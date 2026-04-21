"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  ComponentType,
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { cx } from "../utils/cx";

const marbleButtonBorderBackgrounds = {
  dark: {
    pressed: `
      linear-gradient(300deg, var(--color-white) 0%, #40404000 10%),
      linear-gradient(to right, var(--color-neutral-800) 0px, #40404000 4px),
      linear-gradient(to left, var(--color-neutral-500) 0px, #40404000 4px),
      linear-gradient(to top, var(--color-neutral-400) 0px, #40404000 4px),
      linear-gradient(to bottom, var(--color-neutral-950) 0px, #40404000 4px),
      linear-gradient(to right, var(--color-neutral-600) 0%, var(--color-neutral-600) 100%)`,
    raised: `
      linear-gradient(120deg, var(--color-white) 0%, #40404000 10%),
      linear-gradient(to right, var(--color-neutral-500) 0px, #40404000 4px),
      linear-gradient(to left, var(--color-neutral-600) 0px, #40404000 4px),
      linear-gradient(to top, var(--color-neutral-700) 0px, #40404000 4px),
      linear-gradient(to bottom, var(--color-neutral-400) 0px, #40404000 4px),
      linear-gradient(to right, var(--color-neutral-600) 0%, var(--color-neutral-600) 100%)`,
  },
  light: {
    pressed: `
      linear-gradient(300deg, var(--color-white) 0px, #e5e5e500 10%),
      linear-gradient(to right, var(--color-neutral-300) 0px, #e5e5e500 4px),
      linear-gradient(to left, var(--color-neutral-100) 0px, #e5e5e500 4px),
      linear-gradient(to top, var(--color-neutral-100) 0px, #e5e5e500 4px),
      linear-gradient(to bottom, var(--color-neutral-300) 0px, #e5e5e500 4px),
      linear-gradient(to right, var(--color-neutral-200) 0%, var(--color-neutral-200) 100%)`,
    raised: `
      linear-gradient(120deg, var(--color-white) 0px, #e5e5e500 10%),
      linear-gradient(to right, var(--color-neutral-100) 0px, #e5e5e500 4px),
      linear-gradient(to left, var(--color-neutral-300) 0px, #e5e5e500 4px),
      linear-gradient(to top, var(--color-neutral-300) 0px, #e5e5e500 4px),
      linear-gradient(to bottom, var(--color-neutral-100) 0px, #e5e5e500 4px),
      linear-gradient(to right, var(--color-neutral-200) 0%, var(--color-neutral-200) 100%)`,
  },
  orange: {
    pressed: `
      linear-gradient(300deg, var(--color-white) 0px, #f6490000 10%),
      linear-gradient(to right, var(--color-orange-700) 0px, #f6490000 4px),
      linear-gradient(to left, var(--color-orange-300) 0px, #f6490000 4px),
      linear-gradient(to top, var(--color-orange-300) 0px, #f6490000 4px),
      linear-gradient(to bottom, var(--color-orange-700) 0px, #f6490000 4px),
      linear-gradient(to right, var(--color-orange-600) 0%, var(--color-orange-600) 100%)`,
    raised: `
      linear-gradient(120deg, var(--color-white) 0px, #f6490000 10%),
      linear-gradient(to left, var(--color-orange-600) 0px, #f6490000 4px),
      linear-gradient(to top, var(--color-orange-700) 0px, #f6490000 4px),
      linear-gradient(to bottom, var(--color-orange-300) 0px, #f6490000 4px),
      linear-gradient(to right, var(--color-orange-600) 0%, var(--color-orange-600) 100%)`,
  },
  red: {
    pressed: `
      linear-gradient(300deg, var(--color-white) 0px, #dc262600 10%),
      linear-gradient(to right, var(--color-red-800) 0px, #dc262600 4px),
      linear-gradient(to left, var(--color-red-300) 0px, #dc262600 4px),
      linear-gradient(to top, var(--color-red-300) 0px, #dc262600 4px),
      linear-gradient(to bottom, var(--color-red-950) 0px, #dc262600 4px),
      linear-gradient(to right, var(--color-red-600) 0%, var(--color-red-600) 100%)`,
    raised: `
      linear-gradient(120deg, var(--color-white) 0px, #dc262600 10%),
      linear-gradient(to right, var(--color-red-300) 0px, #dc262600 4px),
      linear-gradient(to left, var(--color-red-700) 0px, #dc262600 4px),
      linear-gradient(to top, var(--color-red-700) 0px, #dc262600 4px),
      linear-gradient(to bottom, var(--color-red-300) 0px, #dc262600 4px),
      linear-gradient(to right, var(--color-red-600) 0%, var(--color-red-600) 100%)`,
  },
} as const;

