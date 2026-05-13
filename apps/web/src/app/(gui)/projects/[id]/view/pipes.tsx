"use client";

import {
  MarbleBadge,
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleContextPopover,
  MarbleEmptyState,
  MarbleListRow,
} from "@marble/ui";
import { PipeIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import {
  buildPipeMappingDisplayRecords,
  buildPipeMappingSummary,
  buildPipeTitle,
} from "../../../../../lib/pipe-display";
import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../change-spotlight";
import { buildSectionHeading } from "./types";

type Pipe = {
  id: string;
  mappings: Parameters<typeof buildPipeMappingDisplayRecords>[0];
  sourceId: string;
  tableId: string;
};

type ProjectPipesSectionProps = {
  creating: boolean;
  inputColumnLabelById: Map<string, string>;
  onCreate: () => void;
  onRequestDelete: (pipeId: string, pipeTitle: string) => void;
  onSelect: (pipeId: string) => void;
  pipes: Pipe[];
  sourceNameById: Map<string, string>;
  tableLabelById: Map<string, string>;
};

const EmptyIcon = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex size-14 items-center justify-center rounded-full border border-orange-200/40 bg-orange-50/35 text-orange-500/45 inset-shadow-2xs inset-shadow-white/70">
      {children}
    </div>
  );
};

export const ProjectPipesSection = ({
  creating,
  inputColumnLabelById,
  onCreate,
  onRequestDelete,
  onSelect,
  pipes,
  sourceNameById,
  tableLabelById,
}: ProjectPipesSectionProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl tracking-tight text-zinc-950">
            {buildSectionHeading("Pipes", pipes.length)}
          </h2>
        </div>
        <MarbleButton
          disabled={creating}
          onClick={onCreate}
          size="sm"
          variant="light"
        >
          {creating ? "Creating" : "New pipe"}
        </MarbleButton>
      </div>

      <MarbleCard>
        {pipes.length === 0 ? (
          <MarbleCardContent>
            <MarbleEmptyState
              description="Create a pipe to map captured payloads into table inputs."
              icon={
                <EmptyIcon>
                  <PipeIcon
                    size={26}
                    weight="duotone"
                  />
                </EmptyIcon>
              }
              title="No pipes yet"
            />
          </MarbleCardContent>
        ) : (
          <MarbleCardContent className="p-0">
            {pipes.map((pipe) => {
              const pipeMappings = buildPipeMappingDisplayRecords(
                pipe.mappings,
                inputColumnLabelById,
              );
              const visiblePipeMappings = pipeMappings.slice(0, 4);
              const hiddenPipeMappingCount =
                pipeMappings.length - visiblePipeMappings.length;
              const pipeTitle = buildPipeTitle({
                sourceLabel: sourceNameById.get(pipe.sourceId),
                tableLabel: tableLabelById.get(pipe.tableId),
              });

              return (
                <MarbleListRow
                  align="start"
                  aside={
                    <MarbleContextPopover
                      ariaLabel={`Pipe actions for ${pipeTitle}`}
                      items={[
                        {
                          label: "Delete pipe",
                          onSelect: () => onRequestDelete(pipe.id, pipeTitle),
                          tone: "danger",
                        },
                      ]}
                    />
                  }
                  description={
                    pipeMappings.length > 0 ? (
                      <>
                        {visiblePipeMappings.map((mapping) => (
                          <MarbleBadge
                            className="gap-1 rounded-full border-zinc-200 bg-zinc-50 px-2 py-1 font-medium text-zinc-700"
                            key={`${mapping.jsonPath}:${mapping.columnId}`}
                          >
                            <span className="font-mono text-[10px] text-zinc-600">
                              {mapping.jsonPathLabel}
                            </span>
                            <span className="text-zinc-400">{"->"}</span>
                            <span className="text-zinc-950">
                              {mapping.columnLabel}
                            </span>
                          </MarbleBadge>
                        ))}

                        {hiddenPipeMappingCount > 0 ? (
                          <MarbleBadge className="rounded-full border-zinc-200 bg-zinc-50 px-2 py-1 font-medium text-zinc-600">
                            +{hiddenPipeMappingCount} more
                          </MarbleBadge>
                        ) : null}
                      </>
                    ) : (
                      buildPipeMappingSummary(
                        pipe.mappings,
                        inputColumnLabelById,
                      )
                    )
                  }
                  descriptionClassName={
                    pipeMappings.length > 0
                      ? "mt-2 flex flex-wrap items-center gap-1.5 text-xs"
                      : "mt-1 text-xs text-zinc-500"
                  }
                  key={pipe.id}
                  onClick={() => onSelect(pipe.id)}
                  title={pipeTitle}
                  {...getChangeTargetProps(changeTargetKey.pipe(pipe.id))}
                />
              );
            })}
          </MarbleCardContent>
        )}
      </MarbleCard>
    </div>
  );
};
