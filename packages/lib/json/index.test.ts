import { describe, expect, test } from "bun:test";
import {
  parseJsonc,
  parseJsonOrUndefined,
  safeStringify,
  stringifyJsonSafe,
  stringifyPretty,
} from "./index";

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

describe("parseJsonc", () => {
  test("parses JSON with line comments and trailing commas", () => {
    expect(
      parseJsonc(`{
        // friendly config note
        "inputSchema": {
          "type": "object",
        },
      }`),
    ).toEqual({
      inputSchema: {
        type: "object",
      },
    });
  });

  test("parses JSON with block comments", () => {
    expect(parseJsonc('{/* quiet */"schema":{"type":"string"}}')).toEqual({
      schema: {
        type: "string",
      },
    });
  });

  test("keeps comment markers inside strings", () => {
    expect(parseJsonc('{"url":"https://example.com/a/*b*/"}')).toEqual({
      url: "https://example.com/a/*b*/",
    });
  });

  test("throws with cause on invalid JSONC", () => {
    expect(() => parseJsonc("{ nope }")).toThrow("Input must be valid JSONC.");
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

  test("keeps undefined values printable", () => {
    expect(stringifyPretty(undefined)).toBe("null");
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

  test("falls back on undefined", () => {
    expect(safeStringify(undefined)).toBe(String(undefined));
  });
});

describe("stringifyJsonSafe", () => {
  test("stringifies normal values", () => {
    expect(
      stringifyJsonSafe({
        a: 1,
      }),
    ).toBe('{"a":1}');
  });

  test("keeps output parseable when values contain cycles", () => {
    const cycle: Record<string, unknown> = {
      name: "cycle",
    };
    cycle.self = cycle;

    expect(JSON.parse(stringifyJsonSafe(cycle))).toEqual({
      name: "cycle",
      self: "[Circular]",
    });
  });

  test("keeps output parseable when values contain BigInt", () => {
    expect(
      JSON.parse(
        stringifyJsonSafe({
          id: BigInt(1),
        }),
      ),
    ).toEqual({
      id: "1",
    });
  });

  test("uses null for undefined top-level values", () => {
    expect(stringifyJsonSafe(undefined)).toBe("null");
  });
});
