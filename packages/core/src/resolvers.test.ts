import { describe, expect, it } from "vitest";
import { resolveColumnConfig, resolveColumnOutputSchema } from "./resolvers";
import type { JsonValue, ProgramOutputConfig } from "./schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const textOutputSchema = {
  type: "string",
} as const;
const numberOutputSchema = {
  type: "number",
} as const;
const imageOutputSchema = {
  type: "object",
  properties: {
    url: {
      type: "string",
    },
    alt: {
      type: "string",
    },
  },
} as const;

const baseOutputConfig: ProgramOutputConfig = {
  flags: {
    allowInference: false,
    allowManualInput: false,
  },
  schema: textOutputSchema,
};

// ---------------------------------------------------------------------------
// resolveColumnOutputSchema
// ---------------------------------------------------------------------------

describe("resolveColumnOutputSchema", () => {
  it("returns the base schema when no overloads are defined", () => {
    const result = resolveColumnOutputSchema({}, baseOutputConfig);
    expect(result).toEqual(textOutputSchema);
  });

  it("returns the base schema when overloads exist but none match", () => {
    const config: ProgramOutputConfig = {
      ...baseOutputConfig,
      overloads: [
        {
          match: {
            mode: "image",
          },
          schema: imageOutputSchema,
        },
      ],
    };

    const result = resolveColumnOutputSchema(
      {
        mode: "text",
      },
      config,
    );
    expect(result).toEqual(textOutputSchema);
  });

  it("returns the first matching overload schema", () => {
    const config: ProgramOutputConfig = {
      ...baseOutputConfig,
      overloads: [
        {
          match: {
            mode: "image",
          },
          schema: imageOutputSchema,
        },
      ],
    };

    const result = resolveColumnOutputSchema(
      {
        mode: "image",
      },
      config,
    );
    expect(result).toEqual(imageOutputSchema);
  });

  it("respects overload ordering (first match wins)", () => {
    const config: ProgramOutputConfig = {
      ...baseOutputConfig,
      overloads: [
        {
          match: {
            mode: "image",
          },
          schema: imageOutputSchema,
        },
        {
          match: {
            mode: "image",
          },
          schema: numberOutputSchema,
        },
      ],
    };

    const result = resolveColumnOutputSchema(
      {
        mode: "image",
      },
      config,
    );
    expect(result).toEqual(imageOutputSchema);
  });

  it("handles $in operator", () => {
    const config: ProgramOutputConfig = {
      ...baseOutputConfig,
      overloads: [
        {
          match: {
            format: {
              $in: [
                "png",
                "jpg",
                "webp",
              ],
            },
          },
          schema: imageOutputSchema,
        },
      ],
    };

    expect(
      resolveColumnOutputSchema(
        {
          format: "png",
        },
        config,
      ),
    ).toEqual(imageOutputSchema);
    expect(
      resolveColumnOutputSchema(
        {
          format: "csv",
        },
        config,
      ),
    ).toEqual(textOutputSchema);
  });

  it("handles $ne operator", () => {
    const config: ProgramOutputConfig = {
      ...baseOutputConfig,
      overloads: [
        {
          match: {
            mode: {
              $ne: "text",
            },
          },
          schema: numberOutputSchema,
        },
      ],
    };

    expect(
      resolveColumnOutputSchema(
        {
          mode: "number",
        },
        config,
      ),
    ).toEqual(numberOutputSchema);
    expect(
      resolveColumnOutputSchema(
        {
          mode: "text",
        },
        config,
      ),
    ).toEqual(textOutputSchema);
  });

  it("handles $or across multiple fields", () => {
    const config: ProgramOutputConfig = {
      ...baseOutputConfig,
      overloads: [
        {
          match: {
            $or: [
              {
                mode: "image",
              },
              {
                outputType: "visual",
              },
            ],
          },
          schema: imageOutputSchema,
        },
      ],
    };

    expect(
      resolveColumnOutputSchema(
        {
          mode: "image",
        },
        config,
      ),
    ).toEqual(imageOutputSchema);
    expect(
      resolveColumnOutputSchema(
        {
          outputType: "visual",
        },
        config,
      ),
    ).toEqual(imageOutputSchema);
    expect(
      resolveColumnOutputSchema(
        {
          mode: "text",
        },
        config,
      ),
    ).toEqual(textOutputSchema);
  });

  it("handles $and for multi-field matching", () => {
    const config: ProgramOutputConfig = {
      ...baseOutputConfig,
      overloads: [
        {
          match: {
            $and: [
              {
                mode: "transform",
              },
              {
                precision: "high",
              },
            ],
          },
          schema: numberOutputSchema,
        },
      ],
    };

    expect(
      resolveColumnOutputSchema(
        {
          mode: "transform",
          precision: "high",
        },
        config,
      ),
    ).toEqual(numberOutputSchema);
    expect(
      resolveColumnOutputSchema(
        {
          mode: "transform",
          precision: "low",
        },
        config,
      ),
    ).toEqual(textOutputSchema);
  });
});

