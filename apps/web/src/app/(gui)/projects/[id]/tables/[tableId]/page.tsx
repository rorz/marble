import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadTablePageDataForUser } from "./actions";
import TablePageView from "./view";

const ProjectTablePage = async (props: {
  params: Promise<{
    id: string;
    tableId: string;
  }>;
}) => {
  const user = await requireUser();
  const { id, tableId } = await props.params;
  const tablePageData = await loadTablePageDataForUser(user.id, tableId);

  if (!tablePageData || tablePageData.table.projectId !== id) {
    notFound();
  }

  return <TablePageView initialTablePageData={tablePageData} />;
};
export default ProjectTablePage;
