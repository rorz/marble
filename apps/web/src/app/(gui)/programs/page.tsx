"use client";

import {
  CodeBracketIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  PlayIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import type { editor as MonacoEditorApi } from "monaco-editor";
import dynamic from "next/dynamic";
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
    <div className="flex h-full items-center justify-center text-gray-500 text-sm">
      Loading editor...
    </div>
  ),
  ssr: false,
});

const monacoEditorOptions = {
  automaticLayout: true,
  fontFamily: '"Fira Code", "Courier New", monospace',
  fontLigatures: true,
  fontSize: 13,
  minimap: {
    enabled: false,
  },
  padding: {
    top: 16,
  },
  renderWhitespace: "selection",
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  tabSize: 2,
} satisfies MonacoEditorApi.IStandaloneEditorConstructionOptions;

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

function buildFieldsFromSchema(schema: Record<string, unknown>): {
  key: string;
  type: string;
  title: string;
  enumValues?: string[];
  defaultValue?: string;
}[] {
  const props = (schema?.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  return Object.entries(props).map(([key, def]) => ({
    defaultValue: def.default as string | undefined,
    enumValues: def.enum as string[] | undefined,
    key,
    title: (def.title as string) ?? key,
    type: (def.type as string) ?? "string",
  }));
}

export default function TestProgramsPage() {
  const [programs, setPrograms] = useState<FullProgram[]>([]);
  const [selectedProgId, setSelectedProgId] = useState<string | null>(null);

  // Editor State
  const [files, setFiles] = useState<ProgramFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [progName, setProgName] = useState("");
  const [inputSchemaStr, setInputSchemaStr] = useState("{}");
  const [outputConfigStr, setOutputConfigStr] = useState("{}");

  // Runner State
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

  const loadPrograms = useCallback(async () => {
    const progs = await actions.listPrograms();
    setPrograms(progs);
  }, []);

  useEffect(() => {
    loadPrograms();
  }, [
    loadPrograms,
  ]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) =>
      [
        `[${ts}] ${msg}`,
        ...prev,
      ].slice(0, 50),
    );
  }, []);

  const selectedProgram = programs.find((p) => p.id === selectedProgId);
  const latestVersion = selectedProgram?.program_version?.length
    ? selectedProgram.program_version.sort((a, b) => b.version - a.version)[0]
    : null;

  // Load program into editor
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
    } else {
      setProgName("");
      setFiles([]);
      setActiveFile(null);
    }
  }, [
    selectedProgram,
    latestVersion,
  ]);

  // Load inputs for runner
  useEffect(() => {
    if (latestVersion) {
      const schema = latestVersion.input_schema as Record<string, unknown>;
      const fs = schema ? buildFieldsFromSchema(schema) : [];
      const defaults: Record<string, string> = {};
      for (const f of fs)
        defaults[f.key] = f.defaultValue ?? f.enumValues?.[0] ?? "";
      setInputValues(defaults);
      setManualInput("");
      setResult(null);
    }
  }, [
    latestVersion,
  ]);

  const handleCreateProgram = () => {
    setSelectedProgId(null);
    setProgName("New Program");
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
  };

  const handleAddFile = () => {
    const name = window.prompt(
      "Enter filename (e.g. utils.ts, data.json):",
      "utils.ts",
    );
    if (!name) return;
    const filetype = name.endsWith(".json")
      ? "Json"
      : name.endsWith(".md")
        ? "Markdown"
        : "TypeScript";
    setFiles((prev) => [
      ...prev,
      {
        content: "",
        filename: name,
        filetype,
      },
    ]);
    setActiveFile(name);
  };

  const activeFileObj = files.find((f) => f.filename === activeFile);

  const handleCodeChange = (newCode: string) => {
    if (!activeFile) return;
    setFiles((prev) =>
      prev.map((f) =>
        f.filename === activeFile
          ? {
              ...f,
              content: newCode,
            }
          : f,
      ),
    );
  };

  const handleSave = async () => {
    if (!progName) return window.alert("Program name is required");
    setSaving(true);
    addLog(`Saving program "${progName}"...`);
    try {
      let parsedInput: unknown, parsedOutput: unknown;
      try {
        parsedInput = JSON.parse(inputSchemaStr);
      } catch (_e) {
        throw new Error("Invalid Input Schema JSON");
      }
      try {
        parsedOutput = JSON.parse(outputConfigStr);
      } catch (_e) {
        throw new Error("Invalid Output Config JSON");
      }

      const { programId } = await actions.saveProgramVersion(
        selectedProgId,
        progName,
        parsedInput,
        parsedOutput,
        files,
      );

      addLog(`✓ Saved successfully.`);
      await loadPrograms();
      setSelectedProgId(programId);
    } catch (err) {
      addLog(
        `✗ Save failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!selectedProgId)
      return window.alert("You must save the program first!");
    // we assume the latest version is the one we want to run. If they have unsaved changes, they should save.
    if (!latestVersion)
      return window.alert("No version to run. Please save first.");

    setRunning(true);
    setResult(null);
    addLog(`▶ Running "${progName}" (v${latestVersion.version})...`);

    try {
      const res = await actions.testProgram(
        latestVersion.id,
        inputValues,
        manualInput || undefined,
      );
      setResult(res);
      addLog(res.ok ? `✓ Success` : `✗ Failed: ${res.error}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({
        error: msg,
        ok: false,
        output: null,
      });
      addLog(`✗ Error: ${msg}`);
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
    <div className="flex h-screen overflow-hidden bg-[#1e1e1e] font-sans text-[#d4d4d4]">
      {/* LEFT SIDEBAR */}
      <div className="flex w-64 shrink-0 flex-col border-[#3c3c3c] border-r bg-[#252526]">
        <div className="p-3 font-semibold text-gray-400 text-xs uppercase tracking-wider">
          Programs
        </div>
        <div className="flex-1 overflow-y-auto">
          <button
            className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2a2d2e] ${!selectedProgId ? "bg-[#37373d]" : ""}`}
            onClick={handleCreateProgram}
            type="button"
          >
            <PlusIcon className="h-4 w-4 text-emerald-400" />
            <span className="text-sm">New Program</span>
          </button>
          {programs.map((p) => (
            <button
              className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2a2d2e] ${selectedProgId === p.id ? "bg-[#37373d]" : ""}`}
              key={p.id}
              onClick={() => setSelectedProgId(p.id)}
              type="button"
            >
              <CodeBracketIcon className="h-4 w-4 text-blue-400" />
              <span className="flex-1 truncate text-sm">{p.name}</span>
              {p.program_version?.length > 0 && (
                <span className="text-gray-500 text-xs">
                  v{Math.max(...p.program_version.map((v) => v.version))}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* FILE EXPLORER FOR SELECTED PROGRAM */}
        {(selectedProgId || files.length > 0) && (
          <div className="flex h-1/2 flex-col border-[#3c3c3c] border-t">
            <div className="group flex items-center justify-between p-3">
              <span className="flex items-center gap-1 font-semibold text-gray-400 text-xs uppercase tracking-wider">
                <FolderOpenIcon className="h-4 w-4" /> Workspace
              </span>
              <button
                className="text-gray-400 hover:text-white"
                onClick={handleAddFile}
                title="New File"
                type="button"
              >
                <DocumentPlusIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
              {files.map((f) => (
                <button
                  className={`flex w-full cursor-pointer items-center gap-2 px-6 py-1 text-left hover:bg-[#2a2d2e] ${activeFile === f.filename ? "bg-[#37373d] text-white" : "text-gray-300"}`}
                  key={f.filename}
                  onClick={() => setActiveFile(f.filename)}
                  type="button"
                >
                  <DocumentTextIcon
                    className={`h-4 w-4 ${f.filename.endsWith(".ts") ? "text-blue-400" : f.filename.endsWith(".json") ? "text-yellow-400" : "text-gray-400"}`}
                  />
                  <span className="truncate text-sm">{f.filename}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MIDDLE: EDITOR */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">
        {/* Editor Top Bar */}
        <div className="flex h-10 items-center gap-4 border-[#3c3c3c] border-b bg-[#2d2d2d] px-4">
          <input
            className="bg-transparent font-semibold text-sm placeholder-gray-500 focus:outline-none"
            onChange={(e) => setProgName(e.target.value)}
            placeholder="Program Name..."
            type="text"
            value={progName}
          />
          <div className="flex-1" />
          <button
            className="rounded bg-blue-600 px-3 py-1 text-white text-xs shadow-sm hover:bg-blue-500 disabled:opacity-50"
            disabled={saving}
            onClick={handleSave}
            type="button"
          >
            {saving ? "Saving..." : "Save Version"}
          </button>
        </div>

        {/* File Tabs */}
        {files.length > 0 && (
          <div className="no-scrollbar flex overflow-x-auto border-[#3c3c3c] border-b bg-[#252526]">
            {files.map((f) => (
              <button
                className={`flex cursor-pointer items-center gap-2 border-[#3c3c3c] border-r px-4 py-2 text-sm ${activeFile === f.filename ? "border-t-2 border-t-blue-500 bg-[#1e1e1e] text-white" : "text-gray-400 hover:bg-[#2d2d2d]"}`}
                key={f.filename}
                onClick={() => setActiveFile(f.filename)}
                type="button"
              >
                <DocumentTextIcon className="h-4 w-4" />
                {f.filename}
              </button>
            ))}
            <button
              className="flex cursor-pointer items-center px-4 py-2 text-gray-400 text-sm hover:bg-[#2d2d2d]"
              onClick={handleAddFile}
              type="button"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Code Editor */}
        <div className="relative flex-1 overflow-auto">
          {activeFileObj ? (
            <div className="absolute inset-0">
              <MonacoEditor
                height="100%"
                language={getMonacoLanguage(activeFileObj)}
                loading={
                  <div className="flex h-full items-center justify-center text-gray-500 text-sm">
                    Loading Monaco...
                  </div>
                }
                onChange={(value) => handleCodeChange(value ?? "")}
                options={monacoEditorOptions}
                path={getMonacoModelPath(
                  selectedProgId,
                  activeFileObj.filename,
                )}
                theme="vs-dark"
                value={activeFileObj.content}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              Select or create a file to edit
            </div>
          )}
        </div>

        {/* Bottom Panel: Output / Terminal */}
        <div className="flex h-48 shrink-0 flex-col border-[#3c3c3c] border-t bg-[#1e1e1e]">
          <div className="flex items-center border-[#3c3c3c] border-b px-4 py-1 text-gray-400 text-xs uppercase tracking-wider">
            Output Log
          </div>
          <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
            {log.length === 0 ? (
              <span className="text-gray-600">No output yet...</span>
            ) : (
              log.map((l, i) => (
                <div
                  className={
                    l.includes("✗")
                      ? "text-red-400"
                      : l.includes("✓")
                        ? "text-green-400"
                        : "text-gray-300"
                  }
                  // biome-ignore lint/suspicious/noArrayIndexKey: log
                  key={`${i}-${l.slice(0, 16)}`}
                >
                  {l}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: SETTINGS & RUNNER */}
      <div className="flex w-80 shrink-0 flex-col border-[#3c3c3c] border-l bg-[#252526]">
        <div className="border-[#3c3c3c] border-b p-3 font-semibold text-gray-400 text-xs uppercase tracking-wider">
          Configuration & Test
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Schema Config */}
          <div className="border-[#3c3c3c] border-b p-4">
            <div className="mb-2 font-semibold text-gray-400 text-xs">
              INPUT SCHEMA
            </div>
            <textarea
              className="h-24 w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] p-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
              onChange={(e) => setInputSchemaStr(e.target.value)}
              value={inputSchemaStr}
            />

            <div className="mt-4 mb-2 font-semibold text-gray-400 text-xs">
              OUTPUT CONFIG
            </div>
            <textarea
              className="h-24 w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] p-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
              onChange={(e) => setOutputConfigStr(e.target.value)}
              value={outputConfigStr}
            />
          </div>

          {/* Test Runner */}
          <div className="p-4">
            <div className="mb-3 font-semibold text-gray-400 text-xs">
              TEST INPUTS
            </div>

            {fields.length === 0 && (
              <div className="mb-2 text-gray-500 text-xs italic">
                No inputs required.
              </div>
            )}

            {fields.map((f) => (
              <div
                className="mb-3"
                key={f.key}
              >
                <label
                  className="mb-1 block text-gray-300 text-xs"
                  htmlFor={`input-${f.key}`}
                >
                  {f.title}
                </label>
                {f.enumValues ? (
                  <select
                    className="w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2 py-1 text-sm outline-none focus:border-blue-500"
                    id={`input-${f.key}`}
                    onChange={(e) =>
                      setInputValues((p) => ({
                        ...p,
                        [f.key]: e.target.value,
                      }))
                    }
                    value={inputValues[f.key] ?? ""}
                  >
                    {f.enumValues.map((v) => (
                      <option
                        key={v}
                        value={v}
                      >
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2 py-1 text-sm outline-none focus:border-blue-500"
                    id={`input-${f.key}`}
                    onChange={(e) =>
                      setInputValues((p) => ({
                        ...p,
                        [f.key]: e.target.value,
                      }))
                    }
                    type="text"
                    value={inputValues[f.key] ?? ""}
                  />
                )}
              </div>
            ))}

            {hasManualInput && (
              <div className="mb-3">
                <label
                  className="mb-1 block text-gray-300 text-xs"
                  htmlFor="manual-input"
                >
                  Manual Cell Input
                </label>
                <input
                  className="w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2 py-1 text-sm outline-none focus:border-blue-500"
                  id="manual-input"
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Cell value..."
                  type="text"
                  value={manualInput}
                />
              </div>
            )}

            <button
              className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 text-white shadow transition-colors hover:bg-emerald-500 disabled:opacity-50"
              disabled={running || !latestVersion}
              onClick={handleRun}
              type="button"
            >
              <PlayIcon className="h-4 w-4" />
              {running ? "Running..." : "Run Program"}
            </button>

            {result && (
              <div className="mt-4 rounded border border-[#3c3c3c] bg-[#1e1e1e]">
                <div
                  className={`border-[#3c3c3c] border-b px-3 py-1.5 font-semibold text-xs ${result.ok ? "text-green-400" : "text-red-400"}`}
                >
                  {result.ok ? "Success" : "Error"}
                </div>
                <div className="max-h-48 overflow-auto break-words p-3 font-mono text-xs">
                  {result.ok
                    ? JSON.stringify(result.output, null, 2)
                    : result.error}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
