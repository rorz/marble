import { PROGRAM_CONFIG_FILENAME } from "@marble/contracts";
import { stringifyPretty } from "@marble/lib/json";
import type { EditableProgramFile, ProgramFile } from "./types";

export const getFileAccent = (filename: string) => {
  if (filename.endsWith(".json") || filename.endsWith(".jsonc")) {
    return "text-amber-600";
  }

  if (filename.endsWith(".md")) {
    return "text-zinc-500";
  }

  return "text-sky-600";
};

export const getProgramFiletype = (
  filename: string,
): EditableProgramFile["filetype"] => {
  if (filename.endsWith(".json") || filename.endsWith(".jsonc")) {
    return "Json";
  }

  if (filename.endsWith(".md")) {
    return "Markdown";
  }

  return "TypeScript";
};

export const isFileDrag = (dataTransfer: DataTransfer | null | undefined) => {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
};

export const getSuggestedFileName = (files: EditableProgramFile[]) => {
  const preferredFilenames = [
    "utils.ts",
    "helpers.ts",
    "config.json",
    "notes.md",
  ];

  for (const candidate of preferredFilenames) {
    if (!files.some((file) => file.filename === candidate)) {
      return candidate;
    }
  }

  let suffix = 2;

  while (files.some((file) => file.filename === `file-${suffix}.ts`)) {
    suffix += 1;
  }

  return `file-${suffix}.ts`;
};

export const normalizeProgramFiles = (
  programFiles: ProgramFile[] | null | undefined,
): EditableProgramFile[] => {
  return (programFiles ?? []).map((file) => ({
    content: file.content,
    filename: file.filename,
    filetype: file.filetype,
  }));
};

export const createDefaultDraftFiles = (): EditableProgramFile[] => {
  return [
    {
      content: `${stringifyPretty({
        dependencies: {},
        name: "untitled-program",
        type: "module",
      })}\n`,
      filename: "package.json",
      filetype: "Json",
    },
    {
      content: `${stringifyPretty({
        inputSchema: {
          properties: {
            param1: {
              type: "string",
            },
          },
          type: "object",
        },
        outputConfig: {
          schema: {
            type: "object",
          },
        },
      })}\n`,
      filename: PROGRAM_CONFIG_FILENAME,
      filetype: "Json",
    },
    {
      content:
        "export default async function run({ input }) {\n  return { ok: true, value: input };\n}",
      filename: "main.ts",
      filetype: "TypeScript",
    },
  ];
};
