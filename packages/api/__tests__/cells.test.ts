/**
 * Validation-layer smoke tests for `cells.*`.
 *
 * Cells are deliberately lifecycle-light per the almanac (no create, no
 * delete, no generic update). The retained operations all key off a cell
 * ID or a row/column pair, and most validation is UUID-shape enforcement.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID, VALID_UUID } from "./_setup";

describe("cells.get validation", () => {
  test("rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.cells.get,
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

describe("cells.list validation", () => {
  test("rejects empty input (must have rowId or columnId)", async () => {
    await expect(
      call(marbleRouter.cells.list, {} as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });

  test("rejects non-uuid rowId", async () => {
    await expect(
      call(
        marbleRouter.cells.list,
        {
          rowId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects non-uuid columnId", async () => {
    await expect(
      call(
        marbleRouter.cells.list,
        {
          columnId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("cells.setManualValue validation", () => {
  test("rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.cells.setManualValue,
        {
          id: INVALID_UUID,
          value: "anything",
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects non-string value (must be string or null)", async () => {
    await expect(
      call(
        marbleRouter.cells.setManualValue,
        {
          id: VALID_UUID,
          value: 123 as never,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("cells.run validation", () => {
  test("rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.cells.run,
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
