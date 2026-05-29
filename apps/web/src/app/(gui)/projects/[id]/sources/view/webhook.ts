import type { Source } from "./types";

const SAMPLE_WEBHOOK_PAYLOAD = `{
  "email": "ada@example.com",
  "name": "Ada Lovelace"
}`;

export const buildSourceWebhookEndpoint = (
  baseUrl: string,
  source: Pick<Source, "id">,
) => {
  return `${baseUrl}/webhooks/${source.id}`;
};

export const buildSourceWebhookCurlSnippet = (
  baseUrl: string,
  source: Pick<Source, "id" | "webhookToken">,
) => {
  const endpoint = buildSourceWebhookEndpoint(baseUrl, source);

  return [
    `WEBHOOK_URL="${endpoint}"`,
    `WEBHOOK_TOKEN="${source.webhookToken}"`,
    "",
    `curl -X POST "$WEBHOOK_URL" \\`,
    `  -H "Authorization: Bearer $WEBHOOK_TOKEN" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  --data '${SAMPLE_WEBHOOK_PAYLOAD}'`,
  ].join("\n");
};
