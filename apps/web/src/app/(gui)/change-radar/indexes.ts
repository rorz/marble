import type { MarbleProfileAttributionProfile } from "@marble/ui";
import { buildPipeTitle } from "../../../lib/pipe-display";
import type { SidebarTreeData } from "../../../lib/sidebar-tree";
import { getStringField, shortId } from "./event-snapshot";

export type ResolutionMaps = {
  columnTableIds: Record<string, null | string>;
  rowTableIds: Record<string, null | string>;
  versionProgramIds: Record<string, null | string>;
};
export type RadarIndexes = {
  pipes: Map<
    string,
    {
      label: string;
      projectId: string;
    }
  >;
  profiles: Map<string, MarbleProfileAttributionProfile>;
  programs: Map<string, string>;
  projects: Map<string, string>;
  sources: Map<
    string,
    {
      label: string;
      projectId: string;
    }
  >;
  tables: Map<
    string,
    {
      label: string;
      projectId: string;
    }
  >;
};

export const buildRadarIndexes = (sidebarData: SidebarTreeData) => {
  const indexes: RadarIndexes = {
    pipes: new Map(),
    profiles: new Map(),
    programs: new Map(),
    projects: new Map(),
    sources: new Map(),
    tables: new Map(),
  };

  for (const profile of sidebarData.profiles) {
    indexes.profiles.set(profile.id, {
      externalName: profile.externalName,
      icon: profile.icon,
      id: profile.id,
      name: profile.name || "Untitled Profile",
      type: profile.type,
    });
  }

  for (const node of sidebarData.programs) {
    indexes.programs.set(node.id, node.label);
  }

  for (const projectNode of sidebarData.projects) {
    indexes.projects.set(projectNode.id, projectNode.label);

    for (const childNode of projectNode.children) {
      if (childNode.kind === "table") {
        indexes.tables.set(childNode.id, {
          label: childNode.label,
          projectId: projectNode.id,
        });
      }

      if (childNode.kind === "source") {
        indexes.sources.set(childNode.id, {
          label: childNode.label,
          projectId: projectNode.id,
        });
      }

      if (childNode.kind === "pipe") {
        indexes.pipes.set(childNode.id, {
          label: childNode.label,
          projectId: projectNode.id,
        });
      }
    }
  }

  return indexes;
};

export const buildTableHref = (
  indexes: RadarIndexes,
  tableId: string,
  explicitProjectId?: string,
) => {
  const projectId = explicitProjectId ?? indexes.tables.get(tableId)?.projectId;

  return projectId
    ? `/projects/${projectId}/tables/${tableId}`
    : `/tables/${tableId}`;
};

export const buildTableLabel = (indexes: RadarIndexes, tableId: string) => {
  return indexes.tables.get(tableId)?.label ?? `Table ${shortId(tableId)}`;
};

export const buildPipeLabel = (
  indexes: RadarIndexes,
  pipeId: string,
  snapshot: Record<string, unknown> | null,
) => {
  const indexedPipe = indexes.pipes.get(pipeId);

  if (indexedPipe?.label) {
    return indexedPipe.label;
  }

  const sourceId = getStringField(snapshot, "source_id");
  const tableId = getStringField(snapshot, "table_id");

  return buildPipeTitle({
    sourceLabel: sourceId
      ? (indexes.sources.get(sourceId)?.label ?? `Source ${shortId(sourceId)}`)
      : undefined,
    tableLabel: tableId
      ? (indexes.tables.get(tableId)?.label ?? `Table ${shortId(tableId)}`)
      : undefined,
  });
};

export const buildProgramHref = (programId?: string) => {
  return programId ? `/programs/${programId}` : "/programs";
};
