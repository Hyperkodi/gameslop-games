"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Profile = require("../js/progression/profile-v2.js");
const Progression = require("../js/progression/progression.js");
const RuleCatalog = require("../../../tools/lib/aegis/v4-rule-catalog.js");
const CheckedProgression = JSON.parse(fs.readFileSync(path.join(
  __dirname, "..", "content-v4", "progression", "binding-v1.json"
), "utf8"));

const RULESET_HASH = "sha256:" + "ab".repeat(32);

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

function earn(profile, count) {
  const source = clone(profile);
  source.earnedLaurelIds = Profile.LAUREL_IDS.slice(0, count);
  return Profile.reconcileProfileV2(source).profile;
}

/* Apply first clears m01..throughMissionId in campaign order. */
function campaign(profile, throughMissionId) {
  let current = profile;
  for (const missionId of Profile.MISSION_IDS) {
    current = Progression.planApplyMissionFirstClear(current, missionId).profile;
    if (missionId === throughMissionId) break;
  }
  return current;
}

function authorize(profile, missionId, difficultyId, loadoutIds, specializationAccessIds) {
  return {
    formatVersion: 2,
    rulesetHash: RULESET_HASH,
    profileContentIdentity: profile.contentIdentity,
    missionId: missionId,
    difficultyId: difficultyId,
    loadoutIds: loadoutIds.slice().sort(),
    specializationAccessIds: (specializationAccessIds || profile.specializationAccessIds).slice().sort(),
  };
}

function victory(profile, missionId, difficultyId, objectiveIds, defenseEvidence, overrides) {
  const loadoutIds = defenseEvidence.length
    ? defenseEvidence.map((record) => record.defenseId)
    : ["sentinel"];
  return Object.assign({
    missionId: missionId,
    difficultyId: difficultyId,
    completedObjectiveIds: objectiveIds.slice().sort(),
    defenseEvidence: defenseEvidence,
    runAuthorization: authorize(profile, missionId, difficultyId, loadoutIds),
  }, overrides || {});
}

function evidence(defenseId, highestLevel, specializationIds) {
  return { defenseId: defenseId, highestLevel: highestLevel, specializationIds: specializationIds || [] };
}

test("progression publishes frozen mission-first-clear grant bundles for all 20 missions", () => {
  assertDeepFrozen(Progression);
  assert.equal(Progression.MISSION_GRANT_BUNDLES.length, 20);

  assert.deepEqual(Progression.getMissionFirstClearGrantBundle("m05"), {
    missionId: "m05",
    loanProtocolIds: ["temporal-edict"],
    firstVictoryGrantIds: [
      "grant.defense-slots.5",
      "grant.protocol-slots.1",
      "grant.protocol.temporal-edict",
    ],
  });
  assert.deepEqual(Progression.getMissionFirstClearGrantBundle("m15"), {
    missionId: "m15",
    loanProtocolIds: ["hephaestus-overclock"],
    firstVictoryGrantIds: [
      "grant.campaign.reserve-2",
      "grant.protocol.hephaestus-overclock",
      "grant.relic-slots.2",
      "grant.relic.laurel-of-ares",
    ],
  });
  assert.throws(() => Progression.getMissionFirstClearGrantBundle("m21"), /mission/i);
});

test("first-clear rewards apply atomically and idempotently", () => {
  const initial = campaign(Profile.createProfileV2("candidate-v4"), "m04");
  const first = Progression.planApplyMissionFirstClear(initial, "m05");
  assert.equal(first.changed, true);
  assert.equal(first.firstClear, true);
  assert.deepEqual(first.profile.completedMissionIds, ["m01", "m02", "m03", "m04", "m05"]);
  assert.equal(first.profile.protocolSlotCap, 1);
  assert.equal(first.profile.defenseSlotCap, 5);
  assert.deepEqual(first.grantIdsApplied, first.grantBundle.firstVictoryGrantIds);
  assert.deepEqual(first.profile.protocols.find((record) => record.id === "temporal-edict"), {
    id: "temporal-edict",
    granted: true,
    availableTier: 1,
    allocatedLaurels: 0,
  });
  assert.deepEqual(initial.completedMissionIds, ["m01", "m02", "m03", "m04"]);

  const again = Progression.planApplyMissionFirstClear(first.profile, "m05");
  assert.equal(again.changed, false);
  assert.equal(again.firstClear, false);
  assert.deepEqual(again.profile, first.profile);
  assert.notEqual(again.profile, first.profile, "plans return detached immutable values");
  assertDeepFrozen(first);
  assertDeepFrozen(again);
});

