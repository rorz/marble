import {
  getDraftVersion,
  getLatestPublishedVersion,
  sortProgramVersions,
} from "./programs";
import type { FullProgram } from "./types";

type DeriveProgramSelectionInput = {
  initialMode: "draft" | "master";
  initialProgramId?: string;
  programs: FullProgram[];
  selectedVersionView: "current" | string;
};

export const deriveProgramSelection = ({
  initialMode,
  initialProgramId,
  programs,
  selectedVersionView,
}: DeriveProgramSelectionInput) => {
  const selectedProgram = initialProgramId
    ? programs.find((program) => program.id === initialProgramId)
    : undefined;
  const latestPublishedVersion = getLatestPublishedVersion(selectedProgram);
  const draftVersion = getDraftVersion(selectedProgram);
  const workingVersion = draftVersion ?? latestPublishedVersion;
  const activeProgramTargetId =
    selectedProgram?.id ?? initialProgramId ?? "__draft__";
  const isLocalDraftProgram = initialMode === "draft" && !selectedProgram;
  const isSystemProgram = selectedProgram?.firstParty === true;
  const isDraftProgram = isLocalDraftProgram || draftVersion !== null;
  const isEditorRoute = isDraftProgram || Boolean(initialProgramId);
  const systemPrograms = programs.filter((program) => program.firstParty);
  const customPrograms = programs.filter((program) => !program.firstParty);
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
  const canEditWorkspace = !viewingHistoricalVersion && !isSystemProgram;

  return {
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
  };
};
