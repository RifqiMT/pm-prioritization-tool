/**
 * Rich-text formatting for roadmap descriptions in tooltips and editor.
 * Handles plain text (paragraphs, bullets, numbering) and sanitized HTML.
 */

const DESCRIPTION_ALLOWED_TAGS = new Set([
  "P",
  "DIV",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "UL",
  "OL",
  "LI",
  "SPAN"
]);

const DESCRIPTION_ALLOWED_ALIGN = new Set(["left", "center", "right", "justify"]);

function escapeDescriptionHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isDescriptionHtml(raw) {
  const value = String(raw || "").trim();
  if (!value) return false;
  return /<\s*(p|div|br|ul|ol|li|strong|b|em|i|u|span)\b/i.test(value);
}

function sanitizeDescriptionHtml(html) {
  const raw = String(html || "").trim();
  if (!raw) return "";
  try {
    const doc = new DOMParser().parseFromString(`<div id="sanitize-root">${raw}</div>`, "text/html");
    const root = doc.getElementById("sanitize-root");
    if (!root) return "";

    root.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => {
      node.remove();
    });

    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const elements = [];
    let node = walker.nextNode();
    while (node) {
      elements.push(node);
      node = walker.nextNode();
    }

    for (let i = elements.length - 1; i >= 0; i -= 1) {
      const el = elements[i];
      if (el === root) continue;
      const tag = el.tagName;
      if (!DESCRIPTION_ALLOWED_TAGS.has(tag)) {
        const parent = el.parentNode;
        if (!parent) continue;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
        continue;
      }

      [...el.attributes].forEach((attr) => {
        if (attr.name === "style") {
          const align = (el.style.textAlign || "").toLowerCase();
          el.removeAttribute("style");
          if (DESCRIPTION_ALLOWED_ALIGN.has(align) && ["P", "DIV", "LI"].includes(tag)) {
            el.style.textAlign = align;
          }
        } else {
          el.removeAttribute(attr.name);
        }
      });
    }

    return root.innerHTML.trim();
  } catch (err) {
    console.warn("sanitizeDescriptionHtml failed", err);
    return escapeDescriptionHtml(raw);
  }
}

function plainTextToDescriptionHtml(raw) {
  const text = preprocessDescription(raw);
  if (!text) return "";
  if (isDescriptionHtml(text)) return sanitizeDescriptionHtml(text);

  const blocks = parseDescriptionBlocks(text);
  if (blocks.length) {
    const parts = [];
    blocks.forEach((block) => {
      if (block.type === "heading") {
        parts.push(`<p><strong>${escapeDescriptionHtml(block.text)}</strong></p>`);
      } else if (block.type === "paragraph") {
        parts.push(`<p>${escapeDescriptionHtml(block.text)}</p>`);
      } else if (block.type === "ul" || block.type === "ol") {
        const tag = block.type === "ol" ? "ol" : "ul";
        parts.push(
          `<${tag}>${block.items.map((item) => `<li>${escapeDescriptionHtml(item)}</li>`).join("")}</${tag}>`
        );
      }
    });
    return parts.join("");
  }

  return text
    .split(/\n\n+/)
    .map((para) => {
      const lines = para.split(/\n/).map((line) => escapeDescriptionHtml(line)).join("<br>");
      return `<p>${lines}</p>`;
    })
    .join("");
}

function descriptionToPlainText(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (isDescriptionHtml(text)) {
    const div = document.createElement("div");
    div.innerHTML = sanitizeDescriptionHtml(text);
    return (div.innerText || div.textContent || "").trim();
  }
  return preprocessDescription(text);
}

