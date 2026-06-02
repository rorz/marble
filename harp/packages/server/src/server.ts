import { harpContract } from "@harp/contracts";
import { implement } from "@orpc/server";
import type { FileStore } from "./store";

export type HarpContext = {
  store: FileStore;
};

export const os = implement(harpContract).$context<HarpContext>();
