import { getProgramInputSchema } from "../cell";
import {
  buildFieldsFromSchema,
  coerceFieldValue,
  parseTemplateToFieldValues,
  resolveReferenceColumnToken,
} from "../schema-fields";
import type { Column, Program, ReferenceableColumn } from "../types";
import type { ColumnFieldValues, ColumnInputField } from "./types";

type ColumnDraft = {
  fieldValues: ColumnFieldValues;
  name: string;
  programId: string;
  runConditionEnabled: boolean;
  secretBindings: Record<string, string>;
};

export const getLatestPublishedProgramVersion = (
  program: Program | undefined,
) => {
  return program?.programVersions?.length
    ? ([
        ...program.programVersions,
      ]
        .filter((version) => version.version !== null)
        .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))[0] ??
        null)
    : null;
};

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

export const buildProgramInputFields = ({
  programId,
  programs,
}: {
  programId: string;
  programs: Program[];
}) => {
  const program = programs.find((entry) => entry.id === programId);
  const version = getLatestPublishedProgramVersion(program);
  const schema = getProgramInputSchema(version);

  return schema ? buildFieldsFromSchema(schema) : [];
};

export const buildProgramDefaultFieldValues = ({
  programId,
  programs,
}: {
  programId: string;
  programs: Program[];
}) =>
  buildDefaultFieldValues(
    buildProgramInputFields({
      programId,
      programs,
    }),
  );

export const buildColumnDraft = ({
  column,
  columnSecretBindings,
  programs,
  referenceColumns,
}: {
  column: Column;
  columnSecretBindings: Record<string, string>;
  programs: Program[];
  referenceColumns: ReferenceableColumn[];
}): ColumnDraft => {
  const programId = column.programVersion?.programId ?? "";
  const fields = buildProgramInputFields({
    programId,
    programs,
  });

  return {
    fieldValues: parseTemplateToFieldValues(
      column.inputTemplate ?? "{}",
      fields,
      referenceColumns,
    ),
    name: column.name,
    programId,
    runConditionEnabled: column.runCondition === true,
    secretBindings: columnSecretBindings,
  };
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
      template[`${key}.$`] =
        `$.columns.${fieldValue.value}.value${fieldValue.path ?? ""}`;
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
    if (fieldValue.mode === "column") {
      if (!referenceColumns.some((column) => column.id === fieldValue.value)) {
        return "Choose a project column for every column dependency.";
      }
      continue;
    }

    if (typeof fieldValue.value !== "string") {
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
