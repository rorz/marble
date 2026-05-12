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

export function toCamelKeys<T extends Record<string, unknown>>(
  value: T,
): Camelize<T> {
  return mapObjectKeys(value, toCamelKey) as Camelize<T>;
}

export function toSnakeKeys<T extends Record<string, unknown>>(
  value: T,
): Snakeize<T> {
  return mapObjectKeys(value, toSnakeKey) as Snakeize<T>;
}

/**
 * Type-narrow an unknown value to a plain object record. Excludes arrays and
 * `null`. Useful for guard clauses that need to read keys off untyped JSON.
 */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Cast a snake_cased broadcast row to its camelCased domain type.
 *
 * Single-purpose helper that replaces a per-resource `xFromBroadcastRow`
 * pile with one well-typed primitive. Always pass the target type
 * explicitly: `castCamelKeys<MyType>(row)`.
 */
export function castCamelKeys<T>(value: Record<string, unknown>): T {
  return toCamelKeys(value) as unknown as T;
}

/**
 * Read a non-empty trimmed string off `record[key]`. Returns `null` when
 * the value is missing, not a string, or empty after trimming. Centralises
 * the "user metadata extraction" pattern.
 */
export function readNonEmptyString(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!record) {
    return null;
  }

  const value = record[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}
