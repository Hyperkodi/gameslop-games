"use strict";

/* IndexedDB adapter proofs plus the one shared profile-store contract table that both the
   session and IndexedDB adapters must satisfy. The IndexedDB double is hand written here so
   the suite stays dependency free; it models staged writes (nothing lands until oncomplete),
   abort semantics, onsuccess/onerror ordering, and injected quota failures. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi-v2.js");
const ReplayV2 = require("../js/sim/replay-v2.js");
const Profile = require("../js/progression/profile-v2.js");
const Progression = require("../js/progression/progression.js");
const VictoryTransaction = require("../js/progression/victory-transaction.js");
const Store = require("../js/progression/storage-adapter.js");
const Memory = require("../js/progression/storage-memory.js");
const IndexedDb = require("../js/progression/storage-indexeddb.js");

const MODULE_PATH = path.join(__dirname, "..", "js", "progression", "storage-indexeddb.js");
const NAMESPACE = "candidate-v4";
const RULESET_HASH = "sha256:" + "ab".repeat(32);
const FINAL_HASH = "cd".repeat(32);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* ---------------------------------------------------------------------------------------
   Hand-written IndexedDB double.
   --------------------------------------------------------------------------------------- */

function quotaError() {
  return { name: "QuotaExceededError", message: "The quota has been exceeded." };
}

function compareKeys(left, right) {
  const leftNumber = typeof left === "number";
  const rightNumber = typeof right === "number";
  if (leftNumber !== rightNumber) return leftNumber ? -1 : 1;
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

function createFakeIndexedDb(options) {
  const settings = options || {};
  const databases = new Map();
  const log = settings.log || [];
  const queue = [];
  let draining = false;

  function schedule(work) {
    queue.push(work);
    if (draining) return;
    draining = true;
    Promise.resolve().then(function () {
      while (queue.length > 0) {
        const next = queue.shift();
        next();
      }
      draining = false;
    });
  }

  function makeDatabaseHandle(state) {
    const handle = {
      name: state.name,
      get version() { return state.version; },
      objectStoreNames: {
        contains: function (name) { return state.stores.has(name); },
        get length() { return state.stores.size; },
      },
      createObjectStore: function (name) {
        if (state.stores.has(name)) throw new Error("Object store already exists: " + name);
        state.stores.set(name, new Map());
        return { name: name };
      },
      close: function () { state.closed = true; },
      transaction: function (storeNames, mode) {
        if (state.closed) throw { name: "InvalidStateError", message: "database closed" };
        const names = Array.from(storeNames);
        names.forEach(function (name) {
          if (!state.stores.has(name)) {
            throw { name: "NotFoundError", message: "unknown object store " + name };
          }
        });
        return makeTransaction(state, names, mode);
      },
    };
    return handle;
  }

  function makeTransaction(state, storeNames, mode) {
    const transaction = {
      mode: mode,
      pending: 0,
      finished: false,
      aborted: false,
      staged: new Map(),
      oncomplete: null,
      onabort: null,
      onerror: null,
    };

    function staged(name) {
      if (!transaction.staged.has(name)) {
        transaction.staged.set(name, new Map(state.stores.get(name)));
      }
      return transaction.staged.get(name);
    }

    function maybeFinish() {
      if (transaction.finished || transaction.pending > 0) return;
      schedule(function () {
        if (transaction.finished || transaction.pending > 0) return;
        transaction.finished = true;
        transaction.staged.forEach(function (records, name) {
          state.stores.set(name, records);
        });
        log.push("complete");
        if (typeof transaction.oncomplete === "function") {
          transaction.oncomplete({ target: transaction });
        }
      });
    }

    function runRequest(label, work) {
      const request = { result: undefined, error: null, onsuccess: null, onerror: null };
      transaction.pending += 1;
      schedule(function () {
        transaction.pending -= 1;
        if (transaction.finished) return;
        let value;
        let error = null;
        try {
          value = work();
        } catch (thrown) {
          error = thrown;
        }
        if (error !== null) {
          request.error = error;
          log.push(label + ":error");
          if (typeof request.onerror === "function") request.onerror({ target: request });
          else transaction.abort();
        } else {
          request.result = value;
          log.push(label + ":success");
          if (typeof request.onsuccess === "function") request.onsuccess({ target: request });
        }
        maybeFinish();
      });
      return request;
    }

    transaction.abort = function () {
      if (transaction.finished) throw { name: "InvalidStateError", message: "transaction finished" };
      transaction.finished = true;
      transaction.aborted = true;
      transaction.staged.clear();
      schedule(function () {
        log.push("abort");
        if (typeof transaction.onabort === "function") transaction.onabort({ target: transaction });
      });
    };

    transaction.objectStore = function (name) {
      if (storeNames.indexOf(name) === -1) {
        throw { name: "NotFoundError", message: "store not in transaction scope: " + name };
      }
      return {
        name: name,
        get: function (key) {
          return runRequest("get", function () {
            const records = transaction.staged.has(name) ? transaction.staged.get(name) : state.stores.get(name);
            const value = records.get(key);
            return value === undefined ? undefined : clone(value);
          });
        },
        getAll: function () {
          return runRequest("getAll", function () {
            const records = transaction.staged.has(name) ? transaction.staged.get(name) : state.stores.get(name);
            return Array.from(records.keys()).sort(compareKeys).map(function (key) {
              return clone(records.get(key));
            });
          });
        },
        put: function (value, key) {
          return runRequest("put", function () {
            if (mode !== "readwrite") throw { name: "ReadOnlyError", message: "read-only transaction" };
            if (typeof settings.failWrite === "function") {
              const failure = settings.failWrite({ store: name, key: key, value: value });
              if (failure) throw failure;
            }
            staged(name).set(key, clone(value));
            return key;
          });
        },
        clear: function () {
          return runRequest("clear", function () {
            if (mode !== "readwrite") throw { name: "ReadOnlyError", message: "read-only transaction" };
            staged(name).clear();
            return undefined;
          });
        },
      };
    };

    schedule(maybeFinish);
    return transaction;
  }

  return {
    databases: databases,
    log: log,
    open: function (name, version) {
      const request = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      };
      schedule(function () {
        if (settings.blocked === true) {
          if (typeof request.onblocked === "function") request.onblocked({ target: request });
          return;
        }
        if (settings.openError) {
          request.error = settings.openError;
          if (typeof request.onerror === "function") request.onerror({ target: request });
          return;
        }
        let state = databases.get(name);
        if (!state) {
          state = { name: name, version: 0, stores: new Map(), closed: false };
          databases.set(name, state);
        }
        state.closed = false;
        const handle = makeDatabaseHandle(state);
        request.result = handle;
        if (version > state.version) {
          state.version = version;
          if (typeof request.onupgradeneeded === "function") request.onupgradeneeded({ target: request });
        }
        if (typeof request.onsuccess === "function") request.onsuccess({ target: request });
      });
      return request;
    },
  };
}

