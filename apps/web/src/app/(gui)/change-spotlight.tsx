"use client";

// harness-ignore: max-file-lines -- pending refactor, regrouping with user on conventions

import {
  MarbleReviewNavigator,
  type MarbleReviewNavigatorDetailItem,
} from "@marble/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CHANGE_SPOTLIGHT_ATTRIBUTE = "data-change-target";
const CHANGE_SPOTLIGHT_EVENT = "marble:change-spotlight";
const CHANGE_SPOTLIGHT_PREVIEW_CLEAR_EVENT =
  "marble:change-spotlight-preview-clear";
const CHANGE_SPOTLIGHT_PREVIEW_EVENT = "marble:change-spotlight-preview";
const CHANGE_SPOTLIGHT_SEARCH_TIMEOUT_MS = 2_500;
const CHANGE_SPOTLIGHT_STORAGE_KEY = "marble:change-spotlight:pending";
const CHANGE_SPOTLIGHT_VISIBLE_PREVIEW_LIMIT = 10;
const CHANGE_SPOTLIGHT_VISIBLE_MS = 4_500;
const CHANGE_SPOTLIGHT_VISIBLE_SECONDARY_LIMIT = 6;

type ChangeSpotlightQueueGroup = {
  description?: string;
  detailItems?: MarbleReviewNavigatorDetailItem[];
  href: string;
  id: string;
  label: string;
  targetKeys: string[];
};

type ChangeSpotlightGroup = {
  description: string;
  detailItems: MarbleReviewNavigatorDetailItem[];
  href: string;
  id: string;
  label: string;
  targetKeys: string[];
};

type PendingChangeSpotlight = {
  activeGroupId: string;
  createdAt: number;
  groups: ChangeSpotlightGroup[];
};

type PreviewChangeSpotlight = {
  targetKeys: string[];
};

type SpotlightRect = {
  height: number;
  left: number;
  radius: number;
  top: number;
  width: number;
};

type SpotlightVisibleTarget = {
  rect: SpotlightRect;
  targetKey: string;
};

type SpotlightSession = {
  activeGroupIndex: number;
  detail: string;
  detailItems: MarbleReviewNavigatorDetailItem[];
  groups: ChangeSpotlightGroup[];
  summary: string;
  targetKeys: string[];
  visibleTargets: SpotlightVisibleTarget[];
};

type SpotlightPreview = {
  visibleTargets: SpotlightVisibleTarget[];
};

export type ChangeTargetDescriptor =
  | {
      kind: "column";
      columnId: string;
    }
  | {
      pipeId: string;
      kind: "pipe";
    }
  | {
      kind: "cell";
      columnId: string;
      rowId: string;
    }
  | {
      kind: "profiles";
    }
  | {
      kind: "program";
      programId: string;
    }
  | {
      kind: "program-file";
      filename: string;
      programId: string;
    }
  | {
      kind: "program-version";
      versionId: string;
    }
  | {
      kind: "project";
      projectId: string;
    }
  | {
      kind: "row";
      rowId: string;
    }
  | {
      kind: "source";
      sourceId: string;
    }
  | {
      kind: "table";
      tableId: string;
    };

type ChangeSpotlightResolver = {
  findElement?: (descriptor: ChangeTargetDescriptor) => HTMLElement | null;
  match: (descriptor: ChangeTargetDescriptor) => boolean;
  reveal?: (
    descriptor: ChangeTargetDescriptor,
  ) => boolean | Promise<boolean | undefined> | undefined;
};

type ParsedTarget = {
  descriptor: ChangeTargetDescriptor;
  key: string;
};

const spotlightResolvers = new Set<ChangeSpotlightResolver>();

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

function dedupeTargetKeys(targetKeys: string[]) {
  return Array.from(
    new Set(
      targetKeys.map((key) => key.trim()).filter((key) => key.length > 0),
    ),
  );
}

