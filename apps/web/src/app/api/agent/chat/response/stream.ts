import { stringifyJsonSafe } from "@marble/lib/json";
import type { AgentChatWireEvent } from "../events";

type CreateStreamWriterInput = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  onPayload: (payload: AgentChatWireEvent) => void;
};

export const createStreamWriter = ({
  controller,
  encoder,
  onPayload,
}: CreateStreamWriterInput) => {
  let closed = false;

  const send = (payload: AgentChatWireEvent) => {
    if (closed) return;
    try {
      controller.enqueue(
        encoder.encode(`data: ${stringifyJsonSafe(payload)}\n\n`),
      );
      onPayload(payload);
    } catch (error) {
      console.error("[/api/agent/chat] stream write failed", error);
      closed = true;
      try {
        controller.error(error);
      } catch (controllerError) {
        console.warn(
          "[/api/agent/chat] stream controller error failed",
          controllerError,
        );
      }
    }
  };

  const close = () => {
    if (closed) return;
    closed = true;
    try {
      controller.close();
    } catch (error) {
      console.warn("[/api/agent/chat] stream close failed", error);
    }
  };

  return {
    close,
    send,
  };
};
