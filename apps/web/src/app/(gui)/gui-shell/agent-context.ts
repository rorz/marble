import type {
  SidebarTreeData,
  SidebarTreeNode,
} from "../../../lib/sidebar-tree";
import type { AgentChatPageContext } from "../agent-chat/types";

type AgentPageContextInput = {
  pathname: string;
  search: string;
  selectedProgramId: null | string;
  sidebarData: SidebarTreeData;
};

type SidebarNodeMatch = {
  node: SidebarTreeNode;
  parent?: SidebarTreeNode;
};

const collectSidebarNodeMatches = (
  nodes: SidebarTreeNode[],
  parent?: SidebarTreeNode,
): SidebarNodeMatch[] =>
  nodes.flatMap((node) => [
    {
      node,
      parent,
    },
    ...collectSidebarNodeMatches(node.children, node),
  ]);

const findProgramMatch = (
  sidebarData: SidebarTreeData,
  selectedProgramId: null | string,
  pathname: string,
): SidebarNodeMatch | null => {
  const pathProgramId =
    pathname.split("/").at(1) === "programs"
      ? (pathname.split("/").at(2) ?? null)
      : null;
  const programId = selectedProgramId ?? pathProgramId;
  if (!programId) return null;

  const programNode = sidebarData.programs.find(
    (node) => node.id === programId,
  );
  return programNode
    ? {
        node: programNode,
      }
    : null;
};

const findProjectMatch = (
  sidebarData: SidebarTreeData,
  pathname: string,
): SidebarNodeMatch | null => {
  const matches = collectSidebarNodeMatches(sidebarData.projects)
    .filter(
      ({ node }) =>
        pathname === node.href || pathname.startsWith(`${node.href}/`),
    )
    .sort((left, right) => right.node.href.length - left.node.href.length);

  return matches.at(0) ?? null;
};

const toContextResource = (match: SidebarNodeMatch) => ({
  href: match.node.href,
  id: match.node.id,
  kind: match.node.kind,
  label: match.node.label,
  parent:
    match.parent?.kind !== "project"
      ? undefined
      : {
          href: match.parent.href,
          id: match.parent.id,
          kind: match.parent.kind,
          label: match.parent.label,
        },
});

export const buildAgentPageContext = ({
  pathname,
  search,
  selectedProgramId,
  sidebarData,
}: AgentPageContextInput): AgentChatPageContext => {
  const programMatch = findProgramMatch(
    sidebarData,
    selectedProgramId,
    pathname,
  );
  const projectMatch = findProjectMatch(sidebarData, pathname);
  const currentMatch = programMatch ?? projectMatch;

  return {
    currentResource: currentMatch ? toContextResource(currentMatch) : undefined,
    pathname,
    search,
  };
};
