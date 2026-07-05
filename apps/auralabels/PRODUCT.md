# Product

## Register

product

> The app is **AURA — A&R Utility & Revenue Assistant**. The label the app is built around is **ORBEAT Records (ORB001)** — that's context, not brand. Anywhere this file says “the product” or “the app,” it means AURA.

## Users

Label managers and A&Rs at **ORBEAT Records** who manage artist rosters, review demo submissions, track releases, handle contracts, run promo campaigns, monitor revenue, and oversee day-to-day label operations. They use this tool daily in a studio or office environment — speed and clarity are critical. Sessions are gated by JWT (7-day TTL); the Sign-in surface is the only entry point.

## Product Purpose

**AURA** is the operational hub for a record label. It centralizes artist management, release pipelines, contract lifecycle, demo inbox management, promo campaign coordination, calendar scheduling, **a dedicated /revenue surface**, AI-assisted content generation (with a Platform selector that drives Claude/GPT-4o/template output per channel), and **a unified Settings page with global Save**. Success means the label team can manage their entire workflow from a single, fast, intentional interface without switching between spreadsheets and email.

## Brand Personality

Dark, modern, premium. Professional confidence with an underground edge. The brand speaks with authority — minimal, direct, and intentional. Cyan → violet gradient on the AURA logo and primary CTA only; orange/amber for status signals only. The leader in the room isn't the loudest color, it's the one that's absent until it matters.

## Brand Identity Governance

The canonical brand title + subtitle for the app live in `src/components/layout/AppLayout.tsx` (`getPageInfo()`). Defaults that must stay in lockstep with the Sidebar wordmark, the Login screen, and Settings:

- **App title**: `AURA`
- **App subtitle**: `A&R Utility & Revenue Assistant`

Per-route pages override the subtitle (e.g. `/` → "AI-powered label management") and that's expected. The **default** values above, however, must be identical wherever they appear. If you change one, change all four together. AppLayout is the next thing to audit if the Sidebar lockup is ever simplified — otherwise the legacy subtitle leaks into `document.title`, browser tab text, and any place `appTitle` is rendered.

## Surfaces (scope of the product)

The product is a single SPA under the `/` route group, with seven named sidebar surfaces. Anything in this list lives on a route; anything not in this list is not in scope.

- **Dashboard (`/`)** — ops cockpit: today's priorities, revenue overview, active campaigns, demo inbox summary, deadlines needing attention.
- **AI Assistant (`/ai`)** — prompt-driven copy / strategy generation for any artist + release + contract context. Powers `/api/ai/generate` chain (Claude → GPT-4o → template).
- **Content Engine (`/content`)** — platform-aware copy generation with `PLATFORM_GUIDANCE` injected into the prompt (Instagram, YouTube, Spotify, Beatport, TikTok, SoundCloud, Radio, Press, Email, Multi-channel). Sits next to AI Assistant in the sidebar as a **distinct** surface — NOT a rename of it. AI Assistant stays for general-purpose prompt-driven copy / strategy; Content Engine is the channel-aware generation surface where per-platform rules + char caps (Instagram = 220 chars, Spotify = 500, no cap on Press etc.) apply to both the LLM system prompt AND the template fallback.
- **Roster & Rights** — three sub-surfaces:
  - **Artists (`/artists`)** — roster CRUD, social links, missing-info signals (`missingInfo`), profile completeness.
  - **Releases (`/releases`)** — release pipeline + readiness checklist + artwork tile + track list + launch checklist.
  - **Rights & Contracts (`/contracts`)** — exclusive/non-exclusive/distribution/licensing contracts with revenue share, expiry tracking, GDPR/IPI status.
- **Operations** — three sub-surfaces:
  - **Demo Inbox (`/demo-inbox`)** — submissions via `/api/webhook/:uuid` (public, Make.com). Rate → labelFit → interested/rejected workflow.
  - **Promo Campaigns (`/promo`)** — release-driven campaigns, platforms, budget, missing content, checklist, next action.
  - **Calendar (`/calendar`)** — tasks linked to any entity type with due dates and overdue flags.
