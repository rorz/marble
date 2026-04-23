import type { Database, SupabaseClient } from "@marble/supabase";
import { ApiError, requireById, requiredValue } from "./core";
import { writeEventRecord } from "./event-driver";

export type DbTableName = keyof Database["public"]["Tables"];
type DbTable<Name extends DbTableName> = Database["public"]["Tables"][Name];
export type DbInsert<Name extends DbTableName> = DbTable<Name>["Insert"];
export type DbRow<Name extends DbTableName> = DbTable<Name>["Row"];
export type DbUpdate<Name extends DbTableName> = DbTable<Name>["Update"];
type QueryValue = boolean | number | string;

export type OrderSpec = {
  ascending?: boolean;
  column: string;
};

type IndexedTableName = "column" | "row";
type PostgresError = {
  code?: string;
  details?: string | null;
  hint?: string | null;
  message: string;
};

const RECORD_METADATA = {
  cell: {
    idKey: "cellId",
    label: "Cell",
  },
  column: {
    idKey: "columnId",
    label: "Column",
  },
  column_dependency: {
    idKey: "dependencyId",
    label: "Column dependency",
  },
  drain: {
    idKey: "drainId",
    label: "Drain",
  },
  event: {
    idKey: "eventId",
    label: "Event",
  },
  key: {
    idKey: "keyId",
    label: "Key",
  },
  profile: {
    idKey: "profileId",
    label: "Profile",
  },
  program: {
    idKey: "programId",
    label: "Program",
  },
  program_file: {
    idKey: "programFileId",
    label: "Program file",
  },
  program_run: {
    idKey: "runId",
    label: "Program run",
  },
  program_version: {
    idKey: "programVersionId",
    label: "Program version",
  },
  project: {
    idKey: "projectId",
    label: "Project",
  },
  row: {
    idKey: "rowId",
    label: "Row",
  },
  secret: {
    idKey: "secretId",
    label: "Secret",
  },
  source: {
    idKey: "sourceId",
    label: "Source",
  },
  source_event: {
    idKey: "sourceEventId",
    label: "Source event",
  },
  table: {
    idKey: "tableId",
    label: "Table",
  },
} as const;
type RecordTableName = keyof typeof RECORD_METADATA & DbTableName;

function getPostgresError(error: unknown): PostgresError | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const candidate = error as Partial<PostgresError>;
  if (typeof candidate.message !== "string") {
    return undefined;
  }

  return {
    code: candidate.code,
    details: candidate.details,
    hint: candidate.hint,
    message: candidate.message,
  };
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const postgresError = getPostgresError(error);
  if (postgresError) {
    return new ApiError(
      postgresError.code === "23505" ? 409 : 500,
      postgresError.message,
      {
        code: postgresError.code,
        details: postgresError.details,
        hint: postgresError.hint,
      },
    );
  }

  return new ApiError(
    500,
    error instanceof Error ? error.message : String(error),
  );
}

function isTableIndexConflict(error: unknown) {
  const postgresError = getPostgresError(error);
  if (!postgresError || postgresError.code !== "23505") {
    return false;
  }

  return (
    postgresError.details?.includes("(table_id, idx)") ||
    postgresError.message.includes("(table_id, idx)")
  );
}

async function writeCreateEvents<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  rows: DbRow<Name>[],
) {
  for (const row of rows) {
    await writeEventRecord(supabase, {
      after: row as Record<string, unknown>,
      before: null,
      operation: "Create",
      resource: table,
    });
  }
}

export async function listRecords<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  where: Record<string, QueryValue | undefined>,
  orderBy: OrderSpec[] = [],
): Promise<DbRow<Name>[]> {
  let request = supabase.from(table as never).select("*");

  for (const [column, value] of Object.entries(where)) {
    if (value !== undefined) {
      request = request.eq(column as never, value as never);
    }
  }

  for (const order of orderBy) {
    request = request.order(order.column as never, {
      ascending: order.ascending ?? true,
    });
  }

  const { data, error } = await request;

  if (error) {
    throw toApiError(error);
  }

  return (data ?? []) as DbRow<Name>[];
}

export function listRecordsFromQuery<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  query: Record<string, unknown>,
  filters: Record<string, string>,
  orderBy: OrderSpec[] = [],
) {
  return listRecords(
    supabase,
    table,
    Object.fromEntries(
      Object.entries(filters).map(([queryKey, column]) => [
        column,
        query[queryKey] as QueryValue | undefined,
      ]),
    ),
    orderBy,
  );
}

export async function listRecordsInColumn<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  column: string,
  values: QueryValue[],
  orderBy: OrderSpec[] = [],
): Promise<DbRow<Name>[]> {
  if (values.length === 0) {
    return [];
  }

  let request = supabase
    .from(table as never)
    .select("*")
    .in(column as never, values as never);

  for (const order of orderBy) {
    request = request.order(order.column as never, {
      ascending: order.ascending ?? true,
    });
  }

  const { data, error } = await request;

  if (error) {
    throw toApiError(error);
  }

  return (data ?? []) as DbRow<Name>[];
}

export async function createRecord<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  values: DbInsert<Name>,
): Promise<DbRow<Name>> {
  const { data, error } = await supabase
    .from(table as never)
    .insert(values as never)
    .select("*")
    .single();

  if (error) {
    throw toApiError(error);
  }

  await writeCreateEvents(supabase, table, [
    data as DbRow<Name>,
  ]);

  return data as DbRow<Name>;
}

