import type { Database } from "@marble/supabase";

export const PROFILE_RECORD_SELECT =
  "created_at, external_name, id, name, owner_user_id, type, updated_at";

export type ProfileRecord = Pick<
  Database["public"]["Tables"]["profile"]["Row"],
  | "created_at"
  | "external_name"
  | "id"
  | "name"
  | "owner_user_id"
  | "type"
  | "updated_at"
>;

export type ProfileDraft = {
  externalName: null | string;
  name: string;
  type: ProfileRecord["type"];
};

export function sortProfiles<T extends Pick<ProfileRecord, "created_at">>(
  profiles: T[],
) {
  return [
    ...profiles,
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );
}

export function upsertProfile(
  current: ProfileRecord[],
  profile: ProfileRecord,
): ProfileRecord[] {
  return sortProfiles([
    profile,
    ...current.filter((candidate) => candidate.id !== profile.id),
  ]);
}

export function removeProfile(current: ProfileRecord[], profileId: string) {
  return current.filter((profile) => profile.id !== profileId);
}

export function readProfileDraft(formData: FormData): ProfileDraft {
  const nameValue = formData.get("name");
  const externalNameValue = formData.get("externalName");
  const typeValue = formData.get("type");
  const name = typeof nameValue === "string" ? nameValue.trim() : "";

  if (!name) {
    throw new Error("Profile name is required.");
  }

  return {
    externalName:
      typeof externalNameValue === "string" && externalNameValue.trim()
        ? externalNameValue.trim()
        : null,
    name,
    type: typeValue === "Human" ? "Human" : "Agent",
  };
}

export function buildOptimisticProfile(
  draft: ProfileDraft,
  userId: string,
): ProfileRecord {
  const timestamp = new Date().toISOString();

  return {
    created_at: timestamp,
    external_name: draft.externalName,
    id: `temp:${crypto.randomUUID()}`,
    name: draft.name,
    owner_user_id: userId,
    type: draft.type,
    updated_at: timestamp,
  };
}
