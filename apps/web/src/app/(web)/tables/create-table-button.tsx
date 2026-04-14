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
      className="bg-neutral-950 p-0.5 rounded-[7px] transition-opacity hover:opacity-90 cursor-pointer"
      onClick={handleCreate}
      type="button"
    >
      <div
        className="size-full p-[1px] rounded-md bg-neutral-200"
        style={{
          background: `linear-gradient(to right, var(--color-neutral-100) 0px, #e5e5e500 4px),
          linear-gradient(to left, var(--color-neutral-400) 0px, #e5e5e500 4px),
          linear-gradient(to top, var(--color-neutral-200) 0px, #e5e5e500 4px),
          linear-gradient(to bottom, var(--color-neutral-300) 0px, #e5e5e500 4px),
          linear-gradient(to bottom right, var(--color-white) 0px, #e5e5e500 4px)`,
        }}
      >
        <div className="size-full flex items-center justify-center font-medium uppercase py-1.5 px-3 rounded-[5px] tracking-wide text-xs bg-neutral-50 text-neutral-700 shadow-sm font-medium">
          + New Table
        </div>
      </div>
    </button>
  );
}
