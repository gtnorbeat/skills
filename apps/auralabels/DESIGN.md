---
name: AURA — A&R Utility & Revenue Assistant
description: Premium dark dashboard for label operations, content generation, and revenue signal. ORBEAT Records (ORB001) is the label context, not the app brand.
colors:
  brand-cta-from: "#0891b2"
  brand-cta-to: "#7c3aed"
  brand-cta: "from-cyan-600 to-violet-600"
  brand-cta-shadow: "shadow-cyan-500/20"
  primary: "#f97316"
  primary-deep: "#ea580c"
  primary-muted: "oklch(0.65 0.18 45)"
  accent-amber: "#d97706"
  accent-amber-light: "#fbbf24"
  surface-bg: "#000000"
  surface-bg-light: "#e4dfd8"
  surface-card: "oklch(0.14 0.004 70)"
  surface-elevated: "oklch(0.12 0.004 70)"
  surface-border: "oklch(0.22 0.005 70)"
  ink-primary: "#ffffff"
  ink-secondary: "oklch(0.56 0.01 70)"
  ink-muted: "oklch(0.38 0.01 70)"
  ink-disabled: "oklch(0.28 0.01 70)"
  status-live: "#10b981"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "text-sm font-bold leading-tight"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "text-xs"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "text-[10px] or text-[11px]"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.15em"
    textTransform: uppercase
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "24px"
components:
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "20px"
  card-hover:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "oklch(0.12 0.004 70)"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    borderColor: "{colors.surface-border}"
  input-focus:
    borderColor: "oklch(0.65 0.18 45 / 0.4)"
  button-filter:
    backgroundColor: "oklch(0.15 0.004 70)"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  button-filter-active:
    backgroundColor: "oklch(0.65 0.18 45 / 0.15)"
    textColor: "{colors.primary}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#000000"
    rounded: "{rounded.md}"
    padding: "12px 48px"
  status-badge:
    rounded: "{rounded.full}"
    padding: "2px 10px"
  nav-item:
    rounded: "{rounded.md}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "oklch(0.65 0.18 45 / 0.10)"
    textColor: "{colors.primary}"
---

# Design System: AURA — A&R Utility & Revenue Assistant

> ORBEAT Records (ORB001) is the label *context* — the artist roster the app is built around — not the app brand. The product is **AURA**.

## 1. Overview

**Creative North Star: "The Control Room"**

AURA is the operational cockpit for a modern record label — a dark, focused workspace where label managers and A&Rs make decisions about artists, demos, releases, contracts, promo campaigns, and revenue. The aesthetic is intentionally nocturnal: pure black canvas with zinc-toned surfaces that recede into the background, letting content — track titles, artist names, status badges — command attention. Two accent voices coexist by intent:

- **Brand chrome** (logo SVG, primary CTA) — a cyan-600 → violet-600 gradient. This is the only place the gradient is allowed. It signals "this is AURA, take me to the action."
- **Status / signal** (readiness fills, monthly revenue bars, filter pills, rating stars) — orange / amber. Rarity is the power: never more than 10% of any given screen.

This system explicitly rejects the "SaaS-cream" aesthetic of light backgrounds, white cards, and generic startup dashboards. It also refuses glassmorphism, gradient text on body / chrome surfaces, and decorative numbered section markers — everything serves the operational purpose.

**Key Characteristics:**
- Pure black background (`#000`) as the foundational canvas (dark mode); warm parchment `#e4dfd8` for light mode
- Zinc-based surface hierarchy (card, elevated, border) at single-digit lightness levels
- Two-tone accent voice: cyan→violet for brand chrome, orange/amber for status / signal
- Single typeface (Geist) across all roles — consistency over contrast
- Border-based elevation: surfaces separate via 1px `zinc-800` strokes, not shadows
- Flat by default; shadows only for modal overlays and the brand mark

## 2. Colors

