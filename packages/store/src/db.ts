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

export const createSupabaseDb = (supabase: SupabaseClient): SupabaseDb => ({
  delete: async (tableName, id, where) => {
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
  },
  first: async (tableName, options) => {
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
  },
  get: async (tableName, id, where) => {
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
  },
  insert: async (tableName, values) => {
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
  },
  list: async (tableName, where = {}, options = {}) => {
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
  },
  update: async (tableName, id, values, where) => {
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
  },
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
  db: createSupabaseDb(supabase),
});
