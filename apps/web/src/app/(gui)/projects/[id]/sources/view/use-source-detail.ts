import { sortBy as sortRows } from "@marble/lib/array";
import { getErrorMessage } from "@marble/lib/result";
import { normalizeDisplayLabel } from "@marble/lib/string";
import {
  type MarbleConfirmModalState,
  marbleToast,
  useMarbleRouter,
} from "@marble/ui";
import { useEffect, useMemo, useState } from "react";
import { useMarbleSdk } from "../../../../../../lib/marble-sdk-client";
import { compareByUpdatedAtCamelDesc } from "../../../../../../lib/realtime-crud";
import type { ProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import { buildSourceTitle } from "../../../../../../lib/source-display";
import * as actions from "../actions";
import { DEFAULT_SOURCE_SCHEMA_TEXT } from "./constants";
import type { SourceEditingSurface } from "./types";
import { useSourceEvents } from "./use-source-events";
import { formatJson, validateSourceSchemaText } from "./validators";

export const useSourceDetail = ({
  initialData,
  initialSourceId,
}: {
  initialData: ProjectSourceWorkspaceData;
  initialSourceId: string;
}) => {
  const router = useMarbleRouter();
  const sdk = useMarbleSdk({
    profileId: initialData.project.ownerProfileId,
  });
  const projectId = initialData.project.id;
  const projectName = initialData.project.name;
  const initialSource =
    initialData.sources.find((source) => source.id === initialSourceId) ?? null;

  const [sources, setSources] = useState(() =>
    sortRows(initialData.sources, compareByUpdatedAtCamelDesc),
  );
  const [sourceEditingSurface, setSourceEditingSurface] =
    useState<SourceEditingSurface>(null);
  const [sourceNameDraft, setSourceNameDraft] = useState(() =>
    buildSourceTitle(initialSource),
  );
  const [sourceSchemaDraft, setSourceSchemaDraft] = useState(
    DEFAULT_SOURCE_SCHEMA_TEXT,
  );
  const [sourceError, setSourceError] = useState<null | string>(null);
  const [sourceRenameError, setSourceRenameError] = useState<null | string>(
    null,
  );
  const [sourceSchemaInferPending, setSourceSchemaInferPending] =
    useState(false);
  const [sourcePending, setSourcePending] = useState(false);
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);

  const selectedSource =
    sources.find((source) => source.id === initialSourceId) ?? null;
  const sourceEvents = useSourceEvents({
    initialEvents: initialData.sourceEvents,
    sourceId: initialSourceId,
  });
  const sourceSchemaValidation = useMemo(
    () => validateSourceSchemaText(sourceSchemaDraft),
    [
      sourceSchemaDraft,
    ],
  );
  const sourceSchemaError = sourceSchemaValidation.ok
    ? sourceError
    : sourceSchemaValidation.message;

  useEffect(() => {
    if (!selectedSource) {
      return;
    }

    setSourceSchemaDraft(formatJson(selectedSource.payloadSchema));
    setSourceError(null);
    setSourceRenameError(null);
  }, [
    selectedSource,
  ]);

  useEffect(() => {
    if (sourceEditingSurface !== null) {
      return;
    }

    setSourceNameDraft(buildSourceTitle(selectedSource));
  }, [
    selectedSource,
    sourceEditingSurface,
  ]);

  const updateSourceSchemaDraft = (value: string) => {
    setSourceSchemaDraft(value);
    setSourceError(null);
  };

  const stopEditingSourceName = () => {
    setSourceEditingSurface(null);
    setSourceNameDraft(buildSourceTitle(selectedSource));
  };

  const commitSourceName = async () => {
    if (!selectedSource) {
      stopEditingSourceName();
      return;
    }

    const currentName = buildSourceTitle(selectedSource);
    const nextName = normalizeDisplayLabel(sourceNameDraft, "Untitled Source");

    if (nextName === currentName) {
      setSourceEditingSurface(null);
      setSourceNameDraft(currentName);
      return;
    }

    setSourceRenameError(null);
    setSourceEditingSurface(null);
    setSourceNameDraft(nextName);
    setSources((current) =>
      sortRows(
        current.map((source) =>
          source.id === selectedSource.id
            ? {
                ...source,
                name: nextName,
                updatedAt: new Date().toISOString(),
              }
            : source,
        ),
        compareByUpdatedAtCamelDesc,
      ),
    );

    try {
      const updated = await sdk.sources.update({
        id: selectedSource.id,
        values: {
          name: nextName,
        },
      });

      setSources((current) =>
        sortRows(
          current.map((source) =>
            source.id === updated.id ? updated : source,
          ),
          compareByUpdatedAtCamelDesc,
        ),
      );
      setSourceNameDraft(buildSourceTitle(updated));
      marbleToast.success("Source renamed");
    } catch (error) {
      setSources((current) =>
        sortRows(
          current.map((source) =>
            source.id === selectedSource.id ? selectedSource : source,
          ),
          compareByUpdatedAtCamelDesc,
        ),
      );
      setSourceNameDraft(currentName);
      setSourceRenameError(getErrorMessage(error));
    }
  };

  const handleSaveSource = async () => {
    if (!sourceSchemaValidation.ok) {
      setSourceError(sourceSchemaValidation.message);
      return;
    }

    setSourcePending(true);
    setSourceError(null);

    try {
      if (!selectedSource) {
        throw new Error("Select a source before saving.");
      }

      const updated = await sdk.sources.update({
        id: selectedSource.id,
        values: {
          payloadSchema: sourceSchemaValidation.value,
        },
      });

      setSources((current) =>
        sortRows(
          current.map((source) =>
            source.id === updated.id ? updated : source,
          ),
          compareByUpdatedAtCamelDesc,
        ),
      );
      marbleToast.success("Source updated");
    } catch (error) {
      setSourceError(getErrorMessage(error));
    } finally {
      setSourcePending(false);
    }
  };

  const handleInferSourceSchema = async () => {
    if (!sourceEvents.selectedSourceEvent) {
      setSourceError("Select an event before inferring a schema.");
      return;
    }

    setSourceSchemaInferPending(true);
    setSourceError(null);

    try {
      const inferredSchema = await actions.inferSourceSchemaFromEventAction(
        projectId,
        sourceEvents.selectedSourceEvent.id,
      );

      setSourceSchemaDraft(formatJson(inferredSchema));
      marbleToast.success("Schema inferred from selected event");
    } catch (error) {
      setSourceError(getErrorMessage(error));
    } finally {
      setSourceSchemaInferPending(false);
    }
  };

  const performDeleteSource = async (sourceId: string) => {
    setSourcePending(true);
    setSourceError(null);

    try {
      await sdk.sources.delete({
        id: sourceId,
      });
      setSources((current) =>
        current.filter((source) => source.id !== sourceId),
      );
      sourceEvents.removeSourceEvents(sourceId);
      router.push(`/projects/${projectId}`);
      marbleToast.success("Source deleted");
    } catch (error) {
      setSourceError(getErrorMessage(error));
    } finally {
      setSourcePending(false);
    }
  };

  const handleDeleteSource = () => {
    if (!selectedSource || sourcePending) {
      return;
    }

    setConfirmState({
      confirmLabel: "Delete source",
      message: `Delete source "${buildSourceTitle(selectedSource)}"?`,
      onConfirm: () => {
        void performDeleteSource(selectedSource.id);
      },
      title: "Delete source",
    });
  };

  return {
    commitSourceName,
    confirmState,
    handleDeleteSource,
    handleInferSourceSchema,
    handleSaveSource,
    projectId,
    projectName,
    selectedSource,
    selectedSourceEvent: sourceEvents.selectedSourceEvent,
    selectedSourceEvents: sourceEvents.selectedSourceEvents,
    setConfirmState,
    setSelectedSourceEventId: sourceEvents.setSelectedSourceEventId,
    setSourceEditingSurface,
    setSourceNameDraft,
    sourceEditingSurface,
    sourceNameDraft,
    sourcePending,
    sourceRenameError,
    sourceSchemaDraft,
    sourceSchemaError,
    sourceSchemaInferPending,
    sourceSchemaValidation,
    stopEditingSourceName,
    updateSourceSchemaDraft,
  };
};
