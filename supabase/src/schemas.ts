import { z } from "zod";

const UserInput = z.object({
  type: z.literal("UserInput"),
});

const MainInputFieldBase = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
});

const StringInput = z.object({
  ...MainInputFieldBase.shape,
  type: z.literal("String"),
});

const StringInputValue = z.object({
  ...StringInput.shape,
  value: z.string(),
});

export const JsonSchemaSchema = z.lazy(() => z.object({}).catchall(z.any()));

export const ColumnProgramInputSchema = z.object({
  variables: z.record(
    z.string(),
    z.discriminatedUnion("type", [
      UserInput,
      z.object({
        type: z.literal("String"),
        name: z.string(),
        description: z.string().optional(),
        required: z.boolean(),
      }),
      z.object({
        type: z.literal("Number"),
        name: z.string(),
        description: z.string().optional(),
        required: z.boolean(),
      }),
      z.object({
        type: z.literal("Enum"),
        name: z.string(),
        description: z.string().optional(),
        required: z.boolean(),
        options: z.array(z.string()),
      }),
      z.object({
        type: z.literal("Json"),
        name: z.string(),
        description: z.string().optional(),
        required: z.boolean(),
      }),
    ]),
  ),
});

export const ColumnProgramInputValuesTemplate = z.object({
  variables: z.record(
    z.string(),
    z.discriminatedUnion("source", [
      z.object({ source: z.literal("column"), column_id: z.string() }),
      z.object({ source: z.literal("cell_value") }),
      z.object({ source: z.literal("literal"), value: z.string() }),
    ]),
  ),
});

export const ColumnProgramOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(false),
    error: z.json().nullable(),
    message: z.string(),
  }),
  z.discriminatedUnion("type", [
    z.object({
      ok: z.literal(true),
      type: z.literal("Text"),
      value: z.string().nullable(),
    }),
    z.object({
      ok: z.literal(true),
      type: z.literal("Number"),
      value: z.number().nullable(),
    }),
    z.object({
      ok: z.literal(true),
      type: z.literal("Object"),
      value: z.json(),
    }),
  ]),
]);

export const ExecutorRequestBodySchema = z.object({
  $marble__cell_value: z.string().optional(),
});
