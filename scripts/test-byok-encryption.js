/**
 * BYOK encryption round-trip (Web Crypto via Node 18+).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { TextEncoder, TextDecoder } = require("util");

const modulePath = path.join(__dirname, "..", "src", "modules", "byok-api-keys.js");
const code = fs.readFileSync(modulePath, "utf8");

const sandbox = {
  window: {},
  globalThis: {},
  crypto: require("crypto").webcrypto,
  TextEncoder,
  TextDecoder,
  console,
  localStorage: {
    _data: {},
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null;
    },
    setItem(key, value) {
      this._data[key] = String(value);
    },
    removeItem(key) {
      delete this._data[key];
    }
  },
  document: {
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.runInNewContext(code, sandbox, { filename: "byok-api-keys.js" });

const { ByokApiKeys } = sandbox;
if (!ByokApiKeys) {
  console.error("FAIL: ByokApiKeys not exported");
  process.exit(1);
}

async function run() {
  const sample = "gsk_test_roundtrip_key_12345";
  const envelope = await ByokApiKeys.encryptSecret(sample);
  if (!envelope || !envelope.iv || !envelope.data) {
    throw new Error("encryptSecret did not return envelope");
  }
  const plain = await ByokApiKeys.decryptSecret(envelope);
  if (plain !== sample) {
    throw new Error(`decrypt mismatch: expected "${sample}", got "${plain}"`);
  }

  const saved = await ByokApiKeys.saveKey("groq", sample);
  if (!saved.ok) throw new Error("saveKey failed");
  if (!ByokApiKeys.hasStoredKey("groq")) throw new Error("hasStoredKey should be true");
  const loaded = await ByokApiKeys.getStoredKey("groq");
  if (loaded !== sample) throw new Error("getStoredKey mismatch");

  await ByokApiKeys.clearKey("groq");
  if (ByokApiKeys.hasStoredKey("groq")) throw new Error("clearKey did not remove key");

  console.log("OK: BYOK encryption round-trip");
}

run().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
