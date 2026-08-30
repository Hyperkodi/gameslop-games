"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB = path.join(REPO_ROOT, "tools", "lib", "aegis");
const CONTENT_V4 = path.join(REPO_ROOT, "games", "aegis", "content-v4");

const Catalog = require(path.join(LIB, "v4-behavior-catalog.js"));
const RuleCatalog = require(path.join(LIB, "v4-rule-catalog.js"));
const Records = require(path.join(LIB, "v4-record-contracts.js"));
const Relics = require(path.join(REPO_ROOT, "games", "aegis", "js", "sim", "relics.js"));

function readSource(relative) {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_V4, relative), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectDiagnostic(run, code, diagnosticPath) {
  let thrown = null;
  try { run(); } catch (error) { thrown = error; }
  assert.ok(thrown, "expected " + code + " but nothing was thrown");
  assert.equal(thrown.name, "AegisContentError", String(thrown && thrown.stack));
  const matched = thrown.diagnostics.some(function (item) {
    return item.code === code && (diagnosticPath === undefined || item.path === diagnosticPath);
  });
  assert.ok(matched, "expected " + code + " " + (diagnosticPath || "") + " in " + JSON.stringify(thrown.diagnostics));
}

test("behavior registry v2 retains every v1 contract and adds only closed data deliveries", () => {
  const v1 = require(path.join(LIB, "v3-rule-catalog.js"));
  v1.BEHAVIOR_CONTRACTS.forEach(function (contract) {
    assert.ok(
      Catalog.BEHAVIOR_CONTRACTS.some(function (record) {
        return record.id === contract.id && record.version === contract.version;
      }),
      "registry v2 must retain " + contract.id + "@" + contract.version
    );
  });
  v1.BEHAVIOR_DELIVERIES.forEach(function (delivery) {
    const key = delivery.contractId + "@" + delivery.version + "/" + delivery.deliveryKind;
    assert.ok(Object.prototype.hasOwnProperty.call(Catalog.DELIVERY_SPECS, key), "retained delivery " + key);
    assert.deepEqual(
      Object.keys(Catalog.DELIVERY_SPECS[key]),
      delivery.parameterFields.slice(),
      "retained v1 delivery parameter set must stay byte-compatible: " + key
    );
  });
  assert.equal(Catalog.BEHAVIOR_REGISTRY_VERSION, 2);
  assert.equal(Catalog.EVENT_SCHEMA_VERSION, 2);
  assert.equal(Catalog.COMMAND_SCHEMA_VERSION, 2);
  assert.equal(Catalog.REPLAY_FORMAT_VERSION, 2);
  assert.equal(Catalog.CONTENT_SCHEMA_VERSION, 4);
  // The catalog is data only: no delivery specification may carry a callable.
  JSON.parse(JSON.stringify(Catalog.DELIVERY_SPECS));
});

test("authored relic clamp table mirrors the runtime resolver exactly", () => {
  const runtime = Relics.STAT_POLICIES;
  assert.deepEqual(
    Catalog.RELIC_STAT_POLICIES.map(function (record) { return record.statId; }),
    Object.keys(runtime).sort()
  );
  Catalog.RELIC_STAT_POLICIES.forEach(function (record) {
    const policy = runtime[record.statId];
    assert.equal(record.operation, policy.operation, record.statId + " operation");
    assert.equal(record.rounding, policy.rounding, record.statId + " rounding");
    assert.equal(record.baseAmount, policy.baseAmount, record.statId + " baseAmount");
    assert.equal(record.minimum, policy.minimum, record.statId + " minimum");
    assert.equal(record.maximum, policy.maximum, record.statId + " maximum");
  });
});

