import { forwardMarbleApiRequest } from "../../../lib/api-route-forwarding";
import { getMarbleApi } from "../../../lib/marble-api";

const forward = async (req: Request) => {
  return forwardMarbleApiRequest(req, {
    api: getMarbleApi(),
    forwardUserSupabaseAuth: true,
    profilelessPaths: [
      "/rpc/sourceEvents/create",
    ],
    publicPaths: [
      "/openapi",
      "/openapi/spec.json",
    ],
    stripPathPrefix: "/api",
  });
};

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
