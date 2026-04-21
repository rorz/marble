"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../../lib/auth";
import { callMarbleApi } from "../../../lib/marble-api";
import { createClient as createServerClient } from "../../../lib/supabase/server";
import { createServiceRoleClient } from "../../../lib/supabase/service-role";
import {
  DEFAULT_AGENT_PROFILE_ICON,
  PROFILE_RECORD_SELECT,
  type ProfileKeyRecord,
  type ProfileRecord,
} from "./shared";

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProfile(formData: FormData) {
  const name = readFormValue(formData, "name");

  if (!name) {
    throw new Error("Profile name is required.");
  }

  return {
    externalName: readFormValue(formData, "externalName") || null,
    icon: readFormValue(formData, "icon") || DEFAULT_AGENT_PROFILE_ICON,
    name,
  };
}

async function requireOwnedProfile(profileId: string) {
  const user = await requireUser();
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("profile")
    .select(PROFILE_RECORD_SELECT)
    .eq("id", profileId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Profile not found.");
  }

  return data as ProfileRecord;
}

async function requireOwnedKey(keyId: string) {
  const user = await requireUser();
  const { data, error } = await createServiceRoleClient()
    .from("key")
    .select(
      "created_at, deleted_at, id, owner_profile_id, prefix, profile:owner_profile_id(owner_user_id)",
    )
    .eq("id", keyId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const profile = data?.profile;

  if (
    !data ||
    !profile ||
    typeof profile !== "object" ||
    !("owner_user_id" in profile) ||
    profile.owner_user_id !== user.id
  ) {
    throw new Error("API key not found.");
  }

  return data as Pick<
    ProfileKeyRecord,
    "created_at" | "deleted_at" | "id" | "owner_profile_id" | "prefix"
  >;
}

export async function createProfileAction(formData: FormData) {
  const profile = normalizeProfile(formData);

  const createdProfile = await callMarbleApi<ProfileRecord>("/profiles", {
    body: {
      ...profile,
      type: "Agent",
    },
    method: "POST",
    profileId: false,
    requireActorProfile: false,
  });

  revalidatePath("/profiles");

  return createdProfile;
}

export async function updateProfileAction(
  profileId: string,
  formData: FormData,
) {
  const existingProfile = await requireOwnedProfile(profileId);

  if (existingProfile.type !== "Agent") {
    throw new Error("Only agent profiles can be edited here.");
  }

  const profile = normalizeProfile(formData);

  const updatedProfile = await callMarbleApi<ProfileRecord>(
    `/profiles/${profileId}`,
    {
      body: profile,
      method: "PATCH",
    },
  );

  revalidatePath("/profiles");

  return updatedProfile;
}

export async function deleteProfileAction(profileId: string) {
  const profile = await requireOwnedProfile(profileId);

  if (profile.type !== "Agent") {
    throw new Error("The automatic human profile cannot be deleted here.");
  }

  const { error } = await createServiceRoleClient()
    .from("profile")
    .delete()
    .eq("id", profile.id)
    .eq("owner_user_id", profile.owner_user_id);

  if (error) {
    if (error.message.includes("violates foreign key constraint")) {
      throw new Error(
        "Delete or move resources owned by this profile before deleting it.",
      );
    }

    throw error;
  }

  revalidatePath("/profiles");
}

export async function createProfileKeyAction(profileId: string) {
  const profile = await requireOwnedProfile(profileId);
  const created = await callMarbleApi<{
    key: ProfileKeyRecord;
    token: string;
  }>("/keys", {
    body: {
      ownerProfileId: profile.id,
    },
    method: "POST",
  });

  revalidatePath("/profiles");

  return {
    key: created.key,
    profileId: profile.id,
    profileName: profile.name,
    token: created.token,
  };
}

export async function revokeProfileKeyAction(keyId: string) {
  const key = await requireOwnedKey(keyId);

  await callMarbleApi(`/keys/${keyId}`, {
    method: "DELETE",
  });

  revalidatePath("/profiles");

  return {
    id: key.id,
    revokedAt: new Date().toISOString(),
  };
}
