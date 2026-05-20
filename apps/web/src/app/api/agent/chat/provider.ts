import type { MarbleAgentProvider } from "@marble/agent";
import { env } from "@/env";

export const providerApiKey = (
  provider: MarbleAgentProvider,
): string | undefined => {
  switch (provider) {
    case "anthropic":
      return env.ANTHROPIC_API_KEY;
    case "google":
      return env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "openai":
      return env.OPENAI_API_KEY;
  }
};