test("the campaign is linear: m01 has no prerequisite and every later mission needs its predecessor", () => {
  assert.equal(Profile.getMissionPrerequisiteId("m01"), null);
  assert.equal(Profile.getMissionPrerequisiteId("m02"), "m01");
  assert.equal(Profile.getMissionPrerequisiteId("m20"), "m19");
  assert.throws(() => Profile.getMissionPrerequisiteId("m21"), /mission/i);

  const fresh = Profile.createProfileV2("candidate-v4");
  const before = clone(fresh);
  assert.throws(
    () => Progression.planApplyMissionFirstClear(fresh, "m05"),
    /m05 requires the prerequisite mission m04/
  );
  assert.throws(
    () => Progression.planApplyMissionFirstClear(fresh, "m20"),
    /m20 requires the prerequisite mission m19/
  );
  assert.throws(
    () => Progression.planApplyVerifiedVictory(fresh, victory(fresh, "m20", "story", ["victory"], [
      evidence("sentinel", 2),
    ])),
    /m20 requires the prerequisite mission m19/
  );
  assert.deepEqual(fresh, before, "a rejected claim never partially mutates the profile");

  const m01 = Progression.planApplyMissionFirstClear(fresh, "m01");
  assert.deepEqual(m01.profile.completedMissionIds, ["m01"]);
  assert.throws(() => Progression.planApplyMissionFirstClear(m01.profile, "m03"), /m03 requires/);
  const m02 = Progression.planApplyMissionFirstClear(m01.profile, "m02");
  assert.deepEqual(m02.profile.completedMissionIds, ["m01", "m02"]);
});

test("verified victory earns canonical Laurels, applies first-clear grants, and advances mastery", () => {
  const initial = campaign(Profile.createProfileV2("candidate-v4"), "m04");
  const result = victory(initial, "m05", "strategos", ["integrity", "mastery", "victory"], [
    evidence("sentinel", 3, ["sentinel-lock-on"]),
  ]);
  const first = Progression.planApplyVerifiedVictory(initial, result);
  assert.equal(first.changed, true);
  assert.equal(first.firstClear, true);
  assert.deepEqual(first.laurelIdsAdded, [
    "m05:strategos:integrity",
    "m05:strategos:mastery",
    "m05:strategos:victory",
  ]);
  const sentinel = first.profile.defenseMastery.find((record) => record.defenseId === "sentinel");
  assert.deepEqual(sentinel, {
    defenseId: "sentinel",
    fielded: true,
    tempered: true,
    mastered: false,
    strategosVictory: true,
    specializationVictoryIds: ["sentinel-lock-on"],
  });
  assert.equal(first.profile.specializationAccessIds.includes("sentinel-twin-lance"), true);
  assert.deepEqual(first.masteryChanges, [{
    defenseId: "sentinel",
    fieldedAdded: true,
    temperedAdded: true,
    masteredAdded: false,
    strategosVictoryAdded: true,
    specializationIdsAdded: ["sentinel-lock-on"],
    specializationAccessIdsAdded: ["sentinel-twin-lance"],
  }]);

  assert.deepEqual(first.repairs, []);

  const second = Progression.planApplyVerifiedVictory(first.profile, victory(first.profile, "m06", "story", ["victory"], [
    evidence("sentinel", 3, ["sentinel-twin-lance"]),
  ]));
  const afterStory = second.profile.defenseMastery.find((record) => record.defenseId === "sentinel");
  assert.deepEqual(afterStory.specializationVictoryIds, ["sentinel-lock-on", "sentinel-twin-lance"]);
  assert.equal(afterStory.mastered, false, "a Story victory never masters a family (ruling R15)");
  assert.equal(second.masteryChanges[0].masteredAdded, false);

  const third = Progression.planApplyVerifiedVictory(second.profile, victory(second.profile, "m07", "titan", ["victory"], [
    evidence("sentinel", 1),
  ]));
  assert.equal(third.profile.defenseMastery.find((record) => (
    record.defenseId === "sentinel"
  )).mastered, true, "the next Strategos-or-higher victory fielding the family masters it");
  assert.equal(third.masteryChanges[0].masteredAdded, true);

  const replay = Progression.planApplyVerifiedVictory(first.profile, result);
  assert.equal(replay.changed, false);
  assert.deepEqual(replay.profile, first.profile);
});

