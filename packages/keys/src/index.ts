import {
  ALPHANUMERIC,
  parseBearerToken,
  randomToken,
  sha256Base64Url,
} from "@marble/lib/crypto";
import type { SupabaseClient, Tables } from "@marble/supabase";

const API_KEY_ALPHABET = ALPHANUMERIC;

export const API_KEY_HASH_LENGTH = 22;
export const API_KEY_PREFIX_LENGTH = 6;
export const API_KEY_SECRET_LENGTH = 24;
export const API_KEY_TOKEN_PREFIX = "mbl_";

const createSecret = randomToken({
  alphabet: API_KEY_ALPHABET,
  length: API_KEY_SECRET_LENGTH,
});

type HeaderSource = {
  get(name: string): string | null;
};

export type ApiKeyRecord = Tables<"key">;
export type ProfileRecord = Tables<"profile">;
export type ResolvedApiKeyRecord = ApiKeyRecord & {
  profile: ProfileRecord | null;
};

export type ApiKeyMaterial = {
  hash: string;
  prefix: string;
  secret: string;
  token: string;
};

export function apiKeyPreview(prefix: string) {
  return `${API_KEY_TOKEN_PREFIX}${prefix}...`;
}

export function getApiKeyTokenFromHeaders(headers: HeaderSource) {
  return parseBearerToken(headers, {
    tokenPrefix: API_KEY_TOKEN_PREFIX,
  });
}

export function parseApiKeyToken(token: string) {
  const normalized = token.trim();
  if (!normalized.startsWith(API_KEY_TOKEN_PREFIX)) {
    return null;
  }

  const secret = normalized.slice(API_KEY_TOKEN_PREFIX.length);
  if (secret.length !== API_KEY_SECRET_LENGTH) {
    return null;
  }

  for (const character of secret) {
    if (!API_KEY_ALPHABET.includes(character)) {
      return null;
    }
  }

  return {
    prefix: secret.slice(0, API_KEY_PREFIX_LENGTH),
    secret,
    token: normalized,
  };
}

async function selectKeyCandidates(
  supabase: SupabaseClient,
  prefix: string,
): Promise<ResolvedApiKeyRecord[]> {
  const { data, error } = await supabase
    .from("key")
    .select("*, profile:owner_profile_id(*)")
    .eq("prefix", prefix)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ResolvedApiKeyRecord[];
}

export async function hashApiKeySecret(secret: string) {
  return sha256Base64Url(secret, API_KEY_HASH_LENGTH);
}

export async function createApiKeyMaterial(): Promise<ApiKeyMaterial> {
  const secret = createSecret();
  return {
    hash: await hashApiKeySecret(secret),
    prefix: secret.slice(0, API_KEY_PREFIX_LENGTH),
    secret,
    token: `${API_KEY_TOKEN_PREFIX}${secret}`,
  };
}

export async function createApiKeyRecord(
  supabase: SupabaseClient,
  ownerProfileId: string,
) {
  const material = await createApiKeyMaterial();
  const { data, error } = await supabase
    .from("key")
    .insert({
      hash: material.hash,
      owner_profile_id: ownerProfileId,
      prefix: material.prefix,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    key: data,
    token: material.token,
  };
}

export async function getApiKeyRecord(
  supabase: SupabaseClient,
  keyId: string,
): Promise<ApiKeyRecord | null> {
  const { data, error } = await supabase
    .from("key")
    .select("*")
    .eq("id", keyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function listApiKeysForProfiles(
  supabase: SupabaseClient,
  ownerProfileIds: string[],
  options?: {
    includeDeleted?: boolean;
  },
): Promise<ApiKeyRecord[]> {
  if (ownerProfileIds.length === 0) {
    return [];
  }

  let request = supabase
    .from("key")
    .select("*")
    .in("owner_profile_id", ownerProfileIds)
    .order("created_at", {
      ascending: false,
    });

  if (!options?.includeDeleted) {
    request = request.is("deleted_at", null);
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function resolveApiKeyAuth(
  supabase: SupabaseClient,
  token: string,
): Promise<ResolvedApiKeyRecord | null> {
  const parsed = parseApiKeyToken(token);
  if (!parsed) {
    return null;
  }

  const [hash, candidates] = await Promise.all([
    hashApiKeySecret(parsed.secret),
    selectKeyCandidates(supabase, parsed.prefix),
  ]);

  return candidates.find((candidate) => candidate.hash === hash) ?? null;
}

export async function revokeApiKeyRecord(
  supabase: SupabaseClient,
  keyId: string,
) {
  const { data, error } = await supabase
    .from("key")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("id", keyId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
