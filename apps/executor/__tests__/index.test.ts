import { describe, expect, test } from "bun:test";
import { parseProgramConfigFileContent } from "@marble/contracts";
import { getProgramVersionTestOutputSchema } from "../src/runner/output-schema";

describe("getProgramVersionTestOutputSchema", () => {
  test("reads output schema from already-parsed program config", () => {
    const programConfig = parseProgramConfigFileContent(
      JSON.stringify({
        inputSchema: {},
        outputConfig: {
          schema: {
            properties: {
              ok: {
                type: "boolean",
              },
            },
            type: "object",
          },
        },
        secrets: {
          properties: {
            APOLLO_API_KEY: {
              title: "Apollo API key",
              type: "string",
            },
          },
          required: [
            "APOLLO_API_KEY",
          ],
          type: "object",
        },
      }),
    );

    expect(programConfig.secrets).toEqual([
      {
        env: "APOLLO_API_KEY",
        label: "Apollo API key",
        required: true,
      },
    ]);
    expect(
      getProgramVersionTestOutputSchema({
        programConfig,
      }),
    ).toEqual({
      properties: {
        ok: {
          type: "boolean",
        },
      },
      type: "object",
    });
  });
});