/* ---------------------------------------------------------------------------------------
   Shared fixtures.
   --------------------------------------------------------------------------------------- */

function freshProfile() {
  return Profile.createProfileV2(NAMESPACE);
}

function startHeader(profile, overrides) {
  return Object.assign({
    formatVersion: 2,
    rulesetHash: RULESET_HASH,
    eventSchemaVersion: 2,
    missionId: "m01",
    difficultyId: "story",
    assist: false,
    seed: 11,
    loadoutIds: ["sentinel", "chronos", "siege"],
    loadoutSlotCap: 4,
    campaignModifierIds: [],
    accessGrantIds: [],
    tutorialUpgradeGateMode: "none",
    protocolLoadout: [],
    protocolSlotCap: 0,
    protocolAuthority: [],
    missionProtocolLoan: null,
    relicIds: [],
    relicSlotCap: 0,
    reinforcementId: null,
    specializationAccessIds: profile.specializationAccessIds.slice(),
  }, overrides || {});
}

function envelopeFor(header, overrides) {
  return Object.assign(clone(header), {
    inputs: [{ tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" }],
    checkpoints: [{ tick: 5, diagnosticHash: "fnv1a32:0badf00d" }],
    finalClaim: {
      outcome: "victory",
      score: 1200,
      laurels: 1,
      durationTicks: 10,
      finalStateHash: FINAL_HASH,
    },
  }, overrides || {});
}

function victoryFor(profile, revision, overrides) {
  const settings = overrides || {};
  const header = startHeader(profile, settings.header);
  return VictoryTransaction.createVictoryTransaction({
    profile: clone(profile),
    revision: revision,
    header: header,
    replayEnvelope: envelopeFor(header, settings.envelope),
    resultFacts: Object.assign({
      missionId: "m01",
      difficultyId: "story",
      completedObjectiveIds: ["victory"],
      defenseEvidence: [{ defenseId: "sentinel", highestLevel: 2, specializationIds: [] }],
    }, settings.resultFacts),
    contentIdentity: NAMESPACE,
    journalTimestamp: settings.journalTimestamp === undefined ? 1700000000000 : settings.journalTimestamp,
  });
}

function profileWrite(profile, baseRevision) {
  return {
    schemaVersion: 2,
    contentIdentity: NAMESPACE,
    baseRevision: baseRevision,
    profile: clone(profile),
  };
}

function journalEntry(kind, timestamp) {
  return { kind: kind, timestamp: timestamp, detail: null };
}

function fakeRoot(options) {
  return { indexedDB: createFakeIndexedDb(options) };
}

/* The one adapter table. Every contract test below runs against both entries. */
const ADAPTERS = [
  {
    label: "session",
    kind: "session",
    create: function () { return Memory.createMemoryAdapter({ namespace: NAMESPACE }); },
  },
  {
    label: "indexeddb",
    kind: "indexeddb",
    create: function () {
      return IndexedDb.createIndexedDbAdapter({ root: fakeRoot(), namespace: NAMESPACE });
    },
  },
];

/* ---------------------------------------------------------------------------------------
   Module contract.
   --------------------------------------------------------------------------------------- */

test("storage-indexeddb publishes a frozen CommonJS and collision-safe browser UMD contract", () => {
  assert.equal(Object.isFrozen(IndexedDb), true);
  assert.equal(IndexedDb.ADAPTER_KIND, "indexeddb");
  assert.equal(IndexedDb.SESSION_KIND, "session");
  assert.equal(IndexedDb.DATABASE_VERSION, 1);
  assert.deepEqual(IndexedDb.STORE_NAMES, ["journal", "profile", "replays", "results"]);
  assert.equal(Object.isFrozen(IndexedDb.STORE_NAMES), true);
  assert.equal(IndexedDb.databaseName("candidate-v4"), "aegis-profile-v2:candidate-v4");
  assert.throws(() => IndexedDb.databaseName("Candidate V4"), /stable lowercase ID/i);

  const source = fs.readFileSync(MODULE_PATH, "utf8");
  const sandbox = { Game: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: MODULE_PATH });
  assert.equal(typeof sandbox.Game.AegisProfileStoreIndexedDb.detectStorage, "function");
  assert.equal(Object.isFrozen(sandbox.Game.AegisProfileStoreIndexedDb), true);
  const descriptor = Object.getOwnPropertyDescriptor(sandbox.Game, "AegisProfileStoreIndexedDb");
  assert.equal(descriptor.writable, false);
  assert.equal(descriptor.configurable, false);
  assert.throws(() => vm.runInNewContext(source, sandbox, { filename: MODULE_PATH }), /already installed/);
  const foreign = { Game: { AegisProfileStoreIndexedDb: {} } };
  foreign.globalThis = foreign;
  assert.throws(() => vm.runInNewContext(source, foreign, { filename: MODULE_PATH }), /already installed/);
  const bare = {};
  bare.globalThis = bare;
  assert.throws(() => vm.runInNewContext(source, bare, { filename: MODULE_PATH }), /Game must exist/);
});

test("detectStorage falls back to the visible Session Only mode whenever IndexedDB is unusable", () => {
  assert.equal(IndexedDb.detectStorage(fakeRoot()), "indexeddb");
  assert.equal(IndexedDb.detectStorage({}), "session");
  assert.equal(IndexedDb.detectStorage(null), "session");
  assert.equal(IndexedDb.detectStorage(undefined), "session");
  assert.equal(IndexedDb.detectStorage("window"), "session");
  assert.equal(IndexedDb.detectStorage({ indexedDB: null }), "session");
  assert.equal(IndexedDb.detectStorage({ indexedDB: {} }), "session");

  /* Private-mode browsers can throw on the property access itself. */
  const hostile = {};
  Object.defineProperty(hostile, "indexedDB", {
    get() { throw new Error("blocked by policy"); },
    enumerable: true,
  });
  assert.equal(IndexedDb.detectStorage(hostile), "session");
  assert.throws(() => IndexedDb.createIndexedDbAdapter({ root: {}, namespace: NAMESPACE }), /IndexedDB factory/i);
});

test("createIndexedDbAdapter opens one versioned database holding the four canonical stores", async () => {
  const root = fakeRoot();
  const adapter = IndexedDb.createIndexedDbAdapter({ root: root, namespace: NAMESPACE });
  assert.equal(Object.isFrozen(adapter), true);
  assert.equal(adapter.kind, "indexeddb");
  assert.equal(adapter.databaseName, "aegis-profile-v2:candidate-v4");
  assert.equal(adapter.databaseVersion, 1);

  assert.deepEqual(await adapter.readProfile(), { ok: false, reason: "not-opened", value: null });
  assert.equal((await adapter.open()).ok, true);
  const state = root.indexedDB.databases.get("aegis-profile-v2:candidate-v4");
  assert.equal(state.version, 1);
  assert.deepEqual(Array.from(state.stores.keys()).sort(), ["journal", "profile", "replays", "results"]);
  assert.equal((await adapter.open()).ok, true, "opening twice is idempotent");
  assert.equal((await adapter.close()).ok, true);
  assert.deepEqual(await adapter.readProfile(), { ok: false, reason: "closed", value: null });

  const blocked = IndexedDb.createIndexedDbAdapter({ root: fakeRoot({ blocked: true }), namespace: NAMESPACE });
  assert.deepEqual(await blocked.open(), { ok: false, reason: "open-blocked", value: null });
  const failing = IndexedDb.createIndexedDbAdapter({
    root: fakeRoot({ openError: { name: "UnknownError" } }),
    namespace: NAMESPACE,
  });
  assert.deepEqual(await failing.open(), { ok: false, reason: "open-failed", value: null });
  await assert.rejects(
    Store.openProfileStore({ namespace: NAMESPACE, adapter: blocked }),
    /failed to open/i
  );
});

/* ---------------------------------------------------------------------------------------
   The shared contract table: identical expectations for both adapters.
   --------------------------------------------------------------------------------------- */

ADAPTERS.forEach((entry) => {
  test("profile store contract conformance (" + entry.label + ")", async () => {
    const adapter = entry.create();
    const store = await Store.openProfileStore({ namespace: NAMESPACE, adapter: adapter });
    assert.equal(Object.isFrozen(store), true);
    assert.equal(store.kind, entry.kind);
    assert.equal(store.namespace, NAMESPACE);
    assert.equal(store.schemaVersion, 2);
    Store.STORE_METHODS.forEach((method) => assert.equal(typeof store[method], "function"));

    assert.deepEqual(await store.readProfile(), { ok: false, reason: "empty", value: null });
    assert.deepEqual(await store.readResults(), { ok: true, value: [] });
    assert.deepEqual(await store.exportRecovery(), { ok: false, reason: "empty", value: null });

    const profile = freshProfile();
    const created = await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 10));
    assert.equal(created.ok, true);
    assert.equal(created.value.revision, 1);
    assert.deepEqual(created.value.repairs, []);
    assert.deepEqual(created.value.profile, clone(profile));

    const read = await store.readProfile();
    assert.equal(read.ok, true);
    assert.deepEqual(Object.keys(read.value).sort(), Store.PROFILE_RECORD_FIELDS.slice().sort());
    assert.equal(read.value.schemaVersion, 2);
    assert.equal(read.value.contentIdentity, NAMESPACE);
    assert.equal(read.value.revision, 1);
    assert.equal(Object.isFrozen(read.value), true);
    assert.equal(Object.isFrozen(read.value.profile), true);

    /* A second write based on the already-consumed revision fails closed. */
    assert.deepEqual(
      await store.writeProfile(profileWrite(profile, 0), journalEntry("write-profile", 11)),
      { ok: false, reason: "stale-revision", value: null }
    );

    const transaction = victoryFor(profile, 1);
    const committed = await store.commitVictory(clone(transaction));
    assert.equal(committed.ok, true, committed.reason);
    assert.equal(committed.value.revision, 2);
    assert.equal(committed.value.firstClear, true);
    assert.deepEqual(committed.value.laurelIdsAdded, ["m01:story:victory"]);
    assert.deepEqual(committed.value.profile.completedMissionIds, ["m01"]);

    const after = await store.readProfile();
    assert.equal(after.value.revision, 2);
    assert.deepEqual(after.value.profile, clone(transaction.profileAfter));

    const results = await store.readResults();
    assert.equal(results.ok, true);
    assert.equal(results.value.length, 1);
    assert.equal(results.value[0].resultId, transaction.result.resultId);
    assert.equal(results.value[0].revision, 2);
    assert.deepEqual(results.value[0].result, clone(transaction.result));
    assert.equal(Object.isFrozen(results.value[0]), true);

    const replay = await store.readReplayReference(transaction.result.resultId);
    assert.equal(replay.ok, true);
    assert.equal(replay.value.replayId, transaction.replay.replayId);
    assert.deepEqual(replay.value.envelope, clone(transaction.replay.envelope));
    assert.deepEqual(
      await store.readReplayReference("sha256:" + "00".repeat(32)),
      { ok: false, reason: "not-found", value: null }
    );
    assert.deepEqual(
      await store.readReplayReference("not-a-hash"),
      { ok: false, reason: "invalid-key", value: null }
    );

    /* Replaying the same transaction is refused: its base revision is already consumed. */
    assert.deepEqual(
      await store.commitVictory(clone(transaction)),
      { ok: false, reason: "stale-revision", value: null }
    );

    const bundle = await store.exportRecovery();
    assert.equal(bundle.ok, true);
    assert.deepEqual(Object.keys(bundle.value).sort(), Store.RECOVERY_BUNDLE_FIELDS.slice().sort());
    assert.equal(bundle.value.kind, Store.RECOVERY_BUNDLE_KIND);
    assert.equal(bundle.value.revision, 2);
    assert.equal(bundle.value.results.length, 1);
    assert.equal(bundle.value.replays.length, 1);
    assert.equal(bundle.value.journal.length, 2);
    assert.deepEqual(
      bundle.value.journal.map((record) => [record.sequence, record.kind, record.timestamp]),
      [[1, "create-profile", 10], [2, "commit-victory", 1700000000000]]
    );

    const imported = await store.importRecovery(clone(bundle.value));
    assert.equal(imported.ok, true, imported.reason);
    assert.equal(imported.value.revision, 2);
    assert.equal(imported.value.resultCount, 1);
    const reread = await store.exportRecovery();
    assert.equal(ABI.canonicalEncode(reread.value), ABI.canonicalEncode(bundle.value));

    assert.deepEqual(await store.close(), { ok: true, value: null });
    assert.deepEqual(await store.readProfile(), { ok: false, reason: "closed", value: null });
    assert.deepEqual(await store.readResults(), { ok: false, reason: "closed", value: null });
    assert.deepEqual(await store.commitVictory(clone(transaction)), { ok: false, reason: "closed", value: null });
  });
});

