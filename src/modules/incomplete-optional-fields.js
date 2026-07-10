/**
 * Incomplete optional fields filter — shared between app.js and Node tests.
 * Global: IncompleteOptionalFields
 */
const IncompleteOptionalFields = (function () {
  const INCOMPLETE_OPTIONAL_FIELD_OPTIONS = [
    { id: "note", label: "Note" },
    { id: "labels", label: "Labels" },
    { id: "links", label: "Links" },
    { id: "rice", label: "RICE scores" },
    { id: "moscow", label: "MOSCOW" },
    { id: "kano", label: "KANO position" },
    { id: "roadmapType", label: "Roadmap type" },
    { id: "tshirtSize", label: "T-shirt size" },
    { id: "deadline", label: "Deadline" },
    { id: "periods", label: "Periods" },
    { id: "tasks", label: "Tasks" },
    { id: "countries", label: "Countries" },
    { id: "raci", label: "RACI" },
    { id: "financial", label: "Financial impact" }
  ];

  const INCOMPLETE_OPTIONAL_FIELD_GROUPS = [
    {
      id: "content",
      label: "Content",
      fields: ["note", "labels", "links"]
    },
    {
      id: "prioritization",
      label: "Prioritization",
      fields: ["rice", "moscow", "kano", "roadmapType", "tshirtSize"]
    },
    {
      id: "planning",
      label: "Planning",
      fields: ["deadline", "periods", "tasks", "countries"]
    },
    {
      id: "stakeholders",
      label: "Stakeholders & finance",
      fields: ["raci", "financial"]
    }
  ];

  const INCOMPLETE_OPTIONAL_FIELD_LABELS = Object.fromEntries(
    INCOMPLETE_OPTIONAL_FIELD_OPTIONS.map((opt) => [opt.id, opt.label])
  );

  function getBrowserMetadataFromAppGlobals() {
    if (typeof normalizeRoadmapLabels !== "function") return null;
    return {
      normalizeRoadmapLabels,
      normalizeRoadmapLinks:
        typeof normalizeRoadmapLinks === "function" ? normalizeRoadmapLinks : null,
      normalizeRoadmapTasks:
        typeof normalizeRoadmapTasks === "function" ? normalizeRoadmapTasks : null,
      normalizeRoadmapRaci:
        typeof normalizeRoadmapRaci === "function" ? normalizeRoadmapRaci : null,
      normalizeKanoAxisLevel:
        typeof normalizeKanoAxisLevel === "function" ? normalizeKanoAxisLevel : null,
      normalizeRoadmapNote:
        typeof normalizeRoadmapNote === "function" ? normalizeRoadmapNote : null
    };
  }

  function getMetadata() {
    if (typeof RoadmapMetadata !== "undefined") {
      return RoadmapMetadata;
    }
    const fromApp = getBrowserMetadataFromAppGlobals();
    if (fromApp) return fromApp;
    if (typeof module !== "undefined" && module.exports) {
      return require("../../api/_lib/roadmap-metadata");
    }
    return null;
  }

  function normalizeRoadmapCountriesList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((c) => String(c).trim()).filter(Boolean);
    return String(raw)
      .split(/[,|]/)
      .map((c) => c.trim())
      .filter(Boolean);
  }

  /** Optional field values are missing when empty or explicitly zero. */
  function optionalVariableValueIsPresent(value) {
    if (value == null) return false;
    const text = String(value).trim();
    if (text === "") return false;
    const numeric = Number(text);
    if (!Number.isNaN(numeric) && numeric === 0) return false;
    return true;
  }

  function optionalVariableValueIsExplicitZero(value) {
    if (value == null) return false;
    const text = String(value).trim();
    if (text === "") return false;
    const numeric = Number(text);
    return !Number.isNaN(numeric) && numeric === 0;
  }

  function roadmapRiceDimensionIsPresent(roadmap, scalarKey, descriptionKey) {
    const p = roadmap || {};
    if (optionalVariableValueIsExplicitZero(p[scalarKey])) return false;
    if (optionalVariableValueIsPresent(p[scalarKey])) return true;
    if (typeof richDescriptionToPlainText !== "function") return false;
    return !!richDescriptionToPlainText(p[descriptionKey] || "");
  }

  function roadmapHasNote(roadmap) {
    const meta = getMetadata();
    if (!meta || typeof meta.normalizeRoadmapNote !== "function") return false;
    return !!meta.normalizeRoadmapNote(roadmap && roadmap.note);
  }

  function roadmapHasLabels(roadmap) {
    const meta = getMetadata();
    if (!meta || typeof meta.normalizeRoadmapLabels !== "function") return false;
    return meta.normalizeRoadmapLabels(roadmap && roadmap.labels).length > 0;
  }

  function roadmapHasLinks(roadmap) {
    const meta = getMetadata();
    if (!meta || typeof meta.normalizeRoadmapLinks !== "function") return false;
    return meta.normalizeRoadmapLinks(roadmap && roadmap.links).length > 0;
  }

  function roadmapHasRiceInput(roadmap) {
    const pairs = [
      ["reachValue", "reachDescription"],
      ["impactValue", "impactDescription"],
      ["confidenceValue", "confidenceDescription"],
      ["effortValue", "effortDescription"]
    ];
    if (
      pairs.some(([scalarKey]) =>
        optionalVariableValueIsExplicitZero((roadmap || {})[scalarKey])
      )
    ) {
      return false;
    }
    return pairs.every(([scalarKey, descriptionKey]) =>
      roadmapRiceDimensionIsPresent(roadmap, scalarKey, descriptionKey)
    );
  }

  function roadmapHasMoscowCategory(roadmap) {
    return !!(roadmap && roadmap.moscowCategory && String(roadmap.moscowCategory).trim());
  }

  function roadmapHasKanoPosition(roadmap) {
    const p = roadmap || {};
    if (
      optionalVariableValueIsExplicitZero(p.kanoFunctionality) ||
      optionalVariableValueIsExplicitZero(p.kanoSatisfaction)
    ) {
      return false;
    }
    const meta = getMetadata();
    if (!meta || typeof meta.normalizeKanoAxisLevel !== "function") return false;
    const f = meta.normalizeKanoAxisLevel(p.kanoFunctionality);
    const s = meta.normalizeKanoAxisLevel(p.kanoSatisfaction);
    return f != null && s != null;
  }

  function roadmapHasRoadmapType(roadmap) {
    return !!(roadmap && roadmap.roadmapType && String(roadmap.roadmapType).trim());
  }

  function roadmapHasTshirtSize(roadmap) {
    return !!(roadmap && roadmap.tshirtSize && String(roadmap.tshirtSize).trim());
  }

  function roadmapHasDeadline(roadmap) {
    if (typeof normalizeRoadmapDeadline !== "function") return false;
    return !!normalizeRoadmapDeadline(roadmap && roadmap.roadmapDeadline);
  }

  function roadmapHasAnyPeriod(roadmap) {
    if (typeof RoadmapPeriods !== "undefined" && typeof RoadmapPeriods.normalizePeriods === "function") {
      const periods = roadmap?.roadmapPeriods;
      const legacyPeriod = roadmap?.roadmapPeriod || roadmap?.projectPeriod || null;
      const normalized = RoadmapPeriods.normalizePeriods(Array.isArray(periods) ? periods : null, {
        legacyPeriod
      });
      return normalized.length > 0;
    }
    const periods = (roadmap && roadmap.roadmapPeriods) || [];
    return Array.isArray(periods) && periods.length > 0;
  }

  function roadmapHasTasks(roadmap) {
    const meta = getMetadata();
    if (!meta || typeof meta.normalizeRoadmapTasks !== "function") return false;
    return meta.normalizeRoadmapTasks(roadmap && roadmap.tasks).length > 0;
  }

  function roadmapHasCountries(roadmap) {
    return normalizeRoadmapCountriesList(roadmap && roadmap.countries).length > 0;
  }

  function roadmapHasRaciAssignments(roadmap) {
    const meta = getMetadata();
    if (!meta || typeof meta.normalizeRoadmapRaci !== "function") return false;
    const raci = meta.normalizeRoadmapRaci(roadmap && roadmap.raci);
    const roles =
      typeof RACI_ROLES !== "undefined"
        ? RACI_ROLES
        : ["responsible", "accountable", "consulted", "informed"];
    return roles.some((role) => Array.isArray(raci[role]) && raci[role].length > 0);
  }

  function roadmapHasFinancialImpact(roadmap) {
    const p = roadmap || {};
    const rawValue = p.financialImpactValue;
    if (optionalVariableValueIsExplicitZero(rawValue)) {
      return false;
    }
    if (optionalVariableValueIsPresent(rawValue)) {
      return true;
    }
    const inputs = p.financialImpactInputs;
    if (inputs && typeof inputs === "object") {
      const values = Object.values(inputs);
      if (values.some((entry) => optionalVariableValueIsExplicitZero(entry))) {
        return false;
      }
      return values.some((entry) => optionalVariableValueIsPresent(entry));
    }
    return false;
  }

  function roadmapOptionalFieldIsComplete(roadmap, fieldId) {
    switch (fieldId) {
      case "note":
        return roadmapHasNote(roadmap);
      case "labels":
        return roadmapHasLabels(roadmap);
      case "links":
        return roadmapHasLinks(roadmap);
      case "rice":
        return roadmapHasRiceInput(roadmap);
      case "moscow":
        return roadmapHasMoscowCategory(roadmap);
      case "kano":
        return roadmapHasKanoPosition(roadmap);
      case "roadmapType":
        return roadmapHasRoadmapType(roadmap);
      case "tshirtSize":
        return roadmapHasTshirtSize(roadmap);
      case "deadline":
        return roadmapHasDeadline(roadmap);
      case "periods":
        return roadmapHasAnyPeriod(roadmap);
      case "tasks":
        return roadmapHasTasks(roadmap);
      case "countries":
        return roadmapHasCountries(roadmap);
      case "raci":
        return roadmapHasRaciAssignments(roadmap);
      case "financial":
        return roadmapHasFinancialImpact(roadmap);
      default:
        return true;
    }
  }

  function roadmapIsMissingOptionalField(roadmap, fieldId) {
    return !roadmapOptionalFieldIsComplete(roadmap, fieldId);
  }

  function roadmapMatchesIncompleteOptionalFieldsFilter(roadmap, fieldIds, mode) {
    if (!Array.isArray(fieldIds) || !fieldIds.length) return true;
    const matchAll = mode === "all";
    if (matchAll) {
      return fieldIds.every((fieldId) => roadmapIsMissingOptionalField(roadmap, fieldId));
    }
    return fieldIds.some((fieldId) => roadmapIsMissingOptionalField(roadmap, fieldId));
  }

  return {
    INCOMPLETE_OPTIONAL_FIELD_OPTIONS,
    INCOMPLETE_OPTIONAL_FIELD_GROUPS,
    INCOMPLETE_OPTIONAL_FIELD_LABELS,
    optionalVariableValueIsPresent,
    optionalVariableValueIsExplicitZero,
    roadmapHasNote,
    roadmapHasLabels,
    roadmapHasLinks,
    roadmapHasRiceInput,
    roadmapHasMoscowCategory,
    roadmapHasKanoPosition,
    roadmapHasRoadmapType,
    roadmapHasTshirtSize,
    roadmapHasDeadline,
    roadmapHasAnyPeriod,
    roadmapHasTasks,
    roadmapHasCountries,
    roadmapHasRaciAssignments,
    roadmapHasFinancialImpact,
    roadmapOptionalFieldIsComplete,
    roadmapIsMissingOptionalField,
    roadmapMatchesIncompleteOptionalFieldsFilter
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = IncompleteOptionalFields;
}
