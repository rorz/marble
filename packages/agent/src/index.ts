// harness-ignore: max-file-lines -- locked-down agent runtime; auth + skill loader + tool builder + session factory share tightly-coupled state and shape, refactor after v1 surface stabilizes
// Locked-down agent session: built-in fs/shell/web tools are disabled (only
// custom tools are passed). API keys live in process memory only. Tool calls
// stamp the user's Agent profile via the in-process router client.

import "server-only";
import { dirname } from "node:path";
import { getModel } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  type AgentSessionEvent,
  AuthStorage,
  createAgentSession,
  createSyntheticSourceInfo,
  DefaultResourceLoader,
  defineTool,
  ModelRegistry,
  SessionManager,
  type Skill,
} from "@earendil-works/pi-coding-agent";
import { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import { marbleOperations } from "@marble/contracts";
import { safeStringify } from "@marble/lib/json";
import { formatRpcError } from "@marble/lib/result";
import type { SupabaseClient } from "@marble/supabase";
import { wizardSkillContent, wizardSkillPath } from "@marble/wizard";
import { z } from "zod";

export type MarbleAgentProvider = "anthropic" | "google" | "openai";

const resolveAgentModel = (provider: MarbleAgentProvider) => {
  switch (provider) {
    case "anthropic":
      return getModel("anthropic", "claude-opus-4-7");
    case "google":
      return getModel("google", "gemini-3.1-pro-preview");
    case "openai":
      return getModel("openai", "gpt-5.5-pro");
  }
};

const buildSystemPrompt = (): string =>
  [
    "You are **Marble Agent**, an assistant embedded inside the Marble web app.",
    "",
    "Identity:",
    "- You act on behalf of the user through their **Agent profile**.",
    "- Every action you take is recorded as a Marble event and surfaces in their changeset feed.",
    "",
    "Tools:",
    "- Use the `marble_<resource>_<op>` tools to read and modify the user's workspace.",
    "- You do NOT have filesystem, shell, or web access in this environment.",
    "- Prefer named product operations over generic CRUD where they exist.",
    "",
    "Reference (Marble Wizard skill):",
    "",
    wizardSkillContent(),
  ].join("\n");

const buildMarbleSkill = (): Skill => {
  const skillPath = wizardSkillPath();
  return {
    baseDir: dirname(skillPath),
    description:
      "Marble platform expert. Operates as the user's Agent profile via Marble SDK tools.",
    disableModelInvocation: false,
    filePath: skillPath,
    name: "marble-wizard",
    sourceInfo: createSyntheticSourceInfo(skillPath, {
      baseDir: dirname(skillPath),
      origin: "package",
      scope: "user",
      source: "@marble/wizard",
    }),
  };
};

const createMarbleResourceLoader = () =>
  new DefaultResourceLoader({
    agentDir: process.cwd(),
    cwd: process.cwd(),
    noContextFiles: true,
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    noThemes: true,
    skillsOverride: () => ({
      diagnostics: [],
      skills: [
        buildMarbleSkill(),
      ],
    }),
    systemPrompt: buildSystemPrompt(),
  });

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

const camelToSnake = (input: string): string =>
  input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const toToolName = (resourceName: string, opName: string): string =>
  `marble_${camelToSnake(resourceName)}_${camelToSnake(opName)}`;

const MAX_RESULT_PREVIEW = 2000;

const summarizeResult = (result: unknown): string => {
  const pretty = safeStringify(result);
  if (pretty.length <= MAX_RESULT_PREVIEW) return pretty;
  return `${pretty.slice(0, MAX_RESULT_PREVIEW)}\n... (truncated; full result in tool details)`;
};

const JSON_VALUE_SCHEMA = {
  description: "Any JSON-serializable value.",
};

const SCHEMA_INTERNAL_KEYS = new Set([
  "$defs",
  "$schema",
  "definitions",
]);

type PreparedSchema = {
  schema: Record<string, unknown>;
  wrapped: boolean;
};

const isSchemaRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const decodeJsonPointerSegment = (segment: string): string =>
  segment.replace(/~1/g, "/").replace(/~0/g, "~");

const resolveLocalSchemaRef = (
  root: unknown,
  ref: string,
): unknown | undefined => {
  if (!ref.startsWith("#/")) return undefined;

  let current = root;
  for (const segment of ref.slice(2).split("/").map(decodeJsonPointerSegment)) {
    if (!isSchemaRecord(current)) return undefined;
    current = current[segment];
  }

  return current;
};

const sanitizeToolSchemaValue = (
  value: unknown,
  root: unknown,
  seenRefs: ReadonlySet<string>,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeToolSchemaValue(item, root, seenRefs));
  }

  if (!isSchemaRecord(value)) {
    return value;
  }

  if (typeof value.$ref === "string") {
    if (seenRefs.has(value.$ref)) {
      return JSON_VALUE_SCHEMA;
    }

    const target = resolveLocalSchemaRef(root, value.$ref);
    if (target === undefined) {
      return JSON_VALUE_SCHEMA;
    }

    return sanitizeToolSchemaValue(
      target,
      root,
      new Set([
        ...seenRefs,
        value.$ref,
      ]),
    );
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (SCHEMA_INTERNAL_KEYS.has(key)) continue;
    sanitized[key] = sanitizeToolSchemaValue(childValue, root, seenRefs);
  }

  return sanitized;
};

