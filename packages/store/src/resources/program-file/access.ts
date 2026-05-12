import type { ResourceDeps } from "../../db";
import { type DbRow, type Entity, toCamelKeys } from "../../types";

type ProgramAccess = {
  firstParty: boolean;
  ownerProfileId: string;
};

type ProgramVersionAccess = Entity<"program_version"> & {
  program: ProgramAccess;
};

export function requireServiceSupabase(deps: ResourceDeps) {
  if (!deps.serviceSupabase) {
    throw new Error(
      "Program file operations require a service Supabase client.",
    );
  }

  return deps.serviceSupabase;
}

function requireUserId(deps: ResourceDeps) {
  if (!deps.context.userId) {
    throw new Error("Program file operations require a user session.");
  }

  return deps.context.userId;
}

async function listOwnedProfileIds(deps: ResourceDeps) {
  const { data, error } = await requireServiceSupabase(deps)
    .from("profile")
    .select("id")
    .eq("owner_user_id", requireUserId(deps));

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((profile) => profile.id));
}

async function getVersionAccess(
  deps: ResourceDeps,
  versionId: string,
): Promise<ProgramVersionAccess> {
  const supabase = requireServiceSupabase(deps);
  const { data: version, error: versionError } = await supabase
    .from("program_version")
    .select("*")
    .eq("id", versionId)
    .single();

  if (versionError || !version) {
    throw new Error(versionError?.message ?? "Program version not found.");
  }

  const { data: program, error: programError } = await supabase
    .from("program")
    .select("first_party, owner_profile_id")
    .eq("id", version.program_id)
    .single();

  if (programError || !program) {
    throw new Error(programError?.message ?? "Program not found.");
  }

  return {
    ...toCamelKeys<"program_version">(version as DbRow<"program_version">),
    program: {
      firstParty: program.first_party,
      ownerProfileId: program.owner_profile_id,
    },
  };
}

export async function requireReadableVersion(
  deps: ResourceDeps,
  versionId: string,
) {
  const [version, ownedProfileIds] = await Promise.all([
    getVersionAccess(deps, versionId),
    listOwnedProfileIds(deps),
  ]);

  if (
    !version.program.firstParty &&
    !ownedProfileIds.has(version.program.ownerProfileId)
  ) {
    throw new Error("Program version not found.");
  }

  return version;
}

export async function requireWritableVersion(
  deps: ResourceDeps,
  versionId: string,
) {
  const version = await requireReadableVersion(deps, versionId);

  if (version.program.firstParty) {
    throw new Error("First-party program files are read-only.");
  }

  if (version.publishedAt !== null) {
    throw new Error(
      `Program version '${versionId}' is published and read-only.`,
    );
  }

  return version;
}
