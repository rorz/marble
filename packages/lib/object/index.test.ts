import { describe, expect, test } from "bun:test";
import {
  castCamelKeys,
  isPlainRecord,
  readNonEmptyString,
  toCamelKeys,
  toSnakeKey,
  toSnakeKeys,
} from "./index";

describe("toSnakeKey", () => {
  test("converts camelCase to snake_case", () => {
    expect(toSnakeKey("fooBar")).toBe("foo_bar");
    expect(toSnakeKey("fooBarBaz")).toBe("foo_bar_baz");
  });

  test("leaves snake_case unchanged", () => {
    expect(toSnakeKey("foo_bar")).toBe("foo_bar");
  });

  test("handles empty string", () => {
    expect(toSnakeKey("")).toBe("");
  });
});

describe("toCamelKeys", () => {
  test("converts snake_case keys to camelCase", () => {
    expect(
      toCamelKeys({
        foo_bar: 1,
        baz_qux_quux: 2,
      }),
    ).toEqual({
      bazQuxQuux: 2,
      fooBar: 1,
    });
  });

  test("leaves camelCase keys unchanged", () => {
    expect(
      toCamelKeys({
        fooBar: 1,
      }),
    ).toEqual({
      fooBar: 1,
    });
  });

  test("handles empty objects", () => {
    expect(toCamelKeys({})).toEqual({});
  });
});

describe("toSnakeKeys", () => {
  test("converts camelCase keys to snake_case", () => {
    expect(
      toSnakeKeys({
        bazQuxQuux: 2,
        fooBar: 1,
      }),
    ).toEqual({
      baz_qux_quux: 2,
      foo_bar: 1,
    });
  });
});

describe("isPlainRecord", () => {
  test("accepts plain objects", () => {
    expect(isPlainRecord({})).toBe(true);
    expect(
      isPlainRecord({
        a: 1,
      }),
    ).toBe(true);
  });

  test("accepts Object.create(null)", () => {
    expect(isPlainRecord(Object.create(null))).toBe(true);
  });

  test("rejects arrays", () => {
    expect(isPlainRecord([])).toBe(false);
    expect(
      isPlainRecord([
        1,
        2,
      ]),
    ).toBe(false);
  });

  test("rejects null", () => {
    expect(isPlainRecord(null)).toBe(false);
  });

  test("rejects primitives", () => {
    expect(isPlainRecord(undefined)).toBe(false);
    expect(isPlainRecord(42)).toBe(false);
    expect(isPlainRecord("hello")).toBe(false);
    expect(isPlainRecord(true)).toBe(false);
  });
});

describe("castCamelKeys", () => {
  test("converts and casts to the target type", () => {
    const result = castCamelKeys<{
      fooBar: number;
    }>({
      foo_bar: 7,
    });
    expect(result).toEqual({
      fooBar: 7,
    });
  });
});

describe("readNonEmptyString", () => {
  test("reads a non-empty trimmed string", () => {
    expect(
      readNonEmptyString(
        {
          a: "  hello  ",
        },
        "a",
      ),
    ).toBe("hello");
  });

  test("returns null for empty strings", () => {
    expect(
      readNonEmptyString(
        {
          a: "",
        },
        "a",
      ),
    ).toBeNull();
  });

  test("returns null for whitespace strings", () => {
    expect(
      readNonEmptyString(
        {
          a: "   ",
        },
        "a",
      ),
    ).toBeNull();
  });

  test("returns null for missing key", () => {
    expect(readNonEmptyString({}, "missing")).toBeNull();
  });

  test("returns null for non-string values", () => {
    expect(
      readNonEmptyString(
        {
          a: 123,
        },
        "a",
      ),
    ).toBeNull();
  });

  test("returns null for null/undefined record", () => {
    expect(readNonEmptyString(null, "a")).toBeNull();
    expect(readNonEmptyString(undefined, "a")).toBeNull();
  });
});
