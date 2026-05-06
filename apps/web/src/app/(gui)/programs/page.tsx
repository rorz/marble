import { requireUser } from "../../../lib/auth";
import { loadProgramsPageDataForUser } from "./actions";
import { ProgramsPageView } from "./view";

export default async function ProgramsPage() {
  const user = await requireUser();
  const pageData = await loadProgramsPageDataForUser(user.id);

  return (
    <ProgramsPageView
      initialProgramSecretBindings={pageData.programSecretBindings}
      initialPrograms={pageData.programs}
      initialSecrets={pageData.secrets}
    />
  );
}
