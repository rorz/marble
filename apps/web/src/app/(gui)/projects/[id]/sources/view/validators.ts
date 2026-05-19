import { stringifyPretty } from "@marble/lib/json";
import { getErrorMessage } from "@marble/lib/result";
import { z } from "zod";
import { isPlainObject } from "./pipe-mapping";
import type { SourceSchemaValidation } from "./types";

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

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

  if (!isPlainObject(parsed)) {
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
