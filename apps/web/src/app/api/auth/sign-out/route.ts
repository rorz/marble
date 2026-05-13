import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAuthCookieNames } from "../../../../lib/supabase/auth-cookies";

export const POST = async () => {
  const cookieStore = await cookies();

  for (const cookieName of getSupabaseAuthCookieNames(cookieStore.getAll())) {
    cookieStore.delete(cookieName);
  }

  return NextResponse.json({
    ok: true,
  });
};
