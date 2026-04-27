"use server";

import type { Database } from "@marble/supabase";
import { revalidatePath } from "next/cache";
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

async function requireOwnedProject(projectId: string) {
  const user = await requireUser();
  const project = await getOwnedProjectForUser(user.id, projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  return project;
}

export async function createProjectAction() {
  const project = await callMarbleApi<ProjectRow>("/projects", {
    method: "POST",
    profileId: false,
    requireActorProfile: false,
  });

  revalidatePath("/projects");

  return project;
}

export async function renameProjectAction(projectId: string, name: string) {
  const project = await callMarbleApi<ProjectRow>(`/projects/${projectId}`, {
    body: {
      name: name.trim() || "Untitled Project",
    },
    method: "PATCH",
  });

  return project;
}

export async function deleteProjectAction(projectId: string) {
  await requireOwnedProject(projectId);

  const result = await callMarbleApi(`/projects/${projectId}`, {
    method: "DELETE",
  });

  revalidatePath("/projects");

  return result;
}

export async function createTableAction(projectId: string) {
  await requireOwnedProject(projectId);

  const table = await callMarbleApi<
    Database["public"]["Tables"]["table"]["Row"]
  >(`/projects/${projectId}/tables`, {
    method: "POST",
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);

  return table;
}
