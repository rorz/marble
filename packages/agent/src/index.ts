import "server-only";
import {
  type AgentSession,
  type AgentSessionEvent,
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import type { SupabaseClient } from "@marble/supabase";
import {
  type MarbleAgentModelTier,
  type MarbleAgentProvider,
  resolveAgentModel,
  resolveAgentThinkingLevel,
} from "./models";
import { createMarbleResourceLoader } from "./resource-loader";
import {
  buildMarbleTools,
  type MarbleAgentHandoffRequest,
  type MarbleAgentHandoffTarget,
  type SkippedTool,
} from "./tools";

export { resolveMarbleAgentClarification } from "./clarification";
export {
  MARBLE_AGENT_MODEL_TIERS,
  type MarbleAgentModelTier,
  type MarbleAgentProvider,
  resolveAgentModel,
  resolveAgentThinkingLevel,
} from "./models";
export { buildSystemPrompt, MARBLE_AGENT_TURN_GUIDANCE } from "./prompt";
export type {
  ClientAction,
  MarbleAgentHandoffRequest,
  MarbleAgentHandoffTarget,
} from "./tools";
export { REQUEST_HANDOFF_TOOL_NAME } from "./tools";

export type MarbleAgentSessionConfig = {
  apiKey: string;
  handoffTargets?: MarbleAgentHandoffTarget[];
  modelTier?: MarbleAgentModelTier;
  onHandoffRequest?: (request: MarbleAgentHandoffRequest) => void;
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
  const modelTier = config.modelTier ?? "rapid";
  const model = resolveAgentModel(config.provider, modelTier);

  const routerClient = createSupabaseClientRouterClient({
    profileId: config.profileId,
    serviceSupabase: config.serviceSupabase,
    supabase: config.supabase,
    userId: config.userId,
  });

  const { skipped, tools } = buildMarbleTools(routerClient, {
    handoffTargets: config.handoffTargets,
    onHandoffRequest: config.onHandoffRequest,
  });

  const { session } = await createAgentSession({
    authStorage: auth,
    customTools: tools,
    model,
    modelRegistry,
    noTools: "builtin",
    resourceLoader: createMarbleResourceLoader(),
    sessionManager: SessionManager.inMemory(),
    thinkingLevel: resolveAgentThinkingLevel(modelTier),
    tools: tools.map((tool) => tool.name),
  });

  return {
    dispose: () => {
      session.dispose();
    },
    session,
    sessionId: session.sessionId,
    skipped,
  };
};

export type { AgentSessionEvent };
