import type { Database, TableName, Tables } from "@marble/supabase";

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

export type Camelize<T> = {
  [K in keyof T as K extends string ? SnakeToCamel<K> : K]: T[K];
};
export type Snakeize<T> = {
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

function toSnakeKey(key: string) {
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

function toDbKeys(value: Record<string, unknown>) {
  return mapObjectKeys(value, toSnakeKey);
}

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

export function toDbWhere<T extends TableName>(
  where: ListParams<T>,
): Partial<DbRow<T>>;
export function toDbWhere(where: Record<string, unknown>) {
  return toDbKeys(where);
}

export interface ResourceDriver {
  create<T extends TableWithIdName>(
    tableName: T,
    values: DbInsert<T>,
  ): Promise<DbRow<T>>;

  delete<T extends TableWithIdName>(
    tableName: T,
    where: Partial<DbRow<T>> & {
      id: string;
    },
  ): Promise<DbRow<T>>;

  list<T extends TableWithIdName>(
    tableName: T,
    where?: Partial<DbRow<T>>,
  ): Promise<DbRow<T>[]>;

  retrieve<T extends TableWithIdName>(
    tableName: T,
    where: Partial<DbRow<T>> & {
      id: string;
    },
  ): Promise<DbRow<T>>;

  update<T extends TableWithIdName>(
    tableName: T,
    where: Partial<DbRow<T>> & {
      id: string;
    },
    values: DbUpdate<T>,
  ): Promise<DbRow<T>>;
}

export type ResourceRow<Name extends TableName> = Tables<Name>;

export type ResourceContext = {
  profileId: string;
};

export type ResourceOptions = {
  context: ResourceContext;
  driver: ResourceDriver;
};

export abstract class CollectionResource<T extends TableWithIdName> {
  public abstract readonly tableName: T;

  public constructor(private readonly options: ResourceOptions) {}

  protected get context() {
    return this.options.context;
  }

  protected async createRecord(values: CreateParams<T>): Promise<Entity<T>> {
    const row = await this.options.driver.create(
      this.tableName,
      toDbInsert(values),
    );

    return toCamelKeys(row);
  }

  protected async listRecords(where?: ListParams<T>): Promise<Entity<T>[]> {
    const rows = await this.options.driver.list(
      this.tableName,
      toDbWhere(where ?? {}),
    );

    return rows.map((row) => toCamelKeys(row));
  }

  protected async getRecord(
    id: string,
    where?: ListParams<T>,
  ): Promise<Entity<T>> {
    const row = await this.options.driver.retrieve(
      this.tableName,
      this.buildIdentity(id, where),
    );

    return toCamelKeys(row);
  }

  protected async updateRecord(
    id: string,
    values: UpdateParams<T>,
    where?: ListParams<T>,
  ): Promise<Entity<T>> {
    const row = await this.options.driver.update(
      this.tableName,
      this.buildIdentity(id, where),
      toDbUpdate(values),
    );

    return toCamelKeys(row);
  }

  protected async deleteRecord(
    id: string,
    where?: ListParams<T>,
  ): Promise<Entity<T>> {
    const row = await this.options.driver.delete(
      this.tableName,
      this.buildIdentity(id, where),
    );

    return toCamelKeys(row);
  }

  private buildIdentity(
    id: string,
    where: ListParams<T> = {},
  ): Partial<DbRow<T>> & {
    id: string;
  } {
    return toDbWhere({
      ...where,
      id,
    } as ListParams<T>) as Partial<DbRow<T>> & {
      id: string;
    };
  }
}
