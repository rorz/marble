import { notFound } from "next/navigation";
import * as actions from "../actions";
import { ProgramsPageView } from "../view";

export default async function ProgramPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await props.params;
  const pageData = await actions.loadProgramsPageData();

  if (!pageData.programs.some((program) => program.id === id)) {
    notFound();
  }

  return (
    <ProgramsPageView
      initialProgramId={id}
      initialProgramSecretBindings={pageData.programSecretBindings}
      initialPrograms={pageData.programs}
      initialSecrets={pageData.secrets}
    />
  );
}
