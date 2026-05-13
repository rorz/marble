/**
 * Validation-layer smoke tests for `secretBindings.*`.
 *
 * Secret bindings live on programs and columns. `set*` replaces the
 * entire binding set for the target; `list*` enumerates by parent IDs.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router/entities";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("secretBindings.listColumns validation", () => {
  test("rejects non-uuid columnId", async () => {
    await expect(
      call(
        marbleRouter.secretBindings.listColumns,
        {
          columnIds: [
            INVALID_UUID,
          ],
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("secretBindings.listPrograms validation", () => {
  test("rejects non-uuid programId", async () => {
    await expect(
      call(
        marbleRouter.secretBindings.listPrograms,
        {
          programIds: [
            INVALID_UUID,
          ],
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("secretBindings.setColumn validation", () => {
  test("rejects non-uuid columnId", async () => {
    await expect(
      call(
        marbleRouter.secretBindings.setColumn,
        {
          bindings: [],
          columnId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("secretBindings.setProgram validation", () => {
  test("rejects non-uuid programId", async () => {
    await expect(
      call(
        marbleRouter.secretBindings.setProgram,
        {
          bindings: [],
          programId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});
