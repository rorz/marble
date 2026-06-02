import { describe, expect, test } from "bun:test";
import type { EndpointModel } from "./model";
import { ingestHar } from "./pipeline";

const json = (value: unknown) => ({
  mimeType: "application/json",
  text: JSON.stringify(value),
});

const ws = (id: string, name: string, plan: string | null) => ({
  id,
  name,
  plan,
});

const getEntry = (url: string, body: unknown, startedDateTime: string) => ({
  request: {
    method: "GET",
    url,
  },
  response: {
    content: json(body),
    status: 200,
  },
  startedDateTime,
});

const listUrl = "https://app.clay.com/api/v1/workspaces";
const itemUrl =
  "https://app.clay.com/api/v1/workspaces/11111111-1111-4111-8111-111111111111";

const fullHar = {
  log: {
    entries: [
      getEntry(
        listUrl,
        [
          ws("11111111-1111-4111-8111-111111111111", "Ada", "pro"),
        ],
        "2026-01-01T00:00:00Z",
      ),
      getEntry(
        listUrl,
        [
          ws("22222222-2222-4222-8222-222222222222", "Bo", null),
        ],
        "2026-01-02T00:00:00Z",
      ),
      getEntry(
        itemUrl,
        ws("11111111-1111-4111-8111-111111111111", "Ada", "pro"),
        "2026-01-03T00:00:00Z",
      ),
    ],
  },
};

const findEndpoint = (
  endpoints: EndpointModel[],
  method: string,
  template: string,
) =>
  endpoints.find(
    (endpoint) =>
      endpoint.method === method && endpoint.pathTemplate === template,
  );

describe("ingestHar", () => {
  test("infers host, resources, and templated path params", () => {
    const { model } = ingestHar({
      har: fullHar,
    });
    expect(model.host).toBe("app.clay.com");

    const workspaces = model.resources.find((r) => r.name === "workspaces");
    expect(workspaces).toBeDefined();

    const item = findEndpoint(
      workspaces?.endpoints ?? [],
      "GET",
      "/api/v1/workspaces/{workspaceId}",
    );
    expect(item).toBeDefined();
    expect(item?.pathParams[0]?.name).toBe("workspaceId");
    expect(item?.pathParams[0]?.schema).toEqual({
      format: "uuid",
      kind: "string",
      nullable: false,
    });
  });

  test("merges repeated samples into nullable fields", () => {
    const { model } = ingestHar({
      har: fullHar,
    });
    const workspaces = model.resources.find((r) => r.name === "workspaces");
    const list = findEndpoint(
      workspaces?.endpoints ?? [],
      "GET",
      "/api/v1/workspaces",
    );
    expect(list?.sampleCount).toBe(2);
    expect(list?.responseBody?.kind).toBe("array");

    const element =
      list?.responseBody?.kind === "array" ? list.responseBody.element : null;
    const planField =
      element?.kind === "object"
        ? element.fields.find((field) => field.key === "plan")
        : undefined;
    expect(planField?.schema).toEqual({
      format: "plain",
      kind: "string",
      nullable: true,
    });
  });

  test("builds a swiss-cheese coverage map with holes", () => {
    const { coverage } = ingestHar({
      har: fullHar,
    });
    const surface = coverage.surfaces.find((s) => s.name === "workspaces");
    expect(surface).toBeDefined();

    const byKey = new Map(
      surface?.tiles.map((tile) => [
        tile.key,
        tile.state,
      ]),
    );
    expect(byKey.get("GET /api/v1/workspaces")).toBe("unlocked");
    expect(byKey.get("DELETE /api/v1/workspaces/{workspaceId}")).toBe("hole");
    expect(coverage.stats.holes).toBeGreaterThan(0);
  });

  test("generates a standalone, portable oRPC contract", () => {
    const { contractSource } = ingestHar({
      har: fullHar,
    });
    expect(contractSource).toContain('import { oc } from "@orpc/contract";');
    expect(contractSource).toContain("export const targetContract");
    expect(contractSource).toContain("export type TargetContract");
    expect(contractSource).toContain("z.uuidv4()");
    expect(contractSource).toContain(
      'path: "/api/v1/workspaces/{workspaceId}"',
    );
  });

  test("accumulates coverage across captures via previous state", () => {
    const oneList = {
      log: {
        entries: [
          getEntry(
            listUrl,
            [
              ws("11111111-1111-4111-8111-111111111111", "Ada", "pro"),
            ],
            "2026-01-01T00:00:00Z",
          ),
        ],
      },
    };

    const first = ingestHar({
      har: oneList,
    });
    const firstSurface = first.coverage.surfaces.find(
      (s) => s.name === "workspaces",
    );
    const firstList = firstSurface?.tiles.find(
      (tile) => tile.key === "GET /api/v1/workspaces",
    );
    expect(firstList?.state).toBe("discovered");

    const second = ingestHar({
      har: oneList,
      previousCoverage: first.coverage,
      previousModel: first.model,
    });
    const secondList = second.coverage.surfaces
      .find((s) => s.name === "workspaces")
      ?.tiles.find((tile) => tile.key === "GET /api/v1/workspaces");
    expect(secondList?.state).toBe("unlocked");
    expect(second.delta.newlyUnlocked).toContain("GET /api/v1/workspaces");
  });
});
