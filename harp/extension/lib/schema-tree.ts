import type { SchemaNode } from "@harp/contracts";

/**
 * Renders a HARP {@link SchemaNode} as a readable, indented type tree for the
 * dashboard — no Zod runtime needed in the extension, it just walks the plain
 * JSON shape the server already returned.
 */

const FORMAT_LABEL: Record<string, string> = {
  date: "date",
  datetime: "datetime",
  email: "email",
  plain: "string",
  url: "url",
  uuid: "uuid",
};

const scalarLabel = (node: SchemaNode): string => {
  if (node.kind === "boolean") {
    return "boolean";
  }
  if (node.kind === "number") {
    return node.integer ? "integer" : "number";
  }
  if (node.kind === "string") {
    return FORMAT_LABEL[node.format] ?? "string";
  }
  if (node.kind === "null") {
    return "null";
  }
  return "unknown";
};

const nullableSuffix = (node: SchemaNode) =>
  "nullable" in node && node.nullable ? " | null" : "";

const span = (className: string, text: string) => {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
};

export const renderSchema = (node: SchemaNode, key?: string): HTMLElement => {
  const row = document.createElement("div");
  row.className = "schema-row";
  if (key !== undefined) {
    row.append(span("schema-key", key));
  }

  if (node.kind === "object") {
    row.append(span("schema-type", `object${nullableSuffix(node)}`));
    const children = document.createElement("div");
    children.className = "schema-children";
    if (node.fields.length === 0) {
      children.append(span("schema-empty", "(no fields)"));
    }
    for (const field of node.fields) {
      children.append(
        renderSchema(field.schema, `${field.key}${field.optional ? "?" : ""}`),
      );
    }
    row.append(children);
    return row;
  }

  if (node.kind === "array") {
    row.append(span("schema-type", `array of${nullableSuffix(node)}`));
    const children = document.createElement("div");
    children.className = "schema-children";
    children.append(renderSchema(node.element));
    row.append(children);
    return row;
  }

  if (node.kind === "union") {
    row.append(span("schema-type", "one of"));
    const children = document.createElement("div");
    children.className = "schema-children";
    for (const variant of node.variants) {
      children.append(renderSchema(variant));
    }
    row.append(children);
    return row;
  }

  row.append(
    span("schema-type", `${scalarLabel(node)}${nullableSuffix(node)}`),
  );
  return row;
};
