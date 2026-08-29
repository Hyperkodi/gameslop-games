"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB_ROOT = path.join(REPO_ROOT, "tools", "lib", "aegis");
const Catalog = require(path.join(LIB_ROOT, "v4-rule-catalog.js"));
const Canonical = require(path.join(LIB_ROOT, "canonical.js"));
const Compiler = require(path.join(LIB_ROOT, "v4-unlock-compiler.js"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function checkedInRecordSet() {
  const output = {};
  ["protocols", "relics", "specializations", "reinforcements", "mechanisms", "progression"].forEach(
    function (domain) {
      output[domain] = JSON.parse(fs.readFileSync(
        path.join(__dirname, "..", "content-v4", domain, "binding-v1.json"),
        "utf8"
      ));
    }
  );
  return output;
}

test("v4 unlock compilation emits one deeply frozen canonical simulation partition", () => {
  const input = checkedInRecordSet();
  const compiled = Compiler.compileUnlockSimulationContent(input);
  assert.deepEqual(Object.keys(compiled), [
    "schemaVersion",
    "eventSchemaVersion",
    "behaviorRegistryVersion",
    "commandSchemaVersion",
    "replayFormatVersion",
    "profileSchemaVersion",
    "protocolRules",
    "relicRules",
    "reinforcementRules",
    "protocols",
    "relics",
    "specializations",
    "reinforcements",
    "mechanisms",
    "grantRecords",
    "missionProgression",
  ]);
  assert.equal(compiled.schemaVersion, 4);
  assert.equal(compiled.eventSchemaVersion, 2);
  assert.equal(compiled.protocols.length, 10);
  assert.equal(compiled.specializations.length, 30);
  assert.equal(compiled.relics.length, 8);
  assert.equal(compiled.reinforcements.length, 3);
  assert.equal(compiled.mechanisms.length, 5);
  assert.equal(Object.isFrozen(compiled), true);
  assert.equal(Object.isFrozen(compiled.protocols[0].tiers[0].effect), true);
  assert.doesNotThrow(function () { Canonical.canonicalEncode(compiled); });
});

test("compiler strips presentation copy keys while retaining simulation and grant identities", () => {
  const compiled = Compiler.compileUnlockSimulationContent(checkedInRecordSet());
  const text = Canonical.canonicalEncode(compiled);
  ["nameKey", "benefitKey", "drawbackKey", "presentation", "asset", "sprite"].forEach(function (token) {
    assert.equal(text.includes('"' + token + '"'), false, token);
  });
  assert.equal(compiled.protocols[8].id, "temporal-edict");
  assert.equal(compiled.protocols[8].tiers[1].effect.magnitudeBp, 5000);
  assert.equal(compiled.relics[1].benefitModifiers[0].amount, 25);
  assert.equal(compiled.specializations[23].id, "sentinel-twin-lance");
  assert.equal(compiled.grantRecords.some(function (record) {
    return record.id === "grant.specialization.sentinel-twin-lance";
  }), true);
});

test("two builds are byte-identical and never retain or mutate caller data", () => {
  const input = checkedInRecordSet();
  const before = JSON.stringify(input);
  const first = Compiler.compileUnlockSimulationContent(input);
  const second = Compiler.compileUnlockSimulationContent(clone(input));
  assert.notStrictEqual(first, second);
  assert.deepEqual(Canonical.canonicalBytes(first), Canonical.canonicalBytes(second));
  assert.equal(JSON.stringify(input), before);
  input.protocols.records[0].tiers[0].baseCostAether = 1;
  assert.equal(first.protocols[0].tiers[0].baseCostAether, 70);
});

test("compiled records cross-reference every unlock, mission loan, and first-victory grant", () => {
  const compiled = Compiler.compileUnlockSimulationContent(checkedInRecordSet());
  const grantIds = new Set(compiled.grantRecords.map(function (record) { return record.id; }));
  compiled.protocols.forEach(function (record) { assert.ok(grantIds.has(record.unlockGrantId)); });
  compiled.relics.forEach(function (record) { assert.ok(grantIds.has(record.unlockGrantId)); });
  compiled.specializations.forEach(function (record) { assert.ok(grantIds.has(record.unlockGrantId)); });
  compiled.reinforcements.forEach(function (record) { assert.ok(grantIds.has(record.unlockGrantId)); });
  const protocolIds = new Set(compiled.protocols.map(function (record) { return record.id; }));
  compiled.missionProgression.forEach(function (record) {
    record.loanProtocolIds.forEach(function (id) { assert.ok(protocolIds.has(id)); });
    record.firstVictoryGrantIds.forEach(function (id) { assert.ok(grantIds.has(id)); });
  });
});

test("compiler rejects drift before emitting a partial partition", () => {
  const source = checkedInRecordSet();
  source.protocols.records[8].tiers[0].baseCostAether = 74;
  assert.throws(
    function () { Compiler.compileUnlockSimulationContent(source); },
    function (error) {
      assert.equal(error.diagnostics[0].code, "V4_PROTOCOL_BINDING");
      assert.equal(error.diagnostics[0].path, "/protocols/records/8/tiers/0/baseCostAether");
      return true;
    }
  );
});

test("compiled versions and domain counts cannot drift from the v4 catalog", () => {
  const compiled = Compiler.compileUnlockSimulationContent(checkedInRecordSet());
  assert.equal(compiled.schemaVersion, Catalog.CONTENT_SCHEMA_VERSION);
  assert.equal(compiled.eventSchemaVersion, Catalog.EVENT_SCHEMA_VERSION);
  assert.equal(compiled.behaviorRegistryVersion, Catalog.BEHAVIOR_REGISTRY_VERSION);
  assert.equal(compiled.commandSchemaVersion, Catalog.COMMAND_SCHEMA_VERSION);
  assert.equal(compiled.replayFormatVersion, Catalog.REPLAY_FORMAT_VERSION);
  assert.equal(compiled.profileSchemaVersion, Catalog.PROFILE_SCHEMA_VERSION);
  assert.deepEqual(compiled.protocols.map(function (record) { return record.id; }), Catalog.PROTOCOL_IDS);
  assert.deepEqual(compiled.specializations.map(function (record) { return record.id; }), Catalog.SPECIALIZATION_IDS);
});
