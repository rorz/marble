"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import {
  createProfile,
  createProfileKey,
  type ManagedProfile,
  revokeProfileKey,
} from "./actions";

export function ProfileManager({ profiles }: { profiles: ManagedProfile[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lastCreatedKey, setLastCreatedKey] = useState<null | {
    profileName: string;
    token: string;
  }>(null);
  const [externalName, setExternalName] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"Agent" | "Human">("Agent");

  const runAction = (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);

    startTransition(() => {
      void action()
        .catch((caughtError) => {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Request failed",
          );
        })
        .finally(() => {
          setIsBusy(false);
        });
    });
  };

  const handleCreateProfile = () => {
    runAction(async () => {
      await createProfile({
        externalName,
        name,
        type,
      });
      setExternalName("");
      setName("");
      setType("Agent");
      router.refresh();
    });
  };

  const handleCreateKey = (profileId: string) => {
    runAction(async () => {
      const created = await createProfileKey(profileId);
      setLastCreatedKey({
        profileName: created.profileName,
        token: created.token,
      });
      router.refresh();
    });
  };

  const handleRevokeKey = (keyId: string) => {
    runAction(async () => {
      await revokeProfileKey(keyId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Create profile
            </h2>
            <p className="text-sm text-zinc-500">
              Agent profiles own keys. Create the profile first, then mint one
              or more API keys onto it.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_180px_auto]">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-zinc-700">Profile name</span>
            <input
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none transition focus:border-orange-400"
              onChange={(event) => setName(event.target.value)}
              placeholder="Customer support agent"
              value={name}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-zinc-700">External name</span>
            <input
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none transition focus:border-orange-400"
              onChange={(event) => setExternalName(event.target.value)}
              placeholder="claude-code"
              value={externalName}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-zinc-700">Type</span>
            <select
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none transition focus:border-orange-400"
              onChange={(event) =>
                setType(event.target.value as "Agent" | "Human")
              }
              value={type}
            >
              <option value="Agent">Agent</option>
              <option value="Human">Human</option>
            </select>
          </label>

          <button
            className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBusy}
            onClick={handleCreateProfile}
            type="button"
          >
            New profile
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {lastCreatedKey ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-900">
              New key for {lastCreatedKey.profileName}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Copy it now. The full token is only shown once.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-emerald-950 px-3 py-3 font-mono text-xs text-emerald-100">
              {lastCreatedKey.token}
            </pre>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Profiles and keys
            </h2>
            <p className="text-sm text-zinc-500">
              Each profile can hold multiple keys. Revoked keys stay visible for
              auditability.
            </p>
          </div>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-zinc-900">No profiles yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Create an agent profile above, then mint a key onto it.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {profiles.map((profile) => (
              <article
                key={profile.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-900">
                        {profile.name}
                      </h3>
                      <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                        {profile.type}
                      </span>
                      {profile.external_name ? (
                        <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-orange-700">
                          {profile.external_name}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                      <span className="font-mono">{profile.id}</span>
                      <span>
                        Created{" "}
                        {new Date(profile.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-orange-400 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isBusy}
                    onClick={() => handleCreateKey(profile.id)}
                    type="button"
                  >
                    Create key
                  </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                  {profile.keys.length === 0 ? (
                    <div className="bg-zinc-50 px-4 py-4 text-sm text-zinc-500">
                      No keys yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200">
                      {profile.keys.map((key) => (
                        <div
                          key={key.id}
                          className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="font-mono text-sm text-zinc-900">
                              {key.preview}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                              <span>{key.id}</span>
                              <span>
                                Created{" "}
                                {new Date(key.created_at).toLocaleDateString()}
                              </span>
                              <span>
                                {key.deleted_at
                                  ? `Revoked ${new Date(
                                      key.deleted_at,
                                    ).toLocaleDateString()}`
                                  : "Active"}
                              </span>
                            </div>
                          </div>

                          <button
                            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isBusy || Boolean(key.deleted_at)}
                            onClick={() => handleRevokeKey(key.id)}
                            type="button"
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