/* ---------------------------------------------------------------------------------------
   IndexedDB transactional behaviour.
   --------------------------------------------------------------------------------------- */

test("a victory commit is one atomic readwrite transaction across all four stores", async () => {
  const log = [];
  const root = fakeRoot({ log: log });
  const adapter = IndexedDb.createIndexedDbAdapter({ root: root, namespace: NAMESPACE });
  const store = await Store.openProfileStore({ namespace: NAMESPACE, adapter: adapter });
  const profile = freshProfile();
  await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1));

  log.length = 0;
  const transaction = victoryFor(profile, 1);
  const committed = await store.commitVictory(clone(transaction));
  assert.equal(committed.ok, true, committed.reason);

  /* One read transaction for the profile, one for the duplicate check, then one readwrite
     transaction whose four puts all settle before the single complete event. */
  assert.deepEqual(log, [
    "get:success", "complete",
    "get:success", "complete",
    "put:success", "put:success", "put:success", "put:success", "complete",
  ]);

  const state = root.indexedDB.databases.get(adapter.databaseName);
  assert.equal(state.stores.get("profile").size, 1);
  assert.equal(state.stores.get("results").size, 1);
  assert.equal(state.stores.get("replays").size, 1);
  assert.equal(state.stores.get("journal").size, 2);
  assert.equal(state.stores.get("profile").get("profile").revision, 2);
});

