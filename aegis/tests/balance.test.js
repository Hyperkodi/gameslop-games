"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const Tool = require("../../../tools/simulate-aegis.js");
const Movement = require("../js/sim/movement.js");

const FIXTURE = path.join(__dirname, "fixtures", "balance", "fake-valid.json");
const MANIFEST = "games/aegis/content/manifests/slice-dev-v1.json";

function capture() {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: { write: function (value) { stdout += value; } },
      stderr: { write: function (value) { stderr += value; } },
    },
    stdout: function () { return stdout; },
    stderr: function () { return stderr; },
  };
}

function frozen(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { frozen(value[key]); });
  return Object.freeze(value);
}

function aetherRecord(overrides) {
  return Object.assign({
    kind: "aether-transaction",
    ordinal: 0,
    action: "build",
    sourceId: "command.build",
    commandSeq: 0,
    towerRuntimeId: 1,
    padId: "pad.a",
    defenseId: "sentinel",
    levelBefore: 0,
    levelAfter: 1,
    debitAether: 80,
    creditAether: 0,
    investedBeforeAether: 0,
    investedAfterAether: 80,
    bankBeforeAether: 210,
    bankAfterAether: 130,
    bountyRemainderBefore: 0,
    bountyRemainderAfter: 0,
  }, overrides || {});
}

function damageRecord(overrides) {
  return Object.assign({
    kind: "damage",
    ordinal: 0,
    sourceTowerRuntimeId: 1,
    sourceRuntimeId: 1,
    defenseId: "sentinel",
    level: 1,
    padId: "pad.a",
    targetRuntimeId: 4,
    targetOwnerId: "enemy.scout",
    targetLineageId: "lineage.4",
    targetRouteId: "route.main",
    damageTypeId: "kinetic",
    baseDamageMilli: 12000,
    preShieldDamageMilli: 12000,
    attemptedShieldDamageMilli: 0,
    appliedShieldDamageMilli: 0,
    eligibleHpDamageMilli: 12000,
    appliedHpDamageMilli: 10000,
    deferredHpDamageMilli: 0,
    overkillHpDamageMilli: 2000,
    noExternalAppliedShieldDamageMilli: 0,
    noExternalAppliedHpDamageMilli: 8000,
    targetShieldBeforeMilli: 0,
    targetShieldAfterMilli: 0,
    targetHpBeforeMilli: 10000,
    targetHpAfterMilli: 0,
    supportSourceTowerRuntimeIds: [2],
    revealSourceTowerRuntimeIds: [],
  }, overrides || {});
}

function spawnRecord(overrides) {
  return Object.assign({
    kind: "spawn", ordinal: 0, entityKind: "enemy", enemyRuntimeId: 4,
    ownerId: "enemy.scout", lineageId: "lineage.4", routeId: "route.main",
    waveId: "m01.w01", maximumHpMilli: 10000, initialShieldMilli: 0,
    baseSpeedDistanceUnitsPerSecond: 1000,
  }, overrides || {});
}

function state(tick, bank, outcome) {
  return frozen({
    tick: tick,
    management: { aether: bank, clearedWaves: 0, phase: "wave", towers: [] },
    outcome: outcome || "active",
    score: outcome === "victory" ? 100 : 0,
    integrity: 20,
    objectiveResults: [],
  });
}

function stateWithEnemies(tick, bank, enemies, outcome, integrity) {
  return frozen({
    tick: tick,
    management: { aether: bank, clearedWaves: 0, phase: "wave", towers: [] },
    outcome: outcome || "active",
    score: 0,
    integrity: integrity === undefined ? 20 : integrity,
    objectiveResults: [],
    enemies: enemies,
  });
}

function tickResult(tick, records, nextState) {
  records.forEach(function (record, ordinal) { record.ordinal = ordinal; });
  return frozen({
    events: [],
    state: nextState,
    telemetry: { schemaVersion: 1, tick: tick, records: records },
  });
}

test("strict import-safe CLI accepts only the exact manifest/action/projection grammar", function () {
  assert.deepEqual(Tool.parseArgs(["--manifest", MANIFEST, "--check"]), {
    help: false,
    manifest: MANIFEST,
    mode: "check",
    mission: null,
    difficulty: null,
    matrix: false,
  });
  assert.deepEqual(Tool.parseArgs([
    "--manifest", MANIFEST, "--write", "--mission", "m04", "--difficulty", "titan", "--matrix",
  ]), {
    help: false,
    manifest: MANIFEST,
    mode: "write",
    mission: "m04",
    difficulty: "titan",
    matrix: true,
  });
  [
    [],
    ["--check"],
    ["--manifest", MANIFEST],
    ["--manifest", MANIFEST, "--check", "--write"],
    ["--manifest", MANIFEST, "--check", "--matrix", "--matrix"],
    ["--manifest", "../outside.json", "--check"],
    ["--manifest", "games/aegis/content/../manifest.json", "--check"],
    ["--manifest", MANIFEST, "--mission", "m02", "--check"],
    ["--manifest", MANIFEST, "--difficulty", "easy", "--check"],
    ["--manifest", MANIFEST, "--check", "--unknown"],
  ].forEach(function (argv) { assert.throws(function () { Tool.parseArgs(argv); }); });
});

test("scenario loader preserves exact bytes as provenance and rejects nonexact roots", function () {
  const bytes = fs.readFileSync(FIXTURE);
  const scenario = Tool.parseScenarioBytes(bytes, "fake-valid.json");
  assert.equal(scenario.id, "fake.loader.contract");
  assert.match(scenario.sourceHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(scenario), true);
  const prepared = Tool.prepareScenarioInput(scenario);
  assert.equal(prepared.sourceHash, scenario.sourceHash);
  assert.equal(Object.keys(prepared).includes("sourceHash"), false);
  assert.throws(function () {
    Tool.parseScenarioBytes(Buffer.from('{"commands":[],"expectations":{},"header":{},"id":"x","kind":"x","pair":null,"schemaVersion":1,"strategyVersion":"x","unknown":true}\n'));
  }, /exactly/);
  assert.throws(function () {
    Tool.parseScenarioBytes(Buffer.from('{"commands":[],"expectations":{},"header":{},"id":"x","kind":"x","pair":null,"schemaVersion":1,"schemaVersion":1,"strategyVersion":"x"}\n'));
  });
});

test("scenario catalog is explicit, sorted, hash-pinned, and source-contained", function () {
  const hashA = "sha256:" + "a".repeat(64);
  const hashB = "sha256:" + "b".repeat(64);
  const valid = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    records: [
      { id: "alpha", source: "games/aegis/tests/fixtures/balance/scenarios/m01/alpha.json", sha256: hashA },
      { id: "beta", source: "games/aegis/tests/fixtures/balance/scenarios/m04-m05/beta.json", sha256: hashB },
    ],
  }) + "\n");
  assert.equal(Tool.parseScenarioCatalogBytes(valid).records.length, 2);
  assert.throws(function () {
    Tool.parseScenarioCatalogBytes(Buffer.from(JSON.stringify({
      schemaVersion: 1,
      records: [
        { id: "beta", source: "games/aegis/tests/fixtures/balance/scenarios/m04-m05/beta.json", sha256: hashB },
        { id: "alpha", source: "games/aegis/tests/fixtures/balance/scenarios/m01/alpha.json", sha256: hashA },
      ],
    }) + "\n"));
  }, /ASCII sorted/);
  assert.throws(function () {
    Tool.parseScenarioCatalogBytes(Buffer.from(JSON.stringify({
      schemaVersion: 1,
      records: [{ id: "alpha", source: "games/aegis/tests/fixtures/balance/alpha.json", sha256: hashA }],
    }) + "\n"));
  }, /scenario root/);
});

