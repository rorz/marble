import Link from "next/link";
import { Pane } from "../../../components/pane";
import { requireUser } from "../../../lib/auth";
import * as actions from "./actions";
import { CreateProjectButton } from "./create-project-button";

function groupProjects(
  projects: Awaited<ReturnType<typeof actions.listProjects>>,
) {
  const grouped = new Map<string, typeof projects>();

  for (const project of projects) {
    const key = project.folder_path.join(" / ");
    const existing = grouped.get(key) ?? [];
    existing.push(project);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries()).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

export default async function ProjectsPage() {
  await requireUser();
  const projects = await actions.listProjects();
  const groupedProjects = groupProjects(projects);

  return (
    <Pane
      actions={[
        {
          children: <>Create</>,
          id: "create-project",
          variant: "orange",
        },
      ]}
      crumbs={[
        {
          label: "Projects",
        },
      ]}
    >
      {projects.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white py-12 text-center">
          <h3 className="mb-1 font-medium text-sm text-zinc-900">
            No projects yet
          </h3>
          <p className="mb-4 text-sm text-zinc-500">
            Create your first project to start organizing tables.
          </p>
          <CreateProjectButton />
        </div>
      ) : (
        <div className="space-y-8">
          {groupedProjects.map(([folderLabel, scopedProjects]) => (
            <section key={folderLabel || "/"}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-sm text-zinc-500 uppercase tracking-[0.18em]">
                  {folderLabel || "/"}
                </h3>
                <span className="font-mono text-xs text-zinc-400">
                  {scopedProjects.length} project
                  {scopedProjects.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {scopedProjects.map((project) => (
                  <Link
                    className="group block rounded-lg border border-zinc-200 bg-white p-5 transition-all hover:border-orange-400 hover:shadow-sm"
                    href={`/projects/${project.id}`}
                    key={project.id}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="truncate font-medium transition-colors group-hover:text-orange-600">
                        {project.name || "Untitled Project"}
                      </h4>
                      <span className="font-mono text-xs text-zinc-400">
                        {project.id.slice(0, 8)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-zinc-500">
                      <span>
                        {project.table_count} table
                        {project.table_count === 1 ? "" : "s"}
                      </span>
                      <span>
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Pane>
  );
}
