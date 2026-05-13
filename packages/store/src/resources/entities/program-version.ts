import type { Json } from "@marble/supabase";
import type { ResourceDeps } from "../../db";
import type {
  DbRow,
  Entity,
  ProgramVersionTestInput,
  ProgramVersionTestResult,
} from "../../types";
import { toCamelKeys } from "../../types";
import { listOwnedProfileIds } from "../list-owned-profile-ids";
import { requireServiceSupabase, requireUserId } from "../require-deps";

export type ProgramVersion = Entity<"program_version">;

export type TestProgramVersionInput = ProgramVersionTestInput & {
  programVersionId: string;
};

type ProgramVersionWriteInput = {
  inputSchema?: unknown;
  outputConfig?: unknown;
  publish?: boolean;
  secretConfig?: unknown;
  version?: number;
};

export type UpdateProgramVersionParams = {
  id: string;
  values: ProgramVersionWriteInput;
};

function asJson(value: unknown): Json {
  return value as Json;
}

const parseInputSchema = asJson;
const parseOutputConfig = asJson;
const parseSecretConfig = asJson;

async function nextProgramVersionNumber(deps: ResourceDeps, programId: string) {
  const { data, error } = await requireServiceSupabase(deps, "Program version")
    .from("program_version")
    .select("version")
    .eq("program_id", programId)
    .not("published_at", "is", null)
    .order("version", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.version ?? 0) + 1;
}

async function getProgramVersion(deps: ResourceDeps, id: string) {
  const { data, error } = await requireServiceSupabase(deps, "Program version")
    .from("program_version")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Program version not found.");
  }

  return toCamelKeys<"program_version">(data as DbRow<"program_version">);
}

