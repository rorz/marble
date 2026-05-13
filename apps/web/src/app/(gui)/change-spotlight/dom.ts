import { CHANGE_SPOTLIGHT_ATTRIBUTE } from "./constants";
import { parseChangeTargetKey, spotlightResolvers } from "./target-keys";
import type {
  ChangeTargetDescriptor,
  SpotlightRect,
  SpotlightVisibleTarget,
} from "./types";

const escapeChangeTarget = (value: string) => {
  if (typeof window !== "undefined" && window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return value.replaceAll('"', '\\"');
};

const queryChangeTargetElement = (targetKey: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  return document.querySelector<HTMLElement>(
    `[${CHANGE_SPOTLIGHT_ATTRIBUTE}="${escapeChangeTarget(targetKey)}"]`,
  );
};

export const findChangeTargetElement = (
  targetKey: string,
  descriptor: ChangeTargetDescriptor | null,
) => {
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
};

const _revealChangeTarget = async (descriptor: ChangeTargetDescriptor) => {
  for (const resolver of spotlightResolvers) {
    if (!resolver.match(descriptor) || !resolver.reveal) {
      continue;
    }

    const result = await resolver.reveal(descriptor);

    if (result !== false) {
      return;
    }
  }
};

const parseBorderRadius = (value: string) => {
  const numericValue = Number.parseFloat(value);

  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const buildSpotlightRect = (
  element: HTMLElement,
  margin = 0,
): SpotlightRect => {
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
};

export const shouldReduceMotion = () => {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
};

export const waitForAnimationFrame = () => {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
};

export const buildSearchOrder = (startIndex: number, length: number) => {
  return Array.from({
    length,
  }).map((_, offset) => (startIndex + offset) % length);
};

export const collectTargetElements = (targetKeys: string[]) => {
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
};

export const revealChangeTarget = async (
  descriptor: ChangeTargetDescriptor,
) => {
  for (const resolver of spotlightResolvers) {
    if (!resolver.match(descriptor) || !resolver.reveal) {
      continue;
    }

    const result = await resolver.reveal(descriptor);

    if (result !== false) {
      return;
    }
  }
};
