import { type Edge, MarkerType } from "@xyflow/react";
import type { ProjectState } from "../types";
import {
  buildSourceNodeId,
  buildTableNodeId,
  type Pipe,
  type Source,
} from "./model";

export type ProjectFlowEdge = Edge<
  {
    pipeId: string;
  },
  "smoothstep"
>;

const PIPE_EDGE_STYLE = {
  stroke: "var(--color-orange-500)",
  strokeWidth: 2.5,
};
const PIPE_MARKER = {
  color: "var(--color-orange-500)",
  height: 18,
  type: MarkerType.ArrowClosed,
  width: 18,
};

export const pipeEdgeStyle = PIPE_EDGE_STYLE;

export const buildProjectFlowEdges = (
  pipes: Pipe[],
  project: ProjectState,
  sources: Source[],
): ProjectFlowEdge[] => {
  const sourceIds = new Set(sources.map((source) => source.id));
  const tableIds = new Set(project.tables.map((table) => table.id));

  return pipes.flatMap((pipe) => {
    if (!sourceIds.has(pipe.sourceId) || !tableIds.has(pipe.tableId)) {
      return [];
    }

    return [
      {
        data: {
          pipeId: pipe.id,
        },
        focusable: true,
        id: pipe.id,
        interactionWidth: 18,
        markerEnd: PIPE_MARKER,
        pathOptions: {
          borderRadius: 24,
        },
        source: buildSourceNodeId(pipe.sourceId),
        sourceHandle: "source-output",
        style: PIPE_EDGE_STYLE,
        target: buildTableNodeId(pipe.tableId),
        targetHandle: "table-input",
        type: "smoothstep",
      },
    ];
  });
};
