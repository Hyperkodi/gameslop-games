/* Armara Aegis profile store: the closed contract shared by the IndexedDB and session
   adapters (ADR-005, spec §13.6).

   Every byte that reaches an adapter has passed Profile.validateProfileV2 (or
   Profile.reconcileProfileV2 with its repairs surfaced to the caller) and, for a victory,
   VictoryTransaction.validateVictoryTransaction, which re-derives the whole transaction from
   its own inputs. Every byte read back is re-validated before it is returned, so no caller
   ever sees unvalidated storage bytes.

   Records carry `schemaVersion: 2`, the release `contentIdentity`, and a monotonic integer
   `revision`. A write declares the `baseRevision` it was computed from; anything other than
   the stored revision fails closed with `stale-revision`, so two tabs cannot interleave a
   victory. Timestamps exist only on journal entries, are supplied by the caller, are never
   read by any validator, and never enter profile, result, replay, or bundle identity.

   The module has no wall clock, no randomness, and no globals. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./profile-v2.js"),
      require("./victory-transaction.js"),
      require("../sim/abi-v2.js")
    );
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisProfileV2 || !game.AegisVictoryTransaction || !game.AegisSimV2) {
    throw new Error(
      "Game.AegisProfileV2, AegisVictoryTransaction, and AegisSimV2 must be installed before storage-adapter.js"
    );
  }
  const api = factory(game.AegisProfileV2, game.AegisVictoryTransaction, game.AegisSimV2);
  if (Object.prototype.hasOwnProperty.call(game, "AegisProfileStore")) {
    if (game.AegisProfileStore !== api) throw new Error("Game.AegisProfileStore is already installed");
    return;
  }
  Object.defineProperty(game, "AegisProfileStore", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (Profile, VictoryTransaction, ABI) {
  "use strict";

  if (!Profile || !Object.isFrozen(Profile) || Profile.PROFILE_SCHEMA_VERSION !== 2) {
    throw new TypeError("A frozen Aegis profile-v2 contract is required");
  }
  if (!VictoryTransaction || !Object.isFrozen(VictoryTransaction) ||
      VictoryTransaction.TRANSACTION_SCHEMA_VERSION !== 2) {
    throw new TypeError("A frozen Aegis victory-transaction builder is required");
  }
  if (!ABI || !Object.isFrozen(ABI) || !ABI.DESCRIPTOR || ABI.DESCRIPTOR.version !== 2) {
    throw new TypeError("The frozen Aegis simulation ABI v2 is required");
  }

  const STORE_SCHEMA_VERSION = 2;
  const RECOVERY_BUNDLE_KIND = "aegis-profile-recovery";
  const ADAPTER_KINDS = Object.freeze(["indexeddb", "session"]);
  const ADAPTER_METHODS = Object.freeze([
    "open", "readProfile", "readResults", "readReplay", "readJournal", "commit", "close",
  ]);
  const STORE_METHODS = Object.freeze([
    "readProfile", "writeProfile", "commitVictory", "readResults", "readReplayReference",
    "exportRecovery", "importRecovery", "close",
  ]);
  /* Every reason the store can report. Callers switch on this closed set; adapters may not
     widen it, so an unrecognized adapter reason becomes `adapter-failed`. */
  const REASONS = Object.freeze([
    "adapter-failed",
    "closed",
    "content-identity-mismatch",
    "duplicate-result",
    "empty",
    "invalid-bundle",
    "invalid-journal-entry",
    "invalid-key",
    "invalid-profile",
    "invalid-transaction",
    "invalid-write",
    "not-found",
    "profile-mismatch",
    "quota-exceeded",
    "stale-revision",
    "transaction-aborted",
  ]);
  const PASSTHROUGH_REASONS = Object.freeze(["closed", "quota-exceeded", "transaction-aborted"]);
  const PROFILE_WRITE_FIELDS = Object.freeze([
    "schemaVersion", "contentIdentity", "baseRevision", "profile",
  ]);
  const PROFILE_RECORD_FIELDS = Object.freeze([
    "schemaVersion", "contentIdentity", "revision", "profile",
  ]);
  const RESULT_RECORD_FIELDS = Object.freeze([
    "schemaVersion", "contentIdentity", "revision", "resultId", "result",
  ]);
  const REPLAY_RECORD_FIELDS = Object.freeze([
    "schemaVersion", "contentIdentity", "revision", "resultId", "replayId", "envelope",
  ]);
  const JOURNAL_RECORD_FIELDS = Object.freeze([
    "schemaVersion", "contentIdentity", "revision", "sequence", "kind", "timestamp", "detail",
  ]);
  const RECOVERY_BUNDLE_FIELDS = Object.freeze([
    "schemaVersion", "kind", "contentIdentity", "revision", "profile", "results", "replays",
    "journal", "checksum",
  ]);
  const FORBIDDEN_KEYS = Object.freeze(["__proto__", "constructor", "prototype"]);
  const STABLE_ID = /^[a-z0-9][a-z0-9._:-]*$/;
  const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
  /* Explicit entity/string bounds for recovery import (campaign spec §12.2). */
  const BUNDLE_LIMITS = Object.freeze({
    maxDepth: 48,
    maxArrayLength: 4096,
    maxObjectFields: 64,
    maxNodes: 400000,
    maxStringLength: 4096,
  });
  const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;

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

  function asciiCompare(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }

  /* Bounded strict copy: plain dense trees of safe integers, strings, booleans, and null.
     Accessors, symbols, cycles, shared references, foreign prototypes, unsafe integers, and
     prototype-polluting keys are rejected before any value is read. */
  function strictDataCopy(value, label, limits) {
    const seen = new Set();
    let nodeCount = 0;

    function copy(current, depth, path) {
      nodeCount += 1;
      if (nodeCount > limits.maxNodes) throw new RangeError(label + " exceeds the strict-data node limit");
      if (current === null || typeof current === "boolean") return current;
      if (typeof current === "number") {
        if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
          throw new TypeError(path + " must contain only safe non-negative-zero integer data");
        }
        return current;
      }
      if (typeof current === "string") {
        if (current.length > limits.maxStringLength) {
          throw new RangeError(path + " exceeds the strict-data string limit");
        }
        return current;
      }
      if (!current || typeof current !== "object") {
        throw new TypeError(path + " contains an unsupported strict-data value");
      }
      if (depth > limits.maxDepth) throw new RangeError(label + " exceeds the strict-data depth limit");
      if (seen.has(current)) throw new TypeError(label + " cannot contain cycles or shared references");
      seen.add(current);
      if (Object.getOwnPropertySymbols(current).length !== 0) {
        throw new TypeError(path + " cannot contain symbol properties");
      }

      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) {
          throw new TypeError(path + " must be an ordinary array");
        }
        const lengthDescriptor = Object.getOwnPropertyDescriptor(current, "length");
        const length = lengthDescriptor && lengthDescriptor.value;
        if (!Number.isSafeInteger(length) || length < 0) {
          throw new TypeError(path + " must have an ordinary array length");
        }
        if (length > limits.maxArrayLength) {
          throw new RangeError(path + " exceeds the strict-data array length limit");
        }
        Object.getOwnPropertyNames(current).forEach(function (propertyName) {
          if (propertyName === "length") return;
          if (!/^(0|[1-9][0-9]*)$/.test(propertyName) || Number(propertyName) >= length) {
            throw new TypeError(path + " cannot contain extra array properties");
          }
        });
        const output = new Array(length);
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
              !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
            throw new TypeError(path + " must be a dense array of enumerable data elements");
          }
          output[index] = copy(descriptor.value, depth + 1, path + "[" + index + "]");
        }
        return output;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(path + " must be a plain object");
      }
      const names = Object.getOwnPropertyNames(current);
      if (names.length > limits.maxObjectFields) {
        throw new RangeError(path + " exceeds the strict-data object field limit");
      }
      const output = {};
      names.forEach(function (propertyName) {
        if (FORBIDDEN_KEYS.indexOf(propertyName) !== -1) {
          throw new TypeError(path + " contains the forbidden key " + propertyName);
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, propertyName);
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
            !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
          throw new TypeError(path + " must contain only enumerable data properties");
        }
        Object.defineProperty(output, propertyName, {
          value: copy(descriptor.value, depth + 1, path + "." + propertyName),
          writable: true,
          configurable: true,
          enumerable: true,
        });
      });
      return output;
    }

    return copy(value, 0, label);
  }

  function exactFields(value, fields, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const actual = Object.getOwnPropertyNames(value).sort(asciiCompare);
    const expected = fields.slice().sort(asciiCompare);
    if (actual.length !== expected.length || actual.some(function (field, index) {
      return field !== expected[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + fields.join(", "));
    }
  }

  function revisionOf(value, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < 0 || value > MAX_REVISION) {
      throw new RangeError(label + " must be a monotonic revision integer");
    }
    return value;
  }

  function stableId(value, label) {
    if (typeof value !== "string" || value.length > 128 || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase ID");
    }
    return value;
  }

  function sha256Id(value, label) {
    if (typeof value !== "string" || !SHA256_ID.test(value)) {
      throw new TypeError(label + " must be lowercase sha256:<64-hex>");
    }
    return value;
  }

  function canonicalSha256(value) {
    return "sha256:" + ABI.sha256Hex(ABI.canonicalEncode(value));
  }

  function detached(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function ok(value) {
    return deepFreeze({ ok: true, value: value === undefined ? null : value });
  }

  function failure(reason) {
    if (REASONS.indexOf(reason) === -1) throw new RangeError("Unknown profile store reason " + reason);
    return deepFreeze({ ok: false, reason: reason, value: null });
  }

  function adapterFailure(result) {
    const reason = result && typeof result.reason === "string" ? result.reason : "adapter-failed";
    return failure(PASSTHROUGH_REASONS.indexOf(reason) === -1 ? "adapter-failed" : reason);
  }

  /* Read-side validators. Any throw means the stored bytes are not a valid record; the caller
     receives a closed reason and never the bytes. */
  function readProfileRecord(record, contentIdentity) {
    exactFields(record, PROFILE_RECORD_FIELDS, "Stored profile record");
    if (record.schemaVersion !== STORE_SCHEMA_VERSION) {
      throw new RangeError("Stored profile record schema version must be 2");
    }
    const identity = stableId(record.contentIdentity, "Stored profile content identity");
    if (contentIdentity !== null && identity !== contentIdentity) {
      throw new RangeError("Stored profile content identity disagrees with the store");
    }
    const revision = revisionOf(record.revision, "Stored profile revision");
    const profile = Profile.validateProfileV2(record.profile);
    if (profile.contentIdentity !== identity) {
      throw new RangeError("Stored profile content identity disagrees with its record");
    }
    return {
      schemaVersion: STORE_SCHEMA_VERSION,
      contentIdentity: identity,
      revision: revision,
      profile: detached(profile),
    };
  }

  function readResultRecord(record, contentIdentity) {
    exactFields(record, RESULT_RECORD_FIELDS, "Stored result record");
    if (record.schemaVersion !== STORE_SCHEMA_VERSION) {
      throw new RangeError("Stored result record schema version must be 2");
    }
    const identity = stableId(record.contentIdentity, "Stored result content identity");
    if (contentIdentity !== null && identity !== contentIdentity) {
      throw new RangeError("Stored result content identity disagrees with the store");
    }
    const revision = revisionOf(record.revision, "Stored result revision");
    const result = VictoryTransaction.validateResultRecord(record.result);
    if (sha256Id(record.resultId, "Stored result ID") !== result.resultId) {
      throw new RangeError("Stored result key disagrees with its result record");
    }
    if (result.runAuthorization.profileContentIdentity !== identity) {
      throw new RangeError("Stored result run authorization disagrees with the store identity");
    }
    return {
      schemaVersion: STORE_SCHEMA_VERSION,
      contentIdentity: identity,
      revision: revision,
      resultId: result.resultId,
      result: detached(result),
    };
  }

  function readReplayRecord(record, contentIdentity) {
    exactFields(record, REPLAY_RECORD_FIELDS, "Stored replay record");
    if (record.schemaVersion !== STORE_SCHEMA_VERSION) {
      throw new RangeError("Stored replay record schema version must be 2");
    }
    const identity = stableId(record.contentIdentity, "Stored replay content identity");
    if (contentIdentity !== null && identity !== contentIdentity) {
      throw new RangeError("Stored replay content identity disagrees with the store");
    }
    const revision = revisionOf(record.revision, "Stored replay revision");
    const replay = VictoryTransaction.validateReplayRecord({
      replayId: record.replayId,
      envelope: record.envelope,
    });
    return {
      schemaVersion: STORE_SCHEMA_VERSION,
      contentIdentity: identity,
      revision: revision,
      resultId: sha256Id(record.resultId, "Stored replay result ID"),
      replayId: replay.replayId,
      envelope: detached(replay.envelope),
    };
  }

  function readJournalRecord(record, contentIdentity) {
    exactFields(record, JOURNAL_RECORD_FIELDS, "Stored journal record");
    if (record.schemaVersion !== STORE_SCHEMA_VERSION) {
      throw new RangeError("Stored journal record schema version must be 2");
    }
    const identity = stableId(record.contentIdentity, "Stored journal content identity");
    if (contentIdentity !== null && identity !== contentIdentity) {
      throw new RangeError("Stored journal content identity disagrees with the store");
    }
    const revision = revisionOf(record.revision, "Stored journal revision");
    const sequence = revisionOf(record.sequence, "Stored journal sequence");
    const entry = VictoryTransaction.validateJournalEntry({
      kind: record.kind,
      timestamp: record.timestamp,
      detail: record.detail,
    });
    return {
      schemaVersion: STORE_SCHEMA_VERSION,
      contentIdentity: identity,
      revision: revision,
      sequence: sequence,
      kind: entry.kind,
      timestamp: entry.timestamp,
      detail: entry.detail === null ? null : detached(entry.detail),
    };
  }

  /* One journal entry per write, so the journal sequence is exactly the revision it produced.
     The journal is the only place a caller-supplied timestamp is ever stored. */
  function journalRecordFor(contentIdentity, revision, entry) {
    return {
      schemaVersion: STORE_SCHEMA_VERSION,
      contentIdentity: contentIdentity,
      revision: revision,
      sequence: revision,
      kind: entry.kind,
      timestamp: entry.timestamp,
      detail: entry.detail === null ? null : detached(entry.detail),
    };
  }

  function recoveryBody(bundle) {
    return {
      schemaVersion: bundle.schemaVersion,
      kind: bundle.kind,
      contentIdentity: bundle.contentIdentity,
      revision: bundle.revision,
      profile: bundle.profile,
      results: bundle.results,
      replays: bundle.replays,
      journal: bundle.journal,
    };
  }

  function validateAdapter(adapter) {
    if (!adapter || typeof adapter !== "object") {
      throw new TypeError("A profile store adapter is required");
    }
    if (ADAPTER_KINDS.indexOf(adapter.kind) === -1) {
      throw new TypeError("A profile store adapter must declare kind indexeddb or session");
    }
    ADAPTER_METHODS.forEach(function (method) {
      if (typeof adapter[method] !== "function") {
        throw new TypeError("A profile store adapter must provide " + method + "()");
      }
    });
    return adapter;
  }

  /* Open one namespaced profile store over an adapter. Programmer errors throw; a backend
     that cannot open throws too, which is the delivery lane's cue to fall back to the visible
     Session Only adapter chosen by storage-indexeddb.js `detectStorage`. */
  async function openProfileStore(options) {
    const settings = options || {};
    const namespace = stableId(settings.namespace, "Profile store namespace");
    const adapter = validateAdapter(settings.adapter);
    const opened = await adapter.open();
    if (!opened || opened.ok !== true) {
      throw new Error(
        "Profile store adapter failed to open (" +
        (opened && opened.reason ? opened.reason : "unknown") + ")"
      );
    }

    let closed = false;

    async function loadProfileRecord() {
      const result = await adapter.readProfile();
      if (!result || result.ok !== true) return { failure: adapterFailure(result) };
      if (result.value === null || result.value === undefined) return { record: null };
      let record;
      try {
        record = readProfileRecord(strictDataCopy(result.value, "Stored profile record", BUNDLE_LIMITS), null);
      } catch (error) {
        return { failure: failure("invalid-profile") };
      }
      return { record: record };
    }

    async function readProfile() {
      if (closed) return failure("closed");
      const loaded = await loadProfileRecord();
      if (loaded.failure) return loaded.failure;
      if (loaded.record === null) return failure("empty");
      return ok(deepFreeze(loaded.record));
    }

    async function readResults() {
      if (closed) return failure("closed");
      const result = await adapter.readResults();
      if (!result || result.ok !== true) return adapterFailure(result);
      const raw = Array.isArray(result.value) ? result.value : [];
      let records;
      try {
        records = raw.map(function (record) {
          return readResultRecord(strictDataCopy(record, "Stored result record", BUNDLE_LIMITS), null);
        });
      } catch (error) {
        return failure("invalid-transaction");
      }
      records.sort(function (left, right) { return asciiCompare(left.resultId, right.resultId); });
      return ok(deepFreeze(records));
    }

    async function readReplayReference(resultId) {
      if (closed) return failure("closed");
      if (typeof resultId !== "string" || !SHA256_ID.test(resultId)) return failure("invalid-key");
      const result = await adapter.readReplay(resultId);
      if (!result || result.ok !== true) return adapterFailure(result);
      if (result.value === null || result.value === undefined) return failure("not-found");
      let record;
      try {
        record = readReplayRecord(strictDataCopy(result.value, "Stored replay record", BUNDLE_LIMITS), null);
      } catch (error) {
        return failure("invalid-transaction");
      }
      if (record.resultId !== resultId) return failure("invalid-transaction");
      return ok(deepFreeze(record));
    }

    async function writeProfile(profileWrite, journalEntry) {
      if (closed) return failure("closed");
      let write;
      let entry;
      try {
        write = strictDataCopy(profileWrite, "Profile write", BUNDLE_LIMITS);
        exactFields(write, PROFILE_WRITE_FIELDS, "Profile write");
        if (write.schemaVersion !== STORE_SCHEMA_VERSION) {
          throw new RangeError("Profile write schema version must be 2");
        }
        write.contentIdentity = stableId(write.contentIdentity, "Profile write content identity");
        write.baseRevision = revisionOf(write.baseRevision, "Profile write base revision");
      } catch (error) {
        return failure("invalid-write");
      }
      try {
        entry = VictoryTransaction.validateJournalEntry(journalEntry);
      } catch (error) {
        return failure("invalid-journal-entry");
      }

      let reconciliation;
      try {
        reconciliation = Profile.reconcileProfileV2(write.profile);
      } catch (error) {
        return failure("invalid-profile");
      }
      if (reconciliation.profile.contentIdentity !== write.contentIdentity) {
        return failure("content-identity-mismatch");
      }

      const loaded = await loadProfileRecord();
      if (loaded.failure) return loaded.failure;
      const current = loaded.record;
      if (current !== null && current.contentIdentity !== write.contentIdentity) {
        return failure("content-identity-mismatch");
      }
      const currentRevision = current === null ? 0 : current.revision;
      if (write.baseRevision !== currentRevision) return failure("stale-revision");
      const revision = currentRevision + 1;
      if (revision > MAX_REVISION) return failure("stale-revision");

      const committed = await adapter.commit({
        replace: false,
        profile: {
          schemaVersion: STORE_SCHEMA_VERSION,
          contentIdentity: write.contentIdentity,
          revision: revision,
          profile: detached(reconciliation.profile),
        },
        results: [],
        replays: [],
        journal: [journalRecordFor(write.contentIdentity, revision, entry)],
      });
      if (!committed || committed.ok !== true) return adapterFailure(committed);
      return ok(deepFreeze({
        revision: revision,
        contentIdentity: write.contentIdentity,
        profile: detached(reconciliation.profile),
        repairs: detached(reconciliation.repairs),
      }));
    }

    /* One transaction across profile, results, replays, and journal. The adapter aborts on any
       failure, so quota exhaustion leaves the previous revision fully intact. */
    async function commitVictory(transactionRecord) {
      if (closed) return failure("closed");
      let transaction;
      try {
        transaction = VictoryTransaction.validateVictoryTransaction(transactionRecord);
      } catch (error) {
        return failure("invalid-transaction");
      }

      const loaded = await loadProfileRecord();
      if (loaded.failure) return loaded.failure;
      const current = loaded.record;
      if (current === null) return failure("empty");
      if (current.contentIdentity !== transaction.contentIdentity) {
        return failure("content-identity-mismatch");
      }
      if (transaction.baseRevision !== current.revision) return failure("stale-revision");
      if (ABI.canonicalEncode(current.profile) !== ABI.canonicalEncode(transaction.profileBefore)) {
        return failure("profile-mismatch");
      }

      const existing = await adapter.readReplay(transaction.result.resultId);
      if (!existing || existing.ok !== true) return adapterFailure(existing);
      if (existing.value !== null && existing.value !== undefined) return failure("duplicate-result");

      const revision = current.revision + 1;
      if (revision > MAX_REVISION) return failure("stale-revision");
      const identity = transaction.contentIdentity;
      const committed = await adapter.commit({
        replace: false,
        profile: {
          schemaVersion: STORE_SCHEMA_VERSION,
          contentIdentity: identity,
          revision: revision,
          profile: detached(transaction.profileAfter),
        },
        results: [{
          schemaVersion: STORE_SCHEMA_VERSION,
          contentIdentity: identity,
          revision: revision,
          resultId: transaction.result.resultId,
          result: detached(transaction.result),
        }],
        replays: [{
          schemaVersion: STORE_SCHEMA_VERSION,
          contentIdentity: identity,
          revision: revision,
          resultId: transaction.result.resultId,
          replayId: transaction.replay.replayId,
          envelope: detached(transaction.replay.envelope),
        }],
        journal: [journalRecordFor(identity, revision, transaction.journalEntry)],
      });
      if (!committed || committed.ok !== true) return adapterFailure(committed);
      return ok(deepFreeze({
        revision: revision,
        contentIdentity: identity,
        profile: detached(transaction.profileAfter),
        resultId: transaction.result.resultId,
        replayId: transaction.replay.replayId,
        firstClear: transaction.plan.firstClear,
        laurelIdsAdded: detached(transaction.plan.laurelIdsAdded),
        grantIdsApplied: detached(transaction.plan.grantIdsApplied),
        repairs: detached(transaction.plan.repairs),
      }));
    }

    async function exportRecovery() {
      if (closed) return failure("closed");
      const loaded = await loadProfileRecord();
      if (loaded.failure) return loaded.failure;
      if (loaded.record === null) return failure("empty");
      const identity = loaded.record.contentIdentity;

      const resultsResult = await adapter.readResults();
      if (!resultsResult || resultsResult.ok !== true) return adapterFailure(resultsResult);
      const journalResult = await adapter.readJournal();
      if (!journalResult || journalResult.ok !== true) return adapterFailure(journalResult);

      let results;
      let replays;
      let journal;
      try {
        results = (Array.isArray(resultsResult.value) ? resultsResult.value : []).map(function (record) {
          return readResultRecord(strictDataCopy(record, "Stored result record", BUNDLE_LIMITS), identity);
        });
        journal = (Array.isArray(journalResult.value) ? journalResult.value : []).map(function (record) {
          return readJournalRecord(strictDataCopy(record, "Stored journal record", BUNDLE_LIMITS), identity);
        });
      } catch (error) {
        return failure("invalid-transaction");
      }
      results.sort(function (left, right) { return asciiCompare(left.resultId, right.resultId); });
      journal.sort(function (left, right) { return left.sequence - right.sequence; });

      replays = [];
      for (let index = 0; index < results.length; index += 1) {
        const replayResult = await adapter.readReplay(results[index].resultId);
        if (!replayResult || replayResult.ok !== true) return adapterFailure(replayResult);
        if (replayResult.value === null || replayResult.value === undefined) {
          return failure("not-found");
        }
        try {
          replays.push(readReplayRecord(
            strictDataCopy(replayResult.value, "Stored replay record", BUNDLE_LIMITS),
            identity
          ));
        } catch (error) {
          return failure("invalid-transaction");
        }
      }
      replays.sort(function (left, right) { return asciiCompare(left.resultId, right.resultId); });

      const bundle = {
        schemaVersion: STORE_SCHEMA_VERSION,
        kind: RECOVERY_BUNDLE_KIND,
        contentIdentity: identity,
        revision: loaded.record.revision,
        profile: loaded.record.profile,
        results: results,
        replays: replays,
        journal: journal,
        checksum: "",
      };
      bundle.checksum = canonicalSha256(recoveryBody(bundle));
      return ok(deepFreeze(bundle));
    }

    /* Dry run first: every record in the bundle is validated and its checksum recomputed
       before a single byte is written, and the write itself replaces all four stores in one
       transaction. A tampered bundle never reaches the adapter. */
    async function importRecovery(bundleValue) {
      if (closed) return failure("closed");
      let bundle;
      let profile;
      let results;
      let replays;
      let journal;
      try {
        bundle = strictDataCopy(bundleValue, "Recovery bundle", BUNDLE_LIMITS);
        exactFields(bundle, RECOVERY_BUNDLE_FIELDS, "Recovery bundle");
        if (bundle.schemaVersion !== STORE_SCHEMA_VERSION) {
          throw new RangeError("Recovery bundle schema version must be 2");
        }
        if (bundle.kind !== RECOVERY_BUNDLE_KIND) {
          throw new RangeError("Recovery bundle kind must be " + RECOVERY_BUNDLE_KIND);
        }
        const identity = stableId(bundle.contentIdentity, "Recovery bundle content identity");
        const revision = revisionOf(bundle.revision, "Recovery bundle revision");
        const checksum = sha256Id(bundle.checksum, "Recovery bundle checksum");
        if (!Array.isArray(bundle.results) || !Array.isArray(bundle.replays) ||
            !Array.isArray(bundle.journal)) {
          throw new TypeError("Recovery bundle collections must be arrays");
        }
        if (checksum !== canonicalSha256(recoveryBody(bundle))) {
          throw new RangeError("Recovery bundle checksum does not match its contents");
        }
        profile = Profile.validateProfileV2(bundle.profile);
        if (profile.contentIdentity !== identity) {
          throw new RangeError("Recovery bundle profile identity disagrees with its bundle");
        }
        results = bundle.results.map(function (record) { return readResultRecord(record, identity); });
        replays = bundle.replays.map(function (record) { return readReplayRecord(record, identity); });
        journal = bundle.journal.map(function (record) { return readJournalRecord(record, identity); });
        const resultIds = new Set(results.map(function (record) { return record.resultId; }));
        if (resultIds.size !== results.length) {
          throw new RangeError("Recovery bundle result IDs must be unique");
        }
        const replayIds = new Set(replays.map(function (record) { return record.resultId; }));
        if (replayIds.size !== replays.length) {
          throw new RangeError("Recovery bundle replay result IDs must be unique");
        }
        replays.forEach(function (record) {
          if (!resultIds.has(record.resultId)) {
            throw new RangeError("Recovery bundle replay references an absent result");
          }
        });
        results.forEach(function (record) {
          if (record.revision > revision) {
            throw new RangeError("Recovery bundle result revision exceeds the bundle revision");
          }
        });
        journal.forEach(function (record) {
          if (record.sequence > revision) {
            throw new RangeError("Recovery bundle journal sequence exceeds the bundle revision");
          }
        });
      } catch (error) {
        return failure("invalid-bundle");
      }

      const committed = await adapter.commit({
        replace: true,
        profile: {
          schemaVersion: STORE_SCHEMA_VERSION,
          contentIdentity: bundle.contentIdentity,
          revision: bundle.revision,
          profile: detached(profile),
        },
        results: results.map(detached),
        replays: replays.map(detached),
        journal: journal.map(detached),
      });
      if (!committed || committed.ok !== true) return adapterFailure(committed);
      return ok(deepFreeze({
        revision: bundle.revision,
        contentIdentity: bundle.contentIdentity,
        profile: detached(profile),
        resultCount: results.length,
        replayCount: replays.length,
        journalCount: journal.length,
      }));
    }

    async function close() {
      if (closed) return failure("closed");
      closed = true;
      const result = await adapter.close();
      if (!result || result.ok !== true) return adapterFailure(result);
      return ok(null);
    }

    return deepFreeze({
      kind: adapter.kind,
      namespace: namespace,
      schemaVersion: STORE_SCHEMA_VERSION,
      readProfile: readProfile,
      writeProfile: writeProfile,
      commitVictory: commitVictory,
      readResults: readResults,
      readReplayReference: readReplayReference,
      exportRecovery: exportRecovery,
      importRecovery: importRecovery,
      close: close,
    });
  }

  return deepFreeze({
    STORE_SCHEMA_VERSION: STORE_SCHEMA_VERSION,
    RECOVERY_BUNDLE_KIND: RECOVERY_BUNDLE_KIND,
    ADAPTER_KINDS: ADAPTER_KINDS,
    ADAPTER_METHODS: ADAPTER_METHODS,
    STORE_METHODS: STORE_METHODS,
    REASONS: REASONS,
    PROFILE_WRITE_FIELDS: PROFILE_WRITE_FIELDS,
    PROFILE_RECORD_FIELDS: PROFILE_RECORD_FIELDS,
    RESULT_RECORD_FIELDS: RESULT_RECORD_FIELDS,
    REPLAY_RECORD_FIELDS: REPLAY_RECORD_FIELDS,
    JOURNAL_RECORD_FIELDS: JOURNAL_RECORD_FIELDS,
    RECOVERY_BUNDLE_FIELDS: RECOVERY_BUNDLE_FIELDS,
    BUNDLE_LIMITS: BUNDLE_LIMITS,
    MAX_REVISION: MAX_REVISION,
    openProfileStore: openProfileStore,
  });
});
