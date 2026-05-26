#!/usr/bin/env bash
# Disables Vercel SSO Deployment Protection so /api/* is publicly reachable.
# Usage:
#   export VERCEL_TOKEN=...
#   export VERCEL_PROJECT_ID=prj_...   # Settings → General → Project ID
#   ./scripts/disable-vercel-deployment-protection.sh

set -euo pipefail

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Set VERCEL_TOKEN (https://vercel.com/account/tokens)" >&2
  exit 1
fi

if [[ -z "${VERCEL_PROJECT_ID:-}" ]]; then
  echo "Set VERCEL_PROJECT_ID from Vercel → Project → Settings → General" >&2
  exit 1
fi

URL="https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}"
if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
  URL="${URL}?teamId=${VERCEL_TEAM_ID}"
fi

echo "Disabling ssoProtection on project ${VERCEL_PROJECT_ID}..."
curl -fsS -X PATCH "$URL" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection":null}' \
  | python3 -m json.tool 2>/dev/null || true

echo "Done. Redeploy Production, then run: npm run verify:deploy -- https://YOUR-DOMAIN"
