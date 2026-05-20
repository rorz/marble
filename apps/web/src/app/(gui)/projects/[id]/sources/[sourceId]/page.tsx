import { notFound } from "next/navigation";
import { requireUser } from "../../../../../../lib/auth";
import { getProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import { ProjectSourceDetailPageView } from "../view";

const ProjectSourcePage = async (props: {
  params: Promise<{
    id: string;
    sourceId: string;
  }>;
}) => {
  await requireUser();
  const { id, sourceId } = await props.params;
  const data = await getProjectSourceWorkspaceData(id);

  if (data === null || !data.sources.some((source) => source.id === sourceId)) {
    notFound();
  }

  return (
    <ProjectSourceDetailPageView
      initialData={data}
      initialSourceId={sourceId}
    />
  );
};
export default ProjectSourcePage;
