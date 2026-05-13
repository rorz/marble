import { notFound } from "next/navigation";
import { requireUser } from "../../../../../../lib/auth";
import { getProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import { ProjectSourceDetailPageView } from "../../sources/view";

const ProjectPipePage = async (props: {
  params: Promise<{
    pipeId: string;
    id: string;
  }>;
}) => {
  await requireUser();
  const { pipeId, id } = await props.params;
  const data = await getProjectSourceWorkspaceData(id);

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
};
export default ProjectPipePage;
