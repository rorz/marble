"use client";

import {
  MarbleButton,
  MarbleCard,
  MarbleCardContent,
  MarbleContextPopover,
  MarbleEmptyState,
  MarbleListRow,
} from "@marble/ui";
import { TableIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../change-spotlight";
import {
  buildSectionHeading,
  DATE_FORMATTER,
  type ProjectState,
} from "./types";

type ProjectTablesSectionProps = {
  creating: boolean;
  onCreate: () => void;
  onRequestDelete: (tableId: string, tableName: string) => void;
  onSelect: (tableId: string) => void;
  project: ProjectState;
};

const EmptyIcon = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex size-14 items-center justify-center rounded-full border border-orange-200/40 bg-orange-50/35 text-orange-500/45 inset-shadow-2xs inset-shadow-white/70">
      {children}
    </div>
  );
};

export const ProjectTablesSection = ({
  creating,
  onCreate,
  onRequestDelete,
  onSelect,
  project,
}: ProjectTablesSectionProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl tracking-tight text-zinc-950">
            {buildSectionHeading("Tables", project.tableCount)}
          </h2>
        </div>
        <MarbleButton
          disabled={creating}
          onClick={onCreate}
          size="sm"
          variant="light"
        >
          {creating ? "Creating" : "New table"}
        </MarbleButton>
      </div>

      <MarbleCard>
        {project.tables.length === 0 ? (
          <MarbleCardContent>
            <MarbleEmptyState
              description="Create a table to build rows and columns."
              icon={
                <EmptyIcon>
                  <TableIcon
                    size={26}
                    weight="duotone"
                  />
                </EmptyIcon>
              }
              title="No tables yet"
            />
          </MarbleCardContent>
        ) : (
          <MarbleCardContent className="p-0">
            {project.tables.map((table) => {
              const tableName = table.name || "Untitled Table";

              return (
                <MarbleListRow
                  aside={
                    <MarbleContextPopover
                      ariaLabel={`Table actions for ${tableName}`}
                      items={[
                        {
                          label: "Delete table",
                          onSelect: () => onRequestDelete(table.id, tableName),
                          tone: "danger",
                        },
                      ]}
                    />
                  }
                  description={`Updated ${DATE_FORMATTER.format(new Date(table.updatedAt))}`}
                  key={table.id}
                  onClick={() => onSelect(table.id)}
                  title={tableName}
                  {...getChangeTargetProps(changeTargetKey.table(table.id))}
                />
              );
            })}
          </MarbleCardContent>
        )}
      </MarbleCard>
    </div>
  );
};
