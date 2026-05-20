import type { ParseOutcome, StreamEvent } from "./types";

export const parseStreamEvent = (block: string): ParseOutcome => {
  if (!block.trim()) {
    return {
      kind: "ignored",
    };
  }
  if (!block.startsWith("data: ")) {
    return {
      kind: "ignored",
    };
  }
  const payload = block.slice(6);
  try {
    return {
      event: JSON.parse(payload) as StreamEvent,
      kind: "ok",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      kind: "parse_error",
      raw: payload,
    };
  }
};
