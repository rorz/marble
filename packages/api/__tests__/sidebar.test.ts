/**
 * Validation-layer smoke tests for `sidebar.*`.
 *
 * The sidebar is a current-user aggregate read with an optional empty
 * input object. Validation has nothing to reject — the test below
 * exists to assert the procedure is at least mounted and reachable.
 */

import { describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { marbleRouter } from "../src/router";
import { createValidationContext } from "./_setup";

describe("sidebar.getData reachability", () => {
  test("validation passes for empty input and reaches the store", async () => {
    // No invalid payload is possible — input is optional/empty. So the
    // call must reach the handler. The stub store throws on read, which
    // is how we know we got past validation cleanly.
    await expect(
      call(marbleRouter.sidebar.getData, undefined, {
        context: createValidationContext(),
      }),
    ).rejects.toThrow(/store/);
  });
});
