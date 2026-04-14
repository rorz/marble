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
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
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
    <div className="flex h-screen bg-[#1e1e1e] text-[#d4d4d4] font-sans overflow-hidden">
      {/* LEFT SIDEBAR */}
      <div className="w-64 bg-[#252526] border-r border-[#3c3c3c] flex flex-col shrink-0">
        <div className="p-3 uppercase text-xs font-semibold tracking-wider text-gray-400">
          Programs
        </div>
        <div className="flex-1 overflow-y-auto">
          <button
            type="button"
            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-[#2a2d2e] ${!selectedProgId ? "bg-[#37373d]" : ""}`}
            onClick={handleCreateProgram}
          >
            <PlusIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-sm">New Program</span>
          </button>
          {programs.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-[#2a2d2e] ${selectedProgId === p.id ? "bg-[#37373d]" : ""}`}
              onClick={() => setSelectedProgId(p.id)}
            >
              <CodeBracketIcon className="w-4 h-4 text-blue-400" />
              <span className="text-sm truncate flex-1">{p.name}</span>
              {p.program_version?.length > 0 && (
                <span className="text-xs text-gray-500">
                  v{Math.max(...p.program_version.map((v) => v.version))}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* FILE EXPLORER FOR SELECTED PROGRAM */}
        {(selectedProgId || files.length > 0) && (
          <div className="h-1/2 border-t border-[#3c3c3c] flex flex-col">
            <div className="p-3 flex items-center justify-between group">
              <span className="uppercase text-xs font-semibold tracking-wider text-gray-400 flex items-center gap-1">
                <FolderOpenIcon className="w-4 h-4" /> Workspace
              </span>
              <button
                type="button"
                onClick={handleAddFile}
                className="text-gray-400 hover:text-white"
                title="New File"
              >
                <DocumentPlusIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
              {files.map((f) => (
                <button
                  type="button"
                  key={f.filename}
                  className={`w-full text-left px-6 py-1 flex items-center gap-2 cursor-pointer hover:bg-[#2a2d2e] ${activeFile === f.filename ? "bg-[#37373d] text-white" : "text-gray-300"}`}
                  onClick={() => setActiveFile(f.filename)}
                >
                  <DocumentTextIcon
                    className={`w-4 h-4 ${f.filename.endsWith(".ts") ? "text-blue-400" : f.filename.endsWith(".json") ? "text-yellow-400" : "text-gray-400"}`}
                  />
                  <span className="text-sm truncate">{f.filename}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MIDDLE: EDITOR */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        {/* Editor Top Bar */}
        <div className="h-10 bg-[#2d2d2d] flex items-center px-4 border-b border-[#3c3c3c] gap-4">
          <input
            type="text"
            value={progName}
            onChange={(e) => setProgName(e.target.value)}
            className="bg-transparent text-sm font-semibold focus:outline-none placeholder-gray-500"
            placeholder="Program Name..."
          />
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded shadow-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Version"}
          </button>
        </div>

        {/* File Tabs */}
        {files.length > 0 && (
          <div className="flex bg-[#252526] overflow-x-auto no-scrollbar border-b border-[#3c3c3c]">
            {files.map((f) => (
              <button
                type="button"
                key={f.filename}
                className={`px-4 py-2 text-sm cursor-pointer border-r border-[#3c3c3c] flex items-center gap-2 ${activeFile === f.filename ? "bg-[#1e1e1e] text-white border-t-2 border-t-blue-500" : "text-gray-400 hover:bg-[#2d2d2d]"}`}
                onClick={() => setActiveFile(f.filename)}
              >
                <DocumentTextIcon className="w-4 h-4" />
                {f.filename}
              </button>
            ))}
            <button
              type="button"
              className="px-4 py-2 text-sm text-gray-400 hover:bg-[#2d2d2d] cursor-pointer flex items-center"
              onClick={handleAddFile}
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Code Editor */}
        <div className="flex-1 overflow-auto relative">
          {activeFileObj ? (
            <div className="absolute inset-0">
              <MonacoEditor
                height="100%"
                language={getMonacoLanguage(activeFileObj)}
                loading={
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    Loading Monaco...
                  </div>
                }
                options={monacoEditorOptions}
                path={getMonacoModelPath(
                  selectedProgId,
                  activeFileObj.filename,
                )}
                theme="vs-dark"
                value={activeFileObj.content}
                onChange={(value) => handleCodeChange(value ?? "")}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              Select or create a file to edit
            </div>
          )}
        </div>

        {/* Bottom Panel: Output / Terminal */}
        <div className="h-48 border-t border-[#3c3c3c] bg-[#1e1e1e] flex flex-col shrink-0">
          <div className="flex items-center px-4 py-1 text-xs uppercase tracking-wider text-gray-400 border-b border-[#3c3c3c]">
            Output Log
          </div>
          <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
            {log.length === 0 ? (
              <span className="text-gray-600">No output yet...</span>
            ) : (
              log.map((l, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: log
                  key={`${i}-${l.slice(0, 16)}`}
                  className={
                    l.includes("✗")
                      ? "text-red-400"
                      : l.includes("✓")
                        ? "text-green-400"
                        : "text-gray-300"
                  }
                >
                  {l}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: SETTINGS & RUNNER */}
      <div className="w-80 bg-[#252526] border-l border-[#3c3c3c] flex flex-col shrink-0">
        <div className="p-3 uppercase text-xs font-semibold tracking-wider text-gray-400 border-b border-[#3c3c3c]">
          Configuration & Test
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Schema Config */}
          <div className="p-4 border-b border-[#3c3c3c]">
            <div className="text-xs text-gray-400 mb-2 font-semibold">
              INPUT SCHEMA
            </div>
            <textarea
              className="w-full h-24 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 text-xs font-mono focus:outline-none focus:border-blue-500"
              value={inputSchemaStr}
              onChange={(e) => setInputSchemaStr(e.target.value)}
            />

            <div className="text-xs text-gray-400 mt-4 mb-2 font-semibold">
              OUTPUT CONFIG
            </div>
            <textarea
              className="w-full h-24 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 text-xs font-mono focus:outline-none focus:border-blue-500"
              value={outputConfigStr}
              onChange={(e) => setOutputConfigStr(e.target.value)}
            />
          </div>

          {/* Test Runner */}
          <div className="p-4">
            <div className="text-xs text-gray-400 mb-3 font-semibold">
              TEST INPUTS
            </div>

            {fields.length === 0 && (
              <div className="text-xs text-gray-500 italic mb-2">
                No inputs required.
              </div>
            )}

            {fields.map((f) => (
              <div
                key={f.key}
                className="mb-3"
              >
                <label
                  htmlFor={`input-${f.key}`}
                  className="block text-xs text-gray-300 mb-1"
                >
                  {f.title}
                </label>
                {f.enumValues ? (
                  <select
                    id={`input-${f.key}`}
                    className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                    value={inputValues[f.key] ?? ""}
                    onChange={(e) =>
                      setInputValues((p) => ({
                        ...p,
                        [f.key]: e.target.value,
                      }))
                    }
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
                    id={`input-${f.key}`}
                    type="text"
                    className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                    value={inputValues[f.key] ?? ""}
                    onChange={(e) =>
                      setInputValues((p) => ({
                        ...p,
                        [f.key]: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}

            {hasManualInput && (
              <div className="mb-3">
                <label
                  htmlFor="manual-input"
                  className="block text-xs text-gray-300 mb-1"
                >
                  Manual Cell Input
                </label>
                <input
                  id="manual-input"
                  type="text"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Cell value..."
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleRun}
              disabled={running || !latestVersion}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded shadow disabled:opacity-50 transition-colors"
            >
              <PlayIcon className="w-4 h-4" />
              {running ? "Running..." : "Run Program"}
            </button>

            {result && (
              <div className="mt-4 border border-[#3c3c3c] rounded bg-[#1e1e1e]">
                <div
                  className={`px-3 py-1.5 border-b border-[#3c3c3c] text-xs font-semibold ${result.ok ? "text-green-400" : "text-red-400"}`}
                >
                  {result.ok ? "Success" : "Error"}
                </div>
                <div className="p-3 text-xs font-mono overflow-auto max-h-48 break-words">
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
