"use server";

import type { Database, Json } from "@marble/supabase";
import { createClient } from "@marble/supabase";
import { env } from "@/env";
import { requireUser } from "../../lib/auth";

type Program = Database["public"]["Tables"]["program"]["Row"];
type ProgramVersion = Database["public"]["Tables"]["program_version"]["Row"];
type ProgramFile = Database["public"]["Tables"]["program_file"]["Row"];

export type FullProgram = Program & {
  program_version: (ProgramVersion & {
    program_file: ProgramFile[];
  })[];
};

function db() {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

export async function listPrograms(): Promise<FullProgram[]> {
  await requireUser();
  const { data, error } = await db()
    .from("program")
    .select(
      "*, program_version!program_version_program_id_fkey(*, program_file(*))",
    )
    .order("created_at");
  if (error) throw error;
  return data as unknown as FullProgram[];
}

export async function saveProgramVersion(
  programId: string | null,
  name: string,
  inputSchema: unknown,
  outputConfig: unknown,
  files: {
    filename: string;
    content: string;
    filetype: "TypeScript" | "Json" | "Markdown";
  }[],
) {
  const user = await requireUser();
  const supabase = db();

  const { data: profile } = await supabase
    .from("profile")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");

  let pId = programId;

  if (!pId) {
    const { data: newProgram, error: progErr } = await supabase
      .from("program")
      .insert({
        name,
        owner_profile_id: profile.id,
      })
      .select()
      .single();
    if (progErr) throw progErr;
    pId = newProgram.id;
  }

  const { data: existingVersions } = await supabase
    .from("program_version")
    .select("version")
    .eq("program_id", pId)
    .order("version", {
      ascending: false,
    })
    .limit(1);

  const nextVersion = existingVersions?.length
    ? existingVersions[0].version + 1
    : 1;

  const { data: version, error: versionErr } = await supabase
    .from("program_version")
    .insert({
      program_id: pId,
      version: nextVersion,
      input_schema: inputSchema as Json,
      output_config: outputConfig as Json,
    })
    .select()
    .single();

  if (versionErr) throw versionErr;

  const filesToInsert = files.map((f) => ({
    owner_profile_id: profile.id,
    version_id: version.id,
    filename: f.filename,
    content: f.content,
    filetype: f.filetype,
  }));

  if (filesToInsert.length > 0) {
    const { error: filesErr } = await supabase
      .from("program_file")
      .insert(filesToInsert);
    if (filesErr) throw filesErr;
  }

  return {
    programId: pId,
    versionId: version.id,
  };
}

export async function testProgram(
  programVersionId: string,
  inputConfig: Record<string, unknown>,
  manualInput?: string,
): Promise<{
  ok: boolean;
  output: unknown;
  error?: string;
}> {
  await requireUser();
  const supabase = db();

  const { data: tables } = await supabase
    .from("table")
    .select("id")
    .limit(1)
    .single();

  let tableId = tables?.id;
  if (!tableId) {
    // we need an owner for the table
    const { data: user } = await supabase.auth.admin.listUsers({
      perPage: 1,
    });
    const { data: profile } = await supabase
      .from("profile")
      .select("id")
      .eq("owner_user_id", user.users[0].id)
      .single();

    if (!profile) throw new Error("Could not find demo profile");

    const { data, error } = await supabase
      .from("table")
      .insert({
        owner_profile_id: profile.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Failed to create test table");
    tableId = data.id;
  }

  const ts = Date.now();

  const { data: col, error: colErr } = await supabase
    .from("column")
    .insert({
      table_id: tableId,
      name: `__test_${ts}`,
      idx: ts,
      program_version_id: programVersionId,
      input_template: JSON.stringify(inputConfig),
      output_schema: {},
    })
    .select("id")
    .single();
  if (colErr) throw colErr;

  const { data: row, error: rowErr } = await supabase
    .from("row")
    .insert({
      table_id: tableId,
      idx: ts,
    })
    .select("id")
    .single();
  if (rowErr) throw rowErr;

  const { data: cell, error: cellErr } = await supabase
    .from("cell")
    .insert({
      column_id: col.id,
      row_id: row.id,
      manual_input: manualInput ?? null,
    })
    .select("id")
    .single();
  if (cellErr) throw cellErr;

  const { data: run, error: runErr } = await supabase
    .from("program_run")
    .insert({
      program_version_id: programVersionId,
      target_cell_id: cell.id,
    })
    .select("id")
    .single();
  if (runErr) throw runErr;

  const executorUrl = env.EXECUTOR_URL;
  try {
    const res = await fetch(`${executorUrl}/run?run_id=${run.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const result = (await res.json()) as {
      success?: boolean;
      output?: unknown;
      error?: boolean;
      message?: string;
    };
    if (result.error)
      return {
        ok: false,
        output: null,
        error: result.message,
      };
    return {
      ok: true,
      output: result.output,
    };
  } catch (err) {
    return {
      ok: false,
      output: null,
      error: `Executor unreachable at ${executorUrl}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