async function requireWritableProgram(deps: ResourceDeps, programId: string) {
  const { data: program, error } = await requireServiceSupabase(
    deps,
    "Program version",
  )
    .from("program")
    .select("first_party, owner_profile_id")
    .eq("id", programId)
    .single();

  if (error || !program) {
    throw new Error(error?.message ?? "Program not found.");
  }

  const ownedProfileIds = new Set(
    await listOwnedProfileIds(deps, "Program version"),
  );

  if (program.first_party || !ownedProfileIds.has(program.owner_profile_id)) {
    throw new Error("Program not found.");
  }

  return program;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function outputErrorField(output: Record<string, unknown>, key: string) {
  const error = output.error;

  if (!isRecord(error)) {
    return undefined;
  }

  return error[key];
}

function toProgramVersionTestResult(
  payload: Record<string, unknown>,
): ProgramVersionTestResult {
  const output = payload.output;

  if (isRecord(output) && output.ok === true) {
    return {
      ok: true,
      output: output.value,
    };
  }

  if (isRecord(output)) {
    const errorType = outputErrorField(output, "type");

    return {
      detail: outputErrorField(output, "detail"),
      error:
        typeof output.message === "string"
          ? output.message
          : "Program test failed.",
      errorType: typeof errorType === "string" ? errorType : undefined,
      ok: false,
      output: null,
    };
  }

  return {
    error:
      typeof payload.message === "string"
        ? payload.message
        : "Program test failed.",
    ok: false,
    output: null,
  };
}

function toProgramVersionTestBody(input: ProgramVersionTestInput) {
  return {
    input:
      input.manualInput === undefined
        ? input.inputConfig
        : {
            cell: {
              manualInputValue: input.manualInput,
            },
            input: input.inputConfig,
            system: {},
          },
  };
}

export class ProgramVersionCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = async (
    input: ProgramVersionWriteInput & {
      inputSchema: unknown;
      outputConfig: unknown;
      programId: string;
    },
  ) => {
    await requireWritableProgram(this.deps, input.programId);

    const versionNumber = input.publish
      ? (input.version ??
        (await nextProgramVersionNumber(this.deps, input.programId)))
      : null;
    const { data: versionRow, error } = await requireServiceSupabase(
      this.deps,
      "Program version",
    )
      .from("program_version")
      .insert({
        input_schema: parseInputSchema(input.inputSchema),
        output_config: parseOutputConfig(input.outputConfig),
        program_id: input.programId,
        published_at: input.publish ? new Date().toISOString() : null,
        secret_config:
          input.secretConfig === undefined
            ? null
            : parseSecretConfig(input.secretConfig),
        version: versionNumber,
      })
      .select("*")
      .single();

    if (error || !versionRow) {
      throw new Error(error?.message ?? "Could not create program version.");
    }

    const version = toCamelKeys<"program_version">(
      versionRow as DbRow<"program_version">,
    );

    return version;
  };

  public readonly test = async ({
    programVersionId,
    ...input
  }: TestProgramVersionInput): Promise<ProgramVersionTestResult> => {
    if (!this.deps.actions.executeProgramVersionTest) {
      throw new Error(
        "Program version test requires an executeProgramVersionTest action.",
      );
    }

    const serviceSupabase = requireServiceSupabase(
      this.deps,
      "Program version",
    );
    const { data: version, error: versionError } = await serviceSupabase
      .from("program_version")
      .select("program_id")
      .eq("id", programVersionId)
      .single();

    if (versionError || !version) {
      throw new Error(versionError?.message ?? "Program version not found.");
    }

    const { data: program, error: programError } = await serviceSupabase
      .from("program")
      .select("first_party, owner_profile_id")
      .eq("id", version.program_id)
      .single();

    if (programError || !program) {
      throw new Error(programError?.message ?? "Program not found.");
    }

    if (!program.first_party) {
      const { data: profile, error: profileError } = await serviceSupabase
        .from("profile")
        .select("owner_user_id")
        .eq("id", program.owner_profile_id)
        .single();

      if (profileError || !profile) {
        throw new Error(profileError?.message ?? "Profile not found.");
      }

      if (
        profile.owner_user_id !== requireUserId(this.deps, "Program version")
      ) {
        throw new Error("Program version not found.");
      }
    }

    const { payload } = await this.deps.actions.executeProgramVersionTest({
      body: toProgramVersionTestBody(input),
      programVersionId,
    });

    return toProgramVersionTestResult(payload);
  };

  public readonly update = async ({
    id,
    values: input,
  }: UpdateProgramVersionParams) => {
    const existing = await getProgramVersion(this.deps, id);

    await requireWritableProgram(this.deps, existing.programId);

    if (existing.publishedAt !== null) {
      throw new Error(`Program version '${id}' is published and read-only.`);
    }

    const dbValues = {
      ...(input.inputSchema === undefined
        ? {}
        : {
            inputSchema: asJson(input.inputSchema),
          }),
      ...(input.outputConfig === undefined
        ? {}
        : {
            outputConfig: asJson(input.outputConfig),
          }),
      ...(input.secretConfig === undefined
        ? {}
        : {
            secretConfig: asJson(input.secretConfig),
          }),
      ...(input.publish
        ? {
            publishedAt: new Date().toISOString(),
            version:
              input.version ??
              (await nextProgramVersionNumber(this.deps, existing.programId)),
          }
        : input.version === undefined
          ? {}
          : {
              version: input.version,
            }),
    };

    if (Object.keys(dbValues).length > 0) {
      const { error } = await requireServiceSupabase(
        this.deps,
        "Program version",
      )
        .from("program_version")
        .update({
          input_schema:
            "inputSchema" in dbValues
              ? parseInputSchema(dbValues.inputSchema)
              : undefined,
          output_config:
            "outputConfig" in dbValues
              ? parseOutputConfig(dbValues.outputConfig)
              : undefined,
          published_at:
            "publishedAt" in dbValues ? dbValues.publishedAt : undefined,
          secret_config:
            "secretConfig" in dbValues
              ? parseSecretConfig(dbValues.secretConfig)
              : undefined,
          version: "version" in dbValues ? dbValues.version : undefined,
        })
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }
    }

    return getProgramVersion(this.deps, id);
  };
}
