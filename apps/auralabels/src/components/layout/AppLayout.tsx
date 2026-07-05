import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileTabBar } from "./MobileTabBar";
import { AuraBrand } from "@/components/ui/AuraBrand";
import { Footer } from "@/components/ui/Footer";
import { PageLoader } from "@/components/ui/PageLoader";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { UpdateBanner } from "@/components/ui/UpdateBanner";
import { lazyNamed } from "@/utils/lazyNamed";
import type { AiStatus } from "@/components/ai-assistant/AIAssistantPage";

// AI Assistant is lazy-loaded here AND in App.tsx — Rollup dedupes the
// same dynamic import path into one shared chunk, so the rail mount
// and the /ai route mount both reuse the same bundle.
const AIAssistantPage = lazyNamed(
  () => import("@/components/ai-assistant/AIAssistantPage"),
  "AIAssistantPage",
);

/** localStorage key for the persistent right-side AI Assistant rail. */
const AI_RAIL_STORAGE_KEY = "aura_ai_rail_open";  /**
   * localStorage key for the persistent Sidebar side preference. Survives
   * reloads on the same browser; on first visit (or in private mode)
   * AppLayout falls back to "left" so the legacy look is preserved.
   */
  const SWAP_STORAGE_KEY = "aura_side_swap";

  /** Single source for the swap handler so desktop chrome (Sidebar) and
   *  mobile chrome (Header ⇄ button) stay in sync. Both surfaces toggle
   *  the same `isSwapped` state — no per-surface callback capture would
   *  drift across renders. */

  /**
   * Renders the right-side view of the AppLayout that includes the
   * mobile UI swap affordance — a small ⇄ icon next to the hamburger
   * menu inside Header chrome. The desktop Sidebar footer swap button
   * still handles the same toggle on lg+ viewports so users get a
   * muscle-memory surface on each device class without double-mounting.
   * (Declared as document-level comment so reviewers see the context.)
   */

/* ── Module-level chrome components ──────────────────────────────────── *
 * Each is its own top-level (NOT nested inside AppLayout) so React does
 * not re-mount it on every AppLayout render. Nested components defined
 * inside another function component are recreated every render, which
 * causes child unmount + remount on every parent update. For AiRail that
 * would tear down in-flight AI generation state; for DesktopSidebar it
 * would reset NavLink scroll positions; for MobileDrawer it costs us the
 * focus listener re-binding. Hoisting all three avoids the whole class
 * of bugs at the cost of one forward-declaration below.
 */

/**
 * Vertical AI Assistant rail. Renders only on `lg+` (mobile users see
 * the Sidebar inside the mobile drawer instead). The `side` prop is the
 * VIEWPORT EDGE the rail sits on (not the divider side): `borderClass`
 * flips so the divider line always lands between the rail and the main
 * column, regardless of side.
 */
function AiRail({
  side,
  onAiStatusChange,
}: {
  side: "left" | "right";
  onAiStatusChange: (status: AiStatus) => void;
}) {
  const borderClass = side === "right" ? "border-l" : "border-r";
  return (
    <aside
      id="ai-rail"
      aria-label="AI Assistant panel"
      className={`hidden h-full shrink-0 overflow-hidden ${borderClass} border-black/20 bg-[#e4dfd8] lg:flex lg:flex-col lg:w-64`}
    >
      <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
        <Suspense
          fallback={
            // AI rail chunk load — the surrounding <aside
            // aria-label="AI Assistant panel"> is the named
            // landmark, but the loading *region* inside the
            // landmark still benefits from its own discoverable
            // name (role="region" promotes it to an explicit SR
            // landmark so the user hears "region, Loading AI
            // Assistant" rather than a generically-named element).
            // Inner PageLoader passes `message=""` so the wrapper
            // aria-label is the sole accessible name — the visible
            // spinner (no inner <p>) matches the layout-clarity
            // rationale we applied to the Dashboard skeleton.
            <div
              role="region"
              aria-label="Loading AI Assistant"
            >
              <PageLoader message="" />
            </div>
          }
        >
          {/* Rail mount bubbles live AI state up to AppLayout
              so the chrome icons react. The /ai route mount
              (separate, outside AppLayout) does NOT receive
              onAiStatusChange. */}
          <AIAssistantPage isRail onAiStatusChange={onAiStatusChange} />
        </Suspense>
      </div>
    </aside>
  );
}

