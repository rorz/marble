import { changeTargetKey } from "../change-spotlight";
import { CHANGE_RADAR_TARGET_LIMIT } from "./constants";
import type { EventRow } from "./event-snapshot";
import { getEventSnapshot, getStringField } from "./event-snapshot";
import type { ResolutionMaps } from "./indexes";

export type RadarScope = {
  href: string;
  key: string;
  label: string;
  targetKeys: string[];
};

export const resolveEventTargetKeys = (
  event: EventRow,
  resolutionMaps: ResolutionMaps,
) => {
  const snapshot = getEventSnapshot(event);

  if (event.resource === "project") {
    return [
      changeTargetKey.project(event.entityId),
    ];
  }

  if (event.resource === "table") {
    return [
      changeTargetKey.table(event.entityId),
    ];
  }

  if (event.resource === "source") {
    const projectId = getStringField(snapshot, "project_id");

    return [
      changeTargetKey.source(event.entityId),
      ...(projectId
        ? [
            changeTargetKey.project(projectId),
          ]
        : []),
    ];
  }

  if (event.resource === "row") {
    const tableId = getStringField(snapshot, "table_id");

    return [
      changeTargetKey.row(event.entityId),
      ...(tableId
        ? [
            changeTargetKey.table(tableId),
          ]
        : []),
    ];
  }

  if (event.resource === "column") {
    const tableId = getStringField(snapshot, "table_id");

    return [
      changeTargetKey.column(event.entityId),
      ...(tableId
        ? [
            changeTargetKey.table(tableId),
          ]
        : []),
    ];
  }

  if (event.resource === "cell") {
    const rowId = getStringField(snapshot, "row_id");
    const columnId = getStringField(snapshot, "column_id");
    const tableId =
      (rowId ? resolutionMaps.rowTableIds[rowId] : undefined) ??
      (columnId ? resolutionMaps.columnTableIds[columnId] : undefined);

    return [
      ...(rowId && columnId
        ? [
            changeTargetKey.cell(rowId, columnId),
          ]
        : []),
      ...(rowId
        ? [
            changeTargetKey.row(rowId),
          ]
        : []),
      ...(columnId
        ? [
            changeTargetKey.column(columnId),
          ]
        : []),
      ...(tableId
        ? [
            changeTargetKey.table(tableId),
          ]
        : []),
    ];
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

    return [
      ...(targetColumnId
        ? [
            changeTargetKey.column(targetColumnId),
          ]
        : []),
      ...(sourceColumnId
        ? [
            changeTargetKey.column(sourceColumnId),
          ]
        : []),
      ...(tableId
        ? [
            changeTargetKey.table(tableId),
          ]
        : []),
    ];
  }

  if (event.resource === "pipe") {
    const tableId = getStringField(snapshot, "table_id");

    return [
      changeTargetKey.pipe(event.entityId),
      ...(tableId
        ? [
            changeTargetKey.table(tableId),
          ]
        : []),
    ];
  }

  if (event.resource === "program") {
    return [
      changeTargetKey.program(event.entityId),
    ];
  }

  if (event.resource === "program_version") {
    const programId = getStringField(snapshot, "program_id");

    return [
      changeTargetKey.programVersion(event.entityId),
      ...(programId
        ? [
            changeTargetKey.program(programId),
          ]
        : []),
    ];
  }

  if (event.resource === "program_file") {
    const versionId = getStringField(snapshot, "version_id");
    const programId = versionId
      ? resolutionMaps.versionProgramIds[versionId]
      : undefined;
    const filename = getStringField(snapshot, "filename");

    return [
      ...(programId && filename
        ? [
            changeTargetKey.programFile(programId, filename),
          ]
        : []),
      ...(versionId
        ? [
            changeTargetKey.programVersion(versionId),
          ]
        : []),
      ...(programId
        ? [
            changeTargetKey.program(programId),
          ]
        : []),
    ];
  }

  if (event.resource === "program_run") {
    const versionId = getStringField(snapshot, "program_version_id");
    const programId = versionId
      ? resolutionMaps.versionProgramIds[versionId]
      : undefined;

    return [
      ...(versionId
        ? [
            changeTargetKey.programVersion(versionId),
          ]
        : []),
      ...(programId
        ? [
            changeTargetKey.program(programId),
          ]
        : []),
    ];
  }

  if (
    event.resource === "profile" ||
    event.resource === "key" ||
    event.resource === "secret"
  ) {
    return [
      changeTargetKey.profiles(),
    ];
  }

  return [];
};

export const appendLimitedTargetKeys = (
  targetKeys: string[],
  nextTargetKeys: string[],
) => {
  for (const targetKey of nextTargetKeys) {
    if (
      targetKeys.length >= CHANGE_RADAR_TARGET_LIMIT ||
      targetKeys.includes(targetKey)
    ) {
      continue;
    }

    targetKeys.push(targetKey);
  }
};

export const resolveEventDetailTargetKeys = (
  event: EventRow,
  resolutionMaps: ResolutionMaps,
) => {
  const snapshot = getEventSnapshot(event);

  if (
    event.resource === "project" ||
    event.resource === "source" ||
    event.resource === "pipe" ||
    event.resource === "table" ||
    event.resource === "row" ||
    event.resource === "column" ||
    event.resource === "program" ||
    event.resource === "program_version"
  ) {
    return resolveEventTargetKeys(event, resolutionMaps).slice(0, 1);
  }

  if (event.resource === "cell") {
    const rowId = getStringField(snapshot, "row_id");
    const columnId = getStringField(snapshot, "column_id");

    return rowId && columnId
      ? [
          changeTargetKey.cell(rowId, columnId),
        ]
      : [];
  }

  if (event.resource === "column_dependency") {
    const sourceColumnId = getStringField(snapshot, "source_column_id");
    const targetColumnId = getStringField(snapshot, "target_column_id");

    return [
      ...(targetColumnId
        ? [
            changeTargetKey.column(targetColumnId),
          ]
        : []),
      ...(sourceColumnId
        ? [
            changeTargetKey.column(sourceColumnId),
          ]
        : []),
    ];
  }

  if (event.resource === "program_file") {
    const programId = getStringField(snapshot, "program_id");
    const versionId = getStringField(snapshot, "version_id");
    const resolvedProgramId =
      programId ??
      (versionId ? resolutionMaps.versionProgramIds[versionId] : undefined);
    const filename = getStringField(snapshot, "filename");

    return resolvedProgramId && filename
      ? [
          changeTargetKey.programFile(resolvedProgramId, filename),
        ]
      : resolvedProgramId
        ? [
            changeTargetKey.program(resolvedProgramId),
          ]
        : [];
  }

  if (event.resource === "program_run") {
    const versionId = getStringField(snapshot, "program_version_id");
    const programId = versionId
      ? resolutionMaps.versionProgramIds[versionId]
      : undefined;

    return versionId
      ? [
          changeTargetKey.programVersion(versionId),
        ]
      : programId
        ? [
            changeTargetKey.program(programId),
          ]
        : [];
  }

  if (
    event.resource === "profile" ||
    event.resource === "key" ||
    event.resource === "secret"
  ) {
    return [
      changeTargetKey.profiles(),
    ];
  }

  return [];
};
