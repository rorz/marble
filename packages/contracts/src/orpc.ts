import { type ContractProcedure, oc } from "@orpc/contract";
import type { ResourceOperationDefinition } from "./resources/define";
import { projectOperations } from "./resources/projects";

type EmptyErrorMap = Record<never, never>;
type EmptyMeta = Record<never, never>;

type ORPCOperation<Operation extends ResourceOperationDefinition> =
  ContractProcedure<
    Operation["input"],
    Operation["output"],
    EmptyErrorMap,
    EmptyMeta
  >;

type ORPCResourceContract<
  Operations extends Record<string, ResourceOperationDefinition>,
> = {
  readonly [Name in keyof Operations]: ORPCOperation<Operations[Name]>;
};

function createORPCResourceContract<
  const Operations extends Record<string, ResourceOperationDefinition>,
>(operations: Operations): ORPCResourceContract<Operations> {
  const entries = Object.entries(operations) as Array<
    [
      keyof Operations & string,
      Operations[keyof Operations & string],
    ]
  >;

  return Object.fromEntries(
    entries.map(([name, operation]) => [
      name,
      oc.route(operation.route).input(operation.input).output(operation.output),
    ]),
  ) as unknown as ORPCResourceContract<Operations>;
}

export const projectsContract = createORPCResourceContract(projectOperations);
