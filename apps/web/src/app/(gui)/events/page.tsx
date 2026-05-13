import { MarblePane } from "@marble/ui";
import type { Metadata } from "next";
import { requireUser } from "../../../lib/auth";
import { createServerMarbleSdk } from "../../../lib/marble-sdk-server";
import { EventFeedBoard } from "./event-feed-board";

const EVENT_FEED_LIMIT = 120;

export const metadata: Metadata = {
  description:
    "A live activity feed for the current user's profile-scoped Marble events.",
  title: "Events | Marble",
};

const loadOwnedEventFeed = async () => {
  const user = await requireUser();
  const sdk = await createServerMarbleSdk();
  const [profiles, events] = await Promise.all([
    sdk.profiles.list({}),
    sdk.events.listForCurrentUser({
      limit: EVENT_FEED_LIMIT,
    }),
  ]);

  return {
    events,
    profiles,
    userId: user.id,
  };
};

const EventsPage = async () => {
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
};
export default EventsPage;
