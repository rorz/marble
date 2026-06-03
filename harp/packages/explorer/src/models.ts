import {
  type Api,
  getModel,
  type KnownProvider,
  type Model,
  type ThinkingLevel,
} from "@earendil-works/pi-ai";

/**
 * Configurable model selection for the HARP explorer. Pick a provider
 * (anthropic / google / openai) and a depth variant; callers supply the API key
 * at runtime, so different models can be tried freely. Mirrors the Marble agent
 * model map so HARP and Marble stay on the same model lineup.
 */

const PROVIDERS = [
  "anthropic",
  "google",
  "openai",
] as const satisfies readonly KnownProvider[];

export type ExplorerProvider = (typeof PROVIDERS)[number];

const VARIANTS = [
  "architect",
  "builder",
  "concierge",
] as const;

export type ExplorerVariant = (typeof VARIANTS)[number];

export type ExplorerModelConfig = {
  model: Model<Api>;
  thinkingLevel: ThinkingLevel;
};

const SELECTIONS = {
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
  ExplorerProvider,
  Record<ExplorerVariant, ExplorerModelConfig>
>;

export const resolveExplorerModel = (
  provider: ExplorerProvider,
  variant: ExplorerVariant = "builder",
): ExplorerModelConfig => SELECTIONS[provider][variant];
