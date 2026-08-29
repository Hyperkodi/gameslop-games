"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Profile = require("../js/progression/profile-v2.js");
const Progression = require("../js/progression/progression.js");
const Migration = require("../js/progression/migration-v1-v2.js");
const Store = require("../js/progression/storage-adapter.js");
const Memory = require("../js/progression/storage-memory.js");

const MODULE_PATH = path.join(__dirname, "..", "js", "progression", "migration-v1-v2.js");
const IDENTITY = "candidate-v4";
const PROFILE_ID = "local:0123abcd-4567-89ab-cdef-0123456789ab";
const RECORD_KEY = "m01|strategos|sha256:" + "ab".repeat(32) + "|sha256:" + "cd".repeat(32) + "|assist-0";

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

function missionIdsThrough(missionId) {
  return Profile.MISSION_IDS.slice(0, Profile.MISSION_IDS.indexOf(missionId) + 1);
}

/* The §12.2 profile-v1 record, built from an explicit list of completed missions. */
function v1Record(completedMissionIds, overrides) {
  const missionProgress = {};
  (completedMissionIds || []).forEach(function (missionId) {
    missionProgress[missionId] = { completed: true, bestLaurelsOverall: 3, attempts: 2 };
  });
  return Object.assign({
    databaseVersion: 1,
    profileSchemaVersion: 1,
    profileId: PROFILE_ID,
    missionProgress: missionProgress,
    records: {
      [RECORD_KEY]: {
        bestScore: { value: 12000, replayId: "replay-score" },
        fastest: { ticks: 18320, replayId: "replay-time" },
        bestLaurels: { value: 3, replayId: "replay-laurels" },
      },
    },
    campaignUnlockIds: ["tower.hoplite", "modifier.reserve-1"],
    loadoutIds: ["sentinel", "chronos", "siege", "hoplite"],
    cosmeticSelectionIds: [],
    cachedEntitlements: [],
    settings: {},
    migrationJournal: [],
  }, overrides || {});
}

function migrate(record, journal, profile) {
  return Migration.migrateProfileV1ToV2({
    record: record,
    contentIdentity: IDENTITY,
    journal: journal === undefined ? null : journal,
    profile: profile === undefined ? null : profile,
  });
}

test("migration-v1-v2 publishes a frozen CommonJS and collision-safe browser UMD contract", () => {
  assertDeepFrozen(Migration);
  assert.equal(Migration.FROM_SCHEMA, 1);
  assert.equal(Migration.TO_SCHEMA, 2);
  assert.equal(Migration.V1_DATABASE_VERSION, 1);
  assert.deepEqual(Migration.MIGRATION_JOURNAL_FIELDS, ["fromSchema", "toSchema", "steps", "completed"]);
  assert.deepEqual(Migration.MIGRATION_STEP_FIELDS, ["index", "kind", "missionId", "done"]);
  assert.deepEqual(Migration.STEP_KINDS, ["apply-mission-first-clear", "create-profile"]);
  assert.deepEqual(Migration.REASONS, Migration.REASONS.slice().sort());

  const source = fs.readFileSync(MODULE_PATH, "utf8");
  const sandbox = { Game: { AegisProfileV2: Profile, AegisProgression: Progression } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: MODULE_PATH });
  assert.equal(typeof sandbox.Game.AegisProfileMigrationV1V2.migrateProfileV1ToV2, "function");
  assert.equal(Object.isFrozen(sandbox.Game.AegisProfileMigrationV1V2), true);
  const descriptor = Object.getOwnPropertyDescriptor(sandbox.Game, "AegisProfileMigrationV1V2");
  assert.equal(descriptor.writable, false);
  assert.equal(descriptor.configurable, false);
  assert.throws(() => vm.runInNewContext(source, sandbox, { filename: MODULE_PATH }), /already installed/);
  const foreign = {
    Game: { AegisProfileV2: Profile, AegisProgression: Progression, AegisProfileMigrationV1V2: {} },
  };
  foreign.globalThis = foreign;
  assert.throws(() => vm.runInNewContext(source, foreign, { filename: MODULE_PATH }), /already installed/);
  const missing = { Game: { AegisProfileV2: Profile } };
  missing.globalThis = missing;
  assert.throws(() => vm.runInNewContext(source, missing, { filename: MODULE_PATH }), /must be installed/);
});

