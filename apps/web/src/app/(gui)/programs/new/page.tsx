import * as actions from "../actions";
import { ProgramsPageView } from "../view";

export default async function NewProgramPage() {
  const programs = await actions.listPrograms();

  return (
    <ProgramsPageView
      initialMode="draft"
      initialPrograms={programs}
    />
  );
}
