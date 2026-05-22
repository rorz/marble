import { defineTool } from "@earendil-works/pi-coding-agent";
import Exa from "exa-js";
import { z } from "zod";
import { prepareToolSchema } from "./contract/schema";

type WebSearchToolBuildOptions = {
  exaApiKey: string;
};

type WebSearchResultSummary = {
  author?: string;
  publishedDate?: string;
  score?: number;
  text: string;
  textPreview: string;
  title?: string;
  url: string;
};

type WebSearchDetails = {
  result?: {
    query: string;
    results: WebSearchResultSummary[];
  };
};

const WEB_SEARCH_TOOL_NAME = "web_search";
const DEFAULT_NUM_RESULTS = 5;
const MAX_NUM_RESULTS = 10;
const MAX_TEXT_LENGTH = 4_000;
const MAX_PREVIEW_LENGTH = 400;

const webSearchInput = z.object({
  numResults: z
    .number()
    .int()
    .min(1)
    .max(MAX_NUM_RESULTS)
    .optional()
    .describe(
      `How many results to return. Defaults to ${DEFAULT_NUM_RESULTS}, max ${MAX_NUM_RESULTS}.`,
    ),
  query: z
    .string()
    .min(1)
    .max(400)
    .describe(
      "Natural language query describing the ideal page. Be specific. Example: 'blog post comparing Postgres GIN vs GiST indexes for JSONB'.",
    ),
});

const truncate = (text: string, max: number): string =>
  text.length > max
    ? `${text.slice(0, max)}\n\n... (truncated to ${max} chars)`
    : text;

const toSummary = (raw: unknown): WebSearchResultSummary => {
  const entry = raw as {
    author?: string;
    publishedDate?: string;
    score?: number;
    text?: string;
    title?: string;
    url: string;
  };
  const text = entry.text ?? "";
  return {
    author: entry.author,
    publishedDate: entry.publishedDate,
    score: entry.score,
    text: truncate(text, MAX_TEXT_LENGTH),
    textPreview: truncate(text, MAX_PREVIEW_LENGTH),
    title: entry.title,
    url: entry.url,
  };
};

const formatResult = (
  result: WebSearchResultSummary,
  index: number,
): string => {
  const header = result.title
    ? `### ${index + 1}. ${result.title}\n${result.url}`
    : `### ${index + 1}. ${result.url}`;
  const meta = [
    result.author ? `Author: ${result.author}` : null,
    result.publishedDate ? `Published: ${result.publishedDate}` : null,
    result.score !== undefined ? `Score: ${result.score.toFixed(2)}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" \u00b7 ");

  return [
    header,
    meta || null,
    "",
    result.textPreview,
  ]
    .filter((part): part is string => part !== null)
    .join("\n");
};

export const buildWebSearchTool = ({
  exaApiKey,
}: WebSearchToolBuildOptions): ReturnType<typeof defineTool> => {
  const exa = new Exa(exaApiKey);
  const prepared = prepareToolSchema(z.toJSONSchema(webSearchInput));

  return defineTool({
    description:
      "Search the web via Exa and return ranked results with title, URL, and a short content preview per hit. Use when you do not yet have a URL and need to discover relevant external pages.",
    execute: async (_toolCallId, params) => {
      const input = webSearchInput.parse(
        prepared.wrapped
          ? (
              params as {
                input: unknown;
              }
            ).input
          : params,
      );
      const numResults = input.numResults ?? DEFAULT_NUM_RESULTS;

      const response = await exa.searchAndContents(input.query, {
        numResults,
        text: true,
      });

      const results = (response.results ?? []).map(toSummary);

      const text =
        results.length === 0
          ? `Exa returned no results for query: ${input.query}`
          : [
              `# Web search results for: ${input.query}`,
              "",
              ...results.map(formatResult),
            ].join("\n\n");

      return {
        content: [
          {
            text,
            type: "text" as const,
          },
        ],
        details: {
          result: {
            query: input.query,
            results,
          },
        } satisfies WebSearchDetails,
      };
    },
    label: "Search Web",
    name: WEB_SEARCH_TOOL_NAME,
    parameters: prepared.schema as Parameters<
      typeof defineTool
    >[0]["parameters"],
    promptGuidelines: [
      "Use web_search when you do not yet have a URL and need to discover relevant external pages.",
      "Write a semantic query that describes the ideal page, not just keywords. 'blog post comparing X and Y performance' is better than 'X vs Y'.",
      "Prefer web_fetch when you already have a known URL.",
      "Default to 5 results; raise numResults only when broad discovery is needed.",
    ],
    promptSnippet:
      "web_search: discover external pages via semantic web search.",
  });
};
