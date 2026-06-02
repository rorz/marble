import type {
  JsonValue,
  SchemaField,
  SchemaNode,
  StringFormat,
} from "../model";

/**
 * Schema induction. {@link inferSchema} turns a single JSON value into a
 * {@link SchemaNode}; {@link mergeSchema} folds two nodes into one so repeated
 * samples of the same endpoint converge on a precise shape (optional fields,
 * widened numbers, nullable scalars, conflict unions).
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

const detectFormat = (value: string): StringFormat => {
  if (UUID_PATTERN.test(value)) {
    return "uuid";
  }
  if (DATETIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value))) {
    return "datetime";
  }
  if (DATE_PATTERN.test(value)) {
    return "date";
  }
  if (EMAIL_PATTERN.test(value)) {
    return "email";
  }
  if (/^https?:\/\//i.test(value)) {
    return "url";
  }
  return "plain";
};

const NULLABLE_KINDS = new Set([
  "boolean",
  "number",
  "string",
  "array",
  "object",
]);

const markNullable = (node: SchemaNode): SchemaNode => {
  if (node.kind === "union") {
    return addToUnion(node, {
      kind: "null",
    });
  }
  if (NULLABLE_KINDS.has(node.kind)) {
    return {
      ...node,
      nullable: true,
    } as SchemaNode;
  }
  return node;
};

const variantKey = (node: SchemaNode) => node.kind;

const addToUnion = (
  union: Extract<
    SchemaNode,
    {
      kind: "union";
    }
  >,
  node: SchemaNode,
): Extract<
  SchemaNode,
  {
    kind: "union";
  }
> => {
  if (node.kind === "union") {
    return node.variants.reduce<
      Extract<
        SchemaNode,
        {
          kind: "union";
        }
      >
    >((acc, variant) => addToUnion(acc, variant), union);
  }
  const variants = [
    ...union.variants,
  ];
  const existingIndex = variants.findIndex(
    (variant) => variantKey(variant) === variantKey(node),
  );
  if (existingIndex === -1) {
    variants.push(node);
  } else {
    variants[existingIndex] = mergeSchema(variants[existingIndex], node);
  }
  return {
    kind: "union",
    variants,
  };
};

const unionOf = (left: SchemaNode, right: SchemaNode): SchemaNode => {
  const base: Extract<
    SchemaNode,
    {
      kind: "union";
    }
  > =
    left.kind === "union"
      ? left
      : {
          kind: "union",
          variants: [
            left,
          ],
        };
  const merged = addToUnion(base, right);
  if (merged.variants.length === 1) {
    return merged.variants[0];
  }
  return merged;
};

const fieldMap = (fields: SchemaField[]) => {
  const map = new Map<string, SchemaField>();
  for (const field of fields) {
    map.set(field.key, field);
  }
  return map;
};

const mergeObjects = (
  left: Extract<
    SchemaNode,
    {
      kind: "object";
    }
  >,
  right: Extract<
    SchemaNode,
    {
      kind: "object";
    }
  >,
): SchemaNode => {
  const leftFields = fieldMap(left.fields);
  const rightFields = fieldMap(right.fields);
  const keys = [
    ...new Set([
      ...leftFields.keys(),
      ...rightFields.keys(),
    ]),
  ].sort();
  const fields: SchemaField[] = keys.map((key) => {
    const inLeft = leftFields.get(key);
    const inRight = rightFields.get(key);
    if (inLeft && inRight) {
      return {
        key,
        optional: inLeft.optional || inRight.optional,
        schema: mergeSchema(inLeft.schema, inRight.schema),
      };
    }
    const present = (inLeft ?? inRight) as SchemaField;
    return {
      key,
      optional: true,
      schema: present.schema,
    };
  });
  return {
    fields,
    kind: "object",
    nullable: left.nullable || right.nullable,
  };
};

export const mergeSchema = (
  left: SchemaNode,
  right: SchemaNode,
): SchemaNode => {
  if (left.kind === "unknown") {
    return right;
  }
  if (right.kind === "unknown") {
    return left;
  }
  if (left.kind === "null") {
    return markNullable(right);
  }
  if (right.kind === "null") {
    return markNullable(left);
  }
  if (left.kind !== right.kind) {
    return unionOf(left, right);
  }
  if (left.kind === "boolean" && right.kind === "boolean") {
    return {
      kind: "boolean",
      nullable: left.nullable || right.nullable,
    };
  }
  if (left.kind === "number" && right.kind === "number") {
    return {
      integer: left.integer && right.integer,
      kind: "number",
      nullable: left.nullable || right.nullable,
    };
  }
  if (left.kind === "string" && right.kind === "string") {
    return {
      format: left.format === right.format ? left.format : "plain",
      kind: "string",
      nullable: left.nullable || right.nullable,
    };
  }
  if (left.kind === "array" && right.kind === "array") {
    return {
      element: mergeSchema(left.element, right.element),
      kind: "array",
      nullable: left.nullable || right.nullable,
    };
  }
  if (left.kind === "object" && right.kind === "object") {
    return mergeObjects(left, right);
  }
  if (left.kind === "union") {
    return unionOf(left, right);
  }
  return unionOf(left, right);
};

export const inferSchema = (value: JsonValue | undefined): SchemaNode => {
  if (value === undefined || value === null) {
    return {
      kind: "null",
    };
  }
  if (typeof value === "boolean") {
    return {
      kind: "boolean",
      nullable: false,
    };
  }
  if (typeof value === "number") {
    return {
      integer: Number.isInteger(value),
      kind: "number",
      nullable: false,
    };
  }
  if (typeof value === "string") {
    return {
      format: detectFormat(value),
      kind: "string",
      nullable: false,
    };
  }
  if (Array.isArray(value)) {
    const element = value.reduce<SchemaNode>(
      (acc, item) => mergeSchema(acc, inferSchema(item)),
      {
        kind: "unknown",
      },
    );
    return {
      element,
      kind: "array",
      nullable: false,
    };
  }
  const fields: SchemaField[] = Object.keys(value)
    .sort()
    .map((key) => ({
      key,
      optional: false,
      schema: inferSchema(value[key]),
    }));
  return {
    fields,
    kind: "object",
    nullable: false,
  };
};
