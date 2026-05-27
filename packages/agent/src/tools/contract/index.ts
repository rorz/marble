import { defineTool } from "@earendil-works/pi-coding-agent";
import { marbleOperations } from "@marble/contracts";
import { formatRpcError } from "@marble/lib/result";
import { z } from "zod";
import { toolPromptMetadataFor } from "./guidance";
import { prepareToolCallInput } from "./prepare-input";
import { prepareToolSchema } from "./schema";
import { summarizeToolResult } from "./summarize-output";

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

export type DispatchTable = Record<
  string,
  Record<string, (input: unknown) => Promise<unknown>>
>;

export type SkippedTool = {
  reason: string;
  toolName: string;
};

type ContractToolBuildReport = {
  skipped: SkippedTool[];
  tools: ReturnType<typeof defineTool>[];
};

type ContractToolBuildOptions = {
  toolNames?: ReadonlySet<string>;
};

type ContractToolBuildOutcome =
  | {
      kind: "ok";
      tool: ReturnType<typeof defineTool>;
    }
  | {
      kind: "skipped";
      reason: string;
      toolName: string;
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

const buildContractToolForOperation = (
  dispatch: DispatchTable,
  resourceName: string,
  opName: string,
  operation: ContractOperation,
): ContractToolBuildOutcome => {
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

export const buildContractTools = (
  dispatch: DispatchTable,
  options: ContractToolBuildOptions = {},
): ContractToolBuildReport => {
  const tools: ReturnType<typeof defineTool>[] = [];
  const skipped: SkippedTool[] = [];
  for (const [resourceName, ops] of Object.entries(marbleOperations)) {
    for (const [opName, operation] of Object.entries(
      ops as Record<string, ContractOperation>,
    )) {
      const toolName = toToolName(resourceName, opName);
      if (options.toolNames && !options.toolNames.has(toolName)) {
        continue;
      }

      const outcome = buildContractToolForOperation(
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
