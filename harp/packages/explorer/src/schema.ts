/**
 * Converts a Zod-derived JSON Schema into the shape Pi's `defineTool` expects:
 * inlines `$ref`s, strips `$defs`/`$schema`, and wraps non-object schemas under
 * an `input` property. Adapted from the Marble agent's tool-schema sanitiser,
 * inlined here so the explorer stays a standalone island.
 */

const JSON_VALUE_SCHEMA = {
  description: "Any JSON-serializable value.",
};
const SCHEMA_INTERNAL_KEYS = new Set([
  "$defs",
  "$schema",
  "definitions",
]);

type PreparedSchema = {
  schema: Record<string, unknown>;
  wrapped: boolean;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const decodeJsonPointerSegment = (segment: string): string =>
  segment.replace(/~1/g, "/").replace(/~0/g, "~");

const resolveLocalSchemaRef = (root: unknown, ref: string): unknown => {
  if (!ref.startsWith("#/")) {
    return undefined;
  }
  let current = root;
  for (const segment of ref.slice(2).split("/").map(decodeJsonPointerSegment)) {
    if (!isPlainRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const sanitizeValue = (
  value: unknown,
  root: unknown,
  seenRefs: ReadonlySet<string>,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, root, seenRefs));
  }
  if (!isPlainRecord(value)) {
    return value;
  }
  if (typeof value.$ref === "string") {
    if (seenRefs.has(value.$ref)) {
      return JSON_VALUE_SCHEMA;
    }
    const target = resolveLocalSchemaRef(root, value.$ref);
    if (target === undefined) {
      return JSON_VALUE_SCHEMA;
    }
    return sanitizeValue(
      target,
      root,
      new Set([
        ...seenRefs,
        value.$ref,
      ]),
    );
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (SCHEMA_INTERNAL_KEYS.has(key)) {
      continue;
    }
    sanitized[key] = sanitizeValue(childValue, root, seenRefs);
  }
  return sanitized;
};

const wrapInput = (candidate: Record<string, unknown>): PreparedSchema => ({
  schema: {
    additionalProperties: false,
    properties: {
      input: candidate,
    },
    required: [
      "input",
    ],
    type: "object",
  },
  wrapped: true,
});

export const prepareToolSchema = (raw: unknown): PreparedSchema => {
  const sanitized = sanitizeValue(raw, raw, new Set());
  if (!isPlainRecord(sanitized)) {
    return wrapInput({
      description: "Tool input.",
    });
  }
  if (sanitized.type === "object") {
    return {
      schema: sanitized,
      wrapped: false,
    };
  }
  return wrapInput(sanitized);
};
