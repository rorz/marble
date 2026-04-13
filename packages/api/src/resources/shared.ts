import { Constants } from "@marble/supabase";
import { z } from "zod";
import { normalizeObjectKeys } from "../core";

type PublicEnumName = keyof typeof Constants.public.Enums;

function databaseEnumSchema<Name extends PublicEnumName>(name: Name) {
  return z.enum(Constants.public.Enums[name]);
}

export function requestObject<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.preprocess(
    (value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? normalizeObjectKeys(value as Record<string, unknown>)
        : value,
    z.object(shape),
  );
}

export const uuidSchema = z.string().uuid();
export const jsonValueSchema = z.json();
export const nonEmptyStringSchema = z.string().trim().min(1);

export const profileTypeSchema = databaseEnumSchema("profile_type");

export const programFileTypeSchema = databaseEnumSchema("program_file_type");

export const dataOperationSchema = databaseEnumSchema("data_operation");

export const programFilePayloadSchema = requestObject({
  content: z.string(),
  filename: nonEmptyStringSchema,
  filetype: programFileTypeSchema,
  ownerProfileId: uuidSchema.optional(),
});
