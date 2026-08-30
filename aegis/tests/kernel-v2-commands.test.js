"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const ABI = require("../js/sim/abi.js");
const Kernel = require("../js/sim/kernel.js");
const Management = require("../js/sim/management.js");
const Fixture = require("./fixtures/kernel-v2/content.js");

const fixture = Fixture.buildKernelV2Fixture();
const KERNEL_PATH = path.join(__dirname, "..", "js", "sim", "kernel.js");
const MANAGEMENT_PATH = path.join(__dirname, "..", "js", "sim", "management.js");

function binding() {
  return Kernel.createRulesetBinding({ release: fixture.release, content: fixture.content });
}

function fundedHeader(overrides) {
  return Fixture.headerV2(fixture, Object.assign({
    assist: true,
    campaignModifierIds: ["reserve-1"],
  }, overrides || {}));
}

function stateHash(state) {
  return ABI.sha256Hex(ABI.canonicalBytes(state));
}

function compileKernelWithSourceReplacement(search, replacement) {
  const source = fs.readFileSync(KERNEL_PATH, "utf8");
  assert.equal(source.includes(search), true);
  const compiled = new Module(KERNEL_PATH, module);
  compiled.filename = KERNEL_PATH;
  compiled.paths = Module._nodeModulePaths(path.dirname(KERNEL_PATH));
  compiled._compile(source.replace(search, replacement), KERNEL_PATH);
  return compiled.exports;
}

function denialReason(result, commandType) {
  const event = result.commandEvents.find(function (candidate) {
    return candidate.commandType === commandType;
  });
  assert.ok(event, "expected a denial event for " + commandType);
  return event.reason;
}

function v1ManagementConfig() {
  return {
    missionId: "m01",
    resolvedStartAether: 200,
    tutorialUpgradeGateMode: "none",
    padIds: ["p01"],
    waveStartGrants: [10],
    defenses: [{
      id: "sentinel",
      costsAether: [10, 20, 30],
      defaultTargetPolicy: "FRONT",
      allowedTargetPolicies: ["FRONT"],
    }],
  };
}

function v2ManagementConfig() {
  return {
    abiVersion: 2,
    missionId: "m01",
    resolvedStartAether: 200,
    tutorialUpgradeGateMode: "none",
    padIds: ["p01", "p02"],
    waveStartGrants: [10],
    defenses: [{
      id: "sentinel",
      costsAether: [10, 20],
      defaultTargetPolicy: "FRONT",
      allowedTargetPolicies: ["FRONT"],
    }],
    relicModifiers: [],
    specializationAccessIds: ["sentinel-lock-on"],
    specializations: [{ costAether: 30, defenseId: "sentinel", id: "sentinel-lock-on" }],
  };
}

function v2Runtime(overrides) {
  return Object.assign({
    boardBounds: { minX: 0, minY: 0, maxX: 160000, maxY: 100000 },
    mechanism: null,
    protocolCatalog: null,
    protocolLoadout: null,
    protocols: {
      effects: [], equipped: [], schedules: [], sharedReadyTick: 0, wardCharges: 0,
    },
    reinforcement: null,
    routes: [],
    selectProtocolTargets: function () { return null; },
    supportedEffectKinds: ["global-slow-field"],
  }, overrides || {});
}

test("ABI v2 executes the ten declared phases in the abi-v2 order", () => {
  const bound = binding();
  const state = Kernel.createInitialState(bound, fundedHeader());
  const result = Kernel.advanceTick(bound, state, [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "startWave" },
  ]);
  assert.deepEqual(result.phaseTrace, [
    "commands-and-aether-payments",
    "expiry-and-enable-transitions",
    "scheduled-protocol-mechanism-resolutions-and-spawns",
    "spawn-movement-control-and-contact",
    "tower-and-reinforcement-acquisition-and-attacks",
    "persistent-zone-pulses-and-terminal-damage",
    "leak-arbitration-and-ward",
    "bounty-income-objectives-and-score-facts",
    "cooldown-and-effect-decrement",
    "guarded-boss-wave-mission-transition-and-event-finalization",
  ]);
  assert.deepEqual(result.phaseTrace, Kernel.V2_PHASE_IDS);
  assert.equal(Object.isFrozen(result.phaseTrace), true);
});

