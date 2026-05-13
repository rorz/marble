import { MarblePane } from "@marble/ui";
import { listProjectIndexData } from "../../../lib/project-data";
import { ProjectsPageView } from "./view";

const ProjectsPage = async () => {
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
};
export default ProjectsPage;
