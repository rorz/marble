import "server-only";
import { createMarbleApi as createMarbleApiV2 } from "@marble/api";
import { createMarbleApi } from "@marble/old-api";
import { getMarbleApiConfig } from "./server-config";

let marbleApi: ReturnType<typeof createMarbleApi> | undefined;
let marbleApiV2: ReturnType<typeof createMarbleApiV2> | undefined;

export function getMarbleApi() {
  marbleApi ??= createMarbleApi(getMarbleApiConfig());
  return marbleApi;
}

export function getMarbleApiV2() {
  marbleApiV2 ??= createMarbleApiV2(getMarbleApiConfig());
  return marbleApiV2;
}
