import { describe, expect, test } from "bun:test";
import { type ApiModel, buildApiModel, type RequestSample } from "@harp/core";
import {
  createExplorerState,
  finalizeModel,
  type ProbeExecutor,
  probeAndMerge,
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
