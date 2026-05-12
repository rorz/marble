/**
 * Comparator factories for use with `Array.prototype.sort`. Centralised so
 * "newest first then alphabetical"-style rhythms compose the same way
 * everywhere. Zero third-party dependencies.
 */

export type Compare<T> = (left: T, right: T) => number;

/**
 * Compare by a date-like string field, newest first. Items with falsy or
 * unparseable values sink to the bottom (they compare as `NaN` →
 * `Date.getTime()` returns `NaN`, which makes both arms `false`).
 */
export function byDateDesc<T>(get: (value: T) => string): Compare<T> {
  return (left, right) =>
    new Date(get(right)).getTime() - new Date(get(left)).getTime();
}

/** Compare by a date-like string field, oldest first. */
export function byDateAsc<T>(get: (value: T) => string): Compare<T> {
  return (left, right) =>
    new Date(get(left)).getTime() - new Date(get(right)).getTime();
}

/**
 * Compare by a string field via `localeCompare`. Pass `locales` to use a
 * specific collation; defaults to the runtime's default locale.
 */
export function byString<T>(
  get: (value: T) => string,
  locales?: Intl.LocalesArgument,
  options?: Intl.CollatorOptions,
): Compare<T> {
  return (left, right) => get(left).localeCompare(get(right), locales, options);
}

/**
 * Compose a sequence of comparators. The first non-zero result wins; ties
 * fall through to the next comparator. Useful for "primary then secondary"
 * orderings (e.g. resource kind, then date, then label).
 */
export function composeCompare<T>(...comparators: Compare<T>[]): Compare<T> {
  return (left, right) => {
    for (const compare of comparators) {
      const result = compare(left, right);

      if (result !== 0) {
        return result;
      }
    }

    return 0;
  };
}
