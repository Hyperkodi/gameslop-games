"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RunHeader = require("../js/delivery/run-header-v2.js");
const ReplayV2 = require("../js/sim/replay-v2.js");
const Profile = require("../js/progression/profile-v2.js");
const Progression = require("../js/progression/progression.js");

const RULESET_HASH = "sha256:" + "a".repeat(64);
const ACCESS_GRANTS = Object.freeze([
  { defenseId: "chronos", accessGrantId: "campaign.chronos" },
  { defenseId: "hoplite", accessGrantId: "campaign.hoplite" },
  { defenseId: "sentinel", accessGrantId: "campaign.sentinel" },
  { defenseId: "siege", accessGrantId: "campaign.siege" },
]);

function mission(overrides) {
  return Object.assign({
    id: "m05",
    availableDefenseIds: ["chronos", "hoplite", "sentinel", "siege"],
    tutorial: { upgradeGateMode: "none" },
    protocolLoan: null,
  }, overrides || {});
}

function baseProfile() {
  return Profile.createProfileV2("candidate-v4");
}

function headerInput(overrides) {
  const profile = (overrides && overrides.profile) || baseProfile();
  return Object.assign({
    snapshot: Profile.resolveRunSnapshot(profile),
    protocolAuthority: RunHeader.deriveProtocolAuthority(profile),
    mission: mission(),
    loadoutIds: ["sentinel", "chronos"],
    accessGrantMappings: ACCESS_GRANTS,
    difficultyId: "strategos",
    seed: 7,
    assist: false,
    rulesetHash: RULESET_HASH,
  }, overrides && overrides.input ? overrides.input : {});
}

/* A profile with every unlock the header can legally carry. */
function upgradedProfile() {
  let profile = baseProfile();
  ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10"].forEach((missionId) => {
    profile = Progression.planApplyMissionFirstClear(profile, missionId).profile;
  });
  return profile;
}

test("run header v2 contains exactly the replay-v2 start-header field set", () => {
  const header = RunHeader.createRunHeaderV2(headerInput());
  assert.deepEqual(Object.keys(header).sort(), RunHeader.HEADER_FIELDS.slice().sort());
  assert.equal(header.formatVersion, 2);
  assert.equal(header.eventSchemaVersion, 2);
  assert.equal(Object.isFrozen(header), true);
});

test("run header never carries Recon, applied grants, mastery, or timestamps", () => {
  const header = RunHeader.createRunHeaderV2(headerInput());
  RunHeader.FORBIDDEN_HEADER_FIELDS.forEach((field) => {
    assert.equal(Object.prototype.hasOwnProperty.call(header, field), false, field);
  });
  const encoded = JSON.stringify(header);
  ["reconTier", "appliedGrantIds", "defenseMastery", "earnedLaurelIds"].forEach((token) => {
    assert.equal(encoded.includes(token), false, token);
  });
});

test("run header golden for a fresh profile is byte stable", () => {
  const header = RunHeader.createRunHeaderV2(headerInput());
  assert.deepEqual(JSON.parse(JSON.stringify(header)), {
    formatVersion: 2,
    rulesetHash: RULESET_HASH,
    eventSchemaVersion: 2,
    missionId: "m05",
    difficultyId: "strategos",
    assist: false,
    seed: 7,
    loadoutIds: ["sentinel", "chronos"],
    loadoutSlotCap: 4,
    campaignModifierIds: [],
    accessGrantIds: ["campaign.chronos", "campaign.sentinel"],
    tutorialUpgradeGateMode: "none",
    protocolLoadout: [],
    protocolSlotCap: 0,
    protocolAuthority: [],
    missionProtocolLoan: null,
    relicIds: [],
    relicSlotCap: 0,
    reinforcementId: null,
    specializationAccessIds: [
      "apollo-forked-ray", "artemis-execution-line", "athena-coordinated-fire",
      "chronos-echo-field", "hades-twin-banish", "hephaestus-molten-field",
      "hermes-wing-command", "hoplite-phalanx", "medusa-gorgon-bloom",
      "oracle-chorus", "poseidon-maelstrom", "sentinel-lock-on",
      "siege-breach-core", "talos-titan-hunter", "zeus-storm-crown",
    ],
  });
});

test("run header keeps loadout slot order and sorts every other identity array", () => {
  const header = RunHeader.createRunHeaderV2(headerInput({
    input: { loadoutIds: ["siege", "chronos", "sentinel"] },
  }));
  assert.deepEqual(header.loadoutIds, ["siege", "chronos", "sentinel"]);
  assert.deepEqual(header.accessGrantIds, ["campaign.chronos", "campaign.sentinel", "campaign.siege"]);
  const sorted = (values) => values.slice().sort().join("|") === values.join("|");
  assert.equal(sorted(header.accessGrantIds), true);
  assert.equal(sorted(header.specializationAccessIds), true);
  assert.equal(sorted(header.campaignModifierIds), true);
});

