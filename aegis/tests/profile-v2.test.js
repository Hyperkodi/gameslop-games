"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const MODULE_PATH = path.join(__dirname, "..", "js", "progression", "profile-v2.js");
const Profile = require(MODULE_PATH);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function prefix(throughMissionId) {
  return Profile.MISSION_IDS.slice(0, Profile.MISSION_IDS.indexOf(throughMissionId) + 1);
}

function profileWithEvidence(earnedLaurelIds, completedMissionIds) {
  const source = clone(Profile.createProfileV2("candidate-v4"));
  source.earnedLaurelIds = earnedLaurelIds.slice();
  source.completedMissionIds = (completedMissionIds || []).slice().sort();
  return clone(Profile.reconcileProfileV2(source).profile);
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

test("profile-v2 publishes a frozen CommonJS and browser UMD contract", () => {
  assertDeepFrozen(Profile);
  assert.equal(Profile.PROFILE_SCHEMA_VERSION, 2);
  assert.equal(Profile.PROTOCOL_IDS.length, 10);
  assert.equal(Profile.RELIC_IDS.length, 8);
  assert.equal(Profile.REINFORCEMENT_IDS.length, 3);
  assert.equal(Profile.DEFENSE_IDS.length, 15);
  assert.equal(Profile.LAUREL_IDS.length, 180);

  const source = fs.readFileSync(MODULE_PATH, "utf8");
  const sandbox = { Game: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: MODULE_PATH });
  assert.equal(typeof sandbox.Game.AegisProfileV2.createProfileV2, "function");
  assert.equal(Object.isFrozen(sandbox.Game.AegisProfileV2), true);
});

test("createProfileV2 returns the exact closed, sparse, deeply frozen profile", () => {
  assert.throws(() => Profile.createProfileV2(), /explicit stable content identity/i);
  const profile = Profile.createProfileV2("candidate-v4");
  assert.deepEqual(Object.keys(profile), [
    "schemaVersion",
    "contentIdentity",
    "completedMissionIds",
    "earnedLaurelIds",
    "appliedGrantIds",
    "defenseGrantIds",
    "defenseSlotCap",
    "campaignModifierIds",
    "campaignActionIds",
    "modeIds",
    "protocols",
    "protocolLoadout",
    "protocolSlotCap",
    "relics",
    "relicLoadoutIds",
    "relicSlotCap",
    "reinforcements",
    "reinforcementId",
    "reinforcementSlotCap",
    "specializationAccessIds",
    "defenseMastery",
    "reconTier",
  ]);
  assert.equal(profile.schemaVersion, 2);
  assert.equal(profile.contentIdentity, "candidate-v4");
  assert.equal(profile.earnedLaurelIds.length, 0, "fresh profiles store earned identities sparsely");
  assert.deepEqual(profile.appliedGrantIds, Profile.INITIAL_APPLIED_GRANT_IDS);
  assert.deepEqual(profile.defenseGrantIds, ["chronos", "sentinel", "siege"]);
  assert.equal(profile.defenseSlotCap, 4);
  assert.equal(profile.protocols.length, 10);
  assert.equal(profile.protocols.every((record) => (
    record.granted === false && record.availableTier === 0 && record.allocatedLaurels === 0
  )), true);
  assert.equal(profile.relics.length, 8);
  assert.equal(profile.reinforcements.length, 3);
  assert.equal(profile.specializationAccessIds.length, 15, "default branches are always accessible");
  assert.equal(profile.defenseMastery.length, 15);
  assertDeepFrozen(profile);
});

