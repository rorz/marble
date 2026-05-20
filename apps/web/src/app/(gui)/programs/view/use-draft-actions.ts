import type { ProgramManifestSecretDeclaration } from "@marble/contracts";
import { stringifyPretty } from "@marble/lib/json";
import { getErrorMessage } from "@marble/lib/result";
import { normalizeDisplayLabel } from "@marble/lib/string";
import { marbleToast } from "@marble/ui";
import { useCallback, useState } from "react";
import { useMarbleWebSessionSdk } from "../../../../lib/marble-sdk-client";
import * as actions from "../actions";
import { normalizeProgramFiles } from "./files";
import { renameProgram } from "./sdk";
import {
  createEditableProgramSecretDeclarations,
  normalizeStoredProgramSecretConfig,
} from "./secret-config";
import type {
  EditableProgramFile,
  EditableProgramSecretDeclaration,
  FullProgram,
  ProgramVersionWithFiles,
} from "./types";

export const useDraftActions = ({
  addLog,
  currentSecretConfigState,
  currentSecretConfigStr,
  draftVersion,
  files,
  latestPublishedVersion,
  normalizedInputSchemaStr,
  normalizedOutputConfigStr,
  packageManifestError,
  progName,
  selectedHistoricalVersion,
  selectedProgram,
  setActiveFile,
  setEditingSurface,
  setFiles,
  setInputSchemaStr,
  setOpenTabs,
  setOutputConfigStr,
  setProgName,
  setRenameError,
  setResult,
  setSecretConfigDraft,
  setSelectedVersionView,
  updateSelectedProgramName,
  upsertProgramVersion,
}: {
  addLog: (message: string) => void;
  currentSecretConfigState: {
    declarations: ProgramManifestSecretDeclaration[];
  };
  currentSecretConfigStr: null | string;
  draftVersion: ProgramVersionWithFiles | null;
  files: EditableProgramFile[];
  latestPublishedVersion: ProgramVersionWithFiles | null;
  normalizedInputSchemaStr: null | string;
  normalizedOutputConfigStr: null | string;
  packageManifestError: null | string;
  progName: string;
  selectedHistoricalVersion: ProgramVersionWithFiles | null;
  selectedProgram: FullProgram | undefined;
  setActiveFile: (filename: null | string) => void;
  setEditingSurface: (surface: null | "crumb" | "title") => void;
  setFiles: (files: EditableProgramFile[]) => void;
  setInputSchemaStr: (value: string) => void;
  setOpenTabs: (tabs: string[]) => void;
  setOutputConfigStr: (value: string) => void;
  setProgName: (value: string) => void;
  setRenameError: (value: null | string) => void;
  setResult: (result: null) => void;
  setSecretConfigDraft: (draft: EditableProgramSecretDeclaration[]) => void;
  setSelectedVersionView: (value: "current" | string) => void;
  updateSelectedProgramName: (programId: string, name: string) => void;
  upsertProgramVersion: (
    programId: string,
    version: ProgramVersionWithFiles,
  ) => ProgramVersionWithFiles;
}) => {
  const sdk = useMarbleWebSessionSdk();
  const [historicalDraftPending, setHistoricalDraftPending] = useState(false);

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

      if (packageManifestError) {
        throw new Error(
          `Fix package.json before creating a draft: ${packageManifestError}`,
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
      currentSecretConfigState.declarations,
      currentSecretConfigStr,
      draftVersion,
      files,
      latestPublishedVersion?.version,
      normalizedInputSchemaStr,
      normalizedOutputConfigStr,
      packageManifestError,
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
    updateSelectedProgramName(selectedProgram.id, nextName);

    try {
      const updated = await renameProgram(sdk, selectedProgram.id, nextName);
      updateSelectedProgramName(selectedProgram.id, updated.name);
      setProgName(updated.name);
      return updated.name;
    } catch (error) {
      updateSelectedProgramName(selectedProgram.id, selectedProgram.name);
      setProgName(selectedProgram.name);
      setRenameError(getErrorMessage(error));
      throw error;
    }
  }, [
    progName,
    sdk,
    selectedProgram,
    setEditingSurface,
    setProgName,
    setRenameError,
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
    setActiveFile,
    setFiles,
    setInputSchemaStr,
    setOpenTabs,
    setOutputConfigStr,
    setResult,
    setSecretConfigDraft,
    setSelectedVersionView,
    upsertProgramVersion,
  ]);

  return {
    ensurePersistedDraftVersion,
    handleCreateDraftFromHistoricalVersion,
    historicalDraftPending,
    persistProgramName,
  };
};