The palette is built on two axes: a warm orange/amber accent spectrum and a cool zinc neutral spectrum. The orange family carries all interactive meaning; zinc provides structure and hierarchy.

### Primary

- **Signal Orange** (oklch(0.65 0.18 45) / `#f97316`): The brand's voice. Used for active navigation items, filter selection, focus rings, and the primary CTA. Its rarity is its power.
- **Deep Orange** (`#ea580c`): Hover and pressed states for orange elements. Slightly darker without losing warmth.

### Secondary

- **Command Amber** (`#d97706`): Secondary accent for progress indicators (gradient fill), rating stars, and "next action" labels. Softer than orange but in the same warm family.
- **Light Amber** (`#fbbf24`): Star ratings and highlight badges.

### Neutral

- **Pure Black** (`#000000`): The body background in dark mode. Not a dark gray — true black.
- **Warm Parchment** (`#e4dfd8`): The body background in light mode. An ~89% luminance warm tone that reduces eyestrain compared to pure white, paired with a subtly visible dot-grid texture for technical depth.
- **Card Surface** (oklch(0.14 0.004 70)): Card and container backgrounds. Just barely lighter than black to create depth.
- **Elevated Surface** (oklch(0.12 0.004 70)): Hover state for cards, one step up from resting.
- **Border** (oklch(0.22 0.005 70) / `zinc-800`): The primary separation tool. 1px strokes at ~22% lightness.
- **Primary Text** (`#ffffff`): Headings, labels, data values.
- **Secondary Text** (oklch(0.56 0.01 70)): Body copy, metadata, non-emphasized information.
- **Muted Text** (oklch(0.38 0.01 70)): Placeholders, disabled states, secondary labels.
- **Disabled Text** (oklch(0.28 0.01 70)): Truly inaccessible elements.

### Status Colors

- **Live Green** (`#10b981` / emerald-500): "Online" status indicator only. Not used elsewhere.

### Named Rules

**The Signal Rule.** Orange / amber occupies ≤10% of any given screen. It exists only on active status indicators, filter pills, readiness bars, and rating stars — never as decorative chrome. When orange is present, the user knows something is at a threshold or actionable.

**The Brand Chrome Rule.** Cyan → violet is the only allowed gradient and the only allowed use of `background-clip: text`. It's reserved for exactly two surfaces: the AURA logo SVG (everywhere it appears) and the primary CTA button (cyan-600 → violet-600). Sidebar wordmarks, page titles, headings, body copy all stay solid white or `text-zinc-*` — the gradient never bleeds into chrome.

## 3. Typography

**Display Font:** Geist (with ui-sans-serif, system-ui, sans-serif fallback)
**Body Font:** Geist (same stack)
**Label Font:** Geist (same stack)
**Mono Font:** ui-monospace, SFMono-Regular, monospace (for BPM/key data values)

**Character:** A single geometric/technical sans-serif stack across all roles. No font pairing — the hierarchy is created through weight, size, and letter-spacing alone. Geist (by Vercel) was chosen over Inter for its sharper, more technical character — narrower apertures, tighter geometric curves, and a distinctly "developer tool" personality that reinforces the AI-first positioning.

### Hierarchy

- **Display** (700, text-sm/14px, 1.25): Used exclusively for the AURA brand mark in the sidebar and the LoginPage. Not a content-facing size. The mark itself is an inline SVG carrying the brand-chrome gradient (cyan-600 → violet-600) — the surrounding text must stay solid white or `text-zinc-*` so the gradient does not bleed into chrome.
- **Headline** (600, text-sm/14px, 1.5): Section headers (`SectionHeader`), card titles, panel headers. The primary content heading.
- **Title** (600, text-[13px], 1.4): Demo artist names, release titles. Used where a heading is needed without competing with the section header.
- **Body** (400, text-xs/12px or text-sm/14px, 1.5): The workhorse. Track details, metadata, descriptions. Capped at 65–75ch in prose contexts.
- **Label** (500 or 600, text-[10px] or text-[11px], 1.4, uppercase, tracking-wider 0.15em): Status badges, priority tags, section labels, filter labels. These are the small uppercase elements that provide scannable structure.
- **Mono** (400, text-xs/12px): BPM values, musical keys, technical data rendered in the track info grid.

