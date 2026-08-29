"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI_V1 = require("../js/sim/abi.js");
const ABI = require("../js/sim/abi-v2.js");
const CommandsV2 = require("../js/sim/commands-v2.js");
const ReplayV1 = require("../js/sim/replay.js");
const ReplayV2 = require("../js/sim/replay-v2.js");

const RULESET_HASH = "sha256:" + "a".repeat(64);
const FINAL_HASH = "b".repeat(64);

function validEnvelope(overrides) {
  return Object.assign({
    formatVersion: 2,
    rulesetHash: RULESET_HASH,
    eventSchemaVersion: 2,
    missionId: "m10",
    difficultyId: "strategos",
    assist: false,
    seed: 123,
    loadoutIds: ["sentinel", "chronos", "siege"],
    loadoutSlotCap: 6,
    campaignModifierIds: ["reserve-1"],
    accessGrantIds: ["campaign.chronos", "campaign.siege"],
    tutorialUpgradeGateMode: "none",
    protocolLoadout: [
      { slot: 0, protocolId: "temporal-edict", tier: 2 },
      { slot: 1, protocolId: "zeus-skyfire", tier: 1 },
    ],
    protocolSlotCap: 2,
    protocolAuthority: [
      { protocolId: "temporal-edict", availableTier: 2 },
      { protocolId: "zeus-skyfire", availableTier: 1 },
    ],
    missionProtocolLoan: { protocolId: "aegis-ward", tier: 1 },
    relicIds: ["bronze-obol", "owl-lens"],
    relicSlotCap: 2,
    reinforcementId: "spartan-phalanx",
    specializationAccessIds: ["sentinel-lock-on", "sentinel-twin-lance"],
    inputs: [{
      tick: 10,
      seq: 0,
      type: "activatePower",
      protocolId: "temporal-edict",
      tier: 2,
      target: { kind: "none" },
    }],
    checkpoints: [{ tick: 60, diagnosticHash: "fnv1a32:1234abcd" }],
    finalClaim: {
      outcome: "victory",
      score: 12345,
      laurels: 3,
      durationTicks: 120,
      finalStateHash: FINAL_HASH,
    },
  }, overrides || {});
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("replay-v2 API is frozen and binds explicit v2 identities", () => {
  assert.equal(Object.isFrozen(ReplayV2), true);
  assert.equal(Object.isFrozen(ReplayV2.DEFAULT_LIMITS), true);
  assert.equal(ReplayV2.FORMAT_VERSION, 2);
  assert.equal(ReplayV2.EVENT_SCHEMA_VERSION, 2);
  assert.equal(ReplayV2.COMMAND_SCHEMA_VERSION, 2);
  assert.equal(ReplayV2.COMMAND_SCHEMA_VERSION, CommandsV2.COMMAND_SCHEMA_VERSION);
  assert.equal(ReplayV2.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assert.equal(ReplayV2.DEFAULT_LIMITS.maxProtocolLoadout, 2);
  assert.equal(ReplayV2.DEFAULT_LIMITS.maxRelicIds, 2);
  assert.equal(ReplayV2.DEFAULT_LIMITS.maxSpecializationAccessIds, 30);
});

test("normalization preserves explicit slot order and creates an unshared frozen envelope", () => {
  const source = validEnvelope();
  const before = clone(source);
  const normalized = ReplayV2.normalizeReplayEnvelope(source);
  assert.deepEqual(source, before);
  assert.notStrictEqual(normalized, source);
  assert.notStrictEqual(normalized.protocolLoadout, source.protocolLoadout);
  assert.notStrictEqual(normalized.protocolLoadout[0], source.protocolLoadout[0]);
  assert.notStrictEqual(normalized.protocolAuthority, source.protocolAuthority);
  assert.notStrictEqual(normalized.missionProtocolLoan, source.missionProtocolLoan);
  assert.deepEqual(normalized.protocolLoadout, source.protocolLoadout);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.protocolLoadout), true);
  assert.equal(Object.isFrozen(normalized.protocolLoadout[0]), true);
  assert.equal(Object.isFrozen(normalized.missionProtocolLoan), true);
  assert.equal(Object.isFrozen(normalized.inputs[0].target), true);
  assert.doesNotThrow(function () { ABI.canonicalEncode(normalized); });
});

