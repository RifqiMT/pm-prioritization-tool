/**
 * RICE Prioritizer - Main application module
 * Handles state, DOM cache, initialization, rendering, modals, import/export, and event handlers.
 *
 * IMPORTANT: This file now runs as a classic <script> (no ES modules).
 * It relies on globals defined in:
 *  - src/constants.js  (STORAGE_KEY, currencyList, countryList, countryCodeByName)
 *  - src/rice.js       (calculateRiceScore, formatRice, validateProjectInput)
 *  - src/utils.js      (formatDateTime, formatDate, formatDateForFilename, compareDatesDesc, generateId, escapeHtml, toNumberOrNull, parseCsv, escapeCsvCell)
 *
 * That means you can simply open index.html in a browser (no dev server required)
 * and everything, including export/import, will work.
 */

// --- State & DOM cache ---
let state = {
  profiles: [],
  activeProfileId: null,
  sortField: "createdAt",
  sortDirection: "desc"
};

let editingProjectId = null;
let projectModalMode = "create";

const $ = (id) => document.getElementById(id);

const elements = {};

/** Returns a trimmed currency string or null; use for consistent storage and comparison. */
function normalizeCurrency(val) {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

// --- Initialization ---
function init() {
  cacheElements();
  initCurrencyOptions();
  initFilterCountriesOptions();
  attachEventListeners();
  loadState();
  ensureDefaultProfile();
  renderProfiles();
  renderProjects();
}

function cacheElements() {
  elements.profileList = $("profileList");
  elements.profilesEmptyState = $("profilesEmptyState");
  elements.addProfileForm = $("addProfileForm");
  elements.newProfileName = $("newProfileName");

  elements.activeProfileTitleText = $("activeProfileTitleText");
  elements.activeProfileSubtitleText = $("activeProfileSubtitleText");
  elements.projectsHeaderBadges = $("projectsHeaderBadges");
  elements.addProjectBtn = $("addProjectBtn");
  elements.bulkDeleteBtn = $("bulkDeleteBtn");

  elements.filterTitle = $("filterTitle");
  elements.filterCreatedFrom = $("filterCreatedFrom");
  elements.filterCreatedTo = $("filterCreatedTo");
  elements.filterModifiedFrom = $("filterModifiedFrom");
  elements.filterModifiedTo = $("filterModifiedTo");
  elements.filterImpact = $("filterImpact");
  elements.filterEffort = $("filterEffort");
  elements.filterCurrency = $("filterCurrency");
  elements.filterProjectType = $("filterProjectType");

  elements.projectsTableBody = $("projectsTableBody");
  elements.selectAllProjects = $("selectAllProjects");

  elements.projectModal = $("projectModal");
  elements.projectModalTitle = $("projectModalTitle");
  elements.projectModalSubtitle = $("projectModalSubtitle");
  elements.projectModalCloseBtn = $("projectModalCloseBtn");
  elements.projectForm = $("projectForm");
  elements.projectFormCancelBtn = $("projectFormCancelBtn");
  elements.projectFormSubmitBtn = $("projectFormSubmitBtn");
  elements.projectFormError = $("projectFormError");

  elements.projectTitle = $("projectTitle");
  elements.projectDescription = $("projectDescription");
  elements.reachDescription = $("reachDescription");
  elements.reachValue = $("reachValue");
  elements.impactDescription = $("impactDescription");
  elements.impactValue = $("impactValue");
  elements.confidenceDescription = $("confidenceDescription");
  elements.confidenceValue = $("confidenceValue");
  elements.effortDescription = $("effortDescription");
  elements.effortValue = $("effortValue");
  elements.financialImpactValue = $("financialImpactValue");
  elements.projectCurrency = $("projectCurrency");
  elements.projectType = $("projectType");

  elements.projectMetaCreated = $("projectMetaCreated");
  elements.projectMetaModified = $("projectMetaModified");
  elements.projectMetaRice = $("projectMetaRice");

  elements.exportDataBtn = $("exportDataBtn");
  elements.importDataBtn = $("importDataBtn");
  elements.importFileInput = $("importFileInput");
  elements.importCsvFileInput = $("importCsvFileInput");

  elements.filtersToggleBtn = $("filtersToggleBtn");
  elements.filtersAdvanced = $("filtersAdvanced");
  elements.filtersActivePill = $("filtersActivePill");
  elements.filtersResetBtn = $("filtersResetBtn");

  elements.countriesContainer = $("countriesContainer");
  elements.addCountryBtn = $("addCountryBtn");

  elements.filterCountriesSearch = $("filterCountriesSearch");
  elements.filterCountriesList = $("filterCountriesList");
  elements.filterCountriesSummary = $("filterCountriesSummary");
  elements.filterCountriesToggle = $("filterCountriesToggle");
  elements.filterCountriesPopup = $("filterCountriesPopup");

  elements.profileDeleteModal = $("profileDeleteModal");
  elements.profileDeleteNameLabel = $("profileDeleteNameLabel");
  elements.profileDeleteSummaryLabel = $("profileDeleteSummaryLabel");
  elements.profileDeleteWarningText = $("profileDeleteWarningText");
  elements.profileDeleteCancelTopBtn = $("profileDeleteCancelTopBtn");
  elements.profileDeleteCancelBtn = $("profileDeleteCancelBtn");
  elements.profileDeleteConfirmBtn = $("profileDeleteConfirmBtn");

  elements.projectDeleteModal = $("projectDeleteModal");
  elements.projectDeleteNameLabel = $("projectDeleteNameLabel");
  elements.projectDeleteWarningText = $("projectDeleteWarningText");
  elements.projectDeleteCancelBtn = $("projectDeleteCancelBtn");
  elements.projectDeleteConfirmBtn = $("projectDeleteConfirmBtn");

  elements.exportFormatModal = $("exportFormatModal");
  elements.exportAsJsonBtn = $("exportAsJsonBtn");
  elements.exportAsCsvBtn = $("exportAsCsvBtn");
  elements.importFormatModal = $("importFormatModal");
  elements.importAsJsonBtn = $("importAsJsonBtn");
  elements.importAsCsvBtn = $("importAsCsvBtn");
}

function initCurrencyOptions() {
  const currencySelects = [elements.filterCurrency, elements.projectCurrency];
  currencyList.sort().forEach((code) => {
    currencySelects.forEach((select) => {
      if (!select) return;
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = code;
      select.appendChild(opt.cloneNode(true));
    });
  });
}

/**
 * Ensures the project currency select has an option for the given code.
 * Used when opening the project modal so imported/JSON data with a currency
 * not in the initial list (or with different casing) still displays correctly.
 */
function ensureCurrencyOption(select, code) {
  if (!select || !code || typeof code !== "string") return;
  const trimmed = code.trim();
  if (!trimmed) return;
  const upper = trimmed.toUpperCase();
  const hasOption = Array.from(select.options).some((o) => (o.value || "").toUpperCase() === upper);
  if (!hasOption) {
    const opt = document.createElement("option");
    opt.value = trimmed;
    opt.textContent = trimmed;
    select.appendChild(opt);
  }
}

function initFilterCountriesOptions() {
  if (!elements.filterCountriesList) return;
  elements.filterCountriesList.innerHTML = "";
  const sorted = countryList.slice().sort();
  const selected = new Set(getSelectedFilterCountries());
  sorted.forEach((name) => {
    const row = document.createElement("div");
    row.className = "filter-country-option";
    row.dataset.name = name;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = name;
    if (selected.has(name)) cb.checked = true;

    const label = document.createElement("span");
    label.textContent = name;

    row.appendChild(cb);
    row.appendChild(label);
    elements.filterCountriesList.appendChild(row);
  });
  filterFilterCountriesBySearchTerm();
  updateFilterCountriesSummary();
}

function attachEventListeners() {
  // --- Profiles & projects: core interactions ---
  elements.addProfileForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (elements.newProfileName.value || "").trim();
    if (!name) return;
    addProfile(name);
    elements.newProfileName.value = "";
  });

  elements.addProjectBtn.addEventListener("click", () => {
    openProjectModal("create");
  });

  elements.bulkDeleteBtn.addEventListener("click", handleBulkDelete);

  // --- Data export / import: main toolbar buttons ---
  // Export and Import both open a simple format chooser (JSON or CSV).
  elements.exportDataBtn.addEventListener("click", () => {
    if (!elements.exportFormatModal) {
      // Fallback: if modal markup is missing, still allow users to export JSON.
      handleExportData();
      return;
    }
    elements.exportFormatModal.setAttribute("aria-hidden", "false");
    elements.exportFormatModal.classList.add("active");
  });

  elements.importDataBtn.addEventListener("click", () => {
    if (!elements.importFormatModal) return;
    elements.importFormatModal.setAttribute("aria-hidden", "false");
    elements.importFormatModal.classList.add("active");
  });

  if (elements.exportFormatModal) {
    elements.exportFormatModal.addEventListener("click", (e) => {
      if (e.target === elements.exportFormatModal) {
        closeExportFormatModal();
      }
    });
  }
  if (elements.importFormatModal) {
    elements.importFormatModal.addEventListener("click", (e) => {
      if (e.target === elements.importFormatModal) {
        closeImportFormatModal();
      }
    });
  }

  if (elements.exportAsJsonBtn) {
    elements.exportAsJsonBtn.addEventListener("click", () => {
      handleExportData();
      closeExportFormatModal();
    });
  }
  if (elements.exportAsCsvBtn) {
    elements.exportAsCsvBtn.addEventListener("click", () => {
      handleExportCsv();
      closeExportFormatModal();
    });
  }

  if (elements.importAsJsonBtn) {
    elements.importAsJsonBtn.addEventListener("click", () => {
      if (!elements.importFileInput) return;
      elements.importFileInput.value = "";
      elements.importFileInput.click();
      closeImportFormatModal();
    });
  }
  if (elements.importAsCsvBtn) {
    elements.importAsCsvBtn.addEventListener("click", () => {
      // Reuse the same hidden input, but treat CSV differently in the change handler.
      if (!elements.importFileInput) return;
      elements.importFileInput.value = "";
      elements.importFileInput.setAttribute("data-import-kind", "csv");
      elements.importFileInput.click();
      closeImportFormatModal();
    });
  }

  if (elements.importFileInput) {
    elements.importFileInput.addEventListener("change", handleUnifiedImportChange);
  }

  if (elements.filtersToggleBtn && elements.filtersAdvanced) {
    elements.filtersToggleBtn.addEventListener("click", () => {
      const visible = elements.filtersAdvanced.classList.toggle("visible");
      elements.filtersToggleBtn.textContent = visible ? "Hide advanced" : "Show advanced";
    });
  }

  if (elements.filtersResetBtn) {
    elements.filtersResetBtn.addEventListener("click", () => {
      clearFilters();
      renderProjects();
    });
  }

  if (elements.filterCountriesToggle) {
    elements.filterCountriesToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const container = elements.filterCountriesToggle.closest(".filter-countries");
      if (!container) return;
      const isOpen = container.classList.toggle("open");
      if (isOpen && elements.filterCountriesSearch) {
        elements.filterCountriesSearch.focus();
        elements.filterCountriesSearch.select();
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (!elements.filterCountriesToggle) return;
    const container = elements.filterCountriesToggle.closest(".filter-countries");
    if (!container) return;
    if (!container.contains(event.target)) {
      container.classList.remove("open");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!elements.filterCountriesToggle) return;
    const container = elements.filterCountriesToggle.closest(".filter-countries");
    if (!container) return;
    container.classList.remove("open");
  });

  if (elements.filterCountriesSearch) {
    elements.filterCountriesSearch.addEventListener("input", () => {
      filterFilterCountriesBySearchTerm();
      renderProjects();
      updateFiltersActivePill();
      updateFilterCountriesSummary();
    });
  }

  if (elements.filterCountriesList) {
    elements.filterCountriesList.addEventListener("change", (event) => {
      const target = event.target;
      if (target && target.type === "checkbox") {
        renderProjects();
        updateFiltersActivePill();
        updateFilterCountriesSummary();
      }
    });
  }

  if (elements.addCountryBtn && elements.countriesContainer) {
    elements.addCountryBtn.addEventListener("click", () => {
      if (projectModalMode === "view") return;
      addCountryRow();
    });
    elements.countriesContainer.addEventListener("click", (event) => {
      if (projectModalMode === "view") return;
      const btn = event.target.closest(".country-remove-btn");
      if (!btn) return;
      const row = btn.closest(".country-row");
      if (!row) return;
      elements.countriesContainer.removeChild(row);
      if (!elements.countriesContainer.querySelector(".country-row")) {
        addCountryRow();
      }
    });
  }

  const filterInputs = [
    elements.filterTitle,
    elements.filterCreatedFrom,
    elements.filterCreatedTo,
    elements.filterModifiedFrom,
    elements.filterModifiedTo,
    elements.filterImpact,
    elements.filterEffort,
    elements.filterCurrency,
    elements.filterProjectType
  ].filter(Boolean); // guard against missing DOM nodes so we never throw while wiring listeners

  filterInputs.forEach((input) => {
    input.addEventListener("input", () => {
      renderProjects();
      updateFiltersActivePill();
    });
    input.addEventListener("change", () => {
      renderProjects();
      updateFiltersActivePill();
    });
  });

  elements.selectAllProjects.addEventListener("change", (e) => {
    const checked = e.target.checked;
    const checkboxes = elements.projectsTableBody.querySelectorAll(".project-select-checkbox");
    checkboxes.forEach((cb) => {
      cb.checked = checked;
    });
    updateBulkDeleteButton();
  });

  elements.projectsTableBody.addEventListener("change", (e) => {
    if (e.target.classList.contains("project-select-checkbox")) {
      syncHeaderCheckbox();
      updateBulkDeleteButton();
    }
  });

  elements.projectsTableBody.addEventListener("click", (e) => {
    const viewBtn = e.target.closest("[data-action='viewProject']");
    const editBtn = e.target.closest("[data-action='editProject']");
    const deleteBtn = e.target.closest("[data-action='deleteProject']");

    if (viewBtn) {
      const id = viewBtn.getAttribute("data-id");
      openProjectModal("view", id);
    } else if (editBtn) {
      const id = editBtn.getAttribute("data-id");
      openProjectModal("edit", id);
    } else if (deleteBtn) {
      const id = deleteBtn.getAttribute("data-id");
      handleSingleDelete(id);
    }
  });

  const headerCells = document.querySelectorAll("th[data-sort-field]");
  headerCells.forEach((th) => {
    th.dataset.sortActive = "false";
    const btn = th.querySelector(".sort-button");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const field = th.getAttribute("data-sort-field");
      toggleSort(field);
    });
  });

  elements.projectModalCloseBtn.addEventListener("click", closeProjectModal);
  elements.projectFormCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeProjectModal();
  });

  elements.projectModal.addEventListener("click", (e) => {
    if (e.target === elements.projectModal) {
      closeProjectModal();
    }
  });

  if (elements.projectDeleteModal) {
    elements.projectDeleteModal.addEventListener("click", (e) => {
      if (e.target === elements.projectDeleteModal) {
        closeProjectDeleteModal();
      }
    });
  }

  elements.projectForm.addEventListener("submit", handleProjectFormSubmit);

  [
    elements.reachValue,
    elements.impactValue,
    elements.confidenceValue,
    elements.effortValue
  ].forEach((el) => {
    el.addEventListener("input", updateModalRicePreview);
    el.addEventListener("change", updateModalRicePreview);
  });
}

