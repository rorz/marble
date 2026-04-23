import {
  ProgramSecretConfigSchema,
  parseProgramManifestFileContent,
  parseProgramSecretConfig,
  Schemas,
} from "@marble/core";
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
  publish: z.boolean().optional(),
  secretConfig: ProgramSecretConfigSchema.optional(),
  version: z.number().int().positive().optional(),
});

const programVersionPatchSchema = requestObject({
  files: z.array(programFilePayloadSchema).optional(),
  inputSchema: jsonValueSchema.optional(),
  outputConfig: jsonValueSchema.optional(),
  publish: z.boolean().optional(),
  secretConfig: ProgramSecretConfigSchema.optional(),
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
  secretConfig?: Json | null;
  version?: number;
};

async function nextProgramVersionNumber(
  supabase: SupabaseClient,
  programId: string,
) {
  const { data, error } = await supabase
    .from("program_version")
    .select("version")
    .eq("program_id", programId)
    .not("published_at", "is", null)
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

export async function listProgramVersionFiles(
  supabase: SupabaseClient,
  versionId: string,
) {
  return listRecordsFromQuery(
    supabase,
    "program_file",
    {
      versionId,
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
}

export async function getProgramVersionWithFiles(
  supabase: SupabaseClient,
  id: string,
) {
  const [version, files] = await Promise.all([
    getRecord(supabase, "program_version", id),
    listProgramVersionFiles(supabase, id),
  ]);

  return {
    ...version,
    files,
  };
}

export async function findProgramDraftVersion(
  supabase: SupabaseClient,
  programId: string,
) {
  const { data, error } = await supabase
    .from("program_version")
    .select("*")
    .eq("program_id", programId)
    .is("published_at", null)
    .order("updated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, error.message);
  }

  return data;
}

export async function findLatestPublishedProgramVersion(
  supabase: SupabaseClient,
  programId: string,
) {
  const { data, error } = await supabase
    .from("program_version")
    .select("*")
    .eq("program_id", programId)
    .not("published_at", "is", null)
    .order("published_at", {
      ascending: false,
    })
    .order("version", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, error.message);
  }

  return data;
}

export async function requirePublishedProgramVersion(
  supabase: SupabaseClient,
  programVersionId: string,
) {
  const version = await getRecord(
    supabase,
    "program_version",
    programVersionId,
  );

  if (version.published_at === null) {
    throw new ApiError(
      409,
      `Program version '${programVersionId}' is still a draft and cannot be used here`,
    );
  }

  return version;
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
  secretConfig?: unknown;
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

  const manifestFile = input.files?.find(
    (file) => file.filename === "package.json",
  );

  if (manifestFile) {
    try {
      parseProgramManifestFileContent(manifestFile.content);
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error
          ? `package.json is invalid: ${error.message}`
          : "package.json is invalid",
      );
    }
  }

  return {
    files: input.files ?? [],
    inputSchema: parsedInputSchema.data as Json,
    outputConfig: parsedOutputConfig.data as Json,
    ownerProfileId: input.ownerProfileId,
    secretConfig:
      input.secretConfig === undefined
        ? null
        : (parseProgramSecretConfig(input.secretConfig) as unknown as Json),
    version: input.version,
  } satisfies NormalizedProgramVersionInput;
}

function hasDuplicateProgramFilenames(
  files: NormalizedProgramVersionInput["files"],
) {
  return new Set(files.map((file) => file.filename)).size !== files.length;
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

  const latestVersion = await requireById(
    Promise.resolve({
      data: await findLatestPublishedProgramVersion(
        supabase,
        options.programId,
      ),
      error: null,
    }),
    "Published program version for program",
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
  options: {
    publish?: boolean;
  } = {},
) {
  if (hasDuplicateProgramFilenames(input.files)) {
    throw new ApiError(400, "Program files must have unique filenames");
  }

  const program = await getRecord(supabase, "program", programId);
  const shouldPublish = options.publish ?? true;
  const version = await createRecord(supabase, "program_version", {
    input_schema: input.inputSchema,
    output_config: input.outputConfig,
    program_id: programId,
    published_at: shouldPublish ? new Date().toISOString() : null,
    secret_config: input.secretConfig ?? null,
    version: shouldPublish
      ? (input.version ?? (await nextProgramVersionNumber(supabase, programId)))
      : null,
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
    {
      publish: body.publish,
    },
  );
}

async function syncProgramVersionFiles(
  supabase: SupabaseClient,
  version: DbRow<"program_version">,
  files: NormalizedProgramVersionInput["files"],
) {
  if (hasDuplicateProgramFilenames(files)) {
    throw new ApiError(400, "Program files must have unique filenames");
  }

  const [existingFiles, program] = await Promise.all([
    listProgramVersionFiles(supabase, version.id),
    getRecord(supabase, "program", version.program_id),
  ]);
  const existingByFilename = new Map(
    existingFiles.map((file) => [
      file.filename,
      file,
    ]),
  );
  const incomingFilenames = new Set(files.map((file) => file.filename));

  for (const existingFile of existingFiles) {
    if (!incomingFilenames.has(existingFile.filename)) {
      await deleteRecord(supabase, "program_file", existingFile.id);
    }
  }

  for (const file of files) {
    const existingFile = existingByFilename.get(file.filename);

    if (!existingFile) {
      await createRecord(supabase, "program_file", {
        content: file.content,
        filename: file.filename,
        filetype: file.filetype,
        owner_profile_id: file.ownerProfileId ?? program.owner_profile_id,
        version_id: version.id,
      });
      continue;
    }

    if (
      existingFile.content !== file.content ||
      existingFile.filetype !== file.filetype
    ) {
      await updateRecord(supabase, "program_file", existingFile.id, {
        content: file.content,
        filetype: file.filetype,
        owner_profile_id: file.ownerProfileId ?? existingFile.owner_profile_id,
      });
    }
  }
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
          const existing = await getRecord(
            c.var.supabase,
            "program_version",
            id,
          );
          requireAnyDefined([
            body.files,
            body.inputSchema,
            body.outputConfig,
            body.publish,
            body.secretConfig,
            body.version,
          ]);

          if (existing.published_at !== null) {
            throw new ApiError(
              409,
              `Program version '${id}' is published and read-only`,
            );
          }

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

          if (body.secretConfig !== undefined) {
            updates.secret_config = parseProgramSecretConfig(
              body.secretConfig,
            ) as unknown as Json;
          }

          if (body.publish) {
            updates.published_at = new Date().toISOString();
            updates.version =
              body.version ??
              updates.version ??
              (await nextProgramVersionNumber(
                c.var.supabase,
                existing.program_id,
              ));
          }

          if (body.files) {
            await syncProgramVersionFiles(
              c.var.supabase,
              existing,
              normalizeProgramVersionInput({
                files: body.files,
                inputSchema:
                  body.inputSchema === undefined
                    ? existing.input_schema
                    : body.inputSchema,
                outputConfig:
                  body.outputConfig === undefined
                    ? existing.output_config
                    : body.outputConfig,
                secretConfig:
                  body.secretConfig === undefined
                    ? existing.secret_config
                    : body.secretConfig,
              }).files,
            );
          }

          if (Object.keys(updates).length > 0) {
            await updateRecord(c.var.supabase, "program_version", id, updates);
          }

          return getProgramVersionWithFiles(c.var.supabase, id);
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
