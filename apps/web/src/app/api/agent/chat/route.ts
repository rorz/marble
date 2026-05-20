import "server-only";
import {
  createMarbleAgentSession,
  type MarbleAgentProvider,
} from "@marble/agent";
import { z } from "zod";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  resolveAgentProfileId,
} from "@/lib/supabase/service-role";

const requestSchema = z.object({
  message: z.string().min(1),
});

const providerApiKey = (provider: MarbleAgentProvider): string | undefined => {
  switch (provider) {
    case "anthropic":
      return env.ANTHROPIC_API_KEY;
    case "google":
      return env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "openai":
      return env.OPENAI_API_KEY;
  }
};

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

  const provider = env.MARBLE_AGENT_PROVIDER;
  const apiKey = providerApiKey(provider);
  if (!apiKey) {
    return new Response(
      `Provider "${provider}" is configured but its API key is missing.`,
      {
        status: 500,
      },
    );
  }

  const profileId = await resolveAgentProfileId(user.id);
  if (!profileId) {
    return new Response("Agent profile not found for user", {
      status: 500,
    });
  }

  const supabase = await createClient();
  const serviceSupabase = createServiceRoleClient();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      console.info("[/api/agent/chat] client cancelled stream");
    },
    async start(controller) {
      let closed = false;
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          closed = true;
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
        error instanceof Error ? error.message : String(error);

      console.info("[/api/agent/chat] stream start");
      send({
        provider,
        type: "marble_session_starting",
      });

      let agentSession: Awaited<ReturnType<typeof createMarbleAgentSession>>;
      try {
        agentSession = await createMarbleAgentSession({
          apiKey,
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
        send({
          skipped,
          type: "marble_session_warnings",
        });
      }

      let unsubscribed = false;
      const unsubscribe = session.subscribe((event) => {
        if (unsubscribed) return;
        try {
          send(event);
        } catch (sendError) {
          console.error("[/api/agent/chat] send failed", sendError);
        }
      });

      const PROMPT_TIMEOUT_MS = 60_000;
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
          session.prompt(parsed.data.message),
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
