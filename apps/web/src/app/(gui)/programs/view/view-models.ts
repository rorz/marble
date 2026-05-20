import type { Dispatch, SetStateAction } from "react";
import type { ProgramsPageData } from "../actions";
import type { deriveProgramsViewState } from "./derive-view-state";
import type {
  FullProgram,
  LibrarySurface,
  ProgramEditorViewModel,
  ProgramsLibraryViewModel,
} from "./types";
import type { useDraftActions } from "./use-draft-actions";
import type { useDraftSync } from "./use-draft-sync";
import type { usePanelResize } from "./use-panel-resize";
import type { useProgramList } from "./use-program-list";
import type { usePublishRun } from "./use-publish-run";
import type { useSecretState } from "./use-secret-state";
import type { useWorkspaceFiles } from "./use-workspace-files";

type CreateLibraryViewModelInput = {
  createError: null | string;
  createPending: boolean;
  customPrograms: FullProgram[];
  forkingProgramId: null | string;
  librarySurface: LibrarySurface;
  onAskAgentToCreateProgram: () => void;
  onCreateProgram: () => Promise<void>;
  onForkProgram: (program: FullProgram) => Promise<void>;
  onOpenProgram: (programId: string) => void;
  onSurfaceChange: Dispatch<SetStateAction<LibrarySurface>>;
  systemPrograms: FullProgram[];
};

type EditorFormState = {
  editingSurface: null | "crumb" | "title";
  inputSchemaStr: string;
  inputValues: Record<string, string>;
  manualInput: string;
  outputConfigStr: string;
  progName: string;
  renameError: null | string;
  result: ProgramEditorViewModel["result"];
  selectedVersionView: "current" | string;
  setEditingSurface: Dispatch<SetStateAction<null | "crumb" | "title">>;
  setInputSchemaStr: Dispatch<SetStateAction<string>>;
  setInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  setManualInput: Dispatch<SetStateAction<string>>;
  setOutputConfigStr: Dispatch<SetStateAction<string>>;
  setProgName: Dispatch<SetStateAction<string>>;
  setSelectedVersionView: Dispatch<SetStateAction<"current" | string>>;
};

type CreateEditorViewModelInput = {
  derived: ReturnType<typeof deriveProgramsViewState>;
  draftActions: ReturnType<typeof useDraftActions>;
  draftSync: ReturnType<typeof useDraftSync>;
  form: EditorFormState;
  initialProgramId?: string;
  initialSecrets: ProgramsPageData["secrets"];
  log: string[];
  onOpenSecrets: () => void;
  panels: ReturnType<typeof usePanelResize>;
  programList: Pick<
    ReturnType<typeof useProgramList>,
    "forkingProgramId" | "handleForkProgram"
  >;
  publishRun: ReturnType<typeof usePublishRun>;
  secrets: ReturnType<typeof useSecretState>;
  workspace: ReturnType<typeof useWorkspaceFiles>;
};

export const createLibraryViewModel = ({
  createError,
  createPending,
  customPrograms,
  forkingProgramId,
  librarySurface,
  onAskAgentToCreateProgram,
  onCreateProgram,
  onForkProgram,
  onOpenProgram,
  onSurfaceChange,
  systemPrograms,
}: CreateLibraryViewModelInput) => {
  return {
    createError,
    createPending,
    customPrograms,
    forkingProgramId,
    librarySurface,
    onAskAgentToCreateProgram,
    onCreateProgram: () => void onCreateProgram(),
    onForkProgram: (program) => void onForkProgram(program),
    onOpenProgram,
    onSurfaceChange,
    systemPrograms,
  } satisfies ProgramsLibraryViewModel;
};

