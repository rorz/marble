import type { SupabaseClient } from "@marble/supabase";
import { ApiError } from "../core";
import {
  type DbRow,
  getRecord,
  listRecordsFromQuery,
  listRecordsInColumn,
} from "../data";

type AccessOptions = {
  authenticatedProfileId?: string;
  userId?: string;
};

function profileNotFound() {
  return new ApiError(404, "Profile not found");
}

function projectNotFound() {
  return new ApiError(404, "Project not found");
}

function tableNotFound() {
  return new ApiError(404, "Table not found");
}

function sourceNotFound() {
  return new ApiError(404, "Source not found");
}

function sourceEventNotFound() {
  return new ApiError(404, "Source event not found");
}

function pipeNotFound() {
  return new ApiError(404, "Pipe not found");
}

function rowNotFound() {
  return new ApiError(404, "Row not found");
}

function columnNotFound() {
  return new ApiError(404, "Column not found");
}

function cellNotFound() {
  return new ApiError(404, "Cell not found");
}

function programRunNotFound() {
  return new ApiError(404, "Program run not found");
}

export async function listAccessibleOwnerProfileIds(
  supabase: SupabaseClient,
  options: AccessOptions,
) {
  if (options.userId) {
    const profiles = await listRecordsFromQuery(
      supabase,
      "profile",
      {
        ownerUserId: options.userId,
      },
      {
        ownerUserId: "owner_user_id",
      },
      [
        {
          column: "created_at",
        },
      ],
    );

    return profiles.map((profile) => profile.id);
  }

  if (options.authenticatedProfileId) {
    return [
      options.authenticatedProfileId,
    ];
  }

  return undefined;
}

export async function listAccessibleProjectIds(
  supabase: SupabaseClient,
  options: AccessOptions,
) {
  const ownerProfileIds = await listAccessibleOwnerProfileIds(
    supabase,
    options,
  );

  if (ownerProfileIds === undefined) {
    return undefined;
  }

  if (ownerProfileIds.length === 0) {
    return [];
  }

  const projects = await listRecordsInColumn(
    supabase,
    "project",
    "owner_profile_id",
    ownerProfileIds,
    [
      {
        column: "created_at",
      },
    ],
  );

  return projects.map((project) => project.id);
}

export async function listAccessibleTableIds(
  supabase: SupabaseClient,
  options: AccessOptions,
) {
  const projectIds = await listAccessibleProjectIds(supabase, options);

  if (projectIds === undefined) {
    return undefined;
  }

  if (projectIds.length === 0) {
    return [];
  }

  const tables = await listRecordsInColumn(
    supabase,
    "table",
    "project_id",
    projectIds,
    [
      {
        column: "created_at",
      },
    ],
  );

  return tables.map((table) => table.id);
}

export async function listAccessibleSourceIds(
  supabase: SupabaseClient,
  options: AccessOptions,
) {
  const projectIds = await listAccessibleProjectIds(supabase, options);

  if (projectIds === undefined) {
    return undefined;
  }

  if (projectIds.length === 0) {
    return [];
  }

  const sources = await listRecordsInColumn(
    supabase,
    "source",
    "project_id",
    projectIds,
    [
      {
        column: "created_at",
      },
    ],
  );

  return sources.map((source) => source.id);
}

export async function listAccessibleRowIds(
  supabase: SupabaseClient,
  options: AccessOptions,
) {
  const tableIds = await listAccessibleTableIds(supabase, options);

  if (tableIds === undefined) {
    return undefined;
  }

  if (tableIds.length === 0) {
    return [];
  }

  const rows = await listRecordsInColumn(
    supabase,
    "row",
    "table_id",
    tableIds,
    [
      {
        column: "table_id",
      },
      {
        column: "idx",
      },
    ],
  );

  return rows.map((row) => row.id);
}

