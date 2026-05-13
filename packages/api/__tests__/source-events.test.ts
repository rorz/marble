/**
 * Validation-layer smoke tests for `sourceEvents.*`.
 *
 * Source events are append-only via the public interface — no update or
 * delete. Creation derives `projectId` from the source, so callers must
 * not provide it.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("sourceEvents.create validation", () => {
  test("rejects non-uuid sourceId", async () => {
    await expect(
      call(
        marbleRouter.sourceEvents.create,
        {
          rawPayload: {
            foo: "bar",
          },
          sourceId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing sourceId", async () => {
    await expect(
      call(
        marbleRouter.sourceEvents.create,
        {
          rawPayload: {
            foo: "bar",
          },
        } as never,
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("sourceEvents.get validation", () => {
  test("rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.sourceEvents.get,
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

describe("sourceEvents.list validation", () => {
  test("rejects empty input (must have sourceId or projectId)", async () => {
    await expect(
      call(marbleRouter.sourceEvents.list, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });
});
