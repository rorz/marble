import { describe, expect, test } from "bun:test";
import { byDateAsc, byDateDesc, byString, composeCompare } from "./index";

describe("byDateDesc", () => {
  test("orders newest first", () => {
    const items = [
      {
        at: "2025-01-01T00:00:00Z",
      },
      {
        at: "2026-01-01T00:00:00Z",
      },
      {
        at: "2024-01-01T00:00:00Z",
      },
    ];
    items.sort(byDateDesc((item) => item.at));
    expect(items.map((item) => item.at)).toEqual([
      "2026-01-01T00:00:00Z",
      "2025-01-01T00:00:00Z",
      "2024-01-01T00:00:00Z",
    ]);
  });

  test("returns 0 for equal timestamps", () => {
    const compare = byDateDesc<{
      at: string;
    }>((item) => item.at);
    expect(
      compare(
        {
          at: "2025-01-01T00:00:00Z",
        },
        {
          at: "2025-01-01T00:00:00Z",
        },
      ),
    ).toBe(0);
  });

  test("sinks invalid and empty date strings to the bottom", () => {
    const items = [
      {
        at: "",
      },
      {
        at: "2025-01-01T00:00:00Z",
      },
      {
        at: "not-a-date",
      },
      {
        at: "2026-01-01T00:00:00Z",
      },
    ];
    items.sort(byDateDesc((item) => item.at));
    expect(items.map((item) => item.at)).toEqual([
      "2026-01-01T00:00:00Z",
      "2025-01-01T00:00:00Z",
      "",
      "not-a-date",
    ]);
  });
});

describe("byDateAsc", () => {
  test("orders oldest first", () => {
    const items = [
      {
        at: "2025-01-01T00:00:00Z",
      },
      {
        at: "2024-01-01T00:00:00Z",
      },
    ];
    items.sort(byDateAsc((item) => item.at));
    expect(items.map((item) => item.at)).toEqual([
      "2024-01-01T00:00:00Z",
      "2025-01-01T00:00:00Z",
    ]);
  });

  test("sinks invalid and empty date strings to the bottom", () => {
    const items = [
      {
        at: "not-a-date",
      },
      {
        at: "2025-01-01T00:00:00Z",
      },
      {
        at: "",
      },
      {
        at: "2024-01-01T00:00:00Z",
      },
    ];
    items.sort(byDateAsc((item) => item.at));
    expect(items.map((item) => item.at)).toEqual([
      "2024-01-01T00:00:00Z",
      "2025-01-01T00:00:00Z",
      "not-a-date",
      "",
    ]);
  });
});

describe("byString", () => {
  test("orders by localeCompare", () => {
    const items = [
      {
        n: "banana",
      },
      {
        n: "apple",
      },
      {
        n: "cherry",
      },
    ];
    items.sort(byString((item) => item.n));
    expect(items.map((item) => item.n)).toEqual([
      "apple",
      "banana",
      "cherry",
    ]);
  });

  test("respects locale options", () => {
    const compare = byString<string>((value) => value, "en", {
      sensitivity: "base",
    });
    expect(compare("a", "A")).toBe(0);
  });
});

describe("composeCompare", () => {
  test("falls through to the next comparator on ties", () => {
    const items = [
      {
        kind: "b",
        n: 1,
      },
      {
        kind: "a",
        n: 2,
      },
      {
        kind: "a",
        n: 1,
      },
    ];
    items.sort(
      composeCompare(
        byString<(typeof items)[number]>((item) => item.kind),
        (left, right) => left.n - right.n,
      ),
    );
    expect(items).toEqual([
      {
        kind: "a",
        n: 1,
      },
      {
        kind: "a",
        n: 2,
      },
      {
        kind: "b",
        n: 1,
      },
    ]);
  });

  test("returns 0 when every comparator ties", () => {
    const compare = composeCompare<number>(
      () => 0,
      () => 0,
    );
    expect(compare(1, 2)).toBe(0);
  });

  test("composes zero comparators as a stable identity", () => {
    const compare = composeCompare<number>();
    expect(compare(1, 2)).toBe(0);
  });
});
