"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const CONTENT_ROOT = path.join(__dirname, "..", "content");
const LIB_ROOT = path.join(REPO_ROOT, "tools", "lib", "aegis");
const Contracts = require(path.join(LIB_ROOT, "v3-record-contracts.js"));
const MapAdapter = require(path.join(LIB_ROOT, "v3-map-adapter.js"));
const { parseExactDecimal } = require(path.join(LIB_ROOT, "exact-decimal.js"));

function readContentJson() {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_ROOT, ...arguments), "utf8"));
}

function campaignRules() {
  return Contracts.validateCampaignRules(readContentJson("campaign-rules", "slice-v1.json"));
}

function defenses() {
  return Contracts.validateDefenseSource(readContentJson("defenses", "slice-v1.json"));
}

function enemies() {
  return Contracts.validateEnemySource(readContentJson("enemies", "slice-v1.json"));
}

function mission(id) {
  return Contracts.validateMissionSource(readContentJson("missions", id + ".slice-v1.json"));
}

function mapSource(id) {
  return readContentJson("maps", id + ".slice-v1.json");
}

function normalizedMap(id, missionIndex) {
  const definition = mission(id);
  return MapAdapter.normalizeAndValidateMap({
    mission: definition,
    missionIndex: missionIndex,
    manifestMission: { id: id },
    mapSource: mapSource(id),
    campaignRules: campaignRules(),
    defenses: defenses(),
  });
}

function grossStrategosAether(definition, carriedCampaignAether) {
  return definition.baseStartAether + carriedCampaignAether + definition.waves.reduce(function (sum, wave) {
    return sum + wave.baseAetherEnvelope;
  }, 0);
}

function cheapestLevelOneCost(defenseCatalog) {
  return Math.min(...defenseCatalog.records.map(function (record) {
    return record.levels[0].purchase.costAether;
  }));
}

test("candidate Guardian remains an armor archetype without shield pools or shield events", function () {
  const enemyCatalog = enemies();
  const guardian = enemyCatalog.records.find(function (record) { return record.id === "guardian"; });
  assert.ok(guardian, "candidate slice must contain Guardian");
  assert.deepEqual(guardian.shieldPools, []);
  assert.deepEqual(
    guardian.semanticEventIds.filter(function (eventId) { return eventId.startsWith("shield."); }),
    []
  );

  const eventCatalog = Contracts.validateEventCatalog(readContentJson("events", "slice-v1.json"));
  assert.deepEqual(
    eventCatalog.records.filter(function (record) { return record.id.startsWith("shield."); }),
    [],
    "the slice event catalog must not retain Guardian-only shield schemas"
  );
});

test("candidate Scout is faster than the baseline Raider", function () {
  const enemyCatalog = enemies();
  const scout = enemyCatalog.records.find(function (record) { return record.id === "scout"; });
  const raider = enemyCatalog.records.find(function (record) { return record.id === "raider"; });
  assert.ok(scout && raider, "candidate slice must contain Scout and Raider");

  const scoutSpeed = parseExactDecimal(scout.speedWorldUnitsPerSecond, 1000, "/enemies/scout/speedWorldUnitsPerSecond");
  const raiderSpeed = parseExactDecimal(raider.speedWorldUnitsPerSecond, 1000, "/enemies/raider/speedWorldUnitsPerSecond");
  assert.ok(scoutSpeed > raiderSpeed, "Scout must remain the fast archetype and Raider the baseline body");
});

test("m05 previews Titan before its first lethal deployment", function () {
  const definition = mission("m05");
  const firstTitanWave = definition.waves.find(function (wave) {
    return wave.groups.some(function (group) { return group.spawnKind === "enemy" && group.enemyId === "titan"; });
  });
  assert.ok(firstTitanWave, "m05 must deploy Titan");

  const titanPreviews = definition.previewDeclarations.filter(function (record) {
    return /titan/i.test(record.id + " " + record.mechanicId);
  });
  assert.equal(titanPreviews.length, 1, "m05 needs one stable Titan preview declaration");
  const preview = titanPreviews[0];
  assert.equal(preview.firstLethalWaveIndex, firstTitanWave.index);

  const attachedPreviewWaves = definition.waves.filter(function (wave) {
    return wave.previewDeclarationIds.includes(preview.id);
  }).map(function (wave) { return wave.index; });
  assert.ok(
    attachedPreviewWaves.some(function (waveIndex) { return waveIndex < firstTitanWave.index; }),
    "Titan preview must be attached to a wave before Titan can leak or deal lethal pressure"
  );
});

test("m04 and reserve-resolved m05 cannot saturate every pad with the cheapest L1", function () {
  const rules = campaignRules();
  const defenseCatalog = defenses();
  const m04 = mission("m04");
  const m05 = mission("m05");
  const cheapestCost = cheapestLevelOneCost(defenseCatalog);

  const reserveReward = m04.firstClearRewards.find(function (reward) {
    return reward.kind === "campaign-modifier";
  });
  assert.ok(reserveReward, "m04 must grant Reserve Capacitor I");
  const reserve = rules.campaignModifierRecords.find(function (record) {
    return record.id === reserveReward.campaignModifierId;
  });
  assert.ok(reserve, "m04 Reserve reward must resolve through campaign rules");
  assert.equal(reserveReward.amountAether, reserve.amountAether);

  const cases = [
    { id: "m04", definition: m04, map: mapSource("m04"), carriedCampaignAether: 0 },
    { id: "m05", definition: m05, map: mapSource("m05"), carriedCampaignAether: reserve.amountAether },
  ];
  cases.forEach(function (entry) {
    const gross = grossStrategosAether(entry.definition, entry.carriedCampaignAether);
    const saturationCap = Math.floor(gross / cheapestCost);
    assert.ok(
      saturationCap < entry.map.pads.length,
      entry.id + " gross Strategos budget " + gross + " can buy " + saturationCap
        + " cheapest L1 defenses for only " + entry.map.pads.length + " pads"
    );
  });
});

test("candidate specialist and support pads carry passing support-intent proofs", function () {
  let exercisedPadCount = 0;
  [
    { id: "m04", missionIndex: 1 },
    { id: "m05", missionIndex: 2 },
  ].forEach(function (entry) {
    const source = mapSource(entry.id);
    const compiled = normalizedMap(entry.id, entry.missionIndex);
    const supportProofPadIds = new Set(compiled.roleProofs.filter(function (proof) {
      return proof.kind === "support";
    }).map(function (proof) { return proof.padId; }));
    const relevantPads = source.pads.filter(function (pad) {
      return pad.declaredQuality === "specialist" || pad.intent === "support";
    });
    exercisedPadCount += relevantPads.length;

    relevantPads.forEach(function (pad) {
      assert.equal(
        pad.intent,
        "support",
        entry.id + "/" + pad.id + " is Specialist and needs a visible support purpose"
      );
      assert.ok(
        supportProofPadIds.has(pad.id),
        entry.id + "/" + pad.id + " needs a passing support role proof"
      );
    });
  });
  assert.ok(exercisedPadCount > 0, "the real candidate slice must exercise specialist/support proof authoring");
});
