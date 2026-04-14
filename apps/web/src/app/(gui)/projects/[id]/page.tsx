import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/auth";
import SignOutButton from "../../../sign-out-button";
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-zinc-200 border-b bg-white/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="font-semibold text-lg tracking-tight">
              <Link
                className="transition-colors hover:text-orange-600"
                href="/projects"
              >
                marble
              </Link>
            </h1>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                className="rounded-lg bg-orange-50 px-3 py-1.5 font-medium text-orange-700"
                href="/projects"
              >
                Projects
              </Link>
              <Link
                className="rounded-lg px-3 py-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                href="/events"
              >
                Events
              </Link>
              <Link
                className="rounded-lg px-3 py-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                href="/profiles"
              >
                Profiles + Secrets
              </Link>
            </nav>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] text-zinc-500 uppercase tracking-[0.22em]">
              {project.folder_path.length > 0
                ? project.folder_path.join(" / ")
                : "Root"}
            </p>
            <h2 className="mt-2 font-semibold text-3xl tracking-tight">
              {project.name || "Untitled Project"}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 leading-6">
              Tables inside this project can reference columns across any table
              you own. Projects also carry a folder path for lightweight UI
              organization without a separate folder resource.
            </p>
          </div>

          <CreateTableButton projectId={project.id} />
        </div>

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
      </main>
    </div>
  );
}
