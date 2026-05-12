import type { Json, Tables } from "../../../../src";
import { z } from "zod";
import type { ResourceDeps } from "../db";

type JsonValue = Json;

type ProgramFile = Pick<
  Tables<"program_file">,
  "content" | "filename" | "filetype"
>;
type ExecutionSecret = {
  category: Tables<"secret">["category"];
  id: string;
  name: string;
  value: string;
};
type ExecutionSecretMetadata = Pick<
  Tables<"secret">,
  "category" | "id" | "name"
>;
type SecretBinding = {
  envName: string;
  secretId: string;
};
type ProgramSecretDeclaration = {
  description?: string;
  env: string;
  label: string;
  required: boolean;
};
type MissingSecretConfiguration = {
  bindingSource: "column" | "implicit" | "program";
  description?: string;
  envName: string;
  label: string;
  required: boolean;
};

export type ProgramVersionTestData = {
  files: ProgramFile[];
  outputConfig: Json;
  programId: string;
  secretConfig: Json | null;
};

const STORED_RUN_SELECT = `*, program_version(*, program!program_version_program_id_fkey(*), program_file(*)), cell!target_cell_id(*, row!cell_row_id_fkey(*, table!row_table_id_fkey(*, project!table_project_id_fkey(*, profile!project_owner_profile_id_fkey(*)))), column!cell_column_id_fkey(*))`;

const executionSecretSchema = z.object({
  category: z.enum([
    "Managed",
    "UserDefined",
  ]),
  id: z.string().uuid(),
  name: z.string(),
  value: z.string(),
});
const secretBindingSchema = z.object({
  env_name: z.string(),
  secret_id: z.string().uuid(),
});

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

function requireServiceSupabase(deps: ResourceDeps) {
  if (!deps.serviceSupabase) {
    throw new Error(
      "Program run operations require a service Supabase client.",
    );
  }

  return deps.serviceSupabase;
}

async function loadStoredRun(
  supabase: ReturnType<typeof requireServiceSupabase>,
  runId: string,
) {
  const { data, error } = await supabase
    .from("program_run")
    .select(STORED_RUN_SELECT)
    .eq("id", runId);

  const run = data?.at(0);
  if (!run || error) {
    throw new Error(error?.message ?? "No run found.");
  }

  return run;
}

export type StoredProgramRun = Awaited<ReturnType<typeof loadStoredRun>>;

type ProgramRunBaseInputContext = {
  cell: Pick<Tables<"cell">, "id" | "manual_input" | "state">;
  column: Pick<
    Tables<"column">,
    | "id"
    | "input_template"
    | "program_version_id"
    | "run_condition"
    | "table_id"
  >;
  programVersion: Pick<Tables<"program_version">, "id" | "input_schema">;
  row: Pick<Tables<"row">, "id" | "idx" | "table_id">;
};

export type ProgramRunInputContext = ProgramRunBaseInputContext & {
  columns: Record<
    string,
    {
      ready: boolean;
      value: JsonValue;
    }
  >;
};

function createExecutionInputContextFromStoredRun(
  run: StoredProgramRun,
): ProgramRunBaseInputContext {
  const row = firstRelation(run.cell.row);

  if (!row) {
    throw new Error("Could not resolve the run row.");
  }

  return {
    cell: {
      id: run.cell.id,
      manual_input: run.cell.manual_input,
      state: run.cell.state,
    },
    column: {
      id: run.cell.column.id,
      input_template: run.cell.column.input_template,
      program_version_id: run.cell.column.program_version_id,
      run_condition: run.cell.column.run_condition,
      table_id: run.cell.column.table_id,
    },
    programVersion: {
      id: run.program_version.id,
      input_schema: run.program_version.input_schema,
    },
    row: {
      id: row.id,
      idx: row.idx,
      table_id: row.table_id,
    },
  };
}

