import { Pane } from "../../../components/pane";
import { requireUser } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";
import { PROFILE_RECORD_SELECT, type ProfileRecord } from "./model";
import { ProfilesPageView } from "./view";

export default async function Profile3Page() {
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
    <Pane
      crumbs={[
        {
          label: "Profiles",
        },
        {
          label: "Profile 3",
        },
      ]}
    >
      <ProfilesPageView
        initialProfiles={(data ?? []) as ProfileRecord[]}
        userId={user.id}
      />
    </Pane>
  );
}
