"use server";

import type { Database } from "@marble/supabase";
import { requireUser } from "../../../lib/auth";
import { callMarbleApi } from "../../../lib/marble-api";
import {
  getOwnedProjectForUser,
  listProjectSummariesForUser,
} from "../../../lib/project-data";

type ProjectRow = Database["public"]["Tables"]["project"]["Row"];

export async function listProjects() {
  const user = await requireUser();
  return listProjectSummariesForUser(user.id);
}

export async function loadProject(projectId: string) {
  const user = await requireUser();
  const project = await getOwnedProjectForUser(user.id, projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  return project;
}

export async function createProject() {
  return callMarbleApi<ProjectRow>("/projects", {
    method: "POST",
  });
}