function updateFiltersActivePill() {
  if (!elements.filtersActivePill) return;
  const activeFilters = [];
  if ((elements.filterTitle.value || "").trim()) activeFilters.push("Title");
  if (elements.filterProjectType.value) activeFilters.push("Type");
  if (getSelectedFilterCountries().length) activeFilters.push("Countries");
  if (elements.filterImpact.value) activeFilters.push("Impact");
  if (elements.filterEffort.value) activeFilters.push("Effort");
  if (elements.filterCurrency.value) activeFilters.push("Currency");
  if (elements.filterCreatedFrom.value || elements.filterCreatedTo.value) activeFilters.push("Created date");
  if (elements.filterModifiedFrom.value || elements.filterModifiedTo.value) activeFilters.push("Modified date");

  if (!activeFilters.length) {
    elements.filtersActivePill.style.display = "none";
    elements.filtersActivePill.textContent = "";
    return;
  }
  elements.filtersActivePill.style.display = "inline-flex";
  const label = activeFilters.length === 1
    ? `1 active filter (${activeFilters[0]})`
    : `${activeFilters.length} active filters`;
  elements.filtersActivePill.textContent = label;
}

// --- Export / import (JSON & CSV, merge logic) ---
function handleExportData() {
  try {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profiles: state.profiles,
      activeProfileId: state.activeProfileId,
      sortField: state.sortField,
      sortDirection: state.sortDirection
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = formatDateForFilename(new Date());
    a.href = url;
    a.download = `rice-prioritizer-export-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export failed", err);
    window.alert("Export failed. See console for details.");
  }
}

function closeExportFormatModal() {
  if (!elements.exportFormatModal) return;
  elements.exportFormatModal.classList.remove("active");
  elements.exportFormatModal.setAttribute("aria-hidden", "true");
}

function handleExportCsv() {
  try {
    const header = [
      "profileId",
      "profileName",
      "profileCreatedAt",
      "projectId",
      "projectTitle",
      "projectDescription",
      "projectCreatedAt",
      "projectModifiedAt",
      "reachValue",
      "reachDescription",
      "impactValue",
      "impactDescription",
      "confidenceValue",
      "confidenceDescription",
      "effortValue",
      "effortDescription",
      "financialImpactValue",
      "financialImpactCurrency",
      "projectType",
      "countries",
      "riceScore"
    ];

    const rows = [header.join(",")];

    state.profiles.forEach((profile) => {
      const profileId = profile.id || "";
      const profileName = profile.name || "";
      const profileCreatedAt = profile.createdAt || "";
      const projectsArray = Array.isArray(profile.projects) ? profile.projects : [];
      if (!projectsArray.length) {
        const emptyRow = [
          escapeCsvCell(profileId),
          escapeCsvCell(profileName),
          escapeCsvCell(profileCreatedAt),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ];
        rows.push(emptyRow.join(","));
        return;
      }
      projectsArray.forEach((project) => {
        const rice = calculateRiceScore(project);
        const countries = Array.isArray(project.countries) ? project.countries.join("|") : "";
        const row = [
          escapeCsvCell(profileId),
          escapeCsvCell(profileName),
          escapeCsvCell(profileCreatedAt),
          escapeCsvCell(project.id || ""),
          escapeCsvCell(project.title || ""),
          escapeCsvCell(project.description || ""),
          escapeCsvCell(project.createdAt || ""),
          escapeCsvCell(project.modifiedAt || ""),
          escapeCsvCell(project.reachValue != null ? String(project.reachValue) : ""),
          escapeCsvCell(project.reachDescription || ""),
          escapeCsvCell(project.impactValue != null ? String(project.impactValue) : ""),
          escapeCsvCell(project.impactDescription || ""),
          escapeCsvCell(project.confidenceValue != null ? String(project.confidenceValue) : ""),
          escapeCsvCell(project.confidenceDescription || ""),
          escapeCsvCell(project.effortValue != null ? String(project.effortValue) : ""),
          escapeCsvCell(project.effortDescription || ""),
          escapeCsvCell(project.financialImpactValue != null ? String(project.financialImpactValue) : ""),
          escapeCsvCell(project.financialImpactCurrency || ""),
          escapeCsvCell(project.projectType || ""),
          escapeCsvCell(countries),
          escapeCsvCell(String(rice))
        ];
        rows.push(row.join(","));
      });
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = formatDateForFilename(new Date());
    a.href = url;
    a.download = `rice-prioritizer-export-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("CSV export failed", err);
    window.alert("CSV export failed. See console for details.");
  }
}

