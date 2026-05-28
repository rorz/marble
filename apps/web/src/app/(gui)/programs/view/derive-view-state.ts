import {
  type ProgramConfig,
  parseProgramConfigFromFiles,
} from "@marble/contracts";
import { getErrorMessage } from "@marble/lib/result";
import type { ProgramsPageData } from "../actions";
import type { deriveProgramSelection } from "./derive-selection";
import { normalizeProgramFiles } from "./files";
import { getProgramPackageManifestState } from "./manifest";
import {
  createEditableProgramSecretDeclarations,
  getMissingSecretConfigurationDetail,
  getProgramSecretConfigComparisonValue,
  getSecretDeclarationIssuesById,
} from "./secret-config";
import type {
  EditableProgramFile,
  PendingChange,
  ProgramTestResult,
} from "./types";
import { buildFieldsFromSchema, buildPendingChanges } from "./workbench";

type DeriveProgramsViewStateInput = {
  activeFile: null | string;
  files: EditableProgramFile[];
  openTabs: string[];
  programSecretBindings: ProgramsPageData["programSecretBindings"];
  progName: string;
  result: ProgramTestResult | null;
  selection: ReturnType<typeof deriveProgramSelection>;
  workspaceDragDepth: number;
};

const getProgramConfigState = (
  files: EditableProgramFile[],
): {
  config: ProgramConfig | null;
  error: null | string;
} => {
  try {
    return {
      config: parseProgramConfigFromFiles(files),
      error: null,
    };
  } catch (error) {
    return {
      config: null,
      error: getErrorMessage(error),
    };
  }
};

export const deriveProgramsViewState = ({
  activeFile,
  files,
  openTabs,
  programSecretBindings,
  progName,
  result,
  selection,
  workspaceDragDepth,
}: DeriveProgramsViewStateInput) => {
  const {
    activeProgramTargetId,
    canEditWorkspace,
    customPrograms,
    draftVersion,
    isDraftProgram,
    isEditorRoute,
    isLocalDraftProgram,
    isSystemProgram,
    latestPublishedVersion,
    programVersions,
    selectedHistoricalVersion,
    selectedProgram,
    systemPrograms,
    viewingHistoricalVersion,
    workingVersion,
  } = selection;
  const visibleVersion = selectedHistoricalVersion ?? workingVersion;
  const visibleFiles = viewingHistoricalVersion
    ? normalizeProgramFiles(selectedHistoricalVersion?.programFiles)
    : files;
  const currentProgramConfigState = getProgramConfigState(files);
  const visibleProgramConfigState = getProgramConfigState(visibleFiles);
  const latestVersionInputSchema =
    visibleProgramConfigState.config?.inputSchema;
  const visibleSecretDeclarations = viewingHistoricalVersion
    ? createEditableProgramSecretDeclarations(
        visibleProgramConfigState.config?.secrets ?? [],
      )
    : createEditableProgramSecretDeclarations(
        currentProgramConfigState.config?.secrets ?? [],
      );
  const visibleSecretConfigState =
    visibleProgramConfigState.config === null
      ? {
          declarations: [],
          error: visibleProgramConfigState.error,
        }
      : {
          declarations: visibleProgramConfigState.config.secrets,
          error: null,
        };
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
  const latestSecretConfigStr = getProgramSecretConfigComparisonValue(
    latestPublishedVersion?.secretConfig,
  );
  const workingSecretConfigStr = getProgramSecretConfigComparisonValue(
    workingVersion?.secretConfig,
  );
  const currentSecretConfigState =
    currentProgramConfigState.config === null
      ? {
          declarations: [],
          error: currentProgramConfigState.error,
        }
      : {
          declarations: currentProgramConfigState.config.secrets,
          error: null,
        };
  const currentSecretConfigStr =
    currentSecretConfigState.error === null
      ? JSON.stringify(currentSecretConfigState.declarations)
      : null;
  const packageManifestState = getProgramPackageManifestState(files);
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
    isDraftProgram,
    latestFileContentByName,
    latestSecretConfigStr,
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
      : currentProgramConfigState.error !== null
        ? "marbleconfig.jsonc must be valid before the draft syncs."
        : currentSecretConfigState.error !== null
          ? "Secret requirements must be valid before the draft syncs."
          : null;
  const fields = visibleProgramConfigState.config
    ? buildFieldsFromSchema(visibleProgramConfigState.config.inputSchema)
    : [];
  const hasManualInput =
    visibleProgramConfigState.config?.outputConfig.flags.allowManualInput ===
    true;

  return {
    activeFileObj,
    activeProgramTargetId,
    canEditWorkspace,
    currentSecretConfigState,
    currentSecretConfigStr,
    customPrograms,
    dirtyFiles,
    draftStackCards,
    draftSyncBlockedReason,
    draftVersion,
    fields,
    hasLocalDraftPayloadChanges,
    hasManualInput,
    hasUnsavedChanges,
    hasVersionChangesAgainstPublished,
    isDraftProgram,
    isEditorRoute,
    isLocalDraftProgram,
    isSystemProgram,
    isWorkspaceDropzoneVisible: workspaceDragDepth > 0,
    latestPublishedVersion,
    latestVersionInputSchema,
    missingSecretConfigurationDetail,
    nextVersionNumber,
    openTabFiles,
    packageManifestState,
    pendingChanges,
    programConfigState: currentProgramConfigState,
    programVersions,
    selectedHistoricalVersion,
    selectedProgram,
    selectedProgramSecretBindings,
    systemPrograms,
    viewingHistoricalVersion,
    visibleFiles,
    visibleSecretConfigState,
    visibleSecretDeclarationIssues,
    visibleSecretDeclarations,
    visibleVersion,
    workingVersion,
  };
};
