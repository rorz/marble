import { Command } from "commander";
import { getMarbleClient } from "../client";
import {
  compactObject,
  type JsonObject,
  parseIntegerOption,
  parseJsonArray,
  parseJsonObject,
  parseJsonValue,
  printJson,
  readEnvValue,
  readJsonFile,
  readJsonOption,
  readOptionalJsonObject,
  readRequiredJsonObject,
  requireChanges,
} from "../json";
import {
  resolveProgramVersionId,
  upsertProgramDirectory,
} from "../program-directory";

type JsonInputOptions = {
  inputFile?: string;
};

type StandardUpdateInput = {
  id: string;
  values: JsonObject;
};

type ProjectUpdateInput = {
  projectId: string;
  values: JsonObject;
};

type Operation<Input, Output> = (input: Input) => Promise<Output>;

function createCommand(name: string, description: string) {
  return new Command(name).description(description);
}

function callOperation<Input, Output>(
  operation: Operation<Input, Output>,
  input: unknown,
) {
  return operation(input as Input);
}

function addInputFileOption(command: Command) {
  return command.option("--input-file <path>", "Read JSON input from a file");
}

async function readInput(
  input: string | undefined,
  options: JsonInputOptions,
  label: string,
) {
  return readRequiredJsonObject({
    input,
    inputFile: options.inputFile,
    label,
  });
}

async function readOptionalInput(
  input: string | undefined,
  options: JsonInputOptions,
  label: string,
) {
  return readOptionalJsonObject({
    input,
    inputFile: options.inputFile,
    label,
  });
}

function parseBindings(input: string[] | undefined) {
  return (input ?? []).map((binding) => {
    const [envName, secretId, ...rest] = binding.split("=");

    if (!envName || !secretId || rest.length > 0) {
      throw new Error("Bindings must use ENV_NAME=<secret-id>.");
    }

    return {
      envName,
      secretId,
    };
  });
}

function parseFolderPath(input?: string) {
  if (input === undefined) {
    return undefined;
  }

  const value = parseJsonArray(input, "Folder path");

  if (value.some((entry) => typeof entry !== "string")) {
    throw new Error("Folder path must be a JSON array of strings.");
  }

  return value as string[];
}

async function resolveProjectId(projectId: string | undefined) {
  if (projectId) {
    return projectId;
  }

  const project = await getMarbleClient().projects.getMostRecentProject({});

  if (!project) {
    throw new Error("No project was provided and no recent project exists.");
  }

  return project.id;
}

function normalizeInputTemplate(input: string | undefined) {
  if (input === undefined) {
    return "{}";
  }

  return JSON.stringify(parseJsonValue(input, "input-template"));
}

async function readSecretValue(options: { value?: string; valueEnv?: string }) {
  if (options.value !== undefined && options.valueEnv !== undefined) {
    throw new Error("Pass either --value or --value-env, not both.");
  }

  if (options.valueEnv) {
    return readEnvValue(options.valueEnv);
  }

  if (options.value === undefined) {
    throw new Error("A secret value is required. Use --value or --value-env.");
  }

  return options.value;
}

function parseSourceFilter(options: { project?: string; source?: string }) {
  if (options.project) {
    return compactObject({
      projectId: options.project,
      sourceId: options.source,
    }) as {
      limit?: number;
      projectId: string;
      sourceId?: string;
    };
  }

  if (options.source) {
    return {
      sourceId: options.source,
    };
  }

  throw new Error("Pass --project, --source, or both.");
}

function parsePipeFilter(options: { source?: string; table?: string }) {
  if (options.source) {
    return compactObject({
      sourceId: options.source,
      tableId: options.table,
    }) as {
      sourceId: string;
      tableId?: string;
    };
  }

  if (options.table) {
    return {
      tableId: options.table,
    };
  }

  throw new Error("Pass --source, --table, or both.");
}

function parseCellFilter(options: { column?: string; row?: string }) {
  if (options.row) {
    return compactObject({
      columnId: options.column,
      rowId: options.row,
    }) as {
      columnId?: string;
      rowId: string;
    };
  }

  if (options.column) {
    return {
      columnId: options.column,
    };
  }

  throw new Error("Pass --row, --column, or --table.");
}

async function listCellsForTable(tableId: string) {
  const marble = getMarbleClient();
  const rows = await marble.rows.list({
    tableId,
  });
  const cellGroups = await Promise.all(
    rows.map((row) =>
      marble.cells.list({
        rowId: row.id,
      }),
    ),
  );

  return cellGroups.flat();
}

async function getAppendRowIdx(tableId: string) {
  const rows = await getMarbleClient().rows.list({
    tableId,
  });

  return rows.reduce((idx, row) => Math.max(idx, row.idx + 1), 0);
}

async function resolveCellRange(range: string) {
  const [startCellId, endCellId, ...rest] = range.split("..");

  if (!startCellId || !endCellId || rest.length > 0) {
    throw new Error("Ranges must use <startCellId>..<endCellId>.");
  }

  const marble = getMarbleClient();
  const [startCell, endCell] = await Promise.all([
    marble.cells.get({
      id: startCellId,
    }),
    marble.cells.get({
      id: endCellId,
    }),
  ]);
  const [startRow, endRow, startColumn, endColumn] = await Promise.all([
    marble.rows.get({
      id: startCell.rowId,
    }),
    marble.rows.get({
      id: endCell.rowId,
    }),
    marble.columns.get({
      id: startCell.columnId,
    }),
    marble.columns.get({
      id: endCell.columnId,
    }),
  ]);

  if (
    startRow.tableId !== endRow.tableId ||
    startColumn.tableId !== endColumn.tableId ||
    startRow.tableId !== startColumn.tableId
  ) {
    throw new Error("Range cells must belong to the same table.");
  }

  const [minRowIdx, maxRowIdx] = [
    Math.min(startRow.idx, endRow.idx),
    Math.max(startRow.idx, endRow.idx),
  ];
  const [minColumnIdx, maxColumnIdx] = [
    Math.min(startColumn.idx, endColumn.idx),
    Math.max(startColumn.idx, endColumn.idx),
  ];
  const [rows, columns] = await Promise.all([
    marble.rows.list({
      tableId: startRow.tableId,
    }),
    marble.columns.list({
      tableId: startRow.tableId,
    }),
  ]);
  const columnIds = new Set(
    columns
      .filter(
        (column) => column.idx >= minColumnIdx && column.idx <= maxColumnIdx,
      )
      .map((column) => column.id),
  );
  const selectedRows = rows
    .filter((row) => row.idx >= minRowIdx && row.idx <= maxRowIdx)
    .sort((left, right) => left.idx - right.idx);
  const cellGroups = await Promise.all(
    selectedRows.map((row) =>
      marble.cells.list({
        rowId: row.id,
      }),
    ),
  );

  return cellGroups
    .flat()
    .filter((cell) => columnIds.has(cell.columnId))
    .sort((left, right) => {
      const leftColumn = columns.find((column) => column.id === left.columnId);
      const rightColumn = columns.find(
        (column) => column.id === right.columnId,
      );

      return (leftColumn?.idx ?? 0) - (rightColumn?.idx ?? 0);
    })
    .map((cell) => cell.id);
}

