import type { SchemaNode } from "../model";

/**
 * Renders a {@link SchemaNode} as Zod v4 source text. The output mirrors the
 * conventions used across the Marble contracts (`z.uuidv4()`,
 * `z.iso.datetime({ offset: true })`, expanded object literals) so generated
 * artifacts read like hand-written ones.
 */

const FORMAT_TO_ZOD: Record<string, string> = {
  date: "z.iso.date()",
  datetime: "z.iso.datetime({ offset: true })",
  email: "z.email()",
  plain: "z.string()",
  url: "z.url()",
  uuid: "z.uuidv4()",
};

const isIdentifier = (key: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);

const quoteKey = (key: string) =>
  isIdentifier(key) ? key : JSON.stringify(key);

const withNullable = (expression: string, nullable: boolean) =>
  nullable ? `${expression}.nullable()` : expression;

const indent = (depth: number) => "  ".repeat(depth);

export const schemaNodeToZod = (node: SchemaNode, depth = 0): string => {
  switch (node.kind) {
    case "unknown":
      return "z.unknown()";
    case "null":
      return "z.null()";
    case "boolean":
      return withNullable("z.boolean()", node.nullable);
    case "number":
      return withNullable(
        node.integer ? "z.number().int()" : "z.number()",
        node.nullable,
      );
    case "string":
      return withNullable(
        FORMAT_TO_ZOD[node.format] ?? "z.string()",
        node.nullable,
      );
    case "array":
      return withNullable(
        `z.array(${schemaNodeToZod(node.element, depth)})`,
        node.nullable,
      );
    case "object": {
      if (node.fields.length === 0) {
        return withNullable("z.object({})", node.nullable);
      }
      const lines = node.fields.map((field) => {
        const value = schemaNodeToZod(field.schema, depth + 1);
        const suffix = field.optional ? ".optional()" : "";
        return `${indent(depth + 1)}${quoteKey(field.key)}: ${value}${suffix},`;
      });
      return withNullable(
        `z.object({\n${lines.join("\n")}\n${indent(depth)}})`,
        node.nullable,
      );
    }
    case "union": {
      const hasNull = node.variants.some((variant) => variant.kind === "null");
      const concrete = node.variants.filter(
        (variant) => variant.kind !== "null",
      );
      if (concrete.length === 0) {
        return "z.null()";
      }
      if (concrete.length === 1) {
        return withNullable(schemaNodeToZod(concrete[0], depth), hasNull);
      }
      const members = concrete
        .map((variant) => schemaNodeToZod(variant, depth))
        .join(", ");
      return withNullable(`z.union([${members}])`, hasNull);
    }
    default:
      return "z.unknown()";
  }
};
