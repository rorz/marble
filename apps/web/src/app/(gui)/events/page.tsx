import type { Database } from "@marble/supabase";
import { MarblePane } from "@marble/ui";
import type { Metadata } from "next";
import { requireUser } from "../../../lib/auth";
import {
  createServiceRoleClient,
  listOwnedProfileIds,
} from "../../../lib/supabase/service-role";
import { EventFeedBoard } from "./event-feed-board";

type EventRow = Database["public"]["Tables"]["event"]["Row"];
type ProfileRow = Pick<
  Database["public"]["Tables"]["profile"]["Row"],
  "created_at" | "external_name" | "id" | "name" | "type"
>;

const EVENT_FEED_LIMIT = 120;

export const metadata: Metadata = {
  description:
    "A live activity feed for the current user's profile-scoped Marble events.",
  title: "Events | Marble",
};

async function loadOwnedEventFeed() {
  const user = await requireUser();
  const ownedProfileIds = await listOwnedProfileIds(user.id);
  const supabase = createServiceRoleClient();
  const profileQuery = supabase
    .from("profile")
    .select("id, name, type, external_name, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", {
      ascending: true,
    });

  if (ownedProfileIds.length === 0) {
    const { data, error } = await profileQuery;

    if (error) {
      throw error;
    }

    return {
      events: [] as EventRow[],
      profiles: (data ?? []) as ProfileRow[],
      userId: user.id,
    };
  }

  const [profilesResult, eventsResult] = await Promise.all([
    profileQuery,
    supabase
      .from("event")
      .select("*")
      .in("actor_profile_id", ownedProfileIds)
      .order("created_at", {
        ascending: false,
      })
      .limit(EVENT_FEED_LIMIT),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (eventsResult.error) {
    throw eventsResult.error;
  }

  return {
    events: (eventsResult.data ?? []) as EventRow[],
    profiles: (profilesResult.data ?? []) as ProfileRow[],
    userId: user.id,
  };
}

export default async function EventsPage() {
  const { events, profiles, userId } = await loadOwnedEventFeed();

  return (
    <MarblePane
      crumbs={[
        {
          id: "events",
          label: "Events",
        },
      ]}
    >
      <EventFeedBoard
        initialEvents={events}
        limit={EVENT_FEED_LIMIT}
        profiles={profiles}
        userId={userId}
      />
    </MarblePane>
  );
}
