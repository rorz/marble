import { cx } from "@marble/ui";
import type { ReactNode } from "react";

/**
 * Footer grid primitives — a wide responsive grid of link columns.
 */

type MarketingFooterGridProps = {
  children: ReactNode;
  className?: string;
};

export const MarketingFooterGrid = ({
  children,
  className,
}: MarketingFooterGridProps) => {
  return (
    <div
      className={cx(
        "grid grid-cols-2 gap-10 md:grid-cols-4 md:gap-12",
        className,
      )}
    >
      {children}
    </div>
  );
};

type MarketingFooterColumnProps = {
  heading: ReactNode;
  links: Array<{
    label: ReactNode;
    href: string;
    external?: boolean;
  }>;
  className?: string;
};

export const MarketingFooterColumn = ({
  heading,
  links,
  className,
}: MarketingFooterColumnProps) => {
  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <span className="font-mono text-eyebrow opacity-60">{heading}</span>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <a
              className="text-base text-current/80 transition-colors hover:text-orange-400 md:text-lg"
              href={link.href}
              rel={link.external ? "noreferrer" : undefined}
              target={link.external ? "_blank" : undefined}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
