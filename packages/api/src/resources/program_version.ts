import { Schemas } from "@marble/core";
import type { Json, SupabaseClient } from "@marble/supabase";
import type { Hono } from "hono";
import { z } from "zod";
import {
  type ApiContext,
  type ApiEnv,
  ApiError,
  mountResource,
  requireAnyDefined,
  requireById,
  requiredParam,
  zodError,
} from "../core";
import {
  createRecord,
  createRecords,
  type DbRow,
  type DbUpdate,
  deleteRecord,
  deleteRecordsByColumn,
  getRecord,
  listRecordsFromQuery,
  successResponse,
  updateRecord,
} from "../data";
import {
  jsonValueSchema,
  programFilePayloadSchema,
  requestObject,
  uuidSchema,
} from "./shared";

const programVersionListSchema = requestObject({
  programId: uuidSchema.optional(),
});

const programVersionCreateSchema = requestObject({
  files: z.array(programFilePayloadSchema).optional(),
  inputSchema: jsonValueSchema,
  outputConfig: jsonValueSchema,
  ownerProfileId: uuidSchema.optional(),
  programId: uuidSchema.optional(),
  version: z.number().int().positive().optional(),
});

const programVersionPatchSchema = requestObject({
  inputSchema: jsonValueSchema.optional(),
  outputConfig: jsonValueSchema.optional(),
  version: z.number().int().positive().optional(),
});

type NormalizedProgramVersionInput = {
  files: Array<{
    content: string;
    filename: string;
    filetype: "Json" | "Markdown" | "TypeScript";
    ownerProfileId?: string;
  }>;
  inputSchema: Json;
  outputConfig: Json;
  ownerProfileId?: string;
  version?: number;
};

async function nextProgramVersionNumber(
  supabase: SupabaseClient,
  programId: string,
) {
  const { data, error } = await supabase
    .from("program_version")
    .select("*")
    .eq("program_id", programId)
    .order("version", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, error.message);
  }

  return (data?.version ?? 0) + 1;
}

export function normalizeProgramVersionInput(input: {
  files?: Array<{
    content: string;
    filename: string;
    filetype: "Json" | "Markdown" | "TypeScript";
    ownerProfileId?: string;
  }>;
  inputSchema?: unknown;
  outputConfig?: unknown;
  ownerProfileId?: string;
  version?: number;
}) {
  if (input.inputSchema === undefined) {
    throw new ApiError(400, "inputSchema is required");
  }

  if (input.outputConfig === undefined) {
    throw new ApiError(400, "outputConfig is required");
  }

  const parsedInputSchema = Schemas.ProgramInputSchema.safeParse(
    input.inputSchema,
  );
  if (!parsedInputSchema.success) {
    throw zodError(parsedInputSchema.error);
  }

  const parsedOutputConfig = Schemas.ProgramOutputConfig.safeParse(
    input.outputConfig,
  );
  if (!parsedOutputConfig.success) {
    throw zodError(parsedOutputConfig.error);
  }

  return {
    files: input.files ?? [],
    inputSchema: parsedInputSchema.data as Json,
    outputConfig: parsedOutputConfig.data as Json,
    ownerProfileId: input.ownerProfileId,
    version: input.version,
  } satisfies NormalizedProgramVersionInput;
}

export async function resolveProgramVersionId(
  supabase: SupabaseClient,
  options: {
    programId?: string;
    programVersionId?: string;
  },
) {
  if (options.programVersionId) {
    return getRecord(
      supabase,
      "program_version",
      options.programVersionId,
    ).then((version) => version.id);
  }

  if (!options.programId) {
    throw new ApiError(
      400,
      "programVersionId or programId is required for this operation",
    );
  }

  const directVersionLookup = await supabase
    .from("program_version")
    .select("*")
    .eq("id", options.programId)
    .maybeSingle();

  if (directVersionLookup.error) {
    throw new ApiError(500, directVersionLookup.error.message);
  }

  if (directVersionLookup.data) {
    return directVersionLookup.data.id;
  }

  await getRecord(supabase, "program", options.programId);

  const latestVersion = await requireById<DbRow<"program_version">>(
    supabase
      .from("program_version")
      .select("*")
      .eq("program_id", options.programId)
      .order("version", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),
    "Program version for program",
    options.programId,
  );

  return latestVersion.id;
}

export async function assertProgramVersionsNotInUse(
  supabase: SupabaseClient,
  versionIds: string[],
) {
  if (versionIds.length === 0) {
    return;
  }

  const [columnRef, runRef, forkRef] = await Promise.all([
    supabase
      .from("column")
      .select("*")
      .in("program_version_id", versionIds)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("program_run")
      .select("*")
      .in("program_version_id", versionIds)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("program")
      .select("*")
      .in("forked_from_version_id", versionIds)
      .limit(1)
      .maybeSingle(),
  ]);

  if (columnRef.error) {
    throw new ApiError(500, columnRef.error.message);
  }

  if (runRef.error) {
    throw new ApiError(500, runRef.error.message);
  }

  if (forkRef.error) {
    throw new ApiError(500, forkRef.error.message);
  }

  if (columnRef.data) {
    throw new ApiError(
      409,
      `Program version '${columnRef.data.program_version_id}' is still referenced by column '${columnRef.data.id}'`,
    );
  }

  if (runRef.data) {
    throw new ApiError(
      409,
      `Program version '${runRef.data.program_version_id}' is still referenced by program run '${runRef.data.id}'`,
    );
  }

  if (forkRef.data?.forked_from_version_id) {
    throw new ApiError(
      409,
      `Program version '${forkRef.data.forked_from_version_id}' is still referenced as a fork source by program '${forkRef.data.id}'`,
    );
  }
}

