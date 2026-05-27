import "server-only";
import {
  buildMarbleAgentTurnPrompt,
  createMarbleAgentSession,
  type MarbleAgentHandoffRequest,
  type MarbleAgentProvider,
  type MarbleAgentVariant,
  REQUEST_HANDOFF_TOOL_NAME,
  resolveAgentModelConfig,
} from "@marble/agent";
import { formatRpcError, getErrorMessage } from "@marble/lib/result";
import type { SupabaseClient } from "@marble/supabase";
import agentRoutesManifest from "../../../../../../agent-routes.generated.json";
import { type AgentChatWireEvent, normalizeAgentEvent } from "../events";
import type { AgentChatRequest } from "../request";
import type { createAgentChatTiming } from "../timing";

type AgentChatTiming = ReturnType<typeof createAgentChatTiming>;

const logRawAgentEvent = (event: unknown) => {
  const e = event as {
    type?: string;
    assistantMessageEvent?: {
      type?: string;
      delta?: string;
    };
    message?: {
      role?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    };
    toolCallId?: string;
    toolName?: string;
    isError?: boolean;
  };
  const summary: Record<string, unknown> = {
    type: e.type,
  };
  if (e.assistantMessageEvent) {
    summary.amType = e.assistantMessageEvent.type;
    summary.deltaLen = e.assistantMessageEvent.delta?.length ?? 0;
  }
  if (e.message) {
    summary.msgRole = e.message.role;
    summary.blocks = e.message.content?.map((b) => ({
      textLen: b.text?.length ?? 0,
      type: b.type,
    }));
  }
  if (e.toolCallId) summary.toolCallId = e.toolCallId;
  if (e.toolName) summary.toolName = e.toolName;
  if (e.isError !== undefined) summary.isError = e.isError;
  console.log("[agent-chat:raw]", JSON.stringify(summary));
};

const logWireEvent = (event: AgentChatWireEvent) => {
  const summary: Record<string, unknown> = {
    type: event.type,
  };
  if (event.type === "message_update" || event.type === "thinking_update") {
    summary.amType = event.assistantMessageEvent.type;
    summary.deltaLen = event.assistantMessageEvent.delta.length;
  }
  if (event.type === "message_end") {
    summary.contentLen = event.content?.length ?? 0;
    summary.suppress = event.suppress;
  }
  if (event.type === "tool_execution_start") summary.toolName = event.toolName;
  if (event.type === "tool_execution_end") {
    summary.isError = event.isError;
    summary.toolCallId = event.toolCallId;
  }
  console.log("[agent-chat:wire]", JSON.stringify(summary));
};

type HandoffContext = {
  brief: string;
  fromVariant: MarbleAgentVariant;
  reason: string;
  toVariant: MarbleAgentVariant;
};

type AgentVariantRunInput = {
  apiKey: string;
  attempt: number;
  exaApiKey: string;
  handoff?: HandoffContext;
  input: AgentChatRequest;
  modelVariant: MarbleAgentVariant;
  profileId: string;
  provider: MarbleAgentProvider;
  send: (event: AgentChatWireEvent) => void;
  serviceSupabase: SupabaseClient;
  supabase: SupabaseClient;
  timing: AgentChatTiming;
  userId: string;
};

type AgentVariantRunResult =
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

const createPromptTimeout = (
  provider: MarbleAgentProvider,
  modelVariant: MarbleAgentVariant,
) =>
  new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Provider "${provider}" ${modelVariant} variant did not respond within ${PROMPT_TIMEOUT_MS / 1000}s. The model may be unreachable, the API key may be invalid, or one of the tool schemas may be rejected.`,
        ),
      );
    }, PROMPT_TIMEOUT_MS);
  });

const errorMessage = (error: unknown) =>
  getErrorMessage(error, formatRpcError(error));

const isTimeoutError = (
  error: unknown,
  provider: MarbleAgentProvider,
  modelVariant: MarbleAgentVariant,
) =>
  error instanceof Error &&
  error.message.startsWith(`Provider "${provider}" ${modelVariant} variant`);

const isHandoffToolEvent = (event: AgentChatWireEvent) =>
  (event.type === "tool_execution_start" ||
    event.type === "tool_execution_end") &&
  event.toolName === REQUEST_HANDOFF_TOOL_NAME;

export const runAgentVariant = async ({
  apiKey,
  attempt,
  exaApiKey,
  handoff,
  input,
  modelVariant,
  profileId,
  provider,
  send,
  serviceSupabase,
  supabase,
  timing,
  userId,
}: AgentVariantRunInput): Promise<AgentVariantRunResult> => {
  let handoffRequest: MarbleAgentHandoffRequest | null = null;
  const modelConfig = resolveAgentModelConfig(provider, modelVariant);
  const modelMetadata = {
    modelId: modelConfig.modelId,
    modelVariant,
    provider,
    thinkingLevel: modelConfig.thinkingLevel,
  };

  timing.mark("agent.variant.start", {
    attempt,
    ...modelMetadata,
  });
  send({
    attempt,
    modelId: modelConfig.modelId,
    modelVariant,
    thinkingLevel: modelMetadata.thinkingLevel,
    type: "marble_agent_variant_start",
  });

  let agentSession: Awaited<ReturnType<typeof createMarbleAgentSession>>;
  try {
    agentSession = await timing.measure(
      "agent.session_build",
      () =>
        createMarbleAgentSession({
          apiKey,
          browserRoutePatterns: agentRoutesManifest.routes,
          exaApiKey,
          modelConfig,
          modelVariant,
          onHandoffRequest: (request) => {
            handoffRequest = request;
            timing.mark("agent.handoff.requested", {
              fromVariant: modelVariant,
              reason: request.reason,
              toVariant: request.variant,
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
    logRawAgentEvent(event);
    const normalized = normalizeAgentEvent(event, session);
    if (normalized) {
      logWireEvent(normalized);
    }
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
          createPromptTimeout(provider, modelVariant),
        ]),
      {
        ...modelMetadata,
      },
    );
  } catch (error) {
    const timeout = isTimeoutError(error, provider, modelVariant);
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
