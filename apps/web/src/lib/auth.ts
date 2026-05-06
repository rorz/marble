import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

type CurrentUser = {
  id: string;
};

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const userId = data.user?.id;

  if (error || !userId) {
    return null;
  }

  return {
    id: userId,
  } satisfies CurrentUser;
}

export async function getCurrentSupabaseAccessToken() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return data.session?.access_token ?? null;
}

export async function redirectIfAuthenticated() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/projects");
  }
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