test("largest-remainder allocation is exact, conserved, and runtime-ID deterministic", function () {
  const result = Tool.allocateLargestRemainder(10, [
    { runtimeId: 2, weight: 1 },
    { runtimeId: 7, weight: 1 },
    { runtimeId: 9, weight: 1 },
  ]);
  assert.deepEqual(result, [
    { runtimeId: 2, value: 4 },
    { runtimeId: 7, value: 3 },
    { runtimeId: 9, value: 3 },
  ]);
  assert.throws(function () {
    Tool.allocateLargestRemainder(1, [{ runtimeId: 3, weight: 1 }, { runtimeId: 2, weight: 1 }]);
  }, /ascending unique/);
});

test("bounded telemetry fold reports real economy and conserved damage without crediting overkill", function () {
  const accumulator = Tool.createBalanceAccumulator();
  const mark = {
    kind: "effect", ordinal: 0, action: "apply", sourceTowerRuntimeId: 2, sourceRuntimeId: 20,
    defenseId: "oracle", level: 1, padId: "pad.o", targetRuntimeId: 4,
    targetOwnerId: "enemy.scout", targetRouteId: "route.main",
    effectKind: "external-amplification", statusId: "mark", requestedMagnitude: 2000,
    appliedMagnitude: 2000, requestedDurationTimeUnits: 60, appliedDurationTimeUnits: 60,
    outcome: "applied",
  };
  Tool.foldTelemetryTick(accumulator, state(0, 210),
    tickResult(0, [aetherRecord(), spawnRecord(), mark], state(1, 130)));
  Tool.foldTelemetryTick(accumulator, state(1, 130), tickResult(1, [damageRecord()], state(2, 130, "victory")));
  const report = Tool.finalizeAccumulator(accumulator);
  assert.equal(report.economy.debitsAether, 80);
  assert.equal(report.economy.netConsumedAether, 80);
  assert.equal(report.economy.maximumSimultaneousInvestmentAether, 80);
  assert.equal(report.combat.attemptedDamageMilli, 12000);
  assert.equal(report.combat.appliedDamageMilli, 10000);
  assert.equal(report.combat.overkillDamageMilli, 2000);
  assert.equal(report.combat.supportValueMilli, 2000);
  assert.equal(report.combat.directValueMilli, 8000);
  assert.deepEqual(report.combatValuePerAether, { numerator: 10000, denominator: 80 });
});

test("amplification uses active effect basis-point weights and Reveal uses the lowest runtime source", function () {
  const accumulator = Tool.createBalanceAccumulator();
  const effects = [
    { tower: 2, source: 20, magnitude: 1000 },
    { tower: 3, source: 30, magnitude: 3000 },
  ].map(function (item) {
    return {
      kind: "effect", ordinal: 0, action: "apply", sourceTowerRuntimeId: item.tower,
      sourceRuntimeId: item.source, defenseId: "oracle", level: 2, padId: "pad.o" + item.tower,
      targetRuntimeId: 4, targetOwnerId: "enemy.scout", targetRouteId: "route.main",
      effectKind: "external-amplification", statusId: "mark",
      requestedMagnitude: item.magnitude, appliedMagnitude: item.magnitude,
      requestedDurationTimeUnits: 60, appliedDurationTimeUnits: 60, outcome: "applied",
    };
  });
  Tool.foldTelemetryTick(accumulator, state(0, 100),
    tickResult(0, [spawnRecord()].concat(effects), state(1, 100)));
  Tool.foldTelemetryTick(accumulator, state(1, 100), tickResult(1, [damageRecord({
    appliedHpDamageMilli: 8000, eligibleHpDamageMilli: 8000, overkillHpDamageMilli: 0,
    noExternalAppliedHpDamageMilli: 4000, targetHpAfterMilli: 2000,
    supportSourceTowerRuntimeIds: [2, 3],
  })], state(2, 100, "victory")));
  const report = Tool.finalizeAccumulator(accumulator, { requireComplete: true });
  assert.equal(report.attributionByTower["2"].supportValueMilli, 1000);
  assert.equal(report.attributionByTower["3"].supportValueMilli, 3000);
  assert.equal(report.attributionByTower["1"].directValueMilli, 4000);

  const reveal = Tool.createBalanceAccumulator();
  const revealEffects = [3, 5].map(function (towerRuntimeId) {
    return {
      kind: "effect", ordinal: 0, action: "apply", sourceTowerRuntimeId: towerRuntimeId,
      sourceRuntimeId: 40 + towerRuntimeId, defenseId: "oracle", level: 1,
      padId: "pad.r" + towerRuntimeId, targetRuntimeId: 4, targetOwnerId: "enemy.echo",
      targetRouteId: "route.main", effectKind: "status", statusId: "reveal",
      requestedMagnitude: 1, appliedMagnitude: 1, requestedDurationTimeUnits: 60,
      appliedDurationTimeUnits: 60, outcome: "applied",
    };
  });
  revealEffects.push(Object.assign({}, revealEffects[0], {
    sourceRuntimeId: 99, effectKind: "external-amplification", statusId: "mark",
    requestedMagnitude: 1000, appliedMagnitude: 1000,
  }));
  Tool.foldTelemetryTick(reveal, state(0, 100),
    tickResult(0, [spawnRecord()].concat(revealEffects), state(1, 100)));
  Tool.foldTelemetryTick(reveal, state(1, 100), tickResult(1, [damageRecord({
    appliedHpDamageMilli: 4000, eligibleHpDamageMilli: 4000, overkillHpDamageMilli: 0,
    noExternalAppliedHpDamageMilli: 4000, targetHpAfterMilli: 6000,
    supportSourceTowerRuntimeIds: [], revealSourceTowerRuntimeIds: [3, 5],
  })], state(2, 100, "victory")));
  const revealReport = Tool.finalizeAccumulator(reveal, { requireComplete: true });
  assert.equal(revealReport.attributionByTower["3"].supportValueMilli, 4000);
  assert.equal(revealReport.attributionByTower["5"], undefined);

  const missing = Tool.createBalanceAccumulator();
  Tool.foldTelemetryTick(missing, state(0, 100),
    tickResult(0, [spawnRecord()], state(1, 100)));
  assert.throws(function () {
    Tool.foldTelemetryTick(missing, state(1, 100), tickResult(1, [damageRecord()],
      state(2, 100, "victory")));
  }, /Single-source amplification lacks/);
});

