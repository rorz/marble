import { notFound } from "next/navigation";
import { requireUser } from "../../../../../../lib/auth";
import { getProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import { ProjectSourceDetailPageView } from "../view";

export default async function ProjectSourcePage(props: {
  params: Promise<{
    id: string;
    sourceId: string;
  }>;
}) {
  const user = await requireUser();
  const { id, sourceId } = await props.params;
  const data = await getProjectSourceWorkspaceData(user.id, id);

  if (data === null || !data.sources.some((source) => source.id === sourceId)) {
    notFound();
  }

  return (
    <ProjectSourceDetailPageView
      initialData={data}
      initialSourceId={sourceId}
      mode="source"
    />
  );
}
