import { z } from "zod";

// ------------------------------------------------------------------
// 0. FOUNDATIONAL TYPES
// ------------------------------------------------------------------

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

// ------------------------------------------------------------------
// 1. MONGO QUERY MATCHER SCHEMA
// ------------------------------------------------------------------

// The basic literal values allowed in JSON
const MongoLiteral = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

// The field-level operators supported by sift.js
const MongoFieldOperators = z
  .object({
    $eq: MongoLiteral.optional(),
    $ne: MongoLiteral.optional(),
    $gt: z
      .union([
        z.number(),
        z.string(),
      ])
      .optional(),
    $gte: z
      .union([
        z.number(),
        z.string(),
      ])
      .optional(),
    $lt: z
      .union([
        z.number(),
        z.string(),
      ])
      .optional(),
    $lte: z
      .union([
        z.number(),
        z.string(),
      ])
      .optional(),
    $in: z.array(MongoLiteral).optional(),
    $nin: z.array(MongoLiteral).optional(),
    $exists: z.boolean().optional(),
    $size: z.number().int().nonnegative().optional(),
    $regex: z.string().optional(), // Must be a string in the DB, not a JS RegExp object
    $options: z.string().optional(), // Modifiers for regex like "i"
  })
  .strict(); // .strict() ensures typo'd operators throw an error before saving

// What a single field path is allowed to match against
const MongoFieldValue = z.union([
  MongoLiteral,
  MongoFieldOperators,
  z.array(MongoLiteral), // for exact array matching
]);
type MongoFieldValue = z.infer<typeof MongoFieldValue>;

// We need an explicit TypeScript type so Zod can do recursive lazy typing
type MongoQuery = {
  [key: string]: MongoFieldValue | MongoQuery[];
};

// The fully hardened recursive Sift.js Matcher
const matchConfigSchema: z.ZodType<MongoQuery> = z.lazy(() =>
  z
    .record(
      z.string(),
      z.union([
        MongoFieldValue,
        z.array(matchConfigSchema), // specifically handles arrays for $or, $and
      ]),
    )
    .superRefine((val, ctx) => {
      // Validate top-level logical operators
      for (const [key, value] of Object.entries(val)) {
        if (
          [
            "$and",
            "$or",
            "$nor",
          ].includes(key)
        ) {
          if (!Array.isArray(value)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Logical operator '${key}' must contain an array of query objects.`,
              path: [
                key,
              ],
            });
          }
        } else if (
          key.startsWith("$") &&
          ![
            "$and",
            "$or",
            "$nor",
          ].includes(key)
        ) {
          // Prevent users from trying to put field-level operators at the top level
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Top-level operator '${key}' is invalid. Did you mean to put this inside a field path?`,
            path: [
              key,
            ],
          });
        }
      }
    }),
);

// ------------------------------------------------------------------
// 2. MAIN OUTPUT STRATEGY SCHEMA
// ------------------------------------------------------------------

const JsonSchema = z.record(z.string(), z.unknown()).superRefine((val, ctx) => {
  if (
    !val.type &&
    !val.$ref &&
    !val.properties &&
    !val.items &&
    Object.keys(val).length > 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Missing typical JSON schema fields (type, $ref, properties, etc.)",
    });
  }
});

const OverloadRule = z.object({
  match: matchConfigSchema,
  schema: JsonSchema,
});

// --- Program

export const ProgramInputSchema = JsonSchema; // TODO: Make our own subset, probably without the top level metakeys?
export type ProgramInputSchema = z.infer<typeof ProgramInputSchema>;

export const ProgramOutputConfig = z.object({
  flags: z
    .object({
      allowInference: z.boolean().optional().default(false),
      allowManualInput: z.boolean().optional().default(false),
    })
    .optional()
    .default({
      allowInference: false,
      allowManualInput: false,
    }),
  schema: JsonSchema,
  overloads: z.array(OverloadRule).optional(),
});
export type ProgramOutputConfig = z.infer<typeof ProgramOutputConfig>;

// --- Column

export const ColumnOutputSchema = JsonSchema;
export type ColumnOutputSchema = z.infer<typeof ColumnOutputSchema>;

// --- Run

export const RunInput = z.object({
  system: z
    .object({
      providers: z.record(z.string(), z.any()).optional().default({}),
    })
    .catchall(z.any())
    .optional()
    .default({
      providers: {},
    }),
  cell: z.object({
    manualInputValue: z.string().optional(),
  }),
  input: z.any(),
});
export type RunInput = z.infer<typeof RunInput>;

export const RunReturnValue = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(false),
    error: z.json(),
    message: z.string(),
  }),
  z.object({
    ok: z.literal(true),
    value: z.json(), // TODO: Pass the output schema into this
  }),
]);
export type RunReturnValue = z.infer<typeof RunReturnValue>;
