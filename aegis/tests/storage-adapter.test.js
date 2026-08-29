"use strict";

/* Adapter-agnostic profile-store proofs. The closed contract is exercised against both
   adapters from one table in tests/storage-indexeddb.test.js, where the hand-written
   IndexedDB double lives; this file proves the semantics that do not depend on a backend. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi-v2.js");
const Profile = require("../js/progression/profile-v2.js");
const Progression = require("../js/progression/progression.js");
const VictoryTransaction = require("../js/progression/victory-transaction.js");
const Store = require("../js/progression/storage-adapter.js");
const Memory = require("../js/progression/storage-memory.js");

const PROGRESSION_DIR = path.join(__dirname, "..", "js", "progression");
const STORE_MODULE_PATH = path.join(PROGRESSION_DIR, "storage-adapter.js");
const MEMORY_MODULE_PATH = path.join(PROGRESSION_DIR, "storage-memory.js");
const PERSISTENCE_MODULES = Object.freeze([
  "migration-v1-v2.js",
  "storage-adapter.js",
  "storage-indexeddb.js",
  "storage-memory.js",
  "victory-transaction.js",
]);
const NAMESPACE = "candidate-v4";
const RULESET_HASH = "sha256:" + "ab".repeat(32);
const FINAL_HASH = "cd".repeat(32);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDeepFrozen(value, seen) {
  if (!value || typeof value !== "object") return;
  const visited = seen || new Set();
  if (visited.has(value)) return;
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  Reflect.ownKeys(value).forEach(function (key) {
    assertDeepFrozen(value[key], visited);
  });
}

function freshProfile() {
  return Profile.createProfileV2(NAMESPACE);
}

function startHeader(profile) {
  return {
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
  };
}

function envelopeFor(header) {
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
  });
}

function victoryFor(profile, revision, journalTimestamp) {
  const header = startHeader(profile);
  return VictoryTransaction.createVictoryTransaction({
    profile: clone(profile),
    revision: revision,
    header: header,
    replayEnvelope: envelopeFor(header),
    resultFacts: {
      missionId: "m01",
      difficultyId: "story",
      completedObjectiveIds: ["victory"],
      defenseEvidence: [{ defenseId: "sentinel", highestLevel: 2, specializationIds: [] }],
    },
    contentIdentity: NAMESPACE,
    journalTimestamp: journalTimestamp === undefined ? 1700000000000 : journalTimestamp,
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

async function openMemoryStore(adapter) {
  const backing = adapter || Memory.createMemoryAdapter({ namespace: NAMESPACE });
  const store = await Store.openProfileStore({ namespace: NAMESPACE, adapter: backing });
  return { store: store, adapter: backing };
}

test("storage-adapter publishes a frozen CommonJS and collision-safe browser UMD contract", () => {
  assertDeepFrozen(Store);
  assert.equal(Store.STORE_SCHEMA_VERSION, 2);
  assert.equal(Store.RECOVERY_BUNDLE_KIND, "aegis-profile-recovery");
  assert.equal(typeof Store.openProfileStore, "function");
  assert.deepEqual(Store.ADAPTER_KINDS, ["indexeddb", "session"]);
  assert.deepEqual(Store.STORE_METHODS, [
    "readProfile", "writeProfile", "commitVictory", "readResults", "readReplayReference",
    "exportRecovery", "importRecovery", "close",
  ]);
  /* The reason set is closed and sorted: callers switch on it exhaustively. */
  assert.deepEqual(Store.REASONS, Store.REASONS.slice().sort());
  assert.deepEqual(Store.REASONS, [
    "adapter-failed", "closed", "content-identity-mismatch", "duplicate-result", "empty",
    "invalid-bundle", "invalid-journal-entry", "invalid-key", "invalid-profile",
    "invalid-transaction", "invalid-write", "not-found", "profile-mismatch",
    "quota-exceeded", "stale-revision", "transaction-aborted",
  ]);
  assert.deepEqual(Store.PROFILE_WRITE_FIELDS, [
    "schemaVersion", "contentIdentity", "baseRevision", "profile",
  ]);

  const source = fs.readFileSync(STORE_MODULE_PATH, "utf8");
  const sandbox = {
    Game: {
      AegisProfileV2: Profile,
      AegisVictoryTransaction: VictoryTransaction,
      AegisSimV2: ABI,
    },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: STORE_MODULE_PATH });
  assert.equal(typeof sandbox.Game.AegisProfileStore.openProfileStore, "function");
  assert.equal(Object.isFrozen(sandbox.Game.AegisProfileStore), true);
  const descriptor = Object.getOwnPropertyDescriptor(sandbox.Game, "AegisProfileStore");
  assert.equal(descriptor.writable, false);
  assert.equal(descriptor.configurable, false);
  assert.throws(() => vm.runInNewContext(source, sandbox, { filename: STORE_MODULE_PATH }), /already installed/);
  const foreign = {
    Game: {
      AegisProfileV2: Profile,
      AegisVictoryTransaction: VictoryTransaction,
      AegisSimV2: ABI,
      AegisProfileStore: {},
    },
  };
  foreign.globalThis = foreign;
  assert.throws(() => vm.runInNewContext(source, foreign, { filename: STORE_MODULE_PATH }), /already installed/);
  const missing = { Game: { AegisProfileV2: Profile } };
  missing.globalThis = missing;
  assert.throws(() => vm.runInNewContext(source, missing, { filename: STORE_MODULE_PATH }), /must be installed/);
});

