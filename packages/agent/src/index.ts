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
import type { SupabaseClient } from "@marble/supabase";
import { wizardSkillContent, wizardSkillPath } from "@marble/wizard";
import { z } from "zod";

export type MarbleAgentProvider = "anthropic" | "google" | "openai";

const resolveAgentModel = (provider: MarbleAgentProvider) => {
  switch (provider) {
    case "anthropic":
      return getModel("anthropic", "claude-opus-4-5");
    case "google":
      return getModel("google", "gemini-2.5-pro");
    case "openai":
      return getModel("openai", "gpt-5");
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
  const pretty = JSON.stringify(result, null, 2);
  if (pretty.length <= MAX_RESULT_PREVIEW) return pretty;
  return `${pretty.slice(0, MAX_RESULT_PREVIEW)}\n... (truncated; full result in tool details)`;
};

type PreparedSchema = {
  schema: Record<string, unknown>;
  wrapped: boolean;
};

const prepareToolSchema = (raw: unknown): PreparedSchema => {
  if (typeof raw !== "object" || raw === null) {
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
  const candidate = raw as Record<string, unknown>;
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
          const result = await dispatch[resourceName][opName](callInput);
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
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                text: `${toolName} failed: ${message}`,
                type: "text" as const,
              },
            ],
            details: {
              error: message,
              result: undefined,
            } as {
              error?: string;
              result?: unknown;
            },
            isError: true,
          };
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

const ESSENTIAL_TOOL_NAMES = new Set([
  "marble_cells_get",
  "marble_cells_set_manual_value",
  "marble_columns_create",
  "marble_columns_list",
  "marble_programs_create",
  "marble_programs_list_for_editor",
  "marble_programs_update",
  "marble_projects_get",
  "marble_projects_get_most_recent_project",
  "marble_projects_list",
  "marble_rows_get",
  "marble_rows_list",
  "marble_rows_update",
  "marble_tables_create",
  "marble_tables_get",
  "marble_tables_insert_rows",
  "marble_tables_list",
]);

const buildMarbleTools = (client: RouterClient): ToolBuildReport => {
  const dispatch = client as unknown as DispatchTable;
  const tools: ReturnType<typeof defineTool>[] = [];
  const skipped: SkippedTool[] = [];
  for (const [resourceName, ops] of Object.entries(marbleOperations)) {
    for (const [opName, operation] of Object.entries(
      ops as Record<string, ContractOperation>,
    )) {
      const toolName = toToolName(resourceName, opName);
      if (!ESSENTIAL_TOOL_NAMES.has(toolName)) {
        skipped.push({
          reason: "Not in v1 essential whitelist (out-of-scope for now)",
          toolName,
        });
        continue;
      }
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
