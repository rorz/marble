import { PlusIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pane } from "../../../../components/pane";
import { requireUser } from "../../../../lib/auth";
import { CreateTableButton } from "../../tables/create-table-button";
import * as actions from "../actions";

export default async function ProjectPage(props: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requireUser();
  const { id } = await props.params;
  let project: Awaited<ReturnType<typeof actions.loadProject>> | null = null;

  try {
    project = await actions.loadProject(id);
  } catch {
    project = null;
  }

  if (!project) {
    notFound();
  }

  return (
    <Pane
      actions={[
        {
          children: (
            <div className="flex items-center gap-1">
              <PlusIcon
                size={12}
                weight="bold"
              />
              <span>Create</span>
            </div>
          ),
          id: "create",
          variant: "dark",
        },
      ]}
      crumbs={[
        {
          label: "Projects",
        },
        {
          label: project.name,
        },
      ]}
    >
      {project.tables.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white py-12 text-center">
          <h3 className="mb-1 font-medium text-sm text-zinc-900">
            No tables in this project yet
          </h3>
          <p className="mb-4 text-sm text-zinc-500">
            Add the first table and start building inside this project.
          </p>
          <div className="flex justify-center">
            <CreateTableButton projectId={project.id} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {project.tables.map((table) => (
            <Link
              className="group block rounded-lg border border-zinc-200 bg-white p-5 transition-all hover:border-orange-400 hover:shadow-sm"
              href={`/tables/${table.id}`}
              key={table.id}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="truncate font-medium transition-colors group-hover:text-orange-600">
                  {table.name || "Untitled Table"}
                </h3>
                <span className="font-mono text-xs text-zinc-400">
                  {table.id.slice(0, 8)}
                </span>
              </div>
              <div className="text-sm text-zinc-500">
                {new Date(table.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Pane>
  );
}