test("validateProfileV2 copies input, enforces exact fields, catalogs, ordering, and relations", () => {
  const source = clone(Profile.createProfileV2("candidate-v4"));
  const validated = Profile.validateProfileV2(source);
  source.contentIdentity = "mutated";
  source.protocols[0].granted = true;
  assert.equal(validated.contentIdentity, "candidate-v4");
  assert.equal(validated.protocols[0].granted, false);
  assertDeepFrozen(validated);

  const extra = clone(validated);
  extra.future = true;
  assert.throws(() => Profile.validateProfileV2(extra), /exactly/i);

  const missingProtocol = clone(validated);
  missingProtocol.protocols.pop();
  assert.throws(() => Profile.validateProfileV2(missingProtocol), /exactly 10/i);

  const swappedProtocols = clone(validated);
  [swappedProtocols.protocols[0], swappedProtocols.protocols[1]] = [
    swappedProtocols.protocols[1], swappedProtocols.protocols[0],
  ];
  assert.throws(() => Profile.validateProfileV2(swappedProtocols), /catalog order/i);

  const unknownLaurel = clone(validated);
  unknownLaurel.earnedLaurelIds = ["m99:titan:victory"];
  assert.throws(() => Profile.validateProfileV2(unknownLaurel), /Laurel identity/i);

  const impossibleTier = profileWithEvidence(Profile.LAUREL_IDS.slice(0, 6), prefix("m05"));
  const temporalIndex = impossibleTier.protocols.findIndex((record) => record.id === "temporal-edict");
  impossibleTier.protocols[temporalIndex] = {
    id: "temporal-edict",
    granted: true,
    availableTier: 3,
    allocatedLaurels: 18,
  };
  assert.throws(() => Profile.validateProfileV2(impossibleTier), /earned Laurel budget/i);

  const hiddenAlternate = clone(validated);
  hiddenAlternate.specializationAccessIds.push("sentinel-twin-lance");
  hiddenAlternate.specializationAccessIds.sort();
  assert.throws(() => Profile.validateProfileV2(hiddenAlternate), /tempered/i);

  const unfieldedStrategos = clone(validated);
  unfieldedStrategos.defenseMastery.find((record) => record.defenseId === "sentinel").strategosVictory = true;
  assert.throws(
    () => Profile.validateProfileV2(unfieldedStrategos),
    /Strategos victory proof requires fielded mastery/
  );
  assert.throws(() => Profile.reconcileProfileV2(unfieldedStrategos), /requires fielded mastery/);
});

test("Laurel identities and budgets are canonical, sparse, and allocation-aware", () => {
  assert.equal(Profile.makeLaurelId("m01", "story", "victory"), "m01:story:victory");
  assert.throws(() => Profile.makeLaurelId("m21", "story", "victory"), /mission/i);
  assert.throws(() => Profile.makeLaurelId("m01", "easy", "victory"), /difficulty/i);

  const source = profileWithEvidence(Profile.LAUREL_IDS.slice(0, 18), prefix("m05"));
  const temporalIndex = source.protocols.findIndex((record) => record.id === "temporal-edict");
  source.protocols[temporalIndex] = {
    id: "temporal-edict",
    granted: true,
    availableTier: 3,
    allocatedLaurels: 18,
  };
  const profile = Profile.validateProfileV2(source);
  assert.deepEqual(Profile.getLaurelBudget(profile), {
    earned: 18,
    allocated: 18,
    available: 0,
  });
});

test("invalid saved Protocol tiers reject normally and lower only through explicit repair", () => {
  const source = profileWithEvidence(Profile.LAUREL_IDS.slice(0, 6), prefix("m05"));
  const temporal = source.protocols.find((record) => record.id === "temporal-edict");
  temporal.granted = true;
  temporal.availableTier = 2;
  temporal.allocatedLaurels = 6;
  source.protocolSlotCap = 1;
  source.protocolLoadout = [{ slot: 0, protocolId: "temporal-edict", tier: 3 }];

  assert.throws(() => Profile.validateProfileV2(source), /equipped tier/i);
  assert.throws(() => Profile.resolveRunSnapshot(source), /equipped tier/i);

  const repaired = Profile.repairSavedProtocolTiers(source);
  assert.equal(repaired.changed, true);
  assert.deepEqual(repaired.repairs, [{
    kind: "lowered-protocol-tier",
    protocolId: "temporal-edict",
    slot: 0,
    fromTier: 3,
    toTier: 2,
  }]);
  assert.equal(repaired.profile.protocolLoadout[0].tier, 2);
  assert.equal(source.protocolLoadout[0].tier, 3, "repair is immutable");
  assertDeepFrozen(repaired);
});

