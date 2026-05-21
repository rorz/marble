import "server-only";
import {
  buildSystemPrompt,
  resolveMarbleAgentClarification,
} from "@marble/agent";
import { stringifyJsonSafe } from "@marble/lib/json";
import { env } from "@/env";
import { getCurrentUser } from "@/lib/auth";
import type { AgentChatWireEvent } from "./events";
import { buildAgentPrompt } from "./prompt";
import { providerApiKey } from "./provider";
import { type AgentChatRequest, requestSchema } from "./request";
import { createAgentChatStreamResponse } from "./response";
import { createAgentChatTiming } from "./timing";

const DEBUG_PROMPT_COMMAND = "/debug prompt";
const STREAM_RESPONSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream",
};

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
  ].join("\n");

export const POST = async (req: Request) => {
  const timing = createAgentChatTiming(req);
  const user = await timing.measure("auth.user", () => getCurrentUser());
  if (!user) {
    timing.finish("unauthorized");
    return new Response("Unauthorized", {
      headers: timing.headers(),
      status: 401,
    });
  }

  const parsed = await timing.measure("request.parse", async () =>
    requestSchema.safeParse(await req.json().catch(() => null)),
  );
  if (!parsed.success) {
    timing.finish("bad_request");
    return new Response("Bad Request", {
      headers: timing.headers(),
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

    timing.finish("debug_prompt");
    return new Response(`data: ${payload}\n\ndata: ${complete}\n\n`, {
      headers: timing.headers(STREAM_RESPONSE_HEADERS),
    });
  }

  const provider = env.MARBLE_AGENT_PROVIDER;
  const clarification = await timing.measure("clarification.resolve", () =>
    resolveMarbleAgentClarification(parsed.data),
  );
  const apiKey = clarification
    ? null
    : await timing.measure(
        "provider.key",
        () => providerApiKey(provider) ?? null,
        {
          provider,
        },
      );
  if (!clarification && !apiKey) {
    timing.finish("provider_key_missing", {
      provider,
    });
    return new Response(
      `Provider "${provider}" is configured but its API key is missing.`,
      {
        headers: timing.headers(),
        status: 500,
      },
    );
  }

  return createAgentChatStreamResponse({
    apiKey,
    clarification,
    input: parsed.data,
    provider,
    timing,
    user,
  });
};