async function resolveRunCellIds(
  cellIds: string[],
  options: {
    range?: string;
  },
) {
  const rangeCellIds = options.range
    ? await resolveCellRange(options.range)
    : [];
  const uniqueCellIds = new Set([
    ...cellIds,
    ...rangeCellIds,
  ]);

  if (uniqueCellIds.size === 0) {
    throw new Error("run start requires at least one cell ID or --range.");
  }

  return [
    ...uniqueCellIds,
  ];
}

function addStandardGet(
  command: Command,
  options: {
    action: (input: { id: string }) => Promise<unknown>;
    noun: string;
  },
) {
  command
    .command("get")
    .argument("<id>", `${options.noun} ID`)
    .action(async (id: string) => {
      printJson(
        await options.action({
          id,
        }),
      );
    });
}

function addStandardDelete(
  command: Command,
  options: {
    action: (input: { id: string }) => Promise<unknown>;
    noun: string;
  },
) {
  command
    .command("delete")
    .argument("<id>", `${options.noun} ID`)
    .action(async (id: string) => {
      printJson(
        await options.action({
          id,
        }),
      );
    });
}

function addStandardCreate(
  command: Command,
  options: {
    action: (input: JsonObject) => Promise<unknown>;
    label: string;
  },
) {
  addInputFileOption(
    command
      .command("create")
      .argument("[input]", `${options.label} JSON input`),
  ).action(async (input: string | undefined, jsonOptions: JsonInputOptions) => {
    printJson(
      await options.action(await readInput(input, jsonOptions, options.label)),
    );
  });
}

function addStandardList(
  command: Command,
  options: {
    action: (input: JsonObject | undefined) => Promise<unknown>;
    label: string;
  },
) {
  addInputFileOption(
    command.command("list").argument("[input]", `${options.label} JSON filter`),
  ).action(async (input: string | undefined, jsonOptions: JsonInputOptions) => {
    printJson(
      await options.action(
        await readOptionalInput(input, jsonOptions, options.label),
      ),
    );
  });
}

function addStandardUpdate(
  command: Command,
  options: {
    action: (input: StandardUpdateInput) => Promise<unknown>;
    label: string;
    noun: string;
  },
) {
  addInputFileOption(
    command
      .command("update")
      .argument("<id>", `${options.noun} ID`)
      .argument("[values]", `${options.label} values JSON`),
  ).action(
    async (
      id: string,
      values: string | undefined,
      jsonOptions: JsonInputOptions,
    ) => {
      const parsedValues = await readInput(values, jsonOptions, options.label);

      requireChanges(parsedValues);
      printJson(
        await options.action({
          id,
          values: parsedValues,
        }),
      );
    },
  );
}

export function createProjectCommand() {
  const command = createCommand("project", "Project commands");

  command
    .command("create")
    .argument("[name]", "Project name")
    .option("--folder-path <json>", "Folder path as a JSON array of strings")
    .action(
      async (
        name: string | undefined,
        options: {
          folderPath?: string;
        },
      ) => {
        printJson(
          await getMarbleClient().projects.create(
            compactObject({
              folderPath: parseFolderPath(options.folderPath),
              name,
            }),
          ),
        );
      },
    );

  command
    .command("list")
    .option("--name <name>", "Filter projects by exact name")
    .action(async (options: { name?: string }) => {
      printJson(
        await getMarbleClient().projects.list(
          compactObject({
            name: options.name,
          }),
        ),
      );
    });

  command
    .command("get")
    .argument("<project-id>", "Project ID")
    .action(async (projectId: string) => {
      printJson(
        await getMarbleClient().projects.get({
          projectId,
        }),
      );
    });

  command.command("get-most-recent").action(async () => {
    printJson(await getMarbleClient().projects.getMostRecentProject({}));
  });

  command
    .command("update")
    .argument("<project-id>", "Project ID")
    .option("--folder-path <json>", "Folder path as a JSON array of strings")
    .option("--name <name>", "Project name")
    .action(
      async (
        projectId: string,
        options: {
          folderPath?: string;
          name?: string;
        },
      ) => {
        const values = compactObject({
          folderPath: parseFolderPath(options.folderPath),
          name: options.name,
        });

        requireChanges(values);
        printJson(
          await getMarbleClient().projects.update({
            projectId,
            values,
          }),
        );
      },
    );

  command
    .command("delete")
    .argument("<project-id>", "Project ID")
    .action(async (projectId: string) => {
      printJson(
        await getMarbleClient().projects.delete({
          projectId,
        }),
      );
    });

  return command;
}

export function createProjectsCommand() {
  const command = createCommand("projects", "Raw project commands");

  addStandardCreate(command, {
    action: (input) => callOperation(getMarbleClient().projects.create, input),
    label: "Project",
  });
  command
    .command("get")
    .argument("<project-id>", "Project ID")
    .action(async (projectId: string) => {
      printJson(
        await getMarbleClient().projects.get({
          projectId,
        }),
      );
    });
  command.command("get-most-recent").action(async () => {
    printJson(await getMarbleClient().projects.getMostRecentProject({}));
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().projects.list, input),
    label: "Project",
  });
  addInputFileOption(
    command
      .command("update")
      .argument("<project-id>", "Project ID")
      .argument("[values]", "Project values JSON"),
  ).action(
    async (
      projectId: string,
      values: string | undefined,
      options: JsonInputOptions,
    ) => {
      const parsedValues = await readInput(values, options, "Project");

      requireChanges(parsedValues);
      printJson(
        await callOperation(getMarbleClient().projects.update, {
          projectId,
          values: parsedValues,
        } satisfies ProjectUpdateInput),
      );
    },
  );
  command
    .command("delete")
    .argument("<project-id>", "Project ID")
    .action(async (projectId: string) => {
      printJson(
        await getMarbleClient().projects.delete({
          projectId,
        }),
      );
    });

  return command;
}