test("checked-in v4 campaign rules validate and lock every unlock rule field", () => {
  const rules = readSource("campaign-rules/candidate-v4.json");
  const normalized = Records.validateV4CampaignRules(rules);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(normalized.schemaVersion, 2);
  assert.equal(normalized.protocolRules.sharedCooldownMs, 15000);
  assert.equal(normalized.protocolRules.repeatCostStepBp, 2500);
  assert.equal(normalized.protocolRules.maximumSlotCap, 2);
  assert.equal(normalized.relicRules.maximumSlotCap, 2);
  assert.equal(normalized.reinforcementRules.maximumActive, 1);
  assert.equal(normalized.reconRules.simulationAffecting, false);
  assert.deepEqual(normalized.targetShapeIds, ["none", "route-point", "tower", "world-vector"]);
  assert.deepEqual(normalized.combatSourceKinds, ["mechanism", "protocol", "tower", "unit"]);
  assert.deepEqual(normalized.profileGrantKinds, Catalog.PROFILE_GRANT_KINDS.slice());
  assert.deepEqual(
    normalized.accessGrantIds,
    Catalog.DEFENSE_IDS.map(function (id) { return "campaign." + id; })
  );

  expectDiagnostic(function () {
    const drift = clone(rules);
    drift.protocolRules.sharedCooldownMs = 12000;
    Records.validateV4CampaignRules(drift);
  }, "SCHEMA_RANGE", "/protocolRules/sharedCooldownMs");
  expectDiagnostic(function () {
    const drift = clone(rules);
    drift.relicRules.statPolicies[1].maximum = 20000;
    Records.validateV4CampaignRules(drift);
  }, "V4_RELIC_CLAMP_LOCK", "/relicRules/statPolicies/1/maximum");
  expectDiagnostic(function () {
    const drift = clone(rules);
    drift.protocolRules.tierCosts[2].cumulativeLaurels = 17;
    Records.validateV4CampaignRules(drift);
  }, "V4_PROTOCOL_TIER_LOCK", "/protocolRules/tierCosts/2");
  expectDiagnostic(function () {
    const drift = clone(rules);
    drift.targetShapeIds = ["none", "route-point", "tower"];
    Records.validateV4CampaignRules(drift);
  }, "SCHEMA_LIMIT", "/targetShapeIds");
  expectDiagnostic(function () {
    const drift = clone(rules);
    drift.unexpected = 1;
    Records.validateV4CampaignRules(drift);
  }, "SCHEMA_UNKNOWN_KEY", "/unexpected");
  expectDiagnostic(function () {
    const drift = clone(rules);
    delete drift.reconRules;
    Records.validateV4CampaignRules(drift);
  }, "SCHEMA_REQUIRED", "/reconRules");
  expectDiagnostic(function () {
    const drift = clone(rules);
    drift.schemaVersion = 1;
    Records.validateV4CampaignRules(drift);
  }, "SCHEMA_RANGE", "/schemaVersion");
});

test("checked-in v4 defenses carry two paid levels and two complete Level-3 branches", () => {
  const defenses = readSource("defenses/candidate-v4.json");
  const normalized = Records.validateV4DefenseSource(defenses);
  assert.equal(normalized.records.length, 15);
  assert.deepEqual(
    normalized.records.map(function (record) { return record.id; }),
    Catalog.DEFENSE_IDS.slice()
  );

  const branchIds = [];
  normalized.records.forEach(function (record) {
    const costs = Catalog.DEFENSE_COSTS[record.id];
    assert.equal(record.levels.length, 2, record.id + " has exactly two paid in-run levels");
    assert.equal(record.levels[0].purchase.kind, "build");
    assert.equal(record.levels[0].purchase.costAether, costs[0]);
    assert.equal(record.levels[1].purchase.kind, "upgrade");
    assert.equal(record.levels[1].purchase.costAether, costs[1]);
    assert.equal(record.specializations.length, 2, record.id + " has exactly two branches");
    const defaults = record.specializations.filter(function (branch) { return branch.isDefault; });
    assert.equal(defaults.length, 1, record.id + " has exactly one default branch");
    record.specializations.forEach(function (branch) {
      assert.equal(branch.level, 3);
      assert.equal(branch.purchase.kind, "specialize");
      assert.equal(branch.purchase.costAether, costs[2], branch.id + " uses the family Level-3 cost");
      assert.equal(branch.defenseId, record.id);
      assert.ok(branch.behaviors.length >= 1);
      assert.equal(typeof branch.ui.descriptionKey, "string");
      branchIds.push(branch.id);
    });
  });
  assert.deepEqual(branchIds.slice().sort(), RuleCatalog.SPECIALIZATION_IDS.slice().sort());

  expectDiagnostic(function () {
    const drift = clone(defenses);
    drift.records[0].levels.push(clone(drift.records[0].levels[1]));
    Records.validateV4DefenseSource(drift);
  }, "SCHEMA_LIMIT", "/records/0/levels");
  expectDiagnostic(function () {
    const drift = clone(defenses);
    drift.records[0].specializations[0].purchase.costAether += 1;
    Records.validateV4DefenseSource(drift);
  }, "V4_SPECIALIZATION_COST");
  expectDiagnostic(function () {
    const drift = clone(defenses);
    drift.records[0].specializations[0].isDefault = drift.records[0].specializations[1].isDefault;
    Records.validateV4DefenseSource(drift);
  }, "V4_SPECIALIZATION_DEFAULT");
  expectDiagnostic(function () {
    const drift = clone(defenses);
    drift.records[0].levels[0].purchase.costAether += 5;
    Records.validateV4DefenseSource(drift);
  }, "V4_DEFENSE_COST_LOCK");
  expectDiagnostic(function () {
    const drift = clone(defenses);
    drift.records[0].levels[0].behaviors[0].parameters.unexpected = 1;
    Records.validateV4DefenseSource(drift);
  }, "SCHEMA_UNKNOWN_KEY");
  expectDiagnostic(function () {
    const drift = clone(defenses);
    delete drift.records[0].levels[0].behaviors[0].parameters.rangeSource;
    Records.validateV4DefenseSource(drift);
  }, "SCHEMA_REQUIRED");
  expectDiagnostic(function () {
    const drift = clone(defenses);
    drift.records[0].levels[0].behaviors[0].deliveryKind = "not-a-delivery";
    Records.validateV4DefenseSource(drift);
  }, "BEHAVIOR_DELIVERY");
  expectDiagnostic(function () {
    const drift = clone(defenses);
    drift.records.splice(14, 1);
    Records.validateV4DefenseSource(drift);
  }, "SCHEMA_LIMIT", "/records");
});

