"use client";

import { cx } from "@marble/ui";
import type { MouseEvent, PointerEvent, PropsWithChildren } from "react";
import { useRef } from "react";

/**
 * CSS-3D tilt card — tracks pointer position over the card and applies
 * a `rotateX/rotateY` transform in real-time. Falls back to a CSS-only
 * static tilt for keyboard users / no-pointer environments.
 *
 * Wrap any rich marketing content (poster, instrument mock, image
 * collage) for that K.O. II "product spinning in hand" feel.
 */

type MarketingTiltCardProps = PropsWithChildren<{
  /** Max degrees of rotation on each axis. */
  maxTilt?: number;
  /** Adds a subtle floating animation in addition to the pointer-tilt. */
  float?: boolean;
  /** Glare overlay that follows the pointer. */
  glare?: boolean;
  className?: string;
  innerClassName?: string;
}>;

export function MarketingTiltCard({
  maxTilt = 10,
  float = false,
  glare = true,
  className,
  innerClassName,
  children,
}: MarketingTiltCardProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLSpanElement>(null);

  function handleMove(
    event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
  ) {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    const rotateX = -offsetY * maxTilt;
    const rotateY = offsetX * maxTilt;
    if (innerRef.current) {
      innerRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }
    if (glareRef.current) {
      const cx = (offsetX + 0.5) * 100;
      const cy = (offsetY + 0.5) * 100;
      glareRef.current.style.background = `radial-gradient(circle at ${cx}% ${cy}%, rgba(255,255,255,0.35), transparent 55%)`;
    }
  }

  function handleLeave() {
    if (innerRef.current) {
      innerRef.current.style.transform = "rotateX(0deg) rotateY(0deg)";
    }
    if (glareRef.current) {
      glareRef.current.style.background = "transparent";
    }
  }

  // The tilt handlers are pure visual pointer-tracking — no semantic
  // interaction, no keyboard activation. Wrapper stays a div.
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: decorative pointer-tilt
    <div
      className={cx("marketing-perspective", className)}
      onMouseLeave={handleLeave}
      onPointerLeave={handleLeave}
      onPointerMove={handleMove}
    >
      <div
        className={cx(
          "marketing-preserve-3d relative isolate transition-transform duration-200 ease-out will-change-transform",
          float && "animate-marketing-float-slow",
          innerClassName,
        )}
        ref={innerRef}
      >
        {children}
        {glare ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xs"
            ref={glareRef}
          />
        ) : null}
      </div>
    </div>
  );
}
