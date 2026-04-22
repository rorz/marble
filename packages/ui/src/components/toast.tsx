"use client";

import { Toaster, toast } from "sonner";

export const marbleToast = toast;

export function MarbleToaster() {
  return (
    <Toaster
      closeButton
      position="top-center"
      richColors={false}
      toastOptions={{
        classNames: {
          actionButton:
            "!bg-taupe-950 !text-white hover:!bg-taupe-800 !border-0",
          cancelButton:
            "!bg-white !text-taupe-700 !border !border-taupe-300 hover:!bg-taupe-50",
          description: "!text-[11px] !leading-4 !text-taupe-500",
          title: "!text-[12px] !font-medium !text-taupe-950",
          toast:
            "!rounded-sm !border !border-taupe-300 !bg-white !px-3 !py-2 !text-taupe-950 !shadow-[0_10px_24px_rgba(28,25,23,0.16)]",
        },
        duration: 4000,
      }}
      visibleToasts={6}
    />
  );
}
