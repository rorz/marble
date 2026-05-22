import { getErrorMessage } from "@marble/lib/result";
import { marbleToast, useMarbleRouter } from "@marble/ui";
import { useMemo } from "react";
import {
  useMarbleSdkFactory,
  useMarbleWebSessionSdk,
} from "../../../../lib/marble-sdk-client";
import { createDefaultProgram } from "../../../../lib/program-client";
import type {
  SidebarTreeData,
  SidebarTreeNode,
} from "../../../../lib/sidebar-tree";
import {
  collectCommandPaletteResources,
  getPipeCreateDefaults,
} from "../nodes";
import { getProjectIdFromPathname } from "../pathname";
import type { CommandPalettePage } from "../types";

type CommandPaletteResource = ReturnType<
  typeof collectCommandPaletteResources
>[number];

export type CommandPaletteActions = {
  createPipeDetail: string;
  createSourceDetail: string;
  createTableDetail: string;
  defaultPipeProjectNode: SidebarTreeNode | null;
  defaultSourceProjectNode: SidebarTreeNode | null;
  defaultTableProjectNode: SidebarTreeNode | null;
  handleCreatePipeForProjectFromCommandPalette: (
    projectNode: SidebarTreeNode,
  ) => Promise<void>;
  handleCreatePipeFromCommandPalette: () => Promise<void>;
  handleCreateProgramFromCommandPalette: () => Promise<void>;
  handleCreateProjectFromCommandPalette: () => Promise<void>;
  handleCreateSourceForProjectFromCommandPalette: (
    projectNode: SidebarTreeNode,
  ) => Promise<void>;
  handleCreateSourceFromCommandPalette: () => Promise<void>;
  handleCreateTableForProjectFromCommandPalette: (
    projectNode: SidebarTreeNode,
  ) => Promise<void>;
  handleCreateTableFromCommandPalette: () => Promise<void>;
  hasProjectTargetsForNewPipe: boolean;
  hasProjectTargetsForNewSource: boolean;
  hasProjectTargetsForNewTable: boolean;
  navigateFromCommandPalette: (path: string) => void;
  pipeProjectNodes: CommandPaletteResource[];
  projectNodes: CommandPaletteResource[];
  projectResources: CommandPaletteResource[];
};

type UseCommandPaletteActionsParams = {
  closeCommandPalette: () => void;
  pathname: string;
  pushCommandPalettePage: (page: CommandPalettePage) => void;
  sidebarData: SidebarTreeData;
};

