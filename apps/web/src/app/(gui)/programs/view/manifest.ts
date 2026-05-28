import { parseProgramManifestFileContent } from "@marble/contracts";
import { getErrorMessage } from "@marble/lib/result";
import type { EditableProgramFile } from "./types";

export const getProgramPackageManifestState = (
  files: EditableProgramFile[],
) => {
  const manifestFile = files.find((file) => file.filename === "package.json");

  if (!manifestFile) {
    return {
      error: "Program files must include package.json.",
    };
  }

  try {
    parseProgramManifestFileContent(manifestFile.content);

    return {
      error: null,
    };
  } catch (error) {
    return {
      error: getErrorMessage(error),
    };
  }
};
