import "server-only";
import type { MarbleAgentModelTier, MarbleAgentProvider } from "@marble/agent";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  resolveAgentProfileId,
} from "@/lib/supabase/service-role";
import type { AgentChatWireEvent } from "../events";
import type { AgentChatRequest } from "../request";
import type { createAgentChatTiming } from "../timing";
import { runAgentTier } from "./run";
import { createStreamWriter } from "./stream";

type AgentChatTiming = ReturnType<typeof createAgentChatTiming>;

type AuthenticatedUser = {
  id: string;
};

type AgentChatStreamResponseInput = {
  apiKey: string;
  exaApiKey: string;
  input: AgentChatRequest;
  provider: MarbleAgentProvider;
  timing: AgentChatTiming;
  user: AuthenticatedUser;
};

type HandoffContext = {
  brief: string;
  fromTier: MarbleAgentModelTier;
  reason: string;
  toTier: MarbleAgentModelTier;
};

const MAX_HANDOFFS_PER_TURN = 2;
const INITIAL_MODEL_TIER: MarbleAgentModelTier = "rapid";
const STREAM_RESPONSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream",
};

const sendSessionError = (
  send: (event: AgentChatWireEvent) => void,
  code: string,
  message: string,
) => {
  send({
    code,
    message,
    type: "marble_session_error",
  });
};

export const createAgentChatStreamResponse = ({
  apiKey,
  exaApiKey,
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
      const { close, send } = createStreamWriter({
        controller,
        encoder,
        onPayload: timing.observeWireEvent,
      });

      timing.mark("stream.start", {
        provider,
      });
      send({
        provider,
        type: "marble_session_starting",
      });

      const profileId = await timing.measure("profile.resolve", () =>
        resolveAgentProfileId(user.id),
      );
      if (!profileId) {
        sendSessionError(
          send,
          "SESSION_INIT_FAILED",
          "Agent profile not found for user",
        );
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

      let handoff: HandoffContext | undefined;
      let handoffCount = 0;
      let modelTier: MarbleAgentModelTier = INITIAL_MODEL_TIER;

      while (true) {
        const result = await runAgentTier({
          apiKey,
          attempt: handoffCount + 1,
          exaApiKey,
          handoff,
          input,
          modelTier,
          profileId,
          provider,
          send,
          serviceSupabase,
          supabase,
          timing,
          userId: user.id,
        });

        if (result.kind === "failed") {
          sendSessionError(send, result.code, result.message);
          timing.finish(result.status, {
            handoffCount,
            modelTier,
            provider,
            route: "agent",
          });
          close();
          return;
        }

        if (result.kind === "complete") {
          send({
            type: "marble_session_complete",
          });
          timing.finish("complete", {
            handoffCount,
            modelTier,
            provider,
            route: "agent",
          });
          close();
          return;
        }

        if (handoffCount >= MAX_HANDOFFS_PER_TURN) {
          sendSessionError(
            send,
            "PROMPT_FAILED",
            "Agent handoff limit reached for this turn.",
          );
          timing.finish("handoff_limit_reached", {
            handoffCount,
            modelTier,
            provider,
            route: "agent",
          });
          close();
          return;
        }

        const nextTier = result.handoff.tier;
        send({
          brief: result.handoff.brief,
          fromTier: modelTier,
          reason: result.handoff.reason,
          toTier: nextTier,
          type: "marble_agent_handoff_requested",
        });
        handoff = {
          brief: result.handoff.brief,
          fromTier: modelTier,
          reason: result.handoff.reason,
          toTier: nextTier,
        };
        handoffCount += 1;
        modelTier = nextTier;
      }
    },
  });

  return new Response(stream, {
    headers: timing.headers(STREAM_RESPONSE_HEADERS),
  });
};
