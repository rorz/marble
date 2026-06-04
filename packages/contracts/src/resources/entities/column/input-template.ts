import { stringifyJsonSafe } from "@marble/lib/json";
import { isPlainRecord } from "@marble/lib/object";

const COLUMN_ID_PATTERN =
  "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const COLUMN_PATH_SUFFIX_PATTERN = "((?:[.\\[].*?)?)";
const CANONICAL_COLUMN_PATH_PATTERN = new RegExp(
  `^\\$\\.columns\\.(${COLUMN_ID_PATTERN})\\.`,
  "i",
);
const CANONICAL_COLUMN_INTERPOLATION_PATTERN = new RegExp(
  `\\{\\{\\s*\\$\\.columns\\.(${COLUMN_ID_PATTERN})\\.[^}]+\\}\\}`,
  "gi",
);
const COLUMN_SHORTHAND_PATH_PATTERN = new RegExp(
  `^\\s*col\\.(${COLUMN_ID_PATTERN})${COLUMN_PATH_SUFFIX_PATTERN}\\s*$`,
  "i",
);
const COLUMN_SHORTHAND_INTERPOLATION_PATTERN = new RegExp(
  `\\{\\{\\s*col\\.(${COLUMN_ID_PATTERN})${COLUMN_PATH_SUFFIX_PATTERN}\\s*\\}\\}`,
  "gi",
);

type NormalizeResult = {
  changed: boolean;
  value: unknown;
};

const toColumnJsonPath = (columnId: string, restPath = "") =>
  `$.columns.${columnId}.value${restPath}`;

const resolveColumnReferencePath = (
  reference: string,
): {
  columnId: string;
  path: string;
} | null => {
  const trimmed = reference.trim();
  const canonicalMatch = trimmed.match(CANONICAL_COLUMN_PATH_PATTERN);
  if (canonicalMatch) {
    return {
      columnId: canonicalMatch[1],
      path: trimmed,
    };
  }

  const shorthandMatch = reference.match(COLUMN_SHORTHAND_PATH_PATTERN);
  if (!shorthandMatch) {
    return null;
  }

  return {
    columnId: shorthandMatch[1],
    path: toColumnJsonPath(shorthandMatch[1], shorthandMatch[2] ?? ""),
  };
};

const normalizeColumnTemplateText = (value: string): NormalizeResult => {
  let changed = false;
  const normalized = value.replace(
    COLUMN_SHORTHAND_INTERPOLATION_PATTERN,
    (_match, columnId: string, restPath: string | undefined) => {
      changed = true;
      return `{{${toColumnJsonPath(columnId, restPath ?? "")}}}`;
    },
  );

  return {
    changed,
    value: normalized,
  };
};

const normalizeColumnTemplateValue = (value: unknown): NormalizeResult => {
  if (typeof value === "string") {
    return normalizeColumnTemplateText(value);
  }

  if (Array.isArray(value)) {
    let changed = false;
    const normalized = value.map((entry) => {
      const result = normalizeColumnTemplateValue(entry);
      changed ||= result.changed;
      return result.value;
    });

    return {
      changed,
      value: normalized,
    };
  }

  if (!isPlainRecord(value)) {
    return {
      changed: false,
      value,
    };
  }

  let changed = false;
  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (key.endsWith(".$") && typeof entry === "string") {
        const reference = resolveColumnReferencePath(entry);
        if (reference && reference.path !== entry) {
          changed = true;
          return [
            key,
            reference.path,
          ];
        }
      }

      const result = normalizeColumnTemplateValue(entry);
      changed ||= result.changed;
      return [
        key,
        result.value,
      ];
    }),
  );

  return {
    changed,
    value: normalized,
  };
};

export const normalizeColumnInputTemplate = (inputTemplate: string): string => {
  let parsedTemplate: unknown;

  try {
    parsedTemplate = JSON.parse(inputTemplate) as unknown;
  } catch (error) {
    void error;
    const result = normalizeColumnTemplateText(inputTemplate);
    return result.changed ? String(result.value) : inputTemplate;
  }

  const result = normalizeColumnTemplateValue(parsedTemplate);
  return result.changed ? stringifyJsonSafe(result.value) : inputTemplate;
};

const addColumnReferenceIdFromPath = (
  reference: string,
  sourceColumnIds: Set<string>,
) => {
  const resolved = resolveColumnReferencePath(reference);
  if (resolved) {
    sourceColumnIds.add(resolved.columnId);
  }
};

const addColumnReferenceIdsFromText = (
  value: string,
  sourceColumnIds: Set<string>,
) => {
  for (const match of value.matchAll(CANONICAL_COLUMN_INTERPOLATION_PATTERN)) {
    sourceColumnIds.add(match[1]);
  }

  for (const match of value.matchAll(COLUMN_SHORTHAND_INTERPOLATION_PATTERN)) {
    sourceColumnIds.add(match[1]);
  }
};

const visitColumnInputTemplateDependencies = (
  value: unknown,
  sourceColumnIds: Set<string>,
) => {
  if (typeof value === "string") {
    addColumnReferenceIdsFromText(value, sourceColumnIds);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      visitColumnInputTemplateDependencies(entry, sourceColumnIds);
    }
    return;
  }

  if (!isPlainRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (
      key === "$marble_ref" &&
      Array.isArray(entry) &&
      entry[0] === "columns"
    ) {
      sourceColumnIds.add(String(entry[1]));
    } else if (key.endsWith(".$") && typeof entry === "string") {
      addColumnReferenceIdFromPath(entry, sourceColumnIds);
    }

    visitColumnInputTemplateDependencies(entry, sourceColumnIds);
  }
};

export const extractColumnInputTemplateDependencies = (
  inputTemplate: string,
): string[] => {
  const sourceColumnIds = new Set<string>();
  let parsedTemplate: unknown;

  try {
    parsedTemplate = JSON.parse(inputTemplate) as unknown;
  } catch (error) {
    void error;
    addColumnReferenceIdsFromText(inputTemplate, sourceColumnIds);
    return Array.from(sourceColumnIds);
  }

  visitColumnInputTemplateDependencies(parsedTemplate, sourceColumnIds);
  return Array.from(sourceColumnIds);
};
