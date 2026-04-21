"use server";

import type { Database } from "@marble/supabase";
import { requireUser } from "../../../lib/auth";
import { callMarbleApi } from "../../../lib/marble-api";
import {
  createServiceRoleClient,
  listOwnedProfileIds,
  resolveOwnedProfileId,
} from "../../../lib/supabase/service-role";

type CellRow = Database["public"]["Tables"]["cell"]["Row"];
type Program = Database["public"]["Tables"]["program"]["Row"];
type ProgramVersion = Database["public"]["Tables"]["program_version"]["Row"];
type ProgramFile = Database["public"]["Tables"]["program_file"]["Row"];
type RowRow = Database["public"]["Tables"]["row"]["Row"];
type ProjectRow = Database["public"]["Tables"]["project"]["Row"];
type TableRow = Database["public"]["Tables"]["table"]["Row"];
type ColumnRow = Database["public"]["Tables"]["column"]["Row"];
type EditableProgramFile = {
  content: string;
  filename: string;
  filetype: "TypeScript" | "Json" | "Markdown";
};
type RunExecutionResult = {
  error?: boolean;
  message?: string;
  output?: unknown;
  runId: string;
  success: boolean;
};

export type FullProgram = Program & {
  program_version: (ProgramVersion & {
    program_file: ProgramFile[];
  })[];
};
const PROGRAM_SELECT =
  "*, program_version!program_version_program_id_fkey(*, program_file(*))";

function db() {
  return createServiceRoleClient();
}

const DEFAULT_PROGRAM_NAME = "Untitled Program";
const DEFAULT_PROGRAM_INPUT_SCHEMA = {
  additionalProperties: true,
  properties: {},
  type: "object",
} satisfies Record<string, unknown>;
const DEFAULT_PROGRAM_OUTPUT_CONFIG = {
  flags: {
    allowInference: true,
  },
  schema: {
    additionalProperties: true,
    description: "Program result",
    type: "object",
  },
} satisfies Record<string, unknown>;
const DEFAULT_PROGRAM_MAIN_FILE = `export default async function ({ input, cell, system }) {
  void cell;
  void system;

  return input;
}
`;

function createDefaultProgramFiles(name: string): EditableProgramFile[] {
  return [
    {
      content: `{
  "name": ${JSON.stringify(name)}
}
`,
      filename: "package.json",
      filetype: "Json",
    },
    {
      content: DEFAULT_PROGRAM_MAIN_FILE,
      filename: "main.ts",
      filetype: "TypeScript",
    },
  ];
}

export async function listPrograms(): Promise<FullProgram[]> {
  const user = await requireUser();
  const ownedProfileIds = await listOwnedProfileIds(user.id);
  const supabase = db();

  const [firstPartyResult, ownedResult] = await Promise.all([
    supabase.from("program").select(PROGRAM_SELECT).eq("first_party", true),
    ownedProfileIds.length === 0
      ? Promise.resolve({
          data: [],
          error: null,
        })
      : supabase
          .from("program")
          .select(PROGRAM_SELECT)
          .in("owner_profile_id", ownedProfileIds),
  ]);

  if (firstPartyResult.error) {
    throw firstPartyResult.error;
  }

  if (ownedResult.error) {
    throw ownedResult.error;
  }

  const merged = new Map<string, FullProgram>();

  for (const program of [
    ...(firstPartyResult.data ?? []),
    ...(ownedResult.data ?? []),
  ]) {
    merged.set(program.id, program as FullProgram);
  }

  return [
    ...merged.values(),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveProgramVersion(
  programId: string | null,
  name: string,
  inputSchema: unknown,
  outputConfig: unknown,
  files: EditableProgramFile[],
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

export async function createProgram() {
  return saveProgramVersion(
    null,
    DEFAULT_PROGRAM_NAME,
    DEFAULT_PROGRAM_INPUT_SCHEMA,
    DEFAULT_PROGRAM_OUTPUT_CONFIG,
    createDefaultProgramFiles(DEFAULT_PROGRAM_NAME),
  );
}

export async function renameProgram(programId: string, name: string) {
  return callMarbleApi<Program>(`/programs/${programId}`, {
    body: {
      name,
    },
    method: "PATCH",
    requestId: crypto.randomUUID(),
  });
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
  const { data: existingProject, error: projectError } = await db()
    .from("project")
    .select("id")
    .eq("owner_profile_id", actorProfileId)
    .order("created_at", {
      ascending: true,
    })
    .limit(1)
    .maybeSingle();

  if (projectError) {
    throw projectError;
  }

  const project =
    existingProject ??
    (await callMarbleApi<ProjectRow>("/projects", {
      method: "POST",
      profileId: actorProfileId,
      requestId,
    }));
  const { data: existingTable, error: tableError } = await db()
    .from("table")
    .select("id")
    .eq("project_id", project.id)
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
    (await callMarbleApi<TableRow>(`/projects/${project.id}/tables`, {
      method: "POST",
      profileId: actorProfileId,
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

  const result = await callMarbleApi<RunExecutionResult>(
    `/cells/${cell.id}/run`,
    {
      body: {
        ...(manualInput === undefined
          ? {}
          : {
              manualInput,
            }),
      },
      method: "POST",
      requestId,
    },
  );

  if (result.error) {
    return {
      error: result.message,
      ok: false,
      output: null,
    };
  }

  return {
    ok: result.success,
    output: result.output,
  };
}