test("prevented-leak P is capped by remaining durability and goes only to control distance", function () {
  const authorities = {
    movement: Movement,
    routeLengths: { "route.main": 700 },
    shadowOutsideRange: function () { return true; },
  };
  const accumulator = Tool.createBalanceAccumulator(authorities);
  const slow = {
    kind: "effect", ordinal: 0, action: "apply", sourceTowerRuntimeId: 3, sourceRuntimeId: 8,
    defenseId: "chronos", level: 1, padId: "pad.c", targetRuntimeId: 4,
    targetOwnerId: "enemy.scout", targetRouteId: "route.main", effectKind: "status",
    statusId: "slow", requestedMagnitude: 5000, appliedMagnitude: 5000,
    requestedDurationTimeUnits: 60, appliedDurationTimeUnits: 60, outcome: "applied",
  };
  Tool.foldTelemetryTick(accumulator, state(0, 100), tickResult(0, [
    spawnRecord({ baseSpeedDistanceUnitsPerSecond: 60000 }), slow,
  ], state(1, 100)));
  const movement = {
    kind: "movement-control", ordinal: 0, enemyRuntimeId: 4, ownerId: "enemy.scout",
    lineageId: "lineage.4", routeId: "route.main", priorRouteDistance: 0,
    nextRouteDistance: 500, actualAdvanceDistance: 500, effectiveSpeedBp: 5000,
    scaledReductionBp: 5000, sourceEffectRuntimeIds: [21], sourceRuntimeIds: [8],
    sourceTowerRuntimeIds: [],
  };
  const surviving = stateWithEnemies(2, 100, [{
    id: 4, hpMilli: 5000, shields: [],
  }], "victory");
  Tool.foldTelemetryTick(accumulator, state(1, 100), tickResult(1, [movement], surviving));
  assert.equal(accumulator.entities["4"].controlDistanceByTower["3"], 200,
    "prevented distance uses endpoint-capped shadow advance, not requested movement");
  const report = Tool.finalizeAccumulator(accumulator, { requireComplete: true });
  assert.equal(report.combat.preventedLeakValueMilli, 5000);
  assert.equal(report.attributionByTower["3"].preventedLeakValueMilli, 5000);
  assert.equal(report.attributionByTower["3"].directValueMilli, 0);
  assert.equal(report.entityConservation[0].preventedLeakValueMilli, 5000);
});

test("legal-random selection uses rejection sampling and exact control headers", function () {
  const draws = [4294967295, 5];
  const states = [{ draw: 1 }, { draw: 2 }];
  const selected = Tool.legalRandomIndex({
    stepNamedRngStream: function () {
      return { uint32: draws.shift(), state: states.shift() };
    },
  }, { draw: 0 }, 10);
  assert.deepEqual(selected, { index: 5, stream: { draw: 2 } });

  const source = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  source.strategyVersion = "legal-random-placement-spend-v1";
  source.header.seed = 3;
  assert.throws(function () {
    Tool.runLegalRandomScenario({}, source);
  }, /exact new-profile/);

  const emptyPlan = Tool.legalRandomPlanningBucket({
    content: {
      missions: { m01: { mapId: "empty" } },
      maps: { empty: { pads: [] } },
      defenses: {},
    },
    simulation: { AegisMovement: {} },
  }, {
    loadoutIds: [], missionId: "m01", tick: 20,
    management: {
      aether: 0, runtimeIds: { nextByDomain: { tower: 1 } },
      towers: [], tutorialUpgradeGateOpen: false,
    },
  }, {}, 1);
  assert.deepEqual(emptyPlan.commands, [{ tick: 20, seq: 0, type: "startWave" }]);
  assert.equal(emptyPlan.skippedPurchaseCount, 1);
});

test("legal-random aggregate gate requires exact seeds, eight defeats, and one late loss", function () {
  function aggregateRuns(victoryCount, lateLoss) {
    return Tool.RANDOM_CONTROL_SEEDS.map(function (seed, index) {
      const victory = index < victoryCount;
      return {
        scenario: {
          expectations: { requiredGateIds: ["m01-legal-random-control"] },
          header: { seed: seed },
          strategyVersion: "legal-random-placement-spend-v1",
        },
        result: {
          outcome: victory ? "victory" : "defeat",
          terminalWaveIndex: !victory && lateLoss && index === victoryCount ? 5 : 3,
        },
      };
    });
  }
  function legalStatus(runs) {
    return Tool.evaluateRequiredGates(runs).find(function (gate) {
      return gate.id === "m01-legal-random-control";
    }).status;
  }
  assert.equal(legalStatus(aggregateRuns(4, true)), "pass");
  assert.equal(legalStatus(aggregateRuns(5, true)), "fail");
  assert.equal(legalStatus(aggregateRuns(4, false)), "fail");
  const duplicateSeed = aggregateRuns(4, true);
  duplicateSeed[11].scenario.header.seed = duplicateSeed[10].scenario.header.seed;
  assert.equal(legalStatus(duplicateSeed), "fail");
});

test("machine-required gates ignore scenario labels and require executable proof results", function () {
  const labeled = [{
    scenario: {
      expectations: {
        requiredGateIds: ["fuzz-soak", "parser-and-runtime-limits", "replay-parity"],
      },
    },
  }];
  function statuses(machineGates) {
    const output = Object.create(null);
    Tool.evaluateRequiredGates(labeled, machineGates).forEach(function (gate) {
      output[gate.id] = gate.status;
    });
    return output;
  }
  const labelsOnly = statuses();
  Tool.MACHINE_GATE_IDS.forEach(function (gateId) {
    assert.equal(labelsOnly[gateId], "fail", gateId + " cannot pass from a fixture label");
  });
  const proved = statuses({
    "fuzz-soak": true,
    "parser-and-runtime-limits": true,
    "replay-parity": true,
  });
  Tool.MACHINE_GATE_IDS.forEach(function (gateId) {
    assert.equal(proved[gateId], "pass");
  });
});

test("replay parity consumes exact simulator proofs instead of replay labels", function () {
  const replay = {
    checkpoints: [],
    finalClaim: {
      durationTicks: 12,
      finalStateHash: "a".repeat(64),
      outcome: "victory",
      score: 900,
    },
  };
  const identities = {
    behaviorRegistryVersion: 1, eventSchemaVersion: 1, executionPath: "commonjs-source",
    releaseAbiHash: "sha256:" + "b".repeat(64),
    runtimeAbiDescriptorHash: "sha256:" + "d".repeat(64),
    simulationArtifact: "aegis-sim." + "c".repeat(64) + ".js",
    simulationHash: "sha256:" + "c".repeat(64),
  };
  const execution = {
      finalStateHash: "a".repeat(64), integrity: 7, outcome: "victory", score: 900,
      tick: 12, verifiedCheckpointCount: 0,
  };
  const run = {
    machineProofs: { replayParity: {
      bundled: execution, identities: identities, node: Object.assign({}, execution),
    } },
    replay: replay,
    result: { integrity: 7, outcome: "victory", score: 900 },
    scenario: { id: "proof-a" },
  };
  const runtime = {
    cloneInto: function (value) { return value; },
    node: { identities: identities },
    pair: {},
    simulation: { AegisReplay: {} },
  };
  assert.deepEqual(Tool.replayParityFacts(runtime, [run]), {
    bundledExecutionCount: 1,
    identities: identities,
    nodeExecutionCount: 1,
    scenarioCount: 1,
    verifiedScenarioIds: ["proof-a"],
  });
  const forged = JSON.parse(JSON.stringify(run));
  forged.machineProofs.replayParity.node.integrity = 8;
  assert.equal(Tool.replayParityFacts(runtime, [forged]), null);
});

