import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthCookieNames } from "./auth-cookies";
import { supabasePublicConfig } from "./public-config";

const PROTECTED_PATHS = [
  "/automations",
  "/events",
  "/help",
  "/integrations",
  "/pipes",
  "/profiles",
  "/programs",
  "/projects",
  "/secrets",
  "/sources",
  "/tables",
  "/test-programs",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
  cookieNames: ReadonlyArray<string>,
) {
  for (const cookieName of cookieNames) {
    request.cookies.delete(cookieName);
    response.cookies.delete(cookieName);
  }

  return response;
}

function copySupabaseCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie.name, cookie.value, cookie);
  }

  return target;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabasePublicConfig.url,
    supabasePublicConfig.publishableKey,
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

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const signedIn = Boolean(userData.user?.id);
  const shouldClearAuthCookies = Boolean(userError);

  const authCookieNames = shouldClearAuthCookies
    ? getSupabaseAuthCookieNames(request.cookies.getAll())
    : [];
  const pathname = request.nextUrl.pathname;

  if (!signedIn && isProtectedPath(pathname)) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    return clearSupabaseAuthCookies(request, redirectResponse, authCookieNames);
  }

  if (signedIn && pathname === "/") {
    return copySupabaseCookies(
      response,
      NextResponse.redirect(new URL("/projects", request.url)),
    );
  }

  if (authCookieNames.length > 0) {
    return clearSupabaseAuthCookies(request, response, authCookieNames);
  }

  return response;
}
