/**
 * Test setup for `@marble/api` behavioral smoke tests.
 *
 * These smoke tests exercise the API surface at two levels:
 *
 *   - **Validation-layer tests** (no DB required): construct a stub
 *     `ApiContext` and call the procedure with invalid inputs. oRPC's
 *     input validation runs before the handler, so the store is never
 *     touched. These are deterministic and fast — they belong in
 *     `bun test` and run in CI without infrastructure.
 *
 *   - **Integration-layer tests** (Supabase local required): construct
 *     a real `ApiContext` with a test profile + service-role client
 *     and call the procedure end-to-end. These exercise the handler →
 *     store → database path. They require a running local Supabase and
 *     test fixtures (see `createIntegrationContext` below).
 *
 * The integration helper is intentionally scaffolded but not yet wired
 * because Marble's test fixture conventions aren't established. When we
 * commit to integration tests, fill in `createIntegrationContext` and
 * add per-resource positive tests alongside the validation suites.
 */

import type { ApiContext, MarbleApiRuntime } from "../src";

/**
 * Shared input fixtures for validation tests.
 *
 * `VALID_UUID` is a syntactically valid v4 UUID that will pass the
 * `z.uuidv4()` validator. The handler is never reached (the stub store
 * throws), so the actual ID doesn't need to exist.
 *
 * `INVALID_UUID` is a deliberately malformed string used in negative
 * tests — every operation with a UUID input should reject this.
 */
export const VALID_UUID = "00000000-0000-4000-8000-000000000000";
export const INVALID_UUID = "not-a-uuid";

const DUMMY_RUNTIME: MarbleApiRuntime = {
  jwtSecret: "test-jwt-secret",
  publishableKey: "test-publishable-key",
  serviceRoleKey: "test-service-role-key",
  supabaseUrl: "http://127.0.0.1:54321",
};

/**
 * Build a stub `ApiContext` for validation-layer tests. The `store` is
 * deliberately a thrown-when-touched proxy so that any test that
 * accidentally reaches the store fails loudly rather than silently
 * passing on an undefined.
 *
 * Use this for tests that prove input validation rejects bad payloads
 * before the handler runs.
 */
export const createValidationContext = (): ApiContext => {
  const store = new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(
          `Validation-layer test reached the store (read \`${String(prop)}\`). Validation should have rejected this input before the handler ran.`,
        );
      },
    },
  ) as ApiContext["store"];

  return {
    actor: {
      keyId: "test-key",
      profileId: "00000000-0000-0000-0000-000000000000",
      type: "api-key",
      userId: "00000000-0000-0000-0000-000000000001",
    },
    recordTiming: () => {},
    requestId: "test-request",
    runtime: DUMMY_RUNTIME,
    store,
    timings: [],
  };
};
