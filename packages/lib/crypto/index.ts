/**
 * Cryptographic primitives. Single third-party dep: `nanoid`.
 *
 * These are domain-agnostic helpers used by `@marble/keys` (API key
 * generation and HTTP bearer parsing). They live here so they can be
 * exercised under unit tests without booting Supabase, and so other
 * packages can compose them without taking on a Supabase dependency.
 *
 * `crypto.subtle` and `Buffer` are runtime built-ins and don't count
 * toward the per-submodule dependency budget.
 */

import { customAlphabet } from "nanoid";

export const ALPHANUMERIC =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const textEncoder = new TextEncoder();
const BASE64_CHUNK_SIZE = 0x8000;

const toBytes = (value: string | ArrayBuffer | Uint8Array): Uint8Array => {
  if (typeof value === "string") {
    return textEncoder.encode(value);
  }

  return value instanceof Uint8Array ? value : new Uint8Array(value);
};

const bytesToBinary = (bytes: Uint8Array): string => {
  let binary = "";

  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + BASE64_CHUNK_SIZE),
    );
  }

  return binary;
};

/**
 * Build a random-token generator over a fixed alphabet and length. Returns
 * a thunk to match `nanoid`'s `customAlphabet` shape.
 */
export const randomToken = (options: {
  alphabet: string;
  length: number;
}): (() => string) => {
  return customAlphabet(options.alphabet, options.length);
};

/** Convert bytes or a UTF-8 string to standard base64. */
export const toBase64 = (value: string | ArrayBuffer | Uint8Array): string => {
  return btoa(bytesToBinary(toBytes(value)));
};

/** Convert bytes or a UTF-8 string to a URL-safe base64 string (no padding). */
export const toBase64Url = (
  value: string | ArrayBuffer | Uint8Array,
): string => {
  return toBase64(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

/**
 * SHA-256 the input and return a URL-safe base64 digest. Pass `length` to
 * truncate the digest (e.g. 22 chars for a short, collision-resistant key
 * fingerprint).
 */
export const sha256Base64Url = async (
  value: string,
  length?: number,
): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(value),
  );
  const encoded = toBase64Url(digest);
  return length === undefined ? encoded : encoded.slice(0, length);
};

type HeaderSource = {
  get(name: string): string | null;
};

/**
 * Extract a bearer-style API token from request headers. Looks for
 *
 *   - `x-api-key` (preferred, exact value), or
 *   - `Authorization: Bearer <token>` (case-insensitive scheme).
 *
 * If `tokenPrefix` is supplied, the bearer value must start with it (used
 * by `@marble/keys` to require the `mbl_` namespace). Returns `null` when
 * no recognizable token is present.
 */
export const parseBearerToken = (
  headers: HeaderSource,
  options: {
    tokenPrefix?: string;
  } = {},
): string | null => {
  const directKey = headers.get("x-api-key")?.trim();
  if (directKey) {
    return directKey;
  }

  const authorization =
    headers.get("authorization") ?? headers.get("Authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, credentials, ...rest] = authorization.trim().split(/\s+/);
  if (rest.length > 0 || scheme.toLowerCase() !== "bearer" || !credentials) {
    return null;
  }

  const token = credentials.trim();

  if (
    options.tokenPrefix !== undefined &&
    !token.startsWith(options.tokenPrefix)
  ) {
    return null;
  }

  return token;
};
