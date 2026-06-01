import type { Node } from "@xyflow/react";

type AddResourceKind = "pipe" | "source" | "table";

type AddNodeData = {
  busy: boolean;
  disabled: boolean;
  kind: AddResourceKind;
  label: string;
};

export type AddNode = Node<AddNodeData, "add">;

type AddNodesParams = {
  addButtonTop: number;
  canCreatePipe: boolean;
  creatingPipe: boolean;
  creatingSource: boolean;
  creatingTable: boolean;
  pipeColumnWidth: number;
  pipeColumnX: number;
  resourceNodeWidth: number;
  sourceLaneId: string;
  sourceNodeX: number;
  tableLaneId: string;
  tableNodeX: number;
};

export const ADD_NODE_HEIGHT = 46;

const buildAddLabel = (busy: boolean, noun: string) =>
  busy ? "Creating" : `New ${noun}`;

const buildAddNode = (
  kind: AddResourceKind,
  data: Omit<AddNodeData, "kind">,
  width: number,
  position: {
    x: number;
    y: number;
  },
  parentId?: string,
): AddNode => ({
  ariaRole: "button",
  className: data.disabled ? "pointer-events-none" : undefined,
  data: {
    ...data,
    kind,
  },
  draggable: false,
  focusable: !data.disabled,
  id: `add:${kind}`,
  parentId,
  position,
  selectable: false,
  style: {
    height: ADD_NODE_HEIGHT,
    width,
  },
  type: "add",
  zIndex: parentId ? 2 : 3,
});

export const buildAddNodes = (params: AddNodesParams): AddNode[] => [
  buildAddNode(
    "source",
    {
      busy: params.creatingSource,
      disabled: params.creatingSource,
      label: buildAddLabel(params.creatingSource, "source"),
    },
    params.resourceNodeWidth,
    {
      x: params.sourceNodeX,
      y: params.addButtonTop,
    },
    params.sourceLaneId,
  ),
  buildAddNode(
    "pipe",
    {
      busy: params.creatingPipe,
      disabled: params.creatingPipe || !params.canCreatePipe,
      label: buildAddLabel(params.creatingPipe, "pipe"),
    },
    params.pipeColumnWidth,
    {
      x: params.pipeColumnX,
      y: params.addButtonTop,
    },
  ),
  buildAddNode(
    "table",
    {
      busy: params.creatingTable,
      disabled: params.creatingTable,
      label: buildAddLabel(params.creatingTable, "table"),
    },
    params.resourceNodeWidth,
    {
      x: params.tableNodeX,
      y: params.addButtonTop,
    },
    params.tableLaneId,
  ),
];
