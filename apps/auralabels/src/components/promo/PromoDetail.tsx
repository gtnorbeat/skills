import { useState, useEffect, useRef, useCallback } from "react";
import type { PromoCampaign, PromoChecklistStatus, CampaignChecklistItem, Release } from "@/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { fetchRelease } from "@/utils/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CAMPAIGN_STATUS_LABELS, getCampaignStatusColor } from "@/utils/statusHelpers";

interface PromoDetailProps {
  campaign: PromoCampaign;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<PromoCampaign>) => Promise<void>;
}

const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", done: "Done", n_a: "N/A",
};

const CHECKLIST_CYCLE: PromoChecklistStatus[] = ["not_started", "in_progress", "done", "n_a"];

function getChecklistColor(status: string): string {
  switch (status) {
    case "done": return "bg-emerald-500/20 text-emerald-400";
    case "in_progress": return "bg-blue-500/20 text-blue-400";
    case "not_started": return "bg-zinc-500/15 text-zinc-500";
    case "n_a": return "bg-zinc-500/10 text-zinc-600";
    default: return "bg-zinc-500/15 text-zinc-500";
  }
}

function getChecklistIcon(status: string): string {
  switch (status) {
    case "done": return "✓";
    case "in_progress": return "◐";
    case "not_started": return "○";
    case "n_a": return "—";
    default: return "○";
  }
}

const CAMPAIGN_STATUSES: PromoCampaign["status"][] = ["planning", "active", "paused", "completed"];
const PRIORITIES: PromoCampaign["priority"][] = ["low", "medium", "high", "critical"];

function calculateReadiness(checklist: CampaignChecklistItem[]): number {
  const required = checklist.filter((i) => i.required);
  if (required.length === 0) return 0;
  const done = required.filter((i) => i.status === "done").length;
  return Math.round((done / required.length) * 100);
}

