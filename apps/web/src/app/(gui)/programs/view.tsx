"use client";

import {
  ClockIcon,
  CodeBracketIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  SparklesIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type { Database } from "@marble/supabase";
import {
  cx,
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleDropzone,
  MarbleEditableText,
  MarbleEmptyState,
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
  MarblePaneEditableCrumb,
  MarbleSelect,
  MarbleTextarea,
  MarbleWorkspaceMark,
} from "@marble/ui";
import type { editor as MonacoEditorApi } from "monaco-editor";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  type DragEvent as ReactDragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import * as actions from "./actions";

type FullProgram = Awaited<ReturnType<typeof actions.listPrograms>>[number];
type ProgramVersionRow = Database["public"]["Tables"]["program_version"]["Row"];
type ProgramFileRow = Database["public"]["Tables"]["program_file"]["Row"];
type ProgramVersionWithFiles = FullProgram["program_version"][number];
type EditableProgramFile = Pick<
  ProgramFileRow,
  "content" | "filename" | "filetype"
>;
type MonacoLanguage = "json" | "markdown" | "typescript";
type LibrarySurface = "marble" | "marketplace" | "mine";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  loading: () => (
    <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
      Loading editor...
    </div>
  ),
  ssr: false,
});

const shellPanelClassName =
  "bg-taupe-300 border-taupe-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]";
const editorTabBaseClassName =
  "group flex h-10 shrink-0 items-center gap-2 border-r border-taupe-300 px-3 text-[12px] transition-colors";
const editorTabActiveClassName =
  "bg-white text-taupe-950 shadow-[inset_0_2px_0_0_#f97316]";
const editorTabIdleClassName =
  "bg-taupe-100/70 text-taupe-600 hover:bg-taupe-50 hover:text-taupe-900";
const compactSidebarRowClassName =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-mono text-[12px] transition-colors";
const compactSidebarRowActiveClassName =
  "bg-white text-taupe-950 shadow-[inset_2px_0_0_0_#f97316]";
const compactSidebarRowIdleClassName =
  "text-taupe-700 hover:bg-white/70 hover:text-taupe-950";
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

function comparePrograms(left: FullProgram, right: FullProgram) {
  return (
    new Date(right.updated_at).getTime() -
      new Date(left.updated_at).getTime() || left.name.localeCompare(right.name)
  );
}

function sortPrograms(programs: FullProgram[]) {
  return [
    ...programs,
  ].sort(comparePrograms);
}

function sortProgramVersions(programVersions: ProgramVersionWithFiles[]) {
  return [
    ...programVersions,
  ].sort((left, right) => right.version - left.version);
}

function getLatestVersion(program: FullProgram | undefined) {
  if (!program?.program_version?.length) {
    return null;
  }

  return sortProgramVersions(program.program_version)[0];
}

