/**
 * Ensures only one popup/overlay is open at a time (modals, sheets, dropdowns, menus).
 */
(function (global) {
  const closers = new Map();
  let isClosing = false;

  function register(id, closeFn) {
    if (!id || typeof closeFn !== "function") return;
    closers.set(id, closeFn);
  }

  function closeAllExcept(exceptId) {
    if (isClosing) return;
    isClosing = true;
    try {
      closers.forEach((closeFn, id) => {
        if (exceptId != null && id === exceptId) return;
        try {
          closeFn();
        } catch (err) {
          console.warn("OverlayManager: failed to close", id, err);
        }
      });
    } finally {
      isClosing = false;
    }
  }

  function prepareOpen(id) {
    closeAllExcept(id);
  }

  function closeAll() {
    closeAllExcept(null);
  }

  global.OverlayManager = {
    register,
    prepareOpen,
    closeAllExcept,
    closeAll
  };
})(typeof window !== "undefined" ? window : this);
