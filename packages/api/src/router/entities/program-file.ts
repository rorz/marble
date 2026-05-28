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
    throw new Error("Program files must include package.json.");
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

const assertRequiredRuntimeFiles = (
  files: Array<{
    filename: string;
  }>,
) => {
  if (!files.some((file) => file.filename === "main.ts")) {
    throw new Error("Program files must include main.ts.");
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
      assertRequiredRuntimeFiles(input.files);
      assertValidProgramManifest(input.files);
      assertValidProgramConfig(input.files);
      return context.store.programFiles.syncForVersion(input);
    },
  ),
} satisfies RouterResourcePart<"programFiles">;