const sanitizeToolSchema = (raw: unknown): unknown =>
  sanitizeToolSchemaValue(raw, raw, new Set());

const prepareToolSchema = (raw: unknown): PreparedSchema => {
  const sanitized = sanitizeToolSchema(raw);

  if (typeof sanitized !== "object" || sanitized === null) {
    return {
      schema: {
        additionalProperties: false,
        properties: {
          input: {
            description: "Tool input.",
          },
        },
        required: [
          "input",
        ],
        type: "object",
      },
      wrapped: true,
    };
  }
  const candidate = sanitized as Record<string, unknown>;
  if (candidate.type === "object") {
    return {
      schema: candidate,
      wrapped: false,
    };
  }
  return {
    schema: {
      additionalProperties: false,
      properties: {
        input: candidate,
      },
      required: [
        "input",
      ],
      type: "object",
    },
    wrapped: true,
  };
};

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

type ToolBuildReport = {
  skipped: SkippedTool[];
  tools: ReturnType<typeof defineTool>[];
};

const buildMarbleTools = (client: RouterClient): ToolBuildReport => {
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

export type MarbleAgentSessionConfig = {
  apiKey: string;
  profileId: string;
  provider: MarbleAgentProvider;
  serviceSupabase?: SupabaseClient;
  supabase: SupabaseClient;
  userId: string;
};

export type MarbleAgentSession = {
  dispose: () => void;
  session: AgentSession;
  sessionId: string;
  skipped: SkippedTool[];
};

export const createMarbleAgentSession = async (
  config: MarbleAgentSessionConfig,
): Promise<MarbleAgentSession> => {
  const auth = AuthStorage.inMemory();
  auth.setRuntimeApiKey(config.provider, config.apiKey);

  const modelRegistry = ModelRegistry.create(auth);
  const model = resolveAgentModel(config.provider);

  const routerClient = createSupabaseClientRouterClient({
    profileId: config.profileId,
    serviceSupabase: config.serviceSupabase,
    supabase: config.supabase,
    userId: config.userId,
  });

  const { skipped, tools } = buildMarbleTools(routerClient);

  const { session } = await createAgentSession({
    authStorage: auth,
    customTools: tools,
    model,
    modelRegistry,
    noTools: "builtin",
    resourceLoader: createMarbleResourceLoader(),
    sessionManager: SessionManager.inMemory(),
    tools: tools.map((tool) => tool.name),
  });

  return {
    dispose: () => {},
    session,
    sessionId: session.sessionId,
    skipped,
  };
};

export type { AgentSessionEvent };
