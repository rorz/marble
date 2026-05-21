import "server-only";
import {
  createMarbleAgentSession,
  type MarbleAgentProvider,
} from "@marble/agent";
import { stringifyJsonSafe } from "@marble/lib/json";
import { formatRpcError, getErrorMessage } from "@marble/lib/result";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  resolveAgentProfileId,
} from "@/lib/supabase/service-role";
import { resolveConduitDecision } from "./conduit";
import { type AgentChatWireEvent, normalizeAgentEvent } from "./events";
import { buildAgentPrompt } from "./prompt";
import type { AgentChatRequest } from "./request";
import type { createAgentChatTiming } from "./timing";

type AgentChatTiming = ReturnType<typeof createAgentChatTiming>;

type AgentClarification = {
  reason: string;
  response: string;
};

type AuthenticatedUser = {
  id: string;
};

type AgentChatStreamResponseInput = {
  apiKey: null | string;
  clarification: AgentClarification | null;
  input: AgentChatRequest;
  provider: MarbleAgentProvider;
  timing: AgentChatTiming;
  user: AuthenticatedUser;
};

const PROMPT_TIMEOUT_MS = 6 * 60_000;
const HEARTBEAT_MS = 5_000;
const STREAM_RESPONSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream",
};

const createPromptTimeout = (provider: MarbleAgentProvider) =>
  new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Provider "${provider}" did not respond within ${PROMPT_TIMEOUT_MS / 1000}s. The model may be unreachable, the API key may be invalid, or one of the tool schemas may be rejected.`,
        ),
      );
    }, PROMPT_TIMEOUT_MS);
  });

export const createAgentChatStreamResponse = ({
  apiKey,
  clarification,
  input,
  provider,
  timing,
  user,
}: AgentChatStreamResponseInput) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      timing.mark("stream.cancel");
      timing.finish("cancelled", {
        provider,
      });
    },
    async start(controller) {
      let closed = false;
      const send = (payload: AgentChatWireEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${stringifyJsonSafe(payload)}\n\n`),
          );
          timing.observeWireEvent(payload);
        } catch (error) {
          console.error("[/api/agent/chat] stream write failed", error);
          closed = true;
          try {
            controller.error(error);
          } catch {}
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };
      const errorMessage = (error: unknown) =>
        getErrorMessage(error, formatRpcError(error));

      timing.mark("stream.start", {
        provider,
      });
      send({
        provider,
        type: "marble_session_starting",
      });

      if (clarification) {
        send({
          reason: clarification.reason,
          route: "direct",
          type: "marble_conduit_decision",
        });
        send({
          content: clarification.response,
          type: "message_end",
        });
        send({
          type: "marble_session_complete",
        });
        timing.finish("clarification", {
          provider,
        });
        close();
        return;
      }

      if (!apiKey) {
        send({
          code: "SESSION_INIT_FAILED",
          message: `Provider "${provider}" is configured but its API key is missing.`,
          type: "marble_session_error",
        });
        timing.finish("provider_key_missing", {
          provider,
        });
        close();
        return;
      }

      const conduitDecision = await timing.measure(
        "conduit.resolve",
        () =>
          resolveConduitDecision({
            apiKey,
            input,
            provider,
          }),
        {
          provider,
        },
      );
      console.info("[/api/agent/chat] conduit decision", {
        modelTier:
          conduitDecision.route === "agent"
            ? conduitDecision.modelTier
            : undefined,
        reason: conduitDecision.reason,
        route: conduitDecision.route,
      });
      send({
        modelTier:
          conduitDecision.route === "agent"
            ? conduitDecision.modelTier
            : undefined,
        reason: conduitDecision.reason,
        route: conduitDecision.route,
        type: "marble_conduit_decision",
      });

      if (conduitDecision.route === "direct") {
        send({
          content: conduitDecision.response,
          type: "message_end",
        });
        send({
          type: "marble_session_complete",
        });
        timing.finish("direct", {
          provider,
          route: conduitDecision.route,
        });
        close();
        return;
      }

      const profileId = await timing.measure("profile.resolve", () =>
        resolveAgentProfileId(user.id),
      );
      if (!profileId) {
        send({
          code: "SESSION_INIT_FAILED",
          message: "Agent profile not found for user",
          type: "marble_session_error",
        });
        timing.finish("profile_missing", {
          provider,
        });
        close();
        return;
      }

      const { serviceSupabase, supabase } = await timing.measure(
        "supabase.clients",
        async () => ({
          serviceSupabase: createServiceRoleClient(),
          supabase: await createClient(),
        }),
      );

      let agentSession: Awaited<ReturnType<typeof createMarbleAgentSession>>;
      try {
        agentSession = await timing.measure(
          "agent.session_build",
          () =>
            createMarbleAgentSession({
              apiKey,
              modelTier: conduitDecision.modelTier,
              profileId,
              provider,
              serviceSupabase,
              supabase,
              userId: user.id,
            }),
          {
            modelTier: conduitDecision.modelTier,
            provider,
          },
        );
      } catch (error) {
        console.error("[/api/agent/chat] SESSION_INIT_FAILED", error);
        send({
          code: "SESSION_INIT_FAILED",
          message: errorMessage(error),
          type: "marble_session_error",
        });
        timing.finish("session_init_failed", {
          provider,
        });
        close();
        return;
      }

      timing.mark("agent.session_built", {
        skippedTools: agentSession.skipped.length,
      });
      send({
        type: "marble_session_built",
      });

      const { session, dispose, skipped } = agentSession;

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
        if (normalized) {
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
          } catch {}
        }
        try {
          dispose();
        } catch {}
        close();
      };

      try {
        await timing.measure(
          "agent.prompt",
          () =>
            Promise.race([
              session.prompt(buildAgentPrompt(input)),
              createPromptTimeout(provider),
            ]),
          {
            modelTier: conduitDecision.modelTier,
            provider,
          },
        );
        send({
          type: "marble_session_complete",
        });
        timing.finish("complete", {
          modelTier: conduitDecision.modelTier,
          provider,
          route: conduitDecision.route,
        });
      } catch (error) {
        const isTimeout =
          error instanceof Error &&
          error.message.startsWith(`Provider "${provider}" did not respond`);
        console.error(
          `[/api/agent/chat] ${isTimeout ? "PROVIDER_TIMEOUT" : "PROMPT_FAILED"}`,
          error,
        );
        send({
          code: isTimeout ? "PROVIDER_TIMEOUT" : "PROMPT_FAILED",
          message: errorMessage(error),
          type: "marble_session_error",
        });
        timing.finish(isTimeout ? "provider_timeout" : "prompt_failed", {
          modelTier: conduitDecision.modelTier,
          provider,
          route: conduitDecision.route,
        });
      } finally {
        cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: timing.headers(STREAM_RESPONSE_HEADERS),
  });
};
