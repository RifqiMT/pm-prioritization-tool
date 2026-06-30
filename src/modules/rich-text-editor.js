/**
 * Lightweight rich-text editor for description fields (contenteditable + toolbar).
 */

const RichTextEditor = (function () {
  const instances = new Map();
  let selectionListenerBound = false;

  const HIGHLIGHT_COLOR = "#fef08a";
  const DEFAULT_BULLET_STYLE = "disc";

  const BULLET_STYLE_OPTIONS = [
    { id: "disc", label: "Filled circle" },
    { id: "circle", label: "Hollow circle" },
    { id: "square", label: "Square" },
    { id: "dash", label: "Dash" },
    { id: "check", label: "Checkmark" },
    { id: "arrow", label: "Arrow" },
    { id: "diamond", label: "Diamond" },
    { id: "star", label: "Star" }
  ];

  const BULLET_STYLE_LABELS = BULLET_STYLE_OPTIONS.reduce((map, option) => {
    map[option.id] = option.label;
    return map;
  }, {});

  const ICONS = {
    bold:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7V5zm0 7h7a3.5 3.5 0 0 1 0 7H7v-7z" fill="currentColor"/></svg>',
    italic:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 4h9v2h-3.2l-4 12H14v2H5v-2h3.2l4-12H10V4z" fill="currentColor"/></svg>',
    underline:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4v6a5 5 0 0 0 10 0V4h2v6a7 7 0 0 1-14 0V4h2zm-2 14h14v2H5v-2z" fill="currentColor"/></svg>',
    strike:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 11h12v2H6v-2zm4-7h4a3 3 0 0 1 0 6H8V4zm0 8h5a3 3 0 0 1 0 6H8v-6z" fill="currentColor"/></svg>',
    subscript:
      '<span class="rich-text-editor__glyph" aria-hidden="true">X<sub>2</sub></span>',
    superscript:
      '<span class="rich-text-editor__glyph" aria-hidden="true">X<sup>2</sup></span>',
    paragraph:
      '<span class="rich-text-editor__glyph" aria-hidden="true">¶</span>',
    heading2:
      '<span class="rich-text-editor__glyph rich-text-editor__glyph--wide" aria-hidden="true">H2</span>',
    heading3:
      '<span class="rich-text-editor__glyph rich-text-editor__glyph--wide" aria-hidden="true">H3</span>',
    quote:
      '<span class="rich-text-editor__glyph" aria-hidden="true">❝</span>',
    highlight:
      '<span class="rich-text-editor__glyph rich-text-editor__glyph--highlight" aria-hidden="true">◧</span>',
    clearFormat:
      '<span class="rich-text-editor__glyph" aria-hidden="true">✕</span>',
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
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7h12v2H9V7zm0 5h12v2H9v-2zm0 5h12v2H9v-2zM5 6v4H3V7.5L4.5 6H5zm-1 6h2v1H4v1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3v-2h1v-1H3v-1h1a1 1 0 0 1 1-1zm0 5h2.5L5 19.5V21H3v-1.5L4.5 18H3v-2h2v1z" fill="currentColor"/></svg>',
    indent:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2zm14-8 4 4-4 4V7z" fill="currentColor"/></svg>',
    outdent:
      '<svg class="rich-text-editor__svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16v2H4V6zm0 5h10v2H4v-2zm0 5h16v2H4v-2zm4-8-4 4 4 4V7z" fill="currentColor"/></svg>'
  };

  const COMMAND_STATE_MAP = {
    bold: "bold",
    italic: "italic",
    underline: "underline",
    strikeThrough: "strikeThrough",
    subscript: "subscript",
    superscript: "superscript",
    insertUnorderedList: "insertUnorderedList",
    insertOrderedList: "insertOrderedList",
    justifyLeft: "justifyLeft",
    justifyCenter: "justifyCenter",
    justifyRight: "justifyRight",
    justifyFull: "justifyFull"
  };

  const FORMAT_LABELS = {
    bold: "Bold",
    italic: "Italic",
    underline: "Underline",
    strikeThrough: "Strikethrough",
    subscript: "Subscript",
    superscript: "Superscript",
    insertUnorderedList: "Bullet list",
    insertOrderedList: "Numbered list",
    justifyLeft: "Align left",
    justifyCenter: "Align center",
    justifyRight: "Align right",
    justifyFull: "Justify",
    h2: "Heading 2",
    h3: "Heading 3",
    blockquote: "Quote",
    highlight: "Highlight"
  };

  const TOOLBAR_COMMANDS = [
    {
      group: "style",
      label: "Text style",
      items: [
        { command: "bold", title: "Bold (Ctrl+B)", label: "Bold", icon: ICONS.bold },
        { command: "italic", title: "Italic (Ctrl+I)", label: "Italic", icon: ICONS.italic },
        { command: "underline", title: "Underline (Ctrl+U)", label: "Underline", icon: ICONS.underline },
        { command: "strikeThrough", title: "Strikethrough", label: "Strikethrough", icon: ICONS.strike },
        { command: "subscript", title: "Subscript", label: "Subscript", icon: ICONS.subscript },
        { command: "superscript", title: "Superscript", label: "Superscript", icon: ICONS.superscript }
      ]
    },
    {
      group: "blocks",
      label: "Block style",
      items: [
        { formatBlock: "p", blockState: "p", title: "Paragraph", label: "Paragraph", icon: ICONS.paragraph },
        { formatBlock: "h2", blockState: "h2", title: "Heading 2", label: "Heading 2", icon: ICONS.heading2 },
        { formatBlock: "h3", blockState: "h3", title: "Heading 3", label: "Heading 3", icon: ICONS.heading3 },
        { formatBlock: "blockquote", blockState: "blockquote", title: "Block quote", label: "Block quote", icon: ICONS.quote }
      ]
    },
    {
      group: "markup",
      label: "Markup",
      items: [
        { action: "highlight", title: "Highlight", label: "Highlight", icon: ICONS.highlight },
        { action: "clearFormat", title: "Clear formatting", label: "Clear formatting", icon: ICONS.clearFormat }
      ]
    },
    {
      group: "align",
      label: "Alignment",
      items: [
        { command: "justifyLeft", title: "Align left", label: "Align left", icon: ICONS.alignLeft },
        { command: "justifyCenter", title: "Align center", label: "Align center", icon: ICONS.alignCenter },
        { command: "justifyRight", title: "Align right", label: "Align right", icon: ICONS.alignRight },
        { command: "justifyFull", title: "Justify", label: "Justify", icon: ICONS.alignJustify }
      ]
    },
    {
      group: "lists",
      label: "Lists",
      items: [
        { command: "insertUnorderedList", title: "Bullet list (Ctrl+Shift+8)", label: "Bullet list", icon: ICONS.bulletList },
        { command: "insertOrderedList", title: "Numbered list (Ctrl+Shift+7)", label: "Numbered list", icon: ICONS.numberedList },
        { command: "indent", title: "Indent list item (Tab)", label: "Indent", icon: ICONS.indent },
        { command: "outdent", title: "Outdent list item (Shift+Tab)", label: "Outdent", icon: ICONS.outdent }
      ]
    }
  ];

  function getSurface(surfaceId) {
    return document.getElementById(surfaceId);
  }

  function getInstance(surfaceId) {
    return instances.get(surfaceId) || null;
  }

  function buildToolbarButton(item) {
    const btnClass =
      "rich-text-editor__btn" +
      (item.bulletStyle ? " rich-text-editor__btn--bullet-style" : "") +
      (item.btnClass ? " " + item.btnClass : "");
    const attrs = [
      `class="${btnClass}"`,
      `title="${item.title}"`,
      `aria-label="${item.label}"`,
      'aria-pressed="false"'
    ];
    if (item.command) attrs.push(`data-command="${item.command}"`);
    if (item.formatBlock) attrs.push(`data-format-block="${item.formatBlock}"`);
    if (item.blockState) attrs.push(`data-block-state="${item.blockState}"`);
    if (item.action) attrs.push(`data-action="${item.action}"`);
    if (item.bulletStyle) attrs.push(`data-bullet-style="${item.bulletStyle}"`);
    return `<button type="button" ${attrs.join(" ")}>${item.icon}</button>`;
  }

  function buildBulletStyleButton(option) {
    return buildToolbarButton({
      action: "setBulletStyle",
      bulletStyle: option.id,
      title: `${option.label} bullets`,
      label: `${option.label} bullet style`,
      icon: `<span class="rich-text-editor__bullet-preview rich-text-editor__bullet-preview--${option.id}" aria-hidden="true"></span>`
    });
  }

  function buildBulletStyleBarHtml() {
    const buttons = BULLET_STYLE_OPTIONS.map(buildBulletStyleButton).join("");
    return (
      `<details class="rich-text-editor__bullet-details" data-bullet-style-bar>` +
      `<summary class="rich-text-editor__bullet-summary"><span class="rich-text-editor__bullet-summary-icon" aria-hidden="true">•</span>Bullet styles</summary>` +
      `<div class="rich-text-editor__bullet-bar" role="group" aria-label="Bullet style">${buttons}</div>` +
      `</details>`
    );
  }

  function buildStatusHtml(surfaceId) {
    return (
      `<div class="rich-text-editor__status" id="${surfaceId}Status" aria-live="polite" aria-atomic="true">` +
      `<span class="rich-text-editor__status-icon" aria-hidden="true"></span>` +
      `<span class="rich-text-editor__status-copy">` +
      `<span class="rich-text-editor__status-label">Selection</span>` +
      `<span class="rich-text-editor__status-chips" data-status-chips hidden></span>` +
      `<span class="rich-text-editor__status-empty" data-status-empty>Plain text</span>` +
      `</span></div>`
    );
  }

  function buildToolbarHtml(toolbarId, ariaLabel) {
    const groups = TOOLBAR_COMMANDS.map((group) => {
      const buttons = group.items.map(buildToolbarButton).join("");
      return (
        `<div class="rich-text-editor__group" role="group" aria-label="${group.label}">` +
        `<span class="rich-text-editor__group-label">${group.label}</span>` +
        `<div class="rich-text-editor__group-actions">${buttons}</div></div>`
      );
    }).join("");

    return `<div class="rich-text-editor__toolbar" id="${toolbarId}" role="toolbar" aria-label="${ariaLabel}">${groups}</div>`;
  }

  function escapeAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
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

  function getComposeCaption(labelId, fallback) {
    const raw = getAccessibleName(labelId, fallback || "Write here");
    const cleaned = raw
      .replace(/\s*required\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || "Write here";
  }

  function getComposeMeta(placeholder) {
    const hint = String(placeholder || "").replace(/\s+/g, " ").trim();
    if (!hint) return "Tap or click to edit";
    if (hint.length > 52) return `${hint.slice(0, 49)}…`;
    return hint;
  }

  function hostMountOptions(host) {
    const surfaceId = host.getAttribute("data-surface-id") || host.id.replace(/Mount$/, "");
    return {
      surfaceId,
      toolbarId: host.getAttribute("data-toolbar-id") || `${surfaceId}Toolbar`,
      labelId: host.getAttribute("data-label-id") || "",
      placeholder: host.getAttribute("data-placeholder") || "",
      ariaLabel: host.getAttribute("data-aria-label") || "Description formatting",
      size: host.getAttribute("data-size") || "standard",
      required: host.hasAttribute("data-required")
    };
  }

  function editorHasComposeChrome(surfaceId) {
    const inst = getInstance(surfaceId);
    if (!inst || !inst.surface) return false;
    return !!inst.surface.closest(".rich-text-editor")?.querySelector(".rich-text-editor__compose");
  }

  function buildEditorHtml(options) {
    const surfaceId = options.surfaceId;
    const toolbarId = options.toolbarId;
    const labelId = options.labelId || "";
    const placeholder = options.placeholder || "";
    const size = options.size === "compact" ? "rich-text-editor--compact" : "";
    const accessibleName = getAccessibleName(labelId, options.ariaLabel || "Description");
    const composeCaption = getComposeCaption(labelId, options.ariaLabel || "Write here");
    const composeMeta = getComposeMeta(placeholder);

    return (
      `<div class="rich-text-editor ${size}">` +
      `<div class="rich-text-editor__chrome">` +
      `<div class="rich-text-editor__header">` +
      `<div class="rich-text-editor__brand"><span class="rich-text-editor__brand-dot" aria-hidden="true"></span>Rich text</div>` +
      buildStatusHtml(surfaceId) +
      `</div>` +
      `<div class="rich-text-editor__toolbar-scroll"><div class="rich-text-editor__toolbar-scroll-inner">` +
      buildToolbarHtml(toolbarId, options.ariaLabel || "Description formatting") +
      `</div></div>` +
      buildBulletStyleBarHtml() +
      `</div>` +
      `<div class="rich-text-editor__compose">` +
      `<div class="rich-text-editor__compose-head">` +
      `<span class="rich-text-editor__compose-icon" aria-hidden="true">` +
      `<svg class="rich-text-editor__compose-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>` +
      `</svg></span>` +
      `<span class="rich-text-editor__compose-caption">${escapeHtml(composeCaption)}</span>` +
      `<span class="rich-text-editor__compose-meta">${escapeHtml(composeMeta)}</span>` +
      `</div>` +
      `<div class="rich-text-editor__surface-wrap">` +
      `<div id="${surfaceId}" class="rich-text-editor__surface rich-description-content rich-text-editor__surface--empty" contenteditable="true" role="textbox" ` +
      `aria-multiline="true" aria-label="${escapeAttr(accessibleName)}"${
        labelId ? ` aria-labelledby="${labelId}"` : ""
      }${options.required ? ' aria-required="true"' : ""} ` +
      `data-placeholder="${placeholder.replace(/"/g, "&quot;")}"></div>` +
      `</div></div>` +
      `<p class="rich-text-editor__hint">Tab to indent lists · Enter on empty line exits list · Ctrl/Cmd+B/I/U for style</p>` +
      `</div>`
    );
  }

  function normalizeFormatBlockValue(value) {
    const raw = String(value || "").toLowerCase().replace(/[<>]/g, "");
    if (!raw || raw === "div") return "p";
    return raw;
  }

  function getActiveBlockFormat() {
    try {
      return normalizeFormatBlockValue(document.queryCommandValue("formatBlock"));
    } catch {
      return "p";
    }
  }

  function selectionTouchesSurface(surface) {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || !surface) return false;
    const node = sel.anchorNode;
    if (!node) return false;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(el && surface.contains(el));
  }

  function getClosestListItem(node, surface) {
    let el = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el && el !== surface) {
      if (el.tagName === "LI") return el;
      el = el.parentElement;
    }
    return null;
  }

  function getBulletStyleId(listEl) {
    if (!listEl || listEl.tagName !== "UL") return DEFAULT_BULLET_STYLE;
    const style = (listEl.getAttribute("data-bullet-style") || "").trim();
    return BULLET_STYLE_LABELS[style] ? style : DEFAULT_BULLET_STYLE;
  }

  function getActiveBulletList(surface) {
    const sel = document.getSelection();
    if (!sel || !surface) return null;
    const li = getClosestListItem(sel.anchorNode, surface);
    if (!li) return null;
    const list = li.parentElement;
    return list && list.tagName === "UL" && surface.contains(list) ? list : null;
  }

  function applyBulletStyle(surface, surfaceId, styleId) {
    if (!surface || !BULLET_STYLE_LABELS[styleId]) return;
    const inst = getInstance(surfaceId);

    let ul = getActiveBulletList(surface);
    if (!ul) {
      document.execCommand("insertUnorderedList", false, null);
      normalizeListStructure(surface);
      syncNestedBulletStyles(surface);
      ul = getActiveBulletList(surface);
    }

    if (ul) {
      ul.setAttribute("data-bullet-style", styleId);
      if (inst) inst.lastBulletStyle = styleId;
    }
  }

  function syncNestedBulletStyles(surface) {
    if (!surface) return;
    surface.querySelectorAll("ul").forEach((ul) => {
      if (ul.hasAttribute("data-bullet-style")) return;
      const parentLi = ul.parentElement;
      if (parentLi && parentLi.tagName === "LI") {
        const parentUl = parentLi.closest("ul");
        ul.setAttribute("data-bullet-style", getBulletStyleId(parentUl));
        return;
      }
      ul.setAttribute("data-bullet-style", DEFAULT_BULLET_STYLE);
    });
  }

  function applyDefaultBulletStyle(surface, surfaceId) {
    const inst = getInstance(surfaceId);
    const styleId = (inst && inst.lastBulletStyle) || DEFAULT_BULLET_STYLE;
    const ul = getActiveBulletList(surface);
    if (ul && !ul.hasAttribute("data-bullet-style")) {
      ul.setAttribute("data-bullet-style", styleId);
    }
    syncNestedBulletStyles(surface);
  }

  function placeCursorInElement(el, atStart) {
    const sel = document.getSelection();
    if (!sel || !el) return;
    const range = document.createRange();
    if (el.childNodes.length) {
      range.selectNodeContents(el);
      range.collapse(!!atStart);
    } else {
      range.setStart(el, 0);
      range.collapse(true);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function exitListItem(li, surface) {
    if (!li || !surface) return;
    const list = li.parentElement;
    if (!list || (list.tagName !== "UL" && list.tagName !== "OL")) return;

    const paragraph = document.createElement("p");
    paragraph.innerHTML = "<br>";

    if (list.children.length === 1) {
      list.replaceWith(paragraph);
    } else {
      li.remove();
      list.after(paragraph);
    }

    placeCursorInElement(paragraph, true);
  }

  function getListContext(surface) {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || !surface) return null;

    const li = getClosestListItem(sel.anchorNode, surface);
    if (!li) return null;

    let list = li.parentElement;
    while (list && list !== surface && list.tagName !== "UL" && list.tagName !== "OL") {
      list = list.parentElement;
    }
    if (!list || !surface.contains(list)) return null;

    const directItems = [...list.children].filter((child) => child.tagName === "LI");
    const index = directItems.indexOf(li);
    let depth = 0;
    let parent = list.parentElement;
    while (parent && parent !== surface) {
      if (parent.tagName === "LI") depth += 1;
      parent = parent.parentElement;
    }

    return {
      isOrdered: list.tagName === "OL",
      index: index >= 0 ? index + 1 : 1,
      total: directItems.length || 1,
      depth: depth + 1,
      bulletStyle: list.tagName === "UL" ? getBulletStyleId(list) : null
    };
  }

  function getListItemPlainText(li) {
    return (li.textContent || "").replace(/\u00a0/g, " ").replace(/\u200B/g, "").trim();
  }

  function normalizeListStructure(surface) {
    if (!surface) return;

    surface.querySelectorAll("ul, ol").forEach((list) => {
      [...list.querySelectorAll("li")].forEach((li) => {
        li.querySelectorAll(":scope > br:last-child").forEach((br) => {
          if (!br.nextSibling && !getListItemPlainText(li)) br.remove();
        });
      });

      [...list.children].forEach((child) => {
        if (child.tagName !== "LI") {
          const wrapper = document.createElement("li");
          list.insertBefore(wrapper, child);
          wrapper.appendChild(child);
        }
      });

      if (!getListItemPlainText(list) && !list.querySelector("ul, ol")) {
        list.remove();
      }
    });

    syncNestedBulletStyles(surface);
  }

  function hasHighlightInSelection(surface) {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || !surface) return false;

    function nodeHasHighlight(node) {
      while (node && node !== surface) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          node = node.parentElement;
          continue;
        }
        const tag = node.tagName.toUpperCase();
        if (tag === "MARK") return true;
        const bg = node.style && node.style.backgroundColor;
        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") return true;
        node = node.parentElement;
      }
      return false;
    }

    if (sel.isCollapsed) {
      return nodeHasHighlight(sel.anchorNode);
    }

    const fragment = sel.getRangeAt(0).cloneContents();
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
    let el = walker.nextNode();
    while (el) {
      const tag = el.tagName ? el.tagName.toUpperCase() : "";
      if (tag === "MARK") return true;
      const bg = el.style && el.style.backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") return true;
      el = walker.nextNode();
    }
    return false;
  }

  function getActiveFormatDescriptors(surfaceId) {
    const inst = getInstance(surfaceId);
    if (!inst || inst.readonly) return [];
    if (!selectionTouchesSurface(inst.surface)) return [];

    const active = [];
    const listContext = getListContext(inst.surface);

    Object.entries(COMMAND_STATE_MAP).forEach(([key, command]) => {
      if (listContext && (key === "insertUnorderedList" || key === "insertOrderedList")) return;
      try {
        if (document.queryCommandState(command)) {
          active.push({ key, label: FORMAT_LABELS[key] || key });
        }
      } catch {
        /* unsupported */
      }
    });

    const block = getActiveBlockFormat();
    if (block === "h2") active.push({ key: "h2", label: FORMAT_LABELS.h2 });
    else if (block === "h3") active.push({ key: "h3", label: FORMAT_LABELS.h3 });
    else if (block === "blockquote") active.push({ key: "blockquote", label: FORMAT_LABELS.blockquote });

    if (hasHighlightInSelection(inst.surface)) {
      active.push({ key: "highlight", label: FORMAT_LABELS.highlight });
    }

    if (listContext) {
      const listLabel = listContext.isOrdered ? "Numbered list" : "Bullet list";
      const positionLabel =
        listContext.total > 1
          ? `${listLabel} · Item ${listContext.index}/${listContext.total}`
          : listLabel;
      active.push({
        key: listContext.isOrdered ? "insertOrderedList" : "insertUnorderedList",
        label: positionLabel
      });
      if (listContext.depth > 1) {
        active.push({ key: "list-depth", label: `Level ${listContext.depth}` });
      }
      if (!listContext.isOrdered && listContext.bulletStyle) {
        active.push({
          key: "bullet-style",
          label: BULLET_STYLE_LABELS[listContext.bulletStyle] || "Bullets"
        });
      }
    }

    return active;
  }

  function updateFormatStatus(surfaceId) {
    const inst = getInstance(surfaceId);
    if (!inst || !inst.statusEl) return;

    const chipsEl = inst.statusEl.querySelector("[data-status-chips]");
    const emptyEl = inst.statusEl.querySelector("[data-status-empty]");
    if (!chipsEl || !emptyEl) return;

    const formats = getActiveFormatDescriptors(surfaceId);
    chipsEl.innerHTML = "";

    if (!formats.length) {
      emptyEl.hidden = false;
      chipsEl.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    chipsEl.hidden = false;
    formats.forEach((fmt) => {
      const chip = document.createElement("span");
      chip.className = "rich-text-editor__status-chip";
      chip.textContent = fmt.label;
      chip.setAttribute("data-format-key", fmt.key);
      chipsEl.appendChild(chip);
    });
  }

  function bindSelectionListener() {
    if (selectionListenerBound) return;
    selectionListenerBound = true;
    document.addEventListener("selectionchange", () => {
      instances.forEach((_inst, surfaceId) => {
        updateToolbarState(surfaceId);
      });
    });
  }

  function remountHost(hostEl, options) {
    if (!hostEl || !options || !options.surfaceId) return false;
    const surfaceId = options.surfaceId;
    const existing = getInstance(surfaceId);
    const savedHtml = existing?.surface ? existing.surface.innerHTML : "";
    const wasReadonly = !!existing?.readonly;
    instances.delete(surfaceId);
    mount(hostEl, options);
    const surface = getSurface(surfaceId);
    if (surface && savedHtml) {
      surface.innerHTML = savedHtml;
      updateEmptyState(surface);
      updateToolbarState(surfaceId);
    }
    if (wasReadonly) setReadonly(surfaceId, true);
    return true;
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
      const options = hostMountOptions(host);
      const surfaceId = options.surfaceId;
      if (!surfaceId) return;
      if (getInstance(surfaceId)) {
        if (editorHasComposeChrome(surfaceId)) return;
        remountHost(host, options);
        return;
      }
      mount(host, options);
    });
  }

  function updateEmptyState(surface) {
    if (!surface) return;
    const isEmpty = !(surface.textContent || "").trim();
    surface.classList.toggle("rich-text-editor__surface--empty", isEmpty);
    const editorEl = surface.closest(".rich-text-editor");
    if (editorEl) editorEl.classList.toggle("rich-text-editor--empty", isEmpty);
  }

  function updateToolbarState(surfaceId) {
    const inst = getInstance(surfaceId);
    if (!inst || inst.readonly) return;

    const inSurface = selectionTouchesSurface(inst.surface);
    const block = getActiveBlockFormat();

    Object.keys(COMMAND_STATE_MAP).forEach((cmd) => {
      const btn = inst.toolbar.querySelector(`[data-command="${cmd}"]`);
      if (!btn) return;
      let active = false;
      if (inSurface) {
        try {
          active = document.queryCommandState(COMMAND_STATE_MAP[cmd]);
        } catch {
          active = false;
        }
      }
      btn.classList.toggle("rich-text-editor__btn--active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    inst.toolbar.querySelectorAll("[data-block-state]").forEach((btn) => {
      const state = btn.getAttribute("data-block-state");
      const active = inSurface && block === state;
      btn.classList.toggle("rich-text-editor__btn--active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const highlightBtn = inst.toolbar.querySelector('[data-action="highlight"]');
    if (highlightBtn) {
      const highlighted = inSurface && hasHighlightInSelection(inst.surface);
      highlightBtn.classList.toggle("rich-text-editor__btn--active", highlighted);
      highlightBtn.setAttribute("aria-pressed", highlighted ? "true" : "false");
    }

    const bulletList = inSurface ? getActiveBulletList(inst.surface) : null;
    const activeBulletStyle = bulletList ? getBulletStyleId(bulletList) : null;
    const editorEl = inst.surface.closest(".rich-text-editor");
    const bulletBar = editorEl ? editorEl.querySelector("[data-bullet-style-bar]") : null;
    if (bulletBar) {
      const showBulletStyles = !!bulletList;
      bulletBar.classList.toggle("rich-text-editor__bullet-details--inactive", !showBulletStyles);
      if (showBulletStyles) {
        bulletBar.setAttribute("open", "");
      } else {
        bulletBar.removeAttribute("open");
      }
    }
    if (editorEl) {
      const activeFormats = getActiveFormatDescriptors(surfaceId);
      editorEl.classList.toggle("rich-text-editor--has-selection", activeFormats.length > 0);
      editorEl.querySelectorAll('[data-action="setBulletStyle"]').forEach((btn) => {
        const style = btn.getAttribute("data-bullet-style");
        const enabled = !!bulletList;
        btn.disabled = !enabled;
        btn.classList.toggle("rich-text-editor__btn--active", enabled && style === activeBulletStyle);
        btn.setAttribute("aria-pressed", enabled && style === activeBulletStyle ? "true" : "false");
      });
    }

    updateFormatStatus(surfaceId);
  }

  function runToolbarAction(surface, surfaceId, btn) {
    if (!surface || !btn) return;
    surface.focus();

    const command = btn.getAttribute("data-command");
    const formatBlock = btn.getAttribute("data-format-block");
    const action = btn.getAttribute("data-action");
    const bulletStyle = btn.getAttribute("data-bullet-style");

    try {
      if (formatBlock) {
        document.execCommand("formatBlock", false, formatBlock);
      } else if (action === "setBulletStyle" && bulletStyle) {
        applyBulletStyle(surface, surfaceId, bulletStyle);
      } else if (action === "highlight") {
        document.execCommand("hiliteColor", false, HIGHLIGHT_COLOR);
      } else if (action === "clearFormat") {
        document.execCommand("removeFormat", false, null);
        document.execCommand("unlink", false, null);
      } else if (command) {
        document.execCommand(command, false, null);
        if (
          command === "insertUnorderedList" ||
          command === "insertOrderedList" ||
          command === "indent" ||
          command === "outdent"
        ) {
          normalizeListStructure(surface);
          if (command === "insertUnorderedList") {
            applyDefaultBulletStyle(surface, surfaceId);
          }
        }
      }
    } catch (err) {
      console.warn("RichTextEditor action failed:", command || formatBlock || action, err);
    }

    updateEmptyState(surface);
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

  function handleListKeydown(e, surface, surfaceId) {
    const inst = getInstance(surfaceId);
    if (!inst || inst.readonly) return false;

    const li = getClosestListItem(document.getSelection()?.anchorNode, surface);

    if (e.key === "Tab") {
      if (!li) return false;
      e.preventDefault();
      document.execCommand(e.shiftKey ? "outdent" : "indent", false, null);
      normalizeListStructure(surface);
      updateEmptyState(surface);
      updateToolbarState(surfaceId);
      return true;
    }

    if (e.key === "Enter" && !e.shiftKey && li && getListItemPlainText(li) === "") {
      e.preventDefault();
      exitListItem(li, surface);
      normalizeListStructure(surface);
      updateEmptyState(surface);
      updateToolbarState(surfaceId);
      return true;
    }

    if (e.key === "Backspace" && li && getListItemPlainText(li) === "") {
      e.preventDefault();
      const list = li.parentElement;
      if (list && list.children.length === 1) {
        exitListItem(li, surface);
      } else {
        const items = [...list.children].filter((child) => child.tagName === "LI");
        const idx = items.indexOf(li);
        li.remove();
        const focusTarget = items[idx - 1] || items[idx + 1] || list.querySelector("li");
        if (focusTarget) placeCursorInElement(focusTarget, false);
      }
      normalizeListStructure(surface);
      updateEmptyState(surface);
      updateToolbarState(surfaceId);
      return true;
    }

    return false;
  }

  function handleKeyboardShortcut(e, surfaceId) {
    const inst = getInstance(surfaceId);
    if (!inst || inst.readonly) return;

    if (e.ctrlKey || e.metaKey) {
      const key = (e.key || "").toLowerCase();
      const map = { b: "bold", i: "italic", u: "underline" };
      const command = map[key];
      if (command) {
        e.preventDefault();
        runCommand(inst.surface, command);
        updateToolbarState(surfaceId);
        return;
      }
      if (e.shiftKey && key === "8") {
        e.preventDefault();
        runCommand(inst.surface, "insertUnorderedList");
        normalizeListStructure(inst.surface);
        applyDefaultBulletStyle(inst.surface, surfaceId);
        updateToolbarState(surfaceId);
        return;
      }
      if (e.shiftKey && key === "7") {
        e.preventDefault();
        runCommand(inst.surface, "insertOrderedList");
        normalizeListStructure(inst.surface);
        updateToolbarState(surfaceId);
        return;
      }
    }
  }

  function init(options) {
    const surfaceId = options && options.surfaceId;
    const toolbarId = options && options.toolbarId;
    const surface = getSurface(surfaceId);
    const toolbar = toolbarId ? document.getElementById(toolbarId) : null;
    const statusEl = document.getElementById(`${surfaceId}Status`);
    if (!surface || !toolbar) return;
    if (instances.has(surfaceId)) return;

    bindSelectionListener();

    toolbar.querySelectorAll("button[data-command], button[data-format-block], button[data-action]").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (getInstance(surfaceId)?.readonly) return;
        runToolbarAction(surface, surfaceId, btn);
        updateToolbarState(surfaceId);
      });
    });

    const editorEl = surface.closest(".rich-text-editor");
    if (editorEl) {
      editorEl.querySelectorAll('[data-action="setBulletStyle"]').forEach((btn) => {
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          if (getInstance(surfaceId)?.readonly) return;
          runToolbarAction(surface, surfaceId, btn);
          updateToolbarState(surfaceId);
        });
      });

      const focusSurfaceFromCompose = (e) => {
        if (getInstance(surfaceId)?.readonly) return;
        if (e.target.closest(".rich-text-editor__surface")) return;
        e.preventDefault();
        surface.focus();
      };
      editorEl.querySelector(".rich-text-editor__compose-head")?.addEventListener("mousedown", focusSurfaceFromCompose);
      editorEl.querySelector(".rich-text-editor__surface-wrap")?.addEventListener("mousedown", focusSurfaceFromCompose);
    }

    surface.addEventListener("input", () => {
      updateEmptyState(surface);
      updateToolbarState(surfaceId);
    });
    surface.addEventListener("focus", () => {
      surface.closest(".rich-text-editor")?.classList.add("rich-text-editor--focused");
      updateToolbarState(surfaceId);
    });
    surface.addEventListener("blur", () => {
      surface.closest(".rich-text-editor")?.classList.remove("rich-text-editor--focused");
      normalizeListStructure(surface);
      updateToolbarState(surfaceId);
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
          normalizeListStructure(surface);
          updateEmptyState(surface);
          updateToolbarState(surfaceId);
          return;
        }
      }
      document.execCommand("insertText", false, text || "");
      updateEmptyState(surface);
      updateToolbarState(surfaceId);
    });

    surface.addEventListener("keydown", (e) => {
      if (handleListKeydown(e, surface, surfaceId)) return;
      handleKeyboardShortcut(e, surfaceId);
    });

    instances.set(surfaceId, {
      surface,
      toolbar,
      statusEl,
      readonly: false,
      lastBulletStyle: DEFAULT_BULLET_STYLE
    });
    updateEmptyState(surface);
    updateToolbarState(surfaceId);
  }

  function getValue(surfaceId) {
    const surface = getSurface(surfaceId);
    if (!surface) return "";
    if (!(surface.textContent || "").trim()) return "";
    normalizeListStructure(surface);
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
      updateToolbarState(surfaceId);
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
    syncNestedBulletStyles(surface);
    updateEmptyState(surface);
    updateToolbarState(surfaceId);
  }

  function setReadonly(surfaceId, readonly) {
    const inst = getInstance(surfaceId);
    if (!inst) return;
    const isReadonly = !!readonly;
    inst.readonly = isReadonly;
    inst.surface.contentEditable = isReadonly ? "false" : "true";
    inst.surface.classList.toggle("rich-text-editor__surface--readonly", isReadonly);
    const editorEl = inst.surface.closest(".rich-text-editor");
    if (editorEl) {
      const chrome = editorEl.querySelector(".rich-text-editor__chrome");
      const hint = editorEl.querySelector(".rich-text-editor__hint");
      if (chrome) chrome.hidden = isReadonly;
      if (hint) hint.hidden = isReadonly;
      editorEl.classList.toggle("rich-text-editor--readonly", isReadonly);
      editorEl.querySelectorAll('[data-action="setBulletStyle"]').forEach((btn) => {
        btn.disabled = isReadonly;
      });
    }
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
  }

  return {
    mountAllFromDom,
    getValue,
    setValue,
    setReadonly
  };
})();

const RICH_TEXT_DESCRIPTION_FIELD_IDS = [
  "roadmapDescription",
  "roadmapNote",
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
    RichTextEditor.setValue(fieldId, value || "");
    return;
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
