import { describe, expect, test } from "bun:test";
import {
  type Compare,
  dedupeById,
  firstRelation,
  groupBy,
  indexBy,
  removeById,
  sortBy,
  upsertById,
} from "./index";

const byIdAsc: Compare<{
  id: string;
}> = (left, right) => left.id.localeCompare(right.id);

describe("upsertById", () => {
  test("inserts when no existing entry matches", () => {
    const rows = [
      {
        id: "a",
      },
    ];
    const next = upsertById(rows, {
      id: "b",
    });

    expect(next).toEqual([
      {
        id: "b",
      },
      {
        id: "a",
      },
    ]);
    expect(rows).toEqual([
      {
        id: "a",
      },
    ]);
  });

  test("replaces an existing entry by id", () => {
    const next = upsertById(
      [
        {
          id: "a",
          n: 1,
        },
        {
          id: "b",
          n: 2,
        },
      ],
      {
        id: "a",
        n: 99,
      },
    );

    expect(next).toEqual([
      {
        id: "a",
        n: 99,
      },
      {
        id: "b",
        n: 2,
      },
    ]);
  });

  test("applies the comparator when provided", () => {
    const next = upsertById(
      [
        {
          id: "c",
        },
        {
          id: "a",
        },
      ],
      {
        id: "b",
      },
      byIdAsc,
    );

    expect(next.map((row) => row.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("removeById", () => {
  test("filters the matching entry", () => {
    expect(
      removeById(
        [
          {
            id: "a",
          },
          {
            id: "b",
          },
        ],
        "a",
      ),
    ).toEqual([
      {
        id: "b",
      },
    ]);
  });

  test("returns the same shape when nothing matches", () => {
    expect(
      removeById(
        [
          {
            id: "a",
          },
        ],
        "z",
      ),
    ).toEqual([
      {
        id: "a",
      },
    ]);
  });

  test("returns an empty array for empty input", () => {
    expect(removeById([], "anything")).toEqual([]);
  });
});

describe("sortBy", () => {
  test("returns a new sorted array without mutating the original", () => {
    const rows = [
      {
        id: "c",
      },
      {
        id: "a",
      },
      {
        id: "b",
      },
    ];
    const sorted = sortBy(rows, byIdAsc);

    expect(sorted.map((row) => row.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(rows.map((row) => row.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  test("returns an empty array unchanged", () => {
    expect(
      sortBy(
        [] as Array<{
          id: string;
        }>,
        byIdAsc,
      ),
    ).toEqual([]);
  });
});

describe("dedupeById", () => {
  test("keeps the last occurrence of each id (Map insertion semantics)", () => {
    const next = dedupeById([
      {
        id: "a",
        n: 1,
      },
      {
        id: "b",
        n: 2,
      },
      {
        id: "a",
        n: 99,
      },
    ]);

    expect(next).toEqual([
      {
        id: "a",
        n: 99,
      },
      {
        id: "b",
        n: 2,
      },
    ]);
  });

  test("returns empty array for empty input", () => {
    expect(dedupeById([])).toEqual([]);
  });
});

describe("groupBy", () => {
  test("groups items by computed key", () => {
    const groups = groupBy(
      [
        {
          k: "x",
          v: 1,
        },
        {
          k: "y",
          v: 2,
        },
        {
          k: "x",
          v: 3,
        },
      ],
      (item) => item.k,
    );

    expect(groups.get("x")).toEqual([
      {
        k: "x",
        v: 1,
      },
      {
        k: "x",
        v: 3,
      },
    ]);
    expect(groups.get("y")).toEqual([
      {
        k: "y",
        v: 2,
      },
    ]);
    expect(groups.size).toBe(2);
  });

  test("returns an empty map for empty input", () => {
    expect(groupBy([], (item) => item).size).toBe(0);
  });
});

describe("indexBy", () => {
  test("indexes items by computed key, last write wins", () => {
    const index = indexBy(
      [
        {
          id: "a",
          n: 1,
        },
        {
          id: "b",
          n: 2,
        },
        {
          id: "a",
          n: 99,
        },
      ],
      (item) => item.id,
    );

    expect(index.get("a")).toEqual({
      id: "a",
      n: 99,
    });
    expect(index.get("b")).toEqual({
      id: "b",
      n: 2,
    });
    expect(index.size).toBe(2);
  });

  test("returns an empty map for empty input", () => {
    expect(indexBy([], (item) => item).size).toBe(0);
  });
});

describe("firstRelation", () => {
  test("returns the value when given a single object", () => {
    expect(
      firstRelation({
        id: "a",
      }),
    ).toEqual({
      id: "a",
    });
  });

  test("returns the first element of an array", () => {
    expect(
      firstRelation([
        {
          id: "a",
        },
        {
          id: "b",
        },
      ]),
    ).toEqual({
      id: "a",
    });
  });

  test("returns undefined for an empty array", () => {
    expect(firstRelation([])).toBeUndefined();
  });

  test("returns undefined for null", () => {
    expect(firstRelation(null)).toBeUndefined();
  });

  test("returns undefined for undefined", () => {
    expect(firstRelation(undefined)).toBeUndefined();
  });
});
