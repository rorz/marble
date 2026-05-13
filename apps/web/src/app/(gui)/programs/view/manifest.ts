import { parseProgramManifestFileContent } from "@marble/contracts";
import type { EditableProgramFile } from "./types";

export const getProgramPackageManifestState = (
  files: EditableProgramFile[],
) => {
  const manifestFile = files.find((file) => file.filename === "package.json");

  if (!manifestFile) {
    return {
      error: null,
    };
  }

  try {
    parseProgramManifestFileContent(manifestFile.content);

    return {
      error: null,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
