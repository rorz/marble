import { getModel } from "@earendil-works/pi-ai";

export type MarbleAgentProvider = "anthropic" | "google" | "openai";

export type MarbleAgentModelTier = "deep" | "fast";

export const resolveAgentModel = (
  provider: MarbleAgentProvider,
  tier: MarbleAgentModelTier = "deep",
) => {
  switch (provider) {
    case "anthropic":
      return getModel(
        "anthropic",
        tier === "fast" ? "claude-haiku-4-5" : "claude-opus-4-7",
      );
    case "google":
      return getModel(
        "google",
        tier === "fast" ? "gemini-3.1-flash-lite" : "gemini-3.1-pro-preview",
      );
    case "openai":
      return getModel(
        "openai",
        tier === "fast" ? "gpt-5.3-codex-spark" : "gpt-5.5-pro",
      );
  }
};
