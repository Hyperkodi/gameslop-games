"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ReplayV1 = require("../js/sim/replay.js");
const ReplayV2 = require("../js/sim/replay-v2.js");
const Formats = require("../js/sim/replay-formats.js");

const RULESET_HASH = "sha256:" + "a".repeat(64);
const FINAL_HASH = "b".repeat(64);

function v1Envelope() {
  return {
    formatVersion: 1,
    rulesetHash: RULESET_HASH,
    eventSchemaVersion: 1,
    missionId: "m01",
    difficultyId: "strategos",
    assist: false,
    seed: 1,
    loadoutIds: ["sentinel"],
    loadoutSlotCap: 4,
    campaignModifierIds: [],
    accessGrantIds: [],
    tutorialUpgradeGateMode: "none",
    inputs: [],
    checkpoints: [],
    finalClaim: {
      outcome: "victory",
      score: 1,
      laurels: 1,
      durationTicks: 1,
      finalStateHash: FINAL_HASH,
    },
  };
}

function v2Envelope() {
  return Object.assign({}, v1Envelope(), {
    formatVersion: 2,
    eventSchemaVersion: 2,
    protocolLoadout: [],
    protocolSlotCap: 0,
    protocolAuthority: [],
    missionProtocolLoan: null,
    relicIds: [],
    relicSlotCap: 0,
    reinforcementId: null,
    specializationAccessIds: [],
  });
}

test("replay format registry exposes two disjoint frozen declared contracts", () => {
  assert.equal(Object.isFrozen(Formats), true);
  assert.deepEqual(Formats.FORMAT_VERSIONS, [1, 2]);
  assert.equal(Object.isFrozen(Formats.FORMAT_VERSIONS), true);
  assert.strictEqual(Formats.getReplayApi(1), ReplayV1);
  assert.strictEqual(Formats.getReplayApi(2), ReplayV2);
  assert.throws(function () { Formats.getReplayApi(0); }, /unsupported.*format/i);
  assert.throws(function () { Formats.getReplayApi("2"); }, /safe integer|format/i);
});

test("declared normalization and parsing never infer a version from envelope fields", () => {
  assert.deepEqual(
    Formats.normalizeReplayEnvelope(1, v1Envelope()),
    ReplayV1.normalizeReplayEnvelope(v1Envelope())
  );
  assert.deepEqual(
    Formats.normalizeReplayEnvelope(2, v2Envelope()),
    ReplayV2.normalizeReplayEnvelope(v2Envelope())
  );
  assert.throws(function () { Formats.normalizeReplayEnvelope(1, v2Envelope()); }, /exactly|format/i);
  assert.throws(function () { Formats.normalizeReplayEnvelope(2, v1Envelope()); }, /exactly|format/i);

  const v1Text = ReplayV1.canonicalEnvelopeString(v1Envelope());
  const v2Text = ReplayV2.canonicalEnvelopeString(v2Envelope());
  assert.deepEqual(Formats.parseReplayEnvelope(1, v1Text), ReplayV1.parseReplayEnvelope(v1Text));
  assert.deepEqual(Formats.parseReplayEnvelope(2, v2Text), ReplayV2.parseReplayEnvelope(v2Text));
  assert.throws(function () { Formats.parseReplayEnvelope(1, v2Text); }, /exactly|format/i);
  assert.throws(function () { Formats.parseReplayEnvelope(2, v1Text); }, /exactly|format/i);
});

test("canonical dispatch preserves each version's exact historical bytes", () => {
  assert.deepEqual(
    Formats.canonicalEnvelopeBytes(1, v1Envelope()),
    ReplayV1.canonicalEnvelopeBytes(v1Envelope())
  );
  assert.deepEqual(
    Formats.canonicalEnvelopeBytes(2, v2Envelope()),
    ReplayV2.canonicalEnvelopeBytes(v2Envelope())
  );
});

test("browser registry installs without replacing either version API", () => {
  const context = { Game: { AegisReplay: ReplayV1, AegisReplayV2: ReplayV2 } };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "js", "sim", "replay-formats.js"), "utf8"),
    context,
    { filename: "replay-formats.js" }
  );
  assert.strictEqual(context.Game.AegisReplay, ReplayV1);
  assert.strictEqual(context.Game.AegisReplayV2, ReplayV2);
  assert.equal(context.Game.AegisReplayFormats.getReplayApi(2), ReplayV2);
});
