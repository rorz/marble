import { ProgramSecretConfigSchema } from "@marble/core";
import type { Hono } from "hono";
import { z } from "zod";
import { type ApiEnv, mountResource, requireAnyDefined } from "../core";
import {
  createRecord,
  deleteRecord,
  deleteRecordsInColumn,
  getRecord,
  listRecordsFromQuery,
  successResponse,
  updateRecord,
} from "../data";
import {
  resolveOwnerProfileFilter,
  resolveOwnerProfileId,
  validateOwnerProfileId,
} from "./profile";
import {
  assertProgramVersionsNotInUse,
  createProgramVersionRecord,
  normalizeProgramVersionInput,
} from "./program_version";
import {
  jsonValueSchema,
  nonEmptyStringSchema,
  programFilePayloadSchema,
  requestObject,
  uuidSchema,
} from "./shared";

const initialProgramVersionSchema = requestObject({
  files: z.array(programFilePayloadSchema).optional(),
  inputSchema: jsonValueSchema.optional(),
  outputConfig: jsonValueSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  publish: z.boolean().optional(),
  secretConfig: ProgramSecretConfigSchema.optional(),
  version: z.number().int().positive().optional(),
});

const programListSchema = requestObject({
  ownerProfileId: uuidSchema.optional(),
});

const programCreateSchema = requestObject({
  code: z.string().optional(),
  codeFilename: nonEmptyStringSchema.optional(),
  files: z.array(programFilePayloadSchema).optional(),
  firstParty: z.boolean().optional(),
  forkedFromVersionId: uuidSchema.nullable().optional(),
  initialVersion: initialProgramVersionSchema.optional(),
  inputSchema: jsonValueSchema.optional(),
  name: nonEmptyStringSchema,
  outputConfig: jsonValueSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  secretConfig: ProgramSecretConfigSchema.optional(),
});

const programPatchSchema = requestObject({
  firstParty: z.boolean().optional(),
  forkedFromVersionId: uuidSchema.nullable().optional(),
  name: nonEmptyStringSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

function normalizeInitialProgramVersion(
  body: z.infer<typeof programCreateSchema>,
) {
  if (body.initialVersion) {
    return {
      input: normalizeProgramVersionInput(body.initialVersion),
      publish: body.initialVersion.publish,
    };
  }

  const files = [
    ...(body.files ?? []),
    ...(body.code === undefined
      ? []
      : [
          {
            content: body.code,
            filename: body.codeFilename ?? "index.js",
            filetype: "TypeScript" as const,
          },
        ]),
  ];

  if (
    body.inputSchema === undefined &&
    body.outputConfig === undefined &&
    files.length === 0
  ) {
    return null;
  }

  return {
    input: normalizeProgramVersionInput({
      files,
      inputSchema: body.inputSchema,
      outputConfig: body.outputConfig,
      ownerProfileId: body.ownerProfileId,
      secretConfig: body.secretConfig,
    }),
    publish: true,
  };
}

export function mountProgramResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          const ownerProfileId = await resolveOwnerProfileId(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            ownerProfileId: body.ownerProfileId,
          });
          const program = await createRecord(c.var.supabase, "program", {
            first_party: body.firstParty ?? false,
            forked_from_version_id: body.forkedFromVersionId ?? null,
            name: body.name,
            owner_profile_id: ownerProfileId,
          });

          const initialVersion = normalizeInitialProgramVersion(body);
          if (!initialVersion) {
            return {
              data: program,
              location: `/programs/${program.id}`,
            };
          }

          try {
            const version = await createProgramVersionRecord(
              c.var.supabase,
              program.id,
              initialVersion.input,
              {
                publish: initialVersion.publish,
              },
            );
            return {
              data: {
                ...program,
                initialVersion: version,
              },
              location: `/programs/${program.id}`,
            };
          } catch (createVersionError) {
            await deleteRecord(c.var.supabase, "program", program.id);
            throw createVersionError;
          }
        },
        schema: programCreateSchema,
      },
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "program",
            {
              ...query,
              ownerProfileId: resolveOwnerProfileFilter({
                authenticatedProfileId: c.var.auth?.profileId,
                ownerProfileId: query.ownerProfileId,
              }),
            },
            {
              ownerProfileId: "owner_profile_id",
            },
            [
              {
                column: "created_at",
              },
            ],
          ),
        schema: programListSchema,
      },
      path: "/programs",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await getRecord(c.var.supabase, "program", id);
          const versions = await listRecordsFromQuery(
            c.var.supabase,
            "program_version",
            {
              programId: id,
            },
            {
              programId: "program_id",
            },
          );
          const versionIds = versions.map((version) => version.id);

          await assertProgramVersionsNotInUse(c.var.supabase, versionIds);

          if (versionIds.length > 0) {
            await Promise.all([
              deleteRecordsInColumn(
                c.var.supabase,
                "program_file",
                "version_id",
                versionIds,
              ),
              deleteRecordsInColumn(
                c.var.supabase,
                "program_version",
                "id",
                versionIds,
              ),
            ]);
          }

          await deleteRecord(c.var.supabase, "program", id);

          return successResponse();
        },
      },
      get: {
        handler: (c, id) => getRecord(c.var.supabase, "program", id),
      },
      idParam: "programId",
      patch: {
        handler: async (c, id, body) => {
          const existing = await getRecord(c.var.supabase, "program", id);
          requireAnyDefined([
            body.firstParty,
            body.forkedFromVersionId,
            body.name,
            body.ownerProfileId,
          ]);

          if (body.forkedFromVersionId) {
            await getRecord(
              c.var.supabase,
              "program_version",
              body.forkedFromVersionId,
            );
          }

          return updateRecord(
            c.var.supabase,
            "program",
            id,
            {
              first_party: body.firstParty,
              forked_from_version_id: body.forkedFromVersionId,
              name: body.name,
              owner_profile_id: await validateOwnerProfileId(c.var.supabase, {
                authenticatedProfileId: c.var.auth?.profileId,
                ownerProfileId: body.ownerProfileId,
              }),
            },
            {
              before: existing,
            },
          );
        },
        schema: programPatchSchema,
      },
      path: "/programs/:programId",
    },
  });
}
