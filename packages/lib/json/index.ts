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

const stripJsoncComments = (input: string): string => {
  let output = "";
  let inString = false;
  let escaped = false;
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      index += 1;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      index += 2;
      while (index < input.length && input[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "/" && nextChar === "*") {
      index += 2;
      while (
        index < input.length &&
        !(input[index] === "*" && input[index + 1] === "/")
      ) {
        output += input[index] === "\n" ? "\n" : "";
        index += 1;
      }
      index = Math.min(index + 2, input.length);
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
};

const stripJsoncTrailingCommas = (input: string): string => {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (/\s/.test(input[lookahead] ?? "")) {
        lookahead += 1;
      }

      if (input[lookahead] === "}" || input[lookahead] === "]") {
        continue;
      }
    }

    output += char;
  }

  return output;
};

export const parseJsonc = (input: string): unknown => {
  try {
    return JSON.parse(
      stripJsoncTrailingCommas(stripJsoncComments(input)),
    ) as unknown;
  } catch (cause) {
    throw new Error("Input must be valid JSONC.", {
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
  } catch (error) {
    void error;
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
