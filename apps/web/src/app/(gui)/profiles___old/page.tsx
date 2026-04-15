import { MarblePane } from "@marble/ui";
import { requireUser } from "../../../lib/auth";
import { listProfilesWithKeys, listSecrets } from "./actions";
import { ProfileManager } from "./profile-manager";

export default async function ProfilesPage() {
  await requireUser();
  const [profiles, secrets] = await Promise.all([
    listProfilesWithKeys(),
    listSecrets(),
  ]);

  return (
    <MarblePane
      crumbs={[
        {
          id: "profiles",
          label: "Profiles",
        },
      ]}
    >
      <ProfileManager
        profiles={profiles}
        secrets={secrets}
      />
    </MarblePane>
  );
}
