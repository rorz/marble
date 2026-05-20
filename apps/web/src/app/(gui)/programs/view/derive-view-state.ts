import { stringifyPretty } from "@marble/lib/json";
import type { ProgramsPageData } from "../actions";
import type { deriveProgramSelection } from "./derive-selection";
import { normalizeProgramFiles } from "./files";
import { getProgramPackageManifestState } from "./manifest";
import { normalizeJsonEditorValue } from "./sdk";
import {
  createEditableProgramSecretDeclarations,
  getEditableProgramSecretConfigState,
  getMissingSecretConfigurationDetail,
  getProgramSecretConfigComparisonValue,
  getSecretDeclarationIssuesById,
} from "./secret-config";
import type {
  EditableProgramFile,
  EditableProgramSecretDeclaration,
  PendingChange,
  ProgramTestResult,
} from "./types";
import { buildFieldsFromSchema, buildPendingChanges } from "./workbench";

type DeriveProgramsViewStateInput = {
  activeFile: null | string;
  files: EditableProgramFile[];
  inputSchemaStr: string;
  openTabs: string[];
  outputConfigStr: string;
  programSecretBindings: ProgramsPageData["programSecretBindings"];
  progName: string;
  result: ProgramTestResult | null;
  secretConfigDraft: EditableProgramSecretDeclaration[];
  selection: ReturnType<typeof deriveProgramSelection>;
  workspaceDragDepth: number;
};

export const deriveProgramsViewState = ({
  activeFile,
  files,
  inputSchemaStr,
  openTabs,
  outputConfigStr,
  programSecretBindings,
  progName,
  result,
  secretConfigDraft,
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
    latestInputSchemaStr,
    latestOutputConfigStr,
    latestPublishedVersion,
    latestVersionInputSchema,
    missingSecretConfigurationDetail,
    nextVersionNumber,
    normalizedInputSchemaStr,
    normalizedOutputConfigStr,
    openTabFiles,
    packageManifestState,
    pendingChanges,
    programVersions,
    selectedHistoricalVersion,
    selectedProgram,
    selectedProgramSecretBindings,
    systemPrograms,
    viewingHistoricalVersion,
    visibleFiles,
    visibleInputSchemaStr,
    visibleOutputConfigStr,
    visibleSecretConfigState,
    visibleSecretDeclarationIssues,
    visibleSecretDeclarations,
    visibleVersion,
    workingVersion,
  };
};
