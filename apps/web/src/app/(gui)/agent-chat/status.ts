import type { StreamEvent } from "./types";

export type AgentChatStatus = {
  message: string;
  notes: string[];
};

const MAX_STATUS_NOTES = 5;

const formatToolName = (event: StreamEvent): string =>
  event.label ?? event.toolName ?? "tool";

const formatTierName = (tier: StreamEvent["modelTier"]): string => {
  switch (tier) {
    case "rapid":
      return "Rapid";
    case "standard":
      return "Standard";
    case "expert":
      return "Expert";
    default:
      return "Agent";
  }
};

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
  createStatus("Starting Rapid...");

export const mergeStatus = (
  current: AgentChatStatus | null,
  next: AgentChatStatus,
): AgentChatStatus =>
  createStatus(next.message, [
    ...(current?.notes ?? []),
    ...next.notes,
  ]);

export const formatTierStatus = (event: StreamEvent): AgentChatStatus =>
  createStatus(`${formatTierName(event.modelTier)} is working...`);

export const formatHandoffStatus = (event: StreamEvent): AgentChatStatus =>
  createStatus(`Handing off to ${formatTierName(event.toTier)}...`, [
    event.reason ?? "The current tier asked for a stronger pass.",
  ]);

export const statusForToolStart = (event: StreamEvent): AgentChatStatus =>
  createStatus(`Running ${formatToolName(event)}...`);

export const statusForToolEnd = (event: StreamEvent): AgentChatStatus =>
  createStatus(
    event.isError
      ? "Tool failed; deciding the next step..."
      : "Reading tool result...",
  );
