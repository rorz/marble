import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import SignOutButton from "../../sign-out-button";
import { listProfilesWithKeys } from "./actions";
import { ProfileManager } from "./profile-manager";

export default async function ProfilesPage() {
  await requireUser();
  const profiles = await listProfilesWithKeys();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold tracking-tight">marble</h1>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                className="rounded-lg px-3 py-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                href="/tables"
              >
                Tables
              </Link>
              <Link
                className="rounded-lg bg-orange-50 px-3 py-1.5 font-medium text-orange-700"
                href="/profiles"
              >
                Profiles + Keys
              </Link>
            </nav>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Profile and key management
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Agent profiles are the owner record for API keys. Create a profile,
            mint one or more keys onto it, and use those keys against the web
            API proxy or executor surfaces.
          </p>
        </div>

        <ProfileManager profiles={profiles} />
      </main>
    </div>
  );
}
