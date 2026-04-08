"use server";

import type { Database } from "@marble/supabase";
import { createClient } from "@marble/supabase";
import { requireUser } from "../../lib/auth";

type Program = Database["public"]["Tables"]["program"]["Row"];

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

export async function listPrograms(): Promise<Program[]> {
  await requireUser();
  const { data, error } = await db()
    .from("program")
    .select("*")
    .order("created_at");
  if (error) throw error;
  return data;
}

async function ensureDemoUser(): Promise<string> {
  const supabase = db();
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({
    perPage: 1,
  });
  if (users.length > 0) return users[0].id;

  const {
    data: { user },
    error,
  } = await supabase.auth.admin.createUser({
    email: "demo@marble.local",
    password: "marble-demo-password",
    email_confirm: true,
  });
  if (error) throw error;
  if (!user) throw new Error("Failed to create demo user");
  return user.id;
}

export async function testProgram(
  programId: string,
  inputConfig: Record<string, unknown>,
  manualInput?: string,
): Promise<{
  ok: boolean;
  output: unknown;
  error?: string;
}> {
  await requireUser();
  const supabase = db();
  const userId = await ensureDemoUser();

  // Grab any table — we just need somewhere to hang a column/row/cell
  const { data: tables } = await supabase
    .from("table")
    .select("id")
    .limit(1)
    .single();

  let tableId = tables?.id;
  if (!tableId) {
    const { data, error } = await supabase
      .from("table")
      .insert({})
      .select("id")
      .single();
    if (error || !data) throw new Error("Failed to create test table");
    tableId = data.id;
  }

  // Timestamp-seeded index avoids UNIQUE(table_id, index) races
  const ts = Date.now();

  const { data: col, error: colErr } = await supabase
    .from("column")
    .insert({
      table_id: tableId,
      name: `__test_${ts}`,
      index: ts,
      program_id: programId,
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
      index: ts,
    })
    .select("id")
    .single();
  if (rowErr) throw rowErr;

  // Cell
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

  // Program run
  const { data: run, error: runErr } = await supabase
    .from("program_run")
    .insert({
      program_id: programId,
      target_cell_id: cell.id,
      instigating_user_id: userId,
    })
    .select("id")
    .single();
  if (runErr) throw runErr;

  // Hit executor
  const executorUrl = process.env.EXECUTOR_URL ?? "http://localhost:8787";
  try {
    const res = await fetch(`${executorUrl}?run_id=${run.id}`, {
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
    if (result.error) {
      return {
        ok: false,
        output: null,
        error: result.message,
      };
    }
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
