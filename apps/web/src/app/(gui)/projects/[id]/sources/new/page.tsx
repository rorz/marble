import { notFound } from "next/navigation";
import { requireUser } from "../../../../../../lib/auth";
import { getProjectSourceWorkspaceData } from "../../../../../../lib/source-data";
import { ProjectSourceDetailPageView } from "../view";

export default async function NewProjectSourcePage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await props.params;
  const data = await getProjectSourceWorkspaceData(user.id, id);

  if (data === null) {
    notFound();
  }

  return (
    <ProjectSourceDetailPageView
      initialData={data}
      isCreating
      mode="source"
    />
  );
}
