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

const MARBLE_AGENT_VARIANTS = [
  "architect",
  "builder",
  "concierge",
] as const;

export type MarbleAgentVariant = (typeof MARBLE_AGENT_VARIANTS)[number];

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
    architect: {
      model: getModel("anthropic", "claude-opus-4-7"),
      thinkingLevel: "high",
    },
    builder: {
      model: getModel("anthropic", "claude-sonnet-4-6"),
      thinkingLevel: "medium",
    },
    concierge: {
      model: getModel("anthropic", "claude-haiku-4-5"),
      thinkingLevel: "low",
    },
  },
  google: {
    architect: {
      model: getModel("google", "gemini-3.1-pro-preview"),
      thinkingLevel: "xhigh",
    },
    builder: {
      model: getModel("google", "gemini-flash-latest"),
      thinkingLevel: "high",
    },
    concierge: {
      model: getModel("google", "gemini-flash-lite-latest"),
      thinkingLevel: "minimal",
    },
  },
  openai: {
    architect: {
      model: getModel("openai", "gpt-5.5-pro"),
      thinkingLevel: "high",
    },
    builder: {
      model: getModel("openai", "gpt-5.5"),
      thinkingLevel: "medium",
    },
    concierge: {
      model: getModel("openai", "gpt-5.4-nano"),
      thinkingLevel: "low",
    },
  },
} as const satisfies Record<
  MarbleAgentProvider,
  Record<MarbleAgentVariant, MarbleAgentModelSelection>
>;

export const resolveAgentModelConfig = (
  provider: MarbleAgentProvider,
  variant: MarbleAgentVariant = "concierge",
): MarbleAgentModelConfig => {
  const selection = MARBLE_AGENT_MODEL_SELECTIONS[provider][variant];

  return {
    model: selection.model,
    modelId: selection.model.id,
    thinkingLevel: selection.thinkingLevel,
  };
};
