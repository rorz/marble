export const marbleButtonBackgrounds = {
  dark: `linear-gradient(to right, var(--color-neutral-300) 0px, #40404000 4px),
    linear-gradient(to left, var(--color-neutral-800) 0px, #40404000 4px),
    linear-gradient(to top, var(--color-neutral-950) 0px, #40404000 4px),
    linear-gradient(to bottom, var(--color-neutral-100) 0px, #40404000 4px),
    linear-gradient(to bottom right, var(--color-white) 0px, #40404000 4px)`,
  light: `linear-gradient(to right, var(--color-neutral-100) 0px, #e5e5e500 4px),
    linear-gradient(to left, var(--color-neutral-400) 0px, #e5e5e500 4px),
    linear-gradient(to top, var(--color-neutral-200) 0px, #e5e5e500 4px),
    linear-gradient(to bottom, var(--color-neutral-300) 0px, #e5e5e500 4px),
    linear-gradient(to bottom right, var(--color-white) 0px, #e5e5e500 4px)`,
  orange: `linear-gradient(to right, var(--color-orange-300) 0px, #f6490000 4px),
    linear-gradient(to left, var(--color-orange-800) 0px, #f6490000 4px),
    linear-gradient(to top, var(--color-orange-950) 0px, #f6490000 4px),
    linear-gradient(to bottom, var(--color-orange-300) 0px, #f6490000 4px),
    linear-gradient(to bottom right, var(--color-white) 0px, #f6490000 4px),
    linear-gradient(to right, var(--color-orange-600) 0%, var(--color-orange-600) 100%)`,
  red: `linear-gradient(to right, var(--color-red-300) 0px, #dc262600 4px),
    linear-gradient(to left, var(--color-red-800) 0px, #dc262600 4px),
    linear-gradient(to top, var(--color-red-950) 0px, #dc262600 4px),
    linear-gradient(to bottom, var(--color-red-300) 0px, #dc262600 4px),
    linear-gradient(to bottom right, var(--color-white) 0px, #dc262600 4px),
    linear-gradient(to right, var(--color-red-600) 0%, var(--color-red-600) 100%)`,
} as const;

export type MarbleButtonVariant = keyof typeof marbleButtonBackgrounds;

export const marbleButtonBorderClassNames: Record<MarbleButtonVariant, string> =
  {
    dark: "",
    light: "bg-neutral-200",
    orange: "bg-orange-600",
    red: "bg-red-600",
  };

export const marbleButtonInnerClassNames: Record<MarbleButtonVariant, string> =
  {
    dark: "bg-neutral-800 text-neutral-100 font-light",
    light: "bg-neutral-50 text-neutral-700 shadow-sm font-medium",
    orange: "bg-orange-600 text-white",
    red: "bg-red-600 text-white",
  };

export const marbleButtonSizeClassNames = {
  md: "px-3 py-1.5 text-xs tracking-wide",
  sm: "px-2.5 py-1 text-[11px] tracking-[0.18em]",
} as const;

export type MarbleButtonSize = keyof typeof marbleButtonSizeClassNames;
