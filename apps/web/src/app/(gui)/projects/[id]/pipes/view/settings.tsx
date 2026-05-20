import {
  MarbleAlert,
  MarbleButton,
  MarbleCard,
  MarbleCardDescription,
  MarbleCardFooter,
  MarbleCardHeader,
  MarbleCardSection,
  MarbleCardTitle,
  MarbleEmptyState,
  MarbleField,
  MarbleSelect,
} from "@marble/ui";
import { buildSourceTitle } from "../../../../../../lib/source-display";
import { PipeMappingList } from "./mapping-list";
import type {
  InputColumn,
  PipeMappingDraft,
  PipeMappingInput,
  PipePathCandidate,
  PipePathSuggestionOption,
  Source,
  TableOption,
} from "./types";

type PipeSettingsCardProps = {
  availablePipeColumns: InputColumn[];
  configuredPipeColumnCount: number;
  onAutoMapPipeColumns: () => void;
  onClearPipeMappings: () => void;
  onPipeSourceIdDraftChange: (sourceId: string) => void;
  onPipeTableIdDraftChange: (tableId: string) => void;
  onSavePipe: () => void;
  onTogglePipeMapping: (columnId: string) => void;
  onUpdatePipeMapping: (
    columnId: string,
    patch: Partial<PipeMappingInput>,
  ) => void;
  pipeCreateDisabled: boolean;
  pipeError: string | null;
  pipeMappingByColumnId: ReadonlyMap<string, PipeMappingDraft>;
  pipeMappingsDraft: PipeMappingDraft[];
  pipePathCandidateByNormalizedKey: ReadonlyMap<string, PipePathCandidate>;
  pipePathCandidates: PipePathCandidate[];
  pipePathSuggestionOptions: PipePathSuggestionOption[];
  pipePending: boolean;
  pipeSourceIdDraft: string;
  pipeSuggestionSummary: string;
  pipeTableIdDraft: string;
  sources: Source[];
  tableOptions: TableOption[];
};

export const PipeSettingsCard = ({
  availablePipeColumns,
  configuredPipeColumnCount,
  onAutoMapPipeColumns,
  onClearPipeMappings,
  onPipeSourceIdDraftChange,
  onPipeTableIdDraftChange,
  onSavePipe,
  onTogglePipeMapping,
  onUpdatePipeMapping,
  pipeCreateDisabled,
  pipeError,
  pipeMappingByColumnId,
  pipeMappingsDraft,
  pipePathCandidateByNormalizedKey,
  pipePathCandidates,
  pipePathSuggestionOptions,
  pipePending,
  pipeSourceIdDraft,
  pipeSuggestionSummary,
  pipeTableIdDraft,
  sources,
  tableOptions,
}: PipeSettingsCardProps) => {
  return (
    <div className="flex min-h-0 flex-1">
      <MarbleCard
        className="w-full max-w-5xl"
        tone="subtle"
      >
        <MarbleCardHeader divided>
          <MarbleCardTitle>Pipe settings</MarbleCardTitle>
          <MarbleCardDescription>
            Pipes only write into input-eligible cells, then start those cells.
            Row-level follow-on work can wake up later through column
            conditions.
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
                  onPipeSourceIdDraftChange(event.target.value)
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
                    {buildSourceTitle(source)}
                  </option>
                ))}
              </MarbleSelect>
            </MarbleField>

            <MarbleField label="Table">
              <MarbleSelect
                onChange={(event) =>
                  onPipeTableIdDraftChange(event.target.value)
                }
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
                {configuredPipeColumnCount} of {availablePipeColumns.length}{" "}
                columns mapped
                {` · ${pipeSuggestionSummary}`}
              </MarbleCardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <MarbleButton
                disabled={
                  pipePathCandidates.length === 0 ||
                  availablePipeColumns.length === 0
                }
                onClick={onAutoMapPipeColumns}
                size="xs"
                variant="light"
              >
                Auto-map by name
              </MarbleButton>
              <MarbleButton
                disabled={pipeMappingsDraft.length === 0}
                onClick={onClearPipeMappings}
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
            <PipeMappingList
              availablePipeColumns={availablePipeColumns}
              onTogglePipeMapping={onTogglePipeMapping}
              onUpdatePipeMapping={onUpdatePipeMapping}
              pipeMappingByColumnId={pipeMappingByColumnId}
              pipePathCandidateByNormalizedKey={
                pipePathCandidateByNormalizedKey
              }
              pipePathSuggestionOptions={pipePathSuggestionOptions}
            />
          )}
        </MarbleCardSection>

        <MarbleCardFooter>
          {pipeCreateDisabled ? (
            <MarbleAlert
              className="mr-auto"
              size="sm"
              tone="warning"
            >
              Create at least one source and one table with an input-eligible
              column before you add pipes.
            </MarbleAlert>
          ) : null}
          <MarbleButton
            disabled={pipePending || pipeCreateDisabled}
            onClick={() => void onSavePipe()}
            variant="dark"
          >
            {pipePending ? "Saving" : "Save pipe"}
          </MarbleButton>
        </MarbleCardFooter>
      </MarbleCard>
    </div>
  );
};