test("run authorization is an exact, strictly validated replay-v2 derived record", () => {
  const profile = campaign(Profile.createProfileV2("candidate-v4"), "m01");
  const base = victory(profile, "m02", "story", ["victory"], [evidence("sentinel", 1)]);
  const before = clone(profile);

  function rejects(mutate, pattern) {
    const result = clone(base);
    mutate(result);
    assert.throws(() => Progression.planApplyVerifiedVictory(profile, result), pattern);
    assert.deepEqual(profile, before);
  }

  rejects((r) => { delete r.runAuthorization; }, /contain exactly/i);
  rejects((r) => { r.runAuthorization.extra = 1; }, /contain exactly/i);
  rejects((r) => { delete r.runAuthorization.rulesetHash; }, /contain exactly/i);
  rejects((r) => { r.runAuthorization.formatVersion = 1; }, /format version must be 2/i);
  rejects((r) => { r.runAuthorization.rulesetHash = "ab".repeat(32); }, /sha256:<64-hex>/);
  rejects((r) => { r.runAuthorization.rulesetHash = "sha256:" + "AB".repeat(32); }, /sha256:<64-hex>/);
  rejects((r) => { r.runAuthorization.rulesetHash = "sha256:" + "ab".repeat(31); }, /sha256:<64-hex>/);
  rejects((r) => { r.runAuthorization.profileContentIdentity = "Other"; }, /stable lowercase ID/i);
  rejects((r) => { r.runAuthorization.profileContentIdentity = "other-profile"; }, /content identity does not match/i);
  rejects((r) => { r.runAuthorization.missionId = "m03"; }, /mission ID does not match/i);
  rejects((r) => { r.runAuthorization.difficultyId = "titan"; }, /difficulty ID does not match/i);
  rejects((r) => { r.runAuthorization.loadoutIds = []; }, /must not be empty/i);
  rejects((r) => { r.runAuthorization.loadoutIds = ["siege", "sentinel"]; }, /strict ASCII order/i);
  rejects((r) => { r.runAuthorization.loadoutIds = ["sentinel", "sentinel"]; }, /strict ASCII order/i);
  rejects((r) => { r.runAuthorization.loadoutIds = ["sentinel", "unknown"]; }, /Unknown run authorization loadout/i);
  rejects((r) => {
    r.runAuthorization.loadoutIds = ["artemis", "chronos", "hoplite", "sentinel"];
  }, /artemis was not granted before the authorized run/);
  rejects((r) => {
    r.runAuthorization.loadoutIds = ["chronos", "sentinel", "siege"];
    r.runAuthorization.loadoutIds.push("apollo", "artemis", "athena", "hades");
    r.runAuthorization.loadoutIds.sort();
  }, /exceed the maximum defense slot cap/i);
  rejects((r) => {
    r.runAuthorization.specializationAccessIds = ["sentinel-twin-lance"].concat(profile.specializationAccessIds).sort();
  }, /sentinel-twin-lance access was not granted before the authorized run/);
  rejects((r) => {
    r.runAuthorization.specializationAccessIds = profile.specializationAccessIds.slice().reverse();
  }, /strict ASCII order/i);

  const accepted = Progression.planApplyVerifiedVictory(profile, base);
  assert.deepEqual(accepted.profile.completedMissionIds, ["m01", "m02"]);
  assertDeepFrozen(Progression.validateRunAuthorization(base.runAuthorization));
});

