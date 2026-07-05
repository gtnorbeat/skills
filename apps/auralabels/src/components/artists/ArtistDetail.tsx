import { useState, useEffect, useRef, useCallback } from "react";
import type { Artist, Contract } from "@/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCardDelete } from "@/hooks/useCardDelete";
import { fetchContracts, updateArtist, deleteArtist } from "@/utils/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FileUploader } from "@/components/ui/FileUploader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDate } from "@/utils/dateHelpers";
import { getContractStatusColor, CONTRACT_STATUS_LABELS } from "@/utils/statusHelpers";

interface ArtistDetailProps {
  artist: Artist;
  onClose: () => void;
  onUpdated?: (artist: Artist) => void;
  onDeleted?: (id: string) => void;
}

export function ArtistDetail({ artist, onClose, onUpdated, onDeleted }: ArtistDetailProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardDelete = useCardDelete({
    api: () => deleteArtist(artist.id),
    onSuccess: onClose,
    onDeleted: () => onDeleted?.(artist.id),
    onError: setError,
    fallbackMessage: "Delete failed",
  });

  // Always-editable form state
  const [formName, setFormName] = useState(artist.name);
  const [formStatus, setFormStatus] = useState(artist.status);
  const [formLabel, setFormLabel] = useState(artist.label);
  const [formImageUrl, setFormImageUrl] = useState(artist.imageUrl ?? "");
  const [formSignedSince, setFormSignedSince] = useState(artist.signedSince);
  const [formBio, setFormBio] = useState(artist.bio);
  const [formGenres, setFormGenres] = useState<string[]>(artist.genres);
  const [formSocialLinks, setFormSocialLinks] = useState<{platform: string; url: string}[]>(artist.socialLinks);
  const [genreInput, setGenreInput] = useState("");
  const [newLinkPlatform, setNewLinkPlatform] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  useEffect(() => {
    fetchContracts().then((all) => {
      setContracts(all.filter((c) => c.artistId === artist.id));
    }).catch(() => {});
  }, [artist.id]);

  const missingCount = artist.missingInfo?.length ?? 0;
  const profileCompleteness = Math.max(0, 100 - missingCount * 25);

  const isDirty =
    formName !== artist.name ||
    formStatus !== artist.status ||
    formLabel !== artist.label ||
    formImageUrl !== (artist.imageUrl ?? "") ||
    formSignedSince !== artist.signedSince ||
    formBio !== artist.bio ||
    JSON.stringify(formGenres) !== JSON.stringify(artist.genres) ||
    JSON.stringify(formSocialLinks) !== JSON.stringify(artist.socialLinks);

  const panelRef = useRef<HTMLDivElement>(null);
  const handleModalEsc = useCallback(() => {
    if (cardDelete.confirming) {
      cardDelete.cancelDelete();
      return;
    }
    onClose();
  }, [cardDelete.confirming, cardDelete.cancelDelete, onClose]);
  useFocusTrap(panelRef, true, handleModalEsc);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    if (!formImageUrl.trim()) {
      setError("A photo is required — upload an image or paste a URL");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateArtist(artist.id, {
        name: formName.trim(),
        status: formStatus,
        label: formLabel,
        imageUrl: formImageUrl,
        signedSince: formSignedSince,
        bio: formBio,
        genres: formGenres,
        socialLinks: formSocialLinks,
      });
      onUpdated?.(updated);
      // Sync local form state with server response
      setFormName(updated.name);
      setFormStatus(updated.status);
      setFormLabel(updated.label);
      setFormImageUrl(updated.imageUrl ?? "");
      setFormSignedSince(updated.signedSince);
      setFormBio(updated.bio);
      setFormGenres(updated.genres);
      setFormSocialLinks(updated.socialLinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addGenre() {
    const trimmed = genreInput.trim();
    if (trimmed && !formGenres.includes(trimmed)) {
      setFormGenres([...formGenres, trimmed]);
    }
    setGenreInput("");
  }

  function removeGenre(genre: string) {
    setFormGenres(formGenres.filter((g) => g !== genre));
  }

  function addSocialLink() {
    if (newLinkPlatform.trim() && newLinkUrl.trim()) {
      setFormSocialLinks([...formSocialLinks, { platform: newLinkPlatform.trim(), url: newLinkUrl.trim() }]);
      setNewLinkPlatform("");
      setNewLinkUrl("");
    }
  }

  function removeSocialLink(index: number) {
    setFormSocialLinks(formSocialLinks.filter((_, i) => i !== index));
  }

  if (cardDelete.confirming) {
    return (
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Delete artist confirmation" className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cardDelete.cancelDelete} />
        <div className="relative w-full max-w-sm rounded-xl border border-red-800/40 bg-zinc-950 p-6 shadow-2xl">
          {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5"><p className="text-xs text-red-400">{error}</p></div>}
          <h3 className="text-sm font-semibold text-white">Delete Artist</h3>
          <p className="mt-2 text-xs text-zinc-400">Are you sure you want to delete <span className="font-medium text-zinc-200">{artist.name}</span>? This action cannot be undone.</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button onClick={cardDelete.cancelDelete} className="rounded-lg px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={cardDelete.performDelete} disabled={cardDelete.deleting} className="rounded-lg bg-red-500/15 px-4 py-2 text-xs font-medium text-red-400 transition-all hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed">{cardDelete.deleting ? "Deleting..." : "Delete"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Artist details for ${artist.name}`} className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="detail-panel relative h-full w-full max-w-full overflow-y-auto border-l border-zinc-800/60 bg-zinc-950 shadow-2xl sm:max-w-lg">
        {/* Header — Save Changes + Done */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/40 bg-zinc-950/80 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 ring-1 ring-zinc-700/50">
              {formImageUrl ? (
                <img src={formImageUrl} alt={artist.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-base font-bold text-cyan-400">{artist.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{artist.name}</h2>
              <p className="text-[11px] text-zinc-500 capitalize">{formStatus}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="submit"
              form="artist-form"
              disabled={saving || !formName.trim() || !isDirty}
              className="rounded-lg bg-cyan-500/10 px-3.5 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/50 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
          </div>
        </div>

        <form id="artist-form" onSubmit={handleSave} className="space-y-5 px-6 py-6">
          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5"><p className="text-xs text-red-400">{error}</p></div>}

          {/* Profile completeness */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Profile completeness</span>
              <span className={`text-xs font-semibold ${profileCompleteness < 75 ? "text-amber-400" : "text-emerald-400"}`}>{profileCompleteness}%</span>
            </div>
            <ProgressBar value={profileCompleteness} size="md" accent={profileCompleteness < 75} />
          </div>

          {/* Missing info */}
          {artist.missingInfo && missingCount > 0 && (
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-400">⚠ Missing Information</h4>
              <div className="space-y-2">
                {artist.missingInfo.map((info, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-2.5">
                    <span className="text-amber-400/60">!</span>
                    <div><p className="text-xs font-medium text-zinc-300">{info.description}</p><p className="text-[10px] text-zinc-600">Field: {info.field}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Name</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>

          {/* Label */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Label</label>
            <input type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</label>
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as Artist["status"])} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="signed">Signed</option>
              <option value="prospect">Prospect</option>
            </select>
          </div>

          {/* Photo */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Photo</label>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <input type="text" value={formImageUrl} onChange={(e) => setFormImageUrl(e.target.value)} placeholder="https://... or upload below" className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
              </div>
              <FileUploader folder="avatars" entityId={artist.id} onUpload={(url) => setFormImageUrl(url)} />
            </div>
            {formImageUrl && (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-3 py-2">
                <img src={formImageUrl} alt="Preview" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover ring-1 ring-zinc-700/50" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span className="text-[11px] text-zinc-500 truncate">{formImageUrl}</span>
              </div>
            )}
          </div>

          {/* Signed since */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Signed Since</label>
            <input type="date" value={formSignedSince} onChange={(e) => setFormSignedSince(e.target.value)} className="w-full rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>

          {/* Genres */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Genres</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {formGenres.map((genre) => (
                <span key={genre} className="inline-flex items-center gap-1 rounded-md bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                  {genre}
                  <button type="button" onClick={() => removeGenre(genre)} className="text-zinc-500 hover:text-red-400 transition-colors">✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={genreInput} onChange={(e) => setGenreInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGenre(); } }} placeholder="Add a genre..." className="flex-1 rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
              <button type="button" onClick={addGenre} disabled={!genreInput.trim()} className="rounded-lg bg-zinc-800/50 px-3 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors disabled:opacity-40">+ Add</button>
            </div>
          </div>

          {/* Social Links */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Social Links</label>
            <div className="space-y-2 mb-2">
              {formSocialLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-3 py-2">
                  <span className="min-w-[80px] text-[11px] font-medium text-zinc-400">{link.platform}</span>
                  <span className="flex-1 truncate text-[11px] text-zinc-500">{link.url}</span>
                  <button type="button" onClick={() => removeSocialLink(i)} className="text-zinc-600 hover:text-red-400 transition-colors text-[10px]">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newLinkPlatform} onChange={(e) => setNewLinkPlatform(e.target.value)} placeholder="Platform (e.g. Instagram)" className="flex-1 rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
              <input type="url" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="https://..." className="flex-[2] rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
              <button type="button" onClick={addSocialLink} disabled={!newLinkPlatform.trim() || !newLinkUrl.trim()} className="rounded-lg bg-zinc-800/50 px-3 text-xs text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors disabled:opacity-40 shrink-0">+ Add</button>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">Biography</label>
            <textarea value={formBio} onChange={(e) => setFormBio(e.target.value)} rows={4} className="w-full resize-none rounded-lg border border-zinc-800/60 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20" />
          </div>

          {/* Contracts (read-only summary) */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Contracts ({contracts.length})</h4>
            <div className="space-y-2">
              {contracts.length === 0 ? (
                <p className="text-xs text-zinc-600">No contracts</p>
              ) : (
                contracts.map((contract) => (
                  <div key={contract.id} className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge label={CONTRACT_STATUS_LABELS[contract.status]} colorClass={getContractStatusColor(contract.status)} />
                      <span className="text-[10px] capitalize text-zinc-500">{contract.type.replace("_", " ")}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-zinc-400">{contract.revenueShare}/{100 - contract.revenueShare} split</p>
                    {contract.notes && <p className="mt-1 text-[10px] text-zinc-600">{contract.notes}</p>}
                    {contract.expiryDate && <p className="mt-1 text-[10px] text-zinc-600">Expires: {formatDate(contract.expiryDate)}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Delete */}
          <div className="border-t border-zinc-800/40 pt-4">
            <button type="button" onClick={cardDelete.requestDelete} className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors">Delete artist</button>
          </div>

          {/* Mobile sticky-bottom bar */}
          <div className="sticky bottom-0 -mx-6 mt-2 flex items-center justify-end gap-2 border-t border-zinc-800/60 bg-zinc-950/95 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:hidden">
            <button type="submit" disabled={saving || !formName.trim() || !isDirty} className="min-h-[44px] rounded-lg bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Changes"}</button>
            <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-800/50 text-sm text-zinc-400 hover:bg-zinc-700/50 hover:text-white transition-colors" title="Done">✓</button>
          </div>
        </form>
      </div>
    </div>
  );
}
