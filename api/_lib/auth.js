const { isMongoConfigured } = require("./mongo");

function getWorkspaceId() {
  const id = process.env.PM_WORKSPACE_ID || "default";
  return String(id).trim() || "default";
}

function getConfiguredSecret() {
  const secret =
    process.env.PM_API_SECRET ||
    process.env.PM_API_KEY ||
    process.env.API_SECRET;
  return secret && String(secret).trim() ? String(secret).trim() : null;
}

/**
 * Auth is optional when:
 * - PM_ALLOW_ANONYMOUS=true, or
 * - MongoDB is configured but no PM_API_SECRET (single-tenant Vercel + Atlas setup).
 */
function isAuthRequired() {
  if (process.env.PM_ALLOW_ANONYMOUS === "true") {
    return false;
  }
  if (isMongoConfigured() && !getConfiguredSecret()) {
    return false;
  }
  return true;
}

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : "";
}

function verifyRequest(req) {
  if (!isAuthRequired()) {
    return { ok: true, workspaceId: getWorkspaceId(), anonymous: true };
  }

  const configured = getConfiguredSecret();
  if (!configured) {
    return {
      ok: false,
      status: 503,
      error: "Server misconfiguration: PM_API_SECRET is not set"
    };
  }

  const token = extractBearerToken(req);
  if (!token || token !== configured) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true, workspaceId: getWorkspaceId(), anonymous: false };
}

module.exports = {
  getWorkspaceId,
  isAuthRequired,
  getConfiguredSecret,
  verifyRequest
};
