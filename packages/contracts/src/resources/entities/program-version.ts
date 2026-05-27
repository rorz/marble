import { z } from "zod";
import { defineResourceOperations } from "../../orpc";
import { baseEntitySchema, jsonValueSchema, timestampSchema } from "../base";

const tags = [
  "Program Versions",
] as const;

const mongoLiteralSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const mongoFieldOperatorsSchema = z
  .object({
    $eq: mongoLiteralSchema.optional(),
    $exists: z.boolean().optional(),
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
    $in: z.array(mongoLiteralSchema).optional(),
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
    $ne: mongoLiteralSchema.optional(),
    $nin: z.array(mongoLiteralSchema).optional(),
    $options: z.string().optional(),
    $regex: z.string().optional(),
    $size: z.number().int().nonnegative().optional(),
  })
  .strict();

const mongoFieldValueSchema = z.union([
  mongoLiteralSchema,
  mongoFieldOperatorsSchema,
  z.array(mongoLiteralSchema),
]);

type MongoFieldValue = z.infer<typeof mongoFieldValueSchema>;
type MongoQuery = {
  [key: string]: MongoFieldValue | MongoQuery[];
};

const matchConfigSchema: z.ZodType<MongoQuery> = z.lazy(() =>
  z
    .record(
      z.string(),
      z.union([
        mongoFieldValueSchema,
        z.array(matchConfigSchema),
      ]),
    )
    .superRefine((value, ctx) => {
      for (const [key, entry] of Object.entries(value)) {
        if (
          [
            "$and",
            "$or",
            "$nor",
          ].includes(key)
        ) {
          if (!Array.isArray(entry)) {
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

export const JsonSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, ctx) => {
    if (
      !value.type &&
      !value.$ref &&
      !value.properties &&
      !value.items &&
      Object.keys(value).length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Missing typical JSON schema fields (type, $ref, properties, etc.)",
      });
    }
  });

const overloadRuleSchema = z.object({
  match: matchConfigSchema,
  schema: JsonSchema,
});

export const ProgramInputSchema = JsonSchema;
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
  overloads: z.array(overloadRuleSchema).optional(),
  schema: JsonSchema,
});
export type ProgramOutputConfig = z.infer<typeof ProgramOutputConfig>;

export const RunInput = z.object({
  cell: z.object({
    manualInputValue: z.string().optional(),
  }),
  input: z.any(),
  system: z
    .object({
      providers: z.record(z.string(), z.any()).optional().default({}),
    })
    .catchall(z.any())
    .optional()
    .default({
      providers: {},
    }),
});
export type RunInput = z.infer<typeof RunInput>;

export const RunReturnValue = z.discriminatedUnion("ok", [
  z.object({
    error: z.json(),
    message: z.string(),
    ok: z.literal(false),
  }),
  z.object({
    ok: z.literal(true),
    value: z.json(),
  }),
]);
export type RunReturnValue = z.infer<typeof RunReturnValue>;

export const ProgramVersionSchema = z.object({
  ...baseEntitySchema.shape,
  programId: baseEntitySchema.shape.id,
  publishedAt: timestampSchema.nullable(),
  secretConfig: jsonValueSchema.nullable(),
  version: z.number().int().positive().nullable(),
});

const ProgramVersionWriteSchema = z.object({
  publish: z.boolean().optional(),
  secretConfig: jsonValueSchema.optional(),
  version: z.number().int().positive().optional(),
});

export const programVersionOperations = defineResourceOperations({
  create: {
    input: ProgramVersionWriteSchema.extend({
      programId: baseEntitySchema.shape.id,
    }),
    output: ProgramVersionSchema,
    route: {
      method: "POST",
      operationId: "programVersions.create",
      path: "/program-versions",
      summary: "Create a program version",
      tags,
    },
  },
  test: {
    input: z.object({
      inputConfig: z.record(z.string(), jsonValueSchema),
      manualInput: z.string().optional(),
      programVersionId: baseEntitySchema.shape.id,
    }),
    output: z.object({
      detail: jsonValueSchema.optional(),
      error: z.string().optional(),
      errorType: z.string().optional(),
      ok: z.boolean(),
      output: jsonValueSchema,
    }),
    route: {
      method: "POST",
      operationId: "programVersions.test",
      path: "/program-versions/{programVersionId}/test",
      summary: "Test a program version",
      tags,
    },
  },
  update: {
    input: z.object({
      id: baseEntitySchema.shape.id,
      values: ProgramVersionWriteSchema,
    }),
    output: ProgramVersionSchema,
    route: {
      method: "PATCH",
      operationId: "programVersions.update",
      path: "/program-versions/{id}",
      summary: "Update a program version",
      tags,
    },
  },
});
