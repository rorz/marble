import {
  coerceFieldValue,
  resolveReferenceColumnToken,
} from "../schema-fields";
import type { ReferenceableColumn } from "../types";
import type { ColumnFieldValues, ColumnInputField } from "./types";

export const buildDefaultFieldValues = (fields: ColumnInputField[]) => {
  const defaults: ColumnFieldValues = {};

  for (const field of fields) {
    defaults[field.key] = {
      mode: "static",
      value: field.defaultValue ?? field.enumValues?.[0] ?? "",
    };
  }

  return defaults;
};

export const buildColumnInputTemplate = ({
  currentTableId,
  fieldValues,
  fields,
  referenceColumns,
}: {
  currentTableId: string;
  fieldValues: ColumnFieldValues;
  fields: ColumnInputField[];
  referenceColumns: ReferenceableColumn[];
}) => {
  const template: Record<string, unknown> = {};

  for (const [key, fieldValue] of Object.entries(fieldValues)) {
    if (fieldValue.mode === "column") {
      template[`${key}.$`] = `$.columns.${fieldValue.value}.value`;
      continue;
    }

    const field = fields.find((entry) => entry.key === key);
    if (!field) {
      continue;
    }

    let value = fieldValue.value;
    if (typeof value === "string") {
      value = value.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
        const reference = resolveReferenceColumnToken(
          inner,
          referenceColumns,
          currentTableId,
        );

        if (reference) {
          return `{{$.columns.${reference.column.id}.value${reference.restPath}}}`;
        }

        return match;
      });
    }

    const coerced = coerceFieldValue(field, value);
    if (coerced !== undefined) {
      template[key] = coerced;
    }
  }

  return JSON.stringify(template);
};

export const validateColumnInputTemplate = ({
  currentTableId,
  fieldValues,
  referenceColumns,
}: {
  currentTableId: string;
  fieldValues: ColumnFieldValues;
  referenceColumns: ReferenceableColumn[];
}) => {
  for (const fieldValue of Object.values(fieldValues)) {
    if (fieldValue.mode !== "static" || typeof fieldValue.value !== "string") {
      continue;
    }

    const matches = [
      ...fieldValue.value.matchAll(/\{\{([^}]+)\}\}/g),
    ];

    for (const match of matches) {
      const inner = match[1];
      if (
        !resolveReferenceColumnToken(inner, referenceColumns, currentTableId)
      ) {
        return `Unrecognized column in formula: "${inner}". Please check your spelling.`;
      }
    }
  }

  return null;
};
