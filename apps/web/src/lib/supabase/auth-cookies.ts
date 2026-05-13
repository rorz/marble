const SUPABASE_AUTH_COOKIE_PATTERNS = [
  /^sb-.*-auth-token(?:\.\d+)?$/,
  /^sb-.*-auth-token-code-verifier(?:\.\d+)?$/,
  /^supabase-auth-token(?:\.\d+)?$/,
  /^supabase-auth-token-code-verifier(?:\.\d+)?$/,
];

const isSupabaseAuthCookieName = (name: string): boolean => {
  return SUPABASE_AUTH_COOKIE_PATTERNS.some((pattern) => pattern.test(name));
};

export const getSupabaseAuthCookieNames = (
  cookies: ReadonlyArray<{
    name: string;
  }>,
): string[] => {
  return cookies.map((cookie) => cookie.name).filter(isSupabaseAuthCookieName);
};
