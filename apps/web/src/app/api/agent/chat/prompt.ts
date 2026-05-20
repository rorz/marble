import type { AgentChatRequest } from "./request";

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

export const buildAgentPrompt = (input: AgentChatRequest): string =>
  [
    "Use the context below to resolve references like this/current/here. Verify IDs with tools before mutating data. Do not invent missing instructions, and never infer destructive intent from frustration. Treat workflow/flow/enrichment/webhook/sign-up requests as product-intent requests: ask concise follow-up questions when key details are missing, or create a connected resource bundle with the needed sources, tables, columns, pipes, and programs when intent is clear. Do not create blank placeholder resources and call the workflow done. Style: answer in one short sentence by default, do not advertise capabilities, and do not use Markdown formatting.",
    formatHistory(input.history),
    formatPageContext(input.context),
    "Current user message:",
    input.message,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

export const buildConduitPrompt = (input: AgentChatRequest): string =>
  [
    "Decide how Marble Agent should handle the current user message.",
    "",
    "Routes:",
    '- "direct": answer immediately without tools or deeper reasoning.',
    '- "fast-agent": use the fast tool-capable agent only when user intent is at least 99% clear and the task is concrete, easy, and likely needs at most two quick tool calls.',
    '- "deep-agent": use the deep agent for ambiguous, multi-step, destructive, broad, or reasoning-heavy work.',
    "",
    "Return only JSON with this exact shape:",
    '{"route":"direct|fast-agent|deep-agent","response":"required only for direct","reason":"short private note"}',
    "",
    "Direct is appropriate for greetings, thanks, simple clarification, or questions answerable from the supplied page/history context.",
    "Any request to inspect or change Marble workspace data needs an agent route.",
    "Deep-agent is required for premise-like product requests such as setting up flows, workflows, website sign-up handling, webhooks, enrichment, integrations, Apollo, connecting sources/tables, pipes/mappings, correction followups, and anything that touches more than one resource.",
    "Fast-agent is only for tiny requests like listing a known thing or creating/updating one clearly named resource.",
    "When unsure between fast-agent and deep-agent, choose deep-agent. If you cannot discern user intent with near certainty, choose deep-agent.",
    "",
    formatHistory(input.history),
    formatPageContext(input.context),
    "Current user message:",
    input.message,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
