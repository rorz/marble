/**
 * Validation-layer smoke tests for `profiles.*`.
 *
 * Profiles are current-user actor identities. `create` enforces a
 * non-empty name and an Agent/Human type enum. Lifecycle operations on
 * human profiles are restricted by the almanac but that's an
 * authorization rule, not a validation rule.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("profiles.create validation", () => {
  test("rejects empty name", async () => {
    await expect(
      call(
        marbleRouter.profiles.create,
        {
          name: "",
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing name", async () => {
    await expect(
      call(marbleRouter.profiles.create, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });

  test("rejects invalid type enum value", async () => {
    await expect(
      call(
        marbleRouter.profiles.create,
        {
          name: "Test",
          type: "NotAType" as never,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

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

  test("delete rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.profiles.delete,
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
