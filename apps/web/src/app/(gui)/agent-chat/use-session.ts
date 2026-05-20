"use client";

import { useEffect, useRef, useState } from "react";
import { appendErrorEntry, closeActiveRunEntries, randomId } from "./entries";
import { buildConversationHistory } from "./history";
import { type AgentChatStatus, createRoutingStatus } from "./status";
import {
  createThreadId,
  deleteStoredThread,
  loadThreadSnapshot,
  openStoredThread,
  saveActiveThread,
} from "./storage";
import { readAgentResponse } from "./transport";
import type {
  AgentChatPageContext,
  ChatEntry,
  ChatThreadSummary,
} from "./types";
import { useClientActions } from "./use-client-actions";
import { useStreamEvents } from "./use-stream-events";

export const useSession = ({
  pageContext,
}: {
  pageContext?: AgentChatPageContext;
}) => {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState<AgentChatStatus | null>(null);
  const [activeThreadId, setActiveThreadId] = useState(() => createThreadId());
  const [threadSummaries, setThreadSummaries] = useState<ChatThreadSummary[]>(
    [],
  );
  const queueClientAction = useClientActions();
  const abortRef = useRef<AbortController | null>(null);
  const sessionResolvedRef = useRef<boolean>(false);
  const { handleEvent, resetInFlight } = useStreamEvents({
    queueClientAction,
    sessionResolvedRef,
    setElapsedMs,
    setEntries,
    setStatus,
  });

  useEffect(() => {
    const snapshot = loadThreadSnapshot();
    setActiveThreadId(snapshot.activeThreadId);
    setEntries(snapshot.entries);
    setThreadSummaries(snapshot.summaries);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setThreadSummaries(saveActiveThread(activeThreadId, entries).summaries);
  }, [
    activeThreadId,
    entries,
    hydrated,
  ]);

  const sendMessage = async (text: string) => {
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
    setStatus(createRoutingStatus());
    sessionResolvedRef.current = false;
    resetInFlight();

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
      setEntries((prev) =>
        appendErrorEntry(prev, {
          code: "TRANSPORT_FAILED",
          message:
            error instanceof Error
              ? `Connection error: ${error.message}`
              : `Connection error: ${String(error)}`,
        }),
      );
    } finally {
      if (!sessionResolvedRef.current && !controller.signal.aborted) {
        setEntries((prev) =>
          appendErrorEntry(
            closeActiveRunEntries(prev, {
              error: "The server stream closed before this tool returned.",
              status: "error",
            }),
            {
              code: "STREAM_ABRUPT_END",
              message:
                "The server stream closed without sending a completion or error event. The dev server terminal will have the upstream crash.",
            },
          ),
        );
      }
      setStreaming(false);
      setStatus(null);
      resetInFlight();
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const cancelCurrentRun = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionResolvedRef.current = true;
    setStreaming(false);
    setStatus(null);
    setEntries((prev) =>
      closeActiveRunEntries(prev, {
        error: "Cancelled by user.",
        status: "error",
      }),
    );
    resetInFlight();
    document.getElementById("agent-chat-composer")?.focus();
  };

  const handleNewThread = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStatus(null);
    setActiveThreadId(createThreadId());
    setEntries([]);
    resetInFlight();
    document.getElementById("agent-chat-composer")?.focus();
  };

  const handleSelectThread = (threadId: string) => {
    if (streaming) return;
    const snapshot = openStoredThread(threadId);
    setActiveThreadId(snapshot.activeThreadId);
    setEntries(snapshot.entries);
    setThreadSummaries(snapshot.summaries);
    resetInFlight();
    document.getElementById("agent-chat-composer")?.focus();
  };

  const handleDeleteThread = (threadId: string) => {
    if (streaming) return;
    const snapshot = deleteStoredThread(threadId, activeThreadId);
    setActiveThreadId(snapshot.activeThreadId);
    setThreadSummaries(snapshot.summaries);
    if (snapshot.removedActiveThread) {
      setEntries(snapshot.entries);
    }
    resetInFlight();
    document.getElementById("agent-chat-composer")?.focus();
  };

  return {
    activeThreadId,
    cancelCurrentRun,
    draft,
    elapsedMs,
    entries,
    handleDeleteThread,
    handleNewThread,
    handleSelectThread,
    sendMessage,
    setDraft,
    status,
    streaming,
    threadSummaries,
  };
};
