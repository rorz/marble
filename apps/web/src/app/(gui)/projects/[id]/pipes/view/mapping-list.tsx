import { MarbleBadge, MarbleButton, MarbleSearchSelect } from "@marble/ui";
import { normalizePipeFieldName } from "./mapping";
import type {
  InputColumn,
  PipeMappingDraft,
  PipeMappingInput,
  PipePathCandidate,
  PipePathSuggestionOption,
} from "./types";

type PipeMappingListProps = {
  availablePipeColumns: InputColumn[];
  onTogglePipeMapping: (columnId: string) => void;
  onUpdatePipeMapping: (
    columnId: string,
    patch: Partial<PipeMappingInput>,
  ) => void;
  pipeMappingByColumnId: ReadonlyMap<string, PipeMappingDraft>;
  pipePathCandidateByNormalizedKey: ReadonlyMap<string, PipePathCandidate>;
  pipePathSuggestionOptions: PipePathSuggestionOption[];
};

export const PipeMappingList = ({
  availablePipeColumns,
  onTogglePipeMapping,
  onUpdatePipeMapping,
  pipeMappingByColumnId,
  pipePathCandidateByNormalizedKey,
  pipePathSuggestionOptions,
}: PipeMappingListProps) => {
  return (
    <div className="overflow-hidden rounded-xs border border-taupe-200 bg-white">
      {availablePipeColumns.map((column) => {
        const mapping = pipeMappingByColumnId.get(column.id);
        const isMapped = mapping !== undefined;
        const hasJsonPath = mapping?.jsonPath.trim().length !== 0;
        const suggestedCandidate = pipePathCandidateByNormalizedKey.get(
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
                <span className="font-mono text-[11px]">{column.id}</span>
                {suggestedCandidate && !hasJsonPath ? (
                  <span>Suggested {suggestedCandidate.path}</span>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <MarbleSearchSelect
                disabled={!isMapped}
                onChange={(event) =>
                  onUpdatePipeMapping(column.id, {
                    jsonPath: event.target.value,
                  })
                }
                options={pipePathSuggestionOptions}
                placeholder={suggestedCandidate?.path ?? "$.record.email"}
                value={mapping?.jsonPath ?? ""}
                wrapperClassName="w-full"
              />
              <p className="text-[11px] text-zinc-500">{statusText}</p>
            </div>

            <MarbleButton
              onClick={() => onTogglePipeMapping(column.id)}
              size="xs"
              variant={isMapped ? "dark" : "light"}
            >
              {isMapped ? "Mapped" : "Map"}
            </MarbleButton>
          </div>
        );
      })}
    </div>
  );
};
