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
  row: {
    idKey: "rowId",
    label: "Row",
  },
  table: {
    idKey: "tableId",
    label: "Table",
  },
} as const;
type RecordTableName = keyof typeof RECORD_METADATA & DbTableName;

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
    throw new ApiError(500, error.message);
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
    throw new ApiError(500, error.message);
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
    throw new ApiError(500, error.message);
  }

  await writeEventRecord(supabase, {
    after: data as Record<string, unknown>,
    before: null,
    operation: "Create",
    resource: table,
  });

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
    throw new ApiError(500, error.message);
  }

  for (const row of data ?? []) {
    await writeEventRecord(supabase, {
      after: row as Record<string, unknown>,
      before: null,
      operation: "Create",
      resource: table,
    });
  }

  return (data ?? []) as DbRow<Name>[];
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
    throw new ApiError(500, error.message);
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
    throw new ApiError(500, error.message);
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
    throw new ApiError(500, error.message);
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
    throw new ApiError(500, error.message);
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
    throw new ApiError(500, error.message);
  }

  return (data?.idx ?? -1) + 1;
}
