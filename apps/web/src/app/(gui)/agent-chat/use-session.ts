"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  appendToolToAssistantTurn,
  closePendingToolEntries,
  closeStreamingAssistantEntries,
  commitFinalAssistantMessage,
  randomId,
  suppressAssistantText,
  updateToolEntry,
} from "./entries";
import { buildConversationHistory } from "./history";
import { loadEntries, saveEntries } from "./storage";
import { readAgentResponse } from "./transport";
import type { AgentChatPageContext, ChatEntry, StreamEvent } from "./types";

type UseSessionProps = {
  pageContext?: AgentChatPageContext;
};

type UseSessionResult = {
  draft: string;
  elapsedMs: number;
  entries: ChatEntry[];
  handleNewThread: () => void;
  sendMessage: (text: string) => Promise<void>;
  setDraft: (draft: string) => void;
  statusMessage: string | null;
  streaming: boolean;
};

const formatRouteStatus = (event: StreamEvent): string =>
  event.route === "direct"
    ? "Direct path: answering without tools."
    : event.modelTier === "fast"
      ? "Fast path: handling a tiny concrete request."
      : "Pro path: reasoning through the workflow and context.";

export const useSession = ({
  pageContext,
}: UseSessionProps): UseSessionResult => {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const activeAssistantIdRef = useRef<null | string>(null);
  const activeToolMapRef = useRef(new Map<string, string>());
  const completedToolCallIdsRef = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);
  const sessionResolvedRef = useRef<boolean>(false);

  useEffect(() => {
    setEntries(loadEntries());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveEntries(entries);
  }, [
    entries,
    hydrated,
  ]);

  const handleEvent = useCallback((event: StreamEvent) => {
    if (event.type === "marble_session_starting") {
      setStatusMessage("Choosing model path...");
      return;
    }

    if (event.type === "marble_conduit_decision") {
      setStatusMessage(formatRouteStatus(event));
      return;
    }

    if (event.type === "marble_session_heartbeat") {
      if (typeof event.elapsedMs === "number") {
        setElapsedMs(event.elapsedMs);
      }
      return;
    }

    if (
      event.type === "marble_session_complete" ||
      event.type === "marble_session_error"
    ) {
      sessionResolvedRef.current = true;
      setStatusMessage(null);
    }

    setEntries((prev) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent?.type === "text_delta"
      ) {
        const delta = event.assistantMessageEvent.delta ?? "";
        const activeId = activeAssistantIdRef.current;
        if (activeId) {
          return prev.map((entry) =>
            entry.id === activeId && entry.kind === "assistant"
              ? {
                  ...entry,
                  content: entry.content + delta,
                }
              : entry,
          );
        }
        const newId = randomId();
        activeAssistantIdRef.current = newId;
        return [
          ...prev,
          {
            content: delta,
            id: newId,
            kind: "assistant",
            streaming: true,
          },
        ];
      }

      if (event.type === "message_end") {
        const activeId = activeAssistantIdRef.current;
        activeAssistantIdRef.current = null;
        if (event.suppress) {
          return suppressAssistantText(prev, activeId);
        }
        const finalContent =
          typeof event.content === "string" && event.content.length > 0
            ? event.content
            : undefined;
        if (!activeId) {
          return finalContent
            ? commitFinalAssistantMessage(prev, finalContent)
            : prev;
        }
        return prev.map((entry) => {
          if (entry.id !== activeId || entry.kind !== "assistant") {
            return entry;
          }

          return {
            ...entry,
            content: finalContent ?? entry.content,
            streaming: false,
          };
        });
      }

      if (event.type === "tool_execution_start" && event.toolCallId) {
        if (activeToolMapRef.current.has(event.toolCallId)) return prev;
        completedToolCallIdsRef.current.delete(event.toolCallId);
        const newId = randomId();
        activeToolMapRef.current.set(event.toolCallId, newId);
        const next = appendToolToAssistantTurn(
          prev,
          {
            id: newId,
            kind: "tool",
            label: event.label ?? event.toolName ?? "Tool call",
            params: event.parameters,
            status: "pending",
            toolCallId: event.toolCallId,
            toolName: event.toolName ?? "unknown",
          },
          activeAssistantIdRef.current,
        );
        activeAssistantIdRef.current = next.assistantId;
        return next.entries;
      }

      if (event.type === "tool_execution_end" && event.toolCallId) {
        const toolEntryId = activeToolMapRef.current.get(event.toolCallId);
        activeToolMapRef.current.delete(event.toolCallId);
        if (
          !toolEntryId &&
          completedToolCallIdsRef.current.has(event.toolCallId)
        ) {
          return prev;
        }

        const toolUpdate = {
          error: event.isError
            ? typeof event.message === "string"
              ? event.message
              : "Tool failed"
            : undefined,
          result: event.result,
          status: event.isError ? ("error" as const) : ("complete" as const),
        };
        completedToolCallIdsRef.current.add(event.toolCallId);
        if (toolEntryId) {
          const next = updateToolEntry(prev, toolEntryId, toolUpdate);
          if (next.found) return next.entries;
        }

        return appendToolToAssistantTurn(prev, {
          id: randomId(),
          kind: "tool",
          label: event.toolName ?? "Tool call",
          params: undefined,
          toolCallId: event.toolCallId,
          toolName: event.toolName ?? "unknown",
          ...toolUpdate,
        }).entries;
      }

      if (event.type === "marble_session_error") {
        activeToolMapRef.current.clear();
        completedToolCallIdsRef.current.clear();
        activeAssistantIdRef.current = null;
        return [
          ...closePendingToolEntries(closeStreamingAssistantEntries(prev), {
            error: "Agent session failed before this tool returned.",
            status: "error",
          }),
          {
            code: event.code,
            id: randomId(),
            kind: "error",
            message: event.message ?? "Agent session failed.",
          },
        ];
      }

      if (event.type === "marble_session_complete") {
        activeToolMapRef.current.clear();
        completedToolCallIdsRef.current.clear();
        return closePendingToolEntries(prev, {
          status: "complete",
        });
      }

      return prev;
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      const history = buildConversationHistory(entries);

      setEntries((prev) => [
        ...prev,
        {
          content: trimmed,
          id: randomId(),
          kind: "user",
        },
      ]);
      setDraft("");
      setStreaming(true);
      setElapsedMs(0);
      setStatusMessage("Choosing model path...");
      sessionResolvedRef.current = false;
      activeAssistantIdRef.current = null;
      activeToolMapRef.current.clear();
      completedToolCallIdsRef.current.clear();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await readAgentResponse({
          controller,
          handleEvent,
          history,
          message: trimmed,
          pageContext,
          setEntries,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setEntries((prev) => [
          ...prev,
          {
            code: "TRANSPORT_FAILED",
            id: randomId(),
            kind: "error",
            message:
              error instanceof Error
                ? `Connection error: ${error.message}`
                : `Connection error: ${String(error)}`,
          },
        ]);
      } finally {
        if (!sessionResolvedRef.current && !controller.signal.aborted) {
          setEntries((prev) => [
            ...closePendingToolEntries(prev, {
              error: "The server stream closed before this tool returned.",
              status: "error",
            }),
            {
              code: "STREAM_ABRUPT_END",
              id: randomId(),
              kind: "error",
              message:
                "The server stream closed without sending a completion or error event. The dev server terminal will have the upstream crash.",
            },
          ]);
        }
        setStreaming(false);
        setStatusMessage(null);
        activeAssistantIdRef.current = null;
        activeToolMapRef.current.clear();
        completedToolCallIdsRef.current.clear();
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      handleEvent,
      entries,
      pageContext,
      streaming,
    ],
  );

  const handleNewThread = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStatusMessage(null);
    setEntries([]);
    activeAssistantIdRef.current = null;
    activeToolMapRef.current.clear();
    completedToolCallIdsRef.current.clear();
    document.getElementById("agent-chat-composer")?.focus();
  };

  return {
    draft,
    elapsedMs,
    entries,
    handleNewThread,
    sendMessage,
    setDraft,
    statusMessage,
    streaming,
  };
};
