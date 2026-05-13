import { requireUser } from "../../../lib/auth";
import { loadProgramsPageDataForUser } from "./actions";
import { ProgramsPageView } from "./view";

const ProgramsPage = async () => {
  const user = await requireUser();
  const pageData = await loadProgramsPageDataForUser(user.id);

  return (
    <ProgramsPageView
      initialProgramSecretBindings={pageData.programSecretBindings}
      initialPrograms={pageData.programs}
      initialSecrets={pageData.secrets}
    />
  );
};
export default ProgramsPage;
