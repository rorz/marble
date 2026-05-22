import { BriefcaseMetalIcon } from "@phosphor-icons/react";
import type { CommandPaletteSection } from "../types";
import type { CommandPaletteActions } from "./actions";

export const buildCreateProjectSections = (actions: CommandPaletteActions) => {
  const createTableProjectSections: CommandPaletteSection[] = [
    {
      heading: "Choose project",
      id: "command-palette-create-table-project",
      items: actions.projectNodes.map(({ node }) => ({
        detail: "Project",
        icon: (
          <BriefcaseMetalIcon
            size={16}
            weight="regular"
          />
        ),
        id: `command-palette-new-table-project:${node.id}`,
        keywords: [
          "create",
          "new",
          "project",
          "table",
          node.id,
        ],
        label: node.label,
        onSelect: () => {
          void actions.handleCreateTableForProjectFromCommandPalette(node);
        },
      })),
    },
  ];
  const createSourceProjectSections: CommandPaletteSection[] = [
    {
      heading: "Choose project",
      id: "command-palette-create-source-project",
      items: actions.projectNodes.map(({ node }) => ({
        detail: "Project",
        icon: (
          <BriefcaseMetalIcon
            size={16}
            weight="regular"
          />
        ),
        id: `command-palette-new-source-project:${node.id}`,
        keywords: [
          "create",
          "new",
          "project",
          "source",
          "webhook",
          node.id,
        ],
        label: node.label,
        onSelect: () => {
          void actions.handleCreateSourceForProjectFromCommandPalette(node);
        },
      })),
    },
  ];
  const createPipeProjectSections: CommandPaletteSection[] = [
    {
      heading: "Choose project",
      id: "command-palette-create-pipe-project",
      items: actions.pipeProjectNodes.map(({ node }) => ({
        detail: "Project",
        icon: (
          <BriefcaseMetalIcon
            size={16}
            weight="regular"
          />
        ),
        id: `command-palette-new-pipe-project:${node.id}`,
        keywords: [
          "create",
          "new",
          "project",
          "pipe",
          "mapping",
          node.id,
        ],
        label: node.label,
        onSelect: () => {
          void actions.handleCreatePipeForProjectFromCommandPalette(node);
        },
      })),
    },
  ];

  return {
    "create-pipe-project": createPipeProjectSections,
    "create-source-project": createSourceProjectSections,
    "create-table-project": createTableProjectSections,
  };
};
