/* Armara Aegis IndexedDB profile-store adapter.
   Implements the closed adapter contract consumed by storage-adapter.js over four object
   stores (journal, profile, replays, results) in one versioned database per release
   namespace. Every victory commit is a single readwrite transaction across all four stores:
   any request failure aborts the whole transaction, so a half-written unlock cannot exist.
   Quota exhaustion and aborts are reported as closed reasons, never thrown. The adapter
   validates nothing beyond record keys; storage-adapter.js owns validation on both sides.
   No wall clock, no randomness, no globals: the IndexedDB factory arrives as an argument. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  const game = root.Game;
  if (!game) throw new Error("Game must exist before storage-indexeddb.js");
  const api = factory();
  if (Object.prototype.hasOwnProperty.call(game, "AegisProfileStoreIndexedDb")) {
    if (game.AegisProfileStoreIndexedDb !== api) {
      throw new Error("Game.AegisProfileStoreIndexedDb is already installed");
    }
    return;
  }
  Object.defineProperty(game, "AegisProfileStoreIndexedDb", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ADAPTER_KIND = "indexeddb";
  const SESSION_KIND = "session";
  const ADAPTER_CONTRACT_VERSION = 1;
  const DATABASE_VERSION = 1;
  const DATABASE_PREFIX = "aegis-profile-v2";
  /* The four canonical object stores, in strict ASCII order. Every store uses out-of-line
     keys so a stored record is exactly the record the store layer validated. */
  const STORE_NAMES = Object.freeze(["journal", "profile", "replays", "results"]);
  const PROFILE_KEY = "profile";
  const STABLE_ID = /^[a-z0-9][a-z0-9._:-]*$/;
  const QUOTA_ERROR_NAMES = Object.freeze(["QuotaExceededError", "NS_ERROR_FILE_NO_DEVICE_SPACE"]);

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

  function isQuotaError(error) {
    if (!error) return false;
    const name = typeof error.name === "string" ? error.name : "";
    return QUOTA_ERROR_NAMES.indexOf(name) !== -1;
  }

  function databaseName(namespace) {
    if (typeof namespace !== "string" || !STABLE_ID.test(namespace)) {
      throw new TypeError("IndexedDB namespace must be a stable lowercase ID");
    }
    return DATABASE_PREFIX + ":" + namespace;
  }

  /* "indexeddb" only when a usable factory is actually reachable. A blocked or private-mode
     scope may throw on property access or expose a factory without open(); both fall back to
     the visible Session Only mode instead of failing the boot. */
  function detectStorage(rootValue) {
    if (!rootValue || (typeof rootValue !== "object" && typeof rootValue !== "function")) {
      return SESSION_KIND;
    }
    let factory = null;
    try {
      factory = rootValue.indexedDB;
    } catch (error) {
      return SESSION_KIND;
    }
    if (!factory || typeof factory.open !== "function") return SESSION_KIND;
    return ADAPTER_KIND;
  }

  function asciiCompare(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }

  function keyOf(record, field, label) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new TypeError(label + " must be a plain object");
    }
    const key = record[field];
    if (typeof key !== "string" && typeof key !== "number") {
      throw new TypeError(label + " must carry a string or integer " + field);
    }
    return key;
  }

  function createIndexedDbAdapter(options) {
    const settings = options || {};
    const namespace = settings.namespace;
    const name = databaseName(namespace);
    const version = settings.databaseVersion === undefined ? DATABASE_VERSION : settings.databaseVersion;
    if (!Number.isSafeInteger(version) || version < 1) {
      throw new TypeError("IndexedDB database version must be a positive safe integer");
    }
    const scope = settings.root;
    if (detectStorage(scope) !== ADAPTER_KIND) {
      throw new TypeError("An IndexedDB factory is required to create the IndexedDB adapter");
    }
    const factory = scope.indexedDB;

    let database = null;
    let closed = false;

    function guard() {
      if (closed) return failure("closed");
      if (database === null) return failure("not-opened");
      return null;
    }

    function open() {
      if (closed) return Promise.resolve(failure("closed"));
      if (database !== null) return Promise.resolve(ok(null));
      return new Promise(function (resolve) {
        let settled = false;
        function settle(result) {
          if (settled) return;
          settled = true;
          resolve(result);
        }
        let request;
        try {
          request = factory.open(name, version);
        } catch (error) {
          settle(failure(isQuotaError(error) ? "quota-exceeded" : "open-failed"));
          return;
        }
        request.onupgradeneeded = function () {
          const upgraded = request.result;
          STORE_NAMES.forEach(function (storeName) {
            if (!upgraded.objectStoreNames.contains(storeName)) {
              upgraded.createObjectStore(storeName);
            }
          });
        };
        request.onblocked = function () { settle(failure("open-blocked")); };
        request.onerror = function () {
          settle(failure(isQuotaError(request.error) ? "quota-exceeded" : "open-failed"));
        };
        request.onsuccess = function () {
          database = request.result;
          settle(ok(null));
        };
      });
    }

    /* One transaction, one outcome. Every request registers an error handler that records a
       quota failure and aborts the transaction, so no store can be left partially written. */
    function runTransaction(mode, work) {
      const blocked = guard();
      if (blocked) return Promise.resolve(blocked);
      return new Promise(function (resolve) {
        let settled = false;
        let quotaSeen = false;
        let transaction;
        function settle(result) {
          if (settled) return;
          settled = true;
          resolve(result);
        }
        function abort() {
          try {
            transaction.abort();
          } catch (error) {
            settle(failure(quotaSeen ? "quota-exceeded" : "transaction-aborted"));
          }
        }
        try {
          transaction = database.transaction(STORE_NAMES, mode);
        } catch (error) {
          return settle(failure(isQuotaError(error) ? "quota-exceeded" : "transaction-aborted"));
        }
        const collected = { value: null };
        function track(request, onSuccess) {
          request.onsuccess = function () {
            if (settled) return;
            try {
              if (onSuccess) onSuccess(request.result);
            } catch (error) {
              abort();
            }
          };
          request.onerror = function () {
            if (isQuotaError(request.error)) quotaSeen = true;
            abort();
          };
          return request;
        }
        transaction.onabort = function () {
          settle(failure(quotaSeen ? "quota-exceeded" : "transaction-aborted"));
        };
        transaction.onerror = function () {
          settle(failure(quotaSeen ? "quota-exceeded" : "transaction-aborted"));
        };
        transaction.oncomplete = function () { settle(ok(collected.value)); };
        try {
          work(transaction, track, collected);
        } catch (error) {
          if (isQuotaError(error)) quotaSeen = true;
          abort();
        }
      });
    }

    async function readProfile() {
      return runTransaction("readonly", function (transaction, track, collected) {
        track(transaction.objectStore("profile").get(PROFILE_KEY), function (value) {
          collected.value = value === undefined ? null : copyData(value);
        });
      });
    }

    async function readResults() {
      return runTransaction("readonly", function (transaction, track, collected) {
        track(transaction.objectStore("results").getAll(), function (values) {
          const records = Array.isArray(values) ? values.map(copyData) : [];
          records.sort(function (left, right) {
            return asciiCompare(String(left.resultId), String(right.resultId));
          });
          collected.value = records;
        });
      });
    }

    async function readReplay(resultId) {
      if (typeof resultId !== "string") return failure("invalid-key");
      return runTransaction("readonly", function (transaction, track, collected) {
        track(transaction.objectStore("replays").get(resultId), function (value) {
          collected.value = value === undefined ? null : copyData(value);
        });
      });
    }

    async function readJournal() {
      return runTransaction("readonly", function (transaction, track, collected) {
        track(transaction.objectStore("journal").getAll(), function (values) {
          const records = Array.isArray(values) ? values.map(copyData) : [];
          records.sort(function (left, right) { return left.sequence - right.sequence; });
          collected.value = records;
        });
      });
    }

    async function commit(plan) {
      if (!plan || typeof plan !== "object" || Array.isArray(plan)) return failure("invalid-plan");
      if (!Array.isArray(plan.results) || !Array.isArray(plan.replays) || !Array.isArray(plan.journal)) {
        return failure("invalid-plan");
      }
      return runTransaction("readwrite", function (transaction, track) {
        if (plan.replace === true) {
          STORE_NAMES.forEach(function (storeName) {
            track(transaction.objectStore(storeName).clear(), null);
          });
        }
        if (plan.profile !== null && plan.profile !== undefined) {
          track(transaction.objectStore("profile").put(copyData(plan.profile), PROFILE_KEY), null);
        }
        const results = transaction.objectStore("results");
        plan.results.forEach(function (record) {
          track(results.put(copyData(record), keyOf(record, "resultId", "Result record")), null);
        });
        const replays = transaction.objectStore("replays");
        plan.replays.forEach(function (record) {
          track(replays.put(copyData(record), keyOf(record, "resultId", "Replay record")), null);
        });
        const journal = transaction.objectStore("journal");
        plan.journal.forEach(function (record) {
          track(journal.put(copyData(record), keyOf(record, "sequence", "Journal record")), null);
        });
      });
    }

    async function close() {
      closed = true;
      if (database !== null) {
        try {
          database.close();
        } catch (error) {
          database = null;
          return ok(null);
        }
        database = null;
      }
      return ok(null);
    }

    return deepFreeze({
      kind: ADAPTER_KIND,
      contractVersion: ADAPTER_CONTRACT_VERSION,
      namespace: namespace,
      databaseName: name,
      databaseVersion: version,
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
    SESSION_KIND: SESSION_KIND,
    ADAPTER_CONTRACT_VERSION: ADAPTER_CONTRACT_VERSION,
    DATABASE_VERSION: DATABASE_VERSION,
    DATABASE_PREFIX: DATABASE_PREFIX,
    STORE_NAMES: STORE_NAMES,
    PROFILE_KEY: PROFILE_KEY,
    databaseName: databaseName,
    detectStorage: detectStorage,
    createIndexedDbAdapter: createIndexedDbAdapter,
  });
});
