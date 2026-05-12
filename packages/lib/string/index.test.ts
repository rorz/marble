import { describe, expect, test } from "bun:test";
import {
  formatJsonPathDisplay,
  normalizeDisplayLabel,
  stripPrefix,
  trimTrailingSlash,
} from "./index";

describe("trimTrailingSlash", () => {
  test("removes a trailing slash", () => {
    expect(trimTrailingSlash("https://example.com/")).toBe(
      "https://example.com",
    );
  });

  test("leaves no-trailing-slash unchanged", () => {
    expect(trimTrailingSlash("https://example.com")).toBe(
      "https://example.com",
    );
  });

  test("returns empty for slash only", () => {
    expect(trimTrailingSlash("/")).toBe("");
  });

  test("returns empty for empty input", () => {
    expect(trimTrailingSlash("")).toBe("");
  });
});

describe("stripPrefix", () => {
  test("removes the prefix when present", () => {
    expect(stripPrefix("/api/foo", "/api")).toBe("/foo");
  });

  test("leaves the value unchanged when prefix is absent", () => {
    expect(stripPrefix("/foo", "/api")).toBe("/foo");
  });

  test("returns empty when value equals prefix", () => {
    expect(stripPrefix("/api", "/api")).toBe("");
  });

  test("handles empty prefix", () => {
    expect(stripPrefix("hello", "")).toBe("hello");
  });
});

describe("normalizeDisplayLabel", () => {
  test("returns the trimmed value", () => {
    expect(normalizeDisplayLabel("  hi  ", "fallback")).toBe("hi");
  });

  test("returns fallback for empty/whitespace strings", () => {
    expect(normalizeDisplayLabel("", "fallback")).toBe("fallback");
    expect(normalizeDisplayLabel("   ", "fallback")).toBe("fallback");
  });

  test("returns fallback for null/undefined", () => {
    expect(normalizeDisplayLabel(null, "fallback")).toBe("fallback");
    expect(normalizeDisplayLabel(undefined, "fallback")).toBe("fallback");
  });
});

describe("formatJsonPathDisplay", () => {
  test("returns $ for empty input", () => {
    expect(formatJsonPathDisplay("")).toBe("$");
    expect(formatJsonPathDisplay("   ")).toBe("$");
  });

  test("strips $. prefix", () => {
    expect(formatJsonPathDisplay("$.foo.bar")).toBe("foo.bar");
  });

  test("strips $ alone", () => {
    expect(formatJsonPathDisplay("$")).toBe("$");
  });

  test("converts bracket notation to dot notation", () => {
    expect(formatJsonPathDisplay("$['foo']['bar']")).toBe("foo.bar");
    expect(formatJsonPathDisplay('$["foo"]["bar"]')).toBe("foo.bar");
  });

  test("returns original when normalised value is empty", () => {
    expect(formatJsonPathDisplay("...")).toBe("...");
  });

  test("trims input", () => {
    expect(formatJsonPathDisplay("  $.foo  ")).toBe("foo");
  });
});
