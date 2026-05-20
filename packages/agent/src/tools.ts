import { defineTool } from "@earendil-works/pi-coding-agent";
import type { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import { marbleOperations } from "@marble/contracts";
import { safeStringify } from "@marble/lib/json";
import { formatRpcError } from "@marble/lib/result";
import { z } from "zod";
import { prepareToolSchema } from "./schema";

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

const MAX_RESULT_PREVIEW = 2000;

const camelToSnake = (input: string): string =>
  input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const toToolName = (resourceName: string, opName: string): string =>
  `marble_${camelToSnake(resourceName)}_${camelToSnake(opName)}`;

const summarizeResult = (result: unknown): string => {
  const pretty = safeStringify(result);
  if (pretty.length <= MAX_RESULT_PREVIEW) return pretty;
  return `${pretty.slice(0, MAX_RESULT_PREVIEW)}\n... (truncated; full result in tool details)`;
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

  try {
    const tool = defineTool({
      description: `${operation.route.summary}. (${operation.route.method} ${operation.route.path})`,
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

          const result = await operationHandler(callInput);
          return {
            content: [
              {
                text: `${toolName} succeeded.\n\n${summarizeResult(result)}`,
                type: "text" as const,
              },
            ],
            details: {
              error: undefined,
              result,
            } as {
              error?: string;
              result?: unknown;
            },
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
  const tools: ReturnType<typeof defineTool>[] = [];
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