test("canonical replay-v2 bytes are stable and caller mutation cannot change them", () => {
  const source = validEnvelope();
  const first = ReplayV2.canonicalEnvelopeBytes(source);
  const normalized = ReplayV2.normalizeReplayEnvelope(source);
  source.protocolLoadout[0].tier = 1;
  source.inputs[0].target.kind = "tower";
  assert.deepEqual(ReplayV2.canonicalEnvelopeBytes(normalized), first);
  assert.deepEqual(
    ReplayV2.canonicalEnvelopeBytes(clone(normalized)),
    first
  );
});

test("strict v2 envelope and nested records reject omissions, additions, and ambiguous identity names", () => {
  const missing = validEnvelope();
  delete missing.protocolSlotCap;
  assert.throws(function () { ReplayV2.normalizeReplayEnvelope(missing); }, /exactly|protocolSlotCap/i);
  assert.throws(function () {
    ReplayV2.normalizeReplayEnvelope(Object.assign(validEnvelope(), { timestamp: 1 }));
  }, /exactly/i);

  const oldLoadoutName = validEnvelope();
  oldLoadoutName.protocolLoadout[0] = { slot: 0, id: "temporal-edict", tier: 2 };
  assert.throws(function () { ReplayV2.normalizeReplayEnvelope(oldLoadoutName); }, /protocolId|exactly/i);

  const oldLoanName = validEnvelope();
  oldLoanName.missionProtocolLoan = { id: "aegis-ward", tier: 1 };
  assert.throws(function () { ReplayV2.normalizeReplayEnvelope(oldLoanName); }, /protocolId|exactly/i);
});

test("Protocol, Relic, reinforcement, and specialization header invariants are exact", () => {
  const cases = [
    [{ formatVersion: 1 }, /format version.*2/i],
    [{ eventSchemaVersion: 1 }, /event schema version.*2/i],
    [{ protocolSlotCap: 3 }, /Protocol slot cap/i],
    [{ protocolSlotCap: 1 }, /Protocol loadout.*slot cap/i],
    [{ protocolAuthority: [
      { protocolId: "zeus-skyfire", availableTier: 1 },
      { protocolId: "temporal-edict", availableTier: 2 },
    ] }, /authority.*ASCII order/i],
    [{ protocolAuthority: [
      { protocolId: "temporal-edict", availableTier: 2 },
      { protocolId: "temporal-edict", availableTier: 3 },
    ] }, /authority.*unique|ASCII order/i],
    [{ protocolAuthority: [{ protocolId: "zeus-skyfire", availableTier: 1 }] },
      /requires permanent.*authority/i],
    [{ protocolAuthority: [
      { protocolId: "temporal-edict", availableTier: 1 },
      { protocolId: "zeus-skyfire", availableTier: 1 },
    ] }, /exceeds.*available tier/i],
    [{ protocolLoadout: [
      { slot: 0, protocolId: "temporal-edict", tier: 2 },
      { slot: 0, protocolId: "zeus-skyfire", tier: 1 },
    ] }, /slot.*order|slot.*unique/i],
    [{ protocolLoadout: [
      { slot: 0, protocolId: "temporal-edict", tier: 2 },
      { slot: 1, protocolId: "temporal-edict", tier: 1 },
    ] }, /Protocol.*unique|duplicate/i],
    [{ missionProtocolLoan: { protocolId: "temporal-edict", tier: 1 } }, /loan.*equipped|duplicate/i],
    [{ missionProtocolLoan: { protocolId: "aegis-ward", tier: 2 } }, /loan tier/i],
    [{ relicIds: ["owl-lens", "bronze-obol"] }, /Relic.*ASCII order/i],
    [{ relicIds: ["bronze-obol", "bronze-obol"] }, /Relic.*unique|ASCII order/i],
    [{ relicSlotCap: 1 }, /Relic.*slot cap/i],
    [{ reinforcementId: "Spartan" }, /reinforcement.*ASCII ID/i],
    [{ specializationAccessIds: ["sentinel-twin-lance", "sentinel-lock-on"] }, /specialization.*ASCII order/i],
  ];
  cases.forEach(function (entry) {
    assert.throws(function () {
      ReplayV2.normalizeReplayEnvelope(validEnvelope(entry[0]));
    }, entry[1], JSON.stringify(entry[0]));
  });

  const empty = ReplayV2.normalizeReplayEnvelope(validEnvelope({
    protocolLoadout: [],
    protocolSlotCap: 0,
    protocolAuthority: [],
    missionProtocolLoan: null,
    relicIds: [],
    relicSlotCap: 0,
    reinforcementId: null,
    specializationAccessIds: [],
    inputs: [],
  }));
  assert.deepEqual(empty.protocolLoadout, []);
  assert.equal(empty.missionProtocolLoan, null);
  assert.equal(empty.reinforcementId, null);
});