export function createProfileCommand() {
  const command = createCommand("profile", "Profile commands");

  command
    .command("create")
    .argument("<name>", "Profile name")
    .option("--external-name <name>", "External profile name")
    .option("--icon <icon>", "Profile icon")
    .option("--type <type>", "Profile type")
    .action(
      async (
        name: string,
        options: {
          externalName?: string;
          icon?: string;
          type?: string;
        },
      ) => {
        printJson(
          await callOperation(
            getMarbleClient().profiles.create,
            compactObject({
              externalName: options.externalName,
              icon: options.icon,
              name,
              type: options.type,
            }),
          ),
        );
      },
    );

  command
    .command("list")
    .option("--type <type>", "Filter by profile type")
    .action(async (options: { type?: string }) => {
      printJson(
        await callOperation(
          getMarbleClient().profiles.list,
          compactObject({
            type: options.type,
          }),
        ),
      );
    });

  addStandardGet(command, {
    action: (input) => getMarbleClient().profiles.get(input),
    noun: "Profile",
  });

  command
    .command("update")
    .argument("<id>", "Profile ID")
    .option("--external-name <name>", "External profile name")
    .option("--icon <icon>", "Profile icon")
    .option("--name <name>", "Profile name")
    .option("--type <type>", "Profile type")
    .action(
      async (
        id: string,
        options: {
          externalName?: string;
          icon?: string;
          name?: string;
          type?: string;
        },
      ) => {
        const values = compactObject({
          externalName: options.externalName,
          icon: options.icon,
          name: options.name,
          type: options.type,
        });

        requireChanges(values);
        printJson(
          await callOperation(getMarbleClient().profiles.update, {
            id,
            values,
          }),
        );
      },
    );

  addStandardDelete(command, {
    action: (input) => getMarbleClient().profiles.delete(input),
    noun: "Profile",
  });

  return command;
}

export function createProfilesCommand() {
  const command = createCommand("profiles", "Raw profile commands");

  addStandardCreate(command, {
    action: (input) => callOperation(getMarbleClient().profiles.create, input),
    label: "Profile",
  });
  addStandardGet(command, {
    action: (input) => getMarbleClient().profiles.get(input),
    noun: "Profile",
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().profiles.list, input),
    label: "Profile",
  });
  addStandardUpdate(command, {
    action: (input) => callOperation(getMarbleClient().profiles.update, input),
    label: "Profile",
    noun: "Profile",
  });
  addStandardDelete(command, {
    action: (input) => getMarbleClient().profiles.delete(input),
    noun: "Profile",
  });

  return command;
}

export function createKeyCommand() {
  const command = createCommand("key", "API key commands");

  command
    .command("create")
    .argument("<profile-id>", "Owner profile ID")
    .action(async (ownerProfileId: string) => {
      printJson(
        await getMarbleClient().keys.create({
          ownerProfileId,
        }),
      );
    });

  command
    .command("list")
    .option("--profile <profile-id>", "Owner profile ID")
    .option("--include-deleted", "Include deleted or revoked keys")
    .action(async (options: { includeDeleted?: boolean; profile?: string }) => {
      printJson(
        await getMarbleClient().keys.list(
          compactObject({
            includeDeleted: options.includeDeleted,
            ownerProfileId: options.profile,
          }),
        ),
      );
    });

  command
    .command("revoke")
    .argument("<id>", "Key ID")
    .action(async (id: string) => {
      printJson(
        await getMarbleClient().keys.revoke({
          id,
        }),
      );
    });

  return command;
}

export function createKeysCommand() {
  const command = createCommand("keys", "Raw API key commands");

  addStandardCreate(command, {
    action: (input) => callOperation(getMarbleClient().keys.create, input),
    label: "Key",
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().keys.list, input),
    label: "Key",
  });
  command
    .command("revoke")
    .argument("<id>", "Key ID")
    .action(async (id: string) => {
      printJson(
        await getMarbleClient().keys.revoke({
          id,
        }),
      );
    });

  return command;
}

export function createSecretCommand() {
  const command = createCommand("secret", "Secret commands");

  command
    .command("create")
    .argument("<name>", "Secret name")
    .option("--category <category>", "Secret category")
    .option("--value <value>", "Secret value")
    .option("--value-env <env>", "Read the secret value from an env var")
    .action(
      async (
        name: string,
        options: {
          category?: "Managed" | "UserDefined";
          value?: string;
          valueEnv?: string;
        },
      ) => {
        printJson(
          await callOperation(
            getMarbleClient().secrets.create,
            compactObject({
              category: options.category,
              name,
              value: await readSecretValue(options),
            }),
          ),
        );
      },
    );

  command
    .command("list")
    .option("--category <category>", "Filter by category")
    .option("--name <name>", "Filter by name")
    .action(
      async (options: {
        category?: "Managed" | "UserDefined";
        name?: string;
      }) => {
        printJson(
          await getMarbleClient().secrets.list(
            compactObject({
              category: options.category,
              name: options.name,
            }),
          ),
        );
      },
    );

  addStandardGet(command, {
    action: (input) => getMarbleClient().secrets.get(input),
    noun: "Secret",
  });

  command
    .command("update")
    .argument("<id>", "Secret ID")
    .option("--name <name>", "Secret name")
    .option("--value <value>", "Secret value")
    .option("--value-env <env>", "Read the secret value from an env var")
    .action(
      async (
        id: string,
        options: {
          name?: string;
          value?: string;
          valueEnv?: string;
        },
      ) => {
        const value =
          options.value === undefined && options.valueEnv === undefined
            ? undefined
            : await readSecretValue(options);
        const values = compactObject({
          name: options.name,
          value,
        });

        requireChanges(values);
        printJson(
          await getMarbleClient().secrets.update({
            id,
            values,
          }),
        );
      },
    );

  addStandardDelete(command, {
    action: (input) => getMarbleClient().secrets.delete(input),
    noun: "Secret",
  });

  return command;
}

export function createSecretsCommand() {
  const command = createCommand("secrets", "Raw secret commands");

  addStandardCreate(command, {
    action: (input) => callOperation(getMarbleClient().secrets.create, input),
    label: "Secret",
  });
  addStandardGet(command, {
    action: (input) => getMarbleClient().secrets.get(input),
    noun: "Secret",
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().secrets.list, input),
    label: "Secret",
  });
  addStandardUpdate(command, {
    action: (input) => callOperation(getMarbleClient().secrets.update, input),
    label: "Secret",
    noun: "Secret",
  });
  addStandardDelete(command, {
    action: (input) => getMarbleClient().secrets.delete(input),
    noun: "Secret",
  });

  return command;
}

