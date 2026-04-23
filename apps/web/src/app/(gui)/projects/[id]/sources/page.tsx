import { redirect } from "next/navigation";

export default async function ProjectSourcesIndexPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await props.params;

  redirect(`/projects/${id}`);
}
