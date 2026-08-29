"use strict";

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

const MODULE_PATH = path.join(__dirname, "..", "js", "progression", "victory-transaction.js");
const RULESET_HASH = "sha256:" + "ab".repeat(32);
const FINAL_HASH = "cd".repeat(32);
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;

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
  return Profile.createProfileV2("candidate-v4");
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

function resultFacts(overrides) {
  return Object.assign({
    missionId: "m01",
    difficultyId: "story",
    completedObjectiveIds: ["victory"],
    defenseEvidence: [{ defenseId: "sentinel", highestLevel: 2, specializationIds: [] }],
  }, overrides || {});
}

function buildInput(overrides) {
  const profile = freshProfile();
  const header = startHeader(profile);
  return Object.assign({
    profile: profile,
    revision: 0,
    header: header,
    replayEnvelope: envelopeFor(header),
    resultFacts: resultFacts(),
    contentIdentity: "candidate-v4",
    journalTimestamp: 1700000000000,
  }, overrides || {});
}

test("victory-transaction publishes a frozen CommonJS and collision-safe browser UMD contract", () => {
  assertDeepFrozen(VictoryTransaction);
  assert.equal(VictoryTransaction.TRANSACTION_SCHEMA_VERSION, 2);
  assert.equal(typeof VictoryTransaction.createVictoryTransaction, "function");
  assert.equal(typeof VictoryTransaction.validateVictoryTransaction, "function");
  /* The start header is exactly the replay-v2 envelope minus its three run-body fields. */
  assert.equal(VictoryTransaction.START_HEADER_FIELDS.length, 20);
  ["inputs", "checkpoints", "finalClaim"].forEach((field) => {
    assert.equal(VictoryTransaction.START_HEADER_FIELDS.includes(field), false);
  });

  const source = fs.readFileSync(MODULE_PATH, "utf8");
  const sandbox = {
    Game: {
      AegisProfileV2: Profile,
      AegisProgression: Progression,
      AegisReplayV2: ReplayV2,
      AegisSimV2: ABI,
    },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: MODULE_PATH });
  assert.equal(typeof sandbox.Game.AegisVictoryTransaction.createVictoryTransaction, "function");
  assert.equal(Object.isFrozen(sandbox.Game.AegisVictoryTransaction), true);
  const descriptor = Object.getOwnPropertyDescriptor(sandbox.Game, "AegisVictoryTransaction");
  assert.equal(descriptor.writable, false);
  assert.equal(descriptor.configurable, false);
  assert.throws(() => vm.runInNewContext(source, sandbox, { filename: MODULE_PATH }), /already installed/);

  const foreign = { Game: { AegisProfileV2: Profile, AegisProgression: Progression, AegisReplayV2: ReplayV2, AegisSimV2: ABI, AegisVictoryTransaction: {} } };
  foreign.globalThis = foreign;
  assert.throws(() => vm.runInNewContext(source, foreign, { filename: MODULE_PATH }), /already installed/);
  const missing = { Game: { AegisProfileV2: Profile } };
  missing.globalThis = missing;
  assert.throws(() => vm.runInNewContext(source, missing, { filename: MODULE_PATH }), /must be installed/);
});

