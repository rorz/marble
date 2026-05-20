import type { ProgramManifestSecretDeclaration } from "@marble/contracts";
import type {
  Dispatch,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";
import type * as actions from "../actions";
import type { ProgramsPageData } from "../actions";

export type FullProgram = ProgramsPageData["programs"][number];
export type ProgramVersionWithFiles = FullProgram["programVersions"][number];
export type ProgramFile = ProgramVersionWithFiles["programFiles"][number];
export type ProgramVersionMutation = Awaited<
  ReturnType<typeof actions.createDraftVersion>
>["version"];
export type ProgramTestResult = Awaited<ReturnType<typeof actions.testProgram>>;
export type PublishedProgramVersionWithFiles = ProgramVersionWithFiles & {
  publishedAt: string;
  version: number;
};
export type EditableProgramFile = Pick<
  ProgramFile,
  "content" | "filename" | "filetype"
>;
export type MonacoLanguage = "json" | "markdown" | "typescript";
export type LibrarySurface = "marketplace" | "mine" | "system";
export type PendingChange = {
  badgeTone: "info" | "neutral" | "warning";
  id: string;
  label: string;
  summary: string;
  tag: string;
};
export type SecretRecord = Awaited<ProgramsPageData["secrets"][number]>;
export type SecretBindingInput = Awaited<
  ReturnType<typeof actions.updateProgramSecretBindings>
>[number];
export type MissingSecretConfigurationDetail = {
  missingSecrets: Array<{
    bindingSource: "column" | "implicit" | "program";
    description?: string;
    envName: string;
    label: string;
    required: boolean;
  }>;
  sentinel?: string;
};
export type EditableProgramSecretDeclaration = {
  description: string;
  env: string;
  id: string;
  label: string;
  required: boolean;
};

export const workbenchPanelHeightLimits = {
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

export type ResizablePanelId = keyof typeof workbenchPanelHeightLimits;
export type RightWorkbenchPanelId = Exclude<
  ResizablePanelId,
  "draftStack" | "versions"
>;

export type ProgramsLibraryViewModel = {
  createError: null | string;
  createPending: boolean;
  customPrograms: FullProgram[];
  forkingProgramId: null | string;
  librarySurface: LibrarySurface;
  onAskAgentToCreateProgram: () => void;
  onCreateProgram: () => void;
  onForkProgram: (program: FullProgram) => void;
  onOpenProgram: (programId: string) => void;
  onSurfaceChange: (surface: LibrarySurface) => void;
  systemPrograms: FullProgram[];
};

export type ProgramEditorViewModel = {
  activeFile: null | string;
  activeFileObj: EditableProgramFile | null;
  activeProgramTargetId: string;
  activeResizePanel: null | ResizablePanelId;
  canEditWorkspace: boolean;
  closeNewFileModal: () => void;
  dirtyFiles: Set<string>;
  draftBootstrapPending: boolean;
  draftStackCards: PendingChange[];
  draftStackCollapsed: boolean;
  draftStackHeight: number;
  draftSyncBlockedReason: null | string;
  draftSyncPending: boolean;
  draftVersion: ProgramVersionWithFiles | null;
  editingSurface: null | "crumb" | "title";
  fields: Array<{
    defaultValue?: string;
    enumValues?: string[];
    key: string;
    title: string;
    type: string;
  }>;
  files: EditableProgramFile[];
  finishPanelResize: (event?: ReactPointerEvent<HTMLButtonElement>) => void;
  forkingProgramId: null | string;
  handleAddSecretDeclaration: () => void;
  handleCloseTab: (filename: string) => void;
  handleCodeChange: (newCode: string) => void;
  handleCreateDraftFromHistoricalVersion: () => Promise<void>;
  handleCreateFile: () => void;
  handleForkProgram: (program: FullProgram) => Promise<void>;
  handleImportFiles: (
    incomingFiles: File[],
    options?: {
      closeModalAfterImport?: boolean;
    },
  ) => Promise<void>;
  handlePanelResizeKeyDown: (
    panelId: ResizablePanelId,
  ) => (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  handlePanelResizeMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  handlePanelResizeStart: (
    panelId: ResizablePanelId,
    direction: -1 | 1,
  ) => (event: ReactPointerEvent<HTMLButtonElement>) => void;
  handleProgramSecretBindingChange: (
    envName: string,
    nextSecretId: string,
  ) => Promise<void>;
  handleRemoveSecretDeclaration: (secretId: string) => void;
  handleRun: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleSecretDeclarationChange: (
    secretId: string,
    field: "description" | "env" | "label" | "required",
    value: boolean | string,
  ) => void;
  handleSelectFile: (filename: string) => void;
  handleWorkspaceDragEnter: (
    event: ReactDragEvent<HTMLFieldSetElement>,
  ) => void;
  handleWorkspaceDragLeave: (
    event: ReactDragEvent<HTMLFieldSetElement>,
  ) => void;
  handleWorkspaceDragOver: (event: ReactDragEvent<HTMLFieldSetElement>) => void;
  handleWorkspaceDrop: (event: ReactDragEvent<HTMLFieldSetElement>) => void;
  hasManualInput: boolean;
  hasUnsavedChanges: boolean;
  historicalDraftPending: boolean;
  initialProgramId?: string;
  initialSecrets: ProgramsPageData["secrets"];
  importingFiles: boolean;
  inputSchemaStr: string;
  inputValues: Record<string, string>;
  isDraftProgram: boolean;
  isNewFileModalOpen: boolean;
  isSystemProgram: boolean;
  isWorkspaceDropzoneVisible: boolean;
  latestInputSchemaStr: string;
  latestOutputConfigStr: string;
  latestPublishedVersion: PublishedProgramVersionWithFiles | null;
  log: string[];
  manualInput: string;
  missingSecretConfigurationDetail: MissingSecretConfigurationDetail | null;
  newFileError: null | string;
  newFileName: string;
  nextVersionNumber: number;
  openNewFileModal: () => void;
  openTabFiles: EditableProgramFile[];
  onOpenSecrets: () => void;
  outputConfigStr: string;
  pendingChanges: PendingChange[];
  persistProgramName: () => Promise<string>;
  programVersions: ProgramVersionWithFiles[];
  progName: string;
  renameError: null | string;
  result: ProgramTestResult | null;
  rightPanelCollapsed: Record<RightWorkbenchPanelId, boolean>;
  rightPanelHeights: Record<RightWorkbenchPanelId, number>;
  running: boolean;
  saving: boolean;
  savingProgramSecrets: boolean;
  selectedHistoricalVersion: ProgramVersionWithFiles | null;
  selectedProgram: FullProgram | undefined;
  selectedProgramSecretBindings: Record<string, string>;
  selectedVersionView: "current" | string;
  setActiveFile: Dispatch<SetStateAction<null | string>>;
  setDraftStackCollapsed: Dispatch<SetStateAction<boolean>>;
  setEditingSurface: Dispatch<SetStateAction<null | "crumb" | "title">>;
  setInputSchemaStr: Dispatch<SetStateAction<string>>;
  setInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  setManualInput: Dispatch<SetStateAction<string>>;
  setNewFileError: Dispatch<SetStateAction<null | string>>;
  setNewFileName: Dispatch<SetStateAction<string>>;
  setOutputConfigStr: Dispatch<SetStateAction<string>>;
  setProgName: Dispatch<SetStateAction<string>>;
  setRightPanelCollapsed: Dispatch<
    SetStateAction<Record<RightWorkbenchPanelId, boolean>>
  >;
  setSelectedVersionView: Dispatch<SetStateAction<"current" | string>>;
  setVersionsCollapsed: Dispatch<SetStateAction<boolean>>;
  visibleFiles: EditableProgramFile[];
  visibleInputSchemaStr: string;
  visibleOutputConfigStr: string;
  visibleSecretConfigState: {
    declarations: ProgramManifestSecretDeclaration[];
    error: null | string;
  };
  visibleSecretDeclarationIssues: Record<string, null | string>;
  visibleSecretDeclarations: EditableProgramSecretDeclaration[];
  viewingHistoricalVersion: boolean;
  versionsCollapsed: boolean;
  versionsHeight: number;
};