function closeImportFormatModal() {
  if (!elements.importFormatModal) return;
  elements.importFormatModal.classList.remove("active");
  elements.importFormatModal.setAttribute("aria-hidden", "true");
}

function mergeImportedProfiles(importedProfiles) {
  if (!Array.isArray(importedProfiles) || !importedProfiles.length) return { addedProfiles: 0, mergedProfiles: 0, addedProjects: 0, skippedProjects: 0 };

  let addedProfiles = 0;
  let mergedProfiles = 0;
  let addedProjects = 0;
  let skippedProjects = 0;

  importedProfiles.forEach((rawProfile) => {
    const profile = normalizeImportedProfile(rawProfile);
    if (!profile) return;

    const existing = state.profiles.find((p) => p.id === profile.id || p.name === profile.name);
    if (!existing) {
      state.profiles.push(profile);
      addedProfiles += 1;
      addedProjects += profile.projects.length;
      return;
    }

    mergedProfiles += 1;
    if (!Array.isArray(existing.projects)) existing.projects = [];
    const existingById = new Map(existing.projects.map((p) => [p.id, p]));
    profile.projects.forEach((proj) => {
      const normProj = normalizeImportedProject(proj);
      if (!normProj) return;
      if (existingById.has(normProj.id)) {
        skippedProjects += 1;
        return;
      }
      existing.projects.push(normProj);
      existingById.set(normProj.id, normProj);
      addedProjects += 1;
    });
  });

  return { addedProfiles, mergedProfiles, addedProjects, skippedProjects };
}

// Unified handler: decides between JSON and CSV based on the selected file and the data-import-kind flag.
function handleUnifiedImportChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  const explicitKind = input.getAttribute("data-import-kind");
  // Reset the flag so the next import goes through auto-detection again.
  input.removeAttribute("data-import-kind");

  const name = (file.name || "").toLowerCase();
  const isCsv = explicitKind === "csv" || name.endsWith(".csv");

  if (isCsv) {
    handleImportCsvFile(file);
  } else {
    handleImportJsonFile(file);
  }

  // Always clear the input so the same file can be selected again later.
  input.value = "";
}

function handleImportJsonFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      let text = e.target.result;
      if (typeof text !== "string") text = String(text);
      text = text.replace(/^\uFEFF/, ""); // strip BOM for JSON from some editors/exporters
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid file format: empty or non-object content.");
      }

      // Support both legacy format (plain array of profiles) and current format ({ profiles, ... })
      const importedProfiles = Array.isArray(parsed) ? parsed : (parsed.profiles != null ? parsed.profiles : null);
      if (!Array.isArray(importedProfiles)) {
        throw new Error("Invalid file format: expected an array of profiles or an object with a 'profiles' array.");
      }
      if (!importedProfiles.length) {
        window.alert("Import file contains no profiles.");
        return;
      }
      const { addedProfiles, mergedProfiles, addedProjects } = mergeImportedProfiles(importedProfiles);
      if (!state.activeProfileId && state.profiles[0]) {
        state.activeProfileId = state.profiles[0].id;
      }
      saveState();
      renderProfiles();
      renderProjects();
      window.alert(`Import complete. ${addedProfiles} profile(s) added, ${mergedProfiles} merged, ${addedProjects} project(s) imported.`);
    } catch (err) {
      console.error("Import failed", err);
      window.alert("Import failed. Please check that you selected a valid JSON export file.");
    }
  };
  reader.onerror = function () {
    console.error("Failed to read import file");
    window.alert("Import failed while reading the JSON file.");
  };
  reader.readAsText(file);
}

function handleImportCsvFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      let text = e.target.result;
      if (typeof text !== "string") text = String(text);
      text = text.replace(/^\uFEFF/, ""); // strip BOM for CSV from Excel etc.
      const rows = parseCsv(text);
      if (!rows.length) {
        window.alert("Import file contains no rows.");
        return;
      }
      const header = rows[0].map((cell) => String(cell).trim());
      const dataRows = rows.slice(1).filter((r) => r.some((cell) => String(cell).trim() !== ""));
      if (!dataRows.length) {
        window.alert("Import file contains no data rows.");
        return;
      }
      const importedProfiles = buildProfilesFromCsvRows(header, dataRows);
      if (!importedProfiles.length) {
        window.alert("No valid data found in CSV file.");
        return;
      }
      const { addedProfiles, mergedProfiles, addedProjects } = mergeImportedProfiles(importedProfiles);
      if (!state.activeProfileId && state.profiles[0]) {
        state.activeProfileId = state.profiles[0].id;
      }
      saveState();
      renderProfiles();
      renderProjects();
      window.alert(`CSV import complete. ${addedProfiles} profile(s) added, ${mergedProfiles} merged, ${addedProjects} project(s) imported.`);
    } catch (err) {
      console.error("CSV import failed", err);
      window.alert("CSV import failed. Please check that you selected a valid CSV export file.");
    }
  };
  reader.onerror = function () {
    console.error("Failed to read CSV import file");
    window.alert("Import failed while reading the CSV file.");
  };
  reader.readAsText(file);
}

