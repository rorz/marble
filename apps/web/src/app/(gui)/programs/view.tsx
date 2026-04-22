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
  MarbleWorkbenchResizeHandle,
  MarbleWorkbenchSection,
  MarbleWorkbenchTab,
  MarbleWorkbenchTabs,
  MarbleWorkspaceMark,
  marbleToast,
} from "@marble/ui";
import type { editor as MonacoEditorApi } from "monaco-editor";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  type DragEvent as ReactDragEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { changeTargetKey, getChangeTargetProps } from "../change-spotlight";
import * as actions from "./actions";

type FullProgram = Awaited<ReturnType<typeof actions.listPrograms>>[number];
type ProgramVersionRow = Database["public"]["Tables"]["program_version"]["Row"];
type ProgramFileRow = Database["public"]["Tables"]["program_file"]["Row"];
type ProgramVersionWithFiles = FullProgram["program_version"][number];
type PublishedProgramVersionWithFiles = ProgramVersionWithFiles & {
  published_at: string;
  version: number;
};
type EditableProgramFile = Pick<
  ProgramFileRow,
  "content" | "filename" | "filetype"
>;
type MonacoLanguage = "json" | "markdown" | "typescript";
type LibrarySurface = "marble" | "marketplace" | "mine";
type PendingChange = {
  badgeTone: "info" | "neutral" | "warning";
  id: string;
  label: string;
  summary: string;
  tag: string;
};

const workbenchPanelHeightLimits = {
  draftStack: {
    max: 360,
    min: 180,
  },
  inputSchema: {
    max: 360,
    min: 180,
  },
  outputConfig: {
    max: 360,
    min: 180,
  },
  secrets: {
    max: 280,
    min: 140,
  },
  testInputs: {
    max: 460,
    min: 240,
  },
  versions: {
    max: 360,
    min: 150,
  },
} as const;

type ResizablePanelId = keyof typeof workbenchPanelHeightLimits;
type RightWorkbenchPanelId = Exclude<ResizablePanelId, "versions">;

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
  "flex h-7 w-full items-center gap-1.5 rounded-sm px-1.5 text-left font-mono text-[11px] transition-colors";
const compactSidebarRowActiveClassName =
  "bg-white/95 text-taupe-950 shadow-[inset_2px_0_0_0_#f97316,0_1px_0_rgba(255,255,255,0.45)]";
const compactSidebarRowIdleClassName =
  "text-taupe-700 hover:bg-white/70 hover:text-taupe-950";
const importAccept = ".ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.md,.markdown,.txt";
const rightPanelDefaultHeights = {
  draftStack: 252,
  inputSchema: 220,
  outputConfig: 220,
  secrets: 176,
  testInputs: 320,
} satisfies Record<RightWorkbenchPanelId, number>;
const stackedWorkbenchSectionClassName =
  "rounded-none border-x-0 border-t-0 bg-transparent shadow-none";
const stackedWorkbenchHeaderClassName = "px-3 py-1.5 bg-transparent";
const stackedWorkbenchBodyClassName = "bg-white/92";

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
  ]
    .filter(
      (version): version is PublishedProgramVersionWithFiles =>
        version.published_at !== null && version.version !== null,
    )
    .sort((left, right) => (right.version ?? 0) - (left.version ?? 0));
}

function getLatestPublishedVersion(program: FullProgram | undefined) {
  return sortProgramVersions(program?.program_version ?? [])[0] ?? null;
}

function getDraftVersion(program: FullProgram | undefined) {
  if (!program?.program_version?.length) {
    return null;
  }

  return (
    [
      ...program.program_version,
    ]
      .filter((version) => version.published_at === null)
      .sort(
        (left, right) =>
          new Date(right.updated_at).getTime() -
          new Date(left.updated_at).getTime(),
      )[0] ?? null
  );
}

function normalizeJsonEditorValue(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return null;
  }
}

