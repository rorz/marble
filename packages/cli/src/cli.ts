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
const rootCommand = new Command();

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
type QueryValue = boolean | number | string | null | undefined;
type ColumnCommandOptions = {
  idx?: number;
  inputTemplate?: string;
  inputTemplateFile?: string;
  outputSchema?: string;
  outputSchemaFile?: string;
  program?: string;
  programVersion?: string;
  table?: string;
};
type RowCommandOptions = {
  count?: number;
  idx?: number;
  table?: string;
};
type CellCommandOptions = {
  clearManualInput?: boolean;
  column?: string;
  manualInput?: string;
  row?: string;
  state?: string;
  stateFile?: string;
  table?: string;
};
type RunCommandOptions = {
  cell?: string;
  clearManualInput?: boolean;
  manualInput?: string;
  programVersion?: string;
};
type ProgramTestOptions = {
  fullInput?: string;
  fullInputFile?: string;
  input?: string;
  inputFile?: string;
  manualInput?: string;
};
type ProjectCommandOptions = {
  folderPath?: string;
  folderPathFile?: string;
  ownerProfileId?: string;
};
type KeyCommandOptions = {
  includeDeleted?: boolean;
  ownerProfileId?: string;
};

function resolveFromInvocation(targetPath: string) {
  return path.resolve(invocationCwd, targetPath);
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

function parseNonNegativeInteger(label: string, input: string) {
  const value = Number(input);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }

  return value;
}

