/**
 * Validation-layer smoke tests for `profiles.*`.
 *
 * Profiles are current-user actor identities. Every user has exactly one
 * Human and one Agent profile, both minted by the on_auth_user_created
 * trigger and pinned by a UNIQUE (owner_user_id, type) constraint. The
 * public surface is read + update only.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router/entities";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("profiles.list validation", () => {
  test("rejects invalid type filter", async () => {
    await expect(
      call(
        marbleRouter.profiles.list,
        {
          type: "NotAType" as never,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("profiles id-input validation", () => {
  test("get rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.profiles.get,
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
        marbleRouter.profiles.update,
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
