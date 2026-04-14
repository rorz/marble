import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import SignOutButton from "../../sign-out-button";
import * as actions from "./[id]/actions";
import { CreateTableButton } from "./create-table-button";
import { LiveTableEvents } from "./live-table-events";

export default async function TablesPage() {
  await requireUser();
  const tables = await actions.listTables();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans text-zinc-900">
      <LiveTableEvents />
      <header className="flex items-center justify-between border-zinc-200 border-b px-5 py-3">
        <div className="flex items-center gap-6">
          <h1 className="font-semibold text-lg tracking-tight">marble</h1>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              className="rounded-lg bg-orange-50 px-3 py-1.5 font-medium text-orange-700"
              href="/tables"
            >
              Tables
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
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-8">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-semibold text-2xl">Tables</h2>
          <CreateTableButton />
        </div>

        {tables.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white py-12 text-center">
            <h3 className="mb-1 font-medium text-sm text-zinc-900">
              No tables yet
            </h3>
            <p className="mb-4 text-sm text-zinc-500">
              Create your first table to get started.
            </p>
            <CreateTableButton />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <Link
                className="group block rounded-lg border border-zinc-200 bg-white p-5 transition-all hover:border-orange-400 hover:shadow-sm"
                href={`/tables/${table.id}`}
                key={table.id}
              >
                <div className="mb-2 flex items-center justify-between">
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
