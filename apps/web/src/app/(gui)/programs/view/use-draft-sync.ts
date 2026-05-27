import type { ProgramManifestSecretDeclaration } from "@marble/contracts";
import { useEffect, useRef, useState } from "react";
import * as actions from "../actions";
import type {
  EditableProgramFile,
  FullProgram,
  ProgramVersionWithFiles,
} from "./types";

export const useDraftSync = ({
  canEditWorkspace,
  currentSecretConfigState,
  draftSyncBlockedReason,
  draftVersion,
  ensurePersistedDraftVersion,
  files,
  hasLocalDraftPayloadChanges,
  hasVersionChangesAgainstPublished,
  latestPublishedVersion,
  selectedProgram,
  upsertProgramVersion,
}: {
  canEditWorkspace: boolean;
  currentSecretConfigState: {
    declarations: ProgramManifestSecretDeclaration[];
  };
  draftSyncBlockedReason: null | string;
  draftVersion: ProgramVersionWithFiles | null;
  ensurePersistedDraftVersion: () => Promise<ProgramVersionWithFiles | null>;
  files: EditableProgramFile[];
  hasLocalDraftPayloadChanges: boolean;
  hasVersionChangesAgainstPublished: boolean;
  latestPublishedVersion: ProgramVersionWithFiles | null;
  selectedProgram: FullProgram | undefined;
  upsertProgramVersion: (
    programId: string,
    version: ProgramVersionWithFiles,
  ) => ProgramVersionWithFiles;
}) => {
  const isMountedRef = useRef(true);
  const draftBootstrapInFlightRef = useRef(false);
  const draftSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [draftBootstrapPending, setDraftBootstrapPending] = useState(false);
  const [draftSyncPending, setDraftSyncPending] = useState(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (draftSyncTimeoutRef.current) {
        clearTimeout(draftSyncTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !canEditWorkspace ||
      !selectedProgram ||
      draftVersion ||
      draftBootstrapInFlightRef.current ||
      !latestPublishedVersion ||
      !hasVersionChangesAgainstPublished ||
      draftSyncBlockedReason !== null
    ) {
      return;
    }

    draftBootstrapInFlightRef.current = true;
    setDraftBootstrapPending(true);

    void (async () => {
      try {
        await ensurePersistedDraftVersion();
      } catch (error) {
        void error;
      } finally {
        draftBootstrapInFlightRef.current = false;
        if (isMountedRef.current) {
          setDraftBootstrapPending(false);
        }
      }
    })();
  }, [
    canEditWorkspace,
    draftSyncBlockedReason,
    draftVersion,
    ensurePersistedDraftVersion,
    hasVersionChangesAgainstPublished,
    latestPublishedVersion,
    selectedProgram,
  ]);

  useEffect(() => {
    if (!canEditWorkspace || !draftVersion || !selectedProgram) {
      if (draftSyncTimeoutRef.current) {
        clearTimeout(draftSyncTimeoutRef.current);
        draftSyncTimeoutRef.current = null;
      }
      setDraftSyncPending(false);
      return;
    }

    if (!hasLocalDraftPayloadChanges || draftSyncBlockedReason !== null) {
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
        try {
          const syncedDraft = await actions.syncDraftVersion(
            draftVersion.id,
            files,
            currentSecretConfigState.declarations,
          );
          upsertProgramVersion(selectedProgram.id, syncedDraft);
        } catch (error) {
          void error;
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
    canEditWorkspace,
    currentSecretConfigState.declarations,
    draftSyncBlockedReason,
    draftVersion,
    files,
    hasLocalDraftPayloadChanges,
    selectedProgram,
    upsertProgramVersion,
  ]);

  return {
    draftBootstrapPending,
    draftSyncPending,
  };
};
