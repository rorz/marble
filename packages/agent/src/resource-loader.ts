import { dirname } from "node:path";
import {
  createSyntheticSourceInfo,
  DefaultResourceLoader,
  type Skill,
} from "@earendil-works/pi-coding-agent";
import { wizardSkillPath } from "@marble/wizard";
import type { MarbleAgentVariant } from "./models";
import { buildSystemPrompt } from "./prompt";

const buildMarbleSkill = (): Skill => {
  const skillPath = wizardSkillPath();
  return {
    baseDir: dirname(skillPath),
    description:
      "Marble platform agent. Operates as the user's Agent profile via Marble SDK tools.",
    disableModelInvocation: false,
    filePath: skillPath,
    name: "marble-wizard",
    sourceInfo: createSyntheticSourceInfo(skillPath, {
      baseDir: dirname(skillPath),
      origin: "package",
      scope: "user",
      source: "@marble/wizard",
    }),
  };
};

export const createMarbleResourceLoader = (variant: MarbleAgentVariant) =>
  new DefaultResourceLoader({
    agentDir: process.cwd(),
    cwd: process.cwd(),
    noContextFiles: true,
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    noThemes: true,
    skillsOverride: () => ({
      diagnostics: [],
      skills: [
        buildMarbleSkill(),
      ],
    }),
    systemPrompt: buildSystemPrompt(variant),
  });