test("an injected QuotaExceededError aborts the whole victory and mutates nothing", async () => {
  const log = [];
  let armed = false;
  const root = fakeRoot({
    log: log,
    failWrite: function (context) {
      return armed && context.store === "replays" ? quotaError() : null;
    },
  });
  const adapter = IndexedDb.createIndexedDbAdapter({ root: root, namespace: NAMESPACE });
  const store = await Store.openProfileStore({ namespace: NAMESPACE, adapter: adapter });
  const profile = freshProfile();
  await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1));
  const before = await store.exportRecovery();

  armed = true;
  log.length = 0;
  const transaction = victoryFor(profile, 1);
  assert.deepEqual(
    await store.commitVictory(clone(transaction)),
    { ok: false, reason: "quota-exceeded", value: null }
  );
  assert.deepEqual(log.slice(-3), ["put:success", "put:error", "abort"]);

  armed = false;
  const state = root.indexedDB.databases.get(adapter.databaseName);
  assert.equal(state.stores.get("results").size, 0, "no result survived the abort");
  assert.equal(state.stores.get("replays").size, 0, "no replay survived the abort");
  assert.equal(state.stores.get("journal").size, 1, "no victory journal entry survived the abort");
  assert.equal(state.stores.get("profile").get("profile").revision, 1, "the profile revision is untouched");
  const after = await store.exportRecovery();
  assert.equal(ABI.canonicalEncode(after.value), ABI.canonicalEncode(before.value));

  /* The same transaction still commits once quota is available: nothing was half written. */
  const retried = await store.commitVictory(clone(transaction));
  assert.equal(retried.ok, true, retried.reason);
  assert.equal(retried.value.revision, 2);
});

