const { sendJson, readJsonBody } = require("../_lib/http");
const { validateTavilyKey } = require("../_lib/byok-validate");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
  }

  const apiKey = body && typeof body.apiKey === "string" ? body.apiKey : "";
  const result = await validateTavilyKey(apiKey);
  return sendJson(res, 200, result);
};
