"use server";

import type { Database } from "@marble/supabase";
import { env } from "@/env";
import { requireUser } from "../../lib/auth";
import { callMarbleApi } from "../../lib/marble-api";
import {
  createServiceRoleClient,
  resolveOwnedProfileId,
} from "../../lib/supabase/service-role";

type CellRow = Database["public"]["Tables"]["cell"]["Row"];
type Program = Database["public"]["Tables"]["program"]["Row"];
type ProgramRunRow = Database["public"]["Tables"]["program_run"]["Row"];
type ProgramVersion = Database["public"]["Tables"]["program_version"]["Row"];
type ProgramFile = Database["public"]["Tables"]["program_file"]["Row"];
type RowRow = Database["public"]["Tables"]["row"]["Row"];
type TableRow = Database["public"]["Tables"]["table"]["Row"];
type ColumnRow = Database["public"]["Tables"]["column"]["Row"];

export type FullProgram = Program & {
  program_version: (ProgramVersion & {
    program_file: ProgramFile[];
  })[];
};

function db() {
  return createServiceRoleClient();
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
  const requestId = crypto.randomUUID();

  if (programId) {
    const version = await callMarbleApi<
      ProgramVersion & {
        files: ProgramFile[];
      }
    >("/program-versions", {
      body: {
        files,
        inputSchema,
        outputConfig,
        programId,
      },
      method: "POST",
      requestId,
    });

    return {
      programId,
      versionId: version.id,
    };
  }

  const program = await callMarbleApi<
    Program & {
      initialVersion: ProgramVersion & {
        files: ProgramFile[];
      };
    }
  >("/programs", {
    body: {
      initialVersion: {
        files,
        inputSchema,
        outputConfig,
      },
      name,
    },
    method: "POST",
    requestId,
  });

  return {
    programId: program.id,
    versionId: program.initialVersion.id,
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
  const user = await requireUser();
  const actorProfileId = await resolveOwnedProfileId(user.id);
  const requestId = crypto.randomUUID();
  const { data: existingTable, error: tableError } = await db()
    .from("table")
    .select("id")
    .eq("owner_profile_id", actorProfileId)
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (tableError) {
    throw tableError;
  }

  const table =
    existingTable ??
    (await callMarbleApi<TableRow>("/tables", {
      method: "POST",
      requestId,
    }));
  const ts = Date.now();
  const column = await callMarbleApi<
    ColumnRow & {
      cells: CellRow[];
    }
  >("/columns", {
    body: {
      idx: ts,
      inputTemplate: JSON.stringify(inputConfig),
      name: `__test_${ts}`,
      outputSchema: {},
      programVersionId,
      tableId: table.id,
    },
    method: "POST",
    requestId,
  });
  const row = await callMarbleApi<RowRow>(`/tables/${table.id}/rows`, {
    body: {
      idx: ts,
    },
    method: "POST",
    requestId,
  });
  const cells = await callMarbleApi<CellRow[]>(`/rows/${row.id}/cells`, {
    requestId,
  });
  const cell = cells.find((candidate) => candidate.column_id === column.id);

  if (!cell) {
    throw new Error("Failed to resolve test cell");
  }

  if (manualInput !== undefined) {
    await callMarbleApi<CellRow>(`/cells/${cell.id}`, {
      body: {
        manualInput,
      },
      method: "PATCH",
      requestId,
    });
  }

  const run = await callMarbleApi<ProgramRunRow>("/program-runs", {
    body: {
      programVersionId,
      targetCellId: cell.id,
    },
    method: "POST",
    requestId,
  });
  const executorUrl = env.EXECUTOR_URL;

  try {
    const res = await fetch(`${executorUrl}/run?run_id=${run.id}`, {
      body: "{}",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const result = (await res.json()) as {
      error?: boolean;
      message?: string;
      output?: unknown;
      success?: boolean;
    };

    if (result.error) {
      return {
        error: result.message,
        ok: false,
        output: null,
      };
    }

    return {
      ok: true,
      output: result.output,
    };
  } catch (err) {
    return {
      error: `Executor unreachable at ${executorUrl}: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
      output: null,
    };
  }
}
