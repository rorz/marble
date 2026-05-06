import { notFound } from "next/navigation";
import { requireUser } from "../../../../../../lib/auth";
import { loadTablePageDataForUser } from "../../../../tables/[id]/actions";
import TablePageView from "../../../../tables/[id]/view";

export default async function ProjectTablePage(props: {
  params: Promise<{
    id: string;
    tableId: string;
  }>;
}) {
  const user = await requireUser();
  const { tableId } = await props.params;
  let tablePageData: Awaited<
    ReturnType<typeof loadTablePageDataForUser>
  > | null = null;

  try {
    tablePageData = await loadTablePageDataForUser(user.id, tableId);
  } catch {
    tablePageData = null;
  }

  if (!tablePageData) {
    notFound();
  }

  return <TablePageView initialTablePageData={tablePageData} />;
}
