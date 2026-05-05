import { MarblePane } from "@marble/ui";
import { requireUser } from "../../../lib/auth";
import { listProjectSummariesForUser } from "../../../lib/project-data";
import { listOwnedProfileIds } from "../../../lib/supabase/service-role";
import { ProjectsPageView } from "./view";

export default async function ProjectsPage() {
  const user = await requireUser();
  const [projects, ownerProfileIds] = await Promise.all([
    listProjectSummariesForUser(user.id),
    listOwnedProfileIds(user.id),
  ]);

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
        userId={user.id}
      />
    </MarblePane>
  );
}
