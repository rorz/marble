"use client";

import { cx } from "@marble/ui";
import { FunnelIcon, TableIcon } from "@phosphor-icons/react/dist/ssr";
import {
  Handle,
  type NodeProps,
  type NodeTypes,
  Position,
} from "@xyflow/react";
import type { LaneNode, ResourceNode } from "./model";
import type { PipeMappingNode } from "./pipe-mapping";

const resourceHandleClass = "!size-2.5 !border-2 !border-white !bg-orange-500";

const ProjectFlowPipeMappingNode = ({
  data,
  selected,
}: NodeProps<PipeMappingNode>) => {
  return (
    <div
      aria-label={data.mappingCountLabel}
      className={cx(
        "rounded-sm border bg-white/92 px-4 py-3 text-xs text-zinc-700 shadow-md shadow-zinc-950/8 inset-shadow-2xs inset-shadow-white/70 transition-colors",
        selected
          ? "border-orange-300 inset-ring-1 inset-ring-orange-500/30"
          : "border-orange-200/70",
      )}
      role="note"
    >
      <div className="text-eyebrow-xs font-semibold text-orange-600">
        {data.mappingCountLabel}
      </div>

      {data.mappingPreview.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1">
          {data.mappingPreview.map((mapping) => (
            <div
              className="flex min-w-0 items-center gap-2"
              key={`${mapping.jsonPath}:${mapping.columnId}`}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-zinc-600">
                {mapping.jsonPathLabel}
              </span>
              <span className="shrink-0 text-zinc-400">{"->"}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-zinc-950">
                {mapping.columnLabel}
              </span>
            </div>
          ))}

          {data.remainingMappingCount > 0 ? (
            <div className="font-medium text-zinc-500">
              +{data.remainingMappingCount} more
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const ProjectFlowLaneNode = ({ data }: NodeProps<LaneNode>) => {
  return (
    <div className="pointer-events-none flex h-full w-full flex-col rounded-sm border border-dashed border-zinc-300/80 bg-white/20 p-5 inset-shadow-2xs inset-shadow-white/45">
      <div className="flex items-center justify-between gap-3">
        <span className="text-eyebrow font-semibold text-zinc-500">
          {data.label}
        </span>
        <span className="rounded-full border border-zinc-200 bg-white/85 px-2 py-1 font-medium text-xs text-zinc-600 shadow-sm">
          {data.count}
        </span>
      </div>
    </div>
  );
};

const ProjectFlowResourceNode = ({
  data,
  selected,
}: NodeProps<ResourceNode>) => {
  const ResourceIcon = data.kind === "source" ? FunnelIcon : TableIcon;
  const canConnect = !data.empty;

  return (
    <div
      className={cx(
        "group relative rounded-sm border bg-white/95 p-3 shadow-sm shadow-zinc-950/5 inset-shadow-2xs inset-shadow-white/70 transition-colors",
        data.empty
          ? "border-dashed border-zinc-200 text-zinc-400"
          : "border-zinc-200 text-zinc-950 hover:border-orange-300",
        selected
          ? "border-orange-400 inset-ring-1 inset-ring-orange-500/35"
          : "",
      )}
    >
      {data.kind === "table" && canConnect ? (
        <Handle
          className={resourceHandleClass}
          id="table-input"
          isConnectable={false}
          position={Position.Left}
          type="target"
        />
      ) : null}

      <div className="flex items-start gap-3">
        <div
          className={cx(
            "flex size-10 shrink-0 items-center justify-center rounded-sm border inset-shadow-2xs inset-shadow-white/70",
            data.kind === "source"
              ? "border-orange-200/60 bg-orange-50/70 text-orange-600"
              : "border-sky-200/70 bg-sky-50/75 text-sky-700",
          )}
        >
          <ResourceIcon
            size={21}
            weight="duotone"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium text-sm">{data.title}</p>
          <p className="truncate text-xs text-zinc-500">{data.subtitle}</p>
          {data.meta ? (
            <p className="text-eyebrow-xs font-semibold text-zinc-400">
              {data.meta}
            </p>
          ) : null}
        </div>
      </div>

      {data.kind === "source" && canConnect ? (
        <Handle
          className={resourceHandleClass}
          id="source-output"
          isConnectable={false}
          position={Position.Right}
          type="source"
        />
      ) : null}
    </div>
  );
};

export const projectFlowNodeTypes = {
  lane: ProjectFlowLaneNode,
  pipeMapping: ProjectFlowPipeMappingNode,
  resource: ProjectFlowResourceNode,
} satisfies NodeTypes;
