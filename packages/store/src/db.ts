import type { Database, Json, SupabaseClient } from "@marble/supabase";
import type {
  CreateParams,
  DbInsert,
  DbRow,
  DbUpdate,
  Entity,
  ListParams,
  MarbleStoreOptions,
  ResourceActions,
  ResourceContext,
  TableWithIdName,
  UpdateParams,
} from "./types";
import {
  toCamelKeys,
  toDbInsert,
  toDbUpdate,
  toSnakeKey,
  toSnakeKeys,
} from "./types";

export type ResourceDeps = {
  actions: ResourceActions;
  context: ResourceContext;
  db: SupabaseDb;
  serviceSupabase?: SupabaseClient;
  supabase: SupabaseClient;
};

export type ListOrder<T extends TableWithIdName> = {
  ascending?: boolean;
  column: keyof Entity<T> & string;
};

export type ListOptions<T extends TableWithIdName> = {
  limit?: number;
  orderBy?: ListOrder<T>[];
};

type InsertTableRowsInput = {
  idx: number;
  ownerProfileId: string;
  quantity: number;
  tableId: string;
};

type InsertTableRowsResult = {
  cellCount: number;
  cells: {
    columnId: string;
    id: string;
    rowId: string;
  }[];
  rowCount: number;
  rows: {
    id: string;
    idx: number;
  }[];
};

type CreateSourceEventInput = {
  rawPayload: CreateParams<"source_event">["rawPayload"];
  sourceId: string;
};

type TableInsertRowsRpcResult = {
  cellCount: number;
  cells?: {
    columnId: string;
    id: string;
    rowId: string;
  }[];
  rowCount: number;
  rows?: {
    id: string;
    idx: number;
  }[];
};

type SupabaseDb = {
  delete: <T extends TableWithIdName>(
    tableName: T,
    id: string,
    where?: ListParams<T>,
  ) => Promise<Entity<T>>;
  get: <T extends TableWithIdName>(
    tableName: T,
    id: string,
    where?: ListParams<T>,
  ) => Promise<Entity<T>>;
  insert: <T extends TableWithIdName>(
    tableName: T,
    values: CreateParams<T>,
  ) => Promise<Entity<T>>;
  list: <T extends TableWithIdName>(
    tableName: T,
    where?: ListParams<T>,
    options?: ListOptions<T>,
  ) => Promise<Entity<T>[]>;
  first: <T extends TableWithIdName>(
    tableName: T,
    options: {
      orderBy: {
        ascending?: boolean;
        column: keyof Entity<T> & string;
      };
      where?: ListParams<T>;
    },
  ) => Promise<Entity<T> | null>;
  insertTableRows: (
    input: InsertTableRowsInput,
  ) => Promise<InsertTableRowsResult>;
  createSourceEvent: (
    input: CreateSourceEventInput,
  ) => Promise<Entity<"source_event">>;
  update: <T extends TableWithIdName>(
    tableName: T,
    id: string,
    values: UpdateParams<T>,
    where?: ListParams<T>,
  ) => Promise<Entity<T>>;
};

const SUPABASE_SELECT_PAGE_SIZE = 1000;

type EventOperation = "Create" | "Delete" | "Update";
type EventDiffEntry = {
  after: Json | null;
  before: Json | null;
  path: string[];
};

const throwSupabaseError = (
  error: {
    message: string;
  } | null,
) => {
  if (error) {
    throw new Error(error.message);
  }
};