test("out-of-range splash collateral remains direct without a winning control source", function () {
  const still = {
    createMovementState: function () { return {}; },
    advanceMovementTick: function (movementState) { return { advance: 0, state: movementState }; },
    advanceRouteProgress: function (_length, distance) {
      return { appliedAdvance: 0, distance: distance, reachedEnd: false };
    },
  };
  const accumulator = Tool.createBalanceAccumulator({
    movement: still,
    routeLengths: { "route.main": 1000 },
    shadowOutsideRange: function () { return true; },
  });
  Tool.foldTelemetryTick(accumulator, state(0, 100), tickResult(0, [spawnRecord()], state(1, 100)));
  Tool.foldTelemetryTick(accumulator, state(1, 100), tickResult(1, [{
    kind: "movement-control", ordinal: 0, enemyRuntimeId: 4, ownerId: "enemy.scout",
    lineageId: "lineage.4", routeId: "route.main", priorRouteDistance: 100,
    nextRouteDistance: 100, actualAdvanceDistance: 0, effectiveSpeedBp: 10000,
    scaledReductionBp: 0, sourceEffectRuntimeIds: [], sourceRuntimeIds: [],
    sourceTowerRuntimeIds: [],
  }], state(2, 100)));
  Tool.foldTelemetryTick(accumulator, state(2, 100), tickResult(2, [damageRecord({
    supportSourceTowerRuntimeIds: [], appliedHpDamageMilli: 4000,
    eligibleHpDamageMilli: 4000, noExternalAppliedHpDamageMilli: 4000,
    overkillHpDamageMilli: 0, targetHpAfterMilli: 6000,
  })], state(3, 100, "victory")));
  const report = Tool.finalizeAccumulator(accumulator, { requireComplete: true });
  assert.equal(report.combat.directValueMilli, 4000);
  assert.equal(report.combat.controlValueMilli, 0);
});

test("post-expiry fixed-point tails inherit historical winning control weights", function () {
  const scriptedMovement = {
    createMovementState: function () { return { step: 0 }; },
    advanceMovementTick: function (movementState) {
      const advance = movementState.step === 0 ? 10 : 11;
      return { advance: advance, state: { step: movementState.step + 1 } };
    },
    advanceRouteProgress: function (length, distance, advance) {
      const appliedAdvance = Math.min(advance, length - distance);
      return { appliedAdvance: appliedAdvance, distance: distance + appliedAdvance, reachedEnd: false };
    },
  };
  const accumulator = Tool.createBalanceAccumulator({
    movement: scriptedMovement, routeLengths: { "route.main": 100 },
    shadowOutsideRange: function () { return false; },
  });
  Tool.foldTelemetryTick(accumulator, state(0, 100), tickResult(0, [spawnRecord()], state(1, 100)));
  Tool.foldTelemetryTick(accumulator, state(1, 100), tickResult(1, [{
    kind: "movement-control", ordinal: 0, enemyRuntimeId: 4, ownerId: "enemy.scout",
    lineageId: "lineage.4", routeId: "route.main", priorRouteDistance: 0,
    nextRouteDistance: 5, actualAdvanceDistance: 5, effectiveSpeedBp: 5000,
    scaledReductionBp: 5000, sourceEffectRuntimeIds: [21], sourceRuntimeIds: [3],
    sourceTowerRuntimeIds: [3],
  }], state(2, 100)));
  Tool.foldTelemetryTick(accumulator, state(2, 100), tickResult(2, [{
    kind: "movement-control", ordinal: 0, enemyRuntimeId: 4, ownerId: "enemy.scout",
    lineageId: "lineage.4", routeId: "route.main", priorRouteDistance: 5,
    nextRouteDistance: 15, actualAdvanceDistance: 10, effectiveSpeedBp: 10000,
    scaledReductionBp: 0, sourceEffectRuntimeIds: [], sourceRuntimeIds: [],
    sourceTowerRuntimeIds: [],
  }], state(3, 100)));
  assert.equal(accumulator.entities["4"].controlDistanceByTower["3"], 6);

  const orphan = Tool.createBalanceAccumulator({
    movement: scriptedMovement, routeLengths: { "route.main": 100 },
    shadowOutsideRange: function () { return false; },
  });
  Tool.foldTelemetryTick(orphan, state(0, 100), tickResult(0, [spawnRecord()], state(1, 100)));
  assert.throws(function () {
    Tool.foldTelemetryTick(orphan, state(1, 100), tickResult(1, [{
      kind: "movement-control", ordinal: 0, enemyRuntimeId: 4, ownerId: "enemy.scout",
      lineageId: "lineage.4", routeId: "route.main", priorRouteDistance: 0,
      nextRouteDistance: 9, actualAdvanceDistance: 9, effectiveSpeedBp: 10000,
      scaledReductionBp: 0, sourceEffectRuntimeIds: [], sourceRuntimeIds: [],
      sourceTowerRuntimeIds: [],
    }], state(2, 100)));
  }, /lacks a historical winning control source/);
});

test("terminal leak arbitration never fabricates prevented-leak control credit", function () {
  const endpointMovement = {
    createMovementState: function () { return {}; },
    advanceMovementTick: function (movementState) {
      return { advance: 100, state: movementState };
    },
    advanceRouteProgress: function (length, distance, advance) {
      const appliedAdvance = Math.min(advance, length - distance);
      return {
        appliedAdvance: appliedAdvance,
        distance: distance + appliedAdvance,
        reachedEnd: distance + appliedAdvance === length,
      };
    },
  };
  function terminalAccumulator(integrity) {
    const accumulator = Tool.createBalanceAccumulator({
      movement: endpointMovement,
      routeLengths: { "route.main": 100 },
      shadowOutsideRange: function () { return false; },
    });
    Tool.foldTelemetryTick(accumulator, state(0, 100), tickResult(0, [spawnRecord()], state(1, 100)));
    Tool.foldTelemetryTick(accumulator, state(1, 100), tickResult(1, [{
      kind: "movement-control", ordinal: 0, enemyRuntimeId: 4, ownerId: "enemy.scout",
      lineageId: "lineage.4", routeId: "route.main", priorRouteDistance: 0,
      nextRouteDistance: 100, actualAdvanceDistance: 100, effectiveSpeedBp: 10000,
      scaledReductionBp: 0, sourceEffectRuntimeIds: [], sourceRuntimeIds: [],
      sourceTowerRuntimeIds: [],
    }], stateWithEnemies(2, 100, [{ id: 4, hpMilli: 5000, shields: [] }], "defeat", integrity)));
    return accumulator;
  }
  const gateDestroyed = Tool.finalizeAccumulator(terminalAccumulator(0), { requireComplete: true });
  assert.equal(gateDestroyed.combat.preventedLeakValueMilli, 0);
  assert.equal(gateDestroyed.entityConservation[0].preventedLeakValueMilli, 0);
  assert.throws(function () {
    Tool.finalizeAccumulator(terminalAccumulator(1), { requireComplete: true });
  }, /lacks a positive resolved control weight/,
  "an endpoint survivor without terminal integrity exhaustion remains invalid evidence");
});

