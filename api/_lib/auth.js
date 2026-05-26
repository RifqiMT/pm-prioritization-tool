function getWorkspaceId() {
  const id = process.env.PM_WORKSPACE_ID || "default";
  return String(id).trim() || "default";
}

function isAuthRequired() {
  return process.env.PM_ALLOW_ANONYMOUS !== "true";
}

function getConfiguredSecret() {
  const secret = process.env.PM_API_SECRET;
  return secret && String(secret).trim() ? String(secret).trim() : null;
}

function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : "";
}

function verifyRequest(req) {
  if (!isAuthRequired()) {
    return { ok: true, workspaceId: getWorkspaceId() };
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
  return { ok: true, workspaceId: getWorkspaceId() };
}

module.exports = {
  getWorkspaceId,
  isAuthRequired,
  getConfiguredSecret,
  verifyRequest
};
