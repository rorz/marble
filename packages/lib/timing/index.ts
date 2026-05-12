/**
 * Timing primitives. Zero third-party dependencies.
 *
 * Centralises the `performance.now() / Math.round` pattern that was
 * inlined in both `apps/web/src/lib/api-route-forwarding.ts` and
 * `packages/store/src/db/supabase.ts`. A single home means a single
 * formatter for the `Server-Timing` header.
 */

/**
 * Run `task`, measure how long it takes, and return both the result and
 * the elapsed milliseconds (rounded to the nearest whole millisecond).
 * Re-throws if `task` throws (after recording the duration is still
 * meaningful at the call site for failure cases — use `withTiming` if you
 * want side-effect recording on both arms).
 */
export async function measure<T>(
  task: () => Promise<T> | T,
): Promise<{
  durationMs: number;
  result: T;
}> {
  const startedAt = performance.now();
  const result = await task();
  return {
    durationMs: Math.round(performance.now() - startedAt),
    result,
  };
}

/**
 * Run `task` while ensuring `record(name, durationMs)` fires once whether
 * `task` resolves or rejects. The recorded `durationMs` is the unrounded
 * float from `performance.now()` — quantize at the formatter (e.g. via
 * `formatServerTimingEntry`) so consumers that compute ratios still see
 * full precision. Mirrors the `timeDbCall` shape in the store package.
 */
export async function withTiming<T>(
  record: (name: string, durationMs: number) => void,
  name: string,
  task: () => Promise<T> | T,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await task();
  } finally {
    record(name, performance.now() - startedAt);
  }
}

/**
 * Format a single Server-Timing entry: `name;dur=N`. Rounds the duration
 * to the nearest whole millisecond.
 */
export function formatServerTimingEntry(name: string, durationMs: number) {
  return `${name};dur=${Math.round(durationMs)}`;
}
