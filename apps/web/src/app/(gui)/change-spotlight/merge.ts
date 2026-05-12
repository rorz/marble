import { collectTargetElements } from "./dom";
import type { SpotlightVisibleTarget } from "./types";

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

export function mergeSpotlightTargets(targets: SpotlightVisibleTarget[]) {
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

export function collectMergedTargetElements(targetKeys: string[]) {
  return mergeSpotlightTargets(collectTargetElements(targetKeys));
}
