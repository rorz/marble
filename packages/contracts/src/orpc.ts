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

type Mutable<T> = {
  -readonly [Name in keyof T]: T[Name];
};

const createORPCOperation = <
  const Operation extends ResourceOperationDefinition,
>(
  operation: Operation,
): ORPCOperation<Operation> =>
  oc.route(operation.route).input(operation.input).output(operation.output);

const assignORPCOperation = <
  const Operations extends Record<string, ResourceOperationDefinition>,
  const Name extends keyof Operations,
>(
  contract: Mutable<ORPCResourceContract<Operations>>,
  operations: Operations,
  name: Name,
) => {
  contract[name] = createORPCOperation(operations[name]);
};

const objectKeys = <const T extends Record<string, unknown>>(value: T) =>
  Object.keys(value) as Array<keyof T>;

function createORPCResourceContract<
  const Operations extends Record<string, ResourceOperationDefinition>,
>(operations: Operations): ORPCResourceContract<Operations> {
  const contract = {} as Mutable<ORPCResourceContract<Operations>>;

  for (const name of objectKeys(operations)) {
    assignORPCOperation(contract, operations, name);
  }

  return contract;
}

export const projectsContract = createORPCResourceContract(projectOperations);
