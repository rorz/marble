import { z } from "zod";
import { defineResourceOperations } from "../../orpc";
import { baseEntitySchema, timestampSchema } from "../base";
import { ProfileSchema } from "./profile";

const tags = [
  "Sidebar",
] as const;

const SidebarProjectSchema = z.object({
  createdAt: timestampSchema,
  folderPath: z.array(z.string()),
  id: baseEntitySchema.shape.id,
  name: z.string(),
  ownerProfileId: baseEntitySchema.shape.id,
  updatedAt: timestampSchema,
});

const SidebarProgramSchema = z.object({
  firstParty: z.boolean(),
  id: baseEntitySchema.shape.id,
  name: z.string(),
  ownerProfileId: baseEntitySchema.shape.id,
  updatedAt: timestampSchema,
});

const SidebarProjectChildSchema = z.object({
  id: baseEntitySchema.shape.id,
  name: z.string(),
  projectId: baseEntitySchema.shape.id,
  updatedAt: timestampSchema,
});

const SidebarPipeSchema = z.object({
  id: baseEntitySchema.shape.id,
  sourceId: baseEntitySchema.shape.id,
  tableId: baseEntitySchema.shape.id,
  updatedAt: timestampSchema,
});

export const sidebarOperations = defineResourceOperations({
  getData: {
    input: z.object({}).optional(),
    output: z.object({
      ownerProfileIds: z.array(baseEntitySchema.shape.id),
      pipes: z.array(SidebarPipeSchema),
      profiles: z.array(
        ProfileSchema.pick({
          externalName: true,
          icon: true,
          id: true,
          name: true,
          type: true,
        }),
      ),
      programs: z.array(SidebarProgramSchema),
      projects: z.array(SidebarProjectSchema),
      sources: z.array(SidebarProjectChildSchema),
      tables: z.array(SidebarProjectChildSchema),
      userId: baseEntitySchema.shape.id,
    }),
    route: {
      method: "GET",
      operationId: "sidebar.getData",
      path: "/sidebar",
      summary: "Get GUI sidebar data",
      tags,
    },
  },
});
