import { describe, expect, test } from "bun:test";
import { formatServerTimingEntry, measure, withTiming } from "./index";

describe("measure", () => {
  test("returns the result of a sync task with a non-negative duration", async () => {
    const { durationMs, result } = await measure(() => 42);
    expect(result).toBe(42);
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  test("awaits async tasks", async () => {
    const { result } = await measure(async () => "ok");
    expect(result).toBe("ok");
  });

  test("rethrows when the task throws", async () => {
    await expect(
      measure(() => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
  });
});

describe("withTiming", () => {
  test("records duration on success", async () => {
    const records: Array<{
      durationMs: number;
      name: string;
    }> = [];
    const value = await withTiming(
      (name, durationMs) =>
        records.push({
          durationMs,
          name,
        }),
      "task",
      () => "ok",
    );
    expect(value).toBe("ok");
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe("task");
    expect(records[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  test("records duration even when the task throws", async () => {
    const records: Array<{
      durationMs: number;
      name: string;
    }> = [];

    await expect(
      withTiming(
        (name, durationMs) =>
          records.push({
            durationMs,
            name,
          }),
        "task",
        () => {
          throw new Error("boom");
        },
      ),
    ).rejects.toThrow("boom");
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe("task");
  });

  test("awaits async tasks", async () => {
    const records: string[] = [];
    const value = await withTiming(
      (name) => records.push(name),
      "n",
      async () => 7,
    );
    expect(value).toBe(7);
    expect(records).toEqual([
      "n",
    ]);
  });
});

describe("formatServerTimingEntry", () => {
  test("formats name and rounded duration", () => {
    expect(formatServerTimingEntry("auth", 12)).toBe("auth;dur=12");
  });

  test("rounds fractional ms", () => {
    expect(formatServerTimingEntry("db", 12.6)).toBe("db;dur=13");
    expect(formatServerTimingEntry("db", 12.4)).toBe("db;dur=12");
  });

  test("formats zero duration", () => {
    expect(formatServerTimingEntry("noop", 0)).toBe("noop;dur=0");
  });
});
