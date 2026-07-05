# MOBILE_FIRST — Inverted-chrome strategy

> Working doc. No code lands here. Every section ends with a concrete list of files that will be touched when the change ships.

## 1. Why

User direction (this session, committed intent):

- **AURA Mobile is the priority surface**, desktop is secondary.
- **Same React web app** — no native runtime, no Expo, no Capacitor.
- **Online-only / thin client** — server stays the single source of truth, no offline-first, no client SQLite.

That collapses the pivot to:

1. Reverse the CSS gradient on `AppLayout / Header / Sidebar` so the *default* state is a 320 px-friendly surface and the desktop chrome is layered on at `lg+`.
2. Add a PWA shell (`manifest.webmanifest` + icon-192/512 + minimal service worker) so the app installs to the home screen on iOS Safari + Android Chrome — installability is a major driver of "feels native on mobile" perception without any native runtime.
3. Leave the backend alone.

## 2. 320 px viewport audit (iPhone SE, 320 × 568 logical px)

Chrome surface by surface, what breaks *today* at exactly `width=320` (Safari iOS zoom-disabled, no user CSS overrides).

### 2.1 Sidebar (`src/components/layout/Sidebar.tsx`)

| Prospect | Today | Issue at 320 px |
|---|---|---|
| Desktop Sidebar | `hidden lg:flex` (mounted only at `lg+`) | ✓ correctly absent |
| Mobile drawer Sidebar | Slide-in via `<MobileDrawer>`, max width `max-w-xs` (20 rem = 320 px) | ✓ card-list scale OK; ✗ the brand lockup at the top (`AuraLogo size=36` + `AURA` wordmark text-xl) plus a close `✕` button — at 320 px the lockup is tight but readable. The footer `Swap layout` (desktop) / `Sign out` (always) cluster stays reachable because it's pinned `flex-shrink-0` inside the 240 px sidebar column. ✓ |
| Touch targets | The four `NAV_GROUPS` items at `py-2 px-3 text-xs` (~32 px hit area each) | ✗ **Below the Apple HIG 44 px minimum** — fine for mouse, but Apple / Google both reject this on phone. The global CSS in `index.css` already raises every `<button>/a` on `<sm` to `min-h-[44px]`, but `<NavLink>` renders as `<a>` so the rule *should* apply; **needs verification** that the rule wins against Tailwind's `py-2` overrides. |

### 2.2 Header (`src/components/layout/Header.tsx`)

The Header right-cluster on `<lg` competes for ~half the 320 px row:

| Item | Width (approx.) | Visible at 320 px? | Issue |
|---|---|---|---|
| ☰ hamburger (`h-11 w-11`) | 44 px | ✓ (`lg:hidden`) | ✓ |
| ⇄ swap (`h-11 w-11`) | 44 px | ✓ (`lg:hidden`) | ✓ |
| Title + subtitle block | `<div min-w-0>` flex-1 | ✓ | Subtitle already `hidden sm:block`; only the title shows. Title font is `text-sm` (~14 px) and the dashboard-route title uses `font-display uppercase` + AURA wordmark glyph — at 320 px this clips the `text-sm truncate` cleanly; ✓ |
| `NotificationCenter` trigger | ~44 px | ✓ | Needs to fit in the right cluster |
| ✦ AI rail toggle | 44 px | ✓ (`aiToggle`) | ✓ but **leaks desktop semantics**: on mobile the AI rail is force-hidden anyway (see `showRail = isAiRailOpen && !isAiPage` in AppLayout). Toggling ✦ at 320 px just writes `localStorage` and the user sees no immediate effect. Confusing — a 320 px user has no `/ai` rail to toggle *open*. The affordance should reroute: on `<lg`, tapping ✦ opens the standalone `/ai` page instead of toggling invisible chrome. |
| `UserMenu` (avatar + username chip) | ~120 px + paddings | ✓ | ✗ At 320 px, the username text + online-status pill compete for the right cluster. Online pill is `hidden sm:inline` so its label is hidden, but the chip wrapper (`px-2 py-1.5` ≈ 24 px) + the green dot take width. The `UserMenu` itself doesn't `truncate` the username at 320 px — a 12-char username with `font-medium text-xs` reads fine, but + display-name ("Gaetano Bianchi") is ~120 px wide and crowds the AI ✦ button. |
| Online status pill | ~24 px wrapper | ✓ (label hidden) | Borderline OK |

