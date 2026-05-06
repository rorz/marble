import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/auth";
import { loadProgramsPageDataForUser } from "../actions";
import { ProgramsPageView } from "../view";

export default async function ProgramPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await props.params;
  const pageData = await loadProgramsPageDataForUser(user.id);

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
