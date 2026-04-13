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
type ProgramDirectoryFile = {
  content: string;
  filename: string;
  filetype: "Json" | "Markdown" | "TypeScript";
};
type LoadedProgramDirectory = {
  files: ProgramDirectoryFile[];
  inputSchema: unknown;
  name: string;
  outputConfig: unknown;
};
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

function inferProgramFileType(
  filename: string,
): ProgramDirectoryFile["filetype"] {
  if (filename.endsWith(".json")) {
    return "Json";
  }

  if (filename.endsWith(".md")) {
    return "Markdown";
  }

  return "TypeScript";
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

function requiredStringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }

  return value.trim();
}

async function loadProgramDirectory(
  fullPath: string,
): Promise<LoadedProgramDirectory> {
  const directoryEntries = await fs.readdir(fullPath, {
    withFileTypes: true,
  });
  const files = (
    await Promise.all(
      directoryEntries
        .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
        .map(async (entry) => ({
          content: await fs.readFile(path.join(fullPath, entry.name), "utf-8"),
          filename: entry.name,
          filetype: inferProgramFileType(entry.name),
        })),
    )
  ).sort((left, right) => left.filename.localeCompare(right.filename));
  const filesByName = new Map(
    files.map((file) => [
      file.filename,
      file,
    ]),
  );
  const packageManifestFile = filesByName.get("package.json");
  const mainFile = filesByName.get("main.ts");
  const inputSchemaFile = filesByName.get("input-schema.json");
  const outputConfigFile = filesByName.get("output-config.json");

  if (!packageManifestFile) {
    throw new Error("Program directory must include package.json.");
  }

  if (!mainFile) {
    throw new Error("Program directory must include main.ts.");
  }

  if (!inputSchemaFile) {
    throw new Error("Program directory must include input-schema.json.");
  }

  if (!outputConfigFile) {
    throw new Error("Program directory must include output-config.json.");
  }

  const packageManifest = parseJson(
    "package.json",
    packageManifestFile.content,
  );

  if (!packageManifest || typeof packageManifest !== "object") {
    throw new Error("package.json must be a JSON object.");
  }

  const name = requiredStringValue(
    (packageManifest as JsonObject).name,
    "package.json.name",
  );
  const inputSchema = parseJson("input-schema.json", inputSchemaFile.content);
  const outputConfig = parseJson(
    "output-config.json",
    outputConfigFile.content,
  );

  return {
    files,
    inputSchema,
    name,
    outputConfig,
  };
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
  .argument("<dir>", "Directory containing the program files and schema")
  .action((dir) =>
    runAction("upserting program", async () => {
      const fullPath = resolveFromInvocation(dir);
      const loadedProgram = await loadProgramDirectory(fullPath);

      const data = await client.upsertProgram({
        files: loadedProgram.files,
        inputSchema: loadedProgram.inputSchema,
        name: loadedProgram.name,
        outputConfig: loadedProgram.outputConfig,
      });

      console.log(
        `Program "${loadedProgram.name}" upserted successfully. (Program ID: ${data.programId}, Version ID: ${data.versionId})`,
      );
    }),
  );

programsCommand
  .command("test")
  .description("Upsert a program and run /test against its latest version")
  .argument("<dir>", "Directory containing the program files and schema")
  .argument("<input>", "Mock input payload as a stringified JSON object")
  .action((dir, inputText) =>
    runAction("testing program", async () => {
      const fullPath = resolveFromInvocation(dir);
      const loadedProgram = await loadProgramDirectory(fullPath);
      const upserted = await client.upsertProgram({
        files: loadedProgram.files,
        inputSchema: loadedProgram.inputSchema,
        name: loadedProgram.name,
        outputConfig: loadedProgram.outputConfig,
      });

      printJson(
        await client.testProgramVersion(upserted.versionId, {
          input: parseJson("input", inputText),
        }),
      );
    }),
  );

program.parse();
