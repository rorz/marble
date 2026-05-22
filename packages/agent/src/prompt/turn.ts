import type { MarbleAgentModelTier } from "../models";

type MarbleAgentTurnHandoffContext = {
  brief: string;
  fromTier: MarbleAgentModelTier;
  reason: string;
  toTier: MarbleAgentModelTier;
};

type MarbleAgentTurnPageContext = {
  currentResource?: {
    id: string;
    kind: string;
    label: string;
    parent?: {
      id: string;
      label: string;
    };
  };
  pathname: string;
  search?: string;
};

type MarbleAgentTurnPromptInput = {
  context?: MarbleAgentTurnPageContext;
  history?: {
    content: string;
    role: "assistant" | "user";
  }[];
  message: string;
};

type MarbleAgentTurnPromptOptions = {
  handoff?: MarbleAgentTurnHandoffContext;
};

const formatHistory = (
  history: MarbleAgentTurnPromptInput["history"],
): string | null => {
  if (!history || history.length === 0) return null;
  return [
    "Recent chat context:",
    ...history.map(
      (entry) =>
        `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content}`,
    ),
  ].join("\n");
};

const formatPageContext = (
  context: MarbleAgentTurnPromptInput["context"],
): string | null => {
  if (!context) return null;
  const lines = [
    "Current Marble page context:",
    `- Path: ${context.pathname}${context.search ? `?${context.search}` : ""}`,
  ];
  if (context.currentResource) {
    lines.push(
      `- Current resource: ${context.currentResource.kind} "${context.currentResource.label}" (${context.currentResource.id})`,
    );
    if (context.currentResource.parent) {
      lines.push(
        `- Parent project: "${context.currentResource.parent.label}" (${context.currentResource.parent.id})`,
      );
    }
  }
  return lines.join("\n");
};

const formatHandoffContext = (
  handoff: MarbleAgentTurnHandoffContext | undefined,
): string | null => {
  if (!handoff) return null;
  return [
    "Internal handoff context:",
    `- Previous tier: ${handoff.fromTier}`,
    `- Current tier: ${handoff.toTier}`,
    `- Reason: ${handoff.reason}`,
    `- Brief: ${handoff.brief}`,
    "Continue the same user turn from this context. Do not mention the handoff unless it changes the user-facing answer.",
  ].join("\n");
};

export const buildMarbleAgentTurnPrompt = (
  input: MarbleAgentTurnPromptInput,
  options: MarbleAgentTurnPromptOptions = {},
): string =>
  [
    formatHistory(input.history),
    formatPageContext(input.context),
    formatHandoffContext(options.handoff),
    "Current user message:",
    input.message,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
