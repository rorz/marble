"use client";

import { useRouter } from "next/navigation";
import * as actions from "./[id]/actions";

export function CreateTableButton() {
  const router = useRouter();

  const handleCreate = async () => {
    const table = await actions.createTable();
    router.push(`/tables/${table.id}`);
  };

  return (
    <button
      className="cursor-pointer rounded-[7px] bg-neutral-950 p-0.5 transition-opacity hover:opacity-90"
      onClick={handleCreate}
      type="button"
    >
      <div
        className="size-full rounded-md bg-neutral-200 p-[1px]"
        style={{
          background: `linear-gradient(to right, var(--color-neutral-100) 0px, #e5e5e500 4px),
          linear-gradient(to left, var(--color-neutral-400) 0px, #e5e5e500 4px),
          linear-gradient(to top, var(--color-neutral-200) 0px, #e5e5e500 4px),
          linear-gradient(to bottom, var(--color-neutral-300) 0px, #e5e5e500 4px),
          linear-gradient(to bottom right, var(--color-white) 0px, #e5e5e500 4px)`,
        }}
      >
        <div className="flex size-full items-center justify-center rounded-[5px] bg-neutral-50 px-3 py-1.5 font-medium font-medium text-neutral-700 text-xs uppercase tracking-wide shadow-sm">
          + New Table
        </div>
      </div>
    </button>
  );
}
