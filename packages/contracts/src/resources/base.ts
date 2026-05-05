import z from "zod";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | {
      [key: string]: JsonValue | undefined;
    }
  | JsonValue[];

export const jsonValueSchema = z.json() as z.ZodType<JsonValue>;
export const timestampSchema = z.iso.datetime({
  offset: true,
});

export const baseEntitySchema = z.object({
  createdAt: timestampSchema,
  id: z.uuidv4(),
  updatedAt: timestampSchema,
});