**Aggregate**: Right cluster at 320 px ≈ 44 (☰) + 44 (⇄) + 44 (Bell) + 44 (✦) + 120 (UserMenu) + 24 (Online pill) ≈ 320 px of competing chrome — leaves the title block with **zero pixels**.

### 2.3 AI Rail (`AiRail` in AppLayout.tsx)

✓ correctly `hidden lg:block` already. Mobile users have the standalone `/ai` route. **No change needed**. The ✦ toggle button is the only surface that needs to reroute (see 2.2).

### 2.4 Detail panel slide-in (`ReleaseDetail.tsx` and the four siblings)

The class `relative h-full w-full max-w-full … sm:max-w-lg` means the panel *shows full-width under `sm`*:

| Property | Value at 320 px | Issue |
|---|---|---|
| `max-w-full` (under sm) | 320 px (whole viewport) | ✓ card-list spans full screen — content has more room than the 384 px desktop panel |
| Inner padding `px-6 py-6` | 24 px sides = content area 272 px | ✓ workable |
| Sticky header `px-6 py-4` + catalog number + status badges + priority badge + close arrows | At 320 px the row holds: catalog# (~60 px) + status badge (~80 px) + priority badge (~60 px) + title + 3 action buttons. **Action buttons render at `h-11 w-11` (44 px) on `<sm` (intentional!)** — but **the catalog number + 2 badges + title take ~280 px before the first button lands**. The first Edit button would clip or push the row to overflow horizontally. |
| Internal `grid grid-cols-1 sm:grid-cols-2` for status / priority / release-date / distributor | At 320 px items stack one-per-row | ✓ already mobile-friendly |

**Top-of-panel chrome is the load-bearing bug at 320 px.** Mitigation strips:

- At `<sm` swap the catalog# + badges + title stack to two rows: row 1 = catalog# + priority only, row 2 = status badge + title. Three buttons stay on row 1.
- Move the Save / Cancel / Edit / Delete / Close buttons into a sticky-footer instead of header-right so the title can breathe.

### 2.5 Hero watermark (centred AuraBrand, AppLayout.tsx ~line 350)

Current Tailwind ladder:

```
className="aura-logo-static aura-hero-mark h-auto w-96 sm:w-[42rem] md:w-[54rem] lg:w-[60rem]"
```

| Viewport | Watermark size | Issue |
|---|---|---|
| `(<sm)` 0–639 | `w-96` = **384 px on a 320 px viewport** | ✗ **Overflows horizontally** by 64 px. `justify-center` on a too-wide flex child reads as the mark bleeding off both sides. `overflow-visible` on the wrapper also lets the static glow ring leak. |
| sm 640–767 | `w-[42rem]` = 672 px on 640 px | ✗ same shape, scaled up |
| md 768–1023 | `w-[54rem]` = 864 px | borderline (864 vs viewport 768–1023) |
| lg 1024+ | `w-[60rem]` = 960 px, inset by `lg:left-[16rem] lg:right-[16rem]` → effective render box 512 px | ✓ |

**The watermark overflow at `<md` is the single biggest mobile-first regression in the current build.** It's also the cheapest to fix — see §3.4.

### 2.6 Hero band padding (`<main>` content)

