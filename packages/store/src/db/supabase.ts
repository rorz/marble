import { withTiming } from "@marble/lib/timing";
import type { Database, SupabaseClient } from "@marble/supabase";
import type {
  CreateParams,
  DbInsert,
  DbRow,
  DbUpdate,
  Entity,
  ListParams,
  ResourceContext,
  TableWithIdName,
  UpdateParams,
} from "../types";
import {
  toCamelKeys,
  toDbInsert,
  toDbUpdate,
  toSnakeKey,
  toSnakeKeys,
} from "../types";
import { writeEventRecord } from "./event-record";
import {
  type CreateSourceEventInput,
  type InsertTableRowsInput,
  type InsertTableRowsResult,
  parseTableInsertRowsResult,
} from "./rpc";

const SUPABASE_SELECT_PAGE_SIZE = 1000;

export type ListOrder<T extends TableWithIdName> = {
  ascending?: boolean;
  column: keyof Entity<T> & string;
};

export type ListOptions<T extends TableWithIdName> = {
  limit?: number;
  orderBy?: ListOrder<T>[];
};

export type SupabaseDb = {
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

type SingleRowResult<T extends TableWithIdName> = {
  data: DbRow<T> | null;
  error: {
    message: string;
  } | null;
};

const noopRecordTiming = () => {};

// Throw on error / throw on null / camelCase the row in one shot.
function unwrapSingleRow<T extends TableWithIdName>(
  result: SingleRowResult<T>,
  missingMessage: string,
): Entity<T> {
  throwSupabaseError(result.error);
  if (result.data === null) {
    throw new Error(missingMessage);
  }
  return toCamelKeys(result.data);
}

const timeDbCall = <T>(
  context: ResourceContext,
  name: string,
  task: () => Promise<T>,
) => withTiming(context.recordTiming ?? noopRecordTiming, name, task);

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

export const createSupabaseDb = (
  supabase: SupabaseClient,
  context: ResourceContext,
  serviceSupabase?: SupabaseClient,
): SupabaseDb => ({
  createSourceEvent: async (input) =>
    timeDbCall(context, "db_rpc_source_event_create", async () =>
      unwrapSingleRow<"source_event">(
        (await supabase.rpc("source_event_create", {
          p_raw_payload: input.rawPayload,
          p_source_id: input.sourceId,
        })) as SingleRowResult<"source_event">,
        "No source event row was returned after insert.",
      ),
    ),
  delete: async (tableName, id, where) =>
    timeDbCall(context, `db_delete_${tableName}`, async () => {
      const result = await supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .delete()
        .match(identityWhere(id, where))
        .select<"*", DbRow<typeof tableName>>("*")
        .single();

      const camelRow = unwrapSingleRow<typeof tableName>(
        result,
        `No ${tableName} row was found matching identity.`,
      );

      await writeEventRecord(serviceSupabase, context, {
        after: null,
        before: result.data as Record<string, unknown>,
        operation: "Delete",
        resource: tableName,
      });

      return camelRow;
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
    timeDbCall(context, `db_get_${tableName}`, async () =>
      unwrapSingleRow<typeof tableName>(
        await supabase
          .from<
            typeof tableName,
            Database["public"]["Tables"][typeof tableName]
          >(tableName)
          .select<"*", DbRow<typeof tableName>>("*")
          .match(identityWhere(id, where))
          .single(),
        `No ${tableName} row was found matching identity.`,
      ),
    ),
  insert: async (tableName, values) =>
    timeDbCall(context, `db_insert_${tableName}`, async () => {
      const result = await supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .insert<DbInsert<typeof tableName>>(toDbInsert(values))
        .select<"*", DbRow<typeof tableName>>("*")
        .single();

      const camelRow = unwrapSingleRow<typeof tableName>(
        result,
        `No ${tableName} row was returned after insert.`,
      );

      await writeEventRecord(serviceSupabase, context, {
        after: result.data as Record<string, unknown>,
        before: null,
        operation: "Create",
        resource: tableName,
      });

      return camelRow;
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

      unwrapSingleRow<typeof tableName>(
        beforeResult,
        `No ${tableName} row was found matching identity.`,
      );

      const updateResult = await supabase
        .from<typeof tableName, Database["public"]["Tables"][typeof tableName]>(
          tableName,
        )
        .update<DbUpdate<typeof tableName>>(toDbUpdate(values))
        .match(identity)
        .select<"*", DbRow<typeof tableName>>("*")
        .single();

      const camelRow = unwrapSingleRow<typeof tableName>(
        updateResult,
        `No ${tableName} row was found matching identity.`,
      );

      await writeEventRecord(serviceSupabase, context, {
        after: updateResult.data as Record<string, unknown>,
        before: beforeResult.data as Record<string, unknown>,
        operation: "Update",
        resource: tableName,
      });

      return camelRow;
    }),
});
