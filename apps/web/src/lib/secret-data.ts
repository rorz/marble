import "server-only";
import type { Database } from "@marble/supabase";
import {
  listProgramSecretDeclarationsFromFiles,
  type ProgramManifestSecretDeclaration,
  parseProgramSecretConfig,
} from "./program-manifest";
import { createServiceRoleClient } from "./supabase/service-role";

type SecretRow = Pick<
  Database["public"]["Tables"]["secret"]["Row"],
  "category" | "created_at" | "id" | "name" | "owner_user_id" | "updated_at"
>;
type ProgramSecretBindingRow = Pick<
  Database["public"]["Tables"]["program_secret_binding"]["Row"],
  "env_name" | "program_id" | "secret_id"
>;
type ColumnSecretBindingRow = Pick<
  Database["public"]["Tables"]["column_secret_binding"]["Row"],
  "column_id" | "env_name" | "secret_id"
>;
type ProgramFileLike = Pick<
  Database["public"]["Tables"]["program_file"]["Row"],
  "content" | "filename"
>;

type SecretRecord = SecretRow;
export type SecretBindingMap = Record<string, Record<string, string>>;

type ProgramWithVersionsLike = {
  id: string;
  program_version: Array<{
    program_file: ProgramFileLike[] | null;
    secret_config: unknown;
    version: number | null;
  }>;
};

function db() {
  return createServiceRoleClient();
}

function mapBindingsByTarget<
  Row extends {
    env_name: string;
    secret_id: string;
  },
>(rows: Row[], getTargetId: (row: Row) => string) {
  const bindings: SecretBindingMap = {};

  for (const row of rows) {
    const targetId = getTargetId(row);
    const currentTargetBindings = bindings[targetId] ?? {};

    bindings[targetId] = {
      ...currentTargetBindings,
      [row.env_name]: row.secret_id,
    };
  }

  return bindings;
}

function getLatestPublishedProgramVersion(program: ProgramWithVersionsLike) {
  return (
    [
      ...program.program_version,
    ]
      .filter((version) => version.version !== null)
      .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))[0] ??
    null
  );
}

export async function listSecretsForUser(userId: string) {
  const { data, error } = await db()
    .from("secret")
    .select("category, created_at, id, name, owner_user_id, updated_at")
    .eq("owner_user_id", userId)
    .order("name", {
      ascending: true,
    })
    .order("category", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as SecretRecord[];
}

export async function listProgramSecretBindingsForUser(
  userId: string,
  programIds: string[],
) {
  if (programIds.length === 0) {
    return {} satisfies SecretBindingMap;
  }

  const { data, error } = await db()
    .from("program_secret_binding")
    .select("env_name, program_id, secret_id")
    .eq("owner_user_id", userId)
    .in("program_id", programIds)
    .order("program_id", {
      ascending: true,
    })
    .order("env_name", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return mapBindingsByTarget(
    (data ?? []) as ProgramSecretBindingRow[],
    (binding) => binding.program_id,
  );
}

export async function listColumnSecretBindings(columnIds: string[]) {
  if (columnIds.length === 0) {
    return {} satisfies SecretBindingMap;
  }

  const { data, error } = await db()
    .from("column_secret_binding")
    .select("column_id, env_name, secret_id")
    .in("column_id", columnIds)
    .order("column_id", {
      ascending: true,
    })
    .order("env_name", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return mapBindingsByTarget(
    (data ?? []) as ColumnSecretBindingRow[],
    (binding) => binding.column_id,
  );
}

export function listLatestProgramSecretDeclarationsByProgramId(
  programs: ProgramWithVersionsLike[],
) {
  return Object.fromEntries(
    programs.map((program) => {
      const latestVersion = getLatestPublishedProgramVersion(program);

      return [
        program.id,
        latestVersion?.secret_config === null ||
        latestVersion?.secret_config === undefined
          ? listProgramSecretDeclarationsFromFiles(
              latestVersion?.program_file ?? [],
            )
          : parseProgramSecretConfig(latestVersion.secret_config),
      ];
    }),
  ) as Record<string, ProgramManifestSecretDeclaration[]>;
}
