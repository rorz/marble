import "server-only";
import type { MarbleAgentProvider, MarbleAgentVariant } from "@marble/agent";
import { createClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  resolveAgentProfileId,
} from "@/lib/supabase/service-role";
import type { AgentChatWireEvent } from "../events";
import type { AgentChatRequest } from "../request";
import type { createAgentChatTiming } from "../timing";
import { runAgentVariant } from "./run";
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
  fromVariant: MarbleAgentVariant;
  reason: string;
  toVariant: MarbleAgentVariant;
};

const MAX_HANDOFFS_PER_TURN = 2;
const INITIAL_MODEL_VARIANT: MarbleAgentVariant = "concierge";
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
      let modelVariant: MarbleAgentVariant = INITIAL_MODEL_VARIANT;

      while (true) {
        const result = await runAgentVariant({
          apiKey,
          attempt: handoffCount + 1,
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
          userId: user.id,
        });

        if (result.kind === "failed") {
          sendSessionError(send, result.code, result.message);
          timing.finish(result.status, {
            handoffCount,
            modelVariant,
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
            modelVariant,
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
            modelVariant,
            provider,
            route: "agent",
          });
          close();
          return;
        }

        const nextVariant = result.handoff.variant;
        send({
          brief: result.handoff.brief,
          fromVariant: modelVariant,
          reason: result.handoff.reason,
          toVariant: nextVariant,
          type: "marble_agent_handoff_requested",
        });
        handoff = {
          brief: result.handoff.brief,
          fromVariant: modelVariant,
          reason: result.handoff.reason,
          toVariant: nextVariant,
        };
        handoffCount += 1;
        modelVariant = nextVariant;
      }
    },
  });

  return new Response(stream, {
    headers: timing.headers(STREAM_RESPONSE_HEADERS),
  });
};
