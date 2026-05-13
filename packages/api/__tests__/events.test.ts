/**
 * Validation-layer smoke tests for `events.*`.
 *
 * The event feed surface is intentionally small — listForCurrentUser is
 * a bounded read (limit clamps between 1 and 500) and resolveTargets is
 * a UUID-array lookup. Both have clean validation contracts.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("events.listForCurrentUser validation", () => {
  test("rejects limit = 0 (must be positive)", async () => {
    await expect(
      call(
        marbleRouter.events.listForCurrentUser,
        {
          limit: 0,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects limit > 500", async () => {
    await expect(
      call(
        marbleRouter.events.listForCurrentUser,
        {
          limit: 501,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects negative limit", async () => {
    await expect(
      call(
        marbleRouter.events.listForCurrentUser,
        {
          limit: -1,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects non-integer limit", async () => {
    await expect(
      call(
        marbleRouter.events.listForCurrentUser,
        {
          limit: 1.5,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects invalid source in excludeSources", async () => {
    await expect(
      call(
        marbleRouter.events.listForCurrentUser,
        {
          excludeSources: [
            "NOT_A_SOURCE" as never,
          ],
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("events.resolveTargets validation", () => {
  test("rejects non-uuid in columnIds", async () => {
    await expect(
      call(
        marbleRouter.events.resolveTargets,
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

  test("rejects non-uuid in rowIds", async () => {
    await expect(
      call(
        marbleRouter.events.resolveTargets,
        {
          rowIds: [
            INVALID_UUID,
          ],
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects non-uuid in programVersionIds", async () => {
    await expect(
      call(
        marbleRouter.events.resolveTargets,
        {
          programVersionIds: [
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
