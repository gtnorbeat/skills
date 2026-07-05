import { useState, useEffect, useRef, useCallback } from "react";
import type { Contract, Artist } from "@/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCardDelete } from "@/hooks/useCardDelete";
import { fetchArtist, updateContract, deleteContract } from "@/utils/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatDate, isOverdue } from "@/utils/dateHelpers";
import { CONTRACT_STATUS_LABELS, getContractStatusColor, CONTRACT_TYPE_LABELS } from "@/utils/statusHelpers";

interface ContractDetailProps {
  contract: Contract;
  onClose: () => void;
  onUpdated?: (contract: Contract) => void;
  onDeleted?: (id: string) => void;
}

type ContractType = "exclusive" | "non_exclusive" | "distribution" | "licensing";
type ContractStatus = "draft" | "sent" | "signed" | "expired" | "terminated";

export function ContractDetail({ contract, onClose, onUpdated, onDeleted }: ContractDetailProps) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loadingArtist, setLoadingArtist] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardDelete = useCardDelete({
    api: () => deleteContract(contract.id),
    onSuccess: onClose,
    onDeleted: () => onDeleted?.(contract.id),
    onError: setError,
    fallbackMessage: "Delete failed",
  });

  // Always-editable form state
  const [formType, setFormType] = useState<ContractType>(contract.type);
  const [formStatus, setFormStatus] = useState<ContractStatus>(contract.status);
  const [formPriority, setFormPriority] = useState(contract.priority);
  const [formRevenueShare, setFormRevenueShare] = useState(contract.revenueShare);
  const [formValue, setFormValue] = useState(contract.value);
  const [formRights, setFormRights] = useState(contract.rights);
  const [formGdprStatus, setFormGdprStatus] = useState(contract.gdprStatus);
  const [formIpiStatus, setFormIpiStatus] = useState(contract.ipiStatus);
  const [formNotes, setFormNotes] = useState(contract.notes);
  const [formSignedDate, setFormSignedDate] = useState(contract.signedDate ?? "");
  const [formExpiryDate, setFormExpiryDate] = useState(contract.expiryDate ?? "");
  const [formNextAction, setFormNextAction] = useState(contract.nextAction ?? "");

  const contractExpired = contract.expiryDate && isOverdue(contract.expiryDate);
  const hasMissingData = (contract.missingData?.length ?? 0) > 0;

  const isDirty =
    formType !== contract.type ||
    formStatus !== contract.status ||
    formPriority !== contract.priority ||
    formRevenueShare !== contract.revenueShare ||
    formValue !== contract.value ||
    formRights !== contract.rights ||
    formGdprStatus !== contract.gdprStatus ||
    formIpiStatus !== contract.ipiStatus ||
    formNotes !== contract.notes ||
    formSignedDate !== (contract.signedDate ?? "") ||
    formExpiryDate !== (contract.expiryDate ?? "") ||
    formNextAction !== (contract.nextAction ?? "");

  const panelRef = useRef<HTMLDivElement>(null);
  const handleModalEsc = useCallback(() => {
    if (cardDelete.confirming) { cardDelete.cancelDelete(); return; }
    onClose();
  }, [cardDelete.confirming, cardDelete.cancelDelete, onClose]);
  useFocusTrap(panelRef, true, handleModalEsc);

  useEffect(() => {
    if (contract.artistId) {
      setLoadingArtist(true);
      fetchArtist(contract.artistId).then((a) => setArtist(a)).catch(() => setArtist(null)).finally(() => setLoadingArtist(false));
    } else { setLoadingArtist(false); }
  }, [contract.artistId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updateContract(contract.id, {
        type: formType, status: formStatus, priority: formPriority,
        revenueShare: formRevenueShare, value: formValue, rights: formRights,
        gdprStatus: formGdprStatus, ipiStatus: formIpiStatus, notes: formNotes,
        signedDate: formSignedDate || null, expiryDate: formExpiryDate || null, nextAction: formNextAction || null,
      });
      onUpdated?.(updated);
      // Sync local form state with server response
      setFormType(updated.type);
      setFormStatus(updated.status);
      setFormPriority(updated.priority);
      setFormRevenueShare(updated.revenueShare);
      setFormValue(updated.value);
      setFormRights(updated.rights);
      setFormGdprStatus(updated.gdprStatus);
      setFormIpiStatus(updated.ipiStatus);
      setFormNotes(updated.notes);
      setFormSignedDate(updated.signedDate ?? "");
      setFormExpiryDate(updated.expiryDate ?? "");
      setFormNextAction(updated.nextAction ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  }

  if (cardDelete.confirming) {
    return (
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Delete contract confirmation" className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cardDelete.cancelDelete} />
        <div className="relative w-full max-w-sm rounded-xl border border-red-800/40 bg-zinc-950 p-6 shadow-2xl">
          {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5"><p className="text-xs text-red-400">{error}</p></div>}
          <h3 className="text-sm font-semibold text-white">Delete Contract</h3>
          <p className="mt-2 text-xs text-zinc-400">Are you sure you want to delete the contract with <span className="font-medium text-zinc-200">{contract.artist}</span>? This action cannot be undone.</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button onClick={cardDelete.cancelDelete} className="rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={cardDelete.performDelete} disabled={cardDelete.deleting} className="rounded-lg bg-red-500/15 px-4 py-2 text-xs font-medium text-red-400 transition-all hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed">{cardDelete.deleting ? "Deleting..." : "Delete"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Contract details for ${contract.artist}`} className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="detail-panel relative h-full w-full max-w-full overflow-y-auto border-l border-zinc-800/60 bg-zinc-950 shadow-2xl sm:max-w-lg">
        {/* Header — Save Changes + Done */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/40 bg-zinc-950/80 px-6 py-4 backdrop-blur-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={CONTRACT_STATUS_LABELS[formStatus]} colorClass={getContractStatusColor(formStatus)} />
              <PriorityBadge priority={formPriority} />
              {contractExpired && <span className="text-[10px] font-medium text-red-400">Expired</span>}
            </div>
            <h2 className="mt-1 text-base font-semibold text-white">{contract.artist}</h2>
            <p className="text-xs text-zinc-500 capitalize">{CONTRACT_TYPE_LABELS[formType]} Agreement</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button type="submit" form="contract-form" disabled={saving || !isDirty} className="rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Changes"}</button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
          </div>
        </div>

        <form id="contract-form" onSubmit={handleSave} className="space-y-5 px-6 py-6">
          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5"><p className="text-xs text-red-400">{error}</p></div>}

          {/* Missing data warning */}
          {hasMissingData && (
            <div>
              <SectionHeader title="Missing Information" subtitle="Required data not yet collected" />
              <div className="space-y-2">
                {contract.missingData!.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-2.5"><span className="text-amber-400/60">!</span><p className="text-xs font-medium text-zinc-300">{item.description}</p></div>
                ))}
              </div>
            </div>
          )}

          {/* Type */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Type</label>
            <select value={formType} onChange={(e) => setFormType(e.target.value as ContractType)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
              <option value="exclusive">Exclusive</option><option value="non_exclusive">Non-Exclusive</option><option value="distribution">Distribution</option><option value="licensing">Licensing</option>
            </select>
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</label>
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as ContractStatus)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
                <option value="draft">Draft</option><option value="sent">Sent</option><option value="signed">Signed</option><option value="expired">Expired</option><option value="terminated">Terminated</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Priority</label>
              <select value={formPriority} onChange={(e) => setFormPriority(e.target.value as Contract["priority"])} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Revenue + Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Revenue Share (%)</label>
              <input type="number" min={0} max={100} value={formRevenueShare} onChange={(e) => setFormRevenueShare(parseInt(e.target.value, 10) || 0)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Value (€)</label>
              <input type="number" min={0} value={formValue} onChange={(e) => setFormValue(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Signed Date</label>
              <input type="date" value={formSignedDate} onChange={(e) => setFormSignedDate(e.target.value)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Expiry Date</label>
              <input type="date" value={formExpiryDate} onChange={(e) => setFormExpiryDate(e.target.value)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
            </div>
          </div>

          {/* Rights */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Rights & License Terms</label>
            <textarea value={formRights} onChange={(e) => setFormRights(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>

          {/* GDPR + IPI */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">GDPR</label>
              <select value={formGdprStatus} onChange={(e) => setFormGdprStatus(e.target.value as Contract["gdprStatus"])} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
                <option value="compliant">Compliant</option><option value="pending">Pending</option><option value="not_applicable">N/A</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">IPI</label>
              <select value={formIpiStatus} onChange={(e) => setFormIpiStatus(e.target.value as Contract["ipiStatus"])} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
                <option value="registered">Registered</option><option value="pending">Pending</option><option value="not_submitted">Not Submitted</option>
              </select>
            </div>
          </div>

          {/* Next action */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Next Action</label>
            <input type="text" value={formNextAction} onChange={(e) => setFormNextAction(e.target.value)} placeholder="e.g. Follow up with artist" className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Notes</label>
            <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>

          {/* Key details (read-only summary) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Revenue Split</p>
              <p className="mt-1 text-sm font-semibold text-white">{contract.revenueShare}/{100 - contract.revenueShare}</p>
            </div>
            {contract.signedDate && (
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Signed</p>
                <p className="mt-1 text-sm font-semibold text-white">{formatDate(contract.signedDate)}</p>
              </div>
            )}
            {contract.expiryDate && (
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Expiry</p>
                <p className={`mt-1 text-sm font-semibold ${contractExpired ? "text-red-400" : "text-white"}`}>{formatDate(contract.expiryDate)}{contractExpired && " (expired)"}</p>
              </div>
            )}
            {contract.value > 0 && (
              <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Value</p>
                <p className="mt-1 text-sm font-semibold text-emerald-400">€{contract.value.toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Connected artist */}
          {loadingArtist ? (
            <div className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-zinc-800" />
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
            </div>
          ) : artist ? (
            <div>
              <SectionHeader title="Artist" />
              <div className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900"><span className="text-sm font-bold text-cyan-400">{artist.name.charAt(0)}</span></div>
                <div><p className="text-sm font-medium text-white">{artist.name}</p><p className="text-[11px] text-zinc-500">{artist.genres.slice(0, 2).join(" • ")}</p></div>
              </div>
            </div>
          ) : null}

          {/* Document */}
          <div>
            <SectionHeader title="Document" />
            <div className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
              <span className="text-lg text-zinc-600">◇</span>
              {contract.fileUrl ? (
                <div><p className="text-xs font-medium text-zinc-300">Contract on file</p><p className="text-[10px] text-zinc-600">{contract.fileUrl}</p></div>
              ) : (
                <p className="text-xs italic text-zinc-600">No document uploaded yet</p>
              )}
            </div>
          </div>

          {/* Next action display */}
          {contract.nextAction && (
            <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-amber-400">Next Action</p>
              <p className="mt-1 text-sm text-amber-200">{contract.nextAction}</p>
            </div>
          )}

          {/* Delete */}
          <div className="border-t border-zinc-800/40 pt-4">
            <button type="button" onClick={cardDelete.requestDelete} className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors">Delete contract</button>
          </div>

          {/* Mobile sticky-bottom bar */}
          <div className="sticky bottom-0 -mx-6 mt-2 flex items-center justify-end gap-2 border-t border-zinc-800/60 bg-zinc-950/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:hidden">
            <button type="submit" disabled={saving || !isDirty} className="min-h-[44px] rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Changes"}</button>
            <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800/50 text-sm text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
          </div>
        </form>
      </div>
    </div>
  );
}
