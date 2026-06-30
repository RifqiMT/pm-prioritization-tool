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
  "S",
  "STRIKE",
  "DEL",
  "SUB",
  "SUP",
  "MARK",
  "H2",
  "H3",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "SPAN"
]);

const DESCRIPTION_ALLOWED_ALIGN = new Set(["left", "center", "right", "justify"]);

const DESCRIPTION_ALLOWED_BULLET_STYLES = new Set([
  "disc",
  "circle",
  "square",
  "dash",
  "check",
  "arrow",
  "diamond",
  "star"
]);

function isAllowedBulletStyle(value) {
  return DESCRIPTION_ALLOWED_BULLET_STYLES.has(String(value || "").trim());
}

function isSafeDescriptionColor(value) {
  const color = String(value || "").trim();
  if (!color) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return true;
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(color)) return true;
  return /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|0?\.\d+|1(\.0)?)\s*\)$/i.test(color);
}

function applySafeDescriptionStyle(el, tag) {
  const align = (el.style.textAlign || "").toLowerCase();
  const color = el.style.color;
  const backgroundColor = el.style.backgroundColor;
  el.removeAttribute("style");
  const blockTags = new Set(["P", "DIV", "LI", "H2", "H3", "BLOCKQUOTE"]);
  if (DESCRIPTION_ALLOWED_ALIGN.has(align) && blockTags.has(tag)) {
    el.style.textAlign = align;
  }
  if (isSafeDescriptionColor(color)) {
    el.style.color = color.trim();
  }
  if (isSafeDescriptionColor(backgroundColor)) {
    el.style.backgroundColor = backgroundColor.trim();
  }
}

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
  return /<\s*(p|div|br|ul|ol|li|strong|b|em|i|u|s|strike|del|sub|sup|mark|h2|h3|blockquote|span)\b/i.test(value);
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
          applySafeDescriptionStyle(el, tag);
        } else if (tag === "UL" && attr.name === "data-bullet-style" && isAllowedBulletStyle(attr.value)) {
          /* keep safe list marker */
        } else {
          el.removeAttribute(attr.name);
        }
      });
    }

    normalizeRichDescriptionStructure(root);

    return root.innerHTML.trim();
  } catch (err) {
    console.warn("sanitizeDescriptionHtml failed", err);
    return escapeDescriptionHtml(raw);
  }
}

function normalizeRichDescriptionStructure(root) {
  if (!root) return;

  root.querySelectorAll("h2, h3").forEach((heading) => {
    heading.querySelectorAll(":scope > p, :scope > div").forEach((block) => {
      while (block.firstChild) {
        heading.insertBefore(block.firstChild, block);
      }
      block.remove();
    });

    [...heading.querySelectorAll("br")].forEach((br) => {
      if (!br.nextSibling) br.remove();
    });

    if (!(heading.textContent || "").replace(/\u00a0/g, " ").trim()) {
      heading.remove();
    }
  });

  root.querySelectorAll("p").forEach((paragraph) => {
    if (paragraph.children.length !== 1) return;
    const child = paragraph.children[0];
    const childTag = child.tagName;
    if (childTag !== "STRONG" && childTag !== "B") return;
    const paragraphText = (paragraph.textContent || "").replace(/\s+/g, " ").trim();
    const childText = (child.textContent || "").replace(/\s+/g, " ").trim();
    if (!paragraphText || paragraphText !== childText) return;

    const heading = document.createElement("h2");
    heading.textContent = childText;
    paragraph.replaceWith(heading);
  });
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
        parts.push(`<h2>${escapeDescriptionHtml(block.text)}</h2>`);
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
