"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CHANGE_SPOTLIGHT_ATTRIBUTE = "data-change-target";
const CHANGE_SPOTLIGHT_EVENT = "marble:change-spotlight";
const CHANGE_SPOTLIGHT_GROUP_THRESHOLD = 4;
const CHANGE_SPOTLIGHT_MARGIN_PX = 10;
const CHANGE_SPOTLIGHT_SEARCH_TIMEOUT_MS = 2_500;
const CHANGE_SPOTLIGHT_STORAGE_KEY = "marble:change-spotlight:pending";
const CHANGE_SPOTLIGHT_VISIBLE_MS = 4_500;
const CHANGE_SPOTLIGHT_VISIBLE_SECONDARY_LIMIT = 6;

type PendingChangeSpotlight = {
  createdAt: number;
  targetKeys: string[];
};

type SpotlightRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type SpotlightVisibleTarget = {
  rect: SpotlightRect;
  targetKey: string;
};

type SpotlightSession = {
  activeIndex: number;
  activeRect: SpotlightRect;
  summary: string;
  targetKeys: string[];
  visibleTargets: SpotlightVisibleTarget[];
};

export type ChangeTargetDescriptor =
  | {
      kind: "column";
      columnId: string;
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
      kind: "table";
      tableId: string;
    };

export type ChangeSpotlightResolver = {
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
    profiles: "profile area",
    program: "program area",
    "program-file": "file",
    "program-version": "version",
    project: "project area",
    row: "row",
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

function readPendingChangeSpotlight() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(CHANGE_SPOTLIGHT_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PendingChangeSpotlight;

    if (
      typeof parsed?.createdAt !== "number" ||
      !Array.isArray(parsed?.targetKeys)
    ) {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      targetKeys: dedupeTargetKeys(parsed.targetKeys),
    };
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

  if (!spotlight || spotlight.targetKeys.length === 0) {
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
  const directMatch = queryChangeTargetElement(targetKey);

  if (directMatch) {
    return directMatch;
  }

  if (!descriptor) {
    return null;
  }

  for (const resolver of spotlightResolvers) {
    if (!resolver.match(descriptor)) {
      continue;
    }

    const candidate = resolver.findElement?.(descriptor);

    if (candidate) {
      return candidate;
    }
  }

  return null;
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

function buildSpotlightRect(rect: DOMRect): SpotlightRect {
  const margin = CHANGE_SPOTLIGHT_MARGIN_PX;
  const maxHeight =
    typeof window === "undefined" ? rect.height : window.innerHeight;
  const maxWidth =
    typeof window === "undefined" ? rect.width : window.innerWidth;
  const top = Math.max(8, rect.top - margin);
  const left = Math.max(8, rect.left - margin);
  const bottom = Math.min(maxHeight - 8, rect.bottom + margin);
  const right = Math.min(maxWidth - 8, rect.right + margin);

  return {
    height: Math.max(0, bottom - top),
    left,
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

      const rect = buildSpotlightRect(element.getBoundingClientRect());

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

  const orderByKey = new Map(
    targets.map((target, index) => [
      target.key,
      index,
    ]),
  );

  const buildGroupedCells = (axis: "column" | "row") => {
    const grouped = new Map<
      string,
      Array<
        ParsedTarget & {
          descriptor: Extract<
            ChangeTargetDescriptor,
            {
              kind: "cell";
            }
          >;
        }
      >
    >();

    for (const target of cellTargets) {
      const groupId =
        axis === "column"
          ? target.descriptor.columnId
          : target.descriptor.rowId;

      if (!grouped.has(groupId)) {
        grouped.set(groupId, []);
      }

      grouped.get(groupId)?.push(target);
    }

    const items: Array<{
      key: string;
      order: number;
    }> = [];
    const coveredCellKeys = new Set<string>();

    for (const [groupId, groupedTargets] of grouped.entries()) {
      if (groupedTargets.length < CHANGE_SPOTLIGHT_GROUP_THRESHOLD) {
        continue;
      }

      const groupKey =
        axis === "column"
          ? changeTargetKey.column(groupId)
          : changeTargetKey.row(groupId);
      const explicitGroupTarget = targets.find(
        (target) => target.key === groupKey,
      );

      items.push({
        key: groupKey,
        order: Math.min(
          explicitGroupTarget
            ? (orderByKey.get(explicitGroupTarget.key) ??
                Number.MAX_SAFE_INTEGER)
            : Number.MAX_SAFE_INTEGER,
          ...groupedTargets.map(
            (target) => orderByKey.get(target.key) ?? Number.MAX_SAFE_INTEGER,
          ),
        ),
      });

      for (const groupedTarget of groupedTargets) {
        coveredCellKeys.add(groupedTarget.key);
      }
    }

    for (const cellTarget of cellTargets) {
      if (coveredCellKeys.has(cellTarget.key)) {
        continue;
      }

      items.push({
        key: cellTarget.key,
        order: orderByKey.get(cellTarget.key) ?? Number.MAX_SAFE_INTEGER,
      });
    }

    return items.sort((left, right) => left.order - right.order);
  };

  const groupedByColumn = buildGroupedCells("column");
  const groupedByRow = buildGroupedCells("row");
  const cellRowIds = new Set(
    cellTargets.map((target) => target.descriptor.rowId),
  );
  const cellColumnIds = new Set(
    cellTargets.map((target) => target.descriptor.columnId),
  );

  const baseItems =
    groupedByColumn.length > 0 || groupedByRow.length > 0
      ? groupedByColumn.length < groupedByRow.length
        ? groupedByColumn
        : groupedByRow.length < groupedByColumn.length
          ? groupedByRow
          : groupedByColumn.length <= cellTargets.length
            ? groupedByColumn
            : groupedByRow
      : cellTargets.map((target) => ({
          key: target.key,
          order: orderByKey.get(target.key) ?? Number.MAX_SAFE_INTEGER,
        }));

  const additionalItems = [
    ...rowTargets
      .filter((target) => !cellRowIds.has(target.descriptor.rowId))
      .map((target) => ({
        key: target.key,
        order: orderByKey.get(target.key) ?? Number.MAX_SAFE_INTEGER,
      })),
    ...columnTargets
      .filter((target) => !cellColumnIds.has(target.descriptor.columnId))
      .map((target) => ({
        key: target.key,
        order: orderByKey.get(target.key) ?? Number.MAX_SAFE_INTEGER,
      })),
  ];

  const compactedKeys = dedupeTargetKeys(
    [
      ...baseItems,
      ...additionalItems,
    ]
      .sort((left, right) => left.order - right.order)
      .map((item) => item.key),
  );

  if (compactedKeys.length > 0) {
    return compactedKeys;
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

export function queueChangeSpotlight(targetKeys: string[]) {
  const nextTargetKeys = dedupeTargetKeys(targetKeys);

  if (typeof window === "undefined" || nextTargetKeys.length === 0) {
    return;
  }

  const spotlight = {
    createdAt: Date.now(),
    targetKeys: nextTargetKeys,
  } satisfies PendingChangeSpotlight;

  persistPendingChangeSpotlight(spotlight);
  window.dispatchEvent(
    new CustomEvent<PendingChangeSpotlight>(CHANGE_SPOTLIGHT_EVENT, {
      detail: spotlight,
    }),
  );
}

export function ChangeSpotlight() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SpotlightSession | null>(null);
  const activationTokenRef = useRef(0);
  const dismissTimeoutRef = useRef<number | null>(null);
  const searchFrameRef = useRef<number | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const activeTargetKeyRef = useRef<string | null>(null);
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

  const clearSpotlight = useCallback(() => {
    activationTokenRef.current += 1;
    clearDismissTimeout();
    clearSearchFrame();
    persistPendingChangeSpotlight(null);
    activeElementRef.current = null;
    activeTargetKeyRef.current = null;
    targetKeysRef.current = [];
    setSession(null);
  }, [
    clearDismissTimeout,
    clearSearchFrame,
  ]);

  const measureSessionTargets = useCallback(() => {
    const targetKeys = targetKeysRef.current;
    const activeTargetKey = activeTargetKeyRef.current;
    const activeElement = activeElementRef.current;

    if (!activeTargetKey || !activeElement || targetKeys.length === 0) {
      return;
    }

    const activeRect = buildSpotlightRect(
      activeElement.getBoundingClientRect(),
    );

    if (activeRect.height <= 0 || activeRect.width <= 0) {
      return;
    }

    const visibleTargets = collectTargetElements(targetKeys)
      .filter((target) => target.targetKey !== activeTargetKey)
      .slice(0, CHANGE_SPOTLIGHT_VISIBLE_SECONDARY_LIMIT);

    setSession((current) => {
      if (!current) {
        return null;
      }

      return {
        ...current,
        activeRect,
        visibleTargets,
      };
    });
  }, []);

  const applyFocusedTarget = useCallback(
    (
      targetKeys: string[],
      activeIndex: number,
      foundTarget: HTMLElement,
      targetKey: string,
    ) => {
      const activeRect = buildSpotlightRect(
        foundTarget.getBoundingClientRect(),
      );

      activeElementRef.current = foundTarget;
      activeTargetKeyRef.current = targetKey;
      targetKeysRef.current = targetKeys;

      setSession({
        activeIndex,
        activeRect,
        summary: formatReviewSummary(targetKeys),
        targetKeys,
        visibleTargets: [],
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

          if (targetKeys.length === 1) {
            dismissTimeoutRef.current = window.setTimeout(() => {
              clearSpotlight();
            }, CHANGE_SPOTLIGHT_VISIBLE_MS);
          }
        });
      });
    },
    [
      clearDismissTimeout,
      clearSpotlight,
      measureSessionTargets,
    ],
  );

  const focusTargetIndex = useCallback(
    async (
      targetKeys: string[],
      requestedIndex: number,
      activationToken: number,
    ) => {
      if (targetKeys.length === 0) {
        return;
      }

      const searchOrder = buildSearchOrder(requestedIndex, targetKeys.length);
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

            persistPendingChangeSpotlight(null);
            applyFocusedTarget(targetKeys, targetIndex, foundTarget, targetKey);
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

  const activateSpotlight = useCallback(
    (pendingSpotlight: PendingChangeSpotlight | null) => {
      const reviewTargetKeys = buildReviewTargetKeys(
        pendingSpotlight?.targetKeys ?? [],
      );

      if (reviewTargetKeys.length === 0) {
        clearSpotlight();
        return;
      }

      activationTokenRef.current += 1;
      void focusTargetIndex(reviewTargetKeys, 0, activationTokenRef.current);
    },
    [
      clearSpotlight,
      focusTargetIndex,
    ],
  );

  const stepReview = useCallback(
    (direction: -1 | 1) => {
      const targetKeys = targetKeysRef.current;

      if (targetKeys.length <= 1 || !session) {
        return;
      }

      activationTokenRef.current += 1;
      const nextIndex =
        (session.activeIndex + direction + targetKeys.length) %
        targetKeys.length;

      void focusTargetIndex(targetKeys, nextIndex, activationTokenRef.current);
    },
    [
      focusTargetIndex,
      session,
    ],
  );

  const jumpToReviewIndex = useCallback(
    (index: number) => {
      const targetKeys = targetKeysRef.current;

      if (
        index < 0 ||
        index >= targetKeys.length ||
        !session ||
        index === session.activeIndex
      ) {
        return;
      }

      activationTokenRef.current += 1;
      void focusTargetIndex(targetKeys, index, activationTokenRef.current);
    },
    [
      focusTargetIndex,
      session,
    ],
  );

  useEffect(() => {
    if (routeKey.length === 0) {
      return;
    }

    activateSpotlight(readPendingChangeSpotlight());
  }, [
    activateSpotlight,
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
        session.targetKeys.length > 1 &&
        (event.key === "ArrowRight" ||
          event.key === "ArrowDown" ||
          event.key === "]")
      ) {
        event.preventDefault();
        stepReview(1);
        return;
      }

      if (
        session.targetKeys.length > 1 &&
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

  useEffect(
    () => () => {
      clearSpotlight();
    },
    [
      clearSpotlight,
    ],
  );

  if (!session) {
    return null;
  }

  const activeTargetKey = session.targetKeys[session.activeIndex];
  const hasMultipleTargets = session.targetKeys.length > 1;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const top = session.activeRect.top;
  const left = session.activeRect.left;
  const height = session.activeRect.height;
  const width = session.activeRect.width;
  const bottom = top + height;
  const right = left + width;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[140]"
    >
      <div
        className="absolute inset-x-0 top-0 bg-taupe-950/10 backdrop-blur-[1px]"
        style={{
          height: top,
        }}
      />
      <div
        className="absolute left-0 bg-taupe-950/10 backdrop-blur-[1px]"
        style={{
          height,
          top,
          width: left,
        }}
      />
      <div
        className="absolute bg-taupe-950/10 backdrop-blur-[1px]"
        style={{
          height,
          left: right,
          top,
          width: Math.max(0, viewportWidth - right),
        }}
      />
      <div
        className="absolute inset-x-0 bg-taupe-950/10 backdrop-blur-[1px]"
        style={{
          height: Math.max(0, viewportHeight - bottom),
          top: bottom,
        }}
      />

      {session.visibleTargets.map((target) => (
        <div
          className="absolute rounded-[10px] border border-orange-200/95 bg-orange-50/30 shadow-[0_0_0_1px_rgba(255,255,255,0.78)] transition-[top,left,width,height] duration-200 ease-out"
          key={target.targetKey}
          style={{
            height: target.rect.height,
            left: target.rect.left,
            top: target.rect.top,
            width: target.rect.width,
          }}
        />
      ))}

      <div
        className="absolute rounded-[12px] border-2 border-orange-400/95 bg-white/14 shadow-[0_0_0_1px_rgba(255,255,255,0.96),0_12px_28px_rgba(249,115,22,0.16)] transition-[top,left,width,height] duration-300 ease-out"
        style={{
          height,
          left,
          top,
          width,
        }}
      />

      {hasMultipleTargets ? (
        <div className="pointer-events-auto fixed inset-x-0 bottom-5 flex justify-center px-4">
          <div className="flex max-w-[32rem] items-center gap-3 rounded-full border border-orange-200/90 bg-white/95 px-3 py-2 shadow-[0_16px_38px_rgba(84,57,26,0.16)] backdrop-blur-sm">
            <div className="min-w-0">
              <div className="truncate font-medium text-[12px] text-zinc-900">
                {session.summary}
              </div>
              <div className="text-[11px] text-taupe-600">
                {session.activeIndex + 1} of {session.targetKeys.length}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {session.targetKeys.slice(0, 8).map((targetKey, index) => (
                <button
                  className={`h-2.5 rounded-full transition-all ${
                    index === session.activeIndex
                      ? "w-6 bg-orange-500"
                      : targetKey === activeTargetKey
                        ? "w-3 bg-orange-300"
                        : "w-3 bg-taupe-200 hover:bg-taupe-300"
                  }`}
                  key={targetKey}
                  onClick={() => jumpToReviewIndex(index)}
                  type="button"
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full border border-taupe-200 bg-white text-sm text-zinc-700 transition-colors hover:border-orange-200 hover:text-orange-700"
                onClick={() => stepReview(-1)}
                type="button"
              >
                {"<"}
              </button>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full border border-taupe-200 bg-white text-sm text-zinc-700 transition-colors hover:border-orange-200 hover:text-orange-700"
                onClick={() => stepReview(1)}
                type="button"
              >
                {">"}
              </button>
              <button
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-taupe-200 bg-white text-sm text-zinc-500 transition-colors hover:border-orange-200 hover:text-zinc-900"
                onClick={clearSpotlight}
                type="button"
              >
                x
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