export async function createProgramVersionRecord(
  supabase: SupabaseClient,
  programId: string,
  input: NormalizedProgramVersionInput,
) {
  const program = await getRecord(supabase, "program", programId);
  const version = await createRecord(supabase, "program_version", {
    input_schema: input.inputSchema,
    output_config: input.outputConfig,
    program_id: programId,
    version:
      input.version ?? (await nextProgramVersionNumber(supabase, programId)),
  });

  const fallbackOwnerProfileId =
    input.ownerProfileId ?? program.owner_profile_id;
  const filesToInsert = input.files.map((file) => ({
    content: file.content,
    filename: file.filename,
    filetype: file.filetype,
    owner_profile_id: file.ownerProfileId ?? fallbackOwnerProfileId,
    version_id: version.id,
  }));

  try {
    const files = await createRecords(supabase, "program_file", filesToInsert);
    return {
      ...version,
      files,
    };
  } catch (error) {
    await deleteRecord(supabase, "program_version", version.id);
    throw error;
  }
}

function createProgramVersionFromBody(
  c: ApiContext,
  programId: string,
  body: z.infer<typeof programVersionCreateSchema>,
) {
  return createProgramVersionRecord(
    c.var.supabase,
    programId,
    normalizeProgramVersionInput(body),
  );
}

export function mountProgramVersionResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          if (!body.programId) {
            throw new ApiError(400, "programId is required");
          }

          const version = await createProgramVersionFromBody(
            c,
            body.programId,
            body,
          );
          return {
            data: version,
            location: `/program-versions/${version.id}`,
          };
        },
        schema: programVersionCreateSchema,
      },
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "program_version",
            query,
            {
              programId: "program_id",
            },
            [
              {
                column: "program_id",
              },
              {
                column: "version",
              },
            ],
          ),
        schema: programVersionListSchema,
      },
      path: "/program-versions",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await getRecord(c.var.supabase, "program_version", id);
          await assertProgramVersionsNotInUse(c.var.supabase, [
            id,
          ]);

          await Promise.all([
            deleteRecordsByColumn(
              c.var.supabase,
              "program_file",
              "version_id",
              id,
            ),
            deleteRecord(c.var.supabase, "program_version", id),
          ]);

          return successResponse();
        },
      },
      get: {
        handler: (c, id) => getRecord(c.var.supabase, "program_version", id),
      },
      idParam: "programVersionId",
      patch: {
        handler: async (c, id, body) => {
          await getRecord(c.var.supabase, "program_version", id);
          requireAnyDefined([
            body.inputSchema,
            body.outputConfig,
            body.version,
          ]);

          const updates: DbUpdate<"program_version"> = {};

          if (body.inputSchema !== undefined) {
            const parsedInputSchema = Schemas.ProgramInputSchema.safeParse(
              body.inputSchema,
            );
            if (!parsedInputSchema.success) {
              throw new ApiError(
                400,
                "Invalid request",
                parsedInputSchema.error.issues,
              );
            }
            updates.input_schema = parsedInputSchema.data as Json;
          }

          if (body.outputConfig !== undefined) {
            const parsedOutputConfig = Schemas.ProgramOutputConfig.safeParse(
              body.outputConfig,
            );
            if (!parsedOutputConfig.success) {
              throw new ApiError(
                400,
                "Invalid request",
                parsedOutputConfig.error.issues,
              );
            }
            updates.output_config = parsedOutputConfig.data as Json;
          }

          if (body.version !== undefined) {
            updates.version = body.version;
          }

          return updateRecord(c.var.supabase, "program_version", id, updates);
        },
        schema: programVersionPatchSchema,
      },
      path: "/program-versions/:programVersionId",
    },
  });

  mountResource(app, {
    collection: {
      create: {
        handler: (c, body) =>
          createProgramVersionFromBody(
            c,
            requiredParam(c, "programId"),
            body,
          ).then((version) => ({
            data: version,
            location: `/program-versions/${version.id}`,
          })),
        schema: programVersionCreateSchema,
      },
      list: {
        handler: async (c) => {
          const programId = requiredParam(c, "programId");
          await getRecord(c.var.supabase, "program", programId);

          return listRecordsFromQuery(
            c.var.supabase,
            "program_version",
            {
              programId,
            },
            {
              programId: "program_id",
            },
            [
              {
                column: "version",
              },
            ],
          );
        },
      },
      path: "/programs/:programId/versions",
    },
  });
}
