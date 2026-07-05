# AGENTS.md — AURA Agent Operating Manual

> The AI coding assistant's first-stop reference for AURA — what the project is, how to build / test / lint it, the rules you must not break, and where the deep docs live. **Read this before editing anything.**
>
> A previous draft of this doc described an Express 5 / Vercel / Railway stack — AURA now runs on **Cloudflare Workers + Pages**. The stack section below is the source of truth, not earlier drafts.

---

## TL;DR — the seven things that will bite you

1. **Stack is Cloudflare Worker + Pages + React 19 SPA + Neon Postgres (Drizzle ORM).** Not Express. Not Vercel. Not Next.js. No server actions. No `server/` directory. The Worker entry is `src/index.ts`; route handlers live in `src/routes/*.ts`.
2. **The DB doctrine is "SaaS pivot":** `packages/db/src/schema.ts` defines 12 tables in the `auralabels_*` namespace; every tenant starts empty. New operators onboard via UI CRUD. Regression tests in `tests/` protect this. **Never reintroduce fixture data.**
3. **Auth is bcrypt + JWT (HS256) via `jose` (Web Crypto API).** The secret lives in `JWT_SECRET`. Tokens use HS256 with configurable TTL (7d / 5m). **Do not import `jsonwebtoken`** — it uses Node's `crypto` module and won't work in Workers. Use `jose` instead.
4. **The deploy target is Cloudflare Workers + Pages, with `main` as the canonical branch.** GitHub Actions CI/CD auto-deploys on push to `main`. `wrangler deploy` pushes the Worker; `wrangler pages deploy` pushes the frontend to Cloudflare Pages. No Vercel, no Railway, no Render.
5. **The brand-chrome gradient is cyan → violet, ONLY on the AURA logo SVG and the primary CTA.** Anywhere else — body, headings, page titles, sidebar wordmark — solid white or `text-zinc-*`. Orange is the status accent (≤ 10 % of any given screen). Crossing either rule is the dilution pattern the reviewer catches every PR.
6. **Tests use Vitest** (`vitest run`). 180 tests across 14 files. Environment is `node` by default (avoids jsdom cross-realm `Uint8Array` issues with `jose`); files that need DOM use `// @vitest-environment jsdom` in their header.
7. **TypeScript is strict.** `npm run typecheck` runs `tsc --noEmit`. No `any` unless the value truly can be anything (rare). The `@cloudflare/workers-types` package provides Worker runtime type declarations.

---

## What this product is

**AURA — A&R Utility & Revenue Assistant** is the operational hub for an indie record label. Dark, premium, mobile-first cockpit for managing artists, releases, contracts, demos, promo campaigns, calendar tasks, and revenue. Sessions are JWT-gated; the login screen is the only public route. Full positioning + surfaces + brand personality: see `PRODUCT.md`.

The label AURA is built around is **ORBEAT Records (ORB001)** — that's the seed context, not the brand.

---

## Stack (the actual stack)

| Layer | Tech | Notes |
|---|---|---|
| **Runtime** | Cloudflare Worker + Pages | Node.js compatibility via `nodejs_compat` flag in `wrangler.toml` |
| **Frontend** | React 19 + React Router 7 + Vite 6 + Tailwind CSS v4 | SPA, mobile-first, PWA with service worker |
| **Backend** | Cloudflare Worker — prefix-based route dispatching (`src/index.ts`) | No router library; routes map in `routes: Record<string, Handler>` using string prefix matching |
| **Database** | Neon Serverless Postgres via `@neondatabase/serverless` (HTTP) + Drizzle ORM | Drizzle client created once via `getDb()` in `src/db.ts` |
| **Auth** | `bcryptjs` + `jose` (HS256) | Web Crypto API — works in Workers, no Node `crypto` dependency |
| **AI** | OpenRouter (`meta-llama/llama-3.3-70b-instruct:free`) → Workers AI (`@cf/meta/llama-3.1-8b-instruct`) → template fallback | Chain in `src/routes/ai-generate.ts`. Either key optional; zero-key lands on the template with a `provider=mock` badge. |
| **Storage** | Cloudflare R2 via `R2_BUCKET` binding | Artwork, contracts, demo files; 90-day auto-cleanup via cron trigger |
| **Testing** | Vitest (v4) | `node` environment by default; `jsdom` per-file when needed. Mocks via `msw`. |
| **Validation** | TypeScript strict + `tsc --noEmit` | Single typecheck pass; `@cloudflare/workers-types` for Worker globals |
| **CI/CD** | GitHub Actions — auto-deploy on push to `main` | Lint → typecheck → test → wrangler deploy → pages deploy |

