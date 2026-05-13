import { redirect } from "next/navigation";

const ProjectSourcesIndexPage = async (props: {
  params: Promise<{
    id: string;
  }>;
}) => {
  const { id } = await props.params;

  redirect(`/projects/${id}`);
};
export default ProjectSourcesIndexPage;