test("checked-in v4 event catalog is schema 2 over the retained and new ABI phase identities", () => {
  const events = readSource("events/candidate-v4.json");
  const normalized = Records.validateV4EventCatalog(events);
  assert.equal(normalized.schemaVersion, 2);
  normalized.records.forEach(function (record) {
    assert.ok(Catalog.PHASE_IDS.indexOf(record.phaseId) >= 0, record.id + " phase");
  });
  const ids = normalized.records.map(function (record) { return record.id; });
  RuleCatalog.PROTOCOL_IDS.forEach(function (protocolId) {
    assert.ok(ids.indexOf("protocol." + protocolId + ".accepted") >= 0);
    assert.ok(ids.indexOf("protocol." + protocolId + ".resolved") >= 0);
  });
  assert.equal(
    normalized.records.find(function (record) { return record.id === "protocol.aegis-ward.accepted"; }).phaseId,
    "commands-and-aether-payments"
  );
  expectDiagnostic(function () {
    const drift = clone(events);
    drift.schemaVersion = 1;
    Records.validateV4EventCatalog(drift);
  }, "SCHEMA_RANGE", "/schemaVersion");
  expectDiagnostic(function () {
    const drift = clone(events);
    drift.records[0].phaseId = "not-a-phase";
    Records.validateV4EventCatalog(drift);
  }, "SCHEMA_ENUM", "/records/0/phaseId");
});

test("v4 missions add exactly protocolLoan, mechanism, and reinforcement markers", () => {
  const mission = readSource("missions/m05.candidate-v4.json");
  const normalized = Records.validateV4MissionSource(mission);
  assert.equal(normalized.schemaVersion, 2);
  assert.deepEqual(normalized.protocolLoan, { protocolId: "temporal-edict", tier: 1 });
  assert.equal(normalized.mechanism, null);
  assert.deepEqual(normalized.reinforcementMarkers, []);
  assert.deepEqual(
    Records.validateV4MissionSource(readSource("missions/m01.candidate-v4.json")).protocolLoan,
    null
  );

  assert.equal(normalized.briefing.storyKey, "m05.story");
  assert.deepEqual(
    normalized.waves.map(function (wave) { return wave.noteKey; }),
    [
      "m05.wave.01.note", "m05.wave.02.note", "m05.wave.03.note", "m05.wave.04.note",
      "m05.wave.05.note", "m05.wave.06.note", "m05.wave.07.note", "m05.wave.08.note",
    ]
  );

  expectDiagnostic(function () {
    const drift = clone(mission);
    delete drift.briefing.storyKey;
    Records.validateV4MissionSource(drift);
  }, "SCHEMA_REQUIRED", "/briefing/storyKey");
  expectDiagnostic(function () {
    const drift = clone(mission);
    delete drift.waves[2].noteKey;
    Records.validateV4MissionSource(drift);
  }, "SCHEMA_REQUIRED", "/waves/2/noteKey");
  expectDiagnostic(function () {
    const drift = clone(mission);
    drift.waves[0].noteKey = "not a key";
    Records.validateV4MissionSource(drift);
  }, "SCHEMA_STRING", "/waves/0/noteKey");
  expectDiagnostic(function () {
    const drift = clone(mission);
    drift.briefing.extraKey = "m05.story";
    Records.validateV4MissionSource(drift);
  }, "SCHEMA_UNKNOWN_KEY", "/briefing/extraKey");

  expectDiagnostic(function () {
    const drift = clone(mission);
    drift.protocolLoan.tier = 2;
    Records.validateV4MissionSource(drift);
  }, "V4_PROTOCOL_LOAN_TIER", "/protocolLoan/tier");
  expectDiagnostic(function () {
    const drift = clone(mission);
    delete drift.reinforcementMarkers;
    Records.validateV4MissionSource(drift);
  }, "SCHEMA_REQUIRED", "/reinforcementMarkers");
  expectDiagnostic(function () {
    const drift = clone(mission);
    drift.schemaVersion = 1;
    Records.validateV4MissionSource(drift);
  }, "SCHEMA_LITERAL", "/schemaVersion");
  expectDiagnostic(function () {
    const drift = clone(mission);
    drift.reinforcementMarkers = [{ id: "marker.a", column: 40, row: 4, supportedReinforcementIds: ["artemis-scout"] }];
    Records.validateV4MissionSource(drift);
  }, "SCHEMA_RANGE", "/reinforcementMarkers/0/column");
  expectDiagnostic(function () {
    const drift = clone(mission);
    drift.mechanism = { mechanismId: "bronze-city-gate", activations: [] };
    Records.validateV4MissionSource(drift);
  }, "SCHEMA_LIMIT", "/mechanism/activations");
  expectDiagnostic(function () {
    const drift = clone(mission);
    drift.mechanism = {
      mechanismId: "bronze-city-gate",
      activations: [{ id: "gate.a", kind: "not-a-kind", geometryId: "geometry.gate.a" }],
    };
    Records.validateV4MissionSource(drift);
  }, "SCHEMA_ENUM", "/mechanism/activations/0/kind");
});

