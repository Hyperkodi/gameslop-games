/* Armara Aegis in-memory profile-store adapter.
   Backs Node tests and the visible browser "Session Only" fallback. It implements the closed
   adapter contract consumed by storage-adapter.js and performs no validation of its own: the
   store layer validates every record before it arrives here and after it leaves.
   Deep copies cross the boundary in both directions so no caller can retain a live reference
   into the backing state. There is no wall clock, no global, and no randomness. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  const game = root.Game;
  if (!game) throw new Error("Game must exist before storage-memory.js");
  const api = factory();
  if (Object.prototype.hasOwnProperty.call(game, "AegisProfileStoreMemory")) {
    if (game.AegisProfileStoreMemory !== api) {
      throw new Error("Game.AegisProfileStoreMemory is already installed");
    }
    return;
  }
  Object.defineProperty(game, "AegisProfileStoreMemory", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ADAPTER_KIND = "session";
  const ADAPTER_CONTRACT_VERSION = 1;
  /* The four canonical object stores, in strict ASCII order. */
  const STORE_NAMES = Object.freeze(["journal", "profile", "replays", "results"]);
  const ADAPTER_METHODS = Object.freeze([
    "open", "readProfile", "readResults", "readReplay", "readJournal", "commit", "close",
  ]);
  const STABLE_ID = /^[a-z0-9][a-z0-9._:-]*$/;

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new Set();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.getOwnPropertyNames(value).forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        deepFreeze(descriptor.value, visited);
      }
    });
    return Object.freeze(value);
  }

  /* JSON round trip: the store layer only ever hands validated plain data across this seam. */
  function copyData(value) {
    if (value === null || value === undefined) return null;
    return JSON.parse(JSON.stringify(value));
  }

  function ok(value) {
    return deepFreeze({ ok: true, value: value === undefined ? null : value });
  }

  function failure(reason) {
    return deepFreeze({ ok: false, reason: reason, value: null });
  }

  function emptyState() {
    return { profile: null, results: new Map(), replays: new Map(), journal: [] };
  }

  function copyState(state) {
    return {
      profile: state.profile === null ? null : copyData(state.profile),
      results: new Map(Array.from(state.results.entries()).map(function (entry) {
        return [entry[0], copyData(entry[1])];
      })),
      replays: new Map(Array.from(state.replays.entries()).map(function (entry) {
        return [entry[0], copyData(entry[1])];
      })),
      journal: state.journal.map(copyData),
    };
  }

  function requireRecordArray(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    return value;
  }

  function keyOf(record, field, label) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError(label + " must be a plain object");
    }
    const key = record[field];
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError(label + " must carry a string " + field);
    }
    return key;
  }

  function asciiCompare(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }

  /* An in-memory adapter is one isolated namespace. Sharing one adapter between two store
     handles models two browser tabs over one database, which is how stale-revision writes
     are proven to fail closed. */
  function createMemoryAdapter(options) {
    const settings = options || {};
    if (settings.namespace !== undefined && settings.namespace !== null) {
      if (typeof settings.namespace !== "string" || !STABLE_ID.test(settings.namespace)) {
        throw new TypeError("Memory adapter namespace must be a stable lowercase ID");
      }
    }
    const namespace = settings.namespace === undefined || settings.namespace === null
      ? "session"
      : settings.namespace;

    let state = emptyState();
    let opened = false;
    let closed = false;

    function guard() {
      if (closed) return failure("closed");
      if (!opened) return failure("not-opened");
      return null;
    }

    async function open() {
      if (closed) return failure("closed");
      opened = true;
      return ok(null);
    }

    async function readProfile() {
      const blocked = guard();
      if (blocked) return blocked;
      return ok(state.profile === null ? null : copyData(state.profile));
    }

    async function readResults() {
      const blocked = guard();
      if (blocked) return blocked;
      const keys = Array.from(state.results.keys()).sort(asciiCompare);
      return ok(keys.map(function (key) { return copyData(state.results.get(key)); }));
    }

    async function readReplay(resultId) {
      const blocked = guard();
      if (blocked) return blocked;
      if (typeof resultId !== "string") return failure("invalid-key");
      const record = state.replays.get(resultId);
      return ok(record === undefined ? null : copyData(record));
    }

    async function readJournal() {
      const blocked = guard();
      if (blocked) return blocked;
      return ok(state.journal.map(copyData));
    }

    /* Atomic by construction: the next state is fully built before the single assignment,
       so a throw anywhere inside leaves the live state exactly as it was. */
    async function commit(plan) {
      const blocked = guard();
      if (blocked) return blocked;
      if (!plan || typeof plan !== "object" || Array.isArray(plan)) return failure("invalid-plan");
      let next;
      try {
        next = plan.replace === true ? emptyState() : copyState(state);
        if (plan.profile !== null && plan.profile !== undefined) {
          next.profile = copyData(plan.profile);
        }
        requireRecordArray(plan.results, "Commit results").forEach(function (record) {
          next.results.set(keyOf(record, "resultId", "Result record"), copyData(record));
        });
        requireRecordArray(plan.replays, "Commit replays").forEach(function (record) {
          next.replays.set(keyOf(record, "resultId", "Replay record"), copyData(record));
        });
        requireRecordArray(plan.journal, "Commit journal").forEach(function (record) {
          keyOf(record, "kind", "Journal record");
          next.journal.push(copyData(record));
        });
      } catch (error) {
        return failure("transaction-aborted");
      }
      state = next;
      return ok(null);
    }

    async function close() {
      closed = true;
      opened = false;
      return ok(null);
    }

    return deepFreeze({
      kind: ADAPTER_KIND,
      contractVersion: ADAPTER_CONTRACT_VERSION,
      namespace: namespace,
      storeNames: STORE_NAMES,
      open: open,
      readProfile: readProfile,
      readResults: readResults,
      readReplay: readReplay,
      readJournal: readJournal,
      commit: commit,
      close: close,
    });
  }

  return deepFreeze({
    ADAPTER_KIND: ADAPTER_KIND,
    ADAPTER_CONTRACT_VERSION: ADAPTER_CONTRACT_VERSION,
    ADAPTER_METHODS: ADAPTER_METHODS,
    STORE_NAMES: STORE_NAMES,
    createMemoryAdapter: createMemoryAdapter,
  });
});
