import { MarblePane } from "@marble/ui";
import { requireUser } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";
import { PROFILE_RECORD_SELECT, type ProfileRecord } from "./shared";
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

  return (
    <MarblePane
      description="Create a profile for each agent you intend to use with Marble. Every action taken on your account will be tracked according to its profile so that you can easily view changes according to who made them."
      title="Profiles"
      width="Narrow"
    >
      <ProfilesPageView
        initialProfiles={(data ?? []) as ProfileRecord[]}
        userId={user.id}
      />
    </MarblePane>
  );
}
