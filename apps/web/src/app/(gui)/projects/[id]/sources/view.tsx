"use client";

import type { Database } from "@marble/supabase";
import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardHeader,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleFieldLabel,
  MarbleInput,
  MarbleListRow,
  MarblePane,
  MarbleSelect,
  MarbleTextarea,
  marbleToast,
} from "@marble/ui";
import { TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProjectSourceWorkspaceData } from "../../../../../lib/source-data";
import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../change-spotlight";
import * as actions from "./actions";

type SourceRecord = Database["public"]["Tables"]["source"]["Row"];
type DrainRecord = Database["public"]["Tables"]["drain"]["Row"];
type DrainMappingInput = Awaited<
  Parameters<typeof actions.createDrainAction>[1]
>["mappings"][number];
type DrainMappingDraft = DrainMappingInput & {
  draftId: string;
};
type ProjectSourceDetailMode = "drain" | "source";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const DEFAULT_SOURCE_SCHEMA_TEXT = JSON.stringify(
  {
    type: "object",
  },
  null,
  2,
);

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function sortByCreatedAtDesc<
  T extends {
    created_at: string;
  },
>(records: T[]) {
  return [
    ...records,
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );
}

function sortByUpdatedAtDesc<
  T extends {
    updated_at: string;
  },
>(records: T[]) {
  return [
    ...records,
  ].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() -
      new Date(left.updated_at).getTime(),
  );
}

function webhookEndpoint(baseUrl: string, source: Pick<SourceRecord, "id">) {
  return `${baseUrl}/webhooks/${source.id}`;
}

function sourceTitle(source: null | Pick<SourceRecord, "name">) {
  return source?.name || "Untitled Source";
}

function drainTitle(drain: null | Pick<DrainRecord, "name">) {
  return drain?.name || "Untitled Drain";
}

function normalizeDrainMappings(value: unknown): DrainMappingInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const candidate = entry as {
      columnId?: unknown;
      jsonPath?: unknown;
    };

    if (
      typeof candidate.columnId !== "string" ||
      typeof candidate.jsonPath !== "string"
    ) {
      return [];
    }

    return [
      {
        columnId: candidate.columnId,
        jsonPath: candidate.jsonPath,
      },
    ];
  });
}

function createDrainMappingDraft(
  value: Partial<DrainMappingInput> = {},
): DrainMappingDraft {
  return {
    columnId: value.columnId ?? "",
    draftId: crypto.randomUUID(),
    jsonPath: value.jsonPath ?? "$",
  };
}

function buildSourceCreateHref(projectId: string) {
  return `/projects/${projectId}/sources/new`;
}

function buildSourceDetailHref(projectId: string, sourceId: string) {
  return `/projects/${projectId}/sources/${sourceId}`;
}

function buildDrainCreateHref(projectId: string) {
  return `/projects/${projectId}/drains/new`;
}

function buildDrainDetailHref(projectId: string, drainId: string) {
  return `/projects/${projectId}/drains/${drainId}`;
}

