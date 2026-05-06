import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const sidebarRouter = {
  getData: os.sidebar.getData.handler(({ context }) =>
    context.store.sidebar.getData(),
  ),
} satisfies RouterResourcePart<"sidebar">;