test("every reported defense and specialization must be authorized by the immutable run, not the profile", () => {
  const fresh = Profile.createProfileV2("candidate-v4");
  const before = clone(fresh);

  const zeusAuthorized = victory(fresh, "m01", "story", ["victory"], [evidence("zeus", 2)]);
  assert.throws(
    () => Progression.planApplyVerifiedVictory(fresh, zeusAuthorized),
    /zeus was not granted before the authorized run/
  );
  const zeusSmuggled = victory(fresh, "m01", "story", ["victory"], [evidence("zeus", 2)], {
    runAuthorization: authorize(fresh, "m01", "story", ["sentinel"]),
  });
  assert.throws(
    () => Progression.planApplyVerifiedVictory(fresh, zeusSmuggled),
    /zeus was not in the run authorization loadout/
  );
  assert.deepEqual(fresh, before, "rejected Zeus evidence never partially mutates a fresh profile");

  const twinLanceSmuggled = victory(fresh, "m01", "story", ["victory"], [
    evidence("sentinel", 3, ["sentinel-twin-lance"]),
  ]);
  assert.throws(
    () => Progression.planApplyVerifiedVictory(fresh, twinLanceSmuggled),
    /sentinel-twin-lance was not available in the run authorization/
  );
  assert.deepEqual(fresh, before);

  const temper = Progression.planApplyVerifiedVictory(fresh, victory(fresh, "m01", "story", ["victory"], [
    evidence("sentinel", 2),
  ]));
  assert.equal(temper.profile.specializationAccessIds.includes("sentinel-twin-lance"), true);
  assert.deepEqual(temper.masteryChanges[0].specializationAccessIdsAdded, ["sentinel-twin-lance"]);

  const sameRunLaundering = victory(temper.profile, "m02", "story", ["victory"], [
    evidence("chronos", 2),
    evidence("sentinel", 3, ["sentinel-twin-lance"]),
  ], {
    runAuthorization: authorize(temper.profile, "m02", "story", ["chronos", "sentinel"], fresh.specializationAccessIds),
  });
  assert.throws(
    () => Progression.planApplyVerifiedVictory(temper.profile, sameRunLaundering),
    /sentinel-twin-lance was not available in the run authorization/,
    "an alternate unlocked by result application only authorizes subsequent runs"
  );

  const nextRun = Progression.planApplyVerifiedVictory(temper.profile, victory(temper.profile, "m02", "story", ["victory"], [
    evidence("sentinel", 3, ["sentinel-twin-lance"]),
  ]));
  assert.deepEqual(nextRun.masteryChanges[0].specializationIdsAdded, ["sentinel-twin-lance"]);
});

test("deriveRunAuthorization reads only the named replay-v2 header fields", () => {
  const profile = campaign(Profile.createProfileV2("candidate-v4"), "m05");
  const header = {
    formatVersion: 2,
    rulesetHash: RULESET_HASH,
    eventSchemaVersion: 2,
    missionId: "m06",
    difficultyId: "titan",
    assist: false,
    seed: 7,
    loadoutIds: ["sentinel", "chronos", "hoplite"],
    loadoutSlotCap: 5,
    campaignModifierIds: ["reserve-1"],
    accessGrantIds: [],
    tutorialUpgradeGateMode: "none",
    protocolLoadout: [{ slot: 0, protocolId: "temporal-edict", tier: 1 }],
    protocolSlotCap: 1,
    protocolAuthority: [{ protocolId: "temporal-edict", availableTier: 1 }],
    missionProtocolLoan: null,
    relicIds: [],
    relicSlotCap: 0,
    reinforcementId: null,
    specializationAccessIds: profile.specializationAccessIds.slice(),
    inputs: [],
    checkpoints: [],
    finalClaim: { outcome: "victory", score: 1, laurels: 1, durationTicks: 1, finalStateHash: RULESET_HASH },
  };
  const derived = Progression.deriveRunAuthorization(header, profile.contentIdentity);
  assert.deepEqual(derived, {
    formatVersion: 2,
    rulesetHash: RULESET_HASH,
    profileContentIdentity: "candidate-v4",
    missionId: "m06",
    difficultyId: "titan",
    loadoutIds: ["chronos", "hoplite", "sentinel"],
    specializationAccessIds: profile.specializationAccessIds,
  }, "slot-ordered header loadouts derive an ASCII-sorted authorization");
  assertDeepFrozen(derived);
  const duplicateSlots = clone(header);
  duplicateSlots.loadoutIds = ["sentinel", "sentinel"];
  assert.throws(() => Progression.deriveRunAuthorization(duplicateSlots, "candidate-v4"), /strict ASCII order/i);
  const unknownSlot = clone(header);
  unknownSlot.loadoutIds = ["sentinel", "ballista"];
  assert.throws(() => Progression.deriveRunAuthorization(unknownSlot, "candidate-v4"), /Unknown Replay-v2 start header loadout ID/);
  const applied = Progression.planApplyVerifiedVictory(profile, {
    missionId: "m06",
    difficultyId: "titan",
    completedObjectiveIds: ["victory"],
    defenseEvidence: [evidence("hoplite", 2)],
    runAuthorization: derived,
  });
  assert.equal(applied.firstClear, true);
  assert.equal(applied.profile.defenseMastery.find((r) => r.defenseId === "hoplite").tempered, true);

  let invoked = false;
  const hostile = clone(header);
  Object.defineProperty(hostile, "loadoutIds", {
    enumerable: true,
    get() { invoked = true; throw new Error("must not run"); },
  });
  assert.throws(() => Progression.deriveRunAuthorization(hostile, "candidate-v4"), /enumerable data property/i);
  assert.equal(invoked, false);
  assert.throws(() => Progression.deriveRunAuthorization(null, "candidate-v4"), /plain object/i);
  assert.throws(() => Progression.deriveRunAuthorization(header, "Bad Identity"), /stable lowercase ID/i);
});

