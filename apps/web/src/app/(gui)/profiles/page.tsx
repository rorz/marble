import { MarblePane } from "@marble/ui";
import { requireUser } from "../../../lib/auth";
import { createServerMarbleSdk } from "../../../lib/marble-sdk-server";
import type { ManagedProfileRecord } from "./shared";
import { ProfilesPageView } from "./view";

export default async function Profile4Page() {
  const user = await requireUser();
  const sdk = await createServerMarbleSdk();
  const [profiles, keys] = await Promise.all([
    sdk.profiles.list({}),
    sdk.keys.list({
      includeDeleted: true,
    }),
  ]);
  const keysByProfileId = new Map<string, ManagedProfileRecord["keys"]>();

  for (const key of keys) {
    const profileKeys = keysByProfileId.get(key.ownerProfileId) ?? [];

    profileKeys.push(key);
    keysByProfileId.set(key.ownerProfileId, profileKeys);
  }

  return (
    <MarblePane
      className="max-w-3xl"
      description="Your human profile is created automatically. Add separate agent profiles for the tools you delegate to, then mint keys inside each profile so activity stays attributable."
      title="Profiles"
      width="Full"
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
