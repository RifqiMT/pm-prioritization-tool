/**
 * Server-side workspace dedupe for MongoDB (Vercel production).
 * Reuses the same merge rules as the browser WorkspaceMerge module.
 */
const WorkspaceMerge = require("../../src/modules/workspace-merge.js");

function dedupeWorkspacePayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return WorkspaceMerge.dedupeWorkspacePayload(payload);
}

function workspacePayloadChangedByDedupe(before, after) {
  if (!before && !after) return false;
  if (!before || !after) return true;
  return (
    WorkspaceMerge.countProfiles(before) !== WorkspaceMerge.countProfiles(after) ||
    WorkspaceMerge.countRoadmaps(before) !== WorkspaceMerge.countRoadmaps(after) ||
    JSON.stringify(before) !== JSON.stringify(after)
  );
}

module.exports = {
  WorkspaceMerge,
  dedupeWorkspacePayload,
  workspacePayloadChangedByDedupe
};