function buildProfilesFromCsvRows(header, rows) {
  const colIndex = {};
  header.forEach((name, idx) => {
    const key = String(name).trim();
    if (key) colIndex[key] = idx;
  });

  const byProfileKey = new Map();

  rows.forEach((cells) => {
    const profileName = (cells[colIndex.profileName] ?? "").toString().trim();
    if (!profileName) return;
    const profileIdFromCsv = (cells[colIndex.profileId] ?? "").toString().trim();
    const profileCreatedAt = (cells[colIndex.profileCreatedAt] ?? "").toString().trim();
    const key = profileIdFromCsv || profileName;

    if (!byProfileKey.has(key)) {
      byProfileKey.set(key, {
        id: profileIdFromCsv || generateId("profile"),
        name: profileName,
        createdAt: profileCreatedAt || new Date().toISOString(),
        projects: []
      });
    }

    const profile = byProfileKey.get(key);

    const projectTitle = (cells[colIndex.projectTitle] ?? "").toString().trim();
    const projectIdCell = (cells[colIndex.projectId] ?? "").toString().trim();
    const anyProjectField = projectTitle || projectIdCell;
    if (!anyProjectField) return;

    const project = {
      id: projectIdCell || generateId("project"),
      createdAt: (cells[colIndex.projectCreatedAt] ?? "").toString().trim() || new Date().toISOString(),
      modifiedAt: (cells[colIndex.projectModifiedAt] ?? "").toString().trim() || undefined,
      title: projectTitle || "Imported project",
      description: (cells[colIndex.projectDescription] ?? "").toString(),
      reachValue: toNumberOrNull(cells[colIndex.reachValue]),
      reachDescription: (cells[colIndex.reachDescription] ?? "").toString(),
      impactValue: toNumberOrNull(cells[colIndex.impactValue]),
      impactDescription: (cells[colIndex.impactDescription] ?? "").toString(),
      confidenceValue: toNumberOrNull(cells[colIndex.confidenceValue]),
      confidenceDescription: (cells[colIndex.confidenceDescription] ?? "").toString(),
      effortValue: toNumberOrNull(cells[colIndex.effortValue]),
      effortDescription: (cells[colIndex.effortDescription] ?? "").toString(),
      financialImpactValue: toNumberOrNull(cells[colIndex.financialImpactValue]),
      financialImpactCurrency: normalizeCurrency(cells[colIndex.financialImpactCurrency]),
      projectType: (cells[colIndex.projectType] ?? "").toString().trim() || null,
      countries: (cells[colIndex.countries] ?? "").toString().split("|").map((c) => c.trim()).filter((c) => c !== "")
    };
    project.riceScore = calculateRiceScore(project);
    profile.projects.push(project);
  });

  return Array.from(byProfileKey.values());
}

function normalizeImportedProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const id = typeof profile.id === "string" && profile.id.trim() ? profile.id.trim() : generateId("profile");
  const name = String(profile.name || "Imported profile");
  const createdAt = profile.createdAt || new Date().toISOString();
  const projectsArray = Array.isArray(profile.projects) ? profile.projects : [];
  const normalizedProjects = projectsArray.map(normalizeImportedProject).filter(Boolean);
  return {
    id,
    name,
    createdAt,
    projects: normalizedProjects
  };
}

function normalizeImportedProject(project) {
  if (!project || typeof project !== "object") return null;
  const now = new Date().toISOString();
  const id = typeof project.id === "string" && project.id.trim() ? project.id.trim() : generateId("project");
  const createdAt = project.createdAt || now;
  const modifiedAt = project.modifiedAt || createdAt;
  const reachValue = toNumberOrNull(project.reachValue);
  const impactValue = toNumberOrNull(project.impactValue);
  const confidenceValue = toNumberOrNull(project.confidenceValue);
  const effortValue = toNumberOrNull(project.effortValue);
  const financialImpactValue = toNumberOrNull(project.financialImpactValue);
  const normalized = {
    id,
    createdAt,
    modifiedAt,
    title: String(project.title || "Imported project"),
    description: String(project.description || ""),
    reachDescription: String(project.reachDescription || ""),
    reachValue: Number.isFinite(reachValue) ? reachValue : 0,
    impactDescription: String(project.impactDescription || ""),
    impactValue: Number.isFinite(impactValue) ? impactValue : 1,
    confidenceDescription: String(project.confidenceDescription || ""),
    confidenceValue: Number.isFinite(confidenceValue) ? confidenceValue : 50,
    effortDescription: String(project.effortDescription || ""),
    effortValue: Number.isFinite(effortValue) && effortValue > 0 ? effortValue : 1,
    financialImpactValue: Number.isFinite(financialImpactValue) && financialImpactValue >= 0 ? financialImpactValue : null,
    financialImpactCurrency: normalizeCurrency(project.financialImpactCurrency),
    projectType: (project.projectType != null && String(project.projectType).trim() !== "") ? String(project.projectType).trim() : null,
    countries: Array.isArray(project.countries) ? project.countries.map((c) => String(c)) : []
  };
  normalized.riceScore = calculateRiceScore(normalized);
  return normalized;
}

// --- Filters (country options, filter UI, clear) ---
function getSelectedFilterCountries() {
  if (!elements.filterCountriesList) return [];
  const checkboxes = elements.filterCountriesList.querySelectorAll("input[type=\"checkbox\"]");
  const values = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
  return Array.from(new Set(values));
}

function filterFilterCountriesBySearchTerm() {
  if (!elements.filterCountriesList || !elements.filterCountriesSearch) return;
  const term = (elements.filterCountriesSearch.value || "").trim().toLowerCase();
  const options = elements.filterCountriesList.querySelectorAll(".filter-country-option");
  options.forEach((opt) => {
    const name = (opt.dataset.name || "").toLowerCase();
    opt.style.display = !term || name.includes(term) ? "" : "none";
  });
}

function updateFilterCountriesSummary() {
  if (!elements.filterCountriesSummary) return;
  const container = elements.filterCountriesSummary;
  const selected = getSelectedFilterCountries();
  container.innerHTML = "";

  if (!selected.length) {
    const span = document.createElement("span");
    span.textContent = "Any country";
    container.appendChild(span);
    return;
  }

  const maxChips = 3;
  const visible = selected.slice(0, maxChips);
  visible.forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "filter-countries-chip";
    chip.textContent = name;
    container.appendChild(chip);
  });

  if (selected.length > maxChips) {
    const moreChip = document.createElement("span");
    moreChip.className = "filter-countries-chip filter-countries-chip-count";
    moreChip.textContent = `+${selected.length - maxChips} more`;
    container.appendChild(moreChip);
  }
}

function renderCountriesControls(countries) {
  if (!elements.countriesContainer) return;
  elements.countriesContainer.innerHTML = "";
  const list = Array.isArray(countries) && countries.length ? countries : [""];
  list.forEach((country) => addCountryRow(country));
}

function addCountryRow(selectedCountry) {
  if (!elements.countriesContainer) return;
  const row = document.createElement("div");
  row.className = "country-row";

  const select = document.createElement("select");
  select.innerHTML = "";
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "Select country";
  select.appendChild(emptyOpt);
  countryList.slice().sort().forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  if (selectedCountry && countryList.includes(selectedCountry)) {
    select.value = selectedCountry;
  }

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "country-remove-btn";
  removeBtn.textContent = "×";

  row.appendChild(select);
  row.appendChild(removeBtn);
  elements.countriesContainer.appendChild(row);
}

function getCountriesFromControls() {
  if (!elements.countriesContainer) return [];
  const selects = elements.countriesContainer.querySelectorAll("select");
  const values = Array.from(selects)
    .map((s) => (s.value || "").trim())
    .filter((v) => v);
  return Array.from(new Set(values));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed) return;

    // Support both legacy format (plain array of profiles) and current format ({ profiles, ... })
    const rawProfiles = Array.isArray(parsed) ? parsed : parsed.profiles;
    if (!Array.isArray(rawProfiles)) return;

    // Normalize each profile: ensure projects array and valid project shape so render/export/import don't break
    state.profiles = rawProfiles.map((p) => {
      const projects = Array.isArray(p.projects)
        ? p.projects.map(normalizeLoadedProject).filter(Boolean)
        : [];
      return {
        id: typeof p.id === "string" && p.id.trim() ? p.id.trim() : generateId("profile"),
        name: String(p.name || "Unnamed profile"),
        createdAt: p.createdAt || new Date().toISOString(),
        projects
      };
    });

    // Resolve active profile: use stored id only if it still exists, otherwise first profile.
    const storedActiveId = !Array.isArray(parsed) ? parsed.activeProfileId : null;
    const validActiveId =
      state.profiles.some((p) => p.id === (storedActiveId || ""))
        ? storedActiveId
        : (state.profiles[0] && state.profiles[0].id) || null;
    state.activeProfileId = validActiveId;

    state.sortField = !Array.isArray(parsed) && parsed.sortField ? parsed.sortField : "createdAt";
    state.sortDirection = !Array.isArray(parsed) && parsed.sortDirection ? parsed.sortDirection : "desc";
  } catch (err) {
    console.error("Failed to load stored state", err);
  }
}

