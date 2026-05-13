import type { EventRow } from "./event-snapshot";
import {
  getEventSnapshot,
  getStringField,
  shortId,
  titleCase,
} from "./event-snapshot";
import type { RadarIndexes, ResolutionMaps } from "./indexes";
import {
  buildPipeLabel,
  buildProgramHref,
  buildTableHref,
  buildTableLabel,
} from "./indexes";
import type { RadarScope } from "./target-keys";
import { resolveEventTargetKeys } from "./target-keys";

export const resolveRadarScope = (
  event: EventRow,
  indexes: RadarIndexes,
  resolutionMaps: ResolutionMaps,
): RadarScope => {
  const snapshot = getEventSnapshot(event);

  if (event.resource === "project") {
    const label =
      indexes.projects.get(event.entityId) ??
      getStringField(snapshot, "name") ??
      "Project";

    return {
      href: `/projects/${event.entityId}`,
      key: `project:${event.entityId}`,
      label,
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (event.resource === "table") {
    const projectId = getStringField(snapshot, "project_id");

    return {
      href: buildTableHref(indexes, event.entityId, projectId),
      key: `table:${event.entityId}`,
      label:
        indexes.tables.get(event.entityId)?.label ??
        getStringField(snapshot, "name") ??
        `Table ${shortId(event.entityId)}`,
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (event.resource === "source") {
    const indexedSource = indexes.sources.get(event.entityId);
    const projectId =
      indexedSource?.projectId ?? getStringField(snapshot, "project_id");
    const label =
      indexedSource?.label ?? getStringField(snapshot, "name") ?? "Source";

    if (projectId) {
      return {
        href: `/projects/${projectId}/sources/${event.entityId}`,
        key: `source:${event.entityId}`,
        label,
        targetKeys: resolveEventTargetKeys(event, resolutionMaps),
      };
    }
  }

  if (event.resource === "row" || event.resource === "column") {
    const tableId = getStringField(snapshot, "table_id");

    if (tableId) {
      return {
        href: buildTableHref(indexes, tableId),
        key: `table:${tableId}`,
        label: buildTableLabel(indexes, tableId),
        targetKeys: resolveEventTargetKeys(event, resolutionMaps),
      };
    }
  }

  if (event.resource === "pipe") {
    const indexedPipe = indexes.pipes.get(event.entityId);
    const tableId = getStringField(snapshot, "table_id");
    const projectId =
      indexedPipe?.projectId ??
      (tableId ? indexes.tables.get(tableId)?.projectId : undefined);

    if (projectId) {
      return {
        href: `/projects/${projectId}/pipes/${event.entityId}`,
        key: `pipe:${event.entityId}`,
        label: buildPipeLabel(indexes, event.entityId, snapshot),
        targetKeys: resolveEventTargetKeys(event, resolutionMaps),
      };
    }
  }

  if (event.resource === "cell") {
    const rowId = getStringField(snapshot, "row_id");
    const columnId = getStringField(snapshot, "column_id");
    const tableId =
      (rowId ? resolutionMaps.rowTableIds[rowId] : undefined) ??
      (columnId ? resolutionMaps.columnTableIds[columnId] : undefined);

    if (tableId) {
      return {
        href: buildTableHref(indexes, tableId),
        key: `table:${tableId}`,
        label: buildTableLabel(indexes, tableId),
        targetKeys: resolveEventTargetKeys(event, resolutionMaps),
      };
    }
  }

  if (event.resource === "column_dependency") {
    const sourceColumnId = getStringField(snapshot, "source_column_id");
    const targetColumnId = getStringField(snapshot, "target_column_id");
    const tableId =
      (targetColumnId
        ? resolutionMaps.columnTableIds[targetColumnId]
        : undefined) ??
      (sourceColumnId
        ? resolutionMaps.columnTableIds[sourceColumnId]
        : undefined);

    if (tableId) {
      return {
        href: buildTableHref(indexes, tableId),
        key: `table:${tableId}`,
        label: buildTableLabel(indexes, tableId),
        targetKeys: resolveEventTargetKeys(event, resolutionMaps),
      };
    }
  }

  if (event.resource === "program") {
    const label =
      indexes.programs.get(event.entityId) ??
      getStringField(snapshot, "name") ??
      "Program";

    return {
      href: buildProgramHref(event.entityId),
      key: `program:${event.entityId}`,
      label,
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (event.resource === "program_version") {
    const programId = getStringField(snapshot, "program_id");

    return {
      href: buildProgramHref(programId),
      key: `program:${programId ?? event.entityId}`,
      label:
        (programId ? indexes.programs.get(programId) : undefined) ?? "Program",
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (event.resource === "program_file" || event.resource === "program_run") {
    const versionId =
      getStringField(snapshot, "version_id") ??
      getStringField(snapshot, "program_version_id");
    const programId = versionId
      ? resolutionMaps.versionProgramIds[versionId]
      : undefined;

    return {
      href: buildProgramHref(programId ?? undefined),
      key: `program:${programId ?? versionId ?? event.entityId}`,
      label:
        (programId ? indexes.programs.get(programId) : undefined) ?? "Program",
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  if (
    event.resource === "profile" ||
    event.resource === "key" ||
    event.resource === "secret"
  ) {
    return {
      href: "/profiles",
      key: "profiles",
      label: "Profiles",
      targetKeys: resolveEventTargetKeys(event, resolutionMaps),
    };
  }

  return {
    href: "/events",
    key: `events:${event.resource}:${event.entityId}`,
    label: titleCase(event.resource),
    targetKeys: resolveEventTargetKeys(event, resolutionMaps),
  };
};