`<main>` wrapper is `mx-auto w-full max-w-7xl px-4 py-6 sm:px-6` — at 320 px the content reads `max-w-7xl` capped at 320 px with 16 px sides, content area 288 px. ✓ But the eyebrow chip + `text-2xl lg:text-4xl` hero title at 320 px is `text-2xl` = `1.5 rem` = 24 px, which renders the title across 3–4 lines and pushes the hero band height to ~140 px. ✓ readable, but `text-balance` (in CSS) helps.

### 2.7 Login page

`max-w-sm` (384 px) card centered, AuraBrand at `size=192` then username + password + Submit. At 320 px the card clips 32 px on each side. The form's CTA is `bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2.5` — fine. **No serious break**; the rendered card is fine on iPhone SE because AuraBrand raster at 192 px fits inside 320 px with margin.

### 2.8 Dashboard hero band — empty-state card

The hero band uses `rounded-2xl px-6 py-6 sm:px-10 sm:py-10`. At 320 px the `px-6` (24 px) is fine but the gradient text-wrap of the headline + subtitle together reach ~140–160 px. ✓

### 2.9 Toast / NotificationCenter / UserMenu

- **Toast**: Bottom-right anchor via `ToastProvider`. At 320 px this still pushes into the safe-area bottom-right — the global `.app-main` padding-right respects `env(safe-area-inset-right)` (per `index.css`), so the toast is above the home indicator. ✓
- **NotificationCenter**: Renders a popover anchored to the bell button. The popover likely has its own "centered" layout that's been desktop-tuned. **Needs a 320 px re-check** before shipping.
- **UserMenu**: Same caveat — anchor-bottom popovers need to re-check at 320 px.

## 3. The inverted chrome pattern

### 3.1 Three-tier chrome, mobile-first

| Tier | Range | What mounts |
|---|---|---|
| **Tier-1: mobile stack** | `<sm` (0–639) | Bottom-tab bar (NEW), Header (NO swap button, AI toggle routes to `/ai`), `MobileDrawer` (single-side, left-anchored, max-w-xs = 320 px). No AI rail (existing behaviour). Detail panels go full-screen (`max-w-full`, sticky footer for actions). |
| **Tier-2: tablet slide-in** | `sm` (640–1023) | Header gets the subtitle back (`hidden sm:block` is in place). Sidebar lives in a slide-in drawer (NOT bottom-tab — tablet widths still feel like a hand-held tablet where thumb reach is everywhere). Detail panels hold the `sm:max-w-lg` cap. AI rail stays hidden on tablets (no docked rail). |
| **Tier-3: desktop / docked** | `lg+` (1024+) | Desktop Sidebar (`hidden lg:flex`), AI rail (`hidden lg:block` + `lg:w-64`). Detail panels cap to `max-w-lg`. Hero watermark inset by `lg:left-[16rem]` etc. (existing behaviour). |

### 3.2 The bottom-tab bar (NEW)

**Worth it?** Yes — and the case is more about *primary-action reachability* than novelty. On a 320 × 568 phone, the Header already has 5–6 items in its top row. Adding a bottom tab strip frees the user from having to tap the ☰ hamburger to reach the four most-used surfaces (Dashboard / Artists / Releases / AI Assistant).

Design:

- 4 tabs: **Dashboard / Artists / Releases / AI** (icon + label, current icon = abbreviated Lucide variants from `SidebarIcons.tsx`).
- Sticky bottom, `h-16` (64 px = matches Header height for visual symmetry), bottom safe-area = `padding-bottom: env(safe-area-inset-bottom)`.
- `backdrop-blur-md bg-zinc-950/85 border-t border-zinc-800/60`.
- Active tab gets `bg-cyan-500/10 text-cyan-400 aura-border-cyan` (same recipe as the Sidebar active item).
- Replaces the ☰ hamburger on `<sm` — which means **the Sidebar drawer becomes a "More" surface on phones** (`Menu / More` tab opens the drawer for the 7 long-tail surfaces + sign-out).

**Two viable layouts** — pick before shipping:

