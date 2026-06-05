/**
 * Pointer press feedback for Scrum / MoSCoW board cards (pairs with board-card-interaction.css).
 * Global: BoardCardInteraction
 */
const BoardCardInteraction = (function () {
  const CARD_SELECTOR = ".scrum-board-card, .moscow-board-card, .roadmaps-table-card";
  const SKIP_SELECTOR =
    ".scrum-board-card-actions, .moscow-board-card-actions, .roadmaps-table-card__select, .roadmaps-table-card__actions, .portfolio-card-move, .portfolio-card-move-select, button, a, input, select, textarea, label, .roadmap-field-tooltip-wrap, .cell-type-icon-wrap, .scrum-board-card-type-wrap, .board-card-metric-icon, .roadmaps-table-card__status-pill, .roadmaps-table-card__chip, .roadmaps-table-card__chip--more, .card-meta-with-tooltip, .card-title-with-tooltip, .cell-rice-with-tooltip, .cell-financial-with-tooltip, .cell-tshirt-with-tooltip, .cell-countries-with-tooltip, .cell-moscow-with-tooltip";

  /** @type {HTMLElement | null} */
  let pressedCard = null;

  function shouldSkipTarget(target) {
    return !!(target && target.closest && target.closest(SKIP_SELECTOR));
  }

  function getCardFromTarget(target) {
    if (!target || !target.closest) return null;
    if (shouldSkipTarget(target)) return null;
    const card = target.closest(CARD_SELECTOR);
    if (!card) return null;
    if (
      card.classList.contains("scrum-board-card--dragging") ||
      card.classList.contains("moscow-board-card--dragging")
    ) {
      return null;
    }
    return card;
  }

  function clearPressed() {
    if (!pressedCard) return;
    pressedCard.classList.remove("portfolio-board-card--pressed");
    pressedCard = null;
  }

  function setPressed(card) {
    if (pressedCard === card) return;
    clearPressed();
    if (!card) return;
    pressedCard = card;
    card.classList.add("portfolio-board-card--pressed");
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const card = getCardFromTarget(e.target);
    if (card) setPressed(card);
  }

  function onPointerUp() {
    clearPressed();
  }

  function bindContainer(container) {
    if (!container || container.dataset.boardCardInteraction === "1") return;
    container.dataset.boardCardInteraction = "1";
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("dragstart", clearPressed, true);
  }

  return {
    bindContainer,
    clearPressed
  };
})();
