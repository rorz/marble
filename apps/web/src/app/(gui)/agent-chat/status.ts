import type { StreamEvent } from "./types";

export type AgentChatStatus = {
  message: string;
  notes: string[];
};

const MAX_STATUS_NOTES = 5;

const formatToolName = (event: StreamEvent): string =>
  event.label ?? event.toolName ?? "tool";

const createStatus = (
  message: string,
  notes: string[] = [],
): AgentChatStatus => ({
  message,
  notes: [
    ...new Set(notes.filter(Boolean)),
  ].slice(-MAX_STATUS_NOTES),
});

export const createRoutingStatus = (): AgentChatStatus =>
  createStatus("Choosing model path...", [
    "Routing through the fast conduit.",
  ]);

export const appendStatusNote = (
  status: AgentChatStatus | null,
  note: string,
): AgentChatStatus =>
  createStatus(status?.message ?? note, [
    ...(status?.notes ?? []),
    note,
  ]);

export const mergeStatus = (
  current: AgentChatStatus | null,
  next: AgentChatStatus,
): AgentChatStatus =>
  createStatus(next.message, [
    ...(current?.notes ?? []),
    ...next.notes,
  ]);

export const formatRouteStatus = (event: StreamEvent): AgentChatStatus => {
  if (event.route === "direct") {
    return createStatus("Direct path: answering without tools.", [
      event.reason ?? "The conduit found a direct answer path.",
    ]);
  }

  if (event.modelTier === "fast") {
    return createStatus("Fast path: elemental request.", [
      event.reason ?? "Intent is clear enough for the low-latency agent.",
    ]);
  }

  return createStatus("Pro path: reasoning through workflow and context.", [
    event.reason ?? "The request needs stronger intent handling.",
  ]);
};

export const statusForToolStart = (event: StreamEvent): AgentChatStatus =>
  createStatus(`Running ${formatToolName(event)}...`, [
    `Calling ${formatToolName(event)}.`,
  ]);

export const statusForToolEnd = (event: StreamEvent): AgentChatStatus =>
  createStatus(
    event.isError
      ? `${formatToolName(event)} failed.`
      : `Finished ${formatToolName(event)}.`,
    [
      event.isError
        ? `${formatToolName(event)} failed.`
        : `${formatToolName(event)} completed.`,
    ],
  );