test("the noncanonical phase trace never enters the canonical state or its hash", () => {
  const bound = binding();
  const state = Kernel.createInitialState(bound, fundedHeader());
  const result = Kernel.advanceTick(bound, state, [{ tick: 0, seq: 0, type: "startWave" }]);
  assert.equal(Object.prototype.hasOwnProperty.call(result.state, "phaseTrace"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.state, "commandEvents"), false);
  assert.equal(ABI.canonicalEncode(result.state).includes("phaseTrace"), false);
  assert.deepEqual(Object.keys(result).sort(), [
    "commandEvents", "events", "phaseTrace", "state", "telemetry",
  ]);
});

test("a planning bucket runs only the command phase and never advances the clock", () => {
  const bound = binding();
  const state = Kernel.createInitialState(bound, fundedHeader());
  const result = Kernel.advanceTick(bound, state, [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
  ]);
  assert.deepEqual(result.phaseTrace, ["commands-and-aether-payments"]);
  assert.equal(result.state.tick, 0);
  assert.deepEqual(result.events, []);
  assert.equal(result.state.management.towers.length, 1);
});

test("a command type ABI v1 cannot run denies `unsupported-under-abi` without mutation", () => {
  const config = v1ManagementConfig();
  const state = Management.createManagementState(config);
  const before = ABI.canonicalEncode(state);
  Management.V2_ONLY_COMMAND_TYPES.forEach(function (type, index) {
    const command = { tick: 0, seq: 0, type: type };
    if (type === "specializeTower") {
      command.towerRuntimeId = 1;
      command.specializationId = "sentinel-lock-on";
    }
    if (type === "activatePower") {
      command.protocolId = "temporal-edict";
      command.tier = 1;
      command.target = { kind: "none" };
    }
    if (type === "deployReinforcement") {
      command.reinforcementId = "spartan-phalanx";
      command.markerId = "marker.a";
    }
    if (type === "activateMechanism") {
      command.mechanismId = "gate";
      command.activationId = "act.a";
    }
    const result = Management.applyCommandBucketV2(state, config, 0, [command], v2Runtime());
    assert.equal(result.events[0].type, "denied", type + " " + index);
    assert.equal(result.events[0].reason, "unsupported-under-abi");
    assert.equal(ABI.canonicalEncode(result.state), before);
  });
});

test("the management reducer denies an unrecognized command type instead of throwing", () => {
  const source = fs.readFileSync(MANAGEMENT_PATH, "utf8");
  assert.equal(source.includes("Normalized command type is not implemented"), false);
  assert.equal(source.includes('deniedEvent(command, "unknown-command")'), true);
  assert.throws(
    () => Management.applyCommandBucketV2(
      Management.createManagementState(v2ManagementConfig()),
      v2ManagementConfig(),
      0,
      [{ tick: 0, seq: 0, type: "teleportTower" }],
      v2Runtime()
    ),
    /Unsupported command type/
  );
});

test("an ordinary upgrade of a Level-2 tower denies `specialization-required` under v4", () => {
  const bound = binding();
  let state = Kernel.createInitialState(bound, fundedHeader());
  let result = Kernel.advanceTick(bound, state, [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "skipTutorialGate" },
    { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
    { tick: 0, seq: 3, type: "upgrade", towerId: 1 },
  ]);
  assert.equal(denialReason(result, "upgrade"), "specialization-required");
  assert.equal(result.state.management.towers[0].level, 2);
  assert.deepEqual(result.state.management.towers[0].paidCosts, [60, 55]);
});

test("specializeTower buys Level 3, records the branch, and appends its actual payment", () => {
  const bound = binding();
  let result = Kernel.advanceTick(bound, Kernel.createInitialState(bound, fundedHeader()), [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "skipTutorialGate" },
    { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
    { tick: 0, seq: 3, type: "startWave" },
  ]);
  const aetherBefore = result.state.management.aether;
  result = Kernel.advanceTick(bound, result.state, [
    { tick: 1, seq: 0, type: "specializeTower", towerRuntimeId: 1, specializationId: "sentinel-twin-lance" },
  ]);
  const tower = result.state.management.towers[0];
  assert.equal(tower.level, 3);
  assert.equal(tower.specializationId, "sentinel-twin-lance");
  assert.deepEqual(tower.paidCosts, [60, 55, 95]);
  assert.equal(tower.investedAether, 210);
  assert.equal(result.state.management.aether, aetherBefore - 95);
  assert.equal(result.state.timers[0].level, 3);
  assert.equal(result.state.timers[0].specializationId, "sentinel-twin-lance");
});

