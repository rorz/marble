import { z } from "zod";
import { type HttpMethod, httpMethodSchema, type JsonValue } from "./model";

/**
 * A deliberately lenient HAR 1.2 schema. We only validate the fields HARP
 * reads; everything else is allowed through untouched so real-world archives
 * (DevTools exports, extension captures, proxy dumps) all parse.
 */
const harNameValueSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const harEntrySchema = z.object({
  request: z.object({
    method: z.string(),
    postData: z
      .object({
        mimeType: z.string().optional(),
        text: z.string().optional(),
      })
      .optional(),
    queryString: z.array(harNameValueSchema).optional(),
    url: z.string(),
  }),
  response: z.object({
    content: z
      .object({
        encoding: z.string().optional(),
        mimeType: z.string().optional(),
        text: z.string().optional(),
      })
      .optional(),
    status: z.number(),
  }),
  startedDateTime: z.string().optional(),
});

export const harSchema = z.object({
  log: z.object({
    entries: z.array(harEntrySchema),
  }),
});

export type Har = z.infer<typeof harSchema>;

/** One normalised request/response pair, ready for inference. */
export type RequestSample = {
  host: string;
  method: HttpMethod;
  pathname: string;
  query: Record<string, string>;
  requestBody: JsonValue | undefined;
  requestContentType: string | null;
  responseBody: JsonValue | undefined;
  responseContentType: string | null;
  responseStatus: number;
  startedDateTime: string;
  url: string;
  viaProbe?: boolean;
};

const isJsonMime = (mime: string | null) =>
  mime !== null && /\bjson\b/i.test(mime);

const isApiLike = (
  requestContentType: string | null,
  responseContentType: string | null,
) => isJsonMime(requestContentType) || isJsonMime(responseContentType);

const tryParseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    // harness-ignore: no-swallowed-errors -- malformed URLs are skipped, not surfaced
    return null;
  }
};

const safeJsonParse = (text: string): JsonValue | undefined => {
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    // harness-ignore: no-swallowed-errors -- non-JSON bodies are simply not inferred
    return undefined;
  }
};

const decodeBase64Utf8 = (value: string): string => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
};

const methodOf = (raw: string): HttpMethod | null => {
  const parsed = httpMethodSchema.safeParse(raw.toUpperCase());
  return parsed.success ? parsed.data : null;
};

const bodyText = (
  text: string | undefined,
  encoding: string | undefined,
): string | undefined => {
  if (text === undefined) {
    return undefined;
  }
  return encoding === "base64" ? decodeBase64Utf8(text) : text;
};

const queryRecord = (
  entries:
    | Array<{
        name: string;
        value: string;
      }>
    | undefined,
  url: URL,
): Record<string, string> => {
  const record: Record<string, string> = {};
  if (entries && entries.length > 0) {
    for (const entry of entries) {
      record[entry.name] = entry.value;
    }
    return record;
  }
  for (const [name, value] of url.searchParams.entries()) {
    record[name] = value;
  }
  return record;
};

const toSample = (
  entry: z.infer<typeof harEntrySchema>,
): RequestSample | null => {
  const url = tryParseUrl(entry.request.url);
  const method = methodOf(entry.request.method);
  if (url === null || method === null) {
    return null;
  }

  const requestContentType = entry.request.postData?.mimeType ?? null;
  const responseContentType = entry.response.content?.mimeType ?? null;
  if (!isApiLike(requestContentType, responseContentType)) {
    return null;
  }

  const requestText = entry.request.postData?.text;
  const responseText = bodyText(
    entry.response.content?.text,
    entry.response.content?.encoding,
  );

  return {
    host: url.host,
    method,
    pathname: url.pathname,
    query: queryRecord(entry.request.queryString, url),
    requestBody:
      requestText !== undefined && isJsonMime(requestContentType)
        ? safeJsonParse(requestText)
        : undefined,
    requestContentType,
    responseBody:
      responseText !== undefined && isJsonMime(responseContentType)
        ? safeJsonParse(responseText)
        : undefined,
    responseContentType,
    responseStatus: entry.response.status,
    startedDateTime: entry.startedDateTime ?? new Date().toISOString(),
    url: entry.request.url,
  };
};

/** Validate and normalise a HAR archive into API-like request samples. */
export const parseHar = (input: unknown): RequestSample[] => {
  const har = harSchema.parse(input);
  const samples: RequestSample[] = [];
  for (const entry of har.log.entries) {
    const sample = toSample(entry);
    if (sample !== null) {
      samples.push(sample);
    }
  }
  return samples;
};
