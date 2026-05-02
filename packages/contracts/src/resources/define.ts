import type { z } from "zod";

export type ResourceOperationRoute = {
  readonly description?: string;
  readonly method: "DELETE" | "GET" | "PATCH" | "POST";
  readonly operationId: string;
  readonly path: `/${string}`;
  readonly summary: string;
  readonly tags: readonly string[];
};

export type ResourceOperationDefinition<
  Input extends z.ZodType = z.ZodType,
  Output extends z.ZodType = z.ZodType,
> = {
  readonly input: Input;
  readonly output: Output;
  readonly route: ResourceOperationRoute;
};

export const defineResourceOperations = <
  const Operations extends Record<string, ResourceOperationDefinition>,
>(
  operations: Operations,
) => operations;