function parsePositiveInteger(label: string, input: string) {
  const value = Number(input);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

function compactObject(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function assertHasDefinedValues(
  label: string,
  value: Record<string, unknown>,
  hints: string[],
) {
  if (Object.keys(compactObject(value)).length > 0) {
    return;
  }

  throw new Error(
    `${label} requires at least one change. Set one of: ${hints.join(", ")}`,
  );
}

function assertExactlyOneDefined(
  label: string,
  choices: Array<{
    flag: string;
    value: unknown;
  }>,
) {
  const definedChoices = choices.filter((choice) => choice.value !== undefined);

  if (definedChoices.length === 1) {
    return;
  }

  if (definedChoices.length === 0) {
    throw new Error(
      `${label} requires exactly one of ${choices
        .map((choice) => choice.flag)
        .join(" or ")}`,
    );
  }

  throw new Error(
    `${label} accepts only one of ${choices
      .map((choice) => choice.flag)
      .join(" or ")}`,
  );
}

function assertAtMostOneDefined(
  label: string,
  choices: Array<{
    flag: string;
    value: unknown;
  }>,
) {
  const definedChoices = choices.filter((choice) => choice.value !== undefined);

  if (definedChoices.length <= 1) {
    return;
  }

  throw new Error(
    `${label} accepts only one of ${choices
      .map((choice) => choice.flag)
      .join(" or ")}`,
  );
}

async function readTextFile(label: string, filePath: string) {
  const fullPath = resolveFromInvocation(filePath);

  try {
    return await fs.readFile(fullPath, "utf-8");
  } catch (error) {
    throw new Error(
      `Could not read ${label} file "${fullPath}": ${formatError(error)}`,
    );
  }
}

async function loadJsonValue(
  label: string,
  options: {
    file?: string;
    value?: string;
  },
) {
  assertAtMostOneDefined(label, [
    {
      flag: "--value",
      value: options.value,
    },
    {
      flag: "--file",
      value: options.file,
    },
  ]);

  if (options.value !== undefined) {
    return parseJson(label, options.value);
  }

  if (options.file !== undefined) {
    return parseJson(label, await readTextFile(label, options.file));
  }

  return undefined;
}

async function loadStringifiedJsonValue(
  label: string,
  options: {
    file?: string;
    value?: string;
  },
) {
  const value = await loadJsonValue(label, options);

  if (value === undefined) {
    return undefined;
  }

  return JSON.stringify(value);
}

function parseStringArray(label: string, value: unknown) {
  if (
    !Array.isArray(value) ||
    value.some(
      (entry) => typeof entry !== "string" || entry.trim().length === 0,
    )
  ) {
    throw new Error(`${label} must be a JSON array of non-empty strings`);
  }

  return value.map((entry) => entry.trim());
}

async function loadFolderPath(options: { file?: string; value?: string }) {
  const value = await loadJsonValue("folder path", options);

  if (value === undefined) {
    return undefined;
  }

  return parseStringArray("folder path", value);
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

async function upsertProgramFromDirectory(dir: string) {
  const fullPath = resolveFromInvocation(dir);
  const loadedProgram = await loadProgramDirectory(fullPath);
  const data = await client.upsertProgram({
    files: loadedProgram.files,
    inputSchema: loadedProgram.inputSchema,
    name: loadedProgram.name,
    outputConfig: loadedProgram.outputConfig,
  });

  return {
    loadedProgram,
    ...data,
  };
}

async function buildColumnPayload(
  name: string | undefined,
  options: ColumnCommandOptions,
) {
  assertExactlyOneDefined("column program selection", [
    {
      flag: "--program",
      value: options.program,
    },
    {
      flag: "--program-version",
      value: options.programVersion,
    },
  ]);

  const payload = compactObject({
    idx: options.idx,
    inputTemplate: await loadStringifiedJsonValue("input template", {
      file: options.inputTemplateFile,
      value: options.inputTemplate,
    }),
    name,
    outputSchema: await loadJsonValue("output schema", {
      file: options.outputSchemaFile,
      value: options.outputSchema,
    }),
    programId: options.program,
    programVersionId: options.programVersion,
    tableId: options.table,
  });

  return payload;
}

async function buildProgramTestInput(options: ProgramTestOptions) {
  const fullInput = await loadJsonValue("full input", {
    file: options.fullInputFile,
    value: options.fullInput,
  });

  if (fullInput !== undefined) {
    assertAtMostOneDefined("program test input source", [
      {
        flag: "--input",
        value: options.input,
      },
      {
        flag: "--input-file",
        value: options.inputFile,
      },
      {
        flag: "--manual-input",
        value: options.manualInput,
      },
    ]);

    return fullInput;
  }

  const input = await loadJsonValue("input", {
    file: options.inputFile,
    value: options.input,
  });

  return {
    cell:
      options.manualInput === undefined
        ? {}
        : {
            manualInputValue: options.manualInput,
          },
    input: input ?? {},
    system: {
      providers: {},
    },
  };
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
        parseJsonObject("filters", filtersText) as Record<string, QueryValue>,
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

function registerProfileCommands() {
  const profileCommand = rootCommand
    .command("profile")
    .description("Human-friendly profile commands");

  profileCommand
    .command("list")
    .description("List profiles")
    .option("--type <type>", "Filter by profile type")
    .action((options: { type?: string }) =>
      runAction("listing profiles", async () => {
        printJson(
          await client.list(
            "profiles",
            compactObject({
              type: options.type,
            }) as Record<string, QueryValue>,
          ),
        );
      }),
    );

  profileCommand
    .command("get")
    .description("Get a profile by ID")
    .argument("<profileId>", "Profile ID")
    .action((profileId) =>
      runAction("getting profile", async () => {
        printJson(await client.get("profiles", profileId));
      }),
    );
}

function registerKeyCommands() {
  const keyCommand = rootCommand
    .command("key")
    .description("Human-friendly API key commands");

  keyCommand
    .command("list")
    .description("List API keys")
    .option("--owner-profile-id <profileId>", "Filter by owner profile ID")
    .option("--include-deleted", "Include revoked keys")
    .action((options: KeyCommandOptions) =>
      runAction("listing API keys", async () => {
        printJson(
          await client.list(
            "keys",
            compactObject({
              includeDeleted: options.includeDeleted || undefined,
              ownerProfileId: options.ownerProfileId,
            }) as Record<string, QueryValue>,
          ),
        );
      }),
    );

  keyCommand
    .command("get")
    .description("Get an API key by ID")
    .argument("<keyId>", "API key ID")
    .action((keyId) =>
      runAction("getting API key", async () => {
        printJson(await client.get("keys", keyId));
      }),
    );
}

function registerTableCommands() {
  const tableCommand = rootCommand
    .command("table")
    .description("Human-friendly table commands");

  tableCommand
    .command("create")
    .description("Create a table")
    .argument("<name>", "Table name")
    .requiredOption("--project <projectId>", "Owning project ID")
    .action(
      (
        name,
        options: {
          project?: string;
        },
      ) =>
        runAction("creating table", async () => {
          printJson(
            await client.create(
              "tables",
              compactObject({
                name,
                projectId: options.project,
              }),
            ),
          );
        }),
    );

  tableCommand
    .command("list")
    .description("List tables")
    .option("--project <projectId>", "Filter by project ID")
    .action((options: { project?: string }) =>
      runAction("listing tables", async () => {
        printJson(
          await client.list(
            "tables",
            compactObject({
              projectId: options.project,
            }) as Record<string, QueryValue>,
          ),
        );
      }),
    );

  tableCommand
    .command("get")
    .description("Get a table by ID")
    .argument("<tableId>", "Table ID")
    .action((tableId) =>
      runAction("getting table", async () => {
        printJson(await client.get("tables", tableId));
      }),
    );

  tableCommand
    .command("update")
    .description("Update a table")
    .argument("<tableId>", "Table ID")
    .option("--name <name>", "New table name")
    .option("--project <projectId>", "New owning project ID")
    .action(
      (
        tableId,
        options: {
          name?: string;
          project?: string;
        },
      ) =>
        runAction("updating table", async () => {
          const payload = compactObject({
            name: options.name,
            projectId: options.project,
          });

          assertHasDefinedValues("table update", payload, [
            "--name",
            "--project",
          ]);
          printJson(await client.update("tables", tableId, payload));
        }),
    );

  tableCommand
    .command("delete")
    .description("Delete a table")
    .argument("<tableId>", "Table ID")
    .action((tableId) =>
      runAction("deleting table", async () => {
        printJson(await client.delete("tables", tableId));
      }),
    );
}

function registerProjectCommands() {
  const projectCommand = rootCommand
    .command("project")
    .description("Human-friendly project commands");

  projectCommand
    .command("create")
    .description("Create a project")
    .argument("<name>", "Project name")
    .option("--owner-profile-id <profileId>", "Owner profile ID")
    .option("--folder-path <json>", "Folder path as a JSON string array")
    .option(
      "--folder-path-file <path>",
      "Path to a JSON file containing the folder path array",
    )
    .action((name, options: ProjectCommandOptions) =>
      runAction("creating project", async () => {
        printJson(
          await client.create(
            "projects",
            compactObject({
              folderPath: await loadFolderPath({
                file: options.folderPathFile,
                value: options.folderPath,
              }),
              name,
              ownerProfileId: options.ownerProfileId,
            }),
          ),
        );
      }),
    );

  projectCommand
    .command("list")
    .description("List projects")
    .option("--owner-profile-id <profileId>", "Filter by owner profile ID")
    .action((options: { ownerProfileId?: string }) =>
      runAction("listing projects", async () => {
        printJson(
          await client.list(
            "projects",
            compactObject({
              ownerProfileId: options.ownerProfileId,
            }) as Record<string, QueryValue>,
          ),
        );
      }),
    );

  projectCommand
    .command("get")
    .description("Get a project by ID")
    .argument("<projectId>", "Project ID")
    .action((projectId) =>
      runAction("getting project", async () => {
        printJson(await client.get("projects", projectId));
      }),
    );

  projectCommand
    .command("update")
    .description("Update a project")
    .argument("<projectId>", "Project ID")
    .option("--name <name>", "New project name")
    .option("--owner-profile-id <profileId>", "New owner profile ID")
    .option("--folder-path <json>", "Folder path as a JSON string array")
    .option(
      "--folder-path-file <path>",
      "Path to a JSON file containing the folder path array",
    )
    .action(
      (
        projectId,
        options: ProjectCommandOptions & {
          name?: string;
        },
      ) =>
        runAction("updating project", async () => {
          const payload = compactObject({
            folderPath: await loadFolderPath({
              file: options.folderPathFile,
              value: options.folderPath,
            }),
            name: options.name,
            ownerProfileId: options.ownerProfileId,
          });

          assertHasDefinedValues("project update", payload, [
            "--name",
            "--owner-profile-id",
            "--folder-path",
            "--folder-path-file",
          ]);
          printJson(await client.update("projects", projectId, payload));
        }),
    );

  projectCommand
    .command("delete")
    .description("Delete a project")
    .argument("<projectId>", "Project ID")
    .action((projectId) =>
      runAction("deleting project", async () => {
        printJson(await client.delete("projects", projectId));
      }),
    );
}

function registerColumnCommands() {
  const columnCommand = rootCommand
    .command("column")
    .description("Human-friendly column commands");

  columnCommand
    .command("create")
    .description("Create a column")
    .argument("<name>", "Column name")
    .requiredOption("--table <tableId>", "Owning table ID")
    .option(
      "--program <programId>",
      "Program ID. Marble resolves this to the latest program version",
    )
    .option("--program-version <programVersionId>", "Pinned program version ID")
    .option("--input-template <json>", "Input template JSON")
    .option("--input-template-file <path>", "Path to input template JSON file")
    .option("--output-schema <json>", "Output schema JSON")
    .option("--output-schema-file <path>", "Path to output schema JSON file")
    .option("--idx <number>", "Column index", (value) =>
      parseNonNegativeInteger("idx", value),
    )
    .addHelpText(
      "after",
      "\nExactly one of --program or --program-version is required.",
    )
    .action((name, options: ColumnCommandOptions) =>
      runAction("creating column", async () => {
        printJson(
          await client.create(
            "columns",
            await buildColumnPayload(name, options),
          ),
        );
      }),
    );

  columnCommand
    .command("list")
    .description("List columns")
    .option("--table <tableId>", "Filter by table ID")
    .option(
      "--program <programId>",
      "Filter by program ID. Marble resolves this to the latest program version",
    )
    .option(
      "--program-version <programVersionId>",
      "Filter by program version ID",
    )
    .action((options: ColumnCommandOptions) =>
      runAction("listing columns", async () => {
        printJson(
          await client.list(
            "columns",
            compactObject({
              programId: options.program,
              programVersionId: options.programVersion,
              tableId: options.table,
            }) as Record<string, QueryValue>,
          ),
        );
      }),
    );

  columnCommand
    .command("get")
    .description("Get a column by ID")
    .argument("<columnId>", "Column ID")
    .action((columnId) =>
      runAction("getting column", async () => {
        printJson(await client.get("columns", columnId));
      }),
    );

  columnCommand
    .command("update")
    .description("Update a column")
    .argument("<columnId>", "Column ID")
    .option("--name <name>", "New column name")
    .option(
      "--program <programId>",
      "Program ID. Marble resolves this to the latest program version",
    )
    .option("--program-version <programVersionId>", "Pinned program version ID")
    .option("--input-template <json>", "Input template JSON")
    .option("--input-template-file <path>", "Path to input template JSON file")
    .option("--output-schema <json>", "Output schema JSON")
    .option("--output-schema-file <path>", "Path to output schema JSON file")
    .option("--idx <number>", "Column index", (value) =>
      parseNonNegativeInteger("idx", value),
    )
    .addHelpText(
      "after",
      "\nProvide one or more flags to change. At most one of --program or --program-version may be set.",
    )
    .action(
      (
        columnId,
        options: ColumnCommandOptions & {
          name?: string;
        },
      ) =>
        runAction("updating column", async () => {
          assertAtMostOneDefined("column program selection", [
            {
              flag: "--program",
              value: options.program,
            },
            {
              flag: "--program-version",
              value: options.programVersion,
            },
          ]);

          const payload = compactObject({
            idx: options.idx,
            inputTemplate: await loadStringifiedJsonValue("input template", {
              file: options.inputTemplateFile,
              value: options.inputTemplate,
            }),
            name: options.name,
            outputSchema: await loadJsonValue("output schema", {
              file: options.outputSchemaFile,
              value: options.outputSchema,
            }),
            programId: options.program,
            programVersionId: options.programVersion,
          });

          assertHasDefinedValues("column update", payload, [
            "--name",
            "--program",
            "--program-version",
            "--input-template",
            "--input-template-file",
            "--output-schema",
            "--output-schema-file",
            "--idx",
          ]);
          printJson(await client.update("columns", columnId, payload));
        }),
    );

  columnCommand
    .command("delete")
    .description("Delete a column")
    .argument("<columnId>", "Column ID")
    .action((columnId) =>
      runAction("deleting column", async () => {
        printJson(await client.delete("columns", columnId));
      }),
    );
}

function registerRowCommands() {
  const rowCommand = rootCommand
    .command("row")
    .description("Human-friendly row commands");

  rowCommand
    .command("create")
    .description("Create one or more rows")
    .requiredOption("--table <tableId>", "Owning table ID")
    .option("--count <number>", "Number of rows to create", (value) =>
      parsePositiveInteger("count", value),
    )
    .option(
      "--idx <number>",
      "Explicit row index. Only valid when count is 1",
      (value) => parseNonNegativeInteger("idx", value),
    )
    .action((options: RowCommandOptions) =>
      runAction("creating row", async () => {
        const payload = compactObject({
          count: options.count,
          idx: options.idx,
          tableId: options.table,
        });

        printJson(await client.create("rows", payload));
      }),
    );

  rowCommand
    .command("list")
    .description("List rows")
    .option("--table <tableId>", "Filter by table ID")
    .action((options: { table?: string }) =>
      runAction("listing rows", async () => {
        printJson(
          await client.list(
            "rows",
            compactObject({
              tableId: options.table,
            }) as Record<string, QueryValue>,
          ),
        );
      }),
    );

  rowCommand
    .command("get")
    .description("Get a row by ID")
    .argument("<rowId>", "Row ID")
    .action((rowId) =>
      runAction("getting row", async () => {
        printJson(await client.get("rows", rowId));
      }),
    );

  rowCommand
    .command("update")
    .description("Update a row")
    .argument("<rowId>", "Row ID")
    .requiredOption("--idx <number>", "New row index", (value) =>
      parseNonNegativeInteger("idx", value),
    )
    .action(
      (
        rowId,
        options: {
          idx: number;
        },
      ) =>
        runAction("updating row", async () => {
          printJson(
            await client.update("rows", rowId, {
              idx: options.idx,
            }),
          );
        }),
    );

  rowCommand
    .command("delete")
    .description("Delete a row")
    .argument("<rowId>", "Row ID")
    .action((rowId) =>
      runAction("deleting row", async () => {
        printJson(await client.delete("rows", rowId));
      }),
    );
}

function registerCellCommands() {
  const cellCommand = rootCommand
    .command("cell")
    .description("Human-friendly cell commands");

  cellCommand
    .command("list")
    .description("List cells")
    .option("--table <tableId>", "Filter by table ID")
    .option("--row <rowId>", "Filter by row ID")
    .option("--column <columnId>", "Filter by column ID")
    .action((options: CellCommandOptions) =>
      runAction("listing cells", async () => {
        printJson(
          await client.list(
            "cells",
            compactObject({
              columnId: options.column,
              rowId: options.row,
              tableId: options.table,
            }) as Record<string, QueryValue>,
          ),
        );
      }),
    );

  cellCommand
    .command("get")
    .description("Get a cell by ID")
    .argument("<cellId>", "Cell ID")
    .action((cellId) =>
      runAction("getting cell", async () => {
        printJson(await client.get("cells", cellId));
      }),
    );

  cellCommand
    .command("set")
    .description("Set manual input on a cell without executing it")
    .argument("<cellId>", "Cell ID")
    .argument("<manualInput>", "Manual input string")
    .action((cellId, manualInput) =>
      runAction("setting cell manual input", async () => {
        printJson(
          await client.update("cells", cellId, {
            manualInput,
          }),
        );
      }),
    );

  cellCommand
    .command("update")
    .description("Low-level cell updates. Prefer run start for execution")
    .argument("<cellId>", "Cell ID")
    .option("--manual-input <value>", "Set manual input")
    .option("--clear-manual-input", "Set manual input to null")
    .option("--state <json>", "Force cell state JSON (low-level/internal)")
    .option(
      "--state-file <path>",
      "Path to forced cell state JSON file (low-level/internal)",
    )
    .action((cellId, options: CellCommandOptions) =>
      runAction("updating cell", async () => {
        if (options.manualInput !== undefined && options.clearManualInput) {
          throw new Error(
            "cell update accepts only one of --manual-input or --clear-manual-input",
          );
        }

        const payload = compactObject({
          manualInput: options.clearManualInput ? null : options.manualInput,
          state: await loadJsonValue("state", {
            file: options.stateFile,
            value: options.state,
          }),
        });

        assertHasDefinedValues("cell update", payload, [
          "--manual-input",
          "--clear-manual-input",
          "--state",
          "--state-file",
        ]);
        printJson(await client.update("cells", cellId, payload));
      }),
    );
}

function registerRunCommands() {
  const runCommand = rootCommand
    .command("run")
    .description("Human-friendly stored run commands");

  runCommand
    .command("start")
    .description("Create and execute the column-bound run for a cell")
    .argument("<cellId>", "Cell ID")
    .option(
      "--manual-input <value>",
      "Set manual input before starting the run",
    )
    .option(
      "--clear-manual-input",
      "Clear manual input before starting the run",
    )
    .action((cellId, options: RunCommandOptions) =>
      runAction("starting run", async () => {
        if (options.manualInput !== undefined && options.clearManualInput) {
          throw new Error(
            "run start accepts only one of --manual-input or --clear-manual-input",
          );
        }

        const result = await client.startCellRun(
          cellId,
          compactObject({
            manualInput: options.clearManualInput ? null : options.manualInput,
          }),
        );

        printJson(result);
        if (!result.success) {
          process.exitCode = 1;
        }
      }),
    );

  runCommand
    .command("list")
    .description("List stored runs")
    .option("--cell <cellId>", "Filter by target cell ID")
    .option(
      "--program-version <programVersionId>",
      "Filter by program version ID",
    )
    .action((options: RunCommandOptions) =>
      runAction("listing runs", async () => {
        printJson(
          await client.list(
            "program_runs",
            compactObject({
              programVersionId: options.programVersion,
              targetCellId: options.cell,
            }) as Record<string, QueryValue>,
          ),
        );
      }),
    );

  runCommand
    .command("get")
    .description("Get a stored run by ID")
    .argument("<runId>", "Run ID")
    .action((runId) =>
      runAction("getting run", async () => {
        printJson(await client.get("program_runs", runId));
      }),
    );

  runCommand
    .command("execute")
    .description("Execute an existing stored run")
    .argument("<runId>", "Run ID")
    .action((runId) =>
      runAction("executing run", async () => {
        const result = await client.executeProgramRun(runId);

        printJson(result);
        if (!result.success) {
          process.exitCode = 1;
        }
      }),
    );
}

function registerProgramCommands() {
  const programCommand = rootCommand
    .command("program")
    .description("Human-friendly program commands");

  programCommand
    .command("list")
    .description("List programs")
    .option("--owner-profile-id <profileId>", "Filter by owner profile ID")
    .action((options: { ownerProfileId?: string }) =>
      runAction("listing programs", async () => {
        printJson(
          await client.list(
            "programs",
            compactObject({
              ownerProfileId: options.ownerProfileId,
            }) as Record<string, QueryValue>,
          ),
        );
      }),
    );

  programCommand
    .command("get")
    .description("Get a program by ID")
    .argument("<programId>", "Program ID")
    .action((programId) =>
      runAction("getting program", async () => {
        printJson(await client.get("programs", programId));
      }),
    );

  programCommand
    .command("delete")
    .description("Delete a program")
    .argument("<programId>", "Program ID")
    .action((programId) =>
      runAction("deleting program", async () => {
        printJson(await client.delete("programs", programId));
      }),
    );

  programCommand
    .command("upsert")
    .description("Upsert a program from a local directory")
    .argument("<dir>", "Directory containing the program files and schema")
    .action((dir) =>
      runAction("upserting program", async () => {
        const result = await upsertProgramFromDirectory(dir);

        console.log(
          `Program "${result.loadedProgram.name}" upserted successfully. (Program ID: ${result.programId}, Version ID: ${result.versionId})`,
        );
      }),
    );

  programCommand
    .command("test")
    .description("Upsert a program and run /test against its latest version")
    .argument("<dir>", "Directory containing the program files and schema")
    .option("--input <json>", "Program input JSON. Defaults to {}")
    .option("--input-file <path>", "Path to program input JSON file")
    .option("--manual-input <value>", "Manual cell input value")
    .option("--full-input <json>", "Full Marble run input JSON")
    .option(
      "--full-input-file <path>",
      "Path to full Marble run input JSON file",
    )
    .action((dir, options: ProgramTestOptions) =>
      runAction("testing program", async () => {
        const result = await upsertProgramFromDirectory(dir);

        printJson(
          await client.testProgramVersion(result.versionId, {
            input: await buildProgramTestInput(options),
          }),
        );
      }),
    );
}

rootCommand
  .name("marble")
  .description(
    "CLI to manage Marble resources. Prefer singular commands; use run start for table execution and plural resource names for raw JSON mode.",
  )
  .version("1.0.0")
  .showHelpAfterError()
  .showSuggestionAfterError();

registerProjectCommands();
registerProfileCommands();
registerKeyCommands();
registerTableCommands();
registerColumnCommands();
registerRowCommands();
registerCellCommands();
registerRunCommands();
registerProgramCommands();

const resourceCommands = new Map<ApiResourceName, Command>();

for (const resourceName of ApiResourceNames) {
  const command = rootCommand
    .command(apiResourceSegment(resourceName))
    .description(`Manage ${apiResourceLabel(resourceName)} (raw JSON mode)`);
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
      const result = await upsertProgramFromDirectory(dir);

      console.log(
        `Program "${result.loadedProgram.name}" upserted successfully. (Program ID: ${result.programId}, Version ID: ${result.versionId})`,
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
      const result = await upsertProgramFromDirectory(dir);

      printJson(
        await client.testProgramVersion(result.versionId, {
          input: parseJson("input", inputText),
        }),
      );
    }),
  );

rootCommand.parse();
