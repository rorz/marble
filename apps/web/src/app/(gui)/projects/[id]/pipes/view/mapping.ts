import { isPlainRecord } from "@marble/lib/object";
import type {
  InputColumn,
  PipeMappingDraft,
  PipeMappingInput,
  PipePathCandidate,
} from "./types";

export const createPipeMappingDraft = (
  value: Partial<PipeMappingInput> = {},
): PipeMappingDraft => {
  return {
    columnId: value.columnId ?? "",
    draftId: crypto.randomUUID(),
    jsonPath: value.jsonPath ?? "",
  };
};

export const normalizePipeFieldName = (value: string) => {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
};

export const buildPipeMappingsPayload = (
  mappings: PipeMappingDraft[],
): PipeMappingInput[] => {
  return mappings
    .filter(
      (mapping) =>
        mapping.columnId.trim().length > 0 &&
        mapping.jsonPath.trim().length > 0,
    )
    .map(({ columnId, jsonPath }) => ({
      columnId,
      jsonPath,
    }));
};

export const updatePipeMappingDrafts = (
  current: PipeMappingDraft[],
  columnId: string,
  patch: Partial<PipeMappingInput>,
) => {
  return current.some((mapping) => mapping.columnId === columnId)
    ? current.map((mapping) =>
        mapping.columnId === columnId
          ? {
              ...mapping,
              ...patch,
            }
          : mapping,
      )
    : [
        ...current,
        createPipeMappingDraft({
          columnId,
          ...patch,
        }),
      ];
};

export const togglePipeMappingDraft = (
  current: PipeMappingDraft[],
  columnId: string,
) => {
  return current.some((mapping) => mapping.columnId === columnId)
    ? current.filter((mapping) => mapping.columnId !== columnId)
    : [
        ...current,
        createPipeMappingDraft({
          columnId,
        }),
      ];
};

export const autoMapPipeMappingDrafts = ({
  availablePipeColumns,
  current,
  pipePathCandidateByNormalizedKey,
}: {
  availablePipeColumns: InputColumn[];
  current: PipeMappingDraft[];
  pipePathCandidateByNormalizedKey: ReadonlyMap<string, PipePathCandidate>;
}) => {
  let matchedColumnCount = 0;
  const nextByColumnId = new Map(
    current.map((mapping) => [
      mapping.columnId,
      mapping,
    ]),
  );

  for (const column of availablePipeColumns) {
    const candidate = pipePathCandidateByNormalizedKey.get(
      normalizePipeFieldName(column.name),
    );

    if (!candidate) {
      continue;
    }

    const existing = nextByColumnId.get(column.id);
    if (existing?.jsonPath.trim().length) {
      continue;
    }

    matchedColumnCount += 1;
    nextByColumnId.set(
      column.id,
      createPipeMappingDraft({
        columnId: column.id,
        jsonPath: candidate.path,
      }),
    );
  }

  const orderByColumnId = new Map(
    availablePipeColumns.map((column, index) => [
      column.id,
      index,
    ]),
  );

  return {
    mappings: Array.from(nextByColumnId.values()).sort(
      (left, right) =>
        (orderByColumnId.get(left.columnId) ?? Number.MAX_SAFE_INTEGER) -
        (orderByColumnId.get(right.columnId) ?? Number.MAX_SAFE_INTEGER),
    ),
    matchedColumnCount,
  };
};

export const formatPipeCandidatePreview = (value: unknown) => {
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
};

export const formatPipeSchemaPreview = (schema: Record<string, unknown>) => {
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

  if (isPlainRecord(schema.properties)) {
    return "object";
  }

  if (schema.items !== undefined) {
    return "array";
  }

  return "value";
};
