import { removeById } from "@marble/lib/array";
import { normalizeDisplayLabel } from "@marble/lib/string";
import { buildPipeTitle } from "./pipe-display";

export type SidebarProjectRow = {
  id: string;
  name: string;
  ownerProfileId: string;
  updatedAt: string;
};

export type SidebarProgramRow = {
  firstParty: boolean;
  id: string;
  name: string;
  ownerProfileId: string;
  updatedAt: string;
};

export type SidebarTableRow = {
  id: string;
  name: string;
  projectId: string;
  updatedAt: string;
};

export type SidebarSourceRow = {
  id: string;
  name: string;
  projectId: string;
  updatedAt: string;
};

export type SidebarPipeRow = {
  id: string;
  sourceId: string;
  tableId: string;
  updatedAt: string;
};

type SidebarProfileRecord = {
  externalName: null | string;
  icon: null | string;
  id: string;
  name: string;
  type: "Agent" | "Human";
};

export type SidebarTreeNode = {
  children: SidebarTreeNode[];
  href: string;
  id: string;
  kind: "pipe" | "program" | "project" | "source" | "table";
  label: string;
  ownerProfileId?: string;
  // Structural references for nodes whose label is derived from sibling state
  // (e.g. a pipe's label is a function of its referenced source + table labels).
  // Present only when `kind` requires it. Used by `recomputeDerivedLabels` to
  // refresh labels in one generic pass after every mutation — keeps mutation
  // handlers free of cross-kind "if you change X also touch Y" exceptions.
  sourceId?: string;
  tableId?: string;
  updatedAt: string;
};

export type SidebarTreeData = {
  ownerProfileIds: string[];
  profiles: SidebarProfileRecord[];
  programs: SidebarTreeNode[];
  projects: SidebarTreeNode[];
  userId: string;
};

const PROJECT_RESOURCE_ORDER: Record<
  Extract<SidebarTreeNode["kind"], "pipe" | "source" | "table">,
  number
> = {
  pipe: 1,
  source: 0,
  table: 2,
};

const compareNodes = (left: SidebarTreeNode, right: SidebarTreeNode) => {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
    left.label.localeCompare(right.label)
  );
};

export const sortSidebarNodes = (nodes: SidebarTreeNode[]) => {
  return [
    ...nodes,
  ].sort(compareNodes);
};

const compareProjectChildren = (
  left: SidebarTreeNode,
  right: SidebarTreeNode,
) => {
  const resourceOrderDifference =
    (PROJECT_RESOURCE_ORDER[left.kind as keyof typeof PROJECT_RESOURCE_ORDER] ??
      Number.MAX_SAFE_INTEGER) -
    (PROJECT_RESOURCE_ORDER[
      right.kind as keyof typeof PROJECT_RESOURCE_ORDER
    ] ?? Number.MAX_SAFE_INTEGER);

  return resourceOrderDifference || compareNodes(left, right);
};

const sortProjectChildren = (nodes: SidebarTreeNode[]) => {
  return [
    ...nodes,
  ].sort(compareProjectChildren);
};

const createSidebarNode = (spec: {
  children?: SidebarTreeNode[];
  href: string;
  id: string;
  kind: SidebarTreeNode["kind"];
  label: string;
  ownerProfileId?: string;
  sourceId?: string;
  tableId?: string;
  updatedAt: string;
}): SidebarTreeNode => {
  const node: SidebarTreeNode = {
    children: spec.children ?? [],
    href: spec.href,
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    updatedAt: spec.updatedAt,
  };

  if (spec.ownerProfileId !== undefined) {
    node.ownerProfileId = spec.ownerProfileId;
  }

  if (spec.sourceId !== undefined) {
    node.sourceId = spec.sourceId;
  }

  if (spec.tableId !== undefined) {
    node.tableId = spec.tableId;
  }

  return node;
};

export const buildProjectNode = (
  project: SidebarProjectRow,
  children: SidebarTreeNode[] = [],
): SidebarTreeNode => {
  return createSidebarNode({
    children: sortProjectChildren(children),
    href: `/projects/${project.id}`,
    id: project.id,
    kind: "project",
    label: normalizeDisplayLabel(project.name, "Untitled Project"),
    ownerProfileId: project.ownerProfileId,
    updatedAt: project.updatedAt,
  });
};

export const buildProgramNode = (
  program: SidebarProgramRow,
): SidebarTreeNode => {
  return createSidebarNode({
    href: `/programs/${program.id}`,
    id: program.id,
    kind: "program",
    label: normalizeDisplayLabel(program.name, "Untitled Program"),
    updatedAt: program.updatedAt,
  });
};

export const buildTableNode = (table: SidebarTableRow): SidebarTreeNode => {
  return createSidebarNode({
    href: `/projects/${table.projectId}/tables/${table.id}`,
    id: table.id,
    kind: "table",
    label: normalizeDisplayLabel(table.name, "Untitled Table"),
    updatedAt: table.updatedAt,
  });
};

export const buildSourceNode = (source: SidebarSourceRow): SidebarTreeNode => {
  return createSidebarNode({
    href: `/projects/${source.projectId}/sources/${source.id}`,
    id: source.id,
    kind: "source",
    label: normalizeDisplayLabel(source.name, "Untitled Source"),
    updatedAt: source.updatedAt,
  });
};

export const buildPipeNode = (
  pipe: SidebarPipeRow,
  projectId: string,
  labels?: {
    sourceLabel?: null | string;
    tableLabel?: null | string;
  },
): SidebarTreeNode => {
  return createSidebarNode({
    href: `/projects/${projectId}/pipes/${pipe.id}`,
    id: pipe.id,
    kind: "pipe",
    label: buildPipeTitle({
      sourceLabel: labels?.sourceLabel,
      tableLabel: labels?.tableLabel,
    }),
    sourceId: pipe.sourceId,
    tableId: pipe.tableId,
    updatedAt: pipe.updatedAt,
  });
};

export const upsertSidebarNode = (
  nodes: SidebarTreeNode[],
  nextNode: SidebarTreeNode,
) => {
  return sortSidebarNodes([
    nextNode,
    ...nodes.filter((node) => node.id !== nextNode.id),
  ]);
};

export const removeSidebarNode = (nodes: SidebarTreeNode[], nodeId: string) => {
  return removeById(nodes, nodeId);
};

export const upsertSidebarChild = (
  nodes: SidebarTreeNode[],
  parentId: string,
  childNode: SidebarTreeNode,
) => {
  return nodes.map((node) =>
    node.id === parentId
      ? {
          ...node,
          children: sortProjectChildren([
            childNode,
            ...node.children.filter((child) => child.id !== childNode.id),
          ]),
        }
      : node,
  );
};

export const removeSidebarChildFromAll = (
  nodes: SidebarTreeNode[],
  childId: string,
) => {
  return nodes.map((node) =>
    node.children.some((child) => child.id === childId)
      ? {
          ...node,
          children: removeSidebarNode(node.children, childId),
        }
      : node,
  );
};

export const collectActiveSidebarKeys = (
  nodes: SidebarTreeNode[],
  isActive: (node: SidebarTreeNode) => boolean,
  keys = new Set<string>(),
) => {
  for (const node of nodes) {
    const childKeys = collectActiveSidebarKeys(node.children, isActive, keys);
    const hasActiveChild = node.children.some((child) =>
      childKeys.has(`node:${child.id}`),
    );

    if (hasActiveChild || isActive(node)) {
      keys.add(`node:${node.id}`);
    }
  }

  return keys;
};
