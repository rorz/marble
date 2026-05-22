import { describe, expect, test } from "bun:test";
import { buildBrowserNavigateTool } from "../src/tools/browser-navigate";

describe("browser_navigate", () => {
  test("accepts hrefs that match the canonical route patterns", async () => {
    const tool = buildBrowserNavigateTool({
      routePatterns: [
        "/",
        "/projects",
        "/projects/[id]",
        "/projects/[id]/tables/[tableId]",
      ],
    });

    await expect(
      tool.execute("tool-call-id", {
        href: "/projects/project-id/tables/table-id",
      }),
    ).resolves.toMatchObject({
      details: {
        clientAction: {
          href: "/projects/project-id/tables/table-id",
          type: "browser_navigate",
        },
      },
    });
  });

  test("rejects hrefs outside the canonical route patterns", async () => {
    const tool = buildBrowserNavigateTool({
      routePatterns: [
        "/",
        "/projects",
      ],
    });

    await expect(
      tool.execute("tool-call-id", {
        href: "/settings",
      }),
    ).rejects.toThrow("known Marble page routes");
  });
});