test("validateProfileV1 accepts the campaign-expansion record and fails closed on drift", () => {
  const record = Migration.validateProfileV1(v1Record(["m01", "m02"]));
  assertDeepFrozen(record);
  assert.deepEqual(Object.keys(record).sort(), Migration.V1_RECORD_FIELDS.slice().sort());
  assert.deepEqual(Object.keys(record.missionProgress), ["m01", "m02"]);
  assert.equal(record.missionProgress.m01.bestLaurelsOverall, 3);
  assert.deepEqual(Object.keys(record.records), [RECORD_KEY]);

  const rejections = [
    [/must contain exactly/i, (value) => { value.extra = 1; }],
    [/must contain exactly/i, (value) => { delete value.settings; }],
    [/database version must be 1/i, (value) => { value.databaseVersion = 2; }],
    [/schema version must be 1/i, (value) => { value.profileSchemaVersion = 2; }],
    [/profile ID must be local/i, (value) => { value.profileId = "cloud:abc"; }],
    [/Unknown profile v1 mission progress key/i, (value) => { value.missionProgress.m99 = { completed: true, bestLaurelsOverall: 0, attempts: 0 }; }],
    [/must contain exactly/i, (value) => { value.missionProgress.m01.streak = 2; }],
    [/completed must be boolean/i, (value) => { value.missionProgress.m01.completed = 1; }],
    [/best Laurels must be between/i, (value) => { value.missionProgress.m01.bestLaurelsOverall = 4; }],
    [/attempts must be between/i, (value) => { value.missionProgress.m01.attempts = -1; }],
    [/Malformed profile v1 record key/i, (value) => { value.records["m01|story"] = value.records[RECORD_KEY]; delete value.records[RECORD_KEY]; }],
    [/must contain exactly/i, (value) => { delete value.records[RECORD_KEY].fastest; }],
    [/replay ID must be a stable ID/i, (value) => { value.records[RECORD_KEY].bestScore.replayId = "Replay Score"; }],
    [/must be unique/i, (value) => { value.campaignUnlockIds = ["tower.hoplite", "tower.hoplite"]; }],
    [/must be an array/i, (value) => { value.migrationJournal = {}; }],
    [/must be a plain object/i, (value) => { value.settings = []; }],
  ];
  rejections.forEach((entry) => {
    const candidate = v1Record(["m01", "m02"]);
    entry[1](candidate);
    assert.throws(() => Migration.validateProfileV1(candidate), entry[0]);
  });
});

test("planMigrationV1ToV2 describes exactly the steps a v1 record proves", () => {
  const empty = Migration.planMigrationV1ToV2(v1Record([]));
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.value.completedMissionIds, []);
  assert.deepEqual(empty.value.journal.steps, [
    { index: 0, kind: "create-profile", missionId: null, done: false },
  ]);
  assert.equal(empty.value.journal.completed, false);
  assertDeepFrozen(empty.value);

  const five = Migration.planMigrationV1ToV2(v1Record(missionIdsThrough("m05")));
  assert.deepEqual(five.value.completedMissionIds, ["m01", "m02", "m03", "m04", "m05"]);
  assert.deepEqual(five.value.journal.steps.map((step) => step.kind), [
    "create-profile",
    "apply-mission-first-clear",
    "apply-mission-first-clear",
    "apply-mission-first-clear",
    "apply-mission-first-clear",
    "apply-mission-first-clear",
  ]);
  assert.deepEqual(five.value.journal.steps.map((step) => step.missionId), [
    null, "m01", "m02", "m03", "m04", "m05",
  ]);
  /* Mission order is campaign order, not the key order of the v1 record. */
  const shuffled = v1Record([]);
  ["m03", "m01", "m05", "m02", "m04"].forEach((missionId) => {
    shuffled.missionProgress[missionId] = { completed: true, bestLaurelsOverall: 1, attempts: 1 };
  });
  assert.deepEqual(
    Migration.planMigrationV1ToV2(shuffled).value.completedMissionIds,
    ["m01", "m02", "m03", "m04", "m05"]
  );
});

