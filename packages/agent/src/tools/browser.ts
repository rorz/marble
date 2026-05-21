import { defineTool } from "@earendil-works/pi-coding-agent";
import { z } from "zod";
import { prepareToolSchema } from "../schema";

export type ClientAction = {
  href: string;
  replace?: boolean;
  type: "browser_navigate";
};

type BrowserToolDetails = {
  clientAction?: ClientAction;
  result?: unknown;
};

const BROWSER_NAVIGATE_TOOL_NAME = "browser_navigate";

const browserNavigateInput = z.object({
  href: z
    .string()
    .min(1)
    .describe("Internal Marble path to navigate to, such as /projects."),
  replace: z
    .boolean()
    .optional()
    .describe("Use history replace instead of push."),
});

const normalizeBrowserHref = (href: string): string => {
  const trimmed = href.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    throw new Error("browser_navigate only accepts internal paths.");
  }

  return trimmed;
};

export const buildBrowserNavigateTool = (): ReturnType<typeof defineTool> => {
  const prepared = prepareToolSchema(z.toJSONSchema(browserNavigateInput));

  return defineTool({
    description:
      "Navigate the user's current Marble browser to an internal app path. Use after creating or finding a resource when the user should see it.",
    execute: async (_toolCallId, params) => {
      const input = browserNavigateInput.parse(
        prepared.wrapped
          ? (
              params as {
                input: unknown;
              }
            ).input
          : params,
      );
      const href = normalizeBrowserHref(input.href);
      const clientAction: ClientAction = {
        href,
        replace: input.replace,
        type: "browser_navigate",
      };

      return {
        content: [
          {
            text: `Browser navigation queued to ${href}.`,
            type: "text" as const,
          },
        ],
        details: {
          clientAction,
          result: {
            href,
            replace: input.replace ?? false,
          },
        } satisfies BrowserToolDetails,
      };
    },
    label: "Navigate Browser",
    name: BROWSER_NAVIGATE_TOOL_NAME,
    parameters: prepared.schema as Parameters<
      typeof defineTool
    >[0]["parameters"],
    promptGuidelines: [
      "Use browser_navigate only for internal Marble paths, never for external web browsing.",
      "After creating a resource, navigate to the most useful detail page when its path is known.",
    ],
    promptSnippet:
      "browser_navigate: move the user's current Marble app page to an internal path.",
  });
};