test("storage-memory publishes a frozen CommonJS and collision-safe browser UMD contract", () => {
  assertDeepFrozen(Memory);
  assert.equal(Memory.ADAPTER_KIND, "session");
  assert.deepEqual(Memory.STORE_NAMES, ["journal", "profile", "replays", "results"]);
  assert.deepEqual(Memory.ADAPTER_METHODS, Store.ADAPTER_METHODS);

  const source = fs.readFileSync(MEMORY_MODULE_PATH, "utf8");
  const sandbox = { Game: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: MEMORY_MODULE_PATH });
  assert.equal(typeof sandbox.Game.AegisProfileStoreMemory.createMemoryAdapter, "function");
  assert.equal(Object.isFrozen(sandbox.Game.AegisProfileStoreMemory), true);
  const descriptor = Object.getOwnPropertyDescriptor(sandbox.Game, "AegisProfileStoreMemory");
  assert.equal(descriptor.writable, false);
  assert.equal(descriptor.configurable, false);
  assert.throws(() => vm.runInNewContext(source, sandbox, { filename: MEMORY_MODULE_PATH }), /already installed/);
  const bare = {};
  bare.globalThis = bare;
  assert.throws(() => vm.runInNewContext(source, bare, { filename: MEMORY_MODULE_PATH }), /Game must exist/);
});

test("openProfileStore refuses namespaces and adapters outside the closed contract", async () => {
  await assert.rejects(Store.openProfileStore(), /namespace must be a stable lowercase ID/i);
  await assert.rejects(
    Store.openProfileStore({ namespace: "Candidate V4", adapter: Memory.createMemoryAdapter({}) }),
    /namespace must be a stable lowercase ID/i
  );
  await assert.rejects(
    Store.openProfileStore({ namespace: NAMESPACE, adapter: null }),
    /adapter is required/i
  );
  await assert.rejects(
    Store.openProfileStore({ namespace: NAMESPACE, adapter: { kind: "cloud" } }),
    /kind indexeddb or session/i
  );
  const partial = { kind: "session" };
  Store.ADAPTER_METHODS.slice(0, 3).forEach((method) => { partial[method] = async () => ({ ok: true }); });
  await assert.rejects(
    Store.openProfileStore({ namespace: NAMESPACE, adapter: partial }),
    /must provide readReplay\(\)/
  );
  const refusing = { kind: "session" };
  Store.ADAPTER_METHODS.forEach((method) => { refusing[method] = async () => ({ ok: false, reason: "open-failed" }); });
  await assert.rejects(
    Store.openProfileStore({ namespace: NAMESPACE, adapter: refusing }),
    /failed to open \(open-failed\)/
  );
});

