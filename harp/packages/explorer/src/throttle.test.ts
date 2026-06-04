import { describe, expect, test } from "bun:test";
import type { ProbeExecutor, ProbeResult } from "./state";
import { throttleProbes } from "./throttle";

const ok = (status: number): ProbeResult => ({
  body: "",
  contentType: "text/html",
  ok: status < 400,
  status,
});

describe("throttleProbes", () => {
  test("serialises probes so they never overlap", async () => {
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];
    const executor: ProbeExecutor = async (request) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(request.url);
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      active -= 1;
      return ok(200);
    };
    const throttled = throttleProbes(executor, {
      gapMs: 0,
      retryMs: 0,
    });
    await Promise.all([
      throttled({
        method: "GET",
        url: "/a",
      }),
      throttled({
        method: "GET",
        url: "/b",
      }),
      throttled({
        method: "GET",
        url: "/c",
      }),
    ]);
    expect(maxActive).toBe(1);
    expect(order).toEqual([
      "/a",
      "/b",
      "/c",
    ]);
  });

  test("retries once on a rate-limited (503) response", async () => {
    let calls = 0;
    const executor: ProbeExecutor = async () => {
      calls += 1;
      return ok(calls === 1 ? 503 : 200);
    };
    const throttled = throttleProbes(executor, {
      gapMs: 0,
      retryMs: 0,
    });
    const result = await throttled({
      method: "GET",
      url: "/x",
    });
    expect(calls).toBe(2);
    expect(result.status).toBe(200);
  });

  test("does not retry a normal response", async () => {
    let calls = 0;
    const executor: ProbeExecutor = async () => {
      calls += 1;
      return ok(200);
    };
    const throttled = throttleProbes(executor, {
      gapMs: 0,
      retryMs: 0,
    });
    await throttled({
      method: "GET",
      url: "/y",
    });
    expect(calls).toBe(1);
  });
});
