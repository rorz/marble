import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/auth";
import * as actions from "../actions";
import { ProjectPageView } from "./view";

export default async function ProjectPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requireUser();
  const { id } = await props.params;
  let project: Awaited<ReturnType<typeof actions.loadProject>> | null = null;

  try {
    project = await actions.loadProject(id);
  } catch {
    project = null;
  }

  if (!project) {
    notFound();
  }

  return <ProjectPageView initialProject={project} />;
}
