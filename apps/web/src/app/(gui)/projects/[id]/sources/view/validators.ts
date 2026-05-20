import { stringifyPretty } from "@marble/lib/json";
import { isPlainRecord } from "@marble/lib/object";
import { getErrorMessage } from "@marble/lib/result";
import { z } from "zod";
import type { SourceSchemaValidation } from "./types";

export const formatJson = (value: unknown) => {
  return stringifyPretty(value);
};

export const validateSourceSchemaText = (
  value: string,
): SourceSchemaValidation => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch (error) {
    return {
      message: getErrorMessage(error, "Payload schema must be JSON."),
      ok: false,
    };
  }

  if (!isPlainRecord(parsed)) {
    return {
      message: "Payload schema must be a JSON schema object.",
      ok: false,
    };
  }

  try {
    z.fromJSONSchema(parsed as z.core.JSONSchema.Schema);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? `Payload schema could not be compiled: ${error.message}`
          : "Payload schema could not be compiled.",
      ok: false,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
};
