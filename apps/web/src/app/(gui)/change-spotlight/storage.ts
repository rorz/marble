import { CHANGE_SPOTLIGHT_STORAGE_KEY } from "./constants";
import { buildReviewTargetKeys } from "./review";
import { formatReviewSummary } from "./target-keys";
import type {
  ChangeSpotlightGroup,
  ChangeSpotlightQueueGroup,
  PendingChangeSpotlight,
} from "./types";

export function normalizeQueuedGroups(groups: ChangeSpotlightQueueGroup[]) {
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

export function readPendingChangeSpotlight() {
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

export function persistPendingChangeSpotlight(
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