test("invalid victory evidence rejects without mutating its profile or partially granting rewards", () => {
  const profile = Profile.createProfileV2("candidate-v4");
  const before = clone(profile);
  assert.throws(() => Progression.planApplyVerifiedVictory(profile, victory(profile, "m01", "strategos", ["victory"], [
    evidence("sentinel", 3, ["chronos-echo-field"]),
  ])), /does not belong/i);
  assert.deepEqual(profile, before);
});

test("Protocol tier allocation costs 6 then 12, refund lowers loadout explicitly, and budget is conserved", () => {
  let profile = campaign(Profile.createProfileV2("candidate-v4"), "m05");
  profile = earn(profile, 18);

  const tier2 = Progression.planAllocateProtocolTier(profile, "temporal-edict");
  assert.equal(tier2.allocated, 6);
  assert.equal(tier2.profile.protocols.find((record) => record.id === "temporal-edict").availableTier, 2);
  assert.deepEqual(Profile.getLaurelBudget(tier2.profile), { earned: 18, allocated: 6, available: 12 });

  const tier3 = Progression.planAllocateProtocolTier(tier2.profile, "temporal-edict");
  assert.equal(tier3.allocated, 12);
  assert.deepEqual(Profile.getLaurelBudget(tier3.profile), { earned: 18, allocated: 18, available: 0 });
  assert.throws(() => Progression.planAllocateProtocolTier(tier3.profile, "temporal-edict"), /maximum tier/i);

  const loaded = Progression.planSetProtocolLoadout(tier3.profile, [
    { slot: 0, protocolId: "temporal-edict", tier: 3 },
  ]).profile;
  const refunded = Progression.planRefundProtocolTier(loaded, "temporal-edict");
  assert.equal(refunded.refunded, 12);
  assert.equal(refunded.profile.protocolLoadout[0].tier, 2);
  assert.deepEqual(refunded.loadoutRepairs, [{
    kind: "lowered-protocol-tier",
    protocolId: "temporal-edict",
    slot: 0,
    fromTier: 3,
    toTier: 2,
  }]);
  assert.deepEqual(Profile.getLaurelBudget(refunded.profile), { earned: 18, allocated: 6, available: 12 });
  assert.throws(() => Progression.planRefundProtocolTier(
    Progression.planRefundProtocolTier(refunded.profile, "temporal-edict").profile,
    "temporal-edict"
  ), /Tier 1 is free/i);
});

test("all ten Protocols maximize for exactly the canonical 180-Laurel budget", () => {
  let source = clone(Profile.createProfileV2("candidate-v4"));
  source.earnedLaurelIds = Profile.LAUREL_IDS.slice();
  let profile = Profile.reconcileProfileV2(source).profile;
  Profile.PROTOCOL_IDS.forEach((protocolId) => {
    profile = Progression.planAllocateProtocolTier(profile, protocolId).profile;
    profile = Progression.planAllocateProtocolTier(profile, protocolId).profile;
  });
  assert.deepEqual(Profile.getLaurelBudget(profile), { earned: 180, allocated: 180, available: 0 });
});