/**
 * Desktop Sidebar wrapper. Hidden at <lg (mobile users reach the same
 * Sidebar through `MobileDrawer` instead). The wrapper exists so the
 * Sidebar's own `flex h-full w-full` resolves correctly inside the
 * AppLayout flex column parent — without this outer `<div hidden
 * lg:flex flex-shrink-0>`, the Sidebar's `max-w-[16rem]` would shrink
 * to the parent flex's content-box.
 *
 * Module-level (not nested) so React does not re-mount the Sidebar
 * instance (including NavLink scroll positions and focus targets)
 * every time the parent re-renders.
 */
function DesktopSidebar({
  side,
  onSwap,
  onSignOut,
  aiStatus,
}: {
  side: "left" | "right";
  onSwap: () => void;
  onSignOut: () => void;
  aiStatus: AiStatus;
}) {
  return (
    <div className="hidden h-full flex-shrink-0 xl:flex">
      <Sidebar side={side} onSwap={onSwap} onSignOut={onSignOut} aiStatus={aiStatus} />
    </div>
  );
}

/**
 * Mobile drawer overlay. Always rendered (mounted for the parent's
 * lifecycle) but returns `null` when `open` is false to avoid the
 * backdrop intercepting pointer events on desktop. Owns its own
 * focus-trap useEffect: the Escape handler closes the drawer + restores
 * focus to the parent-owned menu button; the Tab handler cycles focus
 * within the drawer's focusable elements so keyboard / AT users can't
 * drop into the background main column. Module-level so the focus
 * listener rebinds once per (open, close) cycle, not once per parent
 * render — which would also be a perf hit on rapid re-renders.
 *
 * `drawerRef` and `returnFocusRef` are forwardRefs passed in from the
 * parent so React owns the DOM nodes that this component only borrows
 * (`drawerRef` for the focus-trap query, `returnFocusRef` for the
 * Escape-recovery focus restore).
 */
function MobileDrawer({
  open,
  isSwapped,
  onSwap,
  onClose,
  onSignOut,
  aiStatus,
  drawerRef,
  returnFocusRef,
}: {
  open: boolean;
  isSwapped: boolean;
  onSwap: () => void;
  onClose: () => void;
  onSignOut: () => void;
  aiStatus: AiStatus;
  drawerRef: RefObject<HTMLDivElement | null>;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        returnFocusRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, drawerRef, returnFocusRef]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 xl:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Main navigation"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        key={isSwapped ? "right" : "left"}
        ref={drawerRef}
        className={`aura-mobile-drawer aura-mobile-drawer--${isSwapped ? "right" : "left"} absolute ${isSwapped ? "right-0 left-auto" : "left-0 right-auto"} top-0 flex h-full w-full max-w-xs`}
      >
        <Sidebar
          side={isSwapped ? "right" : "left"}
          onSwap={onSwap}
          onClose={onClose}
          onSignOut={onSignOut}
          aiStatus={aiStatus}
        />
      </div>
    </div>
  );
}

function getPageInfo(pathname: string): { title: string; subtitle: string } {
  if (pathname === "/") return { title: "Dashboard", subtitle: "" };
  if (pathname.startsWith("/artists")) return { title: "Artists", subtitle: "Manage your roster" };
  if (pathname.startsWith("/releases")) return { title: "Releases", subtitle: "Pipeline and catalog" };
  if (pathname.startsWith("/contracts")) return { title: "Rights & Contracts", subtitle: "Agreements and terms" };
  if (pathname.startsWith("/revenue")) return { title: "Revenue", subtitle: "Earnings snapshot" };
  if (pathname.startsWith("/demo-inbox")) return { title: "Demo Inbox", subtitle: "Review submissions" };
  if (pathname.startsWith("/promo")) return { title: "Promo Campaigns", subtitle: "Marketing and outreach" };
  if (pathname.startsWith("/calendar")) return { title: "Calendar", subtitle: "Deadlines and events" };
  if (pathname.startsWith("/campaigns")) return { title: "Campaign Intelligence", subtitle: "AI-powered campaign generation" };
  if (pathname.startsWith("/content")) return { title: "Content Engine", subtitle: "Create & publish" };
  if (pathname.startsWith("/settings")) return { title: "Settings", subtitle: "Configure your label" };
  if (pathname.startsWith("/ai")) return { title: "AI Assistant", subtitle: "Your label co-pilot" };
  return { title: "AURA", subtitle: "A&R Utility & Resources AI Assistant" };
}

