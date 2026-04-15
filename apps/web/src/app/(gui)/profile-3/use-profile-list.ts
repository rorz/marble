"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/browser";
import {
  type ProfileRecord,
  removeProfile,
  sortProfiles,
  upsertProfile,
} from "./model";

type RealtimeStatus = "connecting" | "error" | "live";
type RealtimePayload<Row> = {
  eventType: "DELETE" | "INSERT" | "UPDATE";
  new: Partial<Row>;
  old: Partial<Row>;
};

function toProfileRecord(payload: Partial<ProfileRecord>) {
  if (
    typeof payload.id !== "string" ||
    typeof payload.created_at !== "string" ||
    typeof payload.name !== "string" ||
    typeof payload.owner_user_id !== "string" ||
    (payload.type !== "Agent" && payload.type !== "Human") ||
    typeof payload.updated_at !== "string"
  ) {
    return null;
  }

  return {
    created_at: payload.created_at,
    external_name:
      typeof payload.external_name === "string" ? payload.external_name : null,
    id: payload.id,
    name: payload.name,
    owner_user_id: payload.owner_user_id,
    type: payload.type,
    updated_at: payload.updated_at,
  } satisfies ProfileRecord;
}

export function useProfileList(
  initialProfiles: ProfileRecord[],
  userId: string,
) {
  const [profiles, setProfiles] = useState(() => sortProfiles(initialProfiles));
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`profile-3:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profile",
        },
        (payload) => {
          const change = payload as RealtimePayload<ProfileRecord>;

          setProfiles((current) => {
            if (change.eventType === "DELETE") {
              return typeof change.old.id === "string"
                ? removeProfile(current, change.old.id)
                : current;
            }

            const nextProfile = toProfileRecord(change.new);
            return nextProfile ? upsertProfile(current, nextProfile) : current;
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("live");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("error");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    userId,
  ]);

  return {
    profiles,
    realtimeStatus,
    setProfiles,
  };
}
