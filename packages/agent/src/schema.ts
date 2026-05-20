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

const isSchemaRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const decodeJsonPointerSegment = (segment: string): string =>
  segment.replace(/~1/g, "/").replace(/~0/g, "~");

const resolveLocalSchemaRef = (
  root: unknown,
  ref: string,
): unknown | undefined => {
  if (!ref.startsWith("#/")) return undefined;

  let current = root;
  for (const segment of ref.slice(2).split("/").map(decodeJsonPointerSegment)) {
    if (!isSchemaRecord(current)) return undefined;
    current = current[segment];
  }

  return current;
};

const sanitizeToolSchemaValue = (
  value: unknown,
  root: unknown,
  seenRefs: ReadonlySet<string>,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeToolSchemaValue(item, root, seenRefs));
  }

  if (!isSchemaRecord(value)) {
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

    return sanitizeToolSchemaValue(
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
    if (SCHEMA_INTERNAL_KEYS.has(key)) continue;
    sanitized[key] = sanitizeToolSchemaValue(childValue, root, seenRefs);
  }

  return sanitized;
};

const sanitizeToolSchema = (raw: unknown): unknown =>
  sanitizeToolSchemaValue(raw, raw, new Set());

export const prepareToolSchema = (raw: unknown): PreparedSchema => {
  const sanitized = sanitizeToolSchema(raw);

  if (typeof sanitized !== "object" || sanitized === null) {
    return {
      schema: {
        additionalProperties: false,
        properties: {
          input: {
            description: "Tool input.",
          },
        },
        required: [
          "input",
        ],
        type: "object",
      },
      wrapped: true,
    };
  }

  const candidate = sanitized as Record<string, unknown>;
  if (candidate.type === "object") {
    return {
      schema: candidate,
      wrapped: false,
    };
  }

  return {
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
  };
};
