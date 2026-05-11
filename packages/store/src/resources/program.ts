import { toCamelKeys } from "@marble/lib/object";
import type { Database } from "@marble/supabase";
import type { ResourceDeps } from "../db";
import type { Entity } from "../types";
import { ProgramVersionCollection } from "./program-version";

type ProgramRow = Database["public"]["Tables"]["program"]["Row"];
type ProgramVersionRow = Database["public"]["Tables"]["program_version"]["Row"];
type ProgramFileRow = Database["public"]["Tables"]["program_file"]["Row"];

export type ProgramFile = Entity<"program_file">;
type ProgramVersion = Entity<"program_version">;
export type Program = Entity<"program">;
export type ProgramEditorData = {
  programFiles: ProgramFile[];
  programs: Program[];
  programVersions: ProgramVersion[];
};
export type CreatedProgram = Program & {
  initialVersion?: ProgramVersion;
};
export type CreateProgramInput = Pick<Program, "name"> & {
  initialVersion?: {
    inputSchema: unknown;
    outputConfig: unknown;
    publish?: boolean;
    secretConfig?: unknown;
  };
};

export type ProgramCollectionApi = {
  readonly create: (input: CreateProgramInput) => Promise<CreatedProgram>;
  readonly listForEditor: () => Promise<ProgramEditorData>;
  readonly update: (
    id: string,
    input: Partial<Pick<Program, "name">>,
  ) => Promise<Program>;
};

function toProgramFile(file: ProgramFileRow): ProgramFile {
  return toCamelKeys(file) as ProgramFile;
}

function toProgramVersion(version: ProgramVersionRow): ProgramVersion {
  return toCamelKeys(version) as ProgramVersion;
}

function toProgram(program: ProgramRow): Program {
  return toCamelKeys(program) as Program;
}

function requireUserId(deps: ResourceDeps) {
  if (!deps.context.userId) {
    throw new Error("Program operations require a user session.");
  }

  return deps.context.userId;
}

function requireServiceSupabase(deps: ResourceDeps) {
  if (!deps.serviceSupabase) {
    throw new Error("Program operations require a service Supabase client.");
  }

  return deps.serviceSupabase;
}

export class ProgramCollection implements ProgramCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  private readonly listVisibleProfileIds = async () => {
    const { data, error } = await requireServiceSupabase(this.deps)
      .from("profile")
      .select("id")
      .eq("owner_user_id", requireUserId(this.deps))
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((profile) => profile.id);
  };

  private readonly getProgram = async (id: string) => {
    const { data, error } = await requireServiceSupabase(this.deps)
      .from("program")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return toProgram(data as ProgramRow);
  };

  public readonly create = async (input: CreateProgramInput) => {
    const supabase = requireServiceSupabase(this.deps);
    const profileIds = await this.listVisibleProfileIds();
    const ownerProfileId = profileIds[0];

    if (!ownerProfileId) {
      throw new Error("Create a profile before creating a program.");
    }

    const { data: program, error } = await supabase
      .from("program")
      .insert({
        first_party: false,
        forked_from_version_id: null,
        name: input.name,
        owner_profile_id: ownerProfileId,
      })
      .select("*")
      .single();

    if (error || !program) {
      throw new Error(error?.message ?? "Could not create program.");
    }

    if (!input.initialVersion) {
      return this.getProgram(program.id);
    }

    const initialVersion = await new ProgramVersionCollection(this.deps).create(
      {
        inputSchema: input.initialVersion.inputSchema,
        outputConfig: input.initialVersion.outputConfig,
        programId: program.id,
        publish: input.initialVersion.publish,
        secretConfig: input.initialVersion.secretConfig,
      },
    );

    return {
      ...(await this.getProgram(program.id)),
      initialVersion,
    };
  };

  public readonly listForEditor = async () => {
    const supabase = requireServiceSupabase(this.deps);
    const profileIds = await this.listVisibleProfileIds();
    const [firstPartyResult, ownedResult] = await Promise.all([
      supabase.from("program").select("*").eq("first_party", true),
      profileIds.length === 0
        ? Promise.resolve({
            data: [],
            error: null,
          })
        : requireServiceSupabase(this.deps)
            .from("program")
            .select("*")
            .in("owner_profile_id", profileIds),
    ]);

    if (firstPartyResult.error) {
      throw new Error(firstPartyResult.error.message);
    }

    if (ownedResult.error) {
      throw new Error(ownedResult.error.message);
    }

    const merged = new Map<string, Program>();

    for (const program of [
      ...((firstPartyResult.data ?? []) as ProgramRow[]),
      ...((ownedResult.data ?? []) as ProgramRow[]),
    ]) {
      merged.set(program.id, toProgram(program));
    }

    const programs = [
      ...merged.values(),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const programIds = programs.map((program) => program.id);
    const versionsResult =
      programIds.length === 0
        ? {
            data: [],
            error: null,
          }
        : await supabase
            .from("program_version")
            .select("*")
            .in("program_id", programIds);

    if (versionsResult.error) {
      throw new Error(versionsResult.error.message);
    }

    const programVersions = ((versionsResult.data ?? []) as ProgramVersionRow[])
      .map(toProgramVersion)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const versionIds = programVersions.map((version) => version.id);
    const filesResult =
      versionIds.length === 0
        ? {
            data: [],
            error: null,
          }
        : await supabase
            .from("program_file")
            .select("*")
            .in("version_id", versionIds)
            .order("filename");

    if (filesResult.error) {
      throw new Error(filesResult.error.message);
    }

    return {
      programFiles: ((filesResult.data ?? []) as ProgramFileRow[]).map(
        toProgramFile,
      ),
      programs,
      programVersions,
    };
  };

  public readonly update = async (
    id: string,
    input: Partial<Pick<Program, "name">>,
  ) => {
    const supabase = requireServiceSupabase(this.deps);
    const profileIds = await this.listVisibleProfileIds();
    const existing = await this.getProgram(id);

    if (existing.firstParty || !profileIds.includes(existing.ownerProfileId)) {
      throw new Error("Program not found.");
    }

    const { error } = await supabase
      .from("program")
      .update({
        name: input.name,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return this.getProgram(id);
  };
}
