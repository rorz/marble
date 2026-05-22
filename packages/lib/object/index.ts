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

const toCamelKey = (key: string) => {
  return key.replace(/_([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
};

export const toSnakeKey = (key: string) => {
  return key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
};

const mapObjectKeys = <T extends Record<string, unknown>>(
  value: T,
  mapKey: (key: string) => string,
) => {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      mapKey(key),
      entry,
    ]),
  );
};

export const toCamelKeys = <T extends Record<string, unknown>>(
  value: T,
): Camelize<T> => {
  return mapObjectKeys(value, toCamelKey) as Camelize<T>;
};

export const toSnakeKeys = <T extends Record<string, unknown>>(
  value: T,
): Snakeize<T> => {
  return mapObjectKeys(value, toSnakeKey) as Snakeize<T>;
};

/**
 * Type-narrow an unknown value to a plain object record. Excludes arrays and
 * `null`. Useful for guard clauses that need to read keys off untyped JSON.
 */
export const isPlainRecord = (
  value: unknown,
): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/**
 * Cast a snake_cased broadcast row to its camelCased domain type.
 *
 * Single-purpose helper that replaces a per-resource `xFromBroadcastRow`
 * pile with one well-typed primitive. Always pass the target type
 * explicitly: `castCamelKeys<MyType>(row)`.
 *
 * The `T extends Record<string, unknown>` constraint is what lets us
 * cast through with a single `as T` (not `as unknown as T`): callers
 * always pass a domain object type whose keys are strings, so the
 * structural shape of `toCamelKeys(value)` is assignable.
 */
export const castCamelKeys = <T extends Record<string, unknown>>(
  value: Record<string, unknown>,
): T => {
  return toCamelKeys(value) as T;
};

/**
 * Read a non-empty trimmed string off `record[key]`. Returns `null` when
 * the value is missing, not a string, or empty after trimming. Centralises
 * the "user metadata extraction" pattern.
 */
export const readNonEmptyString = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null => {
  if (!record) {
    return null;
  }

  const value = record[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
};

/**
 * Read `record[key]` and return it only when it is a string. Returns `null`
 * for missing, wrong-type, or non-string values. Does not trim — use
 * `readNonEmptyString` when you want trimming + emptiness rejection.
 */
export const readString = (
  record: Record<string, unknown>,
  key: string,
): string | null => {
  const value = record[key];
  return typeof value === "string" ? value : null;
};

/**
 * Read `record[key]` and return it only when it is a finite number. Returns
 * `null` for missing, wrong-type, or non-number values (including `NaN` is
 * NOT excluded here — callers that need finiteness should filter).
 */
export const readNumber = (
  record: Record<string, unknown>,
  key: string,
): number | null => {
  const value = record[key];
  return typeof value === "number" ? value : null;
};

/**
 * Read `record[key]` and return it only when it is a boolean. Returns
 * `null` for missing or non-boolean values; never coerces truthy strings
 * or zero/one.
 */
export const readBoolean = (
  record: Record<string, unknown>,
  key: string,
): boolean | null => {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
};

/**
 * Read `record[key]` and return it as a nested record only when it is a
 * plain object (per `isPlainRecord`). Returns `null` for arrays, `null`,
 * primitives, or missing values.
 */
export const readRecord = (
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null => {
  const value = record[key];
  return isPlainRecord(value) ? value : null;
};

/**
 * Read `record[key]` as an array and return only the entries that are
 * plain records (per `isPlainRecord`). Returns an empty array when the
 * value is missing or not an array. Non-record entries inside an array
 * are silently filtered out.
 */
export const readRecordArray = (
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] => {
  const value = record[key];
  return Array.isArray(value) ? value.filter(isPlainRecord) : [];
};
