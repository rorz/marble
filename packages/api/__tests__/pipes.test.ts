/**
 * Validation-layer smoke tests for `pipes.*`.
 *
 * Pipes connect a source to a table inside the same project. Mappings
 * are optional but, when supplied, each entry's `jsonPath` must be a
 * non-empty trimmed string.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router/entities";
import { createValidationContext, INVALID_UUID, VALID_UUID } from "./_setup";

describe("pipes.create validation", () => {
  test("rejects non-uuid sourceId", async () => {
    await expect(
      call(
        marbleRouter.pipes.create,
        {
          sourceId: INVALID_UUID,
          tableId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects non-uuid tableId", async () => {
    await expect(
      call(
        marbleRouter.pipes.create,
        {
          sourceId: VALID_UUID,
          tableId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects empty jsonPath in mappings", async () => {
    await expect(
      call(
        marbleRouter.pipes.create,
        {
          mappings: [
            {
              columnId: VALID_UUID,
              jsonPath: "",
            },
          ],
          sourceId: VALID_UUID,
          tableId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects whitespace-only jsonPath in mappings", async () => {
    await expect(
      call(
        marbleRouter.pipes.create,
        {
          mappings: [
            {
              columnId: VALID_UUID,
              jsonPath: "   ",
            },
          ],
          sourceId: VALID_UUID,
          tableId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("pipes.list validation", () => {
  test("rejects empty input (must have sourceId or tableId)", async () => {
    await expect(
      call(marbleRouter.pipes.list, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });
});

describe("pipes id-input validation", () => {
  test("get rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.pipes.get,
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
        marbleRouter.pipes.delete,
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
        marbleRouter.pipes.update,
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
});
