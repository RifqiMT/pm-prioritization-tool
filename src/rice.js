/**
 * Product Management Prioritization Tool - RICE scoring and validation
 * Implements the RICE formula: (Reach × Impact × Confidence) ÷ Effort.
 * Confidence is normalized from 0–100% to 0–1 when > 1.
 *
 * NOTE: This file is loaded as a classic <script>, not as an ES module.
 * All top-level functions become globals that the rest of the app can call.
 */
function calculateRiceScore(roadmap) {
  const reach = Number(roadmap.reachValue || 0);
  const impact = Number(roadmap.impactValue || 0);
  let confidence = Number(roadmap.confidenceValue || 0);
  const effort = Number(roadmap.effortValue || 0);
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

function validateRoadmapInput(raw) {
  function descriptionPlainText(description) {
    if (typeof descriptionToPlainText === "function") {
      return descriptionToPlainText(description || "");
    }
    return String(description || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (!raw.title || !String(raw.title).trim()) {
    return "Roadmap title is required.";
  }

  if (!descriptionPlainText(raw.description)) {
    return "Roadmap description is required.";
  }

  if (raw.reachValue != null && raw.reachValue !== "") {
    if (!Number.isFinite(raw.reachValue) || raw.reachValue < 0) {
      return "Reach value must be a non-negative integer.";
    }
    if (!Number.isInteger(raw.reachValue)) {
      return "Reach value must be an integer (no decimals).";
    }
  }

  if (raw.impactValue != null && raw.impactValue !== "") {
    if (!Number.isFinite(raw.impactValue) || raw.impactValue < 1 || raw.impactValue > 5) {
      return "Impact must be between 1 and 5.";
    }
  }

  if (raw.confidenceValue != null && raw.confidenceValue !== "") {
    if (
      !Number.isFinite(raw.confidenceValue) ||
      raw.confidenceValue < 0 ||
      raw.confidenceValue > 100
    ) {
      return "Confidence must be between 0 and 100.";
    }
  }

  if (raw.effortValue != null && raw.effortValue !== "") {
    if (!Number.isFinite(raw.effortValue) || raw.effortValue < 1 || raw.effortValue > 5) {
      return "Effort must be between 1 and 5.";
    }
  }

  if (raw.financialImpactValue != null && raw.financialImpactValue !== "" && !Number.isFinite(raw.financialImpactValue)) {
    return "Financial impact must be a valid number.";
  }

  if (
    raw.financialImpactValue != null &&
    raw.financialImpactValue !== 0 &&
    Number.isFinite(raw.financialImpactValue) &&
    !raw.financialImpactCurrency
  ) {
    return "Select a currency when financial impact is provided.";
  }

  if (raw.roadmapPeriods && Array.isArray(raw.roadmapPeriods) && raw.roadmapPeriods.length) {
    if (typeof RoadmapPeriods !== "undefined") {
      const periodError = RoadmapPeriods.validatePeriods(raw.roadmapPeriods);
      if (periodError) return periodError;
    }
  } else if (raw.roadmapPeriod) {
    const periodPattern = /^\d{4}-Q[1-4]$/;
    if (!periodPattern.test(raw.roadmapPeriod)) {
      return "Roadmap period must be in the format YYYY-QX (e.g. 2026-Q1).";
    }
  }

  return "";
}
