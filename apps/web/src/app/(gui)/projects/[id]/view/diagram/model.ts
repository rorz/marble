import { type Edge, MarkerType, type Node } from "@xyflow/react";
import { DATE_FORMATTER, type ProjectState } from "../types";

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

export type LaneNode = Node<LaneNodeData, "lane">;
export type ResourceNode = Node<ResourceNodeData, "resource">;
export type ProjectFlowNode = LaneNode | ResourceNode;
export type ProjectFlowEdge = Edge<
  {
    pipeId: string;
  },
  "smoothstep"
>;

const SOURCE_LANE_ID = "sources-lane";
const TABLE_LANE_ID = "tables-lane";
const SOURCE_LANE_WIDTH = 360;
const TABLE_LANE_WIDTH = 760;
const LANE_GAP = 42;
const LANE_HEADER_HEIGHT = 72;
const LANE_MIN_HEIGHT = 520;
const NODE_VERTICAL_GAP = 116;
const NODE_WIDTH = 288;
const SOURCE_NODE_X = 36;
const TABLE_NODE_X = 40;
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

const pluralize = (count: number, singular: string, plural: string) => {
  return count === 1 ? singular : plural;
};

const buildSourceNodeId = (sourceId: string) => `source:${sourceId}`;
const buildTableNodeId = (tableId: string) => `table:${tableId}`;
const buildResourceY = (index: number) =>
  LANE_HEADER_HEIGHT + index * NODE_VERTICAL_GAP;

const buildLaneHeight = (sources: Source[], project: ProjectState) => {
  const rowCount = Math.max(sources.length, project.tables.length, 1);
  return Math.max(
    LANE_MIN_HEIGHT,
    LANE_HEADER_HEIGHT + rowCount * NODE_VERTICAL_GAP + 48,
  );
};

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

export const buildProjectFlowNodes = (
  project: ProjectState,
  sources: Source[],
  sourceEventCountBySourceId: Map<string, number>,
): ProjectFlowNode[] => {
  const laneHeight = buildLaneHeight(sources, project);
  const tableLaneX = SOURCE_LANE_WIDTH + LANE_GAP;

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
    ...buildTableNodes(project),
  ];
};

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

export const isResourceNode = (node: ProjectFlowNode): node is ResourceNode => {
  return node.type === "resource";
};
