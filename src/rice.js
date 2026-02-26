/**
 * RICE Prioritizer - RICE scoring and validation
 * Implements the RICE formula: (Reach × Impact × Confidence) ÷ Effort.
 * Confidence is normalized from 0–100% to 0–1 when > 1.
 *
 * NOTE: This file is loaded as a classic <script>, not as an ES module.
 * All top-level functions become globals that the rest of the app can call.
 */
function calculateRiceScore(project) {
  const reach = Number(project.reachValue || 0);
  const impact = Number(project.impactValue || 0);
  let confidence = Number(project.confidenceValue || 0);
  const effort = Number(project.effortValue || 0);
  if (effort <= 0) return 0;
  if (confidence > 1) {
    confidence = confidence / 100;
  }
  const score = (reach * impact * confidence) / effort;
  if (!Number.isFinite(score) || score < 0) return 0;
  return score;
}

function formatRice(value) {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  if (value >= 1000) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 0
    });
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function validateProjectInput(raw) {
  if (!raw.title) return "Project title is required.";
  if (raw.reachValue == null || !Number.isFinite(raw.reachValue) || raw.reachValue < 0) {
    return "Reach value must be a non-negative integer.";
  }
  if (!Number.isInteger(raw.reachValue)) {
    return "Reach value must be an integer (no decimals).";
  }
  if (raw.impactValue == null || !Number.isFinite(raw.impactValue) || raw.impactValue < 1 || raw.impactValue > 5) {
    return "Impact must be between 1 and 5.";
  }
  if (raw.confidenceValue == null || !Number.isFinite(raw.confidenceValue) || raw.confidenceValue < 0 || raw.confidenceValue > 100) {
    return "Confidence must be between 0 and 100.";
  }
  if (raw.effortValue == null || !Number.isFinite(raw.effortValue) || raw.effortValue < 1 || raw.effortValue > 5) {
    return "Effort must be between 1 and 5.";
  }
  if (raw.financialImpactValue != null && (!Number.isFinite(raw.financialImpactValue) || raw.financialImpactValue < 0)) {
    return "Financial impact must be a non-negative number.";
  }
  if (raw.financialImpactValue != null && raw.financialImpactValue !== 0 && !raw.financialImpactCurrency) {
    return "Select a currency when financial impact is provided.";
  }
  return "";
}

