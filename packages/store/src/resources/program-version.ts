import {
  ProgramInputSchema,
  ProgramOutputConfig,
  parseProgramSecretConfig,
} from "@marble/contracts";
import type { Json } from "@marble/supabase";
import type { ResourceDeps } from "../db";
import type {
  DbRow,
  Entity,
  ProgramVersionTestInput,
  ProgramVersionTestResult,
} from "../types";
import { toCamelKeys } from "../types";

export type ProgramVersion = Entity<"program_version">;

export type ProgramVersionWriteInput = {
  inputSchema?: unknown;
  outputConfig?: unknown;
  publish?: boolean;
  secretConfig?: unknown;
  version?: number;
};

function requireServiceSupabase(deps: ResourceDeps) {
  if (!deps.serviceSupabase) {
    throw new Error(
      "Program version operations require a service Supabase client.",
    );
  }

  return deps.serviceSupabase;
}

function asJson(value: unknown): Json {
  return value as Json;
}

function formatZodIssues(
  issues: Array<{
    message: string;
    path: PropertyKey[];
  }>,
) {
  return issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

function parseInputSchema(input: unknown): Json {
  const parsed = ProgramInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      `Invalid program input schema: ${formatZodIssues(parsed.error.issues)}`,
    );
  }

  return parsed.data as Json;
}

function parseOutputConfig(input: unknown): Json {
  const parsed = ProgramOutputConfig.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      `Invalid program output config: ${formatZodIssues(parsed.error.issues)}`,
    );
  }

  return parsed.data as Json;
}

function parseSecretConfig(input: unknown): Json {
  return parseProgramSecretConfig(input) as unknown as Json;
}

async function nextProgramVersionNumber(deps: ResourceDeps, programId: string) {
  const { data, error } = await requireServiceSupabase(deps)
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
  const { data, error } = await requireServiceSupabase(deps)
    .from("program_version")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Program version not found.");
  }

  return toCamelKeys<"program_version">(data as DbRow<"program_version">);
}

function requireUserId(deps: ResourceDeps) {
  if (!deps.context.userId) {
    throw new Error("Program version operations require a user context.");
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

async function requireWritableProgram(deps: ResourceDeps, programId: string) {
  const { data: program, error } = await requireServiceSupabase(deps)
    .from("program")
    .select("first_party, owner_profile_id")
    .eq("id", programId)
    .single();

  if (error || !program) {
    throw new Error(error?.message ?? "Program not found.");
  }

  const ownedProfileIds = await listOwnedProfileIds(deps);

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
    const { data: versionRow, error } = await requireServiceSupabase(this.deps)
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

  public readonly test = async (
    programVersionId: string,
    input: ProgramVersionTestInput,
  ): Promise<ProgramVersionTestResult> => {
    if (!this.deps.actions.executeProgramVersionTest) {
      throw new Error(
        "Program version test requires an executeProgramVersionTest action.",
      );
    }

    const serviceSupabase = requireServiceSupabase(this.deps);
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

      if (profile.owner_user_id !== requireUserId(this.deps)) {
        throw new Error("Program version not found.");
      }
    }

    const { payload } = await this.deps.actions.executeProgramVersionTest({
      body: toProgramVersionTestBody(input),
      programVersionId,
    });

    return toProgramVersionTestResult(payload);
  };

  public readonly update = async (
    id: string,
    input: ProgramVersionWriteInput,
  ) => {
    const existing = await getProgramVersion(this.deps, id);

    await requireWritableProgram(this.deps, existing.programId);

    if (existing.publishedAt !== null) {
      throw new Error(`Program version '${id}' is published and read-only.`);
    }

    const values = {
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

    if (Object.keys(values).length > 0) {
      const { error } = await requireServiceSupabase(this.deps)
        .from("program_version")
        .update({
          input_schema:
            "inputSchema" in values
              ? parseInputSchema(values.inputSchema)
              : undefined,
          output_config:
            "outputConfig" in values
              ? parseOutputConfig(values.outputConfig)
              : undefined,
          published_at:
            "publishedAt" in values ? values.publishedAt : undefined,
          secret_config:
            "secretConfig" in values
              ? parseSecretConfig(values.secretConfig)
              : undefined,
          version: "version" in values ? values.version : undefined,
        })
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }
    }

    return getProgramVersion(this.deps, id);
  };
}
