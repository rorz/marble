import "server-only";
import {
  type AgentSession,
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import type { SupabaseClient } from "@marble/supabase";
import {
  type MarbleAgentModelConfig,
  type MarbleAgentModelTier,
  type MarbleAgentProvider,
  resolveAgentModelConfig,
} from "./models";
import { createMarbleResourceLoader } from "./resource-loader";
import {
  buildMarbleTools,
  type MarbleAgentHandoffRequest,
  type MarbleAgentHandoffTarget,
  type SkippedTool,
} from "./tools";

type MarbleAgentSessionConfig = {
  apiKey: string;
  browserRoutePatterns?: readonly string[];
  exaApiKey?: string;
  handoffTargets?: MarbleAgentHandoffTarget[];
  modelConfig?: MarbleAgentModelConfig;
  modelTier?: MarbleAgentModelTier;
  onHandoffRequest?: (request: MarbleAgentHandoffRequest) => void;
  profileId: string;
  provider: MarbleAgentProvider;
  serviceSupabase?: SupabaseClient;
  supabase: SupabaseClient;
  userId: string;
};

type MarbleAgentSession = {
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
  const modelConfig =
    config.modelConfig ?? resolveAgentModelConfig(config.provider, modelTier);

  const routerClient = createSupabaseClientRouterClient({
    profileId: config.profileId,
    serviceSupabase: config.serviceSupabase,
    supabase: config.supabase,
    userId: config.userId,
  });

  const { skipped, tools } = buildMarbleTools(routerClient, {
    browserRoutePatterns: config.browserRoutePatterns,
    exaApiKey: config.exaApiKey,
    handoffTargets: config.handoffTargets,
    onHandoffRequest: config.onHandoffRequest,
  });

  const { session } = await createAgentSession({
    authStorage: auth,
    customTools: tools,
    model: modelConfig.model,
    modelRegistry,
    noTools: "builtin",
    resourceLoader: createMarbleResourceLoader(modelTier),
    sessionManager: SessionManager.inMemory(),
    thinkingLevel: modelConfig.thinkingLevel,
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
