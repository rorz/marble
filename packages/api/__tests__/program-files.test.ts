/**
 * Validation-layer smoke tests for `programFiles.*`.
 *
 * Program files are first-class because the editor mutates them directly.
 * Filetype is an enum ("Json" | "Markdown" | "TypeScript"); content and
 * filename are strings; versionId is a UUID.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router/entities";
import { createValidationContext, INVALID_UUID, VALID_UUID } from "./_setup";

const VALID_FILE = {
  content: "console.log('hi');",
  filename: "index.ts",
  filetype: "TypeScript" as const,
};

describe("programFiles.create validation", () => {
  test("rejects non-uuid versionId", async () => {
    await expect(
      call(
        marbleRouter.programFiles.create,
        {
          ...VALID_FILE,
          versionId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects invalid filetype enum", async () => {
    await expect(
      call(
        marbleRouter.programFiles.create,
        {
          ...VALID_FILE,
          filetype: "Python" as never,
          versionId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing required field", async () => {
    await expect(
      call(
        marbleRouter.programFiles.create,
        {
          filename: "x.ts",
          versionId: VALID_UUID,
        } as never,
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("programFiles.syncForVersion validation", () => {
  test("rejects non-uuid versionId", async () => {
    await expect(
      call(
        marbleRouter.programFiles.syncForVersion,
        {
          files: [
            VALID_FILE,
          ],
          versionId: INVALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects invalid filetype in nested file", async () => {
    await expect(
      call(
        marbleRouter.programFiles.syncForVersion,
        {
          files: [
            {
              ...VALID_FILE,
              filetype: "Python" as never,
            },
          ],
          versionId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});

describe("programFiles id-input validation", () => {
  test("get rejects non-uuid id", async () => {
    await expect(
      call(
        marbleRouter.programFiles.get,
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
        marbleRouter.programFiles.delete,
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
        marbleRouter.programFiles.update,
        {
          id: INVALID_UUID,
          values: {
            filename: "new.ts",
          },
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });
});