export function createTableCommand() {
  const command = createCommand("table", "Table commands");

  command
    .command("create")
    .argument("[name]", "Table name")
    .option("--project <project-id>", "Project ID")
    .action(
      async (
        name: string | undefined,
        options: {
          project?: string;
        },
      ) => {
        printJson(
          await callOperation(
            getMarbleClient().tables.create,
            compactObject({
              name,
              projectId: await resolveProjectId(options.project),
            }),
          ),
        );
      },
    );

  command
    .command("list")
    .option("--project <project-id>", "Project ID")
    .action(async (options: { project?: string }) => {
      printJson(
        await getMarbleClient().tables.list({
          projectId: await resolveProjectId(options.project),
        }),
      );
    });

  addStandardGet(command, {
    action: (input) => getMarbleClient().tables.get(input),
    noun: "Table",
  });

  command
    .command("update")
    .argument("<id>", "Table ID")
    .option("--name <name>", "Table name")
    .action(
      async (
        id: string,
        options: {
          name?: string;
        },
      ) => {
        const values = compactObject({
          name: options.name,
        });

        requireChanges(values);
        printJson(
          await getMarbleClient().tables.update({
            id,
            values,
          }),
        );
      },
    );

  command
    .command("insert-rows")
    .argument("<id>", "Table ID")
    .requiredOption("--idx <idx>", "Row index")
    .option("--quantity <quantity>", "Quantity", "1")
    .action(
      async (
        id: string,
        options: {
          idx: string;
          quantity?: string;
        },
      ) => {
        printJson(
          await getMarbleClient().tables.insertRows({
            id,
            idx: parseIntegerOption(options.idx, "idx") ?? 0,
            quantity: parseIntegerOption(options.quantity, "quantity") ?? 1,
          }),
        );
      },
    );

  addStandardDelete(command, {
    action: (input) => getMarbleClient().tables.delete(input),
    noun: "Table",
  });

  return command;
}

export function createTablesCommand() {
  const command = createCommand("tables", "Raw table commands");

  addStandardCreate(command, {
    action: (input) => callOperation(getMarbleClient().tables.create, input),
    label: "Table",
  });
  addStandardGet(command, {
    action: (input) => getMarbleClient().tables.get(input),
    noun: "Table",
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().tables.list, input),
    label: "Table",
  });
  addStandardUpdate(command, {
    action: (input) => callOperation(getMarbleClient().tables.update, input),
    label: "Table",
    noun: "Table",
  });
  command
    .command("insert-rows")
    .argument("<id>", "Table ID")
    .requiredOption("--idx <idx>", "Row index")
    .option("--quantity <quantity>", "Quantity", "1")
    .action(
      async (
        id: string,
        options: {
          idx: string;
          quantity?: string;
        },
      ) => {
        printJson(
          await getMarbleClient().tables.insertRows({
            id,
            idx: parseIntegerOption(options.idx, "idx") ?? 0,
            quantity: parseIntegerOption(options.quantity, "quantity") ?? 1,
          }),
        );
      },
    );
  addStandardDelete(command, {
    action: (input) => getMarbleClient().tables.delete(input),
    noun: "Table",
  });

  return command;
}

export function createColumnCommand() {
  const command = createCommand("column", "Column commands");

  command
    .command("create")
    .argument("<name>", "Column name")
    .requiredOption("--table <table-id>", "Table ID")
    .option("--idx <idx>", "Column index")
    .option("--input-template <json>", "Input template JSON")
    .option("--output-schema <json>", "Output schema JSON")
    .option("--program <program-id>", "Program ID")
    .option("--program-version <version-id>", "Program version ID")
    .option("--run-condition <json>", "Run condition JSON")
    .action(
      async (
        name: string,
        options: {
          idx?: string;
          inputTemplate?: string;
          outputSchema?: string;
          program?: string;
          programVersion?: string;
          runCondition?: string;
          table: string;
        },
      ) => {
        printJson(
          await callOperation(
            getMarbleClient().columns.create,
            compactObject({
              idx: parseIntegerOption(options.idx, "idx"),
              inputTemplate: normalizeInputTemplate(options.inputTemplate),
              name,
              outputSchema:
                options.outputSchema === undefined
                  ? undefined
                  : parseJsonValue(options.outputSchema, "output-schema"),
              programVersionId: await resolveProgramVersionId(
                getMarbleClient(),
                {
                  programId: options.program,
                  programVersionId: options.programVersion,
                },
              ),
              runCondition:
                options.runCondition === undefined
                  ? undefined
                  : parseJsonValue(options.runCondition, "run-condition"),
              tableId: options.table,
            }),
          ),
        );
      },
    );

  command
    .command("list")
    .requiredOption("--table <table-id>", "Table ID")
    .action(async (options: { table: string }) => {
      printJson(
        await getMarbleClient().columns.list({
          tableId: options.table,
        }),
      );
    });

  command.command("list-referenceable").action(async () => {
    printJson(await getMarbleClient().columns.listReferenceable({}));
  });

  addStandardGet(command, {
    action: (input) => getMarbleClient().columns.get(input),
    noun: "Column",
  });

  command
    .command("update")
    .argument("<id>", "Column ID")
    .option("--idx <idx>", "Column index")
    .option("--input-template <json>", "Input template JSON")
    .option("--name <name>", "Column name")
    .option("--output-schema <json>", "Output schema JSON")
    .option("--program <program-id>", "Program ID")
    .option("--program-version <version-id>", "Program version ID")
    .option("--run-condition <json>", "Run condition JSON")
    .action(
      async (
        id: string,
        options: {
          idx?: string;
          inputTemplate?: string;
          name?: string;
          outputSchema?: string;
          program?: string;
          programVersion?: string;
          runCondition?: string;
        },
      ) => {
        const programVersionId =
          options.program || options.programVersion
            ? await resolveProgramVersionId(getMarbleClient(), {
                programId: options.program,
                programVersionId: options.programVersion,
              })
            : undefined;
        const values = compactObject({
          idx: parseIntegerOption(options.idx, "idx"),
          inputTemplate:
            options.inputTemplate === undefined
              ? undefined
              : normalizeInputTemplate(options.inputTemplate),
          name: options.name,
          outputSchema:
            options.outputSchema === undefined
              ? undefined
              : parseJsonValue(options.outputSchema, "output-schema"),
          programVersionId,
          runCondition:
            options.runCondition === undefined
              ? undefined
              : parseJsonValue(options.runCondition, "run-condition"),
        });

        requireChanges(values);
        printJson(
          await getMarbleClient().columns.update({
            id,
            values,
          }),
        );
      },
    );

  addStandardDelete(command, {
    action: (input) => getMarbleClient().columns.delete(input),
    noun: "Column",
  });

  const secretCommand = command.command("secret").description("Column secrets");

  secretCommand
    .command("list")
    .argument("<column-id>", "Column ID")
    .action(async (columnId: string) => {
      printJson(
        await getMarbleClient().secretBindings.listColumns({
          columnIds: [
            columnId,
          ],
        }),
      );
    });

  secretCommand
    .command("set")
    .argument("<column-id>", "Column ID")
    .option("--binding <binding...>", "ENV_NAME=<secret-id>")
    .action(
      async (
        columnId: string,
        options: {
          binding?: string[];
        },
      ) => {
        printJson(
          await getMarbleClient().secretBindings.setColumn({
            bindings: parseBindings(options.binding),
            columnId,
          }),
        );
      },
    );

  return command;
}

