import type { Json, SupabaseClient } from "@marble/supabase";
import { z } from "zod";

export type JsonValue = Json;

const STORED_RUN_SELECT = `*, program_version(*, program!program_version_program_id_fkey(*), program_file(*)), cell!target_cell_id(*, row!cell_row_id_fkey(*, table!row_table_id_fkey(*, project!table_project_id_fkey(*, profile!project_owner_profile_id_fkey(*)))), column!cell_column_id_fkey(*))`;

export const executionSecretSchema = z.object({
  category: z.enum([
    "Managed",
    "UserDefined",
  ]),
  id: z.string().uuid(),
  name: z.string(),
  value: z.string(),
});

export const secretBindingSchema = z.object({
  env_name: z.string(),
  secret_id: z.string().uuid(),
});

export function firstRelation<T>(
  value: T | T[] | null | undefined,
): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

async function loadStoredRun(supabase: SupabaseClient, runId: string) {
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
