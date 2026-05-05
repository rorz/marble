import "server-only";

import { MarbleClient } from "@marble/sdk";
import { createClient } from "./supabase/server";

export async function createServerMarbleSdk(
  options: { profileId?: string } = {},
) {
  const supabase = await createClient();

  return new MarbleClient({
    driver: {
      client: supabase,
      profileId: options.profileId,
      type: "supabase",
    },
  });
}

async function listCurrentUserProfileIds() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile")
    .select("id")
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((profile) => profile.id);
}

export async function createServerMarbleSdkForProject(projectId: string) {
  const profileIds = await listCurrentUserProfileIds();

  for (const profileId of profileIds) {
    const sdk = await createServerMarbleSdk({
      profileId,
    });

    try {
      const project = await sdk.projects.get({
        projectId,
      });

      return {
        project,
        sdk,
      };
    } catch {
      // Try the next owned profile; project access is profile-scoped in the SDK.
    }
  }

  return null;
}
