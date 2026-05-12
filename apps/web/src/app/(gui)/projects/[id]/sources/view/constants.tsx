import dynamic from "next/dynamic";

export const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

export const DEFAULT_SOURCE_SCHEMA_TEXT = JSON.stringify(
  {
    type: "object",
  },
  null,
  2,
);

export const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  loading: () => (
    <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
      Loading editor...
    </div>
  ),
  ssr: false,
});

export const sourceSchemaEditorOptions = {
  automaticLayout: true,
  fontFamily:
    '"Geist Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: 13,
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