async function listSecretMetadataForOwnerUserId(
  supabase: ReturnType<typeof requireServiceSupabase>,
  ownerUserId: string,
) {
  const { data, error } = await supabase
    .from("secret")
    .select("category, id, name")
    .eq("owner_user_id", ownerUserId)
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ExecutionSecretMetadata[];
}

async function listSelectedSecretsForOwnerUserId(
  supabase: ReturnType<typeof requireServiceSupabase>,
  ownerUserId: string,
  secretIds: string[],
) {
  const uniqueSecretIds = Array.from(new Set(secretIds));

  if (uniqueSecretIds.length === 0) {
    return [] as ExecutionSecret[];
  }

  const { data, error } = await supabase.rpc("secret_store_resolve_selected", {
    p_owner_user_id: ownerUserId,
    p_secret_ids: uniqueSecretIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(executionSecretSchema).parse(data ?? []) as ExecutionSecret[];
}

async function resolveOwnerUserIdForProfile(
  supabase: ReturnType<typeof requireServiceSupabase>,
  profileId: string,
) {
  const { data, error } = await supabase
    .from("profile")
    .select("owner_user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`Profile '${profileId}' was not found.`);
  }

  return data.owner_user_id;
}

async function listProgramSecretBindingsForOwnerUserId(
  supabase: ReturnType<typeof requireServiceSupabase>,
  ownerUserId: string,
  programId: string,
) {
  const { data, error } = await supabase
    .from("program_secret_binding")
    .select("env_name, secret_id")
    .eq("owner_user_id", ownerUserId)
    .eq("program_id", programId)
    .order("env_name", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return z
    .array(secretBindingSchema)
    .parse(data ?? [])
    .map((binding) => ({
      envName: binding.env_name,
      secretId: binding.secret_id,
    })) as SecretBinding[];
}

async function listColumnSecretBindings(
  supabase: ReturnType<typeof requireServiceSupabase>,
  columnId: string,
) {
  const { data, error } = await supabase
    .from("column_secret_binding")
    .select("env_name, secret_id")
    .eq("column_id", columnId)
    .order("env_name", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return z
    .array(secretBindingSchema)
    .parse(data ?? [])
    .map((binding) => ({
      envName: binding.env_name,
      secretId: binding.secret_id,
    })) as SecretBinding[];
}

async function listResolvedSecretBindings(
  supabase: ReturnType<typeof requireServiceSupabase>,
  options: {
    columnId?: string;
    ownerUserId: string;
    programId: string;
  },
) {
  const [programBindings, columnBindings] = await Promise.all([
    listProgramSecretBindingsForOwnerUserId(
      supabase,
      options.ownerUserId,
      options.programId,
    ),
    options.columnId
      ? listColumnSecretBindings(supabase, options.columnId)
      : Promise.resolve([] as SecretBinding[]),
  ]);
  const bindingSourceByEnvName = new Map<
    string,
    MissingSecretConfiguration["bindingSource"]
  >();
  const selectedSecretIdByEnvName = new Map<string, string>();

  for (const binding of programBindings) {
    bindingSourceByEnvName.set(binding.envName, "program");
    selectedSecretIdByEnvName.set(binding.envName, binding.secretId);
  }

  for (const binding of columnBindings) {
    bindingSourceByEnvName.set(binding.envName, "column");
    selectedSecretIdByEnvName.set(binding.envName, binding.secretId);
  }

  return {
    bindingSourceByEnvName,
    selectedSecretIdByEnvName,
  };
}

async function resolveDeclaredEnvironmentVariables(
  supabase: ReturnType<typeof requireServiceSupabase>,
  options: {
    columnId?: string;
    declarations: ProgramSecretDeclaration[];
    ownerUserId: string;
    programId: string;
  },
) {
  const declarationByEnvName = new Map(
    options.declarations.map((declaration) => [
      declaration.env,
      declaration,
    ]),
  );
  const { bindingSourceByEnvName, selectedSecretIdByEnvName } =
    await listResolvedSecretBindings(supabase, {
      columnId: options.columnId,
      ownerUserId: options.ownerUserId,
      programId: options.programId,
    });
  const missingSecrets: MissingSecretConfiguration[] = [];

  if (options.declarations.length > 0) {
    const secretMetadata = await listSecretMetadataForOwnerUserId(
      supabase,
      options.ownerUserId,
    );
    const secretIdByName = new Map(
      secretMetadata.map((secret) => [
        secret.name,
        secret.id,
      ]),
    );

    for (const declaration of options.declarations) {
      if (selectedSecretIdByEnvName.has(declaration.env)) {
        continue;
      }

      const implicitSecretId = secretIdByName.get(declaration.env);

      if (implicitSecretId) {
        selectedSecretIdByEnvName.set(declaration.env, implicitSecretId);
        continue;
      }

      if (!declaration.required) {
        continue;
      }

      missingSecrets.push({
        bindingSource: "implicit",
        ...(declaration.description === undefined
          ? {}
          : {
              description: declaration.description,
            }),
        envName: declaration.env,
        label: declaration.label,
        required: declaration.required,
      });
    }
  }

  const resolvedSecrets = await listSelectedSecretsForOwnerUserId(
    supabase,
    options.ownerUserId,
    Array.from(new Set(selectedSecretIdByEnvName.values())),
  );
  const resolvedSecretValueById = new Map(
    resolvedSecrets.map((secret) => [
      secret.id,
      secret.value,
    ]),
  );
  const environmentVariables: Record<string, string> = {};

  for (const [envName, secretId] of selectedSecretIdByEnvName) {
    const selectedValue = resolvedSecretValueById.get(secretId);

    if (selectedValue !== undefined) {
      environmentVariables[envName] = selectedValue;
      continue;
    }

    const declaration = declarationByEnvName.get(envName);
    const bindingSource = bindingSourceByEnvName.get(envName) ?? "implicit";

    if (
      !bindingSourceByEnvName.has(envName) &&
      declaration?.required !== true
    ) {
      continue;
    }

    if (
      missingSecrets.some((missingSecret) => missingSecret.envName === envName)
    ) {
      continue;
    }

    missingSecrets.push({
      bindingSource,
      ...(declaration?.description === undefined
        ? {}
        : {
            description: declaration.description,
          }),
      envName,
      label: declaration?.label ?? envName,
      required:
        bindingSourceByEnvName.has(envName) || declaration?.required === true,
    });
  }

  return {
    environmentVariables,
    missingSecrets,
  };
}

async function loadExecutionInputContextForCell(
  supabase: ReturnType<typeof requireServiceSupabase>,
  cellId: string,
): Promise<ProgramRunBaseInputContext> {
  const { data: cellRecord, error: cellError } = await supabase
    .from("cell")
    .select(
      "id, manual_input, state, row!cell_row_id_fkey(id, idx, table_id), column!cell_column_id_fkey(id, input_template, program_version_id, run_condition, table_id)",
    )
    .eq("id", cellId)
    .maybeSingle();

  if (cellError) {
    throw new Error(cellError.message);
  }

  if (!cellRecord) {
    throw new Error(`No cell found for '${cellId}'.`);
  }

  const row = firstRelation(cellRecord.row);
  const column = firstRelation(cellRecord.column);

  if (!row || !column) {
    throw new Error(
      `Could not resolve execution context for cell '${cellId}'.`,
    );
  }

  const { data: programVersion, error: programVersionError } = await supabase
    .from("program_version")
    .select("id, input_schema")
    .eq("id", column.program_version_id)
    .maybeSingle();

  if (programVersionError) {
    throw new Error(programVersionError.message);
  }

  if (!programVersion) {
    throw new Error(
      `Program version '${column.program_version_id}' was not found.`,
    );
  }

  return {
    cell: {
      id: cellRecord.id,
      manual_input: cellRecord.manual_input,
      state: cellRecord.state,
    },
    column: {
      id: column.id,
      input_template: column.input_template,
      program_version_id: column.program_version_id,
      run_condition: column.run_condition,
      table_id: column.table_id,
    },
    programVersion: {
      id: programVersion.id,
      input_schema: programVersion.input_schema,
    },
    row: {
      id: row.id,
      idx: row.idx,
      table_id: row.table_id,
    },
  };
}

async function loadInputContext(
  supabase: ReturnType<typeof requireServiceSupabase>,
  context: ProgramRunBaseInputContext,
): Promise<ProgramRunInputContext> {
  const { data: dependencies, error: dependenciesError } = await supabase
    .from("column_dependency")
    .select("source_column_id")
    .eq("target_column_id", context.column.id);

  if (dependenciesError) {
    throw new Error(dependenciesError.message);
  }

  const sourceColumnIds =
    dependencies?.map((entry) => entry.source_column_id) ?? [];
  const { data: sourceColumnData, error: sourceColumnError } =
    sourceColumnIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("column")
          .select("id, table_id")
          .in("id", sourceColumnIds);

  if (sourceColumnError) {
    throw new Error(sourceColumnError.message);
  }

  const sourceColumns = sourceColumnData ?? [];
  const externalTableIds = Array.from(
    new Set(
      sourceColumns
        .map((column) => column.table_id)
        .filter((tableId) => tableId !== context.row.table_id),
    ),
  );
  const { data: externalRowData, error: externalRowError } =
    externalTableIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("row")
          .select("id, table_id")
          .eq("idx", context.row.idx)
          .in("table_id", externalTableIds);

  if (externalRowError) {
    throw new Error(externalRowError.message);
  }

  const rowsByTableId = new Map(
    (externalRowData ?? []).map((row) => [
      row.table_id,
      row.id,
    ]),
  );
  const dependencyRowIds = Array.from(
    new Set(
      sourceColumns.flatMap((column) =>
        column.table_id === context.row.table_id
          ? [
              context.row.id,
            ]
          : rowsByTableId.has(column.table_id)
            ? [
                rowsByTableId.get(column.table_id) as string,
              ]
            : [],
      ),
    ),
  );
  const { data: dependencyCellData, error: dependencyCellError } =
    sourceColumns.length === 0 || dependencyRowIds.length === 0
      ? {
          data: [],
          error: null,
        }
      : await supabase
          .from("cell")
          .select("*")
          .in("column_id", sourceColumnIds)
          .in("row_id", dependencyRowIds);

  if (dependencyCellError) {
    throw new Error(dependencyCellError.message);
  }

  const dependencyCellByColumnAndRowId = new Map(
    (dependencyCellData ?? []).map((cell) => [
      `${cell.column_id}:${cell.row_id}`,
      cell,
    ]),
  );
  const dependencyRowIdByColumnId = new Map(
    sourceColumns.map((column) => [
      column.id,
      column.table_id === context.row.table_id
        ? context.row.id
        : rowsByTableId.get(column.table_id),
    ]),
  );
  const columns = Object.fromEntries(
    sourceColumns.map((column) => {
      const rowId = dependencyRowIdByColumnId.get(column.id);
      const cell = rowId
        ? dependencyCellByColumnAndRowId.get(`${column.id}:${rowId}`)
        : undefined;
      const state = cell?.state as
        | {
            ok?: boolean;
            value?: JsonValue;
          }
        | null
        | undefined;
      const ready = state?.ok === true;

      return [
        column.id,
        {
          ready,
          value: ready ? (state.value ?? null) : null,
        },
      ];
    }),
  ) as ProgramRunInputContext["columns"];

  return {
    ...context,
    columns,
  };
}

export class ProgramRunCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  private readonly supabase = () => requireServiceSupabase(this.deps);

  public readonly createPendingForCellIds = async (cellIds: string[]) => {
    const supabase = this.supabase();
    const uniqueCellIds = Array.from(new Set(cellIds));

    if (uniqueCellIds.length === 0) {
      return [] as string[];
    }

    const { data: cells, error: cellError } = await supabase
      .from("cell")
      .select("id, column_id")
      .in("id", uniqueCellIds);

    if (cellError) {
      throw new Error(cellError.message);
    }

    const cellsById = new Map(
      (cells ?? []).map((cell) => [
        cell.id,
        cell,
      ]),
    );

    if (cellsById.size !== uniqueCellIds.length) {
      throw new Error("Could not resolve every cell for execution.");
    }

    const columnIds = Array.from(
      new Set(
        uniqueCellIds.map((cellId) => {
          const cell = cellsById.get(cellId);

          if (!cell) {
            throw new Error(`Cell '${cellId}' was not found.`);
          }

          return cell.column_id;
        }),
      ),
    );
    const { data: columns, error: columnError } = await supabase
      .from("column")
      .select("id, program_version_id")
      .in("id", columnIds);

    if (columnError) {
      throw new Error(columnError.message);
    }

    const programVersionIdByColumnId = new Map(
      (columns ?? []).map((column) => [
        column.id,
        column.program_version_id,
      ]),
    );

    const { error: pendingStateError } = await supabase
      .from("cell")
      .update({
        state: {
          ok: null,
        } as Json,
      })
      .in("id", uniqueCellIds);

    if (pendingStateError) {
      throw new Error(pendingStateError.message);
    }

    const { data: runs, error: runError } = await supabase
      .from("program_run")
      .insert(
        uniqueCellIds.map((cellId) => {
          const cell = cellsById.get(cellId);

          if (!cell) {
            throw new Error(`Cell '${cellId}' was not found.`);
          }

          const programVersionId = programVersionIdByColumnId.get(
            cell.column_id,
          );

          if (!programVersionId) {
            throw new Error(
              `Program version for column '${cell.column_id}' was not found.`,
            );
          }

          return {
            program_version_id: programVersionId,
            target_cell_id: cellId,
          };
        }),
      )
      .select("id, target_cell_id");

    if (runError) {
      throw new Error(runError.message);
    }

    const runIdByCellId = new Map(
      (runs ?? []).map((run) => [
        run.target_cell_id,
        run.id,
      ]),
    );

    return uniqueCellIds.map((cellId) => {
      const runId = runIdByCellId.get(cellId);

      if (!runId) {
        throw new Error(`Run for cell '${cellId}' was not created.`);
      }

      return runId;
    });
  };

  public readonly loadMany = async (runIds: string[]) => {
    const supabase = this.supabase();
    const uniqueRunIds = Array.from(new Set(runIds));

    if (uniqueRunIds.length === 0) {
      return [] as StoredProgramRun[];
    }

    const { data, error } = await supabase
      .from("program_run")
      .select(STORED_RUN_SELECT)
      .in("id", uniqueRunIds);

    if (error) {
      throw new Error(error.message);
    }

    const runsById = new Map(
      (data ?? []).map((run) => [
        run.id,
        run,
      ]),
    );

    for (const runId of uniqueRunIds) {
      if (!runsById.has(runId)) {
        throw new Error(`No run found for '${runId}'.`);
      }
    }

    return runIds.map((runId) => {
      const run = runsById.get(runId);

      if (!run) {
        throw new Error(`No run found for '${runId}'.`);
      }

      return run;
    });
  };

  public readonly persistFailure = async (
    run: StoredProgramRun,
    failState: JsonValue,
  ) => {
    const supabase = this.supabase();
    const results = await Promise.all([
      supabase
        .from("cell")
        .update({
          state: failState as Json,
        })
        .eq("id", run.target_cell_id),
      supabase
        .from("program_run")
        .update({
          output: failState as Json,
        })
        .eq("id", run.id),
    ]);

    for (const result of results) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }
  };

  public readonly persistSuccess = async (input: {
    output: JsonValue;
    parsedInput: JsonValue;
    run: StoredProgramRun;
  }) => {
    const supabase = this.supabase();
    const results = await Promise.all([
      supabase
        .from("cell")
        .update({
          state: input.output as Json,
        })
        .eq("id", input.run.target_cell_id),
      supabase
        .from("program_run")
        .update({
          input: input.parsedInput as Json,
          output: input.output as Json,
        })
        .eq("id", input.run.id),
    ]);

    for (const result of results) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }
  };

  public readonly loadInputContextForRun = async (run: StoredProgramRun) => {
    return loadInputContext(
      this.supabase(),
      createExecutionInputContextFromStoredRun(run),
    );
  };

  public readonly loadInputContextForCellId = async (cellId: string) => {
    return loadInputContext(
      this.supabase(),
      await loadExecutionInputContextForCell(this.supabase(), cellId),
    );
  };

  public readonly setCellState = async (input: {
    cellId: string;
    state: JsonValue;
  }) => {
    const { error } = await this.supabase()
      .from("cell")
      .update({
        state: input.state as Json,
      })
      .eq("id", input.cellId);

    if (error) {
      throw new Error(error.message);
    }
  };

  public readonly listDependentCandidateCellIds = async (input: {
    requestId?: string;
    successfulRuns: StoredProgramRun[];
    visitedCellIds: Set<string>;
  }) => {
    const supabase = this.supabase();
    const sourceColumnIds = Array.from(
      new Set(input.successfulRuns.map((run) => run.cell.column.id)),
    );

    if (sourceColumnIds.length === 0) {
      return [] as string[];
    }

    const { data: dependencies, error: dependencyError } = await supabase
      .from("column_dependency")
      .select("source_column_id, target_column_id")
      .in("source_column_id", sourceColumnIds);

    if (dependencyError) {
      throw new Error(dependencyError.message);
    }

    const dependencyRows = dependencies ?? [];

    if (dependencyRows.length === 0) {
      return [] as string[];
    }

    const targetColumnIds = Array.from(
      new Set(dependencyRows.map((dependency) => dependency.target_column_id)),
    );
    const { data: targetColumns, error: targetColumnError } = await supabase
      .from("column")
      .select("id, table_id, run_condition")
      .in("id", targetColumnIds);

    if (targetColumnError) {
      throw new Error(targetColumnError.message);
    }

    const targetColumnById = new Map(
      (targetColumns ?? [])
        .filter((column) => column.run_condition === true)
        .map((column) => [
          column.id,
          column,
        ]),
    );

    if (targetColumnById.size === 0) {
      return [] as string[];
    }

    const targetColumnIdsBySourceColumnId = new Map<string, string[]>();

    for (const dependency of dependencyRows) {
      if (!targetColumnById.has(dependency.target_column_id)) {
        continue;
      }

      const current =
        targetColumnIdsBySourceColumnId.get(dependency.source_column_id) ?? [];

      current.push(dependency.target_column_id);
      targetColumnIdsBySourceColumnId.set(dependency.source_column_id, current);
    }

    const externalTableIds = new Set<string>();
    const externalIdxValues = new Set<number>();

    for (const run of input.successfulRuns) {
      const row = firstRelation(run.cell.row);

      if (!row) {
        continue;
      }

      for (const targetColumnId of targetColumnIdsBySourceColumnId.get(
        run.cell.column.id,
      ) ?? []) {
        const targetColumn = targetColumnById.get(targetColumnId);

        if (!targetColumn || targetColumn.table_id === row.table_id) {
          continue;
        }

        externalTableIds.add(targetColumn.table_id);
        externalIdxValues.add(row.idx);
      }
    }

    const { data: externalRows, error: externalRowError } =
      externalTableIds.size === 0 || externalIdxValues.size === 0
        ? {
            data: [],
            error: null,
          }
        : await supabase
            .from("row")
            .select("id, idx, table_id")
            .in("table_id", Array.from(externalTableIds))
            .in("idx", Array.from(externalIdxValues));

    if (externalRowError) {
      throw new Error(externalRowError.message);
    }

    const rowIdByTableAndIdx = new Map(
      (externalRows ?? []).map((row) => [
        `${row.table_id}:${row.idx}`,
        row.id,
      ]),
    );
    const candidatePairs = new Map<
      string,
      {
        columnId: string;
        rowId: string;
      }
    >();

    for (const run of input.successfulRuns) {
      const row = firstRelation(run.cell.row);

      if (!row) {
        continue;
      }

      for (const targetColumnId of targetColumnIdsBySourceColumnId.get(
        run.cell.column.id,
      ) ?? []) {
        const targetColumn = targetColumnById.get(targetColumnId);

        if (!targetColumn) {
          continue;
        }

        const targetRowId =
          targetColumn.table_id === row.table_id
            ? row.id
            : rowIdByTableAndIdx.get(`${targetColumn.table_id}:${row.idx}`);

        if (!targetRowId) {
          continue;
        }

        candidatePairs.set(`${targetRowId}:${targetColumn.id}`, {
          columnId: targetColumn.id,
          rowId: targetRowId,
        });
      }
    }

    if (candidatePairs.size === 0) {
      return [] as string[];
    }

    const candidatePairValues = Array.from(candidatePairs.values());
    const { data: candidateCells, error: candidateCellError } = await supabase
      .from("cell")
      .select("id, row_id, column_id")
      .in(
        "row_id",
        Array.from(new Set(candidatePairValues.map((pair) => pair.rowId))),
      )
      .in(
        "column_id",
        Array.from(new Set(candidatePairValues.map((pair) => pair.columnId))),
      );

    if (candidateCellError) {
      throw new Error(candidateCellError.message);
    }

    const candidateCellIdByPair = new Map(
      (candidateCells ?? []).map((cell) => [
        `${cell.row_id}:${cell.column_id}`,
        cell.id,
      ]),
    );
    const candidateCellIds = Array.from(
      new Set(
        candidatePairValues
          .map((pair) =>
            candidateCellIdByPair.get(`${pair.rowId}:${pair.columnId}`),
          )
          .filter((cellId): cellId is string => cellId !== undefined),
      ),
    ).filter((cellId) => !input.visitedCellIds.has(cellId));

    return candidateCellIds;
  };

  public readonly resolveOwnerUserIdForProfile = (profileId: string) =>
    resolveOwnerUserIdForProfile(this.supabase(), profileId);

  public readonly resolveEnvironmentVariablesForSecretDeclarations = (options: {
    columnId?: string;
    declarations: ProgramSecretDeclaration[];
    ownerUserId: string;
    programId: string;
  }) => {
    return resolveDeclaredEnvironmentVariables(this.supabase(), options);
  };

  private readonly loadProgramVersionFiles = async (
    programVersionId: string,
  ): Promise<ProgramFile[]> => {
    const { data, error } = await this.supabase()
      .from("program_file")
      .select("*")
      .eq("version_id", programVersionId);

    if (error) {
      throw new Error(error.message);
    }

    return data ?? [];
  };

  public readonly loadProgramVersionTestData = async (
    programVersionId: string,
  ): Promise<ProgramVersionTestData> => {
    const [files, versionRecord] = await Promise.all([
      this.loadProgramVersionFiles(programVersionId),
      this.supabase()
        .from("program_version")
        .select("output_config, program_id, secret_config")
        .eq("id", programVersionId)
        .maybeSingle(),
    ]);

    if (versionRecord.error) {
      throw new Error(versionRecord.error.message);
    }

    if (!versionRecord.data) {
      throw new Error(`Program version '${programVersionId}' was not found`);
    }

    return {
      files,
      outputConfig: versionRecord.data.output_config,
      programId: versionRecord.data.program_id,
      secretConfig: versionRecord.data.secret_config,
    };
  };
}
