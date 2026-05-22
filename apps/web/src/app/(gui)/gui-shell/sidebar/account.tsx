import { cx, MarbleAccountPopover, useMarbleRouter } from "@marble/ui";
import { SignOutIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useSignOut } from "../../../sign-out-button";
import type { SidebarChrome } from "./types";

type SidebarAccountProps = {
  sidebar: SidebarChrome;
  userAvatarUrl: string | null;
  userDisplayName: string;
  userEmail: string | null;
};

export const SidebarAccount = ({
  sidebar,
  userAvatarUrl,
  userDisplayName,
  userEmail,
}: SidebarAccountProps) => {
  const router = useMarbleRouter();
  const {
    error: signOutError,
    pending: signOutPending,
    signOut,
  } = useSignOut();
  const accountMenuSections = [
    {
      id: "account-actions",
      items: [
        {
          icon: (
            <UserCircleIcon
              size={16}
              weight="regular"
            />
          ),
          id: "account-settings",
          label: "Account settings",
          onSelect: () => router.push("/account"),
        },
      ],
    },
    {
      id: "account-session",
      items: [
        {
          disabled: signOutPending,
          icon: (
            <SignOutIcon
              size={16}
              weight="regular"
            />
          ),
          id: "account-sign-out",
          label: signOutPending ? "Signing out..." : "Sign out",
          onSelect: () => {
            void signOut();
          },
          tone: "danger" as const,
        },
      ],
    },
  ];

  return (
    <>
      <MarbleAccountPopover
        avatarUrl={userAvatarUrl ?? undefined}
        className={cx(sidebar.iconOnly ? null : "flex-1")}
        compact={sidebar.iconOnly}
        description={userEmail ?? undefined}
        displayName={userDisplayName}
        name={userDisplayName}
        sections={accountMenuSections}
      />

      {!sidebar.iconOnly && signOutError ? (
        <p className="px-2 text-red-600 text-xs">{signOutError}</p>
      ) : null}
    </>
  );
};
