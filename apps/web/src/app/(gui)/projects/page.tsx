import { MarblePane } from "@marble/ui";
import { listProjectIndexData } from "../../../lib/project-data";
import { ProjectsPageView } from "./view";

export default async function ProjectsPage() {
  const { ownerProfileIds, projects, userId } = await listProjectIndexData();

  return (
    <MarblePane
      crumbs={[
        {
          id: "projects",
          label: "Projects",
        },
      ]}
    >
      <ProjectsPageView
        initialProjects={projects}
        ownerProfileIds={ownerProfileIds}
        userId={userId}
      />
    </MarblePane>
  );
}
