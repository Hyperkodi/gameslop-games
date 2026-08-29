"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB_ROOT = path.join(REPO_ROOT, "tools", "lib", "aegis");
const { AegisContentError } = require(path.join(LIB_ROOT, "diagnostics.js"));
const Catalog = require(path.join(LIB_ROOT, "v4-rule-catalog.js"));
const Contracts = require(path.join(LIB_ROOT, "v4-unlock-contracts.js"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validRecordSet() {
  return clone(Catalog.BINDING_SOURCES);
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

test("v4 unlock catalog freezes the approved roster and progression arithmetic", () => {
  assert.equal(Catalog.EVENT_SCHEMA_VERSION, 2);
  assert.equal(Catalog.BEHAVIOR_REGISTRY_VERSION, 2);
  assert.equal(Catalog.COMMAND_SCHEMA_VERSION, 2);
  assert.equal(Catalog.REPLAY_FORMAT_VERSION, 2);
  assert.equal(Catalog.PROFILE_SCHEMA_VERSION, 2);
  assert.equal(Catalog.CONTENT_SCHEMA_VERSION, 4);
  assert.equal(Catalog.PRESENTATION_SCHEMA_VERSION, 2);

  assert.equal(Catalog.PROTOCOL_IDS.length, 10);
  assert.equal(Catalog.DEFENSE_IDS.length, 15);
  assert.equal(Catalog.SPECIALIZATION_IDS.length, 30);
  assert.equal(Catalog.RELIC_IDS.length, 8);
  assert.equal(Catalog.REINFORCEMENT_IDS.length, 3);
  assert.equal(Catalog.MECHANISM_IDS.length, 5);
  assert.equal(Catalog.PROTOCOL_TIER_COSTS.reduce(function (sum, record) {
    return sum + record.incrementalLaurels;
  }, 0) * Catalog.PROTOCOL_IDS.length, 180);
  assert.equal(Object.isFrozen(Catalog.BINDING_SOURCES.protocols.records[0].tiers), true);
  assert.deepEqual(Catalog.PROTOCOL_IDS, [
    "aegis-ward",
    "armara-ascension",
    "athena-command",
    "hades-bargain",
    "hephaestus-overclock",
    "hermes-rewind",
    "medusa-lock",
    "poseidon-surge",
    "temporal-edict",
    "zeus-skyfire",
  ]);
});

test("the complete approved unlock source set validates into an unshared frozen graph", () => {
  const input = validRecordSet();
  const normalized = Contracts.validateUnlockRecordSet(input);
  assert.notStrictEqual(normalized, input);
  assert.notStrictEqual(normalized.protocols, input.protocols);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.protocols.records[0].tiers[0].effect), true);
  assert.equal(Object.isFrozen(normalized.progression.records), true);
  assert.deepEqual(normalized.protocols.records.map(function (record) { return record.id; }), Catalog.PROTOCOL_IDS);
  assert.deepEqual(normalized.relics.records.map(function (record) { return record.id; }), Catalog.RELIC_IDS);
  assert.deepEqual(normalized.specializations.records.map(function (record) { return record.id; }), Catalog.SPECIALIZATION_IDS);
});

test("checked-in v4 unlock JSON matches the approved catalog and validates by domain", () => {
  const domains = ["protocols", "relics", "specializations", "reinforcements", "mechanisms", "progression"];
  const validators = {
    protocols: Contracts.validateProtocolSource,
    relics: Contracts.validateRelicSource,
    specializations: Contracts.validateSpecializationSource,
    reinforcements: Contracts.validateReinforcementSource,
    mechanisms: Contracts.validateMechanismSource,
    progression: Contracts.validateProgressionSource,
  };
  domains.forEach(function (domain) {
    const file = path.join(__dirname, "..", "content-v4", domain, "binding-v1.json");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.deepEqual(parsed, Catalog.BINDING_SOURCES[domain], domain);
    assert.deepEqual(validators[domain](parsed), Catalog.BINDING_SOURCES[domain], domain);
  });
});

test("protocol records lock exact tiers, costs, targets, effects, and event identities", () => {
  let source = validRecordSet().protocols;
  source.records.find(function (record) { return record.id === "temporal-edict"; }).tiers[1].effect.magnitudeBp = 4999;
  expectDiagnostic(
    function () { Contracts.validateProtocolSource(source); },
    "V4_PROTOCOL_BINDING",
    "/records/8/tiers/1/effect/magnitudeBp"
  );

  source = validRecordSet().protocols;
  source.records.find(function (record) { return record.id === "zeus-skyfire"; }).tiers[2].baseCostAether = 189;
  expectDiagnostic(
    function () { Contracts.validateProtocolSource(source); },
    "V4_PROTOCOL_BINDING",
    "/records/9/tiers/2/baseCostAether"
  );

  source = validRecordSet().protocols;
  source.records.find(function (record) { return record.id === "medusa-lock"; }).targetKind = "none";
  expectDiagnostic(
    function () { Contracts.validateProtocolSource(source); },
    "V4_PROTOCOL_BINDING",
    "/records/6/targetKind"
  );

  source = validRecordSet().protocols;
  source.records[0].tiers[0].extra = true;
  expectDiagnostic(
    function () { Contracts.validateProtocolSource(source); },
    "SCHEMA_UNKNOWN_KEY",
    "/records/0/tiers/0/extra"
  );
});

test("protocol source rejects missing, duplicate, unsorted, shared, and hostile data", () => {
  let source = validRecordSet().protocols;
  source.records.pop();
  expectDiagnostic(function () { Contracts.validateProtocolSource(source); }, "V4_PROTOCOL_IDS", "/records");

  source = validRecordSet().protocols;
  source.records.reverse();
  expectDiagnostic(function () { Contracts.validateProtocolSource(source); }, "SCHEMA_UNSTABLE_ORDER", "/records/1/id");

  source = validRecordSet().protocols;
  source.records[1].tiers = source.records[0].tiers;
  expectDiagnostic(function () { Contracts.validateProtocolSource(source); }, "SCHEMA_SHARED_REFERENCE", "/records/1/tiers");

  source = validRecordSet().protocols;
  Object.defineProperty(source.records[0], "id", { enumerable: true, get: function () { return "aegis-ward"; } });
  expectDiagnostic(function () { Contracts.validateProtocolSource(source); }, "SCHEMA_DATA_PROPERTY", "/records/0/id");

  source = validRecordSet().protocols;
  Object.setPrototypeOf(source.records[0], { inherited: true });
  expectDiagnostic(function () { Contracts.validateProtocolSource(source); }, "SCHEMA_OBJECT", "/records/0");
});

test("Relics lock one visible benefit and drawback bundle with exact modifier math", () => {
  const source = validRecordSet().relics;
  const normalized = Contracts.validateRelicSource(source);
  assert.equal(normalized.records.length, 8);
  normalized.records.forEach(function (record) {
    assert.ok(record.benefitModifiers.length > 0);
    assert.ok(record.drawbackModifiers.length > 0);
  });

  const changed = validRecordSet().relics;
  changed.records.find(function (record) { return record.id === "bronze-obol"; }).benefitModifiers[0].amount = 26;
  expectDiagnostic(
    function () { Contracts.validateRelicSource(changed); },
    "V4_RELIC_BINDING",
    "/records/1/benefitModifiers/0/amount"
  );
});

test("specialization identities form two exact Level-3 branches for every defense", () => {
  const normalized = Contracts.validateSpecializationSource(validRecordSet().specializations);
  Catalog.DEFENSE_IDS.forEach(function (defenseId) {
    const records = normalized.records.filter(function (record) { return record.defenseId === defenseId; });
    assert.equal(records.length, 2, defenseId);
    assert.equal(records.filter(function (record) { return record.isDefault; }).length, 1, defenseId);
    assert.equal(records[0].level3CostAether, records[1].level3CostAether, defenseId);
  });

  const changed = validRecordSet().specializations;
  changed.records.find(function (record) { return record.id === "sentinel-twin-lance"; }).level3CostAether = 96;
  expectDiagnostic(
    function () { Contracts.validateSpecializationSource(changed); },
    "V4_SPECIALIZATION_BINDING",
    "/records/23/level3CostAether"
  );
});

test("reinforcement and mechanism sources preserve the exact approved action catalog", () => {
  const units = Contracts.validateReinforcementSource(validRecordSet().reinforcements);
  const mechanisms = Contracts.validateMechanismSource(validRecordSet().mechanisms);
  assert.equal(units.records.length, 3);
  assert.equal(mechanisms.records.length, 5);

  let changed = validRecordSet().reinforcements;
  changed.records[2].lifetimeMs = 21000;
  expectDiagnostic(
    function () { Contracts.validateReinforcementSource(changed); },
    "V4_REINFORCEMENT_BINDING",
    "/records/2/lifetimeMs"
  );

  changed = validRecordSet().mechanisms;
  changed.records.find(function (record) { return record.id === "bridgefall"; }).effect.mutatesRouteTopology = true;
  expectDiagnostic(
    function () { Contracts.validateMechanismSource(changed); },
    "V4_MECHANISM_BINDING",
    "/records/1/effect/mutatesRouteTopology"
  );
});

test("progression bundles preserve existing rewards and exact unlock cadence", () => {
  const normalized = Contracts.validateProgressionSource(validRecordSet().progression);
  assert.equal(normalized.protocolRules.maximumSlotCap, 2);
  assert.equal(normalized.relicRules.maximumSlotCap, 2);
  assert.equal(normalized.reinforcementRules.maximumSlotCap, 1);
  assert.equal(normalized.protocolRules.maximumLaurels, 180);

  const m05 = normalized.records.find(function (record) { return record.missionId === "m05"; });
  assert.deepEqual(m05.loanProtocolIds, ["temporal-edict"]);
  assert.ok(m05.firstVictoryGrantIds.includes("grant.protocol.temporal-edict"));
  assert.ok(m05.firstVictoryGrantIds.includes("grant.protocol-slots.1"));

  const changed = validRecordSet().progression;
  changed.protocolRules.tierCosts[2].cumulativeLaurels = 17;
  expectDiagnostic(
    function () { Contracts.validateProgressionSource(changed); },
    "V4_PROGRESSION_BINDING",
    "/protocolRules/tierCosts/2/cumulativeLaurels"
  );
});

test("cross-record validation rejects unresolved grants and domain IDs", () => {
  let source = validRecordSet();
  source.progression.records[4].firstVictoryGrantIds.push("grant.protocol.unknown");
  source.progression.records[4].firstVictoryGrantIds.sort();
  expectDiagnostic(
    function () { Contracts.validateUnlockRecordSet(source); },
    "V4_PROGRESSION_BINDING",
    "/progression/records/4/firstVictoryGrantIds"
  );

  source = validRecordSet();
  source.specializations.records[0].defenseId = "unknown-defense";
  expectDiagnostic(
    function () { Contracts.validateUnlockRecordSet(source); },
    "V4_SPECIALIZATION_BINDING",
    "/specializations/records/0/defenseId"
  );
});
