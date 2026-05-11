/**
 * Validation-layer smoke tests for `tables.*`.
 *
 * These exercise the oRPC input validation layer. They do not require a
 * running database — if any of these tests reaches the store, the stub
 * context throws.
 *
 * `tables.insertRows` is the canonical aggregate-action operation per the
 * almanac and has the richest input contract:
 *
 *   - `id`: required UUID
 *   - `idx`: required non-negative integer
 *   - `quantity`: required positive integer
 *
 * Each rule deserves a negative test.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID, VALID_UUID } from "./_setup";

describe("tables.insertRows validation", () => {
  test("rejects negative idx", async () => {
    await expect(
      call(
        marbleRouter.tables.insertRows,
        {
          id: VALID_UUID,
          idx: -1,
          quantity: 1,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects zero quantity", async () => {
    await expect(
      call(
        marbleRouter.tables.insertRows,
        {
          id: VALID_UUID,
          idx: 0,
          quantity: 0,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects negative quantity", async () => {
    await expect(
      call(
        marbleRouter.tables.insertRows,
        {
          id: VALID_UUID,
          idx: 0,
          quantity: -1,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing id", async () => {
    await expect(
      call(
        marbleRouter.tables.insertRows,
        {
          idx: 0,
          quantity: 1,
        } as never,
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.tables.insertRows,
        {
          id: INVALID_UUID,
          idx: 0,
          quantity: 1,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("tables.create validation", () => {
  test("rejects non-uuid projectId", async () => {
    await expect(
      call(
        marbleRouter.tables.create,
        {
          projectId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing projectId", async () => {
    await expect(
      call(marbleRouter.tables.create, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });
});

describe("tables.list validation", () => {
  test("rejects non-uuid projectId", async () => {
    await expect(
      call(
        marbleRouter.tables.list,
        {
          projectId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("tables id-input validation", () => {
  test("get rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.tables.get,
        {
          id: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("delete rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.tables.delete,
        {
          id: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("update rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.tables.update,
        {
          id: INVALID_UUID,
          values: {
            name: "new",
          },
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});
