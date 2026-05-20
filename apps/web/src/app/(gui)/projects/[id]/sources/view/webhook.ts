import type { Source } from "./types";

export const buildSourceWebhookEndpoint = (
  baseUrl: string,
  source: Pick<Source, "id">,
) => {
  return `${baseUrl}/webhooks/${source.id}`;
};
