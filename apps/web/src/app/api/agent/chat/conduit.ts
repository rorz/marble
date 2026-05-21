import {
  type MarbleAgentConduitDecision,
  type MarbleAgentProvider,
  resolveMarbleAgentConduitDecision,
} from "@marble/agent";
import { buildConduitPrompt } from "./prompt";
import type { AgentChatRequest } from "./request";

const DEEP_AGENT_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
}> = [
  {
    pattern:
      /\b(plan|architect|design|workflow|flow|automation|pipeline|webhook|apollo|enrich|enrichment|integration|sign-?ups?|website)\b/i,
    reason: "Planning, workflow, or integration request.",
  },
  {
    pattern:
      /\b(script|program code|manual input|manual value|user-?input|input column|external API)\b/i,
    reason: "Program authoring or input-column design request.",
  },
  {
    pattern:
      /\b(delete all|delete every|remove all|remove every|wipe|reset everything)\b/i,
    reason: "Broad destructive request.",
  },
];

const resolveHardDeepDecision = (
  input: AgentChatRequest,
): MarbleAgentConduitDecision | null => {
  const message = input.message.trim();

  for (const { pattern, reason } of DEEP_AGENT_PATTERNS) {
    if (pattern.test(message)) {
      return {
        modelTier: "deep",
        reason,
        route: "agent",
      };
    }
  }

  return null;
};

export const resolveConduitDecision = async ({
  apiKey,
  input,
  provider,
}: {
  apiKey: string;
  input: AgentChatRequest;
  provider: MarbleAgentProvider;
}): Promise<MarbleAgentConduitDecision> => {
  const hardDeepDecision = resolveHardDeepDecision(input);
  if (hardDeepDecision) return hardDeepDecision;

  return resolveMarbleAgentConduitDecision({
    apiKey,
    prompt: buildConduitPrompt(input),
    provider,
  });
};
