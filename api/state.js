const { getDb, isMongoConfigured } = require("./_lib/mongo");
const { verifyRequest } = require("./_lib/auth");
const { sendJson, readJsonBody } = require("./_lib/http");
const { normalizeWorkspacePayload } = require("./_lib/roadmap-metadata");

const COLLECTION = "workspaces";

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload must be an object" };
  }
  if (!Array.isArray(payload.profiles)) {
    return { ok: false, error: "payload.profiles must be an array" };
  }
  return { ok: true };
}

async function handleWrite(req, res, workspaceId) {
  const body = await readJsonBody(req);
  const rawPayload = body && body.payload != null ? body.payload : body;
  const validation = validatePayload(rawPayload);
  if (!validation.ok) {
    return sendJson(res, 400, { ok: false, error: validation.error });
  }
  const payload = normalizeWorkspacePayload(rawPayload);

  const db = await getDb();
  const collection = db.collection(COLLECTION);
  const updatedAt = new Date().toISOString();

  await collection.updateOne(
    { workspaceId },
    {
      $set: {
        workspaceId,
        payload,
        updatedAt,
        version: 1
      }
    },
    { upsert: true }
  );

  return sendJson(res, 200, {
    ok: true,
    workspaceId,
    updatedAt
  });
}

module.exports = async function handler(req, res) {
  if (!isMongoConfigured()) {
    return sendJson(res, 503, {
      ok: false,
      error: "MongoDB is not configured. Set MONGODB_URI on Vercel."
    });
  }

  const auth = verifyRequest(req);
  if (!auth.ok) {
    return sendJson(res, auth.status, { ok: false, error: auth.error });
  }

  const workspaceId = auth.workspaceId;
  const method = String(req.method || "GET").toUpperCase();

  try {
    const db = await getDb();
    const collection = db.collection(COLLECTION);

    if (method === "GET") {
      const doc = await collection.findOne({ workspaceId });
      return sendJson(res, 200, {
        ok: true,
        workspaceId,
        payload: doc && doc.payload ? doc.payload : null,
        updatedAt: doc && doc.updatedAt ? doc.updatedAt : null
      });
    }

    if (method === "PUT" || method === "POST") {
      return await handleWrite(req, res, workspaceId);
    }

    res.setHeader("Allow", "GET, PUT, POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("api/state error", err);
    return sendJson(res, 500, {
      ok: false,
      error: "Failed to access workspace storage",
      detail: process.env.NODE_ENV === "development" ? String(err.message || err) : undefined
    });
  }
};
