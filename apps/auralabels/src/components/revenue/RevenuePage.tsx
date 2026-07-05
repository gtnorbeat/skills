import { useEffect, useState } from "react";
import { fetchRevenue } from "@/utils/api";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import type { RevenueSummary } from "@/types";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * AURA — Revenue
 *
 * MVP revenue snapshot. Not full royalty accounting; surfaces per-artist
 * and per-release splits plus a reporting period indicator. Designed to
 * stay simple until PostgreSQL + a real accounting ledger lands later.
 */
export function RevenuePage() {
  const { isOnline } = useNetworkStatus();
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchRevenue()
      .then((r) => {
        if (mounted) { setRevenue(r); setError(null); }
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load revenue data");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Error state — full-page card replaces the KPI/breakdown/notes tree
  // so the user gets an honest signal rather than a misleading zero-value
  // dashboard (which the prior silent-catch path rendered as "no data").
  if (error) {
    return (
      <div className="space-y-8">
        <ErrorState
          message={!isOnline ? "You appear to be offline — check your connection and try again" : error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
  const data: RevenueSummary = revenue ?? {
    totalRevenue: 0,
    monthlyRevenue: 0,
    pendingPayouts: 0,
    revenueByArtist: [],
    revenueByRelease: [],
    currency: "EUR",
  };

  // settled = gross revenue minus un-paid portion. Indicative only;
  // not a payout ledger — that lives on the contract records.
  const settledAmount = Math.max(0, data.totalRevenue - data.pendingPayouts);

  const totalByArtist = data.revenueByArtist.reduce((sum, r) => sum + r.amount, 0);
  const totalByRelease = data.revenueByRelease.reduce((sum, r) => sum + r.amount, 0);

  // Proportion bars — fall back to 1 when the bucket is empty so we never
  // divide by 0. Explicit length check instead of relying on Math.max() with
  // an extra `1` argument; the spread-of-empty-array form silently degenerates
  // to Math.max(1) today but the empty-input form returns -Infinity and a
  // future refactor could lose the trailing `1` and reintroduce the divide-
  // by-zero path without tsc catching it.
  const artistAmounts = data.revenueByArtist.map((r) => r.amount);
  const releaseAmounts = data.revenueByRelease.map((r) => r.amount);
  const maxArtist = artistAmounts.length > 0 ? Math.max(...artistAmounts) : 1;
  const maxRelease = releaseAmounts.length > 0 ? Math.max(...releaseAmounts) : 1;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-zinc-900/70 via-zinc-950/40 to-violet-900/15 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/70">
            Revenue Snapshot
          </p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            AURA Revenue
          </h1>
          <p className="max-w-2xl text-xs text-zinc-400 sm:text-sm">
            Earnings across the roster — release income, artist split, label share,
            distributor deductions. Reporting period: current quarter.
          </p>
        </div>
      </section>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={`€${data.totalRevenue.toLocaleString()}`}
          icon={<span className="text-sm">◆</span>}
        />
        <StatCard
          label="Settled"
          value={`€${settledAmount.toLocaleString()}`}
          subtext="Paid out to artists"
          icon={<span className="text-sm">✓</span>}
        />
        <StatCard
          label="Pending Payouts"
          value={`€${data.pendingPayouts.toLocaleString()}`}
          subtext="Awaiting distribution"
          icon={<span className="text-sm">◷</span>}
          accent
        />
        <StatCard
          label="Monthly Run Rate"
          value={`€${data.monthlyRevenue.toLocaleString()}`}
          subtext={`Currency: ${data.currency}`}
          icon={<span className="text-sm">◈</span>}
        />
      </div>

      {/* Artist breakdown */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader
            title="Revenue by Artist"
            subtitle={`${data.revenueByArtist.length} artists • €${totalByArtist.toLocaleString()} total`}
          />
          <DashboardCard>
            <div className="space-y-3">
              {data.revenueByArtist.map((item) => {
                const pct = Math.round((item.amount / maxArtist) * 100);
                return (
                  <div key={item.artist}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-200">{item.artist}</span>
                      <span className="tabular-nums text-zinc-400">
                        €{item.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-violet-500/80 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </DashboardCard>
        </div>

        <div>
          <SectionHeader
            title="Revenue by Release"
            subtitle={`${data.revenueByRelease.length} releases • €${totalByRelease.toLocaleString()} total`}
          />
          <DashboardCard>
            <div className="space-y-3">
              {data.revenueByRelease.map((item) => {
                const pct = Math.round((item.amount / maxRelease) * 100);
                return (
                  <div key={item.release}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-200">{item.release}</span>
                      <span className="tabular-nums text-zinc-400">
                        €{item.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/60">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500/80 to-cyan-500/80 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </DashboardCard>
        </div>
      </section>

      {/* Reporting notes */}
      <section>
        <DashboardCard>
          <SectionHeader title="Notes" subtitle="Reporting notes" />
          <div className="space-y-2 text-xs leading-relaxed text-zinc-400">
            <p>
              This is a <span className="text-zinc-200">revenue snapshot</span>,
              not a full royalty accounting ledger. Splits shown are indicative.
            </p>
            <p>
              Distributor deductions and payment status are surfaced per release
              via the Rights &amp; Contracts module. Final payout reconciliation
              lives on the contracts record.
            </p>
            <p className="text-zinc-600">
              Reporting period: <span className="text-zinc-400">Current quarter</span>.
              Currency: <span className="text-zinc-400">{data.currency}</span>.
            </p>
            {loading && (
              <p className="text-[10px] text-cyan-400/70">
                Loading live revenue…
              </p>
            )}
          </div>
        </DashboardCard>
      </section>
    </div>
  );
}