function parseTargetKeys(targetKeys: string[]) {
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

function formatReviewSummary(targetKeys: string[]) {
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

function normalizeQueuedGroups(groups: ChangeSpotlightQueueGroup[]) {
  return groups
    .map((group) => {
      const reviewTargetKeys = buildReviewTargetKeys(group.targetKeys);

      if (reviewTargetKeys.length === 0) {
        return null;
      }

      return {
        description:
          group.description?.trim() || formatReviewSummary(reviewTargetKeys),
        detailItems: Array.isArray(group.detailItems) ? group.detailItems : [],
        href: group.href,
        id: group.id,
        label: group.label,
        targetKeys: reviewTargetKeys,
      } satisfies ChangeSpotlightGroup;
    })
    .filter((group): group is ChangeSpotlightGroup => group !== null);
}

function readPendingChangeSpotlight() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(CHANGE_SPOTLIGHT_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as
      | PendingChangeSpotlight
      | {
          createdAt: number;
          targetKeys: string[];
        };

    if (typeof parsed?.createdAt !== "number") {
      return null;
    }

    if ("groups" in parsed && Array.isArray(parsed.groups)) {
      const groups = normalizeQueuedGroups(parsed.groups);

      if (groups.length === 0) {
        return null;
      }

      return {
        activeGroupId:
          typeof parsed.activeGroupId === "string" &&
          groups.some((group) => group.id === parsed.activeGroupId)
            ? parsed.activeGroupId
            : groups[0].id,
        createdAt: parsed.createdAt,
        groups,
      } satisfies PendingChangeSpotlight;
    }

    const legacyTargetKeys =
      "targetKeys" in parsed && Array.isArray(parsed.targetKeys)
        ? parsed.targetKeys
        : null;

    if (!legacyTargetKeys) {
      return null;
    }

    const groups = normalizeQueuedGroups([
      {
        description: formatReviewSummary(legacyTargetKeys),
        href: "",
        id: "legacy",
        label: "Recent change",
        targetKeys: legacyTargetKeys,
      },
    ]);

    if (groups.length === 0) {
      return null;
    }

    return {
      activeGroupId: groups[0].id,
      createdAt: parsed.createdAt,
      groups,
    } satisfies PendingChangeSpotlight;
  } catch {
    return null;
  }
}

function persistPendingChangeSpotlight(
  spotlight: null | PendingChangeSpotlight,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!spotlight || spotlight.groups.length === 0) {
    window.sessionStorage.removeItem(CHANGE_SPOTLIGHT_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(
    CHANGE_SPOTLIGHT_STORAGE_KEY,
    JSON.stringify(spotlight),
  );
}

function escapeChangeTarget(value: string) {
  if (typeof window !== "undefined" && window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return value.replaceAll('"', '\\"');
}

function queryChangeTargetElement(targetKey: string) {
  if (typeof document === "undefined") {
    return null;
  }

  return document.querySelector<HTMLElement>(
    `[${CHANGE_SPOTLIGHT_ATTRIBUTE}="${escapeChangeTarget(targetKey)}"]`,
  );
}

function findChangeTargetElement(
  targetKey: string,
  descriptor: ChangeTargetDescriptor | null,
) {
  if (descriptor) {
    for (const resolver of spotlightResolvers) {
      if (!resolver.match(descriptor)) {
        continue;
      }

      const candidate = resolver.findElement?.(descriptor);

      if (candidate) {
        return candidate;
      }
    }
  }

  return queryChangeTargetElement(targetKey);
}

async function revealChangeTarget(descriptor: ChangeTargetDescriptor) {
  for (const resolver of spotlightResolvers) {
    if (!resolver.match(descriptor) || !resolver.reveal) {
      continue;
    }

    const result = await resolver.reveal(descriptor);

    if (result !== false) {
      return;
    }
  }
}

function parseBorderRadius(value: string) {
  const numericValue = Number.parseFloat(value);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function buildSpotlightRect(element: HTMLElement, margin = 0): SpotlightRect {
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);
  const maxHeight =
    typeof window === "undefined" ? rect.bottom : window.innerHeight;
  const maxWidth =
    typeof window === "undefined" ? rect.right : window.innerWidth;
  const top = Math.max(0, rect.top - margin);
  const left = Math.max(0, rect.left - margin);
  const bottom = Math.min(maxHeight, rect.bottom + margin);
  const right = Math.min(maxWidth, rect.right + margin);
  const radius =
    Math.max(
      parseBorderRadius(computedStyle.borderTopLeftRadius),
      parseBorderRadius(computedStyle.borderTopRightRadius),
      parseBorderRadius(computedStyle.borderBottomRightRadius),
      parseBorderRadius(computedStyle.borderBottomLeftRadius),
    ) + margin;

  return {
    height: Math.max(0, bottom - top),
    left,
    radius: Math.max(0, radius),
    top,
    width: Math.max(0, right - left),
  };
}

function shouldReduceMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function buildSearchOrder(startIndex: number, length: number) {
  return Array.from({
    length,
  }).map((_, offset) => (startIndex + offset) % length);
}

function collectTargetElements(targetKeys: string[]) {
  return targetKeys
    .map((targetKey) => {
      const descriptor = parseChangeTargetKey(targetKey);
      const element = findChangeTargetElement(targetKey, descriptor);

      if (!element) {
        return null;
      }

      const rect = buildSpotlightRect(element);

      if (rect.height <= 0 || rect.width <= 0) {
        return null;
      }

      return {
        rect,
        targetKey,
      } satisfies SpotlightVisibleTarget;
    })
    .filter((target): target is SpotlightVisibleTarget => target !== null);
}

function rectsTouchOrOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
  tolerance = 1,
) {
  return endA + tolerance >= startB && endB + tolerance >= startA;
}

function canMergeSpotlightTargets(
  left: SpotlightVisibleTarget,
  right: SpotlightVisibleTarget,
) {
  const horizontallyAligned =
    Math.abs(left.rect.top - right.rect.top) <= 1 &&
    Math.abs(left.rect.height - right.rect.height) <= 1 &&
    rectsTouchOrOverlap(
      left.rect.left,
      left.rect.left + left.rect.width,
      right.rect.left,
      right.rect.left + right.rect.width,
    );
  const verticallyAligned =
    Math.abs(left.rect.left - right.rect.left) <= 1 &&
    Math.abs(left.rect.width - right.rect.width) <= 1 &&
    rectsTouchOrOverlap(
      left.rect.top,
      left.rect.top + left.rect.height,
      right.rect.top,
      right.rect.top + right.rect.height,
    );
  const overlapping =
    rectsTouchOrOverlap(
      left.rect.left,
      left.rect.left + left.rect.width,
      right.rect.left,
      right.rect.left + right.rect.width,
    ) &&
    rectsTouchOrOverlap(
      left.rect.top,
      left.rect.top + left.rect.height,
      right.rect.top,
      right.rect.top + right.rect.height,
    );

  return horizontallyAligned || verticallyAligned || overlapping;
}

function mergeSpotlightTargets(targets: SpotlightVisibleTarget[]) {
  const pending = [
    ...targets,
  ].sort(
    (left, right) =>
      left.rect.top - right.rect.top || left.rect.left - right.rect.left,
  );
  const merged: SpotlightVisibleTarget[] = [];

  while (pending.length > 0) {
    const candidate = pending.shift();

    if (!candidate) {
      break;
    }

    let current = candidate;
    let mergedAgain = true;

    while (mergedAgain) {
      mergedAgain = false;

      for (let index = 0; index < pending.length; index += 1) {
        const next = pending[index];

        if (!next || !canMergeSpotlightTargets(current, next)) {
          continue;
        }

        pending.splice(index, 1);
        const top = Math.min(current.rect.top, next.rect.top);
        const left = Math.min(current.rect.left, next.rect.left);
        const bottom = Math.max(
          current.rect.top + current.rect.height,
          next.rect.top + next.rect.height,
        );
        const right = Math.max(
          current.rect.left + current.rect.width,
          next.rect.left + next.rect.width,
        );

        current = {
          rect: {
            height: bottom - top,
            left,
            radius: Math.max(current.rect.radius, next.rect.radius),
            top,
            width: right - left,
          },
          targetKey: `${current.targetKey}|${next.targetKey}`,
        };
        mergedAgain = true;
        break;
      }
    }

    merged.push(current);
  }

  return merged;
}

function collectMergedTargetElements(targetKeys: string[]) {
  return mergeSpotlightTargets(collectTargetElements(targetKeys));
}

function isBroadPreviewDescriptor(descriptor: ChangeTargetDescriptor | null) {
  return (
    descriptor?.kind === "profiles" ||
    descriptor?.kind === "program" ||
    descriptor?.kind === "project" ||
    descriptor?.kind === "table"
  );
}

function hasSpecificPreviewDescriptor(
  descriptor: ChangeTargetDescriptor | null,
) {
  return (
    descriptor?.kind === "cell" ||
    descriptor?.kind === "column" ||
    descriptor?.kind === "program-file" ||
    descriptor?.kind === "program-version" ||
    descriptor?.kind === "row"
  );
}

function compactTableReviewTargets(targets: ParsedTarget[]) {
  const cellTargets = targets.filter(
    (
      target,
    ): target is ParsedTarget & {
      descriptor: Extract<
        ChangeTargetDescriptor,
        {
          kind: "cell";
        }
      >;
    } => target.descriptor.kind === "cell",
  );
  const rowTargets = targets.filter(
    (
      target,
    ): target is ParsedTarget & {
      descriptor: Extract<
        ChangeTargetDescriptor,
        {
          kind: "row";
        }
      >;
    } => target.descriptor.kind === "row",
  );
  const columnTargets = targets.filter(
    (
      target,
    ): target is ParsedTarget & {
      descriptor: Extract<
        ChangeTargetDescriptor,
        {
          kind: "column";
        }
      >;
    } => target.descriptor.kind === "column",
  );
  const tableTargets = targets.filter(
    (
      target,
    ): target is ParsedTarget & {
      descriptor: Extract<
        ChangeTargetDescriptor,
        {
          kind: "table";
        }
      >;
    } => target.descriptor.kind === "table",
  );

  if (cellTargets.length > 0) {
    return dedupeTargetKeys(cellTargets.map((target) => target.key));
  }

  if (rowTargets.length > 0 || columnTargets.length > 0) {
    return dedupeTargetKeys([
      ...rowTargets.map((target) => target.key),
      ...columnTargets.map((target) => target.key),
    ]);
  }

  return tableTargets.length > 0
    ? [
        tableTargets[0].key,
      ]
    : [];
}

function buildReviewTargetKeys(targetKeys: string[]) {
  const parsedTargets = parseTargetKeys(targetKeys);
  const results: string[] = [];

  const tableTargets = parsedTargets.filter((target) =>
    [
      "cell",
      "column",
      "row",
      "table",
    ].includes(target.descriptor.kind),
  );
  const programFileTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "program-file",
  );
  const programVersionTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "program-version",
  );
  const programTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "program",
  );
  const projectTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "project",
  );
  const profileTargets = parsedTargets.filter(
    (target) => target.descriptor.kind === "profiles",
  );

  const compactedTableKeys = compactTableReviewTargets(tableTargets);

  if (compactedTableKeys.length > 0) {
    results.push(...compactedTableKeys);
  } else if (projectTargets.length > 0) {
    results.push(projectTargets[0].key);
  }

  if (programFileTargets.length > 0 || programVersionTargets.length > 0) {
    results.push(
      ...dedupeTargetKeys([
        ...programFileTargets.map((target) => target.key),
        ...programVersionTargets.map((target) => target.key),
      ]),
    );
  } else if (programTargets.length > 0) {
    results.push(programTargets[0].key);
  }

  if (
    results.length === 0 &&
    compactedTableKeys.length === 0 &&
    projectTargets.length > 0
  ) {
    results.push(projectTargets[0].key);
  }

  if (results.length === 0 && profileTargets.length > 0) {
    results.push(profileTargets[0].key);
  }

  if (results.length === 0) {
    results.push(...parsedTargets.map((target) => target.key));
  }

  return dedupeTargetKeys(results);
}

