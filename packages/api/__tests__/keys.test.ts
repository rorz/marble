/**
 * Validation-layer smoke tests for `keys.*`.
 *
 * Keys are profile-owned API credentials. The almanac is deliberately
 * narrow: create, list, revoke. No update, no get (token material is
 * only returned at creation).
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("keys.create validation", () => {
  test("rejects non-uuid ownerProfileId", async () => {
    await expect(
      call(
        marbleRouter.keys.create,
        {
          ownerProfileId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing ownerProfileId", async () => {
    await expect(
      call(marbleRouter.keys.create, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });
});

describe("keys.revoke validation", () => {
  test("rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.keys.revoke,
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

describe("keys.list validation", () => {
  test("rejects non-uuid ownerProfileId filter", async () => {
    await expect(
      call(
        marbleRouter.keys.list,
        {
          ownerProfileId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});
