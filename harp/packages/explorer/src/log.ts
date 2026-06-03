import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

/**
 * Maps Pi's raw {@link AgentSessionEvent} stream into HARP's structured
 * "captain's log": the agent's thinking (chain-of-thought), narration, the
 * actions it takes (probe / rename / merge), and each action's result.
 */

export type LogEntryKind =
  | "thinking"
  | "message"
  | "action"
  | "result"
  | "error"
  | "info";

export type LogEntry = {
  at: string;
  kind: LogEntryKind;
  text: string;
};

type LooseEvent = {
  args?: unknown;
  assistantMessageEvent?: {
    delta?: string;
    type?: string;
  };
  isError?: boolean;
  message?: unknown;
  result?: unknown;
  toolName?: string;
  type?: string;
};

const extractAssistantText = (message: unknown): string | undefined => {
  const msg = message as {
    content?: unknown;
    role?: unknown;
  };
  if (msg.role !== "assistant" || !Array.isArray(msg.content)) {
    return undefined;
  }
  const text = msg.content
    .map((block) => {
      const part = block as {
        text?: unknown;
        type?: unknown;
      };
      return part.type === "text" && typeof part.text === "string"
        ? part.text
        : "";
    })
    .join("");
  return text.trim().length > 0 ? text : undefined;
};

const extractToolText = (result: unknown): string | undefined => {
  const content = (
    result as {
      content?: unknown;
    }
  ).content;
  if (!Array.isArray(content)) {
    return undefined;
  }
  const text = content
    .map((block) => {
      const part = block as {
        text?: unknown;
        type?: unknown;
      };
      return part.type === "text" && typeof part.text === "string"
        ? part.text
        : "";
    })
    .filter((line) => line.length > 0)
    .join("\n");
  return text.length > 0 ? text : undefined;
};

const formatAction = (toolName: string | undefined, args: unknown): string => {
  const a = (args ?? {}) as Record<string, unknown>;
  if (toolName === "probe") {
    return `probe ${String(a.method ?? "")} ${String(a.path ?? "")}`.trim();
  }
  if (toolName === "rename_resource") {
    return `rename ${String(a.from)} → ${String(a.to)}`;
  }
  if (toolName === "merge_instance") {
    return `merge ${String(a.resource)} ⇒ ${String(a.into)}`;
  }
  if (toolName === "read_model") {
    return "read the current map";
  }
  return toolName ?? "tool";
};

export const createEventLogger = (onLog: (entry: LogEntry) => void) => {
  let thinking = "";
  const emit = (kind: LogEntryKind, text: string) =>
    onLog({
      at: new Date().toISOString(),
      kind,
      text,
    });
  const flushThinking = () => {
    const buffered = thinking.trim();
    thinking = "";
    if (buffered) {
      emit("thinking", buffered);
    }
  };

  return (event: AgentSessionEvent) => {
    const e = event as LooseEvent;
    if (
      e.type === "message_update" &&
      e.assistantMessageEvent?.type === "thinking_delta"
    ) {
      thinking += e.assistantMessageEvent.delta ?? "";
      return;
    }
    if (e.type === "message_update") {
      return;
    }
    flushThinking();
    if (e.type === "message_end") {
      const text = extractAssistantText(e.message);
      if (text) {
        emit("message", text);
      }
      return;
    }
    if (e.type === "tool_execution_start") {
      emit("action", formatAction(e.toolName, e.args));
      return;
    }
    if (e.type === "tool_execution_end") {
      emit(
        e.isError ? "error" : "result",
        extractToolText(e.result) ?? `${e.toolName ?? "tool"} done`,
      );
    }
  };
};