// ---------------------------------------------------------------------------
// resolveColumnConfig
// ---------------------------------------------------------------------------

const rowContext = {
  columns: {
    "col-abc": {
      value: "hello world",
    },
    "col-def": {
      value: 42,
    },
    "col-ghi": {
      value: {
        nested: {
          deep: "treasure",
        },
      },
    },
  },
};

describe("resolveColumnConfig", () => {
  it("passes through primitives unchanged", () => {
    expect(resolveColumnConfig("hello", rowContext)).toBe("hello");
    expect(resolveColumnConfig(42, rowContext)).toBe(42);
    expect(resolveColumnConfig(true, rowContext)).toBe(true);
    expect(resolveColumnConfig(null, rowContext)).toBe(null);
  });

  it("passes through a fully static object unchanged", () => {
    const config = {
      prompt: "summarise this",
      temperature: 0.7,
    };
    expect(resolveColumnConfig(config, rowContext)).toEqual(config);
  });

  it("resolves a single .$ key via JSONPath", () => {
    const config = {
      "input.$": "$.columns.col-abc.value",
    };

    expect(resolveColumnConfig(config, rowContext)).toEqual({
      input: "hello world",
    });
  });

  it("resolves numeric values through .$", () => {
    const config = {
      "count.$": "$.columns.col-def.value",
    };

    expect(resolveColumnConfig(config, rowContext)).toEqual({
      count: 42,
    });
  });

  it("resolves deeply nested values through .$", () => {
    const config = {
      "secret.$": "$.columns.col-ghi.value.nested.deep",
    };

    expect(resolveColumnConfig(config, rowContext)).toEqual({
      secret: "treasure",
    });
  });

  it("mixes static and dynamic keys in the same object", () => {
    const config = {
      prompt: "Translate the following:",
      "text.$": "$.columns.col-abc.value",
      targetLanguage: "fr",
    };

    expect(resolveColumnConfig(config, rowContext)).toEqual({
      prompt: "Translate the following:",
      text: "hello world",
      targetLanguage: "fr",
    });
  });

  it("recursively resolves nested objects", () => {
    const config = {
      outer: {
        "inner.$": "$.columns.col-abc.value",
        static: true,
      },
    };

    expect(resolveColumnConfig(config, rowContext)).toEqual({
      outer: {
        inner: "hello world",
        static: true,
      },
    });
  });

  it("recursively resolves arrays", () => {
    const config: JsonValue = [
      {
        "a.$": "$.columns.col-abc.value",
      },
      {
        "b.$": "$.columns.col-def.value",
      },
    ];

    expect(resolveColumnConfig(config, rowContext)).toEqual([
      {
        a: "hello world",
      },
      {
        b: 42,
      },
    ]);
  });

  it("resolves an object value (not just scalars) through .$", () => {
    const config = {
      "payload.$": "$.columns.col-ghi.value",
    };

    expect(resolveColumnConfig(config, rowContext)).toEqual({
      payload: {
        nested: {
          deep: "treasure",
        },
      },
    });
  });
});
