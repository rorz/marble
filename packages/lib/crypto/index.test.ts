import { describe, expect, test } from "bun:test";
import {
  ALPHANUMERIC,
  parseBearerToken,
  randomToken,
  sha256Base64Url,
  toBase64,
  toBase64Url,
} from "./index";

const headers = (entries: Record<string, string>) => ({
  get(name: string) {
    return entries[name] ?? entries[name.toLowerCase()] ?? null;
  },
});

describe("randomToken", () => {
  test("produces tokens of the requested length over the requested alphabet", () => {
    const generate = randomToken({
      alphabet: "ab",
      length: 16,
    });
    const token = generate();
    expect(token).toHaveLength(16);
    expect(
      [
        ...token,
      ].every((char) => char === "a" || char === "b"),
    ).toBe(true);
  });

  test("ALPHANUMERIC contains the expected character classes", () => {
    expect(ALPHANUMERIC).toMatch(/^[0-9a-zA-Z]+$/);
    expect(ALPHANUMERIC).toHaveLength(62);
  });
});

describe("toBase64Url", () => {
  test("encodes UTF-8 strings before base64 conversion", () => {
    const value = "hello 🌍 café";
    const encoded = toBase64(value);
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
    );

    expect(decoded).toBe(value);
  });

  test("encodes a buffer using URL-safe base64 without padding", () => {
    const buffer = new TextEncoder().encode("hello").buffer as ArrayBuffer;
    expect(toBase64Url(buffer)).toBe("aGVsbG8");
  });

  test("encodes UTF-8 strings using URL-safe base64 without padding", () => {
    expect(toBase64Url("😀")).toBe("8J-YgA");
  });

  test("uses '_' instead of '/' (URL-safe)", () => {
    // 0xff,0xfe,0xfd → standard base64 "//79", URL-safe "__79".
    const buffer = new Uint8Array([
      0xff,
      0xfe,
      0xfd,
    ]).buffer;
    const encoded = toBase64Url(buffer);
    expect(encoded).toBe("__79");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  test("uses '-' instead of '+' (URL-safe)", () => {
    // 0xfb,0xff,0xff → standard base64 "+///", URL-safe "-___".
    const buffer = new Uint8Array([
      0xfb,
      0xff,
      0xff,
    ]).buffer;
    const encoded = toBase64Url(buffer);
    expect(encoded).toBe("-___");
  });
});

describe("sha256Base64Url", () => {
  test("matches the canonical SHA-256 digest of an empty string", async () => {
    const empty = await sha256Base64Url("");
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(empty).toBe("47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU");
  });

  test("truncates when length is provided", async () => {
    const digest = await sha256Base64Url("anything", 8);
    expect(digest).toHaveLength(8);
  });
});

describe("parseBearerToken", () => {
  test("returns x-api-key when present, trimmed", () => {
    expect(
      parseBearerToken(
        headers({
          "x-api-key": "  abc123  ",
        }),
      ),
    ).toBe("abc123");
  });

  test("falls back to Authorization: Bearer", () => {
    expect(
      parseBearerToken(
        headers({
          authorization: "Bearer xyz",
        }),
      ),
    ).toBe("xyz");
  });

  test("accepts capitalized Authorization header", () => {
    expect(
      parseBearerToken(
        headers({
          Authorization: "Bearer xyz",
        }),
      ),
    ).toBe("xyz");
  });

  test("returns null when no auth header is present", () => {
    expect(parseBearerToken(headers({}))).toBeNull();
  });

  test("rejects non-Bearer schemes", () => {
    expect(
      parseBearerToken(
        headers({
          authorization: "Basic abc",
        }),
      ),
    ).toBeNull();
  });

  test("rejects bearer with extra tokens after the credentials", () => {
    expect(
      parseBearerToken(
        headers({
          authorization: "Bearer abc def",
        }),
      ),
    ).toBeNull();
  });

  test("rejects bearer with no credentials", () => {
    expect(
      parseBearerToken(
        headers({
          authorization: "Bearer",
        }),
      ),
    ).toBeNull();
  });

  test("filters by tokenPrefix when supplied", () => {
    expect(
      parseBearerToken(
        headers({
          authorization: "Bearer mbl_abc",
        }),
        {
          tokenPrefix: "mbl_",
        },
      ),
    ).toBe("mbl_abc");
    expect(
      parseBearerToken(
        headers({
          authorization: "Bearer other_abc",
        }),
        {
          tokenPrefix: "mbl_",
        },
      ),
    ).toBeNull();
  });

  test("ignores empty x-api-key and falls through to Authorization", () => {
    expect(
      parseBearerToken(
        headers({
          authorization: "Bearer xyz",
          "x-api-key": "   ",
        }),
      ),
    ).toBe("xyz");
  });
});