1. **Bottom-tab (4 primary) + ☰-drawer for the rest**. More discoverable, more surface real-estate needed (sticker bar).
2. **Bottom-tab (5 primary including Sign out) only — no drawer on phones**. Drawers go away under `sm`. Aggressive simplification, removes a navigation path.

→ **Recommended: option 1**. The drawer-with-More pattern is the standard mobile-web idiom (every banking app, every news app, every subscription app). User-side, removing the drawer is a regression for the long-tail nav (Tasks / Contracts / Promo / etc.).

### 3.3 Header simplification on `<sm`

At 320 px the Header right-cluster is over-stuffed. Cut list:

- **Drop the ⇄ swap button** on `<sm` (`hidden` already past `sm`). The swap is meaningful only when both Sidebar AND AI rail exist (i.e., `lg+`); on `<lg` the Sidebar is in the drawer, so what would the swap affect? Answer: nothing the user can see. Hidden by default past `lg`; document why (`Sidebar and AI rail coexist only at lg+, so swap has no visible effect below that — keep the affordance where the geometry exists`).
- **Reroute ✦ AI toggle on `<sm`** — instead of toggling an invisible right rail, the button becomes a Link to `/ai`, with `aria-label="Open AI Assistant"`. Past `sm` keep the existing toggle behaviour.
- **Online status pill — strip the chip entirely on `<sm`** (move the timestamp into the UserMenu popover or the Settings Session card). The 24 px wrappers really do compete for the title.
- **UserMenu collapse**: at `<sm`, render the UserMenu as an icon-only avatar (no name text); full name appears in the popover. Frees ~120 px for the title.

### 3.4 Inverted Sidebar / drawer chrome

The Sidebar (rendered both as desktop panel and mobile drawer) is **already** the canonical nav surface. Reverse the gradient so:

- **The Sidebar-as-slide-in-drawer becomes the canonical mobile surface** (already does this — *no change to component logic*). What changes is *which surface invokes it*: at `<sm` the bottom-tab's `More` button invokes the drawer; at `sm-<lg` the ☰ hamburger invokes it (already does this).
- **The desktop Sidebar becomes the canonical `lg+` surface** (already does this). No component change.

### 3.5 Hero watermark recompute (the load-bearing fix)

Replace the static size ladder `w-96 sm:w-[42rem] md:w-[54rem] lg:w-[60rem]` with a *position-aware* ladder:

| Viewport bracket | Width | Effective render box width | Mark width |
|---|---|---|---|
| `<xs` (320 – 359) | 320–399 | 320 px - safe-area | `w-72` (288 px) — fits with 16 px each side |
| `xs` (360 – 413) | 360–639 | 360 px - safe-area | `w-80` (320 px) |
| `sm` (414 – 639) | 414–639 | viewport-width | `w-[20rem]` (320 px) |
| `md` (640 – 1023) | 640–767 | 640 | `w-[26rem]` (416 px) |
| `lg` (1024+) | 1024+ | inset by Sidebar + AI rail | existing ladder |

Tailwind v4 arbitrary-class ladder (drop-in replacement for the existing classes):

```
className="aura-logo-static aura-hero-mark h-auto w-72 xs:w-80 sm:w-[20rem] md:w-[26rem] lg:w-[60rem]"
```

Plus a `xs:` breakpoint that doesn't exist by default in Tailwind v4 — either:

- **Option A**: use `min-[360px]:w-80` (Tailwind v4 arbitrary breakpoint syntax, no config needed)
- **Option B**: add a 360 px breakpoint to `@theme` once and use `xs:` thereafter

→ Use `min-[360px]:` (no global config change) — single source of truth lives in `index.css`, and `AppLayout.tsx` reads the class ladder without importing the breakpoint.

Same for `inset-x-[16rem]` needed at `md` rather than `lg`: introduce `md:left-[16rem] md:right-[16rem]` so the dashboard's watermark lands over `<main>` even on tablets (since the mobile drawer might still be open). At `<md` the drawer slides over the watermark so the inset doesn't matter.

