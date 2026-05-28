import type { SupabaseClient, Tables } from "@marble/supabase";
import { z } from "zod";
import { executionSecretSchema, secretBindingSchema } from "./load";

type ExecutionSecret = {
  category: Tables<"secret">["category"];
  id: string;
  name: string;
  value: string;
};

type SecretBinding = {
  envName: string;
  secretId: string;
};

export type ProgramSecretDeclaration = {
  description?: string;
  env: string;
  label: string;
  required: boolean;
};

export type MissingSecretConfiguration = {
  bindingSource: "column" | "program";
  description?: string;
  envName: string;
  label: string;
  required: boolean;
};

const listSelectedSecretsForOwnerUserId = async (
  supabase: SupabaseClient,
  ownerUserId: string,
  secretIds: string[],
) => {
  const uniqueSecretIds = Array.from(new Set(secretIds));

  if (uniqueSecretIds.length === 0) {
    return [] as ExecutionSecret[];
  }

  const { data, error } = await supabase.rpc("secret_store_resolve_selected", {
    p_owner_user_id: ownerUserId,
    p_secret_ids: uniqueSecretIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(executionSecretSchema).parse(data ?? []) as ExecutionSecret[];
};

export const resolveOwnerUserIdForProfile = async (
  supabase: SupabaseClient,
  profileId: string,
) => {
  const { data, error } = await supabase
    .from("profile")
    .select("owner_user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`Profile '${profileId}' was not found.`);
  }

  return data.owner_user_id;
};

const listProgramSecretBindingsForOwnerUserId = async (
  supabase: SupabaseClient,
  ownerUserId: string,
  programId: string,
) => {
  const { data, error } = await supabase
    .from("program_secret_binding")
    .select("env_name, secret_id")
    .eq("owner_user_id", ownerUserId)
    .eq("program_id", programId)
    .order("env_name", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return z
    .array(secretBindingSchema)
    .parse(data ?? [])
    .map((binding) => ({
      envName: binding.env_name,
      secretId: binding.secret_id,
    })) as SecretBinding[];
};

const listColumnSecretBindings = async (
  supabase: SupabaseClient,
  columnId: string,
) => {
  const { data, error } = await supabase
    .from("column_secret_binding")
    .select("env_name, secret_id")
    .eq("column_id", columnId)
    .order("env_name", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return z
    .array(secretBindingSchema)
    .parse(data ?? [])
    .map((binding) => ({
      envName: binding.env_name,
      secretId: binding.secret_id,
    })) as SecretBinding[];
};

const listResolvedSecretBindings = async (
  supabase: SupabaseClient,
  options: {
    columnId?: string;
    ownerUserId: string;
    programId: string;
  },
) => {
  const [programBindings, columnBindings] = await Promise.all([
    listProgramSecretBindingsForOwnerUserId(
      supabase,
      options.ownerUserId,
      options.programId,
    ),
    options.columnId
      ? listColumnSecretBindings(supabase, options.columnId)
      : Promise.resolve([] as SecretBinding[]),
  ]);
  const bindingSourceByEnvName = new Map<
    string,
    MissingSecretConfiguration["bindingSource"]
  >();
  const selectedSecretIdByEnvName = new Map<string, string>();

  for (const binding of programBindings) {
    bindingSourceByEnvName.set(binding.envName, "program");
    selectedSecretIdByEnvName.set(binding.envName, binding.secretId);
  }

  for (const binding of columnBindings) {
    bindingSourceByEnvName.set(binding.envName, "column");
    selectedSecretIdByEnvName.set(binding.envName, binding.secretId);
  }

  return {
    bindingSourceByEnvName,
    selectedSecretIdByEnvName,
  };
};

export const resolveDeclaredEnvironmentVariables = async (
  supabase: SupabaseClient,
  options: {
    columnId?: string;
    declarations: ProgramSecretDeclaration[];
    ownerUserId: string;
    programId: string;
  },
) => {
  const { bindingSourceByEnvName, selectedSecretIdByEnvName } =
    await listResolvedSecretBindings(supabase, {
      columnId: options.columnId,
      ownerUserId: options.ownerUserId,
      programId: options.programId,
    });
  const declaredSecretIdByEnvName = new Map<string, string>();
  const missingSecrets: MissingSecretConfiguration[] = [];

  for (const declaration of options.declarations) {
    const selectedSecretId = selectedSecretIdByEnvName.get(declaration.env);

    if (selectedSecretId) {
      declaredSecretIdByEnvName.set(declaration.env, selectedSecretId);
      continue;
    }

    if (declaration.required) {
      missingSecrets.push({
        bindingSource: "program",
        ...(declaration.description === undefined
          ? {}
          : {
              description: declaration.description,
            }),
        envName: declaration.env,
        label: declaration.label,
        required: declaration.required,
      });
    }
  }

  const resolvedSecrets = await listSelectedSecretsForOwnerUserId(
    supabase,
    options.ownerUserId,
    Array.from(new Set(declaredSecretIdByEnvName.values())),
  );
  const resolvedSecretValueById = new Map(
    resolvedSecrets.map((secret) => [
      secret.id,
      secret.value,
    ]),
  );
  const environmentVariables: Record<string, string> = {};

  for (const declaration of options.declarations) {
    const secretId = declaredSecretIdByEnvName.get(declaration.env);

    if (!secretId) {
      continue;
    }

    const selectedValue = resolvedSecretValueById.get(secretId);

    if (selectedValue !== undefined) {
      environmentVariables[declaration.env] = selectedValue;
      continue;
    }

    const bindingSource = bindingSourceByEnvName.get(declaration.env);

    if (
      missingSecrets.some(
        (missingSecret) => missingSecret.envName === declaration.env,
      )
    ) {
      continue;
    }

    missingSecrets.push({
      bindingSource: bindingSource ?? "program",
      ...(declaration.description === undefined
        ? {}
        : {
            description: declaration.description,
          }),
      envName: declaration.env,
      label: declaration.label,
      required: bindingSource !== undefined || declaration.required,
    });
  }

  return {
    environmentVariables,
    missingSecrets,
  };
};
