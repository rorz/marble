import { sortBy as sortRows } from "@marble/lib/array";
import { byDateDesc } from "@marble/lib/compare";
import { useMemo } from "react";
import { DATE_TIME_FORMATTER } from "../../sources/view/constants";
import { formatPipeCandidatePreview, normalizePipeFieldName } from "./mapping";
import {
  collectPipePathCandidates,
  collectPipePathCandidatesFromSchema,
  resolveGeneratedJsonPath,
} from "./paths";
import type { PipePathCandidate, Source } from "./types";

type SourceEvent = {
  createdAt: string;
  parseError: string | null;
  parsedPayload: unknown;
  sourceId: string;
};

const sortByCreatedAtDesc = <
  T extends {
    createdAt: string;
  },
>(
  records: readonly T[],
) => {
  return sortRows(
    records,
    byDateDesc((record: T) => record.createdAt),
  );
};

export const usePipePaths = ({
  pipeSourceIdDraft,
  selectedPipeSource,
  sourceEvents,
}: {
  pipeSourceIdDraft: string;
  selectedPipeSource: Source | null;
  sourceEvents: SourceEvent[];
}) => {
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

  return {
    pipePathCandidateByNormalizedKey,
    pipePathCandidates,
    pipePathSuggestionOptions,
    pipeSuggestionSummary,
  };
};
