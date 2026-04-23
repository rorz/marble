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
  MarbleSearchSelect,
  MarbleSelect,
  MarbleTextarea,
  marbleToast,
} from "@marble/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProjectSourceWorkspaceData } from "../../../../../lib/source-data";
import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../change-spotlight";
import * as actions from "./actions";

type SourceRecord = Database["public"]["Tables"]["source"]["Row"];
type PipeRecord = Database["public"]["Tables"]["pipe"]["Row"];
type PipeMappingInput = Awaited<
  Parameters<typeof actions.createPipeAction>[1]
>["mappings"][number];
type PipeMappingDraft = PipeMappingInput & {
  draftId: string;
};
type PipePathCandidate = {
  key: string;
  path: string;
  preview: string;
};
type ProjectSourceDetailMode = "pipe" | "source";

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

function pipeTitle(pipe: null | Pick<PipeRecord, "name">) {
  return pipe?.name || "Untitled Pipe";
}

function normalizePipeMappings(value: unknown): PipeMappingInput[] {
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

function createPipeMappingDraft(
  value: Partial<PipeMappingInput> = {},
): PipeMappingDraft {
  return {
    columnId: value.columnId ?? "",
    draftId: crypto.randomUUID(),
    jsonPath: value.jsonPath ?? "",
  };
}

function normalizePipeFieldName(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function formatPipeCandidatePreview(value: unknown) {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  }

  if (typeof value === "object") {
    return "Object";
  }

  const preview = String(value);
  return preview.length > 48 ? `${preview.slice(0, 45)}...` : preview;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPipeSchemaPreview(schema: Record<string, unknown>) {
  const enumValues = Array.isArray(schema.enum)
    ? schema.enum.filter(
        (value): value is boolean | null | number | string =>
          typeof value === "boolean" ||
          typeof value === "number" ||
          typeof value === "string" ||
          value === null,
      )
    : [];

  if (enumValues.length > 0) {
    const preview = enumValues
      .slice(0, 3)
      .map((value) => formatPipeCandidatePreview(value))
      .join(", ");

    return enumValues.length > 3 ? `Enum ${preview}, ...` : `Enum ${preview}`;
  }

  const schemaType = schema.type;
  const typeLabels =
    typeof schemaType === "string"
      ? [
          schemaType,
        ]
      : Array.isArray(schemaType)
        ? schemaType.filter(
            (value): value is string => typeof value === "string",
          )
        : [];

  if (typeLabels.length > 0) {
    return typeLabels.join(" | ");
  }

  if (isPlainObject(schema.properties)) {
    return "object";
  }

  if (schema.items !== undefined) {
    return "array";
  }

  return "value";
}

function jsonPathPropertySegment(key: string) {
  return /^[$A-Z_a-z][\w$]*$/u.test(key)
    ? `.${key}`
    : `[${JSON.stringify(key)}]`;
}

function collectPipePathCandidates(
  value: unknown,
  path = "$",
  key = "$",
): PipePathCandidate[] {
  if (Array.isArray(value)) {
    return [
      {
        key,
        path,
        preview: formatPipeCandidatePreview(value),
      },
    ];
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return [
        {
          key,
          path,
          preview: "{}",
        },
      ];
    }

    return entries.flatMap(([entryKey, entryValue]) =>
      collectPipePathCandidates(
        entryValue,
        `${path}${jsonPathPropertySegment(entryKey)}`,
        entryKey,
      ),
    );
  }

  return [
    {
      key,
      path,
      preview: formatPipeCandidatePreview(value),
    },
  ];
}

function dedupePipePathCandidates(candidates: PipePathCandidate[]) {
  const candidateByPath = new Map<string, PipePathCandidate>();

  for (const candidate of candidates) {
    if (candidateByPath.has(candidate.path)) {
      continue;
    }

    candidateByPath.set(candidate.path, candidate);
  }

  return Array.from(candidateByPath.values());
}

function collectPipePathCandidatesFromSchema(
  schema: unknown,
  path = "$",
  key = "$",
): PipePathCandidate[] {
  if (!isPlainObject(schema)) {
    return [];
  }

  const nestedCandidates: PipePathCandidate[] = [];

  for (const branchKey of [
    "allOf",
    "anyOf",
    "oneOf",
  ] as const) {
    const branches = schema[branchKey];

    if (!Array.isArray(branches)) {
      continue;
    }

    for (const branch of branches) {
      nestedCandidates.push(
        ...collectPipePathCandidatesFromSchema(branch, path, key),
      );
    }
  }

  const properties = schema.properties;

  if (isPlainObject(properties)) {
    for (const [entryKey, entrySchema] of Object.entries(properties)) {
      nestedCandidates.push(
        ...collectPipePathCandidatesFromSchema(
          entrySchema,
          `${path}${jsonPathPropertySegment(entryKey)}`,
          entryKey,
        ),
      );
    }
  }

  if (nestedCandidates.length > 0) {
    return dedupePipePathCandidates(nestedCandidates);
  }

  return [
    {
      key,
      path,
      preview: formatPipeSchemaPreview(schema),
    },
  ];
}

function parseGeneratedJsonPath(path: string) {
  if (path === "$") {
    return [];
  }

  if (!path.startsWith("$")) {
    return null;
  }

  const segments: string[] = [];
  let index = 1;

  while (index < path.length) {
    const currentChar = path[index];

    if (currentChar === ".") {
      let nextIndex = index + 1;

      while (
        nextIndex < path.length &&
        path[nextIndex] !== "." &&
        path[nextIndex] !== "["
      ) {
        nextIndex += 1;
      }

      const segment = path.slice(index + 1, nextIndex);

      if (segment.length === 0) {
        return null;
      }

      segments.push(segment);
      index = nextIndex;
      continue;
    }

    if (currentChar === "[") {
      const bracketMatch = /^\[(?:"(?:\\.|[^"\\])*")\]/u.exec(
        path.slice(index),
      );

      if (!bracketMatch) {
        return null;
      }

      const segment = JSON.parse(
        bracketMatch[0].slice(1, bracketMatch[0].length - 1),
      );

      if (typeof segment !== "string") {
        return null;
      }

      segments.push(segment);
      index += bracketMatch[0].length;
      continue;
    }

    return null;
  }

  return segments;
}

