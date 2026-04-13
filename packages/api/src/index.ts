import { Schemas } from "@marble/core";
import {
  createClient,
  type Database,
  type Json,
  type SupabaseClient,
} from "@marble/supabase";
import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { getEnv } from "./env";

export type ApiEnv = {
  Bindings: {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    MARBLE_EXECUTOR_URL?: string;
  };
  Variables: {
    supabase: SupabaseClient;
  };
};

type ApiContext = Context<ApiEnv>;

type CellInsert = Database["public"]["Tables"]["cell"]["Insert"];
type CellRow = Database["public"]["Tables"]["cell"]["Row"];
type ColumnRow = Database["public"]["Tables"]["column"]["Row"];
type ColumnDependencyRow =
  Database["public"]["Tables"]["column_dependency"]["Row"];
type EventRow = Database["public"]["Tables"]["event"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profile"]["Row"];
type ProgramFileRow = Database["public"]["Tables"]["program_file"]["Row"];
type ProgramRow = Database["public"]["Tables"]["program"]["Row"];
type ProgramRunRow = Database["public"]["Tables"]["program_run"]["Row"];
type ProgramVersionRow = Database["public"]["Tables"]["program_version"]["Row"];
type RowTableRow = Database["public"]["Tables"]["row"]["Row"];
type TableRow = Database["public"]["Tables"]["table"]["Row"];

class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const app = new Hono<ApiEnv>();

const uuidSchema = z.string().uuid();
const jsonValueSchema = z.json();
const profileTypeSchema = z.enum([
  "Human",
  "Agent",
]);
const programFileTypeSchema = z.enum([
  "TypeScript",
  "Json",
  "Markdown",
]);
const dataOperationSchema = z.enum([
  "Create",
  "Read",
  "Update",
  "Delete",
]);

const profileListQuerySchema = z.object({
  owner_user_id: uuidSchema.optional(),
  ownerUserId: uuidSchema.optional(),
  type: profileTypeSchema.optional(),
});

const profileUpdateBodySchema = z.object({
  external_name: z.string().trim().min(1).nullable().optional(),
  externalName: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1).optional(),
  type: profileTypeSchema.optional(),
});

const eventListQuerySchema = z.object({
  entity_id: uuidSchema.optional(),
  entityId: uuidSchema.optional(),
  operation: dataOperationSchema.optional(),
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  resource: z.string().trim().min(1).optional(),
});

