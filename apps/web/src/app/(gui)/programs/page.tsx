"use client";

import {
  CodeBracketIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  PlayIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { cx } from "@marble/ui";
import type { editor as MonacoEditorApi } from "monaco-editor";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import * as actions from "./actions";

type FullProgram = Awaited<ReturnType<typeof actions.listPrograms>>[number];
type ProgramFile = {
  filename: string;
  content: string;
  filetype: "TypeScript" | "Json" | "Markdown";
};
type MonacoLanguage = "typescript" | "json" | "markdown";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  loading: () => (
    <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
      Loading editor...
    </div>
  ),
  ssr: false,
});

const chromeButtonClassName =
  "inline-flex h-7 items-center justify-center rounded-sm border border-[#d8cfbf] bg-[#fffdf8] px-2.5 font-medium text-[#5f5348] text-[11px] uppercase tracking-[0.18em] transition-colors hover:bg-[#fff4e7] hover:text-[#9a4d10] disabled:cursor-not-allowed disabled:opacity-50";
const chromeFieldClassName =
  "w-full rounded-sm border border-taupe-300 bg-taupe-100 px-2 py-1.5 text-taupe-900 text-xs outline-none transition-colors placeholder:text-taupe-500 focus:border-taupe-500 focus:bg-white";
const chromeHeaderLabelClassName =
  "font-medium text-taupe-600 text-[11px] uppercase tracking-[0.18em]";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-sm border border-[#f0b47b] bg-[#fff1e2] font-medium text-[#9a4d10] text-[11px] uppercase tracking-[0.18em] transition-colors hover:bg-[#ffe7cf] disabled:cursor-not-allowed disabled:opacity-50";
const sidebarHeaderLabelClassName =
  "font-medium text-[11px] text-taupe-700 uppercase tracking-[0.18em]";
const sidebarPanelClassName =
  "bg-taupe-300 border-taupe-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]";
const sidebarItemBaseClassName =
  "flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left text-sm transition-colors";
const sidebarItemIdleClassName =
  "text-taupe-700 hover:bg-taupe-200/85 hover:text-taupe-950";
const sidebarItemActiveClassName =
  "bg-white/85 text-taupe-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]";

const monacoEditorOptions = {
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
} satisfies MonacoEditorApi.IStandaloneEditorConstructionOptions;

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getMonacoLanguage(file: ProgramFile): MonacoLanguage {
  if (file.filetype === "Json" || file.filename.endsWith(".json")) {
    return "json";
  }

  if (file.filetype === "Markdown" || file.filename.endsWith(".md")) {
    return "markdown";
  }

  return "typescript";
}

function getMonacoModelPath(programId: string | null, filename: string) {
  return `inmemory://model/${programId ?? "__draft__"}/${filename}`;
}

function getLatestVersion(program: FullProgram | undefined) {
  if (!program?.program_version?.length) {
    return null;
  }

  return [
    ...program.program_version,
  ].sort((left, right) => right.version - left.version)[0];
}

function getFileAccent(filename: string) {
  if (filename.endsWith(".json")) {
    return "text-amber-600";
  }

  if (filename.endsWith(".md")) {
    return "text-zinc-500";
  }

  return "text-sky-600";
}

function buildFieldsFromSchema(schema: Record<string, unknown>): {
  key: string;
  type: string;
  title: string;
  enumValues?: string[];
  defaultValue?: string;
}[] {
  const properties = (schema?.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  return Object.entries(properties).map(([key, definition]) => ({
    defaultValue: definition.default as string | undefined,
    enumValues: definition.enum as string[] | undefined,
    key,
    title: (definition.title as string) ?? key,
    type: (definition.type as string) ?? "string",
  }));
}

function CompactBadge({
  children,
  tone = "neutral",
}: Readonly<{
  children: React.ReactNode;
  tone?: "neutral" | "orange";
}>) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.18em]",
        tone === "neutral" && "border-taupe-300 bg-taupe-100 text-taupe-700",
        tone === "orange" && "border-taupe-500 bg-taupe-200 text-taupe-900",
      )}
    >
      {children}
    </span>
  );
}

