import { describe, expect, test } from "bun:test";
import { summarizeToolResult } from "../src/tools/contract/summarize-output";

describe("summarizeToolResult", () => {
  test("keeps the first-party User Input version visible in program editor summaries", () => {
    const summary = summarizeToolResult({
      operationId: "programs.listForEditor",
      result: {
        programFiles: [
          {
            content: "x".repeat(5000),
            filename: "main.ts",
            versionId: "user-input-version",
          },
        ],
        programs: [
          {
            firstParty: false,
            id: "other-program",
            name: "Searcher",
          },
          {
            firstParty: true,
            id: "user-input-program",
            name: "User Input",
          },
        ],
        programVersions: [
          {
            id: "other-version",
            outputConfig: {
              flags: {},
            },
            programId: "other-program",
            publishedAt: "2026-01-01T00:00:00.000Z",
            version: 1,
          },
          {
            id: "user-input-version",
            outputConfig: {
              flags: {
                allowManualInput: true,
              },
            },
            programId: "user-input-program",
            publishedAt: "2026-01-02T00:00:00.000Z",
            version: 1,
          },
        ],
      },
    });

    expect(summary).toContain(
      "First-party User Input: programId=user-input-program versionId=user-input-version.",
    );
    expect(summary).toContain(
      'programVersionId=user-input-version, inputTemplate=\'{"format":"string"}\'',
    );
    expect(summary).toContain(
      "Program file contents are omitted from this model summary",
    );
    expect(summary).not.toContain("xxxxx");
  });
});
