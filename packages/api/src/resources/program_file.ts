import type { Hono } from "hono";
import { z } from "zod";
import {
  type ApiContext,
  type ApiEnv,
  ApiError,
  mountResource,
  requireAnyDefined,
  requiredParam,
} from "../core";
import {
  createRecord,
  deleteRecord,
  getRecord,
  listRecordsFromQuery,
  successResponse,
  updateRecord,
} from "../data";
import { resolveOwnerProfileFilter, validateOwnerProfileId } from "./profile";
import {
  nonEmptyStringSchema,
  programFileTypeSchema,
  requestObject,
  uuidSchema,
} from "./shared";

const programFileListSchema = requestObject({
  ownerProfileId: uuidSchema.optional(),
  versionId: uuidSchema.optional(),
});

const programFileCreateSchema = requestObject({
  content: z.string(),
  filename: nonEmptyStringSchema,
  filetype: programFileTypeSchema,
  ownerProfileId: uuidSchema.optional(),
  versionId: uuidSchema.optional(),
});

const programFilePatchSchema = requestObject({
  content: z.string().optional(),
  filename: nonEmptyStringSchema.optional(),
  filetype: programFileTypeSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  versionId: uuidSchema.optional(),
});

async function createProgramFile(
  c: ApiContext,
  versionId: string,
  body: z.infer<typeof programFileCreateSchema>,
) {
  const version = await getRecord(c.var.supabase, "program_version", versionId);
  if (version.published_at !== null) {
    throw new ApiError(
      409,
      `Program version '${versionId}' is published and read-only`,
    );
  }
  const program = await getRecord(
    c.var.supabase,
    "program",
    version.program_id,
  );

  return createRecord(c.var.supabase, "program_file", {
    content: body.content,
    filename: body.filename,
    filetype: body.filetype,
    owner_profile_id:
      (await validateOwnerProfileId(c.var.supabase, {
        authenticatedProfileId: c.var.auth?.profileId,
        ownerProfileId: body.ownerProfileId,
      })) ?? program.owner_profile_id,
    version_id: version.id,
  });
}

export function mountProgramFileResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          if (!body.versionId) {
            throw new ApiError(400, "versionId is required");
          }

          const data = await createProgramFile(c, body.versionId, body);

          return {
            data,
            location: `/program-files/${data.id}`,
          };
        },
        schema: programFileCreateSchema,
      },
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "program_file",
            {
              ...query,
              ownerProfileId: resolveOwnerProfileFilter({
                authenticatedProfileId: c.var.auth?.profileId,
                ownerProfileId: query.ownerProfileId,
              }),
            },
            {
              ownerProfileId: "owner_profile_id",
              versionId: "version_id",
            },
            [
              {
                column: "version_id",
              },
              {
                column: "filename",
              },
            ],
          ),
        schema: programFileListSchema,
      },
      path: "/program-files",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          const existing = await getRecord(c.var.supabase, "program_file", id);
          const version = await getRecord(
            c.var.supabase,
            "program_version",
            existing.version_id,
          );
          if (version.published_at !== null) {
            throw new ApiError(
              409,
              `Program version '${version.id}' is published and read-only`,
            );
          }
          await deleteRecord(c.var.supabase, "program_file", id);

          return successResponse();
        },
      },
      get: {
        handler: (c, id) => getRecord(c.var.supabase, "program_file", id),
      },
      idParam: "programFileId",
      patch: {
        handler: async (c, id, body) => {
          const existing = await getRecord(c.var.supabase, "program_file", id);
          const version = await getRecord(
            c.var.supabase,
            "program_version",
            existing.version_id,
          );
          requireAnyDefined([
            body.content,
            body.filename,
            body.filetype,
            body.ownerProfileId,
          ]);

          if (version.published_at !== null) {
            throw new ApiError(
              409,
              `Program version '${version.id}' is published and read-only`,
            );
          }

          return updateRecord(c.var.supabase, "program_file", id, {
            content: body.content,
            filename: body.filename,
            filetype: body.filetype,
            owner_profile_id:
              (await validateOwnerProfileId(c.var.supabase, {
                authenticatedProfileId: c.var.auth?.profileId,
                ownerProfileId: body.ownerProfileId,
              })) ?? existing.owner_profile_id,
          });
        },
        schema: programFilePatchSchema,
      },
      path: "/program-files/:programFileId",
    },
  });

  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          const data = await createProgramFile(
            c,
            requiredParam(c, "programVersionId"),
            body,
          );

          return {
            data,
            location: `/program-files/${data.id}`,
          };
        },
        schema: programFileCreateSchema,
      },
      list: {
        handler: async (c) => {
          const programVersionId = requiredParam(c, "programVersionId");
          await getRecord(c.var.supabase, "program_version", programVersionId);

          return listRecordsFromQuery(
            c.var.supabase,
            "program_file",
            {
              versionId: programVersionId,
            },
            {
              versionId: "version_id",
            },
            [
              {
                column: "filename",
              },
            ],
          );
        },
      },
      path: "/program-versions/:programVersionId/files",
    },
  });
}
