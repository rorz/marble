import { JSONPath } from "jsonpath-plus";
import sift from "sift";

import type {
  ColumnOutputSchema,
  JsonValue,
  ProgramOutputConfig,
} from "./schemas.js";

export const resolveColumnOutputSchema = (
  inputValues: Record<string, unknown>,
  outputConfig: ProgramOutputConfig,
): ColumnOutputSchema => {
  const matchingOverload = outputConfig.overloads?.find((overload) => {
    const test = sift(overload.match);
    return test(inputValues);
  });

  return matchingOverload?.schema ?? outputConfig.schema;
};

/**
 * Recursively walks the column config and resolves:
 * 1. Any key ending in `.$` against the row context using JSONPath.
 * 2. Any string containing `{{$.path.to.value}}` tags against the row context using JSONPath.
 */
export function resolveColumnConfig(
  config: JsonValue,
  rowContext: Record<string, JsonValue>,
): JsonValue {
  if (config === null || typeof config !== "object") {
    if (typeof config === "string") {
      // Check for inline JSONPath interpolation like "Hello {{$.columns.123.value}}"
      // If the string is exactly ONE interpolation tag, we return the raw value (so numbers/objects don't get stringified)
      const exactMatch = config.match(/^\{\{(\$\.[^}]+)\}\}$/);
      if (exactMatch) {
        return JSONPath({
          path: exactMatch[1],
          json: rowContext,
          wrap: false,
        }) as JsonValue;
      }

      // Otherwise, replace all occurrences, coercing them to strings
      return config.replace(/\{\{(\$\.[^}]+)\}\}/g, (_, path) => {
        const val = JSONPath({
          path,
          json: rowContext,
          wrap: false,
        });
        return val === null || val === undefined ? "" : String(val);
      });
    }
    return config;
  }

  if (Array.isArray(config)) {
    return config.map((item) => resolveColumnConfig(item, rowContext));
  }

  const resolvedObject: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(config)) {
    if (key.endsWith(".$")) {
      const cleanKey = key.slice(0, -2);

      // wrap: false returns the exact primitive/object for a single match
      const extractedValue = JSONPath({
        path: value as string,
        json: rowContext,
        wrap: false,
      });

      resolvedObject[cleanKey] = extractedValue as JsonValue;
    } else {
      resolvedObject[key] = resolveColumnConfig(value, rowContext);
    }
  }

  return resolvedObject;
}
