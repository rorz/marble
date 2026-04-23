"use server";

import type { Database } from "@marble/supabase";
import { requireUser } from "../../../lib/auth";
import { callMarbleApi } from "../../../lib/marble-api";
import type { ProgramSecretConfig } from "../../../lib/program-manifest";
import {
  listProgramSecretBindingsForUser,
  listSecretsForUser,
  type SecretBindingMap,
} from "../../../lib/secret-data";
import {
  createServiceRoleClient,
  listOwnedProfileIds,
} from "../../../lib/supabase/service-role";

type Program = Database["public"]["Tables"]["program"]["Row"];
type ProgramVersion = Database["public"]["Tables"]["program_version"]["Row"];
type ProgramFile = Database["public"]["Tables"]["program_file"]["Row"];
type EditableProgramFile = {
  content: string;
  filename: string;
  filetype: "TypeScript" | "Json" | "Markdown";
};
type RunReturnValue =
  | {
      ok: true;
      value: unknown;
    }
  | {
      error?: {
        detail?: unknown;
        type?: string;
      };
      message: string;
      ok: false;
    };
type RunExecutionResult = {
  output: RunReturnValue;
  success: boolean;
};
type SecretBindingInput = {
  envName: string;
  secretId: string;
};

export type FullProgram = Program & {
  program_version: (ProgramVersion & {
    program_file: ProgramFile[];
  })[];
};
export type ProgramsPageData = {
  programSecretBindings: SecretBindingMap;
  programs: FullProgram[];
  secrets: Awaited<ReturnType<typeof listSecretsForUser>>;
};
const PROGRAM_SELECT =
  "*, program_version!program_version_program_id_fkey(*, program_file(*))";

function db() {
  return createServiceRoleClient();
}

type ProgramVersionWithFiles = ProgramVersion & {
  files: ProgramFile[];
};

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

export async function loadProgramsPageData(): Promise<ProgramsPageData> {
  const user = await requireUser();
  const programs = await listPrograms();
  const [secrets, programSecretBindings] = await Promise.all([
    listSecretsForUser(user.id),
    listProgramSecretBindingsForUser(
      user.id,
      programs.map((program) => program.id),
    ),
  ]);

  return {
    programSecretBindings,
    programs,
    secrets,
  };
}

async function patchProgramVersion(
  programVersionId: string,
  body: {
    files?: EditableProgramFile[];
    inputSchema?: unknown;
    outputConfig?: unknown;
    publish?: boolean;
    secretConfig?: ProgramSecretConfig;
  },
) {
  return callMarbleApi<ProgramVersionWithFiles>(
    `/program-versions/${programVersionId}`,
    {
      body,
      method: "PATCH",
      requestId: crypto.randomUUID(),
    },
  );
}

export async function createDraftVersion(
  programId: string,
  inputSchema: unknown,
  outputConfig: unknown,
  files: EditableProgramFile[],
  secretConfig: ProgramSecretConfig,
) {
  const version = await callMarbleApi<ProgramVersionWithFiles>(
    "/program-versions",
    {
      body: {
        files,
        inputSchema,
        outputConfig,
        programId,
        publish: false,
        secretConfig,
      },
      method: "POST",
      requestId: crypto.randomUUID(),
    },
  );

  return {
    programId,
    version,
  };
}

export async function syncDraftVersion(
  programVersionId: string,
  inputSchema: unknown,
  outputConfig: unknown,
  files: EditableProgramFile[],
  secretConfig: ProgramSecretConfig,
) {
  return patchProgramVersion(programVersionId, {
    files,
    inputSchema,
    outputConfig,
    secretConfig,
  });
}

export async function publishDraftVersion(
  programVersionId: string,
  inputSchema: unknown,
  outputConfig: unknown,
  files: EditableProgramFile[],
  secretConfig: ProgramSecretConfig,
) {
  return patchProgramVersion(programVersionId, {
    files,
    inputSchema,
    outputConfig,
    publish: true,
    secretConfig,
  });
}

export async function createProgram() {
  const files = createDefaultProgramFiles(DEFAULT_PROGRAM_NAME);
  const program = await callMarbleApi<
    Program & {
      initialVersion: ProgramVersionWithFiles;
    }
  >("/programs", {
    body: {
      initialVersion: {
        files,
        inputSchema: DEFAULT_PROGRAM_INPUT_SCHEMA,
        outputConfig: DEFAULT_PROGRAM_OUTPUT_CONFIG,
        publish: false,
        secretConfig: [],
      },
      name: DEFAULT_PROGRAM_NAME,
    },
    method: "POST",
    requestId: crypto.randomUUID(),
  });

  return {
    programId: program.id,
    versionId: program.initialVersion.id,
  };
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
  detail?: unknown;
  error?: string;
  errorType?: string;
}> {
  const result = await callMarbleApi<RunExecutionResult>(
    `/test?programVersionId=${encodeURIComponent(programVersionId)}`,
    {
      allowErrorStatus: true,
      body: {
        input:
          manualInput === undefined
            ? inputConfig
            : {
                cell: {
                  manualInputValue: manualInput,
                },
                input: inputConfig,
                system: {},
              },
      },
      method: "POST",
      requestId: crypto.randomUUID(),
    },
  );

  if (result.output.ok) {
    return {
      ok: true,
      output: result.output.value,
    };
  }

  return {
    detail: result.output.error?.detail,
    error: result.output.message,
    errorType: result.output.error?.type,
    ok: false,
    output: null,
  };
}

export async function updateProgramSecretBindings(
  programId: string,
  bindings: SecretBindingInput[],
) {
  return callMarbleApi<SecretBindingInput[]>(`/programs/${programId}/secrets`, {
    body: {
      bindings,
    },
    method: "PUT",
    requestId: crypto.randomUUID(),
  });
}
