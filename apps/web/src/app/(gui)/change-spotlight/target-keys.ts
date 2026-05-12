import { useEffect } from "react";
import { CHANGE_SPOTLIGHT_ATTRIBUTE } from "./constants";
import type {
  ChangeSpotlightResolver,
  ChangeTargetDescriptor,
  ParsedTarget,
} from "./types";

export const spotlightResolvers = new Set<ChangeSpotlightResolver>();

function encodeChangeTargetSegment(value: string) {
  return encodeURIComponent(value);
}

function decodeChangeTargetSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export const changeTargetKey = {
  cell: (rowId: string, columnId: string) =>
    `cell:${encodeChangeTargetSegment(rowId)}:${encodeChangeTargetSegment(columnId)}`,
  column: (columnId: string) => `column:${encodeChangeTargetSegment(columnId)}`,
  pipe: (pipeId: string) => `pipe:${encodeChangeTargetSegment(pipeId)}`,
  profiles: () => "profiles",
  program: (programId: string) =>
    `program:${encodeChangeTargetSegment(programId)}`,
  programFile: (programId: string, filename: string) =>
    `program-file:${encodeChangeTargetSegment(programId)}:${encodeChangeTargetSegment(filename)}`,
  programVersion: (versionId: string) =>
    `program-version:${encodeChangeTargetSegment(versionId)}`,
  project: (projectId: string) =>
    `project:${encodeChangeTargetSegment(projectId)}`,
  row: (rowId: string) => `row:${encodeChangeTargetSegment(rowId)}`,
  source: (sourceId: string) => `source:${encodeChangeTargetSegment(sourceId)}`,
  table: (tableId: string) => `table:${encodeChangeTargetSegment(tableId)}`,
} as const;

export function parseChangeTargetKey(
  targetKey: string,
): ChangeTargetDescriptor | null {
  if (targetKey === changeTargetKey.profiles()) {
    return {
      kind: "profiles",
    };
  }

  const parts = targetKey.split(":");
  const kind = parts[0];

  if (kind === "project" && parts.length === 2) {
    return {
      kind,
      projectId: decodeChangeTargetSegment(parts[1]),
    };
  }

  if (kind === "table" && parts.length === 2) {
    return {
      kind,
      tableId: decodeChangeTargetSegment(parts[1]),
    };
  }

  if (kind === "row" && parts.length === 2) {
    return {
      kind,
      rowId: decodeChangeTargetSegment(parts[1]),
    };
  }

  if (kind === "source" && parts.length === 2) {
    return {
      kind,
      sourceId: decodeChangeTargetSegment(parts[1]),
    };
  }

  if (kind === "pipe" && parts.length === 2) {
    return {
      kind,
      pipeId: decodeChangeTargetSegment(parts[1]),
    };
  }

  if (kind === "column" && parts.length === 2) {
    return {
      columnId: decodeChangeTargetSegment(parts[1]),
      kind,
    };
  }

  if (kind === "cell" && parts.length === 3) {
    return {
      columnId: decodeChangeTargetSegment(parts[2]),
      kind,
      rowId: decodeChangeTargetSegment(parts[1]),
    };
  }

  if (kind === "program" && parts.length === 2) {
    return {
      kind,
      programId: decodeChangeTargetSegment(parts[1]),
    };
  }

  if (kind === "program-version" && parts.length === 2) {
    return {
      kind,
      versionId: decodeChangeTargetSegment(parts[1]),
    };
  }

  if (kind === "program-file" && parts.length === 3) {
    return {
      filename: decodeChangeTargetSegment(parts[2]),
      kind,
      programId: decodeChangeTargetSegment(parts[1]),
    };
  }

  return null;
}

export function getChangeTargetProps(targetKey: string) {
  return {
    [CHANGE_SPOTLIGHT_ATTRIBUTE]: targetKey,
  } as const;
}

export function useChangeSpotlightResolver(resolver: ChangeSpotlightResolver) {
  useEffect(() => {
    spotlightResolvers.add(resolver);

    return () => {
      spotlightResolvers.delete(resolver);
    };
  }, [
    resolver,
  ]);
}

export function dedupeTargetKeys(targetKeys: string[]) {
  return Array.from(
    new Set(
      targetKeys.map((key) => key.trim()).filter((key) => key.length > 0),
    ),
  );
}

export function parseTargetKeys(targetKeys: string[]) {
  return dedupeTargetKeys(targetKeys)
    .map((key) => {
      const descriptor = parseChangeTargetKey(key);

      if (!descriptor) {
        return null;
      }

      return {
        descriptor,
        key,
      } satisfies ParsedTarget;
    })
    .filter((target): target is ParsedTarget => target !== null);
}

function pluralize(label: string, count: number) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export function formatReviewSummary(targetKeys: string[]) {
  const kindCounts = new Map<ChangeTargetDescriptor["kind"], number>();

  for (const target of parseTargetKeys(targetKeys)) {
    kindCounts.set(
      target.descriptor.kind,
      (kindCounts.get(target.descriptor.kind) ?? 0) + 1,
    );
  }

  const labels: Record<ChangeTargetDescriptor["kind"], string> = {
    cell: "cell",
    column: "column",
    pipe: "pipe",
    profiles: "profile area",
    program: "program area",
    "program-file": "file",
    "program-version": "version",
    project: "project area",
    row: "row",
    source: "source",
    table: "table area",
  };

  const parts = Array.from(kindCounts.entries())
    .sort(([leftKind, leftCount], [rightKind, rightCount]) => {
      return rightCount - leftCount || leftKind.localeCompare(rightKind);
    })
    .map(([kind, count]) => pluralize(labels[kind], count));

  if (parts.length === 0) {
    return "Review changes";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    return `${parts[0]} + ${parts[1]}`;
  }

  return `${parts[0]} + ${parts.length - 1} more`;
}
