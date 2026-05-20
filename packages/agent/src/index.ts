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
} from "./models";
import { createMarbleResourceLoader } from "./resource-loader";
import { buildMarbleTools, type SkippedTool } from "./tools";

export {
  type MarbleAgentConduitDecision,
  resolveMarbleAgentConduitDecision,
} from "./conduit";
export type { MarbleAgentModelTier, MarbleAgentProvider } from "./models";
export { resolveAgentModel } from "./models";
export { buildSystemPrompt } from "./prompt";
export type { ClientAction } from "./tools";

export type MarbleAgentSessionConfig = {
  apiKey: string;
  modelTier?: MarbleAgentModelTier;
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
  const modelTier = config.modelTier ?? "deep";
  const model = resolveAgentModel(config.provider, modelTier);

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
    thinkingLevel: modelTier === "fast" ? "minimal" : undefined,
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
