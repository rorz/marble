import { getErrorMessage } from "@marble/lib/result";
import {
  type MarbleConfirmModalState,
  marbleToast,
  useMarbleRouter,
} from "@marble/ui";
import { useEffect, useMemo, useState } from "react";
import { useMarbleSdk } from "../../../../../../lib/marble-sdk-client";
import {
  buildPipeMappingSummary,
  buildPipeTitle,
  normalizePipeMappings,
} from "../../../../../../lib/pipe-display";
import type { ProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import { buildSourceTitle } from "../../../../../../lib/source-display";
import {
  autoMapPipeMappingDrafts,
  buildPipeMappingsPayload,
  createPipeMappingDraft,
  togglePipeMappingDraft,
  updatePipeMappingDrafts,
} from "./mapping";
import type { PipeMappingDraft, PipeMappingInput } from "./types";
import { usePipePaths } from "./use-pipe-paths";

export const usePipeDetail = ({
  initialData,
  initialPipeId,
}: {
  initialData: ProjectSourceWorkspaceData;
  initialPipeId: string;
}) => {
  const router = useMarbleRouter();
  const sdk = useMarbleSdk({
    profileId: initialData.project.ownerProfileId,
  });
  const projectId = initialData.project.id;
  const projectName = initialData.project.name;
  const sources = initialData.sources;
  const sourceEvents = initialData.sourceEvents;
  const [selectedPipe, setSelectedPipe] = useState(
    () => initialData.pipes.find((pipe) => pipe.id === initialPipeId) ?? null,
  );
  const [pipeSourceIdDraft, setPipeSourceIdDraft] = useState("");
  const [pipeTableIdDraft, setPipeTableIdDraft] = useState("");
  const [pipeMappingsDraft, setPipeMappingsDraft] = useState<
    PipeMappingDraft[]
  >([]);
  const [pipeError, setPipeError] = useState<null | string>(null);
  const [pipePending, setPipePending] = useState(false);
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);

  const selectedPipeSource = pipeSourceIdDraft
    ? (sources.find((source) => source.id === pipeSourceIdDraft) ?? null)
    : null;
  const sourceLabelById = new Map(
    sources.map((source) => [
      source.id,
      buildSourceTitle(source),
    ]),
  );
  const tableOptions = useMemo(
    () =>
      initialData.project.tables.map((table) => ({
        id: table.id,
        label: table.name || "Untitled Table",
      })),
    [
      initialData.project.tables,
    ],
  );
  const tableLabelById = new Map(
    tableOptions.map((table) => [
      table.id,
      table.label,
    ]),
  );
  const availablePipeColumns = useMemo(
    () =>
      initialData.inputColumns.filter(
        (column) => column.tableId === pipeTableIdDraft,
      ),
    [
      pipeTableIdDraft,
      initialData.inputColumns,
    ],
  );
  const pipeColumnLabelById = new Map(
    availablePipeColumns.map((column) => [
      column.id,
      column.name,
    ]),
  );
  const pipePaths = usePipePaths({
    pipeSourceIdDraft,
    selectedPipeSource,
    sourceEvents,
  });
  const pipeMappingByColumnId = useMemo(
    () =>
      new Map(
        pipeMappingsDraft.map((mapping) => [
          mapping.columnId,
          mapping,
        ]),
      ),
    [
      pipeMappingsDraft,
    ],
  );
  const configuredPipeColumnCount = pipeMappingsDraft.filter(
    (mapping) => mapping.jsonPath.trim().length > 0,
  ).length;
  const pipeCreateDisabled =
    sources.length === 0 ||
    tableOptions.length === 0 ||
    initialData.inputColumns.length === 0;

  useEffect(() => {
    if (!selectedPipe) {
      return;
    }

    setPipeSourceIdDraft(selectedPipe.sourceId);
    setPipeTableIdDraft(selectedPipe.tableId);
    setPipeMappingsDraft(
      normalizePipeMappings(selectedPipe.mappings).map((mapping) =>
        createPipeMappingDraft(mapping),
      ),
    );
    setPipeError(null);
  }, [
    selectedPipe,
  ]);

  const updatePipeMapping = (
    columnId: string,
    patch: Partial<PipeMappingInput>,
  ) => {
    setPipeMappingsDraft((current) =>
      updatePipeMappingDrafts(current, columnId, patch),
    );
  };

  const togglePipeMapping = (columnId: string) => {
    setPipeMappingsDraft((current) =>
      togglePipeMappingDraft(current, columnId),
    );
  };

  const clearPipeMappings = () => {
    setPipeMappingsDraft([]);
  };

  const updatePipeTableIdDraft = (tableId: string) => {
    setPipeTableIdDraft(tableId);
    setPipeMappingsDraft([]);
  };

  const handleAutoMapPipeColumns = () => {
    if (pipePaths.pipePathCandidates.length === 0) {
      setPipeError(
        "Auto-map needs source schema fields or a captured valid parsed event.",
      );
      return;
    }

    let nextMatchedColumnCount = 0;

    setPipeMappingsDraft((current) => {
      const next = autoMapPipeMappingDrafts({
        availablePipeColumns,
        current,
        pipePathCandidateByNormalizedKey:
          pipePaths.pipePathCandidateByNormalizedKey,
      });

      nextMatchedColumnCount = next.matchedColumnCount;
      return next.mappings;
    });

    setPipeError(
      nextMatchedColumnCount === 0
        ? "No input columns matched the available JSONPath suggestions by name."
        : null,
    );
  };

  const handleSavePipe = async () => {
    const mappings = buildPipeMappingsPayload(pipeMappingsDraft);

    if (!pipeSourceIdDraft) {
      setPipeError("Choose a source.");
      return;
    }

    if (!pipeTableIdDraft) {
      setPipeError("Choose a table.");
      return;
    }

    if (mappings.length === 0) {
      setPipeError("Add at least one source-to-column mapping.");
      return;
    }

    setPipePending(true);
    setPipeError(null);

    try {
      if (!selectedPipe) {
        throw new Error("Select a pipe before saving.");
      }

      const updated = await sdk.pipes.update({
        id: selectedPipe.id,
        values: {
          mappings,
          sourceId: pipeSourceIdDraft,
          tableId: pipeTableIdDraft,
        },
      });

      setSelectedPipe(updated);
      marbleToast.success("Pipe updated");
    } catch (error) {
      setPipeError(getErrorMessage(error));
    } finally {
      setPipePending(false);
    }
  };

  const performDeletePipe = async (pipeId: string) => {
    setPipePending(true);
    setPipeError(null);

    try {
      await sdk.pipes.delete({
        id: pipeId,
      });
      setSelectedPipe(null);
      router.push(`/projects/${projectId}`);
      marbleToast.success("Pipe deleted");
    } catch (error) {
      setPipeError(getErrorMessage(error));
    } finally {
      setPipePending(false);
    }
  };

  const handleDeletePipe = () => {
    if (!selectedPipe || pipePending) {
      return;
    }

    const selectedPipeTitle = buildPipeTitle({
      sourceLabel: sourceLabelById.get(selectedPipe.sourceId),
      tableLabel: tableLabelById.get(selectedPipe.tableId),
    });

    setConfirmState({
      confirmLabel: "Delete pipe",
      message: `Delete pipe "${selectedPipeTitle}"?`,
      onConfirm: () => {
        void performDeletePipe(selectedPipe.id);
      },
      title: "Delete pipe",
    });
  };

  const pipeSourceLabel =
    sourceLabelById.get(pipeSourceIdDraft) ?? "Choose source";
  const pipeTableLabel = tableLabelById.get(pipeTableIdDraft) ?? "Choose table";
  const pipePageTitle = buildPipeTitle({
    sourceLabel: pipeSourceLabel,
    tableLabel: pipeTableLabel,
  });
  const pipeHeaderSummary = buildPipeMappingSummary(
    pipeMappingsDraft,
    pipeColumnLabelById,
  );

  return {
    availablePipeColumns,
    clearPipeMappings,
    configuredPipeColumnCount,
    confirmState,
    handleAutoMapPipeColumns,
    handleDeletePipe,
    handleSavePipe,
    pipeCreateDisabled,
    pipeError,
    pipeHeaderSummary,
    pipeMappingByColumnId,
    pipeMappingsDraft,
    pipePageTitle,
    pipePathCandidateByNormalizedKey:
      pipePaths.pipePathCandidateByNormalizedKey,
    pipePathCandidates: pipePaths.pipePathCandidates,
    pipePathSuggestionOptions: pipePaths.pipePathSuggestionOptions,
    pipePending,
    pipeSourceIdDraft,
    pipeSuggestionSummary: pipePaths.pipeSuggestionSummary,
    pipeTableIdDraft,
    projectId,
    projectName,
    selectedPipe,
    setConfirmState,
    setPipeSourceIdDraft,
    sources,
    tableOptions,
    togglePipeMapping,
    updatePipeMapping,
    updatePipeTableIdDraft,
  };
};
