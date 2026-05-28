import { describe, expect, test } from "bun:test";
import { resolveColumnConfig } from "../src/resources/entities/column";

const SOURCE_COLUMN_ID = "2dd390ad-0c19-49ae-ade3-ed1f0d603c97";
const rowContext = {
  columns: {
    [SOURCE_COLUMN_ID]: {
      value: {
        email: "ada@example.com",
        name: "Ada",
      },
    },
  },
};

describe("resolveColumnConfig", () => {
  test("resolves column-id shorthand interpolation", () => {
    expect(
      resolveColumnConfig(`{{col.${SOURCE_COLUMN_ID}}}`, rowContext),
    ).toEqual({
      email: "ada@example.com",
      name: "Ada",
    });
  });

  test("resolves inline shorthand paths", () => {
    expect(
      resolveColumnConfig(
        `Email {{col.${SOURCE_COLUMN_ID}.email}}`,
        rowContext,
      ),
    ).toBe("Email ada@example.com");
  });
});
