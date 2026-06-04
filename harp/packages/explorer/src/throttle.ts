import type { ProbeExecutor, ProbeResult } from "./state";

/**
 * Probe transport policy. Active exploration tends to fire many probes in quick
 * bursts; a target that rate-limits then answers real endpoints with 429/503,
 * which look like "doesn't exist" and poison the model. `throttleProbes` wraps
 * an executor so probes run one-at-a-time with a small gap between them, and a
 * rate-limited response is retried once after a pause.
 */

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type ThrottleOptions = {
  gapMs?: number;
  retryMs?: number;
  retryStatuses?: number[];
};

export const throttleProbes = (
  executor: ProbeExecutor,
  options: ThrottleOptions = {},
): ProbeExecutor => {
  const gapMs = options.gapMs ?? 200;
  const retryMs = options.retryMs ?? 800;
  const retryStatuses = new Set(
    options.retryStatuses ?? [
      429,
      503,
    ],
  );

  const executeWithRetry = async (
    request: Parameters<ProbeExecutor>[0],
  ): Promise<ProbeResult> => {
    const first = await executor(request);
    if (!retryStatuses.has(first.status)) {
      return first;
    }
    await delay(retryMs);
    return executor(request);
  };

  let chain: Promise<unknown> = Promise.resolve();
  return (request) => {
    const result = chain.then(() => executeWithRetry(request));
    // The next probe waits for this one to finish AND for the gap to elapse,
    // serialising + spacing probes without delaying this caller's result.
    chain = result.then(
      () => delay(gapMs),
      () => delay(gapMs),
    );
    return result;
  };
};
