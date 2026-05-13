"use client";

import type { VariantProps } from "class-variance-authority";
import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  ComponentType,
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { cx } from "../../utils/cx";
import {
  type MarbleButtonInlineStyle,
  marbleButtonBorderBackgrounds,
  marbleButtonBorderVariants,
  marbleButtonContentVariants,
  marbleButtonCursorDotBackgrounds,
  marbleButtonCursorDotPositionStyle,
  marbleButtonCursorDotVariants,
  marbleButtonDefaultInlineStyle,
  marbleButtonIconSizes,
  marbleButtonInnerVariants,
  marbleButtonRootVariants,
} from "./styles";

const setCursorDotPosition = (
  button: HTMLButtonElement,
  event: ReactPointerEvent<HTMLButtonElement>,
) => {
  if (event.pointerType === "touch") {
    return;
  }

  const bounds = button.getBoundingClientRect();

  button.style.setProperty(
    "--marble-button-dot-x",
    `${event.clientX - bounds.left}px`,
  );
  button.style.setProperty(
    "--marble-button-dot-y",
    `${event.clientY - bounds.top}px`,
  );
};

const centerCursorDotPosition = (button: HTMLButtonElement) => {
  button.style.setProperty("--marble-button-dot-x", "50%");
  button.style.setProperty("--marble-button-dot-y", "50%");
};

const centerCursorDotPositionIfKeyboardFocused = (
  event: ReactFocusEvent<HTMLButtonElement>,
) => {
  if (event.currentTarget.matches(":focus-visible")) {
    centerCursorDotPosition(event.currentTarget);
  }
};

type MarbleButtonIconWeight =
  | "thin"
  | "light"
  | "regular"
  | "bold"
  | "fill"
  | "duotone";

export type MarbleButtonIcon = ComponentType<
  ComponentPropsWithoutRef<"svg"> & {
    alt?: string;
    color?: string;
    mirrored?: boolean;
    size?: string | number;
    weight?: MarbleButtonIconWeight;
  }
>;

type MarbleButtonBaseProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof marbleButtonInnerVariants>;

type MarbleButtonIconProps =
  | {
      iconLeft?: MarbleButtonIcon;
      iconRight?: never;
    }
  | {
      iconLeft?: never;
      iconRight?: MarbleButtonIcon;
    }
  | {
      iconLeft?: undefined;
      iconRight?: undefined;
    };

export type MarbleButtonProps = MarbleButtonBaseProps & MarbleButtonIconProps;

export const MarbleButton = ({
  children,
  className,
  disabled = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  onBlur,
  onFocus,
  onPointerCancel,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  size,
  style,
  type = "button",
  variant = "light",
  ...props
}: MarbleButtonProps) => {
  const iconSize = marbleButtonIconSizes[size ?? "md"];

  return (
    <button
      className={cx(
        marbleButtonRootVariants({
          disabled,
          variant,
        }),
        className,
      )}
      disabled={disabled}
      onBlur={(event) => {
        onBlur?.(event);
      }}
      onFocus={(event) => {
        centerCursorDotPositionIfKeyboardFocused(event);
        onFocus?.(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
      }}
      onPointerEnter={(event) => {
        setCursorDotPosition(event.currentTarget, event);
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
      }}
      onPointerMove={(event) => {
        setCursorDotPosition(event.currentTarget, event);
        onPointerMove?.(event);
      }}
      style={{
        ...marbleButtonDefaultInlineStyle,
        ...(style as MarbleButtonInlineStyle | undefined),
      }}
      type={type}
      {...props}
    >
      <div
        className={marbleButtonBorderVariants({
          variant,
        })}
        style={{
          background: marbleButtonBorderBackgrounds[variant ?? "light"].raised,
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-100 ease-out motion-reduce:transition-none group-active/button:opacity-70"
          style={{
            background:
              marbleButtonBorderBackgrounds[variant ?? "light"].pressed,
          }}
        />
        <div
          className={marbleButtonInnerVariants({
            size,
            variant,
          })}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none group-hover/button:opacity-100 group-focus-visible/button:opacity-100"
          >
            <span
              className={marbleButtonCursorDotVariants({
                size,
              })}
              style={{
                ...marbleButtonCursorDotPositionStyle,
                background:
                  marbleButtonCursorDotBackgrounds[variant ?? "light"],
                filter: "blur(10px) saturate(0.72)",
                willChange: "left, top, filter, transform",
              }}
            />
          </span>
          <span
            className={marbleButtonContentVariants({
              size,
            })}
          >
            {IconLeft ? (
              <IconLeft
                aria-hidden="true"
                className="shrink-0 opacity-80"
                size={iconSize}
                weight="fill"
              />
            ) : null}
            {children}
            {IconRight ? (
              <IconRight
                aria-hidden="true"
                className="shrink-0 opacity-80"
                size={iconSize}
                weight="fill"
              />
            ) : null}
          </span>
        </div>
      </div>
    </button>
  );
};
