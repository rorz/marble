import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthCookieNames } from "./auth-cookies";
import { getSupabaseBrowserKey, getSupabaseUrl } from "./config";

const PROTECTED_PATHS = [
  "/profiles",
  "/projects",
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

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  let signedIn = Boolean(claimsData?.claims?.sub);
  let shouldClearAuthCookies = Boolean(claimsError);

  if (signedIn) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      signedIn = false;
      shouldClearAuthCookies = true;
    }
  }

  const authCookieNames = shouldClearAuthCookies
    ? getSupabaseAuthCookieNames(request.cookies.getAll())
    : [];
  const pathname = request.nextUrl.pathname;

  if (!signedIn && isProtectedPath(pathname)) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    return clearSupabaseAuthCookies(request, redirectResponse, authCookieNames);
  }

  if (signedIn && pathname === "/") {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  if (authCookieNames.length > 0) {
    return clearSupabaseAuthCookies(request, response, authCookieNames);
  }

  return response;
}
