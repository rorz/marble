import z from "zod";
import { defineResourceOperations } from "../helpers";

const tags = ["Tables"] as const;

const TableSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuidv4(),
  name: z.string(),
  projectId: z.uuidv4(),
  updatedAt: z.iso.datetime(),
});

// TODO: Consider if this could be a factory
const GETRouteFor = (singularNoun: string, pluralNoun: string) => ({
  method: "GET" as const,
  operationId: `${pluralNoun}.get`,
  path: `/${pluralNoun}/{id}` as `/${string}`,
  summary: `Get a ${singularNoun}`,
  tags,
});

export const tableOperations = defineResourceOperations({
  get: {
    input: z.object({
      id: z.uuidv4(),
    }),
    output: TableSchema.nullable(),
    route: GETRouteFor("table", "tables"),
  },
  list: {
    input: z
      .object({
        projectId: z.uuidv4().optional(),
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
