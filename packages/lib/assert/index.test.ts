import { describe, expect, test } from "bun:test";
import { assert } from "./index";

describe("assert", () => {
  test("does nothing when condition is true", () => {
    expect(() => assert(true, "should not throw")).not.toThrow();
  });

  test("throws AssertionError when condition is false", () => {
    let caught: unknown;
    try {
      assert(false, "boom");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe("AssertionError");
    expect((caught as Error).message).toBe("boom");
  });

  test("attaches a stack trace", () => {
    try {
      assert(false, "boom");
    } catch (error) {
      expect((error as Error).stack).toBeDefined();
    }
  });

  test("narrows types when condition is true", () => {
    const value: number | undefined = 7;
    assert(value !== undefined, "value must be set");
    // After assert, TypeScript narrows `value` to `number`.
    const doubled: number = value * 2;
    expect(doubled).toBe(14);
  });
});
