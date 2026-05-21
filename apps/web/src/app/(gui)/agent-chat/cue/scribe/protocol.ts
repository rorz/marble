import { parseJsonOrUndefined } from "@marble/lib/json";

const TOKEN_ENDPOINT = "/api/agent/chat/scribe-token";
const WEBSOCKET_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";

const SCRIBE_ERROR_TYPES = new Set([
  "auth_error",
  "input_error",
  "quota_exceeded",
  "rate_limited",
  "unaccepted_terms",
]);

type ScribeSocketMessage = {
  detail?: unknown;
  error?: unknown;
  error_type?: unknown;
  message?: unknown;
  message_type?: unknown;
  text?: unknown;
};

type ScribeTokenResponse = {
  token?: unknown;
};

export const isCommittedTranscriptMessage = (message: ScribeSocketMessage) =>
  message.message_type === "committed_transcript" ||
  message.message_type === "committed_transcript_with_timestamps";

export const isTranscriptMessage = (message: ScribeSocketMessage) =>
  message.message_type === "partial_transcript" ||
  isCommittedTranscriptMessage(message);

export const buildScribeUrl = (token: string) => {
  const url = new URL(WEBSOCKET_URL);
  url.searchParams.set("audio_format", "pcm_16000");
  url.searchParams.set("commit_strategy", "manual");
  url.searchParams.set("model_id", "scribe_v2_realtime");
  url.searchParams.set("token", token);
  return url.toString();
};

export const readScribeToken = async () => {
  const response = await fetch(TOKEN_ENDPOINT, {
    cache: "no-store",
    method: "POST",
  });
  const body = await response.text();

  if (!response.ok) {
    const detail = body.trim() ? ` ${body.trim()}` : "";
    throw new Error(
      `Unable to create ElevenLabs realtime token (${response.status}).${detail}`,
    );
  }

  const data = parseJsonOrUndefined(body) as ScribeTokenResponse | undefined;

  if (typeof data?.token !== "string" || data.token.length === 0) {
    throw new Error("ElevenLabs realtime token response was invalid.");
  }

  return data.token;
};

export const parseScribeMessage = (
  data: unknown,
): ScribeSocketMessage | null => {
  if (typeof data !== "string") {
    return null;
  }

  try {
    const parsed = parseJsonOrUndefined(data);
    return parsed && typeof parsed === "object"
      ? (parsed as ScribeSocketMessage)
      : null;
  } catch (cause) {
    throw new Error("ElevenLabs realtime socket sent invalid JSON.", {
      cause,
    });
  }
};

const readStringField = (
  record: ScribeSocketMessage,
  keys: readonly (keyof ScribeSocketMessage)[],
) => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
};

export const isScribeErrorMessage = (message: ScribeSocketMessage) => {
  if (typeof message.message_type !== "string") {
    return Boolean(message.error);
  }

  return (
    message.message_type === "error" ||
    SCRIBE_ERROR_TYPES.has(message.message_type)
  );
};

export const describeScribeError = (message: ScribeSocketMessage) => {
  const type = readStringField(message, [
    "error_type",
    "message_type",
  ]);
  const detail = readStringField(message, [
    "message",
    "detail",
    "error",
  ]);

  return [
    type,
    detail,
  ]
    .filter(Boolean)
    .join(": ");
};