function normalizeDescriptionText(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function preprocessDescription(raw) {
  let text = normalizeDescriptionText(raw);
  text = text.replace(/^description:\s*/i, "");
  return text;
}

function classifyDescriptionLine(line) {
  const trimmed = (line || "").trim();
  if (!trimmed) return { type: "empty" };

  const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
  if (numbered) return { type: "ol-item", text: numbered[2].trim() };

  const bullet = trimmed.match(/^(?:[-*•–—‣▪]|·)\s+(.+)$/);
  if (bullet) return { type: "ul-item", text: bullet[1].trim() };

  const sectionHeader = trimmed.match(/^(.{2,72}):\s*$/);
  if (sectionHeader) {
    return { type: "heading", text: sectionHeader[1].trim() };
  }

  return { type: "paragraph", text: trimmed };
}

function extractInlineBulletItems(text) {
  const trimmed = (text || "").trim();
  if (!trimmed || !/[•·‣▪]/.test(trimmed)) return null;

  const parts = trimmed
    .split(/\s*(?:•|·|‣|▪)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts : null;
}

function parseDescriptionSection(sectionText) {
  const blocks = [];
  const section = (sectionText || "").trim();
  if (!section) return blocks;

  const headerInline = section.match(/^([^:\n]{2,72}):\s*(.+)$/s);
  if (headerInline && headerInline[2]) {
    blocks.push({ type: "heading", text: headerInline[1].trim() });
    const rest = headerInline[2].trim();
    const inlineBullets = extractInlineBulletItems(rest);
    if (inlineBullets) {
      const first = inlineBullets[0];
      const remainder = inlineBullets.slice(1);
      if (remainder.length && (first.length > 72 || /\.\s*$/.test(first))) {
        blocks.push({ type: "paragraph", text: first });
        blocks.push({ type: "ul", items: remainder });
      } else {
        blocks.push({ type: "ul", items: inlineBullets });
      }
      return blocks;
    }
    blocks.push({ type: "paragraph", text: rest });
    return blocks;
  }

  const lines = section.split(/\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const inlineBullets = extractInlineBulletItems(line);
    if (inlineBullets) {
      const first = inlineBullets[0];
      const rest = inlineBullets.slice(1);
      if (rest.length && (first.length > 72 || /\.\s*$/.test(first))) {
        blocks.push({ type: "paragraph", text: first });
        blocks.push({ type: "ul", items: rest });
      } else {
        blocks.push({ type: "ul", items: inlineBullets });
      }
      i += 1;
      continue;
    }

    const classified = classifyDescriptionLine(line);
    if (classified.type === "empty") {
      i += 1;
      continue;
    }

    if (classified.type === "heading") {
      blocks.push({ type: "heading", text: classified.text });
      i += 1;
      continue;
    }

    if (classified.type === "ul-item" || classified.type === "ol-item") {
      const listType = classified.type === "ol-item" ? "ol" : "ul";
      const items = [];
      while (i < lines.length) {
        const current = classifyDescriptionLine(lines[i]);
        if (
          (listType === "ul" && current.type === "ul-item") ||
          (listType === "ol" && current.type === "ol-item")
        ) {
          items.push(current.text);
          i += 1;
        } else if (current.type === "empty") {
          i += 1;
        } else {
          break;
        }
      }
      if (items.length) blocks.push({ type: listType, items });
      continue;
    }

    const paragraphLines = [];
    while (i < lines.length) {
      const current = classifyDescriptionLine(lines[i]);
      if (current.type === "paragraph") {
        paragraphLines.push(current.text);
        i += 1;
      } else {
        break;
      }
    }
    if (paragraphLines.length) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    }
  }

  return blocks;
}

function parseDescriptionBlocks(raw) {
  const text = preprocessDescription(raw);
  if (!text) return [];

  const sections = text.split(/\n\n+/);
  const blocks = [];
  sections.forEach((section) => {
    parseDescriptionSection(section).forEach((block) => blocks.push(block));
  });
  return blocks;
}

function shouldDescriptionTooltipScroll(raw) {
  if (isDescriptionHtml(raw)) {
    const plain = descriptionToPlainText(raw);
    if (!plain) return false;
    const lineCount = plain.split(/\n/).length;
    return plain.length > 260 || lineCount > 5;
  }
  const text = preprocessDescription(raw);
  if (!text) return false;
  const lineCount = text.split(/\n/).length;
  return text.length > 260 || lineCount > 5 || parseDescriptionBlocks(text).length > 4;
}

function appendRichDescriptionContent(containerEl, rawDescription, options) {
  const emptyText = (options && options.emptyText) || "No description provided.";
  const html = sanitizeDescriptionHtml(rawDescription);
  const plain = descriptionToPlainText(html);
  if (!plain) {
    const empty = document.createElement("p");
    empty.className = "roadmap-details-tooltip__empty";
    empty.textContent = emptyText;
    containerEl.appendChild(empty);
    return;
  }
  const rich = document.createElement("div");
  rich.className = "roadmap-details-tooltip__rich";
  rich.innerHTML = html;
  containerEl.appendChild(rich);
}

function appendFormattedDescriptionContent(containerEl, rawDescription, options) {
  if (!containerEl) return;
  if (isDescriptionHtml(rawDescription)) {
    appendRichDescriptionContent(containerEl, rawDescription, options);
    return;
  }
  const emptyText = (options && options.emptyText) || "No description provided.";
  const blocks = parseDescriptionBlocks(rawDescription);

  if (!blocks.length) {
    const empty = document.createElement("p");
    empty.className = "roadmap-details-tooltip__empty";
    empty.textContent = emptyText;
    containerEl.appendChild(empty);
    return;
  }

  blocks.forEach((block) => {
    if (block.type === "heading") {
      const heading = document.createElement("h4");
      heading.className = "roadmap-details-tooltip__heading";
      heading.textContent = block.text;
      containerEl.appendChild(heading);
      return;
    }

    if (block.type === "paragraph") {
      const paragraph = document.createElement("p");
      paragraph.className = "roadmap-details-tooltip__paragraph";
      paragraph.textContent = block.text;
      containerEl.appendChild(paragraph);
      return;
    }

    if (block.type === "ul" || block.type === "ol") {
      const list = document.createElement(block.type === "ol" ? "ol" : "ul");
      list.className = "roadmap-details-tooltip__list";
      block.items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
      containerEl.appendChild(list);
    }
  });
}

function buildRoadmapDetailsTooltip(options) {
  const titleLabel = (options && options.titleLabel) || "Roadmap details";
  const statusText = options && options.statusText ? String(options.statusText) : "";
  const rawDescription =
    options && options.rawDescription != null ? options.rawDescription : "";

  const tooltipEl = document.createElement("div");
  tooltipEl.className =
    "cell-type-tooltip cell-type-tooltip--wide cell-type-tooltip--roadmap-details";
  if (shouldDescriptionTooltipScroll(rawDescription)) {
    tooltipEl.classList.add("cell-type-tooltip--scroll");
  }
  tooltipEl.setAttribute("role", "tooltip");

  const titleEl = document.createElement("div");
  titleEl.className = "cell-type-tooltip-title";
  titleEl.textContent = titleLabel;
  tooltipEl.appendChild(titleEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "cell-type-tooltip-body roadmap-details-tooltip__body";

  if (statusText) {
    const meta = document.createElement("div");
    meta.className = "roadmap-details-tooltip__meta";
    const badge = document.createElement("span");
    badge.className = "roadmap-details-tooltip__status";
    badge.textContent = statusText;
    meta.appendChild(badge);
    bodyEl.appendChild(meta);
  }

  const content = document.createElement("div");
  content.className = "roadmap-details-tooltip__content";
  appendFormattedDescriptionContent(content, rawDescription);
  bodyEl.appendChild(content);

  tooltipEl.appendChild(bodyEl);

  bodyEl.addEventListener(
    "wheel",
    (e) => {
      e.stopPropagation();
    },
    { passive: true }
  );

  return tooltipEl;
}
