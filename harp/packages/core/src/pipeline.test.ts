import { describe, expect, test } from "bun:test";
import { generateAuthDoc } from "./codegen/auth";
import { generateOpenApi } from "./codegen/openapi";
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
      {
        request: {
          method: "POST",
          postData: json({
            name: "Cy",
          }),
          url: listUrl,
        },
        response: {
          content: json(ws("33333333-3333-4333-8333-333333333333", "Cy", null)),
          status: 201,
        },
        startedDateTime: "2026-01-04T00:00:00Z",
      },
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

  test("generates a valid OpenAPI 3.1 document from the model", () => {
    const { model } = ingestHar({
      har: fullHar,
    });
    const spec = JSON.parse(generateOpenApi(model)) as {
      info: {
        title: string;
      };
      openapi: string;
      paths: Record<
        string,
        Record<
          string,
          {
            operationId: string;
            parameters?: Array<{
              in: string;
              name: string;
            }>;
            requestBody?: unknown;
            responses: Record<string, unknown>;
          }
        >
      >;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toContain("app.clay.com");

    const detail = spec.paths["/api/v1/workspaces/{workspaceId}"]?.get;
    expect(detail?.operationId).toContain("workspaces.");
    expect(
      detail?.parameters?.some(
        (param) => param.in === "path" && param.name === "workspaceId",
      ),
    ).toBe(true);
    expect(detail?.responses["200"]).toBeDefined();

    expect(spec.paths["/api/v1/workspaces"]?.post?.requestBody).toBeDefined();
  });

  test("renders the cap'n's inferred auth notes as a markdown doc", () => {
    const { model } = ingestHar({
      har: fullHar,
    });
    expect(generateAuthDoc(model)).toContain("No auth inferred");
    const doc = generateAuthDoc({
      ...model,
      auth: "Cookie session via `sid`; 401 without it.",
    });
    expect(doc).toContain("# Authentication");
    expect(doc).toContain("Cookie session via `sid`");
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

  test("captures form posts and query GETs, skips assets and bare navigations", () => {
    const htmlHar = {
      log: {
        entries: [
          {
            request: {
              method: "POST",
              postData: {
                mimeType: "application/x-www-form-urlencoded",
                text: "acct=harp&pw=secret&goto=news",
              },
              url: "https://news.example.com/login",
            },
            response: {
              content: {
                mimeType: "text/html",
                text: "<html>ok</html>",
              },
              status: 200,
            },
            startedDateTime: "2026-01-01T00:00:00Z",
          },
          {
            request: {
              method: "GET",
              url: "https://news.example.com/user?id=harp",
            },
            response: {
              content: {
                mimeType: "text/html",
                text: "<html>u</html>",
              },
              status: 200,
            },
            startedDateTime: "2026-01-01T00:01:00Z",
          },
          {
            request: {
              method: "GET",
              url: "https://news.example.com/news",
            },
            response: {
              content: {
                mimeType: "text/html",
                text: "<html>feed</html>",
              },
              status: 200,
            },
            startedDateTime: "2026-01-01T00:02:00Z",
          },
          {
            request: {
              method: "GET",
              url: "https://news.example.com/styles/news.css",
            },
            response: {
              content: {
                mimeType: "text/css",
                text: "body{}",
              },
              status: 200,
            },
            startedDateTime: "2026-01-01T00:03:00Z",
          },
        ],
      },
    };
    const { model } = ingestHar({
      har: htmlHar,
    });

    expect(model.resources.map((r) => r.name).sort()).toEqual([
      "login",
      "user",
    ]);

    const post = findEndpoint(
      model.resources.find((r) => r.name === "login")?.endpoints ?? [],
      "POST",
      "/login",
    );
    const body = post?.requestBody;
    expect(
      body?.kind === "object" ? body.fields.map((f) => f.key) : [],
    ).toEqual([
      "acct",
      "goto",
      "pw",
    ]);

    const get = findEndpoint(
      model.resources.find((r) => r.name === "user")?.endpoints ?? [],
      "GET",
      "/user",
    );
    expect(get?.query?.kind).toBe("object");
  });

  test("gives unique operation names and gates write holes on read-only APIs", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const version = "22222222-2222-4222-8222-222222222222";
    const readOnlyHar = {
      log: {
        entries: [
          getEntry(
            "https://npm.test/v1/packages",
            [
              {
                id,
                name: "react",
              },
            ],
            "2026-01-01T00:00:00Z",
          ),
          getEntry(
            `https://npm.test/v1/packages/${id}/provenance`,
            {
              ok: true,
            },
            "2026-01-02T00:00:00Z",
          ),
          getEntry(
            `https://npm.test/v1/packages/${id}/${version}/provenance`,
            {
              ok: true,
            },
            "2026-01-03T00:00:00Z",
          ),
        ],
      },
    };
    const { coverage, model } = ingestHar({
      har: readOnlyHar,
    });

    const packages = model.resources.find((r) => r.name === "packages");
    const names = packages?.endpoints.map((e) => e.operationName) ?? [];
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);

    const surface = coverage.surfaces.find((s) => s.name === "packages");
    const holeMethods = (surface?.tiles ?? [])
      .filter((tile) => tile.state === "hole")
      .map((tile) => tile.method);
    expect(holeMethods).not.toContain("POST");
    expect(holeMethods).not.toContain("PATCH");
    expect(holeMethods).not.toContain("DELETE");
  });
});
