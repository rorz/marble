import type { Node } from "@xyflow/react";
import { DATE_FORMATTER, type ProjectState } from "../types";
import { ADD_NODE_HEIGHT, type AddNode, buildAddNodes } from "./add-node";
import {
  buildPipeColumnX,
  buildPipeMappingNodes,
  PIPE_MAPPING_LANE_GAP,
  PIPE_MAPPING_NODE_WIDTH,
  type PipeMappingNode,
} from "./pipe-mapping";

export type Source = {
  id: string;
  name: string;
};

export type Pipe = {
  id: string;
  mappings: unknown[];
  sourceId: string;
  tableId: string;
};

type ResourceKind = "source" | "table";

type LaneNodeData = {
  count: number;
  label: string;
};

type ResourceNodeData = {
  empty: boolean;
  entityId: string | null;
  kind: ResourceKind;
  meta: string;
  subtitle: string;
  title: string;
};

type AddButtonState = {
  creatingPipe: boolean;
  creatingSource: boolean;
  creatingTable: boolean;
};

export type LaneNode = Node<LaneNodeData, "lane">;
export type ResourceNode = Node<ResourceNodeData, "resource">;
export type ProjectFlowNode =
  | AddNode
  | LaneNode
  | PipeMappingNode
  | ResourceNode;

const SOURCE_LANE_ID = "sources-lane";
const TABLE_LANE_ID = "tables-lane";
const SOURCE_LANE_WIDTH = 360;
const TABLE_LANE_WIDTH = 360;
const LANE_HEADER_HEIGHT = 72;
const NODE_VERTICAL_GAP = 116;
const NODE_WIDTH = 288;
const NODE_HEIGHT = 84;
const SOURCE_NODE_X = 36;
const TABLE_NODE_X = 36;
const ADD_BUTTON_TOP_GAP = 24;
const LANE_BOTTOM_PADDING = 24;
const SOURCE_NODE_ID_PREFIX = "source:";
const TABLE_NODE_ID_PREFIX = "table:";

const pluralize = (count: number, singular: string, plural: string) => {
  return count === 1 ? singular : plural;
};

export const buildSourceNodeId = (sourceId: string) =>
  `${SOURCE_NODE_ID_PREFIX}${sourceId}`;
export const buildTableNodeId = (tableId: string) =>
  `${TABLE_NODE_ID_PREFIX}${tableId}`;

export const parseSourceNodeId = (nodeId: string): string | null =>
  nodeId.startsWith(SOURCE_NODE_ID_PREFIX)
    ? nodeId.slice(SOURCE_NODE_ID_PREFIX.length)
    : null;
export const parseTableNodeId = (nodeId: string): string | null =>
  nodeId.startsWith(TABLE_NODE_ID_PREFIX)
    ? nodeId.slice(TABLE_NODE_ID_PREFIX.length)
    : null;

const buildResourceY = (index: number) =>
  LANE_HEADER_HEIGHT + index * NODE_VERTICAL_GAP;

const buildLaneRowCount = (sources: Source[], project: ProjectState) =>
  Math.max(sources.length, project.tables.length, 1);

const buildAddButtonTop = (rowCount: number) =>
  LANE_HEADER_HEIGHT +
  (rowCount - 1) * NODE_VERTICAL_GAP +
  NODE_HEIGHT +
  ADD_BUTTON_TOP_GAP;

const buildLaneHeight = (rowCount: number) =>
  buildAddButtonTop(rowCount) + ADD_NODE_HEIGHT + LANE_BOTTOM_PADDING;

const buildLaneNode = (
  id: string,
  label: string,
  count: number,
  width: number,
  height: number,
  x: number,
): LaneNode => ({
  data: {
    count,
    label,
  },
  draggable: false,
  id,
  position: {
    x,
    y: 0,
  },
  selectable: false,
  style: {
    height,
    width,
  },
  type: "lane",
  zIndex: 0,
});

const buildResourceNode = (
  id: string,
  data: ResourceNodeData,
  parentId: string,
  position: {
    x: number;
    y: number;
  },
): ResourceNode => ({
  ariaRole: data.empty ? "group" : "button",
  className: data.empty ? "pointer-events-none" : undefined,
  data,
  draggable: false,
  focusable: !data.empty,
  id,
  parentId,
  position,
  selectable: !data.empty,
  style: {
    width: NODE_WIDTH,
  },
  type: "resource",
  zIndex: 2,
});

const buildEmptySourceNode = (): ResourceNode =>
  buildResourceNode(
    "source-placeholder",
    {
      empty: true,
      entityId: null,
      kind: "source",
      meta: "",
      subtitle: "Create one to capture webhook payloads.",
      title: "No sources yet",
    },
    SOURCE_LANE_ID,
    {
      x: SOURCE_NODE_X,
      y: buildResourceY(0),
    },
  );

