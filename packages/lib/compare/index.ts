/**
 * Comparator factories for use with `Array.prototype.sort`. Centralised so
 * "newest first then alphabetical"-style rhythms compose the same way
 * everywhere. Zero third-party dependencies.
 */

export type Compare<T> = (left: T, right: T) => number;

/**
 * Parse a date-like string to a millisecond timestamp. Falsy or unparseable
 * inputs return the supplied `whenInvalid` sentinel so the caller can decide
 * which end of the sort they sink to.
 */
const toTimestamp = (value: string, whenInvalid: number): number => {
  if (!value) {
    return whenInvalid;
  }
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? whenInvalid : ms;
};

/**
 * Compare by a date-like string field, newest first. Items with falsy or
 * unparseable values sink to the bottom (treated as `-Infinity`).
 */
export const byDateDesc = <T>(get: (value: T) => string): Compare<T> => {
  return (left, right) =>
    toTimestamp(get(right), Number.NEGATIVE_INFINITY) -
    toTimestamp(get(left), Number.NEGATIVE_INFINITY);
};

/**
 * Compare by a date-like string field, oldest first. Items with falsy or
 * unparseable values sink to the bottom (treated as `+Infinity`).
 */
export const byDateAsc = <T>(get: (value: T) => string): Compare<T> => {
  return (left, right) =>
    toTimestamp(get(left), Number.POSITIVE_INFINITY) -
    toTimestamp(get(right), Number.POSITIVE_INFINITY);
};

/**
 * Compare by a string field via `localeCompare`. Pass `locales` to use a
 * specific collation; defaults to the runtime's default locale.
 */
export const byString = <T>(
  get: (value: T) => string,
  locales?: Intl.LocalesArgument,
  options?: Intl.CollatorOptions,
): Compare<T> => {
  return (left, right) => get(left).localeCompare(get(right), locales, options);
};

/**
 * Compose a sequence of comparators. The first non-zero result wins; ties
 * fall through to the next comparator. Useful for "primary then secondary"
 * orderings (e.g. resource kind, then date, then label).
 */
export const composeCompare = <T>(...comparators: Compare<T>[]): Compare<T> => {
  return (left, right) => {
    for (const compare of comparators) {
      const result = compare(left, right);

      if (result !== 0) {
        return result;
      }
    }

    return 0;
  };
};
