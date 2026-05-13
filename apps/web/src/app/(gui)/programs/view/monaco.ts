import type { EditableProgramFile, MonacoLanguage } from "./types";

export const getMonacoLanguage = (
  file: EditableProgramFile,
): MonacoLanguage => {
  if (file.filetype === "Json" || file.filename.endsWith(".json")) {
    return "json";
  }

  if (file.filetype === "Markdown" || file.filename.endsWith(".md")) {
    return "markdown";
  }

  return "typescript";
};

export const getMonacoModelPath = (
  programId: string | null,
  filename: string,
) => {
  return `inmemory://model/${programId ?? "__draft__"}/${filename}`;
};
