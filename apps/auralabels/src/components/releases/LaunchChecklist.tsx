import { useState } from "react";
import type { ChecklistItem, Release } from "@/types";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { computeReadinessScores } from "@/utils/releaseReadiness";
import type { ReadinessCategory } from "@/utils/releaseReadiness";

interface LaunchChecklistProps {
  items: ChecklistItem[];
  readinessPercentage: number;
  /** Optional: pass the full release object to show per-category readiness breakdown */
  release?: Release;
  onToggle?: (itemId: string) => void;
  onAdd?: (title: string, required?: boolean) => void;
  onRemove?: (itemId: string) => void;
  saving?: boolean;
}

function CategoryBar({ category }: { category: ReadinessCategory }) {
  return (
    <div className="group flex items-center gap-3">
      <span className="w-5 text-center text-xs">{category.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-300">{category.label}</span>
          <span className={`text-[10px] font-bold tabular-nums ${
            category.score >= 80 ? "text-emerald-400" :
            category.score >= 50 ? "text-amber-400" :
            "text-red-400"
          }`}>
            {category.score}%
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              category.score >= 80 ? "bg-emerald-500" :
              category.score >= 50 ? "bg-amber-500" :
              "bg-red-500"
            }`}
            style={{ width: `${category.score}%` }}
          />
        </div>
        {/* Subtle tooltip on hover showing individual checks */}
        <div className="mt-1 hidden flex-wrap gap-x-3 gap-y-0.5 group-hover:flex">
          {category.items.map((item, i) => (
            <span
              key={i}
              className={`flex items-center gap-1 text-[9px] ${
                item.done ? "text-emerald-500/70" : "text-zinc-600"
              }`}
            >
              <span>{item.done ? "✓" : "○"}</span>
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LaunchChecklist({ items, readinessPercentage, release, onToggle, onAdd, onRemove, saving }: LaunchChecklistProps) {
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemRequired, setNewItemRequired] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const requiredItems = items.filter((i) => i.required);
  const completedRequired = requiredItems.filter((i) => i.completed).length;
  const missingRequired = requiredItems.filter((i) => !i.completed);

  // Compute per-category scores from the release object
  const readiness = release ? computeReadinessScores(release) : null;

  function handleAdd() {
    const trimmed = newItemTitle.trim();
    if (!trimmed) return;
    onAdd?.(trimmed, newItemRequired);
    setNewItemTitle("");
    setShowAddForm(false);
  }

  return (
    <div className="space-y-4">
      {/* Readiness Score — 5-category breakdown */}
      {readiness && (
        <div className="rounded-xl border border-zinc-800/40 bg-gradient-to-br from-zinc-900/60 to-zinc-950/60 p-4">
          {/* Overall big number */}
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Release Readiness Score
            </span>
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full shadow-[0_0_8px] ${
                readiness.overall >= 80
                  ? "bg-emerald-500 shadow-emerald-500/40"
                  : readiness.overall >= 50
                    ? "bg-amber-500 shadow-amber-500/40"
                    : "bg-red-500 shadow-red-500/40"
              }`} />
              <span className={`text-2xl font-bold tabular-nums ${
                readiness.overall >= 80 ? "text-emerald-400" :
                readiness.overall >= 50 ? "text-amber-400" :
                "text-red-400"
              }`}>
                {readiness.overall}%
              </span>
            </div>
          </div>

          {/* Category bars */}
          <div className="space-y-2.5">
            {readiness.categories.map((cat) => (
              <CategoryBar key={cat.key} category={cat} />
            ))}
          </div>
        </div>
      )}

      {/* Legacy readiness bar (fallback when no release object) */}
      {!readiness && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Launch readiness</span>
            <span className={`text-sm font-bold ${
              readinessPercentage >= 80 ? "text-emerald-400" :
              readinessPercentage >= 50 ? "text-amber-400" :
              "text-red-400"
            }`}>
              {readinessPercentage}%
            </span>
          </div>
          <ProgressBar
            value={readinessPercentage}
            size="md"
            accent={readinessPercentage < 70}
            label={`${completedRequired}/${requiredItems.length} required items done`}
          />
        </div>
      )}

      {/* Missing required items warning */}
      {missingRequired.length > 0 && (
        <div className="rounded-lg border border-red-500/15 bg-red-500/5 px-4 py-3">
          <p className="text-xs font-medium text-red-400">
            ⚠ {missingRequired.length} required item{missingRequired.length > 1 ? "s" : ""} not completed
          </p>
          <ul className="mt-2 space-y-1">
            {missingRequired.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="text-red-400/60">○</span>
                {item.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checklist items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
              item.completed
                ? "bg-emerald-500/5"
                : item.required
                  ? "bg-zinc-800/30"
                  : "bg-zinc-800/15"
            }`}
          >
            {/* Toggle button */}
            <button
              onClick={() => onToggle?.(item.id)}
              disabled={!onToggle || saving}
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-all ${
                item.completed
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                  : "border-zinc-600/50 bg-zinc-800/50 text-transparent hover:border-zinc-500 hover:bg-zinc-700/50"
              } ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              title={item.completed ? "Mark as incomplete" : "Mark as complete"}
            >
              {item.completed && <span className="text-[9px]">✓</span>}
            </button>
            <div className="min-w-0 flex-1">
              <span className={`text-xs ${
                item.completed ? "text-zinc-500 line-through" : "text-zinc-300"
              }`}>
                {item.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {item.required ? (
                <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                  Required
                </span>
              ) : (
                <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                  Optional
                </span>
              )}
              {/* Remove button */}
              {onRemove && (
                <button
                  onClick={() => onRemove(item.id)}
                  disabled={saving}
                  className={`flex h-5 w-5 items-center justify-center rounded text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all ${saving ? "cursor-not-allowed" : ""}`}
                  title="Remove item"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add new item */}
      {onAdd && (
        <div>
          {showAddForm ? (
            <div className="space-y-2 rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-3">
              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                placeholder="Task title..."
                className="w-full rounded-md border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <input
                    type="checkbox"
                    checked={newItemRequired}
                    onChange={(e) => setNewItemRequired(e.target.checked)}
                    className="rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500/40"
                  />
                  Required
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowAddForm(false); setNewItemTitle(""); }}
                    className="rounded-md px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!newItemTitle.trim() || saving}
                    className="rounded-md bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-800/40 px-3 py-2 text-[11px] text-zinc-500 hover:border-zinc-700/60 hover:text-zinc-300 transition-all"
            >
              <span className="text-sm leading-none">+</span>
              Add checklist item
            </button>
          )}
        </div>
      )}
    </div>
  );
}
