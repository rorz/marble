import { randomId } from "./entries";
import { parseStreamEvent } from "./stream";
import {
  type AgentChatPageContext,
  type ChatEntry,
  IDLE_WATCHDOG_MS,
  type StreamEvent,
} from "./types";

type ConversationHistoryEntry = {
  content: string;
  role: "assistant" | "user";
};

type SetEntries = (updater: (prev: ChatEntry[]) => ChatEntry[]) => void;

type ReadAgentResponseOptions = {
  controller: AbortController;
  handleEvent: (event: StreamEvent) => void;
  history: ConversationHistoryEntry[];
  message: string;
  pageContext?: AgentChatPageContext;
  setEntries: SetEntries;
};

export const readAgentResponse = async ({
  controller,
  handleEvent,
  history,
  message,
  pageContext,
  setEntries,
}: ReadAgentResponseOptions) => {
  const response = await fetch("/api/agent/chat", {
    body: JSON.stringify({
      context: pageContext,
      history,
      message,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    const responseText = await response.text().catch(() => "(empty response)");
    setEntries((prev) => [
      ...prev,
      {
        code: "TRANSPORT_FAILED",
        id: randomId(),
        kind: "error",
        message: `Chat request failed (HTTP ${response.status} ${response.statusText || "error"}): ${responseText.slice(0, 400)}`,
      },
    ]);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let watchdogFired = false;
  let lastActivityAt = Date.now();
  const watchdog = window.setInterval(() => {
    if (!watchdogFired && Date.now() - lastActivityAt > IDLE_WATCHDOG_MS) {
      watchdogFired = true;
      setEntries((prev) => [
        ...prev,
        {
          id: randomId(),
          kind: "warning",
          message: `No response from the agent for ${Math.round(IDLE_WATCHDOG_MS / 1000)}s. The model or a tool may be hanging. You can keep waiting or start a new thread.`,
        },
      ]);
    }
  }, 5000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lastActivityAt = Date.now();
      buffer += decoder.decode(value, {
        stream: true,
      });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const outcome = parseStreamEvent(block);
        if (outcome.kind === "ok") {
          lastActivityAt = Date.now();
          handleEvent(outcome.event);
        } else if (outcome.kind === "parse_error") {
          setEntries((prev) => [
            ...prev,
            {
              code: "STREAM_PARSE_FAILED",
              id: randomId(),
              kind: "error",
              message: `Stream parse error: ${outcome.error}. Raw chunk: ${outcome.raw.slice(0, 200)}`,
            },
          ]);
        }
      }
    }
  } finally {
    window.clearInterval(watchdog);
  }
};
