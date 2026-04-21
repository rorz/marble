import * as actions from "./actions";
import { ProgramsPageView } from "./view";

export default async function ProgramsPage() {
  const programs = await actions.listPrograms();

  return <ProgramsPageView initialPrograms={programs} />;
}
