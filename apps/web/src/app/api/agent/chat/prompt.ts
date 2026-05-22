import {
  type MarbleAgentModelTier,
  resolveMarbleAgentPromptSheet,
} from "@marble/agent";
import type { AgentChatRequest } from "./request";

type AgentPromptHandoffContext = {
  brief: string;
  fromTier: MarbleAgentModelTier;
  reason: string;
  toTier: MarbleAgentModelTier;
};

type AgentPromptOptions = {
  handoff?: AgentPromptHandoffContext;
  modelTier?: MarbleAgentModelTier;
};

const formatHistory = (history: AgentChatRequest["history"]): string | null => {
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
  context: AgentChatRequest["context"],
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
  handoff: AgentPromptHandoffContext | undefined,
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

export const buildAgentPrompt = (
  input: AgentChatRequest,
  options: AgentPromptOptions = {},
): string =>
  [
    resolveMarbleAgentPromptSheet(options.modelTier ?? "rapid").turnGuidance,
    formatHistory(input.history),
    formatPageContext(input.context),
    formatHandoffContext(options.handoff),
    "Current user message:",
    input.message,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
