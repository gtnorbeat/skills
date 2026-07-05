# CHOREOGRAPHY — AURA animation timing reference

> ONE place to verify timing. Every `@keyframes` rule in `src/index.css`, with
> its **declared stops**, **computed ms**, **phase boundaries**, and the
> **consuming component**.

## How to use this doc

This file is the single source of truth for animation timing in AURA. If
timing drifts between `src/index.css` and the consuming `.tsx` file, it
drifts here too — and that's the bug.

- **`§1` table** — one row per `@keyframes` declared in `src/index.css`.
  `Duration` is whatever the consumer sets (in `index.css`, in a `.tsx`
  inline `animation:`, or via Tailwind's class output). `Computed ms`
  is `stop% × duration` rounded.
- **`§2`** — Tailwind built-in utilities (`animate-spin`, `-pulse`, `-ping`)
  that aren't `@keyframes` declarations in `src/index.css` but are part of
  the motion vocabulary.
- **`§3`** — maintenance notes and drift-audit commands.

---

## §1. `@keyframes` inventory

| # | Keyframe | File:line | Duration × easing × iteration | Stops declared | Selector → consuming component |
|---|----------|-----------|-------------------------------|----------------|-------------------------------|
| 1 | `slide-in-right` | [`src/index.css:3`](src/index.css) | **250 ms** `ease-out` (one-shot) | `from { opacity: 0; transform: translateX(100%) scale(0.95) }` → `to { opacity: 1; transform: translateX(0) scale(1) }` | `.animate-in-slide` → [`src/components/ui/Toast.tsx`](src/components/ui/Toast.tsx) |
| 2 | `aura-fade-in` | [`src/index.css:465`](src/index.css) | **300 ms** `cubic-bezier(0.22, 1, 0.36, 1)` (one-shot) | `from { opacity: 0; transform: translateY(8px) }` → `to { opacity: 1; transform: translateY(0) }` | `.aura-enter-fade` → entry animations across pages |
| 3 | `aura-fade-up` | [`src/index.css:469`](src/index.css) | **400 ms** `cubic-bezier(0.22, 1, 0.36, 1)` (one-shot) | `from { opacity: 0; transform: translateY(20px) }` → `to { opacity: 1; transform: translateY(0) }` | `.aura-enter-fade-up` → staggered card grids |
| 4 | `aura-scale-in` | [`src/index.css:473`](src/index.css) | **250 ms** `cubic-bezier(0.22, 1, 0.36, 1)` (one-shot) | `from { opacity: 0; transform: scale(0.95) }` → `to { opacity: 1; transform: scale(1) }` | `.aura-enter-scale` → modal/panel mounts |
| 5 | `aura-shimmer` | [`src/index.css:498`](src/index.css) | **1.5 s** `ease-in-out` `infinite` | `0% { background-position: -200% 0 }` → `100% { background-position: 200% 0 }` | `.aura-skeleton-shimmer` → loading skeleton states |
| 6 | `aura-float` | [`src/index.css:510`](src/index.css) | **3 s** `cubic-bezier(0.22, 1, 0.36, 1)` `infinite` | `0%, 100% { transform: translateY(0) }` ↔ `50% { transform: translateY(-6px) }` | `.aura-float` → empty-state icon attractor |
| 7 | `aura-mobile-drawer-slide-in-from-left` | [`src/index.css:676`](src/index.css) | **180 ms** `cubic-bezier(0.22, 1, 0.36, 1)` `both` | `from { transform: translateX(-100%) }` → `to { transform: translateX(0) }` | `.aura-mobile-drawer--left` → [`src/components/layout/AppLayout.tsx`](src/components/layout/AppLayout.tsx) (MobileDrawer component) |
| 8 | `aura-mobile-drawer-slide-in-from-right` | [`src/index.css:680`](src/index.css) | **180 ms** `cubic-bezier(0.22, 1, 0.36, 1)` `both` | `from { transform: translateX(100%) }` → `to { transform: translateX(0) }` | `.aura-mobile-drawer--right` → [`src/components/layout/AppLayout.tsx`](src/components/layout/AppLayout.tsx) (MobileDrawer component) |
| 9 | `aura-toast-shrink` | [`src/index.css:917`](src/index.css) | **dynamic** `linear` `forwards` (duration = `t.duration ?? (t.action ? 5500 : 4000)` ms, declared in [`src/components/ui/Toast.tsx`](src/components/ui/Toast.tsx)) | `from { transform: scaleX(1) }` → `to { transform: scaleX(0) }` | inline `animation` prop on toast progress-bar `<div>` → [`src/components/ui/Toast.tsx`](src/components/ui/Toast.tsx) |

> **Splash animation keyframes removed.** The six `aura-intro-*` and
> `aura-logo-*` @keyframes (aura-intro-logo-show, aura-intro-wordmark-show,
> aura-intro-glow-show, aura-logo-orbit-breath, aura-logo-bar-pulse,
> aura-logo-sparkle-twinkle) were removed from `src/index.css` during a
> cleanup pass. Their corresponding sections (§1.1–§1.3 and §2) and the
> `choreography-tie-out.test.ts` CI guard were removed alongside them.
> The timing reference below is kept as historical record.

---

> **Splash keyframe phase breakdowns removed.** Sections §1.1 (`aura-intro-logo-show`),
> §1.2 (`aura-intro-wordmark-show`), and §1.3 (`aura-intro-glow-show`) were removed
> alongside their corresponding `@keyframes` blocks from `src/index.css` during a
> cleanup pass. The timing reference is kept as historical record in git history
> (commit `7348ea0` and prior).

---

## §2. `prefers-reduced-motion` master block

The master block lives at [`src/index.css`](src/index.css) in the
`@media (prefers-reduced-motion: reduce)` rule (near the end of the
file). It does two things:

1. **Kills all animations + transitions** globally:
   `animation-duration: 0.01ms !important`, `animation-iteration-count:
   1 !important`, `animation-delay: 0.01ms !important`,
   `transition-duration: 0.01ms !important`, `scroll-behavior: auto !important`

2. **Removes the SVG noise-grain texture** from `<body>`:
   `background-image: none !important`

The 0.01ms overrides are chosen over `animation: none` because they
neutralize both the visual effect AND the stagger delays (the
`.aura-stagger-1` through `-6` helper classes set `animation-delay` on
elements — `animation: none` would also work but 0.01ms is the
established pattern from the initial reduced-motion implementation).

Reduced-motion users still experience the full React lifecycle
(components mount/unmount on the same schedule) but without visible
motion.

---

## §3. Tailwind built-in motion utilities (not in `src/index.css`)

These are stock Tailwind utilities consumed via class names; they are
NOT `@keyframes` declarations in [`src/index.css`](src/index.css), but
they're part of AURA's motion vocabulary. They're called out here so a
future reader doesn't go grepping `index.css` for them.

| Utility class | What it does | Where it's used (representative) |
|---------------|--------------|---------------------------------|
| `animate-spin` | Tailwind's `spin` keyframe — 360° rotation, 1 s linear infinite (slow loading affordance, cyan tint layered on dark surfaces) | [`App.tsx:94`](src/App.tsx), [`PageLoader.tsx:17`](src/components/ui/PageLoader.tsx), plus every list/spinner in `ArtistPage`, `ReleasePage`, `PromoPage`, `ContractPage`, `DemoPage`, `CalendarPage`, `AIAssistantPage`, `CampaignIntelligencePage`, `ContentStudioPage` |
| `animate-pulse` | Tailwind's `pulse` keyframe — opacity 1 → 0.5 → 1, 2 s ease-in-out infinite (skeleton-load chip shimmer) | [`ContractDetail.tsx:586-587`](src/components/contracts/ContractDetail.tsx), [`PromoDetail.tsx:494-497`](src/components/promo/PromoDetail.tsx) |
| `animate-ping` | Tailwind's `ping` keyframe — scale 1 → 2, opacity 0.75 → 0, 1 s cubic-bezier infinite (cyan halo ping on presence dots — `NotificationCenter` + `StatusBadge`) | [`NotificationCenter.tsx:119`](src/components/layout/NotificationCenter.tsx), [`StatusBadge.tsx:14`](src/components/ui/StatusBadge.tsx) |

If AURA ever needs a custom Tailwind keyframe (e.g. named `ping` but
with a different size), declare it in [`src/index.css`](src/index.css)
inside an `@layer utilities` block, add a row to `§1` here, and update
the consumer list. Don't shadow Tailwind's built-in `animate-spin` /
`-pulse` / `-ping` directly — name collisions create hard-to-debug
regressions.

---

## §4. Maintenance

When this doc gets out of sync with the code:

1. To audit drift in one pass: `grep -nE '^@keyframes' src/index.css`
   vs. the row count in `§1` of this file. Counts should match.
2. To audit consumer drift: for every `@keyframes` name in `§1`,
   `grep -rn 'keyframe-name' src/` should surface the consuming
   component (plus the `animation:` shorthand line within
   `src/index.css` itself).

Future cleanup arc targets (when the doc grows again):

- Add a Vitest test that compares the count of `@keyframes` declarations
  in `src/index.css` against the row count in `§1` of this file, so
  drift fails CI before `vite build`.
