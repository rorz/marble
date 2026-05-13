import type { ResourceDeps } from "../../db";
import type { DbRow, Entity } from "../../types";
import { toCamelKeys } from "../../types";
import { requireServiceSupabase, requireUserId } from "../require-deps";

type SecretRow = Entity<"secret">;

export type Secret = Omit<SecretRow, "vaultSecretId">;

export type CreateSecretInput = Pick<Secret, "name"> &
  Partial<Pick<Secret, "category">> & {
    value: string;
  };

export type ListSecretsInput = Partial<Pick<Secret, "category" | "name">>;

type GetSecretInput = Pick<Secret, "id">;

type DeleteSecretInput = Pick<Secret, "id">;

export type UpdateSecretInput = Partial<Pick<Secret, "name">> & {
  value?: string;
};

type UpdateSecretParams = Pick<Secret, "id"> & {
  values: UpdateSecretInput;
};

export type SecretCollectionApi = {
  readonly create: (input: CreateSecretInput) => Promise<Secret>;
  readonly delete: (input: DeleteSecretInput) => Promise<Secret>;
  readonly get: (input: GetSecretInput) => Promise<Secret>;
  readonly list: (input?: ListSecretsInput) => Promise<Secret[]>;
  readonly update: (input: UpdateSecretParams) => Promise<Secret>;
};

type SecretRpcRow = DbRow<"secret">;

const toPublicSecret = (secret: SecretRow): Secret => {
  const { vaultSecretId: _vaultSecretId, ...publicSecret } = secret;
  return publicSecret;
};

const toSecretEntity = (secret: SecretRpcRow): SecretRow => {
  return toCamelKeys<"secret">(secret);
};

export class SecretCollection implements SecretCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = async (input: CreateSecretInput) => {
    const { data, error } = await requireServiceSupabase(
      this.deps,
      "Secret",
    ).rpc("secret_store_create", {
      p_category: input.category ?? "UserDefined",
      p_name: input.name,
      p_owner_user_id: requireUserId(this.deps, "Secret"),
      p_plaintext_value: input.value,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "Could not create secret.");
    }

    return toPublicSecret(toSecretEntity(data));
  };

  public readonly delete = async ({ id }: DeleteSecretInput) => {
    const secret = await this.get({
      id,
    });

    const { error } = await requireServiceSupabase(this.deps, "Secret").rpc(
      "secret_store_delete",
      {
        p_secret_id: id,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return secret;
  };

  public readonly get = async ({ id }: GetSecretInput) =>
    toPublicSecret(
      await this.deps.db.get("secret", id, {
        ownerUserId: requireUserId(this.deps, "Secret"),
      }),
    );

  public readonly list = async (input: ListSecretsInput = {}) =>
    (
      await this.deps.db.list(
        "secret",
        {
          ...input,
          ownerUserId: requireUserId(this.deps, "Secret"),
        },
        {
          orderBy: [
            {
              column: "name",
            },
            {
              column: "category",
            },
          ],
        },
      )
    ).map(toPublicSecret);

  public readonly update = async ({ id, values }: UpdateSecretParams) => {
    await this.get({
      id,
    });

    const { data, error } = await requireServiceSupabase(
      this.deps,
      "Secret",
    ).rpc("secret_store_update", {
      p_name: values.name,
      p_plaintext_value: values.value,
      p_secret_id: id,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "Could not update secret.");
    }

    return toPublicSecret(toSecretEntity(data));
  };
}
