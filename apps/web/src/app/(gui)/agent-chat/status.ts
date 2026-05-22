import type { StreamEvent } from "./types";

export type AgentChatStatus = {
  message: string;
  notes: string[];
  tier?: "expert" | "rapid" | "standard";
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

type StatusOptions = {
  notes?: string[];
  tier?: AgentChatStatus["tier"];
};

const createStatus = (
  message: string,
  options: StatusOptions = {},
): AgentChatStatus => ({
  message,
  notes: [
    ...new Set((options.notes ?? []).filter(Boolean)),
  ].slice(-MAX_STATUS_NOTES),
  tier: options.tier,
});

export const createRoutingStatus = (): AgentChatStatus =>
  createStatus("", {
    tier: "rapid",
  });

export const mergeStatus = (
  current: AgentChatStatus | null,
  next: AgentChatStatus,
): AgentChatStatus =>
  createStatus(next.message, {
    notes: [
      ...(current?.notes ?? []),
      ...next.notes,
    ],
    tier: next.tier ?? current?.tier,
  });

export const formatTierStatus = (event: StreamEvent): AgentChatStatus =>
  createStatus("", {
    tier: event.modelTier,
  });

export const formatHandoffStatus = (event: StreamEvent): AgentChatStatus =>
  createStatus(`Handing off to ${formatTierName(event.toTier)}...`, {
    notes: [
      event.reason ?? "The current tier asked for a stronger pass.",
    ],
    tier: event.toTier,
  });

export const statusForToolStart = (event: StreamEvent): AgentChatStatus =>
  createStatus(`Running ${formatToolName(event)}...`);

export const statusForToolEnd = (event: StreamEvent): AgentChatStatus =>
  createStatus(
    event.isError
      ? "Tool failed; deciding the next step..."
      : "Reading tool result...",
  );