test("placement pairs compare logical wave order while allowing different absolute ticks", function () {
  const left = { finalClaim: { durationTicks: 500 }, inputs: [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "build", padId: "p02", defenseId: "chronos" },
    { tick: 0, seq: 2, type: "startWave" },
    { tick: 100, seq: 0, type: "upgrade", towerId: 1 },
    { tick: 100, seq: 1, type: "startWave" },
  ] };
  const right = { finalClaim: { durationTicks: 630 }, inputs: [
    { tick: 20, seq: 0, type: "build", padId: "p07", defenseId: "sentinel" },
    { tick: 20, seq: 1, type: "build", padId: "p08", defenseId: "chronos" },
    { tick: 20, seq: 2, type: "startWave" },
    { tick: 240, seq: 0, type: "upgrade", towerId: 1 },
    { tick: 240, seq: 1, type: "startWave" },
  ] };
  assert.equal(Tool.commandPairDiffersOnlyByTwoBuildPads(left, right), true);
  const movedBoundary = JSON.parse(JSON.stringify(right));
  movedBoundary.inputs[3].tick = 20;
  assert.equal(Tool.commandPairDiffersOnlyByTwoBuildPads(left, movedBoundary), false,
    "a command moved into another distinct tick bucket must not compare equal");
  const missingStart = JSON.parse(JSON.stringify(right));
  missingStart.inputs.pop();
  const leftMissingStart = JSON.parse(JSON.stringify(left));
  leftMissingStart.inputs.pop();
  assert.equal(Tool.commandPairDiffersOnlyByTwoBuildPads(leftMissingStart, missingStart), false,
    "matched arbitrary mid-wave buckets without one startWave must fail closed");
  right.inputs[3] = Object.assign({}, right.inputs[3], { towerId: 2 });
  assert.equal(Tool.commandPairDiffersOnlyByTwoBuildPads(left, right), false);
});

test("sell credits reduce net consumed while simultaneous investment tracks all active towers", function () {
  const accumulator = Tool.createBalanceAccumulator();
  Tool.foldTelemetryTick(accumulator, state(0, 300), tickResult(0, [
    aetherRecord({ towerRuntimeId: 1, debitAether: 80, investedAfterAether: 80 }),
    aetherRecord({ towerRuntimeId: 2, commandSeq: 1, padId: "pad.b", defenseId: "chronos",
      debitAether: 70, investedAfterAether: 70 }),
  ], state(1, 150)));
  Tool.foldTelemetryTick(accumulator, state(1, 150), tickResult(1, [
    aetherRecord({ action: "sell", sourceId: "command.sell", towerRuntimeId: 1, commandSeq: 2,
      levelBefore: 1, levelAfter: 0, debitAether: 0, creditAether: 56,
      investedBeforeAether: 80, investedAfterAether: 0, bankBeforeAether: 150, bankAfterAether: 206 }),
  ], state(2, 206)));
  const report = Tool.finalizeAccumulator(accumulator);
  assert.equal(report.economy.maximumSimultaneousInvestmentAether, 150);
  assert.equal(report.economy.netConsumedAether, 94);
  assert.equal(report.economy.finalBankAether, 206);
});

test("effect lifecycle and movement ownership omissions require prior bounded provenance", function () {
  const accumulator = Tool.createBalanceAccumulator();
  const apply = {
    kind: "effect", ordinal: 0, action: "apply", sourceTowerRuntimeId: 3, sourceRuntimeId: 8,
    defenseId: "chronos", level: 2, padId: "pad.c", targetRuntimeId: 11,
    targetOwnerId: "enemy.scout", targetRouteId: "route.main", effectKind: "status",
    statusId: "slow", requestedMagnitude: 2000, appliedMagnitude: 2000,
    requestedDurationTimeUnits: 60, appliedDurationTimeUnits: 60, outcome: "applied",
  };
  Tool.foldTelemetryTick(accumulator, state(0, 100), tickResult(0, [
    spawnRecord({ enemyRuntimeId: 11, lineageId: "lineage.11" }), apply,
  ], state(1, 100)));
  const movement = {
    kind: "movement-control", ordinal: 0, enemyRuntimeId: 11, ownerId: "enemy.scout",
    lineageId: "lineage.11", routeId: "route.main", priorRouteDistance: 10,
    nextRouteDistance: 11, actualAdvanceDistance: 1, effectiveSpeedBp: 8000,
    scaledReductionBp: 2000, sourceEffectRuntimeIds: [21], sourceRuntimeIds: [8],
    sourceTowerRuntimeIds: [],
  };
  Tool.foldTelemetryTick(accumulator, state(1, 100), tickResult(1, [movement], state(2, 100)));
  const expire = Object.assign({}, apply, {
    action: "expire", sourceTowerRuntimeId: null, defenseId: null, level: null, padId: null,
    outcome: "expired",
  });
  Tool.foldTelemetryTick(accumulator, state(2, 100), tickResult(2, [expire], state(3, 100)));
  assert.throws(function () {
    const orphan = Tool.createBalanceAccumulator();
    Tool.foldTelemetryTick(orphan, state(0, 100), tickResult(0, [Object.assign({}, expire)], state(1, 100)));
  }, /prior apply\/refresh/);
  assert.throws(function () {
    const orphan = Tool.createBalanceAccumulator();
    Tool.foldTelemetryTick(orphan, state(0, 100), tickResult(0, [
      spawnRecord({ enemyRuntimeId: 11, lineageId: "lineage.11" }),
      Object.assign({}, movement, {
      sourceEffectRuntimeIds: movement.sourceEffectRuntimeIds.slice(),
      sourceRuntimeIds: movement.sourceRuntimeIds.slice(),
      sourceTowerRuntimeIds: movement.sourceTowerRuntimeIds.slice(),
      }),
    ], state(1, 100)));
  }, /prior effect provenance/);
});

