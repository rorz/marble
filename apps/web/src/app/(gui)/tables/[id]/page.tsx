import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/auth";
import { loadTablePageDataForUser } from "./actions";
import TablePageView from "./view";

export default async function TablePage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await props.params;
  let tablePageData: Awaited<
    ReturnType<typeof loadTablePageDataForUser>
  > | null = null;

  try {
    tablePageData = await loadTablePageDataForUser(user.id, id);
  } catch {
    tablePageData = null;
  }

  if (!tablePageData) {
    notFound();
  }

  return <TablePageView initialTablePageData={tablePageData} />;
}
