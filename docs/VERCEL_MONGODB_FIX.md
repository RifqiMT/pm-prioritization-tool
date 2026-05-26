# Fix: MongoDB not syncing on Vercel

If the app header shows **Local browser storage** or **Cloud unavailable**, work through this checklist.

## Step 1 — Confirm the correct app is deployed

Open in your browser:

```text
https://YOUR-DOMAIN/api/config
```

### Expected (correct)

```json
{
  "ok": true,
  "storage": "mongodb",
  "authRequired": false,
  "workspaceId": "default",
  "version": 1
}
```

### Wrong (common problem)

You see **HTML** for a React app (“PM Prioritization Matrix”, `create-react-app`, `/static/js/main.*.js`).

That means the Vercel project on this domain is **not** this repository. MongoDB env vars on another project will not help.

**Fix:**

1. Vercel → **Add New → Project** → Import **`RifqiMT/pm-prioritization-tool`** (or open the existing project linked to that repo).
2. Do **not** use an old “matrix” React repo on the same domain if you want this tool.
3. **Settings → Git** → confirm repository = `RifqiMT/pm-prioritization-tool`, branch = `main`.
4. **Redeploy** the latest commit.

After deploy, `/` should show **Product Management Prioritization Tool** (vanilla HTML, not a React bundle), and `/api/config` must return JSON.

---

## Step 2 — Environment variables

Vercel → Project → **Settings → Environment Variables** → **Production**:

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGODB_URI` | Yes | Atlas connection string from Integrations or Atlas |
| `PM_API_SECRET` | No | If omitted, API allows access when only MongoDB is configured |
| `PM_WORKSPACE_ID` | No | Default `default` |
| `MONGODB_DB_NAME` | No | Default `pm_prioritization` |

**Redeploy** after any env change.

---

## Step 3 — MongoDB Atlas

1. **Network Access** → allow `0.0.0.0/0` (or Vercel IP ranges).
2. **Database Access** → user with read/write on your database.
3. If you rotated the password, update `MONGODB_URI` in Vercel.

---

## Step 4 — Verify in the app

1. Hard refresh the site (Ctrl+Shift+R / Cmd+Shift+R).
2. Header should show **Saved to cloud**.
3. Create a test profile → refresh → data should remain.
4. Optional: **Cloud** → **Sync now** (when already connected).

If you use `PM_API_SECRET`, connect once via **Cloud** or:

```text
https://YOUR-DOMAIN/?pm_api_key=YOUR_SECRET
```

---

## Step 5 — Command-line check

From the repo root:

```bash
npm run verify:deploy -- https://YOUR-DOMAIN
```

Exit code `0` = API and MongoDB config look correct.

---

## Still stuck?

Capture and share:

1. Full URL of your production site  
2. First 200 characters of `https://YOUR-DOMAIN/api/config`  
3. Screenshot of Vercel **Environment Variables** (hide secrets)  
4. Vercel deployment **Build log** (install step shows `mongodb` package)
