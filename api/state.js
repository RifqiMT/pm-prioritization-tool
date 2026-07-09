const { getDb, isMongoConfigured } = require("./_lib/mongo");
const { verifyRequest } = require("./_lib/auth");
const { sendJson, readJsonBody } = require("./_lib/http");
const { normalizeWorkspacePayload } = require("./_lib/roadmap-metadata");
const {
  dedupeWorkspacePayload,
  workspacePayloadChangedByDedupe
} = require("./_lib/workspace-dedupe");

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

function getDocumentRevision(doc) {
  if (!doc || typeof doc.revision !== "number" || !Number.isFinite(doc.revision)) {
    return 0;
  }
  return doc.revision;
}

function buildConflictResponse(res, workspaceId, doc) {
  return sendJson(res, 409, {
    ok: false,
    error: "Workspace was updated by another session. Merge and retry.",
    conflict: true,
    workspaceId,
    revision: getDocumentRevision(doc),
    updatedAt: doc && doc.updatedAt ? doc.updatedAt : null,
    payload: doc && doc.payload ? doc.payload : null
  });
}

async function handleWrite(req, res, workspaceId) {
  const body = await readJsonBody(req);
  const rawPayload = body && body.payload != null ? body.payload : body;
  const validation = validatePayload(rawPayload);
  if (!validation.ok) {
    return sendJson(res, 400, { ok: false, error: validation.error });
  }

  const payload = dedupeWorkspacePayload(normalizeWorkspacePayload(rawPayload));
  const expectedRevision =
    body && body.expectedRevision != null && body.expectedRevision !== ""
      ? Number(body.expectedRevision)
      : null;

  const db = await getDb();
  const collection = db.collection(COLLECTION);
  const existing = await collection.findOne({ workspaceId });
  const currentRevision = getDocumentRevision(existing);
  const updatedAt = new Date().toISOString();

  if (!existing) {
    const revision = 1;
    await collection.insertOne({
      workspaceId,
      payload,
      updatedAt,
      revision,
      version: 1
    });
    return sendJson(res, 200, {
      ok: true,
      workspaceId,
      updatedAt,
      revision
    });
  }

  if (expectedRevision != null && Number.isFinite(expectedRevision) && expectedRevision !== currentRevision) {
    return buildConflictResponse(res, workspaceId, existing);
  }

  const nextRevision = currentRevision + 1;
  const updateResult = await collection.updateOne(
    { workspaceId, revision: currentRevision },
    {
      $set: {
        workspaceId,
        payload,
        updatedAt,
        revision: nextRevision,
        version: 1
      }
    }
  );

  if (!updateResult.matchedCount) {
    const fresh = await collection.findOne({ workspaceId });
    return buildConflictResponse(res, workspaceId, fresh || existing);
  }

  return sendJson(res, 200, {
    ok: true,
    workspaceId,
    updatedAt,
    revision: nextRevision
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
      let payload = doc && doc.payload ? doc.payload : null;
      let updatedAt = doc && doc.updatedAt ? doc.updatedAt : null;
      let revision = getDocumentRevision(doc);

      if (payload) {
        const deduped = dedupeWorkspacePayload(payload);
        if (workspacePayloadChangedByDedupe(payload, deduped)) {
          const nextRevision = revision + 1;
          const nextUpdatedAt = new Date().toISOString();
          const updateResult = await collection.updateOne(
            { workspaceId, revision },
            {
              $set: {
                payload: deduped,
                updatedAt: nextUpdatedAt,
                revision: nextRevision
              }
            }
          );
          if (updateResult.matchedCount) {
            payload = deduped;
            updatedAt = nextUpdatedAt;
            revision = nextRevision;
          } else {
            payload = deduped;
          }
        } else {
          payload = deduped;
        }
      }

      return sendJson(res, 200, {
        ok: true,
        workspaceId,
        payload,
        updatedAt,
        revision
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
