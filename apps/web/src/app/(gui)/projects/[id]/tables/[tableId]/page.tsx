import { notFound } from "next/navigation";
import { requireUser } from "../../../../../../lib/auth";
import * as actions from "../../../../tables/[id]/actions";
import TablePageView from "../../../../tables/[id]/view";

export default async function ProjectTablePage(props: {
  params: Promise<{
    id: string;
    tableId: string;
  }>;
}) {
  await requireUser();
  const { tableId } = await props.params;
  let tablePageData: Awaited<
    ReturnType<typeof actions.loadTablePageData>
  > | null = null;

  try {
    tablePageData = await actions.loadTablePageData(tableId);
  } catch {
    tablePageData = null;
  }

  if (!tablePageData) {
    notFound();
  }

  return <TablePageView initialTablePageData={tablePageData} />;
}
