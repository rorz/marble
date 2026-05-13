import type { SupabaseClient, Tables } from "@marble/supabase";
import { z } from "zod";
import { executionSecretSchema, secretBindingSchema } from "./load";

type ExecutionSecret = {
  category: Tables<"secret">["category"];
  id: string;
  name: string;
  value: string;
};

type ExecutionSecretMetadata = Pick<
  Tables<"secret">,
  "category" | "id" | "name"
>;

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
  bindingSource: "column" | "implicit" | "program";
  description?: string;
  envName: string;
  label: string;
  required: boolean;
};

const listSecretMetadataForOwnerUserId = async (
  supabase: SupabaseClient,
  ownerUserId: string,
) => {
  const { data, error } = await supabase
    .from("secret")
    .select("category, id, name")
    .eq("owner_user_id", ownerUserId)
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ExecutionSecretMetadata[];
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
  const declarationByEnvName = new Map(
    options.declarations.map((declaration) => [
      declaration.env,
      declaration,
    ]),
  );
  const { bindingSourceByEnvName, selectedSecretIdByEnvName } =
    await listResolvedSecretBindings(supabase, {
      columnId: options.columnId,
      ownerUserId: options.ownerUserId,
      programId: options.programId,
    });
  const missingSecrets: MissingSecretConfiguration[] = [];

  if (options.declarations.length > 0) {
    const secretMetadata = await listSecretMetadataForOwnerUserId(
      supabase,
      options.ownerUserId,
    );
    const secretIdByName = new Map(
      secretMetadata.map((secret) => [
        secret.name,
        secret.id,
      ]),
    );

    for (const declaration of options.declarations) {
      if (selectedSecretIdByEnvName.has(declaration.env)) {
        continue;
      }

      const implicitSecretId = secretIdByName.get(declaration.env);

      if (implicitSecretId) {
        selectedSecretIdByEnvName.set(declaration.env, implicitSecretId);
        continue;
      }

      if (!declaration.required) {
        continue;
      }

      missingSecrets.push({
        bindingSource: "implicit",
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
    Array.from(new Set(selectedSecretIdByEnvName.values())),
  );
  const resolvedSecretValueById = new Map(
    resolvedSecrets.map((secret) => [
      secret.id,
      secret.value,
    ]),
  );
  const environmentVariables: Record<string, string> = {};

  for (const [envName, secretId] of selectedSecretIdByEnvName) {
    const selectedValue = resolvedSecretValueById.get(secretId);

    if (selectedValue !== undefined) {
      environmentVariables[envName] = selectedValue;
      continue;
    }

    const declaration = declarationByEnvName.get(envName);
    const bindingSource = bindingSourceByEnvName.get(envName) ?? "implicit";

    if (
      !bindingSourceByEnvName.has(envName) &&
      declaration?.required !== true
    ) {
      continue;
    }

    if (
      missingSecrets.some((missingSecret) => missingSecret.envName === envName)
    ) {
      continue;
    }

    missingSecrets.push({
      bindingSource,
      ...(declaration?.description === undefined
        ? {}
        : {
            description: declaration.description,
          }),
      envName,
      label: declaration?.label ?? envName,
      required:
        bindingSourceByEnvName.has(envName) || declaration?.required === true,
    });
  }

  return {
    environmentVariables,
    missingSecrets,
  };
};