function buildPreviewTargetKeys(targetKeys: string[]) {
  const parsedTargets = parseTargetKeys(targetKeys);
  const anchorTargetKeys = [
    parsedTargets.find((target) => target.descriptor.kind === "table")?.key,
    parsedTargets.find((target) => target.descriptor.kind === "program")?.key,
    parsedTargets.find((target) => target.descriptor.kind === "project")?.key,
    parsedTargets.find((target) => target.descriptor.kind === "profiles")?.key,
  ].filter((targetKey): targetKey is string => Boolean(targetKey));

  return dedupeTargetKeys([
    ...buildReviewTargetKeys(targetKeys),
    ...anchorTargetKeys,
  ]);
}

export function queueChangeSpotlightDeck(
  groups: ChangeSpotlightQueueGroup[],
  activeGroupId = groups[0]?.id,
) {
  const normalizedGroups = normalizeQueuedGroups(groups);

  if (
    typeof window === "undefined" ||
    normalizedGroups.length === 0 ||
    typeof activeGroupId !== "string"
  ) {
    return;
  }

  const spotlight = {
    activeGroupId:
      normalizedGroups.find((group) => group.id === activeGroupId)?.id ??
      normalizedGroups[0].id,
    createdAt: Date.now(),
    groups: normalizedGroups,
  } satisfies PendingChangeSpotlight;

  persistPendingChangeSpotlight(spotlight);
  window.dispatchEvent(
    new CustomEvent<PendingChangeSpotlight>(CHANGE_SPOTLIGHT_EVENT, {
      detail: spotlight,
    }),
  );
}

