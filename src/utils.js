/**
 * RICE Prioritizer - Shared utilities
 * Date formatting, ID generation, HTML/CSV escaping, and CSV parsing for export/import.
 *
 * NOTE: This file is loaded as a classic <script>, not as an ES module.
 * All top-level functions become globals that the rest of the app can call.
 */
function formatDateTime(isoString) {
  if (!isoString) return "—";
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDate(isoString) {
  if (!isoString) return "—";
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function formatDateForFilename(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}`;
}

function compareDatesDesc(aIso, bIso) {
  const a = new Date(aIso || 0).getTime();
  const b = new Date(bIso || 0).getTime();
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

function generateId(prefix) {
  return prefix + "_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseCsv(text) {
  const rows = [];
  let current = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        current.push(value);
        value = "";
      } else if (char === "\r") {
        continue;
      } else if (char === "\n") {
        current.push(value);
        rows.push(current);
        current = [];
        value = "";
      } else {
        value += char;
      }
    }
  }

  if (value !== "" || current.length) {
    current.push(value);
    rows.push(current);
  }

  return rows;
}

function escapeCsvCell(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

