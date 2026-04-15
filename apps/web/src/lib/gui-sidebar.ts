export type SidebarMode = "collapsed" | "expanded";

export const COLLAPSED_SIDEBAR_WIDTH = 44;
export const DEFAULT_SIDEBAR_WIDTH = 260;
export const MIN_SIDEBAR_WIDTH = 190;
export const MAX_SIDEBAR_WIDTH = 380;

export function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function parseSidebarWidth(value: null | string | undefined) {
  if (!value) {
    return DEFAULT_SIDEBAR_WIDTH;
  }

  const width = Number(value);

  return Number.isFinite(width)
    ? clampSidebarWidth(width)
    : DEFAULT_SIDEBAR_WIDTH;
}