function getMonacoLanguage(file: EditableProgramFile): MonacoLanguage {
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

function getFileAccent(filename: string) {
  if (filename.endsWith(".json")) {
    return "text-amber-600";
  }

  if (filename.endsWith(".md")) {
    return "text-zinc-500";
  }

  return "text-sky-600";
}

function getProgramFiletype(filename: string): EditableProgramFile["filetype"] {
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

function getSuggestedFileName(files: EditableProgramFile[]) {
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

function normalizeProgramFiles(
  programFiles: ProgramFileRow[] | null | undefined,
): EditableProgramFile[] {
  return (programFiles ?? []).map((file) => ({
    content: file.content,
    filename: file.filename,
    filetype: file.filetype,
  }));
}

function createDefaultDraftFiles(): EditableProgramFile[] {
  return [
    {
      content:
        "export default async function run(input) {\n  return { ok: true, value: input };\n}",
      filename: "main.ts",
      filetype: "TypeScript",
    },
  ];
}

function getDefaultDraftInputSchema() {
  return JSON.stringify(
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
  );
}

function getDefaultDraftOutputConfig() {
  return JSON.stringify(
    {
      schema: {
        type: "object",
      },
    },
    null,
    2,
  );
}

function VersionHistoryRow({
  active,
  version,
}: Readonly<{
  active: boolean;
  version: ProgramVersionRow & {
    program_file: ProgramFileRow[];
  };
}>) {
  return (
    <div
      className={cx(
        "border-b border-taupe-400/80 px-3 py-2 last:border-b-0",
        active ? "bg-white/80" : "bg-transparent",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-taupe-900">
            v{version.version}
          </span>
          {active ? (
            <MarbleBadge
              caps
              tone="warning"
            >
              Latest
            </MarbleBadge>
          ) : null}
        </div>
        <span className="text-[11px] text-taupe-500">
          {DATE_TIME_FORMATTER.format(new Date(version.updated_at))}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-taupe-600">
        {countLabel(version.program_file.length, "file")} in this snapshot
      </div>
    </div>
  );
}

function LibraryDockButton({
  active,
  count,
  icon,
  label,
  onClick,
  subtitle,
}: Readonly<{
  active: boolean;
  count?: number;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  subtitle: string;
}>) {
  return (
    <button
      className={cx(
        "group flex w-[7.25rem] flex-col items-center rounded-[1.25rem] border px-3 py-3 text-center transition-all",
        active
          ? "border-orange-300 bg-orange-50/80 shadow-[0_18px_34px_rgba(154,87,19,0.12)]"
          : "border-taupe-300 bg-white/90 shadow-[0_14px_28px_rgba(84,57,26,0.08)] hover:-translate-y-0.5 hover:border-orange-200",
      )}
      onClick={onClick}
      type="button"
    >
      <div
        className={cx(
          "mb-3 flex size-12 items-center justify-center rounded-2xl border transition-transform group-hover:-translate-y-0.5",
          active
            ? "border-orange-200 bg-white text-orange-600"
            : "border-taupe-200 bg-taupe-50 text-taupe-700",
        )}
      >
        {icon}
      </div>
      <span className="font-medium text-[13px] text-taupe-950">{label}</span>
      <span className="mt-1 text-[11px] text-taupe-500">{subtitle}</span>
      {count !== undefined ? (
        <span className="mt-3 rounded-full border border-taupe-200 bg-white px-2 py-0.5 font-mono text-[11px] text-taupe-700">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function WorkspaceFileTreeRow({
  active,
  dirty,
  file,
  onSelect,
}: Readonly<{
  active: boolean;
  dirty: boolean;
  file: EditableProgramFile;
  onSelect: () => void;
}>) {
  return (
    <button
      className={cx(
        compactSidebarRowClassName,
        active
          ? compactSidebarRowActiveClassName
          : compactSidebarRowIdleClassName,
      )}
      onClick={onSelect}
      type="button"
    >
      <DocumentTextIcon
        className={cx("h-3.5 w-3.5 shrink-0", getFileAccent(file.filename))}
      />
      <span className="min-w-0 flex-1 truncate">{file.filename}</span>
      {dirty ? <span className="size-1.5 rounded-full bg-orange-500" /> : null}
    </button>
  );
}

type ProgramsPageViewProps = {
  initialMode?: "draft" | "master";
  initialProgramId?: string;
  initialPrograms: FullProgram[];
};

export function ProgramsPageView({
  initialMode = "master",
  initialProgramId,
  initialPrograms,
}: ProgramsPageViewProps) {
  const router = useRouter();
  const [programs, setPrograms] = useState(() => sortPrograms(initialPrograms));
  const [createError, setCreateError] = useState<null | string>(null);
  const [createPending, setCreatePending] = useState(false);
  const [librarySurface, setLibrarySurface] = useState<LibrarySurface>(() =>
    initialPrograms.some((program) => program.first_party) ? "marble" : "mine",
  );
  const [editingSurface, setEditingSurface] = useState<
    null | "crumb" | "title"
  >(null);
  const [renameError, setRenameError] = useState<null | string>(null);
  const [savingName, setSavingName] = useState(false);

  const [files, setFiles] = useState<EditableProgramFile[]>([]);
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

  useEffect(() => {
    setPrograms(sortPrograms(initialPrograms));
  }, [
    initialPrograms,
  ]);

  const selectedProgram = initialProgramId
    ? programs.find((program) => program.id === initialProgramId)
    : undefined;
  const latestVersion = getLatestVersion(selectedProgram);
  const activeFileObj = files.find((file) => file.filename === activeFile);
  const isDraftProgram = initialMode === "draft";
  const isEditorRoute = isDraftProgram || Boolean(initialProgramId);
  const firstPartyPrograms = programs.filter((program) => program.first_party);
  const customPrograms = programs.filter((program) => !program.first_party);
  const visiblePrograms =
    librarySurface === "marble" ? firstPartyPrograms : customPrograms;
  const programVersions = selectedProgram
    ? sortProgramVersions(selectedProgram.program_version)
    : [];
  const latestVersionInputSchema = latestVersion?.input_schema;
  const latestFileContentByName = new Map(
    normalizeProgramFiles(latestVersion?.program_file).map((file) => [
      file.filename,
      file.content,
    ]),
  );
  const latestInputSchemaStr = JSON.stringify(
    latestVersion?.input_schema ?? {},
    null,
    2,
  );
  const latestOutputConfigStr = JSON.stringify(
    latestVersion?.output_config ?? {},
    null,
    2,
  );
  const hasUnsavedChanges =
    isDraftProgram ||
    progName !== (selectedProgram?.name ?? "") ||
    inputSchemaStr !== latestInputSchemaStr ||
    outputConfigStr !== latestOutputConfigStr ||
    files.length !== (latestVersion?.program_file.length ?? 0) ||
    files.some(
      (file) => latestFileContentByName.get(file.filename) !== file.content,
    );
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
  const isWorkspaceDropzoneVisible = workspaceDragDepth > 0;

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
    if (!isEditorRoute) {
      return;
    }

    setRenameError(null);
    setEditingSurface(null);
    setResult(null);
    setLog([]);
    setWorkspaceDragDepth(0);
    setIsNewFileModalOpen(false);
    setNewFileError(null);
    setManualInput("");

    if (isDraftProgram) {
      const draftFiles = createDefaultDraftFiles();
      setProgName("Untitled Program");
      setFiles(draftFiles);
      setActiveFile(draftFiles[0]?.filename ?? null);
      setInputSchemaStr(getDefaultDraftInputSchema());
      setOutputConfigStr(getDefaultDraftOutputConfig());
      return;
    }

    if (latestVersion) {
      const nextFiles = normalizeProgramFiles(latestVersion.program_file);

      setFiles(nextFiles);
      setActiveFile(nextFiles[0]?.filename ?? null);
      setInputSchemaStr(JSON.stringify(latestVersion.input_schema, null, 2));
      setOutputConfigStr(JSON.stringify(latestVersion.output_config, null, 2));
      return;
    }

    setFiles([]);
    setActiveFile(null);
    setInputSchemaStr("{}");
    setOutputConfigStr("{}");
  }, [
    isDraftProgram,
    isEditorRoute,
    latestVersion,
  ]);

  useEffect(() => {
    if (isDraftProgram || editingSurface !== null || !selectedProgram) {
      return;
    }

    setProgName(selectedProgram.name);
  }, [
    editingSurface,
    isDraftProgram,
    selectedProgram,
  ]);

  useEffect(() => {
    if (!latestVersionInputSchema) {
      setInputValues({});
      setManualInput("");
      setResult(null);
      return;
    }

    const schema = latestVersionInputSchema as Record<string, unknown>;
    const defaults: Record<string, string> = {};

    for (const field of buildFieldsFromSchema(schema)) {
      defaults[field.key] = field.defaultValue ?? field.enumValues?.[0] ?? "";
    }

    setInputValues(defaults);
    setManualInput("");
    setResult(null);
  }, [
    latestVersionInputSchema,
  ]);

  const refreshPrograms = useCallback(async () => {
    const nextPrograms = sortPrograms(await actions.listPrograms());
    setPrograms(nextPrograms);
    return nextPrograms;
  }, []);

  const persistProgramName = useCallback(async () => {
    const nextName = progName.trim() || "Untitled Program";

    if (isDraftProgram) {
      setProgName(nextName);
      setEditingSurface(null);
      return nextName;
    }

    if (!selectedProgram) {
      return nextName;
    }

    if (nextName === selectedProgram.name) {
      setProgName(selectedProgram.name);
      setEditingSurface(null);
      return selectedProgram.name;
    }

    setSavingName(true);
    setRenameError(null);

    try {
      const updated = await actions.renameProgram(selectedProgram.id, nextName);

      setPrograms((current) =>
        sortPrograms(
          current.map((program) =>
            program.id === updated.id
              ? {
                  ...program,
                  name: updated.name,
                  updated_at: updated.updated_at,
                }
              : program,
          ),
        ),
      );
      setProgName(updated.name);
      setEditingSurface(null);
      return updated.name;
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setSavingName(false);
    }
  }, [
    isDraftProgram,
    progName,
    selectedProgram,
  ]);

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
        const acceptedFiles: EditableProgramFile[] = [];

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
    const nextName = progName.trim() || "Untitled Program";

    if (!nextName) {
      addLog("✗ Program name is required before saving.");
      return;
    }

    setSaving(true);
    addLog(`Saving program "${nextName}"...`);

    try {
      if (
        !isDraftProgram &&
        selectedProgram &&
        nextName !== selectedProgram.name
      ) {
        await persistProgramName();
      }

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
        initialProgramId ?? null,
        nextName,
        parsedInput,
        parsedOutput,
        files,
      );

      addLog("✓ Saved successfully.");
      await refreshPrograms();

      if (isDraftProgram) {
        router.replace(`/programs/${programId}`);
      }
    } catch (error) {
      addLog(
        `✗ Save failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!initialProgramId) {
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

  const handleCreateProgram = useCallback(async () => {
    setCreatePending(true);
    setCreateError(null);

    try {
      const { programId } = await actions.createProgram();
      router.push(`/programs/${programId}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error));
      setCreatePending(false);
    }
  }, [
    router,
  ]);

  if (!isEditorRoute) {
    return (
      <MarblePane
        actions={[
          {
            children: createPending ? "Creating..." : "New program",
            disabled: createPending,
            id: "new-program",
            onClick: () => void handleCreateProgram(),
            variant: "orange",
          },
        ]}
        crumbs={[
          {
            id: "programs",
            label: "Programs",
          },
        ]}
        width="Narrow"
      >
        <div className="space-y-4">
          {createError ? (
            <MarbleAlert tone="error">{createError}</MarbleAlert>
          ) : null}

          <MarbleCard tone="subtle">
            <MarbleCardHeader>
              <MarbleCardTitle>Program libraries</MarbleCardTitle>
              <MarbleCardDescription>
                Switch between Marble-built programs, your custom programs, and
                the upcoming marketplace surface.
              </MarbleCardDescription>
            </MarbleCardHeader>
            <MarbleCardContent>
              <div className="flex flex-wrap gap-3">
                <LibraryDockButton
                  active={librarySurface === "marble"}
                  count={firstPartyPrograms.length}
                  icon={<MarbleWorkspaceMark className="size-10" />}
                  label="Marble"
                  onClick={() => setLibrarySurface("marble")}
                  subtitle="First party"
                />
                <LibraryDockButton
                  active={librarySurface === "mine"}
                  count={customPrograms.length}
                  icon={<UserIcon className="h-6 w-6" />}
                  label="My"
                  onClick={() => setLibrarySurface("mine")}
                  subtitle="Custom"
                />
                <LibraryDockButton
                  active={librarySurface === "marketplace"}
                  icon={<MagnifyingGlassIcon className="h-6 w-6" />}
                  label="Marketplace"
                  onClick={() => setLibrarySurface("marketplace")}
                  subtitle="Search stub"
                />
              </div>
            </MarbleCardContent>
          </MarbleCard>

          {librarySurface === "marketplace" ? (
            <MarbleCard tone="orange">
              <MarbleCardHeader>
                <MarbleCardTitle>Marketplace search</MarbleCardTitle>
                <MarbleCardDescription>
                  Placeholder chrome for the upcoming searchable marketplace of
                  reusable programs.
                </MarbleCardDescription>
              </MarbleCardHeader>
              <MarbleCardContent className="space-y-4">
                <MarbleInput
                  disabled
                  placeholder="Search by provider, transform, or capability..."
                  size="sm"
                  type="text"
                  wrapperClassName="w-full"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      label: "Providers",
                      value: "OpenAI, Clay, HTTP",
                    },
                    {
                      label: "Capabilities",
                      value: "Enrichment, parsing, scoring",
                    },
                    {
                      label: "Trust",
                      value: "Verified and signed packages",
                    },
                    {
                      label: "Install flow",
                      value: "Compare, preview, then add",
                    },
                  ].map((item) => (
                    <div
                      className="rounded-xs border border-orange-200 bg-white/85 p-3"
                      key={item.label}
                    >
                      <div className="font-medium text-sm text-taupe-900">
                        {item.label}
                      </div>
                      <div className="mt-1 text-sm text-taupe-600">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </MarbleCardContent>
            </MarbleCard>
          ) : (
            <MarbleCard>
              {visiblePrograms.length === 0 ? (
                <MarbleCardContent>
                  <MarbleEmptyState
                    description={
                      librarySurface === "mine"
                        ? "Create a custom program to start building your own toolchain."
                        : "No Marble programs are available yet."
                    }
                    title={
                      librarySurface === "mine"
                        ? "No custom programs yet"
                        : "No Marble programs yet"
                    }
                  />
                </MarbleCardContent>
              ) : (
                <MarbleCardContent className="p-0">
                  {visiblePrograms.map((program) => {
                    const visibleLatestVersion = getLatestVersion(program);

                    return (
                      <MarbleListRow
                        description={
                          <>
                            <span>
                              {visibleLatestVersion
                                ? `v${visibleLatestVersion.version}`
                                : "No versions"}
                            </span>
                            <span>
                              {DATE_FORMATTER.format(
                                new Date(program.updated_at),
                              )}
                            </span>
                          </>
                        }
                        descriptionClassName="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500"
                        icon={
                          program.first_party ? (
                            <SparklesIcon className="h-4 w-4 text-orange-600" />
                          ) : (
                            <CodeBracketIcon className="h-4 w-4 text-taupe-500" />
                          )
                        }
                        key={program.id}
                        meta={
                          visibleLatestVersion ? (
                            <span className="font-mono text-[11px] text-taupe-500">
                              {countLabel(
                                visibleLatestVersion.program_file.length,
                                "file",
                              )}
                            </span>
                          ) : null
                        }
                        onClick={() => router.push(`/programs/${program.id}`)}
                        title={program.name || "Untitled Program"}
                        titleClassName="text-sm text-taupe-900"
                      />
                    );
                  })}
                </MarbleCardContent>
              )}
            </MarbleCard>
          )}
        </div>
      </MarblePane>
    );
  }

  return (
    <MarblePane
      crumbs={[
        {
          href: "/programs",
          id: "programs",
          label: "Programs",
        },
        {
          id: "program-name",
          label:
            !isDraftProgram && selectedProgram ? (
              <MarblePaneEditableCrumb
                disabled={savingName}
                editing={editingSurface === "crumb"}
                onCancel={() => {
                  setEditingSurface(null);
                  setProgName(selectedProgram.name);
                }}
                onChange={setProgName}
                onCommit={() => void persistProgramName()}
                onEdit={() => setEditingSurface("crumb")}
                value={progName || "Untitled Program"}
              />
            ) : (
              "New Program"
            ),
        },
      ]}
    >
      <div className="space-y-4 size-full">
        {renameError ? (
          <MarbleAlert tone="error">{renameError}</MarbleAlert>
        ) : null}

        <div className="flex size-full min-h-0 overflow-hidden rounded-md border-2 border-taupe-400 bg-[linear-gradient(180deg,#f8f5ee_0%,#f4efe6_100%)] text-zinc-800 shadow-xl">
          <div
            className={cx(
              "flex w-64 shrink-0 flex-col border-r",
              shellPanelClassName,
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-taupe-400 px-3 py-2">
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
                <div className="h-full overflow-y-auto p-2">
                  {files.length > 0 ? (
                    <div className="space-y-0.5">
                      {files.map((file) => (
                        <WorkspaceFileTreeRow
                          active={activeFile === file.filename}
                          dirty={
                            isDraftProgram ||
                            latestFileContentByName.get(file.filename) !==
                              file.content
                          }
                          file={file}
                          key={file.filename}
                          onSelect={() => setActiveFile(file.filename)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="px-2 py-3 text-taupe-600 text-xs italic">
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

            <div className="max-h-[38%] min-h-40 border-t border-taupe-400">
              <div className="flex items-center gap-1.5 border-b border-taupe-400 px-3 py-2">
                <ClockIcon className="h-4 w-4 text-taupe-500" />
                <MarbleFieldLabel className="mb-0 text-taupe-700">
                  Versions
                </MarbleFieldLabel>
              </div>

              <div className="max-h-full overflow-y-auto">
                {programVersions.length > 0 ? (
                  programVersions.map((version) => (
                    <VersionHistoryRow
                      active={version.id === latestVersion?.id}
                      key={version.id}
                      version={version}
                    />
                  ))
                ) : (
                  <div className="px-3 py-4 text-taupe-600 text-xs italic">
                    {isDraftProgram
                      ? "Save the draft to start version history."
                      : "No saved versions yet."}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-taupe-50">
            <div className="border-b border-taupe-200 bg-linear-to-r from-taupe-100 via-taupe-50 to-white px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <MarbleEditableText
                    className="-mx-1 rounded-sm px-1 text-left text-3xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
                    disabled={savingName}
                    editing={editingSurface === "title"}
                    onCancel={() => {
                      setEditingSurface(null);
                      setProgName(selectedProgram?.name ?? progName);
                    }}
                    onChange={setProgName}
                    onCommit={() => void persistProgramName()}
                    onEdit={() => setEditingSurface("title")}
                    value={progName || "Untitled Program"}
                  />

                  <div className="flex flex-wrap items-center gap-2">
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
                        Marble
                      </MarbleBadge>
                    ) : (
                      <MarbleBadge
                        caps
                        tone="solid"
                      >
                        Custom
                      </MarbleBadge>
                    )}
                    {latestVersion ? (
                      <MarbleBadge className="font-mono">
                        v{latestVersion.version}
                      </MarbleBadge>
                    ) : null}
                    {files.length > 0 ? (
                      <MarbleBadge>
                        {countLabel(files.length, "file")}
                      </MarbleBadge>
                    ) : null}
                    {hasUnsavedChanges ? (
                      <MarbleBadge
                        caps
                        tone="warning"
                      >
                        Unsaved
                      </MarbleBadge>
                    ) : null}
                  </div>
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
            </div>

            {files.length > 0 ? (
              <div className="flex items-stretch overflow-x-auto border-b border-taupe-300 bg-taupe-100/80">
                {files.map((file) => {
                  const isDirty =
                    isDraftProgram ||
                    latestFileContentByName.get(file.filename) !== file.content;

                  return (
                    <button
                      className={cx(
                        editorTabBaseClassName,
                        activeFile === file.filename
                          ? editorTabActiveClassName
                          : editorTabIdleClassName,
                      )}
                      key={file.filename}
                      onClick={() => setActiveFile(file.filename)}
                      type="button"
                    >
                      <DocumentTextIcon
                        className={cx(
                          "h-4 w-4 shrink-0",
                          getFileAccent(file.filename),
                        )}
                      />
                      <span className="max-w-40 truncate">{file.filename}</span>
                      {isDirty ? (
                        <span className="size-1.5 rounded-full bg-orange-500" />
                      ) : null}
                    </button>
                  );
                })}
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
                      initialProgramId ?? null,
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
              shellPanelClassName,
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

              <div className="space-y-3 border-b border-taupe-400 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyIcon className="h-4 w-4 text-taupe-500" />
                    <MarbleFieldLabel className="mb-0 text-taupe-700">
                      Secrets
                    </MarbleFieldLabel>
                  </div>
                  <MarbleBadge
                    caps
                    tone="warning"
                  >
                    Stub
                  </MarbleBadge>
                </div>

                <p className="text-taupe-600 text-xs">
                  Required environment variables will surface here once secret
                  declarations are wired into the program manifest.
                </p>

                {[
                  "EXTERNAL_API_KEY",
                  "PRIVATE_SIGNING_SECRET",
                ].map((secretName) => (
                  <div
                    className="rounded-xs border border-taupe-400/80 bg-white/80 px-3 py-2"
                    key={secretName}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] text-taupe-900">
                        {secretName}
                      </span>
                      <MarbleBadge tone="warning">Missing</MarbleBadge>
                    </div>
                    <div className="mt-1 text-[11px] text-taupe-500">
                      Secret resolution UI coming next.
                    </div>
                  </div>
                ))}
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
