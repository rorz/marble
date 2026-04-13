"use server";

import {
  apiKeyPreview,
  createApiKeyRecord,
  listApiKeysForProfiles,
  revokeApiKeyRecord,
} from "@marble/keys";
import type { Database } from "@marble/supabase";
import { requireUser } from "../../../lib/auth";
import {
  createActingServiceRoleClient,
  createActingServiceRoleClientForUser,
  createServiceRoleClient,
} from "../../../lib/supabase/service-role";

type KeyRow = Database["public"]["Tables"]["key"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profile"]["Row"];
type ProfileType = Database["public"]["Enums"]["profile_type"];

export type ManagedKey = Omit<KeyRow, "hash"> & {
  preview: string;
};

export type ManagedProfile = ProfileRow & {
  keys: ManagedKey[];
};

function db() {
  return createServiceRoleClient();
}

function assertNonEmpty(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  return normalized;
}

async function requireOwnedProfile(profileId: string) {
  const user = await requireUser();
  const { data, error } = await db()
    .from("profile")
    .select("*")
    .eq("id", profileId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Profile not found");
  }

  return data;
}

async function requireOwnedKey(keyId: string) {
  const user = await requireUser();
  const { data, error } = await db()
    .from("key")
    .select("*, profile:owner_profile_id(*)")
    .eq("id", keyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const profile = data?.profile;
  if (!data || !profile || profile.owner_user_id !== user.id) {
    throw new Error("API key not found");
  }

  return data;
}

export async function listProfilesWithKeys(): Promise<ManagedProfile[]> {
  const user = await requireUser();
  const supabase = db();
  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const profiles = data ?? [];
  const keys = await listApiKeysForProfiles(
    supabase,
    profiles.map((profile) => profile.id),
    {
      includeDeleted: true,
    },
  );

  const keysByProfileId = new Map<string, ManagedKey[]>();

  for (const key of keys) {
    const existing = keysByProfileId.get(key.owner_profile_id) ?? [];
    existing.push({
      created_at: key.created_at,
      deleted_at: key.deleted_at,
      id: key.id,
      owner_profile_id: key.owner_profile_id,
      prefix: key.prefix,
      preview: apiKeyPreview(key.prefix),
    });
    keysByProfileId.set(key.owner_profile_id, existing);
  }

  return profiles.map((profile) => ({
    ...profile,
    keys: keysByProfileId.get(profile.id) ?? [],
  }));
}

export async function createProfile(input: {
  externalName?: string;
  name: string;
  type?: ProfileType;
}) {
  const user = await requireUser();
  const name = assertNonEmpty(input.name, "Profile name");
  const externalName = input.externalName?.trim() || null;
  const { supabase } = await createActingServiceRoleClientForUser(user.id);
  const { data, error } = await supabase
    .from("profile")
    .insert({
      external_name: externalName,
      name,
      owner_user_id: user.id,
      type: input.type ?? "Agent",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createProfileKey(profileId: string) {
  const profile = await requireOwnedProfile(profileId);
  const { supabase } = await createActingServiceRoleClient();
  const { key, token } = await createApiKeyRecord(supabase, profile.id);

  return {
    key: {
      created_at: key.created_at,
      deleted_at: key.deleted_at,
      id: key.id,
      owner_profile_id: key.owner_profile_id,
      prefix: key.prefix,
      preview: apiKeyPreview(key.prefix),
    },
    profileId: profile.id,
    profileName: profile.name,
    token,
  };
}

export async function revokeProfileKey(keyId: string) {
  await requireOwnedKey(keyId);
  const { supabase } = await createActingServiceRoleClient();
  const key = await revokeApiKeyRecord(supabase, keyId);

  if (!key) {
    throw new Error("API key already revoked");
  }

  return {
    id: key.id,
  };
}
