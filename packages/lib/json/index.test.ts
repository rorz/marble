import { describe, expect, test } from "bun:test";
import { parseJsonOrUndefined, safeStringify, stringifyPretty } from "./index";

describe("parseJsonOrUndefined", () => {
  test("parses valid JSON", () => {
    expect(parseJsonOrUndefined('{"a":1}')).toEqual({
      a: 1,
    });
  });

  test("returns undefined for empty input", () => {
    expect(parseJsonOrUndefined("")).toBeUndefined();
  });

  test("returns undefined for whitespace-only input", () => {
    expect(parseJsonOrUndefined("   \n\t  ")).toBeUndefined();
  });

  test("throws with cause on invalid JSON", () => {
    let caught: unknown;

    try {
      parseJsonOrUndefined("{not json");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("Input must be valid JSON.");
    expect((caught as Error).cause).toBeDefined();
  });
});

describe("stringifyPretty", () => {
  test("pretty-prints with two-space indent", () => {
    expect(
      stringifyPretty({
        a: 1,
      }),
    ).toBe('{\n  "a": 1\n}');
  });

  test("handles primitives", () => {
    expect(stringifyPretty("hello")).toBe('"hello"');
    expect(stringifyPretty(42)).toBe("42");
    expect(stringifyPretty(null)).toBe("null");
  });
});

describe("safeStringify", () => {
  test("stringifies normal values", () => {
    expect(
      safeStringify({
        a: 1,
      }),
    ).toBe('{"a":1}');
    expect(safeStringify("hello")).toBe('"hello"');
    expect(safeStringify(42)).toBe("42");
  });

  test("falls back to String() on cycles", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(safeStringify(cycle)).toBe(String(cycle));
  });

  test("falls back on BigInt", () => {
    expect(safeStringify(BigInt(1))).toBe(String(BigInt(1)));
  });
});