**Anti-traps.** If scaffolding tempts you toward Express middleware, a `server/` directory, `jsonwebtoken`, a `migrations/` directory, a separate Jest/Mocha config, an nginx/Caddy reverse-proxy, or a `pg`-via-`node-postgres` driver — **stop**. Read this entire doc first, then ask before changing the model.

---

## Build & dev commands

```bash
# Full dev environment (two concurrent processes)
npm install -w apps/auralabels        # or `npm ci` at monorepo root
npm run dev -w apps/auralabels        # Vite on :5173 + Wrangler dev on :8787

# Type-check (single pass)
npm run typecheck -w apps/auralabels  # tsc --noEmit

# Tests (Vitest; 180 tests across 14 files)
npm test -w apps/auralabels           # vitest run
npm run test:watch -w apps/auralabels  # vitest (watch mode)
npm run test:coverage -w apps/auralabels  # vitest run --coverage (v8)

# Build frontend for production
npm run build:client -w apps/auralabels  # vite build

# Production deploy
npm run deploy -w apps/auralabels         # wrangler deploy
npm run deploy:pages -w apps/auralabels   # build:client + wrangler pages deploy

# Seed demo data (local dev)
npm run seed -w apps/auralabels           # node scripts/seed-local.mjs
```

**Dev server notes:**
- All commands below run from the monorepo root. Add `-w apps/auralabels` if using npm workspace syntax, or `cd apps/auralabels` to run directly.
- Vite dev server on `:5173` proxies `/api/*` to Wrangler on `:8787`
- Wrangler runs in `--local` mode (Miniflare) — no Cloudflare Access required
- If ports conflict: `pkill -f 'concurrently.*npm run dev' && pkill -f vite && pkill -f 'wrangler dev'`

---

## Project structure