test("resolveRunSnapshot is combat-only, detached, exact, and deeply frozen", () => {
  const source = profileWithEvidence(Profile.LAUREL_IDS.slice(0, 18), prefix("m18"));
  const temporal = source.protocols.find((record) => record.id === "temporal-edict");
  temporal.granted = true;
  temporal.availableTier = 3;
  temporal.allocatedLaurels = 18;
  source.protocolLoadout = [{ slot: 0, protocolId: "temporal-edict", tier: 2 }];
  const profile = Profile.validateProfileV2(source);
  const snapshot = Profile.resolveRunSnapshot(profile);

  assert.deepEqual(Object.keys(snapshot), [
    "profileSchemaVersion",
    "contentIdentity",
    "defenseGrantIds",
    "defenseSlotCap",
    "campaignModifierIds",
    "campaignActionIds",
    "modeIds",
    "protocolLoadout",
    "protocolSlotCap",
    "relicIds",
    "relicSlotCap",
    "reinforcementId",
    "specializationAccessIds",
  ]);
  assert.equal(Object.hasOwn(snapshot, "reconTier"), false, "Recon is presentation-only");
  assert.equal(Object.hasOwn(snapshot, "appliedGrantIds"), false, "the grant ledger carries Recon grants");
  assert.equal(JSON.stringify(snapshot).indexOf("recon"), -1, "no Recon identity reaches a run header");
  assert.notEqual(snapshot.protocolLoadout, profile.protocolLoadout);
  assert.deepEqual(snapshot.protocolLoadout, [{
    slot: 0,
    protocolId: "temporal-edict",
    tier: 2,
  }]);
  assertDeepFrozen(snapshot);
});

test("profile strict-data preflight rejects hostile graphs without invoking accessors", () => {
  const base = clone(Profile.createProfileV2("candidate-v4"));

  let invoked = false;
  const accessor = clone(base);
  Object.defineProperty(accessor, "contentIdentity", {
    enumerable: true,
    get() {
      invoked = true;
      throw new Error("must not run");
    },
  });
  assert.throws(() => Profile.validateProfileV2(accessor), /enumerable data properties/i);
  assert.equal(invoked, false);

  const inherited = Object.assign(Object.create({ inherited: true }), clone(base));
  assert.throws(() => Profile.validateProfileV2(inherited), /plain object/i);

  const sparse = clone(base);
  sparse.earnedLaurelIds = new Array(1);
  assert.throws(() => Profile.validateProfileV2(sparse), /dense array/i);

  const shared = clone(base);
  shared.protocols[1] = shared.protocols[0];
  assert.throws(() => Profile.validateProfileV2(shared), /cycles or shared references/i);

  const cyclic = clone(base);
  cyclic.self = cyclic;
  assert.throws(() => Profile.validateProfileV2(cyclic), /cycles or shared references/i);

  const protoKey = clone(base);
  Object.defineProperty(protoKey, "__proto__", {
    value: { polluted: true }, enumerable: true, writable: true, configurable: true,
  });
  assert.throws(() => Profile.validateProfileV2(protoKey), /contain exactly/i);
  assert.equal({}.polluted, undefined);
});