export function createColumnsCommand() {
  const command = createCommand("columns", "Raw column commands");

  addStandardCreate(command, {
    action: (input) => callOperation(getMarbleClient().columns.create, input),
    label: "Column",
  });
  addStandardGet(command, {
    action: (input) => getMarbleClient().columns.get(input),
    noun: "Column",
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().columns.list, input),
    label: "Column",
  });
  command.command("list-referenceable").action(async () => {
    printJson(await getMarbleClient().columns.listReferenceable({}));
  });
  addStandardUpdate(command, {
    action: (input) => callOperation(getMarbleClient().columns.update, input),
    label: "Column",
    noun: "Column",
  });
  addStandardDelete(command, {
    action: (input) => getMarbleClient().columns.delete(input),
    noun: "Column",
  });

  return command;
}

export function createRowCommand() {
  const command = createCommand("row", "Row commands");

  command
    .command("create")
    .requiredOption("--table <table-id>", "Table ID")
    .option("--count <count>", "Number of rows to insert", "1")
    .option("--idx <idx>", "Insert row index")
    .action(
      async (options: { count?: string; idx?: string; table: string }) => {
        const quantity = parseIntegerOption(options.count, "count") ?? 1;
        const idx =
          parseIntegerOption(options.idx, "idx") ??
          (await getAppendRowIdx(options.table));

        printJson(
          await getMarbleClient().tables.insertRows({
            id: options.table,
            idx,
            quantity,
          }),
        );
      },
    );

  command
    .command("list")
    .requiredOption("--table <table-id>", "Table ID")
    .action(async (options: { table: string }) => {
      printJson(
        await getMarbleClient().rows.list({
          tableId: options.table,
        }),
      );
    });

  addStandardGet(command, {
    action: (input) => getMarbleClient().rows.get(input),
    noun: "Row",
  });

  command
    .command("update")
    .argument("<id>", "Row ID")
    .requiredOption("--idx <idx>", "Row index")
    .action(
      async (
        id: string,
        options: {
          idx: string;
        },
      ) => {
        printJson(
          await getMarbleClient().rows.update({
            id,
            values: {
              idx: parseIntegerOption(options.idx, "idx") ?? 0,
            },
          }),
        );
      },
    );

  addStandardDelete(command, {
    action: (input) => getMarbleClient().rows.delete(input),
    noun: "Row",
  });

  return command;
}

export function createRowsCommand() {
  const command = createCommand("rows", "Raw row commands");

  command
    .command("create")
    .argument("[input]", "Table-owned row insertion JSON")
    .option("--input-file <path>", "Read JSON input from a file")
    .description("Alias for tables.insertRows")
    .action(async (input: string | undefined, options: JsonInputOptions) => {
      const parsedInput = await readInput(input, options, "Row insertion");
      const tableId = parsedInput.tableId;
      const count = parsedInput.count ?? parsedInput.quantity;

      if (typeof tableId !== "string") {
        throw new Error("Row insertion requires tableId.");
      }

      printJson(
        await getMarbleClient().tables.insertRows({
          id: tableId,
          idx:
            typeof parsedInput.idx === "number"
              ? parsedInput.idx
              : await getAppendRowIdx(tableId),
          quantity: typeof count === "number" ? count : 1,
        }),
      );
    });
  addStandardGet(command, {
    action: (input) => getMarbleClient().rows.get(input),
    noun: "Row",
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().rows.list, input),
    label: "Row",
  });
  addStandardUpdate(command, {
    action: (input) => callOperation(getMarbleClient().rows.update, input),
    label: "Row",
    noun: "Row",
  });
  addStandardDelete(command, {
    action: (input) => getMarbleClient().rows.delete(input),
    noun: "Row",
  });

  return command;
}

export function createCellCommand() {
  const command = createCommand("cell", "Cell commands");

  command
    .command("list")
    .option("--column <column-id>", "Column ID")
    .option("--row <row-id>", "Row ID")
    .option("--table <table-id>", "Table ID")
    .action(
      async (options: { column?: string; row?: string; table?: string }) => {
        if (options.table) {
          printJson(await listCellsForTable(options.table));
          return;
        }

        printJson(
          await callOperation(
            getMarbleClient().cells.list,
            parseCellFilter(options),
          ),
        );
      },
    );

  addStandardGet(command, {
    action: (input) => getMarbleClient().cells.get(input),
    noun: "Cell",
  });

  command
    .command("set")
    .argument("<id>", "Cell ID")
    .argument("[value]", "Manual value")
    .option("--clear", "Clear manual input")
    .action(
      async (
        id: string,
        value: string | undefined,
        options: {
          clear?: boolean;
        },
      ) => {
        if (options.clear && value !== undefined) {
          throw new Error("Pass either a value or --clear, not both.");
        }

        printJson(
          await getMarbleClient().cells.setManualValue({
            id,
            value: options.clear ? null : (value ?? ""),
          }),
        );
      },
    );

  command
    .command("run")
    .argument("<id>", "Cell ID")
    .option("--manual-input <value>", "Manual input for this run")
    .action(
      async (
        id: string,
        options: {
          manualInput?: string;
        },
      ) => {
        printJson(
          await getMarbleClient().cells.run({
            id,
            manualInput: options.manualInput,
          }),
        );
      },
    );

  return command;
}