test("specializeTower denies wrong level, foreign branch, locked branch, and stale tower", () => {
  const bound = binding();
  const opened = Kernel.advanceTick(bound, Kernel.createInitialState(bound, fundedHeader()), [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "skipTutorialGate" },
    { tick: 0, seq: 2, type: "startWave" },
  ]);
  const levelOne = Kernel.advanceTick(bound, opened.state, [
    { tick: 1, seq: 0, type: "specializeTower", towerRuntimeId: 1, specializationId: "sentinel-lock-on" },
    { tick: 1, seq: 1, type: "specializeTower", towerRuntimeId: 99, specializationId: "sentinel-lock-on" },
  ]);
  assert.equal(levelOne.commandEvents[0].reason, "wrong-level");
  assert.equal(levelOne.commandEvents[1].reason, "stale-tower");
  assert.equal(levelOne.state.management.towers[0].level, 1);

  const levelTwo = Kernel.advanceTick(bound, levelOne.state, [
    { tick: 2, seq: 0, type: "upgrade", towerId: 1 },
    { tick: 2, seq: 1, type: "specializeTower", towerRuntimeId: 1, specializationId: "chronos-echo-field" },
    { tick: 2, seq: 2, type: "specializeTower", towerRuntimeId: 1, specializationId: "not-a-branch" },
  ]);
  assert.equal(levelTwo.commandEvents[1].reason, "foreign-specialization");
  assert.equal(levelTwo.commandEvents[2].reason, "unknown-specialization");
  assert.equal(levelTwo.state.management.towers[0].level, 2);
});

test("a branch the run header never granted denies `specialization-locked`", () => {
  const bound = binding();
  const opened = Kernel.advanceTick(bound, Kernel.createInitialState(bound, fundedHeader({
    specializationAccessIds: ["sentinel-lock-on"],
  })), [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "skipTutorialGate" },
    { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
    { tick: 0, seq: 3, type: "startWave" },
  ]);
  const result = Kernel.advanceTick(bound, opened.state, [
    { tick: 1, seq: 0, type: "specializeTower", towerRuntimeId: 1, specializationId: "sentinel-twin-lance" },
  ]);
  assert.equal(result.commandEvents[0].reason, "specialization-locked");
  assert.equal(result.state.management.towers[0].level, 2);
  assert.equal(result.state.management.aether, opened.state.management.aether);
});

test("an unaffordable specialization denies and leaves Aether and level untouched", () => {
  const bound = binding();
  const opened = Kernel.advanceTick(bound, Kernel.createInitialState(bound, Fixture.headerV2(fixture)), [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "skipTutorialGate" },
    { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
  ]);
  assert.equal(opened.state.management.aether, 63);
  const result = Kernel.advanceTick(bound, opened.state, [
    { tick: 0, seq: 0, type: "specializeTower", towerRuntimeId: 1, specializationId: "sentinel-lock-on" },
  ]);
  assert.equal(result.commandEvents[0].reason, "insufficient-aether");
  assert.equal(result.state.management.aether, 63);
  assert.deepEqual(result.state.management.towers[0].paidCosts, [60, 55]);
});

test("sell refunds seventy percent of the actual paid costs, not the authored list price", () => {
  const bound = binding();
  const specialized = Kernel.advanceTick(
    bound,
    Kernel.advanceTick(bound, Kernel.createInitialState(bound, fundedHeader()), [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "skipTutorialGate" },
      { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
      { tick: 0, seq: 3, type: "startWave" },
    ]).state,
    [{ tick: 1, seq: 0, type: "specializeTower", towerRuntimeId: 1, specializationId: "sentinel-lock-on" }]
  );
  const before = specialized.state.management.aether;
  const sold = Kernel.advanceTick(bound, specialized.state, [
    { tick: 2, seq: 0, type: "sell", towerId: 1 },
  ]);
  const sellEvent = sold.commandEvents[0];
  assert.equal(sellEvent.investedAether, 210);
  assert.equal(sellEvent.refundAether, Math.floor(210 * 70 / 100));
  assert.equal(sold.state.management.aether, before + 147);
  assert.deepEqual(sold.state.management.towers, []);
});

