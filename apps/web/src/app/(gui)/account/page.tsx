import {
  MarbleAccountMark,
  MarbleCopyField,
  MarblePane,
  MarbleStat,
} from "@marble/ui";
import { requireUserIdentity } from "../../../lib/auth";
import { AccountSignOutButton } from "./account-sign-out-button";

export default async function AccountPage() {
  const identity = await requireUserIdentity();

  return (
    <MarblePane
      description="The Supabase identity backing this Marble session."
      title="Account"
      width="Narrow"
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 rounded-xs border border-taupe-200 bg-white px-4 py-4">
          <MarbleAccountMark
            avatarUrl={identity.avatarUrl ?? undefined}
            className="size-14"
            displayName={identity.displayName}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-semibold text-base text-taupe-950">
              {identity.displayName}
            </span>
            {identity.email ? (
              <span className="truncate text-sm text-taupe-600">
                {identity.email}
              </span>
            ) : (
              <span className="truncate text-sm text-taupe-400 italic">
                No email on record
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MarbleStat
            framed
            label="Display name"
            value={identity.displayName}
          />
          <MarbleStat
            framed
            label="Email"
            value={identity.email ?? "—"}
          />
        </div>

        <MarbleCopyField
          label="User ID"
          value={identity.id}
        />

        <AccountSignOutButton />
      </div>
    </MarblePane>
  );
}
