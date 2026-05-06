import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const programVersionRouter = {
  create: os.programVersions.create.handler(({ context, input }) =>
    context.store.programVersions.create(input),
  ),
  test: os.programVersions.test.handler(({ context, input }) =>
    context.store.programVersions.test(input.programVersionId, input),
  ),
  update: os.programVersions.update.handler(({ context, input }) =>
    context.store.programVersions.update(input.id, input.values),
  ),
} satisfies RouterResourcePart<"programVersions">;
