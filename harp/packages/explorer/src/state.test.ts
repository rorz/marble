import { describe, expect, test } from "bun:test";
import { type ApiModel, buildApiModel, type RequestSample } from "@harp/core";
import {
  createExplorerState,
  currentSurfaceNames,
  finalizeModel,
  hasEndpoint,
  hasSurface,
  type ProbeExecutor,
  probeAndMerge,
  probeTargets,
  recordAddedEndpoint,
  recordAuth,
  recordMerge,
  recordRename,
} from "./state";

const sample = (host: string, path: string, body: unknown): RequestSample => ({
  host,
  method: "GET",
  pathname: path,
  query: {},
  requestBody: undefined,
  requestContentType: null,
  responseBody: body as RequestSample["responseBody"],
  responseContentType: "application/json",
  responseStatus: 200,
  startedDateTime: "2026-01-01T00:00:00Z",
  url: `https://${host}${path}`,
});

const stateFor = (model: ApiModel, host: string, allowMutations = false) =>
  createExplorerState({
    baseUrl: `https://${host}`,
    model,
    policy: {
      allowedHosts: [
        host,
      ],
      allowMutations,
    },
  });

const jsonExecutor =
  (status: number, body: unknown): ProbeExecutor =>
  async () => ({
    body: JSON.stringify(body),
    contentType: "application/json",
    ok: status < 400,
    status,
  });

const htmlExecutor =
  (status: number): ProbeExecutor =>
  async () => ({
    body: "<html><body>hi</body></html>",
    contentType: "text/html",
    ok: status < 400,
    status,
  });

describe("probeAndMerge", () => {
  test("merges a read-only JSON probe into the model", async () => {
    const state = stateFor(buildApiModel([]), "api.test");
    const outcome = await probeAndMerge(
      state,
      jsonExecutor(200, [
        {
          id: "1",
          name: "a",
        },
      ]),
      {
        method: "GET",
        path: "/widgets",
      },
    );
    expect(outcome.status).toBe(200);
    const widgets = state.model.resources.find((r) => r.name === "widgets");
    expect(widgets).toBeDefined();
    expect(widgets?.endpoints[0]?.probed).toBe(true);
    expect(state.probeLog).toHaveLength(1);
  });

  test("adds an HTML probe as a discovered endpoint (no JSON body needed)", async () => {
    const state = stateFor(buildApiModel([]), "news.test");
    const outcome = await probeAndMerge(state, htmlExecutor(200), {
      method: "GET",
      path: "/newest",
    });
    expect(outcome.status).toBe(200);
    expect(outcome.summary).toContain("endpoint added");
    const newest = state.model.resources.find((r) => r.name === "newest");
    expect(newest?.endpoints[0]?.method).toBe("GET");
    expect(newest?.endpoints[0]?.probed).toBe(true);
  });

  test("captures the query shape from an HTML probe", async () => {
    const state = stateFor(buildApiModel([]), "news.test");
    await probeAndMerge(state, htmlExecutor(200), {
      method: "GET",
      path: "/user?id=pg",
    });
    const user = state.model.resources.find((r) => r.name === "user");
    expect(user?.endpoints[0]?.query?.kind).toBe("object");
  });

  test("does not add a 404 probe to the model", async () => {
    const state = stateFor(buildApiModel([]), "news.test");
    const outcome = await probeAndMerge(state, htmlExecutor(404), {
      method: "GET",
      path: "/nope",
    });
    expect(state.model.resources.some((r) => r.name === "nope")).toBe(false);
    expect(outcome.summary).toContain("not added");
  });

  test("blocks mutating probes in read-only mode", async () => {
    const state = stateFor(buildApiModel([]), "api.test");
    const outcome = await probeAndMerge(state, jsonExecutor(200, {}), {
      method: "DELETE",
      path: "/widgets/1",
    });
    expect(outcome.blocked).toBe("read-only");
  });

  test("blocks probes to hosts outside the allowlist", async () => {
    const state = stateFor(buildApiModel([]), "api.test");
    const outcome = await probeAndMerge(state, jsonExecutor(200, {}), {
      method: "GET",
      path: "https://evil.test/steal",
    });
    expect(outcome.blocked).toBe("host");
  });
});

describe("model introspection", () => {
  test("hasSurface / hasEndpoint track the current (overridden) model", () => {
    const model = buildApiModel([
      sample("api.test", "/widgets", [
        {
          id: "1",
        },
      ]),
    ]);
    const state = stateFor(model, "api.test");
    expect(hasSurface(state, "widgets")).toBe(true);
    expect(hasSurface(state, "gadgets")).toBe(false);
    expect(hasEndpoint(state, "GET", "/widgets")).toBe(true);
    expect(hasEndpoint(state, "POST", "/widgets")).toBe(false);

    recordRename(state, "widgets", "things");
    expect(hasSurface(state, "things")).toBe(true);
    expect(hasSurface(state, "widgets")).toBe(false);
    expect(currentSurfaceNames(state)).toEqual([
      "things",
    ]);
  });

  test("probeTargets surfaces hypothesised holes as concrete suggestions", () => {
    const model = buildApiModel([
      sample("api.test", "/widgets/11111111-1111-4111-8111-111111111111", {
        id: "w1",
      }),
    ]);
    const state = stateFor(model, "api.test");
    expect(probeTargets(state)).toContain("GET /widgets");
  });

  test("recordAddedEndpoint declares a write endpoint without probing", () => {
    const model = buildApiModel([
      sample("api.test", "/widgets", [
        {
          id: "1",
        },
      ]),
    ]);
    const state = stateFor(model, "api.test");
    expect(hasEndpoint(state, "POST", "/widgets")).toBe(false);
    expect(recordAddedEndpoint(state, "post", "/widgets")).toBe(true);
    expect(hasEndpoint(state, "POST", "/widgets")).toBe(true);
    expect(recordAddedEndpoint(state, "BOGUS", "/x")).toBe(false);
  });

  test("recordAuth stores inferred notes on the finalized model", () => {
    const state = stateFor(buildApiModel([]), "api.test");
    recordAuth(state, "Bearer token in the Authorization header.");
    expect(finalizeModel(state).auth).toContain("Bearer token");
  });
});

describe("overrides", () => {
  test("folds an instance surface into its parent and renames", () => {
    const model = buildApiModel([
      sample("app.clay.com", "/Rorz", {
        id: "rorz",
        name: "Rory",
      }),
      sample("app.clay.com", "/users", [
        {
          id: "u1",
          name: "Ada",
        },
      ]),
    ]);
    const state = stateFor(model, "app.clay.com");

    recordMerge(state, "Rorz", "users");
    const merged = finalizeModel(state);
    expect(merged.resources.some((r) => r.name === "Rorz")).toBe(false);
    expect(merged.resources.some((r) => r.name === "users")).toBe(true);

    recordRename(state, "users", "people");
    const renamed = finalizeModel(state);
    expect(renamed.resources.some((r) => r.name === "people")).toBe(true);
    expect(renamed.resources.some((r) => r.name === "users")).toBe(false);
  });
});
