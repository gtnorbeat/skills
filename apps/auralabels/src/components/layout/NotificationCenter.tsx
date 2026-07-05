import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchNotifications } from "@/utils/api";
import type { AppNotification } from "@/types";
const STORAGE_KEY = "notifications_read";
const READ_ALL_KEY = "notifications_read_all";

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveReadId(id: string) {
  try {
    const ids = getReadIds();
    ids.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* localStorage may be unavailable */ }
}

function saveReadAllIds(ids: string[]) {
  try {
    const current = getReadIds();
    ids.forEach((id) => current.add(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
    localStorage.setItem(READ_ALL_KEY, Date.now().toString());
  } catch { /* localStorage may be unavailable */ }
}

const PRIORITY_TYPE_ORDER: Record<string, number> = {
  contract_expiring: 0,
  task_overdue: 1,
  release_attention: 2,
  demo_review: 3,
  artist_missing_info: 4,
  task_due: 5,
};

type LoadState = "idle" | "loading" | "error" | "loaded";

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Merge server notifications with localStorage read state
  const merged = notifications.map((n) => ({
    ...n,
    read: n.read || getReadIds().has(n.id),
  }));
  const unreadCount = merged.filter((n) => !n.read).length;

  // Headline text for the chip — picked by priority, falls back to count.
  const headline = (() => {
    const top = merged
      .filter((n) => !n.read)
      .slice()
      .sort((a, b) => (PRIORITY_TYPE_ORDER[a.type] ?? 99) - (PRIORITY_TYPE_ORDER[b.type] ?? 99))[0];
    if (!top) return unreadCount > 0 ? `${unreadCount} unread` : "All caught up";
    return top.title.length > 36 ? `${top.title.slice(0, 33)}…` : top.title;
  })();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Fetch on mount, then poll every 60s
  const loadStateRef = useRef<LoadState>("idle");
  loadStateRef.current = loadState;

  const load = useCallback(() => {
    setLoadState((prev) => {
      if (prev === "loading") return prev; // already in-flight
      return "loading";
    });
    fetchNotifications()
      .then((data) => {
        setNotifications(data);
        setLoadState("loaded");
      })
      .catch(() => {
        setLoadState("error");
      });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  function handleClick(notif: AppNotification) {
    saveReadId(notif.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
    );
    setOpen(false);
    navigate(notif.link);
  }

  function handleMarkAllRead() {
    const unreadIds = merged.filter((n) => !n.read).map((n) => n.id);
    saveReadAllIds(unreadIds);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true })),
    );
  }

  function handleRetry() {
    setLoadState("idle");
    load();
  }

  // Render the dropdown from the merged map
  const grouped = groupNotifications(merged);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Modern status chip */}
      <button
        onClick={() => {
          setOpen((prev) => !prev);
          if (loadState === "idle" || loadState === "error") load();
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? `Notifications: ${unreadCount} unread. ${headline}`
            : "Notifications, all caught up"
        }
        className="group inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-white px-3 py-1.5 text-[11px] text-zinc-700 transition-all duration-200 hover:border-cyan-500/40 hover:bg-zinc-50"
      >
        <span aria-hidden="true" className="relative flex h-2 w-2">
          {unreadCount > 0 && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
          )}
          <span
            aria-hidden="true"
            className={`relative inline-flex h-2 w-2 rounded-full ${
              unreadCount > 0
                ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                : loadState === "error"
                  ? "bg-amber-400"
                  : "bg-zinc-300"
            }`}
          />
        </span>
        <span aria-hidden="true" className="hidden sm:inline max-w-[14rem] truncate">
          {loadState === "error"
            ? "Notifications unavailable"
            : headline}
        </span>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet-500/80 px-1.5 text-[9px] font-bold tabular-nums text-white"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {loadState === "error" && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500/80 px-1.5 text-[9px] font-bold text-white"
          >
            !
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-zinc-200 aura-glass-light shadow-2xl shadow-zinc-900/10 aura-enter-scale"
        >
          {/* Header with mark-all-read */}
          <div className="flex items-center justify-between border-b border-cyan-500/10 px-4 py-3">
            <div>
              <h3 className="text-xs font-semibold text-zinc-900">Notifications</h3>
              <p className="mt-0.5 text-[10px] text-zinc-400">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="rounded-md px-2 py-1 text-[10px] font-medium text-cyan-600 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
                title="Mark all as read"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* Loading skeleton */}
            {loadState === "loading" && (
              <div className="px-3 py-2 space-y-2" role="status" aria-label="Loading notifications">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
                    <div className="mt-0.5 h-2.5 w-20 rounded aura-skeleton-shimmer" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded aura-skeleton-shimmer" />
                      <div className="h-2.5 w-full rounded aura-skeleton-shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {loadState === "error" && notifications.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-zinc-500">Couldn't load notifications</p>
                <button
                  onClick={handleRetry}
                  className="mt-2 rounded-md px-3 py-1 text-[11px] font-medium text-cyan-600 transition-colors hover:bg-cyan-50"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty state */}
            {loadState === "loaded" && notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="mb-2 text-2xl opacity-30 aura-float">✓</div>
                <p className="text-xs font-medium text-zinc-500">All caught up</p>
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  No tasks, releases, or contracts need attention
                </p>
              </div>
            )}

            {/* Notification list */}
            {loadState !== "loading" &&
              Object.entries(grouped).map(([typeLabel, items]) => (
                <div key={typeLabel}>
                  <div className="sticky top-0 bg-white/85 px-4 py-1.5 backdrop-blur-sm">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                      <span aria-hidden="true">{getTypeIcon(typeLabel)}</span>{" "}
                      {typeLabel}
                    </span>
                  </div>
                  {items.map((notif, idx) => (
                    <button
                      key={notif.id}
                      onClick={() => handleClick(notif)}
                      className={`w-full px-4 py-2.5 text-left transition-colors duration-150 hover:bg-zinc-50 ${
                        !notif.read
                          ? "border-l-2 border-cyan-500/60 bg-cyan-50/30"
                          : "border-l-2 border-transparent"
                      }`}
                      style={
                        !notif.read
                          ? {
                              animationDelay: `${idx * 40}ms`,
                              animation: "aura-fade-in 300ms cubic-bezier(0.22, 1, 0.36, 1) both",
                            }
                          : undefined
                      }
                    >
                      <p
                        className={`text-xs ${
                          !notif.read ? "font-medium text-zinc-900" : "text-zinc-500"
                        }`}
                      >
                        {notif.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-zinc-400 line-clamp-2">
                        {notif.description}
                      </p>
                      <p className="mt-1 text-[9px] text-zinc-300">
                        {getTypeLabel(notif.type)}
                      </p>
                    </button>
                  ))}
                </div>
              ))}
          </div>

          {/* Footer with last-updated */}
          {loadState === "loaded" && notifications.length > 0 && (
            <div className="border-t border-zinc-100 px-4 py-1.5">
              <p className="text-[9px] text-zinc-300">
                Auto-refreshes every minute
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function groupNotifications(
  notifications: AppNotification[],
): Record<string, AppNotification[]> {
  const labels: Record<string, string> = {
    task_overdue: "Overdue",
    task_due: "Due soon",
    release_attention: "Releases",
    contract_expiring: "Contracts",
    demo_review: "Demos",
    artist_missing_info: "Artists",
  };
  const grouped: Record<string, AppNotification[]> = {};
  for (const notif of notifications) {
    const key = labels[notif.type] || "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(notif);
  }
  const typeOrder = [
    "Overdue",
    "Due soon",
    "Releases",
    "Contracts",
    "Demos",
    "Artists",
  ];
  const sorted: Record<string, AppNotification[]> = {};
  for (const label of typeOrder) {
    if (grouped[label]) sorted[label] = grouped[label];
  }
  return sorted;
}

function getTypeIcon(typeLabel: string): string {
  switch (typeLabel) {
    case "Overdue":
      return "⚠";
    case "Due soon":
      return "◷";
    case "Releases":
      return "▣";
    case "Contracts":
      return "◇";
    case "Demos":
      return "▷";
    case "Artists":
      return "◈";
    default:
      return "•";
  }
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    task_overdue: "Overdue Task",
    task_due: "Due Soon",
    release_attention: "Release",
    contract_expiring: "Contract",
    demo_review: "Demo",
    artist_missing_info: "Artist",
  };
  return labels[type] || type;
}