/** Ensures a project loaded from localStorage has required fields so RICE and render don't break. */
function normalizeLoadedProject(project) {
  if (!project || typeof project !== "object") return null;
  const now = new Date().toISOString();
  const id = typeof project.id === "string" && project.id.trim() ? project.id.trim() : generateId("project");
  const createdAt = project.createdAt || now;
  const modifiedAt = project.modifiedAt || createdAt;
  const reachValue = toNumberOrNull(project.reachValue);
  const impactValue = toNumberOrNull(project.impactValue);
  const confidenceValue = toNumberOrNull(project.confidenceValue);
  const effortValue = toNumberOrNull(project.effortValue);
  return {
    id,
    createdAt,
    modifiedAt,
    title: String(project.title || "Untitled project"),
    description: String(project.description || ""),
    reachDescription: String(project.reachDescription || ""),
    reachValue: Number.isFinite(reachValue) ? reachValue : 0,
    impactDescription: String(project.impactDescription || ""),
    impactValue: Number.isFinite(impactValue) ? impactValue : 1,
    confidenceDescription: String(project.confidenceDescription || ""),
    confidenceValue: Number.isFinite(confidenceValue) ? confidenceValue : 50,
    effortDescription: String(project.effortDescription || ""),
    effortValue: Number.isFinite(effortValue) && effortValue > 0 ? effortValue : 1,
    financialImpactValue: Number.isFinite(toNumberOrNull(project.financialImpactValue)) ? Number(project.financialImpactValue) : null,
    financialImpactCurrency: normalizeCurrency(project.financialImpactCurrency),
    projectType: (project.projectType != null && String(project.projectType).trim() !== "") ? String(project.projectType).trim() : null,
    countries: Array.isArray(project.countries) ? project.countries.map((c) => String(c)) : []
  };
}

function saveState() {
  const payload = {
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
    sortField: state.sortField,
    sortDirection: state.sortDirection
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to persist state", err);
  }
}

function ensureDefaultProfile() {
  if (state.profiles.length === 0) {
    const now = new Date().toISOString();
    const profile = {
      id: generateId("profile"),
      name: "Default Profile",
      createdAt: now,
      projects: []
    };
    state.profiles.push(profile);
    state.activeProfileId = profile.id;
    saveState();
  }
}

function addProfile(name) {
  const now = new Date().toISOString();
  const profile = {
    id: generateId("profile"),
    name,
    createdAt: now,
    projects: []
  };
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  saveState();
  renderProfiles();
  renderProjects();
}

function setActiveProfile(profileId) {
  state.activeProfileId = profileId;
  saveState();
  renderProfiles();
  clearFilters();
  renderProjects();
}

function getActiveProfile() {
  if (!state.activeProfileId) return null;
  return state.profiles.find((p) => p.id === state.activeProfileId) || null;
}

// --- Render (profiles list, projects table) ---
function renderProfiles() {
  const { profiles, activeProfileId } = state;

  elements.profileList.innerHTML = "";
  elements.profilesEmptyState.style.display = profiles.length ? "none" : "block";

  profiles
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .forEach((profile) => {
      const li = document.createElement("li");
      const row = document.createElement("div");
      row.className = "profile-item-row";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "profile-item-btn" + (profile.id === activeProfileId ? " active" : "");

      const main = document.createElement("div");
      main.className = "profile-item-main";

      const nameEl = document.createElement("div");
      nameEl.className = "profile-item-name";
      nameEl.textContent = profile.name;

      const metaEl = document.createElement("div");
      metaEl.className = "profile-item-meta";
      const createdDate = formatDate(profile.createdAt);
      const projectsCount = profile.projects ? profile.projects.length : 0;
      metaEl.textContent = `Created ${createdDate} • ${projectsCount} project${projectsCount === 1 ? "" : "s"}`;

      main.appendChild(nameEl);
      main.appendChild(metaEl);

      if (projectsCount > 0) {
        const summary = document.createElement("div");
        summary.className = "profile-summary";
        const riceValues = profile.projects.map((p) => Number(p.riceScore || 0)).filter((v) => !Number.isNaN(v));
        if (riceValues.length) {
          const maxRice = Math.max(...riceValues);
          const avgRice = riceValues.reduce((a, b) => a + b, 0) / riceValues.length;
          summary.innerHTML = `
            <span>Top RICE: <strong>${formatRice(maxRice)}</strong></span>
            <span>Avg: <strong>${formatRice(avgRice)}</strong></span>
          `;
          main.appendChild(summary);
        }
      }

      btn.appendChild(main);
      btn.addEventListener("click", () => setActiveProfile(profile.id));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "profile-delete-btn";
      deleteBtn.textContent = "×";
      deleteBtn.title = "Delete profile and all its projects";
      deleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteProfile(profile.id);
      });

      row.appendChild(btn);
      row.appendChild(deleteBtn);
      li.appendChild(row);
      elements.profileList.appendChild(li);
    });

  const activeProfile = getActiveProfile();
  if (!activeProfile) {
    elements.activeProfileTitleText.textContent = "No profile selected";
    elements.activeProfileSubtitleText.textContent = "Create or select a profile to start adding projects.";
    elements.projectsHeaderBadges.innerHTML = "";
    elements.addProjectBtn.disabled = true;
    elements.bulkDeleteBtn.disabled = true;
    return;
  }

  elements.activeProfileTitleText.textContent = activeProfile.name;
  const count = activeProfile.projects.length;
  elements.activeProfileSubtitleText.textContent =
    count === 0 ? "No projects yet. Add your first project for this profile."
      : `${count} project${count === 1 ? "" : "s"} in this profile.`;

  elements.addProjectBtn.disabled = false;

  const badges = [];
  badges.push(`<span class="pill pill-muted">Projects: <strong>${count}</strong></span>`);
  const riceValues = activeProfile.projects.map((p) => Number(p.riceScore || 0)).filter((v) => !Number.isNaN(v));
  if (riceValues.length) {
    const maxRice = Math.max(...riceValues);
    const avgRice = riceValues.reduce((a, b) => a + b, 0) / riceValues.length;
    badges.push(`<span class="pill pill-soft"><strong>Top:</strong>${formatRice(maxRice)}</span>`);
    badges.push(`<span class="pill pill-soft"><strong>Avg:</strong>${formatRice(avgRice)}</span>`);
  }
  elements.projectsHeaderBadges.innerHTML = badges.join("");
}

