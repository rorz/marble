import type { Database } from "@marble/supabase";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import {
  createServiceRoleClient,
  listOwnedProfileIds,
} from "../../../lib/supabase/service-role";
import SignOutButton from "../../sign-out-button";
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
  };
}

export default async function EventsPage() {
  const { events, profiles } = await loadOwnedEventFeed();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="border-zinc-200 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <h1 className="font-semibold text-lg tracking-tight">marble</h1>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                className="rounded-lg px-3 py-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                href="/tables"
              >
                Tables
              </Link>
              <Link
                className="rounded-lg bg-sky-50 px-3 py-1.5 font-medium text-sky-700"
                href="/events"
              >
                Events
              </Link>
              <Link
                className="rounded-lg px-3 py-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                href="/profiles"
              >
                Profiles + Secrets
              </Link>
            </nav>
          </div>

          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <EventFeedBoard
          initialEvents={events}
          limit={EVENT_FEED_LIMIT}
          profiles={profiles}
        />
      </main>
    </div>
  );
}