test("createVictoryTransaction builds a deep-frozen golden whose ids are stable across runs", () => {
  const input = buildInput();
  const before = clone(input);
  const first = VictoryTransaction.createVictoryTransaction(input);
  const second = VictoryTransaction.createVictoryTransaction(buildInput());
  assert.deepEqual(input, before, "inputs are never mutated");
  assertDeepFrozen(first);
  assert.equal(ABI.canonicalEncode(first), ABI.canonicalEncode(second));

  assert.deepEqual(Object.keys(first), [
    "schemaVersion", "contentIdentity", "baseRevision", "profileBefore", "profileAfter",
    "plan", "result", "replay", "journalEntry",
  ]);
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.contentIdentity, "candidate-v4");
  assert.equal(first.baseRevision, 0);
  assert.deepEqual(first.profileBefore, freshProfile());
  assert.deepEqual(first.profileAfter.completedMissionIds, ["m01"]);
  assert.deepEqual(first.profileAfter.earnedLaurelIds, ["m01:story:victory"]);

  assert.deepEqual(first.plan, {
    changed: true,
    firstClear: true,
    grantIdsApplied: ["grant.defense.hoplite", "grant.specialization.sentinel-twin-lance"],
    laurelIdsAdded: ["m01:story:victory"],
    masteryChanges: [{
      defenseId: "sentinel",
      fieldedAdded: true,
      temperedAdded: true,
      masteredAdded: false,
      strategosVictoryAdded: false,
      specializationIdsAdded: [],
      specializationAccessIdsAdded: ["sentinel-twin-lance"],
    }],
    repairs: [],
  });

  assert.deepEqual(Object.keys(first.result), VictoryTransaction.RESULT_FIELDS);
  assert.match(first.result.resultId, SHA256_ID);
  assert.match(first.result.replayId, SHA256_ID);
  assert.equal(first.result.outcome, "victory");
  assert.equal(first.result.missionId, "m01");
  assert.equal(first.result.difficultyId, "story");
  assert.equal(first.result.score, 1200);
  assert.equal(first.result.durationTicks, 10);
  assert.equal(first.result.rulesetHash, RULESET_HASH);
  assert.deepEqual(first.result.runAuthorization, Progression.deriveRunAuthorization(input.header, "candidate-v4"));
  assert.deepEqual(first.result.laurelIdsAdded, first.plan.laurelIdsAdded);
  assert.deepEqual(first.result.grantIdsApplied, first.plan.grantIdsApplied);

  const expectedReplayId = "sha256:" + ABI.sha256Hex(ReplayV2.canonicalEnvelopeBytes(input.replayEnvelope));
  assert.equal(first.replay.replayId, expectedReplayId);
  assert.equal(first.result.replayId, expectedReplayId);
  assert.equal(VictoryTransaction.computeReplayId(input.replayEnvelope), expectedReplayId);
  assert.deepEqual(first.replay.envelope, ReplayV2.normalizeReplayEnvelope(input.replayEnvelope));
  const body = clone(first.result);
  delete body.resultId;
  assert.equal(first.result.resultId, "sha256:" + ABI.sha256Hex(ABI.canonicalEncode(body)));
  assert.equal(VictoryTransaction.computeResultId(body), first.result.resultId);

  /* Pinned goldens: any change to the canonical result/replay identity is a contract change. */
  assert.equal(first.replay.replayId, VictoryTransaction.GOLDEN_IDS.replayId);
  assert.equal(first.result.resultId, VictoryTransaction.GOLDEN_IDS.resultId);

  assert.deepEqual(first.journalEntry, {
    kind: "commit-victory",
    timestamp: 1700000000000,
    detail: {
      missionId: "m01",
      difficultyId: "story",
      resultId: first.result.resultId,
      replayId: first.replay.replayId,
      firstClear: true,
    },
  });
});

test("createVictoryTransaction fails closed when the envelope disagrees with the header or is not a victory", () => {
  const disagreeMission = buildInput();
  disagreeMission.replayEnvelope = envelopeFor(disagreeMission.header, { missionId: "m02" });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(disagreeMission), /missionId disagrees/i);

  const disagreeDifficulty = buildInput();
  disagreeDifficulty.replayEnvelope = envelopeFor(disagreeDifficulty.header, { difficultyId: "titan" });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(disagreeDifficulty), /difficultyId disagrees/i);

  const disagreeRuleset = buildInput();
  disagreeRuleset.replayEnvelope = envelopeFor(disagreeRuleset.header, { rulesetHash: "sha256:" + "ef".repeat(32) });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(disagreeRuleset), /rulesetHash disagrees/i);

  const disagreeLoadout = buildInput();
  disagreeLoadout.replayEnvelope = envelopeFor(disagreeLoadout.header, { loadoutIds: ["sentinel", "chronos"] });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(disagreeLoadout), /loadoutIds disagrees/i);

  const defeat = buildInput();
  defeat.replayEnvelope = envelopeFor(defeat.header);
  defeat.replayEnvelope.finalClaim.outcome = "defeat";
  assert.throws(() => VictoryTransaction.createVictoryTransaction(defeat), /not a victory/i);

  const headerWithInputs = buildInput();
  headerWithInputs.header = envelopeFor(headerWithInputs.header);
  assert.throws(() => VictoryTransaction.createVictoryTransaction(headerWithInputs), /must contain exactly/i);
});

test("createVictoryTransaction fails closed on result facts that disagree with the envelope or profile", () => {
  const wrongMission = buildInput({ resultFacts: resultFacts({ missionId: "m02" }) });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(wrongMission), /mission ID disagrees/i);

  const wrongDifficulty = buildInput({ resultFacts: resultFacts({ difficultyId: "strategos" }) });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(wrongDifficulty), /difficulty ID disagrees/i);

  const wrongLaurelCount = buildInput({ resultFacts: resultFacts({ completedObjectiveIds: ["integrity", "victory"] }) });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(wrongLaurelCount), /Laurel count disagrees/i);

  const wrongIdentity = buildInput({ contentIdentity: "other-release" });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(wrongIdentity), /content identity/i);

  const unauthorizedDefense = buildInput({
    resultFacts: resultFacts({ defenseEvidence: [{ defenseId: "hoplite", highestLevel: 1, specializationIds: [] }] }),
  });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(unauthorizedDefense), /not in the run authorization/i);

  const badRevision = buildInput({ revision: -1 });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(badRevision), /revision/i);
  const badTimestamp = buildInput({ journalTimestamp: 1.5 });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(badTimestamp), /timestamp/i);
  const extraField = buildInput({ store: {} });
  assert.throws(() => VictoryTransaction.createVictoryTransaction(extraField), /must contain exactly/i);
});

