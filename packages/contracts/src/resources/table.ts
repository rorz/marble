import z from "zod";
import { defineResourceOperations } from "../helpers";

const tags = ["Tables"] as const;

export const TableSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuidv4(),
  name: z.string(),
  projectId: z.uuidv4(),
  updatedAt: z.iso.datetime(),
});

// TODO: Consider if this could be a factory
export const GETRouteFor = (singularNoun: string, pluralNoun: string) => ({
  method: "GET" as const,
  operationId: `${pluralNoun}.get`,
  path: `/${pluralNoun}/{${singularNoun}Id}` as `/${string}`,
  summary: `Get a ${singularNoun}`,
  tags,
});

export const tableOperations = defineResourceOperations({
  get: {
    input: z.object({
      tableId: z.uuidv4(),
    }),
    output: TableSchema.nullable(),
    route: GETRouteFor("table", "tables"),
  },
  list: {
    input: z
      .object({
        name: z.string().optional(),
      })
      .optional(),
    output: z.array(TableSchema),
    route: {
      method: "GET",
      operationId: "tables.list",
      path: "/tables",
      summary: "List tables",
      tags,
    },
  },
});
