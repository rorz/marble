import { MarbleReviewNavigator } from "@marble/ui";
import type { PointerEventHandler } from "react";
import type {
  SpotlightPreview,
  SpotlightRect,
  SpotlightSession,
} from "../types";

type OverlayBounds = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  viewportHeight: number;
  viewportWidth: number;
  width: number;
};

type SpotlightOverlayProps = {
  inspectedTargetKeys: null | string[];
  onBackdropPointerDown: PointerEventHandler<HTMLDivElement>;
  onClearSpotlight: () => void;
  onInspectTargets: (targetKeys: null | string[]) => void;
  onJumpToReviewIndex: (index: number) => void;
  onStepReview: (direction: -1 | 1) => void;
  preview: SpotlightPreview | null;
  session: SpotlightSession | null;
};

const getSessionBounds = (session: SpotlightSession | null) =>
  session?.visibleTargets.reduce<null | SpotlightRect>((current, target) => {
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
  }, null) ?? null;

const getOverlayBounds = (session: SpotlightSession | null): OverlayBounds => {
  const sessionBounds = getSessionBounds(session);
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const top = sessionBounds?.top ?? 0;
  const left = sessionBounds?.left ?? 0;
  const height = sessionBounds?.height ?? 0;
  const width = sessionBounds?.width ?? 0;
  const bottom = top + height;
  const right = left + width;

  return {
    bottom,
    height,
    left,
    right,
    top,
    viewportHeight,
    viewportWidth,
    width,
  };
};

export const SpotlightOverlay = ({
  inspectedTargetKeys,
  onBackdropPointerDown,
  onClearSpotlight,
  onInspectTargets,
  onJumpToReviewIndex,
  onStepReview,
  preview,
  session,
}: SpotlightOverlayProps) => {
  if (!session && !preview) {
    return null;
  }

  const hasMultipleGroups = Boolean(session && session.groups.length > 1);
  const isInspectingSubset = Boolean(
    session && inspectedTargetKeys && inspectedTargetKeys.length > 0,
  );
  const bounds = getOverlayBounds(session);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[140]"
    >
      {session ? (
        <>
          <div
            className="pointer-events-auto absolute inset-x-0 top-0 bg-taupe-950/10 backdrop-blur-[1px]"
            onPointerDown={onBackdropPointerDown}
            style={{
              height: bounds.top,
            }}
          />
          <div
            className="pointer-events-auto absolute left-0 bg-taupe-950/10 backdrop-blur-[1px]"
            onPointerDown={onBackdropPointerDown}
            style={{
              height: bounds.height,
              top: bounds.top,
              width: bounds.left,
            }}
          />
          <div
            className="pointer-events-auto absolute bg-taupe-950/10 backdrop-blur-[1px]"
            onPointerDown={onBackdropPointerDown}
            style={{
              height: bounds.height,
              left: bounds.right,
              top: bounds.top,
              width: Math.max(0, bounds.viewportWidth - bounds.right),
            }}
          />
          <div
            className="pointer-events-auto absolute inset-x-0 bg-taupe-950/10 backdrop-blur-[1px]"
            onPointerDown={onBackdropPointerDown}
            style={{
              height: Math.max(0, bounds.viewportHeight - bounds.bottom),
              top: bounds.bottom,
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
            onClose={onClearSpotlight}
            onNext={() => onStepReview(1)}
            onPreviewTargetsEnd={() => onInspectTargets(null)}
            onPreviewTargetsStart={onInspectTargets}
            onPrevious={() => onStepReview(-1)}
            onSelectIndex={onJumpToReviewIndex}
            summary={session.summary}
            totalCount={session.groups.length}
          />
        </div>
      ) : null}
    </div>
  );
};
