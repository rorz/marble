import "server-only";
import {
  buildSystemPrompt,
  createMarbleAgentSession,
  resolveMarbleAgentClarification,
} from "@marble/agent";
import { stringifyJsonSafe } from "@marble/lib/json";
import { formatRpcError, getErrorMessage } from "@marble/lib/result";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  resolveAgentProfileId,
} from "@/lib/supabase/service-role";
import { resolveConduitDecision } from "./conduit";
import { type AgentChatWireEvent, normalizeAgentEvent } from "./events";
import { buildAgentPrompt, buildConduitPrompt } from "./prompt";
import { providerApiKey } from "./provider";
import { type AgentChatRequest, requestSchema } from "./request";

const DEBUG_PROMPT_COMMAND = "/debug prompt";

const buildDebugPromptDump = (input: AgentChatRequest) =>
  [
    "DEBUG PROMPT DUMP",
    "",
    "The Marble Wizard skill is included inside the system prompt below.",
    "",
    "=== SYSTEM PROMPT ===",
    buildSystemPrompt(),
    "",
    "=== AGENT REQUEST PROMPT ===",
    buildAgentPrompt(input),
    "",
    "=== CONDUIT PROMPT ===",
    buildConduitPrompt(input),
  ].join("\n");

export const POST = async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response("Bad Request", {
      status: 400,
    });
  }

  if (parsed.data.message.trim() === DEBUG_PROMPT_COMMAND) {
    const content =
      process.env.NODE_ENV === "production"
        ? "Prompt debug is disabled in production."
        : buildDebugPromptDump(parsed.data);
    const payload = stringifyJsonSafe({
      content,
      type: "message_end",
    } satisfies AgentChatWireEvent);
    const complete = stringifyJsonSafe({
      type: "marble_session_complete",
    } satisfies AgentChatWireEvent);

    return new Response(`data: ${payload}\n\ndata: ${complete}\n\n`, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      },
    });
  }

  const provider = env.MARBLE_AGENT_PROVIDER;
  const clarification = resolveMarbleAgentClarification(parsed.data);
  const apiKey = clarification ? null : providerApiKey(provider);
  if (!clarification && !apiKey) {
    return new Response(
      `Provider "${provider}" is configured but its API key is missing.`,
      {
        status: 500,
      },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      console.info("[/api/agent/chat] client cancelled stream");
    },
    async start(controller) {
      let closed = false;
      const send = (payload: AgentChatWireEvent) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${stringifyJsonSafe(payload)}\n\n`),
          );
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

      console.info("[/api/agent/chat] stream start");
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
        close();
        return;
      }

      if (!apiKey) {
        send({
          code: "SESSION_INIT_FAILED",
          message: `Provider "${provider}" is configured but its API key is missing.`,
          type: "marble_session_error",
        });
        close();
        return;
      }

      const conduitDecision = await resolveConduitDecision({
        apiKey,
        input: parsed.data,
        provider,
      });
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
        close();
        return;
      }

      const profileId = await resolveAgentProfileId(user.id);
      if (!profileId) {
        send({
          code: "SESSION_INIT_FAILED",
          message: "Agent profile not found for user",
          type: "marble_session_error",
        });
        close();
        return;
      }

      const supabase = await createClient();
      const serviceSupabase = createServiceRoleClient();

      let agentSession: Awaited<ReturnType<typeof createMarbleAgentSession>>;
      try {
        agentSession = await createMarbleAgentSession({
          apiKey,
          modelTier: conduitDecision.modelTier,
          profileId,
          provider,
          serviceSupabase,
          supabase,
          userId: user.id,
        });
      } catch (error) {
        console.error("[/api/agent/chat] SESSION_INIT_FAILED", error);
        send({
          code: "SESSION_INIT_FAILED",
          message: errorMessage(error),
          type: "marble_session_error",
        });
        close();
        return;
      }

      console.info("[/api/agent/chat] session built");
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

      const PROMPT_TIMEOUT_MS = 6 * 60_000;
      const HEARTBEAT_MS = 5_000;
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
        await Promise.race([
          session.prompt(buildAgentPrompt(parsed.data)),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  `Provider "${provider}" did not respond within ${PROMPT_TIMEOUT_MS / 1000}s. The model may be unreachable, the API key may be invalid, or one of the tool schemas may be rejected.`,
                ),
              );
            }, PROMPT_TIMEOUT_MS);
          }),
        ]);
        send({
          type: "marble_session_complete",
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
      } finally {
        cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
};
