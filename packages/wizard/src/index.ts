import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wizardSkillUrl = new URL("./SKILL.md", import.meta.url);

export const wizardSkillPath = (): string => fileURLToPath(wizardSkillUrl);

export const wizardSkillContent = (): string =>
  readFileSync(wizardSkillUrl, "utf8");