```
apps/auralabels/
├── src/
│   ├── index.ts              # Worker entry — route dispatching, bootstrap admin, cron/email handlers
│   ├── auth.ts               # JWT auth via jose (Web Crypto API) — signToken, verifyToken, authenticateRequest
│   ├── db.ts                 # Drizzle ORM client factory (Neon HTTP, singleton pattern)
│   ├── env.ts                # Worker environment binding types (Env interface)
│   ├── routes/
│   │   ├── login.ts          # POST /api/login — bcrypt, rate limiting, timing-safe auth
│   │   ├── demos.ts          # CRUD + restore for demo submissions
│   │   ├── artists.ts        # CRUD + restore for artists
│   │   ├── releases.ts       # CRUD + restore for releases
│   │   ├── contracts.ts      # CRUD + restore for contracts
│   │   ├── tasks.ts          # CRUD + restore for tasks
│   │   ├── campaigns.ts      # CRUD + restore for promo campaigns
│   │   ├── ai-actions.ts     # CRUD for AI actions
│   │   ├── activities.ts     # CRUD + bulk-purge for activity feed
│   │   ├── notifications.ts  # Notification feed
│   │   ├── revenue.ts        # Revenue summaries
│   │   ├── admin.ts          # User management + beta application review
│   │   ├── ai-generate.ts    # POST /api/ai/generate — OpenRouter → Workers AI → template
│   │   ├── beta-applications.ts  # Public beta signup (rate-limited + honeypot)
│   │   ├── files.ts          # R2 file upload/serve/delete + scheduled cleanup
│   │   └── helpers.ts        # Shared helpers: jsonOk, jsonError, generateId, nowISO, parseBody, CorsHeaders type
│   ├── hooks/                # React hooks (useCardDelete, useFocusTrap, useUndoableDelete, useServiceWorkerUpdate)
│   ├── utils/
│   │   ├── api.ts            # Typed fetch wrappers for all endpoints, fetchWithTimeout, JWT helpers
│   │   ├── password.ts       # Password generation/validation
│   │   ├── version.ts        # Build-time version injection (__APP_VERSION__, __APP_NAME__)
│   │   ├── dateHelpers.ts    # Date formatting helpers
│   │   ├── statusHelpers.ts  # Status display helpers
│   │   ├── releaseReadiness.ts  # Release readiness calculation
│   │   ├── deriveFailureMode.ts # Failure mode derivation
│   │   ├── aiMock.ts         # Mock AI responses for development
│   │   └── lazyNamed.ts      # Lazy loading utility
│   ├── types/
│   │   └── index.ts          # ONE canonical types file. Don't create sibling types files.
│   ├── components/
│   │   ├── <surface>/         # One folder per sidebar surface (artists/, releases/, contracts/, demos/, promo/, calendar/, revenue/, ai-assistant/, content/, settings/)
│   │   ├── ui/               # Cross-surface primitives (Badge, Toast, Footer, FileUploader, StatusBadge, ErrorBoundary, OfflineBanner, UpdateBanner)
│   │   ├── auth/             # LoginPage, LoginForm, AuraBrand
│   │   ├── layout/           # AppLayout, Header, Sidebar, MobileTabBar, NotificationCenter, AiRail, AuraIntro
│   │   └── dashboard/        # Dashboard and its sub-components
│   ├── App.tsx               # React Router 7 routes + auth gate
│   ├── main.tsx              # Vite entry — registers service worker, renders App
│   └── index.css             # All @keyframes + design tokens + Tailwind v4 CSS
├── public/                   # Static assets (fonts, manifest, sw.js, _redirects, _headers, _routes.json, robots.txt, guide.html, startup.html)
├── functions/
│   └── api/[[path]].ts       # Pages Functions — proxies /api/* to Worker
├── scripts/                  # Seed scripts (seed-demo.mjs, seed-local.mjs), utility scripts
├── tests/                    # Vitest test files
│   ├── security/             # Auth tests (login-security.test.ts, login-form.test.tsx)
│   ├── hooks/                # Hook tests (useServiceWorkerUpdate.test.ts)
│   ├── components/           # Component tests (ErrorBoundary.test.tsx)
│   ├── *.test.ts / *.test.tsx  # Other test files
│   └── setup.ts              # Vitest setup (MSW handlers, global mocks)
├── vite.config.ts            # Vite config — proxy /api/* → :8787, @/* alias, tailwind plugin, manual chunks
├── vitest.config.ts          # Vitest config — node environment by default, jsdom per-file
├── wrangler.toml             # Worker config — R2 binding, AI binding, email binding, cron triggers
├── playwright.config.ts      # Playwright e2e test config
├── index.html                # Vite SPA shell
├── DESIGN.md                 # Design system tokens, typography, color rules
├── CHOREOGRAPHY.md           # Animation timing reference
├── MOBILE_FIRST.md           # Mobile-first design invariants
├── PRODUCT.md                # Product positioning, surfaces, brand personality
├── AGENTS.md                 # ← you are here
└── package.json

packages/
└── db/                       # Drizzle ORM schema definitions
    ├── src/
    │   ├── index.ts          # Barrel exports
    │   └── schema.ts         # All auralabels_* table schemas (12 tables)
    ├── drizzle/              # Drizzle Kit migrations
    ├── drizzle.config.ts
    ├── vitest.config.ts
    └── package.json
```

### Where to add new code

