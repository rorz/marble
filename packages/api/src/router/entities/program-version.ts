import { parseProgramSecretConfig } from "@marble/contracts";
import { os } from "../../server";
import type { RouterResourcePart } from "../../types";
import { composeResourceRouter } from "../compose";

const normalizeProgramVersionWriteInput = <
  T extends {
    secretConfig?: unknown;
  },
>(
  input: T,
) => {
  return {
    ...input,
    ...(input.secretConfig === undefined
      ? {}
      : {
          secretConfig: parseProgramSecretConfig(input.secretConfig),
        }),
  };
};

export const programVersionRouter = {
  ...composeResourceRouter("programVersions"),
  create: os.programVersions.create.handler(({ context, input }) =>
    context.store.programVersions.create(
      normalizeProgramVersionWriteInput(input),
    ),
  ),
  update: os.programVersions.update.handler(({ context, input }) =>
    context.store.programVersions.update({
      id: input.id,
      values: normalizeProgramVersionWriteInput(input.values),
    }),
  ),
} satisfies RouterResourcePart<"programVersions">;
