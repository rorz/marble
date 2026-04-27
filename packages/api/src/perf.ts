import type { SupabaseClient } from "@marble/supabase";
import { getEventContext } from "./event-driver";

const SLOW_OPERATION_MS = 250;

export function now() {
  return Date.now();
}

export function logSlowOperation(
  name: string,
  startedAt: number,
  input: {
    requestId?: string;
  } = {},
) {
  const durationMs = now() - startedAt;

  if (durationMs < SLOW_OPERATION_MS) {
    return durationMs;
  }

  console.warn("[marble-api] slow operation", {
    durationMs: Math.round(durationMs),
    name,
    ...(input.requestId
      ? {
          requestId: input.requestId,
        }
      : {}),
  });

  return durationMs;
}

export function getSupabaseRequestId(supabase: SupabaseClient) {
  return getEventContext(supabase)?.requestId;
}
