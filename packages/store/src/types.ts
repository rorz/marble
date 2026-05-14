import {
  type Camelize,
  type Snakeize,
  // harness-ignore: no-forward-reference -- import specifier source names shadow the local overload declarations; this is an import, not a value reference
  toCamelKeys as toCamelObjectKeys,
  // harness-ignore: no-forward-reference -- same: import specifier source name shadows the local overload declaration
  toSnakeKeys as toSnakeObjectKeys,
} from "@marble/lib/object";
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

export type CreateParams<T extends TableName> = Camelize<DbInsert<T>>;
export type Entity<T extends TableName> = Camelize<DbRow<T>>;
export type ListParams<T extends TableName> = Partial<Entity<T>>;
export type UpdateParams<T extends TableName> = Camelize<DbUpdate<T>>;
export { toSnakeKey } from "@marble/lib/object";

export function toCamelKeys<T extends TableName>(value: DbRow<T>): Entity<T>;
export function toCamelKeys<T extends Record<string, unknown>>(
  value: T,
): Camelize<T>;
export function toCamelKeys(value: Record<string, unknown>) {
  return toCamelObjectKeys(value);
}

export function toSnakeKeys<T extends TableName>(
  value: CreateParams<T>,
): DbInsert<T>;
export function toSnakeKeys<T extends Record<string, unknown>>(
  value: T,
): Snakeize<T>;
export function toSnakeKeys(value: Record<string, unknown>) {
  return toSnakeObjectKeys(value);
}

const toDbKeys = (value: Record<string, unknown>) => toSnakeObjectKeys(value);

export function toDbInsert<T extends TableName>(
  values: CreateParams<T>,
): DbInsert<T>;
export function toDbInsert(values: Record<string, unknown>) {
  return toDbKeys(values) as unknown;
}

export function toDbUpdate<T extends TableName>(
  values: UpdateParams<T>,
): DbUpdate<T>;
export function toDbUpdate(values: Record<string, unknown>) {
  return toDbKeys(values) as unknown;
}

export type ResourceRow<Name extends TableName> = Tables<Name>;

export type ResourceContext = {
  actorKeyId?: string;
  eventSource?: "CLI" | "RAW_API" | "WEB_APP";
  profileId?: string;
  recordTiming?: (name: string, durationMs: number) => void;
  requestId?: string;
  userId?: string;
};

export const requireProfileId = (context: ResourceContext) => {
  if (!context.profileId) {
    throw new Error("This operation requires a profile context.");
  }

  return context.profileId;
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

export type ProgramVersionTestInput = {
  inputConfig: Record<string, unknown>;
  manualInput?: string;
};

export type ProgramVersionTestResult = {
  detail?: unknown;
  error?: string;
  errorType?: string;
  ok: boolean;
  output: unknown;
};

type RuntimeActionResult = {
  payload: Record<string, unknown>;
  status: number;
};

export type ResourceActions = {
  executeProgramRun?: (input: {
    runId: string;
  }) => Promise<RuntimeActionResult>;
  executeProgramVersionTest?: (input: {
    body: unknown;
    programVersionId: string;
  }) => Promise<RuntimeActionResult>;
};

export type MarbleStoreOptions = {
  actions?: ResourceActions;
  context: ResourceContext;
  serviceSupabase?: SupabaseClient;
  supabase: SupabaseClient;
};

export type MarbleClientOptions = MarbleStoreOptions;
