"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB_ROOT = path.join(REPO_ROOT, "tools", "lib", "aegis");
const RECORD_ROOT = path.join(__dirname, "fixtures", "compiler", "v3-records", "valid");
const ROLE_MAP_PATH = path.join(__dirname, "fixtures", "map-proofs", "valid-role-map.json");
const V1_MAP_PATH = path.join(__dirname, "..", "content", "maps", "m01.json");
const Contracts = require(path.join(LIB_ROOT, "v3-record-contracts.js"));
const Adapter = require(path.join(LIB_ROOT, "v3-map-adapter.js"));
const { AegisContentError } = require(path.join(LIB_ROOT, "diagnostics.js"));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hopliteRecord(defenses) {
  return defenses.records.find(function (record) { return record.id === "hoplite"; });
}

function validatedRecords(options) {
  const settings = options || {};
  const campaignRules = readJson(path.join(RECORD_ROOT, "campaign-rules.json"));
  const defenses = readJson(path.join(RECORD_ROOT, "defenses.json"));
  const mission = readJson(path.join(RECORD_ROOT, "missions", "m01.json"));
  const ranges = settings.ranges || ["20", "25", "30"];
  hopliteRecord(defenses).levels.forEach(function (level, index) {
    level.rangeWorldUnits = ranges[index];
  });
  mission.mapId = settings.mapId || "fixture.role-proofs";
  if (settings.availableDefenseIds) mission.availableDefenseIds = settings.availableDefenseIds.slice();
  return {
    campaignRules: Contracts.validateCampaignRules(campaignRules),
    defenses: Contracts.validateDefenseSource(defenses),
    mission: Contracts.validateMissionSource(mission),
  };
}

function roleMap() {
  const source = readJson(ROLE_MAP_PATH);
  source.roleProofs[3] = {
    id: "proof.support.p02",
    kind: "support",
    version: 1,
    padId: "p02",
    rangeWorldUnits: 40,
    eligibleDefenseTagIds: ["support"],
    expectedNeighborPadIds: ["p01", "p03"],
    minimumEligibleNeighborCount: 2,
  };
  return source;
}

function adapterInput(records, mapSource, supplement) {
  const input = {
    mission: records.mission,
    missionIndex: 0,
    manifestMission: { id: records.mission.id },
    mapSource: mapSource,
    campaignRules: records.campaignRules,
    defenses: records.defenses,
  };
  if (arguments.length === 3) input.mapProofSupplement = supplement;
  return input;
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, error && error.stack);
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

test("adapter exports one stable compiler seam and derives the complete role-proof context", function () {
  assert.deepEqual(Object.keys(Adapter), ["normalizeAndValidateMap"]);
  assert.equal(Object.isFrozen(Adapter), true);
  assert.equal(Adapter.normalizeAndValidateMap.length, 1);

  const records = validatedRecords();
  const source = roleMap();
  const sourceBefore = JSON.stringify(source);
  const ir = Adapter.normalizeAndValidateMap(adapterInput(records, source, undefined));

  assert.equal(JSON.stringify(source), sourceBefore);
  assert.equal(Object.isFrozen(ir), true);
  assert.equal(ir.id, "fixture.role-proofs");
  const guards = ir.roleProofs.filter(function (proof) { return proof.kind === "guard"; });
  assert.equal(guards.length, 3);
  guards.forEach(function (proof) {
    assert.equal(proof.projectionRangeMilliUnits, 20000);
    assert.equal(proof.slotComparatorId, "guard-contact-v1");
    assert.equal(proof.contactComparatorId, "guard-contact-v1");
  });
  const support = ir.roleProofs.find(function (proof) { return proof.kind === "support"; });
  assert.equal(support.mode, "friendly-neighbor");
  assert.deepEqual(support.eligibleDefenseTagIds, ["support"]);
});

test("guard requirements and support tags derive only from mission-eligible defenses", function () {
  const missingGuard = roleMap();
  missingGuard.roleProofs = missingGuard.roleProofs.filter(function (proof) {
    return proof.id !== "proof.guard.p03";
  });
  const withHoplite = validatedRecords();
  expectDiagnostic(
    function () { Adapter.normalizeAndValidateMap(adapterInput(withHoplite, missingGuard)); },
    "ROLE_PROOF_REQUIRED",
    "/pads/p03"
  );

  const withoutHoplite = validatedRecords({
    availableDefenseIds: ["chronos", "oracle", "sentinel", "siege"],
  });
  const ir = Adapter.normalizeAndValidateMap(adapterInput(withoutHoplite, missingGuard));
  assert.equal(ir.roleProofs.some(function (proof) { return proof.padId === "p03" && proof.kind === "guard"; }), false);

  const withoutOracle = validatedRecords({
    availableDefenseIds: ["chronos", "hoplite", "sentinel", "siege"],
  });
  expectDiagnostic(
    function () { Adapter.normalizeAndValidateMap(adapterInput(withoutOracle, roleMap())); },
    "ROLE_PROOF_TAG_REFERENCE",
    "/roleProofs/3/eligibleDefenseTagIds/0"
  );
});

