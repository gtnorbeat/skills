# AURA — Label Manager

React 19 SPA + Cloudflare Worker API backend. Neon Postgres via Drizzle ORM.

**Production:** [https://auralabels.app](https://auralabels.app)

---

## Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Cloudflare Worker + Pages |
| **Frontend** | React 19, Vite 6, Tailwind CSS v4, react-router-dom v7 |
| **Database** | Neon Postgres (serverless) via Drizzle ORM |
| **Auth** | JWT (HS256) with `bcryptjs` password hashing |
| **AI** | Workers AI (default) + OpenRouter (optional fallback) |
| **Storage** | Cloudflare R2 (artwork, contracts, demos) |
| **CI/CD** | GitHub Actions — auto-deploy on push to `main` |
| **Monorepo** | npm workspaces (`apps/*`, `packages/*`) |

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy env vars
cp apps/auralabels/.dev.vars.example apps/auralabels/.dev.vars

# Fill in JWT_SECRET and DATABASE_URL in .dev.vars, then:
npm run dev -w apps/auralabels
```

This starts **Vite HMR** (frontend at `:5173`) + **Wrangler dev** (Worker API at `:8787`) concurrently.

---

## Local Dev Commands

| Command | What it does |
|---------|-------------|
| `npm run dev -w apps/auralabels` | Full dev environment (Vite + Wrangler) |
| `npm run typecheck -w apps/auralabels` | TypeScript check |
| `npm run build:client -w apps/auralabels` | Build frontend for production |
| `npm run deploy -w apps/auralabels` | Deploy Worker to Cloudflare |
| `npm run deploy:pages -w apps/auralabels` | Build + deploy frontend to Pages |

---

## Environment Variables

All secrets go in `apps/auralabels/.dev.vars` for local dev, and `wrangler secret put` for production.

| Variable | Required | Purpose |
|----------|----------|---------|
| `JWT_SECRET` | **Yes** | JWT signing key (HS256) |
| `DATABASE_URL` | **Yes** | Neon Postgres connection string |
| `BOOTSTRAP_ADMIN_USERNAME` | First-run | Create initial admin account |
| `BOOTSTRAP_ADMIN_PASSWORD` | First-run | Initial admin password |
| `OPENROUTER_API_KEY` | Optional | AI generation (free models) |
| `WEBHOOK_SECRET` | Optional | Make.com integration |

---

## Architecture

```
auralabels.app
  ├── Frontend (Cloudflare Pages)
  │   └── React SPA — Vite build → static assets served by Pages
  │
  └── /api/* (Cloudflare Worker)
      ├── Auth: POST /api/login, GET /api/verify
      ├── CRUD: /api/demos, /api/artists, /api/releases, /api/contracts,
      │         /api/tasks, /api/campaigns, /api/ai-actions, /api/activities
      ├── Read: /api/notifications, /api/revenue
      ├── Admin: /api/admin
      ├── Public: /api/beta-applications, /api/health
      └── AI: /api/ai/generate (Workers AI or OpenRouter)
```

- **Route dispatching**: prefix matching (no router framework)
- **Auth**: JWT in `Authorization: Bearer` header, manual verification
- **Database**: Drizzle ORM with Neon serverless driver (`@neondatabase/serverless`)
- **Bootstrap admin**: First admin user seeded automatically when users table is empty

---

## Deployment

### Automatic (CI/CD)

Push to `main` → GitHub Actions:
1. **CI**: `npm ci` → lint → typecheck → build packages
2. **Deploy Worker**: `wrangler deploy`
3. **Deploy Frontend**: `vite build` → `wrangler pages deploy dist/`

Requires `CLOUDFLARE_API_TOKEN` secret in GitHub repo settings with `Workers:Edit` and `Pages:Edit` permissions.

### Manual

```bash
npm run deploy -w apps/auralabels           # Deploy Worker
npm run deploy:pages -w apps/auralabels     # Build + deploy frontend
```

---

## API Endpoints

All CRUD endpoints follow the same pattern — see `src/routes/` for handler signatures.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | No | Health check |
| `GET` | `/api/_health/live` | No | Liveness probe |
| `GET` | `/api/_debug/guards` | No | Boot guard diagnostics |
| `POST` | `/api/login` | No | Authenticate (username + password → JWT) |
| `GET` | `/api/verify` | Bearer | Token validation |
| `GET/POST` | `/api/demos` | Bearer | List / create demos |
| `GET/PUT/DELETE` | `/api/demos/:id` | Bearer | Get / update / delete demo |
| `POST` | `/api/demos/:id/restore` | Bearer | Restore soft-deleted demo |
| *(same pattern for artists, releases, contracts, tasks, campaigns, ai-actions, activities)* |
| `GET` | `/api/notifications` | Bearer | Notification feed |
| `GET` | `/api/revenue` | Bearer | Revenue summaries |
| `GET/POST` | `/api/admin/*` | Bearer | User management, beta review |
| `POST` | `/api/beta-applications` | Public | Beta signup (rate-limited + honeypot) |
| `POST` | `/api/ai/generate` | Bearer | AI text generation |
| `POST` | `/api/files/upload` | Bearer | Upload file to R2 (multipart) |
| `GET` | `/api/files/:key` | Public | Serve file from R2 (images, PDFs) |
| `DELETE` | `/api/files/:key` | Bearer | Delete file from R2 |

---

## Project Structure

```
apps/auralabels/
├── src/
│   ├── index.ts           # Worker entry — route dispatching + bootstrap admin
│   ├── auth.ts            # JWT verification, public path gating
│   ├── db.ts              # Drizzle client factory (Neon)
│   ├── env.ts             # Worker binding types
│   ├── routes/            # ~15 handler files (auth, CRUD, admin, AI, health, files)
│   ├── hooks/             # React hooks (useCardDelete, useFocusTrap, etc.)
│   ├── utils/             # API client, date/status helpers, uploadFile
│   ├── types/             # Shared TypeScript types
│   ├── components/        # React UI components + ui/ (FileUploader, StatusBadge, etc.)
│   ├── App.tsx            # React root with routing
│   └── main.tsx           # Vite entry
├── functions/             # Pages Functions (proxies /api/* to Worker)
├── scripts/               # Seed scripts (seed-demo.mjs)
├── public/                # Static assets (fonts, manifest, sw.js)
├── vite.config.ts         # Vite config (proxies /api/* to wrangler dev)
├── wrangler.toml          # Worker config (R2, AI binding, observability)
└── package.json

packages/
└── db/                    # Drizzle ORM schemas + migrations (12 tables)
```

---

## Database

12 tables in the `auralabels_*` namespace, defined in `packages/db/src/schema.ts`:

`users`, `demos`, `artists`, `releases`, `contracts`, `tasks`, `campaigns`, `ai_actions`, `activities`, `notifications`, `revenue`, `beta_applications`

Managed via Drizzle Kit migrations:
```bash
cd packages/db
npx drizzle-kit push       # Push schema changes to dev DB
npx drizzle-kit generate   # Generate migration files
```
