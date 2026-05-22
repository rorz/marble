import "server-only";
import {
  buildMarbleAgentTurnPrompt,
  createMarbleAgentSession,
  type MarbleAgentHandoffRequest,
  type MarbleAgentHandoffTarget,
  type MarbleAgentModelTier,
  type MarbleAgentProvider,
  REQUEST_HANDOFF_TOOL_NAME,
  resolveAgentModelConfig,
} from "@marble/agent";
import { formatRpcError, getErrorMessage } from "@marble/lib/result";
import type { SupabaseClient } from "@marble/supabase";
import { type AgentChatWireEvent, normalizeAgentEvent } from "../events";
import type { AgentChatRequest } from "../request";
import type { createAgentChatTiming } from "../timing";

type AgentChatTiming = ReturnType<typeof createAgentChatTiming>;

type HandoffContext = {
  brief: string;
  fromTier: MarbleAgentModelTier;
  reason: string;
  toTier: MarbleAgentModelTier;
};

type AgentTierRunInput = {
  apiKey: string;
  attempt: number;
  handoff?: HandoffContext;
  input: AgentChatRequest;
  modelTier: MarbleAgentModelTier;
  profileId: string;
  provider: MarbleAgentProvider;
  send: (event: AgentChatWireEvent) => void;
  serviceSupabase: SupabaseClient;
  supabase: SupabaseClient;
  timing: AgentChatTiming;
  userId: string;
};

type AgentTierRunResult =
  | {
      kind: "complete";
    }
  | {
      handoff: MarbleAgentHandoffRequest;
      kind: "handoff";
    }
  | {
      code: "PROMPT_FAILED" | "PROVIDER_TIMEOUT" | "SESSION_INIT_FAILED";
      kind: "failed";
      message: string;
      status: string;
    };

const PROMPT_TIMEOUT_MS = 6 * 60_000;
const HEARTBEAT_MS = 5_000;

const HANDOFF_TARGETS_BY_TIER: Record<
  MarbleAgentModelTier,
  MarbleAgentHandoffTarget[]
> = {
  expert: [],
  rapid: [
    "standard",
    "expert",
  ],
  standard: [
    "expert",
  ],
};

const createPromptTimeout = (
  provider: MarbleAgentProvider,
  modelTier: MarbleAgentModelTier,
) =>
  new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Provider "${provider}" ${modelTier} tier did not respond within ${PROMPT_TIMEOUT_MS / 1000}s. The model may be unreachable, the API key may be invalid, or one of the tool schemas may be rejected.`,
        ),
      );
    }, PROMPT_TIMEOUT_MS);
  });

const errorMessage = (error: unknown) =>
  getErrorMessage(error, formatRpcError(error));

const isTimeoutError = (
  error: unknown,
  provider: MarbleAgentProvider,
  modelTier: MarbleAgentModelTier,
) =>
  error instanceof Error &&
  error.message.startsWith(`Provider "${provider}" ${modelTier} tier`);

const isHandoffToolEvent = (event: AgentChatWireEvent) =>
  (event.type === "tool_execution_start" ||
    event.type === "tool_execution_end") &&
  event.toolName === REQUEST_HANDOFF_TOOL_NAME;

export const runAgentTier = async ({
  apiKey,
  attempt,
  handoff,
  input,
  modelTier,
  profileId,
  provider,
  send,
  serviceSupabase,
  supabase,
  timing,
  userId,
}: AgentTierRunInput): Promise<AgentTierRunResult> => {
  let handoffRequest: MarbleAgentHandoffRequest | null = null;
  const modelConfig = resolveAgentModelConfig(provider, modelTier);
  const modelMetadata = {
    modelId: modelConfig.modelId,
    modelTier,
    provider,
    thinkingLevel: modelConfig.thinkingLevel,
  };

  timing.mark("agent.tier.start", {
    attempt,
    ...modelMetadata,
  });
  send({
    attempt,
    modelId: modelConfig.modelId,
    modelTier,
    thinkingLevel: modelMetadata.thinkingLevel,
    type: "marble_agent_tier_start",
  });

  let agentSession: Awaited<ReturnType<typeof createMarbleAgentSession>>;
  try {
    agentSession = await timing.measure(
      "agent.session_build",
      () =>
        createMarbleAgentSession({
          apiKey,
          handoffTargets: HANDOFF_TARGETS_BY_TIER[modelTier],
          modelConfig,
          modelTier,
          onHandoffRequest: (request) => {
            handoffRequest = request;
            timing.mark("agent.handoff.requested", {
              fromTier: modelTier,
              reason: request.reason,
              toTier: request.tier,
            });
          },
          profileId,
          provider,
          serviceSupabase,
          supabase,
          userId,
        }),
      modelMetadata,
    );
  } catch (error) {
    console.error("[/api/agent/chat] SESSION_INIT_FAILED", error);
    return {
      code: "SESSION_INIT_FAILED",
      kind: "failed",
      message: errorMessage(error),
      status: "session_init_failed",
    };
  }

  timing.mark("agent.session_built", {
    ...modelMetadata,
    skippedTools: agentSession.skipped.length,
    toolCount: agentSession.session.getActiveToolNames().length,
  });
  send({
    type: "marble_session_built",
  });

  const { dispose, session, skipped } = agentSession;
  if (skipped.length > 0) {
    console.warn(
      `[/api/agent/chat] ${skipped.length} tool(s) skipped during build:`,
      skipped,
    );
  }

  let unsubscribed = false;
  const unsubscribe = session.subscribe((event) => {
    if (unsubscribed) return;
    const normalized = normalizeAgentEvent(event, session);
    if (normalized && !isHandoffToolEvent(normalized)) {
      send(normalized);
    }
  });

  const promptStartedAt = Date.now();
  const heartbeat = setInterval(() => {
    send({
      elapsedMs: Date.now() - promptStartedAt,
      type: "marble_session_heartbeat",
    });
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    if (!unsubscribed) {
      unsubscribed = true;
      try {
        unsubscribe();
      } catch (error) {
        console.warn("[/api/agent/chat] unsubscribe failed", error);
      }
    }
    try {
      dispose();
    } catch (error) {
      console.warn("[/api/agent/chat] dispose failed", error);
    }
  };

  try {
    await timing.measure(
      "agent.prompt",
      () =>
        Promise.race([
          session.prompt(
            buildMarbleAgentTurnPrompt(input, {
              handoff,
            }),
          ),
          createPromptTimeout(provider, modelTier),
        ]),
      {
        ...modelMetadata,
      },
    );
  } catch (error) {
    const timeout = isTimeoutError(error, provider, modelTier);
    console.error(
      `[/api/agent/chat] ${timeout ? "PROVIDER_TIMEOUT" : "PROMPT_FAILED"}`,
      error,
    );
    cleanup();
    return {
      code: timeout ? "PROVIDER_TIMEOUT" : "PROMPT_FAILED",
      kind: "failed",
      message: errorMessage(error),
      status: timeout ? "provider_timeout" : "prompt_failed",
    };
  }

  cleanup();
  if (handoffRequest) {
    return {
      handoff: handoffRequest,
      kind: "handoff",
    };
  }

  return {
    kind: "complete",
  };
};