### 3.6 Sidebar slide-in above 768 px

The user said "Sidebar slide-in above 768 px". Two interpretations:

1. **At `>= md`, Sidebar is a slide-in drawer only — no persistent desktop Sidebar.** Replaces the `hidden lg:flex` desktop wrapper with `hidden md:block` on MobileDrawer.
2. **The drawer is reachable at `>= md` as an alternative to the persistent desktop Sidebar**, but both still mount.

→ Interpretation 1 is the more aggressive mobile-first reading. Recommendation: **interpretation 1**. Reasoning:

- Tablets in portrait (768 × 1024 iPad, 600 × 960 Android small tablets) have just enough width to host content, but the persistent 240 px Sidebar would crowd `<main>` to 528 px and force horizontal-scrolling on data tables.
- Toggling the drawer via a "More" hamburger on tablets keeps the content-first surface.
- The desktop Sidebar (`hidden xl:flex` after change) hosts the persistent chrome at `xl+` (1280+) only.

### 3.7 Touch-target wholesale audit

The existing rule in `index.css`:

```css
@media (max-width: 640px) {
  button, a[href], [role="button"]:not(.no-touch-target) {
    min-height: 44px;
  }
}
```

Extend it:

- Add `min-width: 44px` to the same selector (the ☰ / ✦ / ⇄ buttons explicitly use `h-11 w-11` already — codify that).
- Add an exception for *icon-only* `<img>` / `<svg>` elements with `aria-hidden="true"` so decorative elements don't pay the cost.

## 4. Per-viewport spec table (final state)

| Surface | `<sm` 0–639 | `sm` 640–767 | `md` 768–1023 | `lg+` 1024+ |
|---|---|---|---|---|
| Bottom-tab bar | Sticky, 4 items + More | — | — | — |
| ☰ Header hamburger | Hidden (replaced by bottom-tab More) | Visible, opens drawer | Visible, opens drawer | Hidden |
| ⇄ Swap button | Hidden | Hidden | Hidden | Surface-anchored on Sidebar footer |
| ✦ AI toggle | Becomes Link to `/ai` | Becomes Link to `/ai` | Becomes Link to `/ai` | Toggle rail |
| Sidebar desktop panel | Hidden | Hidden | Hidden | `120 px` column |
| Sidebar drawer | Visible on More tap | Visible on ☰ tap | Visible on ☰ tap | Hidden |
| AI rail | Hidden | Hidden | Hidden | Right docked, `w-64` |
| Hero watermark | `w-72 min-[360px]:w-80` | `w-[20rem]` | `w-[26rem]` with inset-x-16 | existing `w-[60rem]` with Sidebar/rail inset |
| Detail panel | `w-full`, sticky-footer actions | `max-w-lg` sticky-footer | `max-w-lg` sticky-header | `max-w-lg` sticky-header |
| Touch targets | 44×44 px global rule |  |  | intrinsic |

## 5. Hero watermark recompute math (concrete)

Effective render box (where `justify-center` lands the mark):

- `<lg+`, no rail, default Sidebar: `inset-x-0` (full viewport) → mark should fill ~80% of viewport width, centered.
- `<lg+`, rail open + default: still no Sidebar (mobile), so inset-x-0 still applies.
- `md 768+`, rail open with docked Sidebar (interpretation-1 path leaves Sidebar drawer-only on `md`): Sidebar drawer closes chrome-side; `md:left-[16rem] md:right-[16rem]` only applies when Sidebar is in desktop-docked position (i.e., `xl+`). At plain `md` it's `inset-x-0`.
- `lg+, !isSwapped`: `lg:left-[16rem]` reserved for the Sidebar.
- `lg+, isSwapped`: `lg:right-[16rem]` reserved.
- `lg+, showRail` (rail open): `lg:inset-x-[16rem]` (symmetric — both Sidebar AND AI rail claim 16 rem).