test("Forge Ember and Titan Gear compose one clamped basis-point sum and one rounding", () => {
  const bound = binding();
  const header = fundedHeader({
    relicIds: ["forge-ember", "titan-gear"],
    relicSlotCap: 2,
  });
  const state = Kernel.createInitialState(bound, header);
  assert.deepEqual(state.relics.modifiers.map(function (modifier) {
    return [modifier.statId, modifier.amount];
  }), [
    ["build-cost", 11600],
    ["protocol-cost", 8500],
    ["specialization-cost", 9600],
    ["upgrade-cost", 9600],
  ]);
  const opened = Kernel.advanceTick(bound, state, [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "skipTutorialGate" },
    { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
    { tick: 0, seq: 3, type: "startWave" },
  ]);
  /* ceil(60 x 11600 / 10000) = 70, ceil(55 x 9600 / 10000) = 53, ceil(95 x 9600 / 10000) = 92. */
  assert.equal(opened.commandEvents[0].costAether, 70);
  assert.equal(opened.commandEvents[2].costAether, 53);
  const specialized = Kernel.advanceTick(bound, opened.state, [
    { tick: 1, seq: 0, type: "specializeTower", towerRuntimeId: 1, specializationId: "sentinel-lock-on" },
  ]);
  const tower = specialized.state.management.towers[0];
  assert.deepEqual(tower.paidCosts, [70, 53, 92]);
  assert.equal(tower.investedAether, 215);
  const sold = Kernel.advanceTick(bound, specialized.state, [
    { tick: 2, seq: 0, type: "sell", towerId: 1 },
  ]);
  assert.equal(sold.commandEvents[0].refundAether, Math.floor(215 * 70 / 100));
});

test("resetPlan refunds this planning bucket's construction at full paid cost", () => {
  const bound = binding();
  const state = Kernel.createInitialState(bound, fundedHeader());
  const startAether = state.management.aether;
  const result = Kernel.advanceTick(bound, state, [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "skipTutorialGate" },
    { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
    { tick: 0, seq: 3, type: "build", padId: "p02", defenseId: "sentinel" },
    { tick: 0, seq: 4, type: "resetPlan" },
  ]);
  const resetEvent = result.commandEvents[4];
  assert.equal(resetEvent.type, "resetPlan");
  assert.equal(resetEvent.removedTowerCount, 2);
  assert.equal(resetEvent.refundAether, 60 + 55 + 60);
  assert.deepEqual(result.state.management.towers, []);
  assert.equal(result.state.management.aether, startAether);
});

test("resetPlan denies outside planning and never removes a live tower", () => {
  const bound = binding();
  const opened = Kernel.advanceTick(bound, Kernel.createInitialState(bound, fundedHeader()), [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "startWave" },
  ]);
  const result = Kernel.advanceTick(bound, opened.state, [{ tick: 1, seq: 0, type: "resetPlan" }]);
  assert.equal(result.commandEvents[0].reason, "wrong-phase");
  assert.equal(result.state.management.towers.length, 1);
});

test("reinforcement and mechanism commands deny `not-available` until their lane lands", () => {
  const bound = binding();
  const result = Kernel.advanceTick(bound, Kernel.createInitialState(bound, fundedHeader()), [
    { tick: 0, seq: 0, type: "deployReinforcement", reinforcementId: "spartan-phalanx", markerId: "marker.a" },
    { tick: 0, seq: 1, type: "activateMechanism", mechanismId: "cyclops-emp", activationId: "act.a" },
  ]);
  assert.deepEqual(result.commandEvents.map(function (event) { return event.reason; }), [
    "not-available", "not-available",
  ]);
  assert.equal(result.state.management.aether, 208);
});