test("run header refuses a loadout the profile or mission does not offer", () => {
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({
    input: { loadoutIds: ["hoplite"] },
  })), /has not unlocked/);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({
    input: { loadoutIds: [] },
  })), /at least one defense/);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({
    input: { loadoutIds: ["sentinel", "sentinel"] },
  })), /must not repeat/);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({
    input: { loadoutIds: ["sentinel", "chronos", "siege", "sentinel"] },
  })), /must not repeat/);
});

test("run header respects the profile defense slot cap", () => {
  const profile = upgradedProfile();
  const header = RunHeader.createRunHeaderV2(headerInput({
    profile,
    input: {
      snapshot: Profile.resolveRunSnapshot(profile),
      protocolAuthority: RunHeader.deriveProtocolAuthority(profile),
      loadoutIds: ["sentinel", "chronos", "siege", "hoplite"],
    },
  }));
  assert.equal(header.loadoutSlotCap, 6);
  assert.equal(header.protocolSlotCap, 2);
  assert.deepEqual(header.protocolAuthority, [
    { protocolId: "aegis-ward", availableTier: 1 },
    { protocolId: "temporal-edict", availableTier: 1 },
    { protocolId: "zeus-skyfire", availableTier: 1 },
  ]);
});

test("protocol authority derives only granted protocols at their available tier", () => {
  const fresh = RunHeader.deriveProtocolAuthority(baseProfile());
  assert.deepEqual(fresh, []);
  let profile = upgradedProfile();
  profile = Progression.planApplyMissionFirstClear(profile, "m11").profile;
  assert.throws(() => RunHeader.deriveProtocolAuthority({ protocols: [{ granted: true }] }),
    /stable lowercase ID/);
  const authority = RunHeader.deriveProtocolAuthority(profile);
  assert.equal(authority.every((entry) => entry.availableTier >= 1), true);
  assert.equal(Object.isFrozen(authority), true);
});

test("an equipped protocol tier can never exceed its permanent authority", () => {
  let profile = upgradedProfile();
  profile = Progression.planSetProtocolLoadout(profile, [
    { slot: 0, protocolId: "temporal-edict", tier: 1 },
  ]).profile;
  const snapshot = Profile.resolveRunSnapshot(profile);
  const header = RunHeader.createRunHeaderV2(headerInput({
    input: {
      snapshot,
      protocolAuthority: RunHeader.deriveProtocolAuthority(profile),
      loadoutIds: ["sentinel"],
    },
  }));
  assert.deepEqual(header.protocolLoadout, [{ slot: 0, protocolId: "temporal-edict", tier: 1 }]);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({
    input: {
      snapshot: Object.assign({}, snapshot, {
        protocolLoadout: [{ slot: 0, protocolId: "temporal-edict", tier: 3 }],
      }),
      protocolAuthority: RunHeader.deriveProtocolAuthority(profile),
      loadoutIds: ["sentinel"],
    },
  })), /exceeds its available tier/);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({
    input: {
      snapshot: Object.assign({}, snapshot, {
        protocolLoadout: [{ slot: 0, protocolId: "armara-ascension", tier: 1 }],
      }),
      protocolAuthority: RunHeader.deriveProtocolAuthority(profile),
      loadoutIds: ["sentinel"],
    },
  })), /requires permanent authority/);
});

