"use client";

import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleCardDescription,
  MarbleCardFooter,
  MarbleCardHeader,
  MarbleCardSection,
  MarbleCardTitle,
  MarbleConfirmModal,
  type MarbleConfirmModalState,
  MarbleCopyField,
  MarbleEditableText,
  MarbleEmptyState,
  MarbleField,
  MarbleJsonPreview,
  MarbleListRow,
  MarblePane,
  MarblePaneEditableCrumb,
  MarbleSearchSelect,
  MarbleSelect,
  marbleToast,
} from "@marble/ui";
import type { editor as MonacoEditorApi } from "monaco-editor";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { sourceEventFromBroadcastRow } from "../../../../../lib/marble-resources";
import { useMarbleSdk } from "../../../../../lib/marble-sdk-client";
import {
  buildPipeMappingSummary,
  buildPipeTitle,
  normalizePipeMappings,
} from "../../../../../lib/pipe-display";
import { usePrivateBroadcast } from "../../../../../lib/realtime/private-broadcast";
import type { ProjectSourceWorkspaceData } from "../../../../../lib/source-data";
import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../change-spotlight";
import * as actions from "./actions";

type Source = ProjectSourceWorkspaceData["sources"][number];
type PipeMappingInput = {
  columnId: string;
  jsonPath: string;
};
type PipeMappingDraft = PipeMappingInput & {
  draftId: string;
};
type PipePathCandidate = {
  key: string;
  path: string;
  preview: string;
};
type ProjectSourceDetailMode = "pipe" | "source";
type SourceSchemaValidation =
  | {
      ok: true;
      value: unknown;
    }
  | {
      message: string;
      ok: false;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  loading: () => (
    <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
      Loading editor...
    </div>
  ),
  ssr: false,
});

const sourceSchemaEditorOptions = {
  automaticLayout: true,
  fontFamily:
    '"Geist Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: 13,
  lineNumbersMinChars: 3,
  minimap: {
    enabled: false,
  },
  padding: {
    top: 12,
  },
  renderWhitespace: "selection",
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  tabSize: 2,
} satisfies MonacoEditorApi.IStandaloneEditorConstructionOptions;

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function validateSourceSchemaText(value: string): SourceSchemaValidation {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Payload schema must be JSON.",
      ok: false,
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      message: "Payload schema must be a JSON schema object.",
      ok: false,
    };
  }

  try {
    z.fromJSONSchema(parsed as z.core.JSONSchema.Schema);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? `Payload schema could not be compiled: ${error.message}`
          : "Payload schema could not be compiled.",
      ok: false,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
}

function sortByCreatedAtDesc<
  T extends {
    createdAt: string;
  },
