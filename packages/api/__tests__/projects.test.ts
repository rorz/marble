/**
 * Validation-layer smoke tests for `projects.*`.
 *
 * Projects are the top-level user-owned workspace. Note that delete/get
 * take `{ projectId }` (the almanac-canonical name), not `{ id }`.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("projects.delete validation", () => {
  test("rejects non-uuid projectId", async () => {
    await expect(
      call(
        marbleRouter.projects.delete,
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
      call(marbleRouter.projects.delete, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });
});

describe("projects.get validation", () => {
  test("rejects non-uuid projectId", async () => {
    await expect(
      call(
        marbleRouter.projects.get,
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

describe("projects.update validation", () => {
  test("rejects non-uuid projectId", async () => {
    await expect(
      call(
        marbleRouter.projects.update,
        {
          projectId: INVALID_UUID,
        } as never,
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});
