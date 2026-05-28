import { describe, expect, test } from "bun:test";
import { prepareToolCallInput } from "../src/tools/contract/prepare-input";

describe("prepareToolCallInput", () => {
  test("fills User Input program version for simple column create calls", async () => {
    const prepared = await prepareToolCallInput({
      dispatch: {
        programs: {
          listForEditor: async () => ({
            programFiles: [],
            programs: [
              {
                firstParty: true,
                id: "user-input-program",
                name: "User Input",
              },
            ],
            programVersions: [
              {
                id: "old-version",
                programId: "user-input-program",
                publishedAt: "2025-01-01T00:00:00Z",
                version: 1,
              },
              {
                id: "latest-version",
                programId: "user-input-program",
                publishedAt: "2025-02-01T00:00:00Z",
                version: 2,
              },
            ],
          }),
        },
      },
      input: {
        inputTemplate: {
          format: "string",
        },
        name: "Bagel",
        tableId: "table-id",
      },
      operationId: "columns.create",
    });

    expect(prepared).toEqual({
      inputTemplate: '{"format":"string"}',
      name: "Bagel",
      programVersionId: "latest-version",
      runCondition: false,
      tableId: "table-id",
    });
  });

  test("does not rewrite dependent program columns", async () => {
    const prepared = await prepareToolCallInput({
      dispatch: {
        programs: {
          listForEditor: async () => {
            throw new Error("should not list programs");
          },
        },
      },
      input: {
        inputTemplate: {
          "name.$": "$.columns.name.value",
        },
        name: "Enrichment",
        tableId: "table-id",
      },
      operationId: "columns.create",
    });

    expect(prepared).toEqual({
      inputTemplate: '{"name.$":"$.columns.name.value"}',
      name: "Enrichment",
      tableId: "table-id",
    });
  });

  test("normalizes authored program files for runtime entrypoint expectations", async () => {
    const prepared = await prepareToolCallInput({
      dispatch: {},
      input: {
        files: [
          {
            content: "export default async function run() { return 'ok'; }",
            filename: "index.ts",
            filetype: "TypeScript",
          },
          {
            content:
              '{"inputSchema":{},"outputConfig":{"schema":{"type":"string"}}}',
            filename: "marbleconfig.jsonc",
            filetype: "Json",
          },
        ],
        versionId: "version-id",
      },
      operationId: "programFiles.syncForVersion",
    });

    expect(prepared).toEqual({
      files: [
        {
          content:
            '{\n  "dependencies": {},\n  "name": "marble-program",\n  "type": "module"\n}\n',
          filename: "package.json",
          filetype: "Json",
        },
        {
          content: "export default async function run() { return 'ok'; }",
          filename: "main.ts",
          filetype: "TypeScript",
        },
        {
          content:
            '{"inputSchema":{},"outputConfig":{"schema":{"type":"string"}}}',
          filename: "marbleconfig.jsonc",
          filetype: "Json",
        },
      ],
      versionId: "version-id",
    });
  });
});
