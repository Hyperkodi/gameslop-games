/* Armara Aegis session-only profile store.
   The delivery shell prefers the durable adapters lane P1 installs as
   Game.AegisStorage*. When durable storage cannot be proven, this in-memory
   store keeps the run playable and the shell shows the visible
   "SESSION ONLY - PROGRESS WILL NOT BE SAVED" state (campaign spec 12.2).
   It implements the same async {ok, reason?, value?} contract. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  const game = root.Game = root.Game || {};
  if (!game || (typeof game !== "object" && typeof game !== "function")) {
    throw new Error("Cannot install the Aegis session store into a non-object Game namespace");
  }
  if (Object.prototype.hasOwnProperty.call(game, "AegisSessionStore")) {
    if (game.AegisSessionStore !== api) throw new Error("Conflicting Game.AegisSessionStore is already installed");
    return;
  }
  Object.defineProperty(game, "AegisSessionStore", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RECOVERY_SCHEMA_VERSION = 1;
  const MAX_RESULTS = 64;
  const NAMESPACE = /^aegis(?:-[a-z0-9-]+)?(?::[a-z0-9-]+)?$/;

  const SESSION_ONLY_NOTICE = Object.freeze({
    id: "session-only",
    tone: "warning",
    title: "SESSION ONLY - PROGRESS WILL NOT BE SAVED",
    detail: "This browser did not offer durable storage for Aegis. You can play and export a recovery file, "
      + "but victories, Laurels, and unlocks disappear when the page closes.",
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function ok(value) {
    return deepFreeze({ ok: true, value: value === undefined ? null : value });
  }

  function failed(reason) {
    return deepFreeze({ ok: false, reason: reason, value: null });
  }

  /* Mirrors lane P1's detectStorage(root): a truthful capability probe that
     never throws in a sandbox, a private window, or under file://. */
  function detectStorage(hostRoot) {
    const host = hostRoot || null;
    if (!host) return deepFreeze({ kind: "session", durable: false, reason: "no-host" });
    let protocol = null;
    try {
      protocol = host.location && typeof host.location.protocol === "string" ? host.location.protocol : null;
    } catch (error) { protocol = null; }
    if (protocol === "file:") {
      return deepFreeze({ kind: "session", durable: false, reason: "direct-file-boot" });
    }
    let hasIndexedDb = false;
    try { hasIndexedDb = Boolean(host.indexedDB); } catch (error) { hasIndexedDb = false; }
    if (!hasIndexedDb) return deepFreeze({ kind: "session", durable: false, reason: "no-indexeddb" });
    return deepFreeze({ kind: "indexeddb", durable: true, reason: null });
  }

  function openSessionProfileStore(options) {
    const input = options || {};
    const namespace = typeof input.namespace === "string" ? input.namespace : "aegis";
    if (!NAMESPACE.test(namespace)) throw new Error("Session store namespace must be Aegis-owned: " + namespace);
    let profile = input.profile === undefined || input.profile === null ? null : clone(input.profile);
    let closed = false;
    const journal = [];
    const results = [];
    const replays = new Map();

    function guard() {
      if (closed) throw new Error("The Aegis session store is closed");
    }

    return Object.freeze({
      kind: "session",
      durable: false,
      namespace: namespace,
      notice: SESSION_ONLY_NOTICE,
      readProfile: async function () {
        guard();
        return ok(profile === null ? null : deepFreeze(clone(profile)));
      },
      writeProfile: async function (nextProfile, journalEntry) {
        guard();
        if (!nextProfile || typeof nextProfile !== "object") return failed("invalid-profile");
        profile = clone(nextProfile);
        if (journalEntry !== undefined && journalEntry !== null) journal.push(clone(journalEntry));
        return ok(deepFreeze(clone(profile)));
      },
      commitVictory: async function (transactionRecord) {
        guard();
        if (!transactionRecord || typeof transactionRecord !== "object") return failed("invalid-transaction");
        const record = clone(transactionRecord);
        if (!record.profile || typeof record.profile !== "object") return failed("transaction-missing-profile");
        profile = clone(record.profile);
        if (record.result) {
          results.push(clone(record.result));
          while (results.length > MAX_RESULTS) results.shift();
        }
        if (record.replay && record.result && typeof record.result.resultId === "string") {
          replays.set(record.result.resultId, clone(record.replay));
        }
        if (record.journalEntry) journal.push(clone(record.journalEntry));
        return ok(deepFreeze({
          durable: false,
          profile: deepFreeze(clone(profile)),
          resultId: record.result && record.result.resultId ? record.result.resultId : null,
        }));
      },
      readResults: async function () {
        guard();
        return ok(deepFreeze(results.map(clone)));
      },
      readReplayReference: async function (resultId) {
        guard();
        if (!replays.has(resultId)) return failed("replay-not-retained");
        return ok(deepFreeze(clone(replays.get(resultId))));
      },
      exportRecovery: async function () {
        guard();
        return ok(deepFreeze({
          schemaVersion: RECOVERY_SCHEMA_VERSION,
          namespace: namespace,
          durable: false,
          profile: profile === null ? null : clone(profile),
          results: results.map(clone),
          journal: journal.map(clone),
        }));
      },
      importRecovery: async function (bundle) {
        guard();
        if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) return failed("invalid-bundle");
        if (bundle.schemaVersion !== RECOVERY_SCHEMA_VERSION) return failed("unsupported-recovery-schema");
        if (bundle.profile !== null && (!bundle.profile || typeof bundle.profile !== "object")) {
          return failed("invalid-bundle-profile");
        }
        profile = bundle.profile === null ? null : clone(bundle.profile);
        results.length = 0;
        (Array.isArray(bundle.results) ? bundle.results : []).forEach(function (record) {
          results.push(clone(record));
        });
        return ok(deepFreeze(profile === null ? null : clone(profile)));
      },
      close: async function () {
        closed = true;
        return ok(null);
      },
    });
  }

  /* Prefers lane P1's durable adapter when it is installed and its probe agrees;
     otherwise returns the honest session-only store. Never throws for a missing
     adapter: a shell that cannot save must still be playable. */
  async function openProfileStore(options) {
    const input = options || {};
    const namespace = input.namespace || "aegis";
    const durableFactory = input.adapterFactory ||
      (input.game && input.game.AegisStorage && input.game.AegisStorage.openProfileStore) || null;
    if (typeof durableFactory === "function") {
      try {
        const store = await durableFactory({ namespace: namespace, adapter: input.adapter || null });
        if (store && typeof store.readProfile === "function") return store;
      } catch (error) {
        /* fall through to the honest session-only store */
      }
    }
    return openSessionProfileStore({ namespace: namespace, profile: input.profile || null });
  }

  return deepFreeze({
    RECOVERY_SCHEMA_VERSION: RECOVERY_SCHEMA_VERSION,
    SESSION_ONLY_NOTICE: SESSION_ONLY_NOTICE,
    detectStorage: detectStorage,
    openProfileStore: openProfileStore,
    openSessionProfileStore: openSessionProfileStore,
  });
});
