import dynamic from "next/dynamic";
import type { RightWorkbenchPanelId } from "./types";

export const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

export const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  loading: () => (
    <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
      Loading editor...
    </div>
  ),
  ssr: false,
});

export const shellPanelClassName =
  "bg-taupe-300 border-taupe-400 inset-shadow-2xs inset-shadow-white/45";
export const editorTabBaseClassName =
  "group flex h-10 shrink-0 items-center gap-2 border-r border-taupe-300 px-3 text-[12px] transition-colors";
export const editorTabActiveClassName =
  "bg-white text-taupe-950 shadow-marble-stripe-top";
export const editorTabIdleClassName =
  "bg-taupe-100/70 text-taupe-600 hover:bg-taupe-50 hover:text-taupe-900";
export const compactSidebarRowClassName =
  "flex h-7 w-full items-center gap-1.5 rounded-sm px-1.5 text-left font-mono text-[11px] transition-colors";
export const compactSidebarRowActiveClassName =
  "bg-white/95 text-taupe-950 shadow-marble-stripe-left";
export const compactSidebarRowIdleClassName =
  "text-taupe-700 hover:bg-white/70 hover:text-taupe-950";
export const importAccept =
  ".ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonc,.md,.markdown,.txt";
export const rightPanelDefaultHeights = {
  secrets: 176,
  testInputs: 320,
} satisfies Record<RightWorkbenchPanelId, number>;
export const stackedWorkbenchSectionClassName =
  "rounded-none border-x-0 border-t-0 bg-transparent shadow-none";
export const stackedWorkbenchHeaderClassName = "px-3 py-1.5 bg-transparent";
export const stackedWorkbenchBodyClassName = "bg-white/92";

export const monacoEditorOptions = {
  automaticLayout: true,
  fontFamily:
    '"Geist Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: 12,
  lineNumbersMinChars: 3,
  minimap: {
    enabled: false,
  },
  padding: {
    top: 12,
  },
  renderWhitespace: "selection",
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  tabSize: 2,
} satisfies import("monaco-editor").editor.IStandaloneEditorConstructionOptions;
