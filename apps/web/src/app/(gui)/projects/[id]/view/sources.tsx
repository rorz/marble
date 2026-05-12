"use client";

import {
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleContextPopover,
  MarbleEmptyState,
  MarbleListRow,
} from "@marble/ui";
import { FunnelIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../change-spotlight";
import { buildSectionHeading } from "./types";

type Source = {
  id: string;
  name: string;
};

type ProjectSourcesSectionProps = {
  creating: boolean;
  onCreate: () => void;
  onRequestDelete: (sourceId: string, sourceName: string) => void;
  onSelect: (sourceId: string) => void;
  sourceEventCountBySourceId: Map<string, number>;
  sources: Source[];
};

function EmptyIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-14 items-center justify-center rounded-full border border-orange-200/40 bg-orange-50/35 text-orange-500/45 inset-shadow-2xs inset-shadow-white/70">
      {children}
    </div>
  );
}

export function ProjectSourcesSection({
  creating,
  onCreate,
  onRequestDelete,
  onSelect,
  sourceEventCountBySourceId,
  sources,
}: ProjectSourcesSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl tracking-tight text-zinc-950">
            {buildSectionHeading("Sources", sources.length)}
          </h2>
        </div>
        <MarbleButton
          disabled={creating}
          onClick={onCreate}
          size="sm"
          variant="light"
        >
          {creating ? "Creating" : "New source"}
        </MarbleButton>
      </div>

      <MarbleCard>
        {sources.length === 0 ? (
          <MarbleCardContent>
            <MarbleEmptyState
              description="Create a source to capture incoming webhook payloads."
              icon={
                <EmptyIcon>
                  <FunnelIcon
                    size={26}
                    weight="duotone"
                  />
                </EmptyIcon>
              }
              title="No sources yet"
            />
          </MarbleCardContent>
        ) : (
          <MarbleCardContent className="p-0">
            {sources.map((source) => {
              const sourceName = source.name || "Untitled Source";

              return (
                <MarbleListRow
                  aside={
                    <MarbleContextPopover
                      ariaLabel={`Source actions for ${sourceName}`}
                      items={[
                        {
                          label: "Delete source",
                          onSelect: () =>
                            onRequestDelete(source.id, sourceName),
                          tone: "danger",
                        },
                      ]}
                    />
                  }
                  description={`${sourceEventCountBySourceId.get(source.id) ?? 0} events captured`}
                  key={source.id}
                  onClick={() => onSelect(source.id)}
                  title={sourceName}
                  {...getChangeTargetProps(changeTargetKey.source(source.id))}
                />
              );
            })}
          </MarbleCardContent>
        )}
      </MarbleCard>
    </div>
  );
}
