import { projectsContract } from "./orpc";

export { projectsContract } from "./orpc";
export * from "./resources/define";
export * from "./resources/projects";

export const contract = {
  projects: projectsContract,
};

export type MarbleContract = typeof contract;
