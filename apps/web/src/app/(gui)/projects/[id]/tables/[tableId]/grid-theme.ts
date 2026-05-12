import { themeQuartz } from "ag-grid-community";

// AG Grid theme colors. Each entry mirrors a Tailwind v4 zinc token so the
// grid stays in lockstep with the design system. Update both together.
//
// Per AGENTS.md UI rule 13 ("Tokens, not literals"), raw hex literals are
// only acceptable in third-party theme escape hatches (e.g. AG Grid's
// `themeQuartz.withParams(...)`) — which is exactly what this file is.
// Named constants here make the design-system mapping explicit.

const GRID_THEME_COLORS = {
  // zinc-50
  background: "#fafafa",
  // zinc-200
  border: "#e4e4e7",
  // zinc-900
  foreground: "#18181b",
  // zinc-100
  headerBackground: "#f4f4f5",
  // zinc-100 — matches hover row to header surface
  rowHover: "#f4f4f5",
} as const;

export const GRID_CELL_BACKGROUNDS = {
  // zinc-100 — empty editable cell prompt
  editableEmpty: "#f4f4f5",
  // white — editable cell with a value
  editableFilled: "#ffffff",
  // zinc-50 — read-only computed cell
  readonly: "#fafafa",
} as const;

// zinc-500 — row number gutter text color
export const GRID_ROW_NUMBER_COLOR = "#71717a";

export const TABLE_CELL_HORIZONTAL_PADDING_PX = 4;
export const TABLE_CELL_LED_CLEARANCE_PX = 12;
export const TABLE_CELL_LED_GUTTER_PX =
  TABLE_CELL_LED_CLEARANCE_PX + TABLE_CELL_HORIZONTAL_PADDING_PX - 2;

export const gridTheme = themeQuartz.withParams({
  backgroundColor: GRID_THEME_COLORS.background,
  borderColor: GRID_THEME_COLORS.border,
  cellHorizontalPaddingScale: 0.8,
  fontSize: 13,
  foregroundColor: GRID_THEME_COLORS.foreground,
  headerBackgroundColor: GRID_THEME_COLORS.headerBackground,
  headerFontSize: 12,
  headerFontWeight: 500,
  rowHoverColor: GRID_THEME_COLORS.rowHover,
  spacing: 6,
  wrapperBorderRadius: 8,
});