export const createEditorViewModel = ({
  derived,
  draftActions,
  draftSync,
  form,
  initialProgramId,
  initialSecrets,
  log,
  onOpenSecrets,
  panels,
  programList,
  publishRun,
  secrets,
  workspace,
}: CreateEditorViewModelInput) => {
  return {
    activeFile: workspace.activeFile,
    activeFileObj: derived.activeFileObj,
    activeProgramTargetId: derived.activeProgramTargetId,
    activeResizePanel: panels.activeResizePanel,
    canEditWorkspace: derived.canEditWorkspace,
    closeNewFileModal: workspace.closeNewFileModal,
    dirtyFiles: derived.dirtyFiles,
    draftBootstrapPending: draftSync.draftBootstrapPending,
    draftStackCards: derived.draftStackCards,
    draftStackCollapsed: panels.draftStackCollapsed,
    draftStackHeight: panels.draftStackHeight,
    draftSyncBlockedReason: derived.draftSyncBlockedReason,
    draftSyncPending: draftSync.draftSyncPending,
    draftVersion: derived.draftVersion,
    editingSurface: form.editingSurface,
    fields: derived.fields,
    files: workspace.files,
    finishPanelResize: panels.finishPanelResize,
    forkingProgramId: programList.forkingProgramId,
    handleAddSecretDeclaration: secrets.handleAddSecretDeclaration,
    handleCloseTab: workspace.handleCloseTab,
    handleCodeChange: workspace.handleCodeChange,
    handleCreateDraftFromHistoricalVersion:
      draftActions.handleCreateDraftFromHistoricalVersion,
    handleCreateFile: workspace.handleCreateFile,
    handleForkProgram: programList.handleForkProgram,
    handleImportFiles: workspace.handleImportFiles,
    handlePanelResizeKeyDown: panels.handlePanelResizeKeyDown,
    handlePanelResizeMove: panels.handlePanelResizeMove,
    handlePanelResizeStart: panels.handlePanelResizeStart,
    handleProgramSecretBindingChange: secrets.handleProgramSecretBindingChange,
    handleRemoveSecretDeclaration: secrets.handleRemoveSecretDeclaration,
    handleRun: publishRun.handleRun,
    handleSave: publishRun.handleSave,
    handleSecretDeclarationChange: secrets.handleSecretDeclarationChange,
    handleSelectFile: workspace.handleSelectFile,
    handleWorkspaceDragEnter: workspace.handleWorkspaceDragEnter,
    handleWorkspaceDragLeave: workspace.handleWorkspaceDragLeave,
    handleWorkspaceDragOver: workspace.handleWorkspaceDragOver,
    handleWorkspaceDrop: workspace.handleWorkspaceDrop,
    hasManualInput: derived.hasManualInput,
    hasUnsavedChanges: derived.hasUnsavedChanges,
    historicalDraftPending: draftActions.historicalDraftPending,
    importingFiles: workspace.importingFiles,
    initialProgramId,
    initialSecrets,
    inputSchemaStr: form.inputSchemaStr,
    inputValues: form.inputValues,
    isDraftProgram: derived.isDraftProgram,
    isNewFileModalOpen: workspace.isNewFileModalOpen,
    isSystemProgram: derived.isSystemProgram,
    isWorkspaceDropzoneVisible: derived.isWorkspaceDropzoneVisible,
    latestInputSchemaStr: derived.latestInputSchemaStr,
    latestOutputConfigStr: derived.latestOutputConfigStr,
    latestPublishedVersion: derived.latestPublishedVersion,
    log,
    manualInput: form.manualInput,
    missingSecretConfigurationDetail: derived.missingSecretConfigurationDetail,
    newFileError: workspace.newFileError,
    newFileName: workspace.newFileName,
    nextVersionNumber: derived.nextVersionNumber,
    onOpenSecrets,
    openNewFileModal: workspace.openNewFileModal,
    openTabFiles: derived.openTabFiles,
    outputConfigStr: form.outputConfigStr,
    pendingChanges: derived.pendingChanges,
    persistProgramName: draftActions.persistProgramName,
    progName: form.progName,
    programVersions: derived.programVersions,
    renameError: form.renameError,
    result: form.result,
    rightPanelCollapsed: panels.rightPanelCollapsed,
    rightPanelHeights: panels.rightPanelHeights,
    running: publishRun.running,
    saving: publishRun.saving,
    savingProgramSecrets: secrets.savingProgramSecrets,
    selectedHistoricalVersion: derived.selectedHistoricalVersion,
    selectedProgram: derived.selectedProgram,
    selectedProgramSecretBindings: derived.selectedProgramSecretBindings,
    selectedVersionView: form.selectedVersionView,
    setActiveFile: workspace.setActiveFile,
    setDraftStackCollapsed: panels.setDraftStackCollapsed,
    setEditingSurface: form.setEditingSurface,
    setInputSchemaStr: form.setInputSchemaStr,
    setInputValues: form.setInputValues,
    setManualInput: form.setManualInput,
    setNewFileError: workspace.setNewFileError,
    setNewFileName: workspace.setNewFileName,
    setOutputConfigStr: form.setOutputConfigStr,
    setProgName: form.setProgName,
    setRightPanelCollapsed: panels.setRightPanelCollapsed,
    setSelectedVersionView: form.setSelectedVersionView,
    setVersionsCollapsed: panels.setVersionsCollapsed,
    versionsCollapsed: panels.versionsCollapsed,
    versionsHeight: panels.versionsHeight,
    viewingHistoricalVersion: derived.viewingHistoricalVersion,
    visibleFiles: derived.visibleFiles,
    visibleInputSchemaStr: derived.visibleInputSchemaStr,
    visibleOutputConfigStr: derived.visibleOutputConfigStr,
    visibleSecretConfigState: derived.visibleSecretConfigState,
    visibleSecretDeclarationIssues: derived.visibleSecretDeclarationIssues,
    visibleSecretDeclarations: derived.visibleSecretDeclarations,
  } satisfies ProgramEditorViewModel;
};
