import type { ResourceDeps } from "../db";

export type SecretBindingEntry = {
  envName: string;
  secretId: string;
};

export type SecretBindingMap = Record<string, Record<string, string>>;

function requireUserId(deps: ResourceDeps) {
  if (!deps.context.userId) {
    throw new Error("Secret binding operations require a user session.");
  }

  return deps.context.userId;
}

function requireServiceSupabase(deps: ResourceDeps) {
  if (!deps.serviceSupabase) {
    throw new Error(
      "Secret binding operations require a service Supabase client.",
    );
  }

  return deps.serviceSupabase;
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
    bindings[targetId] = {
      ...(bindings[targetId] ?? {}),
      [row.env_name]: row.secret_id,
    };
  }

  return bindings;
}

function serializeBindings<
  Row extends {
    env_name: string;
    secret_id: string;
  },
>(bindings: Row[]): SecretBindingEntry[] {
  return bindings
    .map((binding) => ({
      envName: binding.env_name,
      secretId: binding.secret_id,
    }))
    .sort((left, right) => left.envName.localeCompare(right.envName));
}

export class SecretBindingCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  private readonly validateSecrets = async (bindings: SecretBindingEntry[]) => {
    const secretIds = Array.from(
      new Set(bindings.map((binding) => binding.secretId)),
    );

    if (secretIds.length === 0) {
      return;
    }

    const { data, error } = await requireServiceSupabase(this.deps)
      .from("secret")
      .select("id, owner_user_id")
      .in("id", secretIds);

    if (error) {
      throw new Error(error.message);
    }

    const userId = requireUserId(this.deps);
    const secrets = data ?? [];

    if (
      secrets.length !== secretIds.length ||
      secrets.some((secret) => secret.owner_user_id !== userId)
    ) {
      throw new Error("Secret not found.");
    }
  };

  public readonly listColumns = async (input: { columnIds: string[] }) => {
    if (input.columnIds.length === 0) {
      return {} satisfies SecretBindingMap;
    }

    const { data, error } = await requireServiceSupabase(this.deps)
      .from("column_secret_binding")
      .select("column_id, env_name, secret_id")
      .in("column_id", input.columnIds)
      .order("column_id", {
        ascending: true,
      })
      .order("env_name", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return mapBindingsByTarget(data ?? [], (binding) => binding.column_id);
  };

  public readonly listPrograms = async (input: { programIds: string[] }) => {
    if (input.programIds.length === 0) {
      return {} satisfies SecretBindingMap;
    }

    const { data, error } = await requireServiceSupabase(this.deps)
      .from("program_secret_binding")
      .select("env_name, program_id, secret_id")
      .eq("owner_user_id", requireUserId(this.deps))
      .in("program_id", input.programIds)
      .order("program_id", {
        ascending: true,
      })
      .order("env_name", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return mapBindingsByTarget(data ?? [], (binding) => binding.program_id);
  };

  public readonly setColumn = async (input: {
    bindings: SecretBindingEntry[];
    columnId: string;
  }) => {
    const supabase = requireServiceSupabase(this.deps);
    await this.validateSecrets(input.bindings);

    const { error: deleteError } = await supabase
      .from("column_secret_binding")
      .delete()
      .eq("column_id", input.columnId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (input.bindings.length === 0) {
      return [] as SecretBindingEntry[];
    }

    const { data, error } = await supabase
      .from("column_secret_binding")
      .insert(
        input.bindings.map((binding) => ({
          column_id: input.columnId,
          env_name: binding.envName,
          secret_id: binding.secretId,
        })),
      )
      .select("env_name, secret_id");

    if (error) {
      throw new Error(error.message);
    }

    return serializeBindings(data ?? []);
  };

  public readonly setProgram = async (input: {
    bindings: SecretBindingEntry[];
    programId: string;
  }) => {
    const supabase = requireServiceSupabase(this.deps);
    const userId = requireUserId(this.deps);
    await this.validateSecrets(input.bindings);

    const { error: deleteError } = await supabase
      .from("program_secret_binding")
      .delete()
      .eq("owner_user_id", userId)
      .eq("program_id", input.programId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (input.bindings.length === 0) {
      return [] as SecretBindingEntry[];
    }

    const { data, error } = await supabase
      .from("program_secret_binding")
      .insert(
        input.bindings.map((binding) => ({
          env_name: binding.envName,
          owner_user_id: userId,
          program_id: input.programId,
          secret_id: binding.secretId,
        })),
      )
      .select("env_name, secret_id");

    if (error) {
      throw new Error(error.message);
    }

    return serializeBindings(data ?? []);
  };
}