test("a non-quota request failure surfaces as transaction-aborted with zero partial mutation", async () => {
  let armed = false;
  const root = fakeRoot({
    failWrite: function (context) {
      return armed && context.store === "journal"
        ? { name: "UnknownError", message: "backend fault" }
        : null;
    },
  });
  const adapter = IndexedDb.createIndexedDbAdapter({ root: root, namespace: NAMESPACE });
  const store = await Store.openProfileStore({ namespace: NAMESPACE, adapter: adapter });
  const profile = freshProfile();
  await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1));

  armed = true;
  assert.deepEqual(
    await store.commitVictory(clone(victoryFor(profile, 1))),
    { ok: false, reason: "transaction-aborted", value: null }
  );
  const state = root.indexedDB.databases.get(adapter.databaseName);
  assert.equal(state.stores.get("results").size, 0);
  assert.equal(state.stores.get("replays").size, 0);
  assert.equal(state.stores.get("journal").size, 1);
  assert.equal(state.stores.get("profile").get("profile").revision, 1);

  armed = false;
  const read = await store.readProfile();
  assert.equal(read.value.revision, 1);
  assert.deepEqual(read.value.profile, clone(profile));
});

test("a recovery import replaces all four stores in one transaction or none of them", async () => {
  const source = IndexedDb.createIndexedDbAdapter({ root: fakeRoot(), namespace: NAMESPACE });
  const sourceStore = await Store.openProfileStore({ namespace: NAMESPACE, adapter: source });
  const profile = freshProfile();
  await sourceStore.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1));
  await sourceStore.commitVictory(clone(victoryFor(profile, 1)));
  const bundle = (await sourceStore.exportRecovery()).value;

  let armed = false;
  const targetRoot = fakeRoot({
    failWrite: function (context) {
      return armed && context.store === "results" ? quotaError() : null;
    },
  });
  const target = IndexedDb.createIndexedDbAdapter({ root: targetRoot, namespace: NAMESPACE });
  const targetStore = await Store.openProfileStore({ namespace: NAMESPACE, adapter: target });

  armed = true;
  assert.deepEqual(
    await targetStore.importRecovery(clone(bundle)),
    { ok: false, reason: "quota-exceeded", value: null }
  );
  const state = targetRoot.indexedDB.databases.get(target.databaseName);
  assert.equal(state.stores.get("profile").size, 0);
  assert.equal(state.stores.get("results").size, 0);
  assert.equal(state.stores.get("replays").size, 0);
  assert.equal(state.stores.get("journal").size, 0);
  assert.deepEqual(await targetStore.readProfile(), { ok: false, reason: "empty", value: null });

  armed = false;
  assert.equal((await targetStore.importRecovery(clone(bundle))).ok, true);
  const restored = await targetStore.exportRecovery();
  assert.equal(ABI.canonicalEncode(restored.value), ABI.canonicalEncode(bundle));
});