const marbleButtonCursorDotBackgrounds = {
  dark: `
    radial-gradient(circle at center,
      rgb(255 255 255 / 0.4) 0%,
      rgb(244 244 245 / 0.22) 26%,
      rgb(212 212 216 / 0.1) 48%,
      transparent 74%
    ),
    repeating-linear-gradient(
      37deg,
      rgb(255 255 255 / 0.1) 0px,
      rgb(255 255 255 / 0.1) 2px,
      transparent 2px,
      transparent 5px
    ),
    repeating-linear-gradient(
      -41deg,
      rgb(24 24 27 / 0.05) 0px,
      rgb(24 24 27 / 0.05) 1px,
      transparent 1px,
      transparent 4px
    )`,
  light: `
    radial-gradient(circle at center,
      rgb(63 63 70 / 0.22) 0%,
      rgb(63 63 70 / 0.12) 26%,
      rgb(24 24 27 / 0.05) 46%,
      transparent 72%
    ),
    repeating-linear-gradient(
      37deg,
      rgb(24 24 27 / 0.07) 0px,
      rgb(24 24 27 / 0.07) 2px,
      transparent 2px,
      transparent 5px
    ),
    repeating-linear-gradient(
      -41deg,
      rgb(255 255 255 / 0.08) 0px,
      rgb(255 255 255 / 0.08) 1px,
      transparent 1px,
      transparent 4px
    )`,
  orange: `
    radial-gradient(circle at center,
      rgb(255 255 255 / 0.36) 0%,
      rgb(250 250 250 / 0.18) 28%,
      rgb(254 215 170 / 0.08) 48%,
      transparent 74%
    ),
    repeating-linear-gradient(
      35deg,
      rgb(255 255 255 / 0.1) 0px,
      rgb(255 255 255 / 0.1) 2px,
      transparent 2px,
      transparent 5px
    ),
    repeating-linear-gradient(
      -39deg,
      rgb(120 53 15 / 0.05) 0px,
      rgb(120 53 15 / 0.05) 1px,
      transparent 1px,
      transparent 4px
    )`,
  red: `
    radial-gradient(circle at center,
      rgb(255 255 255 / 0.34) 0%,
      rgb(250 250 250 / 0.18) 28%,
      rgb(254 202 202 / 0.08) 48%,
      transparent 74%
    ),
    repeating-linear-gradient(
      35deg,
      rgb(255 255 255 / 0.1) 0px,
      rgb(255 255 255 / 0.1) 2px,
      transparent 2px,
      transparent 5px
    ),
    repeating-linear-gradient(
      -39deg,
      rgb(127 29 29 / 0.05) 0px,
      rgb(127 29 29 / 0.05) 1px,
      transparent 1px,
      transparent 4px
    )`,
} as const;

const marbleButtonRootVariants = cva(
  "group/button relative overflow-hidden rounded-sm p-0.5 transition-opacity duration-150 ease-out",
  {
    variants: {
      disabled: {
        false: "cursor-pointer hover:opacity-95",
        true: "cursor-not-allowed opacity-40",
      },
      variant: {
        dark: "bg-neutral-500",
        light: "bg-neutral-200",
        orange:
          "bg-linear-to-br from-orange-400 to-orange-700 border border-orange-300",
        red: "bg-red-400",
      },
    },
  },
);

const marbleButtonBorderVariants = cva(
  "relative size-full overflow-hidden rounded-md p-px",
  {
    defaultVariants: {
      variant: "light",
    },
    variants: {
      variant: {
        dark: "bg-neutral-700",
        light: "bg-neutral-300",
        orange: "bg-orange-500",
        red: "bg-red-600",
      },
    },
  },
);

const marbleButtonInnerVariants = cva(
  "relative flex size-full items-center justify-center overflow-hidden rounded-[5px] font-semibold",
  {
    defaultVariants: {
      size: "md",
      variant: "light",
    },
    variants: {
      size: {
        md: "px-3 py-1.5 text-xs tracking-normal",
        sm: "px-2.5 py-1 text-[11px] tracking-wide",
        xs: "px-2 py-0.5 text-[10px] tracking-wide",
      },
      variant: {
        dark: "bg-neutral-600 text-neutral-100",
        light: "bg-neutral-200 text-neutral-900",
        orange: "bg-orange-500 text-white",
        red: "bg-red-600 text-white",
      },
    },
  },
);

const marbleButtonCursorDotVariants = cva(
  "pointer-events-none absolute z-0 -translate-x-1/2 -translate-y-1/2 rounded-full [transition-property:left,top,filter] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
  {
    defaultVariants: {
      size: "md",
    },
    variants: {
      size: {
        md: "size-12",
        sm: "size-10",
        xs: "size-10",
      },
    },
  },
);

const marbleButtonContentVariants = cva(
  "relative z-10 inline-flex items-center justify-center",
  {
    defaultVariants: {
      size: "md",
    },
    variants: {
      size: {
        md: "gap-1.5",
        sm: "gap-1.5",
        xs: "gap-1",
      },
    },
  },
);

type MarbleButtonInlineStyle = CSSProperties & {
  "--marble-button-dot-x"?: string;
  "--marble-button-dot-y"?: string;
};

const marbleButtonIconSizes = {
  md: 14,
  sm: 12,
  xs: 12,
} as const;

const marbleButtonDefaultInlineStyle = {
  "--marble-button-dot-x": "50%",
  "--marble-button-dot-y": "50%",
} satisfies MarbleButtonInlineStyle;

const marbleButtonCursorDotPositionStyle = {
  left: "var(--marble-button-dot-x)",
  top: "var(--marble-button-dot-y)",
} satisfies CSSProperties;

function setCursorDotPosition(
  button: HTMLButtonElement,
  event: ReactPointerEvent<HTMLButtonElement>,
) {
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
}

function centerCursorDotPosition(button: HTMLButtonElement) {
  button.style.setProperty("--marble-button-dot-x", "50%");
  button.style.setProperty("--marble-button-dot-y", "50%");
}

function centerCursorDotPositionIfKeyboardFocused(
  event: ReactFocusEvent<HTMLButtonElement>,
) {
  if (event.currentTarget.matches(":focus-visible")) {
    centerCursorDotPosition(event.currentTarget);
  }
}

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

export function MarbleButton({
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
}: MarbleButtonProps) {
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
}