| You're adding… | Folder | Convention |
|---|---|---|
| A new API endpoint | `src/routes/` | One file per resource; register in the `routes` record in `src/index.ts` |
| A new sidebar surface (`/foo` route) | `src/components/foo/` | One file per screen (`FooPage.tsx`) + one detail file if needed. Reuse `src/components/ui/` primitives. |
| A reusable cross-surface component | `src/components/ui/` | PascalCase file matching default export. |
| A pure helper | `src/utils/` | camelCase (e.g. `dateHelpers.ts`, `statusHelpers.ts`); named exports. |
| A DB query | `src/db.ts` | Add prepared query function; reuse existing semantically-similar queries. |
| A schema change | `packages/db/src/schema.ts` | Add columns/tables in `auralabels_*` namespace; generate migration with `npx drizzle-kit generate`. |
| A new test file | `tests/` | `vitest.config.ts` includes `tests/**/*.test.ts` and `tests/**/*.test.tsx` by default. |
| A new agent skill | `.agents/skills/<name>/SKILL.md` | Mirror upstream YAML frontmatter + body; add row to `skills-lock.json`. |

---

## Data doctrine — the SaaS pivot

**The doctrine:** every tenant starts with an empty database. Onboarding is via UI CRUD. There is **no** fixture data, **no** seed payload, **no** mock data shim.

**Why:** AURA is multi-tenant in posture; demo data only confuses new operators. This is shippable posture, not "we ran out of time."

**Protected by tests:**
- `tests/no-mock-imports.test.ts` — Dashboard entry graph contains no `mock*` identifiers, no `src/data/*` imports
- `tests/server-no-inline-mock.ts` — route handler files contain no module-scope hardcoded fixture arrays

**If you find yourself writing fixture data: STOP.** The right move is a UI-side empty-state affordance and a real CRUD endpoint.

---

## Code conventions

- **TypeScript strict.** No `any`. The single legitimate `any` is "the value can truly be anything" (rare). One canonical types entry: `src/types/index.ts`.
- **Imports from `db.ts`.** Every route handler pulls its DB client from `getDb()`. Do not create additional DB clients; use the singleton.
- **One component per file.** Multi-export is allowed for tiny helpers in `src/components/ui/`. Every cross-surface consumer should be able to import a named default export.
- **Tailwind for all styling.** No CSS Modules, no styled-components, no inline `style={…}` except for the splash radial-gradient halo in `AuraIntro.tsx`.
- **Animation timing lives in `CHOREOGRAPHY.md`.** Every `@keyframes` in `src/index.css` has a row in `CHOREOGRAPHY.md`.
- **Brand chrome rule.** Cyan → violet gradient ONLY on the AURA logo SVG and the primary `Save Settings` button. Anywhere else — solid white or `text-zinc-*`.
- **Signal-orange rule.** Orange / amber is the status accent; ≤ 10 % of any given screen (active nav, filter pills, readiness fills, rating stars, monthly revenue bars). See `DESIGN.md §2 Named Rules`.
- **Single source of truth for `appTitle` + `appSubtitle`.** `src/components/layout/AppLayout.tsx`'s `getPageInfo()` is canonical.
- **Worker route handlers** follow a consistent signature: `(req: Request, env: Env, corsHeaders: CorsHeaders, url: URL) => Promise<Response>`. All registered in `src/index.ts`'s `routes` map.
- **Response shapes** are standardized: LIST returns bare array `T[]`, GET by ID returns `T` or `{ status: "ok", item: T }`, CREATE/UPDATE returns `{ status: "ok", item: T }`, DELETE returns `{ status: "ok", id: string }`.

---

## Security layers

AURA ships with defence-in-depth across four layers:

| Layer | Mechanism | Where |
|---|---|---|
| 1. Cloudflare WAF | Managed Ruleset (OWASP, XSS, SQLi) | Zone `auralabels.app` |
| 2. Cloudflare Access | Zero Trust gate in front of the Worker | `aura.gtnorbeat.workers.dev` — all requests redirected to Access login |
| 3. Rate limiting | 5 attempts / 15 min per IP (in-memory Map, `CF-Connecting-IP`) | `src/routes/login.ts` — `loginRateBuckets` |
| 4. Timing-safe auth | Dummy bcrypt hash for non-existent users, cost 10 | `src/routes/login.ts` — `DUMMY_HASH` constant |

