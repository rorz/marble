import { cx } from "@marble/ui";
import type { ReactNode, SVGProps } from "react";

export type BrandGlyphProps = {
  size?: number;
  className?: string;
};

export const GlyphBase = ({
  size = 24,
  className,
  children,
  ...rest
}: BrandGlyphProps &
  SVGProps<SVGSVGElement> & {
    children: ReactNode;
  }) => {
  return (
    <svg
      aria-hidden="true"
      className={cx("inline-block shrink-0", className)}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {children}
    </svg>
  );
};