### Named Rules

**The Uniform Voice Rule.** One typeface across all roles. Hierarchy is the work of size, weight, and letter-spacing — not font switching. Pairing Geist with another sans would create noise, not contrast.

**The Single-Title Rule.** `AppLayout.tsx`'s `getPageInfo()` is the canonical source of `appTitle` + `document.title` + the sidebar wordmark. The default brand-locked values (`AURA` with subtitle `A&R Utility & Revenue Assistant`) must be identical wherever they appear (AppLayout, Sidebar, Login, Settings). If you change the page title or subtitle in this file, audit all four consumers together — otherwise AppLayout still carrying the old subtitle bites you next deploy.

## 4. Elevation

The system is intentionally flat. Depth is communicated through border contrast, not shadows.

- **Surface separation**: 1px `border-zinc-800` strokes at `oklch(0.22)` — this is the primary elevation tool. Cards, panels, sidebars, and inputs all use this single border treatment to create layering against the pure black background.
- **Hover response**: The border lightens to `border-zinc-700` and the background lifts to `oklch(0.12)`. No shadow shift — just a tonal brightening.
- **Overlays**: Backdrops use `bg-black/60 backdrop-blur-sm` for the blur + dim effect. The panel itself floats at `zinc-950` background, creating the highest surface layer via tonal contrast with the black backdrop.
- **Brand mark**: The AURA logo SVG carries the brand chrome — cyan-600 → violet-600 gradient — with a soft `shadow-lg shadow-cyan-500/20` glow. It appears in the Sidebar and the LoginPage. This is the only element in the system with a coloured shadow that uses the brand gradient. Status signals (readiness fills, monthly revenue bars, filter pills) stay orange/amber — the gradient never bleeds into status chrome because that would dilute what orange is signalling.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a branded gesture (the logo) or as a practical boundary (modals). No card shadows, no floating elements, no lifted states via `box-shadow`.

## 5. Components

### Cards / Containers

- **Shape:** Gently curved — 12px (`rounded-xl`) corners.
- **Background:** Card surface (`oklch(0.14)`), rests against pure black background.
- **Border:** 1px zinc-800 stroke at rest.
- **Hover:** Border lightens to zinc-700, background lifts slightly. Transition: 300ms ease.
- **Internal Padding:** 20px (`p-5`) consistently.
- **Shadow Strategy:** None. Cards are tonal layers, not floating objects.

### Buttons

- **Shape:** 8px (`rounded-lg`) for primary action buttons; 6px (`rounded-md`) for filter pills.
- **Primary CTA (the one allowed gradient):** `from-cyan-600 to-violet-600`, white text. Used for top-of-page "Save", "Generate", "Create Release" — the dominant action on any given surface. Hover: subtle lift + glow. Active: scale 0.98 for tactile feedback.
- **Secondary Save (Settings page global Save):** Same brand gradient treatment. Settings uses ONE global Save — per-card Save is forbidden because it makes the success chip ambiguous about which card was saved. Save buttons must carry `type="button"` so a toggle click can never trigger an implicit submit.
- **Filter Pills:** Dark surface (`oklch(0.15)`) with muted text at rest. Active: orange tinted background with orange text. All: `rounded-md`.
- **Status Buttons (DemoDetail):** Dark surface at rest, orange tint + orange ring when active. 5-column grid.
- **Icon Buttons (close, delete):** 32px square, dark surface, muted icons. Hover: white text. Delete hover shifts to red tint.
- **Transitions:** `transition-all duration-200` on state changes.

### Inputs / Fields