export type HeroState = "pending" | "settled";

interface AppLayoutProps {
  username: string | null;
  onSignOut: () => void;
  /**
   * Drives the static hero watermark lifecycle:
   *   - "pending"  → hero is hidden (intro is playing in AuraIntro)
   *   - "settled"  → hero is at its 7% opacity, static
   * "settled" is the post-intro steady state. App.tsx drives the
   * transition directly pending → settled; the prior "revealed"
   * intermediate (with a 600 ms aura-hero-mark-reveal crossfade)
   * was removed because it compounded with AuraIntro's 2400 ms
   * dissolve to read as a two-event fade. Round-and-coherent
   * handoff stands on pending → settled with no intermediate.
   */
  heroState: HeroState;
  children?: ReactNode;
}

export function AppLayout({ username, onSignOut, heroState, children }: AppLayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  // MOBILE_FIRST Phase 2 — secondary focus-restore target for the
  // MobileTabBar's More button. AppLayout owns both refs; lastTrigger
  // state (declared with the open handlers below) decides which carries
  // back focus when the Sidebar drawer closes via Escape / backdrop /
  // X button.
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
  const { title, subtitle } = getPageInfo(location.pathname);

  // Persistent right-side AI Assistant rail. Default state is OPEN so
  // the user's first impression of the dashboard already has the tool
  // surfaced; explicit close writes 'false' so subsequent visits start
  // closed. Survives reloads via localStorage. Force-closed visually on
  // the standalone /ai route so the rail never double-renders the page.
  const [isAiRailOpen, setIsAiRailOpen] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(AI_RAIL_STORAGE_KEY);
      if (raw === null) return true; // first visit
      return raw === "true";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(AI_RAIL_STORAGE_KEY, String(isAiRailOpen));
    } catch {
      /* localStorage unavailable (private mode / quota) — state still works this session */
    }
  }, [isAiRailOpen]);
  const isAiPage = location.pathname.startsWith("/ai");
  const showRail = isAiRailOpen && !isAiPage;

  // Sidebar side preference — persisted in localStorage so the chrome
  // geometry (which side the Sidebar and AI rail sit on) survives
  // reloads. Decoupled from the AI rail toggle so chrome geometry lives
  // independently from which rail is currently mounted. Default false
  // keeps the Sidebar on the left as it has always been.
  const [isSwapped, setIsSwapped] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SWAP_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SWAP_STORAGE_KEY, String(isSwapped));
    } catch {
      /* private mode / quota — runtime state still works this session */
    }
  }, [isSwapped]);

  // Live AI activity state for the context icons (Header rail toggle +
  // Sidebar AI Assistant nav item). Owned here because both chrome
  // surfaces live under AppLayout, not under AIAssistantPage itself.
  // The rail mount reports state up via onAiStatusChange; the /ai route
  // mount does NOT (it's outside AppLayout) — see comment in AIAssistantPage
  // for why that's intentional.
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  // Reset to idle once the rail is no longer visible: explicit close
  // OR user navigated to /ai (force-close to avoid double-renders).
  // Without this reset, the chrome would stay magenta/amber forever
  // after the user closed the rail mid-generation.
  useEffect(() => {
    if (!showRail) setAiStatus("idle");
  }, [showRail]);

  // MOBILE_FIRST Phase 6 — register the app-shell service worker.
  // Host-gated so Vite dev (localhost / 127.0.0.1) bypasses the SW
  // entirely (HMR's per-module transforms would collide with a
  // cached `/src/...` of the prior module body). Production
  // URLs register the SW so Add-to-Home-Screen on iOS Safari /
  // Android Chrome can promote the install. Errors are silently
  // swallowed — Safari private mode + some content-blockers reject
  // registration synchronously without breaking the SPA. The
  // `if (typeof window === 'undefined')` early-return keeps the
  // effect safely no-op during SSR if we ever pivot to Vite SSR.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    /* MOBILE_FIRST Phase 6 — IPv6 loopback. Adding `[::1]` to the
       host-gate covers developers running Vite via IPv6 (modern
       macOS / Linux defaults to ::1 for `localhost` resolution on
       some browsers/IPv6-preferred networks). Production
       URLs still pass the gate (they're never loopback). */
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return;
    if (!("serviceWorker" in navigator)) return;
    try {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
    } catch {
      /* Safari private mode can throw synchronously — logged and
       * swallowed because the running SPA is unaffected. */
    }
  }, []);

  // Map state to the class names index.css expects. The "revealed"
  // intermediate (and its 600 ms aura-hero-mark-reveal crossfade)
  // was removed: the happy path now goes pending → settled directly
  // (App.tsx) so the splash is the only animated layer during the
  // transition. The round-and-coherent handoff stands on the
  // .aura-hero-bg base rule (--aura-hero-target-opacity) taking
  // effect at the unmount moment — no intermediate fade between
  // two different opacity curves.
  const heroClass =
    heroState === "pending"
      ? "aura-hero-bg aura-hero-bg--pending"
      : "aura-hero-bg";

  // Hero watermark bounding box reflects which rails are mounted AND
  // which side they're on. All four cases enumerated:
  //
  //   showRail=true  → inset-x-[16rem] (256 px on both sides, symmetric)
  //   rail=false, isSwapped=false → left-[16rem] (Sidebar on left)
  //   rail=false, isSwapped=true  → right-[16rem] (Sidebar on right)
  //
  // In the (showRail=true, isSwapped=true) case both AI rail (left) and
  // Sidebar (right) are w-64 — still symmetric at inset-x-[16rem].
  // The hero content (AuraBrand) sits inside this bounding box and
  // centres via flex justify-center, so it always lands over <main>
  // regardless of which side the Sidebar / AI rail sit on.
  const heroPadClass = showRail
    ? "lg:inset-x-[16rem]"
    : isSwapped
      ? "lg:right-[16rem]"
      : "lg:left-[16rem]";

  // Single swap handler reused by both desktop Sidebar wrappers (left
  // when !isSwapped, right when isSwapped) AND the mobile drawer —
  // so the user can flip sides from any viewport.
  //
  // Mobile drawer's setSidebarOpen(false) is intentionally NOT called
  // here (commit: animated swap). When the user taps ⇄ while the
  // drawer is open, the MobileDrawer container remounts via
  // `key={isSwapped ? "right" : "left"}` and the CSS keyframe
  // (`.aura-mobile-drawer--{left|right}` in src/index.css) animates the
  // slide-in from the new edge. The previous snap-close was jarring;
  // the animated slide reads as a continuous swap. The user can still
  // close the drawer via backdrop / X / Escape after the swap.
  // On desktop `sidebarOpen` is already `false`, so swapping toggles
  // only desktop chrome geometry with no visible animation here.
  const handleSwap = () => {
    setIsSwapped((v) => !v);
  };

  // Stable drawer-close callback forwarded to MobileDrawer. Without
  // useCallback this arrow would be a fresh function reference on every
  // AppLayout render and MobileDrawer's focus-trap useEffect deps
  // (`[open, onClose, drawerRef, returnFocusRef]`) would re-bind the
  // keydown listener on every parent render, not only on open/close
  // transitions. Re-binding is cheap but pure noise — and on rapid
  // re-renders (e.g. AI generation state updates) the effect's
  // clean-up-then-rerun cycle could race with a stale Tab capture.
  const handleCloseDrawer = useCallback(
    () => setSidebarOpen(false),
    [],
  );

  // Mobile-first opener tracker (MOBILE_FIRST Phase 2) — the Sidebar
  // drawer can be opened from one of two triggers: the Header ☰ (sm-md)
  // or the MobileTabBar's More tab (<sm). MobileDrawer's Escape
  // handler restores focus to the opening trigger so keyboard and SR
  // users return to the same surface they came from. Without this
  // split the pre-Phase-2 Header ☰, hidden at <sm via
  // `hidden sm:flex lg:hidden`, would receive focus restoration the
  // browser's focus tree can't physically carry to. `lastTrigger`
  // persists across renders so the MobileDrawer's `returnFocusRef`
  // downstream (which DOES NOT re-render between opens) remains
  // pointing at the right element.
  const [lastTrigger, setLastTrigger] = useState<"header" | "tabBar">("header");
  const handleOpenFromHeader = useCallback(() => {
    setLastTrigger("header");
    setSidebarOpen(true);
  }, []);
  const handleOpenFromTabBar = useCallback(() => {
    setLastTrigger("tabBar");
    setSidebarOpen(true);
  }, []);

  // chromeSlots — single source-of-truth describing what chrome
  // surfaces render at the current {isSwapped, showRail, sidebarOpen}
  // state. The JSX below consumes this object as 4 explicit slot
  // renders — left rail, drawer, main column, right rail — instead
  // of inlining 4 boolean conditionals inline.
  //
  // Recomputed every render: cheap, since each slot is a small JSX
  // value whose components are module-level (AiRail, DesktopSidebar,
  // MobileDrawer) so React's reconciler sees the same component type
  // at the same render-tree position across renders. Memoizing this
  // object with useMemo would cost the same as recomputing it for any
  // state change that matters — there's no perf win, only a small
  // readability cost from the hook boilerplate.
  const chromeSlots = {
    // Edge slot: Sidebar (default) OR AI rail (swapped) OR nothing
    // (swapped, rail closed — Sidebar moved right, AI rail hidden).
    left: !isSwapped
      ? <DesktopSidebar side="left" onSwap={handleSwap} onSignOut={onSignOut} aiStatus={aiStatus} />
      : (showRail
          ? <AiRail side="left" onAiStatusChange={setAiStatus} />
          : null),
    // Edge slot, mirror: AI rail (default, rail open) OR Sidebar
    // (swapped) OR nothing (default, rail closed — no right rail).
    right: !isSwapped
      ? (showRail
          ? <AiRail side="right" onAiStatusChange={setAiStatus} />
          : null)
      : <DesktopSidebar side="right" onSwap={handleSwap} onSignOut={onSignOut} aiStatus={aiStatus} />,
    // Overlay slot: MobileDrawer handles its own `open=false → null`
    // early-return internally so this slot is always mounted and the
    // JSX stays a clean 4-render pattern (no `{sidebarOpen && ...}`
    // gate). The component's own useEffect rebinds the focus-trap
    // listener on every (open→close→open) cycle, which is what we
    // want.
    drawer: <MobileDrawer
      open={sidebarOpen}
      isSwapped={isSwapped}
      onSwap={handleSwap}
      onClose={handleCloseDrawer}
      onSignOut={onSignOut}
      aiStatus={aiStatus}
      drawerRef={mobileDrawerRef}
      // Switch the focus-restore target to whichever trigger opened
      // the drawer last. `menuButtonRef` (Header ☰) is the target at
      // sm-md; the tab-bar's More button is the target at <sm. Stays
      // canonical for both surfaces — the SR focus tree can carry
      // focus to either, the difference is just which element to
      // bias toward after Escape-close. Reassigns the same RefObject
      // identity (no child remount) so MobileDrawer's focus-trap
      // useEffect deps don't re-bind on every parent render.
      returnFocusRef={lastTrigger === "header" ? menuButtonRef : moreButtonRef}
    />,
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#e4dfd8]">
      {/* AURA hero watermark -- single centred mark beneath Header
          (top-16 = 64 px = h-16 Header height). aria-hidden; the Sidebar
          lockup announces the brand semantically.
          --aura-hero-target-opacity holds the resting tint (default 0.15);
          the canonical declaration is :root in index.css (this wrapper
          used to inline the same value via style={{...}}, but the
          :root-based declaration makes EVERY surface read the same
          resting opacity without per-caller threading).
          AuraLogo's amplified motion hooks (orbit breath / bar pulse /
          sparkle twinkle) run on this hero — there is no longer an
          `.aura-logo-static` opt-out here. Hero opacity (0.15) is low
          enough that the ambient breath reads as scenery rather than
          competing with main-column content.
          Swap-aware heroPadClass -- covers all 4 cases (rail+!:swap,
          rail+swap, !rail+!:swap, !rail+swap) so the centred mark
          always lands over <main> regardless of which side the Sidebar
          or AI rail sit on. */}
      <div
        aria-hidden="true"
        className={`${heroClass} ${heroPadClass} pointer-events-none fixed inset-0 top-16 z-0 flex items-center justify-center overflow-hidden`}
      >
        {/* Wireframe tech grid (inspired by orbeatrecords.com) layered
            behind the bloom orbs for depth. */}
        <div className="absolute inset-0 aura-dot-grid-light" />
        <div className="absolute inset-0 aura-wireframe-grid-light" />
        <div className="absolute inset-0 aura-bloom-cyan-light" />
        <div className="absolute inset-0 aura-bloom-violet-light" />
        <div className="absolute inset-0 aura-bloom-magenta-light" />
        {/* MOBILE_FIRST Phase 3 — viewport-aware watermark ladder.
            The previous `w-96 sm:w-[42rem] md:w-[54rem] lg:w-[60rem]`
            sizes were anchored to the desktop render box (256 px
            Sidebar + 256 px rail = 1024-512). At smaller viewports the
            static `w-96` (384 px) overflowed a 320 px viewport with
            `justify-center` reading as a horizontally-bleeding mark.
            New ladder scales downward:
              < xs (320–359): w-72 = 288 px (16 px gutters each side)
              xs+ (360+):     min-[360px]:w-80 = 320 px (no overflow)
              sm+ (640+):     w-[24rem] = 384 px (tablet headroom — code-review
                             flagged 320 px on 640–767 viewports as
                             reading below half-viewport; 384 px keeps
                             the mark at 60–50% of tablet width)
              md+ (768+):     w-[26rem] = 416 px (visual headroom)
              lg+ (1024+):    w-[60rem] = 960 px (existing desktop)
            Tailwind v4 arbitrary breakpoint `min-[360px]:` is preferred
            over a global `xs:` token because no other surface needs the
            breakpoint today — keeping the ladder self-contained. */}
        {/* aura-logo-static REMOVED — the splash plays with the
            amplified orbit/equalizer/sparkle motion, and removing the
            static opt-out here keeps those animations running on the
            hero, so the splash → hero handoff is continuous
            (motion-on, no kill at unmount) rather than the prior
            motion-on / motion-off discontinuity. Hero opacity
            (--aura-hero-target-opacity, 0.15) is low enough that the
            ambient breath reads as scenery rather than competing
            with main-column content. */}
        <AuraBrand
          size={960}
          ariaLabel=""
          className="aura-hero-mark h-auto w-72 min-[360px]:w-80 sm:w-[24rem] md:w-[26rem] lg:w-[60rem]"
          priority
        />
      </div>

      {/* Skip-link for keyboard users (a11y) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-cyan-500 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-black focus:shadow-lg focus:shadow-cyan-500/30"
      >
        Skip to main content
      </a>

      {/* 4 explicit slot renders — chromeSlots consolidates the
          4-cell render matrix ({isSwapped, showRail} for left/right +
          {sidebarOpen} for drawer). Read top-to-bottom: outer rails
          clock-wise around the centered main column. */}
      {chromeSlots.left}
      {chromeSlots.drawer}

      {/* Main column -- Header (h-16) + scrollable main. Takes all
          remaining horizontal space after both Sidebar and AI rail
          consume their fixed w-64 strips (whichever is mounted). */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          subtitle={subtitle}
          titleClassName={
            (location.pathname === "/" ||
              location.pathname.startsWith("/artists") ||
              location.pathname.startsWith("/releases") ||
              location.pathname.startsWith("/ai"))
              ? "font-display uppercase"
              : undefined
          }
          username={username}
          onSignOut={onSignOut}
          menuOpen={sidebarOpen}
          onMenuButtonRef={(el) => {
            menuButtonRef.current = el;
          }}
          onMenuClick={handleOpenFromHeader}
          // Mobile swap affordance — desktop Sidebar has its own swap
          // footer button (hidden on mobile, visible on lg+). The Header
          // ⇄ button is the mirror surface: hidden on lg+, visible <lg so
          // the two never both render and the same toggle state stays
          // canonical across viewports.
          onSwap={handleSwap}
          // aria/visual honesty: on /ai the rail is force-closed so the
          // ✦ button reads as closed; underlying isAiRailOpen still owns
          // localStorage and re-applies on the next non-/ai route.
          aiRailOpen={!isAiPage ? isAiRailOpen : false}
          // Live AI activity tint for the rail toggle mark.
          aiStatus={aiStatus}
          onToggleAiRail={() => setIsAiRailOpen((v) => !v)}
        />
        {/* MOBILE_FIRST Phase 8 — offline banner sits between Header and
            main content so it&apos;s always visible regardless of which route
            is active. Thin amber bar, dismissible per session — the
            OfflineBanner component owns its own `useNetworkStatus` hook
            and returns null when the network is up. */}
        <OfflineBanner />
        <UpdateBanner />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto">
          {/* Footer mount: flex-col wrapper + flex-1 on the route content
              pushes the Footer against the bottom of <main> when the
              route is short, and to the end of the scrollable column
              when the route overflows. min-h-full on the wrapper
              preserves the prior single-row layout when the content
              height matches <main>'s flex-1 share. */}
          {/* MOBILE_FIRST Phase 2 — pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:pb-0
               reserves 64 px for the fixed MobileTabBar + the notched-phone home indicator
               so the page Footer and bottom-of-page content are never hidden behind the
               bottom-tab bar. At ≥sm the bar is hidden (sm:hidden) so the padding is
               zeroed, preserving the existing scrollable-column layout. */}
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pb-0">
            <div className="flex-1">{children}</div>
            <Footer className="mt-12" />
          </div>
        </main>
      </div>

      {chromeSlots.right}

      {/* MobileTabBar (MOBILE_FIRST Phase 2) — bottom-anchored primary
          nav strip visible only at <sm (Tabs by `sm:hidden` inside
          the component — code-review fix pins it to MOBILE_FIRST.md
          §4 spec table where bottom-tab is `<sm` only). Mounted as
          the LAST flex child so it sits on top of chromeSlots.drawer's
          z-50 when the drawer's open (the bar itself is z-40 —
          below the drawer's z-50 — so the drawer's backdrop covers
          the bar visually when active).

          aria-controls stays scoped to AppLayout's `sidebarOpen` state
          via the `handleOpenFromTabBar` callback below. AppLayout's
          existing `menuButtonRef` (the Header ☰) is the focus-restore
          target when the drawer opens via Header; the bottom-tab More
          button is the target when the drawer opens via TabBar. The
          `lastTrigger` state tracks which opener is dominant so the
          MobileDrawer's focus-trap can return focus to the right
          element after Escape-close. Without this split the Header ☰
          (hidden at <sm) would receive focus restoration that the SR
          focus tree can't actually carry to. */}
      <MobileTabBar
        aiStatus={aiStatus}
        moreOpen={sidebarOpen}
        onMoreClick={handleOpenFromTabBar}
        // Callback-ref wire for Sidebar drawer's focus-restore target.
        // AppLayout's `moreButtonRef` (declared with menuButtonRef at
        // the top of this component) carries the More button's DOM
        // node so MobileDrawer's focus-trap can hand focus back to it
        // on Escape-close, matching the muscle-memory contract the
        // Header ☰ already established at sm-md.
        onMoreButtonRef={(el) => { moreButtonRef.current = el; }}
      />
    </div>
  );
}
