import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { createEventLogger, type LogEntry } from "./log";
import {
  type ExplorerProvider,
  type ExplorerVariant,
  resolveExplorerModel,
} from "./models";
import { buildExplorerSystemPrompt, buildExploreTurnPrompt } from "./prompt";
import type { ExplorerState, ProbeExecutor } from "./state";
import { buildExplorerTools } from "./tools";

export type ExplorerSessionConfig = {
  apiKey: string;
  executor: ProbeExecutor;
  onLog?: (entry: LogEntry) => void;
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

  const unsubscribe = config.onLog
    ? session.subscribe(createEventLogger(config.onLog))
    : undefined;
  try {
    await session.prompt(buildExploreTurnPrompt(config.state.model.host));
  } finally {
    unsubscribe?.();
    session.dispose();
  }
};
