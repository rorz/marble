import { defineTool } from "@earendil-works/pi-coding-agent";
import type { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import { marbleOperations } from "@marble/contracts";
import { formatRpcError } from "@marble/lib/result";
import { z } from "zod";
import { prepareToolSchema } from "../schema";
import { toolPromptMetadataFor } from "./guidance";
import { prepareToolCallInput } from "./prepare-call";
import { summarizeToolResult } from "./summarize-result";

type RouterClient = ReturnType<typeof createSupabaseClientRouterClient>;

type ContractOperation = {
  input: z.ZodType<unknown>;
  output: z.ZodType<unknown>;
  route: {
    method: string;
    operationId: string;
    path: string;
    summary: string;
  };
};

type DispatchTable = Record<
  string,
  Record<string, (input: unknown) => Promise<unknown>>
>;

export type SkippedTool = {
  reason: string;
  toolName: string;
};

type ToolBuildOutcome =
  | {
      kind: "ok";
      tool: ReturnType<typeof defineTool>;
    }
  | {
      kind: "skipped";
      reason: string;
      toolName: string;
    };

type ToolBuildReport = {
  skipped: SkippedTool[];
  tools: ReturnType<typeof defineTool>[];
};

export type ClientAction = {
  href: string;
  replace?: boolean;
  type: "browser_navigate";
};

type ToolDetails = {
  clientAction?: ClientAction;
  error?: string;
  result?: unknown;
};

const BROWSER_NAVIGATE_TOOL_NAME = "browser_navigate";

const camelToSnake = (input: string): string =>
  input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const toToolName = (resourceName: string, opName: string): string =>
  `marble_${camelToSnake(resourceName)}_${camelToSnake(opName)}`;

const browserNavigateInput = z.object({
  href: z
    .string()
    .min(1)
    .describe("Internal Marble path to navigate to, such as /projects."),
  replace: z
    .boolean()
    .optional()
    .describe("Use history replace instead of push."),
});

const normalizeBrowserHref = (href: string): string => {
  const trimmed = href.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    throw new Error("browser_navigate only accepts internal paths.");
  }

  return trimmed;
};

const buildBrowserNavigateTool = (): ReturnType<typeof defineTool> => {
  const prepared = prepareToolSchema(z.toJSONSchema(browserNavigateInput));

  return defineTool({
    description:
      "Navigate the user's current Marble browser to an internal app path. Use after creating or finding a resource when the user should see it.",
    execute: async (_toolCallId, params) => {
      const input = browserNavigateInput.parse(
        prepared.wrapped
          ? (
              params as {
                input: unknown;
              }
            ).input
          : params,
      );
      const href = normalizeBrowserHref(input.href);
      const clientAction: ClientAction = {
        href,
        replace: input.replace,
        type: "browser_navigate",
      };

      return {
        content: [
          {
            text: `Browser navigation queued to ${href}.`,
            type: "text" as const,
          },
        ],
        details: {
          clientAction,
          result: {
            href,
            replace: input.replace ?? false,
          },
        } satisfies ToolDetails,
      };
    },
    label: "Navigate Browser",
    name: BROWSER_NAVIGATE_TOOL_NAME,
    parameters: prepared.schema as Parameters<
      typeof defineTool
    >[0]["parameters"],
    promptGuidelines: [
      "Use browser_navigate only for internal Marble paths, never for external web browsing.",
      "After creating a resource, navigate to the most useful detail page when its path is known.",
    ],
    promptSnippet:
      "browser_navigate: move the user's current Marble app page to an internal path.",
  });
};

const buildToolDescription = (operation: ContractOperation): string => {
  const promptMetadata = toolPromptMetadataFor(operation.route.operationId);

  return [
    `${operation.route.summary}. (${operation.route.method} ${operation.route.path})`,
    promptMetadata.description,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
};

const buildToolForOperation = (
  dispatch: DispatchTable,
  resourceName: string,
  opName: string,
  operation: ContractOperation,
): ToolBuildOutcome => {
  const toolName = toToolName(resourceName, opName);

  let rawSchema: unknown;
  try {
    rawSchema = z.toJSONSchema(operation.input);
  } catch (error) {
    return {
      kind: "skipped",
      reason: `Schema conversion failed: ${error instanceof Error ? error.message : String(error)}`,
      toolName,
    };
  }

  const prepared = prepareToolSchema(rawSchema);
  const promptMetadata = toolPromptMetadataFor(operation.route.operationId);

  try {
    const tool = defineTool({
      description: buildToolDescription(operation),
      execute: async (_toolCallId, params) => {
        try {
          const callInput = prepared.wrapped
            ? (
                params as {
                  input: unknown;
                }
              ).input
            : params;
          const operationHandler = dispatch[resourceName]?.[opName];
          if (!operationHandler) {
            throw new Error(`No handler found for ${resourceName}.${opName}.`);
          }

          const preparedInput = await prepareToolCallInput({
            dispatch,
            input: callInput,
            operationId: operation.route.operationId,
          });
          const result = await operationHandler(preparedInput);
          return {
            content: [
              {
                text: `${toolName} succeeded.\n\n${summarizeToolResult({
                  operationId: operation.route.operationId,
                  result,
                })}`,
                type: "text" as const,
              },
            ],
            details: {
              error: undefined,
              result,
            } satisfies ToolDetails,
          };
        } catch (error) {
          throw new Error(`${toolName} failed: ${formatRpcError(error)}`, {
            cause: error,
          });
        }
      },
      label: operation.route.summary,
      name: toolName,
      parameters: prepared.schema as Parameters<
        typeof defineTool
      >[0]["parameters"],
      ...(promptMetadata.promptGuidelines
        ? {
            promptGuidelines: promptMetadata.promptGuidelines,
          }
        : {}),
      ...(promptMetadata.promptSnippet
        ? {
            promptSnippet: promptMetadata.promptSnippet,
          }
        : {}),
    });
    return {
      kind: "ok",
      tool,
    };
  } catch (error) {
    return {
      kind: "skipped",
      reason: `defineTool rejected schema: ${error instanceof Error ? error.message : String(error)}`,
      toolName,
    };
  }
};

export const buildMarbleTools = (client: RouterClient): ToolBuildReport => {
  const dispatch = client as unknown as DispatchTable;
  const tools: ReturnType<typeof defineTool>[] = [
    buildBrowserNavigateTool(),
  ];
  const skipped: SkippedTool[] = [];
  for (const [resourceName, ops] of Object.entries(marbleOperations)) {
    for (const [opName, operation] of Object.entries(
      ops as Record<string, ContractOperation>,
    )) {
      const outcome = buildToolForOperation(
        dispatch,
        resourceName,
        opName,
        operation,
      );
      if (outcome.kind === "ok") {
        tools.push(outcome.tool);
      } else {
        skipped.push({
          reason: outcome.reason,
          toolName: outcome.toolName,
        });
      }
    }
  }
  return {
    skipped,
    tools,
  };
};
