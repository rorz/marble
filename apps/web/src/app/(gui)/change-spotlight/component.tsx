"use client";

// harness-ignore: max-file-lines -- single dense state machine: 15 useCallbacks + 6 useEffects sharing 8 refs; lifting would obscure dataflow

import { MarbleReviewNavigator, useMarbleRouter } from "@marble/ui";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHANGE_SPOTLIGHT_EVENT,
  CHANGE_SPOTLIGHT_PREVIEW_CLEAR_EVENT,
  CHANGE_SPOTLIGHT_PREVIEW_EVENT,
  CHANGE_SPOTLIGHT_SEARCH_TIMEOUT_MS,
  CHANGE_SPOTLIGHT_VISIBLE_MS,
  CHANGE_SPOTLIGHT_VISIBLE_PREVIEW_LIMIT,
  CHANGE_SPOTLIGHT_VISIBLE_SECONDARY_LIMIT,
} from "./constants";
import {
  buildSearchOrder,
  buildSpotlightRect,
  collectTargetElements,
  findChangeTargetElement,
  revealChangeTarget,
  shouldReduceMotion,
  waitForAnimationFrame,
} from "./dom";
import { collectMergedTargetElements, mergeSpotlightTargets } from "./merge";
import {
  buildPreviewTargetKeys,
  hasSpecificPreviewDescriptor,
  isBroadPreviewDescriptor,
} from "./review";
import {
  normalizeQueuedGroups,
  persistPendingChangeSpotlight,
  readPendingChangeSpotlight,
} from "./storage";
import {
  dedupeTargetKeys,
  formatReviewSummary,
  parseChangeTargetKey,
} from "./target-keys";
import type {
  ChangeSpotlightGroup,
  PendingChangeSpotlight,
  SpotlightPreview,
  SpotlightRect,
  SpotlightSession,
} from "./types";

type PreviewChangeSpotlight = {
  targetKeys: string[];
};

export const ChangeSpotlight = () => {
  const router = useMarbleRouter();
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
};
