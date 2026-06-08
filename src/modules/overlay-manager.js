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

  function closeAllExcept(exceptIdOrIds) {
    if (isClosing) return;
    isClosing = true;
    const exceptSet = new Set();
    if (exceptIdOrIds != null) {
      const list = Array.isArray(exceptIdOrIds) ? exceptIdOrIds : [exceptIdOrIds];
      list.forEach((id) => {
        if (id != null && id !== "") exceptSet.add(id);
      });
    }
    try {
      closers.forEach((closeFn, id) => {
        if (exceptSet.has(id)) return;
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

  global.OverlayManager = {
    register,
    prepareOpen,
    closeAllExcept
  };
})(typeof window !== "undefined" ? window : this);