- **Shape:** 8px (`rounded-lg`).
- **Resting:** `bg-zinc-900/60` with `border-zinc-800/60`.
- **Focus:** Orange border at 40% opacity (`border-orange-500/40`) with a 1px orange ring (`ring-1 ring-orange-500/20`).
- **Placeholder:** Muted text (`zinc-500`).
- **Search Inputs:** Include a leading icon (⌕) and optional clear button.
- **Textareas:** Same treatment, with `resize-none` to prevent layout breakage. 4-row default height.

### Status Badges

- **Shape:** Pill — `rounded-full` with a 1px border.
- **Padding:** 2px 10px (`px-2.5 py-0.5`).
- **Typography:** 11px, font-medium.
- **Variants by status (Demo):** "new" → animated ping dot + colored border/text, "listening" → different color, "interested" → different, "rejected"/"accepted" → distinct.
- **Variants by fit (Label):** "perfect", "good", "moderate", "poor" using distinct color mappings.

### Navigation (Sidebar)

- **Width:** 240px (`w-60`), full height.
- **Border:** Right border `zinc-800/60`.
- **Background:** `bg-black/40 backdrop-blur-sm`.
- **Items:** 8px 12px padding, 11px font-medium gap.
- **Active:** Orange tinted background at 10%, orange text, 6px orange dot indicator.
- **Inactive:** Muted zinc text, dark background on hover.
- **Transitions:** `transition-all duration-200`.

### Progress Bars

- **Track:** `rounded-full` with `bg-zinc-800` at 1–2px height.
- **Fill:** Gradient (`from-orange-500 to-amber-500`) for accent bars, gradient (`from-zinc-600 to-zinc-500`) for neutral bars.
- **Animation:** 700ms ease-out on width change.

### Header

- **Height:** 56px (`h-14`).
- **Border:** Bottom border `zinc-800/40`.
- **Title:** Bold, white, 14px.
- **Status Indicator:** Small green dot (`emerald-500`) + "Online" label in a pill container.

## 6. Do's and Don'ts

### Do:

- **Do** use pure black (`#000`) as the body background. The dark foundation is intentional and non-negotiable.
- **Do** use orange accents sparingly — ≤10% of any given screen. Orange is a signal, not a decoration.
- **Do** use `rounded-xl` (12px) for cards and containers. This is the established radius.
- **Do** use `border-zinc-800` strokes for surface separation instead of shadows.
- **Do** keep typography to a single Geist stack. Hierarchy comes from weight and size, not font-switching.
- **Do** use `transition-all duration-200` for hover/focus state changes.
- **Do** wrap long text in `line-clamp-1` or `truncate` in constrained containers.
- **Do** respect the pure black background — maintain high contrast for all body text against it.

### Don't:

- **Don't** use pure white (`#ffffff`) as a page-level background in light mode. The warm parchment `#e4dfd8` is the canonical light surface; white is reserved for cards and inputs only.
- **Don't** use box-shadow on cards or containers. The flat surface hierarchy is part of the brand.
- **Don't** use gradient text (`background-clip: text`), glassmorphism, or numbered section markers (01/02/03).
- **Don't** use hand-drawn SVG illustrations or decorative `feTurbulence` filters.
- **Don't** pair a border with a wide box-shadow on the same element (the "ghost card" pattern).
- **Don't** exceed 16px (`rounded-xl`) on cards. Pill radii (`rounded-full`) are for badges only.
- **Don't** use pink, blue, purple, or green accents on **status or body** surfaces. Orange/amber are the only status accent. Cyan and violet are reserved for **brand chrome** (logo SVG + primary CTA) — nowhere else. Crossing this rule is the single most common brand dilution.
- **Don't** apply decorative entrance animations. Motion has purpose — state transitions and focus direction only.
- **Don't** override the body background with tinted near-blacks on the root canvas in dark mode. Cards and panels can be slightly lighter, but the foundation stays `#000`.
- **Don't** use the dark-mode `#000` body background in light mode. The warm parchment `#e4dfd8` is the canonical light canvas — cards, containers, and inputs use `bg-white` against it.
