import { describe, expect, test } from "bun:test";
import { formatRpcError, getErrorMessage } from "./index";

describe("getErrorMessage", () => {
  test("returns Error.message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  test("returns the string itself when given a non-empty string", () => {
    expect(getErrorMessage("nope")).toBe("nope");
  });

  test("falls back when given an empty string", () => {
    expect(getErrorMessage("")).toBe("Request failed.");
  });

  test("reads .message off plain objects", () => {
    expect(
      getErrorMessage({
        message: "from object",
      }),
    ).toBe("from object");
  });

  test("falls back when message is not a string", () => {
    expect(
      getErrorMessage({
        message: 123,
      }),
    ).toBe("Request failed.");
  });

  test("falls back for null", () => {
    expect(getErrorMessage(null)).toBe("Request failed.");
  });

  test("falls back for undefined with custom fallback", () => {
    expect(getErrorMessage(undefined, "nothing")).toBe("nothing");
  });

  test("falls back for primitive numbers", () => {
    expect(getErrorMessage(42)).toBe("Request failed.");
  });

  test("uses fallback when Error.message is empty", () => {
    expect(getErrorMessage(new Error(""), "fallback")).toBe("fallback");
  });
});

describe("formatRpcError", () => {
  test("uses toJSON when available", () => {
    const error = {
      toJSON() {
        return {
          code: "X",
          message: "y",
        };
      },
    };
    expect(formatRpcError(error)).toBe('{\n  "code": "X",\n  "message": "y"\n}');
  });

  test("falls through when toJSON throws", () => {
    const error = new Error("boom");
    (error as unknown as {
      toJSON: () => unknown;
    }).toJSON = () => {
      throw new Error("nope");
    };
    expect(formatRpcError(error)).toBe("boom");
  });

  test("formats objects with code+message", () => {
    expect(
      formatRpcError({
        code: "BAD",
        data: {
          x: 1,
        },
        message: "broken",
        status: 400,
      }),
    ).toBe(
      '{\n  "code": "BAD",\n  "data": {\n    "x": 1\n  },\n  "message": "broken",\n  "status": 400\n}',
    );
  });

  test("returns Error message with cause string", () => {
    expect(
      formatRpcError(
        new Error("outer", {
          cause: new Error("inner"),
        }),
      ),
    ).toBe("outer: inner");
  });

  test("returns Error message alone when cause is undefined", () => {
    expect(formatRpcError(new Error("plain"))).toBe("plain");
  });

  test("returns Error message with stringified non-Error cause", () => {
    expect(
      formatRpcError(
        new Error("outer", {
          cause: {
            ok: false,
          },
        }),
      ),
    ).toBe('outer: {"ok":false}');
  });

  test("returns String() for primitives", () => {
    expect(formatRpcError(42)).toBe("42");
    expect(formatRpcError(null)).toBe("null");
    expect(formatRpcError(undefined)).toBe("undefined");
  });

  test("returns String() for plain objects without code+message+toJSON", () => {
    expect(
      formatRpcError({
        random: 1,
      }),
    ).toBe("[object Object]");
  });
});
