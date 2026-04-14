import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../utils/cx";

const marbleButtonBackgrounds = {
  dark: `
    linear-gradient(120deg, var(--color-white) 0%, #40404000 10%),
    linear-gradient(to right, var(--color-neutral-500) 0px, #40404000 4px),
    linear-gradient(to left, var(--color-neutral-800) 0px, #40404000 4px),
    linear-gradient(to top, var(--color-neutral-950) 0px, #40404000 4px),
    linear-gradient(to bottom, var(--color-neutral-400) 0px, #40404000 4px),linear-gradient(to right, var(--color-neutral-600) 0%, var(--color-neutral-600) 100%)`,
  light: `
    linear-gradient(120deg, var(--color-white) 0px, #e5e5e500 10%),
    linear-gradient(to right, var(--color-neutral-100) 0px, #e5e5e500 4px),
    linear-gradient(to left, var(--color-neutral-300) 0px, #e5e5e500 4px),
    linear-gradient(to top, var(--color-neutral-300) 0px, #e5e5e500 4px),
    linear-gradient(to bottom, var(--color-neutral-100) 0px, #e5e5e500 4px),linear-gradient(to right, var(--color-neutral-200) 0%, var(--color-neutral-200) 100%)`,
  orange: `
    linear-gradient(120deg, var(--color-white) 0px, #f6490000 10%),
    linear-gradient(to left, var(--color-orange-800) 0px, #f6490000 4px),
    linear-gradient(to top, var(--color-orange-950) 0px, #f6490000 4px),
    linear-gradient(to bottom, var(--color-orange-300) 0px, #f6490000 4px),
    linear-gradient(to right, var(--color-orange-600) 0%, var(--color-orange-600) 100%)`,
  red: `
    linear-gradient(120deg, var(--color-white) 0px, #dc262600 10%),
    linear-gradient(to right, var(--color-red-300) 0px, #dc262600 4px),
    linear-gradient(to left, var(--color-red-800) 0px, #dc262600 4px),
    linear-gradient(to top, var(--color-red-950) 0px, #dc262600 4px),
    linear-gradient(to bottom, var(--color-red-300) 0px, #dc262600 4px),
    linear-gradient(to right, var(--color-red-600) 0%, var(--color-red-600) 100%)`,
} as const;

export const marbleButtonRootVariants = cva(
  "rounded-xs bg-neutral-900 p-0.5 transition-opacity",
  {
    variants: {
      disabled: {
        false: "cursor-pointer hover:opacity-90",
        true: "cursor-not-allowed opacity-40",
      },
    },
  },
);

export const marbleButtonBorderVariants = cva("size-full rounded-md p-px", {
  defaultVariants: {
    variant: "light",
  },
  variants: {
    variant: {
      dark: "bg-neutral-700",
      light: "bg-neutral-200",
      orange: "bg-orange-600",
      red: "bg-red-600",
    },
  },
});

export const marbleButtonInnerVariants = cva(
  "size-full rounded-[5px] flex items-center justify-center font-medium uppercase",
  {
    defaultVariants: {
      size: "md",
      variant: "light",
    },
    variants: {
      size: {
        md: "px-3 py-1.5 text-xs tracking-wide",
        sm: "px-2.5 py-1 text-[11px] tracking-[0.18em]",
      },
      variant: {
        dark: "bg-neutral-700 text-neutral-100 font-light",
        light: "bg-neutral-200 text-neutral-900 shadow-sm font-regular",
        orange: "bg-orange-600 text-white",
        red: "bg-red-600 text-white",
      },
    },
  },
);

export type MarbleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof marbleButtonInnerVariants>;

export function MarbleButton({
  children,
  className,
  disabled = false,
  size,
  type = "button",
  variant,
  ...props
}: MarbleButtonProps) {
  const resolvedVariant = variant ?? "light";

  return (
    <button
      className={cx(
        marbleButtonRootVariants({
          disabled,
        }),
        className,
      )}
      disabled={disabled}
      type={type}
      {...props}
    >
      <div
        className={marbleButtonBorderVariants({
          variant: resolvedVariant,
        })}
        style={{
          background: marbleButtonBackgrounds[resolvedVariant],
        }}
      >
        <div
          className={marbleButtonInnerVariants({
            size,
            variant,
          })}
        >
          {children}
        </div>
      </div>
    </button>
  );
}
