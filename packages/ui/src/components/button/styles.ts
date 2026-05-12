import { cva } from "class-variance-authority";
import type { CSSProperties } from "react";

export const marbleButtonBorderBackgrounds = {
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
      linear-gradient(to right, var(--color-orange-500) 0%, var(--color-orange-500) 100%)`,
    raised: `
      linear-gradient(120deg, var(--color-white) 0px, #f6490000 10%),
      linear-gradient(to right, var(--color-orange-300) 0px, #f6490000 4px),
      linear-gradient(to left, var(--color-orange-700) 0px, #f6490000 4px),
      linear-gradient(to top, var(--color-orange-700) 0px, #f6490000 4px),
      linear-gradient(to bottom, var(--color-orange-300) 0px, #f6490000 4px),
      linear-gradient(to right, var(--color-orange-500) 0%, var(--color-orange-500) 100%)`,
  },
  red: {
    pressed: `
      linear-gradient(300deg, var(--color-white) 0px, #c1121f00 10%),
      linear-gradient(to right, var(--color-red-700) 0px, #c1121f00 4px),
      linear-gradient(to left, var(--color-red-300) 0px, #c1121f00 4px),
      linear-gradient(to top, var(--color-red-300) 0px, #c1121f00 4px),
      linear-gradient(to bottom, var(--color-red-700) 0px, #c1121f00 4px),
      linear-gradient(to right, var(--color-red-500) 0%, var(--color-red-500) 100%)`,
    raised: `
      linear-gradient(120deg, var(--color-white) 0px, #c1121f00 10%),
      linear-gradient(to right, var(--color-red-300) 0px, #c1121f00 4px),
      linear-gradient(to left, var(--color-red-700) 0px, #c1121f00 4px),
      linear-gradient(to top, var(--color-red-700) 0px, #c1121f00 4px),
      linear-gradient(to bottom, var(--color-red-300) 0px, #c1121f00 4px),
      linear-gradient(to right, var(--color-red-500) 0%, var(--color-red-500) 100%)`,
  },
} as const;

export const marbleButtonCursorDotBackgrounds = {
  dark: `
    radial-gradient(circle at center,
      rgb(255 255 255 / 0.32) 0%,
      rgb(255 255 255 / 0.16) 28%,
      rgb(255 255 255 / 0.06) 50%,
      transparent 76%
    ),
    repeating-linear-gradient(
      37deg,
      rgb(255 255 255 / 0.08) 0px,
      rgb(255 255 255 / 0.08) 2px,
      transparent 2px,
      transparent 5px
    ),
    repeating-linear-gradient(
      -41deg,
      rgb(0 0 0 / 0.07) 0px,
      rgb(0 0 0 / 0.07) 1px,
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

export const marbleButtonRootVariants = cva(
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

export const marbleButtonBorderVariants = cva(
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

export const marbleButtonInnerVariants = cva(
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

export const marbleButtonCursorDotVariants = cva(
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

export const marbleButtonContentVariants = cva(
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

export type MarbleButtonInlineStyle = CSSProperties & {
  "--marble-button-dot-x"?: string;
  "--marble-button-dot-y"?: string;
};

export const marbleButtonIconSizes = {
  md: 14,
  sm: 12,
  xs: 12,
} as const;

export const marbleButtonDefaultInlineStyle = {
  "--marble-button-dot-x": "50%",
  "--marble-button-dot-y": "50%",
} satisfies MarbleButtonInlineStyle;

export const marbleButtonCursorDotPositionStyle = {
  left: "var(--marble-button-dot-x)",
  top: "var(--marble-button-dot-y)",
} satisfies CSSProperties;
