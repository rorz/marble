import type { ProgramManifestSecretDeclaration } from "@marble/contracts";
import { getErrorMessage } from "@marble/lib/result";
import { normalizeDisplayLabel } from "@marble/lib/string";
import { marbleToast } from "@marble/ui";
import { useState } from "react";
import { useMarbleWebSessionSdk } from "../../../../lib/marble-sdk-client";
import * as actions from "../actions";
import { renameProgram } from "./sdk";
import type {
  EditableProgramFile,
  FullProgram,
  ProgramTestResult,
  ProgramVersionWithFiles,
} from "./types";

export const usePublishRun = ({
  addLog,
  currentSecretConfigState,
  currentSecretConfigStr,
  draftVersion,
  ensurePersistedDraftVersion,
  files,
  hasUnsavedChanges,
  inputValues,
  latestPublishedVersion,
  manualInput,
  nextVersionNumber,
  packageManifestError,
  programConfigError,
  progName,
  refreshPrograms,
  selectedHistoricalVersion,
  selectedProgram,
  setResult,
  updateSelectedProgramName,
  upsertProgramVersion,
  viewingHistoricalVersion,
  visibleVersion,
}: {
  addLog: (message: string) => void;
  currentSecretConfigState: {
    declarations: ProgramManifestSecretDeclaration[];
  };
  currentSecretConfigStr: null | string;
  draftVersion: ProgramVersionWithFiles | null;
  ensurePersistedDraftVersion: (
    showToast?: boolean,
  ) => Promise<ProgramVersionWithFiles | null>;
  files: EditableProgramFile[];
  hasUnsavedChanges: boolean;
  inputValues: Record<string, string>;
  latestPublishedVersion: ProgramVersionWithFiles | null;
  manualInput: string;
  nextVersionNumber: number;
  packageManifestError: null | string;
  programConfigError: null | string;
  progName: string;
  refreshPrograms: () => Promise<FullProgram[]>;
  selectedHistoricalVersion: ProgramVersionWithFiles | null;
  selectedProgram: FullProgram | undefined;
  setResult: (result: ProgramTestResult | null) => void;
  updateSelectedProgramName: (programId: string, name: string) => void;
  upsertProgramVersion: (
    programId: string,
    version: ProgramVersionWithFiles,
  ) => ProgramVersionWithFiles;
  viewingHistoricalVersion: boolean;
  visibleVersion: ProgramVersionWithFiles | null;
}) => {
  const sdk = useMarbleWebSessionSdk();
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

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
      if (packageManifestError) {
        throw new Error(`Invalid package.json: ${packageManifestError}`);
      }

      if (programConfigError) {
        throw new Error(`Invalid marbleconfig.jsonc: ${programConfigError}`);
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
        updateSelectedProgramName(selectedProgram.id, updatedProgram.name);
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

    if (!visibleVersion) {
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
        visibleVersion.id,
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

  return {
    handleRun,
    handleSave,
    running,
    saving,
  };
};
