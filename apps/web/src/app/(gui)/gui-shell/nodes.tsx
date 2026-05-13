import {
  CodeBlockIcon,
  FunnelIcon,
  PipeIcon,
  TableIcon,
} from "@phosphor-icons/react";

import type { SidebarMode } from "../../../lib/gui-sidebar";
import {
  collectActiveSidebarKeys,
  type SidebarTreeData,
  type SidebarTreeNode,
} from "../../../lib/sidebar-tree";
import { changeTargetKey } from "../change-spotlight";
import { isNodePathActive } from "./pathname";

export const collectCommandPaletteResources = (
  nodes: SidebarTreeNode[],
  parents: SidebarTreeNode[] = [],
): Array<{
  node: SidebarTreeNode;
  parents: SidebarTreeNode[];
}> => {
  return nodes.flatMap((node) => [
    {
      node,
      parents,
    },
    ...collectCommandPaletteResources(node.children, [
      ...parents,
      node,
    ]),
  ]);
};

const findProjectChildNode = (
  projectNode: SidebarTreeNode,
  kind: "source" | "table",
) => {
  return projectNode.children.find((child) => child.kind === kind) ?? null;
};

export const getPipeCreateDefaults = (projectNode: SidebarTreeNode) => {
  const sourceNode = findProjectChildNode(projectNode, "source");
  const tableNode = findProjectChildNode(projectNode, "table");

  return sourceNode && tableNode
    ? {
        sourceId: sourceNode.id,
        tableId: tableNode.id,
      }
    : null;
};

export const getNodeIcon = (node: SidebarTreeNode) => {
  if (node.kind === "project") {
    return null;
  }

  if (node.kind === "table") {
    return (
      <TableIcon
        className="h-4 w-4"
        weight="duotone"
      />
    );
  }

  if (node.kind === "source") {
    return (
      <FunnelIcon
        className="h-4 w-4"
        weight="duotone"
      />
    );
  }

  if (node.kind === "pipe") {
    return (
      <PipeIcon
        className="h-4 w-4"
        weight="duotone"
      />
    );
  }

  return (
    <CodeBlockIcon
      className="h-4 w-4"
      weight="duotone"
    />
  );
};

export const getNodeTargetKey = (node: SidebarTreeNode) => {
  if (node.kind === "project") {
    return changeTargetKey.project(node.id);
  }

  if (node.kind === "table") {
    return changeTargetKey.table(node.id);
  }

  if (node.kind === "source") {
    return changeTargetKey.source(node.id);
  }

  if (node.kind === "pipe") {
    return changeTargetKey.pipe(node.id);
  }

  return changeTargetKey.program(node.id);
};

export const buildDefaultSidebarOpenKeys = ({
  pathname,
  selectedProgramId,
  sidebarData,
  sidebarMode,
}: {
  pathname: string;
  selectedProgramId: null | string;
  sidebarData: SidebarTreeData;
  sidebarMode: SidebarMode;
}) => {
  const keys = new Set<string>(
    sidebarMode === "expanded"
      ? [
          "section:programs",
          "section:projects",
        ]
      : [],
  );
  const topLevelPath = `/${pathname.split("/").at(1)}`;
  const isNodeActive = (node: SidebarTreeNode) =>
    node.kind === "program"
      ? pathname === "/programs" && selectedProgramId === node.id
      : isNodePathActive(pathname, node.href);

  if (topLevelPath === "/projects") {
    keys.add("section:projects");
  }

  if (topLevelPath === "/programs") {
    keys.add("section:programs");
  }

  for (const key of collectActiveSidebarKeys(
    sidebarData.projects,
    isNodeActive,
  )) {
    keys.add(key);
  }

  for (const key of collectActiveSidebarKeys(
    sidebarData.programs,
    isNodeActive,
  )) {
    keys.add(key);
  }

  return keys;
};
