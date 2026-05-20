import "server-only";
import {
  createMarbleAgentSession,
  type MarbleAgentProvider,
} from "@marble/agent";
import { stringifyJsonSafe } from "@marble/lib/json";
import { formatRpcError, getErrorMessage } from "@marble/lib/result";
import { z } from "zod";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  resolveAgentProfileId,
} from "@/lib/supabase/service-role";
import { type AgentChatWireEvent, normalizeAgentEvent } from "./events";

const requestSchema = z.object({
  context: z
    .object({
      currentResource: z
        .object({
          href: z.string(),
          id: z.string(),
          kind: z.enum([
            "pipe",
            "program",
            "project",
            "source",
            "table",
          ]),
          label: z.string(),
          parent: z
            .object({
              href: z.string(),
              id: z.string(),
              kind: z.literal("project"),
              label: z.string(),
            })
            .optional(),
        })
        .optional(),
      pathname: z.string(),
      search: z.string(),
    })
    .optional(),
  history: z
    .array(
      z.object({
        content: z.string(),
        role: z.enum([
          "assistant",
          "user",
        ]),
      }),
    )
    .max(12)
    .optional(),
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

const formatHistory = (
  history: z.infer<typeof requestSchema>["history"],
): string | null => {
  if (!history || history.length === 0) return null;

  return [
    "Recent chat context:",
    ...history.map(
      (entry) =>
        `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content}`,
    ),
  ].join("\n");
};

const formatPageContext = (
  context: z.infer<typeof requestSchema>["context"],
): string | null => {
  if (!context) return null;

  const lines = [
    "Current Marble page context:",
    `- Path: ${context.pathname}${context.search ? `?${context.search}` : ""}`,
  ];

  if (context.currentResource) {
    lines.push(
      `- Current resource: ${context.currentResource.kind} "${context.currentResource.label}" (${context.currentResource.id})`,
    );

    if (context.currentResource.parent) {
      lines.push(
        `- Parent project: "${context.currentResource.parent.label}" (${context.currentResource.parent.id})`,
      );
    }
  }

  return lines.join("\n");
};

const buildPrompt = (input: z.infer<typeof requestSchema>): string =>
  [
    "Use the context below to resolve references like this/current/here. Verify IDs with tools before mutating data. Do not invent missing instructions, and never infer destructive intent from frustration. Style: answer in one short sentence by default, do not advertise capabilities, and do not use Markdown formatting.",
    formatHistory(input.history),
    formatPageContext(input.context),
    "Current user message:",
    input.message,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

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
      }

      let unsubscribed = false;
      const unsubscribe = session.subscribe((event) => {
        if (unsubscribed) return;
        const normalized = normalizeAgentEvent(event, session);
        if (normalized) {
          send(normalized);
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
          session.prompt(buildPrompt(parsed.data)),
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