test("profile strict-data preflight enforces depth, array, and object bounds", () => {
  const oversizedArray = clone(Profile.createProfileV2("candidate-v4"));
  oversizedArray.earnedLaurelIds = new Array(513).fill("m01:story:victory");
  assert.throws(() => Profile.validateProfileV2(oversizedArray), /array length limit/i);

  const oversizedObject = clone(Profile.createProfileV2("candidate-v4"));
  oversizedObject.oversized = {};
  for (let index = 0; index < 65; index += 1) {
    oversizedObject.oversized["field" + index] = index;
  }
  assert.throws(() => Profile.validateProfileV2(oversizedObject), /object field limit/i);

  const tooDeep = clone(Profile.createProfileV2("candidate-v4"));
  let cursor = {};
  tooDeep.tooDeep = cursor;
  for (let index = 0; index < 34; index += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.throws(() => Profile.validateProfileV2(tooDeep), /depth limit/i);
});

test("completion, Laurel proof, and applied grants fail closed or reconcile deterministically", () => {
  const missingDerived = clone(Profile.createProfileV2("candidate-v4"));
  missingDerived.completedMissionIds = ["m01", "m02", "m03", "m04", "m05"];
  assert.throws(() => Profile.validateProfileV2(missingDerived), /must match completed mission/i);
  const reconciled = Profile.reconcileProfileV2(missingDerived);
  assert.equal(reconciled.changed, true);
  assert.equal(reconciled.profile.appliedGrantIds.includes("grant.protocol.temporal-edict"), true);
  assert.equal(reconciled.profile.protocols.find((record) => (
    record.id === "temporal-edict"
  )).granted, true);
  assert.equal(reconciled.profile.defenseSlotCap, 5);

  const skipped = clone(Profile.createProfileV2("candidate-v4"));
  skipped.completedMissionIds = ["m05"];
  assert.throws(() => Profile.validateProfileV2(skipped), /linear campaign prefix; found m05 without m01/);
  assert.throws(() => Profile.reconcileProfileV2(skipped), /linear campaign prefix/);
  const gap = clone(Profile.createProfileV2("candidate-v4"));
  gap.completedMissionIds = ["m01", "m03"];
  assert.throws(() => Profile.validateProfileV2(gap), /found m03 without m02/);
  const endgame = clone(Profile.createProfileV2("candidate-v4"));
  endgame.completedMissionIds = ["m20"];
  assert.throws(() => Profile.validateProfileV2(endgame), /linear campaign prefix/);

  const orphan = clone(Profile.createProfileV2("candidate-v4"));
  orphan.earnedLaurelIds = ["m01:story:integrity"];
  assert.throws(() => Profile.validateProfileV2(orphan), /mission to be completed|victory Laurel/i);
  const repairedOrphan = Profile.reconcileProfileV2(orphan);
  assert.deepEqual(repairedOrphan.profile.earnedLaurelIds, []);

  const completedWithoutVictory = clone(Profile.reconcileProfileV2(Object.assign(
    clone(Profile.createProfileV2("candidate-v4")),
    { completedMissionIds: ["m01"] }
  )).profile);
  completedWithoutVictory.earnedLaurelIds = ["m01:story:integrity"];
  assert.throws(
    () => Profile.validateProfileV2(completedWithoutVictory),
    /same mission\/difficulty victory Laurel/i
  );

  const victoryProof = clone(Profile.createProfileV2("candidate-v4"));
  victoryProof.earnedLaurelIds = ["m01:story:victory", "m02:story:victory"];
  const restored = Profile.reconcileProfileV2(victoryProof);
  assert.deepEqual(restored.profile.completedMissionIds, ["m01", "m02"]);
  assert.equal(restored.profile.appliedGrantIds.includes("grant.defense.oracle"), true);
  assert.deepEqual(restored.repairs.map((repair) => repair.kind), [
    "restored-completion-from-victory-laurel",
    "restored-completion-from-victory-laurel",
    "rebuilt-applied-grant-ledger",
  ]);

  const strayLaurel = clone(Profile.createProfileV2("candidate-v4"));
  strayLaurel.earnedLaurelIds = ["m19:story:victory"];
  assert.throws(
    () => Profile.reconcileProfileV2(strayLaurel),
    /linear campaign prefix; found m19 without m01/,
    "reconciliation never invents intermediate completions from one stray Laurel"
  );
});

test("mastered may lag but never lead its verified evidence", () => {
  const source = profileWithEvidence(Profile.LAUREL_IDS.slice(0, 6), prefix("m02"));
  const sentinel = source.defenseMastery.find((record) => record.defenseId === "sentinel");
  sentinel.fielded = true;
  sentinel.tempered = true;
  sentinel.strategosVictory = true;
  sentinel.specializationVictoryIds = ["sentinel-lock-on", "sentinel-twin-lance"];
  sentinel.mastered = false;
  source.specializationAccessIds.push("sentinel-twin-lance");
  source.specializationAccessIds.sort();
  source.appliedGrantIds.push("grant.specialization.sentinel-twin-lance");
  source.appliedGrantIds.sort();
  assert.equal(Profile.validateProfileV2(source).defenseMastery.find((record) => (
    record.defenseId === "sentinel"
  )).mastered, false, "both branches plus Strategos proof do not force mastery");

  const leading = clone(source);
  const leadingSentinel = leading.defenseMastery.find((record) => record.defenseId === "sentinel");
  leadingSentinel.mastered = true;
  leadingSentinel.specializationVictoryIds = ["sentinel-lock-on"];
  assert.throws(() => Profile.validateProfileV2(leading), /mastered state is not supported/);
});

test("hostile scalar diagnostics never invoke Symbol.toPrimitive or toString", () => {
  let invoked = false;
  const hostile = {
    [Symbol.toPrimitive]() { invoked = true; throw new Error("must not run"); },
    toString() { invoked = true; throw new Error("must not run"); },
  };
  assert.throws(() => Profile.makeLaurelId(hostile, "story", "victory"), /received object/i);
  assert.equal(invoked, false);
});