test("loadout plans enforce grants, uniqueness, and the exact 2/2/1 caps", () => {
  let profile = campaign(Profile.createProfileV2("candidate-v4"), "m15");

  profile = Progression.planSetProtocolLoadout(profile, [
    { slot: 0, protocolId: "temporal-edict", tier: 1 },
    { slot: 1, protocolId: "zeus-skyfire", tier: 1 },
  ]).profile;
  profile = Progression.planSetRelicLoadout(profile, ["bronze-obol", "laurel-of-ares"]).profile;
  profile = Progression.planSetReinforcementLoadout(profile, "spartan-phalanx").profile;
  const snapshot = Profile.resolveRunSnapshot(profile);
  assert.equal(snapshot.protocolLoadout.length, 2);
  assert.deepEqual(snapshot.relicIds, ["bronze-obol", "laurel-of-ares"]);
  assert.equal(snapshot.reinforcementId, "spartan-phalanx");
  assert.equal(Object.hasOwn(snapshot, "appliedGrantIds"), false, "Recon-bearing grant ledger never enters a run");
  assert.equal(Object.hasOwn(snapshot, "reconTier"), false);

  assert.throws(() => Progression.planSetProtocolLoadout(profile, [
    { slot: 0, protocolId: "temporal-edict", tier: 1 },
    { slot: 1, protocolId: "temporal-edict", tier: 1 },
  ]), /duplicate/i);
  assert.throws(() => Progression.planSetRelicLoadout(profile, ["titan-gear"]), /not granted/i);
  assert.throws(() => Progression.planSetReinforcementLoadout(profile, "talos-automaton"), /not granted/i);
});

test("progression object boundaries reject hostile graphs before reading them", () => {
  const profile = Progression.planApplyMissionFirstClear(
    Profile.createProfileV2("candidate-v4"),
    "m01"
  ).profile;

  let invoked = false;
  const accessorEntry = { slot: 0, tier: 1 };
  Object.defineProperty(accessorEntry, "protocolId", {
    enumerable: true,
    get() {
      invoked = true;
      throw new Error("must not run");
    },
  });
  assert.throws(
    () => Progression.planSetProtocolLoadout(profile, [accessorEntry]),
    /enumerable data properties/i
  );
  assert.equal(invoked, false);

  const inheritedVictory = Object.assign(
    Object.create({ inherited: true }),
    victory(profile, "m02", "story", ["victory"], [])
  );
  assert.throws(
    () => Progression.planApplyVerifiedVictory(profile, inheritedVictory),
    /plain object/i
  );

  const sparseLoadout = new Array(1);
  assert.throws(
    () => Progression.planSetProtocolLoadout(profile, sparseLoadout),
    /dense array/i
  );

  const sharedEntry = { slot: 0, protocolId: "temporal-edict", tier: 1 };
  assert.throws(
    () => Progression.planSetProtocolLoadout(profile, [sharedEntry, sharedEntry]),
    /cycles or shared references/i
  );

  const cyclicVictory = victory(profile, "m02", "story", ["victory"], []);
  cyclicVictory.self = cyclicVictory;
  assert.throws(
    () => Progression.planApplyVerifiedVictory(profile, cyclicVictory),
    /cycles or shared references/i
  );

  const protoKeyVictory = victory(profile, "m02", "story", ["victory"], []);
  Object.defineProperty(protoKeyVictory, "__proto__", {
    value: { polluted: true }, enumerable: true, writable: true, configurable: true,
  });
  assert.throws(
    () => Progression.planApplyVerifiedVictory(profile, protoKeyVictory),
    /contain exactly/i
  );
  assert.equal({}.polluted, undefined);
});

