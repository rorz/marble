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
    "Use the context below to resolve references like this/current/here. Verify IDs with tools before mutating data. Do not invent missing instructions, and never infer destructive intent from frustration. Treat workflow/flow/enrichment/webhook/sign-up requests as product-intent requests: ask concise follow-up questions when key details are missing, or create a connected resource bundle with the needed sources, tables, columns, pipes, and programs when intent is clear. Do not create blank placeholder resources and call the workflow done. For program code, follow the Marble Wizard contract: main.ts exports a default function with ({ system, cell, input }); never import @earendil-works/marble-sdk or instantiate Program. Cell rule: setting manual cell values only stores input; if the user expects populated output or downstream work, run the ready cells with marble_cells_run before saying the work is done. Style: answer in one short sentence by default, do not advertise capabilities, and do not use Markdown formatting.",
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
    '- "fast-agent": use the fast tool-capable agent when the task is elemental: clear intent, no planning, and likely at most two simple tool calls.',
    '- "deep-agent": use the deep agent for plans, workflow design, ambiguous intent, broad destructive actions, or reasoning-heavy work.',
    "",
    "Return only JSON with this exact shape:",
    '{"route":"direct|fast-agent|deep-agent","response":"required only for direct","reason":"short private note"}',
    "",
    "Direct is appropriate for greetings, thanks, simple clarification, or questions answerable from the supplied page/history context.",
    "Any request to inspect or change Marble workspace data needs an agent route.",
    "Fast-agent is appropriate for elemental workspace actions like listing known things, creating/updating one clearly named resource, creating two independent resources, or navigating to a known page.",
    "Deep-agent is required for premise-like product requests such as setting up flows, workflows, website sign-up handling, webhooks, enrichment, integrations, Apollo, or open-ended pipe/mapping design.",
    "When unsure between fast-agent and deep-agent, choose deep-agent. If you cannot discern user intent with near certainty, choose deep-agent.",
    "",
    formatHistory(input.history),
    formatPageContext(input.context),
    "Current user message:",
    input.message,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
