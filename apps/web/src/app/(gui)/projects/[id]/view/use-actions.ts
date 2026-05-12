import { type MarbleConfirmModalState, marbleToast } from "@marble/ui";
import type { useRouter } from "next/navigation";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { useMarbleSdk } from "../../../../../lib/marble-sdk-client";
import {
  compareByCreatedAtCamelDesc,
  compareByUpdatedAtCamelDesc,
  getErrorMessage,
  upsertRow,
} from "../../../../../lib/realtime-crud";
import type { ProjectState } from "./types";

type Sdk = ReturnType<typeof useMarbleSdk>;

type UseProjectActionsOptions = {
  nameDraft: string;
  project: ProjectState;
  projectRef: MutableRefObject<ProjectState>;
  renameInFlightRef: MutableRefObject<boolean>;
  renameRequestRef: MutableRefObject<number>;
  router: ReturnType<typeof useRouter>;
  sdk: Sdk;
  setConfirmState: Dispatch<SetStateAction<MarbleConfirmModalState | null>>;
  setCreatingPipe: Dispatch<SetStateAction<boolean>>;
  setCreatingSource: Dispatch<SetStateAction<boolean>>;
  setCreatingTable: Dispatch<SetStateAction<boolean>>;
  setDeletingProject: Dispatch<SetStateAction<boolean>>;
  setEditingSurface: Dispatch<SetStateAction<null | "crumb" | "title">>;
  setError: Dispatch<SetStateAction<null | string>>;
  setNameDraft: Dispatch<SetStateAction<string>>;
  setPipes: Dispatch<
    SetStateAction<Awaited<ReturnType<Sdk["pipes"]["create"]>>[]>
  >;
  setProject: Dispatch<SetStateAction<ProjectState>>;
  setSources: Dispatch<
    SetStateAction<Awaited<ReturnType<Sdk["sources"]["create"]>>[]>
  >;
  sources: Awaited<ReturnType<Sdk["sources"]["create"]>>[];
};

export function useProjectActions(options: UseProjectActionsOptions) {
  const {
    nameDraft,
    project,
    projectRef,
    renameInFlightRef,
    renameRequestRef,
    router,
    sdk,
    setConfirmState,
    setCreatingPipe,
    setCreatingSource,
    setCreatingTable,
    setDeletingProject,
    setEditingSurface,
    setError,
    setNameDraft,
    setPipes,
    setProject,
    setSources,
    sources,
  } = options;

  const buildSourceDetailHref = (sourceId: string) =>
    `/projects/${project.id}/sources/${sourceId}`;

  const buildPipeDetailHref = (pipeId: string) =>
    `/projects/${project.id}/pipes/${pipeId}`;

  const stopEditing = () => {
    setEditingSurface(null);
    setNameDraft(project.name);
  };

  const commitName = async () => {
    const nextName = nameDraft.trim() || "Untitled Project";
    const previousProject = projectRef.current;

    if (nextName === previousProject.name) {
      setEditingSurface(null);
      setNameDraft(previousProject.name);
      return;
    }

    const requestId = renameRequestRef.current + 1;
    renameRequestRef.current = requestId;
    renameInFlightRef.current = true;
    setError(null);
    setEditingSurface(null);
    setNameDraft(nextName);
    setProject((current) => ({
      ...current,
      name: nextName,
    }));

    try {
      const updated = await sdk.projects.update({
        projectId: previousProject.id,
        values: {
          name: nextName,
        },
      });
      if (renameRequestRef.current !== requestId) {
        return;
      }

      setProject((current) => ({
        ...current,
        name: updated.name,
        updatedAt: updated.updatedAt,
      }));
      setNameDraft(updated.name);
    } catch (caughtError) {
      if (renameRequestRef.current !== requestId) {
        return;
      }

      setProject((current) => ({
        ...current,
        name: previousProject.name,
        updatedAt: previousProject.updatedAt,
      }));
      setNameDraft(previousProject.name);
      setError(getErrorMessage(caughtError));
    } finally {
      if (renameRequestRef.current === requestId) {
        renameInFlightRef.current = false;
      }
    }
  };

  const startEditingName = (surface: "crumb" | "title") => {
    if (renameInFlightRef.current) {
      return;
    }

    setEditingSurface(surface);
  };

  const handleCreateTable = async () => {
    setCreatingTable(true);
    setError(null);

    try {
      const table = await sdk.tables.create({
        projectId: project.id,
      });
      router.push(`/projects/${project.id}/tables/${table.id}`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setCreatingTable(false);
    }
  };

  const handleCreateSource = async () => {
    setCreatingSource(true);
    setError(null);

    try {
      const source = await sdk.sources.create({
        projectId: project.id,
      });
      setSources((current) =>
        upsertRow(current, source, compareByUpdatedAtCamelDesc),
      );
      router.push(buildSourceDetailHref(source.id));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setCreatingSource(false);
    }
  };

  const handleCreatePipe = async () => {
    const sourceId = sources[0]?.id;
    const tableId = project.tables[0]?.id;

    if (!sourceId || !tableId) {
      setError(
        "Create at least one source and one table before adding a pipe.",
      );
      return;
    }

    setCreatingPipe(true);
    setError(null);

    try {
      const pipe = await sdk.pipes.create({
        mappings: [],
        sourceId,
        tableId,
      });
      setPipes((current) =>
        upsertRow(current, pipe, compareByCreatedAtCamelDesc),
      );
      router.push(buildPipeDetailHref(pipe.id));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setCreatingPipe(false);
    }
  };

  const performDeleteProject = async () => {
    setDeletingProject(true);
    setError(null);

    try {
      await sdk.projects.delete({
        projectId: project.id,
      });
      router.push("/projects");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setDeletingProject(false);
    }
  };

  const handleDeleteProject = () => {
    setConfirmState({
      confirmLabel: "Delete project",
      message: `Delete ${project.name}? This also removes its tables and related data.`,
      onConfirm: () => {
        void performDeleteProject();
      },
      title: "Delete project",
    });
  };

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
    buildPipeDetailHref,
    buildSourceDetailHref,
    commitName,
    handleCreatePipe,
    handleCreateSource,
    handleCreateTable,
    handleDeleteProject,
    requestDeletePipe,
    requestDeleteSource,
    requestDeleteTable,
    startEditingName,
    stopEditing,
  };
}
