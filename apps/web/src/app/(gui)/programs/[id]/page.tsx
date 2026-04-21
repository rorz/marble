import { notFound } from "next/navigation";
import * as actions from "../actions";
import { ProgramsPageView } from "../view";

export default async function ProgramPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await props.params;
  const programs = await actions.listPrograms();

  if (!programs.some((program) => program.id === id)) {
    notFound();
  }

  return (
    <ProgramsPageView
      initialProgramId={id}
      initialPrograms={programs}
    />
  );
}