function normalizeProgramVersionMutation(
  version: ProgramVersionRow & {
    files?: ProgramFileRow[];
    program_file?: ProgramFileRow[];
  },
) {
  return {
    ...version,
    program_file: version.program_file ?? version.files ?? [],
  } satisfies ProgramVersionWithFiles;
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

function clampWorkbenchPanelHeight(
  panelId: ResizablePanelId,
  nextHeight: number,
) {
  const { max, min } = workbenchPanelHeightLimits[panelId];

  return Math.min(max, Math.max(min, nextHeight));
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

function buildPendingChanges({
  files,
  inputSchemaStr,
  isDraftProgram,
  latestFileContentByName,
  latestInputSchemaStr,
  latestOutputConfigStr,
  outputConfigStr,
  programName,
  savedProgramName,
}: {
  files: EditableProgramFile[];
  inputSchemaStr: string;
  isDraftProgram: boolean;
  latestFileContentByName: Map<string, string>;
  latestInputSchemaStr: string;
  latestOutputConfigStr: string;
  outputConfigStr: string;
  programName: string;
  savedProgramName: string;
}): PendingChange[] {
  const changes: PendingChange[] = [];
  const nextProgramName = programName.trim() || "Untitled Program";

  if (!isDraftProgram && nextProgramName !== savedProgramName) {
    changes.push({
      badgeTone: "warning",
      id: "rename",
      label: `Rename to ${nextProgramName}`,
      summary:
        "The next saved version will publish under the updated program name.",
      tag: "Rename",
    });
  }

  if (inputSchemaStr !== latestInputSchemaStr) {
    changes.push({
      badgeTone: "warning",
      id: "input-schema",
      label: "Edited input schema",
      summary:
        "Input requirements are staged in the draft until you mint the next version.",
      tag: "Schema",
    });
  }

  if (outputConfigStr !== latestOutputConfigStr) {
    changes.push({
      badgeTone: "warning",
      id: "output-config",
      label: "Edited output config",
      summary:
        "Output mapping changes stay isolated from live columns until save.",
      tag: "Output",
    });
  }

  const currentFileNames = new Set(files.map((file) => file.filename));

  for (const file of files) {
    const previousContent = latestFileContentByName.get(file.filename);

    if (previousContent === undefined) {
      changes.push({
        badgeTone: "info",
        id: `file:add:${file.filename}`,
        label: `Added ${file.filename}`,
        summary: "This file will only exist in the next saved version.",
        tag: "Added",
      });
      continue;
    }

    if (previousContent !== file.content) {
      changes.push({
        badgeTone: "warning",
        id: `file:edit:${file.filename}`,
        label: `Edited ${file.filename}`,
        summary:
          "File edits are layered onto the draft stack without touching the saved version.",
        tag: "Edited",
      });
    }
  }

  for (const filename of latestFileContentByName.keys()) {
    if (!currentFileNames.has(filename)) {
      changes.push({
        badgeTone: "warning",
        id: `file:remove:${filename}`,
        label: `Removed ${filename}`,
        summary:
          "The file will disappear only after you save the next version.",
        tag: "Removed",
      });
    }
  }

  if (isDraftProgram && changes.length === 0) {
    changes.push({
      badgeTone: "info",
      id: "draft",
      label: "Draft scaffold",
      summary:
        "Nothing references this workspace until you create the first version.",
      tag: "Draft",
    });
  }

  return changes;
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
  targetKey,
  version,
}: Readonly<{
  active: boolean;
  targetKey?: string;
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
      {...(targetKey ? getChangeTargetProps(targetKey) : {})}
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

function PendingChangeCard({
  change,
}: Readonly<{
  change: PendingChange;
}>) {
  const toneClassName =
    change.badgeTone === "info"
      ? {
          badge: "info" as const,
          text: "text-sky-700",
        }
      : change.badgeTone === "warning"
        ? {
            badge: "warning" as const,
            text: "text-amber-700",
          }
        : {
            badge: "neutral" as const,
            text: "text-taupe-600",
          };

  return (
    <div className="flex items-start justify-between gap-2 border-t border-taupe-200 px-2 py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[12px] text-taupe-950">
          {change.label}
        </div>
        <div className="mt-0.5 text-[11px] leading-4 text-taupe-500">
          {change.summary}
        </div>
      </div>
      <MarbleBadge
        className={toneClassName.text}
        tone={toneClassName.badge}
      >
        {change.tag}
      </MarbleBadge>
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
  targetKey,
}: Readonly<{
  active: boolean;
  dirty: boolean;
  file: EditableProgramFile;
  onSelect: () => void;
  targetKey?: string;
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
      {...(targetKey ? getChangeTargetProps(targetKey) : {})}
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
  const [openTabs, setOpenTabs] = useState<string[]>([]);
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
  const [versionsCollapsed, setVersionsCollapsed] = useState(false);
  const [versionsHeight, setVersionsHeight] = useState(224);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState<
    Record<RightWorkbenchPanelId, boolean>
  >({
    draftStack: false,
    inputSchema: false,
    outputConfig: false,
    secrets: false,
    testInputs: false,
  });
  const [rightPanelHeights, setRightPanelHeights] = useState(
    rightPanelDefaultHeights,
  );
  const [activeResizePanel, setActiveResizePanel] =
    useState<null | ResizablePanelId>(null);
  const resizeStateRef = useRef<null | {
    direction: -1 | 1;
    panelId: ResizablePanelId;
    pointerId: number;
    startHeight: number;
    startY: number;
  }>(null);
  const loadedProgramIdRef = useRef<string | null>(null);
  const draftSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [draftBootstrapPending, setDraftBootstrapPending] = useState(false);
  const [draftSyncPending, setDraftSyncPending] = useState(false);

  useEffect(() => {
    setPrograms(sortPrograms(initialPrograms));
  }, [
    initialPrograms,
  ]);

  const selectedProgram = initialProgramId
    ? programs.find((program) => program.id === initialProgramId)
    : undefined;
  const latestPublishedVersion = getLatestPublishedVersion(selectedProgram);
  const draftVersion = getDraftVersion(selectedProgram);
  const workingVersion = draftVersion ?? latestPublishedVersion;
  const activeProgramTargetId =
    selectedProgram?.id ?? initialProgramId ?? "__draft__";
  const isLocalDraftProgram = initialMode === "draft" && !selectedProgram;
  const isDraftProgram = isLocalDraftProgram || draftVersion !== null;
  const isEditorRoute = isDraftProgram || Boolean(initialProgramId);
  const firstPartyPrograms = programs.filter((program) => program.first_party);
  const customPrograms = programs.filter((program) => !program.first_party);
  const visiblePrograms =
    librarySurface === "marble" ? firstPartyPrograms : customPrograms;
  const programVersions = selectedProgram
    ? sortProgramVersions(selectedProgram.program_version)
    : [];
  const latestVersionInputSchema = workingVersion?.input_schema;
  const latestFileContentByName = new Map(
    normalizeProgramFiles(latestPublishedVersion?.program_file).map((file) => [
      file.filename,
      file.content,
    ]),
  );
  const workingFileContentByName = new Map(
    normalizeProgramFiles(workingVersion?.program_file).map((file) => [
      file.filename,
      file.content,
    ]),
  );
  const latestInputSchemaStr = JSON.stringify(
    latestPublishedVersion?.input_schema ?? {},
    null,
    2,
  );
  const workingInputSchemaStr = JSON.stringify(
    workingVersion?.input_schema ?? {},
    null,
    2,
  );
  const latestOutputConfigStr = JSON.stringify(
    latestPublishedVersion?.output_config ?? {},
    null,
    2,
  );
  const workingOutputConfigStr = JSON.stringify(
    workingVersion?.output_config ?? {},
    null,
    2,
  );
  const normalizedInputSchemaStr = normalizeJsonEditorValue(inputSchemaStr);
  const normalizedOutputConfigStr = normalizeJsonEditorValue(outputConfigStr);
  const nextVersionNumber = latestPublishedVersion
    ? (latestPublishedVersion.version ?? 0) + 1
    : 1;
  const fileByName = new Map(
    files.map((file) => [
      file.filename,
      file,
    ]),
  );
  const openTabFiles = openTabs.flatMap((filename) => {
    const file = fileByName.get(filename);

    return file
      ? [
          file,
        ]
      : [];
  });
  const activeFileObj =
    (activeFile ? fileByName.get(activeFile) : null) ?? openTabFiles[0] ?? null;
  const dirtyFiles = new Set(
    files
      .filter(
        (file) =>
          workingVersion === null ||
          workingFileContentByName.get(file.filename) !== file.content,
      )
      .map((file) => file.filename),
  );
  const pendingChanges = buildPendingChanges({
    files,
    inputSchemaStr,
    isDraftProgram,
    latestFileContentByName,
    latestInputSchemaStr,
    latestOutputConfigStr,
    outputConfigStr,
    programName: progName,
    savedProgramName: selectedProgram?.name ?? "",
  });
  const draftStackCards: PendingChange[] = [
    {
      badgeTone: "neutral",
      id: "base-version",
      label: latestPublishedVersion
        ? `Base v${latestPublishedVersion.version}`
        : "Unsaved draft",
      summary: latestPublishedVersion
        ? pendingChanges.length > 0
          ? `Live columns keep using v${latestPublishedVersion.version} until you publish v${nextVersionNumber}.`
          : `No draft changes. Live columns still use v${latestPublishedVersion.version}.`
        : "Nothing else points at this workspace until you create the first saved version.",
      tag: latestPublishedVersion ? "Saved" : "Draft",
    },
    ...pendingChanges,
  ];
  const hasLocalProgramNameChange = progName !== (selectedProgram?.name ?? "");
  const hasLocalDraftPayloadChanges =
    (normalizedInputSchemaStr === null
      ? inputSchemaStr !== workingInputSchemaStr
      : normalizedInputSchemaStr !== workingInputSchemaStr) ||
    (normalizedOutputConfigStr === null
      ? outputConfigStr !== workingOutputConfigStr
      : normalizedOutputConfigStr !== workingOutputConfigStr) ||
    files.length !== (workingVersion?.program_file.length ?? 0) ||
    files.some(
      (file) => workingFileContentByName.get(file.filename) !== file.content,
    );
  const hasUnsavedChanges =
    draftVersion !== null ||
    isLocalDraftProgram ||
    hasLocalProgramNameChange ||
    pendingChanges.length > 0;
  const hasVersionChangesAgainstPublished =
    (normalizedInputSchemaStr === null
      ? inputSchemaStr !== latestInputSchemaStr
      : normalizedInputSchemaStr !== latestInputSchemaStr) ||
    (normalizedOutputConfigStr === null
      ? outputConfigStr !== latestOutputConfigStr
      : normalizedOutputConfigStr !== latestOutputConfigStr) ||
    files.length !== (latestPublishedVersion?.program_file.length ?? 0) ||
    files.some(
      (file) => latestFileContentByName.get(file.filename) !== file.content,
    );
  const fields = workingVersion
    ? buildFieldsFromSchema(
        workingVersion.input_schema as Record<string, unknown>,
      )
    : [];
  const hasManualInput =
    (
      (workingVersion?.output_config as Record<string, unknown> | undefined)
        ?.flags as Record<string, unknown> | undefined
    )?.allowManualInput === true;
  const isWorkspaceDropzoneVisible = workspaceDragDepth > 0;

  useEffect(() => {
    return () => {
      if (draftSyncTimeoutRef.current) {
        clearTimeout(draftSyncTimeoutRef.current);
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

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
      loadedProgramIdRef.current = null;
      return;
    }

    const programIdentity =
      selectedProgram?.id ?? (isLocalDraftProgram ? "__draft__" : null);

    if (
      programIdentity === null ||
      loadedProgramIdRef.current === programIdentity
    ) {
      return;
    }

    loadedProgramIdRef.current = programIdentity;
    setRenameError(null);
    setEditingSurface(null);
    setResult(null);
    setLog([]);
    setWorkspaceDragDepth(0);
    setIsNewFileModalOpen(false);
    setNewFileError(null);
    setManualInput("");

    if (isLocalDraftProgram) {
      const draftFiles = createDefaultDraftFiles();
      setProgName("Untitled Program");
      setFiles(draftFiles);
      setActiveFile(draftFiles[0]?.filename ?? null);
      setOpenTabs(
        draftFiles[0]?.filename
          ? [
              draftFiles[0].filename,
            ]
          : [],
      );
      setInputSchemaStr(getDefaultDraftInputSchema());
      setOutputConfigStr(getDefaultDraftOutputConfig());
      return;
    }

    if (workingVersion) {
      const nextFiles = normalizeProgramFiles(workingVersion.program_file);

      setProgName(selectedProgram?.name ?? "Untitled Program");
      setFiles(nextFiles);
      setActiveFile(nextFiles[0]?.filename ?? null);
      setOpenTabs(
        nextFiles[0]?.filename
          ? [
              nextFiles[0].filename,
            ]
          : [],
      );
      setInputSchemaStr(JSON.stringify(workingVersion.input_schema, null, 2));
      setOutputConfigStr(JSON.stringify(workingVersion.output_config, null, 2));
      return;
    }

    setProgName(selectedProgram?.name ?? "Untitled Program");
    setFiles([]);
    setActiveFile(null);
    setOpenTabs([]);
    setInputSchemaStr("{}");
    setOutputConfigStr("{}");
  }, [
    isEditorRoute,
    isLocalDraftProgram,
    selectedProgram?.id,
    selectedProgram?.name,
    workingVersion,
  ]);

  useEffect(() => {
    if (isLocalDraftProgram || editingSurface !== null || !selectedProgram) {
      return;
    }

    setProgName(selectedProgram.name);
  }, [
    editingSurface,
    isLocalDraftProgram,
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

  const upsertProgramVersion = useCallback(
    (
      programId: string,
      nextVersion: ProgramVersionRow & {
        files?: ProgramFileRow[];
        program_file?: ProgramFileRow[];
      },
    ) => {
      const normalizedVersion = normalizeProgramVersionMutation(nextVersion);

      setPrograms((current) =>
        sortPrograms(
          current.map((program) =>
            program.id === programId
              ? {
                  ...program,
                  program_version: [
                    ...program.program_version.filter(
                      (version) => version.id !== normalizedVersion.id,
                    ),
                    normalizedVersion,
                  ],
                  updated_at: normalizedVersion.updated_at,
                }
              : program,
          ),
        ),
      );

      return normalizedVersion;
    },
    [],
  );

  const updateSelectedProgramName = useCallback(
    (name: string) => {
      if (!selectedProgram) {
        return;
      }

      setPrograms((current) =>
        sortPrograms(
          current.map((program) =>
            program.id === selectedProgram.id
              ? {
                  ...program,
                  name,
                  updated_at: new Date().toISOString(),
                }
              : program,
          ),
        ),
      );
    },
    [
      selectedProgram,
    ],
  );

  const ensurePersistedDraftVersion = useCallback(
    async (showToast = true) => {
      if (!selectedProgram) {
        return null;
      }

      if (draftVersion) {
        return draftVersion;
      }

      if (!normalizedInputSchemaStr || !normalizedOutputConfigStr) {
        throw new Error("Fix the draft JSON before creating a draft.");
      }

      const { version } = await actions.createDraftVersion(
        selectedProgram.id,
        JSON.parse(normalizedInputSchemaStr),
        JSON.parse(normalizedOutputConfigStr),
        files,
      );
      const persistedDraft = upsertProgramVersion(selectedProgram.id, version);

      if (showToast && latestPublishedVersion?.version) {
        marbleToast("Draft created", {
          description: `Forked from v${latestPublishedVersion.version}. Existing columns still use v${latestPublishedVersion.version}.`,
        });
      }

      return persistedDraft;
    },
    [
      draftVersion,
      files,
      latestPublishedVersion?.version,
      normalizedInputSchemaStr,
      normalizedOutputConfigStr,
      selectedProgram,
      upsertProgramVersion,
    ],
  );

  const persistProgramName = useCallback(async () => {
    const nextName = progName.trim() || "Untitled Program";

    if (!selectedProgram) {
      setProgName(nextName);
      setEditingSurface(null);
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

      updateSelectedProgramName(updated.name);
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
    progName,
    selectedProgram,
    updateSelectedProgramName,
  ]);

  useEffect(() => {
    if (
      !selectedProgram ||
      draftVersion ||
      draftBootstrapPending ||
      !latestPublishedVersion ||
      !hasVersionChangesAgainstPublished
    ) {
      return;
    }

    if (!normalizedInputSchemaStr || !normalizedOutputConfigStr) {
      return;
    }

    let cancelled = false;
    setDraftBootstrapPending(true);

    void (async () => {
      try {
        await ensurePersistedDraftVersion();
      } catch (error) {
        if (!cancelled) {
          addLog(
            `✗ Draft creation failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          marbleToast.error("Draft creation failed", {
            description: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        if (!cancelled) {
          setDraftBootstrapPending(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    addLog,
    draftBootstrapPending,
    draftVersion,
    ensurePersistedDraftVersion,
    hasVersionChangesAgainstPublished,
    latestPublishedVersion,
    normalizedInputSchemaStr,
    normalizedOutputConfigStr,
    selectedProgram,
  ]);

  useEffect(() => {
    if (!draftVersion || !selectedProgram) {
      if (draftSyncTimeoutRef.current) {
        clearTimeout(draftSyncTimeoutRef.current);
        draftSyncTimeoutRef.current = null;
      }
      setDraftSyncPending(false);
      return;
    }

    if (!hasLocalDraftPayloadChanges) {
      if (draftSyncTimeoutRef.current) {
        clearTimeout(draftSyncTimeoutRef.current);
        draftSyncTimeoutRef.current = null;
      }
      setDraftSyncPending(false);
      return;
    }

    if (!normalizedInputSchemaStr || !normalizedOutputConfigStr) {
      return;
    }

    if (draftSyncTimeoutRef.current) {
      clearTimeout(draftSyncTimeoutRef.current);
    }

    setDraftSyncPending(true);
    draftSyncTimeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const syncedDraft = await actions.syncDraftVersion(
            draftVersion.id,
            JSON.parse(normalizedInputSchemaStr),
            JSON.parse(normalizedOutputConfigStr),
            files,
          );
          upsertProgramVersion(selectedProgram.id, syncedDraft);
        } catch (error) {
          addLog(
            `✗ Draft sync failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          setDraftSyncPending(false);
          draftSyncTimeoutRef.current = null;
        }
      })();
    }, 500);

    return () => {
      if (draftSyncTimeoutRef.current) {
        clearTimeout(draftSyncTimeoutRef.current);
        draftSyncTimeoutRef.current = null;
      }
    };
  }, [
    addLog,
    draftVersion,
    files,
    hasLocalDraftPayloadChanges,
    normalizedInputSchemaStr,
    normalizedOutputConfigStr,
    selectedProgram,
    upsertProgramVersion,
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
    setOpenTabs((current) =>
      current.includes(nextFilename)
        ? current
        : [
            ...current,
            nextFilename,
          ],
    );
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
        const acceptedFilename = firstAcceptedFilename;

        setOpenTabs((current) =>
          current.includes(acceptedFilename)
            ? current
            : [
                ...current,
                acceptedFilename,
              ],
        );
        setActiveFile(acceptedFilename);
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

  const handleSelectFile = (filename: string) => {
    setOpenTabs((current) =>
      current.includes(filename)
        ? current
        : [
            ...current,
            filename,
          ],
    );
    setActiveFile(filename);
  };

  const handleCloseTab = (filename: string) => {
    setOpenTabs((current) => {
      const currentIndex = current.indexOf(filename);

      if (currentIndex === -1) {
        return current;
      }

      const nextTabs = current.filter((tab) => tab !== filename);

      setActiveFile((currentActiveFile) =>
        currentActiveFile === filename
          ? (nextTabs[currentIndex] ?? nextTabs[currentIndex - 1] ?? null)
          : currentActiveFile,
      );

      return nextTabs;
    });
  };

  const getPanelHeight = (panelId: ResizablePanelId) =>
    panelId === "versions" ? versionsHeight : rightPanelHeights[panelId];

  const setPanelHeight = (panelId: ResizablePanelId, nextHeight: number) => {
    if (panelId === "versions") {
      setVersionsHeight(nextHeight);
      return;
    }

    setRightPanelHeights((current) => ({
      ...current,
      [panelId]: nextHeight,
    }));
  };

  const finishPanelResize = (event?: ReactPointerEvent<HTMLButtonElement>) => {
    const currentTarget = event?.currentTarget;
    const resizeState = resizeStateRef.current;

    if (!resizeState) {
      return;
    }

    if (currentTarget?.hasPointerCapture(resizeState.pointerId)) {
      currentTarget.releasePointerCapture(resizeState.pointerId);
    }

    resizeStateRef.current = null;
    setActiveResizePanel(null);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const handlePanelResizeStart =
    (panelId: ResizablePanelId, direction: -1 | 1) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      resizeStateRef.current = {
        direction,
        panelId,
        pointerId: event.pointerId,
        startHeight: getPanelHeight(panelId),
        startY: event.clientY,
      };
      setActiveResizePanel(panelId);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      event.currentTarget.setPointerCapture(event.pointerId);
    };

  const handlePanelResizeMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const resizeState = resizeStateRef.current;

    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    const nextHeight = clampWorkbenchPanelHeight(
      resizeState.panelId,
      resizeState.startHeight +
        (event.clientY - resizeState.startY) * resizeState.direction,
    );

    setPanelHeight(resizeState.panelId, nextHeight);
  };

  const handlePanelResizeKeyDown =
    (panelId: ResizablePanelId) =>
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      let nextHeight: number | null = null;

      if (event.key === "ArrowUp") {
        nextHeight = getPanelHeight(panelId) + 16;
      } else if (event.key === "ArrowDown") {
        nextHeight = getPanelHeight(panelId) - 16;
      } else if (event.key === "Home") {
        nextHeight = workbenchPanelHeightLimits[panelId].min;
      } else if (event.key === "End") {
        nextHeight = workbenchPanelHeightLimits[panelId].max;
      }

      if (nextHeight === null) {
        return;
      }

      event.preventDefault();
      setPanelHeight(panelId, clampWorkbenchPanelHeight(panelId, nextHeight));
    };

  const handleSave = async () => {
    if (!selectedProgram) {
      addLog("✗ Create a program before publishing a version.");
      return;
    }

    const nextName = progName.trim() || "Untitled Program";

    if (!nextName) {
      addLog("✗ Program name is required before publishing.");
      return;
    }

    setSaving(true);
    addLog(`Publishing "${nextName}" as v${nextVersionNumber}...`);

    try {
      if (!normalizedInputSchemaStr) {
        throw new Error("Invalid Input Schema JSON");
      }

      if (!normalizedOutputConfigStr) {
        throw new Error("Invalid Output Config JSON");
      }

      const persistedDraft = await ensurePersistedDraftVersion(false);

      if (!persistedDraft) {
        throw new Error("Draft creation failed");
      }

      const publishedVersion = await actions.publishDraftVersion(
        persistedDraft.id,
        JSON.parse(normalizedInputSchemaStr),
        JSON.parse(normalizedOutputConfigStr),
        files,
      );
      upsertProgramVersion(selectedProgram.id, publishedVersion);

      if (nextName !== selectedProgram.name) {
        const updatedProgram = await actions.renameProgram(
          selectedProgram.id,
          nextName,
        );
        updateSelectedProgramName(updatedProgram.name);
      }

      addLog(`✓ Published v${publishedVersion.version ?? nextVersionNumber}.`);
      marbleToast.success(
        `Published v${publishedVersion.version ?? nextVersionNumber}`,
        {
          description: "Existing columns stay pinned until you update them.",
        },
      );
      await refreshPrograms();
    } catch (error) {
      addLog(
        `✗ Publish failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!selectedProgram) {
      addLog("✗ Save this program before running it.");
      return;
    }

    const runnableVersion = draftVersion ?? latestPublishedVersion;

    if (!runnableVersion) {
      addLog("✗ No runnable version is available yet.");
      return;
    }

    setRunning(true);
    setResult(null);
    if (draftVersion) {
      addLog(
        latestPublishedVersion
          ? `ℹ Running draft from v${latestPublishedVersion.version}; live columns remain pinned to v${latestPublishedVersion.version}.`
          : "ℹ Running the current draft; nothing live points at it yet.",
      );
    } else if (hasUnsavedChanges) {
      addLog(
        `ℹ Running saved v${latestPublishedVersion?.version}; local edits will not be included until the draft is created.`,
      );
    }
    addLog(
      `▶ Running "${progName}" (${draftVersion ? "draft" : latestPublishedVersion ? `v${latestPublishedVersion.version}` : "draft"})...`,
    );

    try {
      const nextResult = await actions.testProgram(
        runnableVersion.id,
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
                    const visibleLatestVersion =
                      getLatestPublishedVersion(program);

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
                        {...getChangeTargetProps(
                          changeTargetKey.program(program.id),
                        )}
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
      frame="none"
    >
      <div className="space-y-4 size-full">
        {renameError ? (
          <MarbleAlert tone="error">{renameError}</MarbleAlert>
        ) : null}

        <div className="flex size-full min-h-0 overflow-hidden rounded-md border border-taupe-400 bg-[linear-gradient(180deg,#f8f5ee_0%,#f4efe6_100%)] text-zinc-800 rounded-t-none">
          <div
            className={cx(
              "flex w-60 shrink-0 flex-col border-r",
              shellPanelClassName,
            )}
          >
            <MarbleWorkbenchSection
              actions={
                <MarbleButton
                  onClick={openNewFileModal}
                  size="xs"
                  type="button"
                >
                  <span className="inline-flex items-center gap-1">
                    <DocumentPlusIcon className="h-3.5 w-3.5" />
                    New
                  </span>
                </MarbleButton>
              }
              badge={
                <MarbleBadge className="font-mono">{files.length}</MarbleBadge>
              }
              bodyClassName="bg-transparent"
              className="flex min-h-0 flex-1 flex-col rounded-none border-0 border-b border-taupe-400 bg-transparent shadow-none"
              headerClassName="px-2 py-1.5"
              icon={<FolderOpenIcon className="h-4 w-4" />}
              title="Workspace"
            >
              <fieldset
                aria-label="Program workspace files"
                className="relative flex-1 overflow-hidden border-0 p-0"
                onDragEnter={handleWorkspaceDragEnter}
                onDragLeave={handleWorkspaceDragLeave}
                onDragOver={handleWorkspaceDragOver}
                onDrop={handleWorkspaceDrop}
              >
                <div className="h-full overflow-y-auto p-1.5">
                  {files.length > 0 ? (
                    <div className="space-y-px">
                      {files.map((file) => (
                        <WorkspaceFileTreeRow
                          active={activeFile === file.filename}
                          dirty={dirtyFiles.has(file.filename)}
                          file={file}
                          key={file.filename}
                          onSelect={() => handleSelectFile(file.filename)}
                          targetKey={changeTargetKey.programFile(
                            activeProgramTargetId,
                            file.filename,
                          )}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="px-2 py-3 text-taupe-600 text-[11px] italic">
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
            </MarbleWorkbenchSection>

            <div className="relative shrink-0">
              {versionsCollapsed ? null : (
                <MarbleWorkbenchResizeHandle
                  active={activeResizePanel === "versions"}
                  aria-label="Resize versions panel"
                  className="absolute inset-x-0 top-0"
                  onKeyDown={handlePanelResizeKeyDown("versions")}
                  onPointerCancel={finishPanelResize}
                  onPointerDown={handlePanelResizeStart("versions", -1)}
                  onPointerMove={handlePanelResizeMove}
                  onPointerUp={finishPanelResize}
                  title="Resize versions panel"
                />
              )}

              <MarbleWorkbenchSection
                badge={
                  latestPublishedVersion ? (
                    <MarbleBadge className="font-mono">
                      v{latestPublishedVersion.version}
                    </MarbleBadge>
                  ) : null
                }
                bodyClassName="bg-transparent"
                bodyStyle={{
                  height: versionsHeight,
                }}
                className="shrink-0 rounded-none border-0 bg-transparent shadow-none"
                collapsed={versionsCollapsed}
                collapsible
                headerClassName="px-2 py-1.5"
                icon={<ClockIcon className="h-4 w-4" />}
                onToggleCollapsed={() =>
                  setVersionsCollapsed((current) => !current)
                }
                title="Versions"
              >
                <div className="h-full overflow-y-auto bg-transparent">
                  {programVersions.length > 0 ? (
                    programVersions.map((version) => (
                      <VersionHistoryRow
                        active={version.id === latestPublishedVersion?.id}
                        key={version.id}
                        targetKey={changeTargetKey.programVersion(version.id)}
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
              </MarbleWorkbenchSection>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-taupe-50">
            <div className="border-b border-taupe-200 bg-linear-to-r from-taupe-100 via-taupe-50 to-white px-4 py-3">
              <div
                className="flex items-start justify-between gap-4"
                {...getChangeTargetProps(
                  changeTargetKey.program(activeProgramTargetId),
                )}
              >
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
                    {latestPublishedVersion ? (
                      <MarbleBadge className="font-mono">
                        v{latestPublishedVersion.version}
                      </MarbleBadge>
                    ) : null}
                    {hasUnsavedChanges ? (
                      <MarbleBadge
                        caps
                        tone="warning"
                      >
                        Publish v{nextVersionNumber}
                      </MarbleBadge>
                    ) : null}
                    {draftBootstrapPending || draftSyncPending ? (
                      <MarbleBadge tone="info">Syncing</MarbleBadge>
                    ) : null}
                    {files.length > 0 ? (
                      <MarbleBadge>
                        {countLabel(files.length, "file")}
                      </MarbleBadge>
                    ) : null}
                  </div>
                </div>

                <MarbleButton
                  disabled={
                    saving ||
                    !progName.trim() ||
                    files.length === 0 ||
                    !hasUnsavedChanges
                  }
                  onClick={handleSave}
                  size="sm"
                  type="button"
                  variant="orange"
                >
                  {saving ? "Publishing..." : `Publish v${nextVersionNumber}`}
                </MarbleButton>
              </div>
            </div>

            <MarbleWorkbenchTabs>
              {openTabFiles.length > 0 ? (
                openTabFiles.map((file) => (
                  <MarbleWorkbenchTab
                    active={activeFile === file.filename}
                    className={cx(
                      editorTabBaseClassName,
                      activeFile === file.filename
                        ? editorTabActiveClassName
                        : editorTabIdleClassName,
                    )}
                    dirty={dirtyFiles.has(file.filename)}
                    icon={
                      <DocumentTextIcon
                        className={cx("h-4 w-4", getFileAccent(file.filename))}
                      />
                    }
                    key={file.filename}
                    label={file.filename}
                    onClose={() => handleCloseTab(file.filename)}
                    onSelect={() => setActiveFile(file.filename)}
                  />
                ))
              ) : (
                <div className="flex h-9 items-center px-3 text-[11px] text-taupe-500">
                  Select a file from the workspace to open a tab.
                </div>
              )}
            </MarbleWorkbenchTabs>

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
                  Select or create a file to open a tab.
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
              "flex w-[22rem] shrink-0 flex-col border-l",
              shellPanelClassName,
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-taupe-400 px-3 py-1.5">
              <MarbleFieldLabel className="mb-0 text-taupe-700">
                Draft + Test
              </MarbleFieldLabel>
              <MarbleBadge className="font-mono">
                v{nextVersionNumber}
              </MarbleBadge>
            </div>

            <div className="flex-1 overflow-y-auto">
              <MarbleWorkbenchSection
                actions={
                  pendingChanges.length > 0 ? (
                    <MarbleBadge tone="warning">
                      {countLabel(pendingChanges.length, "change")}
                    </MarbleBadge>
                  ) : null
                }
                badge={
                  <MarbleBadge className="font-mono">
                    {draftVersion ? "Draft" : `v${nextVersionNumber}`}
                  </MarbleBadge>
                }
                bodyClassName={stackedWorkbenchBodyClassName}
                bodyStyle={{
                  height: rightPanelHeights.draftStack,
                }}
                className={stackedWorkbenchSectionClassName}
                collapsed={rightPanelCollapsed.draftStack}
                collapsible
                headerClassName={stackedWorkbenchHeaderClassName}
                icon={<SparklesIcon className="h-4 w-4" />}
                onToggleCollapsed={() =>
                  setRightPanelCollapsed((current) => ({
                    ...current,
                    draftStack: !current.draftStack,
                  }))
                }
                title="Draft Stack"
              >
                <div className="flex h-full flex-col">
                  <div className="flex-1 overflow-y-auto">
                    {draftStackCards.map((change) => (
                      <PendingChangeCard
                        change={change}
                        key={change.id}
                      />
                    ))}
                  </div>
                  <MarbleWorkbenchResizeHandle
                    active={activeResizePanel === "draftStack"}
                    aria-label="Resize draft stack"
                    onKeyDown={handlePanelResizeKeyDown("draftStack")}
                    onPointerCancel={finishPanelResize}
                    onPointerDown={handlePanelResizeStart("draftStack", 1)}
                    onPointerMove={handlePanelResizeMove}
                    onPointerUp={finishPanelResize}
                    title="Resize draft stack"
                  />
                </div>
              </MarbleWorkbenchSection>

              <MarbleWorkbenchSection
                badge={
                  inputSchemaStr !== latestInputSchemaStr ? (
                    <MarbleBadge tone="warning">Draft</MarbleBadge>
                  ) : null
                }
                bodyClassName={stackedWorkbenchBodyClassName}
                bodyStyle={{
                  height: rightPanelHeights.inputSchema,
                }}
                className={stackedWorkbenchSectionClassName}
                collapsed={rightPanelCollapsed.inputSchema}
                collapsible
                headerClassName={stackedWorkbenchHeaderClassName}
                icon={<DocumentTextIcon className="h-4 w-4 text-amber-600" />}
                onToggleCollapsed={() =>
                  setRightPanelCollapsed((current) => ({
                    ...current,
                    inputSchema: !current.inputSchema,
                  }))
                }
                title="Input Schema"
              >
                <div className="flex h-full flex-col p-2">
                  <MarbleTextarea
                    className="min-h-0 flex-1"
                    monospace
                    onChange={(event) => setInputSchemaStr(event.target.value)}
                    size="xs"
                    value={inputSchemaStr}
                    wrapperClassName="w-full flex-1"
                  />
                  <MarbleWorkbenchResizeHandle
                    active={activeResizePanel === "inputSchema"}
                    aria-label="Resize input schema"
                    onKeyDown={handlePanelResizeKeyDown("inputSchema")}
                    onPointerCancel={finishPanelResize}
                    onPointerDown={handlePanelResizeStart("inputSchema", 1)}
                    onPointerMove={handlePanelResizeMove}
                    onPointerUp={finishPanelResize}
                    title="Resize input schema"
                  />
                </div>
              </MarbleWorkbenchSection>

              <MarbleWorkbenchSection
                badge={
                  outputConfigStr !== latestOutputConfigStr ? (
                    <MarbleBadge tone="warning">Draft</MarbleBadge>
                  ) : null
                }
                bodyClassName={stackedWorkbenchBodyClassName}
                bodyStyle={{
                  height: rightPanelHeights.outputConfig,
                }}
                className={stackedWorkbenchSectionClassName}
                collapsed={rightPanelCollapsed.outputConfig}
                collapsible
                headerClassName={stackedWorkbenchHeaderClassName}
                icon={<CodeBracketIcon className="h-4 w-4 text-sky-600" />}
                onToggleCollapsed={() =>
                  setRightPanelCollapsed((current) => ({
                    ...current,
                    outputConfig: !current.outputConfig,
                  }))
                }
                title="Output Config"
              >
                <div className="flex h-full flex-col p-2">
                  <MarbleTextarea
                    className="min-h-0 flex-1"
                    monospace
                    onChange={(event) => setOutputConfigStr(event.target.value)}
                    size="xs"
                    value={outputConfigStr}
                    wrapperClassName="w-full flex-1"
                  />
                  <MarbleWorkbenchResizeHandle
                    active={activeResizePanel === "outputConfig"}
                    aria-label="Resize output config"
                    onKeyDown={handlePanelResizeKeyDown("outputConfig")}
                    onPointerCancel={finishPanelResize}
                    onPointerDown={handlePanelResizeStart("outputConfig", 1)}
                    onPointerMove={handlePanelResizeMove}
                    onPointerUp={finishPanelResize}
                    title="Resize output config"
                  />
                </div>
              </MarbleWorkbenchSection>

              <MarbleWorkbenchSection
                badge={
                  <MarbleBadge
                    caps
                    tone="warning"
                  >
                    Stub
                  </MarbleBadge>
                }
                bodyClassName={stackedWorkbenchBodyClassName}
                bodyStyle={{
                  height: rightPanelHeights.secrets,
                }}
                className={stackedWorkbenchSectionClassName}
                collapsed={rightPanelCollapsed.secrets}
                collapsible
                headerClassName={stackedWorkbenchHeaderClassName}
                icon={<KeyIcon className="h-4 w-4 text-taupe-500" />}
                onToggleCollapsed={() =>
                  setRightPanelCollapsed((current) => ({
                    ...current,
                    secrets: !current.secrets,
                  }))
                }
                title="Secrets"
              >
                <div className="flex h-full flex-col">
                  <div className="flex-1 space-y-3 overflow-y-auto p-3">
                    <p className="text-taupe-600 text-xs">
                      Required environment variables will surface here once
                      secret declarations are wired into the program manifest.
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
                  <MarbleWorkbenchResizeHandle
                    active={activeResizePanel === "secrets"}
                    aria-label="Resize secrets panel"
                    onKeyDown={handlePanelResizeKeyDown("secrets")}
                    onPointerCancel={finishPanelResize}
                    onPointerDown={handlePanelResizeStart("secrets", 1)}
                    onPointerMove={handlePanelResizeMove}
                    onPointerUp={finishPanelResize}
                    title="Resize secrets panel"
                  />
                </div>
              </MarbleWorkbenchSection>

              <MarbleWorkbenchSection
                actions={
                  selectedProgram?.first_party ? (
                    <MarbleBadge
                      caps
                      tone="warning"
                    >
                      Built-in
                    </MarbleBadge>
                  ) : null
                }
                badge={
                  draftVersion ? (
                    <MarbleBadge tone="warning">Draft</MarbleBadge>
                  ) : latestPublishedVersion ? (
                    <MarbleBadge className="font-mono">
                      v{latestPublishedVersion.version}
                    </MarbleBadge>
                  ) : null
                }
                bodyClassName={stackedWorkbenchBodyClassName}
                bodyStyle={{
                  height: rightPanelHeights.testInputs,
                }}
                className={stackedWorkbenchSectionClassName}
                collapsed={rightPanelCollapsed.testInputs}
                collapsible
                headerClassName={stackedWorkbenchHeaderClassName}
                icon={<PlayIcon className="h-4 w-4" />}
                onToggleCollapsed={() =>
                  setRightPanelCollapsed((current) => ({
                    ...current,
                    testInputs: !current.testInputs,
                  }))
                }
                title="Test Inputs"
              >
                <div className="flex h-full flex-col">
                  <div className="flex-1 space-y-4 overflow-y-auto p-3">
                    <p className="border-b border-taupe-200 pb-2 text-[11px] leading-5 text-taupe-500">
                      {draftVersion
                        ? latestPublishedVersion
                          ? `Runs the draft while live columns stay pinned to v${latestPublishedVersion.version}.`
                          : "Runs the draft directly; nothing live points at it yet."
                        : latestPublishedVersion
                          ? `Runs published v${latestPublishedVersion.version}.`
                          : "Save the draft before running it."}
                    </p>
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
                          onChange={(event) =>
                            setManualInput(event.target.value)
                          }
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
                      disabled={
                        running || (!draftVersion && !latestPublishedVersion)
                      }
                      onClick={handleRun}
                      size="sm"
                      type="button"
                      variant="orange"
                    >
                      <span className="inline-flex items-center gap-2">
                        <PlayIcon className="h-4 w-4" />
                        {running
                          ? "Running..."
                          : draftVersion
                            ? "Run Draft"
                            : "Run Published Version"}
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
                  <MarbleWorkbenchResizeHandle
                    active={activeResizePanel === "testInputs"}
                    aria-label="Resize test inputs"
                    onKeyDown={handlePanelResizeKeyDown("testInputs")}
                    onPointerCancel={finishPanelResize}
                    onPointerDown={handlePanelResizeStart("testInputs", 1)}
                    onPointerMove={handlePanelResizeMove}
                    onPointerUp={finishPanelResize}
                    title="Resize test inputs"
                  />
                </div>
              </MarbleWorkbenchSection>
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
