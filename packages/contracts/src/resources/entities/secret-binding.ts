import { z } from "zod";
import { defineResourceOperations } from "../../orpc";
import { baseEntitySchema } from "../base";

const tags = [
  "Secret Bindings",
] as const;

const SecretBindingEntrySchema = z.object({
  envName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  secretId: baseEntitySchema.shape.id,
});

const SecretBindingMapSchema = z.record(
  baseEntitySchema.shape.id,
  z.record(z.string(), baseEntitySchema.shape.id),
);

export const secretBindingOperations = defineResourceOperations({
  listColumns: {
    input: z.object({
      columnIds: z.array(baseEntitySchema.shape.id),
    }),
    output: SecretBindingMapSchema,
    route: {
      method: "POST",
      operationId: "secretBindings.listColumns",
      path: "/secret-bindings/columns/list",
      summary: "List column secret bindings",
      tags,
    },
  },
  listPrograms: {
    input: z.object({
      programIds: z.array(baseEntitySchema.shape.id),
    }),
    output: SecretBindingMapSchema,
    route: {
      method: "POST",
      operationId: "secretBindings.listPrograms",
      path: "/secret-bindings/programs/list",
      summary: "List program secret bindings",
      tags,
    },
  },
  setColumn: {
    input: z.object({
      bindings: z.array(SecretBindingEntrySchema),
      columnId: baseEntitySchema.shape.id,
    }),
    output: z.array(SecretBindingEntrySchema),
    route: {
      method: "PATCH",
      operationId: "secretBindings.setColumn",
      path: "/secret-bindings/columns/{columnId}",
      summary: "Replace column secret bindings",
      tags,
    },
  },
  setProgram: {
    input: z.object({
      bindings: z.array(SecretBindingEntrySchema),
      programId: baseEntitySchema.shape.id,
    }),
    output: z.array(SecretBindingEntrySchema),
    route: {
      method: "PATCH",
      operationId: "secretBindings.setProgram",
      path: "/secret-bindings/programs/{programId}",
      summary: "Replace program secret bindings",
      tags,
    },
  },
});
