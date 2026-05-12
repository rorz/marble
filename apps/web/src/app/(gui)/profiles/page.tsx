import { MarbleAlert, MarblePane } from "@marble/ui";
import { requireUser } from "../../../lib/auth";
import { createServerMarbleSdk } from "../../../lib/marble-sdk-server";
import type { ManagedProfileRecord, ProfileKeyRecord } from "./shared";
import { ProfilesPageView } from "./view";

export default async function ProfilesPage() {
  const user = await requireUser();
  const sdk = await createServerMarbleSdk();
  const [profiles, keys] = await Promise.all([
    sdk.profiles.list({}),
    sdk.keys.list({
      includeDeleted: true,
    }),
  ]);
  const keysByProfileId = new Map<string, ProfileKeyRecord[]>();

  for (const key of keys) {
    const profileKeys = keysByProfileId.get(key.ownerProfileId) ?? [];

    profileKeys.push(key);
    keysByProfileId.set(key.ownerProfileId, profileKeys);
  }

  const managed: ManagedProfileRecord[] = profiles.map((profile) => ({
    ...profile,
    keys: keysByProfileId.get(profile.id) ?? [],
  }));
  const human = managed.find((profile) => profile.type === "Human") ?? null;
  const agent = managed.find((profile) => profile.type === "Agent") ?? null;

  return (
    <MarblePane
      description="One human, one agent. Mint API keys on either side to authenticate as that identity from outside the GUI."
      title="Profiles"
      width="Wide"
    >
      {human && agent ? (
        <ProfilesPageView
          agent={agent}
          human={human}
          userId={user.id}
        />
      ) : (
        <MarbleAlert tone="error">
          Marble expected an automatic human profile and agent profile for this
          account, but the pair could not be loaded. This indicates the
          on_auth_user_created trigger did not run for your user.
        </MarbleAlert>
      )}
    </MarblePane>
  );
}
