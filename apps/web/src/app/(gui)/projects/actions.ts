"use server";

import { requireUser } from "../../../lib/auth";
import {
  getOwnedProjectForUser,
  listProjectSummariesForUser,
} from "../../../lib/project-data";

export async function listProjects() {
  const user = await requireUser();
  return listProjectSummariesForUser(user.id);
}

async function loadProject(projectId: string) {
  const user = await requireUser();
  const project = await getOwnedProjectForUser(user.id, projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  return project;
}