function ProgramRow({
  active,
  onSelect,
  program,
}: Readonly<{
  active: boolean;
  onSelect: () => void;
  program: FullProgram;
}>) {
  const latestVersion = getLatestVersion(program);

  return (
    <button
      aria-pressed={active}
      className={cx(
        sidebarItemBaseClassName,
        active ? sidebarItemActiveClassName : sidebarItemIdleClassName,
      )}
      onClick={onSelect}
      type="button"
    >
      <CodeBracketIcon className="h-4 w-4 shrink-0 text-taupe-500" />
      <span className="flex-1 truncate">
        {program.name || "Untitled Program"}
      </span>
      {latestVersion ? (
        <span className="font-mono text-[11px] text-taupe-500">
          v{latestVersion.version}
        </span>
      ) : null}
    </button>
  );
}

function FileRow({
  active,
  file,
  onSelect,
}: Readonly<{
  active: boolean;
  file: ProgramFile;
  onSelect: () => void;
}>) {
  return (
    <button
      aria-pressed={active}
      className={cx(
        sidebarItemBaseClassName,
        "px-5",
        active ? sidebarItemActiveClassName : sidebarItemIdleClassName,
      )}
      onClick={onSelect}
      type="button"
    >
      <DocumentTextIcon
        className={cx("h-4 w-4 shrink-0", getFileAccent(file.filename))}
      />
      <span className="flex-1 truncate">{file.filename}</span>
    </button>
  );
}