test("stored bytes are re-validated on every read and corruption never reaches a caller", async () => {
  const root = fakeRoot();
  const adapter = IndexedDb.createIndexedDbAdapter({ root: root, namespace: NAMESPACE });
  const store = await Store.openProfileStore({ namespace: NAMESPACE, adapter: adapter });
  const profile = freshProfile();
  await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1));
  const transaction = victoryFor(profile, 1);
  await store.commitVictory(clone(transaction));

  const state = root.indexedDB.databases.get(adapter.databaseName);
  const stored = state.stores.get("profile").get("profile");
  stored.profile.completedMissionIds = ["m01", "m03"];
  assert.deepEqual(await store.readProfile(), { ok: false, reason: "invalid-profile", value: null });
  assert.deepEqual(await store.exportRecovery(), { ok: false, reason: "invalid-profile", value: null });
  stored.profile.completedMissionIds = ["m01"];
  assert.equal((await store.readProfile()).ok, true);

  const storedResult = state.stores.get("results").get(transaction.result.resultId);
  storedResult.result.score = 1201;
  assert.deepEqual(await store.readResults(), { ok: false, reason: "invalid-transaction", value: null });
  storedResult.result.score = 1200;
  assert.equal((await store.readResults()).ok, true);

  const storedReplay = state.stores.get("replays").get(transaction.result.resultId);
  storedReplay.envelope.seed = 99;
  assert.deepEqual(
    await store.readReplayReference(transaction.result.resultId),
    { ok: false, reason: "invalid-transaction", value: null }
  );
});

