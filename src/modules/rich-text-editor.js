/**
 * Lightweight rich-text editor for description fields (contenteditable + toolbar).
 */

const RichTextEditor = (function () {
  const instances = new Map();

  const ICONS = {
    bold:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7V5zm0 7h7a3.5 3.5 0 0 1 0 7H7v-7z" fill="currentColor"/></svg>',
    italic:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 4h9v2h-3.2l-4 12H14v2H5v-2h3.2l4-12H10V4z" fill="currentColor"/></svg>',
    underline:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4v6a5 5 0 0 0 10 0V4h2v6a7 7 0 0 1-14 0V4h2zm-2 14h14v2H5v-2z" fill="currentColor"/></svg>',
    alignLeft:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor"/></svg>',
    alignCenter:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16v2H4V6zm3 5h10v2H7v-2zm-3 5h16v2H4v-2z" fill="currentColor"/></svg>',
    alignRight:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16v2H4V6zm6 5h10v2H10v-2zm-6 5h16v2H4v-2z" fill="currentColor"/></svg>',
    alignJustify:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor"/></svg>',
    bulletList:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 7H20v2H8V7zm0 5h12v2H8v-2zm0 5h20v2H8v-2zM4 7a1.5 1.5 0 1 0 0 .01V7zm0 5a1.5 1.5 0 1 0 0 .01V12zm0 5a1.5 1.5 0 1 0 0 .01V17z" fill="currentColor"/></svg>',
    numberedList:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7h12v2H9V7zm0 5h12v2H9v-2zm0 5h12v2H9v-2zM5 6v4H3V7.5L4.5 6H5zm-1 6h2v1H4v1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3v-2h1v-1H3v-1h1a1 1 0 0 1 1-1zm0 5h2.5L5 19.5V21H3v-1.5L4.5 18H3v-2h2v1z" fill="currentColor"/></svg>'
  };

  const TOOLBAR_COMMANDS = [
    { group: "style", label: "Text style", items: [
      { command: "bold", title: "Bold (Ctrl+B)", label: "Bold", icon: ICONS.bold },
      { command: "italic", title: "Italic (Ctrl+I)", label: "Italic", icon: ICONS.italic },
      { command: "underline", title: "Underline (Ctrl+U)", label: "Underline", icon: ICONS.underline }
    ]},
    { group: "align", label: "Alignment", items: [
      { command: "justifyLeft", title: "Align left", label: "Align left", icon: ICONS.alignLeft },
      { command: "justifyCenter", title: "Align center", label: "Align center", icon: ICONS.alignCenter },
      { command: "justifyRight", title: "Align right", label: "Align right", icon: ICONS.alignRight },
      { command: "justifyFull", title: "Justify", label: "Justify", icon: ICONS.alignJustify }
    ]},
    { group: "lists", label: "Lists", items: [
      { command: "insertUnorderedList", title: "Bullet list", label: "Bullet list", icon: ICONS.bulletList },
      { command: "insertOrderedList", title: "Numbered list", label: "Numbered list", icon: ICONS.numberedList }
    ]}
  ];

  function getSurface(surfaceId) {
    return document.getElementById(surfaceId);
  }

  function getInstance(surfaceId) {
    return instances.get(surfaceId) || null;
  }

  function buildToolbarButton(item) {
    return (
      `<button type="button" class="rich-text-editor__btn" data-command="${item.command}" ` +
      `title="${item.title}" aria-label="${item.label}" aria-pressed="false">${item.icon}</button>`
    );
  }

  function buildToolbarHtml(toolbarId, ariaLabel) {
    const groups = TOOLBAR_COMMANDS.map((group, index) => {
      const buttons = group.items.map(buildToolbarButton).join("");
      const separator = index > 0 ? '<div class="rich-text-editor__separator" aria-hidden="true"></div>' : "";
      return (
        `${separator}<div class="rich-text-editor__group" role="group" aria-label="${group.label}">${buttons}</div>`
      );
    }).join("");

    return (
      `<div class="rich-text-editor__toolbar" id="${toolbarId}" role="toolbar" aria-label="${ariaLabel}">` +
      `<span class="rich-text-editor__toolbar-label">Format</span>${groups}</div>`
    );
  }

  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  function getAccessibleName(labelId, fallback) {
    if (labelId) {
      const labelEl = document.getElementById(labelId);
      if (labelEl) {
        const text = (labelEl.textContent || "").replace(/\s+/g, " ").trim();
        if (text) return text;
      }
    }
    return fallback || "Description";
  }

  function buildEditorHtml(options) {
    const surfaceId = options.surfaceId;
    const toolbarId = options.toolbarId;
    const labelId = options.labelId || "";
    const placeholder = options.placeholder || "";
    const size = options.size === "compact" ? "rich-text-editor--compact" : "";
    const accessibleName = getAccessibleName(labelId, options.ariaLabel || "Description");

    return (
      `<div class="rich-text-editor ${size}">` +
      buildToolbarHtml(toolbarId, options.ariaLabel || "Description formatting") +
      `<div id="${surfaceId}" class="rich-text-editor__surface" contenteditable="true" role="textbox" ` +
      `aria-multiline="true" aria-label="${escapeAttr(accessibleName)}"${
        labelId ? ` aria-labelledby="${labelId}"` : ""
      }${options.required ? ' aria-required="true"' : ""} ` +
      `data-placeholder="${placeholder.replace(/"/g, "&quot;")}"></div></div>`
    );
  }

  function mount(hostEl, options) {
    if (!hostEl || !options || !options.surfaceId) return false;
    hostEl.innerHTML = buildEditorHtml(options);
    init({
      surfaceId: options.surfaceId,
      toolbarId: options.toolbarId || `${options.surfaceId}Toolbar`
    });
    return true;
  }

  function mountAllFromDom() {
    document.querySelectorAll("[data-rich-text-editor]").forEach((host) => {
      const surfaceId = host.getAttribute("data-surface-id") || host.id.replace(/Mount$/, "");
      if (!surfaceId || getInstance(surfaceId)) return;
      mount(host, {
        surfaceId,
        toolbarId: host.getAttribute("data-toolbar-id") || `${surfaceId}Toolbar`,
        labelId: host.getAttribute("data-label-id") || "",
        placeholder: host.getAttribute("data-placeholder") || "",
        ariaLabel: host.getAttribute("data-aria-label") || "Description formatting",
        size: host.getAttribute("data-size") || "standard",
        required: host.hasAttribute("data-required")
      });
    });
  }

  function updateEmptyState(surface) {
    if (!surface) return;
    const isEmpty = !(surface.textContent || "").trim();
    surface.classList.toggle("rich-text-editor__surface--empty", isEmpty);
  }

  function updateToolbarState(surfaceId) {
    const inst = getInstance(surfaceId);
    if (!inst || inst.readonly) return;

    const commands = [
      "bold",
      "italic",
      "underline",
      "justifyLeft",
      "justifyCenter",
      "justifyRight",
      "justifyFull",
      "insertUnorderedList",
      "insertOrderedList"
    ];

    commands.forEach((cmd) => {
      const btn = inst.toolbar.querySelector(`[data-command="${cmd}"]`);
      if (!btn) return;
      try {
        const active = document.queryCommandState(cmd);
        btn.classList.toggle("rich-text-editor__btn--active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      } catch {
        btn.classList.remove("rich-text-editor__btn--active");
        btn.setAttribute("aria-pressed", "false");
      }
    });
  }

  function runCommand(surface, command) {
    if (!surface || !command) return;
    surface.focus();
    try {
      document.execCommand(command, false, null);
    } catch (err) {
      console.warn("RichTextEditor command failed:", command, err);
    }
    updateEmptyState(surface);
  }

  function handleKeyboardShortcut(e, surfaceId) {
    if (!e.ctrlKey && !e.metaKey) return;
    const key = (e.key || "").toLowerCase();
    const map = { b: "bold", i: "italic", u: "underline" };
    const command = map[key];
    if (!command) return;
    const inst = getInstance(surfaceId);
    if (!inst || inst.readonly) return;
    e.preventDefault();
    runCommand(inst.surface, command);
    updateToolbarState(surfaceId);
  }

  function init(options) {
    const surfaceId = options && options.surfaceId;
    const toolbarId = options && options.toolbarId;
    const surface = getSurface(surfaceId);
    const toolbar = toolbarId ? document.getElementById(toolbarId) : null;
    if (!surface || !toolbar) return;
    if (instances.has(surfaceId)) return;

    toolbar.querySelectorAll("button[data-command]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (getInstance(surfaceId)?.readonly) return;
        runCommand(surface, btn.getAttribute("data-command"));
        updateToolbarState(surfaceId);
      });
    });

    surface.addEventListener("input", () => updateEmptyState(surface));
    surface.addEventListener("focus", () => {
      surface.closest(".rich-text-editor")?.classList.add("rich-text-editor--focused");
      updateToolbarState(surfaceId);
    });
    surface.addEventListener("blur", () => {
      surface.closest(".rich-text-editor")?.classList.remove("rich-text-editor--focused");
    });
    surface.addEventListener("keyup", () => updateToolbarState(surfaceId));
    surface.addEventListener("mouseup", () => updateToolbarState(surfaceId));

    surface.addEventListener("paste", (e) => {
      e.preventDefault();
      const clipboard = e.clipboardData || window.clipboardData;
      if (!clipboard) return;
      const html = clipboard.getData("text/html");
      const text = clipboard.getData("text/plain");
      if (html && typeof sanitizeDescriptionHtml === "function") {
        const cleaned = sanitizeDescriptionHtml(html);
        if (cleaned) {
          document.execCommand("insertHTML", false, cleaned);
          updateEmptyState(surface);
          return;
        }
      }
      document.execCommand("insertText", false, text || "");
      updateEmptyState(surface);
    });

    surface.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        return;
      }
      handleKeyboardShortcut(e, surfaceId);
    });

    instances.set(surfaceId, {
      surface,
      toolbar,
      readonly: false
    });
    updateEmptyState(surface);
  }

  function getValue(surfaceId) {
    const surface = getSurface(surfaceId);
    if (!surface) return "";
    if (!(surface.textContent || "").trim()) return "";
    const html = surface.innerHTML || "";
    return typeof sanitizeDescriptionHtml === "function"
      ? sanitizeDescriptionHtml(html).trim()
      : html.trim();
  }

  function setValue(surfaceId, value) {
    const surface = getSurface(surfaceId);
    if (!surface) return;
    const raw = value != null ? String(value) : "";

    if (!raw.trim()) {
      surface.innerHTML = "";
      updateEmptyState(surface);
      return;
    }

    if (typeof isDescriptionHtml === "function" && isDescriptionHtml(raw)) {
      surface.innerHTML =
        typeof sanitizeDescriptionHtml === "function" ? sanitizeDescriptionHtml(raw) : raw;
    } else if (typeof plainTextToDescriptionHtml === "function") {
      surface.innerHTML = plainTextToDescriptionHtml(raw);
    } else {
      surface.textContent = raw;
    }
    updateEmptyState(surface);
  }

  function setReadonly(surfaceId, readonly) {
    const inst = getInstance(surfaceId);
    if (!inst) return;
    const isReadonly = !!readonly;
    inst.readonly = isReadonly;
    inst.surface.contentEditable = isReadonly ? "false" : "true";
    inst.surface.classList.toggle("rich-text-editor__surface--readonly", isReadonly);
    inst.toolbar.classList.toggle("rich-text-editor__toolbar--hidden", isReadonly);
    if (isReadonly) {
      inst.toolbar.setAttribute("hidden", "");
      inst.toolbar.setAttribute("aria-hidden", "true");
    } else {
      inst.toolbar.removeAttribute("hidden");
      inst.toolbar.setAttribute("aria-hidden", "false");
    }
    inst.toolbar.querySelectorAll("button").forEach((btn) => {
      btn.disabled = isReadonly;
    });
    const editorEl = inst.surface.closest(".rich-text-editor");
    if (editorEl) {
      editorEl.classList.toggle("rich-text-editor--readonly", isReadonly);
    }
  }

  function clear(surfaceId) {
    setValue(surfaceId, "");
  }

  return {
    mount,
    mountAllFromDom,
    init,
    getValue,
    setValue,
    setReadonly,
    clear
  };
})();

