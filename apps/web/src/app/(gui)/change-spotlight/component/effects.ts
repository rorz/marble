import { useEffect } from "react";
import {
  CHANGE_SPOTLIGHT_EVENT,
  CHANGE_SPOTLIGHT_PREVIEW_CLEAR_EVENT,
  CHANGE_SPOTLIGHT_PREVIEW_EVENT,
} from "../constants";
import { buildPreviewTargetKeys } from "../review";
import { readPendingChangeSpotlight } from "../storage";
import type { PendingChangeSpotlight, SpotlightPreview } from "../types";
import type { PreviewChangeSpotlight, SpotlightRefs } from "./types";

type SpotlightEffectsParams = {
  activateSpotlight: (pendingSpotlight: PendingChangeSpotlight | null) => void;
  clearPreview: () => void;
  clearSpotlight: () => void;
  measurePreviewTargets: () => void;
  measureSessionTargets: () => void;
  preview: SpotlightPreview | null;
  refs: SpotlightRefs;
  routeKey: string;
  sessionGroupsLength: number;
  stepReview: (direction: -1 | 1) => void;
};

export const useSpotlightEffects = ({
  activateSpotlight,
  clearPreview,
  clearSpotlight,
  measurePreviewTargets,
  measureSessionTargets,
  preview,
  refs,
  routeKey,
  sessionGroupsLength,
  stepReview,
}: SpotlightEffectsParams) => {
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
      if (sessionGroupsLength > 0) {
        return;
      }

      const detail = (event as CustomEvent<PreviewChangeSpotlight>).detail;
      const targetKeys = buildPreviewTargetKeys(detail?.targetKeys ?? []);

      if (targetKeys.length === 0) {
        clearPreview();
        return;
      }

      refs.previewTargetKeysRef.current = targetKeys;
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
    refs.previewTargetKeysRef,
    sessionGroupsLength,
  ]);

  useEffect(() => {
    if (sessionGroupsLength === 0) {
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
        sessionGroupsLength > 1 &&
        (event.key === "ArrowRight" ||
          event.key === "ArrowDown" ||
          event.key === "]")
      ) {
        event.preventDefault();
        stepReview(1);
        return;
      }

      if (
        sessionGroupsLength > 1 &&
        (event.key === "ArrowLeft" ||
          event.key === "ArrowUp" ||
          event.key === "[")
      ) {
        event.preventDefault();
        stepReview(-1);
      }
    };
    const activeElement = refs.activeElementRef.current;
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
    refs.activeElementRef,
    sessionGroupsLength,
    stepReview,
  ]);

  useEffect(() => {
    if (sessionGroupsLength > 0 || !preview) {
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
    sessionGroupsLength,
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
};
