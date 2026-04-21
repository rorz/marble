"use client";

import {
  CodeBracketIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  PlayIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import {
  cx,
  MarbleBadge,
  MarbleButton,
  MarbleDropzone,
  MarbleFieldLabel,
  MarbleInput,
  MarbleListRow,
  MarbleModal,
  MarbleModalContent,
  MarbleModalDescription,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
  MarblePane,
  MarbleSelect,
  MarbleTextarea,
} from "@marble/ui";
import type { editor as MonacoEditorApi } from "monaco-editor";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type DragEvent as ReactDragEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import * as actions from "./actions";

type FullProgram = Awaited<ReturnType<typeof actions.listPrograms>>[number];
type ProgramFile = {
  content: string;
  filename: string;
  filetype: "TypeScript" | "Json" | "Markdown";
};
type MonacoLanguage = "typescript" | "json" | "markdown";
type EditorMode = "blank" | "draft" | "saved";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  loading: () => (
    <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
      Loading editor...
    </div>
  ),
  ssr: false,
});

const sidebarPanelClassName =
  "bg-taupe-300 border-taupe-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]";
const editorTabButtonClassName =
  "flex shrink-0 items-center gap-2 rounded-sm border px-3 py-1.5 text-xs transition-colors";
const editorTabActiveClassName =
  "border-orange-300 bg-white text-taupe-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]";
const editorTabIdleClassName =
  "border-transparent text-taupe-600 hover:border-taupe-200 hover:bg-taupe-50 hover:text-taupe-900";
const importAccept = ".ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.md,.markdown,.txt";

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

function getProgramFiletype(filename: string): ProgramFile["filetype"] {
  if (filename.endsWith(".json")) {
    return "Json";
  }

  if (filename.endsWith(".md")) {
    return "Markdown";
  }

  return "TypeScript";
}

function isFileDrag(dataTransfer: DataTransfer | null | undefined) {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
}

function getSuggestedFileName(files: ProgramFile[]) {
  const preferredFilenames = [
    "utils.ts",
    "helpers.ts",
    "config.json",
    "notes.md",
  ];

  for (const candidate of preferredFilenames) {
    if (!files.some((file) => file.filename === candidate)) {
      return candidate;
    }
  }

  let suffix = 2;

  while (files.some((file) => file.filename === `file-${suffix}.ts`)) {
    suffix += 1;
  }

  return `file-${suffix}.ts`;
}

function buildFieldsFromSchema(schema: Record<string, unknown>): {
  defaultValue?: string;
  enumValues?: string[];
  key: string;
  title: string;
  type: string;
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
    <MarbleListRow
      active={active}
      icon={<CodeBracketIcon className="h-4 w-4 text-taupe-500" />}
      meta={
        latestVersion ? (
          <span className="font-mono text-[11px] text-taupe-500">
            v{latestVersion.version}
          </span>
        ) : null
      }
      onClick={onSelect}
      size="sm"
      title={program.name || "Untitled Program"}
      titleClassName="text-sm text-taupe-900"
      tone="orange"
      wrapperClassName="border-taupe-400/70"
    />
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
    <MarbleListRow
      active={active}
      icon={
        <DocumentTextIcon
          className={cx("h-4 w-4", getFileAccent(file.filename))}
        />
      }
      onClick={onSelect}
      size="sm"
      title={file.filename}
      titleClassName="text-sm text-taupe-900"
      tone="orange"
      wrapperClassName="border-taupe-400/70"
    />
  );
}