test("validateVictoryTransaction re-derives the transaction and rejects tampering and hostile input", () => {
  const golden = VictoryTransaction.createVictoryTransaction(buildInput());
  const validated = VictoryTransaction.validateVictoryTransaction(clone(golden));
  assert.equal(ABI.canonicalEncode(validated), ABI.canonicalEncode(golden));
  assertDeepFrozen(validated);

  const tamperedResultId = clone(golden);
  tamperedResultId.result.resultId = "sha256:" + "00".repeat(32);
  assert.throws(() => VictoryTransaction.validateVictoryTransaction(tamperedResultId), /re-derivation/i);

  const tamperedLaurels = clone(golden);
  tamperedLaurels.result.laurelIdsAdded = ["m01:story:integrity", "m01:story:victory"];
  assert.throws(() => VictoryTransaction.validateVictoryTransaction(tamperedLaurels), /re-derivation/i);

  const tamperedAfter = clone(golden);
  tamperedAfter.profileAfter.earnedLaurelIds = ["m01:story:integrity", "m01:story:victory"];
  assert.throws(() => VictoryTransaction.validateVictoryTransaction(tamperedAfter), /re-derivation/i);

  const tamperedEnvelope = clone(golden);
  tamperedEnvelope.replay.envelope.seed = 12;
  assert.throws(() => VictoryTransaction.validateVictoryTransaction(tamperedEnvelope), /re-derivation/i);

  const tamperedRevision = clone(golden);
  tamperedRevision.baseRevision = Number.MAX_SAFE_INTEGER + 2;
  assert.throws(() => VictoryTransaction.validateVictoryTransaction(tamperedRevision), /safe/i);

  let invoked = false;
  const hostileGetter = clone(golden);
  Object.defineProperty(hostileGetter, "profileAfter", {
    enumerable: true,
    get() { invoked = true; throw new Error("must not run"); },
  });
  assert.throws(() => VictoryTransaction.validateVictoryTransaction(hostileGetter), /enumerable data/i);
  assert.equal(invoked, false);

  const cyclic = clone(golden);
  cyclic.plan.cycle = cyclic;
  assert.throws(() => VictoryTransaction.validateVictoryTransaction(cyclic), /cycle|must contain exactly/i);

  const proto = clone(golden);
  Object.defineProperty(proto.result, "__proto__", { value: {}, enumerable: true, configurable: true, writable: true });
  assert.throws(() => VictoryTransaction.validateVictoryTransaction(proto), /forbidden key|must contain exactly/i);

  assert.throws(() => VictoryTransaction.validateVictoryTransaction(null), /plain object/i);
  assert.throws(() => VictoryTransaction.validateVictoryTransaction([]), /plain object/i);
});

test("result and replay record validators recompute identities and reject drift", () => {
  const golden = VictoryTransaction.createVictoryTransaction(buildInput());
  const result = VictoryTransaction.validateResultRecord(clone(golden.result));
  assert.deepEqual(result, golden.result);
  assertDeepFrozen(result);
  const drifted = clone(golden.result);
  drifted.score = 1201;
  assert.throws(() => VictoryTransaction.validateResultRecord(drifted), /result ID/i);
  const wrongOutcome = clone(golden.result);
  wrongOutcome.outcome = "defeat";
  assert.throws(() => VictoryTransaction.validateResultRecord(wrongOutcome), /victory/i);

  const replay = VictoryTransaction.validateReplayRecord(clone(golden.replay));
  assert.deepEqual(replay, golden.replay);
  const driftedReplay = clone(golden.replay);
  driftedReplay.envelope.seed = 99;
  assert.throws(() => VictoryTransaction.validateReplayRecord(driftedReplay), /replay ID/i);

  const entry = VictoryTransaction.validateJournalEntry({ kind: "write-profile", timestamp: 5, detail: null });
  assert.deepEqual(entry, { kind: "write-profile", timestamp: 5, detail: null });
  assert.throws(() => VictoryTransaction.validateJournalEntry({ kind: "write-profile", timestamp: -1, detail: null }), /timestamp/i);
  assert.throws(() => VictoryTransaction.validateJournalEntry({ kind: "Bad Kind", timestamp: 1, detail: null }), /kind/i);
  assert.throws(() => VictoryTransaction.validateJournalEntry({ kind: "x", timestamp: 1 }), /must contain exactly/i);
});
