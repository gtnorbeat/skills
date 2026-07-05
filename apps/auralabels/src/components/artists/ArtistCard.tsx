import type { Artist } from "@/types";
import { ProgressRing } from "@/components/ui/ProgressRing";

interface ArtistCardProps {
  artist: Artist;
  onClick: () => void;
  onDelete?: () => void;
}

export function ArtistCard({ artist, onClick, onDelete }: ArtistCardProps) {
  const missingCount = artist.missingInfo?.length ?? 0;
  const hasMissingInfo = missingCount > 0;
  const hasPhoto = !!artist.imageUrl;
  // Profile completeness: 4 tracked categories (bio, photo, instagram, IPI);
  // each missingInfo item represents one missing category.
  const profilePct = Math.max(0, Math.min(100, 100 - missingCount * 25));

  return (
    <article className="group relative w-full rounded-xl border border-zinc-800/60 bg-zinc-900/40 aura-card-lift p-5 text-left transition-all duration-300 hover:border-zinc-700/60 hover:bg-zinc-900/80">
      {/* Quick-action overlay — delete only; status workflow is captured in
          the ArtistDetail panel where the artist.status <select> lives.
          Visible on hover + always on focus-within so keyboard users can
          reach the button without a mouse. Hover-only would lock out
          touch devices that have no hovered state. */}
      {onDelete && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label={`Delete artist ${artist.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900/70 text-[11px] text-zinc-500 hover:bg-red-500/15 hover:text-red-400 transition-colors"
          >
            🗑
          </button>
        </div>
      )}

      {/* Clickable content — separate <div role="button"> so the action
          <button> above stays a valid sibling, not a nested interactive. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/40 rounded-lg"
      >
        {/* Profile ring + warning top-right (was here before; sits in a
            different position relative to the new overlay so it never
            collides with the delete button). */}
        <div className="absolute right-3 top-3 flex items-center gap-2 pointer-events-none">
          {hasMissingInfo && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              ⚠ {missingCount}
            </span>
          )}
          <ProgressRing value={profilePct} size={32} hideLabel ariaLabel={`Profile ${profilePct}% complete`} />
        </div>

        {/* Avatar */}
        <div className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 ring-1 ring-zinc-700/50 transition-all duration-300 group-hover:ring-cyan-500/30">
          {hasPhoto ? (
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-lg font-bold text-zinc-400 group-hover:text-cyan-400">
              {artist.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Info */}
        <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors duration-200">
          {artist.name}
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {artist.genres.slice(0, 2).join(" • ")}
        </p>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-4 border-t border-zinc-800/40 pt-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Releases
            </p>
            <p className="text-sm font-semibold text-zinc-300">{artist.totalReleases}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Signed
            </p>
            <p className="text-sm font-semibold text-zinc-300">{artist.signedSince?.split("-")[0] ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              Status
            </p>
            <p className="text-sm font-semibold capitalize text-emerald-400">{artist.status}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
