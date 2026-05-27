import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  PROGRAM_CONFIG_FILENAME,
  parseProgramConfigFileContent,
} from "@marble/contracts";
import type { MarbleClient } from "@marble/sdk";
import { Command } from "commander";
import { getMarbleClient } from "./client";
import { type JsonValue, printError, printJson, readInput } from "./io";

/**
 * `program-dir` is the one CLI affordance that is *not* a contract pass-through.
 *
 * Programs are a Marble first-class resource, but on disk they are a
 * directory of files. Composing that directory into the API requires
 * sequencing multiple contract calls (find or create program, find or
 * create draft version, sync files, publish). That coordination is the
 * only thing this command does, and it lives here because filesystem I/O
 * has no natural home on the SDK or the contract.
 *
 * Everything else in the CLI is a single pass-through to one contract
 * operation. If you find yourself adding a second non-passthrough
 * command, stop and reconsider.
 */
type ProgramFileType = "Json" | "Markdown" | "TypeScript";

type ProgramDirectoryFile = {
  content: string;
  filename: string;
  filetype: ProgramFileType;
};

type ProgramDirectory = {
  files: ProgramDirectoryFile[];
  name: string;
  secretConfig: JsonValue[];
};

type ProgramEditorData = Awaited<
  ReturnType<MarbleClient["programs"]["listForEditor"]>
>;
type EditorProgram = ProgramEditorData["programs"][number];
type EditorProgramVersion = ProgramEditorData["programVersions"][number];

const getFileType = (filename: string): ProgramFileType => {
  if (filename.endsWith(".json") || filename.endsWith(".jsonc")) {
    return "Json";
  }

  if (filename.endsWith(".md")) {
    return "Markdown";
  }

  return "TypeScript";
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readJsonFile = async (path: string) => {
  return JSON.parse(await readFile(path, "utf8")) as JsonValue;
};

const readProgramManifest = async (dir: string) => {
  const manifest = (await readJsonFile(join(dir, "package.json"))) as Record<
    string,
    unknown
  > | null;

  if (
    !manifest ||
    typeof manifest.name !== "string" ||
    manifest.name.trim() === ""
  ) {
    throw new Error("Program package.json must contain a non-empty name.");
  }

  const marble = isRecord(manifest.marble) ? manifest.marble : undefined;

  return {
    name: manifest.name,
    secrets: Array.isArray(marble?.secrets)
      ? (marble.secrets as JsonValue[])
      : [],
  };
};

const readProgramFiles = async (dir: string) => {
  const entries = await readdir(dir, {
    withFileTypes: true,
  });

  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => ({
        content: await readFile(join(dir, entry.name), "utf8"),
        filename: entry.name,
        filetype: getFileType(entry.name),
      })),
  );
};

const readProgramDirectory = async (dir: string): Promise<ProgramDirectory> => {
  const manifest = await readProgramManifest(dir);
  const files = await readProgramFiles(dir);
  const configFile = files.find(
    (file) => file.filename === PROGRAM_CONFIG_FILENAME,
  );

  if (!configFile) {
    throw new Error(
      `Program directory must contain ${PROGRAM_CONFIG_FILENAME}.`,
    );
  }

  parseProgramConfigFileContent(configFile.content);

  return {
    files,
    name: manifest.name || basename(dir),
    secretConfig: manifest.secrets,
  };
};

const listVersionsForProgram = (
  editorData: ProgramEditorData,
  programId: string,
) => {
  return editorData.programVersions.filter(
    (version) => version.programId === programId,
  );
};

const getDraftVersion = (
  editorData: ProgramEditorData,
  programId: string,
): EditorProgramVersion | undefined => {
  return listVersionsForProgram(editorData, programId)
    .filter((version) => version.publishedAt === null)
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    )[0];
};

const findWritableProgram = (
  editorData: ProgramEditorData,
  name: string,
): EditorProgram | undefined => {
  return editorData.programs.find(
    (program) => program.name === name && !program.firstParty,
  );
};

const upsertProgramDirectory = async (marble: MarbleClient, dir: string) => {
  const source = await readProgramDirectory(dir);
  const editorData = await marble.programs.listForEditor({});
  const existingProgram = findWritableProgram(editorData, source.name);
  const program =
    existingProgram ??
    (await marble.programs.create({
      name: source.name,
    }));
  const draft =
    existingProgram === undefined
      ? undefined
      : getDraftVersion(editorData, existingProgram.id);
  const draftVersion = draft
    ? await marble.programVersions.update({
        id: draft.id,
        values: {
          secretConfig: source.secretConfig,
        },
      })
    : await marble.programVersions.create({
        programId: program.id,
        secretConfig: source.secretConfig,
      });
  const files = await marble.programFiles.syncForVersion({
    files: source.files,
    versionId: draftVersion.id,
  });
  const version = await marble.programVersions.update({
    id: draftVersion.id,
    values: {
      publish: true,
    },
  });

  return {
    files,
    program,
    version,
  };
};

const asInputConfig = (value: unknown): Record<string, JsonValue> => {
  if (!isRecord(value)) {
    return {};
  }

  return value as Record<string, JsonValue>;
};

export const registerProgramDir = (root: Command) => {
  const command = new Command("program-dir").description(
    "Filesystem helper for syncing a local program directory to Marble. This is the one CLI subcommand that is not a contract pass-through.",
  );

  command
    .command("upsert")
    .argument(
      "<directory>",
      `Path to a program directory (must contain package.json, main.ts, ${PROGRAM_CONFIG_FILENAME})`,
    )
    .description(
      "Upsert the program directory and publish a new version. Returns the program, version, and synced files.",
    )
    .action(async (dir: string) => {
      try {
        const result = await upsertProgramDirectory(getMarbleClient(), dir);
        printJson(result);
      } catch (error) {
        printError(error);
        process.exit(1);
      }
    });

  command
    .command("test")
    .argument("<directory>", "Path to a program directory")
    .argument(
      "[input]",
      "Test input JSON matching programVersions.test (programVersionId is set automatically). Pass '-' to read from stdin.",
    )
    .option(
      "--input-file <path>",
      "Read test input JSON from a file (or '-' for stdin)",
    )
    .description(
      "Upsert the program directory, then call programVersions.test against the new version.",
    )
    .action(
      async (
        dir: string,
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
          const marble = getMarbleClient();
          const upserted = await upsertProgramDirectory(marble, dir);
          const record = isRecord(parsed) ? parsed : {};
          const inputConfig = asInputConfig(record.inputConfig);
          const manualInput =
            typeof record.manualInput === "string"
              ? record.manualInput
              : undefined;
          const result = await marble.programVersions.test({
            inputConfig,
            manualInput,
            programVersionId: upserted.version.id,
          });

          printJson(result);
        } catch (error) {
          printError(error);
          process.exit(1);
        }
      },
    );

  root.addCommand(command);
};