export function createCellsCommand() {
  const command = createCommand("cells", "Raw cell commands");

  addStandardGet(command, {
    action: (input) => getMarbleClient().cells.get(input),
    noun: "Cell",
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().cells.list, input),
    label: "Cell",
  });
  command
    .command("set-manual-value")
    .argument("<id>", "Cell ID")
    .argument("[value]", "Manual value")
    .option("--clear", "Clear manual input")
    .action(
      async (
        id: string,
        value: string | undefined,
        options: {
          clear?: boolean;
        },
      ) => {
        printJson(
          await getMarbleClient().cells.setManualValue({
            id,
            value: options.clear ? null : (value ?? ""),
          }),
        );
      },
    );
  command
    .command("run")
    .argument("<id>", "Cell ID")
    .option("--manual-input <value>", "Manual input for this run")
    .action(
      async (
        id: string,
        options: {
          manualInput?: string;
        },
      ) => {
        printJson(
          await getMarbleClient().cells.run({
            id,
            manualInput: options.manualInput,
          }),
        );
      },
    );

  return command;
}

export function createRunCommand() {
  const command = createCommand("run", "Cell run commands");

  command
    .command("start")
    .argument("[cell-ids...]", "Cell IDs")
    .option("--manual-input <value>", "Manual input for a single cell run")
    .option("--range <range>", "<startCellId>..<endCellId>")
    .action(
      async (
        cellIds: string[],
        options: {
          manualInput?: string;
          range?: string;
        },
      ) => {
        const resolvedCellIds = await resolveRunCellIds(cellIds, options);

        if (options.manualInput !== undefined && resolvedCellIds.length > 1) {
          throw new Error("--manual-input can only be used with one cell.");
        }

        const results = await Promise.all(
          resolvedCellIds.map((id) =>
            getMarbleClient().cells.run({
              id,
              manualInput: options.manualInput,
            }),
          ),
        );

        printJson(results.length === 1 ? results[0] : results);
      },
    );

  return command;
}

export function createProgramCommand() {
  const command = createCommand("program", "Program commands");

  command
    .command("create")
    .argument("<name>", "Program name")
    .option("--initial-version <json>", "Initial version JSON")
    .action(
      async (
        name: string,
        options: {
          initialVersion?: string;
        },
      ) => {
        printJson(
          await callOperation(
            getMarbleClient().programs.create,
            compactObject({
              initialVersion:
                options.initialVersion === undefined
                  ? undefined
                  : parseJsonObject(options.initialVersion, "initial-version"),
              name,
            }),
          ),
        );
      },
    );

  command.command("list").action(async () => {
    printJson(await getMarbleClient().programs.listForEditor({}));
  });

  command
    .command("update")
    .argument("<id>", "Program ID")
    .requiredOption("--name <name>", "Program name")
    .action(
      async (
        id: string,
        options: {
          name: string;
        },
      ) => {
        printJson(
          await getMarbleClient().programs.update({
            id,
            values: {
              name: options.name,
            },
          }),
        );
      },
    );

  command
    .command("upsert")
    .argument("<dir>", "Program directory")
    .action(async (dir: string) => {
      printJson(await upsertProgramDirectory(getMarbleClient(), dir));
    });

  command
    .command("test")
    .argument("<dir>", "Program directory")
    .option("--full-input <json>", "Full run input JSON")
    .option("--input <json>", "Program input JSON")
    .option("--input-file <path>", "Read program input JSON from a file")
    .option("--manual-input <value>", "Manual input value")
    .action(
      async (
        dir: string,
        options: {
          fullInput?: string;
          input?: string;
          inputFile?: string;
          manualInput?: string;
        },
      ) => {
        if (options.fullInput && (options.input || options.inputFile)) {
          throw new Error("Pass either --full-input or --input/--input-file.");
        }

        const upserted = await upsertProgramDirectory(getMarbleClient(), dir);
        const fullInput =
          options.fullInput === undefined
            ? undefined
            : parseJsonObject(options.fullInput, "full-input");
        const inputConfig = fullInput
          ? fullInput.input
          : await readOptionalInput(options.input, options, "input");
        const manualInput =
          options.manualInput ??
          (fullInput &&
          typeof fullInput.cell === "object" &&
          fullInput.cell !== null &&
          "manualInputValue" in fullInput.cell &&
          typeof fullInput.cell.manualInputValue === "string"
            ? fullInput.cell.manualInputValue
            : undefined);

        printJson(
          await getMarbleClient().programVersions.test({
            inputConfig:
              inputConfig && typeof inputConfig === "object"
                ? (inputConfig as Record<string, unknown>)
                : {},
            manualInput,
            programVersionId: upserted.version.id,
          }),
        );
      },
    );

  const secretCommand = command
    .command("secret")
    .description("Program secrets");

  secretCommand
    .command("list")
    .argument("<program-id>", "Program ID")
    .action(async (programId: string) => {
      printJson(
        await getMarbleClient().secretBindings.listPrograms({
          programIds: [
            programId,
          ],
        }),
      );
    });

  secretCommand
    .command("set")
    .argument("<program-id>", "Program ID")
    .option("--binding <binding...>", "ENV_NAME=<secret-id>")
    .action(
      async (
        programId: string,
        options: {
          binding?: string[];
        },
      ) => {
        printJson(
          await getMarbleClient().secretBindings.setProgram({
            bindings: parseBindings(options.binding),
            programId,
          }),
        );
      },
    );

  return command;
}

export function createProgramsCommand() {
  const command = createCommand("programs", "Raw program commands");

  addStandardCreate(command, {
    action: (input) => callOperation(getMarbleClient().programs.create, input),
    label: "Program",
  });
  command.command("list").action(async () => {
    printJson(await getMarbleClient().programs.listForEditor({}));
  });
  command.command("list-for-editor").action(async () => {
    printJson(await getMarbleClient().programs.listForEditor({}));
  });
  addStandardUpdate(command, {
    action: (input) => callOperation(getMarbleClient().programs.update, input),
    label: "Program",
    noun: "Program",
  });

  return command;
}

export function createProgramVersionsCommand() {
  const command = createCommand(
    "program-versions",
    "Raw program version commands",
  ).alias("programVersions");

  addStandardCreate(command, {
    action: (input) =>
      callOperation(getMarbleClient().programVersions.create, input),
    label: "Program version",
  });
  addStandardUpdate(command, {
    action: (input) =>
      callOperation(getMarbleClient().programVersions.update, input),
    label: "Program version",
    noun: "Program version",
  });
  addInputFileOption(
    command
      .command("test")
      .argument("<program-version-id>", "Program version ID")
      .argument("[input]", "Program version test JSON"),
  ).action(
    async (
      programVersionId: string,
      input: string | undefined,
      options: JsonInputOptions,
    ) => {
      const parsedInput = await readInput(input, options, "Program test");

      printJson(
        await getMarbleClient().programVersions.test({
          ...parsedInput,
          programVersionId,
        } as {
          inputConfig: Record<string, unknown>;
          manualInput?: string;
          programVersionId: string;
        }),
      );
    },
  );

  return command;
}

