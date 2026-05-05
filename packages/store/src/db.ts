import type { Database, SupabaseClient } from "@marble/supabase";
import type {
  CreateParams,
  DbInsert,
  DbRow,
  DbUpdate,
  Entity,
  ListParams,
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
  rowCount: number;
};

type CreateSourceEventInput = {
  rawPayload: CreateParams<"source_event">["rawPayload"];
  sourceId: string;
};

type TableInsertRowsRpcResult = {
  cellCount: number;
  rowCount: number;
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

      return result;
    }),
  list: async (tableName, where = {}, options = {}) =>
    timeDbCall(context, `db_list_${tableName}`, async () => {
      const request = supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
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

      const { data, error } = await (options.limit === undefined
        ? filteredRequest
        : filteredRequest.limit(options.limit));

      throwSupabaseError(error);

      return (data ?? []).map((row) => toCamelKeys(row));
    }),
  update: async (tableName, id, values, where) =>
    timeDbCall(context, `db_update_${tableName}`, async () => {
      const { data, error } = await supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .update<DbUpdate<typeof tableName>>(toDbUpdate(values))
        .match(identityWhere(id, where))
        .select<"*", DbRow<typeof tableName>>("*")
        .single();

      throwSupabaseError(error);

      if (data === null) {
        throw new Error(`No ${tableName} row was found matching identity.`);
      }

      return toCamelKeys(data);
    }),
});

export const createResourceDeps = ({
  actions = {},
  context,
  supabase,
}: {
  actions?: ResourceActions;
  context: ResourceContext;
  supabase: SupabaseClient;
}): ResourceDeps => ({
  actions,
  context,
  db: createSupabaseDb(supabase, context),
});