function renderProjects() {
  const activeProfile = getActiveProfile();
  elements.projectsTableBody.innerHTML = "";

  if (!activeProfile) {
    elements.projectsTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          Create or select a profile to start adding projects.
        </td>
      </tr>
    `;
    elements.bulkDeleteBtn.disabled = true;
    return;
  }

  const baseProjects = activeProfile.projects.slice();

  baseProjects.forEach((p) => {
    p.riceScore = calculateRiceScore(p);
  });

  let projects = applyFilters(baseProjects);
  projects = sortProjects(projects);

  if (!projects.length) {
    elements.projectsTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          No projects match the current filters. Adjust filters or add a new project.
        </td>
      </tr>
    `;
    elements.bulkDeleteBtn.disabled = true;
    elements.selectAllProjects.checked = false;
    return;
  }

  const rows = document.createDocumentFragment();
  projects.forEach((project) => {
    const tr = document.createElement("tr");

    const tdSelect = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "checkbox-input project-select-checkbox";
    cb.setAttribute("data-id", project.id);
    tdSelect.appendChild(cb);
    tr.appendChild(tdSelect);

    const tdTitle = document.createElement("td");
    const countries = Array.isArray(project.countries) ? project.countries : [];
    let countriesHtml = "";
    if (countries.length) {
      const maxToShow = 3;
      const shown = countries.slice(0, maxToShow);
      const moreCount = countries.length - shown.length;
      const shownCodes = shown.map((name) => countryCodeByName[name] || name);
      countriesHtml = `
        <div class="countries-badge">
          <span>${escapeHtml(shownCodes.join(", "))}${moreCount > 0 ? escapeHtml(" +" + moreCount + " more") : ""}</span>
        </div>
      `;
    }
    tdTitle.innerHTML = `
      <div class="cell-title">${escapeHtml(project.title || "")}</div>
      ${countriesHtml}
    `;
    const projectDesc = project.description || "";
    if (projectDesc) {
      tr.title = projectDesc;
    }
    tr.appendChild(tdTitle);

    const tdType = document.createElement("td");
    if (project.projectType) {
      const span = document.createElement("span");
      span.className = "cell-type-pill";
      span.dataset.type = project.projectType;
      span.textContent = project.projectType;
      tdType.appendChild(span);
    } else {
      tdType.innerHTML = `<span class="cell-meta">—</span>`;
    }
    tr.appendChild(tdType);

    const tdRice = document.createElement("td");
    const riceScore = calculateRiceScore(project);
    tdRice.className = "cell-rice";

    const reachVal = project.reachValue != null ? String(project.reachValue) : "—";
    const impactVal = project.impactValue != null ? String(project.impactValue) : "—";
    const confidenceVal = project.confidenceValue != null ? String(project.confidenceValue) : "—";
    const effortVal = project.effortValue != null ? String(project.effortValue) : "—";

    const reachNum = Number(project.reachValue ?? 0);
    const impactNum = Number(project.impactValue ?? 0);
    const confidenceNum = project.confidenceValue != null ? Number(project.confidenceValue) : null;
    const effortNum = Number(project.effortValue ?? 0);
    const confidenceFraction = confidenceNum != null && Number.isFinite(confidenceNum)
      ? confidenceNum / 100
      : null;
    const confidenceDecimal = confidenceFraction != null && Number.isFinite(confidenceFraction)
      ? confidenceFraction.toFixed(2)
      : "—";

    let calcLine = "N/A";
    if (Number.isFinite(reachNum) && Number.isFinite(impactNum) && confidenceFraction != null && Number.isFinite(effortNum) && effortNum > 0) {
      calcLine = `[${reachNum} × ${impactNum} × ${confidenceFraction.toFixed(2)}] ÷ ${effortNum} = ${formatRice(riceScore)}`;
    }

    const riceWrapper = document.createElement("div");
    riceWrapper.className = "rice-score-wrapper";

    const scoreSpan = document.createElement("span");
    scoreSpan.textContent = formatRice(riceScore);
    riceWrapper.appendChild(scoreSpan);

    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "rice-info-btn";
    infoBtn.textContent = "?";
    riceWrapper.appendChild(infoBtn);

    const popup = document.createElement("div");
    popup.className = "rice-popup";
    popup.innerHTML = `
      <div class="rice-popup-row">
        <span class="rice-popup-label">Formula</span>
        <span class="rice-popup-value">[Reach × Impact × Confidence] ÷ Effort</span>
      </div>
      <div class="rice-popup-row">
        <span class="rice-popup-label">Reach</span>
        <span class="rice-popup-value">${reachVal}</span>
      </div>
      <div class="rice-popup-row">
        <span class="rice-popup-label">Impact</span>
        <span class="rice-popup-value">${impactVal}</span>
      </div>
      <div class="rice-popup-row">
        <span class="rice-popup-label">Confidence</span>
        <span class="rice-popup-value">${confidenceVal !== "—" ? confidenceVal + "%" : "—"} (${confidenceDecimal})</span>
      </div>
      <div class="rice-popup-row">
        <span class="rice-popup-label">Effort</span>
        <span class="rice-popup-value">${effortVal}</span>
      </div>
      <div class="rice-popup-row">
        <span class="rice-popup-label">Calculation</span>
        <span class="rice-popup-value">${calcLine}</span>
      </div>
    `;
    riceWrapper.appendChild(popup);

    infoBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const isVisible = popup.classList.contains("visible");
      document.querySelectorAll(".rice-popup.visible").forEach((el) => el.classList.remove("visible"));
      if (!isVisible) {
        popup.classList.add("visible");
      }
    });

    document.addEventListener("click", () => {
      popup.classList.remove("visible");
    });

    tdRice.appendChild(riceWrapper);
    tr.appendChild(tdRice);

    const tdInputs = document.createElement("td");
    tdInputs.innerHTML = `
      <div class="cell-rice-values">
        <div>R - ${reachVal}</div>
        <div>I - ${impactVal}</div>
        <div>C - ${confidenceVal !== "—" ? confidenceVal + "%" : "—"}</div>
        <div>E - ${effortVal}</div>
      </div>
    `;
    tr.appendChild(tdInputs);

    const tdFinancial = document.createElement("td");
    if (project.financialImpactValue != null && project.financialImpactValue !== "") {
      const formattedAmount = Number(project.financialImpactValue).toLocaleString(undefined, {
        maximumFractionDigits: 2
      });
      tdFinancial.innerHTML = `
        <div class="cell-meta"><strong>${formattedAmount}</strong></div>
      `;
    } else {
      tdFinancial.innerHTML = `<span class="cell-meta">—</span>`;
    }
    tr.appendChild(tdFinancial);

    const tdCurrency = document.createElement("td");
    tdCurrency.innerHTML = `<span class="cell-meta">${project.financialImpactCurrency || "—"}</span>`;
    tr.appendChild(tdCurrency);

    const tdCreated = document.createElement("td");
    tdCreated.innerHTML = `<div class="cell-meta">${formatDateTime(project.createdAt)}</div>`;
    tr.appendChild(tdCreated);

    const tdModified = document.createElement("td");
    tdModified.innerHTML = `<div class="cell-meta">${formatDateTime(project.modifiedAt)}</div>`;
    tr.appendChild(tdModified);

    const tdActions = document.createElement("td");
    tdActions.className = "cell-actions";

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "btn-secondary";
    viewBtn.textContent = "View";
    viewBtn.dataset.action = "viewProject";
    viewBtn.setAttribute("data-id", project.id);

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.dataset.action = "editProject";
    editBtn.setAttribute("data-id", project.id);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-secondary";
    deleteBtn.textContent = "Delete";
    deleteBtn.dataset.action = "deleteProject";
    deleteBtn.setAttribute("data-id", project.id);

    tdActions.appendChild(viewBtn);
    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);
    tr.appendChild(tdActions);

    rows.appendChild(tr);
  });

  elements.projectsTableBody.appendChild(rows);
  syncHeaderCheckbox();
  updateBulkDeleteButton();
  updateSortIndicators();
  renderProfiles();
}

