# Production Deployment (Vercel + MongoDB)

The app is a **static UI** plus **Vercel serverless API** routes under `/api`. Portfolio data is stored in **MongoDB Atlas** when `MONGODB_URI` is configured; the browser keeps a **local cache** for faster reload and offline fallback.

## Architecture on Vercel

| Layer | Responsibility |
|--------|----------------|
| **Vercel CDN** | Host `index.html`, `css/`, `src/` |
| **Vercel Functions** | `GET /api/health`, `GET/PUT /api/state` → MongoDB |
| **MongoDB Atlas** | Primary workspace document (`workspaces` collection) |
| **Browser** | UI logic; `sessionStorage` for profile unlock + API key; `localStorage` cache when cloud is active |
| **External APIs** | Exchange rates, map tiles, GeoJSON |

## Required environment variables (Vercel)

Set these in **Project → Settings → Environment Variables** (Production and Preview):

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | **Yes** (for cloud) | Atlas connection string |
| `PM_API_SECRET` | **Yes** (recommended) | Bearer token the browser sends on `/api/state` |
| `PM_WORKSPACE_ID` | No | Document id (default: `default`) |
| `MONGODB_DB_NAME` | No | Database name (default: `pm_prioritization`) |
| `PM_ALLOW_ANONYMOUS` | No | Set `true` only for private dev (skips Bearer check) |

Copy from [`.env.example`](../.env.example). **Never commit** real secrets to Git.

Generate a secret:

```bash
openssl rand -hex 32
```

## One-time Vercel setup

1. Import the GitHub repository in Vercel.
2. **Root Directory:** repository root (where `index.html` lives).
3. **Install Command:** `npm install` (installs `mongodb` for API routes).
4. **Build Command:** `npm run build` (no-op; validates project).
5. **Output Directory:** `.`
6. Add environment variables above → **Redeploy**.

## Connecting the browser to cloud storage

After deploy, open the production URL:

1. Header status should show **Saved to cloud** when `PM_API_SECRET` is already in session, or prompt **Connect cloud storage**.
2. Click **Cloud** in the header (or the status label when auth is required).
3. Paste the same value as `PM_API_SECRET` → **Connect & sync**.

**One-time URL bootstrap** (bookmark without storing key in UI):

```
https://YOUR_DOMAIN/?pm_api_key=YOUR_PM_API_SECRET
```

The key is saved to `sessionStorage` and removed from the address bar.

## Data flow

1. On load, the app calls `GET /api/health`.
2. If `storage: "mongodb"`, it loads `GET /api/state` with `Authorization: Bearer <key>`.
3. If the cloud workspace is empty but `localStorage` has data, it **migrates** local data to MongoDB once.
4. On each change, state is written to `localStorage` (cache) and debounced to `PUT /api/state`.

Profile passwords remain **hashed in the payload** (PBKDF2); unlock state stays in **sessionStorage** only.

## Local development

| Command | Storage |
|---------|---------|
| `npm run dev` (static serve) | `localStorage` only (no `/api`) |
| `npx vercel dev` | Full stack + `.env` local |

Pull env for local API testing:

```bash
npx vercel env pull .env.local
npx vercel dev
```

## Post-deploy smoke test

1. `GET /api/health` → `{ "storage": "mongodb" }`
2. Open `/` → connect cloud with API key → status **Saved to cloud**
3. Create a profile and project → refresh → data persists (from MongoDB)
4. Open in another browser (same key) → same workspace data
5. Export/import still works as backup

## Security notes

- Treat `PM_API_SECRET` like a password; anyone with the key can read/write the workspace.
- Use a unique secret per environment (preview vs production).
- Do not set `PM_ALLOW_ANONYMOUS=true` on public production URLs.
- MongoDB user should have least privilege (read/write on one database only).

## Troubleshooting

| Symptom | Cause | Action |
|---------|--------|--------|
| **Local browser storage** on prod | `MONGODB_URI` missing or API failing | Check Vercel env + redeploy; verify `/api/health` |
| **Connect cloud storage** loop | Wrong/missing `PM_API_SECRET` | Re-enter key; match Vercel env exactly |
| 401 on `/api/state` | Bearer mismatch | Regenerate secret in Vercel + reconnect browser |
| Data different on preview vs prod | Separate origins + workspace ids | Use same `PM_WORKSPACE_ID` only if intentional |
| CSP blocks API | Rare | `connect-src` includes `'self'` in `vercel.json` |

## Related documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — modules and persistence
- [GUARDRAILS.md](GUARDRAILS.md) — limits and security
- [../.env.example](../.env.example) — variable template
