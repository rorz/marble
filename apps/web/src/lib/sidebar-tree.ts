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

function compareNodes(left: SidebarTreeNode, right: SidebarTreeNode) {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
    left.label.localeCompare(right.label)
  );
}

export function sortSidebarNodes(nodes: SidebarTreeNode[]) {
  return [
    ...nodes,
  ].sort(compareNodes);
}

function compareProjectChildren(left: SidebarTreeNode, right: SidebarTreeNode) {
  const resourceOrderDifference =
    (PROJECT_RESOURCE_ORDER[left.kind as keyof typeof PROJECT_RESOURCE_ORDER] ??
      Number.MAX_SAFE_INTEGER) -
    (PROJECT_RESOURCE_ORDER[
      right.kind as keyof typeof PROJECT_RESOURCE_ORDER
    ] ?? Number.MAX_SAFE_INTEGER);

  return resourceOrderDifference || compareNodes(left, right);
}

function sortProjectChildren(nodes: SidebarTreeNode[]) {
  return [
    ...nodes,
  ].sort(compareProjectChildren);
}

function createSidebarNode(spec: {
  children?: SidebarTreeNode[];
  href: string;
  id: string;
  kind: SidebarTreeNode["kind"];
  label: string;
  ownerProfileId?: string;
  updatedAt: string;
}): SidebarTreeNode {
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

  return node;
}

export function buildProjectNode(
  project: SidebarProjectRow,
  children: SidebarTreeNode[] = [],
): SidebarTreeNode {
  return createSidebarNode({
    children: sortProjectChildren(children),
    href: `/projects/${project.id}`,
    id: project.id,
    kind: "project",
    label: normalizeDisplayLabel(project.name, "Untitled Project"),
    ownerProfileId: project.ownerProfileId,
    updatedAt: project.updatedAt,
  });
}

export function buildProgramNode(program: SidebarProgramRow): SidebarTreeNode {
  return createSidebarNode({
    href: `/programs/${program.id}`,
    id: program.id,
    kind: "program",
    label: normalizeDisplayLabel(program.name, "Untitled Program"),
    updatedAt: program.updatedAt,
  });
}

export function buildTableNode(table: SidebarTableRow): SidebarTreeNode {
  return createSidebarNode({
    href: `/projects/${table.projectId}/tables/${table.id}`,
    id: table.id,
    kind: "table",
    label: normalizeDisplayLabel(table.name, "Untitled Table"),
    updatedAt: table.updatedAt,
  });
}

export function buildSourceNode(source: SidebarSourceRow): SidebarTreeNode {
  return createSidebarNode({
    href: `/projects/${source.projectId}/sources/${source.id}`,
    id: source.id,
    kind: "source",
    label: normalizeDisplayLabel(source.name, "Untitled Source"),
    updatedAt: source.updatedAt,
  });
}

export function buildPipeNode(
  pipe: SidebarPipeRow,
  projectId: string,
  labels?: {
    sourceLabel?: null | string;
    tableLabel?: null | string;
  },
): SidebarTreeNode {
  return createSidebarNode({
    href: `/projects/${projectId}/pipes/${pipe.id}`,
    id: pipe.id,
    kind: "pipe",
    label: buildPipeTitle({
      sourceLabel: labels?.sourceLabel,
      tableLabel: labels?.tableLabel,
    }),
    updatedAt: pipe.updatedAt,
  });
}

export function upsertSidebarNode(
  nodes: SidebarTreeNode[],
  nextNode: SidebarTreeNode,
) {
  return sortSidebarNodes([
    nextNode,
    ...nodes.filter((node) => node.id !== nextNode.id),
  ]);
}

export function removeSidebarNode(nodes: SidebarTreeNode[], nodeId: string) {
  return removeById(nodes, nodeId);
}

export function upsertSidebarChild(
  nodes: SidebarTreeNode[],
  parentId: string,
  childNode: SidebarTreeNode,
) {
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
}

export function removeSidebarChildFromAll(
  nodes: SidebarTreeNode[],
  childId: string,
) {
  return nodes.map((node) =>
    node.children.some((child) => child.id === childId)
      ? {
          ...node,
          children: removeSidebarNode(node.children, childId),
        }
      : node,
  );
}

export function collectActiveSidebarKeys(
  nodes: SidebarTreeNode[],
  isActive: (node: SidebarTreeNode) => boolean,
  keys = new Set<string>(),
) {
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
}
