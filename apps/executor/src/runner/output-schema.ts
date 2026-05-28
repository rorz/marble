import type { JsonValue } from "@marble/contracts";
import type { ProgramVersionTestData } from "@marble/store";

export const getProgramVersionTestOutputSchema = (
  versionData: Pick<ProgramVersionTestData, "programConfig">,
): JsonValue => {
  return versionData.programConfig.outputConfig.schema as JsonValue;
};
