"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { MarbleRouteProgressBeacon } from "./route-progress";

export type MarbleLinkProps = ComponentProps<typeof Link>;

/**
 * Marble's standard client-side navigation primitive. Drop-in replacement
 * for `next/link` `<Link>` that auto-registers with `<MarbleRouteProgress />`
 * so the top loading bar fires on every click.
 *
 * Always prefer this over raw `<Link>` or `<a href="/...">` for in-app
 * navigation. Naked `<Link>` clicks won't surface in the progress bar, and
 * raw `<a>` tags trigger full document reloads — both regress the SPA UX.
 */
export function MarbleLink({ children, ...props }: MarbleLinkProps) {
  return (
    <Link {...props}>
      <MarbleRouteProgressBeacon />
      {children}
    </Link>
  );
}
