import { JSONPath } from "jsonpath-plus";
import sift from "sift";
import { z } from "zod";
import { defineResourceOperations } from "../../orpc";
import { baseEntitySchema, type JsonValue, jsonValueSchema } from "../base";
import { JsonSchema, type ProgramOutputConfig } from "./program-version";

const tags = [
  "Columns",
] as const;

const COLUMN_ID_PATTERN =
  "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const COLUMN_SHORTHAND_REFERENCE_PATTERN = new RegExp(
  `^col\\.(${COLUMN_ID_PATTERN})((?:[.\\[].*?)?)$`,
  "i",
);

const ColumnSchema = z.object({
  ...baseEntitySchema.shape,
  idx: z.number().int().nonnegative(),
  inputTemplate: z.string(),
  name: z.string(),
  outputSchema: jsonValueSchema,
  programVersionId: baseEntitySchema.shape.id,
  runCondition: jsonValueSchema,
  tableId: baseEntitySchema.shape.id,
});

export const ColumnRunCondition = z.boolean();
export type ColumnRunCondition = z.infer<typeof ColumnRunCondition>;

export const ColumnOutputSchema = JsonSchema;
export type ColumnOutputSchema = z.infer<typeof ColumnOutputSchema>;

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

const normalizeColumnReferencePath = (reference: string): string | null => {
  const trimmed = reference.trim();
  if (trimmed.startsWith("$.")) return trimmed;

  const shorthandMatch = trimmed.match(COLUMN_SHORTHAND_REFERENCE_PATTERN);
  if (!shorthandMatch) return null;

  return `$.columns.${shorthandMatch[1]}.value${shorthandMatch[2] ?? ""}`;
};

export const resolveColumnConfig = (
  config: JsonValue,
  rowContext: Record<string, JsonValue>,
): JsonValue => {
  if (config === null || typeof config !== "object") {
    if (typeof config === "string") {
      const exactMatch = config.match(/^\{\{([^}]+)\}\}$/);

      if (exactMatch) {
        const path = normalizeColumnReferencePath(exactMatch[1]);
        if (path) {
          return JSONPath({
            json: rowContext,
            path,
            wrap: false,
          }) as JsonValue;
        }
      }

      return config.replace(/\{\{([^}]+)\}\}/g, (match, reference) => {
        const path = normalizeColumnReferencePath(reference);
        if (!path) return match;

        const value = JSONPath({
          json: rowContext,
          path,
          wrap: false,
        });
        return value === null || value === undefined ? "" : String(value);
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
      const extractedValue = JSONPath({
        json: rowContext,
        path: value as string,
        wrap: false,
      });

      resolvedObject[cleanKey] = extractedValue as JsonValue;
    } else {
      resolvedObject[key] = resolveColumnConfig(value, rowContext);
    }
  }

  return resolvedObject;
};

export const columnOperations = defineResourceOperations({
  create: {
    input: ColumnSchema.pick({
      idx: true,
      inputTemplate: true,
      name: true,
      outputSchema: true,
      programVersionId: true,
      runCondition: true,
      tableId: true,
    }).partial({
      idx: true,
      outputSchema: true,
      runCondition: true,
    }),
    output: ColumnSchema,
    route: {
      method: "POST",
      operationId: "columns.create",
      path: "/columns",
      summary: "Create a column",
      tags,
    },
  },
  delete: {
    input: ColumnSchema.pick({
      id: true,
    }),
    output: ColumnSchema,
    route: {
      method: "DELETE",
      operationId: "columns.delete",
      path: "/columns/{id}",
      summary: "Delete a column",
      tags,
    },
  },
  get: {
    input: ColumnSchema.pick({
      id: true,
    }),
    output: ColumnSchema,
    route: {
      method: "GET",
      operationId: "columns.get",
      path: "/columns/{id}",
      summary: "Get a column",
      tags,
    },
  },
  list: {
    input: ColumnSchema.pick({
      tableId: true,
    }),
    output: z.array(ColumnSchema),
    route: {
      method: "GET",
      operationId: "columns.list",
      path: "/columns",
      summary: "List columns",
      tags,
    },
  },
  listReferenceable: {
    input: z.object({
      projectId: baseEntitySchema.shape.id,
    }),
    output: z.array(
      ColumnSchema.pick({
        id: true,
        name: true,
        tableId: true,
      }).extend({
        allowManualInput: z.boolean(),
        label: z.string(),
        projectId: baseEntitySchema.shape.id,
        projectName: z.string(),
        tableName: z.string(),
      }),
    ),
    route: {
      method: "GET",
      operationId: "columns.listReferenceable",
      path: "/columns/referenceable",
      summary: "List referenceable columns",
      tags,
    },
  },
  update: {
    input: ColumnSchema.pick({
      id: true,
    }).extend({
      values: ColumnSchema.pick({
        idx: true,
        inputTemplate: true,
        name: true,
        outputSchema: true,
        programVersionId: true,
        runCondition: true,
      }).partial(),
    }),
    output: ColumnSchema,
    route: {
      method: "PATCH",
      operationId: "columns.update",
      path: "/columns/{id}",
      summary: "Update a column",
      tags,
    },
  },
});