test("migrating m01..m05 grants exactly those first-clear rewards and invents nothing", () => {
  const result = migrate(v1Record(missionIdsThrough("m05")));
  assert.equal(result.ok, true, result.reason);
  assertDeepFrozen(result);
  const profile = result.value.profile;

  assert.deepEqual(profile.completedMissionIds, ["m01", "m02", "m03", "m04", "m05"]);
  assert.deepEqual(result.value.grantIdsApplied, [
    "grant.campaign.reserve-1",
    "grant.defense-slots.5",
    "grant.defense.artemis",
    "grant.defense.hoplite",
    "grant.defense.oracle",
    "grant.protocol-slots.1",
    "grant.protocol.temporal-edict",
  ]);
  assert.deepEqual(
    profile.appliedGrantIds,
    Profile.INITIAL_APPLIED_GRANT_IDS.concat(result.value.grantIdsApplied).sort()
  );

  /* Nothing is invented: no Laurel identity, no mastery, no tempered branch, no Recon, no
     allocation, and no Protocol tier beyond the granted Tier 1. */
  assert.deepEqual(profile.earnedLaurelIds, []);
  assert.equal(Profile.getLaurelBudget(profile).available, 0);
  assert.equal(profile.reconTier, 0);
  assert.equal(profile.defenseMastery.every((record) => (
    !record.fielded && !record.tempered && !record.mastered && !record.strategosVictory &&
    record.specializationVictoryIds.length === 0
  )), true);
  assert.deepEqual(profile.specializationAccessIds, Profile.DEFAULT_SPECIALIZATION_IDS);
  assert.deepEqual(profile.protocolLoadout, []);
  assert.deepEqual(profile.relicLoadoutIds, []);
  assert.equal(profile.reinforcementId, null);
  profile.protocols.forEach((record) => {
    assert.equal(record.allocatedLaurels, 0);
    assert.equal(record.availableTier, record.granted ? 1 : 0);
  });
  assert.deepEqual(
    profile.protocols.filter((record) => record.granted).map((record) => record.id),
    ["temporal-edict"]
  );
  assert.equal(profile.defenseSlotCap, 5);
  assert.equal(profile.protocolSlotCap, 1);
  assert.deepEqual(result.value.repairs, []);

  /* An untouched v1 profile yields exactly a fresh v2 profile. */
  const none = migrate(v1Record([]));
  assert.deepEqual(clone(none.value.profile), clone(Profile.createProfileV2(IDENTITY)));
  assert.deepEqual(none.value.grantIdsApplied, []);
});

test("a v1 record claiming m07 without m06 fails closed and yields no profile", () => {
  const skipped = v1Record(missionIdsThrough("m05"));
  skipped.missionProgress.m07 = { completed: true, bestLaurelsOverall: 3, attempts: 1 };
  const result = migrate(skipped);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "non-linear-completion");
  assert.equal(result.value, null);
  assert.match(result.detail, /linear campaign prefix at m07/i);
  assert.equal(Migration.planMigrationV1ToV2(skipped).reason, "non-linear-completion");

  /* A gap anywhere in the sequence is refused, not repaired. */
  const gapAtStart = v1Record(["m02", "m03"]);
  assert.equal(migrate(gapAtStart).reason, "non-linear-completion");
  /* `completed: false` entries are simply not completions. */
  const declined = v1Record(["m01"]);
  declined.missionProgress.m02 = { completed: false, bestLaurelsOverall: 2, attempts: 9 };
  const partial = migrate(declined);
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.value.profile.completedMissionIds, ["m01"]);
});