const buildEmptyTableNode = (): ResourceNode =>
  buildResourceNode(
    "table-placeholder",
    {
      empty: true,
      entityId: null,
      kind: "table",
      meta: "",
      subtitle: "Create one to build rows and columns.",
      title: "No tables yet",
    },
    TABLE_LANE_ID,
    {
      x: TABLE_NODE_X,
      y: buildResourceY(0),
    },
  );

const buildSourceNodes = (
  sources: Source[],
  sourceEventCountBySourceId: Map<string, number>,
): ResourceNode[] => {
  if (sources.length === 0) {
    return [
      buildEmptySourceNode(),
    ];
  }

  return sources.map((source, index) => {
    const eventCount = sourceEventCountBySourceId.get(source.id) ?? 0;

    return buildResourceNode(
      buildSourceNodeId(source.id),
      {
        empty: false,
        entityId: source.id,
        kind: "source",
        meta: `${eventCount} ${pluralize(eventCount, "event", "events")} captured`,
        subtitle: "Webhook source",
        title: source.name || "Untitled Source",
      },
      SOURCE_LANE_ID,
      {
        x: SOURCE_NODE_X,
        y: buildResourceY(index),
      },
    );
  });
};

const buildTableNodes = (project: ProjectState): ResourceNode[] => {
  if (project.tables.length === 0) {
    return [
      buildEmptyTableNode(),
    ];
  }

  return project.tables.map((table, index) =>
    buildResourceNode(
      buildTableNodeId(table.id),
      {
        empty: false,
        entityId: table.id,
        kind: "table",
        meta: `Updated ${DATE_FORMATTER.format(new Date(table.updatedAt))}`,
        subtitle: "Table",
        title: table.name || "Untitled Table",
      },
      TABLE_LANE_ID,
      {
        x: TABLE_NODE_X,
        y: buildResourceY(index),
      },
    ),
  );
};

const hasUnconnectedSourceTablePair = (
  sources: Source[],
  project: ProjectState,
  pipes: Pipe[],
): boolean => {
  if (sources.length === 0 || project.tables.length === 0) {
    return false;
  }

  const sourceIds = new Set(sources.map((source) => source.id));
  const tableIds = new Set(project.tables.map((table) => table.id));
  const connectedPairs = new Set<string>();

  for (const pipe of pipes) {
    if (sourceIds.has(pipe.sourceId) && tableIds.has(pipe.tableId)) {
      connectedPairs.add(`${pipe.sourceId}:${pipe.tableId}`);
    }
  }

  return connectedPairs.size < sources.length * project.tables.length;
};

export const buildProjectFlowNodes = (
  project: ProjectState,
  sources: Source[],
  sourceEventCountBySourceId: Map<string, number>,
  pipes: Pipe[],
  inputColumnLabelById: ReadonlyMap<string, string>,
  addButtonState: AddButtonState,
): ProjectFlowNode[] => {
  const rowCount = buildLaneRowCount(sources, project);
  const laneHeight = buildLaneHeight(rowCount);
  const addButtonTop = buildAddButtonTop(rowCount);
  const tableLaneX = SOURCE_LANE_WIDTH + PIPE_MAPPING_LANE_GAP;

  return [
    buildLaneNode(
      SOURCE_LANE_ID,
      "Sources",
      sources.length,
      SOURCE_LANE_WIDTH,
      laneHeight,
      0,
    ),
    buildLaneNode(
      TABLE_LANE_ID,
      "Tables",
      project.tables.length,
      TABLE_LANE_WIDTH,
      laneHeight,
      tableLaneX,
    ),
    ...buildSourceNodes(sources, sourceEventCountBySourceId),
    ...buildPipeMappingNodes({
      inputColumnLabelById,
      laneHeaderHeight: LANE_HEADER_HEIGHT,
      nodeVerticalGap: NODE_VERTICAL_GAP,
      pipes,
      project,
      resourceNodeHeight: NODE_HEIGHT,
      sourceLaneWidth: SOURCE_LANE_WIDTH,
      sources,
    }),
    ...buildTableNodes(project),
    ...buildAddNodes({
      addButtonTop,
      canCreatePipe: hasUnconnectedSourceTablePair(sources, project, pipes),
      creatingPipe: addButtonState.creatingPipe,
      creatingSource: addButtonState.creatingSource,
      creatingTable: addButtonState.creatingTable,
      pipeColumnWidth: PIPE_MAPPING_NODE_WIDTH,
      pipeColumnX: buildPipeColumnX(SOURCE_LANE_WIDTH),
      resourceNodeWidth: NODE_WIDTH,
      sourceLaneId: SOURCE_LANE_ID,
      sourceNodeX: SOURCE_NODE_X,
      tableLaneId: TABLE_LANE_ID,
      tableNodeX: TABLE_NODE_X,
    }),
  ];
};

export const isAddNode = (node: ProjectFlowNode): node is AddNode =>
  node.type === "add";

export const isPipeMappingNode = (
  node: ProjectFlowNode,
): node is PipeMappingNode => {
  return node.type === "pipeMapping";
};

export const isResourceNode = (node: ProjectFlowNode): node is ResourceNode => {
  return node.type === "resource";
};
