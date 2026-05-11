"use client";

import { MarbleButton, MarbleContextPopover } from "@marble/ui";
import AuthForm from "../auth-form";

export function AuthPopover() {
  return (
    <MarbleContextPopover
      align="end"
      ariaLabel="Sign in"
      asChild
      content={<AuthForm />}
      contentClassName="w-80"
    >
      <MarbleButton variant="orange">Sign in</MarbleButton>
    </MarbleContextPopover>
  );
}
