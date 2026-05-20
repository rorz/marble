/**
 * Tiny JSON helpers that don't fit anywhere else. Zero third-party deps.
 *
 * These exist so production callers don't sprinkle ad-hoc try/catch around
 * `JSON.parse` and `JSON.stringify`.
 */

/**
 * Parse `input` as JSON. Returns `undefined` for the empty-string case (and
 * for input that is only whitespace) so callers can pass the result through
 * to schemas that accept "no value provided". Throws an `Error` whose `cause`
 * is the original `SyntaxError` for genuine parse failures.
 */
export const parseJsonOrUndefined = (input: string): unknown => {
  const trimmed = input.trim();

  if (trimmed === "") {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch (cause) {
    throw new Error("Input must be valid JSON.", {
      cause,
    });
  }
};

/** Pretty-print a value as JSON with 2-space indentation. */
export const stringifyPretty = (value: unknown): string => {
  return JSON.stringify(value, null, 2) ?? "null";
};

/**
 * Stringify a value as JSON, falling back to `String(value)` when the value
 * cannot be serialised (cycles, BigInts, etc.). Never throws.
 */
export const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

/**
 * Stringify a value as valid JSON even when it contains cycles or BigInts.
 * Cycles become "[Circular]" and BigInts become decimal strings.
 */
export const stringifyJsonSafe = (value: unknown): string => {
  const seen = new WeakSet<object>();

  const json = JSON.stringify(value, (_key, nestedValue) => {
    if (typeof nestedValue === "bigint") {
      return nestedValue.toString();
    }

    if (typeof nestedValue === "object" && nestedValue !== null) {
      if (seen.has(nestedValue)) {
        return "[Circular]";
      }
      seen.add(nestedValue);
    }

    return nestedValue;
  });

  return json ?? "null";
};
