import type { Database } from "@marble/supabase";
import { buildPipeTitle } from "./pipe-display";

export type SidebarProjectRow = Pick<
  Database["public"]["Tables"]["project"]["Row"],
  "id" | "name" | "owner_profile_id" | "updated_at"
>;

export type SidebarProgramRow = Pick<
  Database["public"]["Tables"]["program"]["Row"],
  "first_party" | "id" | "name" | "owner_profile_id" | "updated_at"
>;

export type SidebarTableRow = Pick<
  Database["public"]["Tables"]["table"]["Row"],
  "id" | "name" | "project_id" | "updated_at"
>;

export type SidebarSourceRow = Pick<
  Database["public"]["Tables"]["source"]["Row"],
  "id" | "name" | "project_id" | "updated_at"
>;

export type SidebarPipeRow = Pick<
  Database["public"]["Tables"]["pipe"]["Row"],
  "id" | "source_id" | "table_id" | "updated_at"
>;

export type SidebarProfileRecord = Pick<
  Database["public"]["Tables"]["profile"]["Row"],
  "external_name" | "icon" | "id" | "name" | "type"
>;

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

export function buildProjectNode(
  project: SidebarProjectRow,
  children: SidebarTreeNode[] = [],
): SidebarTreeNode {
  return {
    children: sortProjectChildren(children),
    href: `/projects/${project.id}`,
    id: project.id,
    kind: "project",
    label: project.name || "Untitled Project",
    ownerProfileId: project.owner_profile_id,
    updatedAt: project.updated_at,
  };
}

export function buildProgramNode(program: SidebarProgramRow): SidebarTreeNode {
  return {
    children: [],
    href: `/programs/${program.id}`,
    id: program.id,
    kind: "program",
    label: program.name || "Untitled Program",
    updatedAt: program.updated_at,
  };
}

export function buildTableNode(table: SidebarTableRow): SidebarTreeNode {
  return {
    children: [],
    href: `/projects/${table.project_id}/tables/${table.id}`,
    id: table.id,
    kind: "table",
    label: table.name || "Untitled Table",
    updatedAt: table.updated_at,
  };
}

export function buildSourceNode(source: SidebarSourceRow): SidebarTreeNode {
  return {
    children: [],
    href: `/projects/${source.project_id}/sources/${source.id}`,
    id: source.id,
    kind: "source",
    label: source.name || "Untitled Source",
    updatedAt: source.updated_at,
  };
}

export function buildPipeNode(
  pipe: SidebarPipeRow,
  projectId: string,
  labels?: {
    sourceLabel?: null | string;
    tableLabel?: null | string;
  },
): SidebarTreeNode {
  return {
    children: [],
    href: `/projects/${projectId}/pipes/${pipe.id}`,
    id: pipe.id,
    kind: "pipe",
    label: buildPipeTitle({
      sourceLabel: labels?.sourceLabel,
      tableLabel: labels?.tableLabel,
    }),
    updatedAt: pipe.updated_at,
  };
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
  return nodes.filter((node) => node.id !== nodeId);
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

function removeSidebarChild(
  nodes: SidebarTreeNode[],
  parentId: string,
  childId: string,
) {
  return nodes.map((node) =>
    node.id === parentId
      ? {
          ...node,
          children: removeSidebarNode(node.children, childId),
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
