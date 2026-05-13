/**
 * Validation-layer smoke tests for `sources.*`.
 *
 * Sources describe the shape of inbound payloads for a project.
 * `create` takes a projectId; everything else is id-keyed.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID } from "./_setup";

describe("sources.create validation", () => {
  test("rejects non-uuid projectId", async () => {
    await expect(
      call(
        marbleRouter.sources.create,
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
      call(marbleRouter.sources.create, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });
});

describe("sources.list validation", () => {
  test("rejects non-uuid projectId", async () => {
    await expect(
      call(
        marbleRouter.sources.list,
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

describe("sources id-input validation", () => {
  test("get rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.sources.get,
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
        marbleRouter.sources.delete,
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
        marbleRouter.sources.update,
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