>(records: T[]) {
  return [
    ...records,
  ].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function sortByUpdatedAtDesc<
  T extends {
    updatedAt: string;
  },
>(records: T[]) {
  return [
    ...records,
  ].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function webhookEndpoint(baseUrl: string, source: Pick<Source, "id">) {
  return `${baseUrl}/webhooks/${source.id}`;
}

function sourceTitle(source: null | Pick<Source, "name">) {
  return source?.name || "Untitled Source";
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

export function ProjectSourceDetailPageView({
  initialData,
  initialPipeId = null,
  initialSourceId = null,
  mode,
}: {
  initialData: ProjectSourceWorkspaceData;
  initialPipeId?: string | null;
  initialSourceId?: string | null;
  mode: ProjectSourceDetailMode;
}) {
  const router = useRouter();
  const sdk = useMarbleSdk({
    profileId: initialData.project.ownerProfileId,
  });
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
  const currentSourceId = initialSourceId;
  const currentPipeId = initialPipeId;
  const [selectedSourceEventId, setSelectedSourceEventId] = useState<
    null | string
  >(null);
  const [sourceEditingSurface, setSourceEditingSurface] = useState<
    null | "crumb" | "title"
  >(null);
  const [sourceNameDraft, setSourceNameDraft] = useState(() => {
    const initialSource = initialSourceId
      ? (initialData.sources.find((source) => source.id === initialSourceId) ??
        null)
      : null;

    return sourceTitle(initialSource);
  });
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
  const [pipeSourceIdDraft, setPipeSourceIdDraft] = useState("");
  const [pipeTableIdDraft, setPipeTableIdDraft] = useState("");
  const [pipeMappingsDraft, setPipeMappingsDraft] = useState<
    PipeMappingDraft[]
  >([]);
  const [pipeError, setPipeError] = useState<null | string>(null);
  const [pipePending, setPipePending] = useState(false);
  const [confirmState, setConfirmState] =
    useState<MarbleConfirmModalState | null>(null);

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
        sourceEvents.filter((event) => event.sourceId === currentSourceId),
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
  const sourceLabelById = new Map(
    sources.map((source) => [
      source.id,
      sourceTitle(source),
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
  const latestPipeSourceEvent = useMemo(
    () =>
      sortByCreatedAtDesc(
        sourceEvents.filter(
          (event) =>
            event.sourceId === pipeSourceIdDraft &&
            event.parseError === null &&
            event.parsedPayload !== null,
        ),
      )[0] ?? null,
    [
      pipeSourceIdDraft,
      sourceEvents,
    ],
  );
  const latestPipeParsedPayload = latestPipeSourceEvent?.parsedPayload ?? null;
  const pipeSchemaPathCandidates = useMemo(
    () =>
      collectPipePathCandidatesFromSchema(
        selectedPipeSource?.payloadSchema,
      ).slice(0, 200),
    [
      selectedPipeSource?.payloadSchema,
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
  const sourceSchemaValidation = useMemo(
    () => validateSourceSchemaText(sourceSchemaDraft),
    [
      sourceSchemaDraft,
    ],
  );
  const sourceSchemaError = sourceSchemaValidation.ok
    ? sourceError
    : sourceSchemaValidation.message;
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
    if (mode !== "source") {
      return;
    }

    if (!selectedSource) {
      return;
    }

    setSourceSchemaDraft(formatJson(selectedSource.payloadSchema));
    setSourceError(null);
    setSourceRenameError(null);
  }, [
    mode,
    selectedSource,
  ]);

  useEffect(() => {
    if (mode !== "source" || sourceEditingSurface !== null) {
      return;
    }

    setSourceNameDraft(sourceTitle(selectedSource));
  }, [
    mode,
    selectedSource,
    sourceEditingSurface,
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

  usePrivateBroadcast({
    enabled: mode === "source" && Boolean(currentSourceId),
    event: "INSERT",
    label: "Source event",
    onMessage: (payload) => {
      const record = isRecord(payload) ? payload.record : null;

      if (!isRecord(record)) {
        return;
      }

      const nextEvent = sourceEventFromBroadcastRow(record);

      if (nextEvent.sourceId !== currentSourceId) {
        return;
      }

      setSourceEvents((current) =>
        sortByCreatedAtDesc([
          nextEvent,
          ...current.filter((event) => event.id !== nextEvent.id),
        ]).slice(0, 120),
      );
    },
    topic: currentSourceId
      ? `source-events:${currentSourceId}`
      : "source-events:",
  });

  useEffect(() => {
    if (mode !== "pipe") {
      return;
    }

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
        "Auto-map needs source schema fields or a captured valid parsed event.",
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

  const stopEditingSourceName = () => {
    setSourceEditingSurface(null);
    setSourceNameDraft(sourceTitle(selectedSource));
  };

  const commitSourceName = async () => {
    if (!selectedSource) {
      stopEditingSourceName();
      return;
    }

    const currentName = sourceTitle(selectedSource);
    const nextName = sourceNameDraft.trim() || "Untitled Source";

    if (nextName === currentName) {
      setSourceEditingSurface(null);
      setSourceNameDraft(currentName);
      return;
    }

    setSourceRenameError(null);
    setSourceEditingSurface(null);
    setSourceNameDraft(nextName);
    setSources((current) =>
      sortByUpdatedAtDesc(
        current.map((source) =>
          source.id === selectedSource.id
            ? {
                ...source,
                name: nextName,
                updatedAt: new Date().toISOString(),
              }
            : source,
        ),
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
        sortByUpdatedAtDesc(
          current.map((source) =>
            source.id === updated.id ? updated : source,
          ),
        ),
      );
      setSourceNameDraft(sourceTitle(updated));
      marbleToast.success("Source renamed");
    } catch (error) {
      setSources((current) =>
        sortByUpdatedAtDesc(
          current.map((source) =>
            source.id === selectedSource.id ? selectedSource : source,
          ),
        ),
      );
      setSourceNameDraft(currentName);
      setSourceRenameError(
        error instanceof Error ? error.message : String(error),
      );
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

  const handleInferSourceSchema = async () => {
    if (!selectedSourceEvent) {
      setSourceError("Select an event before inferring a schema.");
      return;
    }

    setSourceSchemaInferPending(true);
    setSourceError(null);

    try {
      const inferredSchema = await actions.inferSourceSchemaFromEventAction(
        projectId,
        selectedSourceEvent.id,
      );

      setSourceSchemaDraft(formatJson(inferredSchema));
      marbleToast.success("Schema inferred from selected event");
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : String(error));
    } finally {
      setSourceSchemaInferPending(false);
    }
  };

  const handleDeleteSource = () => {
    if (!selectedSource || sourcePending) {
      return;
    }

    setConfirmState({
      confirmLabel: "Delete source",
      message: `Delete source "${sourceTitle(selectedSource)}"?`,
      onConfirm: () => {
        void performDeleteSource(selectedSource.id);
      },
      title: "Delete source",
    });
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
      setPipes((current) =>
        current.filter((pipe) => pipe.sourceId !== sourceId),
      );
      setSourceEvents((current) =>
        current.filter((event) => event.sourceId !== sourceId),
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

  const performDeletePipe = async (pipeId: string) => {
    setPipePending(true);
    setPipeError(null);

    try {
      await sdk.pipes.delete({
        id: pipeId,
      });
      setPipes((current) => current.filter((pipe) => pipe.id !== pipeId));
      router.push(`/projects/${projectId}`);
      marbleToast.success("Pipe deleted");
    } catch (error) {
      setPipeError(error instanceof Error ? error.message : String(error));
    } finally {
      setPipePending(false);
    }
  };

  const sourcePageTitle = sourceNameDraft;
  const pipeSourceLabel =
    sourceLabelById.get(pipeSourceIdDraft) ?? "Choose source";
  const pipeTableLabel = tableLabelById.get(pipeTableIdDraft) ?? "Choose table";
  const pipeDraftTitle = buildPipeTitle({
    sourceLabel: pipeSourceLabel,
    tableLabel: pipeTableLabel,
  });
  const pipeMappingSummary = buildPipeMappingSummary(
    pipeMappingsDraft,
    pipeColumnLabelById,
  );
  const pipePageTitle = pipeDraftTitle;
  const pageTitle = mode === "source" ? sourcePageTitle : pipePageTitle;
  const paneTargetKey =
    mode === "source"
      ? !selectedSource
        ? changeTargetKey.project(projectId)
        : changeTargetKey.source(selectedSource.id)
      : !selectedPipe
        ? changeTargetKey.project(projectId)
        : changeTargetKey.pipe(selectedPipe.id);
  const pipeHeaderSummary = pipeMappingSummary;
  const latestPipeSourceEventLabel = latestPipeSourceEvent
    ? DATE_TIME_FORMATTER.format(new Date(latestPipeSourceEvent.createdAt))
    : null;
  const pipeSuggestionSummary = pipeSchemaHasConcreteFields
    ? latestPipeSourceEventLabel
      ? `Suggestions from source schema · Previewed with valid event ${latestPipeSourceEventLabel}`
      : "Suggestions from source schema"
    : latestPipeSourceEventLabel
      ? `Schema has no concrete fields yet · Falling back to valid event ${latestPipeSourceEventLabel}`
      : pipeSchemaPathCandidates.length > 0
        ? "Schema is broad, so field suggestions unlock after a valid captured event lands"
        : "Add source schema fields or capture a valid parsed event to unlock suggestions";
  const paneDisclosureActions =
    mode === "source"
      ? [
          {
            disabled: sourcePending || !selectedSource,
            label: "Delete source",
            onSelect: () => void handleDeleteSource(),
            tone: "danger" as const,
          },
        ]
      : [
          {
            disabled: pipePending || !selectedPipe,
            label: "Delete pipe",
            onSelect: () => void handleDeletePipe(),
            tone: "danger" as const,
          },
        ];

  return (
    <MarblePane
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
          label:
            mode === "source" ? (
              <MarblePaneEditableCrumb
                disabled={!selectedSource}
                editing={sourceEditingSurface === "crumb"}
                onCancel={stopEditingSourceName}
                onChange={setSourceNameDraft}
                onCommit={() => void commitSourceName()}
                onEdit={() => setSourceEditingSurface("crumb")}
                value={sourceNameDraft}
              />
            ) : (
              pageTitle
            ),
        },
      ]}
      disclosureActions={paneDisclosureActions}
      disclosureAriaLabel="Open resource actions"
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-5"
        {...getChangeTargetProps(paneTargetKey)}
      >
        <div className="space-y-3">
          {mode === "source" ? (
            <MarbleEditableText
              className="-mx-1 rounded-sm px-1 text-left text-4xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
              disabled={!selectedSource}
              editing={sourceEditingSurface === "title"}
              onCancel={stopEditingSourceName}
              onChange={setSourceNameDraft}
              onCommit={() => void commitSourceName()}
              onEdit={() => setSourceEditingSurface("title")}
              value={sourceNameDraft}
            />
          ) : (
            <h1 className="text-4xl tracking-tight text-zinc-950">
              {pageTitle}
            </h1>
          )}

          {mode === "source" ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
              <span>{selectedSourceEvents.length} events captured</span>
              {selectedSource ? (
                <span className="font-mono text-xs text-zinc-400">
                  {selectedSource.id}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
              <span>{pipeHeaderSummary}</span>
              {selectedPipe ? (
                <span className="font-mono text-xs text-zinc-400">
                  {selectedPipe.id}
                </span>
              ) : null}
            </div>
          )}
        </div>

        {mode === "source" && sourceRenameError ? (
          <MarbleAlert tone="error">{sourceRenameError}</MarbleAlert>
        ) : null}

        {mode === "source" ? (
          <div className="grid min-h-0 flex-1 items-stretch gap-5 xl:grid-cols-[minmax(22rem,0.95fr)_minmax(0,1.15fr)]">
            <MarbleCard
              className="flex h-full min-h-0"
              tone="subtle"
            >
              <MarbleCardHeader>
                <MarbleCardTitle>Source settings</MarbleCardTitle>
              </MarbleCardHeader>
              <MarbleCardSection className="space-y-3">
                <MarbleCardTitle>Webhook</MarbleCardTitle>
                <MarbleCopyField
                  label="Webhook endpoint"
                  value={
                    selectedSource
                      ? webhookEndpoint(
                          initialData.webhookBaseUrl,
                          selectedSource,
                        )
                      : null
                  }
                />
                <MarbleCopyField
                  label="Webhook token"
                  value={selectedSource?.webhookToken ?? null}
                />
              </MarbleCardSection>
              <MarbleCardSection className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <MarbleCardTitle>Payload schema</MarbleCardTitle>
                  <MarbleButton
                    disabled={
                      !selectedSourceEvent ||
                      sourcePending ||
                      sourceSchemaInferPending
                    }
                    onClick={() => void handleInferSourceSchema()}
                    size="xs"
                    variant="light"
                  >
                    {sourceSchemaInferPending
                      ? "Inferring"
                      : "Infer from selected event"}
                  </MarbleButton>
                </div>
                {sourceSchemaError ? (
                  <MarbleAlert tone="error">{sourceSchemaError}</MarbleAlert>
                ) : null}

                <MarbleField
                  className="flex min-h-[18rem] flex-1 flex-col"
                  label="Schema"
                >
                  <div className="min-h-0 flex-1 overflow-hidden rounded-xs border border-taupe-200 bg-white shadow-sm shadow-zinc-950/10">
                    <MonacoEditor
                      height="100%"
                      language="json"
                      loading={
                        <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
                          Loading editor...
                        </div>
                      }
                      onChange={(value) => {
                        setSourceSchemaDraft(value ?? "");
                        setSourceError(null);
                      }}
                      options={sourceSchemaEditorOptions}
                      path={
                        selectedSource
                          ? `source://${selectedSource.id}/payload-schema.json`
                          : "source://payload-schema.json"
                      }
                      theme="vs"
                      value={sourceSchemaDraft}
                    />
                  </div>
                </MarbleField>
              </MarbleCardSection>
              <MarbleCardFooter>
                <MarbleButton
                  disabled={
                    sourcePending ||
                    sourceSchemaInferPending ||
                    !sourceSchemaValidation.ok
                  }
                  onClick={() => void handleSaveSource()}
                  variant="dark"
                >
                  {sourcePending ? "Saving" : "Save schema"}
                </MarbleButton>
              </MarbleCardFooter>
            </MarbleCard>

            <MarbleCard className="flex h-full min-h-0">
              <MarbleCardHeader>
                <MarbleCardTitle className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-taupe-800 animate-pulse"
                  />
                  Live event preview
                </MarbleCardTitle>
              </MarbleCardHeader>
              <MarbleCardContent className="flex min-h-0 flex-1 flex-col gap-4">
                {!selectedSource ? (
                  <MarbleEmptyState
                    description="Select a source to inspect captured webhook payloads."
                    title="No source selected"
                  />
                ) : selectedSourceEvents.length === 0 ? (
                  <MarbleEmptyState
                    description="Post JSON to the webhook endpoint to preview the latest payload."
                    title="No events captured yet"
                  />
                ) : (
                  <div className="grid h-full min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
                    <div className="h-full min-h-0 overflow-y-auto rounded-xs border border-taupe-200">
                      {selectedSourceEvents.map((event) => (
                        <MarbleListRow
                          active={selectedSourceEvent?.id === event.id}
                          description={
                            <div className="space-y-1">
                              <div>
                                {DATE_TIME_FORMATTER.format(
                                  new Date(event.createdAt),
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
                              tone={event.parseError ? "warning" : "neutral"}
                            >
                              {event.parseError ? "Parse error" : "Parsed"}
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
                          <MarbleField label="Raw payload">
                            <MarbleJsonPreview
                              className="min-h-[12rem]"
                              value={selectedSourceEvent.rawPayload}
                            />
                          </MarbleField>

                          <MarbleField label="Parsed payload">
                            <MarbleJsonPreview
                              className="min-h-[12rem]"
                              value={selectedSourceEvent.parsedPayload}
                            />
                          </MarbleField>

                          {selectedSourceEvent.parseError ? (
                            <MarbleAlert tone="warning">
                              {selectedSourceEvent.parseError}
                            </MarbleAlert>
                          ) : null}
                        </>
                      ) : (
                        <MarbleEmptyState
                          description="Select an event to inspect its payload."
                          title="Choose a captured event"
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
              <MarbleCardHeader divided>
                <MarbleCardTitle>Pipe settings</MarbleCardTitle>
                <MarbleCardDescription>
                  Pipes only write into input-eligible cells, then start those
                  cells. Row-level follow-on work can wake up later through
                  column conditions.
                </MarbleCardDescription>
              </MarbleCardHeader>

              {pipeError ? (
                <MarbleCardSection>
                  <MarbleAlert tone="error">{pipeError}</MarbleAlert>
                </MarbleCardSection>
              ) : null}

              <MarbleCardSection>
                <div className="grid gap-4 md:grid-cols-2">
                  <MarbleField label="Source">
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
                  </MarbleField>

                  <MarbleField label="Table">
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
                  </MarbleField>
                </div>
              </MarbleCardSection>

              <MarbleCardSection className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-1">
                    <MarbleCardTitle>Table input columns</MarbleCardTitle>
                    <MarbleCardDescription>
                      {configuredPipeColumnCount} of{" "}
                      {availablePipeColumns.length} columns mapped
                      {` · ${pipeSuggestionSummary}`}
                    </MarbleCardDescription>
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
                  <div className="overflow-hidden rounded-xs border border-taupe-200 bg-white">
                    {availablePipeColumns.map((column) => {
                      const mapping = pipeMappingByColumnId.get(column.id);
                      const isMapped = mapping !== undefined;
                      const hasJsonPath = mapping?.jsonPath.trim().length !== 0;
                      const suggestedCandidate =
                        pipePathCandidateByNormalizedKey.get(
                          normalizePipeFieldName(column.name),
                        );
                      const statusText = !isMapped
                        ? "Not mapped."
                        : hasJsonPath
                          ? "This path will write into the column when the event payload resolves."
                          : "Type or pick a JSONPath for this column.";

                      return (
                        <div
                          className="grid items-center gap-4 border-b border-taupe-200 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
                          key={column.id}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-medium text-sm text-zinc-950">
                                {column.name}
                              </span>
                              {hasJsonPath ? (
                                <MarbleBadge
                                  caps
                                  tone="success"
                                >
                                  Mapped
                                </MarbleBadge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                              <span className="font-mono text-[11px]">
                                {column.id}
                              </span>
                              {suggestedCandidate && !hasJsonPath ? (
                                <span>Suggested {suggestedCandidate.path}</span>
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
                            <p className="text-[11px] text-zinc-500">
                              {statusText}
                            </p>
                          </div>

                          <MarbleButton
                            onClick={() => togglePipeMapping(column.id)}
                            size="xs"
                            variant={isMapped ? "dark" : "light"}
                          >
                            {isMapped ? "Mapped" : "Map"}
                          </MarbleButton>
                        </div>
                      );
                    })}
                  </div>
                )}
              </MarbleCardSection>

              <MarbleCardFooter>
                {pipeCreateDisabled ? (
                  <MarbleAlert
                    className="mr-auto"
                    size="sm"
                    tone="warning"
                  >
                    Create at least one source and one table with an
                    input-eligible column before you add pipes.
                  </MarbleAlert>
                ) : null}
                <MarbleButton
                  disabled={pipePending || pipeCreateDisabled}
                  onClick={() => void handleSavePipe()}
                  variant="dark"
                >
                  {pipePending ? "Saving" : "Save pipe"}
                </MarbleButton>
              </MarbleCardFooter>
            </MarbleCard>
          </div>
        )}
      </div>

      <MarbleConfirmModal
        onClose={() => setConfirmState(null)}
        state={confirmState}
      />
    </MarblePane>
  );
}