test("every profile write is validated and reconciled before a byte is persisted", async () => {
  const opened = await openMemoryStore();
  const store = opened.store;
  const profile = freshProfile();

  assert.deepEqual(
    await store.writeProfile(profileWrite({ schemaVersion: 2 }, 0), journalEntry("write-profile", 1)),
    { ok: false, reason: "invalid-profile", value: null }
  );
  assert.deepEqual(await store.readProfile(), { ok: false, reason: "empty", value: null });

  /* A profile whose ledger disagrees with its completions is repaired, and the repair is
     reported rather than silently swallowed. */
  const drifted = clone(profile);
  drifted.completedMissionIds = ["m01"];
  drifted.appliedGrantIds = [];
  const repaired = await store.writeProfile(profileWrite(drifted, 0), journalEntry("write-profile", 5));
  assert.equal(repaired.ok, true, repaired.reason);
  assert.deepEqual(
    repaired.value.repairs.map((entry) => entry.kind),
    ["rebuilt-applied-grant-ledger"]
  );
  assert.deepEqual(
    repaired.value.profile,
    clone(Profile.reconcileProfileV2(drifted).profile),
    "the reconciled bytes are what is stored"
  );
  assert.deepEqual((await store.readProfile()).value.profile, repaired.value.profile);

  /* The declared content identity must match the profile it carries and the store. */
  const mismatched = profileWrite(Profile.createProfileV2("other-release"), 1);
  assert.deepEqual(
    await store.writeProfile(mismatched, journalEntry("write-profile", 6)),
    { ok: false, reason: "content-identity-mismatch", value: null }
  );

  assert.deepEqual(
    await store.writeProfile(profileWrite(profile, 1), { kind: "Bad Kind", timestamp: 1, detail: null }),
    { ok: false, reason: "invalid-journal-entry", value: null }
  );
  assert.deepEqual(
    await store.writeProfile(profileWrite(profile, 1), { kind: "write-profile", timestamp: -1, detail: null }),
    { ok: false, reason: "invalid-journal-entry", value: null }
  );
  const extraField = profileWrite(profile, 1);
  extraField.revision = 1;
  assert.deepEqual(
    await store.writeProfile(extraField, journalEntry("write-profile", 7)),
    { ok: false, reason: "invalid-write", value: null }
  );
  assert.equal((await store.readProfile()).value.revision, 1, "no rejected write advanced the revision");
});

test("revisions are monotonic and a second handle on the same store cannot interleave", async () => {
  const adapter = Memory.createMemoryAdapter({ namespace: NAMESPACE });
  const first = (await openMemoryStore(adapter)).store;
  const second = (await openMemoryStore(adapter)).store;
  const profile = freshProfile();

  assert.equal((await first.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1))).value.revision, 1);
  /* Both handles read revision 1; only one of them may write revision 2. */
  assert.equal((await first.readProfile()).value.revision, 1);
  assert.equal((await second.readProfile()).value.revision, 1);

  const advanced = Progression.planApplyMissionFirstClear(profile, "m01").profile;
  assert.equal((await second.writeProfile(profileWrite(advanced, 1), journalEntry("write-profile", 2))).value.revision, 2);
  assert.deepEqual(
    await first.writeProfile(profileWrite(profile, 1), journalEntry("write-profile", 3)),
    { ok: false, reason: "stale-revision", value: null }
  );
  assert.deepEqual(
    await first.commitVictory(clone(victoryFor(profile, 1))),
    { ok: false, reason: "stale-revision", value: null }
  );
  const current = await first.readProfile();
  assert.equal(current.value.revision, 2);
  assert.deepEqual(current.value.profile, clone(advanced));

  /* A write from the future is refused just as firmly as one from the past. */
  assert.deepEqual(
    await first.writeProfile(profileWrite(advanced, 9), journalEntry("write-profile", 4)),
    { ok: false, reason: "stale-revision", value: null }
  );
});

test("timestamps live only on journal entries and never enter stored identity", async () => {
  const profile = freshProfile();
  const early = victoryFor(profile, 1, 1);
  const late = victoryFor(profile, 1, 1900000000000);
  assert.equal(early.result.resultId, late.result.resultId);
  assert.equal(early.replay.replayId, late.replay.replayId);
  assert.equal(early.journalEntry.timestamp, 1);
  assert.equal(late.journalEntry.timestamp, 1900000000000);

  const store = (await openMemoryStore()).store;
  await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 999));
  const committed = await store.commitVictory(clone(late));
  assert.equal(committed.ok, true, committed.reason);

  const bundle = (await store.exportRecovery()).value;
  assert.equal(JSON.stringify(bundle.profile).includes("timestamp"), false);
  bundle.results.forEach((record) => assert.equal(JSON.stringify(record).includes("timestamp"), false));
  bundle.replays.forEach((record) => assert.equal(JSON.stringify(record).includes("timestamp"), false));
  assert.deepEqual(bundle.journal.map((record) => record.timestamp), [999, 1900000000000]);

  /* Rewriting only the journal timestamps changes no identity and no checksum input beyond
     the journal itself, so the bundle checksum is the only thing that moves. */
  const shifted = clone(bundle);
  shifted.journal[0].timestamp = 1;
  const body = clone(shifted);
  delete body.checksum;
  shifted.checksum = "sha256:" + ABI.sha256Hex(ABI.canonicalEncode(body));
  const reimported = await store.importRecovery(shifted);
  assert.equal(reimported.ok, true, reimported.reason);
  assert.deepEqual((await store.readResults()).value[0].resultId, late.result.resultId);
});

