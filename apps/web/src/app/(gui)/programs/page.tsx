import * as actions from "./actions";
import { ProgramsPageView } from "./view";

export default async function ProgramsPage() {
  const pageData = await actions.loadProgramsPageData();

  return (
    <ProgramsPageView
      initialProgramSecretBindings={pageData.programSecretBindings}
      initialPrograms={pageData.programs}
      initialSecrets={pageData.secrets}
    />
  );
}
