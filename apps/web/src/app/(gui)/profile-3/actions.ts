"use server";

import type { Database } from "@marble/supabase";
import { requireUser } from "../../../lib/auth";
import { callMarbleApi } from "../../../lib/marble-api";
import { createClient as createServerClient } from "../../../lib/supabase/server";
import { createServiceRoleClient } from "../../../lib/supabase/service-role";
import {
  PROFILE_RECORD_SELECT,
  type ProfileRecord,
  readProfileDraft,
} from "./model";

const PROFILE_TYPES = new Set<ProfileType>([
  "Agent",
  "Human",
]);

type ProfileType = Database["public"]["Enums"]["profile_type"];

function normalizeProfileInput(formData: FormData) {
  const draft = readProfileDraft(formData);
  const type = PROFILE_TYPES.has(draft.type) ? draft.type : "Agent";

  return {
    externalName: draft.externalName,
    name: draft.name,
    type,
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
  const input = normalizeProfileInput(formData);

  return callMarbleApi<ProfileRecord>("/profiles", {
    body: {
      externalName: input.externalName,
      name: input.name,
      type: input.type,
    },
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
  const input = normalizeProfileInput(formData);

  return callMarbleApi<ProfileRecord>(`/profiles/${profileId}`, {
    body: {
      externalName: input.externalName,
      name: input.name,
      type: input.type,
    },
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

  return {
    id: profile.id,
  };
}