test("recovery bundles round trip and every tampered field is refused", async () => {
  const store = (await openMemoryStore()).store;
  const profile = freshProfile();
  await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1));
  const transaction = victoryFor(profile, 1);
  await store.commitVictory(clone(transaction));
  const bundle = (await store.exportRecovery()).value;
  assertDeepFrozen(bundle);
  assert.equal((await store.importRecovery(clone(bundle))).ok, true);

  const tampered = [
    ["profile", (value) => { value.profile.reconTier = 3; }],
    ["revision", (value) => { value.revision = 99; }],
    ["contentIdentity", (value) => { value.contentIdentity = "other-release"; }],
    ["kind", (value) => { value.kind = "aegis-profile-backup"; }],
    ["schemaVersion", (value) => { value.schemaVersion = 3; }],
    ["result score", (value) => { value.results[0].result.score = 1201; }],
    ["result id", (value) => { value.results[0].resultId = "sha256:" + "00".repeat(32); }],
    ["replay envelope", (value) => { value.replays[0].envelope.seed = 99; }],
    ["journal sequence", (value) => { value.journal[0].sequence = 500; }],
    ["checksum", (value) => { value.checksum = "sha256:" + "00".repeat(32); }],
    ["extra field", (value) => { value.extra = 1; }],
    ["dropped field", (value) => { delete value.journal; }],
  ];
  for (let index = 0; index < tampered.length; index += 1) {
    const copy = clone(bundle);
    tampered[index][1](copy);
    const result = await store.importRecovery(copy);
    assert.deepEqual(
      result,
      { ok: false, reason: "invalid-bundle", value: null },
      "tampering with " + tampered[index][0] + " must be refused"
    );
  }
  /* The store still holds the untampered bundle after every refusal. */
  const survived = await store.exportRecovery();
  assert.equal(ABI.canonicalEncode(survived.value), ABI.canonicalEncode(bundle));

  /* A replay whose result was dropped leaves a dangling reference and is refused. */
  const dangling = clone(bundle);
  dangling.results = [];
  delete dangling.checksum;
  const body = clone(dangling);
  dangling.checksum = "sha256:" + ABI.sha256Hex(ABI.canonicalEncode(body));
  assert.deepEqual(
    await store.importRecovery(dangling),
    { ok: false, reason: "invalid-bundle", value: null }
  );
});

