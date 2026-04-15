import type { Database } from "@marble/supabase";
import { MarblePane } from "@marble/ui";
import { requireUser } from "../../../lib/auth";
import { createClient } from "../../../lib/supabase/server";
import { ProfilesPageView } from "./view";

const PROFILE_RECORD_SELECT =
  "created_at, external_name, id, name, owner_user_id, type, updated_at";

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

export default async function ProfilesPage() {
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
      crumbs={[
        {
          id: "profiles",
          label: "Profiles",
        },
      ]}
    >
      <ProfilesPageView
        initialProfiles={(data ?? []) as ProfileRecord[]}
        userId={user.id}
      />
    </MarblePane>
  );
}