test("victory commits authored against another profile or release fail closed", async () => {
  const adapter = IndexedDb.createIndexedDbAdapter({ root: fakeRoot(), namespace: NAMESPACE });
  const store = await Store.openProfileStore({ namespace: NAMESPACE, adapter: adapter });
  const profile = freshProfile();
  const transaction = victoryFor(profile, 1);

  assert.deepEqual(await store.commitVictory(clone(transaction)), { ok: false, reason: "empty", value: null });
  await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1));

  const advanced = Progression.planApplyMissionFirstClear(profile, "m01").profile;
  await store.writeProfile(profileWrite(advanced, 1), journalEntry("write-profile", 2));
  assert.deepEqual(
    await store.commitVictory(clone(victoryFor(profile, 2))),
    { ok: false, reason: "profile-mismatch", value: null }
  );

  const otherRelease = Profile.createProfileV2("other-release");
  const otherStore = await Store.openProfileStore({
    namespace: NAMESPACE,
    adapter: IndexedDb.createIndexedDbAdapter({ root: fakeRoot(), namespace: NAMESPACE }),
  });
  await otherStore.writeProfile({
    schemaVersion: 2,
    contentIdentity: "other-release",
    baseRevision: 0,
    profile: clone(otherRelease),
  }, journalEntry("create-profile", 1));
  assert.deepEqual(
    await otherStore.commitVictory(clone(victoryFor(profile, 1))),
    { ok: false, reason: "content-identity-mismatch", value: null }
  );
});

test("a result already present is refused rather than rewritten", async () => {
  const adapter = IndexedDb.createIndexedDbAdapter({ root: fakeRoot(), namespace: NAMESPACE });
  const store = await Store.openProfileStore({ namespace: NAMESPACE, adapter: adapter });
  const profile = freshProfile();
  await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1));
  const transaction = victoryFor(profile, 1);
  assert.equal((await store.commitVictory(clone(transaction))).ok, true);

  /* Rewind the stored profile to the pre-victory bytes at the current revision: the base
     revision and profile now agree again, so only the stored result can refuse the write. */
  const bundle = clone((await store.exportRecovery()).value);
  bundle.profile = clone(profile);
  delete bundle.checksum;
  const checksum = "sha256:" + ABI.sha256Hex(ABI.canonicalEncode(bundle));
  bundle.checksum = checksum;
  assert.equal((await store.importRecovery(bundle)).ok, true);

  assert.deepEqual(
    await store.commitVictory(clone(victoryFor(profile, 2))),
    { ok: false, reason: "duplicate-result", value: null }
  );
});
