/**
 * Pure list operations that recur across the web app, sidebar, realtime,
 * and store layers. Zero third-party dependencies.
 */

type Identified = {
  id: string;
};

export type Compare<T> = (left: T, right: T) => number;

/**
 * Return a new array with `row` placed at the front, replacing any prior
 * entry with the same `id`. If a comparator is supplied the result is sorted
 * by it. Original array is never mutated.
 */
export function upsertById<T extends Identified>(
  rows: readonly T[],
  row: T,
  compare?: Compare<T>,
): T[] {
  const next = [
    row,
    ...rows.filter((candidate) => candidate.id !== row.id),
  ];

  return compare ? next.sort(compare) : next;
}

/** Return a new array with the entry whose `id` matches removed. */
export function removeById<T extends Identified>(
  rows: readonly T[],
  id: string,
): T[] {
  return rows.filter((row) => row.id !== id);
}

/** Immutable sort: returns a new array sorted by `compare`. */
export function sortBy<T>(rows: readonly T[], compare: Compare<T>): T[] {
  return [
    ...rows,
  ].sort(compare);
}

/**
 * Return a new array with duplicates collapsed. Keeps the **last** occurrence
 * for each `id` (Map insertion semantics: later writes overwrite earlier ones).
 */
export function dedupeById<T extends Identified>(rows: readonly T[]): T[] {
  return Array.from(
    new Map(
      rows.map((row) => [
        row.id,
        row,
      ]),
    ).values(),
  );
}

/**
 * Group `items` into lists keyed by `keyOf(item)`. Insertion order within
 * each group matches the input.
 */
export function groupBy<T, K>(
  items: Iterable<T>,
  keyOf: (item: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const key = keyOf(item);
    const existing = groups.get(key);

    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [
        item,
      ]);
    }
  }

  return groups;
}

/**
 * Index `items` by a unique key. When duplicate keys appear the last value
 * wins (matches `Object.fromEntries` semantics).
 */
export function indexBy<T, K>(
  items: Iterable<T>,
  keyOf: (item: T) => K,
): Map<K, T> {
  const index = new Map<K, T>();

  for (const item of items) {
    index.set(keyOf(item), item);
  }

  return index;
}

/**
 * Supabase relation columns come back as either `T`, `T[]`, or null
 * depending on whether the join is one-to-one or one-to-many. Pick the
 * first concrete value or `undefined`.
 */
export function firstRelation<T>(
  value: T | T[] | null | undefined,
): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}
