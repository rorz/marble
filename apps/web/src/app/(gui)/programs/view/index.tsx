"use client";

import { marbleToast, useMarbleRouter } from "@marble/ui";
import { useCallback, useState } from "react";
import type { ProgramsPageData } from "../actions";
import { deriveProgramSelection } from "./derive-selection";
import { deriveProgramsViewState } from "./derive-view-state";
import { ProgramEditorView } from "./editor";
import { ProgramsLibraryView } from "./library";
import type { FullProgram, ProgramTestResult } from "./types";
import { useDraftActions } from "./use-draft-actions";
import { useDraftSync } from "./use-draft-sync";
import { useEditorLoader } from "./use-editor-loader";
import { useProgramLog } from "./use-log";
import { usePanelResize } from "./use-panel-resize";
import { useProgramList } from "./use-program-list";
import { usePublishRun } from "./use-publish-run";
import { useSecretState } from "./use-secret-state";
import { useWorkspaceFiles } from "./use-workspace-files";
import { createEditorViewModel, createLibraryViewModel } from "./view-models";

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
  const programList = useProgramList({
    initialPrograms,
    router,
  });
  const [editingSurface, setEditingSurface] = useState<
    null | "crumb" | "title"
  >(null);
  const [renameError, setRenameError] = useState<null | string>(null);

  const [progName, setProgName] = useState("");

  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState<ProgramTestResult | null>(null);
  const { addLog, log, setLog } = useProgramLog();
  const panels = usePanelResize();
  const [selectedVersionView, setSelectedVersionView] = useState<
    "current" | string
  >("current");

  const selection = deriveProgramSelection({
    initialMode,
    initialProgramId,
    programs: programList.programs,
    selectedVersionView,
  });
  const secrets = useSecretState({
    canEditWorkspace: selection.canEditWorkspace,
    initialProgramSecretBindings,
    selectedProgram: selection.selectedProgram,
  });
  const workspace = useWorkspaceFiles({
    addLog,
    canEditWorkspace: selection.canEditWorkspace,
  });
  const derived = deriveProgramsViewState({
    activeFile: workspace.activeFile,
    files: workspace.files,
    openTabs: workspace.openTabs,
    progName,
    programSecretBindings: secrets.programSecretBindings,
    result,
    secretConfigDraft: secrets.secretConfigDraft,
    selection,
    workspaceDragDepth: workspace.workspaceDragDepth,
  });

  useEditorLoader({
    editingSurface,
    isEditorRoute: derived.isEditorRoute,
    isLocalDraftProgram: derived.isLocalDraftProgram,
    latestVersionInputSchema: derived.latestVersionInputSchema,
    selectedProgram: derived.selectedProgram,
    setActiveFile: workspace.setActiveFile,
    setEditingSurface,
    setFiles: workspace.setFiles,
    setInputValues,
    setIsNewFileModalOpen: workspace.setIsNewFileModalOpen,
    setLog,
    setManualInput,
    setNewFileError: workspace.setNewFileError,
    setOpenTabs: workspace.setOpenTabs,
    setProgName,
    setRenameError,
    setResult,
    setSecretConfigDraft: secrets.setSecretConfigDraft,
    setSelectedVersionView,
    setWorkspaceDragDepth: workspace.setWorkspaceDragDepth,
    testInputResetKey: `${derived.activeProgramTargetId}:${derived.visibleVersion?.id ?? "local"}`,
    visibleFiles: derived.visibleFiles,
    workingVersion: derived.workingVersion,
  });

  const draftActions = useDraftActions({
    addLog,
    currentSecretConfigState: derived.currentSecretConfigState,
    currentSecretConfigStr: derived.currentSecretConfigStr,
    draftVersion: derived.draftVersion,
    files: workspace.files,
    latestPublishedVersion: derived.latestPublishedVersion,
    packageManifestError: derived.packageManifestState.error,
    progName,
    programConfigError: derived.programConfigState.error,
    selectedHistoricalVersion: derived.selectedHistoricalVersion,
    selectedProgram: derived.selectedProgram,
    setActiveFile: workspace.setActiveFile,
    setEditingSurface,
    setFiles: workspace.setFiles,
    setOpenTabs: workspace.setOpenTabs,
    setProgName,
    setRenameError,
    setResult,
    setSecretConfigDraft: secrets.setSecretConfigDraft,
    setSelectedVersionView,
    updateSelectedProgramName: programList.updateSelectedProgramName,
    upsertProgramVersion: programList.upsertProgramVersion,
  });

  const draftSync = useDraftSync({
    canEditWorkspace: derived.canEditWorkspace,
    currentSecretConfigState: derived.currentSecretConfigState,
    draftSyncBlockedReason: derived.draftSyncBlockedReason,
    draftVersion: derived.draftVersion,
    ensurePersistedDraftVersion: draftActions.ensurePersistedDraftVersion,
    files: workspace.files,
    hasLocalDraftPayloadChanges: derived.hasLocalDraftPayloadChanges,
    hasVersionChangesAgainstPublished:
      derived.hasVersionChangesAgainstPublished,
    latestPublishedVersion: derived.latestPublishedVersion,
    selectedProgram: derived.selectedProgram,
    upsertProgramVersion: programList.upsertProgramVersion,
  });

  const publishRun = usePublishRun({
    addLog,
    currentSecretConfigState: derived.currentSecretConfigState,
    currentSecretConfigStr: derived.currentSecretConfigStr,
    draftVersion: derived.draftVersion,
    ensurePersistedDraftVersion: draftActions.ensurePersistedDraftVersion,
    files: workspace.files,
    hasUnsavedChanges: derived.hasUnsavedChanges,
    inputValues,
    latestPublishedVersion: derived.latestPublishedVersion,
    manualInput,
    nextVersionNumber: derived.nextVersionNumber,
    packageManifestError: derived.packageManifestState.error,
    progName,
    programConfigError: derived.programConfigState.error,
    refreshPrograms: programList.refreshPrograms,
    selectedHistoricalVersion: derived.selectedHistoricalVersion,
    selectedProgram: derived.selectedProgram,
    setResult,
    updateSelectedProgramName: programList.updateSelectedProgramName,
    upsertProgramVersion: programList.upsertProgramVersion,
    viewingHistoricalVersion: derived.viewingHistoricalVersion,
    visibleVersion: derived.visibleVersion,
  });

  const handleAskAgentToCreateProgram = useCallback(() => {
    marbleToast.message("Ask your agent from the side panel", {
      description: "Describe the program you want and it can create it here.",
    });
  }, []);

  const libraryModel = createLibraryViewModel({
    createError: programList.createError,
    createPending: programList.createPending,
    customPrograms: derived.customPrograms,
    forkingProgramId: programList.forkingProgramId,
    librarySurface: programList.librarySurface,
    onAskAgentToCreateProgram: handleAskAgentToCreateProgram,
    onCreateProgram: programList.handleCreateProgram,
    onForkProgram: programList.handleForkProgram,
    onOpenProgram: programList.handleOpenProgram,
    onSurfaceChange: programList.setLibrarySurface,
    systemPrograms: derived.systemPrograms,
  });

  const editorModel = createEditorViewModel({
    derived,
    draftActions,
    draftSync,
    form: {
      editingSurface,
      inputValues,
      manualInput,
      progName,
      renameError,
      result,
      selectedVersionView,
      setEditingSurface,
      setInputValues,
      setManualInput,
      setProgName,
      setSelectedVersionView,
    },
    initialProgramId,
    initialSecrets,
    log,
    onOpenSecrets: () => router.push("/secrets"),
    panels,
    programList,
    publishRun,
    secrets,
    workspace,
  });

  return derived.isEditorRoute ? (
    <ProgramEditorView model={editorModel} />
  ) : (
    <ProgramsLibraryView model={libraryModel} />
  );
};
