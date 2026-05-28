import { describe, expect, test } from "bun:test";
import {
  extractColumnInputTemplateDependencies,
  normalizeColumnInputTemplate,
} from "../src/resources/entities/column/input-template";

const EMAIL_COLUMN_ID = "2dd390ad-0c19-49ae-ade3-ed1f0d603c97";
const NAME_COLUMN_ID = "c7cc39e8-7f1a-4c46-92f1-1d34fc0b2b41";

describe("normalizeColumnInputTemplate", () => {
  test("normalizes column-id shorthand interpolation to runtime JSONPath", () => {
    expect(
      normalizeColumnInputTemplate(
        JSON.stringify({
          email: `{{col.${EMAIL_COLUMN_ID}}}`,
          prompt: `Email {{ col.${EMAIL_COLUMN_ID}.address }} for {{col.${NAME_COLUMN_ID}}}`,
        }),
      ),
    ).toBe(
      JSON.stringify({
        email: `{{$.columns.${EMAIL_COLUMN_ID}.value}}`,
        prompt: `Email {{$.columns.${EMAIL_COLUMN_ID}.value.address}} for {{$.columns.${NAME_COLUMN_ID}.value}}`,
      }),
    );
  });

  test("normalizes shorthand dynamic references", () => {
    expect(
      normalizeColumnInputTemplate(
        JSON.stringify({
          "email.$": `col.${EMAIL_COLUMN_ID}`,
        }),
      ),
    ).toBe(
      JSON.stringify({
        "email.$": `$.columns.${EMAIL_COLUMN_ID}.value`,
      }),
    );
  });
});

describe("extractColumnInputTemplateDependencies", () => {
  test("extracts dependencies from canonical and shorthand references", () => {
    expect(
      extractColumnInputTemplateDependencies(
        JSON.stringify({
          canonical: `{{$.columns.${EMAIL_COLUMN_ID}.value}}`,
          shorthand: `{{col.${NAME_COLUMN_ID}}}`,
        }),
      ).sort(),
    ).toEqual(
      [
        EMAIL_COLUMN_ID,
        NAME_COLUMN_ID,
      ].sort(),
    );
  });
});