const RICH_TEXT_DESCRIPTION_FIELD_IDS = [
  "projectDescription",
  "reachDescription",
  "impactDescription",
  "confidenceDescription",
  "effortDescription"
];

function getRichDescriptionValue(fieldId) {
  if (typeof RichTextEditor !== "undefined" && RichTextEditor.getValue) {
    const value = RichTextEditor.getValue(fieldId);
    if (value || getRichDescriptionSurface(fieldId)) return (value || "").trim();
  }
  const el = document.getElementById(fieldId);
  if (!el) return "";
  if ("value" in el) return (el.value || "").trim();
  return (el.textContent || "").trim();
}

function setRichDescriptionValue(fieldId, value) {
  if (typeof RichTextEditor !== "undefined" && RichTextEditor.setValue) {
    const surface = getRichDescriptionSurface(fieldId);
    if (surface) {
      RichTextEditor.setValue(fieldId, value || "");
      return;
    }
  }
  const el = document.getElementById(fieldId);
  if (!el) return;
  if ("value" in el) {
    el.value = value || "";
  } else {
    el.textContent = value || "";
  }
}

function getRichDescriptionSurface(fieldId) {
  const el = document.getElementById(fieldId);
  return el && el.classList && el.classList.contains("rich-text-editor__surface") ? el : null;
}

function setRichDescriptionFieldsReadonly(readonly) {
  if (typeof RichTextEditor === "undefined") return;
  RICH_TEXT_DESCRIPTION_FIELD_IDS.forEach((fieldId) => {
    if (getRichDescriptionSurface(fieldId)) {
      RichTextEditor.setReadonly(fieldId, readonly);
    }
  });
}

function richDescriptionToPlainText(raw) {
  return typeof descriptionToPlainText === "function"
    ? descriptionToPlainText(raw || "")
    : String(raw || "").trim();
}
