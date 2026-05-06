import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const programFileRouter = {
  create: os.programFiles.create.handler(({ context, input }) =>
    context.store.programFiles.create(input),
  ),
  delete: os.programFiles.delete.handler(({ context, input }) =>
    context.store.programFiles.delete(input.id),
  ),
  get: os.programFiles.get.handler(({ context, input }) =>
    context.store.programFiles.get(input.id),
  ),
  list: os.programFiles.list.handler(({ context, input }) =>
    context.store.programFiles.list(input),
  ),
  syncForVersion: os.programFiles.syncForVersion.handler(({ context, input }) =>
    context.store.programFiles.syncForVersion(input.versionId, input.files),
  ),
  update: os.programFiles.update.handler(({ context, input }) =>
    context.store.programFiles.update(input.id, input.values),
  ),
} satisfies RouterResourcePart<"programFiles">;
