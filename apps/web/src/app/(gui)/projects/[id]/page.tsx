import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/auth";
import { getProjectSourceWorkspaceData } from "../../../../lib/source-data";
import { ProjectPageView } from "./view";

export default async function ProjectPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requireUser();
  const { id } = await props.params;
  const project = await getProjectSourceWorkspaceData(id);

  if (project === null) {
    notFound();
  }

  return <ProjectPageView initialProject={project} />;
}
