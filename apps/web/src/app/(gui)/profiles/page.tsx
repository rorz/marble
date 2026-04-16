import { apiKeyPreview, listApiKeysForProfiles } from "@marble/keys";
import { MarblePane } from "@marble/ui";
import { requireUser } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";
import { createServiceRoleClient } from "../../../lib/supabase/service-role";
import {
  type ManagedProfileRecord,
  PROFILE_RECORD_SELECT,
  type ProfileRecord,
} from "./shared";
import { ProfilesPageView } from "./view";

export default async function Profile4Page() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile")
    .select(PROFILE_RECORD_SELECT)
    .eq("owner_user_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  const profiles = (data ?? []) as ProfileRecord[];
  const keys = await listApiKeysForProfiles(
    createServiceRoleClient(),
    profiles.map((profile) => profile.id),
    {
      includeDeleted: true,
    },
  );
  const keysByProfileId = new Map<string, ManagedProfileRecord["keys"]>();

  for (const key of keys) {
    const profileKeys = keysByProfileId.get(key.owner_profile_id) ?? [];

    profileKeys.push({
      created_at: key.created_at,
      deleted_at: key.deleted_at,
      id: key.id,
      owner_profile_id: key.owner_profile_id,
      prefix: key.prefix,
      preview: apiKeyPreview(key.prefix),
    });
    keysByProfileId.set(key.owner_profile_id, profileKeys);
  }

  return (
    <MarblePane
      description="Create a profile for each agent you intend to use with Marble. Every action taken on your account will be tracked according to its profile so that you can easily view changes according to who made them."
      title="Profiles"
      width="Narrow"
    >
      <ProfilesPageView
        initialProfiles={profiles.map((profile) => ({
          ...profile,
          keys: keysByProfileId.get(profile.id) ?? [],
        }))}
        userId={user.id}
      />
    </MarblePane>
  );
}