test("map-v1 receives a supplement only when supplied while map-v2 never receives one", function () {
  const records = validatedRecords({
    availableDefenseIds: ["chronos", "oracle", "sentinel", "siege"],
    mapId: "m01",
  });
  const source = readJson(V1_MAP_PATH);
  const supplement = {
    schemaVersion: 1,
    id: "m01.guard-v1",
    mapId: "m01",
    normalizedMapSchemaVersion: 2,
    roleProofs: [],
  };

  const ir = Adapter.normalizeAndValidateMap(adapterInput(records, source, supplement));
  assert.equal(ir.id, "m01");
  assert.deepEqual(ir.roleProofs, []);
  expectDiagnostic(
    function () { Adapter.normalizeAndValidateMap(adapterInput(records, source)); },
    "MAP_PROOF_SUPPLEMENT_REQUIRED"
  );
  expectDiagnostic(
    function () { Adapter.normalizeAndValidateMap(adapterInput(records, source, undefined)); },
    "MAP_PROOF_SUPPLEMENT_REQUIRED"
  );
  expectDiagnostic(
    function () { Adapter.normalizeAndValidateMap(adapterInput(records, roleMap(), supplement)); },
    "MAP_PROOF_SUPPLEMENT_FORBIDDEN"
  );
});

test("Hoplite range derivation fails closed on missing and fractional values", function (t) {
  const rangePath = "/defenses/records/1/levels/0/rangeWorldUnits";
  const cases = [
    {
      name: "missing",
      mutate: function (input) { delete hopliteRecord(input.defenses).levels[0].rangeWorldUnits; },
    },
    {
      name: "fractional",
      mutate: function (input) { hopliteRecord(input.defenses).levels[0].rangeWorldUnits = "20.5"; },
    },
  ];
  cases.forEach(function (entry) {
    t.test(entry.name, function () {
      const records = clone(validatedRecords());
      entry.mutate(records);
      expectDiagnostic(
        function () { Adapter.normalizeAndValidateMap(adapterInput(records, roleMap())); },
        "V3_MAP_ADAPTER_RANGE",
        rangePath
      );
    });
  });
});

test("Hoplite behavior and comparator derivation rejects missing, duplicate, drifted, and unclosed records", function (t) {
  const behaviorPath = "/defenses/records/1/levels/0/behaviors";
  const slotPath = "/defenses/records/1/levels/1/behaviors/0/parameters/slotComparatorId";
  const cases = [
    {
      name: "missing spawnUnit slot behavior",
      code: "V3_MAP_ADAPTER_BEHAVIOR",
      path: behaviorPath,
      mutate: function (input) { hopliteRecord(input.defenses).levels[0].behaviors.shift(); },
    },
    {
      name: "duplicate spawnUnit slot behavior",
      code: "V3_MAP_ADAPTER_BEHAVIOR",
      path: behaviorPath,
      mutate: function (input) {
        const level = hopliteRecord(input.defenses).levels[0];
        const duplicate = clone(level.behaviors[0]);
        duplicate.id = "guard-slots-duplicate";
        level.behaviors.push(duplicate);
      },
    },
    {
      name: "slot comparator drift",
      code: "V3_MAP_ADAPTER_COMPARATOR",
      path: slotPath,
      mutate: function (input) {
        hopliteRecord(input.defenses).levels[1].behaviors[0].parameters.slotComparatorId = "remaining-route-distance-asc";
      },
    },
    {
      name: "closed catalog omission",
      code: "V3_MAP_ADAPTER_COMPARATOR",
      path: "/defenses/records/1/levels/0/behaviors/0/parameters/slotComparatorId",
      mutate: function (input) {
        input.campaignRules.ruleCatalog.comparatorIds = input.campaignRules.ruleCatalog.comparatorIds.filter(function (id) {
          return id !== "guard-contact-v1";
        });
      },
    },
  ];
  cases.forEach(function (entry) {
    t.test(entry.name, function () {
      const records = clone(validatedRecords());
      entry.mutate(records);
      expectDiagnostic(
        function () { Adapter.normalizeAndValidateMap(adapterInput(records, roleMap())); },
        entry.code,
        entry.path
      );
    });
  });
});

test("adapter rejects missing Hoplite and unresolved mission defense references deterministically", function () {
  const missingHoplite = clone(validatedRecords());
  missingHoplite.defenses.records = missingHoplite.defenses.records.filter(function (record) {
    return record.id !== "hoplite";
  });
  expectDiagnostic(
    function () { Adapter.normalizeAndValidateMap(adapterInput(missingHoplite, roleMap())); },
    "V3_MAP_ADAPTER_HOPLITE",
    "/defenses/records"
  );

  const unknown = clone(validatedRecords());
  unknown.mission.availableDefenseIds.push("unknown-defense");
  expectDiagnostic(
    function () { Adapter.normalizeAndValidateMap(adapterInput(unknown, roleMap())); },
    "V3_MAP_ADAPTER_MISSION_DEFENSES",
    "/missions/0/availableDefenseIds/5"
  );
});
