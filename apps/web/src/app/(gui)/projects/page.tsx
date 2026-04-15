import { MarblePane } from "@marble/ui";
import { requireUser } from "../../../lib/auth";
import { listOwnedProfileIds } from "../../../lib/supabase/service-role";
import * as actions from "./actions";
import { ProjectsPageView } from "./view";

export default async function ProjectsPage() {
  const user = await requireUser();
  const [projects, ownerProfileIds] = await Promise.all([
    actions.listProjects(),
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
      />
    </MarblePane>
  );
}