test("a mission protocol loan is Tier 1, mission local, and dropped when already equipped", () => {
  let profile = upgradedProfile();
  const loaned = RunHeader.createRunHeaderV2(headerInput({
    input: {
      snapshot: Profile.resolveRunSnapshot(profile),
      protocolAuthority: RunHeader.deriveProtocolAuthority(profile),
      loadoutIds: ["sentinel"],
      mission: mission({ protocolLoan: { protocolId: "poseidon-surge", tier: 1 } }),
    },
  }));
  assert.deepEqual(loaned.missionProtocolLoan, { protocolId: "poseidon-surge", tier: 1 });

  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({
    input: {
      snapshot: Profile.resolveRunSnapshot(profile),
      protocolAuthority: RunHeader.deriveProtocolAuthority(profile),
      loadoutIds: ["sentinel"],
      mission: mission({ protocolLoan: { protocolId: "poseidon-surge", tier: 2 } }),
    },
  })), /always Tier 1/);

  profile = Progression.planSetProtocolLoadout(profile, [
    { slot: 0, protocolId: "temporal-edict", tier: 1 },
  ]).profile;
  const duplicate = RunHeader.createRunHeaderV2(headerInput({
    input: {
      snapshot: Profile.resolveRunSnapshot(profile),
      protocolAuthority: RunHeader.deriveProtocolAuthority(profile),
      loadoutIds: ["sentinel"],
      mission: mission({ protocolLoan: { protocolId: "temporal-edict", tier: 1 } }),
    },
  }));
  assert.equal(duplicate.missionProtocolLoan, null,
    "a loan for an owned Protocol is dropped rather than duplicating an equipped slot");
  const missionWithoutLoan = RunHeader.createRunHeaderV2(headerInput({
    input: {
      snapshot: Profile.resolveRunSnapshot(profile),
      protocolAuthority: RunHeader.deriveProtocolAuthority(profile),
      loadoutIds: ["sentinel"],
    },
  }));
  assert.equal(missionWithoutLoan.missionProtocolLoan, null);
});

test("run header validates difficulty, seed, assist, ruleset hash, and gate mode", () => {
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({ input: { difficultyId: "nightmare" } })),
    /story, strategos, or titan/);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({ input: { seed: -1 } })), /between 0/);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({ input: { seed: 4294967296 } })), /between 0/);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({ input: { assist: "yes" } })), /boolean/);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({ input: { rulesetHash: "sha256:zz" } })),
    /lowercase sha256/);
  assert.throws(() => RunHeader.createRunHeaderV2(headerInput({
    input: { mission: mission({ tutorial: { upgradeGateMode: "m02-wave3" } }) },
  })), /Unsupported Tutorial Upgrade gate mode/);
  assert.equal(
    RunHeader.createRunHeaderV2(headerInput({ input: { mission: mission({ tutorial: undefined }) } }))
      .tutorialUpgradeGateMode,
    "none"
  );
  assert.equal(
    RunHeader.createRunHeaderV2(headerInput({
      input: { mission: mission({ id: "m01", tutorial: { upgradeGateMode: "m01-wave1" } }) },
    })).tutorialUpgradeGateMode,
    "m01-wave1"
  );
});

test("run header input is an exact record and rejects unknown or missing fields", () => {
  const input = headerInput();
  assert.throws(() => RunHeader.createRunHeaderV2(Object.assign({}, input, { wallClockMs: 1 })),
    /must contain exactly/);
  const missing = Object.assign({}, input);
  delete missing.seed;
  assert.throws(() => RunHeader.createRunHeaderV2(missing), /must contain exactly/);
});

test("the built header normalizes as a replay-v2 envelope without translation", () => {
  const header = RunHeader.createRunHeaderV2(headerInput());
  const envelope = ReplayV2.normalizeReplayEnvelope(Object.assign({}, header, {
    inputs: [],
    checkpoints: [],
    finalClaim: {
      outcome: "victory",
      score: 1200,
      laurels: 3,
      durationTicks: 900,
      finalStateHash: "b".repeat(64),
    },
  }));
  RunHeader.HEADER_FIELDS.forEach((field) => {
    assert.deepEqual(
      JSON.parse(JSON.stringify(envelope[field])),
      JSON.parse(JSON.stringify(header[field])),
      field
    );
  });
});

test("the run header derives a run authorization the progression planner accepts", () => {
  const header = RunHeader.createRunHeaderV2(headerInput());
  const authorization = Progression.deriveRunAuthorization(header, "candidate-v4");
  assert.equal(authorization.formatVersion, Progression.RUN_AUTHORIZATION_FORMAT_VERSION);
  assert.equal(authorization.missionId, "m05");
  assert.deepEqual(authorization.loadoutIds, ["chronos", "sentinel"]);
  assert.equal(authorization.profileContentIdentity, "candidate-v4");
});

test("run-header-v2 installs as a frozen collision-safe classic script", () => {
  const filename = path.join(__dirname, "../js/delivery/run-header-v2.js");
  const source = fs.readFileSync(filename, "utf8");
  const context = { globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename });
  assert.equal(context.Game.AegisRunHeaderV2.FORMAT_VERSION, 2);
  assert.equal(Object.isFrozen(context.Game.AegisRunHeaderV2), true);
  const conflict = { globalThis: null, Game: { AegisRunHeaderV2: {} } };
  conflict.globalThis = conflict;
  assert.throws(() => vm.runInNewContext(source, conflict, { filename }),
    /Conflicting Game\.AegisRunHeaderV2/);
});
