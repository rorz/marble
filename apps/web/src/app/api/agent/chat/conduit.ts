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
      /\b(workflow|flow|automation|pipeline|webhook|apollo|enrich|enrichment|integration|sign-?ups?|website)\b/i,
    reason: "Complex workflow or integration request.",
  },
  {
    pattern: /\b(connect|connected|pipe|mapping|link)\b/i,
    reason: "Cross-resource connection request.",
  },
  {
    pattern:
      /\b(wrong project|new project|you haven't|not what|nothing'?s connected|already said)\b/i,
    reason: "Correction follow-up needs stronger context handling.",
  },
];

const mutationPattern = /\b(add|build|connect|create|make|set up|update)\b/i;
const sequencePattern = /\b(and then|then|using|via|with .* and)\b/i;

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

  if (mutationPattern.test(message) && sequencePattern.test(message)) {
    return {
      modelTier: "deep",
      reason: "Multi-step mutation request.",
      route: "agent",
    };
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
