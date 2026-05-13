/**
 * Validation-layer smoke tests for `secrets.*`.
 *
 * Plaintext values are write-only; metadata reads never expose them.
 * The validation surface here is the input shape — handler-level
 * Vault interactions belong in integration tests.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("secrets.create validation", () => {
  test("rejects missing name", async () => {
    await expect(
      call(
        marbleRouter.secrets.create,
        {
          value: "supersecret",
        } as never,
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing value", async () => {
    await expect(
      call(
        marbleRouter.secrets.create,
        {
          name: "API_KEY",
        } as never,
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("secrets id-input validation", () => {
  test("get rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.secrets.get,
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
        marbleRouter.secrets.delete,
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
        marbleRouter.secrets.update,
        {
          id: INVALID_UUID,
          values: {
            name: "renamed",
          },
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});