- **Revenue (`/revenue`)** — `/api/revenue` summary, monthly trend, artist & release proportion bars, pending payouts in EUR. (Was infrastructure-only before; this surface makes it a first-class screen.)
- **Settings (`/settings`)** — label configuration, AI providers (OpenRouter + Workers AI), user/session management, JWT-aware Sign out. One global Save.

## Auth UX (interaction first principle)

Authentication is part of the product, not chrome:

- **Discoverable Sign-out**: a top-right UserMenu chip (avatar initial + label + chevron) on every page; secondary entry from a Session card inside Settings. Both lead to the same Sign-out confirmation that clears `localStorage("auth_token")` + `localStorage("auth_user")` and reloads.
- **Global Save on Settings**: ONE global Save button persists every editable card at once, with a success chip naming what was saved. Per-card Save is forbidden because the visible success chip belonged to a different card than the one the user actually edited. Toggles must carry `type="button"` so they can never trigger an implicit form submit.
- **No silent logout**: the login screen is the only public surface; every other route redirects to `/login` if `/api/verify` rejects the token.

## AI Pipeline (interaction first principle)

- The `POST /api/ai/generate` chain is **Claude → GPT-4o → template**. Either AI key is optional; with neither set, the template responds with a provider badge of `mock` so the UI can surface which engine produced the text.
- The Content Engine `Platform` selector injects the **PLATFORM_GUIDANCE** rules into the LLM system prompt AND hard-caps the template fallback to the target channel's recommended length (Instagram = 220 chars, Spotify = 500, Press Release has no cap, etc.).
- All AI edits are persisted client-side as drafts; the user owns the publish action. Provider badge (cyan for OpenRouter, emerald for Workers AI, zinc for template, red for error) sits inline with the Output header.

## Anti-references

- **No SaaS-cream:** No light backgrounds, white cards, or generic startup dashboards. The app should feel like a premium tool, not a web app template.
- **No AI-generated clichés:** No glassmorphism, no hand-drawn SVG illustrations, no numbered section markers (01/02/03). No gradient text on **body or chrome** — surface treatments, sidebars, headings, page titles. The single exception is the **AURA logo SVG and the primary CTA button** (`from-cyan-600 to-violet-600`). Anywhere else, no gradient text, ever.
- **No over-rounded UI:** Card borders top out at 12–16px. Full-pill radii only for tags and buttons.

## Design Principles

1. **Dark by conviction, not by default.** The dark theme is intentional — it reduces visual noise in a studio environment and reinforces the premium brand. Every surface should feel purposeful, not "dark mode" as an afterthought.

2. **Clarity over cleverness.** Label managers make decisions from this interface. Data density is high, but visual hierarchy must make the important thing the obvious thing. No decorative flourishes that compete with content.

3. **Rhythm and restraint.** Spacing, typography, and color are used sparingly and consistently. Two-tone accents: **cyan → violet for brand chrome (logo + CTA only)**, **orange / amber for status signals (readiness fills, monthly revenue, filter pills, rating stars)**. When everything is emphasized, nothing is.

4. **Underground edge, professional execution.** The brand voice is bold and authoritative — but the tool itself is precise and reliable. Edginess lives in the attitude, not in broken layouts or experimental interactions.

5. **Motion with purpose.** Animations clarify state transitions and direct focus. No gratuitous entrance animations, no bounce effects. Reduced motion is always respected.

## Accessibility & Inclusion

Base accessibility: avoid obvious problems (contrast, focus indicators, semantic HTML) without pursuing formal WCAG certification. Body text must meet minimum contrast standards. Reduced motion supported. Sign-out lives in two discoverable places (top-right UserMenu chip + Settings Session card), not a borderline-10px footer link — accessibility includes “I can find the way out without help.”
