# Production Deployment (Vercel + MongoDB)

| Field | Value |
|-------|-------|
| **Last updated** | 2026-07-09 |
| **Implementation baseline** | `APP_ASSET_VERSION` = `20260709-ui199` |

The app is a **static UI** plus **Vercel serverless API** routes under `/api`. Portfolio data is stored in **MongoDB Atlas** when `MONGODB_URI` is configured; the browser keeps a **local cache** for faster reload and offline fallback.

## Architecture on Vercel

| Layer | Responsibility |
|--------|----------------|
| **Vercel CDN** | Host `index.html`, `css/`, `src/` at repo root |
| **Vercel Functions** | `GET /api/health`, `GET/PUT /api/state` → MongoDB; `POST /api/byok/validate-*` for BYOK key checks |
| **MongoDB Atlas** | Primary workspace document (`workspaces` collection) |
| **Browser** | UI logic; `sessionStorage` for profile unlock; `localStorage` for workspace cache + encrypted BYOK keys (`pm_byok_v1`, separate from cloud) |
| **Persistence** | Full workspace JSON (`profiles`, UI prefs, exchange rates) under `STORAGE_KEY`; cloud mirror at `PUT /api/state` when `MONGODB_URI` is set |
| **External APIs** | Exchange rates, map tiles, GeoJSON; **Groq** + **Tavily** (client-side BYOK only; allowed in CSP `connect-src`) |

## Required environment variables (Vercel)

Set these in **Project → Settings → Environment Variables** (Production and Preview):

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | **Yes** (for cloud) | Atlas connection string |
| `PM_API_SECRET` | No (optional) | If set, browser must connect via **Cloud** menu. If omitted, API works with `MONGODB_URI` only (single-tenant). |
| `PM_WORKSPACE_ID` | No | Document id (default: `default`) |
| `MONGODB_DB_NAME` | No | Database name (default: `pm_prioritization`) |
| `PM_ALLOW_ANONYMOUS` | No | Set `true` only for private dev (skips Bearer check) |

Copy from [`.env.example`](../.env.example). **Never commit** real secrets to Git.

Generate a secret:

```bash
openssl rand -hex 32
```

## One-time Vercel setup

1. Import **`RifqiMT/pm-prioritization-tool`** in Vercel (not the old React “matrix” repo).
2. **Root Directory:** repository root (contains `index.html`, `api/`).
3. **Install Command:** `npm install` (installs `mongodb` for API routes).
4. **Build Command:** `npm run build` (validates layout).
5. **Output Directory:** `.` (repository root — see `vercel.json`).
6. Add environment variables above → **Redeploy**.

## Connecting the browser to cloud storage

After deploy, open the production URL:

1. Visit `https://pm-prioritization-tool-six.vercel.app/api/config` — expect JSON: `"storage": "mongodb"`.
2. If you **only** set `MONGODB_URI` (no `PM_API_SECRET`), the header should show **Saved to cloud** automatically after redeploy.
3. If you set `PM_API_SECRET`, click **Cloud** → paste the secret → **Connect & sync** (stored in `localStorage` for return visits).

**Verify API is not static HTML:** `/api/config` must return JSON, not your `index.html` page. If you see HTML, redeploy after pulling the latest `vercel.json` (no `outputDirectory: "."`).

**One-time URL bootstrap** (when using `PM_API_SECRET`):

```
https://YOUR_DOMAIN/?pm_api_key=YOUR_PM_API_SECRET
```

## Data flow

1. On load, the app calls `GET /api/health`.
2. If `storage: "mongodb"`, it loads `GET /api/state` with `Authorization: Bearer <key>`.
3. If the cloud workspace is empty but `localStorage` has data, it **migrates** local data to MongoDB once.
4. On each change, state is written to `localStorage` (cache), deduped via `WorkspaceMerge.dedupeWorkspacePayload`, merged with remote if needed, and debounced to `PUT /api/state` with `expectedRevision`.
5. If another session saved first, the server returns **HTTP 409** with the current payload and `revision`; the client merges and retries automatically.

Profile passwords remain **hashed in the payload** (PBKDF2); unlock state stays in **sessionStorage** only.

**BYOK API keys** (Groq/Tavily) are encrypted in `localStorage` (`pm_byok_v1`) on the client only — never in MongoDB or workspace export. Validation uses `POST /api/byok/validate-groq` and `POST /api/byok/validate-tavily` (key sent only during explicit user validation). LLM summary, Five Why, and Tavily calls run **from the browser**; `vercel.json` CSP `connect-src` must include `https://api.groq.com` and `https://api.tavily.com`.

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
3. Create a profile and roadmap → refresh → data persists (from MongoDB)
4. Open in another browser (same key) → same workspace data
5. Export/import still works as backup

