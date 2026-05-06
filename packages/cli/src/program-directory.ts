import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import type { MarbleClient } from "@marble/sdk";
import { parseJsonObject, readJsonFile, readTextFile } from "./json";

type ProgramFileType = "Json" | "Markdown" | "TypeScript";

type ProgramDirectoryFile = {
  content: string;
  filename: string;
  filetype: ProgramFileType;
};

type ProgramDirectory = {
  files: ProgramDirectoryFile[];
  inputSchema: unknown;
  name: string;
  outputConfig: unknown;
  secretConfig: unknown[];
};

type ProgramEditorData = Awaited<
  ReturnType<MarbleClient["programs"]["listForEditor"]>
>;
type EditorProgram = ProgramEditorData["programs"][number];
type EditorProgramVersion = ProgramEditorData["programVersions"][number];

function getFileType(filename: string): ProgramFileType {
  if (filename.endsWith(".json")) {
    return "Json";
  }

  if (filename.endsWith(".md")) {
    return "Markdown";
  }

  return "TypeScript";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readProgramManifest(content: string) {
  const manifest = parseJsonObject(content, "package.json");

  if (typeof manifest.name !== "string" || manifest.name.trim().length === 0) {
    throw new Error("Program package.json must contain a non-empty name.");
  }

  const marble = isRecord(manifest.marble) ? manifest.marble : undefined;

  return {
    name: manifest.name,
    secrets: Array.isArray(marble?.secrets) ? marble.secrets : [],
  };
}

async function readProgramFiles(dir: string) {
  const entries = await readdir(dir, {
    withFileTypes: true,
  });

  return Promise.all(
    entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => ({
        content: await readTextFile(join(dir, entry.name)),
        filename: entry.name,
        filetype: getFileType(entry.name),
      })),
  );
}

export async function readProgramDirectory(
  dir: string,
): Promise<ProgramDirectory> {
  const packageJson = await readTextFile(join(dir, "package.json"));
  const manifest = readProgramManifest(packageJson);

  return {
    files: await readProgramFiles(dir),
    inputSchema: await readJsonFile(join(dir, "input-schema.json")),
    name: manifest.name || basename(dir),
    outputConfig: await readJsonFile(join(dir, "output-config.json")),
    secretConfig: manifest.secrets,
  };
}

function listVersionsForProgram(
  editorData: ProgramEditorData,
  programId: string,
) {
  return editorData.programVersions.filter(
    (version) => version.programId === programId,
  );
}

function getDraftVersion(
  editorData: ProgramEditorData,
  programId: string,
): EditorProgramVersion | undefined {
  return listVersionsForProgram(editorData, programId)
    .filter((version) => version.publishedAt === null)
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    )[0];
}

function getLatestPublishedVersion(
  editorData: ProgramEditorData,
  programId: string,
): EditorProgramVersion | undefined {
  return listVersionsForProgram(editorData, programId)
    .filter(
      (version) => version.publishedAt !== null && version.version !== null,
    )
    .sort((left, right) => (right.version ?? 0) - (left.version ?? 0))[0];
}

function findWritableProgram(
  editorData: ProgramEditorData,
  name: string,
): EditorProgram | undefined {
  return editorData.programs.find(
    (program) => program.name === name && !program.firstParty,
  );
}

export async function resolveProgramVersionId(
  marble: MarbleClient,
  options: {
    programId?: string;
    programVersionId?: string;
  },
) {
  if (options.programId && options.programVersionId) {
    throw new Error("Pass either --program or --program-version, not both.");
  }

  if (options.programVersionId) {
    return options.programVersionId;
  }

  if (!options.programId) {
    throw new Error("Column commands require --program-version or --program.");
  }

  const editorData = await marble.programs.listForEditor({});
  const version =
    getLatestPublishedVersion(editorData, options.programId) ??
    getDraftVersion(editorData, options.programId);

  if (!version) {
    throw new Error(`Program ${options.programId} has no usable version.`);
  }

  return version.id;
}

export async function upsertProgramDirectory(
  marble: MarbleClient,
  dir: string,
) {
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
          inputSchema: source.inputSchema,
          outputConfig: source.outputConfig,
          secretConfig: source.secretConfig,
        },
      })
    : await marble.programVersions.create({
        inputSchema: source.inputSchema,
        outputConfig: source.outputConfig,
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
}
