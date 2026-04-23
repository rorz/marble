import { notFound } from "next/navigation";
import { requireUser } from "../../../../../../lib/auth";
import { getProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import { ProjectSourceDetailPageView } from "../../sources/view";

export default async function ProjectDrainPage(props: {
  params: Promise<{
    drainId: string;
    id: string;
  }>;
}) {
  const user = await requireUser();
  const { drainId, id } = await props.params;
  const data = await getProjectSourceWorkspaceData(user.id, id);

  if (data === null || !data.drains.some((drain) => drain.id === drainId)) {
    notFound();
  }

  return (
    <ProjectSourceDetailPageView
      initialData={data}
      initialDrainId={drainId}
      mode="drain"
    />
  );
}
