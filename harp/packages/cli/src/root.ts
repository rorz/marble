import { harpContract } from "@harp/contracts";
import { isContractProcedure } from "@orpc/contract";
import { Command } from "commander";
import { z } from "zod";
import { getHarpClient } from "./client";
import { printError, printJson, readInput } from "./io";

/**
 * The HARP CLI is a thin, agentic JSON pass-through to the HARP control API.
 *
 *   harp <resource> <operation> [json]
 *   harp <resource> <operation> --input-file <path>
 *   harp <resource> <operation> -            # read JSON from stdin
 *
 * Every subcommand is auto-generated from `harpContract`; the only hand-written
 * surface is `harp describe` for schema introspection.
 */

type CommandHandler = (input: unknown) => Promise<unknown>;
type HarpCliContract = typeof harpContract;
type HarpCliResource = keyof HarpCliContract & string;

type HarpClientShape = {
  readonly [R in keyof HarpCliContract]: Record<string, CommandHandler>;
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

const listCliResourceEntries = () =>
  Object.entries(harpContract) as Array<
    [
      HarpCliResource,
      Record<string, unknown>,
    ]
  >;

const getProcedureMeta = (procedure: unknown): ContractProcedureMeta | null => {
  if (!isContractProcedure(procedure)) {
    return null;
  }
  const def = (
    procedure as {
      "~orpc"?: unknown;
    }
  )["~orpc"];
  return (def ?? null) as ContractProcedureMeta | null;
};

const describeOperation = (resource: string, operation: string) => {
  const procedure = (harpContract as Record<string, Record<string, unknown>>)[
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
};

const listOperations = (resource?: string) => {
  const entries = listCliResourceEntries();
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
};

const summariseForHelp = (procedure: unknown) => {
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
};

const dispatch = (resource: string, operation: string, input: unknown) => {
  const client = getHarpClient() as unknown as HarpClientShape;
  const handler = client[resource as keyof HarpCliContract]?.[operation];
  if (typeof handler !== "function") {
    throw new Error(`Operation '${resource}.${operation}' is not callable.`);
  }
  return handler(input === undefined ? {} : input);
};

const registerResources = (root: Command) => {
  for (const [resource, operations] of listCliResourceEntries()) {
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
              printJson(await dispatch(resource, operation, parsed));
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
};

const registerDescribe = (root: Command) => {
  const command = new Command("describe").description(
    "Introspect contract operations. With no args, list every operation. With a resource, list its operations. With both, return the HTTP route and full input/output JSON schemas.",
  );
  command
    .argument("[resource]", "Resource name (e.g. 'captures')")
    .argument("[operation]", "Operation name (e.g. 'ingest')")
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
};

export const createRootCommand = () => {
  const command = new Command()
    .name("harp")
    .description(
      "HARP \uD83E\uDE89 CLI. Agentic JSON pass-through to every HARP control-plane operation. See 'harp describe' for the catalogue.",
    )
    .showHelpAfterError()
    .showSuggestionAfterError();
  registerResources(command);
  registerDescribe(command);
  return command;
};

export const rootCommand = createRootCommand();
