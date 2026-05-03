import type { MarbleContract } from "@marble/contracts";
import type { Router } from "@orpc/server";
import type { ApiContext } from "./context";

export type RouterResourcePart<R extends keyof MarbleContract> = Router<
  MarbleContract[R],
  ApiContext
>;
