import { Link } from "react-router-dom";
import { AuraBrand } from "@/components/ui/AuraBrand";
import { Footer } from "@/components/ui/Footer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const AURA_FIRST_LETTER_COLORS: Record<string, string> = {
  A: "text-aura-cyan",
  U: "text-aura-violet",
  R: "text-aura-magenta",
};

const SUBTITLE_WORDS = "A&R Utility & Resources AI Assistant".split(" ");

export function LandingPage() {
  return (
    <div className="min-h-screen min-h-dvh w-screen overflow-x-hidden">
      {/* ── Wireframe tech grid (inspired by orbeatrecords.com) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 aura-dot-grid-light" />
        <div className="absolute inset-0 aura-wireframe-grid-light" />
        <div className="absolute inset-0 aura-bloom-cyan-light" />
        <div className="absolute inset-0 aura-bloom-violet-light" />
        <div className="absolute inset-0 aura-bloom-magenta-light" />
      </div>

      {/* ── HERO ── */}
      <section className="relative z-10 flex min-h-screen min-h-dvh flex-col items-center justify-center px-5 sm:px-6">
        <div className="mx-auto mb-4 flex justify-center">
          <AuraBrand size={288} ariaLabel="AURA" priority className="brightness-[1.02]" />
        </div>

        <h1 className="font-display text-xl text-zinc-900 text-balance text-center mb-4 sm:text-2xl">
          {SUBTITLE_WORDS.map((word, i) => {
            const first = word[0];
            const color = AURA_FIRST_LETTER_COLORS[first];
            return (
              <span key={i}>
                {i > 0 && " "}
                {color ? <span className={color}>{first}</span> : first}
                {word.slice(1)}
              </span>
            );
          })}
        </h1>

        <p className="max-w-md text-center text-sm text-zinc-600 leading-relaxed text-balance">
          The operational cockpit for independent record labels —
          organise artists, releases, rights, promo workflows, and
          revenue tracking from one focused dashboard.
        </p>

        {/* ── Scroll-down cue ── */}
        <div className="mt-12 flex flex-col items-center gap-2 animate-pulse">
          <span className="text-xs uppercase tracking-widest text-zinc-400">
            What AURA does
          </span>
          <svg
            className="h-4 w-4 text-zinc-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </section>

      {/* ── SECTIONS ── */}
      <section className="relative z-10 mx-auto max-w-3xl px-5 pb-32 sm:px-6">
        <div className="grid gap-12 sm:gap-16">
          {/* Artist & Release Management */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              Artist &amp; Release Management
            </h2>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-prose">
              Maintain a living roster of signed and scouted artists.
              Track release pipelines from demo to distribution with
              status badges that tell you exactly where every record
              stands. No spreadsheets, no scattered notes — one
              source of truth for your label's output.
            </p>
          </div>

          {/* Rights & Contracts */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              Rights &amp; Contracts
            </h2>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-prose">
              Keep master and publishing splits, contract terms, and
              renewal dates in one place. No last-minute rights
              clearance emergencies — AURA surfaces expiring agreements
              before they become problems.
            </p>
          </div>

          {/* AI-Powered Intelligence */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              AI-Powered Intelligence
            </h2>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-prose">
              Generate press releases, Beatport descriptions, artist
              communications, and campaign copy with AI tuned for the
              music industry. Campaign Intelligence scans your roster
              and suggests marketing angles you haven't thought of.
            </p>
          </div>

          {/* Revenue Tracking */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              Revenue &amp; Promo Tracking
            </h2>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-prose">
              Track streaming royalties, sync licensing, and
              merchandise revenue against your promo spend. See which
              campaigns are driving return and which need a course
              correction — all from one dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* ── ADMIN ENTRY ── */}
      <div className="relative z-10 mx-auto max-w-sm px-5 pb-24 sm:px-6">
        <div className="border-t border-zinc-200 pt-8 text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-400 mb-4">
            Already on the team?
          </p>
          <Link
            to="/login"
            className="block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-xs font-medium text-zinc-600 transition-all hover:border-zinc-300 hover:text-zinc-900 hover:bg-zinc-100"
          >
            Sign in to your label dashboard
          </Link>
        </div>

        <Footer className="mt-8" />
      </div>

      {/* Theme toggle — floating button in bottom-right corner */}
      <ThemeToggle variant="floating" />
    </div>
  );
}
