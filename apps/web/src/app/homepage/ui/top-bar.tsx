import { AuthPopover } from "./auth-popover";

export function TopBar() {
  return (
    <header className="top-0 sticky z-40 border-b border-taupe-300/90 bg-taupe-200/90 backdrop-blur-xl py-3 px-6">
      <div className="flex items-center justify-between gap-6">
        <a
          className="font-display font-bold text-xl text-orange-500 tracking-tight"
          href="/"
        >
          Marble
        </a>

        <div className="flex items-center gap-2">
          <AuthPopover />
        </div>
      </div>
    </header>
  );
}
