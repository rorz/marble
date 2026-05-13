/**
 * Validation-layer smoke tests for `programs.*`.
 *
 * The public almanac surface is narrow: create, listForEditor, update.
 * File and version mutations have their own resources.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("programs.create validation", () => {
  test("rejects missing name", async () => {
    await expect(
      call(marbleRouter.programs.create, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });

  test("rejects non-string name", async () => {
    await expect(
      call(
        marbleRouter.programs.create,
        {
          name: 123 as never,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("programs.update validation", () => {
  test("rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.programs.update,
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
