#!/usr/bin/env node

import { MarbleClient } from "@marble/sdk";
import { Command } from "commander";
import dotenv from "dotenv";
import { readCliEnv } from "./env";

dotenv.config();

let marble: MarbleClient | undefined;

function getMarbleClient() {
  marble ??= (() => {
    const env = readCliEnv(process.env);
    return new MarbleClient({
      apiKey: env.MARBLE_API_KEY,
      apiUrl: env.MARBLE_API_URL,
    });
  })();

  return marble;
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function parseFolderPath(input?: string) {
  if (input === undefined) {
    return undefined;
  }

  const value = JSON.parse(input) as unknown;

  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error("Folder path must be a JSON array of strings.");
  }

  return value;
}

function requireChanges(value: Record<string, unknown>) {
  if (Object.keys(compactObject(value)).length === 0) {
    throw new Error("Update requires at least one changed value.");
  }
}

export const rootCommand = new Command();
const projectsCommand = new Command("projects");

rootCommand.name("marble").description("Marble CLI");

projectsCommand
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
      const project = await getMarbleClient().projects.create({
        folderPath: parseFolderPath(options.folderPath),
        name,
      });

      printJson(project);
    },
  );

projectsCommand
  .command("delete")
  .argument("<project-id>", "Project ID")
  .action(async (projectId: string) => {
    const project = await getMarbleClient().projects.delete({
      projectId,
    });

    printJson(project);
  });

projectsCommand
  .command("get")
  .argument("<project-id>", "Project ID")
  .action(async (projectId: string) => {
    const project = await getMarbleClient().projects.get({
      projectId,
    });

    printJson(project);
  });

projectsCommand.command("get-most-recent").action(async () => {
  const project = await getMarbleClient().projects.getMostRecentProject();

  printJson(project);
});

projectsCommand
  .command("list")
  .option("--name <name>", "Filter projects by exact name")
  .action(async (options: { name?: string }) => {
    const projects = await getMarbleClient().projects.list(
      compactObject({
        name: options.name,
      }),
    );

    printJson(projects);
  });

projectsCommand
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

      const project = await getMarbleClient().projects.update({
        projectId,
        values,
      });

      printJson(project);
    },
  );

rootCommand.addCommand(projectsCommand);

await rootCommand.parseAsync(process.argv);
