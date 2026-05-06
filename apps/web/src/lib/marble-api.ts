import "server-only";
import { createMarbleApi } from "@marble/api";
import { getMarbleApiConfig } from "./server-config";

let marbleApi: ReturnType<typeof createMarbleApi> | undefined;

export function getMarbleApi() {
  marbleApi ??= createMarbleApi(getMarbleApiConfig());
  return marbleApi;
}
