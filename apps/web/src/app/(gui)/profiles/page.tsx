import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import SignOutButton from "../../sign-out-button";
import { listProfilesWithKeys, listSecrets } from "./actions";
import { ProfileManager } from "./profile-manager";

export default async function ProfilesPage() {
  await requireUser();
  const [profiles, secrets] = await Promise.all([
    listProfilesWithKeys(),
    listSecrets(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-zinc-200 border-b bg-white/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="font-semibold text-lg tracking-tight">marble</h1>
            <nav className="flex items-center gap-2 text-sm">
              <Link
                className="rounded-lg px-3 py-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
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
                className="rounded-lg bg-orange-50 px-3 py-1.5 font-medium text-orange-700"
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
        <div className="mb-8 max-w-3xl">
          <h2 className="font-semibold text-3xl tracking-tight">
            Profiles, keys, and secrets
          </h2>
          <p className="mt-2 text-sm text-zinc-600 leading-6">
            Profiles own API keys. Secrets are scoped to the signed-in user and
            flow into execution environments as environment variables, with
            user-defined values overriding managed ones of the same name.
          </p>
        </div>

        <ProfileManager
          profiles={profiles}
          secrets={secrets}
        />
      </main>
    </div>
  );
}