export function createProgramFilesCommand() {
  const command = createCommand(
    "program-files",
    "Raw program file commands",
  ).alias("programFiles");

  addStandardCreate(command, {
    action: (input) =>
      callOperation(getMarbleClient().programFiles.create, input),
    label: "Program file",
  });
  addStandardGet(command, {
    action: (input) => getMarbleClient().programFiles.get(input),
    noun: "Program file",
  });
  addStandardList(command, {
    action: (input) =>
      callOperation(getMarbleClient().programFiles.list, input),
    label: "Program file",
  });
  addInputFileOption(
    command
      .command("sync-for-version")
      .argument("<version-id>", "Program version ID")
      .argument("[files]", "Files JSON array"),
  ).action(
    async (
      versionId: string,
      files: string | undefined,
      options: JsonInputOptions,
    ) => {
      const parsedFiles = options.inputFile
        ? await readJsonFile(options.inputFile, "Program files")
        : files === undefined
          ? undefined
          : parseJsonValue(files, "Program files");

      if (!Array.isArray(parsedFiles)) {
        throw new Error("Program files input must be a JSON array.");
      }

      printJson(
        await getMarbleClient().programFiles.syncForVersion({
          files: parsedFiles as Array<{
            content: string;
            filename: string;
            filetype: "Json" | "Markdown" | "TypeScript";
          }>,
          versionId,
        }),
      );
    },
  );
  addStandardUpdate(command, {
    action: (input) =>
      callOperation(getMarbleClient().programFiles.update, input),
    label: "Program file",
    noun: "Program file",
  });
  addStandardDelete(command, {
    action: (input) => getMarbleClient().programFiles.delete(input),
    noun: "Program file",
  });

  return command;
}

export function createSourceCommand() {
  const command = createCommand("source", "Source commands");

  command
    .command("create")
    .argument("[name]", "Source name")
    .option("--payload-schema <json>", "Payload schema JSON")
    .option("--project <project-id>", "Project ID")
    .action(
      async (
        name: string | undefined,
        options: {
          payloadSchema?: string;
          project?: string;
        },
      ) => {
        printJson(
          await callOperation(
            getMarbleClient().sources.create,
            compactObject({
              name,
              payloadSchema:
                options.payloadSchema === undefined
                  ? undefined
                  : parseJsonValue(options.payloadSchema, "payload-schema"),
              projectId: await resolveProjectId(options.project),
            }),
          ),
        );
      },
    );

  command
    .command("list")
    .option("--project <project-id>", "Project ID")
    .action(async (options: { project?: string }) => {
      printJson(
        await getMarbleClient().sources.list({
          projectId: await resolveProjectId(options.project),
        }),
      );
    });

  addStandardGet(command, {
    action: (input) => getMarbleClient().sources.get(input),
    noun: "Source",
  });

  command
    .command("update")
    .argument("<id>", "Source ID")
    .option("--name <name>", "Source name")
    .option("--payload-schema <json>", "Payload schema JSON")
    .action(
      async (
        id: string,
        options: {
          name?: string;
          payloadSchema?: string;
        },
      ) => {
        const values = compactObject({
          name: options.name,
          payloadSchema:
            options.payloadSchema === undefined
              ? undefined
              : parseJsonValue(options.payloadSchema, "payload-schema"),
        });

        requireChanges(values);
        printJson(
          await getMarbleClient().sources.update({
            id,
            values,
          }),
        );
      },
    );

  addStandardDelete(command, {
    action: (input) => getMarbleClient().sources.delete(input),
    noun: "Source",
  });

  return command;
}

export function createSourcesCommand() {
  const command = createCommand("sources", "Raw source commands");

  addStandardCreate(command, {
    action: (input) => callOperation(getMarbleClient().sources.create, input),
    label: "Source",
  });
  addStandardGet(command, {
    action: (input) => getMarbleClient().sources.get(input),
    noun: "Source",
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().sources.list, input),
    label: "Source",
  });
  addStandardUpdate(command, {
    action: (input) => callOperation(getMarbleClient().sources.update, input),
    label: "Source",
    noun: "Source",
  });
  addStandardDelete(command, {
    action: (input) => getMarbleClient().sources.delete(input),
    noun: "Source",
  });

  return command;
}

export function createSourceEventCommand() {
  const command = createCommand("source-event", "Source event commands");

  command
    .command("create")
    .requiredOption("--source <source-id>", "Source ID")
    .requiredOption("--payload <json>", "Raw payload JSON")
    .action(async (options: { payload: string; source: string }) => {
      printJson(
        await getMarbleClient().sourceEvents.create({
          rawPayload: parseJsonValue(options.payload, "payload"),
          sourceId: options.source,
        }),
      );
    });

  command
    .command("list")
    .option("--limit <limit>", "Result limit")
    .option("--project <project-id>", "Project ID")
    .option("--source <source-id>", "Source ID")
    .action(
      async (options: {
        limit?: string;
        project?: string;
        source?: string;
      }) => {
        printJson(
          await callOperation(getMarbleClient().sourceEvents.list, {
            ...parseSourceFilter(options),
            limit: parseIntegerOption(options.limit, "limit"),
          }),
        );
      },
    );

  addStandardGet(command, {
    action: (input) => getMarbleClient().sourceEvents.get(input),
    noun: "Source event",
  });

  return command;
}

export function createSourceEventsCommand() {
  const command = createCommand(
    "source-events",
    "Raw source event commands",
  ).alias("sourceEvents");

  addStandardCreate(command, {
    action: (input) =>
      callOperation(getMarbleClient().sourceEvents.create, input),
    label: "Source event",
  });
  addStandardGet(command, {
    action: (input) => getMarbleClient().sourceEvents.get(input),
    noun: "Source event",
  });
  addStandardList(command, {
    action: (input) =>
      callOperation(getMarbleClient().sourceEvents.list, input),
    label: "Source event",
  });

  return command;
}