const tableListQuerySchema = z.object({
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

const tableCreateBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

const tableUpdateBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

const columnListQuerySchema = z.object({
  program_id: uuidSchema.optional(),
  programId: uuidSchema.optional(),
  program_version_id: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
  table_id: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const columnCreateBodySchema = z.object({
  idx: z.number().int().nonnegative().optional(),
  input_template: z.string().optional(),
  inputTemplate: z.string().optional(),
  name: z.string().trim().min(1),
  output_schema: jsonValueSchema.optional(),
  outputSchema: jsonValueSchema.optional(),
  program_id: uuidSchema.optional(),
  programId: uuidSchema.optional(),
  program_version_id: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
  table_id: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const columnUpdateBodySchema = z.object({
  idx: z.number().int().nonnegative().optional(),
  input_template: z.string().optional(),
  inputTemplate: z.string().optional(),
  name: z.string().trim().min(1).optional(),
  output_schema: jsonValueSchema.optional(),
  outputSchema: jsonValueSchema.optional(),
  program_id: uuidSchema.optional(),
  programId: uuidSchema.optional(),
  program_version_id: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
});

const columnDependencyListQuerySchema = z.object({
  source_column_id: uuidSchema.optional(),
  sourceColumnId: uuidSchema.optional(),
  table_id: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
  target_column_id: uuidSchema.optional(),
  targetColumnId: uuidSchema.optional(),
});

const rowListQuerySchema = z.object({
  table_id: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const rowCreateBodySchema = z.object({
  count: z.number().int().positive().optional(),
  idx: z.number().int().nonnegative().optional(),
  table_id: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const rowUpdateBodySchema = z.object({
  idx: z.number().int().nonnegative().optional(),
});

const cellListQuerySchema = z.object({
  column_id: uuidSchema.optional(),
  columnId: uuidSchema.optional(),
  row_id: uuidSchema.optional(),
  rowId: uuidSchema.optional(),
  table_id: uuidSchema.optional(),
  tableId: uuidSchema.optional(),
});

const cellUpdateBodySchema = z.object({
  manual_input: z.string().nullable().optional(),
  manualInput: z.string().nullable().optional(),
  state: jsonValueSchema.optional(),
});

const programFilePayloadSchema = z.object({
  content: z.string(),
  filename: z.string().trim().min(1),
  filetype: programFileTypeSchema,
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

const initialProgramVersionBodySchema = z.object({
  files: z.array(programFilePayloadSchema).optional(),
  input_schema: jsonValueSchema.optional(),
  inputSchema: jsonValueSchema.optional(),
  output_config: jsonValueSchema.optional(),
  outputConfig: jsonValueSchema.optional(),
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  version: z.number().int().positive().optional(),
});

const programListQuerySchema = z.object({
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

const programCreateBodySchema = z.object({
  code: z.string().optional(),
  codeFilename: z.string().trim().min(1).optional(),
  files: z.array(programFilePayloadSchema).optional(),
  first_party: z.boolean().optional(),
  firstParty: z.boolean().optional(),
  forked_from_version_id: uuidSchema.nullable().optional(),
  forkedFromVersionId: uuidSchema.nullable().optional(),
  initial_version: initialProgramVersionBodySchema.optional(),
  initialVersion: initialProgramVersionBodySchema.optional(),
  input_schema: jsonValueSchema.optional(),
  inputSchema: jsonValueSchema.optional(),
  name: z.string().trim().min(1),
  output_config: jsonValueSchema.optional(),
  outputConfig: jsonValueSchema.optional(),
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

const programUpdateBodySchema = z.object({
  first_party: z.boolean().optional(),
  firstParty: z.boolean().optional(),
  forked_from_version_id: uuidSchema.nullable().optional(),
  forkedFromVersionId: uuidSchema.nullable().optional(),
  name: z.string().trim().min(1).optional(),
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

const programVersionListQuerySchema = z.object({
  program_id: uuidSchema.optional(),
  programId: uuidSchema.optional(),
});

const programVersionCreateBodySchema = z.object({
  files: z.array(programFilePayloadSchema).optional(),
  input_schema: jsonValueSchema.optional(),
  inputSchema: jsonValueSchema.optional(),
  output_config: jsonValueSchema.optional(),
  outputConfig: jsonValueSchema.optional(),
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  program_id: uuidSchema.optional(),
  programId: uuidSchema.optional(),
  version: z.number().int().positive().optional(),
});

const programVersionUpdateBodySchema = z.object({
  input_schema: jsonValueSchema.optional(),
  inputSchema: jsonValueSchema.optional(),
  output_config: jsonValueSchema.optional(),
  outputConfig: jsonValueSchema.optional(),
  version: z.number().int().positive().optional(),
});

const programFileListQuerySchema = z.object({
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  version_id: uuidSchema.optional(),
  versionId: uuidSchema.optional(),
});

const programFileCreateBodySchema = z.object({
  content: z.string(),
  filename: z.string().trim().min(1),
  filetype: programFileTypeSchema,
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
  version_id: uuidSchema.optional(),
  versionId: uuidSchema.optional(),
});

const programFileUpdateBodySchema = z.object({
  content: z.string().optional(),
  filename: z.string().trim().min(1).optional(),
  filetype: programFileTypeSchema.optional(),
  owner_profile_id: uuidSchema.optional(),
  ownerProfileId: uuidSchema.optional(),
});

const programRunListQuerySchema = z.object({
  program_version_id: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
  target_cell_id: uuidSchema.optional(),
  targetCellId: uuidSchema.optional(),
});

const programRunCreateBodySchema = z.object({
  input: jsonValueSchema.optional(),
  output: jsonValueSchema.optional(),
  program_id: uuidSchema.optional(),
  programId: uuidSchema.optional(),
  program_version_id: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
  target_cell_id: uuidSchema.optional(),
  targetCellId: uuidSchema.optional(),
});

const programRunUpdateBodySchema = z.object({
  input: jsonValueSchema.optional(),
  output: jsonValueSchema.optional(),
  program_id: uuidSchema.optional(),
  programId: uuidSchema.optional(),
  program_version_id: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
  target_cell_id: uuidSchema.optional(),
  targetCellId: uuidSchema.optional(),
});

function route(
  handler: (c: ApiContext) => Promise<Response>,
): (c: ApiContext) => Promise<Response> {
  return async (c) => {
    try {
      return await handler(c);
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(
              500,
              error instanceof Error ? error.message : String(error),
            );

      return Response.json(
        {
          error: apiError.message,
          ...(apiError.details === undefined
            ? {}
            : {
                details: apiError.details,
              }),
        },
        {
          status: apiError.status as ContentfulStatusCode,
        },
      );
    }
  };
}

function created(c: ApiContext, location: string, data: unknown) {
  c.header("Location", location);
  return c.json(data, {
    status: 201,
  });
}

function zodError(error: z.ZodError) {
  return new ApiError(
    400,
    "Invalid request",
    error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.join("."),
    })),
  );
}

async function readJsonBody(c: ApiContext): Promise<unknown> {
  const text = await c.req.text();
  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
}

async function parseJsonBody<T extends z.ZodTypeAny>(
  c: ApiContext,
  schema: T,
): Promise<z.infer<T>> {
  const body = await readJsonBody(c);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw zodError(parsed.error);
  }

  return parsed.data;
}

function parseQuery<T extends z.ZodTypeAny>(
  c: ApiContext,
  schema: T,
): z.infer<T> {
  const parsed = schema.safeParse(c.req.query());

  if (!parsed.success) {
    throw zodError(parsed.error);
  }

  return parsed.data;
}

function requiredParam(c: ApiContext, key: string) {
  const value = c.req.param(key);

  if (value === undefined) {
    throw new ApiError(400, `Missing path parameter '${key}'`);
  }

  return value;
}

function requiredValue(value: string | undefined, key: string) {
  if (value === undefined) {
    throw new ApiError(400, `Missing value '${key}'`);
  }

  return value;
}

function hasAnyDefined(values: unknown[]) {
  return values.some((value) => value !== undefined);
}

function requireAnyDefined(
  values: unknown[],
  message = "Request body must include at least one updatable field",
) {
  if (!hasAnyDefined(values)) {
    throw new ApiError(400, message);
  }
}

async function requireById<T>(
  query: PromiseLike<{
    data: T | null;
    error: {
      message: string;
    } | null;
  }>,
  resourceName: string,
  id: string,
): Promise<T> {
  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, error.message);
  }

  if (!data) {
    throw new ApiError(404, `${resourceName} '${id}' was not found`);
  }

  return data;
}

function resolveBaseOutputSchema(programVersion: ProgramVersionRow) {
  const parsed = Schemas.ProgramOutputConfig.safeParse(
    programVersion.output_config,
  );

  if (!parsed.success) {
    return {};
  }

  return parsed.data.schema;
}

function extractDependenciesFromTemplate(template: string) {
  const sourceColumnIds = new Set<string>();
  let parsedTemplate: unknown;

  try {
    parsedTemplate = JSON.parse(template);
  } catch {
    return [];
  }

  const jsonPathPattern = /^\$\.columns\.([a-f0-9-]+)\./;
  const interpolationPattern = /\{\{\$\.columns\.([a-f0-9-]+)\.[^}]+\}\}/g;

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      const matches = [
        ...value.matchAll(interpolationPattern),
      ];

      for (const match of matches) {
        sourceColumnIds.add(match[1]);
      }

      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        if (
          key === "$marble_ref" &&
          Array.isArray(entry) &&
          entry[0] === "columns"
        ) {
          sourceColumnIds.add(String(entry[1]));
        } else if (key.endsWith(".$") && typeof entry === "string") {
          const match = entry.match(jsonPathPattern);
          if (match) {
            sourceColumnIds.add(match[1]);
          }
        }

        visit(entry);
      }
    }
  };

  visit(parsedTemplate);
  return Array.from(sourceColumnIds);
}

async function createCells(
  supabase: SupabaseClient,
  cells: CellInsert[],
): Promise<CellRow[]> {
  if (cells.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from("cell").insert(cells).select("*");

  if (error) {
    throw new ApiError(500, error.message);
  }

  return data ?? [];
}

async function getProfile(
  supabase: SupabaseClient,
  profileId: string | undefined,
): Promise<ProfileRow> {
  const resolvedProfileId = requiredValue(profileId, "profileId");

  return requireById<ProfileRow>(
    supabase
      .from("profile")
      .select("*")
      .eq("id", resolvedProfileId)
      .maybeSingle(),
    "Profile",
    resolvedProfileId,
  );
}

async function getTable(
  supabase: SupabaseClient,
  tableId: string | undefined,
): Promise<TableRow> {
  const resolvedTableId = requiredValue(tableId, "tableId");

  return requireById<TableRow>(
    supabase.from("table").select("*").eq("id", resolvedTableId).maybeSingle(),
    "Table",
    resolvedTableId,
  );
}

async function getColumn(
  supabase: SupabaseClient,
  columnId: string | undefined,
): Promise<ColumnRow> {
  const resolvedColumnId = requiredValue(columnId, "columnId");

  return requireById<ColumnRow>(
    supabase
      .from("column")
      .select("*")
      .eq("id", resolvedColumnId)
      .maybeSingle(),
    "Column",
    resolvedColumnId,
  );
}

async function getRow(
  supabase: SupabaseClient,
  rowId: string | undefined,
): Promise<RowTableRow> {
  const resolvedRowId = requiredValue(rowId, "rowId");

  return requireById<RowTableRow>(
    supabase.from("row").select("*").eq("id", resolvedRowId).maybeSingle(),
    "Row",
    resolvedRowId,
  );
}

async function getCell(
  supabase: SupabaseClient,
  cellId: string | undefined,
): Promise<
  CellRow & {
    program_run: ProgramRunRow[] | null;
  }
> {
  const resolvedCellId = requiredValue(cellId, "cellId");

  return requireById<
    CellRow & {
      program_run: ProgramRunRow[] | null;
    }
  >(
    supabase
      .from("cell")
      .select("*, program_run(*)")
      .eq("id", resolvedCellId)
      .maybeSingle(),
    "Cell",
    resolvedCellId,
  );
}

async function getProgram(
  supabase: SupabaseClient,
  programId: string | undefined,
): Promise<ProgramRow> {
  const resolvedProgramId = requiredValue(programId, "programId");

  return requireById<ProgramRow>(
    supabase
      .from("program")
      .select("*")
      .eq("id", resolvedProgramId)
      .maybeSingle(),
    "Program",
    resolvedProgramId,
  );
}

async function getProgramVersion(
  supabase: SupabaseClient,
  programVersionId: string | undefined,
): Promise<ProgramVersionRow> {
  const resolvedProgramVersionId = requiredValue(
    programVersionId,
    "programVersionId",
  );

  return requireById<ProgramVersionRow>(
    supabase
      .from("program_version")
      .select("*")
      .eq("id", resolvedProgramVersionId)
      .maybeSingle(),
    "Program version",
    resolvedProgramVersionId,
  );
}

async function getProgramFile(
  supabase: SupabaseClient,
  programFileId: string | undefined,
): Promise<ProgramFileRow> {
  const resolvedProgramFileId = requiredValue(programFileId, "programFileId");

  return requireById<ProgramFileRow>(
    supabase
      .from("program_file")
      .select("*")
      .eq("id", resolvedProgramFileId)
      .maybeSingle(),
    "Program file",
    resolvedProgramFileId,
  );
}

async function getProgramRun(
  supabase: SupabaseClient,
  runId: string | undefined,
): Promise<ProgramRunRow> {
  const resolvedRunId = requiredValue(runId, "runId");

  return requireById<ProgramRunRow>(
    supabase
      .from("program_run")
      .select("*")
      .eq("id", resolvedRunId)
      .maybeSingle(),
    "Program run",
    resolvedRunId,
  );
}

async function getColumnDependency(
  supabase: SupabaseClient,
  dependencyId: string | undefined,
): Promise<ColumnDependencyRow> {
  const resolvedDependencyId = requiredValue(dependencyId, "dependencyId");

  return requireById<ColumnDependencyRow>(
    supabase
      .from("column_dependency")
      .select("*")
      .eq("id", resolvedDependencyId)
      .maybeSingle(),
    "Column dependency",
    resolvedDependencyId,
  );
}

async function getEvent(
  supabase: SupabaseClient,
  eventId: string | undefined,
): Promise<EventRow> {
  const resolvedEventId = requiredValue(eventId, "eventId");

  return requireById<EventRow>(
    supabase.from("event").select("*").eq("id", resolvedEventId).maybeSingle(),
    "Event",
    resolvedEventId,
  );
}

async function resolveOwnerProfileId(
  supabase: SupabaseClient,
  ownerProfileId?: string,
) {
  if (ownerProfileId) {
    await getProfile(supabase, ownerProfileId);
    return ownerProfileId;
  }

  const { data, error } = await supabase
    .from("profile")
    .select("id")
    .order("created_at", {
      ascending: true,
    })
    .limit(2);

  if (error) {
    throw new ApiError(500, error.message);
  }

  if (!data || data.length === 0) {
    throw new ApiError(
      400,
      "No profiles exist. Provide owner_profile_id explicitly.",
    );
  }

  if (data.length > 1) {
    throw new ApiError(
      400,
      "Multiple profiles exist. Provide owner_profile_id explicitly.",
    );
  }

  return data[0].id;
}

async function nextIndex(
  supabase: SupabaseClient,
  tableName: "column" | "row",
  tableId: string,
) {
  const { data, error } = await supabase
    .from(tableName)
    .select("idx")
    .eq("table_id", tableId)
    .order("idx", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, error.message);
  }

  return (data?.idx ?? -1) + 1;
}

async function resolveProgramVersionId(
  supabase: SupabaseClient,
  options: {
    program_id?: string;
    program_version_id?: string;
  },
) {
  if (options.program_version_id) {
    const directVersion = await getProgramVersion(
      supabase,
      options.program_version_id,
    );
    return directVersion.id;
  }

  if (!options.program_id) {
    throw new ApiError(
      400,
      "program_version_id or program_id is required for this operation",
    );
  }

  const directVersionLookup = await supabase
    .from("program_version")
    .select("*")
    .eq("id", options.program_id)
    .maybeSingle();

  if (directVersionLookup.error) {
    throw new ApiError(500, directVersionLookup.error.message);
  }

  if (directVersionLookup.data) {
    return directVersionLookup.data.id;
  }

  await getProgram(supabase, options.program_id);

  const latestVersion = await requireById<ProgramVersionRow>(
    supabase
      .from("program_version")
      .select("*")
      .eq("program_id", options.program_id)
      .order("version", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),
    "Program version for program",
    options.program_id,
  );

  return latestVersion.id;
}

async function replaceColumnDependencies(
  supabase: SupabaseClient,
  columnId: string,
  inputTemplate: string,
) {
  const { error: deleteError } = await supabase
    .from("column_dependency")
    .delete()
    .eq("target_column_id", columnId);

  if (deleteError) {
    throw new ApiError(500, deleteError.message);
  }

  const sourceColumnIds = extractDependenciesFromTemplate(inputTemplate);

  if (sourceColumnIds.length === 0) {
    return [] as ColumnDependencyRow[];
  }

  const { data, error } = await supabase
    .from("column_dependency")
    .insert(
      sourceColumnIds.map((sourceColumnId) => ({
        source_column_id: sourceColumnId,
        target_column_id: columnId,
      })),
    )
    .select("*");

  if (error) {
    throw new ApiError(500, error.message);
  }

  return data ?? [];
}

async function deleteProgramRunsForCellIds(
  supabase: SupabaseClient,
  cellIds: string[],
) {
  if (cellIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("program_run")
    .delete()
    .in("target_cell_id", cellIds);

  if (error) {
    throw new ApiError(500, error.message);
  }
}

async function deleteColumnDependenciesForColumnIds(
  supabase: SupabaseClient,
  columnIds: string[],
) {
  if (columnIds.length === 0) {
    return;
  }

  const [sourceDelete, targetDelete] = await Promise.all([
    supabase
      .from("column_dependency")
      .delete()
      .in("source_column_id", columnIds),
    supabase
      .from("column_dependency")
      .delete()
      .in("target_column_id", columnIds),
  ]);

  if (sourceDelete.error) {
    throw new ApiError(500, sourceDelete.error.message);
  }

  if (targetDelete.error) {
    throw new ApiError(500, targetDelete.error.message);
  }
}

async function deleteTableCascade(supabase: SupabaseClient, tableId: string) {
  await getTable(supabase, tableId);

  const [columnsResult, rowsResult] = await Promise.all([
    supabase.from("column").select("id").eq("table_id", tableId),
    supabase.from("row").select("id").eq("table_id", tableId),
  ]);

  if (columnsResult.error) {
    throw new ApiError(500, columnsResult.error.message);
  }

  if (rowsResult.error) {
    throw new ApiError(500, rowsResult.error.message);
  }

  const columnIds = (columnsResult.data ?? []).map((column) => column.id);
  const rowIds = (rowsResult.data ?? []).map((row) => row.id);

  let cellIds: string[] = [];

  if (rowIds.length > 0) {
    const cellResult = await supabase
      .from("cell")
      .select("id")
      .in("row_id", rowIds);

    if (cellResult.error) {
      throw new ApiError(500, cellResult.error.message);
    }

    cellIds = (cellResult.data ?? []).map((cell) => cell.id);
  }

  await deleteProgramRunsForCellIds(supabase, cellIds);
  await deleteColumnDependenciesForColumnIds(supabase, columnIds);

  if (rowIds.length > 0) {
    const { error } = await supabase.from("cell").delete().in("row_id", rowIds);

    if (error) {
      throw new ApiError(500, error.message);
    }
  }

  if (columnIds.length > 0) {
    const { error } = await supabase
      .from("column")
      .delete()
      .in("id", columnIds);

    if (error) {
      throw new ApiError(500, error.message);
    }
  }

  if (rowIds.length > 0) {
    const { error } = await supabase.from("row").delete().in("id", rowIds);

    if (error) {
      throw new ApiError(500, error.message);
    }
  }

  const { error } = await supabase.from("table").delete().eq("id", tableId);

  if (error) {
    throw new ApiError(500, error.message);
  }
}

async function assertProgramVersionsNotInUse(
  supabase: SupabaseClient,
  versionIds: string[],
) {
  if (versionIds.length === 0) {
    return;
  }

  const [columnRef, runRef, forkRef] = await Promise.all([
    supabase
      .from("column")
      .select("id, program_version_id")
      .in("program_version_id", versionIds)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("program_run")
      .select("id, program_version_id")
      .in("program_version_id", versionIds)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("program")
      .select("id, forked_from_version_id")
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

function normalizeProgramVersionInput(input: {
  files?: Array<{
    content: string;
    filename: string;
    filetype: "Json" | "Markdown" | "TypeScript";
    owner_profile_id?: string;
    ownerProfileId?: string;
  }>;
  input_schema?: unknown;
  inputSchema?: unknown;
  output_config?: unknown;
  outputConfig?: unknown;
  owner_profile_id?: string;
  ownerProfileId?: string;
  version?: number;
}): NormalizedProgramVersionInput {
  const inputSchema = input.input_schema ?? input.inputSchema;
  const outputConfig = input.output_config ?? input.outputConfig;

  if (inputSchema === undefined) {
    throw new ApiError(400, "input_schema is required");
  }

  if (outputConfig === undefined) {
    throw new ApiError(400, "output_config is required");
  }

  const parsedInputSchema = Schemas.ProgramInputSchema.safeParse(inputSchema);
  if (!parsedInputSchema.success) {
    throw zodError(parsedInputSchema.error);
  }

  const parsedOutputConfig =
    Schemas.ProgramOutputConfig.safeParse(outputConfig);
  if (!parsedOutputConfig.success) {
    throw zodError(parsedOutputConfig.error);
  }

  return {
    files: (input.files ?? []).map((file) => ({
      content: file.content,
      filename: file.filename,
      filetype: file.filetype,
      ownerProfileId: file.owner_profile_id ?? file.ownerProfileId,
    })),
    inputSchema: parsedInputSchema.data as Json,
    outputConfig: parsedOutputConfig.data as Json,
    ownerProfileId: input.owner_profile_id ?? input.ownerProfileId,
    version: input.version,
  };
}

function normalizeInitialProgramVersion(
  body: z.infer<typeof programCreateBodySchema>,
) {
  const explicitVersion = body.initial_version ?? body.initialVersion;

  if (explicitVersion) {
    return normalizeProgramVersionInput(explicitVersion);
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
    body.input_schema === undefined &&
    body.inputSchema === undefined &&
    body.output_config === undefined &&
    body.outputConfig === undefined &&
    files.length === 0
  ) {
    return null;
  }

  return normalizeProgramVersionInput({
    files,
    input_schema: body.input_schema ?? body.inputSchema,
    output_config: body.output_config ?? body.outputConfig,
    owner_profile_id: body.owner_profile_id ?? body.ownerProfileId,
  });
}

async function createProgramVersionRecord(
  supabase: SupabaseClient,
  programId: string,
  input: NormalizedProgramVersionInput,
) {
  const program = await getProgram(supabase, programId);

  const versionNumber =
    input.version ??
    (await (async () => {
      const { data, error } = await supabase
        .from("program_version")
        .select("version")
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
    })());

  const { data: version, error } = await supabase
    .from("program_version")
    .insert({
      input_schema: input.inputSchema,
      output_config: input.outputConfig,
      program_id: programId,
      version: versionNumber,
    })
    .select("*")
    .single();

  if (error) {
    throw new ApiError(500, error.message);
  }

  const fallbackOwnerProfileId =
    input.ownerProfileId ?? program.owner_profile_id;

  const filesToInsert = input.files.map((file) => ({
    content: file.content,
    filename: file.filename,
    filetype: file.filetype,
    owner_profile_id: file.ownerProfileId ?? fallbackOwnerProfileId,
    version_id: version.id,
  }));

  let files: ProgramFileRow[] = [];

  if (filesToInsert.length > 0) {
    const { data, error: fileError } = await supabase
      .from("program_file")
      .insert(filesToInsert)
      .select("*");

    if (fileError) {
      await supabase.from("program_version").delete().eq("id", version.id);
      throw new ApiError(500, fileError.message);
    }

    files = data ?? [];
  }

  return {
    ...version,
    files,
  };
}

async function createProgramVersionFromBody(
  supabase: SupabaseClient,
  programId: string,
  body: z.infer<typeof programVersionCreateBodySchema>,
) {
  const normalized = normalizeProgramVersionInput(body);
  return createProgramVersionRecord(supabase, programId, normalized);
}

// Middleware: authenticate and inject Supabase client.
app.use("*", async (c, next) => {
  const env = getEnv(c.env);
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return c.json(
      {
        error: "Server missing Supabase credentials",
      },
      500,
    );
  }

  const authHeader = c.req.header("Authorization");
  const headers: Record<string, string> = authHeader
    ? {
        Authorization: authHeader,
      }
    : {};

  c.set(
    "supabase",
    createClient(supabaseUrl, supabaseKey, {
      global: {
        headers,
      },
    }),
  );

  await next();
});

app.get(
  "/",
  route(async (c) => {
    return c.json({
      resources: {
        column_dependencies: "/column-dependencies",
        columns: "/columns",
        events: "/events",
        profiles: "/profiles",
        program_files: "/program-files",
        program_runs: "/program-runs",
        program_versions: "/program-versions",
        programs: "/programs",
        rows: "/rows",
        tables: "/tables",
      },
    });
  }),
);

// Profiles
app.get(
  "/profiles",
  route(async (c) => {
    const query = parseQuery(c, profileListQuerySchema);
    let request = c.var.supabase
      .from("profile")
      .select("*")
      .order("created_at");

    const ownerUserId = query.owner_user_id ?? query.ownerUserId;
    if (ownerUserId) {
      request = request.eq("owner_user_id", ownerUserId);
    }

    if (query.type) {
      request = request.eq("type", query.type);
    }

    const { data, error } = await request;

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.get(
  "/profiles/:profileId",
  route(async (c) =>
    c.json(await getProfile(c.var.supabase, requiredParam(c, "profileId"))),
  ),
);

app.patch(
  "/profiles/:profileId",
  route(async (c) => {
    const profileId = requiredParam(c, "profileId");
    await getProfile(c.var.supabase, profileId);

    const body = await parseJsonBody(c, profileUpdateBodySchema);
    requireAnyDefined([
      body.external_name,
      body.externalName,
      body.name,
      body.type,
    ]);

    const { data, error } = await c.var.supabase
      .from("profile")
      .update({
        external_name: body.external_name ?? body.externalName,
        name: body.name,
        type: body.type,
      })
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data);
  }),
);

// Events
app.get(
  "/events",
  route(async (c) => {
    const query = parseQuery(c, eventListQuerySchema);
    let request = c.var.supabase.from("event").select("*").order("created_at", {
      ascending: false,
    });

    const entityId = query.entity_id ?? query.entityId;
    const ownerProfileId = query.owner_profile_id ?? query.ownerProfileId;

    if (entityId) {
      request = request.eq("entity_id", entityId);
    }

    if (ownerProfileId) {
      request = request.eq("owner_profile_id", ownerProfileId);
    }

    if (query.operation) {
      request = request.eq("operation", query.operation);
    }

    if (query.resource) {
      request = request.eq("resource", query.resource);
    }

    const { data, error } = await request;

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.get(
  "/events/:eventId",
  route(async (c) =>
    c.json(await getEvent(c.var.supabase, requiredParam(c, "eventId"))),
  ),
);

// Tables
app.get(
  "/tables",
  route(async (c) => {
    const query = parseQuery(c, tableListQuerySchema);
    let request = c.var.supabase.from("table").select("*").order("created_at");

    const ownerProfileId = query.owner_profile_id ?? query.ownerProfileId;
    if (ownerProfileId) {
      request = request.eq("owner_profile_id", ownerProfileId);
    }

    const { data, error } = await request;

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.post(
  "/tables",
  route(async (c) => {
    const body = await parseJsonBody(c, tableCreateBodySchema);
    const ownerProfileId = await resolveOwnerProfileId(
      c.var.supabase,
      body.owner_profile_id ?? body.ownerProfileId,
    );

    const { data, error } = await c.var.supabase
      .from("table")
      .insert({
        name: body.name ?? "Untitled Table",
        owner_profile_id: ownerProfileId,
      })
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return created(c, `/tables/${data.id}`, data);
  }),
);

app.get(
  "/tables/:tableId",
  route(async (c) =>
    c.json(await getTable(c.var.supabase, requiredParam(c, "tableId"))),
  ),
);

app.patch(
  "/tables/:tableId",
  route(async (c) => {
    const tableId = requiredParam(c, "tableId");
    await getTable(c.var.supabase, tableId);

    const body = await parseJsonBody(c, tableUpdateBodySchema);
    requireAnyDefined([
      body.name,
      body.owner_profile_id,
      body.ownerProfileId,
    ]);

    const ownerProfileId =
      body.owner_profile_id ?? body.ownerProfileId ?? undefined;

    if (ownerProfileId) {
      await getProfile(c.var.supabase, ownerProfileId);
    }

    const { data, error } = await c.var.supabase
      .from("table")
      .update({
        name: body.name,
        owner_profile_id: ownerProfileId,
      })
      .eq("id", tableId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data);
  }),
);

app.delete(
  "/tables/:tableId",
  route(async (c) => {
    const tableId = requiredParam(c, "tableId");
    await deleteTableCascade(c.var.supabase, tableId);

    return c.json({
      success: true,
    });
  }),
);

// Columns
app.get(
  "/columns",
  route(async (c) => {
    const query = parseQuery(c, columnListQuerySchema);
    let request = c.var.supabase.from("column").select("*");

    const tableId = query.table_id ?? query.tableId;
    const programVersionId = query.program_version_id ?? query.programVersionId;
    const programId = query.program_id ?? query.programId;

    if (tableId) {
      request = request.eq("table_id", tableId);
    }

    if (programVersionId) {
      request = request.eq("program_version_id", programVersionId);
    } else if (programId) {
      const resolvedProgramVersionId = await resolveProgramVersionId(
        c.var.supabase,
        {
          program_id: programId,
        },
      );

      request = request.eq("program_version_id", resolvedProgramVersionId);
    }

    const { data, error } = await request
      .order("table_id", {
        ascending: true,
      })
      .order("idx", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

async function createColumn(c: ApiContext, explicitTableId?: string) {
  const body = await parseJsonBody(c, columnCreateBodySchema);
  const tableId = explicitTableId ?? body.table_id ?? body.tableId;

  if (!tableId) {
    throw new ApiError(400, "table_id is required");
  }

  await getTable(c.var.supabase, tableId);

  const programVersionId = await resolveProgramVersionId(c.var.supabase, {
    program_id: body.program_id ?? body.programId,
    program_version_id: body.program_version_id ?? body.programVersionId,
  });

  const programVersion = await getProgramVersion(
    c.var.supabase,
    programVersionId,
  );
  const inputTemplate = body.input_template ?? body.inputTemplate ?? "{}";
  const outputSchema =
    body.output_schema ??
    body.outputSchema ??
    resolveBaseOutputSchema(programVersion);
  const idx = body.idx ?? (await nextIndex(c.var.supabase, "column", tableId));

  const parsedOutputSchema = Schemas.ColumnOutputSchema.safeParse(outputSchema);
  if (!parsedOutputSchema.success) {
    throw zodError(parsedOutputSchema.error);
  }

  const { data: column, error } = await c.var.supabase
    .from("column")
    .insert({
      idx,
      input_template: inputTemplate,
      name: body.name,
      output_schema: parsedOutputSchema.data as Json,
      program_version_id: programVersionId,
      table_id: tableId,
    })
    .select("*")
    .single();

  if (error) {
    throw new ApiError(500, error.message);
  }

  try {
    const dependencies = await replaceColumnDependencies(
      c.var.supabase,
      column.id,
      inputTemplate,
    );

    const { data: rows, error: rowsError } = await c.var.supabase
      .from("row")
      .select("id")
      .eq("table_id", tableId);

    if (rowsError) {
      throw new ApiError(500, rowsError.message);
    }

    const cells = await createCells(
      c.var.supabase,
      (rows ?? []).map((row) => ({
        column_id: column.id,
        row_id: row.id,
      })),
    );

    return created(c, `/columns/${column.id}`, {
      ...column,
      cells,
      dependencies,
    });
  } catch (error) {
    await deleteColumnDependenciesForColumnIds(c.var.supabase, [
      column.id,
    ]);
    await c.var.supabase.from("column").delete().eq("id", column.id);
    throw error;
  }
}

app.get(
  "/tables/:tableId/columns",
  route(async (c) => {
    await getTable(c.var.supabase, requiredParam(c, "tableId"));

    const { data, error } = await c.var.supabase
      .from("column")
      .select("*")
      .eq("table_id", requiredParam(c, "tableId"))
      .order("idx", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.post(
  "/tables/:tableId/columns",
  route(async (c) => createColumn(c, requiredParam(c, "tableId"))),
);

app.post(
  "/columns",
  route(async (c) => createColumn(c)),
);

app.get(
  "/columns/:columnId",
  route(async (c) =>
    c.json(await getColumn(c.var.supabase, requiredParam(c, "columnId"))),
  ),
);

app.patch(
  "/columns/:columnId",
  route(async (c) => {
    const columnId = requiredParam(c, "columnId");
    const existing = await getColumn(c.var.supabase, columnId);
    const body = await parseJsonBody(c, columnUpdateBodySchema);

    requireAnyDefined([
      body.idx,
      body.input_template,
      body.inputTemplate,
      body.name,
      body.output_schema,
      body.outputSchema,
      body.program_id,
      body.programId,
      body.program_version_id,
      body.programVersionId,
    ]);

    const inputTemplate = body.input_template ?? body.inputTemplate;
    const requestedProgramVersionId = hasAnyDefined([
      body.program_id,
      body.programId,
      body.program_version_id,
      body.programVersionId,
    ])
      ? await resolveProgramVersionId(c.var.supabase, {
          program_id: body.program_id ?? body.programId,
          program_version_id: body.program_version_id ?? body.programVersionId,
        })
      : existing.program_version_id;

    const nextProgramVersion = await getProgramVersion(
      c.var.supabase,
      requestedProgramVersionId,
    );

    const outputSchema =
      body.output_schema ??
      body.outputSchema ??
      resolveBaseOutputSchema(nextProgramVersion);
    const parsedOutputSchema =
      Schemas.ColumnOutputSchema.safeParse(outputSchema);

    if (!parsedOutputSchema.success) {
      throw zodError(parsedOutputSchema.error);
    }

    const { data, error } = await c.var.supabase
      .from("column")
      .update({
        idx: body.idx,
        input_template: inputTemplate,
        name: body.name,
        output_schema: parsedOutputSchema.data as Json,
        program_version_id: requestedProgramVersionId,
      })
      .eq("id", columnId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    if (inputTemplate !== undefined) {
      await replaceColumnDependencies(c.var.supabase, columnId, inputTemplate);
    }

    return c.json(data);
  }),
);

app.delete(
  "/columns/:columnId",
  route(async (c) => {
    const columnId = requiredParam(c, "columnId");
    await getColumn(c.var.supabase, columnId);

    const { data: cells, error: cellError } = await c.var.supabase
      .from("cell")
      .select("id")
      .eq("column_id", columnId);

    if (cellError) {
      throw new ApiError(500, cellError.message);
    }

    await deleteProgramRunsForCellIds(
      c.var.supabase,
      (cells ?? []).map((cell) => cell.id),
    );

    const [cellDelete, columnDelete] = await Promise.all([
      c.var.supabase.from("cell").delete().eq("column_id", columnId),
      c.var.supabase.from("column").delete().eq("id", columnId),
      deleteColumnDependenciesForColumnIds(c.var.supabase, [
        columnId,
      ]),
    ]);

    if (cellDelete.error) {
      throw new ApiError(500, cellDelete.error.message);
    }

    if (columnDelete.error) {
      throw new ApiError(500, columnDelete.error.message);
    }

    return c.json({
      success: true,
    });
  }),
);

// Column dependencies
app.get(
  "/column-dependencies",
  route(async (c) => {
    const query = parseQuery(c, columnDependencyListQuerySchema);
    const sourceColumnId = query.source_column_id ?? query.sourceColumnId;
    const targetColumnId = query.target_column_id ?? query.targetColumnId;
    const tableId = query.table_id ?? query.tableId;

    if (tableId) {
      await getTable(c.var.supabase, tableId);

      const { data: columns, error: columnError } = await c.var.supabase
        .from("column")
        .select("id")
        .eq("table_id", tableId);

      if (columnError) {
        throw new ApiError(500, columnError.message);
      }

      const columnIds = (columns ?? []).map((column) => column.id);
      if (columnIds.length === 0) {
        return c.json([]);
      }

      const [sourceResult, targetResult] = await Promise.all([
        c.var.supabase
          .from("column_dependency")
          .select("*")
          .in("source_column_id", columnIds),
        c.var.supabase
          .from("column_dependency")
          .select("*")
          .in("target_column_id", columnIds),
      ]);

      if (sourceResult.error) {
        throw new ApiError(500, sourceResult.error.message);
      }

      if (targetResult.error) {
        throw new ApiError(500, targetResult.error.message);
      }

      const merged = new Map<string, ColumnDependencyRow>();
      for (const dependency of [
        ...(sourceResult.data ?? []),
        ...(targetResult.data ?? []),
      ]) {
        merged.set(dependency.id, dependency);
      }

      return c.json(
        Array.from(merged.values()).filter((dependency) => {
          if (
            sourceColumnId &&
            dependency.source_column_id !== sourceColumnId
          ) {
            return false;
          }

          if (
            targetColumnId &&
            dependency.target_column_id !== targetColumnId
          ) {
            return false;
          }

          return true;
        }),
      );
    }

    let request = c.var.supabase
      .from("column_dependency")
      .select("*")
      .order("created_at", {
        ascending: true,
      });

    if (sourceColumnId) {
      request = request.eq("source_column_id", sourceColumnId);
    }

    if (targetColumnId) {
      request = request.eq("target_column_id", targetColumnId);
    }

    const { data, error } = await request;

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.get(
  "/column-dependencies/:dependencyId",
  route(async (c) =>
    c.json(
      await getColumnDependency(
        c.var.supabase,
        requiredParam(c, "dependencyId"),
      ),
    ),
  ),
);

// Rows
app.get(
  "/rows",
  route(async (c) => {
    const query = parseQuery(c, rowListQuerySchema);
    let request = c.var.supabase.from("row").select("*");
    const tableId = query.table_id ?? query.tableId;

    if (tableId) {
      request = request.eq("table_id", tableId);
    }

    const { data, error } = await request
      .order("table_id", {
        ascending: true,
      })
      .order("idx", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

async function createRows(c: ApiContext, explicitTableId?: string) {
  const body = await parseJsonBody(c, rowCreateBodySchema);
  const tableId = explicitTableId ?? body.table_id ?? body.tableId;

  if (!tableId) {
    throw new ApiError(400, "table_id is required");
  }

  await getTable(c.var.supabase, tableId);

  const count = body.count ?? 1;
  if (count > 1 && body.idx !== undefined) {
    throw new ApiError(400, "idx cannot be used when count is greater than 1");
  }

  const startIndex =
    body.idx ?? (await nextIndex(c.var.supabase, "row", tableId));

  const rowsToInsert = Array.from(
    {
      length: count,
    },
    (_, index) => ({
      idx: startIndex + index,
      table_id: tableId,
    }),
  );

  const { data: rows, error } = await c.var.supabase
    .from("row")
    .insert(rowsToInsert)
    .select("*");

  if (error) {
    throw new ApiError(500, error.message);
  }

  const { data: columns, error: columnError } = await c.var.supabase
    .from("column")
    .select("id")
    .eq("table_id", tableId);

  if (columnError) {
    throw new ApiError(500, columnError.message);
  }

  const cells = await createCells(
    c.var.supabase,
    (rows ?? []).flatMap((row) =>
      (columns ?? []).map((column) => ({
        column_id: column.id,
        row_id: row.id,
      })),
    ),
  );

  if (count === 1 && rows && rows[0]) {
    return created(c, `/rows/${rows[0].id}`, rows[0]);
  }

  return c.json(
    {
      cells,
      rows: rows ?? [],
    },
    201,
  );
}

app.get(
  "/tables/:tableId/rows",
  route(async (c) => {
    await getTable(c.var.supabase, requiredParam(c, "tableId"));

    const { data, error } = await c.var.supabase
      .from("row")
      .select("*")
      .eq("table_id", requiredParam(c, "tableId"))
      .order("idx", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.post(
  "/tables/:tableId/rows",
  route(async (c) => createRows(c, requiredParam(c, "tableId"))),
);

app.post(
  "/rows",
  route(async (c) => createRows(c)),
);

app.get(
  "/rows/:rowId",
  route(async (c) =>
    c.json(await getRow(c.var.supabase, requiredParam(c, "rowId"))),
  ),
);

app.patch(
  "/rows/:rowId",
  route(async (c) => {
    const rowId = requiredParam(c, "rowId");
    await getRow(c.var.supabase, rowId);

    const body = await parseJsonBody(c, rowUpdateBodySchema);
    requireAnyDefined([
      body.idx,
    ]);

    const { data, error } = await c.var.supabase
      .from("row")
      .update({
        idx: body.idx,
      })
      .eq("id", rowId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data);
  }),
);

app.delete(
  "/rows/:rowId",
  route(async (c) => {
    const rowId = requiredParam(c, "rowId");
    await getRow(c.var.supabase, rowId);

    const { data: cells, error: cellError } = await c.var.supabase
      .from("cell")
      .select("id")
      .eq("row_id", rowId);

    if (cellError) {
      throw new ApiError(500, cellError.message);
    }

    await deleteProgramRunsForCellIds(
      c.var.supabase,
      (cells ?? []).map((cell) => cell.id),
    );

    const [cellDelete, rowDelete] = await Promise.all([
      c.var.supabase.from("cell").delete().eq("row_id", rowId),
      c.var.supabase.from("row").delete().eq("id", rowId),
    ]);

    if (cellDelete.error) {
      throw new ApiError(500, cellDelete.error.message);
    }

    if (rowDelete.error) {
      throw new ApiError(500, rowDelete.error.message);
    }

    return c.json({
      success: true,
    });
  }),
);

// Cells
app.get(
  "/cells",
  route(async (c) => {
    const query = parseQuery(c, cellListQuerySchema);
    const tableId = query.table_id ?? query.tableId;
    const rowId = query.row_id ?? query.rowId;
    const columnId = query.column_id ?? query.columnId;

    let request = c.var.supabase.from("cell").select("*");

    if (rowId) {
      request = request.eq("row_id", rowId);
    }

    if (columnId) {
      request = request.eq("column_id", columnId);
    }

    if (tableId) {
      const { data: rows, error: rowError } = await c.var.supabase
        .from("row")
        .select("id")
        .eq("table_id", tableId);

      if (rowError) {
        throw new ApiError(500, rowError.message);
      }

      const rowIds = (rows ?? []).map((row) => row.id);
      if (rowIds.length === 0) {
        return c.json([]);
      }

      request = request.in("row_id", rowIds);
    }

    const { data, error } = await request
      .order("row_id", {
        ascending: true,
      })
      .order("column_id", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.get(
  "/rows/:rowId/cells",
  route(async (c) => {
    await getRow(c.var.supabase, requiredParam(c, "rowId"));

    const { data, error } = await c.var.supabase
      .from("cell")
      .select("*")
      .eq("row_id", requiredParam(c, "rowId"))
      .order("column_id", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.get(
  "/columns/:columnId/cells",
  route(async (c) => {
    await getColumn(c.var.supabase, requiredParam(c, "columnId"));

    const { data, error } = await c.var.supabase
      .from("cell")
      .select("*")
      .eq("column_id", requiredParam(c, "columnId"))
      .order("row_id", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.get(
  "/cells/:cellId",
  route(async (c) =>
    c.json(await getCell(c.var.supabase, requiredParam(c, "cellId"))),
  ),
);

app.patch(
  "/cells/:cellId",
  route(async (c) => {
    const cellId = requiredParam(c, "cellId");
    await requireById(
      c.var.supabase.from("cell").select("*").eq("id", cellId).maybeSingle(),
      "Cell",
      cellId,
    );

    const body = await parseJsonBody(c, cellUpdateBodySchema);
    requireAnyDefined([
      body.manual_input,
      body.manualInput,
      body.state,
    ]);

    const { data, error } = await c.var.supabase
      .from("cell")
      .update({
        manual_input: body.manual_input ?? body.manualInput,
        state: body.state as Json | undefined,
      })
      .eq("id", cellId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data);
  }),
);

// Programs
app.get(
  "/programs",
  route(async (c) => {
    const query = parseQuery(c, programListQuerySchema);
    let request = c.var.supabase
      .from("program")
      .select("*")
      .order("created_at");
    const ownerProfileId = query.owner_profile_id ?? query.ownerProfileId;

    if (ownerProfileId) {
      request = request.eq("owner_profile_id", ownerProfileId);
    }

    const { data, error } = await request;

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.post(
  "/programs",
  route(async (c) => {
    const body = await parseJsonBody(c, programCreateBodySchema);
    const ownerProfileId = await resolveOwnerProfileId(
      c.var.supabase,
      body.owner_profile_id ?? body.ownerProfileId,
    );

    const { data: program, error } = await c.var.supabase
      .from("program")
      .insert({
        first_party: body.first_party ?? body.firstParty ?? false,
        forked_from_version_id:
          body.forked_from_version_id ?? body.forkedFromVersionId ?? null,
        name: body.name,
        owner_profile_id: ownerProfileId,
      })
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    const initialVersion = normalizeInitialProgramVersion(body);
    if (!initialVersion) {
      return created(c, `/programs/${program.id}`, program);
    }

    try {
      const version = await createProgramVersionRecord(
        c.var.supabase,
        program.id,
        initialVersion,
      );

      return created(c, `/programs/${program.id}`, {
        ...program,
        initial_version: version,
      });
    } catch (createVersionError) {
      await c.var.supabase.from("program").delete().eq("id", program.id);
      throw createVersionError;
    }
  }),
);

app.get(
  "/programs/:programId",
  route(async (c) =>
    c.json(await getProgram(c.var.supabase, requiredParam(c, "programId"))),
  ),
);

app.patch(
  "/programs/:programId",
  route(async (c) => {
    const programId = requiredParam(c, "programId");
    await getProgram(c.var.supabase, programId);

    const body = await parseJsonBody(c, programUpdateBodySchema);
    requireAnyDefined([
      body.first_party,
      body.firstParty,
      body.forked_from_version_id,
      body.forkedFromVersionId,
      body.name,
      body.owner_profile_id,
      body.ownerProfileId,
    ]);

    const ownerProfileId =
      body.owner_profile_id ?? body.ownerProfileId ?? undefined;
    const forkedFromVersionId =
      body.forked_from_version_id ?? body.forkedFromVersionId;

    if (ownerProfileId) {
      await getProfile(c.var.supabase, ownerProfileId);
    }

    if (forkedFromVersionId) {
      await getProgramVersion(c.var.supabase, forkedFromVersionId);
    }

    const { data, error } = await c.var.supabase
      .from("program")
      .update({
        first_party: body.first_party ?? body.firstParty,
        forked_from_version_id: forkedFromVersionId,
        name: body.name,
        owner_profile_id: ownerProfileId,
      })
      .eq("id", programId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data);
  }),
);

app.delete(
  "/programs/:programId",
  route(async (c) => {
    const programId = requiredParam(c, "programId");
    await getProgram(c.var.supabase, programId);

    const { data: versions, error: versionError } = await c.var.supabase
      .from("program_version")
      .select("id")
      .eq("program_id", programId);

    if (versionError) {
      throw new ApiError(500, versionError.message);
    }

    const versionIds = (versions ?? []).map((version) => version.id);
    await assertProgramVersionsNotInUse(c.var.supabase, versionIds);

    if (versionIds.length > 0) {
      const [fileDelete, versionDelete] = await Promise.all([
        c.var.supabase
          .from("program_file")
          .delete()
          .in("version_id", versionIds),
        c.var.supabase.from("program_version").delete().in("id", versionIds),
      ]);

      if (fileDelete.error) {
        throw new ApiError(500, fileDelete.error.message);
      }

      if (versionDelete.error) {
        throw new ApiError(500, versionDelete.error.message);
      }
    }

    const { error } = await c.var.supabase
      .from("program")
      .delete()
      .eq("id", programId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json({
      success: true,
    });
  }),
);

// Program versions
app.get(
  "/program-versions",
  route(async (c) => {
    const query = parseQuery(c, programVersionListQuerySchema);
    let request = c.var.supabase.from("program_version").select("*");
    const programId = query.program_id ?? query.programId;

    if (programId) {
      request = request.eq("program_id", programId);
    }

    const { data, error } = await request
      .order("program_id", {
        ascending: true,
      })
      .order("version", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.get(
  "/programs/:programId/versions",
  route(async (c) => {
    await getProgram(c.var.supabase, requiredParam(c, "programId"));

    const { data, error } = await c.var.supabase
      .from("program_version")
      .select("*")
      .eq("program_id", requiredParam(c, "programId"))
      .order("version", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.post(
  "/program-versions",
  route(async (c) => {
    const body = await parseJsonBody(c, programVersionCreateBodySchema);
    const programId = body.program_id ?? body.programId;

    if (!programId) {
      throw new ApiError(400, "program_id is required");
    }

    const createdVersion = await createProgramVersionFromBody(
      c.var.supabase,
      programId,
      body,
    );

    return created(c, `/program-versions/${createdVersion.id}`, createdVersion);
  }),
);

app.post(
  "/programs/:programId/versions",
  route(async (c) => {
    const createdVersion = await createProgramVersionFromBody(
      c.var.supabase,
      requiredParam(c, "programId"),
      await parseJsonBody(c, programVersionCreateBodySchema),
    );

    return created(c, `/program-versions/${createdVersion.id}`, createdVersion);
  }),
);

app.get(
  "/program-versions/:programVersionId",
  route(async (c) =>
    c.json(
      await getProgramVersion(
        c.var.supabase,
        requiredParam(c, "programVersionId"),
      ),
    ),
  ),
);

app.patch(
  "/program-versions/:programVersionId",
  route(async (c) => {
    const programVersionId = requiredParam(c, "programVersionId");
    await getProgramVersion(c.var.supabase, programVersionId);

    const body = await parseJsonBody(c, programVersionUpdateBodySchema);
    requireAnyDefined([
      body.input_schema,
      body.inputSchema,
      body.output_config,
      body.outputConfig,
      body.version,
    ]);

    const updates: Database["public"]["Tables"]["program_version"]["Update"] =
      {};

    if (body.input_schema !== undefined || body.inputSchema !== undefined) {
      const parsedInputSchema = Schemas.ProgramInputSchema.safeParse(
        body.input_schema ?? body.inputSchema,
      );

      if (!parsedInputSchema.success) {
        throw zodError(parsedInputSchema.error);
      }

      updates.input_schema = parsedInputSchema.data as Json;
    }

    if (body.output_config !== undefined || body.outputConfig !== undefined) {
      const parsedOutputConfig = Schemas.ProgramOutputConfig.safeParse(
        body.output_config ?? body.outputConfig,
      );

      if (!parsedOutputConfig.success) {
        throw zodError(parsedOutputConfig.error);
      }

      updates.output_config = parsedOutputConfig.data as Json;
    }

    if (body.version !== undefined) {
      updates.version = body.version;
    }

    const { data, error } = await c.var.supabase
      .from("program_version")
      .update(updates)
      .eq("id", programVersionId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data);
  }),
);

app.delete(
  "/program-versions/:programVersionId",
  route(async (c) => {
    const programVersionId = requiredParam(c, "programVersionId");
    await getProgramVersion(c.var.supabase, programVersionId);
    await assertProgramVersionsNotInUse(c.var.supabase, [
      programVersionId,
    ]);

    const [fileDelete, versionDelete] = await Promise.all([
      c.var.supabase
        .from("program_file")
        .delete()
        .eq("version_id", programVersionId),
      c.var.supabase
        .from("program_version")
        .delete()
        .eq("id", programVersionId),
    ]);

    if (fileDelete.error) {
      throw new ApiError(500, fileDelete.error.message);
    }

    if (versionDelete.error) {
      throw new ApiError(500, versionDelete.error.message);
    }

    return c.json({
      success: true,
    });
  }),
);

// Program files
app.get(
  "/program-files",
  route(async (c) => {
    const query = parseQuery(c, programFileListQuerySchema);
    let request = c.var.supabase.from("program_file").select("*");
    const ownerProfileId = query.owner_profile_id ?? query.ownerProfileId;
    const versionId = query.version_id ?? query.versionId;

    if (ownerProfileId) {
      request = request.eq("owner_profile_id", ownerProfileId);
    }

    if (versionId) {
      request = request.eq("version_id", versionId);
    }

    const { data, error } = await request
      .order("version_id", {
        ascending: true,
      })
      .order("filename", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.get(
  "/program-versions/:programVersionId/files",
  route(async (c) => {
    await getProgramVersion(
      c.var.supabase,
      requiredParam(c, "programVersionId"),
    );

    const { data, error } = await c.var.supabase
      .from("program_file")
      .select("*")
      .eq("version_id", requiredParam(c, "programVersionId"))
      .order("filename", {
        ascending: true,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.post(
  "/program-files",
  route(async (c) => {
    const body = await parseJsonBody(c, programFileCreateBodySchema);
    const versionId = body.version_id ?? body.versionId;

    if (!versionId) {
      throw new ApiError(400, "version_id is required");
    }

    const version = await getProgramVersion(c.var.supabase, versionId);
    const program = await getProgram(c.var.supabase, version.program_id);
    const ownerProfileId =
      body.owner_profile_id ?? body.ownerProfileId ?? program.owner_profile_id;

    const { data, error } = await c.var.supabase
      .from("program_file")
      .insert({
        content: body.content,
        filename: body.filename,
        filetype: body.filetype,
        owner_profile_id: ownerProfileId,
        version_id: versionId,
      })
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return created(c, `/program-files/${data.id}`, data);
  }),
);

app.post(
  "/program-versions/:programVersionId/files",
  route(async (c) => {
    const body = await parseJsonBody(c, programFileCreateBodySchema);
    const version = await getProgramVersion(
      c.var.supabase,
      requiredParam(c, "programVersionId"),
    );
    const program = await getProgram(c.var.supabase, version.program_id);
    const ownerProfileId =
      body.owner_profile_id ?? body.ownerProfileId ?? program.owner_profile_id;

    const { data, error } = await c.var.supabase
      .from("program_file")
      .insert({
        content: body.content,
        filename: body.filename,
        filetype: body.filetype,
        owner_profile_id: ownerProfileId,
        version_id: version.id,
      })
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return created(c, `/program-files/${data.id}`, data);
  }),
);

app.get(
  "/program-files/:programFileId",
  route(async (c) =>
    c.json(
      await getProgramFile(c.var.supabase, requiredParam(c, "programFileId")),
    ),
  ),
);

app.patch(
  "/program-files/:programFileId",
  route(async (c) => {
    const programFileId = requiredParam(c, "programFileId");
    const existing = await getProgramFile(c.var.supabase, programFileId);
    const body = await parseJsonBody(c, programFileUpdateBodySchema);

    requireAnyDefined([
      body.content,
      body.filename,
      body.filetype,
      body.owner_profile_id,
      body.ownerProfileId,
    ]);

    const ownerProfileId =
      body.owner_profile_id ?? body.ownerProfileId ?? existing.owner_profile_id;

    if (ownerProfileId) {
      await getProfile(c.var.supabase, ownerProfileId);
    }

    const { data, error } = await c.var.supabase
      .from("program_file")
      .update({
        content: body.content,
        filename: body.filename,
        filetype: body.filetype,
        owner_profile_id: ownerProfileId,
      })
      .eq("id", programFileId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data);
  }),
);

app.delete(
  "/program-files/:programFileId",
  route(async (c) => {
    const programFileId = requiredParam(c, "programFileId");
    await getProgramFile(c.var.supabase, programFileId);

    const { error } = await c.var.supabase
      .from("program_file")
      .delete()
      .eq("id", programFileId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json({
      success: true,
    });
  }),
);

// Program runs
app.get(
  "/program-runs",
  route(async (c) => {
    const query = parseQuery(c, programRunListQuerySchema);
    let request = c.var.supabase.from("program_run").select("*");

    const targetCellId = query.target_cell_id ?? query.targetCellId;
    const programVersionId = query.program_version_id ?? query.programVersionId;

    if (targetCellId) {
      request = request.eq("target_cell_id", targetCellId);
    }

    if (programVersionId) {
      request = request.eq("program_version_id", programVersionId);
    }

    const { data, error } = await request.order("created_at", {
      ascending: false,
    });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.get(
  "/cells/:cellId/runs",
  route(async (c) => {
    await requireById(
      c.var.supabase
        .from("cell")
        .select("*")
        .eq("id", requiredParam(c, "cellId"))
        .maybeSingle(),
      "Cell",
      requiredParam(c, "cellId"),
    );

    const { data, error } = await c.var.supabase
      .from("program_run")
      .select("*")
      .eq("target_cell_id", requiredParam(c, "cellId"))
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data ?? []);
  }),
);

app.post(
  "/program-runs",
  route(async (c) => {
    const body = await parseJsonBody(c, programRunCreateBodySchema);
    const targetCellId = body.target_cell_id ?? body.targetCellId;

    if (!targetCellId) {
      throw new ApiError(400, "target_cell_id is required");
    }

    await requireById(
      c.var.supabase
        .from("cell")
        .select("*")
        .eq("id", targetCellId)
        .maybeSingle(),
      "Cell",
      targetCellId,
    );

    const programVersionId = await resolveProgramVersionId(c.var.supabase, {
      program_id: body.program_id ?? body.programId,
      program_version_id: body.program_version_id ?? body.programVersionId,
    });

    const { data, error } = await c.var.supabase
      .from("program_run")
      .insert({
        input: body.input as Json | undefined,
        output: body.output as Json | undefined,
        program_version_id: programVersionId,
        target_cell_id: targetCellId,
      })
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return created(c, `/program-runs/${data.id}`, data);
  }),
);

app.get(
  "/program-runs/:runId",
  route(async (c) =>
    c.json(await getProgramRun(c.var.supabase, requiredParam(c, "runId"))),
  ),
);

app.patch(
  "/program-runs/:runId",
  route(async (c) => {
    const runId = requiredParam(c, "runId");
    await getProgramRun(c.var.supabase, runId);

    const body = await parseJsonBody(c, programRunUpdateBodySchema);
    requireAnyDefined([
      body.input,
      body.output,
      body.program_id,
      body.programId,
      body.program_version_id,
      body.programVersionId,
      body.target_cell_id,
      body.targetCellId,
    ]);

    const updates: Database["public"]["Tables"]["program_run"]["Update"] = {};

    if (body.input !== undefined) {
      updates.input = body.input as Json;
    }

    if (body.output !== undefined) {
      updates.output = body.output as Json;
    }

    const targetCellId = body.target_cell_id ?? body.targetCellId;
    if (targetCellId) {
      await requireById(
        c.var.supabase
          .from("cell")
          .select("*")
          .eq("id", targetCellId)
          .maybeSingle(),
        "Cell",
        targetCellId,
      );
      updates.target_cell_id = targetCellId;
    }

    if (
      hasAnyDefined([
        body.program_id,
        body.programId,
        body.program_version_id,
        body.programVersionId,
      ])
    ) {
      updates.program_version_id = await resolveProgramVersionId(
        c.var.supabase,
        {
          program_id: body.program_id ?? body.programId,
          program_version_id: body.program_version_id ?? body.programVersionId,
        },
      );
    }

    const { data, error } = await c.var.supabase
      .from("program_run")
      .update(updates)
      .eq("id", runId)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json(data);
  }),
);

app.delete(
  "/program-runs/:runId",
  route(async (c) => {
    const runId = requiredParam(c, "runId");
    await getProgramRun(c.var.supabase, runId);

    const { error } = await c.var.supabase
      .from("program_run")
      .delete()
      .eq("id", runId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    return c.json({
      success: true,
    });
  }),
);

// Legacy dry-run passthrough
app.post(
  "/programs/dry-run",
  route(async (c) => {
    const env = getEnv(c.env);
    const executorUrl = env.MARBLE_EXECUTOR_URL || "http://localhost:8787";
    const body = await readJsonBody(c);

    try {
      const response = await fetch(`${executorUrl}/dry-run`, {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const text = await response.text();
      let payload: unknown = text;

      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        // Non-JSON responses are forwarded as text.
      }

      return Response.json(payload, {
        status: response.status,
      });
    } catch (error) {
      throw new ApiError(
        500,
        error instanceof Error ? error.message : String(error),
      );
    }
  }),
);

export default app;
