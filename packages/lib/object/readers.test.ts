import { describe, expect, test } from "bun:test";
import {
  readBoolean,
  readNumber,
  readRecord,
  readRecordArray,
  readString,
} from "./index";

describe("readString", () => {
  test("returns the raw untrimmed string", () => {
    expect(
      readString(
        {
          a: "  hello  ",
        },
        "a",
      ),
    ).toBe("  hello  ");
  });

  test("returns an empty string verbatim", () => {
    expect(
      readString(
        {
          a: "",
        },
        "a",
      ),
    ).toBe("");
  });

  test("returns null for non-string values", () => {
    expect(
      readString(
        {
          a: 1,
        },
        "a",
      ),
    ).toBeNull();
    expect(
      readString(
        {
          a: true,
        },
        "a",
      ),
    ).toBeNull();
    expect(
      readString(
        {
          a: null,
        },
        "a",
      ),
    ).toBeNull();
  });

  test("returns null for missing keys", () => {
    expect(readString({}, "missing")).toBeNull();
  });
});

describe("readNumber", () => {
  test("returns numeric values", () => {
    expect(
      readNumber(
        {
          a: 42,
        },
        "a",
      ),
    ).toBe(42);
    expect(
      readNumber(
        {
          a: 0,
        },
        "a",
      ),
    ).toBe(0);
    expect(
      readNumber(
        {
          a: -1.5,
        },
        "a",
      ),
    ).toBe(-1.5);
  });

  test("returns null for non-number values", () => {
    expect(
      readNumber(
        {
          a: "5",
        },
        "a",
      ),
    ).toBeNull();
    expect(
      readNumber(
        {
          a: true,
        },
        "a",
      ),
    ).toBeNull();
  });

  test("returns null for missing keys", () => {
    expect(readNumber({}, "missing")).toBeNull();
  });
});

describe("readBoolean", () => {
  test("returns booleans verbatim", () => {
    expect(
      readBoolean(
        {
          a: true,
        },
        "a",
      ),
    ).toBe(true);
    expect(
      readBoolean(
        {
          a: false,
        },
        "a",
      ),
    ).toBe(false);
  });

  test("never coerces truthy/falsy non-booleans", () => {
    expect(
      readBoolean(
        {
          a: 1,
        },
        "a",
      ),
    ).toBeNull();
    expect(
      readBoolean(
        {
          a: 0,
        },
        "a",
      ),
    ).toBeNull();
    expect(
      readBoolean(
        {
          a: "true",
        },
        "a",
      ),
    ).toBeNull();
  });
});

describe("readRecord", () => {
  test("returns nested plain objects", () => {
    expect(
      readRecord(
        {
          nested: {
            x: 1,
          },
        },
        "nested",
      ),
    ).toEqual({
      x: 1,
    });
  });

  test("returns null for arrays", () => {
    expect(
      readRecord(
        {
          a: [
            1,
            2,
          ],
        },
        "a",
      ),
    ).toBeNull();
  });

  test("returns null for null and primitives", () => {
    expect(
      readRecord(
        {
          a: null,
        },
        "a",
      ),
    ).toBeNull();
    expect(
      readRecord(
        {
          a: 7,
        },
        "a",
      ),
    ).toBeNull();
  });

  test("returns null for missing keys", () => {
    expect(readRecord({}, "missing")).toBeNull();
  });
});

describe("readRecordArray", () => {
  test("returns only the plain-record entries in the array", () => {
    expect(
      readRecordArray(
        {
          items: [
            {
              id: "a",
            },
            "skip",
            {
              id: "b",
            },
            null,
          ],
        },
        "items",
      ),
    ).toEqual([
      {
        id: "a",
      },
      {
        id: "b",
      },
    ]);
  });

  test("returns an empty array for non-array values", () => {
    expect(
      readRecordArray(
        {
          items: "not-an-array",
        },
        "items",
      ),
    ).toEqual([]);
    expect(readRecordArray({}, "missing")).toEqual([]);
  });
});
