import type { Release } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";

interface ReleasesNeedingAttentionProps {
  releases: Release[];
  artistImages?: Record<string, string>;
  onSelect?: (releaseId: string) => void;
}

export function ReleasesNeedingAttention({ releases, artistImages = {}, onSelect }: ReleasesNeedingAttentionProps) {
  return (
    <div>
      <SectionHeader
        title="Needs Attention"
        subtitle="Releases requiring action"
      />
      <DashboardCard>
        <div className="space-y-3">
          {releases.length === 0 ? (
            <p className="text-xs text-zinc-600">All releases on track</p>
          ) : (
            releases.map((release) => {
              const imgUrl = artistImages[release.artistId];
              return (
                <div key={release.id} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} onClick={onSelect ? () => onSelect(release.id) : undefined} onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(release.id); } } : undefined} className={`flex items-start gap-3 ${onSelect ? 'cursor-pointer' : ''}`}>
                  <span className="mt-0.5 flex-shrink-0 text-xs text-amber-400">⚠</span>
                  {imgUrl && (
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
                      <img
                        src={imgUrl}
                        alt={release.artist}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white">
                      {release.catalogNumber} — {release.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">{release.artist}</p>
                    <p className="text-[10px] text-zinc-600">
                      Readiness: {release.readinessPercentage}%
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DashboardCard>
    </div>
  );
}
