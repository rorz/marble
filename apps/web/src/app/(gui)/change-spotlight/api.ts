import { useEffect, useState } from "react";
import {
  CHANGE_SPOTLIGHT_EVENT,
  CHANGE_SPOTLIGHT_PREVIEW_CLEAR_EVENT,
  CHANGE_SPOTLIGHT_PREVIEW_EVENT,
} from "./constants";
import { buildPreviewTargetKeys } from "./review";
import {
  normalizeQueuedGroups,
  persistPendingChangeSpotlight,
} from "./storage";
import { dedupeTargetKeys } from "./target-keys";
import type {
  ChangeSpotlightQueueGroup,
  PendingChangeSpotlight,
} from "./types";

type PreviewChangeSpotlight = {
  targetKeys: string[];
};

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
