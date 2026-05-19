"use client";

// harness-ignore: max-file-lines -- single dense state machine: ProgramsPageView orchestrates the entire program editor with shared refs across library/editor/version/draft/secret/manifest/file-tree/workbench concerns; lifting would obscure dataflow

import { stringifyPretty } from "@marble/lib/json";
import { getErrorMessage } from "@marble/lib/result";
import { normalizeDisplayLabel } from "@marble/lib/string";
import {
  cx,
  MarbleAlert,
  MarbleBadge,
  MarbleBrandMark,
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
  MarbleModalClose,
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
  marbleToast,
  useMarbleRouter,
} from "@marble/ui";
import {
  ClockIcon,
  CodeIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderOpenIcon,
  GitBranchIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  SparkleIcon,
  UserIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useMarbleWebSessionSdk } from "../../../../lib/marble-sdk-client";
import { createDefaultProgram } from "../../../../lib/program-client";
import { changeTargetKey, getChangeTargetProps } from "../../change-spotlight";
import type { ProgramsPageData } from "../actions";
import * as actions from "../actions";

import {
  DATE_FORMATTER,
  editorTabActiveClassName,
  editorTabBaseClassName,
  editorTabIdleClassName,
  importAccept,
  MonacoEditor,
  monacoEditorOptions,
  rightPanelDefaultHeights,
  shellPanelClassName,
  stackedWorkbenchBodyClassName,
  stackedWorkbenchHeaderClassName,
  stackedWorkbenchSectionClassName,
} from "./constants";
import { CurrentWorkspaceRow } from "./current-workspace-row";
import { DraftStackRow } from "./draft-stack-row";
import {
  createDefaultDraftFiles,
  getFileAccent,
  getProgramFiletype,
  getSuggestedFileName,
  isFileDrag,
  normalizeProgramFiles,
} from "./files";
import { LibraryDockButton } from "./library-dock-button";
import { getProgramPackageManifestState } from "./manifest";
import { getMonacoLanguage, getMonacoModelPath } from "./monaco";
import {
  countLabel,
  getDraftVersion,
  getLatestPublishedVersion,
  sortPrograms,
  sortProgramVersions,
} from "./programs";
import {
  normalizeJsonEditorValue,
  normalizeProgramVersionMutation,
  renameProgram,
  updateProgramSecretBindings,
} from "./sdk";
import {
  createEditableProgramSecretDeclarations,
  describeProgramSecretResolution,
  getEditableProgramSecretConfigState,
  getMissingSecretConfigurationDetail,
  getProgramSecretConfigComparisonValue,
  getSecretDeclarationIssuesById,
  getSuggestedSecretEnvironmentName,
  normalizeStoredProgramSecretConfig,
  secretBindingEntriesToMap,
  secretBindingMapToEntries,
} from "./secret-config";
import {
  type EditableProgramFile,
  type EditableProgramSecretDeclaration,
  type FullProgram,
  type LibrarySurface,
  type PendingChange,
  type ProgramVersionMutation,
  type ProgramVersionWithFiles,
  type ResizablePanelId,
  type RightWorkbenchPanelId,
  workbenchPanelHeightLimits,
} from "./types";
import { VersionHistoryRow } from "./version-history-row";
import {
  buildFieldsFromSchema,
  buildPendingChanges,
  clampWorkbenchPanelHeight,
  getDefaultDraftInputSchema,
  getDefaultDraftOutputConfig,
} from "./workbench";
import { WorkspaceFileTreeRow } from "./workspace-file-tree-row";

type ProgramsPageViewProps = {
  initialMode?: "draft" | "master";
  initialProgramId?: string;
  initialProgramSecretBindings: ProgramsPageData["programSecretBindings"];
  initialPrograms: FullProgram[];
  initialSecrets: ProgramsPageData["secrets"];
};