export function createPipeCommand() {
  const command = createCommand("pipe", "Pipe commands");

  command
    .command("create")
    .option("--mappings <json>", "Pipe mappings JSON")
    .option("--mappings-file <path>", "Read pipe mappings JSON from a file")
    .requiredOption("--source <source-id>", "Source ID")
    .requiredOption("--table <table-id>", "Table ID")
    .action(
      async (options: {
        mappings?: string;
        mappingsFile?: string;
        source: string;
        table: string;
      }) => {
        printJson(
          await callOperation(
            getMarbleClient().pipes.create,
            compactObject({
              mappings: await readJsonOption({
                file: options.mappingsFile,
                label: "mappings",
                value: options.mappings,
              }),
              sourceId: options.source,
              tableId: options.table,
            }),
          ),
        );
      },
    );

  command
    .command("list")
    .option("--source <source-id>", "Source ID")
    .option("--table <table-id>", "Table ID")
    .action(async (options: { source?: string; table?: string }) => {
      printJson(
        await callOperation(
          getMarbleClient().pipes.list,
          parsePipeFilter(options),
        ),
      );
    });

  addStandardGet(command, {
    action: (input) => getMarbleClient().pipes.get(input),
    noun: "Pipe",
  });

  command
    .command("update")
    .argument("<id>", "Pipe ID")
    .option("--mappings <json>", "Pipe mappings JSON")
    .option("--mappings-file <path>", "Read pipe mappings JSON from a file")
    .option("--source <source-id>", "Source ID")
    .option("--table <table-id>", "Table ID")
    .action(
      async (
        id: string,
        options: {
          mappings?: string;
          mappingsFile?: string;
          source?: string;
          table?: string;
        },
      ) => {
        const values = compactObject({
          mappings: await readJsonOption({
            file: options.mappingsFile,
            label: "mappings",
            value: options.mappings,
          }),
          sourceId: options.source,
          tableId: options.table,
        });

        requireChanges(values);
        printJson(
          await callOperation(getMarbleClient().pipes.update, {
            id,
            values,
          }),
        );
      },
    );

  addStandardDelete(command, {
    action: (input) => getMarbleClient().pipes.delete(input),
    noun: "Pipe",
  });

  return command;
}

export function createPipesCommand() {
  const command = createCommand("pipes", "Raw pipe commands");

  addStandardCreate(command, {
    action: (input) => callOperation(getMarbleClient().pipes.create, input),
    label: "Pipe",
  });
  addStandardGet(command, {
    action: (input) => getMarbleClient().pipes.get(input),
    noun: "Pipe",
  });
  addStandardList(command, {
    action: (input) => callOperation(getMarbleClient().pipes.list, input),
    label: "Pipe",
  });
  addStandardUpdate(command, {
    action: (input) => callOperation(getMarbleClient().pipes.update, input),
    label: "Pipe",
    noun: "Pipe",
  });
  addStandardDelete(command, {
    action: (input) => getMarbleClient().pipes.delete(input),
    noun: "Pipe",
  });

  return command;
}

export function createSecretBindingsCommand() {
  const command = createCommand(
    "secret-bindings",
    "Raw secret binding commands",
  ).alias("secretBindings");

  command
    .command("list-programs")
    .argument("<program-ids...>", "Program IDs")
    .action(async (programIds: string[]) => {
      printJson(
        await getMarbleClient().secretBindings.listPrograms({
          programIds,
        }),
      );
    });

  command
    .command("list-columns")
    .argument("<column-ids...>", "Column IDs")
    .action(async (columnIds: string[]) => {
      printJson(
        await getMarbleClient().secretBindings.listColumns({
          columnIds,
        }),
      );
    });

  command
    .command("set-program")
    .argument("<program-id>", "Program ID")
    .option("--binding <binding...>", "ENV_NAME=<secret-id>")
    .action(
      async (
        programId: string,
        options: {
          binding?: string[];
        },
      ) => {
        printJson(
          await getMarbleClient().secretBindings.setProgram({
            bindings: parseBindings(options.binding),
            programId,
          }),
        );
      },
    );

  command
    .command("set-column")
    .argument("<column-id>", "Column ID")
    .option("--binding <binding...>", "ENV_NAME=<secret-id>")
    .action(
      async (
        columnId: string,
        options: {
          binding?: string[];
        },
      ) => {
        printJson(
          await getMarbleClient().secretBindings.setColumn({
            bindings: parseBindings(options.binding),
            columnId,
          }),
        );
      },
    );

  return command;
}

export function createEventCommand() {
  const command = createCommand("event", "Event commands");

  command
    .command("list")
    .option("--exclude-source <source...>", "Event sources to exclude")
    .option("--limit <limit>", "Result limit")
    .action(async (options: { excludeSource?: string[]; limit?: string }) => {
      printJson(
        await callOperation(
          getMarbleClient().events.listForCurrentUser,
          compactObject({
            excludeSources: options.excludeSource,
            limit: parseIntegerOption(options.limit, "limit"),
          }),
        ),
      );
    });

  command
    .command("resolve-targets")
    .option("--column <column-id...>", "Column IDs")
    .option("--program-version <program-version-id...>", "Program version IDs")
    .option("--row <row-id...>", "Row IDs")
    .action(
      async (options: {
        column?: string[];
        programVersion?: string[];
        row?: string[];
      }) => {
        printJson(
          await getMarbleClient().events.resolveTargets(
            compactObject({
              columnIds: options.column,
              programVersionIds: options.programVersion,
              rowIds: options.row,
            }),
          ),
        );
      },
    );

  return command;
}

export function createEventsCommand() {
  const command = createCommand("events", "Raw event commands");

  addStandardList(command, {
    action: (input) =>
      callOperation(getMarbleClient().events.listForCurrentUser, input),
    label: "Event",
  });
  command
    .command("list-for-current-user")
    .argument("[input]", "Event filter JSON")
    .option("--input-file <path>", "Read JSON input from a file")
    .action(async (input: string | undefined, options: JsonInputOptions) => {
      printJson(
        await callOperation(
          getMarbleClient().events.listForCurrentUser,
          await readOptionalInput(input, options, "Event"),
        ),
      );
    });
  addInputFileOption(
    command.command("resolve-targets").argument("[input]", "Event target JSON"),
  ).action(async (input: string | undefined, options: JsonInputOptions) => {
    printJson(
      await callOperation(
        getMarbleClient().events.resolveTargets,
        await readInput(input, options, "Event targets"),
      ),
    );
  });

  return command;
}

export function createSidebarCommand() {
  const command = createCommand("sidebar", "Sidebar aggregate commands");

  command.command("get-data").action(async () => {
    printJson(await getMarbleClient().sidebar.getData({}));
  });

  return command;
}
