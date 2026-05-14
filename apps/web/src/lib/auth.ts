import "server-only";
import { readNonEmptyString } from "@marble/lib/object";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

type CurrentUser = {
  id: string;
};

type CurrentUserIdentity = {
  avatarUrl: string | null;
  displayName: string;
  email: string | null;
  id: string;
};

export const getCurrentUser = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const userId = data.user?.id;

  if (error || !userId) {
    return null;
  }

  return {
    id: userId,
  } satisfies CurrentUser;
};

const deriveDisplayName = (params: {
  email: string | null;
  fullName: string | null;
  id: string;
  name: string | null;
}): string => {
  if (params.fullName) {
    return params.fullName;
  }

  if (params.name) {
    return params.name;
  }

  if (params.email) {
    const local = params.email.split("@").at(0)?.trim();

    if (local && local.length > 0) {
      return local;
    }
  }

  return params.id.slice(0, 8);
};

const getCurrentUserIdentity = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user) {
    return null;
  }

  const metadata = (user.user_metadata ?? null) as Record<
    string,
    unknown
  > | null;
  const fullName = readNonEmptyString(metadata, "full_name");
  const name = readNonEmptyString(metadata, "name");
  const avatarUrl = readNonEmptyString(metadata, "avatar_url");
  const email = user.email ?? null;
  const displayName = deriveDisplayName({
    email,
    fullName,
    id: user.id,
    name,
  });

  return {
    avatarUrl,
    displayName,
    email,
    id: user.id,
  } satisfies CurrentUserIdentity;
};

export const getCurrentSupabaseAccessToken = async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return data.session?.access_token ?? null;
};

export const redirectIfAuthenticated = async () => {
  const user = await getCurrentUser();

  if (user) {
    redirect("/projects");
  }
};

export const requireUser = async () => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
};

export const requireUserIdentity = async () => {
  const user = await getCurrentUserIdentity();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
};
