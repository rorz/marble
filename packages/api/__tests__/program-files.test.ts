/**
 * Validation-layer smoke tests for `programFiles.*`.
 *
 * Program files are first-class because the editor mutates them directly.
 * Filetype is an enum ("Json" | "Markdown" | "TypeScript"); content and
 * filename are strings; versionId is a UUID.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext, INVALID_UUID, VALID_UUID } from "./_setup";

const VALID_FILE = {
  content: "console.log('hi');",
  filename: "index.ts",
  filetype: "TypeScript" as const,
};
const VALID_CONFIG_FILE = {
  content: '{"inputSchema":{},"outputConfig":{"schema":{"type":"string"}}}',
  filename: "marbleconfig.jsonc",
  filetype: "Json" as const,
};
const VALID_MAIN_FILE = {
  content: "export default async function run() { return 'ok'; }",
  filename: "main.ts",
  filetype: "TypeScript" as const,
};
const VALID_PACKAGE_FILE = {
  content: '{"name":"test-program"}',
  filename: "package.json",
  filetype: "Json" as const,
};
const VALID_CONFIG_FILE_WITH_SECRET = {
  ...VALID_CONFIG_FILE,
  content:
    '{"inputSchema":{},"outputConfig":{"schema":{"type":"string"}},"secrets":{"type":"object","properties":{"APOLLO_API_KEY":{"type":"string","title":"Apollo API key"}},"required":["APOLLO_API_KEY"]}}',
};
const LEGACY_SECRET_CONFIG_FILE = {
  ...VALID_CONFIG_FILE,
  content:
    '{"inputSchema":{},"outputConfig":{"schema":{"type":"string"}},"secrets":[{"env":"APOLLO_API_KEY","label":"Apollo API key","required":true}]}',
};
const LEGACY_SECRET_CONFIG_FIELD_FILE = {
  ...VALID_CONFIG_FILE,
  content:
    '{"inputSchema":{},"outputConfig":{"schema":{"type":"string"}},"secretConfig":{"type":"object","properties":{"APOLLO_API_KEY":{"type":"string"}}}}',
};
const LEGACY_SECRET_PACKAGE_FILE = {
  ...VALID_PACKAGE_FILE,
  content:
    '{"name":"test-program","marble":{"secrets":[{"env":"APOLLO_API_KEY"}]}}',
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

  test("rejects file sets without main.ts", async () => {
    await expect(
      call(
        marbleRouter.programFiles.syncForVersion,
        {
          files: [
            VALID_PACKAGE_FILE,
            VALID_CONFIG_FILE,
          ],
          versionId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow("Program files must include main.ts.");
  });

  test("rejects file sets without package.json", async () => {
    await expect(
      call(
        marbleRouter.programFiles.syncForVersion,
        {
          files: [
            VALID_MAIN_FILE,
            VALID_CONFIG_FILE,
          ],
          versionId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow("Program files must include package.json.");
  });

  test("accepts secret declarations in marbleconfig.jsonc", async () => {
    await expect(
      call(
        marbleRouter.programFiles.syncForVersion,
        {
          files: [
            VALID_MAIN_FILE,
            VALID_PACKAGE_FILE,
            VALID_CONFIG_FILE_WITH_SECRET,
          ],
          versionId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow(/store/);
  });

  test("rejects legacy marbleconfig.jsonc secret arrays", async () => {
    await expect(
      call(
        marbleRouter.programFiles.syncForVersion,
        {
          files: [
            VALID_MAIN_FILE,
            VALID_PACKAGE_FILE,
            LEGACY_SECRET_CONFIG_FILE,
          ],
          versionId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow();
  });

  test("rejects legacy marbleconfig.jsonc secretConfig field", async () => {
    await expect(
      call(
        marbleRouter.programFiles.syncForVersion,
        {
          files: [
            VALID_MAIN_FILE,
            VALID_PACKAGE_FILE,
            LEGACY_SECRET_CONFIG_FIELD_FILE,
          ],
          versionId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow("Secret declarations belong in marbleconfig.jsonc");
  });

  test("rejects legacy package.json secret declarations", async () => {
    await expect(
      call(
        marbleRouter.programFiles.syncForVersion,
        {
          files: [
            VALID_MAIN_FILE,
            LEGACY_SECRET_PACKAGE_FILE,
            VALID_CONFIG_FILE,
          ],
          versionId: VALID_UUID,
        },
        {
          context: createValidationContext(),
        },
      ),
    ).rejects.toThrow("Secret declarations belong in marbleconfig.jsonc");
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