export function ProjectSourceDetailPageView({
  initialData,
  initialDrainId = null,
  initialSourceId = null,
  isCreating = false,
  mode,
}: {
  initialData: ProjectSourceWorkspaceData;
  initialDrainId?: string | null;
  initialSourceId?: string | null;
  isCreating?: boolean;
  mode: ProjectSourceDetailMode;
}) {
  const router = useRouter();
  const projectId = initialData.project.id;
  const projectName = initialData.project.name;

  const [sources, setSources] = useState(() =>
    sortByUpdatedAtDesc(initialData.sources),
  );
  const [sourceEvents, setSourceEvents] = useState(() =>
    sortByCreatedAtDesc(initialData.sourceEvents),
  );
  const [drains, setDrains] = useState(() =>
    sortByUpdatedAtDesc(initialData.drains),
  );
  const [currentSourceId, setCurrentSourceId] = useState(initialSourceId);
  const [currentDrainId, setCurrentDrainId] = useState(initialDrainId);
  const [creatingSource, setCreatingSource] = useState(
    mode === "source" && isCreating,
  );
  const [creatingDrain, setCreatingDrain] = useState(
    mode === "drain" && isCreating,
  );
  const [selectedSourceEventId, setSelectedSourceEventId] = useState<
    null | string
  >(null);
  const [sourceNameDraft, setSourceNameDraft] = useState("");
  const [sourceSchemaDraft, setSourceSchemaDraft] = useState(
    DEFAULT_SOURCE_SCHEMA_TEXT,
  );
  const [sourceError, setSourceError] = useState<null | string>(null);
  const [sourcePending, setSourcePending] = useState(false);
  const [drainNameDraft, setDrainNameDraft] = useState("");
  const [drainSourceIdDraft, setDrainSourceIdDraft] = useState("");
  const [drainTableIdDraft, setDrainTableIdDraft] = useState("");
  const [drainMappingsDraft, setDrainMappingsDraft] = useState<
    DrainMappingDraft[]
  >([
    createDrainMappingDraft(),
  ]);
  const [drainError, setDrainError] = useState<null | string>(null);
  const [drainPending, setDrainPending] = useState(false);

  const selectedSource = currentSourceId
    ? (sources.find((source) => source.id === currentSourceId) ?? null)
    : null;
  const selectedDrain = currentDrainId
    ? (drains.find((drain) => drain.id === currentDrainId) ?? null)
    : null;
  const selectedSourceEvents = useMemo(
    () =>
      sortByCreatedAtDesc(
        sourceEvents.filter((event) => event.source_id === currentSourceId),
      ),
    [
      currentSourceId,
      sourceEvents,
    ],
  );
  const selectedSourceEvent =
    selectedSourceEventId && selectedSourceEvents.length > 0
      ? (selectedSourceEvents.find(
          (event) => event.id === selectedSourceEventId,
        ) ?? null)
      : (selectedSourceEvents[0] ?? null);
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
  const availableDrainColumns = useMemo(
    () =>
      initialData.inputColumns.filter(
        (column) => column.table_id === drainTableIdDraft,
      ),
    [
      drainTableIdDraft,
      initialData.inputColumns,
    ],
  );
  const firstSourceId = sources[0]?.id ?? "";
  const firstTableId = tableOptions[0]?.id ?? "";
  const drainCreateDisabled =
    sources.length === 0 ||
    tableOptions.length === 0 ||
    initialData.inputColumns.length === 0;

  useEffect(() => {
    if (mode !== "source") {
      return;
    }

    if (creatingSource) {
      setSourceNameDraft("");
      setSourceSchemaDraft(DEFAULT_SOURCE_SCHEMA_TEXT);
      setSourceError(null);
      return;
    }

    if (!selectedSource) {
      return;
    }

    setSourceNameDraft(selectedSource.name);
    setSourceSchemaDraft(formatJson(selectedSource.payload_schema));
    setSourceError(null);
  }, [
    creatingSource,
    mode,
    selectedSource,
  ]);

  useEffect(() => {
    if (mode !== "source") {
      return;
    }

    setSelectedSourceEventId(selectedSourceEvents[0]?.id ?? null);
  }, [
    mode,
    selectedSourceEvents,
  ]);

  useEffect(() => {
    if (mode !== "drain") {
      return;
    }

    if (creatingDrain) {
      setDrainNameDraft("");
      setDrainSourceIdDraft(firstSourceId);
      setDrainTableIdDraft(firstTableId);
      setDrainMappingsDraft([
        createDrainMappingDraft(),
      ]);
      setDrainError(null);
      return;
    }

    if (!selectedDrain) {
      return;
    }

    setDrainNameDraft(selectedDrain.name);
    setDrainSourceIdDraft(selectedDrain.source_id);
    setDrainTableIdDraft(selectedDrain.table_id);
    setDrainMappingsDraft(
      normalizeDrainMappings(selectedDrain.mappings).map((mapping) =>
        createDrainMappingDraft(mapping),
      ),
    );
    setDrainError(null);
  }, [
    creatingDrain,
    firstSourceId,
    firstTableId,
    mode,
    selectedDrain,
  ]);

  const updateDrainMapping = (
    draftId: string,
    patch: Partial<DrainMappingInput>,
  ) => {
    setDrainMappingsDraft((current) =>
      current.map((mapping) =>
        mapping.draftId === draftId
          ? {
              ...mapping,
              ...patch,
            }
          : mapping,
      ),
    );
  };

  const handleSaveSource = async () => {
    let payloadSchema: unknown;

    try {
      payloadSchema = JSON.parse(sourceSchemaDraft);
    } catch {
      setSourceError("Payload schema must be valid JSON.");
      return;
    }

    setSourcePending(true);
    setSourceError(null);

    try {
      if (creatingSource) {
        const created = await actions.createSourceAction(projectId, {
          name: sourceNameDraft.trim() || undefined,
          payloadSchema,
        });

        setSources((current) =>
          sortByUpdatedAtDesc([
            created,
            ...current,
          ]),
        );
        setCreatingSource(false);
        setCurrentSourceId(created.id);
        router.replace(buildSourceDetailHref(projectId, created.id));
        marbleToast.success("Source created");
        return;
      }

      if (!selectedSource) {
        throw new Error("Select a source before saving.");
      }

      const updated = await actions.updateSourceAction(
        projectId,
        selectedSource.id,
        {
          name: sourceNameDraft.trim() || undefined,
          payloadSchema,
        },
      );

      setSources((current) =>
        sortByUpdatedAtDesc(
          current.map((source) =>
            source.id === updated.id ? updated : source,
          ),
        ),
      );
      marbleToast.success("Source updated");
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : String(error));
    } finally {
      setSourcePending(false);
    }
  };

  const handleDeleteSource = async () => {
    if (!selectedSource || sourcePending) {
      return;
    }

    if (!window.confirm(`Delete source "${sourceTitle(selectedSource)}"?`)) {
      return;
    }

    setSourcePending(true);
    setSourceError(null);

    try {
      await actions.deleteSourceAction(projectId, selectedSource.id);
      setSources((current) =>
        current.filter((source) => source.id !== selectedSource.id),
      );
      setDrains((current) =>
        current.filter((drain) => drain.source_id !== selectedSource.id),
      );
      setSourceEvents((current) =>
        current.filter((event) => event.source_id !== selectedSource.id),
      );
      router.push(`/projects/${projectId}`);
      marbleToast.success("Source deleted");
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : String(error));
    } finally {
      setSourcePending(false);
    }
  };

  const handleSaveDrain = async () => {
    const mappings = drainMappingsDraft
      .filter(
        (mapping) =>
          mapping.columnId.trim().length > 0 &&
          mapping.jsonPath.trim().length > 0,
      )
      .map(({ columnId, jsonPath }) => ({
        columnId,
        jsonPath,
      }));

    if (!drainSourceIdDraft) {
      setDrainError("Choose a source.");
      return;
    }

    if (!drainTableIdDraft) {
      setDrainError("Choose a table.");
      return;
    }

    if (mappings.length === 0) {
      setDrainError("Add at least one source-to-column mapping.");
      return;
    }

    setDrainPending(true);
    setDrainError(null);

    try {
      if (creatingDrain) {
        const created = await actions.createDrainAction(projectId, {
          mappings,
          name: drainNameDraft.trim() || undefined,
          sourceId: drainSourceIdDraft,
          tableId: drainTableIdDraft,
        });

        setDrains((current) =>
          sortByUpdatedAtDesc([
            created,
            ...current,
          ]),
        );
        setCreatingDrain(false);
        setCurrentDrainId(created.id);
        router.replace(buildDrainDetailHref(projectId, created.id));
        marbleToast.success("Drain created");
        return;
      }

      if (!selectedDrain) {
        throw new Error("Select a drain before saving.");
      }

      const updated = await actions.updateDrainAction(
        projectId,
        selectedDrain.id,
        {
          mappings,
          name: drainNameDraft.trim() || undefined,
          sourceId: drainSourceIdDraft,
          tableId: drainTableIdDraft,
        },
      );

      setDrains((current) =>
        sortByUpdatedAtDesc(
          current.map((drain) => (drain.id === updated.id ? updated : drain)),
        ),
      );
      marbleToast.success("Drain updated");
    } catch (error) {
      setDrainError(error instanceof Error ? error.message : String(error));
    } finally {
      setDrainPending(false);
    }
  };

  const handleDeleteDrain = async () => {
    if (!selectedDrain || drainPending) {
      return;
    }

    if (!window.confirm(`Delete drain "${drainTitle(selectedDrain)}"?`)) {
      return;
    }

    setDrainPending(true);
    setDrainError(null);

    try {
      await actions.deleteDrainAction(projectId, selectedDrain.id);
      setDrains((current) =>
        current.filter((drain) => drain.id !== selectedDrain.id),
      );
      router.push(`/projects/${projectId}`);
      marbleToast.success("Drain deleted");
    } catch (error) {
      setDrainError(error instanceof Error ? error.message : String(error));
    } finally {
      setDrainPending(false);
    }
  };

  const sourcePageTitle = creatingSource
    ? "New source"
    : sourceTitle(selectedSource);
  const drainPageTitle = creatingDrain
    ? "New drain"
    : drainTitle(selectedDrain);
  const pageTitle = mode === "source" ? sourcePageTitle : drainPageTitle;
  const paneTargetKey =
    mode === "source"
      ? creatingSource || !selectedSource
        ? changeTargetKey.project(projectId)
        : changeTargetKey.source(selectedSource.id)
      : creatingDrain || !selectedDrain
        ? changeTargetKey.project(projectId)
        : changeTargetKey.drain(selectedDrain.id);
  const drainSourceLabel =
    sources.find((source) => source.id === drainSourceIdDraft)?.name ??
    "Choose source";
  const drainTableLabel =
    tableOptions.find((table) => table.id === drainTableIdDraft)?.label ??
    "Choose table";

  return (
    <MarblePane
      actions={[
        {
          children: "Back to project",
          id: "back-to-project",
          onClick: () => router.push(`/projects/${projectId}`),
          variant: "light",
        },
      ]}
      crumbs={[
        {
          href: "/projects",
          id: "projects",
          label: "Projects",
        },
        {
          href: `/projects/${projectId}`,
          id: "project",
          label: projectName,
        },
        {
          id: mode,
          label: pageTitle,
        },
      ]}
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-5"
        {...getChangeTargetProps(paneTargetKey)}
      >
        <div className="space-y-3">
          <h1 className="text-4xl tracking-tight text-zinc-950">{pageTitle}</h1>

          {mode === "source" ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
              <span>{selectedSourceEvents.length} cached events</span>
              {!creatingSource && selectedSource ? (
                <span className="font-mono text-xs text-zinc-400">
                  {selectedSource.id}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
              <span>{drainSourceLabel}</span>
              <span>{"->"}</span>
              <span>{drainTableLabel}</span>
              {!creatingDrain && selectedDrain ? (
                <span className="font-mono text-xs text-zinc-400">
                  {selectedDrain.id}
                </span>
              ) : null}
            </div>
          )}
        </div>

        {mode === "source" ? (
          <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(22rem,0.95fr)_minmax(0,1.15fr)]">
            <MarbleCard
              className="min-h-0"
              tone="subtle"
            >
              <MarbleCardHeader
                actions={
                  creatingSource
                    ? undefined
                    : [
                        {
                          children: "New source",
                          onClick: () =>
                            router.push(buildSourceCreateHref(projectId)),
                          variant: "light",
                        },
                      ]
                }
              >
                <MarbleCardTitle>Source settings</MarbleCardTitle>
              </MarbleCardHeader>
              <MarbleCardContent className="space-y-4">
                {sourceError ? (
                  <MarbleAlert tone="error">{sourceError}</MarbleAlert>
                ) : null}

                <div className="space-y-1.5">
                  <MarbleFieldLabel>Name</MarbleFieldLabel>
                  <MarbleInput
                    onChange={(event) => setSourceNameDraft(event.target.value)}
                    placeholder="Untitled Source"
                    value={sourceNameDraft}
                    wrapperClassName="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <MarbleFieldLabel>Payload schema</MarbleFieldLabel>
                  <MarbleTextarea
                    className="min-h-[14rem] font-mono text-xs"
                    onChange={(event) =>
                      setSourceSchemaDraft(event.target.value)
                    }
                    value={sourceSchemaDraft}
                    wrapperClassName="w-full"
                  />
                  <div className="text-[11px] text-zinc-500">
                    Default is a JSON schema object. Leave it broad if you just
                    want a source cache first.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <MarbleFieldLabel>Webhook endpoint</MarbleFieldLabel>
                  <MarbleInput
                    readOnly
                    value={
                      selectedSource
                        ? webhookEndpoint(
                            initialData.webhookBaseUrl,
                            selectedSource,
                          )
                        : "Save the source first to get a webhook endpoint."
                    }
                    wrapperClassName="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <MarbleFieldLabel>Webhook token</MarbleFieldLabel>
                  <MarbleInput
                    readOnly
                    value={
                      selectedSource?.webhook_token ??
                      "Save the source first to get a webhook token."
                    }
                    wrapperClassName="w-full"
                  />
                  <div className="text-[11px] text-zinc-500">
                    Send it as `Authorization: Bearer &lt;token&gt;` or
                    `X-Marble-Webhook-Token`.
                  </div>
                </div>

                <MarbleAlert tone="neutral">
                  Source events keep both the raw payload and the parsed
                  payload. Parse errors are cached, not fatal.
                </MarbleAlert>

                <div className="flex flex-wrap items-center gap-2">
                  <MarbleButton
                    disabled={sourcePending}
                    onClick={() => void handleSaveSource()}
                    variant="dark"
                  >
                    {sourcePending
                      ? "Saving"
                      : creatingSource
                        ? "Create source"
                        : "Save source"}
                  </MarbleButton>

                  {!creatingSource ? (
                    <MarbleButton
                      disabled={sourcePending || !selectedSource}
                      onClick={() => void handleDeleteSource()}
                      variant="red"
                    >
                      Delete
                    </MarbleButton>
                  ) : null}
                </div>
              </MarbleCardContent>
            </MarbleCard>

            <MarbleCard className="min-h-0">
              <MarbleCardHeader>
                <MarbleCardTitle>Recent cached events</MarbleCardTitle>
              </MarbleCardHeader>
              <MarbleCardContent className="flex min-h-0 flex-1 flex-col gap-4">
                {creatingSource || !selectedSource ? (
                  <MarbleEmptyState
                    description="Create the source first. Once it exists, incoming webhook payloads will show up here."
                    title="No source events yet"
                  />
                ) : selectedSourceEvents.length === 0 ? (
                  <MarbleEmptyState
                    description="Post JSON to the webhook and the raw and parsed payloads will land here."
                    title="No events for this source yet"
                  />
                ) : (
                  <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
                    <div className="min-h-0 overflow-y-auto rounded-xs border border-taupe-200">
                      {selectedSourceEvents.map((event) => (
                        <MarbleListRow
                          active={selectedSourceEvent?.id === event.id}
                          description={
                            <div className="space-y-1">
                              <div>
                                {DATE_TIME_FORMATTER.format(
                                  new Date(event.created_at),
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-zinc-400">
                                {event.id}
                              </div>
                            </div>
                          }
                          key={event.id}
                          meta={
                            <MarbleBadge
                              caps
                              tone={event.parse_error ? "warning" : "neutral"}
                            >
                              {event.parse_error ? "Parse error" : "Parsed"}
                            </MarbleBadge>
                          }
                          onClick={() => setSelectedSourceEventId(event.id)}
                          title="Source event"
                          tone="orange"
                        />
                      ))}
                    </div>

                    <div className="flex min-h-0 flex-col gap-3">
                      {selectedSourceEvent ? (
                        <>
                          <div className="space-y-1.5">
                            <MarbleFieldLabel>Raw payload</MarbleFieldLabel>
                            <MarbleTextarea
                              className="min-h-[12rem] font-mono text-xs"
                              readOnly
                              value={formatJson(
                                selectedSourceEvent.raw_payload,
                              )}
                              wrapperClassName="w-full"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <MarbleFieldLabel>Parsed payload</MarbleFieldLabel>
                            <MarbleTextarea
                              className="min-h-[12rem] font-mono text-xs"
                              readOnly
                              value={formatJson(
                                selectedSourceEvent.parsed_payload,
                              )}
                              wrapperClassName="w-full"
                            />
                          </div>

                          {selectedSourceEvent.parse_error ? (
                            <MarbleAlert tone="warning">
                              {selectedSourceEvent.parse_error}
                            </MarbleAlert>
                          ) : null}
                        </>
                      ) : (
                        <MarbleEmptyState
                          description="Select an event to inspect its payload."
                          title="Choose a cached event"
                        />
                      )}
                    </div>
                  </div>
                )}
              </MarbleCardContent>
            </MarbleCard>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <MarbleCard
              className="w-full max-w-5xl"
              tone="subtle"
            >
              <MarbleCardHeader
                actions={
                  creatingDrain
                    ? undefined
                    : [
                        {
                          children: "New drain",
                          onClick: () =>
                            router.push(buildDrainCreateHref(projectId)),
                          variant: "light",
                        },
                      ]
                }
              >
                <MarbleCardTitle>Drain settings</MarbleCardTitle>
              </MarbleCardHeader>
              <MarbleCardContent className="space-y-4">
                {drainError ? (
                  <MarbleAlert tone="error">{drainError}</MarbleAlert>
                ) : null}

                <div className="space-y-1.5">
                  <MarbleFieldLabel>Name</MarbleFieldLabel>
                  <MarbleInput
                    onChange={(event) => setDrainNameDraft(event.target.value)}
                    placeholder="Untitled Drain"
                    value={drainNameDraft}
                    wrapperClassName="w-full"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <MarbleFieldLabel>Source</MarbleFieldLabel>
                    <MarbleSelect
                      onChange={(event) =>
                        setDrainSourceIdDraft(event.target.value)
                      }
                      value={drainSourceIdDraft}
                      wrapperClassName="w-full"
                    >
                      <option value="">Choose source</option>
                      {sources.map((source) => (
                        <option
                          key={source.id}
                          value={source.id}
                        >
                          {sourceTitle(source)}
                        </option>
                      ))}
                    </MarbleSelect>
                  </div>

                  <div className="space-y-1.5">
                    <MarbleFieldLabel>Table</MarbleFieldLabel>
                    <MarbleSelect
                      onChange={(event) => {
                        setDrainTableIdDraft(event.target.value);
                        setDrainMappingsDraft((current) =>
                          current.map((mapping) => ({
                            ...mapping,
                            columnId: "",
                          })),
                        );
                      }}
                      value={drainTableIdDraft}
                      wrapperClassName="w-full"
                    >
                      <option value="">Choose table</option>
                      {tableOptions.map((table) => (
                        <option
                          key={table.id}
                          value={table.id}
                        >
                          {table.label}
                        </option>
                      ))}
                    </MarbleSelect>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-sm text-zinc-900">
                      Column mappings
                    </div>
                    <MarbleButton
                      onClick={() =>
                        setDrainMappingsDraft((current) => [
                          ...current,
                          createDrainMappingDraft(),
                        ])
                      }
                      size="xs"
                      variant="light"
                    >
                      Add mapping
                    </MarbleButton>
                  </div>

                  {drainMappingsDraft.map((mapping) => (
                    <div
                      className="grid gap-3 rounded-xs border border-taupe-200 bg-white/60 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                      key={mapping.draftId}
                    >
                      <div className="space-y-1.5">
                        <MarbleFieldLabel>Input column</MarbleFieldLabel>
                        <MarbleSelect
                          onChange={(event) =>
                            updateDrainMapping(mapping.draftId, {
                              columnId: event.target.value,
                            })
                          }
                          value={mapping.columnId}
                          wrapperClassName="w-full"
                        >
                          <option value="">Choose column</option>
                          {availableDrainColumns.map((column) => (
                            <option
                              key={column.id}
                              value={column.id}
                            >
                              {column.table_name} / {column.name}
                            </option>
                          ))}
                        </MarbleSelect>
                      </div>

                      <div className="space-y-1.5">
                        <MarbleFieldLabel>JSONPath</MarbleFieldLabel>
                        <MarbleInput
                          onChange={(event) =>
                            updateDrainMapping(mapping.draftId, {
                              jsonPath: event.target.value,
                            })
                          }
                          placeholder="$.record.email"
                          value={mapping.jsonPath}
                          wrapperClassName="w-full"
                        />
                      </div>

                      <div className="flex items-end">
                        <MarbleButton
                          disabled={drainMappingsDraft.length === 1}
                          onClick={() =>
                            setDrainMappingsDraft((current) =>
                              current.filter(
                                (candidate) =>
                                  candidate.draftId !== mapping.draftId,
                              ),
                            )
                          }
                          size="xs"
                          variant="red"
                        >
                          <TrashIcon size={12} />
                        </MarbleButton>
                      </div>
                    </div>
                  ))}
                </div>

                <MarbleAlert tone="neutral">
                  Drains only write into input-eligible cells, then start those
                  cells. Row-level follow-on work can wake up later through
                  column conditions.
                </MarbleAlert>

                <div className="flex flex-wrap items-center gap-2">
                  <MarbleButton
                    disabled={drainPending || drainCreateDisabled}
                    onClick={() => void handleSaveDrain()}
                    variant="dark"
                  >
                    {drainPending
                      ? "Saving"
                      : creatingDrain
                        ? "Create drain"
                        : "Save drain"}
                  </MarbleButton>

                  {!creatingDrain ? (
                    <MarbleButton
                      disabled={drainPending || !selectedDrain}
                      onClick={() => void handleDeleteDrain()}
                      variant="red"
                    >
                      Delete
                    </MarbleButton>
                  ) : null}
                </div>

                {drainCreateDisabled ? (
                  <MarbleAlert tone="warning">
                    Create at least one source and one table with an
                    input-eligible column before you add drains.
                  </MarbleAlert>
                ) : null}
              </MarbleCardContent>
            </MarbleCard>
          </div>
        )}
      </div>
    </MarblePane>
  );
}
