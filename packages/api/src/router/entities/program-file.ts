import {
  parseProgramConfigFromFiles,
  parseProgramManifestFileContent,
} from "@marble/contracts";
import { os } from "../../server";
import type { RouterResourcePart } from "../../types";
import { composeResourceRouter } from "../compose";

const assertValidProgramManifest = (
  files: Array<{
    content: string;
    filename: string;
  }>,
) => {
  const manifestFile = files.find((file) => file.filename === "package.json");

  if (!manifestFile) {
    return;
  }

  try {
    parseProgramManifestFileContent(manifestFile.content);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `package.json is invalid: ${error.message}`
        : "package.json is invalid.",
    );
  }
};

const assertValidProgramConfig = (
  files: Array<{
    content: string;
    filename: string;
  }>,
) => {
  try {
    parseProgramConfigFromFiles(files);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `marbleconfig.jsonc is invalid: ${error.message}`
        : "marbleconfig.jsonc is invalid.",
    );
  }
};

export const programFileRouter = {
  ...composeResourceRouter("programFiles"),
  syncForVersion: os.programFiles.syncForVersion.handler(
    ({ context, input }) => {
      assertValidProgramManifest(input.files);
      assertValidProgramConfig(input.files);
      return context.store.programFiles.syncForVersion(input);
    },
  ),
} satisfies RouterResourcePart<"programFiles">;
