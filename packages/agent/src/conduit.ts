import { type AssistantMessage, completeSimple } from "@earendil-works/pi-ai";
import {
  type MarbleAgentModelTier,
  type MarbleAgentProvider,
  resolveAgentModel,
} from "./models";

const CONDUIT_TIMEOUT_MS = 4_000;

type RawConduitDecision = {
  reason?: string;
  response?: string;
  route: "deep-agent" | "direct" | "fast-agent";
};

export type MarbleAgentConduitDecision =
  | {
      reason?: string;
      response: string;
      route: "direct";
    }
  | {
      modelTier: MarbleAgentModelTier;
      reason?: string;
      route: "agent";
    };

const fallbackDecision = (reason: string): MarbleAgentConduitDecision => ({
  modelTier: "deep",
  reason,
  route: "agent",
});

const extractAssistantText = (message: AssistantMessage): string =>
  message.content
    .filter(
      (
        block,
      ): block is Extract<
        AssistantMessage["content"][number],
        {
          type: "text";
        }
      > => block.type === "text",
    )
    .map((block) => block.text)
    .join("")
    .trim();

const stripCodeFence = (text: string): string =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const extractJsonObject = (text: string): string => {
  const stripped = stripCodeFence(text);
  if (stripped.startsWith("{") && stripped.endsWith("}")) return stripped;

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return stripped;
  return stripped.slice(start, end + 1);
};

const isRawConduitDecision = (value: unknown): value is RawConduitDecision => {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  return (
    (record.route === "deep-agent" ||
      record.route === "direct" ||
      record.route === "fast-agent") &&
    (record.reason === undefined || typeof record.reason === "string") &&
    (record.response === undefined || typeof record.response === "string")
  );
};

const parseConduitDecision = (text: string): RawConduitDecision | undefined => {
  try {
    const parsed = JSON.parse(extractJsonObject(text)) as unknown;
    return isRawConduitDecision(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const normalizeConduitDecision = (
  decision: RawConduitDecision,
): MarbleAgentConduitDecision => {
  if (decision.route === "direct" && decision.response?.trim()) {
    return {
      reason: decision.reason,
      response: decision.response.trim(),
      route: "direct",
    };
  }

  return {
    modelTier: decision.route === "deep-agent" ? "deep" : "fast",
    reason: decision.reason,
    route: "agent",
  };
};

export const resolveMarbleAgentConduitDecision = async ({
  apiKey,
  prompt,
  provider,
}: {
  apiKey: string;
  prompt: string;
  provider: MarbleAgentProvider;
}): Promise<MarbleAgentConduitDecision> => {
  const model = resolveAgentModel(provider, "fast");

  try {
    const message = await completeSimple(
      model,
      {
        messages: [
          {
            content: prompt,
            role: "user",
            timestamp: Date.now(),
          },
        ],
        systemPrompt:
          "You are a fast routing model for Marble Agent. Classify the next step only. Return compact JSON and no prose.",
      },
      {
        apiKey,
        maxRetries: 0,
        maxTokens: 260,
        reasoning: "minimal",
        temperature: 0,
        timeoutMs: CONDUIT_TIMEOUT_MS,
      },
    );

    const decision = parseConduitDecision(extractAssistantText(message));
    return decision
      ? normalizeConduitDecision(decision)
      : fallbackDecision("Conduit returned unparseable output.");
  } catch (error) {
    console.warn("[marble-agent] conduit failed; using deep agent", error);
    return fallbackDecision("Conduit failed.");
  }
};
