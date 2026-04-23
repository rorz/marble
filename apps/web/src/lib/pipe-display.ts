export type PipeMappingRecord = {
  columnId: string;
  jsonPath: string;
};

export type PipeMappingDisplayRecord = PipeMappingRecord & {
  columnLabel: string;
  jsonPathLabel: string;
};

function normalizeDisplayLabel(
  value: null | string | undefined,
  fallback: string,
) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function formatPipeJsonPathLabel(value: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "$";
  }

  const normalized = trimmed
    .replace(/^\$\./, "")
    .replace(/^\$/, "")
    .replace(/\[['"]([^'"\]]+)['"]\]/g, ".$1")
    .replace(/^\.+/, "");

  return normalized.length > 0 ? normalized : trimmed;
}

export function normalizePipeMappings(value: unknown): PipeMappingRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const candidate = entry as {
      columnId?: unknown;
      jsonPath?: unknown;
    };

    if (
      typeof candidate.columnId !== "string" ||
      typeof candidate.jsonPath !== "string"
    ) {
      return [];
    }

    return [
      {
        columnId: candidate.columnId,
        jsonPath: candidate.jsonPath,
      },
    ];
  });
}

export function buildPipeTitle({
  sourceLabel,
  tableLabel,
}: {
  sourceLabel: null | string | undefined;
  tableLabel: null | string | undefined;
}) {
  return `${normalizeDisplayLabel(sourceLabel, "Unknown source")} -> ${normalizeDisplayLabel(tableLabel, "Unknown table")}`;
}

export function buildPipeMappingDisplayRecords(
  value: unknown,
  columnLabelById: ReadonlyMap<string, string>,
) {
  const seenMappings = new Set<string>();

  return normalizePipeMappings(value).flatMap((mapping) => {
    const columnId = mapping.columnId.trim();
    const jsonPath = mapping.jsonPath.trim();

    if (columnId.length === 0 || jsonPath.length === 0) {
      return [];
    }

    const mappingKey = `${jsonPath}:${columnId}`;

    if (seenMappings.has(mappingKey)) {
      return [];
    }

    seenMappings.add(mappingKey);

    return [
      {
        ...mapping,
        columnLabel: normalizeDisplayLabel(
          columnLabelById.get(columnId),
          "Unknown field",
        ),
        jsonPathLabel: formatPipeJsonPathLabel(jsonPath),
      } satisfies PipeMappingDisplayRecord,
    ];
  });
}

export function buildPipeMappingSummary(
  value: unknown,
  columnLabelById: ReadonlyMap<string, string>,
  maxVisibleFields = 3,
) {
  const mappings = buildPipeMappingDisplayRecords(value, columnLabelById);
  const mappedFieldCount = mappings.length;

  if (mappedFieldCount === 0) {
    return "No mapped fields yet";
  }

  const fieldLabels = [
    ...new Set(
      mappings.flatMap(({ columnLabel }) => {
        return columnLabel
          ? [
              columnLabel,
            ]
          : [];
      }),
    ),
  ];
  const visibleLabels = fieldLabels.slice(
    0,
    Math.min(maxVisibleFields, mappedFieldCount),
  );
  const remainingFieldCount = mappedFieldCount - visibleLabels.length;
  const detailParts = [
    ...visibleLabels,
    ...(remainingFieldCount > 0
      ? [
          `+${remainingFieldCount}`,
        ]
      : []),
  ];

  return `${mappedFieldCount} mapped field${mappedFieldCount === 1 ? "" : "s"}${detailParts.length > 0 ? `: ${detailParts.join(", ")}` : ""}`;
}
