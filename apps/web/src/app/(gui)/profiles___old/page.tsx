import { Pane } from "../../../components/pane";
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
    <Pane
      crumbs={[
        {
          label: "Profiles",
        },
      ]}
    >
      <ProfileManager
        profiles={profiles}
        secrets={secrets}
      />
    </Pane>
  );
}