**Tests:**
- `tests/security/login-security.test.ts` — 6 tests: rate limiting
- `tests/security/login-form.test.tsx` — 10 tests: login form rendering, submission, error handling
- Run with `npm test -w apps/auralabels` (180 total across 14 files)

---

## Auth architecture

- **HS256 JWTs** using `jose` (Web Crypto API) — compatible with Cloudflare Workers. **Do not use `jsonwebtoken`** (it depends on Node's `crypto` module).
- **Bearer token** in `Authorization` header. No cookies, no sessions.
- **Configurable TTL**: 7 days if "Remember me" is checked, 5 minutes if unchecked. `signToken()` in `src/auth.ts` accepts optional `expiry` parameter.
- **bcrypt at cost 10** for password hashes. Don't lower the cost.
- **Bootstrap admin:** `bootstrapAdminIfNeeded()` in `src/index.ts` — idempotent; runs on first request when users table is empty and `BOOTSTRAP_ADMIN_USERNAME` + `BOOTSTRAP_ADMIN_PASSWORD` are set.
- **Public routes** (no auth): `/api/health`, `/api/_health/live`, `/api/login`, `/api/beta-applications`, `GET /api/files/*`, `/api/webhook/*`.
- **Auth gate** checks `isPublicPath()`; all other `/api/*` routes require a valid Bearer token via `authenticateRequest()`.
- **`DUMMY_HASH` constant** ensures timing-safe bcrypt comparison even when the user doesn't exist — prevents username enumeration.

---

## AI pipeline

Three tiers, in order, all in `src/routes/ai-generate.ts`:

1. **OpenRouter** — `meta-llama/llama-3.3-70b-instruct:free`, only if `OPENROUTER_API_KEY` set. Badge: cyan.
2. **Workers AI** — `@cf/meta/llama-3.1-8b-instruct`, fallback via AI binding. Badge: emerald.
3. **Template fallback** — `generateWithTemplate()`, the third-tier static-string producer. Badge: zinc.

Provider badge colors are part of the UI contract (visible inline with the Output header on `/ai` and `/content`). Don't change the colors.

**Content Engine** (`/content` — distinct from `/ai`, per `PRODUCT.md §Surfaces`):
- The `Platform` selector injects `PLATFORM_GUIDANCE` into the LLM system prompt.
- The same rules hard-cap the template fallback (Instagram = 220 chars, Spotify = 500, Press has no cap, etc.).
- `/ai` is for general prompt-driven copy / strategy; `/content` is the channel-aware generation surface. **Don't merge them or rename one into the other.**

---

## Don't surprise me — footguns

1. **Don't import `jsonwebtoken`.** It uses Node's `crypto` module and won't run in Workers. Use `jose` (already in `package.json`) — it uses the standard Web Crypto API.
2. **Don't create a `server/` directory or Express middleware.** The Worker entry is `src/index.ts`; route handlers are in `src/routes/*.ts`. No `app.use()`, no `app.get()`, no middleware chains.
3. **Don't create a `migrations/` directory or a migration runner.** Schema lives in `packages/db/src/schema.ts` and migrations live in `packages/db/drizzle/`. Manage with `npx drizzle-kit generate` / `npx drizzle-kit push`.
4. **Don't reintroduce `mockData.ts` or seed fixture arrays anywhere.** Five regression tests will fail; empty-state affordances + real CRUD is the correct pattern.
5. **Don't add Jest / Mocha.** Use Vitest — it's already configured in `vitest.config.ts`. `node` environment by default; use `// @vitest-environment jsdom` per-file for DOM tests.
6. **Don't lower bcrypt rounds or shorten JWT TTL.** Audit trail assumes cost 10; don't drop below.
7. **Don't add an nginx / Caddy / reverse-proxy layer.** Cloudflare handles routing natively — Pages serves the SPA, the Worker handles `/api/*`.
8. **Don't shadow Tailwind utilities** (`animate-spin`, `animate-pulse`, `animate-ping`) with locally-named replacements. `CHOREOGRAPHY.md §3` warns about collisions.
9. **Don't add `any`.** Strict TS. The only legitimate `any` is when the value can truly be anything (rare).
10. **Don't read raw secret values into JSON responses.**
11. **Don't hardcode Cloudflare account IDs or zone IDs** in source code. They're configured in the Cloudflare dashboard, not in the repo.
12. **Don't assume `process.env` works** in Workers. Env vars come through the `env` parameter on the fetch handler. In `wrangler.toml`, vars are under `[vars]`; secrets use `wrangler secret put`.
13. **Don't use `dotenv`.** Workers don't run Node.js directly; env is injected via `wrangler dev --local` (reads `.dev.vars`) or via the `env` binding in production.

---

## Where to find what — pointer map

| File | What it is |
|---|---|
| `src/index.ts` | Worker entry — fetch handler, route dispatching, bootstrap admin, cron/email handlers |
| `src/auth.ts` | JWT signing/verification via `jose` (HS256) |
| `src/db.ts` | Drizzle ORM client singleton (Neon HTTP) |
| `src/env.ts` | `Env` interface — all Worker bindings and secrets |
| `src/routes/login.ts` | POST /api/login — bcrypt, rate limiting, timing-safe auth |
| `src/routes/ai-generate.ts` | AI generation — OpenRouter → Workers AI → template chain |
| `src/routes/helpers.ts` | Shared Response builders: `jsonOk`, `jsonError`, `generateId`, `nowISO`, `CorsHeaders` type |
| `src/routes/files.ts` | R2 file upload/serve/delete + scheduled 90-day cleanup |
| `src/App.tsx` | React Router 7 routes + auth gate |
| `src/main.tsx` | Vite entry — service worker registration, React render |
| `src/components/layout/AppLayout.tsx` | Authenticated app shell — sidebar, header, mobile tab bar, AI rail |
| `src/components/layout/AuraIntro.tsx` | Splash intro animation |
| `src/utils/api.ts` | Typed fetch wrappers for all endpoints, `fetchWithTimeout`, JWT helper |
| `src/types/index.ts` | Canonical types entry — every shared type lives here |
| `src/index.css` | All `@keyframes` + design tokens + Tailwind CSS |
| `vite.config.ts` | Vite config — `/api/*` proxy → `:8787`, `@/*` alias, React + Tailwind plugins, manual chunks |
| `vitest.config.ts` | Vitest config — `node` environment, `jsdom` per-file, MSW setup |
| `wrangler.toml` | Worker config — R2/AI/email bindings, cron triggers, observability |
| `packages/db/src/schema.ts` | All 12 `auralabels_*` table schemas |
| `packages/db/drizzle/` | Drizzle Kit migration files |
| `.github/workflows/ci.yml` | CI/CD — lint → typecheck → test → deploy |
| `tests/security/login-security.test.ts` | Rate limiting tests (6) |
| `tests/security/login-form.test.tsx` | Login form tests (10: render, submit, error handling, rememberMe) |
| `.agents/skills/` | Agent skills — see `skills-lock.json` for manifest |
| `skills-lock.json` | Skills manifest — every entry has `source`, `sourceType`, `skillPath`, `computedHash` |

---

## Cross-references (read these for the deep spec)

- **`PRODUCT.md`** — positioning, target users, brand personality, every named surface, AI pipeline, anti-references, design principles, accessibility commitments.
- **`DESIGN.md`** — color tokens, typography hierarchy, elevation, component specs, do's / don'ts, named rules.
- **`CHOREOGRAPHY.md`** — `@keyframes` inventory + timing reference + `prefers-reduced-motion` master block.
- **`MOBILE_FIRST.md`** — mobile-first design invariants, breakpoints, touch target rules.
- **`README.md`** — quick start, environment variables, API endpoint reference, deployment guide.
- **`aura-app.knowledge.md`** — comprehensive technical reference: schema, routes, auth, CI/CD, env vars, recent changes.
- **`.agents/skills/`** — agent skills: `impeccable` (design review), `frontend-design` (UI guidance), `code-review-expert`, `web-perf`, `find-skills`, etc.
