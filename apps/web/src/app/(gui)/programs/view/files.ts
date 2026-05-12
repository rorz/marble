import type { EditableProgramFile, ProgramFile } from "./types";

export function getFileAccent(filename: string) {
  if (filename.endsWith(".json")) {
    return "text-amber-600";
  }

  if (filename.endsWith(".md")) {
    return "text-zinc-500";
  }

  return "text-sky-600";
}

export function getProgramFiletype(
  filename: string,
): EditableProgramFile["filetype"] {
  if (filename.endsWith(".json")) {
    return "Json";
  }

  if (filename.endsWith(".md")) {
    return "Markdown";
  }

  return "TypeScript";
}

export function isFileDrag(dataTransfer: DataTransfer | null | undefined) {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
}

export function getSuggestedFileName(files: EditableProgramFile[]) {
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
}

export function normalizeProgramFiles(
  programFiles: ProgramFile[] | null | undefined,
): EditableProgramFile[] {
  return (programFiles ?? []).map((file) => ({
    content: file.content,
    filename: file.filename,
    filetype: file.filetype,
  }));
}

export function createDefaultDraftFiles(): EditableProgramFile[] {
  return [
    {
      content:
        "export default async function run(input) {\n  return { ok: true, value: input };\n}",
      filename: "main.ts",
      filetype: "TypeScript",
    },
  ];
}