export default function ProgramsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [programs, setPrograms] = useState<FullProgram[]>([]);
  const [editorMode, setEditorMode] = useState<EditorMode>("blank");

  const [files, setFiles] = useState<ProgramFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [progName, setProgName] = useState("");
  const [inputSchemaStr, setInputSchemaStr] = useState("{}");
  const [outputConfigStr, setOutputConfigStr] = useState("{}");

  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState<{
    error?: string;
    ok: boolean;
    output: unknown;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const [importingFiles, setImportingFiles] = useState(false);
  const [workspaceDragDepth, setWorkspaceDragDepth] = useState(0);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileError, setNewFileError] = useState<string | null>(null);

  const selectedProgId = searchParams.get("programId");
  const selectedProgram = programs.find(
    (program) => program.id === selectedProgId,
  );
  const latestVersion = getLatestVersion(selectedProgram);
  const isDraftProgram = editorMode === "draft" && !selectedProgId;
  const hasProgramContext = Boolean(
    selectedProgId || isDraftProgram || files.length > 0,
  );
  const isWorkspaceDropzoneVisible = workspaceDragDepth > 0;

  const resetEditor = useCallback(() => {
    setProgName("");
    setFiles([]);
    setActiveFile(null);
    setInputSchemaStr("{}");
    setOutputConfigStr("{}");
    setInputValues({});
    setManualInput("");
    setResult(null);
    setLog([]);
    setWorkspaceDragDepth(0);
  }, []);

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
      setEditorMode("saved");
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

    if (editorMode === "draft") {
      return;
    }

    setEditorMode("blank");
    resetEditor();
  }, [
    editorMode,
    latestVersion,
    resetEditor,
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
    setEditorMode("draft");
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
    setInputValues({});
    setManualInput("");
    setResult(null);
    setLog([]);
    setImportingFiles(false);
    setWorkspaceDragDepth(0);
    setIsNewFileModalOpen(false);
    setNewFileError(null);
  };

  const openNewFileModal = () => {
    setNewFileName(getSuggestedFileName(files));
    setNewFileError(null);
    setIsNewFileModalOpen(true);
  };

  const closeNewFileModal = () => {
    setIsNewFileModalOpen(false);
    setNewFileError(null);
  };

  const handleCreateFile = () => {
    const nextFilename = newFileName.trim();

    if (!nextFilename) {
      setNewFileError("Filename is required.");
      return;
    }

    if (files.some((file) => file.filename === nextFilename)) {
      setNewFileError(`"${nextFilename}" already exists in this program.`);
      return;
    }

    setFiles((current) => [
      ...current,
      {
        content: "",
        filename: nextFilename,
        filetype: getProgramFiletype(nextFilename),
      },
    ]);
    setActiveFile(nextFilename);
    closeNewFileModal();
  };

  const handleImportFiles = async (
    incomingFiles: File[],
    options?: {
      closeModalAfterImport?: boolean;
    },
  ) => {
    if (incomingFiles.length === 0) {
      return;
    }

    setImportingFiles(true);
    addLog(`Importing ${countLabel(incomingFiles.length, "file")}...`);

    try {
      const importedFiles = await Promise.all(
        incomingFiles.map(async (file) => ({
          content: await file.text(),
          filename: file.name,
          filetype: getProgramFiletype(file.name),
        })),
      );

      const duplicateNames: string[] = [];
      let firstAcceptedFilename: null | string = null;
      let importedCount = 0;

      setFiles((current) => {
        const existingNames = new Set(current.map((file) => file.filename));
        const acceptedFiles: ProgramFile[] = [];

        for (const file of importedFiles) {
          if (existingNames.has(file.filename)) {
            duplicateNames.push(file.filename);
            continue;
          }

          existingNames.add(file.filename);
          acceptedFiles.push(file);
        }

        importedCount = acceptedFiles.length;
        firstAcceptedFilename = acceptedFiles[0]?.filename ?? null;

        return acceptedFiles.length > 0
          ? [
              ...current,
              ...acceptedFiles,
            ]
          : current;
      });

      if (firstAcceptedFilename) {
        setActiveFile((current) => current ?? firstAcceptedFilename);
      }

      if (importedCount > 0) {
        addLog(`✓ Imported ${countLabel(importedCount, "file")}.`);

        if (options?.closeModalAfterImport) {
          closeNewFileModal();
        }
      }

      if (duplicateNames.length > 0) {
        addLog(
          `✗ Skipped duplicate ${countLabel(duplicateNames.length, "file")}: ${duplicateNames.join(", ")}`,
        );
      }
    } catch (error) {
      addLog(
        `✗ File import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setImportingFiles(false);
      setWorkspaceDragDepth(0);
    }
  };

  const handleWorkspaceDragEnter = (
    event: ReactDragEvent<HTMLFieldSetElement>,
  ) => {
    if (importingFiles || !isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setWorkspaceDragDepth((current) => current + 1);
  };

  const handleWorkspaceDragLeave = (
    event: ReactDragEvent<HTMLFieldSetElement>,
  ) => {
    if (!isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setWorkspaceDragDepth((current) => Math.max(0, current - 1));
  };

  const handleWorkspaceDragOver = (
    event: ReactDragEvent<HTMLFieldSetElement>,
  ) => {
    if (importingFiles || !isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleWorkspaceDrop = (event: ReactDragEvent<HTMLFieldSetElement>) => {
    if (!isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setWorkspaceDragDepth(0);
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
      addLog("✗ Program name is required before saving.");
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
      addLog("✗ Save this program before running it.");
      return;
    }

    if (!latestVersion) {
      addLog("✗ No saved version is available to run.");
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
    (
      (latestVersion?.output_config as Record<string, unknown> | undefined)
        ?.flags as Record<string, unknown> | undefined
    )?.allowManualInput === true;

  return (
    <MarblePane
      crumbs={[
        {
          id: "home",
          label: "Programs",
        },
      ]}
    >
      <div className="flex size-full min-h-0 overflow-hidden rounded-md border-2 border-taupe-400 bg-[linear-gradient(180deg,#f8f5ee_0%,#f4efe6_100%)] text-zinc-800 shadow-xl">
        <div
          className={cx(
            "flex w-60 shrink-0 flex-col border-r",
            sidebarPanelClassName,
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-taupe-400 px-3 py-2">
            <MarbleFieldLabel className="mb-0 text-taupe-700">
              Programs
            </MarbleFieldLabel>
            <MarbleButton
              onClick={handleCreateProgram}
              size="sm"
              variant="dark"
            >
              <span className="inline-flex items-center gap-1.5">
                <PlusIcon className="h-4 w-4" />
                Create
              </span>
            </MarbleButton>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isDraftProgram ? (
              <MarbleListRow
                active
                icon={<PlusIcon className="h-4 w-4 text-orange-600" />}
                meta={
                  <MarbleBadge
                    caps
                    tone="warning"
                  >
                    Draft
                  </MarbleBadge>
                }
                onClick={() => setActiveFile((current) => current ?? "main.ts")}
                size="sm"
                title={progName.trim() || "Untitled Program"}
                titleClassName="text-sm text-taupe-900"
                tone="orange"
                wrapperClassName="border-taupe-400/70"
              />
            ) : null}

            {programs.map((program) => (
              <ProgramRow
                active={selectedProgId === program.id}
                key={program.id}
                onSelect={() => selectProgram(program.id)}
                program={program}
              />
            ))}

            {!isDraftProgram && programs.length === 0 ? (
              <div className="px-3 py-4 text-taupe-600 text-xs italic">
                No programs yet.
              </div>
            ) : null}
          </div>

          {hasProgramContext ? (
            <div className="flex min-h-0 basis-[42%] flex-col border-t border-taupe-400">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <FolderOpenIcon className="h-4 w-4 text-taupe-500" />
                  <MarbleFieldLabel className="mb-0 text-taupe-700">
                    Workspace
                  </MarbleFieldLabel>
                </div>
                <MarbleButton
                  onClick={openNewFileModal}
                  size="sm"
                  type="button"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <DocumentPlusIcon className="h-4 w-4" />
                    Add File
                  </span>
                </MarbleButton>
              </div>

              <fieldset
                aria-label="Program workspace files"
                className="relative flex-1 overflow-hidden border-0 p-0"
                onDragEnter={handleWorkspaceDragEnter}
                onDragLeave={handleWorkspaceDragLeave}
                onDragOver={handleWorkspaceDragOver}
                onDrop={handleWorkspaceDrop}
              >
                <div className="h-full overflow-y-auto pb-2">
                  {files.length > 0 ? (
                    files.map((file) => (
                      <FileRow
                        active={activeFile === file.filename}
                        file={file}
                        key={file.filename}
                        onSelect={() => setActiveFile(file.filename)}
                      />
                    ))
                  ) : (
                    <div className="px-3 py-4 text-taupe-600 text-xs italic">
                      No files in this version.
                    </div>
                  )}
                </div>

                {isWorkspaceDropzoneVisible ? (
                  <div className="absolute inset-0 z-10 border-t border-taupe-400 bg-taupe-300/88 p-3 backdrop-blur-[1px]">
                    <MarbleDropzone
                      accept={importAccept}
                      className="h-full min-h-0"
                      description="Import code or config files into this workspace."
                      disabled={importingFiles}
                      hint="Release to add files to the current program."
                      icon={<DocumentPlusIcon className="h-5 w-5" />}
                      multiple
                      onFilesChange={(incomingFiles) => {
                        void handleImportFiles(incomingFiles);
                      }}
                      title={
                        importingFiles
                          ? "Importing files..."
                          : "Drop files to import"
                      }
                      tone="orange"
                    />
                  </div>
                ) : null}
              </fieldset>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-taupe-50">
          <div className="flex items-center gap-3 border-b border-taupe-200 bg-linear-to-r from-taupe-100 via-taupe-50 to-white px-3 py-2">
            <MarbleInput
              className="font-medium text-sm text-taupe-900"
              onChange={(event) => setProgName(event.target.value)}
              placeholder="Program Name..."
              size="sm"
              type="text"
              value={progName}
              wrapperClassName="min-w-0 flex-1"
            />

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {isDraftProgram ? (
                <MarbleBadge
                  caps
                  tone="warning"
                >
                  Draft
                </MarbleBadge>
              ) : null}
              {selectedProgram?.first_party ? (
                <MarbleBadge
                  caps
                  tone="info"
                >
                  First Party
                </MarbleBadge>
              ) : null}
              {latestVersion ? (
                <MarbleBadge className="font-mono">
                  v{latestVersion.version}
                </MarbleBadge>
              ) : null}
              {files.length > 0 ? (
                <MarbleBadge>{countLabel(files.length, "file")}</MarbleBadge>
              ) : null}
            </div>

            <MarbleButton
              disabled={saving || !progName.trim() || files.length === 0}
              onClick={handleSave}
              size="sm"
              type="button"
              variant="orange"
            >
              {saving ? "Saving..." : "Save Version"}
            </MarbleButton>
          </div>

          {files.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto border-b border-taupe-200 bg-taupe-100/80 px-2 py-1.5">
              {files.map((file) => (
                <button
                  className={cx(
                    editorTabButtonClassName,
                    activeFile === file.filename
                      ? editorTabActiveClassName
                      : editorTabIdleClassName,
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

          <div className="flex h-36 shrink-0 flex-col border-t border-taupe-200 bg-linear-to-b from-taupe-50 to-white">
            <div className="flex items-center justify-between border-b border-taupe-200 px-3 py-2">
              <MarbleFieldLabel className="mb-0 text-taupe-600">
                Output Log
              </MarbleFieldLabel>
              {log.length > 0 ? (
                <MarbleBadge>
                  {countLabel(log.length, "entry", "entries")}
                </MarbleBadge>
              ) : null}
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
            <MarbleFieldLabel className="mb-0 text-taupe-700">
              Configuration & Test
            </MarbleFieldLabel>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4 border-b border-taupe-400 p-3">
              <div className="space-y-1.5">
                <MarbleFieldLabel className="text-taupe-700">
                  Input Schema
                </MarbleFieldLabel>
                <MarbleTextarea
                  className="min-h-28"
                  monospace
                  onChange={(event) => setInputSchemaStr(event.target.value)}
                  size="xs"
                  value={inputSchemaStr}
                  wrapperClassName="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <MarbleFieldLabel className="text-taupe-700">
                  Output Config
                </MarbleFieldLabel>
                <MarbleTextarea
                  className="min-h-28"
                  monospace
                  onChange={(event) => setOutputConfigStr(event.target.value)}
                  size="xs"
                  value={outputConfigStr}
                  wrapperClassName="w-full"
                />
              </div>
            </div>

            <div className="space-y-4 p-3">
              <div className="flex items-center gap-2">
                <MarbleFieldLabel className="mb-0 text-taupe-700">
                  Test Inputs
                </MarbleFieldLabel>
                {selectedProgram?.first_party ? (
                  <MarbleBadge
                    caps
                    tone="warning"
                  >
                    Built-in
                  </MarbleBadge>
                ) : null}
              </div>

              {fields.length === 0 ? (
                <p className="text-taupe-600 text-xs italic">
                  No inputs required.
                </p>
              ) : null}

              {fields.map((field) => (
                <div
                  className="space-y-1.5"
                  key={field.key}
                >
                  <MarbleFieldLabel className="text-taupe-800">
                    {field.title}
                  </MarbleFieldLabel>
                  {field.enumValues ? (
                    <MarbleSelect
                      aria-label={field.title}
                      onChange={(event) =>
                        setInputValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      size="sm"
                      value={inputValues[field.key] ?? ""}
                      wrapperClassName="w-full"
                    >
                      {field.enumValues.map((value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      ))}
                    </MarbleSelect>
                  ) : (
                    <MarbleInput
                      aria-label={field.title}
                      onChange={(event) =>
                        setInputValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      size="sm"
                      type={field.type === "number" ? "number" : "text"}
                      value={inputValues[field.key] ?? ""}
                      wrapperClassName="w-full"
                    />
                  )}
                </div>
              ))}

              {hasManualInput ? (
                <div className="space-y-1.5">
                  <MarbleFieldLabel className="text-taupe-800">
                    Manual Cell Input
                  </MarbleFieldLabel>
                  <MarbleInput
                    aria-label="Manual Cell Input"
                    onChange={(event) => setManualInput(event.target.value)}
                    placeholder="Cell value..."
                    size="sm"
                    type="text"
                    value={manualInput}
                    wrapperClassName="w-full"
                  />
                </div>
              ) : null}

              <MarbleButton
                className="w-full"
                disabled={running || !latestVersion}
                onClick={handleRun}
                size="sm"
                type="button"
                variant="orange"
              >
                <span className="inline-flex items-center gap-2">
                  <PlayIcon className="h-4 w-4" />
                  {running ? "Running..." : "Run Program"}
                </span>
              </MarbleButton>

              {result ? (
                <div className="overflow-hidden rounded-sm border border-taupe-300 bg-white/85 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-taupe-200 px-3 py-2">
                    <MarbleFieldLabel className="mb-0 text-taupe-600">
                      Last Run
                    </MarbleFieldLabel>
                    <MarbleBadge
                      caps
                      tone={result.ok ? "success" : "error"}
                    >
                      {result.ok ? "Success" : "Error"}
                    </MarbleBadge>
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

      {isNewFileModalOpen ? (
        <MarbleModal
          ariaLabel="Create a new program file"
          onClose={closeNewFileModal}
          size="sm"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateFile();
            }}
          >
            <MarbleModalHeader>
              <MarbleModalTitle>New file</MarbleModalTitle>
            </MarbleModalHeader>
            <MarbleModalContent className="space-y-4">
              <MarbleModalDescription>
                Add another source file to the current program version.
              </MarbleModalDescription>

              <div className="space-y-1.5">
                <MarbleFieldLabel>Import existing files</MarbleFieldLabel>
                <MarbleDropzone
                  accept={importAccept}
                  description="Drop code or config files here to add them directly to this program."
                  disabled={importingFiles}
                  hint="Supports .ts, .json, .md, and plain-text helpers."
                  icon={<DocumentPlusIcon className="h-5 w-5" />}
                  multiple
                  onFilesChange={(incomingFiles) => {
                    void handleImportFiles(incomingFiles, {
                      closeModalAfterImport: true,
                    });
                  }}
                  size="sm"
                  title={
                    importingFiles
                      ? "Importing files..."
                      : "Drop files here or click to browse"
                  }
                  tone="orange"
                />
              </div>

              <div className="space-y-1.5">
                <MarbleFieldLabel>Filename</MarbleFieldLabel>
                <MarbleInput
                  aria-label="Filename"
                  autoFocus
                  onChange={(event) => {
                    setNewFileName(event.target.value);
                    if (newFileError) {
                      setNewFileError(null);
                    }
                  }}
                  placeholder="utils.ts"
                  size="sm"
                  type="text"
                  value={newFileName}
                  wrapperClassName="w-full"
                />
              </div>

              {newFileError ? (
                <p className="text-red-600 text-sm">{newFileError}</p>
              ) : null}
            </MarbleModalContent>
            <MarbleModalFooter>
              <MarbleButton
                onClick={closeNewFileModal}
                size="sm"
                type="button"
              >
                Cancel
              </MarbleButton>
              <MarbleButton
                size="sm"
                type="submit"
                variant="orange"
              >
                Create File
              </MarbleButton>
            </MarbleModalFooter>
          </form>
        </MarbleModal>
      ) : null}
    </MarblePane>
  );
}
