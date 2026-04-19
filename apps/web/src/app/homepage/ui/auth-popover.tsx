"use client";

import { MarbleButton } from "@marble/ui";
import { useEffect, useRef, useState } from "react";
import AuthForm from "../auth-form";

export function AuthPopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [
    open,
  ]);

  return (
    <div
      className="relative"
      ref={rootRef}
    >
      <MarbleButton
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        variant="orange"
      >
        Sign in
      </MarbleButton>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-80 z-50">
          <AuthForm />
        </div>
      ) : null}
    </div>
  );
}
