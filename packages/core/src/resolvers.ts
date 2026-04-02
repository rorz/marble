import { JSONPath } from "jsonpath-plus";
import sift from "sift";

import type {
  ColumnOutputSchema,
  JsonValue,
  ProgramOutputConfig,
} from "./schemas";

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
 * Recursively walks the column config and resolves any key ending in `.$`
 * against the row context (view) using JSONPath.
 */
export function resolveColumnConfig(
  config: JsonValue,
  rowContext: Record<string, JsonValue>,
): JsonValue {
  if (config === null || typeof config !== "object") {
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
