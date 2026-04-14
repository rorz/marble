import type { ButtonHTMLAttributes } from "react";
import { cx } from "../internal/cx";
import {
  type MarbleButtonSize,
  type MarbleButtonVariant,
  marbleButtonBackgrounds,
  marbleButtonBorderClassNames,
  marbleButtonInnerClassNames,
  marbleButtonSizeClassNames,
} from "../themes/button";

export type MarbleButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: MarbleButtonSize;
  variant?: MarbleButtonVariant;
};

export function MarbleButton({
  children,
  className,
  disabled,
  size = "md",
  type = "button",
  variant = "light",
  ...props
}: MarbleButtonProps) {
  return (
    <button
      className={cx(
        "rounded-[7px] bg-neutral-950 p-0.5 transition-opacity",
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:opacity-90",
        className,
      )}
      disabled={disabled}
      type={type}
      {...props}
    >
      <div
        className={cx(
          "size-full rounded-md p-[1px]",
          marbleButtonBorderClassNames[variant],
        )}
        style={{
          background: marbleButtonBackgrounds[variant],
        }}
      >
        <div
          className={cx(
            "size-full rounded-[5px] font-medium uppercase",
            "flex items-center justify-center",
            marbleButtonInnerClassNames[variant],
            marbleButtonSizeClassNames[size],
          )}
        >
          {children}
        </div>
      </div>
    </button>
  );
}
