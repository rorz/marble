import type { Hono } from "hono";
import { z } from "zod";
import { type ApiEnv, mountResource, requireAnyDefined } from "../core";
import {
  createRecord,
  deleteRecord,
  listRecordsFromQuery,
  listRecordsInColumn,
  type OrderSpec,
  successResponse,
  updateRecord,
} from "../data";
import {
  listAccessibleOwnerProfileIds,
  requireAccessibleProject,
  resolveProjectOwnerProfileId,
} from "./access";
import { nonEmptyStringSchema, requestObject, uuidSchema } from "./shared";
import { deleteTableCascade } from "./table";

const projectListSchema = requestObject({
  ownerProfileId: uuidSchema.optional(),
});

const projectWriteSchema = requestObject({
  folderPath: z.array(nonEmptyStringSchema).optional(),
  name: nonEmptyStringSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

const CREATED_AT_ORDER: OrderSpec[] = [
  {
    column: "created_at",
  },
];

export function mountProjectResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          const ownerProfileId = await resolveProjectOwnerProfileId(
            c.var.supabase,
            {
              authenticatedProfileId: c.var.auth?.profileId,
              ownerProfileId: body.ownerProfileId,
              userId: c.var.auth?.userId,
            },
          );
          const data = await createRecord(c.var.supabase, "project", {
            folder_path: body.folderPath ?? [],
            name: body.name ?? "Untitled Project",
            owner_profile_id: ownerProfileId,
          });

          return {
            data,
            location: `/projects/${data.id}`,
          };
        },
        schema: projectWriteSchema,
      },
      list: {
        handler: async (c, query) => {
          const ownerProfileIds = await listAccessibleOwnerProfileIds(
            c.var.supabase,
            {
              authenticatedProfileId: c.var.auth?.profileId,
              userId: c.var.auth?.userId,
            },
          );

          if (ownerProfileIds !== undefined) {
            if (
              query.ownerProfileId &&
              !ownerProfileIds.includes(query.ownerProfileId)
            ) {
              return [];
            }

            const scopedProfileIds = query.ownerProfileId
              ? [
                  query.ownerProfileId,
                ]
              : ownerProfileIds;

            if (scopedProfileIds.length === 0) {
              return [];
            }

            return listRecordsInColumn(
              c.var.supabase,
              "project",
              "owner_profile_id",
              scopedProfileIds,
              CREATED_AT_ORDER,
            );
          }

          return listRecordsFromQuery(
            c.var.supabase,
            "project",
            query,
            {
              ownerProfileId: "owner_profile_id",
            },
            CREATED_AT_ORDER,
          );
        },
        schema: projectListSchema,
      },
      path: "/projects",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await requireAccessibleProject(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            projectId: id,
            userId: c.var.auth?.userId,
          });
          const tables = await listRecordsFromQuery(
            c.var.supabase,
            "table",
            {
              projectId: id,
            },
            {
              projectId: "project_id",
            },
          );

          for (const table of tables) {
            await deleteTableCascade(c.var.supabase, table.id);
          }

          await deleteRecord(c.var.supabase, "project", id);
          return successResponse();
        },
      },
      get: {
        handler: (c, id) =>
          requireAccessibleProject(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            projectId: id,
            userId: c.var.auth?.userId,
          }),
      },
      idParam: "projectId",
      patch: {
        handler: async (c, id, body) => {
          const existing = await requireAccessibleProject(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            projectId: id,
            userId: c.var.auth?.userId,
          });
          requireAnyDefined([
            body.folderPath,
            body.name,
            body.ownerProfileId,
          ]);

          return updateRecord(
            c.var.supabase,
            "project",
            id,
            {
              folder_path: body.folderPath,
              name: body.name,
              owner_profile_id:
                body.ownerProfileId === undefined
                  ? undefined
                  : await resolveProjectOwnerProfileId(c.var.supabase, {
                      authenticatedProfileId: c.var.auth?.profileId,
                      ownerProfileId: body.ownerProfileId,
                      userId: c.var.auth?.userId,
                    }),
            },
            {
              before: existing,
            },
          );
        },
        schema: projectWriteSchema,
      },
      path: "/projects/:projectId",
    },
  });
}
