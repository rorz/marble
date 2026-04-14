"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import {
  createProfile,
  createProfileKey,
  createSecret,
  deleteSecret,
  type ManagedProfile,
  replaceSecretValue,
  revokeProfileKey,
  type StoredSecret,
} from "./actions";

const secretSortOrder = {
  Managed: 1,
  UserDefined: 0,
} as const;

export function ProfileManager({
  profiles,
  secrets,
}: {
  profiles: ManagedProfile[];
  secrets: StoredSecret[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lastCreatedKey, setLastCreatedKey] = useState<null | {
    profileName: string;
    token: string;
  }>(null);
  const [externalName, setExternalName] = useState("");
  const [name, setName] = useState("");
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [type, setType] = useState<"Agent" | "Human">("Agent");
  const orderedSecrets = [
    ...secrets,
  ].sort(
    (left, right) =>
      secretSortOrder[left.category] - secretSortOrder[right.category] ||
      left.name.localeCompare(right.name),
  );
  const userDefinedSecretNames = new Set(
    orderedSecrets
      .filter((secret) => secret.category === "UserDefined")
      .map((secret) => secret.name),
  );
  const managedSecretNames = new Set(
    orderedSecrets
      .filter((secret) => secret.category === "Managed")
      .map((secret) => secret.name),
  );

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

  const handleCreateSecret = () => {
    runAction(async () => {
      await createSecret({
        name: secretName,
        value: secretValue,
      });
      setSecretName("");
      setSecretValue("");
      router.refresh();
    });
  };

  const handleReplaceSecretValue = (secretId: string) => {
    runAction(async () => {
      const nextValue = secretDrafts[secretId] ?? "";
      await replaceSecretValue(secretId, nextValue);
      setSecretDrafts((current) => ({
        ...current,
        [secretId]: "",
      }));
      router.refresh();
    });
  };

  const handleDeleteSecret = (secretId: string) => {
    runAction(async () => {
      await deleteSecret(secretId);
      setSecretDrafts((current) => {
        const nextDrafts = {
          ...current,
        };
        delete nextDrafts[secretId];
        return nextDrafts;
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg text-zinc-900">
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
            className="rounded-xl bg-neutral-950 px-4 py-2 font-medium text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBusy}
            onClick={handleCreateProfile}
            type="button"
          >
            New profile
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 text-sm">
            {error}
          </p>
        ) : null}

        {lastCreatedKey ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-medium text-emerald-900 text-sm">
              New key for {lastCreatedKey.profileName}
            </p>
            <p className="mt-1 text-emerald-800 text-sm">
              Copy it now. The full token is only shown once.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-emerald-950 px-3 py-3 font-mono text-emerald-100 text-xs">
              {lastCreatedKey.token}
            </pre>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-lg text-zinc-900">
              Create user-defined secret
            </h2>
            <p className="text-sm text-zinc-500">
              Secrets are injected into program execution as environment
              variables. User-defined secrets override managed secrets with the
              same name.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1.6fr_auto]">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-zinc-700">Environment name</span>
            <input
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-zinc-900 outline-none transition focus:border-orange-400"
              onChange={(event) => setSecretName(event.target.value)}
              placeholder="SERVICE_API_KEY"
              value={secretName}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-zinc-700">Value</span>
            <input
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-zinc-900 outline-none transition focus:border-orange-400"
              onChange={(event) => setSecretValue(event.target.value)}
              placeholder="Paste the secret value"
              type="password"
              value={secretValue}
            />
          </label>

          <button
            className="rounded-xl bg-neutral-950 px-4 py-2 font-medium text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBusy}
            onClick={handleCreateSecret}
            type="button"
          >
            Save secret
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 text-sm">
            {error}
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg text-zinc-900">
              Profiles and keys
            </h2>
            <p className="text-sm text-zinc-500">
              Each profile can hold multiple keys. Revoked keys stay visible for
              auditability.
            </p>
          </div>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-2xl border border-zinc-300 border-dashed bg-white p-10 text-center">
            <p className="font-medium text-sm text-zinc-900">No profiles yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Create an agent profile above, then mint a key onto it.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {profiles.map((profile) => (
              <article
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                key={profile.id}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base text-zinc-900">
                        {profile.name}
                      </h3>
                      <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-[11px] text-zinc-500 uppercase tracking-[0.18em]">
                        {profile.type}
                      </span>
                      {profile.external_name ? (
                        <span className="rounded-full bg-orange-50 px-2 py-1 font-medium text-[11px] text-orange-700 uppercase tracking-[0.18em]">
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
                    className="rounded-xl border border-zinc-300 px-3 py-2 font-medium text-sm text-zinc-700 transition hover:border-orange-400 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                          className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between"
                          key={key.id}
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
                            className="rounded-xl border border-zinc-300 px-3 py-2 font-medium text-sm text-zinc-700 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
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

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg text-zinc-900">Secrets</h2>
            <p className="text-sm text-zinc-500">
              Managed secrets are system-provided for the current user. Create a
              user-defined secret with the same name to override one.
            </p>
          </div>
        </div>

        {orderedSecrets.length === 0 ? (
          <div className="rounded-2xl border border-zinc-300 border-dashed bg-white p-10 text-center">
            <p className="font-medium text-sm text-zinc-900">No secrets yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Add a user-defined secret above to inject it into program runs.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orderedSecrets.map((secret) => {
              const overridesManaged =
                secret.category === "UserDefined" &&
                managedSecretNames.has(secret.name);
              const overriddenByUser =
                secret.category === "Managed" &&
                userDefinedSecretNames.has(secret.name);

              return (
                <article
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                  key={secret.id}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-mono font-semibold text-sm text-zinc-900">
                          {secret.name}
                        </h3>
                        <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-[11px] text-zinc-500 uppercase tracking-[0.18em]">
                          {secret.category === "Managed"
                            ? "Managed"
                            : "User defined"}
                        </span>
                        {overridesManaged ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-[11px] text-emerald-700 uppercase tracking-[0.18em]">
                            Overrides managed
                          </span>
                        ) : null}
                        {overriddenByUser ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-[11px] text-amber-700 uppercase tracking-[0.18em]">
                            Overridden
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                        <span className="font-mono">{secret.id}</span>
                        <span>
                          Created{" "}
                          {new Date(secret.created_at).toLocaleDateString()}
                        </span>
                        <span>
                          Updated{" "}
                          {new Date(secret.updated_at).toLocaleDateString()}
                        </span>
                      </div>

                      {secret.category === "Managed" ? (
                        <p className="text-sm text-zinc-500">
                          System-provided secret for this user. Create a
                          user-defined secret with the same name if you need to
                          override it.
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-500">
                          The current value stays hidden. Saving a new value
                          replaces the stored one.
                        </p>
                      )}
                    </div>
                  </div>

                  {secret.category === "UserDefined" ? (
                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900 outline-none transition focus:border-orange-400"
                        onChange={(event) =>
                          setSecretDrafts((current) => ({
                            ...current,
                            [secret.id]: event.target.value,
                          }))
                        }
                        placeholder="Paste a replacement value"
                        type="password"
                        value={secretDrafts[secret.id] ?? ""}
                      />

                      <button
                        className="rounded-xl border border-zinc-300 px-3 py-2 font-medium text-sm text-zinc-700 transition hover:border-orange-400 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isBusy || !(secretDrafts[secret.id] ?? "")}
                        onClick={() => handleReplaceSecretValue(secret.id)}
                        type="button"
                      >
                        Replace value
                      </button>

                      <button
                        className="rounded-xl border border-zinc-300 px-3 py-2 font-medium text-sm text-zinc-700 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isBusy}
                        onClick={() => handleDeleteSecret(secret.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
