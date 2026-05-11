/**
 * Validation-layer smoke tests for `rows.*`.
 *
 * Per the almanac, user-facing row insertion goes through
 * `tables.insertRows`. The row resource exposes list/get/update/delete
 * only.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID, VALID_UUID } from "./_setup";

describe("rows.list validation", () => {
  test("rejects non-uuid tableId", async () => {
    await expect(
      call(
        marbleRouter.rows.list,
        {
          tableId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("rows.update validation", () => {
  test("rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.rows.update,
        {
          id: INVALID_UUID,
          values: {
            idx: 0,
          },
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects negative idx", async () => {
    await expect(
      call(
        marbleRouter.rows.update,
        {
          id: VALID_UUID,
          values: {
            idx: -1,
          },
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects non-integer idx", async () => {
    await expect(
      call(
        marbleRouter.rows.update,
        {
          id: VALID_UUID,
          values: {
            idx: 1.5,
          },
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("rows id-input validation", () => {
  test("get rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.rows.get,
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
        marbleRouter.rows.delete,
        {
          id: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});