export async function listAccessibleColumnIds(
  supabase: SupabaseClient,
  options: AccessOptions,
) {
  const tableIds = await listAccessibleTableIds(supabase, options);

  if (tableIds === undefined) {
    return undefined;
  }

  if (tableIds.length === 0) {
    return [];
  }

  const columns = await listRecordsInColumn(
    supabase,
    "column",
    "table_id",
    tableIds,
    [
      {
        column: "table_id",
      },
      {
        column: "idx",
      },
    ],
  );

  return columns.map((column) => column.id);
}

export async function listAccessibleCellIds(
  supabase: SupabaseClient,
  options: AccessOptions,
) {
  const rowIds = await listAccessibleRowIds(supabase, options);

  if (rowIds === undefined) {
    return undefined;
  }

  if (rowIds.length === 0) {
    return [];
  }

  const cells = await listRecordsInColumn(supabase, "cell", "row_id", rowIds, [
    {
      column: "row_id",
    },
    {
      column: "column_id",
    },
  ]);

  return cells.map((cell) => cell.id);
}

async function requireOwnedProfileForUser(
  supabase: SupabaseClient,
  ownerProfileId: string,
  userId: string,
) {
  const profile = await getRecord(supabase, "profile", ownerProfileId);

  if (profile.owner_user_id !== userId) {
    throw profileNotFound();
  }

  return profile;
}

export async function resolveProjectOwnerProfileId(
  supabase: SupabaseClient,
  options: AccessOptions & {
    ownerProfileId?: string;
  },
) {
  if (options.userId) {
    if (options.ownerProfileId) {
      await requireOwnedProfileForUser(
        supabase,
        options.ownerProfileId,
        options.userId,
      );
      return options.ownerProfileId;
    }

    if (options.authenticatedProfileId) {
      await requireOwnedProfileForUser(
        supabase,
        options.authenticatedProfileId,
        options.userId,
      );
      return options.authenticatedProfileId;
    }

    const ownerProfileIds = await listAccessibleOwnerProfileIds(supabase, {
      userId: options.userId,
    });

    if (!ownerProfileIds || ownerProfileIds.length === 0) {
      throw new ApiError(
        400,
        "No profiles exist. Create a profile before creating a project.",
      );
    }

    return ownerProfileIds[0];
  }

  if (options.authenticatedProfileId) {
    if (
      options.ownerProfileId &&
      options.ownerProfileId !== options.authenticatedProfileId
    ) {
      throw new ApiError(
        403,
        "owner_profile_id is fixed by the authenticated API key and cannot be overridden.",
      );
    }

    await getRecord(supabase, "profile", options.authenticatedProfileId);
    return options.authenticatedProfileId;
  }

  if (options.ownerProfileId) {
    await getRecord(supabase, "profile", options.ownerProfileId);
    return options.ownerProfileId;
  }

  const profiles = await listRecordsFromQuery(supabase, "profile", {}, {}, [
    {
      column: "created_at",
    },
  ]);

  if (profiles.length === 0) {
    throw new ApiError(
      400,
      "No profiles exist. Provide owner_profile_id explicitly.",
    );
  }

  if (profiles.length > 1) {
    throw new ApiError(
      400,
      "Multiple profiles exist. Provide owner_profile_id explicitly.",
    );
  }

  return profiles[0].id;
}

export async function requireAccessibleProject(
  supabase: SupabaseClient,
  options: AccessOptions & {
    projectId: string;
  },
) {
  const project = await getRecord(supabase, "project", options.projectId);

  if (options.userId) {
    await requireOwnedProfileForUser(
      supabase,
      project.owner_profile_id,
      options.userId,
    );
    return project;
  }

  if (
    options.authenticatedProfileId &&
    project.owner_profile_id !== options.authenticatedProfileId
  ) {
    throw projectNotFound();
  }

  return project;
}

