import { getErrorMessage } from "@marble/lib/result";
import { type MarbleConfirmModalState, marbleToast } from "@marble/ui";
import type { Dispatch, SetStateAction } from "react";
import type { useMarbleSdk } from "../../../../../../lib/marble-sdk-client";
import type { ProjectState } from "../types";

type Sdk = ReturnType<typeof useMarbleSdk>;

type UseProjectResourceDeletionsOptions = {
  sdk: Sdk;
  setConfirmState: Dispatch<SetStateAction<MarbleConfirmModalState | null>>;
  setError: Dispatch<SetStateAction<null | string>>;
  setPipes: Dispatch<
    SetStateAction<Awaited<ReturnType<Sdk["pipes"]["create"]>>[]>
  >;
  setProject: Dispatch<SetStateAction<ProjectState>>;
  setSources: Dispatch<
    SetStateAction<Awaited<ReturnType<Sdk["sources"]["create"]>>[]>
  >;
};

export const useProjectResourceDeletions = (
  options: UseProjectResourceDeletionsOptions,
) => {
  const { sdk, setConfirmState, setError, setPipes, setProject, setSources } =
    options;

  const performDeleteSource = async (sourceId: string, sourceName: string) => {
    setError(null);

    try {
      await sdk.sources.delete({
        id: sourceId,
      });
      setSources((current) => current.filter((row) => row.id !== sourceId));
      setPipes((current) =>
        current.filter((pipe) => pipe.sourceId !== sourceId),
      );
      marbleToast.success(`Source "${sourceName}" deleted`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const requestDeleteSource = (sourceId: string, sourceName: string) => {
    setConfirmState({
      confirmLabel: "Delete source",
      message: `Delete source "${sourceName}"? Pipes that read from this source will also be removed.`,
      onConfirm: () => {
        void performDeleteSource(sourceId, sourceName);
      },
      title: "Delete source",
    });
  };

  const performDeletePipe = async (pipeId: string, pipeTitle: string) => {
    setError(null);

    try {
      await sdk.pipes.delete({
        id: pipeId,
      });
      setPipes((current) => current.filter((pipe) => pipe.id !== pipeId));
      marbleToast.success(`Pipe "${pipeTitle}" deleted`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const requestDeletePipe = (pipeId: string, pipeTitle: string) => {
    setConfirmState({
      confirmLabel: "Delete pipe",
      message: `Delete pipe "${pipeTitle}"?`,
      onConfirm: () => {
        void performDeletePipe(pipeId, pipeTitle);
      },
      title: "Delete pipe",
    });
  };

  const performDeleteTable = async (tableId: string, tableName: string) => {
    setError(null);

    try {
      await sdk.tables.delete({
        id: tableId,
      });
      setProject((current) => {
        const tables = current.tables.filter((table) => table.id !== tableId);
        return {
          ...current,
          tableCount: tables.length,
          tables,
        };
      });
      setPipes((current) => current.filter((pipe) => pipe.tableId !== tableId));
      marbleToast.success(`Table "${tableName}" deleted`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const requestDeleteTable = (tableId: string, tableName: string) => {
    setConfirmState({
      confirmLabel: "Delete table",
      message: `Delete table "${tableName}"? Its rows, cells, and any pipes that target it will also be deleted.`,
      onConfirm: () => {
        void performDeleteTable(tableId, tableName);
      },
      title: "Delete table",
    });
  };

  return {
    requestDeletePipe,
    requestDeleteSource,
    requestDeleteTable,
  };
};