export const useCommandPaletteActions = ({
  closeCommandPalette,
  pathname,
  pushCommandPalettePage,
  sidebarData,
}: UseCommandPaletteActionsParams): CommandPaletteActions => {
  const router = useMarbleRouter();
  const getSdk = useMarbleSdkFactory();
  const sdk = useMemo(
    () => getSdk(),
    [
      getSdk,
    ],
  );
  const apiSdk = useMarbleWebSessionSdk();
  const navigateFromCommandPalette = (path: string) => {
    closeCommandPalette();
    router.push(path);
  };
  const handleCommandPaletteError = (error: unknown) => {
    marbleToast.error(getErrorMessage(error));
  };
  const projectResources = collectCommandPaletteResources(sidebarData.projects);
  const projectNodes = projectResources.filter(
    ({ node }) => node.kind === "project",
  );
  const selectedProjectId = getProjectIdFromPathname(pathname);
  const selectedProjectNode =
    selectedProjectId === null
      ? null
      : (projectNodes.find(({ node }) => node.id === selectedProjectId)?.node ??
        null);
  const defaultTableProjectNode =
    selectedProjectNode ??
    (projectNodes.length === 1 ? (projectNodes[0]?.node ?? null) : null);
  const defaultSourceProjectNode = defaultTableProjectNode;
  const pipeProjectNodes = projectNodes.filter(
    ({ node }) => getPipeCreateDefaults(node) !== null,
  );
  const defaultPipeProjectNode =
    selectedProjectNode && getPipeCreateDefaults(selectedProjectNode)
      ? selectedProjectNode
      : pipeProjectNodes.length === 1
        ? (pipeProjectNodes[0]?.node ?? null)
        : null;
  const hasProjectTargetsForNewTable = projectNodes.length > 0;
  const hasProjectTargetsForNewSource = projectNodes.length > 0;
  const hasProjectTargetsForNewPipe = pipeProjectNodes.length > 0;
  const createTableDetail = defaultTableProjectNode?.label ?? "Choose project";
  const createSourceDetail =
    defaultSourceProjectNode?.label ?? "Choose project";
  const createPipeDetail = defaultPipeProjectNode?.label ?? "Choose project";
  const handleCreateProjectFromCommandPalette = async () => {
    closeCommandPalette();

    try {
      const project = await sdk.projects.create({});
      router.push(`/projects/${project.id}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
  const handleCreateTableForProjectFromCommandPalette = async (
    projectNode: SidebarTreeNode,
  ) => {
    closeCommandPalette();

    try {
      const table = await getSdk({
        profileId: projectNode.ownerProfileId,
      }).tables.create({
        projectId: projectNode.id,
      });
      router.push(`/projects/${projectNode.id}/tables/${table.id}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
  const handleCreateTableFromCommandPalette = async () => {
    if (!hasProjectTargetsForNewTable) {
      return;
    }

    if (!defaultTableProjectNode) {
      pushCommandPalettePage("create-table-project");
      return;
    }

    await handleCreateTableForProjectFromCommandPalette(
      defaultTableProjectNode,
    );
  };
  const handleCreateSourceForProjectFromCommandPalette = async (
    projectNode: SidebarTreeNode,
  ) => {
    closeCommandPalette();

    try {
      const source = await getSdk({
        profileId: projectNode.ownerProfileId,
      }).sources.create({
        projectId: projectNode.id,
      });
      router.push(`/projects/${projectNode.id}/sources/${source.id}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
  const handleCreateSourceFromCommandPalette = async () => {
    if (!hasProjectTargetsForNewSource) {
      return;
    }

    if (!defaultSourceProjectNode) {
      pushCommandPalettePage("create-source-project");
      return;
    }

    await handleCreateSourceForProjectFromCommandPalette(
      defaultSourceProjectNode,
    );
  };
  const handleCreatePipeForProjectFromCommandPalette = async (
    projectNode: SidebarTreeNode,
  ) => {
    const defaults = getPipeCreateDefaults(projectNode);

    if (!defaults) {
      return;
    }

    closeCommandPalette();

    try {
      const pipe = await getSdk({
        profileId: projectNode.ownerProfileId,
      }).pipes.create({
        mappings: [],
        sourceId: defaults.sourceId,
        tableId: defaults.tableId,
      });
      router.push(`/projects/${projectNode.id}/pipes/${pipe.id}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };
  const handleCreatePipeFromCommandPalette = async () => {
    if (!hasProjectTargetsForNewPipe) {
      return;
    }

    if (!defaultPipeProjectNode) {
      pushCommandPalettePage("create-pipe-project");
      return;
    }

    await handleCreatePipeForProjectFromCommandPalette(defaultPipeProjectNode);
  };
  const handleCreateProgramFromCommandPalette = async () => {
    closeCommandPalette();

    try {
      const { programId } = await createDefaultProgram(apiSdk);
      router.push(`/programs/${programId}`);
    } catch (error) {
      handleCommandPaletteError(error);
    }
  };

  return {
    createPipeDetail,
    createSourceDetail,
    createTableDetail,
    defaultPipeProjectNode,
    defaultSourceProjectNode,
    defaultTableProjectNode,
    handleCreatePipeForProjectFromCommandPalette,
    handleCreatePipeFromCommandPalette,
    handleCreateProgramFromCommandPalette,
    handleCreateProjectFromCommandPalette,
    handleCreateSourceForProjectFromCommandPalette,
    handleCreateSourceFromCommandPalette,
    handleCreateTableForProjectFromCommandPalette,
    handleCreateTableFromCommandPalette,
    hasProjectTargetsForNewPipe,
    hasProjectTargetsForNewSource,
    hasProjectTargetsForNewTable,
    navigateFromCommandPalette,
    pipeProjectNodes,
    projectNodes,
    projectResources,
  };
};