async function timeDbCall<T>(
  context: ResourceContext,
  name: string,
  task: () => Promise<T>,
) {
  const startedAt = performance.now();

  try {
    return await task();
  } finally {
    context.recordTiming?.(name, performance.now() - startedAt);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asJsonValue(value: unknown): Json | null {
  if (value === undefined) {
    return null;
  }

  return value as Json;
}

function valuesMatch(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildDiffEntries(
  before: unknown,
  after: unknown,
  path: string[] = [],
): EventDiffEntry[] {
  if (valuesMatch(before, after)) {
    return [];
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    return Array.from(
      new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ]),
    )
      .sort()
      .flatMap((key) =>
        buildDiffEntries(before[key], after[key], [
          ...path,
          key,
        ]),
      );
  }

  return [
    {
      after: asJsonValue(after),
      before: asJsonValue(before),
      path,
    },
  ];
}

function normalizeEventRow(
  resource: string,
  row: Record<string, unknown> | null,
): Json | null {
  if (!row) {
    return null;
  }

  const normalized = Object.fromEntries(
    Object.entries(row).filter(
      ([key]) =>
        ![
          "created_at",
          "updated_at",
        ].includes(key),
    ),
  );

  if (resource === "key") {
    delete normalized.hash;
  }

  if (resource === "secret") {
    delete normalized.value;
    delete normalized.vault_secret_id;
  }

  if (resource === "source") {
    delete normalized.webhook_token;
  }

  return normalized as Json;
}

async function writeEventRecord(
  serviceSupabase: SupabaseClient | undefined,
  context: ResourceContext,
  input: {
    after: Record<string, unknown> | null;
    before: Record<string, unknown> | null;
    operation: EventOperation;
    resource: string;
  },
) {
  if (!serviceSupabase || input.resource === "event") {
    return;
  }

  const actorProfileId = context.profileId;

  if (!actorProfileId) {
    return;
  }

  const beforeState = normalizeEventRow(input.resource, input.before);
  const afterState = normalizeEventRow(input.resource, input.after);
  const diff = buildDiffEntries(beforeState, afterState);

  if (input.operation === "Update" && diff.length === 0) {
    return;
  }

  const entityId = String((input.after ?? input.before)?.id ?? "").trim();

  if (!entityId) {
    return;
  }

  const { error } = await serviceSupabase.from("event").insert({
    actor_key_id: context.actorKeyId,
    actor_profile_id: actorProfileId,
    after_state: afterState,
    before_state: beforeState,
    diff: diff as Json,
    entity_id: entityId,
    operation: input.operation,
    request_id: context.requestId,
    resource: input.resource,
    source: context.eventSource ?? "RAW_API",
  });

  throwSupabaseError(error);
}

const parseTableInsertRowsResult = (
  value: unknown,
): TableInsertRowsRpcResult => {
  if (
    !isRecord(value) ||
    typeof value.rowCount !== "number" ||
    typeof value.cellCount !== "number"
  ) {
    throw new Error("table_insert_rows returned an unexpected payload.");
  }

  return value as TableInsertRowsRpcResult;
};

const toSupabaseMatch = <T extends TableWithIdName>(
  where: ListParams<T>,
): Partial<DbRow<T>> => toSnakeKeys(where) as unknown as Partial<DbRow<T>>;

const identityWhere = <T extends TableWithIdName>(
  id: string,
  where: ListParams<T> = {},
): Partial<DbRow<T>> & {
  id: string;
} =>
  toSupabaseMatch({
    ...where,
    id,
  } as ListParams<T>) as Partial<DbRow<T>> & {
    id: string;
  };

const createSupabaseDb = (
  supabase: SupabaseClient,
  context: ResourceContext,
  serviceSupabase?: SupabaseClient,
): SupabaseDb => ({
  createSourceEvent: async (input) =>
    timeDbCall(context, "db_rpc_source_event_create", async () => {
      const { data, error } = await supabase.rpc("source_event_create", {
        p_raw_payload: input.rawPayload,
        p_source_id: input.sourceId,
      });

      throwSupabaseError(error);

      if (data === null) {
        throw new Error("No source event row was returned after insert.");
      }

      return toCamelKeys<"source_event">(data as DbRow<"source_event">);
    }),
  delete: async (tableName, id, where) =>
    timeDbCall(context, `db_delete_${tableName}`, async () => {
      const { data, error } = await supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .delete()
        .match(identityWhere(id, where))
        .select<"*", DbRow<typeof tableName>>("*")
        .single();

      throwSupabaseError(error);

      if (data === null) {
        throw new Error(`No ${tableName} row was found matching identity.`);
      }

      await writeEventRecord(serviceSupabase, context, {
        after: null,
        before: data as Record<string, unknown>,
        operation: "Delete",
        resource: tableName,
      });

      return toCamelKeys(data);
    }),
  first: async (tableName, options) =>
    timeDbCall(context, `db_first_${tableName}`, async () => {
      const request = supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .select<"*", DbRow<typeof tableName>>("*");

      const match = toSupabaseMatch(options.where ?? {});
      const filteredRequest =
        Object.keys(match).length === 0 ? request : request.match(match);
      const { data, error } = await filteredRequest
        .order(toSnakeKey(options.orderBy.column) as never, {
          ascending: options.orderBy.ascending ?? true,
        })
        .limit(1)
        .maybeSingle();

      throwSupabaseError(error);

      return data === null ? null : toCamelKeys(data);
    }),
  get: async (tableName, id, where) =>
    timeDbCall(context, `db_get_${tableName}`, async () => {
      const { data, error } = await supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .select<"*", DbRow<typeof tableName>>("*")
        .match(identityWhere(id, where))
        .single();

      throwSupabaseError(error);

      if (data === null) {
        throw new Error(`No ${tableName} row was found matching identity.`);
      }

      return toCamelKeys(data);
    }),
  insert: async (tableName, values) =>
    timeDbCall(context, `db_insert_${tableName}`, async () => {
      const { data, error } = await supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .insert<DbInsert<typeof tableName>>(toDbInsert(values))
        .select<"*", DbRow<typeof tableName>>("*")
        .single();

      throwSupabaseError(error);

      if (data === null) {
        throw new Error(`No ${tableName} row was returned after insert.`);
      }

      await writeEventRecord(serviceSupabase, context, {
        after: data as Record<string, unknown>,
        before: null,
        operation: "Create",
        resource: tableName,
      });

      return toCamelKeys(data);
    }),
  insertTableRows: async (input) =>
    timeDbCall(context, "db_rpc_table_insert_rows", async () => {
      const { data, error } = await supabase.rpc("table_insert_rows", {
        p_idx: input.idx,
        p_owner_profile_id: input.ownerProfileId,
        p_quantity: input.quantity,
        p_table_id: input.tableId,
      });

      throwSupabaseError(error);

      const result = parseTableInsertRowsResult(data);

      return {
        cellCount: result.cellCount,
        cells: result.cells ?? [],
        rowCount: result.rowCount,
        rows: result.rows ?? [],
      };
    }),
  list: async (tableName, where = {}, options = {}) =>
    timeDbCall(context, `db_list_${tableName}`, async () => {
      const rows: DbRow<typeof tableName>[] = [];
      const requestedLimit = options.limit ?? Number.POSITIVE_INFINITY;

      for (let from = 0; rows.length < requestedLimit; ) {
        const pageSize = Math.min(
          SUPABASE_SELECT_PAGE_SIZE,
          requestedLimit - rows.length,
        );
        const request = supabase
          .from<
            typeof tableName,
            Database["public"]["Tables"][typeof tableName]
          >(tableName)
          .select<"*", DbRow<typeof tableName>>("*");

        const match = toSupabaseMatch(where);
        let filteredRequest =
          Object.keys(match).length === 0 ? request : request.match(match);

        for (const order of options.orderBy ?? []) {
          filteredRequest = filteredRequest.order(
            toSnakeKey(order.column) as never,
            {
              ascending: order.ascending ?? true,
            },
          );
        }

        const { data, error } = await filteredRequest.range(
          from,
          from + pageSize - 1,
        );

        throwSupabaseError(error);

        const page = data ?? [];
        rows.push(...page);

        if (page.length < pageSize) {
          break;
        }

        from += pageSize;
      }

      return rows.map((row) => toCamelKeys(row));
    }),
  update: async (tableName, id, values, where) =>
    timeDbCall(context, `db_update_${tableName}`, async () => {
      const identity = identityWhere(id, where);
      const beforeResult = await supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .select<"*", DbRow<typeof tableName>>("*")
        .match(identity)
        .single();

      throwSupabaseError(beforeResult.error);

      if (beforeResult.data === null) {
        throw new Error(`No ${tableName} row was found matching identity.`);
      }

      const { data, error } = await supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .update<DbUpdate<typeof tableName>>(toDbUpdate(values))
        .match(identity)
        .select<"*", DbRow<typeof tableName>>("*")
        .single();

      throwSupabaseError(error);

      if (data === null) {
        throw new Error(`No ${tableName} row was found matching identity.`);
      }

      await writeEventRecord(serviceSupabase, context, {
        after: data as Record<string, unknown>,
        before: beforeResult.data as Record<string, unknown>,
        operation: "Update",
        resource: tableName,
      });

      return toCamelKeys(data);
    }),
});

export const createResourceDeps = ({
  actions = {},
  context,
  serviceSupabase,
  supabase,
}: MarbleStoreOptions): ResourceDeps => ({
  actions,
  context,
  db: createSupabaseDb(supabase, context, serviceSupabase),
  serviceSupabase,
  supabase,
});