Width ladder per state is in §3.5.

## 6. Migration order

Each phase is its own commit. Revert-points are well-defined. No phase changes the API surface or any server-side code.

### Phase 1 — Chrome rebalance (CSS-only, no new components)

- `Header.tsx`: drop ⇄ on `<sm` (add `hidden`, currently `lg:hidden` — the inverse); route ✦ to `/ai` on `<sm` via a props.home-link vs. props.onClick ternary.
- `Sidebar.tsx`: nothing (already dual-purpose).
- `AppLayout.tsx`: change desktop Sidebar wrapper from `hidden lg:flex` to `hidden xl:flex` (interpretation-1 deferred, see Phase 4).
- `index.css`: enlarge the touch-target rule to `min-width: 44px min-height: 44px`; add an exception for `aria-hidden` decorative elements.

Risk: **low**. Pure CSS / props tweaks, no new component logic.

### Phase 2 — Bottom-tab bar (NEW component)

- New file `src/components/layout/MobileTabBar.tsx` (≤ 200 LoC).
- AppLayout mounts it conditionally `flex md:hidden`.
- The 4 tabs use the existing `SidebarIcons.tsx` SVGs; add a `<SidebarIcons>` 5th entry `{name:"More", icon: ☰}` (or import Lucide directly — `SidebarIcons.tsx` is typed for the Sidebar family, so a separate `MobileTabIcons.tsx` is cleaner).
- The `More` tab invokes the existing `setSidebarOpen(true)` handler, so the drawer is the secondary nav surface.
- Bottom-tab style — same `rounded-lg px-3 py-2` recipe as `Sidebar.tsx` nav items, with NavLink swapping `hover:bg-zinc-800/40` for `hover:bg-cyan-500/10`.

Risk: **medium**. New mount → potential layout-shift during route transitions. Test with cold-launch rollout sketch.

### Phase 3 — Hero watermark ladder (CSS-only)

- `AppLayout.tsx`: change the AuraBrand `className` ladder to `w-72 min-[360px]:w-80 sm:w-[20rem] md:w-[26rem] lg:w-[60rem]`.
- `index.css`: nothing if we use Tailwind v4's `min-[360px]:` arbitrary breakpoint; otherwise add a 360 px default to `@theme`.

Risk: **low**. CSS-only, visible in 1 file.

### Phase 4 — Swap revert on `<sm`