function applyFilters(projects) {
  const titleQuery = (elements.filterTitle.value || "").trim().toLowerCase();
  const createdFrom = elements.filterCreatedFrom.value ? new Date(elements.filterCreatedFrom.value) : null;
  const createdTo = elements.filterCreatedTo.value ? new Date(elements.filterCreatedTo.value) : null;
  const modifiedFrom = elements.filterModifiedFrom.value ? new Date(elements.filterModifiedFrom.value) : null;
  const modifiedTo = elements.filterModifiedTo.value ? new Date(elements.filterModifiedTo.value) : null;
  const impactFilter = elements.filterImpact.value;
  const effortFilter = elements.filterEffort.value;
  const currencyFilter = elements.filterCurrency.value;
  const projectTypeFilter = elements.filterProjectType.value;
  const selectedCountriesFilter = getSelectedFilterCountries();

  return projects.filter((p) => {
    if (titleQuery) {
      const title = (p.title || "").toLowerCase();
      if (!title.includes(titleQuery)) return false;
    }

    if (createdFrom) {
      const createdDate = new Date(p.createdAt);
      if (createdDate < createdFrom) return false;
    }
    if (createdTo) {
      const createdDate = new Date(p.createdAt);
      const endOfDay = new Date(createdTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (createdDate > endOfDay) return false;
    }

    if (modifiedFrom) {
      const modifiedDate = new Date(p.modifiedAt || p.createdAt);
      if (modifiedDate < modifiedFrom) return false;
    }
    if (modifiedTo) {
      const modifiedDate = new Date(p.modifiedAt || p.createdAt);
      const endOfDay = new Date(modifiedTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (modifiedDate > endOfDay) return false;
    }

    if (impactFilter) {
      if (String(p.impactValue || "") !== impactFilter) return false;
    }

    if (effortFilter) {
      if (String(p.effortValue || "") !== effortFilter) return false;
    }

    if (currencyFilter) {
      if ((p.financialImpactCurrency || "") !== currencyFilter) return false;
    }

    if (projectTypeFilter) {
      if ((p.projectType || "") !== projectTypeFilter) return false;
    }

    if (selectedCountriesFilter.length) {
      const projCountries = Array.isArray(p.countries) ? p.countries : [];
      const hasMatch = projCountries.some((c) => selectedCountriesFilter.includes(c));
      if (!hasMatch) return false;
    }

    return true;
  });
}

function sortProjects(projects) {
  const field = state.sortField || "createdAt";
  const direction = state.sortDirection === "asc" ? 1 : -1;

  return projects.slice().sort((a, b) => {
    if (field === "title" || field === "projectType" || field === "financialImpactCurrency") {
      const va = (a[field] || "").toString().toLowerCase();
      const vb = (b[field] || "").toString().toLowerCase();
      if (va === vb) {
        return compareDatesDesc(a.createdAt, b.createdAt);
      }
      return va < vb ? -1 * direction : 1 * direction;
    }

    if (field === "riceScore" || field === "financialImpactValue" || field === "impactValue" || field === "effortValue") {
      const va = Number(field === "riceScore" ? calculateRiceScore(a) : (a[field] ?? 0));
      const vb = Number(field === "riceScore" ? calculateRiceScore(b) : (b[field] ?? 0));
      if (va === vb) {
        return compareDatesDesc(a.createdAt, b.createdAt);
      }
      return va < vb ? -1 * direction : 1 * direction;
    }

    if (field === "createdAt" || field === "modifiedAt") {
      const da = new Date(a[field] || a.createdAt || 0).getTime();
      const db = new Date(b[field] || b.createdAt || 0).getTime();
      if (da === db) return 0;
      return da < db ? -1 * direction : 1 * direction;
    }

    return compareDatesDesc(a.createdAt, b.createdAt);
  });
}

function toggleSort(field) {
  if (state.sortField === field) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortField = field;
    state.sortDirection = field === "title" ? "asc" : "desc";
  }
  saveState();
  updateSortIndicators();
  renderProjects();
}

function updateSortIndicators() {
  const headerCells = document.querySelectorAll("th[data-sort-field]");
  headerCells.forEach((th) => {
    const field = th.getAttribute("data-sort-field");
    const active = field === state.sortField;
    th.dataset.sortActive = active ? "true" : "false";
    const indicator = th.querySelector(".sort-indicator");
    if (indicator) {
      if (!active) {
        indicator.textContent = "↕";
      } else {
        indicator.textContent = state.sortDirection === "asc" ? "↑" : "↓";
      }
    }
  });
}

function clearFilters() {
  elements.filterTitle.value = "";
  elements.filterCreatedFrom.value = "";
  elements.filterCreatedTo.value = "";
  elements.filterModifiedFrom.value = "";
  elements.filterModifiedTo.value = "";
  elements.filterImpact.value = "";
  elements.filterEffort.value = "";
  elements.filterCurrency.value = "";
  elements.filterProjectType.value = "";
  if (elements.filterCountriesSearch) {
    elements.filterCountriesSearch.value = "";
  }
  if (elements.filterCountriesList) {
    const checkboxes = elements.filterCountriesList.querySelectorAll("input[type=\"checkbox\"]");
    checkboxes.forEach((cb) => {
      cb.checked = false;
    });
    filterFilterCountriesBySearchTerm();
  }
  updateFiltersActivePill();
  updateFilterCountriesSummary();
}

function updateBulkDeleteButton() {
  const anyChecked = !!elements.projectsTableBody.querySelector(".project-select-checkbox:checked");
  elements.bulkDeleteBtn.disabled = !anyChecked;
}

function syncHeaderCheckbox() {
  const checkboxes = elements.projectsTableBody.querySelectorAll(".project-select-checkbox");
  if (!checkboxes.length) {
    elements.selectAllProjects.checked = false;
    return;
  }
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  elements.selectAllProjects.checked = allChecked;
}

function handleBulkDelete() {
  const activeProfile = getActiveProfile();
  if (!activeProfile) return;
  const checked = elements.projectsTableBody.querySelectorAll(".project-select-checkbox:checked");
  if (!checked.length) return;

  const ids = Array.from(checked).map((cb) => cb.getAttribute("data-id"));
  const confirmDelete = window.confirm(`Delete ${ids.length} selected project(s)? This cannot be undone.`);
  if (!confirmDelete) return;

  activeProfile.projects = activeProfile.projects.filter((p) => !ids.includes(p.id));
  saveState();
  renderProjects();
}

function closeProjectDeleteModal() {
  if (!elements.projectDeleteModal) return;
  elements.projectDeleteModal.classList.remove("active");
  elements.projectDeleteModal.setAttribute("aria-hidden", "true");
  elements.projectDeleteModal.removeAttribute("data-project-id");
}

function closeProfileDeleteModal() {
  if (!elements.profileDeleteModal) return;
  elements.profileDeleteModal.classList.remove("active");
  elements.profileDeleteModal.setAttribute("aria-hidden", "true");
  elements.profileDeleteModal.removeAttribute("data-profile-id");
}

function deleteProfile(profileId) {
  const index = state.profiles.findIndex((p) => p.id === profileId);
  if (index === -1 || !elements.profileDeleteModal) return;
  const profile = state.profiles[index];
  const projectCount = profile.projects ? profile.projects.length : 0;

  elements.profileDeleteModal.setAttribute("data-profile-id", profileId);
  if (elements.profileDeleteNameLabel) {
    elements.profileDeleteNameLabel.textContent = profile.name || "Untitled profile";
  }
  if (elements.profileDeleteSummaryLabel) {
    if (projectCount > 0) {
      elements.profileDeleteSummaryLabel.textContent = ` • ${projectCount} project${projectCount === 1 ? "" : "s"} attached`;
    } else {
      elements.profileDeleteSummaryLabel.textContent = " • No projects yet";
    }
  }
  if (elements.profileDeleteWarningText) {
    elements.profileDeleteWarningText.textContent =
      "This will permanently remove this profile and all of its projects from this browser. This action cannot be undone.";
  }

  elements.profileDeleteModal.setAttribute("aria-hidden", "false");
  elements.profileDeleteModal.classList.add("active");

  if (elements.profileDeleteConfirmBtn) {
    elements.profileDeleteConfirmBtn.onclick = () => {
      const id = elements.profileDeleteModal.getAttribute("data-profile-id");
      const idx = state.profiles.findIndex((p) => p.id === id);
      if (idx !== -1) {
        state.profiles.splice(idx, 1);
        if (state.profiles.length === 0) {
          state.activeProfileId = null;
          ensureDefaultProfile();
        } else if (state.activeProfileId === id) {
          state.activeProfileId = state.profiles[0].id;
        }
        saveState();
        renderProfiles();
        renderProjects();
      }
      closeProfileDeleteModal();
    };
  }

  if (elements.profileDeleteCancelTopBtn) {
    elements.profileDeleteCancelTopBtn.onclick = () => {
      closeProfileDeleteModal();
    };
  }
  if (elements.profileDeleteCancelBtn) {
    elements.profileDeleteCancelBtn.onclick = () => {
      closeProfileDeleteModal();
    };
  }
}

function handleSingleDelete(projectId) {
  const activeProfile = getActiveProfile();
  if (!activeProfile || !elements.projectDeleteModal) return;

  const project = activeProfile.projects.find((p) => p.id === projectId);
  if (!project) return;

  elements.projectDeleteModal.setAttribute("data-project-id", projectId);
  if (elements.projectDeleteNameLabel) {
    elements.projectDeleteNameLabel.textContent = project.title || "Untitled project";
  }
  if (elements.projectDeleteWarningText) {
    elements.projectDeleteWarningText.textContent =
      "This will permanently remove this project from this profile. This action cannot be undone.";
  }

  elements.projectDeleteModal.setAttribute("aria-hidden", "false");
  elements.projectDeleteModal.classList.add("active");

  if (elements.projectDeleteConfirmBtn) {
    elements.projectDeleteConfirmBtn.onclick = () => {
      const id = elements.projectDeleteModal.getAttribute("data-project-id");
      const target = activeProfile.projects.find((p) => p.id === id);
      if (!target) {
        closeProjectDeleteModal();
        return;
      }
      activeProfile.projects = activeProfile.projects.filter((p) => p.id !== id);
      saveState();
      renderProjects();
      closeProjectDeleteModal();
    };
  }

  if (elements.projectDeleteCancelBtn) {
    elements.projectDeleteCancelBtn.onclick = () => {
      closeProjectDeleteModal();
    };
  }
}

function openProjectModal(mode, projectId) {
  const isEdit = mode === "edit";
  const isView = mode === "view";
  projectModalMode = mode;
  editingProjectId = isEdit ? projectId : null;
  elements.projectFormError.style.display = "none";
  elements.projectFormError.textContent = "";

  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  let project = null;
  if (isEdit || isView) {
    project = activeProfile.projects.find((p) => p.id === projectId);
  }

  if (project) {
    elements.projectModalTitle.textContent = isView ? "View project" : "Edit project";
    elements.projectTitle.value = project.title || "";
    elements.projectDescription.value = project.description || "";
    elements.reachDescription.value = project.reachDescription || "";
    elements.reachValue.value = project.reachValue != null ? project.reachValue : "";
    elements.impactDescription.value = project.impactDescription || "";
    elements.impactValue.value = project.impactValue != null ? String(project.impactValue) : "";
    elements.confidenceDescription.value = project.confidenceDescription || "";
    elements.confidenceValue.value = project.confidenceValue != null ? project.confidenceValue : "";
    elements.effortDescription.value = project.effortDescription || "";
    elements.effortValue.value = project.effortValue != null ? String(project.effortValue) : "";
    elements.financialImpactValue.value = project.financialImpactValue != null ? project.financialImpactValue : "";
    ensureCurrencyOption(elements.projectCurrency, project.financialImpactCurrency);
    const currencyVal = project.financialImpactCurrency ? String(project.financialImpactCurrency).trim() : "";
    if (currencyVal) {
      const opt = Array.from(elements.projectCurrency.options).find(
        (o) => (o.value || "").toUpperCase() === currencyVal.toUpperCase()
      );
      if (opt) elements.projectCurrency.value = opt.value;
    } else {
      elements.projectCurrency.value = "";
    }
    elements.projectType.value = project.projectType || "";
    renderCountriesControls(Array.isArray(project.countries) ? project.countries : []);

    elements.projectMetaCreated.textContent = formatDateTime(project.createdAt);
    elements.projectMetaModified.textContent = formatDateTime(project.modifiedAt || project.createdAt);
    elements.projectMetaRice.textContent = formatRice(calculateRiceScore(project));
    elements.projectFormSubmitBtn.textContent = isView ? "Close" : "Update project";
  } else {
    elements.projectModalTitle.textContent = "New project";
    elements.projectTitle.value = "";
    elements.projectDescription.value = "";
    elements.reachDescription.value = "";
    elements.reachValue.value = "";
    elements.impactDescription.value = "";
    elements.impactValue.value = "";
    elements.confidenceDescription.value = "";
    elements.confidenceValue.value = "";
    elements.effortDescription.value = "";
    elements.effortValue.value = "";
    elements.financialImpactValue.value = "";
    elements.projectCurrency.value = "";
    elements.projectType.value = "";
    renderCountriesControls([]);

    const now = new Date().toISOString();
    elements.projectMetaCreated.textContent = formatDateTime(now);
    elements.projectMetaModified.textContent = formatDateTime(now);
    elements.projectMetaRice.textContent = "—";
    elements.projectFormSubmitBtn.textContent = "Save project";
  }

  updateModalRicePreview();
  elements.projectModal.setAttribute("aria-hidden", "false");
  elements.projectModal.classList.add("active");
  elements.projectTitle.focus();

  const inputs = elements.projectForm.querySelectorAll("input, textarea, select");
  inputs.forEach((el) => {
    if (isView) {
      el.setAttribute("disabled", "disabled");
    } else {
      el.removeAttribute("disabled");
    }
  });

  if (elements.addCountryBtn) {
    elements.addCountryBtn.style.display = isView ? "none" : "";
  }
  if (elements.countriesContainer) {
    const removeButtons = elements.countriesContainer.querySelectorAll(".country-remove-btn");
    removeButtons.forEach((btn) => {
      btn.style.display = isView ? "none" : "";
    });
  }

  if (elements.projectFormCancelBtn) {
    elements.projectFormCancelBtn.style.display = isView ? "none" : "";
  }
}

function closeProjectModal() {
  elements.projectModal.classList.remove("active");
  elements.projectModal.setAttribute("aria-hidden", "true");
  editingProjectId = null;
}

function handleProjectFormSubmit(e) {
  e.preventDefault();
  elements.projectFormError.style.display = "none";
  elements.projectFormError.textContent = "";

  if (elements.projectFormSubmitBtn.textContent === "Close") {
    closeProjectModal();
    return;
  }

  const activeProfile = getActiveProfile();
  if (!activeProfile) return;

  const raw = {
    title: (elements.projectTitle.value || "").trim(),
    description: (elements.projectDescription.value || "").trim(),
    reachDescription: (elements.reachDescription.value || "").trim(),
    reachValue: elements.reachValue.value !== "" ? Number(elements.reachValue.value) : null,
    impactDescription: (elements.impactDescription.value || "").trim(),
    impactValue: elements.impactValue.value !== "" ? Number(elements.impactValue.value) : null,
    confidenceDescription: (elements.confidenceDescription.value || "").trim(),
    confidenceValue: elements.confidenceValue.value !== "" ? Number(elements.confidenceValue.value) : null,
    effortDescription: (elements.effortDescription.value || "").trim(),
    effortValue: elements.effortValue.value !== "" ? Number(elements.effortValue.value) : null,
    financialImpactValue: elements.financialImpactValue.value !== "" ? Number(elements.financialImpactValue.value) : null,
    financialImpactCurrency: normalizeCurrency(elements.projectCurrency.value),
    projectType: (elements.projectType.value || "").trim() || null,
    countries: getCountriesFromControls()
  };

  const validationError = validateProjectInput(raw);
  if (validationError) {
    elements.projectFormError.textContent = validationError;
    elements.projectFormError.style.display = "block";
    return;
  }

  if (editingProjectId) {
    const project = activeProfile.projects.find((p) => p.id === editingProjectId);
    if (!project) return;
    project.title = raw.title;
    project.description = raw.description;
    project.reachDescription = raw.reachDescription;
    project.reachValue = raw.reachValue;
    project.impactDescription = raw.impactDescription;
    project.impactValue = raw.impactValue;
    project.confidenceDescription = raw.confidenceDescription;
    project.confidenceValue = raw.confidenceValue;
    project.effortDescription = raw.effortDescription;
    project.effortValue = raw.effortValue;
    project.financialImpactValue = raw.financialImpactValue;
    project.financialImpactCurrency = raw.financialImpactCurrency;
    project.projectType = raw.projectType || null;
    project.countries = Array.isArray(raw.countries) ? raw.countries : [];
    project.modifiedAt = new Date().toISOString();
    project.riceScore = calculateRiceScore(project);
  } else {
    const now = new Date().toISOString();
    const project = {
      id: generateId("project"),
      createdAt: now,
      modifiedAt: now,
      title: raw.title,
      description: raw.description,
      reachDescription: raw.reachDescription,
      reachValue: raw.reachValue,
      impactDescription: raw.impactDescription,
      impactValue: raw.impactValue,
      confidenceDescription: raw.confidenceDescription,
      confidenceValue: raw.confidenceValue,
      effortDescription: raw.effortDescription,
      effortValue: raw.effortValue,
      financialImpactValue: raw.financialImpactValue,
      financialImpactCurrency: raw.financialImpactCurrency,
      projectType: raw.projectType || null,
      countries: Array.isArray(raw.countries) ? raw.countries : []
    };
    project.riceScore = calculateRiceScore(project);
    activeProfile.projects.unshift(project);
  }

  saveState();
  closeProjectModal();
  renderProjects();
}

function updateModalRicePreview() {
  const temp = {
    reachValue: elements.reachValue.value !== "" ? Number(elements.reachValue.value) : null,
    impactValue: elements.impactValue.value !== "" ? Number(elements.impactValue.value) : null,
    confidenceValue: elements.confidenceValue.value !== "" ? Number(elements.confidenceValue.value) : null,
    effortValue: elements.effortValue.value !== "" ? Number(elements.effortValue.value) : null
  };
  const rice = calculateRiceScore(temp);
  elements.projectMetaRice.textContent = Number.isFinite(rice) && rice > 0 ? formatRice(rice) : "—";
}

// Boot the app once the DOM is ready (classic script mode)
document.addEventListener("DOMContentLoaded", init);
