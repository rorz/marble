/**
 * Validation-layer smoke tests for `columns.*`.
 *
 * `columns.create` requires the full table-binding payload (tableId,
 * programVersionId, name, inputTemplate). Each is UUID/string typed so
 * negative cases are clean.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router/entities";
import { createValidationContext, INVALID_UUID, VALID_UUID } from "./_setup";

const VALID_CREATE_INPUT = {
  inputTemplate: "{{ $.foo }}",
  name: "Test Column",
  programVersionId: VALID_UUID,
  tableId: VALID_UUID,
};

describe("columns.create validation", () => {
  test("rejects non-uuid tableId", async () => {
    await expect(
      call(
        marbleRouter.columns.create,
        {
          ...VALID_CREATE_INPUT,
          tableId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects non-uuid programVersionId", async () => {
    await expect(
      call(
        marbleRouter.columns.create,
        {
          ...VALID_CREATE_INPUT,
          programVersionId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing tableId", async () => {
    const { tableId: _omit, ...rest } = VALID_CREATE_INPUT;
    await expect(
      call(marbleRouter.columns.create, rest as never, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow();
  });
});

describe("columns.list validation", () => {
  test("rejects non-uuid tableId", async () => {
    await expect(
      call(
        marbleRouter.columns.list,
        {
          tableId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("columns id-input validation", () => {
  test("get rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.columns.get,
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
        marbleRouter.columns.delete,
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
        marbleRouter.columns.update,
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