test("Hoplite delayed Resolve requires an explicit delayed-to-active telemetry transition", function () {
  const accumulator = Tool.createBalanceAccumulator();
  const delayedApply = {
    kind: "effect", ordinal: 0, action: "apply", sourceTowerRuntimeId: 3, sourceRuntimeId: 8,
    defenseId: "hoplite", level: 3, padId: "pad.c", targetRuntimeId: 11,
    targetOwnerId: "enemy.scout", targetRouteId: "route.main", effectKind: "delayed-status",
    statusId: "resolve", requestedMagnitude: 2000, appliedMagnitude: 2000,
    requestedDurationTimeUnits: 60, appliedDurationTimeUnits: 60, outcome: "applied",
  };
  const stunApply = Object.assign({}, delayedApply, {
    effectKind: "status", statusId: "stun", requestedMagnitude: 10000,
    appliedMagnitude: 10000,
  });
  Tool.foldTelemetryTick(accumulator, state(0, 100),
    tickResult(0, [spawnRecord({ enemyRuntimeId: 11, lineageId: "lineage.11" }),
      stunApply, delayedApply], state(1, 100)));
  const movement = {
    kind: "movement-control", ordinal: 0, enemyRuntimeId: 11, ownerId: "enemy.scout",
    lineageId: "lineage.11", routeId: "route.main", priorRouteDistance: 0,
    nextRouteDistance: 0, actualAdvanceDistance: 0, effectiveSpeedBp: 0,
    scaledReductionBp: 10000, sourceEffectRuntimeIds: [21], sourceRuntimeIds: [8],
    sourceTowerRuntimeIds: [],
  };
  Tool.foldTelemetryTick(accumulator, state(1, 100),
    tickResult(1, [movement], state(2, 100)));
  const activeRefresh = Object.assign({}, delayedApply, {
    action: "refresh", sourceTowerRuntimeId: null, defenseId: null, level: null, padId: null,
    effectKind: "status", outcome: "refreshed",
  });
  Tool.foldTelemetryTick(accumulator, state(2, 100),
    tickResult(2, [activeRefresh], state(3, 100)));
  const activeExpire = Object.assign({}, activeRefresh, { action: "expire", outcome: "expired" });
  Tool.foldTelemetryTick(accumulator, state(3, 100),
    tickResult(3, [activeExpire], state(4, 100)));

  assert.throws(function () {
    const orphan = Tool.createBalanceAccumulator();
    Tool.foldTelemetryTick(orphan, state(0, 100),
      tickResult(0, [Object.assign({}, activeRefresh)], state(1, 100)));
  }, /prior delayed-status transition/);
});

test("placement gate uses the binding 15 percent cross-multiplication rule", function () {
  assert.equal(Tool.placementGate({ numerator: 115, denominator: 100 }, { numerator: 100, denominator: 100 }), true);
  assert.equal(Tool.placementGate({ numerator: 114, denominator: 100 }, { numerator: 100, denominator: 100 }), false);
  assert.equal(Tool.placementGate({ numerator: 999, denominator: 0 }, { numerator: 1, denominator: 1 }), false);
});

test("machine predicates encode Section 11.2 material-use and representative m01 bounds", function () {
  assert.equal(Tool.materiallyUsedDefense({
    defenseId: "sentinel", builtBeforeFinalWave: true, waveActiveOwnedTicks: 60,
    valueMilli: 5000, witnessValueMilli: 100000, metrics: { positiveAppliedHits: 10 },
  }), true);
  assert.equal(Tool.materiallyUsedDefense({
    defenseId: "sentinel", builtBeforeFinalWave: true, waveActiveOwnedTicks: 60,
    valueMilli: 4999, witnessValueMilli: 100000, metrics: { positiveAppliedHits: 99 },
  }), false);
  const representative = [
    { finalBankAether: 64, finalTowerCount: 4, netConsumedAether: 360, occupiedPadCount: 4, upgradeUnits: 1 },
    { finalBankAether: 20, finalTowerCount: 5, netConsumedAether: 410, occupiedPadCount: 5, upgradeUnits: 2 },
    { finalBankAether: 80, finalTowerCount: 4, netConsumedAether: 390, occupiedPadCount: 4, upgradeUnits: 3 },
  ];
  assert.equal(Tool.m01RepresentativeSetGate(representative), true);
  representative[0] = Object.assign({}, representative[0], { occupiedPadCount: 10 });
  assert.equal(Tool.m01RepresentativeSetGate(representative), false);
});

test("scenario material-use and emphasis facts aggregate conserved tower families", function () {
  const result = {
    towerUsage: {
      "1": {
        defenseId: "sentinel", builtBeforeFinalWave: true, waveActiveOwnedTicks: 35,
        acceptedGuardContacts: 0, multiTargetActivations: 0, positiveAppliedHits: 6,
        positivelyAmplifiedMarkedHits: 0, revealEnabledHits: 0,
        strongestMovementEnemyTicks: 0,
      },
      "2": {
        defenseId: "sentinel", builtBeforeFinalWave: true, waveActiveOwnedTicks: 30,
        acceptedGuardContacts: 0, multiTargetActivations: 0, positiveAppliedHits: 5,
        positivelyAmplifiedMarkedHits: 0, revealEnabledHits: 0,
        strongestMovementEnemyTicks: 0,
      },
    },
    attributionByDefense: {
      sentinel: {
        directValueMilli: 5000, supportValueMilli: 0, controlValueMilli: 0,
        preventedLeakValueMilli: 0,
      },
    },
    finalInvestmentByDefense: { sentinel: 150 },
    combatValuePerAether: { numerator: 6000, denominator: 150 },
  };
  const facts = Tool.materialUseFactsByDefense(result);
  assert.equal(facts.sentinel.waveActiveOwnedTicks, 65);
  assert.equal(facts.sentinel.metrics.positiveAppliedHits, 11);
  assert.equal(Tool.materiallyUsedDefense(facts.sentinel), true);
  assert.deepEqual(Tool.emphasisRows(result), [
    { defenseId: "sentinel", investmentAether: 150, valueMilli: 5000 },
  ]);
});

test("emphasis, diversity, synergy, and mission exercise predicates stay exact", function () {
  assert.equal(Tool.emphasisGate("sentinel", [
    { defenseId: "sentinel", investmentAether: 60, valueMilli: 6000 },
    { defenseId: "chronos", investmentAether: 20, valueMilli: 2000 },
    { defenseId: "siege", investmentAether: 20, valueMilli: 2000 },
  ]), true);
  assert.equal(Tool.synergyStatus(135, 100), "pass");
  assert.equal(Tool.synergyStatus(136, 100), "review");
  assert.equal(Tool.materiallyDifferentLoadouts(
    ["sentinel", "chronos", "siege"], ["sentinel", "hoplite", "oracle"],
    { chronos: true, siege: true, hoplite: true, oracle: true }
  ), true);
  assert.equal(Tool.m04ExerciseGate({
    builtNorthLocal: true, builtShared: true, builtSouthLocal: true,
    crossRouteComparatorSelection: true, northLocalBeforeJoin: true,
    sharedAffectedRouteIds: ["route.north", "route.south"], southLocalBeforeJoin: true,
  }), true);
  assert.equal(Tool.m05ExerciseGate({
    bossLineageLeaks: 0, exposureWindowsWithPositiveDamage: 3, podChildrenReleased: 12,
    talosDied: true, talosSpawned: true, thresholdTransitions: 3, victory: true,
    warningsMatured: 3,
  }), true);
});

