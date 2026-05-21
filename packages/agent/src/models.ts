import { getModel } from "@earendil-works/pi-ai";

export type MarbleAgentProvider = "anthropic" | "google" | "openai";

export type MarbleAgentModelTier = "expert" | "rapid" | "standard";

export const MARBLE_AGENT_MODEL_TIERS = [
  "rapid",
  "standard",
  "expert",
] as const satisfies MarbleAgentModelTier[];

const resolveGoogleProLatestModel = () => {
  const model = getModel("google", "gemini-flash-latest");

  return {
    ...model,
    id: "gemini-pro-latest",
    name: "gemini-pro-latest",
  };
};

export const resolveAgentModel = (
  provider: MarbleAgentProvider,
  tier: MarbleAgentModelTier = "rapid",
) => {
  switch (provider) {
    case "anthropic":
      return getModel(
        "anthropic",
        tier === "rapid"
          ? "claude-haiku-4-5"
          : tier === "standard"
            ? "claude-sonnet-4-6"
            : "claude-opus-4-7",
      );
    case "google":
      return tier === "expert"
        ? resolveGoogleProLatestModel()
        : getModel(
            "google",
            tier === "rapid"
              ? "gemini-flash-lite-latest"
              : "gemini-flash-latest",
          );
    case "openai":
      return getModel(
        "openai",
        tier === "rapid"
          ? "gpt-5.4-nano"
          : tier === "standard"
            ? "gpt-5.5"
            : "gpt-5.5-pro",
      );
  }
};

export const resolveAgentThinkingLevel = (tier: MarbleAgentModelTier) => {
  switch (tier) {
    case "rapid":
      return "low";
    case "standard":
      return "medium";
    case "expert":
      return "high";
  }
};
