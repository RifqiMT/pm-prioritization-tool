/**
 * Profile password security (browser-only).
 * Uses Web Crypto PBKDF2-SHA256; never stores plaintext passwords.
 */
(function (global) {
  const MIN_PASSWORD_LENGTH = 4;
  const PBKDF2_ITERATIONS = 120000;
  const SALT_BYTE_LENGTH = 16;
  const HASH_PREFIX = "v1:";

  function generateSalt() {
    const bytes = new Uint8Array(SALT_BYTE_LENGTH);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function hexToBytes(hex) {
    const normalized = (hex || "").trim();
    if (!normalized || normalized.length % 2 !== 0) return new Uint8Array(0);
    const out = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  function timingSafeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  function isProfilePasswordProtected(profile) {
    return !!(
      profile &&
      typeof profile.passwordSalt === "string" &&
      profile.passwordSalt.length > 0 &&
      typeof profile.passwordHash === "string" &&
      profile.passwordHash.length > 0
    );
  }

  /**
   * @param {string} password
   * @param {string} confirm
   * @param {{ required?: boolean }} [options]
   * @returns {{ ok: boolean, password?: string, message?: string }}
   */
  function validatePasswordPair(password, confirm, options) {
    const required = !!(options && options.required);
    const pwd = (password || "").trim();
    const conf = (confirm || "").trim();

    if (!pwd && !conf) {
      if (required) {
        return { ok: false, message: "Password is required." };
      }
      return { ok: true, password: "" };
    }

    if (pwd !== conf) {
      return { ok: false, message: "Passwords do not match." };
    }

    if (pwd.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      };
    }

    return { ok: true, password: pwd };
  }

  async function hashProfilePassword(password, saltHex) {
    if (!password || !saltHex) {
      throw new Error("Password and salt are required for hashing.");
    }
    if (!global.crypto || !global.crypto.subtle) {
      throw new Error("Secure password hashing is not available in this browser.");
    }

    const enc = new TextEncoder();
    const salt = hexToBytes(saltHex);
    if (!salt.length) {
      throw new Error("Invalid password salt.");
    }

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const derived = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

    return HASH_PREFIX + bytesToHex(new Uint8Array(derived));
  }

  async function verifyProfilePassword(password, saltHex, storedHash) {
    if (!password || !saltHex || !storedHash) return false;
    try {
      const computed = await hashProfilePassword(password, saltHex);
      return timingSafeEqual(computed, storedHash);
    } catch (err) {
      console.error("Profile password verification failed:", err);
      return false;
    }
  }

  global.ProfileSecurity = {
    MIN_PASSWORD_LENGTH,
    generateSalt,
    hashProfilePassword,
    verifyProfilePassword,
    isProfilePasswordProtected,
    validatePasswordPair
  };
})(typeof window !== "undefined" ? window : globalThis);
