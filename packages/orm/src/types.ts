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
export type ResourceIdInput = {
  id: string;
};
export type ResourceIdentity<T extends TableWithIdName> = ResourceIdInput &
  ListParams<T>;
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

export type CallableCollection<TRecord, TCollection> = TCollection &
  ((id: string) => TRecord);

export function callableCollection<
  TRecord,
  TCollection extends {
    record: (id: string) => TRecord;
  },
>(collection: TCollection): CallableCollection<TRecord, TCollection> {
  const callable = (id: string) => collection.record(id);

  return new Proxy(callable, {
    get(target, property, receiver) {
      if (property in collection) {
        const value = Reflect.get(collection, property, collection);

        return typeof value === "function" ? value.bind(collection) : value;
      }

      return Reflect.get(target, property, receiver);
    },
  }) as CallableCollection<TRecord, TCollection>;
}

export abstract class CollectionResource<
  T extends TableWithIdName,
  TRecord = RecordResource<T>,
> {
  // --- Setup ---

  public abstract readonly tableName: T;

  public constructor(
    private readonly options: ResourceOptions,
    protected readonly scope: ListParams<T> = {},
  ) {}

  protected get context() {
    return this.options.context;
  }

  public readonly record = (id: string): TRecord =>
    this.createRecordResource(this.buildIdentity(id));

  // --- Driver methods ---

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
      toDbWhere(this.applyScope(where)),
    );

    return rows.map((row) => toCamelKeys(row));
  }

  public async retrieveByIdentity(
    identity: ResourceIdentity<T>,
  ): Promise<Entity<T>> {
    const row = await this.options.driver.retrieve(
      this.tableName,
      toDbWhere(identity as ListParams<T>) as Partial<DbRow<T>> & {
        id: string;
      },
    );

    return toCamelKeys(row);
  }

  public async updateByIdentity(
    identity: ResourceIdentity<T>,
    values: UpdateParams<T>,
  ): Promise<Entity<T>> {
    const row = await this.options.driver.update(
      this.tableName,
      toDbWhere(identity as ListParams<T>) as Partial<DbRow<T>> & {
        id: string;
      },
      toDbUpdate(values),
    );

    return toCamelKeys(row);
  }

  public async deleteByIdentity(
    identity: ResourceIdentity<T>,
  ): Promise<Entity<T>> {
    const row = await this.options.driver.delete(
      this.tableName,
      toDbWhere(identity as ListParams<T>) as Partial<DbRow<T>> & {
        id: string;
      },
    );

    return toCamelKeys(row);
  }

  protected createScopedCollection<TScope, TCollection extends object>(
    Collection: new (options: ResourceOptions, scope: TScope) => TCollection,
    scope: TScope,
  ): TCollection {
    return new Collection(this.options, scope);
  }

  protected createScopedCallableCollection<
    TScope,
    TChildRecord,
    TCollection extends {
      record: (id: string) => TChildRecord;
    },
  >(
    Collection: new (options: ResourceOptions, scope: TScope) => TCollection,
    scope: TScope,
  ): CallableCollection<TChildRecord, TCollection> {
    return callableCollection(this.createScopedCollection(Collection, scope));
  }

  protected createRecordResource(identity: ResourceIdentity<T>): TRecord {
    return new RecordResource(this, identity) as TRecord;
  }

  private applyScope(where: ListParams<T> = {}): ListParams<T> {
    return {
      ...where,
      ...this.scope,
    };
  }

  private buildIdentity(id: string): ResourceIdentity<T> {
    return {
      ...this.scope,
      id,
    } as ResourceIdentity<T>;
  }

  // --- "Define" methods ---

  protected defineCreate<CreateInput>(
    buildValues: (input: CreateInput) => CreateParams<T>,
  ): (input: CreateInput) => Promise<Entity<T>> {
    return (input) => this.createRecord(buildValues(input));
  }

  protected defineList<ListInput>(
    buildWhere: (input: ListInput) => ListParams<T>,
  ): (input: ListInput) => Promise<Entity<T>[]> {
    return (input) => this.listRecords(buildWhere(input));
  }

  protected defineRetrieve(): (input: ResourceIdInput) => Promise<Entity<T>> {
    return (input) => this.retrieveByIdentity(this.buildIdentity(input.id));
  }

  protected defineUpdate<UpdateInput extends ResourceIdInput>(
    buildValues: (input: UpdateInput) => UpdateParams<T>,
  ): (input: UpdateInput) => Promise<Entity<T>> {
    return (input) =>
      this.updateByIdentity(this.buildIdentity(input.id), buildValues(input));
  }

  protected defineDelete(): (input: ResourceIdInput) => Promise<Entity<T>> {
    return (input) => this.deleteByIdentity(this.buildIdentity(input.id));
  }
}

export class RecordResource<
  T extends TableWithIdName,
  TUpdateInput = UpdateParams<T>,
  TCollection extends CollectionResource<T, unknown> = CollectionResource<
    T,
    unknown
  >,
> {
  public readonly id: string;

  public constructor(
    protected readonly collection: TCollection,
    protected readonly identity: ResourceIdentity<T>,
  ) {
    this.id = identity.id;
  }

  public readonly delete = (): Promise<Entity<T>> =>
    this.collection.deleteByIdentity(this.identity);

  public readonly retrieve = (): Promise<Entity<T>> =>
    this.collection.retrieveByIdentity(this.identity);

  public readonly update = (input: TUpdateInput): Promise<Entity<T>> =>
    this.collection.updateByIdentity(this.identity, input as UpdateParams<T>);
}
