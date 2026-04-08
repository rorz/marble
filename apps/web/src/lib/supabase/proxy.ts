import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseBrowserKey, getSupabaseUrl } from "./config";

const PROTECTED_PATHS = [
  "/demo",
  "/test-programs",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseBrowserKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set({
              name: cookie.name,
              value: cookie.value,
              ...cookie.options,
            });
          }

          response = NextResponse.next({
            request,
          });

          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          }
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const signedIn = Boolean(claimsData?.claims?.sub);
  const pathname = request.nextUrl.pathname;

  if (!signedIn && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (signedIn && pathname === "/") {
    return NextResponse.redirect(new URL("/demo", request.url));
  }

  return response;
}
