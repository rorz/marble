import { useCallback } from "react";
import {
  CHANGE_SPOTLIGHT_SEARCH_TIMEOUT_MS,
  CHANGE_SPOTLIGHT_VISIBLE_MS,
} from "../constants";
import {
  buildSearchOrder,
  buildSpotlightRect,
  findChangeTargetElement,
  revealChangeTarget,
  shouldReduceMotion,
  waitForAnimationFrame,
} from "../dom";
import { mergeSpotlightTargets } from "../merge";
import {
  normalizeQueuedGroups,
  persistPendingChangeSpotlight,
} from "../storage";
import { formatReviewSummary, parseChangeTargetKey } from "../target-keys";
import type { ChangeSpotlightGroup, PendingChangeSpotlight } from "../types";
import type { SpotlightState } from "./types";

type SpotlightRouter = {
  push: (href: string) => void;
};

type SpotlightNavigationParams = Pick<
  SpotlightState,
  | "clearDismissTimeout"
  | "clearPreview"
  | "clearSearchFrame"
  | "clearSpotlight"
  | "refs"
  | "resetActiveSpotlight"
  | "session"
  | "setSession"
> & {
  measureSessionTargets: () => void;
  pathname: string;
  router: SpotlightRouter;
  setSessionInspectionTargetKeys: (targetKeys: null | string[]) => void;
};

export const useSpotlightNavigation = ({
  clearDismissTimeout,
  clearPreview,
  clearSearchFrame,
  clearSpotlight,
  measureSessionTargets,
  pathname,
  refs,
  resetActiveSpotlight,
  router,
  session,
  setSession,
  setSessionInspectionTargetKeys,
}: SpotlightNavigationParams) => {
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

      refs.activeElementRef.current = foundTarget;
      refs.activeTargetKeyRef.current = targetKey;
      refs.targetKeysRef.current = targetKeys;
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
            refs.dismissTimeoutRef.current = window.setTimeout(() => {
              clearSpotlight();
            }, CHANGE_SPOTLIGHT_VISIBLE_MS);
          }
        });
      });
    },
    [
      clearDismissTimeout,
      clearPreview,
      clearSpotlight,
      measureSessionTargets,
      refs.activeElementRef,
      refs.activeTargetKeyRef,
      refs.dismissTimeoutRef,
      refs.targetKeysRef,
      setSession,
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
            if (refs.activationTokenRef.current !== activationToken) {
              return;
            }

            const targetKey = targetKeys[targetIndex];
            const descriptor = parseChangeTargetKey(targetKey);
            let foundTarget = findChangeTargetElement(targetKey, descriptor);

            if (!foundTarget && descriptor && !revealedKeys.has(targetKey)) {
              revealedKeys.add(targetKey);
              await revealChangeTarget(descriptor);

              if (refs.activationTokenRef.current !== activationToken) {
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

          if (refs.activationTokenRef.current !== activationToken) {
            return;
          }

          if (
            performance.now() - startedAt <
            CHANGE_SPOTLIGHT_SEARCH_TIMEOUT_MS
          ) {
            refs.searchFrameRef.current =
              window.requestAnimationFrame(attemptFocus);
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
      refs.activationTokenRef,
      refs.searchFrameRef,
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

      refs.activationTokenRef.current += 1;
      void focusTargetIndex(groups, nextIndex, refs.activationTokenRef.current);
    },
    [
      clearPreview,
      focusTargetIndex,
      pathname,
      refs.activationTokenRef,
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

      refs.activationTokenRef.current += 1;
      void focusTargetIndex(
        groups,
        activeGroupIndex,
        refs.activationTokenRef.current,
      );
    },
    [
      clearPreview,
      clearSpotlight,
      focusTargetIndex,
      pathname,
      refs.activationTokenRef,
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

  return {
    activateSpotlight,
    jumpToReviewIndex,
    stepReview,
  };
};
