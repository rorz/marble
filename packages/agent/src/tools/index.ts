import { defineTool } from "@earendil-works/pi-coding-agent";
import type { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import { marbleOperations } from "@marble/contracts";
import { formatRpcError } from "@marble/lib/result";
import { z } from "zod";
import { prepareToolSchema } from "../schema";
import { buildBrowserNavigateTool } from "./browser";
import { toolPromptMetadataFor } from "./guidance";
import {
  buildRequestHandoffTool,
  type HandoffToolBuildOptions,
} from "./handoff";
import { prepareToolCallInput } from "./prepare-call";
import { summarizeToolResult } from "./summarize-result";

export type { ClientAction } from "./browser";
export type {
  MarbleAgentHandoffRequest,
  MarbleAgentHandoffTarget,
} from "./handoff";
export { REQUEST_HANDOFF_TOOL_NAME } from "./handoff";

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

type ToolBuildOptions = {
  handoffTargets?: HandoffToolBuildOptions["handoffTargets"];
  onHandoffRequest?: HandoffToolBuildOptions["onHandoffRequest"];
};

type ContractToolDetails = {
  error?: string;
  result?: unknown;
};

const camelToSnake = (input: string): string =>
  input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const toToolName = (resourceName: string, opName: string): string =>
  `marble_${camelToSnake(resourceName)}_${camelToSnake(opName)}`;

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
            } satisfies ContractToolDetails,
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

export const buildMarbleTools = (
  client: RouterClient,
  options: ToolBuildOptions = {},
): ToolBuildReport => {
  const dispatch = client as unknown as DispatchTable;
  const tools: ReturnType<typeof defineTool>[] = [
    buildBrowserNavigateTool(),
  ];
  const skipped: SkippedTool[] = [];
  if (options.handoffTargets?.length && options.onHandoffRequest) {
    tools.push(
      buildRequestHandoffTool({
        handoffTargets: options.handoffTargets,
        onHandoffRequest: options.onHandoffRequest,
      }),
    );
  }

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
