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

export const baseEntitySchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuidv4(),
  updatedAt: z.iso.datetime(),
});