export default function ProgramsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [programs, setPrograms] = useState<FullProgram[]>([]);

  // Editor state
  const [files, setFiles] = useState<ProgramFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [progName, setProgName] = useState("");
  const [inputSchemaStr, setInputSchemaStr] = useState("{}");
  const [outputConfigStr, setOutputConfigStr] = useState("{}");

  // Runner state
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    output: unknown;
    error?: string;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const selectedProgId = searchParams.get("programId");
  const selectedProgram = programs.find(
    (program) => program.id === selectedProgId,
  );
  const latestVersion = getLatestVersion(selectedProgram);

  const loadPrograms = useCallback(async () => {
    const nextPrograms = await actions.listPrograms();
    setPrograms(nextPrograms);
  }, []);

  useEffect(() => {
    void loadPrograms();
  }, [
    loadPrograms,
  ]);

  const selectProgram = useCallback(
    (programId: string | null) => {
      router.replace(
        programId ? `${pathname}?programId=${programId}` : pathname,
      );
    },
    [
      pathname,
      router,
    ],
  );

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog((current) =>
      [
        `[${timestamp}] ${message}`,
        ...current,
      ].slice(0, 50),
    );
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      setProgName(selectedProgram.name);

      if (latestVersion) {
        setFiles(latestVersion.program_file || []);
        setActiveFile(latestVersion.program_file?.[0]?.filename || null);
        setInputSchemaStr(JSON.stringify(latestVersion.input_schema, null, 2));
        setOutputConfigStr(
          JSON.stringify(latestVersion.output_config, null, 2),
        );
      } else {
        setFiles([]);
        setActiveFile(null);
        setInputSchemaStr("{}");
        setOutputConfigStr("{}");
      }

      return;
    }

    setProgName("");
    setFiles([]);
    setActiveFile(null);
    setInputSchemaStr("{}");
    setOutputConfigStr("{}");
  }, [
    latestVersion,
    selectedProgram,
  ]);

  useEffect(() => {
    if (latestVersion) {
      const schema = latestVersion.input_schema as Record<string, unknown>;
      const fields = buildFieldsFromSchema(schema);
      const defaults: Record<string, string> = {};

      for (const field of fields) {
        defaults[field.key] = field.defaultValue ?? field.enumValues?.[0] ?? "";
      }

      setInputValues(defaults);
      setManualInput("");
      setResult(null);
      return;
    }

    setInputValues({});
    setManualInput("");
    setResult(null);
  }, [
    latestVersion,
  ]);

  const handleCreateProgram = () => {
    selectProgram(null);
    setProgName("Untitled Program");
    setFiles([
      {
        content:
          "export default async function run(input) {\n  return { ok: true, value: input };\n}",
        filename: "main.ts",
        filetype: "TypeScript",
      },
    ]);
    setActiveFile("main.ts");
    setInputSchemaStr(
      JSON.stringify(
        {
          properties: {
            param1: {
              type: "string",
            },
          },
          type: "object",
        },
        null,
        2,
      ),
    );
    setOutputConfigStr(
      JSON.stringify(
        {
          schema: {
            type: "object",
          },
        },
        null,
        2,
      ),
    );
    setLog([]);
    setResult(null);
  };

  const handleAddFile = () => {
    const filename = window.prompt(
      "Enter filename (e.g. utils.ts, data.json):",
      "utils.ts",
    );

    if (!filename) {
      return;
    }

    const filetype = filename.endsWith(".json")
      ? "Json"
      : filename.endsWith(".md")
        ? "Markdown"
        : "TypeScript";

    setFiles((current) => [
      ...current,
      {
        content: "",
        filename,
        filetype,
      },
    ]);
    setActiveFile(filename);
  };

  const activeFileObj = files.find((file) => file.filename === activeFile);

  const handleCodeChange = (newCode: string) => {
    if (!activeFile) {
      return;
    }

    setFiles((current) =>
      current.map((file) =>
        file.filename === activeFile
          ? {
              ...file,
              content: newCode,
            }
          : file,
      ),
    );
  };

  const handleSave = async () => {
    if (!progName.trim()) {
      window.alert("Program name is required");
      return;
    }

    setSaving(true);
    addLog(`Saving program "${progName}"...`);

    try {
      let parsedInput: unknown;
      let parsedOutput: unknown;

      try {
        parsedInput = JSON.parse(inputSchemaStr);
      } catch {
        throw new Error("Invalid Input Schema JSON");
      }

      try {
        parsedOutput = JSON.parse(outputConfigStr);
      } catch {
        throw new Error("Invalid Output Config JSON");
      }

      const { programId } = await actions.saveProgramVersion(
        selectedProgId,
        progName,
        parsedInput,
        parsedOutput,
        files,
      );

      addLog("✓ Saved successfully.");
      await loadPrograms();
      selectProgram(programId);
    } catch (error) {
      addLog(
        `✗ Save failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!selectedProgId) {
      window.alert("You must save the program first.");
      return;
    }

    if (!latestVersion) {
      window.alert("No version to run. Please save first.");
      return;
    }

    setRunning(true);
    setResult(null);
    addLog(`▶ Running "${progName}" (v${latestVersion.version})...`);

    try {
      const nextResult = await actions.testProgram(
        latestVersion.id,
        inputValues,
        manualInput || undefined,
      );

      setResult(nextResult);
      addLog(nextResult.ok ? "✓ Success" : `✗ Failed: ${nextResult.error}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setResult({
        error: message,
        ok: false,
        output: null,
      });
      addLog(`✗ Error: ${message}`);
    } finally {
      setRunning(false);
    }
  };

  const fields = latestVersion
    ? buildFieldsFromSchema(
        latestVersion.input_schema as Record<string, unknown>,
      )
    : [];
  const hasManualInput =
    latestVersion &&
    (
      (latestVersion.output_config as Record<string, unknown>)?.flags as
        | Record<string, unknown>
        | undefined
    )?.allowManualInput === true;

  return (
    <div
      className="flex size-full min-h-0 overflow-hidden bg-[linear-gradient(180deg,#f8f5ee_0%,#f4efe6_100%)] text-zinc-800 border-taupe-400 border-2 overflow-hidden rounded-md shadow-xl"
      style={{
        colorScheme: "light",
      }}
    >
      <div
        className={cx(
          "flex w-60 shrink-0 flex-col border-r",
          sidebarPanelClassName,
        )}
      >
        <div className="flex items-center border-b border-taupe-400 px-3 py-2">
          <span className={sidebarHeaderLabelClassName}>Programs</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <button
            className={cx(
              sidebarItemBaseClassName,
              !selectedProgId && files.length > 0
                ? sidebarItemActiveClassName
                : sidebarItemIdleClassName,
            )}
            onClick={handleCreateProgram}
            type="button"
          >
            <PlusIcon className="h-4 w-4 shrink-0 text-taupe-500" />
            <span className="truncate">New Program</span>
          </button>

          {programs.map((program) => (
            <ProgramRow
              active={selectedProgId === program.id}
              key={program.id}
              onSelect={() => selectProgram(program.id)}
              program={program}
            />
          ))}
        </div>

        {selectedProgId || files.length > 0 ? (
          <div className="flex min-h-0 basis-[42%] flex-col border-t border-taupe-400">
            <div className="flex items-center justify-between px-3 py-2">
              <span
                className={cx(
                  sidebarHeaderLabelClassName,
                  "flex items-center gap-1.5",
                )}
              >
                <FolderOpenIcon className="h-4 w-4" />
                Workspace
              </span>
              <button
                className="text-taupe-600 transition-colors hover:text-taupe-900"
                onClick={handleAddFile}
                title="New File"
                type="button"
              >
                <DocumentPlusIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-2">
              {files.map((file) => (
                <FileRow
                  active={activeFile === file.filename}
                  file={file}
                  key={file.filename}
                  onSelect={() => setActiveFile(file.filename)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-taupe-50">
        <div className="flex h-9 items-center gap-2 border-b border-taupe-200 bg-taupe-100 px-3">
          <input
            className="h-7 min-w-0 flex-1 rounded-sm border border-taupe-300 bg-taupe-50 px-2 font-medium text-sm text-taupe-900 outline-none transition-colors placeholder:text-taupe-500 focus:border-taupe-500 focus:bg-white"
            onChange={(event) => setProgName(event.target.value)}
            placeholder="Program Name..."
            type="text"
            value={progName}
          />

          {selectedProgram?.first_party ? (
            <CompactBadge tone="orange">Built-in</CompactBadge>
          ) : null}
          {latestVersion ? (
            <CompactBadge>v{latestVersion.version}</CompactBadge>
          ) : null}
          {files.length > 0 ? (
            <CompactBadge>{countLabel(files.length, "file")}</CompactBadge>
          ) : null}

          <button
            className={chromeButtonClassName}
            disabled={saving || !progName.trim() || files.length === 0}
            onClick={handleSave}
            type="button"
          >
            {saving ? "Saving..." : "Save Version"}
          </button>
        </div>

        {files.length > 0 ? (
          <div className="flex h-8 overflow-x-auto border-b border-taupe-200 bg-taupe-100">
            {files.map((file) => (
              <button
                className={cx(
                  "flex items-center gap-2 border-r border-taupe-200 px-3 text-xs transition-colors",
                  activeFile === file.filename
                    ? "border-t-2 border-t-taupe-500 bg-white text-taupe-900"
                    : "text-taupe-600 hover:bg-taupe-200",
                )}
                key={file.filename}
                onClick={() => setActiveFile(file.filename)}
                type="button"
              >
                <DocumentTextIcon
                  className={cx("h-4 w-4", getFileAccent(file.filename))}
                />
                <span className="max-w-40 truncate">{file.filename}</span>
              </button>
            ))}

            <button
              className="flex items-center px-3 text-taupe-600 text-xs transition-colors hover:bg-taupe-200 hover:text-taupe-900"
              onClick={handleAddFile}
              type="button"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="relative flex-1 overflow-hidden bg-white">
          {activeFileObj ? (
            <div className="absolute inset-0">
              <MonacoEditor
                height="100%"
                language={getMonacoLanguage(activeFileObj)}
                loading={
                  <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
                    Loading Monaco...
                  </div>
                }
                onChange={(value) => handleCodeChange(value ?? "")}
                options={monacoEditorOptions}
                path={getMonacoModelPath(
                  selectedProgId,
                  activeFileObj.filename,
                )}
                theme="vs"
                value={activeFileObj.content}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
              Select or create a file to edit.
            </div>
          )}
        </div>

        <div className="flex h-36 shrink-0 flex-col border-t border-taupe-200 bg-taupe-50">
          <div className="border-b border-taupe-200 px-3 py-2">
            <span className={chromeHeaderLabelClassName}>Output Log</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-5">
            {log.length === 0 ? (
              <span className="text-taupe-500">No output yet...</span>
            ) : (
              log.map((entry, index) => (
                <div
                  className={cx(
                    entry.includes("✗")
                      ? "text-red-600"
                      : entry.includes("✓")
                        ? "text-emerald-700"
                        : "text-taupe-800",
                  )}
                  // biome-ignore lint/suspicious/noArrayIndexKey: log entries are append-only UI state
                  key={`${index}-${entry.slice(0, 16)}`}
                >
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div
        className={cx(
          "flex w-80 shrink-0 flex-col border-l",
          sidebarPanelClassName,
        )}
      >
        <div className="flex items-center border-b border-taupe-400 px-3 py-2">
          <span className={sidebarHeaderLabelClassName}>
            Configuration & Test
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-taupe-400 p-3">
            <div className="mb-2">
              <span className={sidebarHeaderLabelClassName}>Input Schema</span>
            </div>
            <textarea
              className={cx(chromeFieldClassName, "h-28 resize-y font-mono")}
              onChange={(event) => setInputSchemaStr(event.target.value)}
              value={inputSchemaStr}
            />

            <div className="mt-4 mb-2">
              <span className={sidebarHeaderLabelClassName}>Output Config</span>
            </div>
            <textarea
              className={cx(chromeFieldClassName, "h-28 resize-y font-mono")}
              onChange={(event) => setOutputConfigStr(event.target.value)}
              value={outputConfigStr}
            />
          </div>

          <div className="p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className={sidebarHeaderLabelClassName}>Test Inputs</span>
              {selectedProgram?.first_party ? (
                <CompactBadge tone="orange">Built-in</CompactBadge>
              ) : null}
            </div>

            {fields.length === 0 ? (
              <div className="mb-3 text-taupe-600 text-xs italic">
                No inputs required.
              </div>
            ) : null}

            {fields.map((field) => (
              <div
                className="mb-3"
                key={field.key}
              >
                <label
                  className="mb-1 block text-taupe-800 text-xs"
                  htmlFor={`input-${field.key}`}
                >
                  {field.title}
                </label>
                {field.enumValues ? (
                  <select
                    className={chromeFieldClassName}
                    id={`input-${field.key}`}
                    onChange={(event) =>
                      setInputValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    value={inputValues[field.key] ?? ""}
                  >
                    {field.enumValues.map((value) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={chromeFieldClassName}
                    id={`input-${field.key}`}
                    onChange={(event) =>
                      setInputValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    type={field.type === "number" ? "number" : "text"}
                    value={inputValues[field.key] ?? ""}
                  />
                )}
              </div>
            ))}

            {hasManualInput ? (
              <div className="mb-3">
                <label
                  className="mb-1 block text-taupe-800 text-xs"
                  htmlFor="manual-input"
                >
                  Manual Cell Input
                </label>
                <input
                  className={chromeFieldClassName}
                  id="manual-input"
                  onChange={(event) => setManualInput(event.target.value)}
                  placeholder="Cell value..."
                  type="text"
                  value={manualInput}
                />
              </div>
            ) : null}

            <button
              className={cx(primaryButtonClassName, "mt-1 h-8 w-full gap-2")}
              disabled={running || !latestVersion}
              onClick={handleRun}
              type="button"
            >
              <PlayIcon className="h-4 w-4" />
              {running ? "Running..." : "Run Program"}
            </button>

            {result ? (
              <div className="mt-4 overflow-hidden rounded-sm border border-taupe-300 bg-taupe-50">
                <div
                  className={cx(
                    "border-b border-taupe-200 px-3 py-1.5 font-medium text-[11px] uppercase tracking-[0.18em]",
                    result.ok ? "text-emerald-700" : "text-red-600",
                  )}
                >
                  {result.ok ? "Success" : "Error"}
                </div>
                <div className="max-h-48 overflow-auto break-words px-3 py-2 font-mono text-[11px] leading-5 text-taupe-800">
                  {result.ok
                    ? JSON.stringify(result.output, null, 2)
                    : result.error}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
