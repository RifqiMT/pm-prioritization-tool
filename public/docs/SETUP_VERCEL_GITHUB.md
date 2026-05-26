# One-time setup: GitHub → Vercel (MongoDB + public API)

Use this when MongoDB sync fails because `/api/config` returns **401 Authentication Required** or HTML.

## 1. Get three values from Vercel

| Secret | Where |
|--------|--------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create |
| `VERCEL_PROJECT_ID` | Project **linked to `RifqiMT/pm-prioritization-tool`** → **Settings → General** → Project ID (`prj_…`) |
| `VERCEL_ORG_ID` (optional) | Same page → Team ID, if the project is under a team |

Use the project that deploys from **`RifqiMT/pm-prioritization-tool`**, not the old React “Matrix” app.

## 2. Add GitHub secrets

GitHub → **RifqiMT/pm-prioritization-tool** → **Settings → Secrets and variables → Actions** → **New repository secret**

Add `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and optionally `VERCEL_ORG_ID`.

## 3. Run the fix workflow

GitHub → **Actions** → **Fix Vercel Deployment Protection** → **Run workflow** → **Run workflow**

Wait until it succeeds (green).

## 4. Redeploy

Vercel → your project → **Deployments** → latest → **⋯** → **Redeploy** (Production).

## 5. Fix the public domain (important)

`pm-prioritization-tool.vercel.app` may still point at the **wrong** React project.

1. **Old React project** → **Settings → Domains** → remove `pm-prioritization-tool.vercel.app`
2. **This project** (`RifqiMT/pm-prioritization-tool`) → **Settings → Domains** → add `pm-prioritization-tool.vercel.app`

## 6. Verify

```bash
npm run verify:deploy -- https://pm-prioritization-tool.vercel.app
```

Expected: exit code `0` and JSON with `"storage": "mongodb"`.

Open the app → header **Saved to cloud**.

## Optional: full deploy from GitHub

Add the same secrets plus run **Deploy to Vercel (Production)** workflow, or keep Vercel’s native Git integration (pushes to `main` already deploy via `vercel[bot]`).

See also [VERCEL_MONGODB_FIX.md](../public/docs/VERCEL_MONGODB_FIX.md).