test("reapplying a completed mission reconciles every missing typed grant state", () => {
  const damaged = clone(Profile.createProfileV2("candidate-v4"));
  damaged.completedMissionIds = Profile.MISSION_IDS.slice(0, 9);
  const result = Progression.planApplyMissionFirstClear(damaged, "m09");
  assert.equal(result.firstClear, false);
  assert.equal(result.changed, true);
  assert.deepEqual(result.repairs.map((repair) => repair.kind), ["rebuilt-applied-grant-ledger"]);
  const skipped = clone(Profile.createProfileV2("candidate-v4"));
  skipped.completedMissionIds = ["m09"];
  assert.throws(() => Progression.planApplyMissionFirstClear(skipped, "m09"), /linear campaign prefix/);
  assert.equal(result.profile.appliedGrantIds.includes("grant.blueprint-reset"), true);
  assert.deepEqual(result.profile.campaignActionIds, ["blueprint-reset"]);
  assert.equal(result.profile.reinforcementSlotCap, 1);
  assert.equal(result.profile.reinforcements.find((record) => (
    record.id === "spartan-phalanx"
  )).granted, true);
  assert.equal(result.profile.relics.find((record) => record.id === "broken-aegis").granted, true);
});

test("profile catalogs and every progression record stay exhaustive with v4 source authorities", () => {
  const rules = RuleCatalog.BINDING_SOURCES.progression;
  assert.deepEqual(Profile.PROTOCOL_IDS, RuleCatalog.PROTOCOL_IDS);
  assert.deepEqual(Profile.RELIC_IDS, RuleCatalog.RELIC_IDS);
  assert.deepEqual(Profile.REINFORCEMENT_IDS, RuleCatalog.REINFORCEMENT_IDS);
  assert.deepEqual(Profile.DEFENSE_IDS, RuleCatalog.DEFENSE_IDS);
  assert.deepEqual(Profile.SPECIALIZATION_IDS, RuleCatalog.SPECIALIZATION_IDS);
  assert.deepEqual(Progression.PROTOCOL_TIER_COSTS, RuleCatalog.PROTOCOL_TIER_COSTS);
  assert.deepEqual(Progression.PROTOCOL_TIER_COSTS, CheckedProgression.protocolRules.tierCosts);
  assert.deepEqual(Progression.GRANT_RECORDS, rules.grantRecords);
  assert.deepEqual(Progression.GRANT_RECORDS, CheckedProgression.grantRecords);
  assert.deepEqual(Profile.GRANT_IDS, rules.grantRecords.map((record) => record.id));
  assert.deepEqual(Progression.MISSION_GRANT_BUNDLES, rules.records);
  assert.deepEqual(Progression.MISSION_GRANT_BUNDLES, CheckedProgression.records);
  const defaults = RuleCatalog.BINDING_SOURCES.specializations.records
    .filter((record) => record.isDefault)
    .map((record) => record.id)
    .sort();
  assert.deepEqual(Profile.DEFAULT_SPECIALIZATION_IDS, defaults);
});

test("every defense maps to exactly [default, alternate] with v4 isDefault parity", () => {
  const records = RuleCatalog.BINDING_SOURCES.specializations.records;
  assert.equal(records.length, 30);
  assert.equal(Profile.DEFENSE_IDS.length, 15);
  const expectedMapping = {};
  Profile.DEFENSE_IDS.forEach((defenseId) => {
    const branches = Profile.SPECIALIZATIONS_BY_DEFENSE[defenseId];
    assert.equal(branches.length, 2, defenseId + " has exactly two branches");
    const family = records.filter((record) => record.defenseId === defenseId);
    assert.equal(family.length, 2, defenseId + " has exactly two v4 specialization records");
    const defaultRecord = family.filter((record) => record.isDefault === true);
    const alternateRecord = family.filter((record) => record.isDefault === false);
    assert.equal(defaultRecord.length, 1);
    assert.equal(alternateRecord.length, 1);
    assert.equal(branches[0], defaultRecord[0].id, defenseId + " default branch parity");
    assert.equal(branches[1], alternateRecord[0].id, defenseId + " alternate branch parity");
    branches.forEach((id) => assert.equal(id.indexOf(defenseId + "-"), 0));
    expectedMapping[defenseId] = [defaultRecord[0].id, alternateRecord[0].id];
  });
  assert.deepEqual(clone(Profile.SPECIALIZATIONS_BY_DEFENSE), expectedMapping);
  assert.deepEqual(Object.keys(Profile.SPECIALIZATIONS_BY_DEFENSE), Profile.DEFENSE_IDS);
  assert.deepEqual(
    Profile.DEFAULT_SPECIALIZATION_IDS.concat(Profile.ALTERNATE_SPECIALIZATION_IDS).sort(),
    Profile.SPECIALIZATION_IDS
  );
  assert.equal(new Set(Profile.SPECIALIZATION_IDS).size, 30);
});