test("pair checkpoint carries terminal counters and compiled absent axes remain unavailable", function () {
  const pair = Tool.pairAtSharedCheckpoint({
    replay: { finalClaim: { durationTicks: 100 } },
    result: { combatValuePerAether: { numerator: 1000, denominator: 100 } },
  }, {
    replay: { finalClaim: { durationTicks: 120 } },
    result: { combatValuePerAether: { numerator: 900, denominator: 100 } },
  });
  assert.equal(pair.checkpointTick, 120);
  assert.equal(pair.left.durationTicks, 100);
  const axes = Tool.compiledAxisAvailability({
    enemies: { scout: { id: "scout", routeKinds: ["ground"], shieldPools: [] } },
    bosses: { talos: { id: "talos", routeKinds: ["ground"], shieldPools: [] } },
  });
  assert.deepEqual(axes, {
    air: { status: "unavailable", ownerIds: [] },
    shield: { status: "unavailable", ownerIds: [] },
  });
});

test("no-strict-dominance evaluates its ten measured pairs without gate-list ordering", function () {
  function matrixRun(gateId, pairRole, numerator) {
    return {
      scenario: {
        expectations: { requiredGateIds: [gateId] },
        pair: { id: gateId + "-v1", role: pairRole },
      },
      result: {
        combatValuePerAether: { numerator: numerator, denominator: 100 },
        integrity: 10,
        outcome: "defeat",
        score: 0,
        terminalWaveIndex: 3,
      },
    };
  }
  const runs = [];
  ["chronos", "hoplite", "oracle", "sentinel", "siege"].forEach(function (defenseId) {
    const roleId = "defense-role-" + defenseId;
    runs.push(matrixRun(roleId, "baseline", 110));
    runs.push(matrixRun(roleId, "substitute", 100));
    const weaknessId = "defense-weakness-" + defenseId;
    runs.push(matrixRun(weaknessId, "baseline", 100));
    runs.push(matrixRun(weaknessId, "substitute", 120));
  });
  assert.equal(Tool.noStrictDominanceGate(runs), true);
  assert.equal(Tool.evaluateRequiredGates(runs).find(function (gate) {
    return gate.id === "no-strict-dominance";
  }).status, "pass");
  assert.equal(Tool.noStrictDominanceGate(runs.slice(0, -1)), false);
});

test("report shape keeps ratios exact and refuses false headless/manual evidence writes", function () {
  const report = Tool.createBalanceReport({
    binding: { contentVersion: "slice-v1", rulesetHash: "sha256:" + "a".repeat(64) },
    scenarioResults: [],
    matrixResults: [],
    aggregates: { ratio: { numerator: 3, denominator: 2 } },
    gateResults: [{ id: "starter-wins", required: true, status: "pass" }],
    manualTargets: [{ id: "clarity", status: "manual" }],
  });
  assert.equal(report.formulaVersion, "combat-value-v1-conserved");
  assert.doesNotThrow(function () { Tool.ensureTruthfulWrite(report); });
  const failing = Tool.createBalanceReport({
    binding: {}, scenarioResults: [], matrixResults: [], aggregates: {},
    gateResults: [{ id: "starter-wins", required: true, status: "fail" }],
    manualTargets: [{ id: "clarity", status: "manual" }],
  });
  assert.throws(function () { Tool.ensureTruthfulWrite(failing); }, /Refusing evidence write/);
  assert.throws(function () {
    Tool.createBalanceReport({
      binding: {}, scenarioResults: [], matrixResults: [], aggregates: {},
      gateResults: [{ id: "air", required: true, status: "unavailable" }],
      manualTargets: [],
    });
  }, /cannot be marked/);
});

test("execute is injection-safe, check-only compares bytes, and never repairs evidence", function () {
  const output = capture();
  let compared = false;
  let wrote = false;
  const release = {
    contentVersion: "slice-v1",
    rulesetHash: "sha256:" + "b".repeat(64),
  };
  const report = Tool.createBalanceReport({
    binding: release,
    scenarioResults: [], matrixResults: [], aggregates: {},
    gateResults: [{ id: "fake", required: true, status: "pass" }],
    manualTargets: [{ id: "clarity", status: "manual" }],
  });
  const code = Tool.execute(Tool.parseArgs(["--manifest", MANIFEST, "--check"]), output.io, {
    compileAuthenticatedSelection: function () { return { release: release }; },
    generateEvidence: function () {
      return { report: report, artifacts: new Map([["balance-report.json", Tool.canonicalArtifact(report)]]) };
    },
    compareEvidence: function (_directory, entries) {
      compared = true;
      assert.equal(entries.length, 1);
    },
    writeEvidence: function () { wrote = true; },
  });
  assert.equal(code, 0);
  assert.equal(compared, true);
  assert.equal(wrote, false);
  assert.match(output.stdout(), /balance check passed/);
});

test("default evidence generator consumes the frozen catalog/runner contract", function () {
  const scenario = Tool.parseScenarioBytes(fs.readFileSync(FIXTURE));
  const release = {
    abiHash: "sha256:" + "1".repeat(64), annexHash: "sha256:" + "2".repeat(64),
    contentHash: "sha256:" + "3".repeat(64), contentVersion: "slice-v1",
    eventSchemaVersion: 1, rulesetHash: "sha256:" + "4".repeat(64),
    simulationHash: "sha256:" + "5".repeat(64), sourceManifestHash: "sha256:" + "6".repeat(64),
  };
  const replay = { finalClaim: { durationTicks: 1 }, inputs: [] };
  const generated = Tool.generateEvidence({ release: release }, {}, {
    createBoundRuntime: function () { return { content: {
      enemies: { scout: { id: "scout", routeKinds: ["ground"], shieldPools: [] } },
      bosses: {},
    } }; },
    loadScenarioCatalog: function () { return [scenario]; },
    runAuthoredScenario: function () { return {
      replay: replay,
      result: {
        economy: { finalBankAether: 10 }, outcome: "defeat", integrity: 0,
        terminalWaveIndex: 5,
      },
      sourceHash: scenario.sourceHash,
    }; },
  });
  assert.equal(generated.report.aggregates.scenarioCount, 1);
  assert.equal(generated.report.aggregates.axisAvailability.air.status, "unavailable");
  assert.deepEqual(generated.report.aggregates.machineEvidence, {
    malformedInputFuzz: null, parserAndRuntimeLimits: null, replayParity: null,
  });
  assert.equal(generated.artifacts.has("balance-report.json"), true);
  assert.equal(generated.artifacts.has("witnesses/fake.loader.contract.replay.json"), true);
  assert.equal(generated.report.gateResults.every(function (gate) {
    return gate.required === false || gate.status === "fail";
  }), true);
});