export async function createRecords<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  values: DbInsert<Name>[],
): Promise<DbRow<Name>[]> {
  if (values.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(table as never)
    .insert(values as never)
    .select("*");

  if (error) {
    throw toApiError(error);
  }

  await writeCreateEvents(supabase, table, (data ?? []) as DbRow<Name>[]);

  return (data ?? []) as DbRow<Name>[];
}

export async function createRecordsIgnoringDuplicates<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  values: DbInsert<Name>[],
  onConflict: string,
): Promise<DbRow<Name>[]> {
  if (values.length === 0) {
    return [];
  }

  // Some create flows intentionally race on unique natural keys, e.g. cells
  // materialized by concurrent row and column creation.
  const { data, error } = await supabase
    .from(table as never)
    .upsert(values as never, {
      ignoreDuplicates: true,
      onConflict,
    })
    .select("*");

  if (error) {
    throw toApiError(error);
  }

  await writeCreateEvents(supabase, table, (data ?? []) as DbRow<Name>[]);

  return (data ?? []) as DbRow<Name>[];
}

export async function createRecordsWithGeneratedIndex<
  Name extends IndexedTableName,
>(
  supabase: SupabaseClient,
  table: Name,
  tableId: string,
  buildValues: (startIndex: number) => DbInsert<Name>[],
  options?: {
    maxAttempts?: number;
  },
): Promise<DbRow<Name>[]> {
  const maxAttempts = options?.maxAttempts ?? 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const startIndex = await nextIndex(supabase, table, tableId);
    const values = buildValues(startIndex);
    const { data, error } = await supabase
      .from(table as never)
      .insert(values as never)
      .select("*");

    if (!error) {
      await writeCreateEvents(supabase, table, (data ?? []) as DbRow<Name>[]);
      return (data ?? []) as DbRow<Name>[];
    }

    if (!isTableIndexConflict(error)) {
      throw toApiError(error);
    }
  }

  throw new ApiError(
    409,
    `Could not allocate a unique idx for ${table} records on table '${tableId}' after repeated concurrent conflicts`,
  );
}

export async function updateRecord<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  id: string,
  values: DbUpdate<Name>,
): Promise<DbRow<Name>> {
  const before = await requireById<DbRow<Name>>(
    supabase
      .from(table as never)
      .select("*")
      .eq("id" as never, id as never)
      .maybeSingle() as never,
    table,
    id,
  );

  const { data, error } = await supabase
    .from(table as never)
    .update(values as never)
    .eq("id" as never, id as never)
    .select("*")
    .single();

  if (error) {
    throw toApiError(error);
  }

  await writeEventRecord(supabase, {
    after: data as Record<string, unknown>,
    before: before as Record<string, unknown>,
    operation: "Update",
    resource: table,
  });

  return data as DbRow<Name>;
}

export async function deleteRecord<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  id: string,
) {
  const before = await requireById<DbRow<Name>>(
    supabase
      .from(table as never)
      .select("*")
      .eq("id" as never, id as never)
      .maybeSingle() as never,
    table,
    id,
  );

  const { error } = await supabase
    .from(table as never)
    .delete()
    .eq("id" as never, id as never);

  if (error) {
    throw toApiError(error);
  }

  await writeEventRecord(supabase, {
    after: null,
    before: before as Record<string, unknown>,
    operation: "Delete",
    resource: table,
  });
}

export async function deleteRecordsByColumn<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  column: string,
  value: QueryValue,
) {
  const before = await listRecords(supabase, table, {
    [column]: value,
  });

  const { error } = await supabase
    .from(table as never)
    .delete()
    .eq(column as never, value as never);

  if (error) {
    throw toApiError(error);
  }

  for (const row of before) {
    await writeEventRecord(supabase, {
      after: null,
      before: row as Record<string, unknown>,
      operation: "Delete",
      resource: table,
    });
  }
}

export async function deleteRecordsInColumn<Name extends DbTableName>(
  supabase: SupabaseClient,
  table: Name,
  column: string,
  values: QueryValue[],
) {
  if (values.length === 0) {
    return;
  }

  const before = await listRecordsInColumn(supabase, table, column, values);

  const { error } = await supabase
    .from(table as never)
    .delete()
    .in(column as never, values as never);

  if (error) {
    throw toApiError(error);
  }

  for (const row of before) {
    await writeEventRecord(supabase, {
      after: null,
      before: row as Record<string, unknown>,
      operation: "Delete",
      resource: table,
    });
  }
}

export function successResponse() {
  return {
    success: true,
  };
}

export async function getRecord<
  Name extends RecordTableName,
  Result = DbRow<Name>,
>(
  supabase: SupabaseClient,
  table: Name,
  id: string | undefined,
  options?: {
    idKey?: string;
    label?: string;
    select?: string;
  },
): Promise<Result> {
  const metadata = RECORD_METADATA[table];
  const resolvedId = requiredValue(id, options?.idKey ?? metadata.idKey);

  return requireById<Result>(
    supabase
      .from(table as never)
      .select(options?.select ?? "*")
      .eq("id" as never, resolvedId as never)
      .maybeSingle() as never,
    options?.label ?? metadata.label,
    resolvedId,
  );
}

export async function nextIndex(
  supabase: SupabaseClient,
  tableName: "column" | "row",
  tableId: string,
) {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("table_id", tableId)
    .order("idx", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw toApiError(error);
  }

  return (data?.idx ?? -1) + 1;
}