export function previewChangeSpotlight(targetKeys: string[]) {
  const nextTargetKeys = dedupeTargetKeys(targetKeys);

  if (typeof window === "undefined" || nextTargetKeys.length === 0) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<PreviewChangeSpotlight>(CHANGE_SPOTLIGHT_PREVIEW_EVENT, {
      detail: {
        targetKeys: nextTargetKeys,
      },
    }),
  );
}

export function clearPreviewChangeSpotlight() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CHANGE_SPOTLIGHT_PREVIEW_CLEAR_EVENT));
}

export function useChangeSpotlightPreviewTargetKeys() {
  const [previewTargetKeys, setPreviewTargetKeys] = useState<string[]>([]);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      const detail = (event as CustomEvent<PreviewChangeSpotlight>).detail;

      setPreviewTargetKeys(buildPreviewTargetKeys(detail?.targetKeys ?? []));
    };
    const handlePreviewClear = () => {
      setPreviewTargetKeys([]);
    };

    window.addEventListener(CHANGE_SPOTLIGHT_PREVIEW_EVENT, handlePreview);
    window.addEventListener(
      CHANGE_SPOTLIGHT_PREVIEW_CLEAR_EVENT,
      handlePreviewClear,
    );

    return () => {
      window.removeEventListener(CHANGE_SPOTLIGHT_PREVIEW_EVENT, handlePreview);
      window.removeEventListener(
        CHANGE_SPOTLIGHT_PREVIEW_CLEAR_EVENT,
        handlePreviewClear,
      );
    };
  }, []);

  return previewTargetKeys;
}

