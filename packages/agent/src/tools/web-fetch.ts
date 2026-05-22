import { defineTool } from "@earendil-works/pi-coding-agent";
import Exa from "exa-js";
import { z } from "zod";
import { prepareToolSchema } from "./contract/schema";

type WebFetchToolBuildOptions = {
  exaApiKey: string;
};

type WebFetchResultSummary = {
  author?: string;
  publishedDate?: string;
  text: string;
  textPreview: string;
  title?: string;
  url: string;
};

type WebFetchDetails = {
  result?: {
    results: WebFetchResultSummary[];
  };
};

const WEB_FETCH_TOOL_NAME = "web_fetch";
const MAX_TEXT_LENGTH = 12_000;
const MAX_PREVIEW_LENGTH = 600;

const webFetchInput = z.object({
  urls: z
    .array(z.string().url())
    .min(1)
    .max(5)
    .describe(
      "One to five fully-qualified http(s) URLs to fetch. Each URL is scraped server-side and returned as clean text.",
    ),
});

const truncate = (text: string, max: number): string =>
  text.length > max
    ? `${text.slice(0, max)}\n\n... (truncated to ${max} chars)`
    : text;

const formatResult = (result: WebFetchResultSummary): string => {
  const header = result.title
    ? `## ${result.title}\n${result.url}`
    : `## ${result.url}`;
  const meta = [
    result.author ? `Author: ${result.author}` : null,
    result.publishedDate ? `Published: ${result.publishedDate}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" \u00b7 ");

  return [
    header,
    meta || null,
    "",
    result.text,
  ]
    .filter((part): part is string => part !== null)
    .join("\n");
};

const toSummary = (raw: unknown): WebFetchResultSummary => {
  const entry = raw as {
    author?: string;
    publishedDate?: string;
    text?: string;
    title?: string;
    url: string;
  };
  const text = entry.text ?? "";
  return {
    author: entry.author,
    publishedDate: entry.publishedDate,
    text: truncate(text, MAX_TEXT_LENGTH),
    textPreview: truncate(text, MAX_PREVIEW_LENGTH),
    title: entry.title,
    url: entry.url,
  };
};

export const buildWebFetchTool = ({
  exaApiKey,
}: WebFetchToolBuildOptions): ReturnType<typeof defineTool> => {
  const exa = new Exa(exaApiKey);
  const prepared = prepareToolSchema(z.toJSONSchema(webFetchInput));

  return defineTool({
    description:
      "Fetch the text contents of one to five web URLs via Exa. Use to read articles, docs, changelogs, GitHub READMEs, or any external page the user references. Returns clean main-content text per URL, with title and publication date when available.",
    execute: async (_toolCallId, params) => {
      const input = webFetchInput.parse(
        prepared.wrapped
          ? (
              params as {
                input: unknown;
              }
            ).input
          : params,
      );

      const response = await exa.getContents(input.urls, {
        text: true,
      });

      const results = (response.results ?? []).map(toSummary);

      const text =
        results.length === 0
          ? "Exa returned no content for the requested URLs."
          : results.map(formatResult).join("\n\n---\n\n");

      return {
        content: [
          {
            text,
            type: "text" as const,
          },
        ],
        details: {
          result: {
            results,
          },
        } satisfies WebFetchDetails,
      };
    },
    label: "Fetch Web Page",
    name: WEB_FETCH_TOOL_NAME,
    parameters: prepared.schema as Parameters<
      typeof defineTool
    >[0]["parameters"],
    promptGuidelines: [
      "Use web_fetch when you have one or more known URLs and need their text content (articles, docs, GitHub, changelogs).",
      "Prefer web_search if you do NOT yet have a URL and need to discover one.",
      "Never use web_fetch to access internal Marble app URLs; use browser_navigate for those.",
    ],
    promptSnippet:
      "web_fetch: read the text content of up to five external URLs.",
  });
};
