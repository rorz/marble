import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import SignOutButton from "../../sign-out-button";
import * as actions from "./[id]/actions";
import { CreateTableButton } from "./create-table-button";

export default async function TablesPage() {
  await requireUser();
  const tables = await actions.listTables();

  return (
    <div className="bg-zinc-50 text-zinc-900 min-h-screen flex flex-col font-sans">
      <header className="border-b border-zinc-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight">marble</h1>
        </div>
        <SignOutButton />
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">Tables</h2>
          <CreateTableButton />
        </div>

        {tables.length === 0 ? (
          <div className="text-center py-12 bg-white border border-zinc-200 rounded-lg">
            <h3 className="text-sm font-medium text-zinc-900 mb-1">
              No tables yet
            </h3>
            <p className="text-sm text-zinc-500 mb-4">
              Create your first table to get started.
            </p>
            <CreateTableButton />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <Link
                key={table.id}
                href={`/tables/${table.id}`}
                className="group block p-5 bg-white border border-zinc-200 rounded-lg hover:border-orange-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium truncate group-hover:text-orange-600 transition-colors">
                    {table.name || "Untitled Table"}
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono">
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