test("generator cache reuses identical executions but retains scenario provenance and expectation boundaries", function () {
  function cachedScenario(id, hashDigit, integrityMax) {
    const source = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
    source.id = id;
    source.expectations.integrityMax = integrityMax;
    source.expectations.requiredGateIds = [];
    return Tool.validateScenario(source, "sha256:" + hashDigit.repeat(64));
  }
  const scenarios = [
    cachedScenario("cache-a", "a", 0),
    cachedScenario("cache-b", "b", 0),
    cachedScenario("cache-c", "c", 1),
  ];
  let runnerCalls = 0;
  const release = {
    abiHash: "sha256:" + "1".repeat(64), annexHash: "sha256:" + "2".repeat(64),
    contentHash: "sha256:" + "3".repeat(64), contentVersion: "slice-v1",
    eventSchemaVersion: 1, rulesetHash: "sha256:" + "4".repeat(64),
    simulationHash: "sha256:" + "5".repeat(64), sourceManifestHash: "sha256:" + "6".repeat(64),
  };
  const generated = Tool.generateEvidence({ release: release }, {}, {
    createBoundRuntime: function () { return { content: { enemies: {}, bosses: {} } }; },
    loadScenarioCatalog: function () { return scenarios; },
    runAuthoredScenario: function (_runtime, scenario) {
      runnerCalls += 1;
      return {
        replay: { finalClaim: { durationTicks: 1 }, inputs: [] },
        result: { economy: { finalBankAether: 0 }, outcome: "defeat", integrity: 0,
          terminalWaveIndex: 5 },
        sourceHash: scenario.sourceHash,
      };
    },
  });
  assert.equal(runnerCalls, 2, "only the changed terminal constraint misses the execution cache");
  assert.deepEqual(generated.report.scenarioResults.map(function (record) {
    return [record.id, record.sourceSha256];
  }), [
    ["cache-a", "sha256:" + "a".repeat(64)],
    ["cache-b", "sha256:" + "b".repeat(64)],
    ["cache-c", "sha256:" + "c".repeat(64)],
  ]);
  assert.equal(generated.artifacts.has("witnesses/cache-a.replay.json"), true);
  assert.equal(generated.artifacts.has("witnesses/cache-b.replay.json"), true);
});

test("CLI returns stable usage and execution exit classes", function () {
  let output = capture();
  assert.equal(Tool.main(["--check"], output.io), 2);
  assert.match(output.stderr(), /Usage:/);
  output = capture();
  assert.equal(Tool.main(["--manifest", MANIFEST, "--check"], output.io, {
    compileAuthenticatedSelection: function () { return { release: {
      contentVersion: "slice-v1", rulesetHash: "sha256:" + "c".repeat(64),
    } }; },
    createBoundRuntime: function () { return { content: { enemies: {}, bosses: {} } }; },
  }), 1);
  assert.match(output.stderr(), /catalog\.json|ENOENT/);
});

test("real v3 bytes authenticate, bind in a locked VM, and return exact telemetry", {
  timeout: 30000,
}, function () {
  const selection = Tool.compileAuthenticatedSelection(MANIFEST);
  const runtime = Tool.createBoundRuntime(selection);
  const kernel = runtime.simulation.AegisKernel;
  assert.equal(kernel.BALANCE_TELEMETRY_SCHEMA_VERSION, 1);
  assert.equal(kernel.MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK, 65536);
  assert.equal(kernel.MAX_BALANCE_TELEMETRY_TARGET_IDS, 4096);
  const header = runtime.cloneInto({
    formatVersion: 1,
    rulesetHash: runtime.release.rulesetHash,
    eventSchemaVersion: runtime.release.eventSchemaVersion,
    missionId: "m01",
    difficultyId: "strategos",
    assist: false,
    seed: 0,
    loadoutIds: ["sentinel", "chronos", "siege"],
    loadoutSlotCap: 3,
    campaignModifierIds: [],
    accessGrantIds: ["campaign.chronos", "campaign.sentinel", "campaign.siege"],
    tutorialUpgradeGateMode: "m01-wave1",
  });
  const initial = kernel.createInitialState(runtime.binding, header);
  const commands = runtime.cloneInto([{ tick: 0, seq: 0, type: "startWave" }]);
  const result = kernel.advanceTick(runtime.binding, initial, commands);
  assert.deepEqual(Object.keys(result).sort(), ["events", "state", "telemetry"]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.telemetry.schemaVersion, 1);
  assert.equal(result.telemetry.tick, 0);
  assert.equal(Object.isFrozen(result.telemetry.records), true);
  const accumulator = Tool.createBalanceAccumulator();
  assert.doesNotThrow(function () { Tool.foldTelemetryTick(accumulator, initial, result); });
  assert.equal(accumulator.ticks, 1);

  const geometryContent = JSON.parse(JSON.stringify(runtime.content));
  geometryContent.defenses.sentinel.levels[0].rangeWorldUnits = 23001;
  geometryContent.maps.m01.analysis.coverage.pads.forEach(function (pad) {
    pad.probes = pad.probes.filter(function (probe) { return probe.range !== 23001; });
  });
  const geometryAuthorities = Tool.createConservedAuthorities({
    cloneInto: runtime.cloneInto,
    content: geometryContent,
    simulation: runtime.simulation,
  }, "m01");
  assert.doesNotThrow(function () {
    geometryAuthorities.shadowOutsideRange({
      defenseId: "sentinel", level: 1, padId: "p01", targetRouteId: "route.main",
    }, 20000);
  }, "exact bound geometry must not require an authored analysis probe for the compiled range");

  const limitProbeReplay = {
    formatVersion: 1,
    rulesetHash: runtime.release.rulesetHash,
    eventSchemaVersion: runtime.release.eventSchemaVersion,
    missionId: "m01",
    difficultyId: "strategos",
    assist: false,
    seed: 0,
    loadoutIds: ["sentinel", "chronos", "siege"],
    loadoutSlotCap: 3,
    campaignModifierIds: [],
    accessGrantIds: ["campaign.chronos", "campaign.sentinel", "campaign.siege"],
    tutorialUpgradeGateMode: "m01-wave1",
    inputs: [{ tick: 0, seq: 0, type: "startWave" }],
    checkpoints: [],
    finalClaim: {
      outcome: "defeat", score: 0, laurels: 0, durationTicks: 2,
      finalStateHash: "0".repeat(64),
    },
  };
  const limitFacts = Tool.parserAndRuntimeLimitsFacts(runtime, [{ replay: limitProbeReplay }]);
  assert.ok(limitFacts);
  assert.equal(limitFacts.probeCount, 5);
  assert.deepEqual(limitFacts.exercisedLimits.map(function (probe) { return probe.id; }), [
    "replay.max-utf8-bytes", "replay.frozen-limit-relaxation", "replay.max-total-commands",
    "kernel.max-commands-per-tick-atomic", "runtime.terminal-duration-claim",
  ]);
  assert.equal(Tool.parserAndRuntimeLimitsGate(runtime, [{ replay: limitProbeReplay }]), true,
    "the authenticated parser and runner must behaviorally reject tightened/oversized boundaries");
  const malformedFuzz = Tool.malformedInputFuzzFacts(runtime, [{ replay: limitProbeReplay }]);
  assert.ok(malformedFuzz, "the fixed-seed malformed corpus must complete");
  assert.equal(malformedFuzz.iterationCount,
    Tool.MALFORMED_FUZZ_SEEDS.length * Tool.MALFORMED_FUZZ_ITERATIONS_PER_SEED * 2);
  assert.equal(malformedFuzz.parserRejectionCount, 64);
  assert.equal(malformedFuzz.commandRejectionCount, 64);
  assert.match(malformedFuzz.corpusHash, /^sha256:[0-9a-f]{64}$/);
  assert.match(malformedFuzz.initialStateHash, /^[0-9a-f]{64}$/);
});