test("an interrupted migration resumes from the last completed step", () => {
  const record = v1Record(missionIdsThrough("m05"));
  const full = migrate(clone(record));
  assert.equal(full.ok, true);

  /* Replay the first three journal steps only: create-profile, m01, m02. */
  let partial = Profile.createProfileV2(IDENTITY);
  partial = Progression.planApplyMissionFirstClear(partial, "m01").profile;
  partial = Progression.planApplyMissionFirstClear(partial, "m02").profile;
  const journal = clone(Migration.planMigrationV1ToV2(clone(record)).value.journal);
  journal.steps[0].done = true;
  journal.steps[1].done = true;
  journal.steps[2].done = true;

  const resumed = migrate(clone(record), clone(journal), clone(partial));
  assert.equal(resumed.ok, true, resumed.reason);
  assert.equal(resumed.value.resumedFromStep, 3);
  assert.equal(resumed.value.appliedStepCount, 3);
  assert.equal(resumed.value.changed, true);
  assert.equal(resumed.value.journal.completed, true);
  assert.equal(resumed.value.journal.steps.every((step) => step.done), true);
  assert.deepEqual(clone(resumed.value.profile), clone(full.value.profile));
  assert.deepEqual(resumed.value.grantIdsApplied, [
    "grant.campaign.reserve-1",
    "grant.defense-slots.5",
    "grant.defense.artemis",
    "grant.protocol-slots.1",
    "grant.protocol.temporal-edict",
  ]);

  /* Resuming from every possible interruption point converges on the same profile. */
  for (let doneCount = 1; doneCount <= journal.steps.length; doneCount += 1) {
    let staged = Profile.createProfileV2(IDENTITY);
    for (let step = 1; step < doneCount; step += 1) {
      staged = Progression.planApplyMissionFirstClear(staged, journal.steps[step].missionId).profile;
    }
    const stagedJournal = clone(Migration.planMigrationV1ToV2(clone(record)).value.journal);
    for (let step = 0; step < doneCount; step += 1) stagedJournal.steps[step].done = true;
    const attempt = migrate(clone(record), stagedJournal, clone(staged));
    assert.equal(attempt.ok, true, attempt.reason);
    assert.deepEqual(clone(attempt.value.profile), clone(full.value.profile));
  }
});

test("a completed migration re-runs as a byte-identical no-op", () => {
  const record = v1Record(missionIdsThrough("m05"));
  const first = migrate(clone(record));
  const again = migrate(clone(record), clone(first.value.journal), clone(first.value.profile));
  assert.equal(again.ok, true, again.reason);
  assert.equal(again.value.changed, false);
  assert.equal(again.value.appliedStepCount, 0);
  assert.deepEqual(again.value.grantIdsApplied, []);
  assert.deepEqual(clone(again.value.profile), clone(first.value.profile));
  assert.deepEqual(clone(again.value.journal), clone(first.value.journal));

  /* Running the whole migration a second time from scratch is also deterministic. */
  const rerun = migrate(clone(record));
  assert.deepEqual(clone(rerun.value.profile), clone(first.value.profile));
});

test("resume inputs that do not match the plan fail closed", () => {
  const record = v1Record(missionIdsThrough("m05"));
  const plan = Migration.planMigrationV1ToV2(clone(record));
  const journal = clone(plan.value.journal);
  journal.steps[0].done = true;
  const partial = Profile.createProfileV2(IDENTITY);

  assert.equal(migrate(clone(record), clone(journal), null).reason, "missing-partial-profile");
  assert.equal(migrate(clone(record), null, clone(partial)).reason, "unexpected-partial-profile");
  assert.equal(
    migrate(clone(record), clone(Migration.planMigrationV1ToV2(v1Record(["m01"])).value.journal), null).reason,
    "journal-mismatch"
  );
  assert.equal(
    migrate(clone(record), clone(journal), clone(Profile.createProfileV2("other-release"))).reason,
    "invalid-partial-profile"
  );
  const broken = clone(partial);
  broken.completedMissionIds = ["m02"];
  assert.equal(migrate(clone(record), clone(journal), broken).reason, "invalid-partial-profile");

  const outOfOrder = clone(plan.value.journal);
  outOfOrder.steps[2].done = true;
  assert.equal(migrate(clone(record), outOfOrder, clone(partial)).reason, "invalid-journal");
  const wrongSchema = clone(plan.value.journal);
  wrongSchema.fromSchema = 2;
  assert.equal(migrate(clone(record), wrongSchema, null).reason, "invalid-journal");
  const completedWithPending = clone(plan.value.journal);
  completedWithPending.completed = true;
  assert.equal(migrate(clone(record), completedWithPending, null).reason, "invalid-journal");
  const extraStepField = clone(plan.value.journal);
  extraStepField.steps[0].note = "x";
  assert.equal(migrate(clone(record), extraStepField, null).reason, "invalid-journal");
});

