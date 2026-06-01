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
  resourceNodeHeight: number;
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

const PIPE_MAPPING_NODE_GUTTER = 64;
const PIPE_MAPPING_PREVIEW_LIMIT = 2;
export const PIPE_MAPPING_NODE_WIDTH = 320;
export const PIPE_MAPPING_LANE_GAP =
  PIPE_MAPPING_NODE_WIDTH + PIPE_MAPPING_NODE_GUTTER * 2;

const PIPE_CARD_PADDING_Y = 24;
const PIPE_CARD_HEADER_HEIGHT = 16;
const PIPE_CARD_PREVIEW_GAP = 8;
const PIPE_CARD_ROW_HEIGHT = 18;
const PIPE_MAPPING_STACK_GAP = 16;

export const buildPipeColumnX = (sourceLaneWidth: number) =>
  sourceLaneWidth + PIPE_MAPPING_NODE_GUTTER;

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

const estimatePipeMappingHeight = (data: PipeMappingNodeData) => {
  const rowCount =
    data.mappingPreview.length + (data.remainingMappingCount > 0 ? 1 : 0);
  const previewHeight =
    rowCount > 0 ? PIPE_CARD_PREVIEW_GAP + rowCount * PIPE_CARD_ROW_HEIGHT : 0;

  return PIPE_CARD_PADDING_Y + PIPE_CARD_HEADER_HEIGHT + previewHeight;
};

const buildResourceCenterY = (
  index: number,
  laneHeaderHeight: number,
  nodeVerticalGap: number,
  resourceNodeHeight: number,
) => laneHeaderHeight + index * nodeVerticalGap + resourceNodeHeight / 2;

type PipeMappingEntry = {
  data: PipeMappingNodeData;
  height: number;
  pairKey: string;
  sourceIndex: number;
  tableIndex: number;
};

const buildPipeMappingEntry = (
  pipe: PipeMappingPipe,
  inputColumnLabelById: ReadonlyMap<string, string>,
  sourceIndexById: ReadonlyMap<string, number>,
  tableIndexById: ReadonlyMap<string, number>,
): PipeMappingEntry[] => {
  const sourceIndex = sourceIndexById.get(pipe.sourceId);
  const tableIndex = tableIndexById.get(pipe.tableId);

  if (sourceIndex === undefined || tableIndex === undefined) {
    return [];
  }

  const data = buildPipeMappingNodeData(pipe, inputColumnLabelById);

  return [
    {
      data,
      height: estimatePipeMappingHeight(data),
      pairKey: `${sourceIndex}:${tableIndex}`,
      sourceIndex,
      tableIndex,
    },
  ];
};

const buildPipeMappingNode = (
  data: PipeMappingNodeData,
  x: number,
  y: number,
): PipeMappingNode => ({
  ariaRole: "button",
  data,
  draggable: false,
  focusable: true,
  id: `pipe-mapping:${data.pipeId}`,
  position: {
    x,
    y,
  },
  selectable: true,
  style: {
    width: PIPE_MAPPING_NODE_WIDTH,
  },
  type: "pipeMapping",
  zIndex: 3,
});

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
  const columnX = buildPipeColumnX(layout.sourceLaneWidth);

  const groupedEntries = new Map<string, PipeMappingEntry[]>();
  for (const pipe of layout.pipes) {
    for (const entry of buildPipeMappingEntry(
      pipe,
      layout.inputColumnLabelById,
      sourceIndexById,
      tableIndexById,
    )) {
      const group = groupedEntries.get(entry.pairKey) ?? [];
      group.push(entry);
      groupedEntries.set(entry.pairKey, group);
    }
  }

  const nodes: PipeMappingNode[] = [];
  for (const group of groupedEntries.values()) {
    const first = group[0];

    if (!first) {
      continue;
    }

    const midpointY =
      (buildResourceCenterY(
        first.sourceIndex,
        layout.laneHeaderHeight,
        layout.nodeVerticalGap,
        layout.resourceNodeHeight,
      ) +
        buildResourceCenterY(
          first.tableIndex,
          layout.laneHeaderHeight,
          layout.nodeVerticalGap,
          layout.resourceNodeHeight,
        )) /
      2;
    const stackHeight =
      group.reduce((total, entry) => total + entry.height, 0) +
      (group.length - 1) * PIPE_MAPPING_STACK_GAP;

    let cursorY = midpointY - stackHeight / 2;
    for (const entry of group) {
      nodes.push(buildPipeMappingNode(entry.data, columnX, cursorY));
      cursorY += entry.height + PIPE_MAPPING_STACK_GAP;
    }
  }

  return nodes;
};
