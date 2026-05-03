import type {
  Database,
  SupabaseClient,
  TableName,
  Tables,
} from "@marble/supabase";

type DbTable<T extends TableName> = Database["public"]["Tables"][T];

export type DbInsert<T extends TableName> =
  DbTable<T> extends {
    Insert: unknown;
  }
    ? DbTable<T>["Insert"]
    : never;

export type DbRow<T extends TableName> =
  DbTable<T> extends {
    Row: unknown;
  }
    ? DbTable<T>["Row"]
    : never;

export type DbUpdate<T extends TableName> =
  DbTable<T> extends {
    Update: unknown;
  }
    ? DbTable<T>["Update"]
    : never;

export type TableWithIdName = {
  [Name in TableName]: DbRow<Name> extends {
    id: string;
  }
    ? Name
    : never;
}[TableName];

type SnakeToCamel<S extends string> = S extends `${infer H}_${infer R}`
  ? `${H}${Capitalize<SnakeToCamel<R>>}`
  : S;
type CamelToSnake<S extends string> = S extends `${infer H}${infer R}`
  ? H extends Lowercase<H>
    ? `${H}${CamelToSnake<R>}`
    : `_${Lowercase<H>}${CamelToSnake<R>}`
  : S;

type Camelize<T> = {
  [K in keyof T as K extends string ? SnakeToCamel<K> : K]: T[K];
};
type Snakeize<T> = {
  [K in keyof T as K extends string ? CamelToSnake<K> : K]: T[K];
};

export type CreateParams<T extends TableName> = Camelize<DbInsert<T>>;
export type Entity<T extends TableName> = Camelize<DbRow<T>>;
export type ListParams<T extends TableName> = Partial<Entity<T>>;
export type UpdateParams<T extends TableName> = Camelize<DbUpdate<T>>;

function toCamelKey(key: string) {
  return key.replace(/_([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
}

export function toSnakeKey(key: string) {
  return key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
}

function mapObjectKeys<T extends Record<string, unknown>>(
  value: T,
  mapKey: (key: string) => string,
) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      mapKey(key),
      entry,
    ]),
  );
}

export function toCamelKeys<T extends TableName>(value: DbRow<T>): Entity<T>;
export function toCamelKeys<T extends Record<string, unknown>>(
  value: T,
): Camelize<T>;
export function toCamelKeys(value: Record<string, unknown>) {
  return mapObjectKeys(value, toCamelKey);
}

export function toSnakeKeys<T extends TableName>(
  value: CreateParams<T>,
): DbInsert<T>;
export function toSnakeKeys<T extends Record<string, unknown>>(
  value: T,
): Snakeize<T>;
export function toSnakeKeys(value: Record<string, unknown>) {
  return mapObjectKeys(value, toSnakeKey);
}

const toDbKeys = (value: Record<string, unknown>) =>
  mapObjectKeys(value, toSnakeKey);

export function toDbInsert<T extends TableName>(
  values: CreateParams<T>,
): DbInsert<T>;
export function toDbInsert(values: Record<string, unknown>) {
  return toDbKeys(values);
}

export function toDbUpdate<T extends TableName>(
  values: UpdateParams<T>,
): DbUpdate<T>;
export function toDbUpdate(values: Record<string, unknown>) {
  return toDbKeys(values);
}

export type ResourceRow<Name extends TableName> = Tables<Name>;

export type ResourceContext = {
  profileId: string;
};

export type CellRunInput = {
  manualInput?: string | null;
};

export type CellRunResult = {
  cellId?: string;
  error?: boolean;
  message?: string;
  output: unknown;
  runId: string;
  success: boolean;
};

export type ResourceActions = {
  runCell?: (cellId: string, input?: CellRunInput) => Promise<CellRunResult>;
};

export type MarbleStoreOptions = {
  actions?: ResourceActions;
  context: ResourceContext;
  supabase: SupabaseClient;
};

export type MarbleClientOptions = MarbleStoreOptions;
