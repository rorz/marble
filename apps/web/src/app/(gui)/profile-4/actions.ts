"use server";

import type { Database } from "@marble/supabase";
import { requireUser } from "../../../lib/auth";
import { callMarbleApi } from "../../../lib/marble-api";
import { createClient as createServerClient } from "../../../lib/supabase/server";
import { createServiceRoleClient } from "../../../lib/supabase/service-role";

const PROFILE_RECORD_SELECT =
  "created_at, external_name, id, name, owner_user_id, type, updated_at";
const PROFILE_TYPES = new Set<ProfileType>([
  "Agent",
  "Human",
]);

type ProfileRecord = Pick<
  Database["public"]["Tables"]["profile"]["Row"],
  | "created_at"
  | "external_name"
  | "id"
  | "name"
  | "owner_user_id"
  | "type"
  | "updated_at"
>;
type ProfileType = Database["public"]["Enums"]["profile_type"];

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProfile(formData: FormData) {
  const name = readFormValue(formData, "name");

  if (!name) {
    throw new Error("Profile name is required.");
  }

  const type = readFormValue(formData, "type");

  return {
    externalName: readFormValue(formData, "externalName") || null,
    name,
    type: PROFILE_TYPES.has(type as ProfileType)
      ? (type as ProfileType)
      : "Agent",
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

export async function createProfileAction(formData: FormData) {
  const profile = normalizeProfile(formData);

  return callMarbleApi<ProfileRecord>("/profiles", {
    body: profile,
    method: "POST",
    profileId: false,
    requireActorProfile: false,
  });
}

export async function updateProfileAction(
  profileId: string,
  formData: FormData,
) {
  await requireOwnedProfile(profileId);
  const profile = normalizeProfile(formData);

  return callMarbleApi<ProfileRecord>(`/profiles/${profileId}`, {
    body: profile,
    method: "PATCH",
  });
}

export async function deleteProfileAction(profileId: string) {
  const profile = await requireOwnedProfile(profileId);
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
}