test("Commands-v2 owns retained and added input shapes, ordering, and tick bounds", () => {
  const source = validEnvelope({
    inputs: [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "activateMechanism", mechanismId: "bridgefall", activationId: "a01" },
      { tick: 1, seq: 0, type: "deployReinforcement", reinforcementId: "spartan-phalanx", markerId: "r01" },
    ],
  });
  assert.deepEqual(ReplayV2.normalizeReplayEnvelope(source).inputs, source.inputs);

  const oldName = validEnvelope();
  oldName.inputs[0] = {
    tick: 10, seq: 0, type: "activatePower", powerId: "temporal-edict", tier: 2,
    target: { kind: "none" },
  };
  assert.throws(function () { ReplayV2.normalizeReplayEnvelope(oldName); }, /protocolId|exactly/i);

  const unprocessed = validEnvelope();
  unprocessed.inputs[0].tick = unprocessed.finalClaim.durationTicks;
  assert.throws(function () { ReplayV2.normalizeReplayEnvelope(unprocessed); }, /strictly less/i);
});

test("hostile object graphs fail before accessors execute", () => {
  let getterRuns = 0;
  const accessor = validEnvelope();
  Object.defineProperty(accessor, "protocolSlotCap", {
    enumerable: true,
    get: function () { getterRuns += 1; return 2; },
  });
  assert.throws(function () { ReplayV2.normalizeReplayEnvelope(accessor); }, /data propert|accessor/i);
  assert.equal(getterRuns, 0);

  const shared = { slot: 0, protocolId: "temporal-edict", tier: 1 };
  const repeated = validEnvelope({ protocolLoadout: [shared, shared] });
  assert.throws(function () { ReplayV2.normalizeReplayEnvelope(repeated); }, /shared reference|cycle/i);

  const sparse = validEnvelope();
  sparse.specializationAccessIds = new Array(1);
  assert.throws(function () { ReplayV2.normalizeReplayEnvelope(sparse); }, /sparse|data propert/i);
});

test("strict replay-v2 text parsing rejects duplicate keys, trailing data, and lone surrogates", () => {
  const canonical = ReplayV2.canonicalEnvelopeString(validEnvelope());
  assert.deepEqual(
    ReplayV2.parseReplayEnvelope(canonical),
    ReplayV2.normalizeReplayEnvelope(validEnvelope())
  );
  assert.throws(function () {
    ReplayV2.parseReplayEnvelope(canonical.replace(
      '"protocolSlotCap":2',
      '"protocolSlotCap":2,"protocolSlotCap":2'
    ));
  }, /duplicate/i);
  assert.throws(function () { ReplayV2.parseReplayEnvelope(canonical + "x"); }, /trailing|JSON/i);
  assert.throws(function () {
    ReplayV2.parseReplayEnvelope(canonical.replace('"m10"', '"m\\ud800"'));
  }, /surrogate|Unicode|JSON/i);
});

test("replay-v1 remains a disjoint unchanged contract", () => {
  assert.equal(ReplayV1.FORMAT_VERSION, 1);
  assert.equal(ReplayV1.EVENT_SCHEMA_VERSION, 1);
  assert.throws(function () { ReplayV1.normalizeReplayEnvelope(validEnvelope()); }, /exactly|format version/i);
  assert.throws(function () {
    ReplayV2.normalizeReplayEnvelope(Object.assign(validEnvelope(), { formatVersion: 1 }));
  }, /format version.*2/i);
});

test("browser UMD installs replay-v2 without replacing replay-v1", () => {
  const context = {
    Game: {
      AegisSimV2: ABI,
      AegisCommandsV2: CommandsV2,
      AegisReplay: ReplayV1,
    },
  };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "js", "sim", "replay-v2.js"), "utf8"),
    context,
    { filename: "replay-v2.js" }
  );
  assert.equal(context.Game.AegisReplay, ReplayV1);
  assert.equal(context.Game.AegisReplayV2.FORMAT_VERSION, 2);
  assert.equal(typeof context.Game.AegisReplayV2.normalizeReplayEnvelope, "function");
});

test("browser UMD rejects a v1 ABI wired into the v2 slot", () => {
  const context = {
    Game: { AegisSimV2: ABI_V1, AegisCommandsV2: CommandsV2, AegisReplay: ReplayV1 },
  };
  vm.createContext(context);
  assert.throws(function () {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", "js", "sim", "replay-v2.js"), "utf8"),
      context
    );
  }, /ABI v2/i);
});
