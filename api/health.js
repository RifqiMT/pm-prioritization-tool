const { isMongoConfigured } = require("./_lib/mongo");
const { getWorkspaceId, isAuthRequired } = require("./_lib/auth");
const { sendJson } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const mongo = isMongoConfigured();
  return sendJson(res, 200, {
    ok: true,
    storage: mongo ? "mongodb" : "unavailable",
    workspaceId: getWorkspaceId(),
    authRequired: isAuthRequired(),
    version: 1
  });
};