function resolveGeneratedJsonPath(value: unknown, path: string) {
  const segments = parseGeneratedJsonPath(path);

  if (segments === null) {
    return undefined;
  }

  let currentValue = value;

  for (const segment of segments) {
    if (!isPlainObject(currentValue) || !(segment in currentValue)) {
      return undefined;
    }

    currentValue = currentValue[segment];
  }

  return currentValue;
}

function buildSourceCreateHref(projectId: string) {
  return `/projects/${projectId}/sources/new`;
}

function buildSourceDetailHref(projectId: string, sourceId: string) {
  return `/projects/${projectId}/sources/${sourceId}`;
}

function buildPipeCreateHref(projectId: string) {
  return `/projects/${projectId}/pipes/new`;
}

function buildPipeDetailHref(projectId: string, pipeId: string) {
  return `/projects/${projectId}/pipes/${pipeId}`;
}

export function ProjectSourceDetailPageView({
  initialData,
  initialPipeId = null,
  initialSourceId = null,
  isCreating = false,
  mode,
}: {
  initialData: ProjectSourceWorkspaceData;
  initialPipeId?: string | null;
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
  const [pipes, setPipes] = useState(() =>
    sortByUpdatedAtDesc(initialData.pipes),
  );
  const [currentSourceId, setCurrentSourceId] = useState(initialSourceId);
  const [currentPipeId, setCurrentPipeId] = useState(initialPipeId);
  const [creatingSource, setCreatingSource] = useState(
    mode === "source" && isCreating,
  );
  const [creatingPipe, setCreatingPipe] = useState(
    mode === "pipe" && isCreating,
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
  const [pipeNameDraft, setPipeNameDraft] = useState("");
  const [pipeSourceIdDraft, setPipeSourceIdDraft] = useState("");
  const [pipeTableIdDraft, setPipeTableIdDraft] = useState("");
  const [pipeMappingsDraft, setPipeMappingsDraft] = useState<
    PipeMappingDraft[]
  >([]);
  const [pipeError, setPipeError] = useState<null | string>(null);
  const [pipePending, setPipePending] = useState(false);

  const selectedSource = currentSourceId
    ? (sources.find((source) => source.id === currentSourceId) ?? null)
    : null;
  const selectedPipe = currentPipeId
    ? (pipes.find((pipe) => pipe.id === currentPipeId) ?? null)
    : null;
  const selectedPipeSource = pipeSourceIdDraft
    ? (sources.find((source) => source.id === pipeSourceIdDraft) ?? null)
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
  const availablePipeColumns = useMemo(
    () =>
      initialData.inputColumns.filter(
        (column) => column.table_id === pipeTableIdDraft,
      ),
    [
      pipeTableIdDraft,
      initialData.inputColumns,
    ],
  );
  const latestPipeSourceEvent = useMemo(
    () =>
      sortByCreatedAtDesc(
        sourceEvents.filter(
          (event) =>
            event.source_id === pipeSourceIdDraft &&
            event.parse_error === null &&
            event.parsed_payload !== null,
        ),
      )[0] ?? null,
    [
      pipeSourceIdDraft,
      sourceEvents,
    ],
  );
  const latestPipeParsedPayload = latestPipeSourceEvent?.parsed_payload ?? null;
  const pipeSchemaPathCandidates = useMemo(
    () =>
      collectPipePathCandidatesFromSchema(
        selectedPipeSource?.payload_schema,
      ).slice(0, 200),
    [
      selectedPipeSource?.payload_schema,
    ],
  );
  const latestPipeEventPathCandidates = useMemo(
    () =>
      latestPipeParsedPayload === null
        ? []
        : collectPipePathCandidates(latestPipeParsedPayload).slice(0, 200),
    [
      latestPipeParsedPayload,
    ],
  );
  const pipeSchemaHasConcreteFields = pipeSchemaPathCandidates.some(
    (candidate) => candidate.path !== "$",
  );
  const pipePathCandidates = useMemo(() => {
    const baseCandidates =
      pipeSchemaHasConcreteFields || latestPipeEventPathCandidates.length === 0
        ? pipeSchemaPathCandidates
        : latestPipeEventPathCandidates;

    if (latestPipeParsedPayload === null) {
      return baseCandidates;
    }

    return baseCandidates.map((candidate) => {
      const previewValue = resolveGeneratedJsonPath(
        latestPipeParsedPayload,
        candidate.path,
      );

      return {
        ...candidate,
        preview:
          previewValue === undefined
            ? candidate.preview
            : formatPipeCandidatePreview(previewValue),
      };
    });
  }, [
    latestPipeEventPathCandidates,
    latestPipeParsedPayload,
    pipeSchemaHasConcreteFields,
    pipeSchemaPathCandidates,
  ]);
  const pipePathCandidateByNormalizedKey = useMemo(() => {
    const candidateByKey = new Map<string, PipePathCandidate>();

    for (const candidate of pipePathCandidates) {
      const normalizedKey = normalizePipeFieldName(candidate.key);

      if (normalizedKey.length === 0 || candidateByKey.has(normalizedKey)) {
        continue;
      }

      candidateByKey.set(normalizedKey, candidate);
    }

    return candidateByKey;
  }, [
    pipePathCandidates,
  ]);
  const pipePathSuggestionOptions = useMemo(
    () =>
      pipePathCandidates.map((candidate) => ({
        label: `${candidate.path} · ${candidate.preview}`,
        value: candidate.path,
      })),
    [
      pipePathCandidates,
    ],
  );
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
  const firstSourceId = sources[0]?.id ?? "";
  const firstTableId = tableOptions[0]?.id ?? "";
  const pipeCreateDisabled =
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
    if (mode !== "pipe") {
      return;
    }

    if (creatingPipe) {
      setPipeNameDraft("");
      setPipeSourceIdDraft(firstSourceId);
      setPipeTableIdDraft(firstTableId);
      setPipeMappingsDraft([]);
      setPipeError(null);
      return;
    }

    if (!selectedPipe) {
      return;
    }

    setPipeNameDraft(selectedPipe.name);
    setPipeSourceIdDraft(selectedPipe.source_id);
    setPipeTableIdDraft(selectedPipe.table_id);
    setPipeMappingsDraft(
      normalizePipeMappings(selectedPipe.mappings).map((mapping) =>
        createPipeMappingDraft(mapping),
      ),
    );
    setPipeError(null);
  }, [
    creatingPipe,
    firstSourceId,
    firstTableId,
    mode,
    selectedPipe,
  ]);

  const updatePipeMapping = (
    columnId: string,
    patch: Partial<PipeMappingInput>,
  ) => {
    setPipeMappingsDraft((current) =>
      current.some((mapping) => mapping.columnId === columnId)
        ? current.map((mapping) =>
            mapping.columnId === columnId
              ? {
                  ...mapping,
                  ...patch,
                }
              : mapping,
          )
        : [
            ...current,
            createPipeMappingDraft({
              columnId,
              ...patch,
            }),
          ],
    );
  };

  const togglePipeMapping = (columnId: string) => {
    setPipeMappingsDraft((current) =>
      current.some((mapping) => mapping.columnId === columnId)
        ? current.filter((mapping) => mapping.columnId !== columnId)
        : [
            ...current,
            createPipeMappingDraft({
              columnId,
            }),
          ],
    );
  };

  const handleAutoMapPipeColumns = () => {
    if (pipePathCandidates.length === 0) {
      setPipeError(
        "Auto-map needs source schema fields or a cached valid parsed event.",
      );
      return;
    }

    let matchedColumnCount = 0;

    setPipeMappingsDraft((current) => {
      const nextByColumnId = new Map(
        current.map((mapping) => [
          mapping.columnId,
          mapping,
        ]),
      );

      for (const column of availablePipeColumns) {
        const candidate = pipePathCandidateByNormalizedKey.get(
          normalizePipeFieldName(column.name),
        );

        if (!candidate) {
          continue;
        }

        const existing = nextByColumnId.get(column.id);
        if (existing?.jsonPath.trim().length) {
          continue;
        }

        matchedColumnCount += 1;
        nextByColumnId.set(
          column.id,
          createPipeMappingDraft({
            columnId: column.id,
            jsonPath: candidate.path,
          }),
        );
      }

      const orderByColumnId = new Map(
        availablePipeColumns.map((column, index) => [
          column.id,
          index,
        ]),
      );

      return Array.from(nextByColumnId.values()).sort(
        (left, right) =>
          (orderByColumnId.get(left.columnId) ?? Number.MAX_SAFE_INTEGER) -
          (orderByColumnId.get(right.columnId) ?? Number.MAX_SAFE_INTEGER),
      );
    });

    setPipeError(
      matchedColumnCount === 0
        ? "No input columns matched the available JSONPath suggestions by name."
        : null,
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
      setPipes((current) =>
        current.filter((pipe) => pipe.source_id !== selectedSource.id),
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

  const handleSavePipe = async () => {
    const mappings = pipeMappingsDraft
      .filter(
        (mapping) =>
          mapping.columnId.trim().length > 0 &&
          mapping.jsonPath.trim().length > 0,
      )
      .map(({ columnId, jsonPath }) => ({
        columnId,
        jsonPath,
      }));

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
      if (creatingPipe) {
        const created = await actions.createPipeAction(projectId, {
          mappings,
          name: pipeNameDraft.trim() || undefined,
          sourceId: pipeSourceIdDraft,
          tableId: pipeTableIdDraft,
        });

        setPipes((current) =>
          sortByUpdatedAtDesc([
            created,
            ...current,
          ]),
        );
        setCreatingPipe(false);
        setCurrentPipeId(created.id);
        router.replace(buildPipeDetailHref(projectId, created.id));
        marbleToast.success("Pipe created");
        return;
      }

      if (!selectedPipe) {
        throw new Error("Select a pipe before saving.");
      }

      const updated = await actions.updatePipeAction(
        projectId,
        selectedPipe.id,
        {
          mappings,
          name: pipeNameDraft.trim() || undefined,
          sourceId: pipeSourceIdDraft,
          tableId: pipeTableIdDraft,
        },
      );

      setPipes((current) =>
        sortByUpdatedAtDesc(
          current.map((pipe) => (pipe.id === updated.id ? updated : pipe)),
        ),
      );
      marbleToast.success("Pipe updated");
    } catch (error) {
      setPipeError(error instanceof Error ? error.message : String(error));
    } finally {
      setPipePending(false);
    }
  };

  const handleDeletePipe = async () => {
    if (!selectedPipe || pipePending) {
      return;
    }

    if (!window.confirm(`Delete pipe "${pipeTitle(selectedPipe)}"?`)) {
      return;
    }

    setPipePending(true);
    setPipeError(null);

    try {
      await actions.deletePipeAction(projectId, selectedPipe.id);
      setPipes((current) =>
        current.filter((pipe) => pipe.id !== selectedPipe.id),
      );
      router.push(`/projects/${projectId}`);
      marbleToast.success("Pipe deleted");
    } catch (error) {
      setPipeError(error instanceof Error ? error.message : String(error));
    } finally {
      setPipePending(false);
    }
  };

  const sourcePageTitle = creatingSource
    ? "New source"
    : sourceTitle(selectedSource);
  const pipePageTitle = creatingPipe ? "New pipe" : pipeTitle(selectedPipe);
  const pageTitle = mode === "source" ? sourcePageTitle : pipePageTitle;
  const paneTargetKey =
    mode === "source"
      ? creatingSource || !selectedSource
        ? changeTargetKey.project(projectId)
        : changeTargetKey.source(selectedSource.id)
      : creatingPipe || !selectedPipe
        ? changeTargetKey.project(projectId)
        : changeTargetKey.pipe(selectedPipe.id);
  const pipeSourceLabel =
    sources.find((source) => source.id === pipeSourceIdDraft)?.name ??
    "Choose source";
  const pipeTableLabel =
    tableOptions.find((table) => table.id === pipeTableIdDraft)?.label ??
    "Choose table";
  const latestPipeSourceEventLabel = latestPipeSourceEvent
    ? DATE_TIME_FORMATTER.format(new Date(latestPipeSourceEvent.created_at))
    : null;
  const pipeSuggestionSummary = pipeSchemaHasConcreteFields
    ? latestPipeSourceEventLabel
      ? `Suggestions from source schema · Previewed with valid event ${latestPipeSourceEventLabel}`
      : "Suggestions from source schema"
    : latestPipeSourceEventLabel
      ? `Schema has no concrete fields yet · Falling back to valid event ${latestPipeSourceEventLabel}`
      : pipeSchemaPathCandidates.length > 0
        ? "Schema is broad, so field suggestions unlock after a valid parsed event lands"
        : "Add source schema fields or cache a valid parsed event to unlock suggestions";

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
              <span>{pipeSourceLabel}</span>
              <span>{"->"}</span>
              <span>{pipeTableLabel}</span>
              {!creatingPipe && selectedPipe ? (
                <span className="font-mono text-xs text-zinc-400">
                  {selectedPipe.id}
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
                  creatingPipe
                    ? undefined
                    : [
                        {
                          children: "New pipe",
                          onClick: () =>
                            router.push(buildPipeCreateHref(projectId)),
                          variant: "light",
                        },
                      ]
                }
              >
                <MarbleCardTitle>Pipe settings</MarbleCardTitle>
              </MarbleCardHeader>
              <MarbleCardContent className="space-y-4">
                {pipeError ? (
                  <MarbleAlert tone="error">{pipeError}</MarbleAlert>
                ) : null}

                <div className="space-y-1.5">
                  <MarbleFieldLabel>Name</MarbleFieldLabel>
                  <MarbleInput
                    onChange={(event) => setPipeNameDraft(event.target.value)}
                    placeholder="Untitled Pipe"
                    value={pipeNameDraft}
                    wrapperClassName="w-full"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <MarbleFieldLabel>Source</MarbleFieldLabel>
                    <MarbleSelect
                      onChange={(event) =>
                        setPipeSourceIdDraft(event.target.value)
                      }
                      value={pipeSourceIdDraft}
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
                        setPipeTableIdDraft(event.target.value);
                        setPipeMappingsDraft([]);
                      }}
                      value={pipeTableIdDraft}
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-sm text-zinc-900">
                        Table input columns
                      </div>
                      <div className="text-xs text-zinc-500">
                        {configuredPipeColumnCount} of{" "}
                        {availablePipeColumns.length} columns mapped
                        {` · ${pipeSuggestionSummary}`}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MarbleButton
                        disabled={
                          pipePathCandidates.length === 0 ||
                          availablePipeColumns.length === 0
                        }
                        onClick={handleAutoMapPipeColumns}
                        size="xs"
                        variant="light"
                      >
                        Auto-map by name
                      </MarbleButton>
                      <MarbleButton
                        disabled={pipeMappingsDraft.length === 0}
                        onClick={() => setPipeMappingsDraft([])}
                        size="xs"
                        variant="light"
                      >
                        Clear mapped
                      </MarbleButton>
                    </div>
                  </div>

                  {availablePipeColumns.length === 0 ? (
                    <MarbleEmptyState
                      description="Choose a table with input-eligible columns to configure this pipe."
                      title="No input columns for this table"
                    />
                  ) : (
                    <div className="overflow-hidden rounded-xs border border-taupe-200 bg-white/60">
                      {availablePipeColumns.map((column) => {
                        const mapping = pipeMappingByColumnId.get(column.id);
                        const isMapped = mapping !== undefined;
                        const hasJsonPath =
                          mapping?.jsonPath.trim().length !== 0;
                        const suggestedCandidate =
                          pipePathCandidateByNormalizedKey.get(
                            normalizePipeFieldName(column.name),
                          );

                        return (
                          <div
                            className="grid gap-3 border-b border-taupe-200 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]"
                            key={column.id}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate font-medium text-sm text-zinc-950">
                                  {column.name}
                                </div>
                                {hasJsonPath ? (
                                  <MarbleBadge tone="success">
                                    Mapped
                                  </MarbleBadge>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                                <span className="font-mono text-[11px]">
                                  {column.id}
                                </span>
                                {suggestedCandidate && !hasJsonPath ? (
                                  <span>
                                    Suggested {suggestedCandidate.path}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <MarbleSearchSelect
                                disabled={!isMapped}
                                onChange={(event) =>
                                  updatePipeMapping(column.id, {
                                    jsonPath: event.target.value,
                                  })
                                }
                                options={pipePathSuggestionOptions}
                                placeholder={
                                  suggestedCandidate?.path ?? "$.record.email"
                                }
                                value={mapping?.jsonPath ?? ""}
                                wrapperClassName="w-full"
                              />
                              <div className="text-[11px] text-zinc-500">
                                {!isMapped
                                  ? "Not mapped."
                                  : hasJsonPath
                                    ? "This path will write into the column when the event payload resolves."
                                    : "Type or pick a JSONPath for this column."}
                              </div>
                            </div>

                            <div className="flex items-center">
                              <MarbleButton
                                onClick={() => togglePipeMapping(column.id)}
                                size="xs"
                                variant={isMapped ? "dark" : "light"}
                              >
                                {isMapped ? "Mapped" : "Map"}
                              </MarbleButton>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <MarbleAlert tone="neutral">
                  Pipes only write into input-eligible cells, then start those
                  cells. Row-level follow-on work can wake up later through
                  column conditions.
                </MarbleAlert>

                <div className="flex flex-wrap items-center gap-2">
                  <MarbleButton
                    disabled={pipePending || pipeCreateDisabled}
                    onClick={() => void handleSavePipe()}
                    variant="dark"
                  >
                    {pipePending
                      ? "Saving"
                      : creatingPipe
                        ? "Create pipe"
                        : "Save pipe"}
                  </MarbleButton>

                  {!creatingPipe ? (
                    <MarbleButton
                      disabled={pipePending || !selectedPipe}
                      onClick={() => void handleDeletePipe()}
                      variant="red"
                    >
                      Delete
                    </MarbleButton>
                  ) : null}
                </div>

                {pipeCreateDisabled ? (
                  <MarbleAlert tone="warning">
                    Create at least one source and one table with an
                    input-eligible column before you add pipes.
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