## Security notes

- Treat `PM_API_SECRET` like a password; anyone with the key can read/write the workspace.
- Use a unique secret per environment (preview vs production).
- Do not set `PM_ALLOW_ANONYMOUS=true` on public production URLs.
- MongoDB user should have least privilege (read/write on one database only).

## Troubleshooting (MongoDB sync)

If the header shows **Local browser storage** or **Cloud unavailable**, work through this checklist.

### 1. Disable Vercel Deployment Protection (required for `/api`)

New Vercel projects often return **401 Authentication Required** on `/api/config`. Turn protection off for **Production**:

1. Vercel → project linked to **`RifqiMT/pm-prioritization-tool`** → **Settings → Deployment Protection**.
2. Set **Production** to **None** (disable Vercel Authentication).
3. **Save** → **Redeploy** `main`.

Verify:

```bash
npm run verify:deploy -- https://YOUR-DOMAIN
```

**CLI:** `./scripts/disable-vercel-deployment-protection.sh`

Requires environment variables:

| Variable | Required | Source |
|----------|----------|--------|
| `VERCEL_TOKEN` | Yes | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_PROJECT_ID` | Yes | Vercel → Project → Settings → General → Project ID (`prj_…`) |
| `VERCEL_TEAM_ID` | No | Team settings if project is under a team |

The script PATCHes `ssoProtection: null` on the project, then you must **redeploy Production** and run `npm run verify:deploy`.

**GitHub Actions:** Add secrets `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` (and optional `VERCEL_ORG_ID`) → run **Actions → Fix Vercel Deployment Protection** → redeploy.

### 2. Confirm the correct app is deployed

Open `https://YOUR-DOMAIN/api/config`. Expected JSON:

```json
{ "ok": true, "storage": "mongodb", "authRequired": false, "workspaceId": "default", "version": 1 }
```

If you see **HTML** for a React app (“PM Prioritization Matrix”), the domain points at the **wrong** Vercel roadmap. Fix **Settings → Git** to use this repo, or create a new roadmap and move the domain. Production URL: **`pm-prioritization-tool-six.vercel.app`** — not `pm-prioritization-tool.vercel.app` (legacy React app).

### 3. Environment variables and Atlas

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGODB_URI` | Yes | Atlas connection string |
| `PM_API_SECRET` | No | Optional Bearer auth |
| `PM_WORKSPACE_ID` | No | Default `default` |
| `MONGODB_DB_NAME` | No | Default `pm_prioritization` |

Redeploy after any env change. In Atlas: **Network Access** `0.0.0.0/0`, database user with read/write.

### 4. Verify in the app

1. Hard refresh → header **Saved to cloud**.
2. Create a profile → refresh → data persists.
3. **Cloud** menu → Pull / Save, or click the storage label.

With `PM_API_SECRET`: connect via **Cloud** menu or `https://YOUR-DOMAIN/?pm_api_key=YOUR_SECRET`.

### Quick reference

| Symptom | Cause | Action |
|---------|--------|--------|
| **Local browser storage** on prod | Missing/failing API or protection | Steps 1–3 above |
| **Connect cloud storage** loop | Wrong `PM_API_SECRET` | Re-enter key; match Vercel env |
| 401 on `/api/state` | Bearer mismatch | Regenerate secret + reconnect |
| `/api/config` returns HTML | Wrong Vercel project | Step 2 |
| Data differs preview vs prod | Separate origins | Same `PM_WORKSPACE_ID` only if intentional |

## CI and automated tests

GitHub Actions workflow `.github/workflows/ci.yml` runs on every push/PR to `main`:

1. `npm ci`
2. `npm run build` — validates static root + `api/state.js`
3. `npm test` — twelve script suites (storage, metadata, persistence, export, byok, byok-validate, kano, llm, 5why, periods, gantt, share)

Post-deploy smoke: `npm run verify:production` (or `verify:deploy` with your URL).

Cross-feature behavior reference: [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md).

## Related documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — modules and persistence
- [GUARDRAILS.md](GUARDRAILS.md) — limits and security
- [TECH_GUIDELINES.md](TECH_GUIDELINES.md) — §15 automated tests
- [../.env.example](../.env.example) — variable template
