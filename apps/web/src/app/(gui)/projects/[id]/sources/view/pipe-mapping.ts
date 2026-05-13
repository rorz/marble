import type { PipeMappingDraft, PipeMappingInput } from "./types";

export function createPipeMappingDraft(
  value: Partial<PipeMappingInput> = {},
): PipeMappingDraft {
  return {
    columnId: value.columnId ?? "",
    draftId: crypto.randomUUID(),
    jsonPath: value.jsonPath ?? "",
  };
}

export function normalizePipeFieldName(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

export function formatPipeCandidatePreview(value: unknown) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (typeof value === "object") {
    return "Object";
  }

  const preview = String(value);
  return preview.length > 48 ? `${preview.slice(0, 45)}...` : preview;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function formatPipeSchemaPreview(schema: Record<string, unknown>) {
  const enumValues = Array.isArray(schema.enum)
    ? schema.enum.filter(
        (value): value is boolean | null | number | string =>
          typeof value === "boolean" ||
          typeof value === "number" ||
          typeof value === "string" ||
          value === null,
      )
    : [];

  if (enumValues.length > 0) {
    const preview = enumValues
      .slice(0, 3)
      .map((value) => formatPipeCandidatePreview(value))
      .join(", ");

    return enumValues.length > 3 ? `Enum ${preview}, ...` : `Enum ${preview}`;
  }

  const schemaType = schema.type;
  const typeLabels =
    typeof schemaType === "string"
      ? [
          schemaType,
        ]
      : Array.isArray(schemaType)
        ? schemaType.filter(
            (value): value is string => typeof value === "string",
          )
        : [];

  if (typeLabels.length > 0) {
    return typeLabels.join(" | ");
  }

  if (isPlainObject(schema.properties)) {
    return "object";
  }

  if (schema.items !== undefined) {
    return "array";
  }

  return "value";
}
