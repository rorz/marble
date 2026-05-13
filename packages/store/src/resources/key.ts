import {
  apiKeyPreview,
  createApiKeyMaterial,
  listApiKeysForProfiles,
  resolveApiKeyAuth,
} from "@marble/keys";
import type { ResourceDeps } from "../db";

export type ApiKey = {
  createdAt: string;
  deletedAt: null | string;
  id: string;
  ownerProfileId: string;
  prefix: string;
  preview: string;
};

type ApiKeyAuth = {
  keyId: string;
  profileId: string;
  userId?: string;
};

type ListKeysInput = {
  includeDeleted?: boolean;
  ownerProfileId?: string;
};

function requireUserId(deps: ResourceDeps) {
  if (!deps.context.userId) {
    throw new Error("Key operations require a user session.");
  }

  return deps.context.userId;
}

function requireServiceSupabase(deps: ResourceDeps) {
  if (!deps.serviceSupabase) {
    throw new Error("Key operations require a service Supabase client.");
  }

  return deps.serviceSupabase;
}

function toApiKey(key: {
  created_at: string;
  deleted_at: null | string;
  id: string;
  owner_profile_id: string;
  prefix: string;
}): ApiKey {
  return {
    createdAt: key.created_at,
    deletedAt: key.deleted_at,
    id: key.id,
    ownerProfileId: key.owner_profile_id,
    prefix: key.prefix,
    preview: apiKeyPreview(key.prefix),
  };
}

export class KeyCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly authenticateToken = async (
    token: string,
  ): Promise<ApiKeyAuth | null> => {
    const keyAuth = await resolveApiKeyAuth(
      requireServiceSupabase(this.deps),
      token,
    );

    if (!keyAuth) {
      return null;
    }

    return {
      keyId: keyAuth.id,
      profileId: keyAuth.owner_profile_id,
      userId: keyAuth.profile?.owner_user_id,
    };
  };

  private readonly requireOwnedProfile = async (profileId: string) => {
    const profile = await this.deps.db.get("profile", profileId, {
      ownerUserId: requireUserId(this.deps),
    });

    return profile;
  };

  private readonly listOwnerProfileIds = async (ownerProfileId?: string) => {
    if (ownerProfileId) {
      await this.requireOwnedProfile(ownerProfileId);
      return [
        ownerProfileId,
      ];
    }

    return (
      await this.deps.db.list("profile", {
        ownerUserId: requireUserId(this.deps),
      })
    ).map((profile) => profile.id);
  };

  public readonly create = async (input: { ownerProfileId: string }) => {
    const supabase = requireServiceSupabase(this.deps);
    const profile = await this.requireOwnedProfile(input.ownerProfileId);
    const material = await createApiKeyMaterial();
    const { data, error } = await supabase
      .from("key")
      .insert({
        hash: material.hash,
        owner_profile_id: profile.id,
        prefix: material.prefix,
      })
      .select("created_at, deleted_at, id, owner_profile_id, prefix")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not create API key.");
    }

    return {
      key: toApiKey(data),
      profileId: profile.id,
      profileName: profile.name,
      token: material.token,
    };
  };

  public readonly list = async (input: ListKeysInput = {}) => {
    const supabase = requireServiceSupabase(this.deps);
    const ownerProfileIds = await this.listOwnerProfileIds(
      input.ownerProfileId,
    );
    const keys = await listApiKeysForProfiles(supabase, ownerProfileIds, {
      includeDeleted: input.includeDeleted,
    });

    return keys.map(toApiKey);
  };

  public readonly revoke = async ({ id }: { id: string }) => {
    const supabase = requireServiceSupabase(this.deps);
    const { data: key, error: getError } = await supabase
      .from("key")
      .select("created_at, deleted_at, id, owner_profile_id, prefix")
      .eq("id", id)
      .single();

    if (getError || !key) {
      throw new Error(getError?.message ?? "API key not found.");
    }

    await this.requireOwnedProfile(key.owner_profile_id);

    if (key.deleted_at) {
      throw new Error("API key already revoked.");
    }

    const { data: revoked, error } = await supabase
      .from("key")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("created_at, deleted_at, id, owner_profile_id, prefix")
      .single();

    if (error || !revoked) {
      throw new Error(error?.message ?? "Could not revoke API key.");
    }

    return toApiKey(revoked);
  };
}
