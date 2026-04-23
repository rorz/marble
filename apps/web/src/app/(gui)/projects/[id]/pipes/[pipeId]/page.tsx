import { notFound } from "next/navigation";
import { requireUser } from "../../../../../../lib/auth";
import { getProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import { ProjectSourceDetailPageView } from "../../sources/view";

export default async function ProjectPipePage(props: {
  params: Promise<{
    pipeId: string;
    id: string;
  }>;
}) {
  const user = await requireUser();
  const { pipeId, id } = await props.params;
  const data = await getProjectSourceWorkspaceData(user.id, id);

  if (data === null || !data.pipes.some((pipe) => pipe.id === pipeId)) {
    notFound();
  }

  return (
    <ProjectSourceDetailPageView
      initialData={data}
      initialPipeId={pipeId}
      mode="pipe"
    />
  );
}
