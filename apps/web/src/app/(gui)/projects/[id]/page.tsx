import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/auth";
import { getProjectSourceWorkspaceData } from "../../../../lib/source-data";
import { ProjectPageView } from "./view";

export default async function ProjectPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await props.params;
  const project = await getProjectSourceWorkspaceData(user.id, id);

  if (project === null) {
    notFound();
  }

  return <ProjectPageView initialProject={project} />;
}
