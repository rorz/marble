"use client";

import { MarbleButton } from "@marble/ui";
import { SignOutIcon } from "@phosphor-icons/react";
import { useSignOut } from "../../sign-out-button";

export const AccountSignOutButton = () => {
  const { error, pending, signOut } = useSignOut();

  return (
    <div className="flex flex-col items-end gap-2">
      <MarbleButton
        disabled={pending}
        iconLeft={SignOutIcon}
        onClick={() => {
          void signOut();
        }}
        type="button"
        variant="red"
      >
        {pending ? "Signing out..." : "Sign out"}
      </MarbleButton>
      {error ? <p className="text-red-600 text-xs">{error}</p> : null}
    </div>
  );
};
