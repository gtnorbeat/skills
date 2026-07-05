import type { Artist } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";

interface MissingArtistInfoProps {
  artists: Artist[];
  artistImages?: Record<string, string>;
  onSelect?: (artistId: string) => void;
}

export function MissingArtistInfo({ artists, artistImages = {}, onSelect }: MissingArtistInfoProps) {
  return (
    <div>
      <SectionHeader
        title="Missing Information"
        subtitle="Artist profiles incomplete"
      />
      <DashboardCard>
        <div className="space-y-3">
          {artists.length === 0 ? (
            <p className="text-xs text-zinc-600">All artist profiles complete</p>
          ) : (
            artists.map((artist) => {
              const imgUrl = artist.imageUrl || artistImages[artist.id];
              return (
                <div key={artist.id} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} onClick={onSelect ? () => onSelect(artist.id) : undefined} onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(artist.id); } } : undefined} className={`flex items-start gap-3 ${onSelect ? 'cursor-pointer' : ''}`}>
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={artist.name}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-[9px] font-medium text-zinc-500">
                        {artist.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white">{artist.name}</p>
                    <ul className="mt-1 space-y-0.5">
                      {(artist.missingInfo ?? []).map((info, i) => (
                        <li key={i} className="text-[10px] text-zinc-500">
                          • {info.description}
                        </li>
                      ))}
                    </ul>
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
