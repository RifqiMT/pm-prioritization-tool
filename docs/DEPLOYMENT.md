# Production Deployment (Vercel)

This application is a **static, local-first** web app. There is no backend server, database, or build-time bundler. Vercel serves the repository root (`index.html`, `css/`, `src/`) over HTTPS.

## Architecture on Vercel

| Layer | Responsibility |
|--------|----------------|
| **Vercel Edge / CDN** | Host static assets, TLS, compression, cache headers |
| **Browser** | UI, RICE/financial logic, `localStorage` persistence |
| **External APIs (browser)** | Exchange rates (Frankfurter, MoneyConvert), map tiles (OpenStreetMap), GeoJSON (jsDelivr), Leaflet (unpkg) |

Data **does not** leave the user’s browser except when the user explicitly uses export, or when the app fetches public exchange-rate / map resources.

## Prerequisites

- A [Vercel](https://vercel.com) account
- Git repository: `https://github.com/RifqiMT/pm-prioritization-tool`
- **No environment variables are required** for core functionality

## One-time Vercel project setup

1. In Vercel: **Add New → Project** → Import the GitHub repository.
2. **Root Directory**: leave as repository root (where `index.html` lives).
3. **Framework Preset**: Other (or detect as static).
4. **Build Command**: leave empty, or use `npm run build` (no-op placeholder).
5. **Output Directory**: `.` (repository root).
6. **Install Command**: optional; can be empty for zero-dependency deploy.
7. Deploy.

Configuration is also declared in `vercel.json` at the repo root.

## Configuration files

| File | Purpose |
|------|---------|
| `vercel.json` | Static output, SPA fallback rewrite, security headers, asset caching |
| `package.json` | Project metadata; optional `npm run dev` for local preview |
| `.vercelignore` | Exclude dev-only paths from upload |
| `.gitignore` | Keep secrets and `.vercel/` out of Git |

## Security headers (production)

`vercel.json` applies:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (restricts camera/mic/geo)
- **Content-Security-Policy** allowing required CDNs:
  - Fonts: Google Fonts
  - Scripts/styles: unpkg (Leaflet)
  - Connect: Frankfurter, MoneyConvert, jsDelivr
  - Images: OpenStreetMap tiles

If a third-party endpoint changes or is blocked, update CSP `connect-src` / `img-src` in `vercel.json`.

## Caching strategy

| Asset | Cache-Control |
|-------|----------------|
| `index.html` | `max-age=0, must-revalidate` (fast rollout of HTML changes) |
| `css/*`, `src/*` | `max-age=31536000, immutable` (long cache; bump by changing file contents) |

After deployments, users may need a hard refresh once if they cached old JS/CSS aggressively.

## Custom domain

1. Vercel project → **Settings → Domains**
2. Add your domain and follow DNS instructions (CNAME / nameservers).
3. Production branch is typically `main`.

## Preview vs production

| Environment | Trigger | URL pattern |
|-------------|---------|-------------|
| **Preview** | Pull request / non-production branch | `*.vercel.app` preview URL |
| **Production** | Push to production branch (`main`) | Production domain |

Each deployment is isolated; **user data remains in browser `localStorage`** per origin (preview URL ≠ production URL).

## Post-deploy smoke test

Run after each production deploy:

1. Open `/` — app shell loads, no console CSP errors.
2. Create a profile and project — RICE score computes.
3. Switch views: Table, Board, MOSCOW, Map.
4. **Refresh exchange rates** — rates label updates or shows graceful error.
5. Open Map view — tiles and country layer render.
6. Export JSON — file downloads.
7. Import JSON — merge works without duplicates corruption.
8. Filters: Countries and Project period popovers open and apply.

## Local production-like preview

```bash
npm run dev
# Open http://localhost:5173
```

Or:

```bash
python3 -m http.server 5173
```

## Operational guardrails (production)

- **No server-side backup**: remind users to export JSON/CSV regularly.
- **Exchange rates**: depend on third-party APIs; fallback rates apply when APIs fail.
- **Privacy**: portfolio data stays in the browser unless exported by the user.
- **Secrets**: never commit API keys; this app does not require them today.

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|----------------|--------|
| Blank page / 404 on deep links | Rewrite misconfiguration | Confirm `vercel.json` rewrites; root contains `index.html` |
| Map or rates fail | CSP or CORS | Check browser console; update `vercel.json` CSP `connect-src` |
| Stale UI after deploy | Browser cache | Hard refresh; verify `index.html` cache headers |
| Data missing on new URL | Different origin | `localStorage` is per-domain; export from old URL and import on new |

## Rollback

In Vercel: **Deployments** → select a previous successful deployment → **Promote to Production**.

## Related documentation

- `../README.md` — product overview and local setup
- `ARCHITECTURE.md` — runtime modules and data flow
- `GUARDRAILS.md` — business and technical limits
