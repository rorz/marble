import { useCallback } from "react";
import {
  CHANGE_SPOTLIGHT_VISIBLE_PREVIEW_LIMIT,
  CHANGE_SPOTLIGHT_VISIBLE_SECONDARY_LIMIT,
} from "../constants";
import { collectTargetElements } from "../dom";
import { collectMergedTargetElements, mergeSpotlightTargets } from "../merge";
import {
  hasSpecificPreviewDescriptor,
  isBroadPreviewDescriptor,
} from "../review";
import { dedupeTargetKeys, parseChangeTargetKey } from "../target-keys";
import type { SpotlightState } from "./types";

type SpotlightMeasurementParams = Pick<
  SpotlightState,
  | "clearPreview"
  | "refs"
  | "session"
  | "setInspectedTargetKeys"
  | "setPreview"
  | "setSession"
>;

export const useSpotlightMeasurement = ({
  clearPreview,
  refs,
  session,
  setInspectedTargetKeys,
  setPreview,
  setSession,
}: SpotlightMeasurementParams) => {
  const measureSessionTargets = useCallback(() => {
    const inspectedTargetKeys = refs.inspectedTargetKeysRef.current;
    const targetKeys =
      inspectedTargetKeys && inspectedTargetKeys.length > 0
        ? inspectedTargetKeys
        : refs.targetKeysRef.current;
    const activeElement = refs.activeElementRef.current;

    if (!activeElement || targetKeys.length === 0) {
      return;
    }

    const visibleTargets = collectMergedTargetElements(targetKeys).slice(
      0,
      CHANGE_SPOTLIGHT_VISIBLE_SECONDARY_LIMIT + 1,
    );
    const resolvedVisibleTargets =
      visibleTargets.length === 0 && inspectedTargetKeys
        ? collectMergedTargetElements(refs.targetKeysRef.current).slice(
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
  }, [
    refs.activeElementRef,
    refs.inspectedTargetKeysRef,
    refs.targetKeysRef,
    setSession,
  ]);

  const setSessionInspectionTargetKeys = useCallback(
    (targetKeys: null | string[]) => {
      const nextTargetKeys =
        targetKeys && targetKeys.length > 0
          ? dedupeTargetKeys(targetKeys)
          : null;

      refs.inspectedTargetKeysRef.current = nextTargetKeys;
      setInspectedTargetKeys(nextTargetKeys);

      if (refs.activeElementRef.current) {
        measureSessionTargets();
      }
    },
    [
      measureSessionTargets,
      refs.activeElementRef,
      refs.inspectedTargetKeysRef,
      setInspectedTargetKeys,
    ],
  );

  const measurePreviewTargets = useCallback(() => {
    if (session) {
      return;
    }

    const targetKeys = refs.previewTargetKeysRef.current;

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
    refs.previewTargetKeysRef,
    session,
    setPreview,
  ]);

  return {
    measurePreviewTargets,
    measureSessionTargets,
    setSessionInspectionTargetKeys,
  };
};
