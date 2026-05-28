import type { Node } from "@xyflow/react";
import { buildPipeMappingDisplayRecords } from "../../../../../../lib/pipe-display";

type PipeMappingPipe = {
  id: string;
  mappings: unknown[];
  sourceId: string;
  tableId: string;
};

type PipeMappingProject = {
  tables: Array<{
    id: string;
  }>;
};

type PipeMappingSource = {
  id: string;
};

type PipeMappingNodeLayout = {
  inputColumnLabelById: ReadonlyMap<string, string>;
  laneHeaderHeight: number;
  nodeVerticalGap: number;
  pipes: PipeMappingPipe[];
  project: PipeMappingProject;
  sourceLaneWidth: number;
  sources: PipeMappingSource[];
};

type PipeMappingPreview = {
  columnId: string;
  columnLabel: string;
  jsonPath: string;
  jsonPathLabel: string;
};

type PipeMappingNodeData = {
  mappingCountLabel: string;
  mappingPreview: PipeMappingPreview[];
  pipeId: string;
  remainingMappingCount: number;
};

export type PipeMappingNode = Node<PipeMappingNodeData, "pipeMapping">;

const PIPE_MAPPING_NODE_ESTIMATED_HEIGHT = 112;
const PIPE_MAPPING_NODE_GUTTER = 96;
const PIPE_MAPPING_PREVIEW_LIMIT = 2;
const PIPE_MAPPING_NODE_WIDTH = 320;
export const PIPE_MAPPING_LANE_GAP =
  PIPE_MAPPING_NODE_WIDTH + PIPE_MAPPING_NODE_GUTTER * 2;

const pluralize = (count: number, singular: string, plural: string) => {
  return count === 1 ? singular : plural;
};

const buildPipeMappingCountLabel = (mappingCount: number) => {
  if (mappingCount === 0) {
    return "No mapped fields yet";
  }

  return `${mappingCount} mapped ${pluralize(mappingCount, "field", "fields")}`;
};

const buildPipeMappingNodeData = (
  pipe: PipeMappingPipe,
  inputColumnLabelById: ReadonlyMap<string, string>,
): PipeMappingNodeData => {
  const mappings = buildPipeMappingDisplayRecords(
    pipe.mappings,
    inputColumnLabelById,
  );
  const mappingPreview = mappings.slice(0, PIPE_MAPPING_PREVIEW_LIMIT);

  return {
    mappingCountLabel: buildPipeMappingCountLabel(mappings.length),
    mappingPreview,
    pipeId: pipe.id,
    remainingMappingCount: mappings.length - mappingPreview.length,
  };
};

const buildResourceY = (
  index: number,
  laneHeaderHeight: number,
  nodeVerticalGap: number,
) => laneHeaderHeight + index * nodeVerticalGap;

const buildResourceCenterY = (
  index: number,
  laneHeaderHeight: number,
  nodeVerticalGap: number,
) =>
  buildResourceY(index, laneHeaderHeight, nodeVerticalGap) +
  PIPE_MAPPING_NODE_ESTIMATED_HEIGHT / 2;

const buildPipeMappingNode = (
  pipe: PipeMappingPipe,
  layout: Omit<PipeMappingNodeLayout, "pipes" | "project" | "sources">,
  sourceIndexById: ReadonlyMap<string, number>,
  tableIndexById: ReadonlyMap<string, number>,
): PipeMappingNode[] => {
  const sourceIndex = sourceIndexById.get(pipe.sourceId);
  const tableIndex = tableIndexById.get(pipe.tableId);

  if (sourceIndex === undefined || tableIndex === undefined) {
    return [];
  }

  return [
    {
      ariaRole: "button",
      data: buildPipeMappingNodeData(pipe, layout.inputColumnLabelById),
      draggable: false,
      focusable: true,
      id: `pipe-mapping:${pipe.id}`,
      position: {
        x: layout.sourceLaneWidth + PIPE_MAPPING_NODE_GUTTER,
        y:
          (buildResourceCenterY(
            sourceIndex,
            layout.laneHeaderHeight,
            layout.nodeVerticalGap,
          ) +
            buildResourceCenterY(
              tableIndex,
              layout.laneHeaderHeight,
              layout.nodeVerticalGap,
            )) /
            2 -
          PIPE_MAPPING_NODE_ESTIMATED_HEIGHT / 2,
      },
      selectable: true,
      style: {
        width: PIPE_MAPPING_NODE_WIDTH,
      },
      type: "pipeMapping",
      zIndex: 3,
    },
  ];
};

export const buildPipeMappingNodes = (
  layout: PipeMappingNodeLayout,
): PipeMappingNode[] => {
  const sourceIndexById = new Map(
    layout.sources.map((source, index) => [
      source.id,
      index,
    ]),
  );
  const tableIndexById = new Map(
    layout.project.tables.map((table, index) => [
      table.id,
      index,
    ]),
  );

  return layout.pipes.flatMap((pipe) =>
    buildPipeMappingNode(pipe, layout, sourceIndexById, tableIndexById),
  );
};