test("disable sources add, sort, remove, and re-enable exactly when the last one expires", () => {
  const config = v2ManagementConfig();
  const built = Management.applyCommandBucketV2(
    Management.createManagementState(config), config, 0,
    [{ tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" }],
    v2Runtime()
  );
  let state = Management.addDisableSource(built.state, config, 1, "hephaestus.shutdown", 40);
  state = Management.addDisableSource(state, config, 1, "cyclops.emp", 20);
  assert.deepEqual(state.towers[0].disableSources, [
    { expiryTick: 20, sourceId: "cyclops.emp" },
    { expiryTick: 40, sourceId: "hephaestus.shutdown" },
  ]);

  const stillDisabled = Management.expireDisableSources(state, config, 20);
  assert.deepEqual(stillDisabled.enabledTowerRuntimeIds, []);
  assert.deepEqual(stillDisabled.state.towers[0].disableSources, [
    { expiryTick: 40, sourceId: "hephaestus.shutdown" },
  ]);

  const enabled = Management.expireDisableSources(stillDisabled.state, config, 40);
  assert.deepEqual(enabled.enabledTowerRuntimeIds, [1]);
  assert.deepEqual(enabled.state.towers[0].disableSources, []);

  const removed = Management.removeDisableSource(state, config, 1, "cyclops.emp");
  assert.deepEqual(removed.towers[0].disableSources, [
    { expiryTick: 40, sourceId: "hephaestus.shutdown" },
  ]);
  assert.throws(
    () => Management.addDisableSource(state, config, 99, "x.y", 1),
    /Unknown tower runtime ID/
  );
});

test("a disable source suppresses the tower's attacks and its expiry restores them", () => {
  const emp = compileKernelWithSourceReplacement(
    "    const enableTransition = Management.expireDisableSources(management, config, state.tick);",
    "    if (management.towers.length > 0 && state.tick < 12) {\n" +
    "      management = Management.addDisableSource(management, config, management.towers[0].id, \"test.emp\", 12);\n" +
    "    }\n" +
    "    const enableTransition = Management.expireDisableSources(management, config, state.tick);"
  );
  const empBinding = emp.createRulesetBinding({
    release: fixture.release,
    content: fixture.content,
  });
  let empState = emp.createInitialState(empBinding, fundedHeader());
  let stockBinding = binding();
  let stockState = Kernel.createInitialState(stockBinding, fundedHeader());
  const opening = [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "startWave" },
  ];
  let empResult = emp.advanceTick(empBinding, empState, opening);
  let stockResult = Kernel.advanceTick(stockBinding, stockState, opening);
  let empActivations = 0;
  let stockActivations = 0;
  for (let tick = 1; tick <= 11; tick += 1) {
    empResult = emp.advanceTick(empBinding, empResult.state, []);
    stockResult = Kernel.advanceTick(stockBinding, stockResult.state, []);
    empActivations += empResult.telemetry.records.filter(function (record) {
      return record.kind === "activation";
    }).length;
    stockActivations += stockResult.telemetry.records.filter(function (record) {
      return record.kind === "activation";
    }).length;
  }
  assert.equal(empActivations, 0);
  assert.ok(stockActivations > 0, "the stock kernel must fire while the disabled kernel cannot");
  assert.deepEqual(empResult.state.management.towers[0].disableSources, [
    { expiryTick: 12, sourceId: "test.emp" },
  ]);
  const reEnabled = emp.advanceTick(empBinding, empResult.state, []);
  assert.deepEqual(reEnabled.state.management.towers[0].disableSources, []);
});

test("a bounded v2 collection overflow fails the tick before any mutation", () => {
  const zeroEffects = compileKernelWithSourceReplacement(
    "  const MAX_PROTOCOL_EFFECTS = 64;",
    "  const MAX_PROTOCOL_EFFECTS = 0;"
  );
  const bound = zeroEffects.createRulesetBinding({
    release: fixture.release,
    content: fixture.content,
  });
  const opened = zeroEffects.advanceTick(bound, zeroEffects.createInitialState(bound, fundedHeader()), [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "startWave" },
  ]);
  const before = stateHash(opened.state);
  assert.throws(
    () => zeroEffects.advanceTick(bound, opened.state, [{
      tick: 1, seq: 0, type: "activatePower", protocolId: "temporal-edict", tier: 1,
      target: { kind: "none" },
    }]),
    /Protocol effects exceed the kernel ceiling/
  );
  assert.equal(stateHash(opened.state), before);

  const smallDisable = compileKernelWithSourceReplacement(
    "  const MAX_DISABLE_SOURCES = Management.MAX_DISABLE_SOURCES;",
    "  const MAX_DISABLE_SOURCES = 0;"
  );
  const disableBinding = smallDisable.createRulesetBinding({
    release: fixture.release,
    content: fixture.content,
  });
  const disableOpened = smallDisable.advanceTick(
    disableBinding,
    smallDisable.createInitialState(disableBinding, fundedHeader()),
    [{ tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" }]
  );
  assert.equal(disableOpened.state.management.towers.length, 1);
});

test("the ABI-v2 tick is deterministic across identical runs", () => {
  function run() {
    const bound = binding();
    let state = Kernel.createInitialState(bound, fundedHeader());
    const hashes = [stateHash(state)];
    let result = Kernel.advanceTick(bound, state, [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]);
    hashes.push(stateHash(result.state));
    for (let tick = 1; tick <= 30; tick += 1) {
      result = Kernel.advanceTick(bound, result.state, tick === 6 ? [{
        tick: tick, seq: 0, type: "activatePower", protocolId: "temporal-edict", tier: 1,
        target: { kind: "none" },
      }] : []);
      hashes.push(stateHash(result.state));
    }
    return { hashes: hashes, events: result.events, telemetry: result.telemetry };
  }
  const first = run();
  const second = run();
  assert.deepEqual(first.hashes, second.hashes);
  assert.equal(ABI.canonicalEncode(first.events), ABI.canonicalEncode(second.events));
  assert.equal(ABI.canonicalEncode(first.telemetry), ABI.canonicalEncode(second.telemetry));
});

test("a non-tower combat source resolves through the same damage pipeline with no attribution", () => {
  /* ADR-014: one damage reducer serves every source kind and only `tower` earns attribution.
     This variant relabels the ordinary Sentinel hit as a Protocol source and proves the applied
     damage is byte-identical while every tower identity in its telemetry becomes null. */
  const relabelled = compileKernelWithSourceReplacement(
    "      source: towerCombatSource(intent.towerRuntimeId),",
    "      source: combatSource(\"protocol\", \"temporal-edict\", intent.towerRuntimeId),"
  );
  const long = Fixture.buildLongWaveFixture();
  function damageRecords(kernel) {
    const bound = kernel.createRulesetBinding({
      release: long.release,
      content: long.content,
    });
    let result = kernel.advanceTick(bound, kernel.createInitialState(bound, fundedHeader()), [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]);
    const records = [];
    function collect(tickResult) {
      tickResult.telemetry.records.forEach(function (record) {
        if (record.kind === "damage") records.push(record);
      });
    }
    collect(result);
    for (let tick = 1; tick <= 20; tick += 1) {
      result = kernel.advanceTick(bound, result.state, []);
      collect(result);
    }
    return records;
  }
  const towerSourced = damageRecords(Kernel);
  const protocolSourced = damageRecords(relabelled);
  assert.ok(towerSourced.length > 0, "the run must resolve at least one hit");
  assert.equal(protocolSourced.length, towerSourced.length);
  towerSourced.forEach(function (record, index) {
    const other = protocolSourced[index];
    ["appliedHpDamageMilli", "appliedShieldDamageMilli", "eligibleHpDamageMilli",
      "preShieldDamageMilli", "targetHpAfterMilli", "targetHpBeforeMilli", "targetRuntimeId",
      "damageTypeId"].forEach(function (field) {
      assert.deepEqual(other[field], record[field], field);
    });
    assert.equal(record.sourceTowerRuntimeId, 1);
    assert.equal(record.defenseId, "sentinel");
    assert.equal(other.sourceTowerRuntimeId, null);
    assert.equal(other.defenseId, null);
    assert.equal(other.level, null);
    assert.equal(other.padId, null);
  });
});
