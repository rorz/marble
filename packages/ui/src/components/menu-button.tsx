"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { MarbleButton } from "./button";
import type { marbleButtonInnerVariants } from "./button/styles";
import {
  MarbleContextPopover,
  type MarbleContextPopoverItem,
  type MarbleContextPopoverProps,
  type MarbleContextPopoverSection,
} from "./context-popover";

type MarbleMenuButtonVariantProps = VariantProps<
  typeof marbleButtonInnerVariants
>;

export type MarbleMenuButtonProps = Omit<
  MarbleContextPopoverProps,
  "asChild" | "children" | "content" | "disabled" | "items" | "sections"
> & {
  disabled?: boolean;
  items?: MarbleContextPopoverItem[];
  label: ReactNode;
  sections?: MarbleContextPopoverSection[];
  size?: MarbleMenuButtonVariantProps["size"];
  variant?: MarbleMenuButtonVariantProps["variant"];
};

export const MarbleMenuButton = ({
  align = "end",
  ariaLabel,
  className,
  disabled = false,
  items,
  label,
  sections,
  size,
  variant,
  ...props
}: MarbleMenuButtonProps) => {
  const menuLabel = typeof label === "string" ? label : "button";

  return (
    <MarbleContextPopover
      align={align}
      ariaLabel={ariaLabel ?? `Open ${menuLabel} menu`}
      asChild
      className={className}
      disabled={disabled}
      items={items}
      sections={sections}
      {...props}
    >
      <MarbleButton
        disabled={disabled}
        iconRight={CaretDownIcon}
        size={size}
        variant={variant}
      >
        {label}
      </MarbleButton>
    </MarbleContextPopover>
  );
};