export async function requireAccessibleTable(
  supabase: SupabaseClient,
  options: AccessOptions & {
    tableId: string;
  },
): Promise<DbRow<"table">> {
  const table = await getRecord(supabase, "table", options.tableId);

  try {
    await requireAccessibleProject(supabase, {
      authenticatedProfileId: options.authenticatedProfileId,
      projectId: table.project_id,
      userId: options.userId,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw tableNotFound();
    }

    throw error;
  }

  return table;
}

export async function requireAccessibleSource(
  supabase: SupabaseClient,
  options: AccessOptions & {
    sourceId: string;
  },
): Promise<DbRow<"source">> {
  const source = await getRecord(supabase, "source", options.sourceId);

  try {
    await requireAccessibleProject(supabase, {
      authenticatedProfileId: options.authenticatedProfileId,
      projectId: source.project_id,
      userId: options.userId,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw sourceNotFound();
    }

    throw error;
  }

  return source;
}

export async function requireAccessibleSourceEvent(
  supabase: SupabaseClient,
  options: AccessOptions & {
    sourceEventId: string;
  },
): Promise<DbRow<"source_event">> {
  const sourceEvent = await getRecord(
    supabase,
    "source_event",
    options.sourceEventId,
  );

  try {
    await requireAccessibleProject(supabase, {
      authenticatedProfileId: options.authenticatedProfileId,
      projectId: sourceEvent.project_id,
      userId: options.userId,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw sourceEventNotFound();
    }

    throw error;
  }

  return sourceEvent;
}

export async function requireAccessiblePipe(
  supabase: SupabaseClient,
  options: AccessOptions & {
    pipeId: string;
  },
): Promise<DbRow<"pipe">> {
  const pipe = await getRecord(supabase, "pipe", options.pipeId);

  try {
    await requireAccessibleSource(supabase, {
      authenticatedProfileId: options.authenticatedProfileId,
      sourceId: pipe.source_id,
      userId: options.userId,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw pipeNotFound();
    }

    throw error;
  }

  return pipe;
}

export async function requireAccessibleRow(
  supabase: SupabaseClient,
  options: AccessOptions & {
    rowId: string;
  },
): Promise<DbRow<"row">> {
  const row = await getRecord(supabase, "row", options.rowId);

  try {
    await requireAccessibleTable(supabase, {
      authenticatedProfileId: options.authenticatedProfileId,
      tableId: row.table_id,
      userId: options.userId,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw rowNotFound();
    }

    throw error;
  }

  return row;
}

export async function requireAccessibleColumn(
  supabase: SupabaseClient,
  options: AccessOptions & {
    columnId: string;
  },
): Promise<DbRow<"column">> {
  const column = await getRecord(supabase, "column", options.columnId);

  try {
    await requireAccessibleTable(supabase, {
      authenticatedProfileId: options.authenticatedProfileId,
      tableId: column.table_id,
      userId: options.userId,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw columnNotFound();
    }

    throw error;
  }

  return column;
}

export async function requireAccessibleCell(
  supabase: SupabaseClient,
  options: AccessOptions & {
    cellId: string;
  },
): Promise<DbRow<"cell">> {
  const cell = await getRecord(supabase, "cell", options.cellId);
  const row = await getRecord(supabase, "row", cell.row_id);

  try {
    await requireAccessibleTable(supabase, {
      authenticatedProfileId: options.authenticatedProfileId,
      tableId: row.table_id,
      userId: options.userId,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw cellNotFound();
    }

    throw error;
  }

  return cell;
}

export async function requireAccessibleProgramRun(
  supabase: SupabaseClient,
  options: AccessOptions & {
    runId: string;
  },
): Promise<DbRow<"program_run">> {
  const run = await getRecord(supabase, "program_run", options.runId);

  try {
    await requireAccessibleCell(supabase, {
      authenticatedProfileId: options.authenticatedProfileId,
      cellId: run.target_cell_id,
      userId: options.userId,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw programRunNotFound();
    }

    throw error;
  }

  return run;
}