test("all twenty first victories plus tempering all fifteen families reaches exactly 77/77 grants", () => {
  assert.equal(Profile.GRANT_IDS.length, 77);
  let profile = Profile.createProfileV2("candidate-v4");
  Profile.MISSION_IDS.forEach((missionId) => {
    profile = Progression.planApplyMissionFirstClear(profile, missionId).profile;
  });
  const expectedMissionGrants = Progression.MISSION_GRANT_BUNDLES.flatMap((record) => (
    record.firstVictoryGrantIds
  ));
  assert.deepEqual(profile.appliedGrantIds, Array.from(new Set(
    Profile.INITIAL_APPLIED_GRANT_IDS.concat(expectedMissionGrants)
  )).sort());
  assert.equal(profile.appliedGrantIds.length, 62, "15 defaults + 47 first-victory grants");
  assert.deepEqual(profile.defenseGrantIds, Profile.DEFENSE_IDS);
  assert.equal(profile.defenseSlotCap, 6);
  assert.deepEqual(profile.campaignModifierIds, ["reserve-1", "reserve-2"]);
  assert.deepEqual(profile.campaignActionIds, ["blueprint-reset"]);
  assert.deepEqual(profile.modeIds, ["endless-ascension"]);
  assert.equal(profile.protocols.every((record) => record.granted), true);
  assert.equal(profile.protocolSlotCap, 2);
  assert.equal(profile.relics.every((record) => record.granted), true);
  assert.equal(profile.relicSlotCap, 2);
  assert.equal(profile.reinforcements.every((record) => record.granted), true);
  assert.equal(profile.reinforcementSlotCap, 1);
  assert.equal(profile.reconTier, 3);

  const families = Profile.DEFENSE_IDS.slice();
  [families.slice(0, 6), families.slice(6, 12), families.slice(12)].forEach((loadout) => {
    const result = Progression.planApplyVerifiedVictory(profile, victory(profile, "m20", "story", ["victory"],
      loadout.map((defenseId) => evidence(defenseId, 2))));
    assert.equal(result.firstClear, false);
    profile = result.profile;
  });
  assert.deepEqual(profile.appliedGrantIds, Profile.GRANT_IDS);
  assert.equal(profile.appliedGrantIds.length, 77);
  assert.equal(profile.defenseMastery.every((record) => record.fielded && record.tempered), true);
  assert.deepEqual(profile.specializationAccessIds, Profile.SPECIALIZATION_IDS);
  assert.equal(profile.specializationAccessIds.length, 30);

  const damaged = clone(profile);
  damaged.appliedGrantIds = [];
  damaged.defenseGrantIds = ["chronos", "sentinel", "siege"];
  damaged.defenseSlotCap = 4;
  damaged.protocolSlotCap = 0;
  damaged.relicSlotCap = 0;
  damaged.reinforcementSlotCap = 0;
  damaged.reconTier = 0;
  damaged.specializationAccessIds = Profile.DEFAULT_SPECIALIZATION_IDS.slice();
  assert.throws(() => Profile.validateProfileV2(damaged), /Initial grant is missing/i);
  const reconciled = Profile.reconcileProfileV2(damaged);
  assert.equal(reconciled.changed, true);
  assert.equal(reconciled.repairs.some((repair) => repair.kind === "rebuilt-applied-grant-ledger"), true);
  assert.deepEqual(reconciled.profile.appliedGrantIds, Profile.GRANT_IDS);
  assert.deepEqual(reconciled.profile, profile, "reconciliation restores the exact 77-record ledger and its derived state");
});

test("hostile scalar grant and mission IDs are never coerced for diagnostics", () => {
  let invoked = false;
  const hostile = {
    [Symbol.toPrimitive]() { invoked = true; throw new Error("must not run"); },
    toString() { invoked = true; throw new Error("must not run"); },
  };
  assert.throws(() => Progression.getMissionFirstClearGrantBundle(hostile), /received object/i);
  assert.equal(invoked, false);
});