- Header ⇄ button is already `lg:hidden`. The proposal in §3.3 *keeps* the `lg:hidden` rule but adds `hidden` on the button itself past `lg+` (it's already past-`lg` only). Specifically: the button currently lives because `onSwap` is forwarded from AppLayout; on `<sm` we should not forward `onSwap` at all. AppLayout stops forwarding at `isMobile` window (a small `useMediaQuery` helper or a `md:` Tailwind guard via inline `useEffect`). The visible-but-no-op state is what we're killing.

Risk: **medium**. State-machine check — when the button is mounted but the user thinks it does nothing, that's a UX trap.

### Phase 5 — Detail panel wrap (mobile)

- `ReleaseDetail.tsx` (and 4 siblings): on `<sm`, move sticky-header action buttons to a sticky-footer.
- Catalog# + badges re-stack on `<sm`.

Risk: **low–medium**. Five component edits in one commit, mostly CSS rationale matching §2.4.

### Phase 6 — PWA shell

- `public/manifest.webmanifest` (manifest) + `public/icon-192.png` + `public/icon-512.png`.
- `src/sw.ts` (service worker; build artifact or copy to `public/sw.js`).
- `index.html` adds `<link rel="manifest">`, `<link rel="apple-touch-icon">`.
- AppLayout registers `serviceWorker.register('/sw.js')` on mount (skip in dev; gate on `import.meta.env.PROD`).

Risk: **low**. SW bugs don't crash the app; manifest is best-effort.

## 7. Out of scope

Held outside this strategy because of the *online-only thin client* choice:

- Offline data cache. SW caches the app shell (`index.html` + JS chunks + fonts), NOT `/api/*`. The user loses connectivity → app goes read-but-down.
- Client SQLite / IndexedDB mirror. The server SQLite is the single source of truth.
- Push notifications. Would need a server-side push store + VAPID config.
- Capacitor / Expo wrapper. We're keeping the React web app, not shipping native bundles.

These are *next quarter* work, not blockers for mobile-first.

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Bottom-tab + drawer overlap steals Header real-estate on first paint | Medium | Phase 2 ships Header *immediately* after bottom-tab mounts so the user sees a "header collapses, bottom-tab appears" animation as one continuous surface swap |
| Service-worker cache mask stale chunks on dependencies update | Medium (classic PWA trap) | SW uses `cache: 'network-first'` for index.html; chunks skipped because Rollup content-hashes them with cache-busting sureness |
| 320 px device users on iOS Safari still trigger pinch-to-zoom on form fields | Low | Already covered (`input/textarea/select` `font-size: 16 px` in `index.css @media (max-width: 480px)`) — Safari will *not* zoom on focus |
| `aria-hidden` decorative SVGs being trapped by the new 44×44 touch-target rule | Low | Decorative SVG gets `[role="presentation"]` to opt out, or pinned via inline `min-h-0` |
| Hero watermark's narrower `<md` sizes feel like the brand "lost weight" | Low | Tie opacity to `0.10 → 0.13` for `<md` so the smaller mark reads at the same perceived density |
| Detail panel sticky-footer collides with bottom-tab's 64 px height on `<sm` | Medium | Use `pb-[calc(env(safe-area-inset-bottom)+4rem)]` on the panel body, and offset the sticky-footer above the bottom-tab |
| ⇄ swap removal on `<sm` confuses users who knew about it | Low | Add the bottom-tab `More` → drawer → Sidebar Footer has Swap Layout, so the swap is reachable, just not on the Header |

## 9. Files touched (final list)

- `src/components/layout/AppLayout.tsx` — chrome geometry / hero watermark ladder / phase-4 swap-revert logic
- `src/components/layout/Header.tsx` — `✦` reroute on `<sm`, optional inline checks
- `src/components/layout/Sidebar.tsx` — no vendor changes; nav-item touch-target already covered by global CSS
- `src/components/layout/MobileTabBar.tsx` — NEW file (Phase 2)
- `src/components/ui/MobileTabIcons.tsx` — NEW file, mirror of `SidebarIcons.tsx` with just 5 entries (Phase 2)
- `src/components/releases/ReleaseDetail.tsx` + 4 siblings (TaskDetail / ContractDetail / DemoDetail / ArtistDetail / PromoDetail) — sticky-footer on `<sm`
- `src/components/dashboard/Dashboard.tsx` — no change (its chrome stays desktop-tuned; the bottom-tab compensates)
- `src/index.css` — touch-target rule expansion, optional `xs:` breakpoint add
- `index.html` — `<link rel="manifest">` + `<link rel="apple-touch-icon">`
- `public/manifest.webmanifest` — NEW
- `public/icon-192.png` — NEW
- `public/icon-512.png` — NEW
- `public/sw.js` — NEW (PWA app-shell cache, Phase 6)

## 10. Done when

- Lighthouse mobile-friendliness ≥ 95 (was unmeasured — establish baseline first).
- 320 px viewport screenshot of every page — no horizontal scroll, no clipped chrome, all interactive surfaces are 44 × 44 px min.
- Bottom-tab swaps in and out without Header overlap on every route.
- PWA manifest validates (Lighthouse → Installable).
- All existing Touch target / a11y / focus-trap invariants hold (the per-component `<button>:focus-visible` ring is unaffected).
