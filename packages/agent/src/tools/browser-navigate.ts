import { defineTool } from "@earendil-works/pi-coding-agent";
import { z } from "zod";
import { prepareToolSchema } from "./contract/schema";

export type ClientAction = {
  href: string;
  replace?: boolean;
  type: "browser_navigate";
};

type BrowserToolDetails = {
  clientAction?: ClientAction;
  result?: unknown;
};

type BrowserNavigateToolBuildOptions = {
  routePatterns?: readonly string[];
};

const BROWSER_NAVIGATE_TOOL_NAME = "browser_navigate";

const formatRoutePatterns = (routePatterns: readonly string[]): string => {
  return routePatterns.map((route) => `- ${route}`).join("\n");
};

const createBrowserNavigateInput = (routePatterns: readonly string[]) =>
  z.object({
    href: z
      .string()
      .min(1)
      .describe(
        routePatterns.length === 0
          ? "Internal Marble path to navigate to, such as /projects."
          : `Internal Marble path to navigate to. It must match one of these route patterns:\n${formatRoutePatterns(routePatterns)}`,
      ),
    replace: z
      .boolean()
      .optional()
      .describe("Use history replace instead of push."),
  });

const uniqueRoutePatterns = (
  routePatterns: readonly string[] | undefined,
): string[] => {
  return [
    ...new Set(routePatterns ?? []),
  ].sort();
};

const normalizePathname = (href: string): string => {
  const url = new URL(href, "http://marble.local");
  const pathname = url.pathname;

  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
};

const routePatternMatchesPathname = (
  routePattern: string,
  pathname: string,
): boolean => {
  const patternSegments = routePattern.split("/").filter(Boolean);
  const pathnameSegments = pathname.split("/").filter(Boolean);

  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];

    if (patternSegment.startsWith("[[...") && patternSegment.endsWith("]]")) {
      return true;
    }

    if (patternSegment.startsWith("[...") && patternSegment.endsWith("]")) {
      return pathnameSegments.length > i;
    }

    if (pathnameSegments[i] === undefined) return false;

    if (patternSegment.startsWith("[") && patternSegment.endsWith("]")) {
      continue;
    }

    if (patternSegment !== pathnameSegments[i]) return false;
  }

  return patternSegments.length === pathnameSegments.length;
};

const matchesRoutePattern = (
  routePatterns: readonly string[],
  pathname: string,
): boolean => {
  return routePatterns.some((routePattern) =>
    routePatternMatchesPathname(routePattern, pathname),
  );
};

const normalizeBrowserHref = (href: string): string => {
  const trimmed = href.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    throw new Error("browser_navigate only accepts internal paths.");
  }

  return trimmed;
};

const validateBrowserHref = (
  href: string,
  routePatterns: readonly string[],
): string => {
  const normalized = normalizeBrowserHref(href);
  if (
    routePatterns.length > 0 &&
    !matchesRoutePattern(routePatterns, normalizePathname(normalized))
  ) {
    throw new Error(
      `browser_navigate only accepts known Marble page routes. Available route patterns:\n${formatRoutePatterns(routePatterns)}`,
    );
  }

  return normalized;
};

export const buildBrowserNavigateTool = (
  options: BrowserNavigateToolBuildOptions = {},
): ReturnType<typeof defineTool> => {
  const routePatterns = uniqueRoutePatterns(options.routePatterns);
  const browserNavigateInput = createBrowserNavigateInput(routePatterns);
  const prepared = prepareToolSchema(z.toJSONSchema(browserNavigateInput));
  const routeGuidance =
    routePatterns.length === 0
      ? "Use browser_navigate only for internal Marble paths, never for external web browsing."
      : `Use browser_navigate only for internal Marble paths that match this canonical page route map:\n${formatRoutePatterns(routePatterns)}`;

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
      const href = validateBrowserHref(input.href, routePatterns);
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
      routeGuidance,
      "After creating a resource, navigate to the most useful detail page when its path is known.",
    ],
    promptSnippet:
      "browser_navigate: move the user's current Marble app page to an internal path.",
  });
};
