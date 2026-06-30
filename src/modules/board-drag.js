/**
 * Shared Scrum / MoSCoW board drag-and-drop visuals (desktop: floating preview + drop slot).
 * Classic script global: BoardDrag
 */
const BoardDrag = (function () {
  const EMPTY_DRAG_IMAGE = (function () {
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    return img;
  })();

  const CARD_SELECTORS = ".scrum-board-card, .moscow-board-card";

  /** @type {null | {
   *   card: HTMLElement,
   *   offsetX: number,
   *   offsetY: number,
   *   draggingClass: string,
   *   columnDragOverClass: string,
   *   preview: HTMLElement | null,
   *   legacyGhost: HTMLElement | null,
   *   activeColumn: HTMLElement | null,
   *   indicator: HTMLElement | null
   * }} */
  let session = null;

  function isDesktopEnhanced() {
    return document.documentElement.classList.contains("is-desktop-layout");
  }

  function begin(card, e, options) {
    end();
    if (!card || !e) return null;

    const rect = card.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    session = {
      card,
      offsetX,
      offsetY,
      draggingClass: options.draggingClass || "",
      columnDragOverClass: options.columnDragOverClass || "",
      preview: null,
      legacyGhost: null,
      activeColumn: null,
      indicator: null
    };

    if (session.draggingClass) card.classList.add(session.draggingClass);
    if (typeof BoardCardInteraction !== "undefined") BoardCardInteraction.clearPressed();
    document.documentElement.classList.add("board-drag-active");

    if (isDesktopEnhanced()) {
      const preview = card.cloneNode(true);
      preview.classList.add("board-drag-preview");
      preview.setAttribute("aria-hidden", "true");
      preview.removeAttribute("draggable");
      preview.style.width = rect.width + "px";
      preview.style.boxSizing = "border-box";
      document.body.appendChild(preview);
      session.preview = preview;
      movePointer(e.clientX, e.clientY);
      if (e.dataTransfer) {
        try {
          e.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0);
        } catch (err) {
          console.warn("BoardDrag: setDragImage failed", err);
        }
      }
    } else if (typeof options.createLegacyGhost === "function" && e.dataTransfer) {
      const legacy = options.createLegacyGhost(card, e.clientX, e.clientY);
      if (legacy && legacy.ghost) {
        session.legacyGhost = legacy.ghost;
        session.offsetX = legacy.offsetX;
        session.offsetY = legacy.offsetY;
        try {
          e.dataTransfer.setDragImage(legacy.ghost, legacy.offsetX, legacy.offsetY);
        } catch (err) {
          console.warn("BoardDrag: legacy setDragImage failed", err);
        }
      }
    }

    return session;
  }

  function movePointer(clientX, clientY) {
    if (!session || !session.preview) return;
    session.preview.style.left = clientX - session.offsetX + "px";
    session.preview.style.top = clientY - session.offsetY + "px";
  }

  function listCardsInContainer(cardsContainer, draggedCard) {
    if (!cardsContainer) return [];
    return Array.from(cardsContainer.querySelectorAll(CARD_SELECTORS)).filter(
      (node) => node !== draggedCard && !node.classList.contains("board-drag-preview")
    );
  }

  function computeDropIndex(cardsContainer, clientY, draggedCard) {
    const columnCards = listCardsInContainer(cardsContainer, draggedCard);
    if (!columnCards.length) return 0;
    const rect = cardsContainer.getBoundingClientRect();
    const y = clientY - rect.top;
    let dropIndex = columnCards.length;
    for (let i = 0; i < columnCards.length; i++) {
      const cardRect = columnCards[i].getBoundingClientRect();
      const cardMid = (cardRect.top + cardRect.bottom) / 2 - rect.top;
      if (y < cardMid) {
        dropIndex = i;
        break;
      }
    }
    return dropIndex;
  }

  function clearIndicator() {
    document.querySelectorAll(".board-drop-indicator").forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    if (session) session.indicator = null;
  }

  function showIndicator(cardsContainer, dropIndex, draggedCard) {
    if (!isDesktopEnhanced() || !cardsContainer) return;
    clearIndicator();
    const indicator = document.createElement("div");
    indicator.className = "board-drop-indicator";
    indicator.setAttribute("aria-hidden", "true");
    const cards = listCardsInContainer(cardsContainer, draggedCard);
    const idx = Math.max(0, Math.min(dropIndex, cards.length));
    if (idx >= cards.length) {
      cardsContainer.appendChild(indicator);
    } else {
      cardsContainer.insertBefore(indicator, cards[idx]);
    }
    if (session) session.indicator = indicator;
  }

  function setColumnHighlight(column, enabled) {
    if (!session || !session.columnDragOverClass) return;
    const cls = session.columnDragOverClass;
    if (enabled && column) {
      if (session.activeColumn && session.activeColumn !== column) {
        session.activeColumn.classList.remove(cls);
      }
      column.classList.add(cls);
      session.activeColumn = column;
      return;
    }
    if (column && session.activeColumn === column) {
      column.classList.remove(cls);
      session.activeColumn = null;
    }
  }

  function clearColumnHighlights(root) {
    const scope = root || document;
    scope
      .querySelectorAll(".scrum-board-column--drag-over, .moscow-board-column--drag-over")
      .forEach((col) => {
        col.classList.remove("scrum-board-column--drag-over", "moscow-board-column--drag-over");
      });
  }

  function end() {
    if (!session) return;
    const { card, draggingClass, legacyGhost, preview, activeColumn, columnDragOverClass } = session;
    if (card && draggingClass) card.classList.remove(draggingClass);
    if (legacyGhost && legacyGhost.parentNode) legacyGhost.parentNode.removeChild(legacyGhost);
    if (preview && preview.parentNode) preview.parentNode.removeChild(preview);
    if (activeColumn && columnDragOverClass) activeColumn.classList.remove(columnDragOverClass);
    clearIndicator();
    document.documentElement.classList.remove("board-drag-active");
    session = null;
  }

  function getSession() {
    return session;
  }

  return {
    begin,
    movePointer,
    computeDropIndex,
    showIndicator,
    clearIndicator,
    setColumnHighlight,
    clearColumnHighlights,
    end,
    getSession
  };
})();
