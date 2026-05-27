import type { AgentVariant, StreamEvent } from "./types";

export type AgentChatStatus = {
  message: string;
  notes: string[];
  variant?: AgentVariant;
};

const MAX_STATUS_NOTES = 5;

const formatToolName = (event: StreamEvent): string =>
  event.label ?? event.toolName ?? "tool";

const formatVariantName = (variant: AgentVariant | undefined): string => {
  switch (variant) {
    case "architect":
      return "Architect";
    case "builder":
      return "Builder";
    case "concierge":
      return "Concierge";
    default:
      return "Agent";
  }
};

type StatusOptions = {
  notes?: string[];
  variant?: AgentChatStatus["variant"];
};

const createStatus = (
  message: string,
  options: StatusOptions = {},
): AgentChatStatus => ({
  message,
  notes: [
    ...new Set((options.notes ?? []).filter(Boolean)),
  ].slice(-MAX_STATUS_NOTES),
  variant: options.variant,
});

export const createRoutingStatus = (): AgentChatStatus =>
  createStatus("", {
    variant: "concierge",
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
    variant: next.variant ?? current?.variant,
  });

export const formatVariantStatus = (event: StreamEvent): AgentChatStatus =>
  createStatus("", {
    variant: event.modelVariant,
  });

export const formatHandoffStatus = (event: StreamEvent): AgentChatStatus =>
  createStatus(`Handing off to ${formatVariantName(event.toVariant)}...`, {
    notes: [
      event.reason ?? "The current variant asked for a handoff.",
    ],
    variant: event.toVariant,
  });

export const statusForToolStart = (event: StreamEvent): AgentChatStatus =>
  createStatus(`Running ${formatToolName(event)}...`);

export const statusForToolEnd = (event: StreamEvent): AgentChatStatus =>
  createStatus(
    event.isError
      ? "Tool failed; deciding the next step..."
      : "Reading tool result...",
  );
