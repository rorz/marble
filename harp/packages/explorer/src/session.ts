import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { buildCoverage, type CoverageMap } from "@harp/core";
import { createEventLogger, type LogEntry } from "./log";
import {
  type ExplorerProvider,
  type ExplorerVariant,
  resolveExplorerModel,
} from "./models";
import {
  buildChatTurnPrompt,
  buildExplorerSystemPrompt,
  buildExploreTurnPrompt,
  buildRefineTurnPrompt,
} from "./prompt";
import {
  type ExplorerState,
  finalizeModel,
  type ProbeExecutor,
  summarizeModel,
} from "./state";
import { buildExplorerTools } from "./tools";

export type ExplorerSessionConfig = {
  apiKey: string;
  executor?: ProbeExecutor;
  message?: string;
  mode?: "explore" | "refine";
  onLog?: (entry: LogEntry) => void;
  onProgress?: (coverage: CoverageMap) => void;
  provider: ExplorerProvider;
  state: ExplorerState;
  variant?: ExplorerVariant;
};

/**
 * Runs one agentic exploration turn: builds a Pi coding-agent session with the
 * explorer's tools and the chosen provider/model, drives a single prompt to
 * completion (tools execute internally), then disposes. State mutations land on
 * `config.state`.
 */
export const runExplore = async (
  config: ExplorerSessionConfig,
): Promise<void> => {
  const auth = AuthStorage.inMemory();
  auth.setRuntimeApiKey(config.provider, config.apiKey);

  const modelRegistry = ModelRegistry.create(auth);
  const modelConfig = resolveExplorerModel(config.provider, config.variant);
  const tools = buildExplorerTools(config.state, config.executor);
  const resourceLoader = new DefaultResourceLoader({
    agentDir: process.cwd(),
    cwd: process.cwd(),
    noContextFiles: true,
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    noThemes: true,
    systemPrompt: buildExplorerSystemPrompt(),
  });

  const { session } = await createAgentSession({
    authStorage: auth,
    customTools: tools,
    model: modelConfig.model,
    modelRegistry,
    noTools: "builtin",
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    thinkingLevel: modelConfig.thinkingLevel,
    tools: tools.map((tool) => tool.name),
  });

  const host = config.state.model.host;
  const modelSummary = summarizeModel(config.state);
  const turnPrompt = config.message
    ? buildChatTurnPrompt(host, modelSummary, config.message)
    : config.mode === "refine"
      ? buildRefineTurnPrompt(host, modelSummary)
      : buildExploreTurnPrompt(host, modelSummary);

  const logger = config.onLog ? createEventLogger(config.onLog) : undefined;
  const onProgress = config.onProgress;
  // Stream the growing map after every tool finishes, so the dashboard fills in
  // live instead of waiting for the whole turn to complete.
  const handle = (event: Parameters<NonNullable<typeof logger>>[0]) => {
    logger?.(event);
    if (
      onProgress &&
      (
        event as {
          type?: string;
        }
      ).type === "tool_execution_end"
    ) {
      onProgress(buildCoverage(finalizeModel(config.state)));
    }
  };
  const unsubscribe =
    logger || onProgress ? session.subscribe(handle) : undefined;
  try {
    await session.prompt(turnPrompt);
  } finally {
    unsubscribe?.();
    session.dispose();
  }
};
