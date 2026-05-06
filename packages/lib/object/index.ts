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
