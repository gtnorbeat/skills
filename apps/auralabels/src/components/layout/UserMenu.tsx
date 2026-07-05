import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

interface UserMenuProps {
  /** Display name shown in the chip and the dropdown header. */
  username: string;
  /** Invoked when the user picks "Sign out" in the dropdown. */
  onSignOut: () => void;
}

/**
 * Top-right account menu. Mirrors `NotificationCenter`'s dropdown keyboard
 * semantics:
 *   - click outside closes the menu
 *   - Escape closes and restores focus to the chip button
 *   - `aria-haspopup="dialog"` + `aria-expanded` track the open state for AT
 *   - chip button is the single labelled target; dropdown is a `role="dialog"`
 */
export function UserMenu({ username, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const initial = (username.trim().charAt(0) || "•").toUpperCase();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={btnRef}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Account menu for ${username}`}
        className="group inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 pl-1.5 pr-2 py-1 text-[11px] font-medium text-zinc-700 transition-all duration-200 hover:border-cyan-500/40 hover:bg-zinc-100 hover:text-zinc-900"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-[11px] font-semibold text-white shadow-sm shadow-cyan-500/25"
        >
          {initial}
        </span>
        <span aria-hidden="true" className="hidden sm:inline max-w-[8rem] truncate">
          {username}
        </span>
        <span
          aria-hidden="true"
          className="ml-0.5 text-[9px] text-zinc-400 group-hover:text-zinc-600"
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Account menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-zinc-200 aura-glass-light shadow-2xl shadow-zinc-900/10"
        >
          <div className="border-b border-zinc-200 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-zinc-900">{username}</p>
          </div>

          <div className="p-1.5">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <span aria-hidden="true" className="w-4 text-center text-zinc-500">⚙</span>
              Account settings
            </Link>

            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <span aria-hidden="true" className="w-4 text-center text-zinc-500">◆</span>
              Back to dashboard
            </Link>

            <div className="my-1 h-px bg-zinc-200" />

            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-red-500/10 hover:text-red-600"
            >
              <span aria-hidden="true" className="w-4 text-center text-zinc-500">⏻</span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