test("the checked-in act catalog is four contiguous acts plus four recon briefing lines", () => {
  const acts = readSource("acts/candidate-v4.json");
  const normalized = Records.validateV4ActSource(acts);
  assert.equal(normalized.schemaVersion, Records.ACT_SOURCE_SCHEMA_VERSION);
  assert.equal(normalized.records.length, Records.ACT_COUNT);
  assert.deepEqual(normalized.records.map(function (record) { return record.index; }), [1, 2, 3, 4]);
  normalized.records.forEach(function (record) {
    assert.deepEqual(Object.keys(record).sort(), Records.ACT_RECORD_FIELDS.slice().sort());
  });
  assert.deepEqual(normalized.records[0].missionIds, ["m01", "m04", "m05"]);
  assert.deepEqual(
    normalized.reconRecords.map(function (record) { return record.tier; }),
    [0, 1, 2, 3]
  );

  expectDiagnostic(function () {
    const drift = clone(acts);
    drift.records[2].index = 5;
    Records.validateV4ActSource(drift);
  }, "SCHEMA_RANGE", "/records/2/index");
  expectDiagnostic(function () {
    const drift = clone(acts);
    drift.records.pop();
    Records.validateV4ActSource(drift);
  }, "SCHEMA_LIMIT", "/records");
  expectDiagnostic(function () {
    const drift = clone(acts);
    drift.records[0].missionIds = ["m04", "m01", "m05"];
    Records.validateV4ActSource(drift);
  }, "SCHEMA_UNSTABLE_ORDER", "/records/0/missionIds/1");
  expectDiagnostic(function () {
    const drift = clone(acts);
    drift.records[1].missionIds = ["m01"];
    Records.validateV4ActSource(drift);
  }, "SCHEMA_DUPLICATE_ID", "/records/1/missionIds/0");
  expectDiagnostic(function () {
    const drift = clone(acts);
    drift.records[0].missionIds = ["m21"];
    Records.validateV4ActSource(drift);
  }, "SCHEMA_STRING", "/records/0/missionIds/0");
  expectDiagnostic(function () {
    const drift = clone(acts);
    delete drift.records[3].eraKey;
    Records.validateV4ActSource(drift);
  }, "SCHEMA_REQUIRED", "/records/3/eraKey");
  expectDiagnostic(function () {
    const drift = clone(acts);
    drift.records[0].bannerAsset = "art/act-1.png";
    Records.validateV4ActSource(drift);
  }, "SCHEMA_UNKNOWN_KEY", "/records/0/bannerAsset");
  expectDiagnostic(function () {
    const drift = clone(acts);
    drift.reconRecords[3].tier = 4;
    Records.validateV4ActSource(drift);
  }, "SCHEMA_RANGE", "/reconRecords/3/tier");
  expectDiagnostic(function () {
    const drift = clone(acts);
    drift.reconRecords.push({ tier: 4, detailKey: "recon.4.detail" });
    Records.validateV4ActSource(drift);
  }, "SCHEMA_LIMIT", "/reconRecords");
});
