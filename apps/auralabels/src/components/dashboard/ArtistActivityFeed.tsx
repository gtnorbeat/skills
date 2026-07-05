import type { ArtistActivity } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { daysAgo } from "@/utils/dateHelpers";

interface ArtistActivityFeedProps {
  activity: ArtistActivity[];
  artistImages?: Record<string, string>;
}

export function ArtistActivityFeed({ activity, artistImages = {} }: ArtistActivityFeedProps) {
  return (
    <div>
      <SectionHeader
        title="Artist Activity"
        subtitle="Latest updates"
      />
      <DashboardCard>
        <div className="space-y-4">
          {activity.length === 0 ? (
            <p className="text-xs text-zinc-600">No recent activity</p>
          ) : (
            activity.map((item, i) => {
              const imgUrl = artistImages[item.artistId];
              return (
                <div key={`${item.artistId}-${item.timestamp}`} className={`aura-enter-fade-up aura-stagger-${(i % 6) + 1} flex items-start gap-3`}>
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.artistName}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-[10px] font-medium text-zinc-400">
                        {item.artistName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-300">
                      <span className="font-medium text-white">{item.artistName}</span>{" "}
                      {item.action}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-600">
                      {daysAgo(item.timestamp)}
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
