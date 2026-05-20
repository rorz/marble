import { isPlainRecord } from "@marble/lib/object";
import { formatPipeCandidatePreview, formatPipeSchemaPreview } from "./mapping";
import type { PipePathCandidate } from "./types";

const jsonPathPropertySegment = (key: string) => {
  return /^[$A-Z_a-z][\w$]*$/u.test(key)
    ? `.${key}`
    : `[${JSON.stringify(key)}]`;
};

const dedupePipePathCandidates = (candidates: PipePathCandidate[]) => {
  const candidateByPath = new Map<string, PipePathCandidate>();

  for (const candidate of candidates) {
    if (candidateByPath.has(candidate.path)) {
      continue;
    }

    candidateByPath.set(candidate.path, candidate);
  }

  return Array.from(candidateByPath.values());
};

const parseGeneratedJsonPath = (path: string) => {
  if (path === "$") {
    return [];
  }

  if (!path.startsWith("$")) {
    return null;
  }

  const segments: string[] = [];
  let index = 1;

  while (index < path.length) {
    const currentChar = path[index];

    if (currentChar === ".") {
      let nextIndex = index + 1;

      while (
        nextIndex < path.length &&
        path[nextIndex] !== "." &&
        path[nextIndex] !== "["
      ) {
        nextIndex += 1;
      }

      const segment = path.slice(index + 1, nextIndex);

      if (segment.length === 0) {
        return null;
      }

      segments.push(segment);
      index = nextIndex;
      continue;
    }

    if (currentChar === "[") {
      const bracketMatch = /^\[(?:"(?:\\.|[^"\\])*")\]/u.exec(
        path.slice(index),
      );

      if (!bracketMatch) {
        return null;
      }

      const segment = JSON.parse(
        bracketMatch[0].slice(1, bracketMatch[0].length - 1),
      );

      if (typeof segment !== "string") {
        return null;
      }

      segments.push(segment);
      index += bracketMatch[0].length;
      continue;
    }

    return null;
  }

  return segments;
};

export const collectPipePathCandidates = (
  value: unknown,
  path = "$",
  key = "$",
): PipePathCandidate[] => {
  if (Array.isArray(value)) {
    return [
      {
        key,
        path,
        preview: formatPipeCandidatePreview(value),
      },
    ];
  }

  if (isPlainRecord(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return [
        {
          key,
          path,
          preview: "{}",
        },
      ];
    }

    return entries.flatMap(([entryKey, entryValue]) =>
      collectPipePathCandidates(
        entryValue,
        `${path}${jsonPathPropertySegment(entryKey)}`,
        entryKey,
      ),
    );
  }

  return [
    {
      key,
      path,
      preview: formatPipeCandidatePreview(value),
    },
  ];
};

export const collectPipePathCandidatesFromSchema = (
  schema: unknown,
  path = "$",
  key = "$",
): PipePathCandidate[] => {
  if (!isPlainRecord(schema)) {
    return [];
  }

  const nestedCandidates: PipePathCandidate[] = [];

  for (const branchKey of [
    "allOf",
    "anyOf",
    "oneOf",
  ] as const) {
    const branches = schema[branchKey];

    if (!Array.isArray(branches)) {
      continue;
    }

    for (const branch of branches) {
      nestedCandidates.push(
        ...collectPipePathCandidatesFromSchema(branch, path, key),
      );
    }
  }

  const properties = schema.properties;

  if (isPlainRecord(properties)) {
    for (const [entryKey, entrySchema] of Object.entries(properties)) {
      nestedCandidates.push(
        ...collectPipePathCandidatesFromSchema(
          entrySchema,
          `${path}${jsonPathPropertySegment(entryKey)}`,
          entryKey,
        ),
      );
    }
  }

  if (nestedCandidates.length > 0) {
    return dedupePipePathCandidates(nestedCandidates);
  }

  return [
    {
      key,
      path,
      preview: formatPipeSchemaPreview(schema),
    },
  ];
};

export const resolveGeneratedJsonPath = (value: unknown, path: string) => {
  const segments = parseGeneratedJsonPath(path);

  if (segments === null) {
    return undefined;
  }

  let currentValue = value;

  for (const segment of segments) {
    if (!isPlainRecord(currentValue) || !(segment in currentValue)) {
      return undefined;
    }

    currentValue = currentValue[segment];
  }

  return currentValue;
};