export function PromoDetail({ campaign, onClose, onUpdate }: PromoDetailProps) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PromoCampaign>(() => ({ ...campaign }));
  const [release, setRelease] = useState<Release | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);

  useEffect(() => {
    if (!campaign.releaseId) { setRelease(null); return; }
    let cancelled = false;
    setReleaseLoading(true);
    fetchRelease(campaign.releaseId)
      .then((r) => { if (!cancelled) setRelease(r); })
      .catch(() => { if (!cancelled) setRelease(null); })
      .finally(() => { if (!cancelled) setReleaseLoading(false); });
    return () => { cancelled = true; };
  }, [campaign.releaseId]);

  const panelRef = useRef<HTMLDivElement>(null);
  const handleModalEsc = useCallback(() => { onClose(); }, [onClose]);
  useFocusTrap(panelRef, true, handleModalEsc);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(campaign);

  const checklistItems = [
    { key: "promoPoolStatus" as const, label: "Promo Pool" },
    { key: "djFeedbackStatus" as const, label: "DJ Feedback" },
    { key: "instagramContentStatus" as const, label: "Instagram Content" },
    { key: "youtubeTeaserStatus" as const, label: "YouTube Teaser" },
    { key: "beatportFeaturePitchStatus" as const, label: "Beatport Feature" },
    { key: "spotifyPitchStatus" as const, label: "Spotify Pitch" },
    { key: "emailBlastStatus" as const, label: "Email Blast" },
  ];

  function cycleStatus(current: PromoChecklistStatus): PromoChecklistStatus {
    const idx = CHECKLIST_CYCLE.indexOf(current);
    return CHECKLIST_CYCLE[(idx + 1) % CHECKLIST_CYCLE.length];
  }

  function updateField<K extends keyof PromoCampaign>(key: K, value: PromoCampaign[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const recalculatedReadiness = calculateReadiness(draft.campaignChecklist);
      const data: Partial<PromoCampaign> = {
        name: draft.name, status: draft.status, priority: draft.priority, startDate: draft.startDate, endDate: draft.endDate,
        budget: draft.budget, platforms: draft.platforms,
        promoPoolStatus: draft.promoPoolStatus, djFeedbackStatus: draft.djFeedbackStatus,
        instagramContentStatus: draft.instagramContentStatus, youtubeTeaserStatus: draft.youtubeTeaserStatus,
        beatportFeaturePitchStatus: draft.beatportFeaturePitchStatus, spotifyPitchStatus: draft.spotifyPitchStatus,
        emailBlastStatus: draft.emailBlastStatus, campaignChecklist: draft.campaignChecklist,
        missingContent: draft.missingContent, nextAction: draft.nextAction, readinessPercentage: recalculatedReadiness,
      };
      await onUpdate(campaign.id, data);
    } catch (err) { console.error("Save failed:", err); }
    finally { setSaving(false); }
  }

  function addPlatform(platform: string) {
    if (!platform.trim() || draft.platforms.includes(platform.trim())) return;
    updateField("platforms", [...draft.platforms, platform.trim()]);
  }

  function removePlatform(platform: string) {
    updateField("platforms", draft.platforms.filter((p) => p !== platform));
  }

  function addMissingItem(item: string) {
    if (!item.trim() || draft.missingContent.includes(item.trim())) return;
    updateField("missingContent", [...draft.missingContent, item.trim()]);
  }

  function removeMissingItem(item: string) {
    updateField("missingContent", draft.missingContent.filter((i) => i !== item));
  }

  function cycleChecklistItem(itemId: string) {
    setDraft((prev) => ({ ...prev, campaignChecklist: prev.campaignChecklist.map((item) => item.id === itemId ? { ...item, status: cycleStatus(item.status) } : item) }));
  }

  function addChecklistItem(title: string) {
    if (!title.trim()) return;
    const newItem: CampaignChecklistItem = { id: `cp-check-${Date.now()}`, title: title.trim(), status: "not_started", required: false };
    updateField("campaignChecklist", [...draft.campaignChecklist, newItem]);
  }

  function removeChecklistItem(itemId: string) {
    updateField("campaignChecklist", draft.campaignChecklist.filter((i) => i.id !== itemId));
  }

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Edit campaign ${draft.name}`} className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="detail-panel relative h-full w-full max-w-full overflow-y-auto border-l border-zinc-800/60 bg-zinc-950 shadow-2xl sm:max-w-lg">
        {/* Header — Save Changes + Done */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/40 bg-zinc-950/80 px-6 py-4 backdrop-blur-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusBadge label={CAMPAIGN_STATUS_LABELS[draft.status]} colorClass={getCampaignStatusColor(draft.status)} pulse={draft.status === "active"} />
              <PriorityBadge priority={draft.priority} />
            </div>
            <input type="text" value={draft.name} onChange={(e) => updateField("name", e.target.value)} className="mt-1 w-full rounded-md border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-1 text-base font-semibold text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
            <p className="text-xs text-zinc-500">{draft.artist}</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button onClick={handleSave} disabled={saving || !isDirty} className="rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Changes"}</button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {/* Readiness */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Campaign Readiness</span>
              <span className={`text-lg font-bold ${calculateReadiness(draft.campaignChecklist) >= 70 ? "text-emerald-400" : calculateReadiness(draft.campaignChecklist) >= 40 ? "text-amber-400" : "text-red-400"}`}>{calculateReadiness(draft.campaignChecklist)}%</span>
            </div>
            <ProgressBar value={calculateReadiness(draft.campaignChecklist)} size="md" accent={calculateReadiness(draft.campaignChecklist) < 50} />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">Status</label>
              <select value={draft.status} onChange={(e) => updateField("status", e.target.value as PromoCampaign["status"])} className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-xs text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
                {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{CAMPAIGN_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">Priority</label>
              <select value={draft.priority} onChange={(e) => updateField("priority", e.target.value as PromoCampaign["priority"])} className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-xs text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Dates & Budget */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Start</label>
              <input type="date" value={draft.startDate} onChange={(e) => updateField("startDate", e.target.value)} className="mt-1 w-full rounded border border-zinc-700/50 bg-zinc-800/50 px-2 py-1 text-sm font-semibold text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
            </div>
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">End</label>
              <input type="date" value={draft.endDate} onChange={(e) => updateField("endDate", e.target.value)} className="mt-1 w-full rounded border border-zinc-700/50 bg-zinc-800/50 px-2 py-1 text-sm font-semibold text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
            </div>
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Budget</label>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-sm text-zinc-500">€</span>
                <input type="number" value={draft.budget} onChange={(e) => updateField("budget", Number(e.target.value))} className="w-full rounded border border-zinc-700/50 bg-zinc-800/50 px-2 py-1 text-sm font-semibold text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
              </div>
            </div>
          </div>

          {/* Platforms */}
          <div>
            <SectionHeader title="Platforms" />
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {draft.platforms.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 rounded-md bg-zinc-800/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300">{p}<button onClick={() => removePlatform(p)} className="text-zinc-600 hover:text-red-400 transition-colors">✕</button></span>
                ))}
              </div>
              <PlatformInput onAdd={addPlatform} />
            </div>
          </div>

          {/* Promo Checklist */}
          <div>
            <SectionHeader title="Promo Checklist" />
            <div className="space-y-1.5">
              {checklistItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-2.5 cursor-pointer hover:border-zinc-700/60 transition-colors" onClick={() => updateField(item.key, cycleStatus(draft[item.key]))}>
                  <span className="text-xs text-zinc-300">{item.label}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${getChecklistColor(draft[item.key])}`}>
                    <span>{getChecklistIcon(draft[item.key])}</span>
                    {CHECKLIST_STATUS_LABELS[draft[item.key]]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Full checklist */}
          <div>
            <div className="flex items-center justify-between">
              <SectionHeader title="All Tasks" />
              <span className="text-[10px] text-zinc-600">Click to cycle status</span>
            </div>
            <div className="space-y-1.5">
              {draft.campaignChecklist.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-2.5 cursor-pointer hover:border-zinc-700/60 transition-colors" onClick={() => cycleChecklistItem(item.id)}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`text-xs flex-shrink-0 ${item.status === "done" ? "text-emerald-400" : item.status === "in_progress" ? "text-blue-400" : "text-zinc-600"}`}>{getChecklistIcon(item.status)}</span>
                    <span className={`text-xs truncate ${item.status === "done" ? "text-zinc-500 line-through" : "text-zinc-300"}`}>{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">{item.required ? "Required" : "Optional"}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeChecklistItem(item.id); }} className="text-zinc-600 hover:text-red-400 transition-colors">✕</button>
                  </div>
                </div>
              ))}
              <ChecklistItemInput onAdd={addChecklistItem} />
            </div>
          </div>

          {/* Missing content */}
          {draft.missingContent.length > 0 && (
            <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Missing Content</p>
              <div className="mt-2 space-y-2">
                {draft.missingContent.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[11px] text-zinc-400"><span className="text-amber-400/60">!</span>{item}</span>
                    <button onClick={() => removeMissingItem(item)} className="text-zinc-600 hover:text-red-400 transition-colors">✕</button>
                  </div>
                ))}
                <MissingInput onAdd={addMissingItem} />
              </div>
            </div>
          )}

          {/* Next action */}
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400">Next Action</p>
            <textarea value={draft.nextAction} onChange={(e) => updateField("nextAction", e.target.value)} rows={2} className="mt-1 w-full rounded border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-1.5 text-sm text-amber-200 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 resize-none" />
          </div>

          {/* Connected release */}
          {campaign.releaseId && (
            <div>
              <SectionHeader title="Connected Release" />
              {releaseLoading ? (
                <div className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                  <div className="flex flex-col gap-2"><div className="h-3 w-32 animate-pulse rounded bg-zinc-800" /><div className="h-2.5 w-24 animate-pulse rounded bg-zinc-800/60" /></div>
                  <div className="h-2 w-2 animate-pulse rounded-full bg-zinc-700" />
                </div>
              ) : release ? (
                <div className="flex items-center justify-between rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                  <div><p className="text-xs font-medium text-white">{release.title}</p><p className="text-[10px] text-zinc-600">{release.catalogNumber} • {release.artist}</p></div>
                  <span className={`h-2 w-2 rounded-full ${release.status === "scheduled" ? "bg-emerald-500" : release.status === "mastering" ? "bg-blue-500" : "bg-zinc-500"}`} />
                </div>
              ) : (
                <div className="rounded-lg border border-red-800/30 bg-red-500/5 px-4 py-3"><p className="text-[11px] text-zinc-500">Release not found (ID: {campaign.releaseId})</p></div>
              )}
            </div>
          )}

          {/* Performance */}
          {campaign.status === "active" && campaign.impressions > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Impressions</p>
                <p className="mt-1 text-lg font-bold text-white">{campaign.impressions.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Engagements</p>
                <p className="mt-1 text-lg font-bold text-white">{campaign.engagements.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Mobile sticky-bottom bar */}
          <div className="sticky bottom-0 -mx-6 mt-2 flex items-center justify-end gap-2 border-t border-zinc-800/60 bg-zinc-950/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:hidden">
            <button onClick={handleSave} disabled={saving || !isDirty} className="min-h-[44px] rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Changes"}</button>
            <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800/50 text-sm text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Inline sub-components ── */

function PlatformInput({ onAdd }: { onAdd: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onAdd(value); setValue(""); }} className="flex gap-1.5">
      <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add platform..." className="flex-1 rounded border border-zinc-700/50 bg-zinc-800/30 px-2.5 py-1 text-[11px] text-zinc-300 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
      <button type="submit" disabled={!value.trim()} className="rounded bg-zinc-700/50 px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-zinc-600/50 hover:text-white transition-colors disabled:opacity-40">+</button>
    </form>
  );
}

function MissingInput({ onAdd }: { onAdd: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onAdd(value); setValue(""); }} className="flex gap-1.5">
      <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add missing item..." className="flex-1 rounded border border-zinc-700/50 bg-zinc-800/30 px-2.5 py-1 text-[11px] text-zinc-300 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
      <button type="submit" disabled={!value.trim()} className="rounded bg-zinc-700/50 px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-zinc-600/50 hover:text-white transition-colors disabled:opacity-40">+</button>
    </form>
  );
}

function ChecklistItemInput({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onAdd(value); setValue(""); }} className="flex gap-1.5">
      <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add task..." className="flex-1 rounded border border-zinc-700/50 bg-zinc-800/30 px-2.5 py-1 text-[11px] text-zinc-300 placeholder-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
      <button type="submit" disabled={!value.trim()} className="rounded bg-zinc-700/50 px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-zinc-600/50 hover:text-white transition-colors disabled:opacity-40">+</button>
    </form>
  );
}
