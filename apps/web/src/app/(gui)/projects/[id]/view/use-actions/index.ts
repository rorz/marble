import { getErrorMessage } from "@marble/lib/result";
import { normalizeDisplayLabel } from "@marble/lib/string";
import {
  type MarbleConfirmModalState,
  type MarbleRouter,
  marbleToast,
} from "@marble/ui";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { useMarbleSdk } from "../../../../../../lib/marble-sdk-client";
import {
  compareByCreatedAtCamelDesc,
  compareByUpdatedAtCamelDesc,
  upsertRow,
} from "../../../../../../lib/realtime-crud";
import type { ProjectState } from "../types";
import { useProjectResourceDeletions } from "./deletions";

type Sdk = ReturnType<typeof useMarbleSdk>;

type UseProjectActionsOptions = {
  nameDraft: string;
  pipes: Awaited<ReturnType<Sdk["pipes"]["create"]>>[];
  project: ProjectState;
  projectRef: MutableRefObject<ProjectState>;
  renameInFlightRef: MutableRefObject<boolean>;
  renameRequestRef: MutableRefObject<number>;
  router: MarbleRouter;
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

export const useProjectActions = (options: UseProjectActionsOptions) => {
  const {
    nameDraft,
    pipes,
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

  const deletions = useProjectResourceDeletions({
    sdk,
    setConfirmState,
    setError,
    setPipes,
    setProject,
    setSources,
  });

  const buildSourceDetailHref = (sourceId: string) =>
    `/projects/${project.id}/sources/${sourceId}`;

  const buildPipeDetailHref = (pipeId: string) =>
    `/projects/${project.id}/pipes/${pipeId}`;

  const stopEditing = () => {
    setEditingSurface(null);
    setNameDraft(project.name);
  };

  const commitName = async () => {
    const nextName = normalizeDisplayLabel(nameDraft, "Untitled Project");
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

  const findPipeForPair = (sourceId: string, tableId: string) =>
    pipes.find(
      (pipe) => pipe.sourceId === sourceId && pipe.tableId === tableId,
    );

  const findFirstUnconnectedPair = () => {
    for (const source of sources) {
      for (const table of project.tables) {
        if (!findPipeForPair(source.id, table.id)) {
          return {
            sourceId: source.id,
            tableId: table.id,
          };
        }
      }
    }

    return null;
  };

  const handleCreatePipe = async (connection?: {
    sourceId: string;
    tableId: string;
  }) => {
    if (connection) {
      const existingPipe = findPipeForPair(
        connection.sourceId,
        connection.tableId,
      );

      if (existingPipe) {
        marbleToast.message("These are already connected — opening the pipe.");
        router.push(buildPipeDetailHref(existingPipe.id));
        return;
      }
    }

    const pair = connection ?? findFirstUnconnectedPair();

    if (!pair) {
      setError(
        sources.length === 0 || project.tables.length === 0
          ? "Create at least one source and one table before adding a pipe."
          : "Every source is already connected to every table.",
      );
      return;
    }

    setCreatingPipe(true);
    setError(null);

    try {
      const pipe = await sdk.pipes.create({
        mappings: [],
        sourceId: pair.sourceId,
        tableId: pair.tableId,
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

  return {
    buildPipeDetailHref,
    buildSourceDetailHref,
    commitName,
    handleCreatePipe,
    handleCreateSource,
    handleCreateTable,
    handleDeleteProject,
    requestDeletePipe: deletions.requestDeletePipe,
    requestDeleteSource: deletions.requestDeleteSource,
    requestDeleteTable: deletions.requestDeleteTable,
    startEditingName,
    stopEditing,
  };
};
