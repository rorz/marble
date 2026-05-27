/**
 * Validation-layer smoke tests for `programVersions.*`.
 *
 * Program versions own secret config, publish state, and test execution for a
 * program version. Input/output config lives in marbleconfig.jsonc.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID, VALID_UUID } from "./_setup";

describe("programVersions.create validation", () => {
  test("rejects non-uuid programId", async () => {
    await expect(
      call(
        marbleRouter.programVersions.create,
        {
          programId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing programId", async () => {
    await expect(
      call(marbleRouter.programVersions.create, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });
});

describe("programVersions.test validation", () => {
  test("rejects non-uuid programVersionId", async () => {
    await expect(
      call(
        marbleRouter.programVersions.test,
        {
          inputConfig: {},
          programVersionId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("programVersions.update validation", () => {
  test("rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.programVersions.update,
        {
          id: INVALID_UUID,
          values: {},
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("accepts well-formed id (validation only)", async () => {
    // This is intentionally a sanity test — `values: {}` is allowed; the
    // call must reach the handler (which then throws because the stub
    // store is a throw-on-touch proxy). We just verify validation passed.
    await expect(
      call(
        marbleRouter.programVersions.update,
        {
          id: VALID_UUID,
          values: {},
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow(/store/);
  });
});
