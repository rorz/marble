import { marbleContract } from "@marble/contracts";
import { implement } from "@orpc/server";
import type { ApiContext } from "./context";

export const os = implement(marbleContract).$context<ApiContext>();