export const ProgramsPageView = ({
  initialMode = "master",
  initialProgramId,
  initialProgramSecretBindings,
  initialPrograms,
  initialSecrets,
}: ProgramsPageViewProps) => {
  const router = useMarbleRouter();
  const sdk = useMarbleWebSessionSdk();
  const [programs, setPrograms] = useState(() => sortPrograms(initialPrograms));
  const [programSecretBindings, setProgramSecretBindings] = useState(
    initialProgramSecretBindings,
  );
  const [savingProgramSecrets, setSavingProgramSecrets] = useState(false);
  const [createError, setCreateError] = useState<null | string>(null);
  const [createPending, setCreatePending] = useState(false);
  const [librarySurface, setLibrarySurface] = useState<LibrarySurface>(() =>
    initialPrograms.some((program) => program.firstParty) ? "marble" : "mine",
  );
  const [editingSurface, setEditingSurface] = useState<
    null | "crumb" | "title"
  >(null);
  const [renameError, setRenameError] = useState<null | string>(null);

  const [files, setFiles] = useState<EditableProgramFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [progName, setProgName] = useState("");
  const [inputSchemaStr, setInputSchemaStr] = useState("{}");
  const [outputConfigStr, setOutputConfigStr] = useState("{}");
  const [secretConfigDraft, setSecretConfigDraft] = useState<
    EditableProgramSecretDeclaration[]
  >([]);

  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof actions.testProgram>
  > | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const [importingFiles, setImportingFiles] = useState(false);
  const [workspaceDragDepth, setWorkspaceDragDepth] = useState(0);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [draftStackCollapsed, setDraftStackCollapsed] = useState(false);
  const [draftStackHeight, setDraftStackHeight] = useState(196);
  const [versionsCollapsed, setVersionsCollapsed] = useState(false);
  const [versionsHeight, setVersionsHeight] = useState(224);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState<
    Record<RightWorkbenchPanelId, boolean>
  >({
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
  const isMountedRef = useRef(true);
  const resizeStateRef = useRef<null | {
    direction: -1 | 1;
    panelId: ResizablePanelId;
    pointerId: number;
    startHeight: number;
    startY: number;
  }>(null);
  const loadedProgramIdRef = useRef<string | null>(null);
  const draftBootstrapInFlightRef = useRef(false);
  const draftSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [draftBootstrapPending, setDraftBootstrapPending] = useState(false);
  const [draftSyncPending, setDraftSyncPending] = useState(false);
  const [historicalDraftPending, setHistoricalDraftPending] = useState(false);
  const [selectedVersionView, setSelectedVersionView] = useState<
    "current" | string
  >("current");

  useEffect(() => {
    setPrograms(sortPrograms(initialPrograms));
  }, [
    initialPrograms,
  ]);

  useEffect(() => {
    setProgramSecretBindings(initialProgramSecretBindings);
  }, [
    initialProgramSecretBindings,
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
  const firstPartyPrograms = programs.filter((program) => program.firstParty);
  const customPrograms = programs.filter((program) => !program.firstParty);
  const visiblePrograms =
    librarySurface === "marble" ? firstPartyPrograms : customPrograms;
  const programVersions = selectedProgram
    ? sortProgramVersions(selectedProgram.programVersions)
    : [];
  const selectedHistoricalVersion =
    selectedVersionView === "current"
      ? null
      : (programVersions.find(
          (version) => version.id === selectedVersionView,
        ) ?? null);
  const viewingHistoricalVersion = selectedHistoricalVersion !== null;
  const visibleVersion = selectedHistoricalVersion ?? workingVersion;
  const latestVersionInputSchema = visibleVersion?.inputSchema;
  const visibleFiles = viewingHistoricalVersion
    ? normalizeProgramFiles(selectedHistoricalVersion?.programFiles)
    : files;
  const visibleSecretDeclarations = viewingHistoricalVersion
    ? createEditableProgramSecretDeclarations(
        selectedHistoricalVersion?.secretConfig,
      )
    : secretConfigDraft;
  const visibleSecretConfigState = getEditableProgramSecretConfigState(
    visibleSecretDeclarations,
  );
  const visibleSecretDeclarationIssues = getSecretDeclarationIssuesById(
    visibleSecretDeclarations,
  );
  const selectedProgramSecretBindings = selectedProgram
    ? (programSecretBindings[selectedProgram.id] ?? {})
    : {};
  const latestFileContentByName = new Map(
    normalizeProgramFiles(latestPublishedVersion?.programFiles).map((file) => [
      file.filename,
      file.content,
    ]),
  );
  const workingFileContentByName = new Map(
    normalizeProgramFiles(workingVersion?.programFiles).map((file) => [
      file.filename,
      file.content,
    ]),
  );
  const latestInputSchemaStr = stringifyPretty(
    latestPublishedVersion?.inputSchema ?? {},
  );
  const workingInputSchemaStr = stringifyPretty(
    workingVersion?.inputSchema ?? {},
  );
  const latestOutputConfigStr = stringifyPretty(
    latestPublishedVersion?.outputConfig ?? {},
  );
  const workingOutputConfigStr = stringifyPretty(
    workingVersion?.outputConfig ?? {},
  );
  const latestSecretConfigStr = getProgramSecretConfigComparisonValue(
    latestPublishedVersion?.secretConfig,
  );
  const workingSecretConfigStr = getProgramSecretConfigComparisonValue(
    workingVersion?.secretConfig,
  );
  const currentSecretConfigState =
    getEditableProgramSecretConfigState(secretConfigDraft);
  const currentSecretConfigStr =
    currentSecretConfigState.error === null
      ? JSON.stringify(currentSecretConfigState.declarations)
      : null;
  const packageManifestState = getProgramPackageManifestState(files);
  const normalizedInputSchemaStr = normalizeJsonEditorValue(inputSchemaStr);
  const normalizedOutputConfigStr = normalizeJsonEditorValue(outputConfigStr);
  const visibleInputSchemaStr = viewingHistoricalVersion
    ? stringifyPretty(selectedHistoricalVersion?.inputSchema ?? {})
    : inputSchemaStr;
  const visibleOutputConfigStr = viewingHistoricalVersion
    ? stringifyPretty(selectedHistoricalVersion?.outputConfig ?? {})
    : outputConfigStr;
  const nextVersionNumber = latestPublishedVersion
    ? (latestPublishedVersion.version ?? 0) + 1
    : 1;
  const fileByName = new Map(
    visibleFiles.map((file) => [
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
    (activeFile ? fileByName.get(activeFile) : null) ??
    openTabFiles[0] ??
    visibleFiles[0] ??
    null;
  const missingSecretConfigurationDetail =
    result && !result.ok
      ? getMissingSecretConfigurationDetail(result.detail)
      : null;
  const dirtyFiles = viewingHistoricalVersion
    ? new Set<string>()
    : new Set(
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
    latestSecretConfigStr,
    outputConfigStr,
    programName: progName,
    savedProgramName: selectedProgram?.name ?? "",
    secretConfigStr: currentSecretConfigStr ?? "__invalid__",
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
    (currentSecretConfigStr === null
      ? true
      : currentSecretConfigStr !== workingSecretConfigStr) ||
    files.length !== (workingVersion?.programFiles.length ?? 0) ||
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
    (currentSecretConfigStr === null
      ? true
      : currentSecretConfigStr !== latestSecretConfigStr) ||
    files.length !== (latestPublishedVersion?.programFiles.length ?? 0) ||
    files.some(
      (file) => latestFileContentByName.get(file.filename) !== file.content,
    );
  const draftSyncBlockedReason =
    packageManifestState.error !== null
      ? "package.json must be valid before the draft syncs."
      : normalizedInputSchemaStr === null
        ? "Input schema JSON must be valid before the draft syncs."
        : normalizedOutputConfigStr === null
          ? "Output config JSON must be valid before the draft syncs."
          : currentSecretConfigState.error !== null
            ? "Secret requirements must be valid before the draft syncs."
            : null;
  const fields = visibleVersion
    ? buildFieldsFromSchema(
        visibleVersion.inputSchema as Record<string, unknown>,
      )
    : [];
  const hasManualInput =
    (
      (visibleVersion?.outputConfig as Record<string, unknown> | undefined)
        ?.flags as Record<string, unknown> | undefined
    )?.allowManualInput === true;
  const isWorkspaceDropzoneVisible = workspaceDragDepth > 0;
  const canEditWorkspace = !viewingHistoricalVersion;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
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
    setSelectedVersionView("current");
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
      setSecretConfigDraft([]);
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
      const nextFiles = normalizeProgramFiles(workingVersion.programFiles);

      setProgName(selectedProgram?.name ?? "Untitled Program");
      setFiles(nextFiles);
      setSecretConfigDraft(
        createEditableProgramSecretDeclarations(workingVersion.secretConfig),
      );
      setActiveFile(nextFiles[0]?.filename ?? null);
      setOpenTabs(
        nextFiles[0]?.filename
          ? [
              nextFiles[0].filename,
            ]
          : [],
      );
      setInputSchemaStr(stringifyPretty(workingVersion.inputSchema));
      setOutputConfigStr(stringifyPretty(workingVersion.outputConfig));
      return;
    }

    setProgName(selectedProgram?.name ?? "Untitled Program");
    setFiles([]);
    setSecretConfigDraft([]);
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
    const visibleFileNames = new Set(visibleFiles.map((file) => file.filename));

    setOpenTabs((current) => {
      const nextTabs = current.filter((filename) =>
        visibleFileNames.has(filename),
      );
      const resolvedTabs =
        nextTabs.length > 0
          ? nextTabs
          : visibleFiles[0]?.filename
            ? [
                visibleFiles[0].filename,
              ]
            : [];

      if (
        current.length === resolvedTabs.length &&
        current.every((filename, index) => filename === resolvedTabs[index])
      ) {
        return current;
      }

      return resolvedTabs;
    });

    setActiveFile((current) =>
      current && visibleFileNames.has(current)
        ? current
        : (visibleFiles[0]?.filename ?? null),
    );
  }, [
    visibleFiles,
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

  const handleProgramSecretBindingChange = useCallback(
    async (envName: string, nextSecretId: string) => {
      if (!selectedProgram) {
        return;
      }

      const previousBindings = programSecretBindings[selectedProgram.id] ?? {};
      const nextBindings = {
        ...previousBindings,
      };

      if (nextSecretId) {
        nextBindings[envName] = nextSecretId;
      } else {
        delete nextBindings[envName];
      }

      setProgramSecretBindings((current) => ({
        ...current,
        [selectedProgram.id]: nextBindings,
      }));
      setSavingProgramSecrets(true);

      try {
        const savedBindings = await updateProgramSecretBindings(
          sdk,
          selectedProgram.id,
          secretBindingMapToEntries(nextBindings),
        );

        setProgramSecretBindings((current) => ({
          ...current,
          [selectedProgram.id]: secretBindingEntriesToMap(savedBindings),
        }));
      } catch (error) {
        setProgramSecretBindings((current) => ({
          ...current,
          [selectedProgram.id]: previousBindings,
        }));
        marbleToast.error("Secret binding failed", {
          description: getErrorMessage(error),
        });
      } finally {
        setSavingProgramSecrets(false);
      }
    },
    [
      programSecretBindings,
      sdk,
      selectedProgram,
    ],
  );

  const handleAddSecretDeclaration = useCallback(() => {
    if (!canEditWorkspace) {
      return;
    }

    const suggestedEnvName =
      getSuggestedSecretEnvironmentName(secretConfigDraft);

    setSecretConfigDraft((current) => [
      ...current,
      {
        description: "",
        env: suggestedEnvName,
        id: crypto.randomUUID(),
        label: suggestedEnvName,
        required: true,
      },
    ]);
  }, [
    canEditWorkspace,
    secretConfigDraft,
  ]);

  const handleRemoveSecretDeclaration = useCallback(
    (secretId: string) => {
      if (!canEditWorkspace) {
        return;
      }

      setSecretConfigDraft((current) =>
        current.filter((secret) => secret.id !== secretId),
      );
    },
    [
      canEditWorkspace,
    ],
  );

  const handleSecretDeclarationChange = useCallback(
    (
      secretId: string,
      field: "description" | "env" | "label" | "required",
      value: boolean | string,
    ) => {
      if (!canEditWorkspace) {
        return;
      }

      setSecretConfigDraft((current) =>
        current.map((secret) => {
          if (secret.id !== secretId) {
            return secret;
          }

          if (field === "required") {
            return {
              ...secret,
              required: value === true,
            };
          }

          const nextValue = typeof value === "string" ? value : "";

          if (field === "env") {
            return {
              ...secret,
              env: nextValue,
              label:
                secret.label === secret.env || secret.label.trim().length === 0
                  ? nextValue
                  : secret.label,
            };
          }

          return {
            ...secret,
            [field]: nextValue,
          };
        }),
      );
    },
    [
      canEditWorkspace,
    ],
  );

  const upsertProgramVersion = useCallback(
    (
      programId: string,
      nextVersion: ProgramVersionMutation | ProgramVersionWithFiles,
    ) => {
      const normalizedVersion = normalizeProgramVersionMutation(nextVersion);

      setPrograms((current) =>
        sortPrograms(
          current.map((program) =>
            program.id === programId
              ? {
                  ...program,
                  programVersions: [
                    ...program.programVersions.filter(
                      (version) => version.id !== normalizedVersion.id,
                    ),
                    normalizedVersion,
                  ],
                  updatedAt: normalizedVersion.updatedAt,
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
                  updatedAt: new Date().toISOString(),
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

      if (packageManifestState.error) {
        throw new Error(
          `Fix package.json before creating a draft: ${packageManifestState.error}`,
        );
      }

      if (!currentSecretConfigStr) {
        throw new Error("Fix the secret requirements before creating a draft.");
      }

      const { version } = await actions.createDraftVersion(
        selectedProgram.id,
        JSON.parse(normalizedInputSchemaStr),
        JSON.parse(normalizedOutputConfigStr),
        files,
        currentSecretConfigState.declarations,
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
      currentSecretConfigState.declarations,
      currentSecretConfigStr,
      latestPublishedVersion?.version,
      normalizedInputSchemaStr,
      normalizedOutputConfigStr,
      packageManifestState.error,
      selectedProgram,
      upsertProgramVersion,
    ],
  );

  const persistProgramName = useCallback(async () => {
    const nextName = normalizeDisplayLabel(progName, "Untitled Program");

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

    setRenameError(null);
    setEditingSurface(null);
    setProgName(nextName);
    updateSelectedProgramName(nextName);

    try {
      const updated = await renameProgram(sdk, selectedProgram.id, nextName);

      updateSelectedProgramName(updated.name);
      setProgName(updated.name);
      return updated.name;
    } catch (error) {
      updateSelectedProgramName(selectedProgram.name);
      setProgName(selectedProgram.name);
      setRenameError(getErrorMessage(error));
      throw error;
    }
  }, [
    progName,
    sdk,
    selectedProgram,
    updateSelectedProgramName,
  ]);

  const handleCreateDraftFromHistoricalVersion = useCallback(async () => {
    if (!selectedProgram || !selectedHistoricalVersion) {
      return;
    }

    setHistoricalDraftPending(true);

    try {
      const sourceFiles = normalizeProgramFiles(
        selectedHistoricalVersion.programFiles,
      );
      const { version } = await actions.createDraftVersion(
        selectedProgram.id,
        selectedHistoricalVersion.inputSchema,
        selectedHistoricalVersion.outputConfig,
        sourceFiles,
        normalizeStoredProgramSecretConfig(
          selectedHistoricalVersion.secretConfig,
        ),
      );
      const persistedDraft = upsertProgramVersion(selectedProgram.id, version);
      const nextFiles = normalizeProgramFiles(persistedDraft.programFiles);

      setFiles(nextFiles);
      setSecretConfigDraft(
        createEditableProgramSecretDeclarations(persistedDraft.secretConfig),
      );
      setActiveFile(nextFiles[0]?.filename ?? null);
      setOpenTabs(
        nextFiles[0]?.filename
          ? [
              nextFiles[0].filename,
            ]
          : [],
      );
      setInputSchemaStr(stringifyPretty(persistedDraft.inputSchema));
      setOutputConfigStr(stringifyPretty(persistedDraft.outputConfig));
      setSelectedVersionView("current");
      setResult(null);

      addLog(`✓ Draft created from v${selectedHistoricalVersion.version}.`);
      marbleToast.success("Draft created", {
        description: `Forked from v${selectedHistoricalVersion.version}. Existing columns stay pinned to their current published version.`,
      });
    } catch (error) {
      const message = getErrorMessage(error);

      addLog(`✗ Draft creation failed: ${message}`);
      marbleToast.error("Draft creation failed", {
        description: message,
      });
    } finally {
      setHistoricalDraftPending(false);
    }
  }, [
    addLog,
    selectedHistoricalVersion,
    selectedProgram,
    upsertProgramVersion,
  ]);

  useEffect(() => {
    if (
      !selectedProgram ||
      draftVersion ||
      draftBootstrapInFlightRef.current ||
      !latestPublishedVersion ||
      !hasVersionChangesAgainstPublished
    ) {
      return;
    }

    if (draftSyncBlockedReason !== null) {
      return;
    }

    draftBootstrapInFlightRef.current = true;
    setDraftBootstrapPending(true);

    void (async () => {
      try {
        await ensurePersistedDraftVersion();
      } catch {
      } finally {
        draftBootstrapInFlightRef.current = false;
        if (isMountedRef.current) {
          setDraftBootstrapPending(false);
        }
      }
    })();

    return () => {};
  }, [
    draftVersion,
    draftSyncBlockedReason,
    ensurePersistedDraftVersion,
    hasVersionChangesAgainstPublished,
    latestPublishedVersion,
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

    if (draftSyncBlockedReason !== null) {
      if (draftSyncTimeoutRef.current) {
        clearTimeout(draftSyncTimeoutRef.current);
        draftSyncTimeoutRef.current = null;
      }
      setDraftSyncPending(false);
      return;
    }

    if (draftSyncTimeoutRef.current) {
      clearTimeout(draftSyncTimeoutRef.current);
    }

    setDraftSyncPending(true);
    draftSyncTimeoutRef.current = setTimeout(() => {
      void (async () => {
        const inputSchema = normalizedInputSchemaStr;
        const outputConfig = normalizedOutputConfigStr;

        if (!inputSchema || !outputConfig) {
          setDraftSyncPending(false);
          draftSyncTimeoutRef.current = null;
          return;
        }

        try {
          const syncedDraft = await actions.syncDraftVersion(
            draftVersion.id,
            JSON.parse(inputSchema),
            JSON.parse(outputConfig),
            files,
            currentSecretConfigState.declarations,
          );
          upsertProgramVersion(selectedProgram.id, syncedDraft);
        } catch {
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
    currentSecretConfigState.declarations,
    draftVersion,
    draftSyncBlockedReason,
    files,
    hasLocalDraftPayloadChanges,
    normalizedInputSchemaStr,
    normalizedOutputConfigStr,
    selectedProgram,
    upsertProgramVersion,
  ]);

  const openNewFileModal = () => {
    if (!canEditWorkspace) {
      return;
    }

    setNewFileName(getSuggestedFileName(files));
    setNewFileError(null);
    setIsNewFileModalOpen(true);
  };

  const closeNewFileModal = () => {
    setIsNewFileModalOpen(false);
    setNewFileError(null);
  };

  const handleCreateFile = () => {
    if (!canEditWorkspace) {
      return;
    }

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
    if (!canEditWorkspace) {
      return;
    }

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
      addLog(`✗ File import failed: ${getErrorMessage(error)}`);
    } finally {
      setImportingFiles(false);
      setWorkspaceDragDepth(0);
    }
  };

  const handleWorkspaceDragEnter = (
    event: ReactDragEvent<HTMLFieldSetElement>,
  ) => {
    if (
      !canEditWorkspace ||
      importingFiles ||
      !isFileDrag(event.dataTransfer)
    ) {
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
    if (
      !canEditWorkspace ||
      importingFiles ||
      !isFileDrag(event.dataTransfer)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleWorkspaceDrop = (event: ReactDragEvent<HTMLFieldSetElement>) => {
    if (!canEditWorkspace) {
      return;
    }

    if (!isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setWorkspaceDragDepth(0);
  };

  const handleCodeChange = (newCode: string) => {
    if (!canEditWorkspace || !activeFile) {
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
    panelId === "draftStack"
      ? draftStackHeight
      : panelId === "versions"
        ? versionsHeight
        : rightPanelHeights[panelId];

  const setPanelHeight = (panelId: ResizablePanelId, nextHeight: number) => {
    if (panelId === "draftStack") {
      setDraftStackHeight(nextHeight);
      return;
    }

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
    if (viewingHistoricalVersion) {
      addLog("✗ Return to the current workspace before publishing.");
      return;
    }

    if (!selectedProgram) {
      addLog("✗ Create a program before publishing a version.");
      return;
    }

    const nextName = normalizeDisplayLabel(progName, "Untitled Program");

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

      if (packageManifestState.error) {
        throw new Error(`Invalid package.json: ${packageManifestState.error}`);
      }

      if (!currentSecretConfigStr) {
        throw new Error("Secret requirements are invalid.");
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
        currentSecretConfigState.declarations,
      );
      upsertProgramVersion(selectedProgram.id, publishedVersion);

      if (nextName !== selectedProgram.name) {
        const updatedProgram = await renameProgram(
          sdk,
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
      addLog(`✗ Publish failed: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    if (!selectedProgram) {
      addLog("✗ Save this program before running it.");
      return;
    }

    const runnableVersion = visibleVersion;

    if (!runnableVersion) {
      addLog("✗ No runnable version is available yet.");
      return;
    }

    setRunning(true);
    setResult(null);
    if (viewingHistoricalVersion && selectedHistoricalVersion) {
      addLog(`ℹ Running published v${selectedHistoricalVersion.version}.`);
    } else if (draftVersion) {
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
      `▶ Running "${progName}" (${viewingHistoricalVersion && selectedHistoricalVersion ? `v${selectedHistoricalVersion.version}` : draftVersion ? "draft" : latestPublishedVersion ? `v${latestPublishedVersion.version}` : "draft"})...`,
    );

    try {
      const nextResult = await actions.testProgram(
        runnableVersion.id,
        inputValues,
        manualInput || undefined,
      );

      setResult(nextResult);
      addLog(
        nextResult.ok
          ? "✓ Success"
          : nextResult.errorType === "MissingSecretConfiguration"
            ? `⏸ ${nextResult.error}`
            : `✗ Failed: ${nextResult.error}`,
      );
    } catch (error) {
      const message = getErrorMessage(error);

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
      const { programId } = await createDefaultProgram(sdk);
      router.push(`/programs/${programId}`);
    } catch (error) {
      setCreateError(getErrorMessage(error));
      setCreatePending(false);
    }
  }, [
    router,
    sdk,
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
                  icon={<MarbleBrandMark className="size-10" />}
                  label="Marble"
                  onClick={() => setLibrarySurface("marble")}
                  subtitle="First party"
                />
                <LibraryDockButton
                  active={librarySurface === "mine"}
                  count={customPrograms.length}
                  icon={<UserIcon size={24} />}
                  label="My"
                  onClick={() => setLibrarySurface("mine")}
                  subtitle="Custom"
                />
                <LibraryDockButton
                  active={librarySurface === "marketplace"}
                  icon={<MagnifyingGlassIcon size={24} />}
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
                                new Date(program.updatedAt),
                              )}
                            </span>
                          </>
                        }
                        descriptionClassName="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500"
                        icon={
                          program.firstParty ? (
                            <SparkleIcon
                              className="text-orange-600"
                              size={16}
                            />
                          ) : (
                            <CodeIcon
                              className="text-taupe-500"
                              size={16}
                            />
                          )
                        }
                        key={program.id}
                        meta={
                          visibleLatestVersion ? (
                            <span className="font-mono text-[11px] text-taupe-500">
                              {countLabel(
                                visibleLatestVersion.programFiles.length,
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
                disabled={false}
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

        <div className="flex size-full min-h-0 overflow-hidden rounded-md border border-taupe-400 bg-workbench-surface text-zinc-800 rounded-t-none">
          <div
            className={cx(
              "flex w-60 shrink-0 flex-col border-r",
              shellPanelClassName,
            )}
          >
            <MarbleWorkbenchSection
              actions={
                <MarbleButton
                  disabled={!canEditWorkspace}
                  iconLeft={FilePlusIcon}
                  onClick={openNewFileModal}
                  size="xs"
                  type="button"
                >
                  New
                </MarbleButton>
              }
              badge={
                <MarbleBadge className="font-mono">
                  {visibleFiles.length}
                </MarbleBadge>
              }
              bodyClassName="bg-transparent"
              className="flex min-h-0 flex-1 flex-col rounded-none border-0 border-b border-taupe-400 bg-transparent shadow-none"
              headerClassName="px-2 py-1.5"
              icon={<FolderOpenIcon size={16} />}
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
                  {visibleFiles.length > 0 ? (
                    <div className="space-y-px">
                      {visibleFiles.map((file) => (
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
                    <div className="px-2 py-3 text-[11px] text-taupe-600 italic">
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
                      icon={<FilePlusIcon size={20} />}
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
              {draftStackCollapsed ? null : (
                <MarbleWorkbenchResizeHandle
                  active={activeResizePanel === "draftStack"}
                  aria-label="Resize draft stack panel"
                  className="absolute inset-x-0 top-0"
                  onKeyDown={handlePanelResizeKeyDown("draftStack")}
                  onPointerCancel={finishPanelResize}
                  onPointerDown={handlePanelResizeStart("draftStack", -1)}
                  onPointerMove={handlePanelResizeMove}
                  onPointerUp={finishPanelResize}
                  title="Resize draft stack panel"
                />
              )}

              <MarbleWorkbenchSection
                actions={
                  pendingChanges.length > 0 ? (
                    <MarbleBadge tone="warning">
                      {countLabel(pendingChanges.length, "change")}
                    </MarbleBadge>
                  ) : null
                }
                badge={
                  draftVersion ? (
                    <MarbleBadge tone="warning">Draft</MarbleBadge>
                  ) : latestPublishedVersion ? (
                    <MarbleBadge className="font-mono">
                      v{nextVersionNumber}
                    </MarbleBadge>
                  ) : null
                }
                bodyClassName="bg-transparent"
                bodyStyle={{
                  height: draftStackHeight,
                }}
                className="shrink-0 rounded-none border-0 border-b border-taupe-400 bg-transparent shadow-none"
                collapsed={draftStackCollapsed}
                collapsible
                headerClassName="px-2 py-1.5"
                icon={
                  <GitBranchIcon
                    className="text-taupe-700"
                    size={16}
                    weight="regular"
                  />
                }
                onToggleCollapsed={() =>
                  setDraftStackCollapsed((current) => !current)
                }
                title="Draft Stack"
              >
                <div className="h-full overflow-y-auto overscroll-contain bg-transparent">
                  {draftStackCards.map((change) => (
                    <DraftStackRow
                      change={change}
                      key={change.id}
                    />
                  ))}
                </div>
              </MarbleWorkbenchSection>
            </div>

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
                icon={<ClockIcon size={16} />}
                onToggleCollapsed={() =>
                  setVersionsCollapsed((current) => !current)
                }
                title="Versions"
              >
                <div className="h-full overflow-y-auto overscroll-contain bg-transparent">
                  {programVersions.length > 0 ? (
                    <>
                      {draftVersion ? (
                        <CurrentWorkspaceRow
                          active={selectedVersionView === "current"}
                          draftVersion={draftVersion}
                          latestPublishedVersion={latestPublishedVersion}
                          onSelect={() => setSelectedVersionView("current")}
                        />
                      ) : null}
                      {programVersions.map((version) => (
                        <VersionHistoryRow
                          active={
                            selectedVersionView === version.id ||
                            (!draftVersion &&
                              selectedVersionView === "current" &&
                              version.id === latestPublishedVersion?.id)
                          }
                          activeBadge={
                            !draftVersion &&
                            selectedVersionView === "current" &&
                            version.id === latestPublishedVersion?.id
                              ? "Live"
                              : "Viewing"
                          }
                          key={version.id}
                          onSelect={() =>
                            setSelectedVersionView(
                              !draftVersion &&
                                version.id === latestPublishedVersion?.id
                                ? "current"
                                : version.id,
                            )
                          }
                          targetKey={changeTargetKey.programVersion(version.id)}
                          version={version}
                        />
                      ))}
                    </>
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
                    disabled={viewingHistoricalVersion}
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
                    {selectedProgram?.firstParty ? (
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
                    {viewingHistoricalVersion && selectedHistoricalVersion ? (
                      <MarbleBadge tone="neutral">
                        Viewing v{selectedHistoricalVersion.version}
                      </MarbleBadge>
                    ) : draftVersion && latestPublishedVersion ? (
                      <MarbleBadge tone="warning">
                        Draft from v{latestPublishedVersion.version}
                      </MarbleBadge>
                    ) : draftVersion ? (
                      <MarbleBadge tone="warning">Draft</MarbleBadge>
                    ) : latestPublishedVersion ? (
                      <MarbleBadge className="font-mono">
                        Published v{latestPublishedVersion.version}
                      </MarbleBadge>
                    ) : null}
                    {visibleFiles.length > 0 ? (
                      <MarbleBadge>
                        {countLabel(visibleFiles.length, "file")}
                      </MarbleBadge>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {draftBootstrapPending ||
                  draftSyncPending ||
                  historicalDraftPending ? (
                    <span className="text-[11px] text-taupe-500">
                      Syncing draft...
                    </span>
                  ) : draftSyncBlockedReason &&
                    canEditWorkspace &&
                    hasUnsavedChanges ? (
                    <span className="text-[11px] text-amber-700">
                      Draft sync paused
                    </span>
                  ) : null}

                  {viewingHistoricalVersion && draftVersion ? (
                    <MarbleButton
                      onClick={() => setSelectedVersionView("current")}
                      size="sm"
                      type="button"
                    >
                      Return to draft
                    </MarbleButton>
                  ) : null}

                  {viewingHistoricalVersion &&
                  !draftVersion &&
                  selectedHistoricalVersion ? (
                    <MarbleButton
                      disabled={historicalDraftPending}
                      onClick={() =>
                        void handleCreateDraftFromHistoricalVersion()
                      }
                      size="sm"
                      type="button"
                    >
                      {historicalDraftPending
                        ? "Creating draft..."
                        : `Create draft from v${selectedHistoricalVersion.version}`}
                    </MarbleButton>
                  ) : null}

                  <MarbleButton
                    disabled={
                      viewingHistoricalVersion ||
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
                    {saving ? "Publishing..." : "Publish version"}
                  </MarbleButton>
                </div>
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
                      <FileTextIcon
                        className={getFileAccent(file.filename)}
                        size={16}
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
                    options={{
                      ...monacoEditorOptions,
                      readOnly: viewingHistoricalVersion,
                    }}
                    path={getMonacoModelPath(
                      viewingHistoricalVersion
                        ? (selectedHistoricalVersion?.id ??
                            initialProgramId ??
                            null)
                        : (initialProgramId ?? null),
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
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MarbleWorkbenchSection
                badge={
                  !viewingHistoricalVersion &&
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
                icon={
                  <FileTextIcon
                    className="text-amber-600"
                    size={16}
                  />
                }
                onToggleCollapsed={() =>
                  setRightPanelCollapsed((current) => ({
                    ...current,
                    inputSchema: !current.inputSchema,
                  }))
                }
                title="Input Schema"
              >
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1 p-2">
                    <MarbleTextarea
                      className="h-full min-h-full resize-none leading-5"
                      monospace
                      onChange={(event) =>
                        setInputSchemaStr(event.target.value)
                      }
                      readOnly={viewingHistoricalVersion}
                      size="xs"
                      value={visibleInputSchemaStr}
                      wrapperClassName="flex h-full w-full flex-1"
                    />
                  </div>
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
                  !viewingHistoricalVersion &&
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
                icon={
                  <CodeIcon
                    className="text-sky-600"
                    size={16}
                  />
                }
                onToggleCollapsed={() =>
                  setRightPanelCollapsed((current) => ({
                    ...current,
                    outputConfig: !current.outputConfig,
                  }))
                }
                title="Output Config"
              >
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1 p-2">
                    <MarbleTextarea
                      className="h-full min-h-full resize-none leading-5"
                      monospace
                      onChange={(event) =>
                        setOutputConfigStr(event.target.value)
                      }
                      readOnly={viewingHistoricalVersion}
                      size="xs"
                      value={visibleOutputConfigStr}
                      wrapperClassName="flex h-full w-full flex-1"
                    />
                  </div>
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
                actions={
                  canEditWorkspace ? (
                    <MarbleButton
                      onClick={handleAddSecretDeclaration}
                      size="xs"
                      type="button"
                      variant="light"
                    >
                      Add
                    </MarbleButton>
                  ) : null
                }
                badge={
                  visibleSecretDeclarations.length > 0 ? (
                    <MarbleBadge
                      caps
                      tone={
                        visibleSecretDeclarations.some((secret) => {
                          const declarationIssue =
                            visibleSecretDeclarationIssues[secret.id];

                          if (declarationIssue) {
                            return true;
                          }

                          const normalizedEnvName = secret.env.trim();
                          const resolution = describeProgramSecretResolution(
                            {
                              ...(secret.description.trim().length > 0
                                ? {
                                    description: secret.description.trim(),
                                  }
                                : {}),
                              env: normalizedEnvName,
                              label:
                                secret.label.trim().length > 0
                                  ? secret.label.trim()
                                  : normalizedEnvName,
                              required: secret.required,
                            },
                            selectedProgramSecretBindings[normalizedEnvName],
                            initialSecrets,
                          );

                          return resolution.badgeTone === "warning";
                        })
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {visibleSecretDeclarations.length} configured
                    </MarbleBadge>
                  ) : null
                }
                bodyClassName={stackedWorkbenchBodyClassName}
                bodyStyle={{
                  height: rightPanelHeights.secrets,
                }}
                className={stackedWorkbenchSectionClassName}
                collapsed={rightPanelCollapsed.secrets}
                collapsible
                headerClassName={stackedWorkbenchHeaderClassName}
                icon={
                  <KeyIcon
                    className="text-taupe-500"
                    size={16}
                  />
                }
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
                    <p className="text-taupe-600 text-xs leading-5">
                      Secret requirements live on the version. Program defaults
                      apply everywhere unless a column overrides them.
                    </p>

                    {!selectedProgram ? (
                      <MarbleAlert
                        size="sm"
                        tone="neutral"
                      >
                        Save this program once before persisting default secret
                        bindings.
                      </MarbleAlert>
                    ) : null}

                    {visibleSecretConfigState.error ? (
                      <MarbleAlert
                        size="sm"
                        tone="warning"
                      >
                        {visibleSecretConfigState.error}
                      </MarbleAlert>
                    ) : null}

                    {initialSecrets.length === 0 ? (
                      <div className="rounded-xs border border-taupe-200 bg-white/80 p-3">
                        <div className="text-xs text-taupe-700">
                          No named secrets are available yet.
                        </div>
                        <div className="mt-3">
                          <MarbleButton
                            onClick={() => router.push("/secrets")}
                            size="xs"
                            variant="light"
                          >
                            Open Secrets
                          </MarbleButton>
                        </div>
                      </div>
                    ) : null}

                    {savingProgramSecrets ? (
                      <MarbleAlert
                        size="sm"
                        tone="neutral"
                      >
                        Saving default secret bindings…
                      </MarbleAlert>
                    ) : null}

                    {visibleSecretDeclarations.length === 0 &&
                    !visibleSecretConfigState.error ? (
                      <p className="text-taupe-600 text-xs">
                        No secret requirements are declared for this version.
                      </p>
                    ) : null}

                    {visibleSecretDeclarations.map((secret) => {
                      const declarationIssue =
                        visibleSecretDeclarationIssues[secret.id];
                      const normalizedEnvName = secret.env.trim();
                      const normalizedLabel =
                        secret.label.trim().length > 0
                          ? secret.label.trim()
                          : normalizedEnvName;
                      const explicitSecretId = normalizedEnvName
                        ? selectedProgramSecretBindings[normalizedEnvName]
                        : undefined;
                      const resolution =
                        declarationIssue === null
                          ? describeProgramSecretResolution(
                              {
                                ...(secret.description.trim().length > 0
                                  ? {
                                      description: secret.description.trim(),
                                    }
                                  : {}),
                                env: normalizedEnvName,
                                label: normalizedLabel,
                                required: secret.required,
                              },
                              explicitSecretId,
                              initialSecrets,
                            )
                          : null;

                      return (
                        <div
                          className="space-y-3 rounded-xs border border-taupe-200 bg-white/85 px-3 py-3"
                          key={secret.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-mono text-[12px] text-taupe-950">
                                  {normalizedEnvName || "NEW_SECRET"}
                                </span>
                                {resolution ? (
                                  <MarbleBadge tone={resolution.badgeTone}>
                                    {resolution.badgeLabel}
                                  </MarbleBadge>
                                ) : null}
                                <MarbleBadge
                                  tone={secret.required ? "warning" : "neutral"}
                                >
                                  {secret.required ? "Required" : "Optional"}
                                </MarbleBadge>
                              </div>
                              <div className="text-[11px] text-taupe-700">
                                {normalizedLabel || "Label this secret"}
                              </div>
                              {secret.description.trim().length > 0 ? (
                                <div className="text-[11px] text-taupe-500">
                                  {secret.description.trim()}
                                </div>
                              ) : null}
                            </div>
                            {canEditWorkspace ? (
                              <MarbleButton
                                onClick={() =>
                                  handleRemoveSecretDeclaration(secret.id)
                                }
                                size="xs"
                                type="button"
                                variant="light"
                              >
                                Remove
                              </MarbleButton>
                            ) : null}
                          </div>

                          {declarationIssue ? (
                            <MarbleAlert
                              size="sm"
                              tone="warning"
                            >
                              {declarationIssue}
                            </MarbleAlert>
                          ) : null}

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                              <MarbleFieldLabel className="text-taupe-700">
                                Env var
                              </MarbleFieldLabel>
                              <MarbleInput
                                disabled={!canEditWorkspace}
                                onChange={(event) =>
                                  handleSecretDeclarationChange(
                                    secret.id,
                                    "env",
                                    event.target.value,
                                  )
                                }
                                size="xs"
                                type="text"
                                value={secret.env}
                                wrapperClassName="w-full"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <MarbleFieldLabel className="text-taupe-700">
                                Label
                              </MarbleFieldLabel>
                              <MarbleInput
                                disabled={!canEditWorkspace}
                                onChange={(event) =>
                                  handleSecretDeclarationChange(
                                    secret.id,
                                    "label",
                                    event.target.value,
                                  )
                                }
                                size="xs"
                                type="text"
                                value={secret.label}
                                wrapperClassName="w-full"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem]">
                            <div className="space-y-1.5">
                              <MarbleFieldLabel className="text-taupe-700">
                                Description
                              </MarbleFieldLabel>
                              <MarbleTextarea
                                className="min-h-20 resize-y"
                                disabled={!canEditWorkspace}
                                onChange={(event) =>
                                  handleSecretDeclarationChange(
                                    secret.id,
                                    "description",
                                    event.target.value,
                                  )
                                }
                                size="xs"
                                value={secret.description}
                                wrapperClassName="w-full"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <MarbleFieldLabel className="text-taupe-700">
                                Requirement
                              </MarbleFieldLabel>
                              <MarbleSelect
                                disabled={!canEditWorkspace}
                                onChange={(event) =>
                                  handleSecretDeclarationChange(
                                    secret.id,
                                    "required",
                                    event.target.value === "required",
                                  )
                                }
                                size="xs"
                                value={
                                  secret.required ? "required" : "optional"
                                }
                                wrapperClassName="w-full"
                              >
                                <option value="required">Required</option>
                                <option value="optional">Optional</option>
                              </MarbleSelect>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <MarbleFieldLabel className="text-taupe-700">
                              Default secret
                            </MarbleFieldLabel>
                            <MarbleSelect
                              disabled={
                                !selectedProgram ||
                                savingProgramSecrets ||
                                declarationIssue !== null
                              }
                              onChange={(event) =>
                                handleProgramSecretBindingChange(
                                  normalizedEnvName,
                                  event.target.value,
                                )
                              }
                              size="xs"
                              value={explicitSecretId ?? ""}
                              wrapperClassName="w-full"
                            >
                              <option value="">
                                {resolution?.implicitSecret
                                  ? `Use matching secret (${resolution.implicitSecret.name})`
                                  : "No default binding"}
                              </option>
                              {explicitSecretId &&
                              !initialSecrets.some(
                                (secret) => secret.id === explicitSecretId,
                              ) ? (
                                <option value={explicitSecretId}>
                                  Missing secret
                                </option>
                              ) : null}
                              {initialSecrets.map((secret) => (
                                <option
                                  key={secret.id}
                                  value={secret.id}
                                >
                                  {secret.name}
                                </option>
                              ))}
                            </MarbleSelect>
                          </div>

                          <div className="text-[11px] text-taupe-500">
                            {declarationIssue
                              ? "Fix this declaration before draft sync resumes."
                              : resolution?.helperText}
                          </div>
                        </div>
                      );
                    })}
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
            </div>

            <div className="relative mt-auto shrink-0">
              {rightPanelCollapsed.testInputs ? null : (
                <MarbleWorkbenchResizeHandle
                  active={activeResizePanel === "testInputs"}
                  aria-label="Resize test inputs"
                  className="absolute inset-x-0 top-0"
                  onKeyDown={handlePanelResizeKeyDown("testInputs")}
                  onPointerCancel={finishPanelResize}
                  onPointerDown={handlePanelResizeStart("testInputs", -1)}
                  onPointerMove={handlePanelResizeMove}
                  onPointerUp={finishPanelResize}
                  title="Resize test inputs"
                />
              )}

              <MarbleWorkbenchSection
                actions={
                  selectedProgram?.firstParty ? (
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
                className="rounded-none border-x-0 border-b-0 bg-transparent shadow-none"
                collapsed={rightPanelCollapsed.testInputs}
                collapsible
                headerClassName={stackedWorkbenchHeaderClassName}
                icon={<PlayIcon size={16} />}
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
                      iconLeft={PlayIcon}
                      onClick={handleRun}
                      size="sm"
                      type="button"
                      variant="orange"
                    >
                      {running
                        ? "Running..."
                        : draftVersion
                          ? "Run Draft"
                          : "Run Published Version"}
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
                        {result.ok ? (
                          <div className="max-h-48 overflow-auto break-words px-3 py-2 font-mono text-[11px] leading-5 text-taupe-800">
                            {stringifyPretty(result.output)}
                          </div>
                        ) : missingSecretConfigurationDetail ? (
                          <div className="space-y-3 px-3 py-3">
                            <MarbleAlert
                              size="sm"
                              tone="warning"
                            >
                              This run is waiting for secret configuration.
                            </MarbleAlert>
                            <div className="space-y-2">
                              {missingSecretConfigurationDetail.missingSecrets.map(
                                (secret) => (
                                  <div
                                    className="rounded-xs border border-taupe-200 bg-white/70 px-3 py-2"
                                    key={secret.envName}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[11px] text-taupe-900">
                                        {secret.envName}
                                      </span>
                                      <MarbleBadge tone="warning">
                                        {secret.bindingSource === "program"
                                          ? "Program"
                                          : secret.bindingSource === "column"
                                            ? "Column"
                                            : "Auto"}
                                      </MarbleBadge>
                                    </div>
                                    <div className="mt-1 text-[11px] text-taupe-600">
                                      {secret.label}
                                    </div>
                                    {secret.description ? (
                                      <div className="mt-1 text-[11px] text-taupe-500">
                                        {secret.description}
                                      </div>
                                    ) : null}
                                  </div>
                                ),
                              )}
                            </div>
                            <MarbleButton
                              onClick={() => router.push("/secrets")}
                              size="xs"
                              variant="light"
                            >
                              Open Secrets
                            </MarbleButton>
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-auto break-words px-3 py-2 font-mono text-[11px] leading-5 text-taupe-800">
                            {result.error}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
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
              <MarbleModalClose onClick={closeNewFileModal} />
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
                  icon={<FilePlusIcon size={20} />}
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
};
