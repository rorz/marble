import {
  BriefcaseMetalIcon,
  CodeBlockIcon,
  FunnelIcon,
  PipeIcon,
  TableIcon,
} from "@phosphor-icons/react";
import type { SidebarTreeData } from "../../../../lib/sidebar-tree";
import type { CommandPaletteSection } from "../types";
import type { CommandPaletteActions } from "./actions";

type ResourceCommandPaletteSectionsParams = {
  actions: CommandPaletteActions;
  sidebarData: SidebarTreeData;
};

export const buildResourceCommandPaletteSections = ({
  actions,
  sidebarData,
}: ResourceCommandPaletteSectionsParams): CommandPaletteSection[] => {
  const projectCommandItems = actions.projectResources
    .filter(({ node }) => node.kind === "project")
    .map(({ node }) => ({
      detail: "Project",
      icon: (
        <BriefcaseMetalIcon
          size={16}
          weight="regular"
        />
      ),
      id: `command-palette-project:${node.id}`,
      keywords: [
        "project",
        "workspace",
        node.id,
      ],
      label: node.label,
      onSelect: () => actions.navigateFromCommandPalette(node.href),
    }));
  const tableCommandItems = actions.projectResources
    .filter(({ node }) => node.kind === "table")
    .map(({ node, parents }) => {
      const parentPath = parents.map((parent) => parent.label);
      const projectLabel = parentPath.at(-1) ?? "Project";

      return {
        detail: projectLabel,
        icon: (
          <TableIcon
            size={16}
            weight="duotone"
          />
        ),
        id: `command-palette-table:${node.id}`,
        keywords: [
          "table",
          node.id,
          ...parentPath,
        ],
        label: node.label,
        onSelect: () => actions.navigateFromCommandPalette(node.href),
      };
    });
  const sourceCommandItems = actions.projectResources
    .filter(({ node }) => node.kind === "source")
    .map(({ node, parents }) => {
      const parentPath = parents.map((parent) => parent.label);
      const projectLabel = parentPath.at(-1) ?? "Project";

      return {
        detail: projectLabel,
        icon: (
          <FunnelIcon
            size={16}
            weight="duotone"
          />
        ),
        id: `command-palette-source:${node.id}`,
        keywords: [
          "source",
          "webhook",
          "ingest",
          node.id,
          ...parentPath,
        ],
        label: node.label,
        onSelect: () => actions.navigateFromCommandPalette(node.href),
      };
    });
  const pipeCommandItems = actions.projectResources
    .filter(({ node }) => node.kind === "pipe")
    .map(({ node, parents }) => {
      const parentPath = parents.map((parent) => parent.label);
      const projectLabel = parentPath.at(-1) ?? "Project";

      return {
        detail: projectLabel,
        icon: (
          <PipeIcon
            size={16}
            weight="duotone"
          />
        ),
        id: `command-palette-pipe:${node.id}`,
        keywords: [
          "pipe",
          "mapping",
          "ingest",
          node.id,
          ...parentPath,
        ],
        label: node.label,
        onSelect: () => actions.navigateFromCommandPalette(node.href),
      };
    });
  const programCommandItems = sidebarData.programs.map((node) => ({
    detail: "Program",
    icon: (
      <CodeBlockIcon
        size={16}
        weight="duotone"
      />
    ),
    id: `command-palette-program:${node.id}`,
    keywords: [
      "program",
      "code",
      "runner",
      node.id,
    ],
    label: node.label,
    onSelect: () => actions.navigateFromCommandPalette(node.href),
  }));

  return [
    {
      heading: "Projects",
      id: "command-palette-project-resources",
      items: projectCommandItems,
    },
    {
      heading: "Tables",
      id: "command-palette-table-resources",
      items: tableCommandItems,
    },
    {
      heading: "Sources",
      id: "command-palette-source-resources",
      items: sourceCommandItems,
    },
    {
      heading: "Pipes",
      id: "command-palette-pipe-resources",
      items: pipeCommandItems,
    },
    {
      heading: "Programs",
      id: "command-palette-program-resources",
      items: programCommandItems,
    },
  ];
};
