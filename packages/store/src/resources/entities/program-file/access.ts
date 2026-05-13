import type { ResourceDeps } from "../../../db";
import { type DbRow, type Entity, toCamelKeys } from "../../../types";
import { listOwnedProfileIds } from "../../list-owned-profile-ids";
import { requireServiceSupabase } from "../../require-deps";

type ProgramAccess = {
  firstParty: boolean;
  ownerProfileId: string;
};

type ProgramVersionAccess = Entity<"program_version"> & {
  program: ProgramAccess;
};

const getVersionAccess = async (
  deps: ResourceDeps,
  versionId: string,
): Promise<ProgramVersionAccess> => {
  const supabase = requireServiceSupabase(deps, "Program file");
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
};

export const requireReadableVersion = async (
  deps: ResourceDeps,
  versionId: string,
) => {
  const [version, ownedProfileIds] = await Promise.all([
    getVersionAccess(deps, versionId),
    listOwnedProfileIds(deps, "Program file").then((ids) => new Set(ids)),
  ]);

  if (
    !version.program.firstParty &&
    !ownedProfileIds.has(version.program.ownerProfileId)
  ) {
    throw new Error("Program version not found.");
  }

  return version;
};

export const requireWritableVersion = async (
  deps: ResourceDeps,
  versionId: string,
) => {
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
};
