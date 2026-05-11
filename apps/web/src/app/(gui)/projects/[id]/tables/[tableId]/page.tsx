import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadTablePageDataForUser } from "./actions";
import TablePageView from "./view";

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
