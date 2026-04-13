#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  type ApiResourceName,
  ApiResourceNames,
  apiResourceLabel,
  apiResourceSegment,
  type CrudOperation,
  supportsResourceOperation,
} from "@marble/core";
import { Command } from "commander";
import dotenv from "dotenv";
import { MarbleClient } from "./client.js";
import { env } from "./env.js";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const invocationCwd = env.INIT_CWD || process.cwd();
const client = new MarbleClient();
const program = new Command();

type JsonObject = Record<string, unknown>;
type CrudCommandDefinition = {
  arguments: Array<
    [
      name: string,
      description: string,
    ]
  >;
  description: (label: string) => string;
  execute: (resourceName: ApiResourceName, args: string[]) => Promise<unknown>;
  name: string;
  operation: CrudOperation;
  progress: (label: string) => string;
};

function resolveFromInvocation(dir: string) {
  return path.resolve(invocationCwd, dir);
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function parseJson(label: string, input: string) {
  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${formatError(error)}`);
  }
}

function parseJsonObject(label: string, input?: string) {
  if (input === undefined) {
    return {} as JsonObject;
  }

  const value = parseJson(label, input);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return value as JsonObject;
}

function toCamelCaseResourceCommand(name: ApiResourceName) {
  return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

async function runAction(label: string, action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    console.error(`Error ${label}: ${formatError(error)}`);
    process.exit(1);
  }
}

const CRUD_COMMANDS: CrudCommandDefinition[] = [
  {
    arguments: [
      [
        "[filters]",
        "Optional JSON query filters",
      ],
    ],
    description: (label) => `List ${label}`,
    execute: (resourceName, [filtersText]) =>
      client.list(
        resourceName,
        parseJsonObject("filters", filtersText) as Record<
          string,
          boolean | number | string | null | undefined
        >,
      ),
    name: "list",
    operation: "list",
    progress: (label) => `listing ${label}`,
  },
  {
    arguments: [
      [
        "<id>",
        "Resource ID",
      ],
    ],
    description: (label) => `Get ${label} by ID`,
    execute: (resourceName, [id]) => client.get(resourceName, id),
    name: "get",
    operation: "get",
    progress: (label) => `getting ${label}`,
  },
  {
    arguments: [
      [
        "<payload>",
        "JSON payload",
      ],
    ],
    description: (label) => `Create ${label} from a JSON payload`,
    execute: (resourceName, [payloadText]) =>
      client.create(resourceName, parseJsonObject("payload", payloadText)),
    name: "create",
    operation: "create",
    progress: (label) => `creating ${label}`,
  },
  {
    arguments: [
      [
        "<id>",
        "Resource ID",
      ],
      [
        "<payload>",
        "JSON payload",
      ],
    ],
    description: (label) => `Update ${label} with a JSON payload`,
    execute: (resourceName, [id, payloadText]) =>
      client.update(resourceName, id, parseJsonObject("payload", payloadText)),
    name: "update",
    operation: "update",
    progress: (label) => `updating ${label}`,
  },
  {
    arguments: [
      [
        "<id>",
        "Resource ID",
      ],
    ],
    description: (label) => `Delete ${label}`,
    execute: (resourceName, [id]) => client.delete(resourceName, id),
    name: "delete",
    operation: "delete",
    progress: (label) => `deleting ${label}`,
  },
];

function registerCrudCommands(resourceName: ApiResourceName, command: Command) {
  const label = apiResourceLabel(resourceName);

  for (const crudCommand of CRUD_COMMANDS) {
    if (!supportsResourceOperation(resourceName, crudCommand.operation)) {
      continue;
    }

    const subcommand = command
      .command(crudCommand.name)
      .description(crudCommand.description(label));

    for (const [argumentName, argumentDescription] of crudCommand.arguments) {
      subcommand.argument(argumentName, argumentDescription);
    }

    subcommand.action((...actionArgs) =>
      runAction(crudCommand.progress(label), async () => {
        const commandArgs = actionArgs.slice(
          0,
          crudCommand.arguments.length,
        ) as string[];
        printJson(await crudCommand.execute(resourceName, commandArgs));
      }),
    );
  }
}

program
  .name("marble")
  .description("CLI to manage Marble resources")
  .version("1.0.0");

const resourceCommands = new Map<ApiResourceName, Command>();

for (const resourceName of ApiResourceNames) {
  const command = program
    .command(apiResourceSegment(resourceName))
    .description(`Manage ${apiResourceLabel(resourceName)}`);
  const camelCaseAlias = toCamelCaseResourceCommand(resourceName);

  if (camelCaseAlias !== resourceName) {
    command.alias(camelCaseAlias);
  }

  registerCrudCommands(resourceName, command);
  resourceCommands.set(resourceName, command);
}

const programsCommand = resourceCommands.get("programs");

if (!programsCommand) {
  throw new Error("Programs command registry is missing.");
}

programsCommand
  .command("upsert")
  .description("Upsert a program from a local directory")
  .argument("<dir>", "Directory containing the program code and schema")
  .action((dir) =>
    runAction("upserting program", async () => {
      const fullPath = resolveFromInvocation(dir);
      const code = await fs.readFile(path.join(fullPath, "index.js"), "utf-8");
      const config = JSON.parse(
        await fs.readFile(path.join(fullPath, "config.json"), "utf-8"),
      ) as {
        inputSchema: unknown;
        name: string;
        outputConfig: unknown;
      };

      const data = await client.upsertProgram({
        code,
        inputSchema: config.inputSchema,
        name: config.name,
        outputConfig: config.outputConfig,
      });

      console.log(
        `Program "${config.name}" upserted successfully. (ID: ${data.id})`,
      );
    }),
  );

programsCommand
  .command("dry-run")
  .description("Dry-run a program against the API")
  .argument("<dir>", "Directory containing the program code and schema")
  .argument("<input>", "Mock input payload as a stringified JSON object")
  .action((dir, inputText) =>
    runAction("dry-running program", async () => {
      const fullPath = resolveFromInvocation(dir);
      const code = await fs.readFile(path.join(fullPath, "index.js"), "utf-8");
      const config = JSON.parse(
        await fs.readFile(path.join(fullPath, "config.json"), "utf-8"),
      ) as {
        outputConfig?: {
          schema?: unknown;
        };
        outputSchema?: unknown;
      };

      printJson(
        await client.dryRunProgram({
          code,
          input: parseJson("input", inputText),
          outputSchema:
            config.outputConfig?.schema || config.outputSchema || {},
        }),
      );
    }),
  );

program.parse();
