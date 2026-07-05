# AURA — Instructions & Quick Reference

Quick reference for the AURA Cloudflare Workers monorepo.

---

## Quick Start

```bash
# Install dependencies
npm install

# Type-check everything
npm run build

# Lint
npm run lint
```

---

## Development

### AURA Label Manager (auralabels)

```bash
# Run full dev environment (Vite HMR + Wrangler dev)
npm run dev -w apps/auralabels
```

This starts:
- **Vite dev server** (React SPA with hot reload, proxies `/api/*` to `:8787`)
- **Wrangler dev** (Worker API backend at port 8787)



---

## Key Commands

| Command | What it does |
|---------|-------------|
| `npm run build` | Type-check all packages + auralabels |
| `npm run lint` | ESLint across repo |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run deploy` | Deploy auralabels Worker + Pages |
| `npm run dev -w apps/auralabels` | Run auralabels locally |
| `npm run typecheck -w apps/auralabels` | Type-check auralabels only |

---

## Environment Setup

Copy the `.dev.vars.example` file from the auralabels app:

```bash
cp apps/auralabels/.dev.vars.example apps/auralabels/.dev.vars
```

### Key Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `JWT_SECRET` | auralabels | JWT signing key (required) |
| `DATABASE_URL` | auralabels | Neon Postgres connection string (required) |
| `OPENROUTER_API_KEY` | auralabels | AI generation via OpenRouter (optional) |
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | Wrangler deploy auth |

---

## Project Structure

```
apps/
└── auralabels/        # React SPA + Cloudflare Worker backend
    ├── src/
    │   ├── routes/    # 12 CRUD handler files
    │   └── components/# React UI components

packages/
└── db/                # Drizzle ORM schemas (12 tables)
```

---

## Deployment

Deploy happens automatically on push to `main` via GitHub Actions (requires `CLOUDFLARE_API_TOKEN` secret).

Manual deploy:

```bash
npm run deploy
```

This deploys the auralabels Worker (`wrangler deploy`) + frontend (`wrangler pages deploy`).

---

## Testing

```bash
# Run auralabels test suite
npm run test -w apps/auralabels
```

Tests are written with Vitest in `apps/auralabels/tests/`.

---

## CI/CD Pipeline

`.github/workflows/ci.yml`:

1. **CI** — runs on every push and PR to `main`: lint → typecheck → test
2. **Deploy** — runs after CI passes, only on push to `main`: rebuild + `wrangler deploy` auralabels Worker + `wrangler pages deploy` frontend

Secrets needed in GitHub repo settings: `CLOUDFLARE_API_TOKEN`.

---

## Troubleshooting

### "DATABASE_URL not set"
Copy `.dev.vars.example` to `.dev.vars` and fill in the connection string.

### Worker won't deploy
- Verify `CLOUDFLARE_API_TOKEN` secret is set in GitHub repo settings
- Check `wrangler.toml` route configuration
- Run `npm run build` first to catch type errors

### auralabels won't start
```bash
npm run dev -w apps/auralabels   # starts Vite + Wrangler dev concurrently
```
Check that `JWT_SECRET` and `DATABASE_URL` are in `apps/auralabels/.dev.vars`.

### Type errors after pull
```bash
npm run build   # rebuilds and type-checks everything
```

---

*Last updated: July 1, 2026*
