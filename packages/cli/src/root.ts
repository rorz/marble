import { type MarbleContract, marbleContract } from "@marble/contracts";
import { isContractProcedure } from "@orpc/contract";
import { Command } from "commander";
import { z } from "zod";
import { getMarbleClient } from "./client";
import { printError, printJson, readInput } from "./io";
import { registerProgramDir } from "./program-dir";

/**
 * The Marble CLI is a thin, agentic JSON pass-through to the Marble API.
 *
 *   marble <resource> <operation> [json]
 *   marble <resource> <operation> --input-file <path>
 *   marble <resource> <operation> -            # read JSON from stdin
 *
 * Resource and operation names mirror `marbleContract` from `@marble/contracts`
 * exactly. Every subcommand is auto-generated from that contract — there are
 * no hand-written per-resource definitions. If an operation exists on the
 * contract, it exists on the CLI; if it doesn't, the CLI can't invoke it.
 *
 * The only exceptions are:
 *
 *   - `marble describe ...` for schema introspection, and
 *   - `marble program-dir ...` for the filesystem affordance.
 *
 * Everything else here is plumbing.
 */

type CommandHandler = (input: unknown) => Promise<unknown>;

/**
 * Shape of `MarbleClient` for dynamic dispatch from CLI argv.
 *
 * Outer keys are tied to `MarbleContract` resource names, so renaming or
 * removing a resource will surface here. Inner keys stay string-indexed
 * because operations are looked up by raw argv strings — operation
 * existence is checked at runtime by `dispatch`.
 *
 * The cast to this shape requires `as unknown as` (not a single `as`)
 * because the typed RPC client's per-op handlers have specific
 * `(input: SpecificInput) => Promise<SpecificOutput>` signatures and
 * function-parameter contravariance correctly rejects widening them to
 * `(input: unknown) => Promise<unknown>`. The CLI is a thin JSON
 * pass-through — input validation happens via the API's Zod schemas at
 * call time — so the widening is safe in practice.
 */
type MarbleClientShape = {
  readonly [R in keyof MarbleContract]: Record<string, CommandHandler>;
};

type ContractProcedureMeta = {
  description?: string;
  inputSchema?: z.ZodType;
  outputSchema?: z.ZodType;
  route?: {
    description?: string;
    method?: string;
    operationId?: string;
    path?: string;
    summary?: string;
    tags?: readonly string[];
  };
};

function getProcedureMeta(procedure: unknown): ContractProcedureMeta | null {
  if (!isContractProcedure(procedure)) {
    return null;
  }

  const def = (
    procedure as {
      "~orpc"?: unknown;
    }
  )["~orpc"];

  return (def ?? null) as ContractProcedureMeta | null;
}

function describeOperation(resource: string, operation: string) {
  const procedure = (marbleContract as Record<string, Record<string, unknown>>)[
    resource
  ]?.[operation];
  const meta = getProcedureMeta(procedure);

  if (!meta) {
    throw new Error(`Unknown operation '${resource} ${operation}'.`);
  }

  return {
    description: meta.route?.description,
    input: meta.inputSchema
      ? z.toJSONSchema(meta.inputSchema, {
          target: "draft-7",
        })
      : null,
    operation: `${resource}.${operation}`,
    output: meta.outputSchema
      ? z.toJSONSchema(meta.outputSchema, {
          target: "draft-7",
        })
      : null,
    route: meta.route ?? null,
    summary: meta.route?.summary,
  };
}

function listOperations(resource?: string) {
  const entries = Object.entries(marbleContract) as Array<
    [
      string,
      Record<string, unknown>,
    ]
  >;
  const filtered = resource
    ? entries.filter(([name]) => name === resource)
    : entries;

  if (resource && filtered.length === 0) {
    throw new Error(`Unknown resource '${resource}'.`);
  }

  return filtered.flatMap(([name, operations]) =>
    Object.entries(operations).map(([operation, procedure]) => {
      const meta = getProcedureMeta(procedure);

      return {
        description: meta?.route?.description,
        operation: `${name}.${operation}`,
        route: meta?.route ?? null,
        summary: meta?.route?.summary,
      };
    }),
  );
}

function summariseForHelp(procedure: unknown) {
  const meta = getProcedureMeta(procedure);
  const route = meta?.route;

  if (!route) {
    return undefined;
  }

  const httpHint =
    route.method && route.path ? `${route.method} ${route.path}` : undefined;

  return [
    route.summary,
    httpHint,
  ]
    .filter(Boolean)
    .join(" — ");
}

function dispatch(resource: string, operation: string, input: unknown) {
  const client = getMarbleClient() as unknown as MarbleClientShape;
  const handler = client[resource as keyof MarbleContract]?.[operation];

  if (typeof handler !== "function") {
    throw new Error(`Operation '${resource}.${operation}' is not callable.`);
  }

  // Operations with empty input schemas (e.g. `sidebar.getData`) still need
  // an object payload from the oRPC client, so we default missing input to
  // `{}` instead of `undefined`. Operations with required input will surface
  // their own Zod validation error if `{}` doesn't satisfy them.
  return handler(input === undefined ? {} : input);
}

function registerResources(root: Command) {
  for (const [resource, operations] of Object.entries(marbleContract) as Array<
    [
      string,
      Record<string, unknown>,
    ]
  >) {
    const resourceCommand = new Command(resource).description(
      `${resource} contract operations`,
    );

    for (const [operation, procedure] of Object.entries(operations)) {
      const opCommand = resourceCommand
        .command(operation)
        .argument("[input]", "JSON input. Pass '-' to read JSON from stdin.")
        .option(
          "--input-file <path>",
          "Read JSON input from a file (use '-' for stdin)",
        )
        .action(
          async (
            input: string | undefined,
            opts: {
              inputFile?: string;
            },
          ) => {
            try {
              const parsed = await readInput({
                arg: input,
                file: opts.inputFile,
              });
              const result = await dispatch(resource, operation, parsed);

              printJson(result);
            } catch (error) {
              printError(error);
              process.exit(1);
            }
          },
        );

      const summary = summariseForHelp(procedure);

      if (summary) {
        opCommand.description(summary);
      }
    }

    root.addCommand(resourceCommand);
  }
}

function registerDescribe(root: Command) {
  const command = new Command("describe").description(
    "Introspect contract operations. With no args, list every operation. With a resource, list its operations. With both, return the operation's HTTP route and full input/output JSON schemas.",
  );

  command
    .argument("[resource]", "Resource name (e.g. 'cells')")
    .argument("[operation]", "Operation name (e.g. 'run')")
    .action((resource: string | undefined, operation: string | undefined) => {
      try {
        if (resource && operation) {
          printJson(describeOperation(resource, operation));
          return;
        }

        printJson(listOperations(resource));
      } catch (error) {
        printError(error);
        process.exit(1);
      }
    });

  root.addCommand(command);
}

export function createRootCommand() {
  const command = new Command()
    .name("marble")
    .description(
      "Marble CLI. Agentic JSON pass-through to every Marble API operation. See 'marble describe' for the operation catalogue.",
    )
    .showHelpAfterError()
    .showSuggestionAfterError();

  registerResources(command);
  registerDescribe(command);
  registerProgramDir(command);

  return command;
}

export const rootCommand = createRootCommand();
