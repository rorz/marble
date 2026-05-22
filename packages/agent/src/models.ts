import {
  type Api,
  getModel,
  type KnownProvider,
  type Model,
  type ThinkingLevel,
} from "@earendil-works/pi-ai";

const MARBLE_AGENT_PROVIDERS = [
  "anthropic",
  "google",
  "openai",
] as const satisfies readonly KnownProvider[];

export type MarbleAgentProvider = (typeof MARBLE_AGENT_PROVIDERS)[number];

const MARBLE_AGENT_MODEL_TIERS = [
  "rapid",
  "standard",
  "expert",
] as const;

export type MarbleAgentModelTier = (typeof MARBLE_AGENT_MODEL_TIERS)[number];

type MarbleAgentModelSelection = {
  model: Model<Api>;
  thinkingLevel: ThinkingLevel;
};

export type MarbleAgentModelConfig = {
  model: Model<Api>;
  modelId: Model<Api>["id"];
  thinkingLevel: ThinkingLevel;
};

const MARBLE_AGENT_MODEL_SELECTIONS = {
  anthropic: {
    expert: {
      model: getModel("anthropic", "claude-opus-4-7"),
      thinkingLevel: "high",
    },
    rapid: {
      model: getModel("anthropic", "claude-haiku-4-5"),
      thinkingLevel: "low",
    },
    standard: {
      model: getModel("anthropic", "claude-sonnet-4-6"),
      thinkingLevel: "medium",
    },
  },
  google: {
    expert: {
      model: getModel("google", "gemini-3.1-pro-preview"),
      thinkingLevel: "xhigh",
    },
    rapid: {
      model: getModel("google", "gemini-flash-latest"),
      thinkingLevel: "minimal",
    },
    standard: {
      model: getModel("google", "gemini-flash-latest"),
      thinkingLevel: "high",
    },
  },
  openai: {
    expert: {
      model: getModel("openai", "gpt-5.5-pro"),
      thinkingLevel: "high",
    },
    rapid: {
      model: getModel("openai", "gpt-5.4-nano"),
      thinkingLevel: "low",
    },
    standard: {
      model: getModel("openai", "gpt-5.5"),
      thinkingLevel: "medium",
    },
  },
} as const satisfies Record<
  MarbleAgentProvider,
  Record<MarbleAgentModelTier, MarbleAgentModelSelection>
>;

export const resolveAgentModelConfig = (
  provider: MarbleAgentProvider,
  tier: MarbleAgentModelTier = "rapid",
): MarbleAgentModelConfig => {
  const selection = MARBLE_AGENT_MODEL_SELECTIONS[provider][tier];

  return {
    model: selection.model,
    modelId: selection.model.id,
    thinkingLevel: selection.thinkingLevel,
  };
};