test("hostile v1 records and migration inputs are rejected before use", () => {
  assert.equal(migrate(null).reason, "invalid-v1-record");
  assert.equal(migrate([]).reason, "invalid-v1-record");
  assert.equal(Migration.migrateProfileV1ToV2(null).reason, "invalid-input");
  assert.equal(Migration.migrateProfileV1ToV2({ record: v1Record([]) }).reason, "invalid-input");
  assert.equal(
    Migration.migrateProfileV1ToV2({
      record: v1Record([]), contentIdentity: "Candidate V4", journal: null, profile: null,
    }).reason,
    "invalid-input"
  );

  let invoked = false;
  const withGetter = v1Record(["m01"]);
  Object.defineProperty(withGetter, "missionProgress", {
    enumerable: true,
    configurable: true,
    get() { invoked = true; throw new Error("must not run"); },
  });
  assert.equal(migrate(withGetter).reason, "invalid-v1-record");
  assert.equal(invoked, false);

  const cyclic = v1Record(["m01"]);
  cyclic.settings.self = cyclic;
  assert.equal(migrate(cyclic).reason, "invalid-v1-record");

  const polluted = v1Record(["m01"]);
  Object.defineProperty(polluted, "__proto__", {
    value: { polluted: true },
    enumerable: true,
    configurable: true,
    writable: true,
  });
  assert.equal(migrate(polluted).reason, "invalid-v1-record");
  assert.equal({}.polluted, undefined);

  const unsafe = v1Record(["m01"]);
  unsafe.missionProgress.m01.attempts = Number.MAX_SAFE_INTEGER + 2;
  assert.equal(migrate(unsafe).reason, "invalid-v1-record");
  const fractional = v1Record(["m01"]);
  fractional.records[RECORD_KEY].fastest.ticks = 1.5;
  assert.equal(migrate(fractional).reason, "invalid-v1-record");
});

test("a migrated profile persists through the store as one revision", async () => {
  const record = v1Record(missionIdsThrough("m05"));
  const migrated = migrate(clone(record));
  assert.equal(migrated.ok, true, migrated.reason);

  const adapter = Memory.createMemoryAdapter({ namespace: IDENTITY });
  const store = await Store.openProfileStore({ namespace: IDENTITY, adapter: adapter });
  const written = await store.writeProfile({
    schemaVersion: 2,
    contentIdentity: IDENTITY,
    baseRevision: 0,
    profile: clone(migrated.value.profile),
  }, {
    kind: "migrate-v1-v2",
    timestamp: 1700000000000,
    detail: { fromSchema: 1, toSchema: 2, appliedStepCount: migrated.value.appliedStepCount },
  });
  assert.equal(written.ok, true, written.reason);
  assert.equal(written.value.revision, 1);
  assert.deepEqual(written.value.repairs, [], "a migrated profile needs no reconciliation repair");

  const read = await store.readProfile();
  assert.deepEqual(read.value.profile, clone(migrated.value.profile));
  const bundle = await store.exportRecovery();
  assert.deepEqual(bundle.value.journal.map((entry) => entry.kind), ["migrate-v1-v2"]);
  assert.deepEqual(bundle.value.journal[0].detail, {
    fromSchema: 1, toSchema: 2, appliedStepCount: migrated.value.appliedStepCount,
  });
});
