"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useRef } from "react";
import {
  appendErrorEntry,
  appendToolToAssistantTurn,
  closeActiveRunEntries,
  closePendingToolEntries,
  commitFinalAssistantMessage,
  randomId,
  suppressAssistantText,
  updateToolEntry,
} from "./entries";
import {
  type AgentChatStatus,
  createRoutingStatus,
  formatRouteStatus,
  mergeStatus,
  statusForToolEnd,
  statusForToolStart,
} from "./status";
import type { ChatEntry, StreamEvent } from "./types";

type UseStreamEventsInput = {
  queueClientAction: (event: StreamEvent) => void;
  sessionResolvedRef: MutableRefObject<boolean>;
  setElapsedMs: Dispatch<SetStateAction<number>>;
  setEntries: Dispatch<SetStateAction<ChatEntry[]>>;
  setStatus: Dispatch<SetStateAction<AgentChatStatus | null>>;
};

export const useStreamEvents = ({
  queueClientAction,
  sessionResolvedRef,
  setElapsedMs,
  setEntries,
  setStatus,
}: UseStreamEventsInput) => {
  const activeAssistantIdRef = useRef<null | string>(null);
  const activeToolMapRef = useRef(new Map<string, string>());
  const completedToolCallIdsRef = useRef(new Set<string>());

  const resetInFlight = () => {
    activeAssistantIdRef.current = null;
    activeToolMapRef.current.clear();
    completedToolCallIdsRef.current.clear();
  };

  const handleEvent = (event: StreamEvent) => {
    if (event.type === "marble_session_starting") {
      setStatus(createRoutingStatus());
      return;
    }

    if (event.type === "marble_conduit_decision") {
      setStatus(formatRouteStatus(event));
      return;
    }

    if (event.type === "marble_session_built") {
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
      setStatus(null);
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
        return prev.map((entry) =>
          entry.id !== activeId || entry.kind !== "assistant"
            ? entry
            : {
                ...entry,
                content: finalContent ?? entry.content,
                streaming: false,
              },
        );
      }

      if (event.type === "tool_execution_start" && event.toolCallId) {
        setStatus((prevStatus) =>
          mergeStatus(prevStatus, statusForToolStart(event)),
        );
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
        setStatus((prevStatus) =>
          mergeStatus(prevStatus, statusForToolEnd(event)),
        );
        if (!completedToolCallIdsRef.current.has(event.toolCallId)) {
          queueClientAction(event);
        }
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
        resetInFlight();
        return appendErrorEntry(
          closeActiveRunEntries(prev, {
            error: "Agent session failed before this tool returned.",
            status: "error",
          }),
          {
            code: event.code,
            message: event.message ?? "Agent session failed.",
          },
        );
      }

      if (event.type === "marble_session_complete") {
        resetInFlight();
        return closePendingToolEntries(prev, {
          status: "complete",
        });
      }

      return prev;
    });
  };

  return {
    handleEvent,
    resetInFlight,
  };
};