test("hostile inputs are rejected before any value is read", async () => {
  const store = (await openMemoryStore()).store;
  const profile = freshProfile();
  await store.writeProfile(profileWrite(profile, 0), journalEntry("create-profile", 1));
  const transaction = victoryFor(profile, 1);

  let invoked = false;
  const withGetter = profileWrite(profile, 1);
  Object.defineProperty(withGetter, "profile", {
    enumerable: true,
    configurable: true,
    get() { invoked = true; throw new Error("must not run"); },
  });
  assert.deepEqual(
    await store.writeProfile(withGetter, journalEntry("write-profile", 2)),
    { ok: false, reason: "invalid-write", value: null }
  );
  assert.equal(invoked, false);

  const cyclic = profileWrite(profile, 1);
  cyclic.profile.self = cyclic;
  assert.deepEqual(
    await store.writeProfile(cyclic, journalEntry("write-profile", 2)),
    { ok: false, reason: "invalid-write", value: null }
  );

  const polluted = profileWrite(profile, 1);
  Object.defineProperty(polluted, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
    writable: true,
  });
  assert.deepEqual(
    await store.writeProfile(polluted, journalEntry("write-profile", 2)),
    { ok: false, reason: "invalid-write", value: null }
  );
  assert.equal({}.polluted, undefined);

  const unsafe = profileWrite(profile, 1);
  unsafe.baseRevision = Number.MAX_SAFE_INTEGER + 2;
  assert.deepEqual(
    await store.writeProfile(unsafe, journalEntry("write-profile", 2)),
    { ok: false, reason: "invalid-write", value: null }
  );
  const fractional = profileWrite(profile, 1);
  fractional.baseRevision = 1.5;
  assert.deepEqual(
    await store.writeProfile(fractional, journalEntry("write-profile", 2)),
    { ok: false, reason: "invalid-write", value: null }
  );

  let victoryGetterInvoked = false;
  const hostileVictory = clone(transaction);
  Object.defineProperty(hostileVictory, "profileAfter", {
    enumerable: true,
    configurable: true,
    get() { victoryGetterInvoked = true; throw new Error("must not run"); },
  });
  assert.deepEqual(
    await store.commitVictory(hostileVictory),
    { ok: false, reason: "invalid-transaction", value: null }
  );
  assert.equal(victoryGetterInvoked, false);
  assert.deepEqual(await store.commitVictory(null), { ok: false, reason: "invalid-transaction", value: null });
  assert.deepEqual(await store.commitVictory([]), { ok: false, reason: "invalid-transaction", value: null });
  assert.deepEqual(await store.importRecovery(null), { ok: false, reason: "invalid-bundle", value: null });
  assert.deepEqual(await store.importRecovery("bundle"), { ok: false, reason: "invalid-bundle", value: null });

  assert.equal((await store.readProfile()).value.revision, 1, "nothing hostile advanced the store");
});

test("the memory adapter deep copies on both sides so callers cannot reach into storage", async () => {
  const adapter = Memory.createMemoryAdapter({ namespace: NAMESPACE });
  assert.equal(Object.isFrozen(adapter), true);
  assert.equal(adapter.kind, "session");
  assert.equal((await adapter.open()).ok, true);

  const record = {
    schemaVersion: 2,
    contentIdentity: NAMESPACE,
    revision: 1,
    profile: clone(freshProfile()),
  };
  assert.equal((await adapter.commit({ replace: false, profile: record, results: [], replays: [], journal: [] })).ok, true);
  record.profile.reconTier = 3;
  const read = await adapter.readProfile();
  assert.equal(read.value.profile.reconTier, 0, "mutating the caller's record cannot reach storage");
  assert.equal(Object.isFrozen(read.value.profile), true, "reads are handed back frozen");
  const second = await adapter.readProfile();
  assert.notEqual(second.value, read.value, "every read is a fresh copy, never the live record");
  assert.deepEqual(second.value, read.value);

  /* A malformed plan leaves the state exactly as it was. */
  assert.deepEqual(
    await adapter.commit({ replace: false, profile: null, results: [{}], replays: [], journal: [] }),
    { ok: false, reason: "transaction-aborted", value: null }
  );
  assert.equal((await adapter.readProfile()).value.revision, 1);
  assert.deepEqual(
    await adapter.commit(null),
    { ok: false, reason: "invalid-plan", value: null }
  );
  assert.equal((await adapter.close()).ok, true);
  assert.deepEqual(await adapter.commit({ replace: false, profile: null, results: [], replays: [], journal: [] }), {
    ok: false, reason: "closed", value: null,
  });
});

test("no progression persistence module reads the wall clock or a random source", () => {
  const forbidden = [
    /\bDate\b/,
    /Math\s*\.\s*random/,
    /performance\s*\.\s*now/,
    /process\s*\.\s*hrtime/,
    /crypto\s*\.\s*getRandomValues/,
    /\brequire\s*\(\s*["']node:/,
  ];
  PERSISTENCE_MODULES.forEach((name) => {
    const source = fs.readFileSync(path.join(PROGRESSION_DIR, name), "utf8");
    forbidden.forEach((pattern) => {
      assert.equal(
        pattern.test(source),
        false,
        name + " must not reference " + pattern
      );
    });
    /* Every module installs itself on Game with a collision-safe non-writable property. */
    assert.equal(/writable:\s*false/.test(source), true, name + " must install non-writable");
    assert.equal(/configurable:\s*false/.test(source), true, name + " must install non-configurable");
    assert.equal(/is already installed/.test(source), true, name + " must refuse a colliding install");
  });
});
