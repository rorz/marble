import { forwardMarbleApiRequest } from "../../../lib/api-route-forwarding";
import { getMarbleApiV2 } from "../../../lib/marble-api";

async function forward(req: Request) {
  return forwardMarbleApiRequest(req, {
    api: getMarbleApiV2(),
    forwardUserSupabaseAuth: true,
    profilelessPaths: [
      "/rpc/sourceEvents/create",
    ],
    publicPaths: [
      "/openapi",
      "/openapi/spec.json",
    ],
    stripPathPrefix: "/api-v2",
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
