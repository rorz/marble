import {
  type ProgramConfig,
  parseProgramConfigFromFiles,
} from "@marble/contracts";
import type { SupabaseClient, Tables } from "@marble/supabase";

type ProgramConfigFile = Pick<Tables<"program_file">, "content" | "filename">;

export const readProgramConfigFromFiles = (
  files: ProgramConfigFile[],
): ProgramConfig => {
  return parseProgramConfigFromFiles(files);
};

export const loadProgramConfigForVersion = async (
  supabase: SupabaseClient,
  versionId: string,
): Promise<ProgramConfig> => {
  const { data, error } = await supabase
    .from("program_file")
    .select("content, filename")
    .eq("version_id", versionId);

  if (error) {
    throw new Error(error.message);
  }

  return readProgramConfigFromFiles(data ?? []);
};

export const getProgramConfigOutputSchema = (config: ProgramConfig) => {
  return config.outputConfig.schema;
};

export const programConfigAllowsManualInput = (config: ProgramConfig) => {
  return config.outputConfig.flags.allowManualInput === true;
};