export function ChangeSpotlight() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inspectedTargetKeys, setInspectedTargetKeys] = useState<
    null | string[]
  >(null);
  const [preview, setPreview] = useState<SpotlightPreview | null>(null);
  const [session, setSession] = useState<SpotlightSession | null>(null);
  const activationTokenRef = useRef(0);
  const dismissTimeoutRef = useRef<number | null>(null);
  const searchFrameRef = useRef<number | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const activeTargetKeyRef = useRef<string | null>(null);
  const inspectedTargetKeysRef = useRef<null | string[]>(null);
  const previewTargetKeysRef = useRef<string[]>([]);
  const targetKeysRef = useRef<string[]>([]);
  const routeKey = useMemo(
    () => `${pathname}?${searchParams.toString()}`,
    [
      pathname,
      searchParams,
    ],
  );

  const clearDismissTimeout = useCallback(() => {
    if (dismissTimeoutRef.current !== null) {
      window.clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
  }, []);

  const clearSearchFrame = useCallback(() => {
    if (searchFrameRef.current !== null) {
      window.cancelAnimationFrame(searchFrameRef.current);
      searchFrameRef.current = null;
    }
  }, []);

  const resetActiveSpotlight = useCallback(() => {
    activationTokenRef.current += 1;
    clearDismissTimeout();
    clearSearchFrame();
    activeElementRef.current = null;
    activeTargetKeyRef.current = null;
    inspectedTargetKeysRef.current = null;
    targetKeysRef.current = [];
    setInspectedTargetKeys(null);
    setSession(null);
  }, [
    clearDismissTimeout,
    clearSearchFrame,
  ]);

  const clearSpotlight = useCallback(() => {
    persistPendingChangeSpotlight(null);
    resetActiveSpotlight();
  }, [
    resetActiveSpotlight,
  ]);

  const clearPreview = useCallback(() => {
    previewTargetKeysRef.current = [];
    setPreview(null);
  }, []);

  const dismissSpotlightFromBackdrop = useCallback(() => {
    clearSpotlight();
  }, [
    clearSpotlight,
  ]);

  const measureSessionTargets = useCallback(() => {
    const inspectedTargetKeys = inspectedTargetKeysRef.current;
    const targetKeys =
      inspectedTargetKeys && inspectedTargetKeys.length > 0
        ? inspectedTargetKeys
        : targetKeysRef.current;
    const activeElement = activeElementRef.current;

    if (!activeElement || targetKeys.length === 0) {
      return;
    }
    const visibleTargets = collectMergedTargetElements(targetKeys).slice(
      0,
      CHANGE_SPOTLIGHT_VISIBLE_SECONDARY_LIMIT + 1,
    );
    const resolvedVisibleTargets =
      visibleTargets.length === 0 && inspectedTargetKeys
        ? collectMergedTargetElements(targetKeysRef.current).slice(
            0,
            CHANGE_SPOTLIGHT_VISIBLE_SECONDARY_LIMIT + 1,
          )
        : visibleTargets;

    setSession((current) => {
      if (!current) {
        return null;
      }

      return {
        ...current,
        visibleTargets: resolvedVisibleTargets,
      };
    });
  }, []);

  const setSessionInspectionTargetKeys = useCallback(
    (targetKeys: null | string[]) => {
      const nextTargetKeys =
        targetKeys && targetKeys.length > 0
          ? dedupeTargetKeys(targetKeys)
          : null;

      inspectedTargetKeysRef.current = nextTargetKeys;
      setInspectedTargetKeys(nextTargetKeys);

      if (activeElementRef.current) {
        measureSessionTargets();
      }
    },
    [
      measureSessionTargets,
    ],
  );

  const measurePreviewTargets = useCallback(() => {
    if (session) {
      return;
    }

    const targetKeys = previewTargetKeysRef.current;

    if (targetKeys.length === 0) {
      clearPreview();
      return;
    }

    const rawTargets = collectTargetElements(targetKeys);
    const hasSpecificVisibleTarget = rawTargets.some((target) =>
      hasSpecificPreviewDescriptor(parseChangeTargetKey(target.targetKey)),
    );
    const visibleTargets = mergeSpotlightTargets(
      rawTargets.filter((target) => {
        if (!hasSpecificVisibleTarget) {
          return true;
        }

        return !isBroadPreviewDescriptor(
          parseChangeTargetKey(target.targetKey),
        );
      }),
    ).slice(0, CHANGE_SPOTLIGHT_VISIBLE_PREVIEW_LIMIT);

    if (visibleTargets.length === 0) {
      clearPreview();
      return;
    }

    setPreview({
      visibleTargets,
    });
  }, [
    clearPreview,
    session,
  ]);

  const applyFocusedTarget = useCallback(
    (
      groups: ChangeSpotlightGroup[],
      activeGroupIndex: number,
      foundTarget: HTMLElement,
      targetKey: string,
    ) => {
      const activeGroup = groups[activeGroupIndex];
      const targetKeys = activeGroup?.targetKeys ?? [];
      const initialRect = buildSpotlightRect(foundTarget);

      activeElementRef.current = foundTarget;
      activeTargetKeyRef.current = targetKey;
      targetKeysRef.current = targetKeys;
      setSessionInspectionTargetKeys(null);
      clearPreview();

      setSession({
        activeGroupIndex,
        detail: activeGroup?.description ?? formatReviewSummary(targetKeys),
        detailItems: activeGroup?.detailItems ?? [],
        groups,
        summary: activeGroup?.label ?? "Recent change",
        targetKeys,
        visibleTargets: mergeSpotlightTargets([
          {
            rect: initialRect,
            targetKey,
          },
        ]),
      });

      foundTarget.scrollIntoView({
        behavior: shouldReduceMotion() ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          measureSessionTargets();
          clearDismissTimeout();

          if (groups.length === 1 && targetKeys.length === 1) {
            dismissTimeoutRef.current = window.setTimeout(() => {
              clearSpotlight();
            }, CHANGE_SPOTLIGHT_VISIBLE_MS);
          }
        });
      });
    },
    [
      clearPreview,
      clearDismissTimeout,
      clearSpotlight,
      measureSessionTargets,
      setSessionInspectionTargetKeys,
    ],
  );

  const focusTargetIndex = useCallback(
    async (
      groups: ChangeSpotlightGroup[],
      requestedGroupIndex: number,
      activationToken: number,
    ) => {
      const activeGroup = groups[requestedGroupIndex];
      const targetKeys = activeGroup?.targetKeys ?? [];

      if (!activeGroup || targetKeys.length === 0) {
        return;
      }

      const searchOrder = buildSearchOrder(0, targetKeys.length);
      const revealedKeys = new Set<string>();
      const startedAt = performance.now();

      clearSearchFrame();

      const attemptFocus = () => {
        void (async () => {
          for (const targetIndex of searchOrder) {
            if (activationTokenRef.current !== activationToken) {
              return;
            }

            const targetKey = targetKeys[targetIndex];
            const descriptor = parseChangeTargetKey(targetKey);
            let foundTarget = findChangeTargetElement(targetKey, descriptor);

            if (!foundTarget && descriptor && !revealedKeys.has(targetKey)) {
              revealedKeys.add(targetKey);
              await revealChangeTarget(descriptor);

              if (activationTokenRef.current !== activationToken) {
                return;
              }

              await waitForAnimationFrame();
              foundTarget = findChangeTargetElement(targetKey, descriptor);
            }

            if (!foundTarget) {
              continue;
            }

            persistPendingChangeSpotlight({
              activeGroupId: activeGroup.id,
              createdAt: Date.now(),
              groups,
            });
            applyFocusedTarget(
              groups,
              requestedGroupIndex,
              foundTarget,
              targetKey,
            );
            return;
          }

          if (activationTokenRef.current !== activationToken) {
            return;
          }

          if (
            performance.now() - startedAt <
            CHANGE_SPOTLIGHT_SEARCH_TIMEOUT_MS
          ) {
            searchFrameRef.current = window.requestAnimationFrame(attemptFocus);
            return;
          }

          clearSpotlight();
        })();
      };

      attemptFocus();
    },
    [
      applyFocusedTarget,
      clearSearchFrame,
      clearSpotlight,
    ],
  );

  const goToReviewGroup = useCallback(
    async (groups: ChangeSpotlightGroup[], nextIndex: number) => {
      const nextGroup = groups[nextIndex];

      if (!nextGroup) {
        return;
      }

      const pendingSpotlight = {
        activeGroupId: nextGroup.id,
        createdAt: Date.now(),
        groups,
      } satisfies PendingChangeSpotlight;

      persistPendingChangeSpotlight(pendingSpotlight);
      clearPreview();

      if (nextGroup.href && nextGroup.href !== pathname) {
        resetActiveSpotlight();
        router.push(nextGroup.href);
        return;
      }

      activationTokenRef.current += 1;
      void focusTargetIndex(groups, nextIndex, activationTokenRef.current);
    },
    [
      clearPreview,
      focusTargetIndex,
      pathname,
      resetActiveSpotlight,
      router,
    ],
  );

  const activateSpotlight = useCallback(
    (pendingSpotlight: PendingChangeSpotlight | null) => {
      const groups = normalizeQueuedGroups(pendingSpotlight?.groups ?? []);

      if (groups.length === 0) {
        clearSpotlight();
        return;
      }

      const activeGroupIndex = Math.max(
        0,
        groups.findIndex(
          (group) => group.id === pendingSpotlight?.activeGroupId,
        ),
      );
      const activeGroup = groups[activeGroupIndex] ?? groups[0];

      persistPendingChangeSpotlight({
        activeGroupId: activeGroup.id,
        createdAt: pendingSpotlight?.createdAt ?? Date.now(),
        groups,
      });
      clearPreview();
      if (activeGroup.href && activeGroup.href !== pathname) {
        resetActiveSpotlight();
        return;
      }

      activationTokenRef.current += 1;
      void focusTargetIndex(
        groups,
        activeGroupIndex,
        activationTokenRef.current,
      );
    },
    [
      clearPreview,
      clearSpotlight,
      focusTargetIndex,
      pathname,
      resetActiveSpotlight,
    ],
  );

  const stepReview = useCallback(
    (direction: -1 | 1) => {
      if (!session || session.groups.length <= 1) {
        return;
      }

      const nextIndex =
        (session.activeGroupIndex + direction + session.groups.length) %
        session.groups.length;

      void goToReviewGroup(session.groups, nextIndex);
    },
    [
      goToReviewGroup,
      session,
    ],
  );

  const jumpToReviewIndex = useCallback(
    (index: number) => {
      if (
        !session ||
        index < 0 ||
        index >= session.groups.length ||
        index === session.activeGroupIndex
      ) {
        return;
      }

      void goToReviewGroup(session.groups, index);
    },
    [
      goToReviewGroup,
      session,
    ],
  );

  useEffect(() => {
    if (routeKey.length === 0) {
      return;
    }

    clearPreview();
    activateSpotlight(readPendingChangeSpotlight());
  }, [
    activateSpotlight,
    clearPreview,
    routeKey,
  ]);

  useEffect(() => {
    const handleSpotlight = (event: Event) => {
      const detail = (event as CustomEvent<PendingChangeSpotlight>).detail;
      activateSpotlight(detail);
    };

    window.addEventListener(CHANGE_SPOTLIGHT_EVENT, handleSpotlight);

    return () => {
      window.removeEventListener(CHANGE_SPOTLIGHT_EVENT, handleSpotlight);
    };
  }, [
    activateSpotlight,
  ]);

  useEffect(() => {
    const handlePreview = (event: Event) => {
      if (session) {
        return;
      }

      const detail = (event as CustomEvent<PreviewChangeSpotlight>).detail;
      const targetKeys = buildPreviewTargetKeys(detail?.targetKeys ?? []);

      if (targetKeys.length === 0) {
        clearPreview();
        return;
      }

      previewTargetKeysRef.current = targetKeys;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          measurePreviewTargets();
        });
      });
    };
    const handlePreviewClear = () => {
      clearPreview();
    };

    window.addEventListener(CHANGE_SPOTLIGHT_PREVIEW_EVENT, handlePreview);
    window.addEventListener(
      CHANGE_SPOTLIGHT_PREVIEW_CLEAR_EVENT,
      handlePreviewClear,
    );

    return () => {
      window.removeEventListener(CHANGE_SPOTLIGHT_PREVIEW_EVENT, handlePreview);
      window.removeEventListener(
        CHANGE_SPOTLIGHT_PREVIEW_CLEAR_EVENT,
        handlePreviewClear,
      );
    };
  }, [
    clearPreview,
    measurePreviewTargets,
    session,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const handleReflow = () => {
      measureSessionTargets();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSpotlight();
        return;
      }

      if (
        session.groups.length > 1 &&
        (event.key === "ArrowRight" ||
          event.key === "ArrowDown" ||
          event.key === "]")
      ) {
        event.preventDefault();
        stepReview(1);
        return;
      }

      if (
        session.groups.length > 1 &&
        (event.key === "ArrowLeft" ||
          event.key === "ArrowUp" ||
          event.key === "[")
      ) {
        event.preventDefault();
        stepReview(-1);
      }
    };
    const activeElement = activeElementRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && activeElement
        ? new ResizeObserver(handleReflow)
        : null;

    window.addEventListener("resize", handleReflow);
    window.addEventListener("scroll", handleReflow, true);
    window.addEventListener("keydown", handleKeyDown);

    if (resizeObserver && activeElement) {
      resizeObserver.observe(activeElement);
    }

    return () => {
      window.removeEventListener("resize", handleReflow);
      window.removeEventListener("scroll", handleReflow, true);
      window.removeEventListener("keydown", handleKeyDown);
      resizeObserver?.disconnect();
    };
  }, [
    clearSpotlight,
    measureSessionTargets,
    session,
    stepReview,
  ]);

  useEffect(() => {
    if (session || !preview) {
      return;
    }

    const handleReflow = () => {
      measurePreviewTargets();
    };

    window.addEventListener("resize", handleReflow);
    window.addEventListener("scroll", handleReflow, true);

    return () => {
      window.removeEventListener("resize", handleReflow);
      window.removeEventListener("scroll", handleReflow, true);
    };
  }, [
    measurePreviewTargets,
    preview,
    session,
  ]);

  useEffect(
    () => () => {
      clearPreview();
      clearSpotlight();
    },
    [
      clearPreview,
      clearSpotlight,
    ],
  );

  if (!session && !preview) {
    return null;
  }

  const hasMultipleGroups = Boolean(session && session.groups.length > 1);
  const isInspectingSubset = Boolean(
    session && inspectedTargetKeys && inspectedTargetKeys.length > 0,
  );
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const sessionBounds = session?.visibleTargets.reduce<null | SpotlightRect>(
    (current, target) => {
      if (!current) {
        return target.rect;
      }

      const top = Math.min(current.top, target.rect.top);
      const left = Math.min(current.left, target.rect.left);
      const bottom = Math.max(
        current.top + current.height,
        target.rect.top + target.rect.height,
      );
      const right = Math.max(
        current.left + current.width,
        target.rect.left + target.rect.width,
      );

      return {
        height: bottom - top,
        left,
        radius: Math.max(current.radius, target.rect.radius),
        top,
        width: right - left,
      };
    },
    null,
  );
  const top = sessionBounds?.top ?? 0;
  const left = sessionBounds?.left ?? 0;
  const height = sessionBounds?.height ?? 0;
  const width = sessionBounds?.width ?? 0;
  const bottom = top + height;
  const right = left + width;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[140]"
    >
      {session ? (
        <>
          <div
            className="pointer-events-auto absolute inset-x-0 top-0 bg-taupe-950/10 backdrop-blur-[1px]"
            onPointerDown={dismissSpotlightFromBackdrop}
            style={{
              height: top,
            }}
          />
          <div
            className="pointer-events-auto absolute left-0 bg-taupe-950/10 backdrop-blur-[1px]"
            onPointerDown={dismissSpotlightFromBackdrop}
            style={{
              height,
              top,
              width: left,
            }}
          />
          <div
            className="pointer-events-auto absolute bg-taupe-950/10 backdrop-blur-[1px]"
            onPointerDown={dismissSpotlightFromBackdrop}
            style={{
              height,
              left: right,
              top,
              width: Math.max(0, viewportWidth - right),
            }}
          />
          <div
            className="pointer-events-auto absolute inset-x-0 bg-taupe-950/10 backdrop-blur-[1px]"
            onPointerDown={dismissSpotlightFromBackdrop}
            style={{
              height: Math.max(0, viewportHeight - bottom),
              top: bottom,
            }}
          />

          {session.visibleTargets.map((target) => (
            <div
              className={
                isInspectingSubset
                  ? "absolute border border-orange-400/95 bg-white/34 shadow-[0_0_0_1px_rgba(255,255,255,0.92),0_18px_36px_rgba(249,115,22,0.14)] transition-[top,left,width,height,border-radius] duration-150 ease-out"
                  : "absolute border border-orange-200/95 bg-orange-50/18 shadow-[0_0_0_1px_rgba(255,255,255,0.78)] transition-[top,left,width,height,border-radius] duration-200 ease-out"
              }
              key={target.targetKey}
              style={{
                borderRadius: target.rect.radius,
                height: target.rect.height,
                left: target.rect.left,
                top: target.rect.top,
                width: target.rect.width,
              }}
            />
          ))}
        </>
      ) : null}

      {!session && preview ? (
        <>
          <div className="absolute inset-0 bg-taupe-950/8 backdrop-blur-[1px]" />
          {preview.visibleTargets.map((target) => (
            <div
              className="absolute border border-orange-400/95 bg-white/38 shadow-[0_0_0_1px_rgba(255,255,255,0.96),0_18px_36px_rgba(249,115,22,0.16)] transition-[top,left,width,height,border-radius,opacity] duration-150 ease-out"
              key={target.targetKey}
              style={{
                borderRadius: target.rect.radius,
                height: target.rect.height,
                left: target.rect.left,
                top: target.rect.top,
                width: target.rect.width,
              }}
            />
          ))}
        </>
      ) : null}

      {session && hasMultipleGroups ? (
        <div className="pointer-events-auto fixed inset-x-0 bottom-5 flex justify-center px-4">
          <MarbleReviewNavigator
            currentIndex={session.activeGroupIndex}
            detail={session.detail}
            detailItems={session.detailItems}
            onClose={clearSpotlight}
            onNext={() => stepReview(1)}
            onPreviewTargetsEnd={() => setSessionInspectionTargetKeys(null)}
            onPreviewTargetsStart={setSessionInspectionTargetKeys}
            onPrevious={() => stepReview(-1)}
            onSelectIndex={jumpToReviewIndex}
            summary={session.summary}
            totalCount={session.groups.length}
          />
        </div>
      ) : null}
    </div>
  );
}
