"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const Behaviors = require("../js/sim/behaviors.js");
const Commands = require("../js/sim/commands.js");
const Kernel = require("../js/sim/kernel.js");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const RELEASE_PATH = path.join(
  __dirname, "..", "content", "generated",
  "aegis-release.f38d130820cad7b9311de4be2fa6a262a6f59c5a276a8ad0b959692d34be239c.js"
);
const CONTENT_PATH = path.join(
  __dirname, "..", "content", "generated",
  "aegis-content.647876fbe0ea68ca972721c3c03d26d567753ec16a234cab5759985eb012c240.js"
);
const RELEASE = require(RELEASE_PATH).RELEASE;
const CONTENT = require(CONTENT_PATH).CONTENT;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function header(release, overrides) {
  return Object.assign({
    formatVersion: 1,
    rulesetHash: release.rulesetHash,
    eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
    missionId: "m01",
    difficultyId: "story",
    assist: false,
    seed: 123,
    loadoutIds: ["sentinel"],
    loadoutSlotCap: 1,
    campaignModifierIds: [],
    accessGrantIds: ["campaign.sentinel"],
    tutorialUpgradeGateMode: "m01-wave1",
  }, overrides || {});
}

function fixture(mutator, base) {
  const source = base || { content: CONTENT, release: RELEASE };
  const content = clone(source.content);
  mutator(content);
  deepFreeze(content);
  return {
    binding: Kernel.createRulesetBinding({ release: source.release, content: content }),
    content: content,
    release: source.release,
  };
}

function oneWave(content, missionId, waveOffset, groups) {
  const wave = content.missions[missionId].waves[waveOffset || 0];
  wave.index = 1;
  if (groups) wave.groups = groups;
  content.missions[missionId].waves = [wave];
  return wave;
}

function directLevel(content, defenseId, levelIndex) {
  return content.defenses[defenseId].levels[levelIndex].behaviors.find(function (behavior) {
    return behavior.contractId === "direct";
  });
}

function stateHash(state) {
  return ABI.sha256Hex(ABI.canonicalBytes(state));
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.keys(value).forEach(function (key) { assertDeepFrozen(value[key]); });
}

function assertTelemetry(result, inputTick) {
  assert.deepEqual(Object.keys(result), ["events", "state", "telemetry"]);
  assert.deepEqual(Object.keys(result.telemetry), ["schemaVersion", "tick", "records"]);
  assert.equal(result.telemetry.schemaVersion, 1);
  assert.equal(result.telemetry.tick, inputTick);
  assert.deepEqual(
    result.telemetry.records.map(function (record) { return record.ordinal; }),
    result.telemetry.records.map(function (_record, index) { return index; })
  );
  assert.equal(ABI.canonicalEncode(result.telemetry), ABI.canonicalEncode(clone(result.telemetry)));
  assert.equal(Object.isFrozen(result), true);
  assertDeepFrozen(result.state);
  assertDeepFrozen(result.telemetry);
}

function compileKernelWithSourceReplacement(search, replacement) {
  const filename = path.join(__dirname, "..", "js", "sim", "kernel.js");
  const source = fs.readFileSync(filename, "utf8");
  assert.equal(source.includes(search), true);
  const modified = source.replace(search, replacement);
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(modified, filename);
  return compiled.exports;
}

function assertAtomicTickRejection(kernel, binding, state, commands, expected) {
  const beforeHash = stateHash(state);
  const beforeState = clone(state);
  const beforeCommands = clone(commands);
  assert.throws(function () {
    kernel.advanceTick(binding, state, commands);
  }, expected);
  assert.equal(stateHash(state), beforeHash);
  assert.deepEqual(state, beforeState);
  assert.deepEqual(commands, beforeCommands);
  assertDeepFrozen(state);
}

let currentSourceArtifacts = null;
function compileCurrentSource() {
  if (currentSourceArtifacts !== null) return currentSourceArtifacts;
  const Compiler = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "compiler.js"));
  const Bundle = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "simulation-bundle.js"));
  const result = Compiler.compileSourceTree({
    sourceRoot: path.join(REPO_ROOT, "games", "aegis", "content"),
    manifestPath: path.join(
      REPO_ROOT, "games", "aegis", "content", "manifests", "slice-dev-v1.json"
    ),
    repositoryRoot: REPO_ROOT,
    simulationBytes: Bundle.buildSimulationBundle({
      sourceRoot: path.join(REPO_ROOT, "games", "aegis", "js", "sim"),
    }),
  });
  currentSourceArtifacts = Object.freeze({
    content: result.artifacts.content,
    release: result.artifacts.manifest,
  });
  return currentSourceArtifacts;
}

test("kernel exposes one frozen authoritative seam and fixed Candidate ceilings", () => {
  assert.equal(Object.isFrozen(Kernel), true);
  assert.deepEqual(Object.keys(Kernel).sort(), [
    "ABI_DESCRIPTOR_SHA256",
    "ABI_V2_DESCRIPTOR_SHA256",
    "BALANCE_TELEMETRY_SCHEMA_VERSION",
    "BEHAVIOR_REGISTRY_VERSION",
    "COMBAT_SOURCE_KINDS",
    "COMMAND_SCHEMA_VERSION",
    "EVENT_SCHEMA_VERSION",
    "KERNEL_SCHEMA_VERSION",
    "KERNEL_SCHEMA_VERSION_V2",
    "MAX_ACTIVE_ENTITIES",
    "MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK",
    "MAX_BALANCE_TELEMETRY_TARGET_IDS",
    "MAX_DISABLE_SOURCES",
    "MAX_LOADOUT_IDS",
    "MAX_MECHANISM_ZONES",
    "MAX_PROTOCOL_EFFECTS",
    "MAX_PROTOCOL_SCHEDULES",
    "MAX_PROTOCOL_SLOTS",
    "MAX_RELIC_IDS",
    "MAX_SEMANTIC_EVENTS_PER_TICK",
    "MAX_SPECIALIZATION_ACCESS_IDS",
    "MAX_TARGET_CANDIDATES",
    "SUPPORTED_PROTOCOL_EFFECT_KINDS",
    "V2_PHASE_IDS",
    "addTowerDisableSource",
    "advanceTick",
    "createInitialState",
    "createRulesetBinding",
    "removeTowerDisableSource",
  ].sort());
  assert.equal(Kernel.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assert.equal(Kernel.EVENT_SCHEMA_VERSION, ABI.EVENT_SCHEMA_VERSION);
  assert.equal(Kernel.BEHAVIOR_REGISTRY_VERSION, Behaviors.BEHAVIOR_REGISTRY_VERSION);
  assert.equal(Kernel.COMMAND_SCHEMA_VERSION, Commands.COMMAND_SCHEMA_VERSION);
  assert.equal(Kernel.MAX_ACTIVE_ENTITIES, 4096);
  assert.equal(Kernel.BALANCE_TELEMETRY_SCHEMA_VERSION, 1);
  assert.equal(Kernel.MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK, 65536);
  assert.equal(Kernel.MAX_BALANCE_TELEMETRY_TARGET_IDS, 4096);
  assert.equal(Kernel.MAX_LOADOUT_IDS, 6);
  assert.equal(Kernel.MAX_TARGET_CANDIDATES, 4096);
  assert.equal(Kernel.MAX_SEMANTIC_EVENTS_PER_TICK, 16384);
  assert.equal(Kernel.KERNEL_SCHEMA_VERSION_V2, 2);
  assert.equal(Kernel.MAX_PROTOCOL_EFFECTS, 64);
  assert.equal(Kernel.MAX_PROTOCOL_SCHEDULES, 64);
  assert.equal(Kernel.MAX_DISABLE_SOURCES, 8);
  assert.equal(Kernel.MAX_MECHANISM_ZONES, 16);
  assert.equal(Kernel.MAX_PROTOCOL_SLOTS, 2);
  assert.equal(Kernel.MAX_RELIC_IDS, 2);
  assert.equal(Kernel.MAX_SPECIALIZATION_ACCESS_IDS, 128);
  assert.deepEqual(Kernel.COMBAT_SOURCE_KINDS, ["mechanism", "protocol", "tower", "unit"]);
  assert.deepEqual(Kernel.V2_PHASE_IDS, [
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
});

test("telemetry ceilings reject before returning partial tick output", () => {
  const oneRecordKernel = compileKernelWithSourceReplacement(
    "const MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK = 65536;",
    "const MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK = 1;"
  );
  const oneRecordBinding = oneRecordKernel.createRulesetBinding({ release: RELEASE, content: CONTENT });
  const oneRecordState = oneRecordKernel.createInitialState(oneRecordBinding, header(RELEASE));
  const before = stateHash(oneRecordState);
  assert.throws(() => oneRecordKernel.advanceTick(oneRecordBinding, oneRecordState, [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "startWave" },
  ]), /telemetry.*ceiling/i);
  assert.equal(stateHash(oneRecordState), before);

  const noTargetIdsKernel = compileKernelWithSourceReplacement(
    "const MAX_BALANCE_TELEMETRY_TARGET_IDS = 4096;",
    "const MAX_BALANCE_TELEMETRY_TARGET_IDS = 0;"
  );
  const content = clone(CONTENT);
  content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
  deepFreeze(content);
  const noTargetIdsBinding = noTargetIdsKernel.createRulesetBinding({
    release: RELEASE,
    content: content,
  });
  const noTargetIdsState = noTargetIdsKernel.createInitialState(
    noTargetIdsBinding,
    header(RELEASE)
  );
  assert.throws(() => noTargetIdsKernel.advanceTick(noTargetIdsBinding, noTargetIdsState, [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "startWave" },
  ]), /target-ID ceiling/i);
});

test("active-entity ceiling rejects a real spawn tick without partially mutating input state", () => {
  const noEntitiesKernel = compileKernelWithSourceReplacement(
    "const MAX_ACTIVE_ENTITIES = 4096;",
    "const MAX_ACTIVE_ENTITIES = 0;"
  );
  const binding = noEntitiesKernel.createRulesetBinding({ release: RELEASE, content: CONTENT });
  const state = noEntitiesKernel.createInitialState(binding, header(RELEASE));
  const commands = [
    { tick: 0, seq: 0, type: "startWave" },
  ];
  assertAtomicTickRejection(
    noEntitiesKernel,
    binding,
    state,
    commands,
    /Active hostile and summon entities exceed the kernel ceiling/
  );
});

test("target-candidate ceiling rejects a real acquisition tick without partial mutation", () => {
  const noCandidatesKernel = compileKernelWithSourceReplacement(
    "const MAX_TARGET_CANDIDATES = 4096;",
    "const MAX_TARGET_CANDIDATES = 0;"
  );
  const binding = noCandidatesKernel.createRulesetBinding({ release: RELEASE, content: CONTENT });
  const state = noCandidatesKernel.createInitialState(binding, header(RELEASE));
  const commands = [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "startWave" },
  ];
  assertAtomicTickRejection(
    noCandidatesKernel,
    binding,
    state,
    commands,
    /Target candidates exceed the kernel ceiling/
  );
});

test("semantic-event ceiling rejects a real wave-start tick without partial mutation", () => {
  const noEventsKernel = compileKernelWithSourceReplacement(
    "const MAX_SEMANTIC_EVENTS_PER_TICK = 16384;",
    "const MAX_SEMANTIC_EVENTS_PER_TICK = 0;"
  );
  const binding = noEventsKernel.createRulesetBinding({ release: RELEASE, content: CONTENT });
  const state = noEventsKernel.createInitialState(binding, header(RELEASE));
  const commands = [
    { tick: 0, seq: 0, type: "startWave" },
  ];
  assertAtomicTickRejection(
    noEventsKernel,
    binding,
    state,
    commands,
    /Semantic events exceed the kernel per-tick ceiling/
  );
});

test("ruleset binding and Start pin exact immutable identities and canonical facts", () => {
  const bound = Kernel.createRulesetBinding({ release: RELEASE, content: CONTENT });
  assert.deepEqual(bound, {
    abiHash: RELEASE.abiHash,
    abiVersion: 1,
    behaviorRegistryVersion: ABI.BEHAVIOR_REGISTRY_VERSION,
    contentVersion: RELEASE.contentVersion,
    eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
    missionIds: ["m01", "m04", "m05"],
    rulesetHash: RELEASE.rulesetHash,
    simulationHash: RELEASE.simulationHash,
  });
  const input = header(RELEASE, {
    assist: true,
    campaignModifierIds: ["reserve-1"],
  });
  const state = Kernel.createInitialState(bound, input);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(ABI.canonicalEncode(state), ABI.canonicalEncode(clone(state)));
  assert.equal(state.tick, 0);
  assert.equal(state.integrity, 25);
  assert.equal(state.management.aether, 208);
  assert.equal(state.management.phase, "planning");
  assert.equal(state.outcome, "active");
  assert.deepEqual(state.enemies, []);
  assert.deepEqual(state.pendingBossReleases, []);
  assert.deepEqual(state.objectiveFacts.routeLeakCounts, [
    { leakCount: 0, routeId: "route.main" },
  ]);
  assert.throws(
    () => Kernel.createInitialState(bound, header(RELEASE, { loadoutSlotCap: 0 })),
    /slot cap/i
  );
  assert.doesNotThrow(
    () => Kernel.createInitialState(bound, header(RELEASE, { loadoutSlotCap: 1 }))
  );
  assert.doesNotThrow(
    () => Kernel.createInitialState(bound, header(RELEASE, { loadoutSlotCap: 6 }))
  );
  assert.throws(
    () => Kernel.createInitialState(bound, header(RELEASE, { loadoutSlotCap: 7 })),
    /slot cap/i
  );
  assert.throws(
    () => Kernel.createInitialState(bound, header(RELEASE, { accessGrantIds: [] })),
    /access grant/i
  );
  assert.throws(
    () => Kernel.createInitialState(Object.freeze(clone(bound)), input),
    /binding/i
  );
});

test("planning is clock-suspended until an accepted Start and callers remain immutable", () => {
  const bound = Kernel.createRulesetBinding({ release: RELEASE, content: CONTENT });
  const state = Kernel.createInitialState(bound, header(RELEASE, {
    assist: true,
    campaignModifierIds: ["reserve-1"],
  }));
  const bucket = [{ tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" }];
  const beforeState = clone(state);
  const beforeBucket = clone(bucket);
  const planned = Kernel.advanceTick(bound, state, bucket);
  assert.deepEqual(state, beforeState);
  assert.deepEqual(bucket, beforeBucket);
  assert.equal(planned.state.tick, 0);
  assert.equal(planned.state.management.aether, 148);
  assert.deepEqual(planned.events, []);
  assert.deepEqual(planned.state.management.towers.map((tower) => tower.id), [1]);

  const started = Kernel.advanceTick(
    bound, planned.state, [{ tick: 0, seq: 0, type: "startWave" }]
  );
  assert.equal(started.state.tick, 1);
  assert.equal(started.state.management.phase, "wave");
  assert.equal(started.state.enemies.length, 1);
  assert.deepEqual(started.events.map((event) => event.eventId), ["wave.deploy", "enemy.spawn"]);

  const deniedOnly = Kernel.advanceTick(
    bound,
    state,
    [{ tick: 0, seq: 0, type: "build", padId: "not-a-pad", defenseId: "sentinel" }]
  );
  assert.equal(deniedOnly.state.tick, 0);
  assert.equal(deniedOnly.state.management.aether, 208);
  assert.throws(
    () => Kernel.advanceTick(bound, planned.state, [{ tick: 1, seq: 0, type: "startWave" }]),
    /current tick/i
  );
});

test("wave-start grant is sequenced before later commands but unavailable to earlier commands", () => {
  const game = fixture(function (content) {
    content.missions.m01.baseStartAether = 50;
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 1 })];
  });
  const baseHeader = header(game.release);
  const beforeStart = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, baseHeader),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assert.equal(beforeStart.state.management.aether, 77);
  assert.equal(beforeStart.state.management.towers.length, 0);
  assert.equal(beforeStart.state.enemies.length, 1);

  const afterStart = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, baseHeader),
    [
      { tick: 0, seq: 0, type: "startWave" },
      { tick: 0, seq: 1, type: "build", padId: "p01", defenseId: "sentinel" },
    ]
  );
  assert.equal(afterStart.state.management.aether, 17);
  assert.deepEqual(afterStart.state.management.towers.map((tower) => tower.id), [1]);
  assert.equal(afterStart.state.enemies.length, 1);
});

test("m01 golden executes build, Start, spawn, attack, kill, bounty, objectives, score, and clear", () => {
  const game = fixture(function (content) {
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 1 })];
    content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
    directLevel(content, "sentinel", 0).parameters.baseDamage = 100000;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release)),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assertTelemetry(result, 0);
  assert.deepEqual(result.telemetry.records.map((record) => record.kind), [
    "aether-transaction", "aether-transaction", "spawn", "movement-control", "activation",
    "damage", "aether-transaction", "aether-transaction",
  ]);
  assert.deepEqual(
    result.telemetry.records.filter((record) => record.kind === "aether-transaction")
      .map((record) => [record.action, record.sourceId, record.creditAether]),
    [
      ["build", "command.build", 0],
      ["wave-start-grant", "m01.w01", 18],
      ["bounty", "lineage.1", 2],
      ["wave-clear-grant", "m01.w01", 0],
    ]
  );
  const damageTelemetry = result.telemetry.records.find((record) => record.kind === "damage");
  assert.deepEqual({
    appliedHpDamageMilli: damageTelemetry.appliedHpDamageMilli,
    deferredHpDamageMilli: damageTelemetry.deferredHpDamageMilli,
    eligibleHpDamageMilli: damageTelemetry.eligibleHpDamageMilli,
    noExternalAppliedHpDamageMilli: damageTelemetry.noExternalAppliedHpDamageMilli,
    overkillHpDamageMilli: damageTelemetry.overkillHpDamageMilli,
  }, {
    appliedHpDamageMilli: 23800,
    deferredHpDamageMilli: 0,
    eligibleHpDamageMilli: 100000,
    noExternalAppliedHpDamageMilli: 23800,
    overkillHpDamageMilli: 76200,
  });
  assert.deepEqual(result.events.map((event) => event.eventId), ["wave.deploy", "enemy.spawn"]);
  assert.equal(result.state.tick, 1);
  assert.equal(result.state.outcome, "victory");
  assert.equal(result.state.management.phase, "complete");
  assert.equal(result.state.management.aether, 138);
  assert.equal(result.state.management.bountyRemainder, 2000);
  assert.deepEqual(result.state.scoreFacts, { killScore: 40, waveScore: 100 });
  assert.equal(result.state.lineages[0].claimed, true);
  assert.equal(result.state.lineages[0].lineageId, "lineage.1");
  assert.equal(result.state.score, 2281);
  assert.deepEqual(result.state.objectiveResults.map((record) => record.complete), [true, true, true]);
  assert.equal(
    stateHash(result.state),
    "07c21163252d649885f12f171b735dcff37905c57a0f2f75e9ca6e8e148fbf3f"
  );
  assert.equal(Object.prototype.hasOwnProperty.call(result.state, "telemetry"), false);
  assert.throws(() => Kernel.advanceTick(game.binding, result.state, []), /terminal/i);
});

test("wave clear at tick N returns the planning boundary at N+1", () => {
  const game = fixture(function (content) {
    const first = content.missions.m01.waves[0];
    first.index = 1;
    first.groups = [Object.assign({}, first.groups[0], { count: 1 })];
    const second = clone(first);
    second.id = "m01.w02";
    second.index = 2;
    second.groups[0].id = "m01.w02.g00";
    content.missions.m01.waves = [first, second];
    content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
    directLevel(content, "sentinel", 0).parameters.baseDamage = 100000;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release)),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assert.equal(result.state.tick, 1);
  assert.equal(result.state.outcome, "active");
  assert.equal(result.state.management.phase, "planning");
  assert.equal(result.state.management.clearedWaves, 1);
  assert.equal(result.state.waveStartTick, null);
});

test("m01 tutorial gate releases after Wave 1 and upgrades then sell at exactly 70 percent", () => {
  const game = fixture(function (content) {
    content.missions.m01.baseStartAether = 500;
    const first = content.missions.m01.waves[0];
    first.index = 1;
    first.groups = [Object.assign({}, first.groups[0], { count: 1 })];
    const second = clone(first);
    second.id = "m01.w02";
    second.index = 2;
    second.groups[0].id = "m01.w02.g00";
    content.missions.m01.waves = [first, second];
    content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
    directLevel(content, "sentinel", 0).parameters.baseDamage = 100000;
  });
  let state = Kernel.createInitialState(game.binding, header(game.release));
  let result = Kernel.advanceTick(game.binding, state, [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "upgrade", towerId: 1 },
  ]);
  assert.equal(result.state.tick, 0);
  assert.equal(result.state.management.towers[0].level, 1);
  assert.equal(result.state.management.tutorialUpgradeGateOpen, false);
  result = Kernel.advanceTick(
    game.binding, result.state, [{ tick: 0, seq: 0, type: "startWave" }]
  );
  assert.equal(result.state.tick, 1);
  assert.equal(result.state.management.phase, "planning");
  assert.equal(result.state.management.tutorialUpgradeGateOpen, true);
  assert.equal(result.state.management.aether, 555);
  result = Kernel.advanceTick(game.binding, result.state, [
    { tick: 1, seq: 0, type: "upgrade", towerId: 1 },
    { tick: 1, seq: 1, type: "upgrade", towerId: 1 },
    { tick: 1, seq: 2, type: "sell", towerId: 1 },
  ]);
  assert.equal(result.state.tick, 1);
  assert.equal(result.state.management.towers.length, 0);
  assert.equal(result.state.management.aether, 552);
  assert.equal(60 + 55 + 95, 210);
  assert.equal(Math.floor(210 * 70 / 100), 147);
});

test("damage arithmetic uses milli damage, armor, then resistance exactly once", () => {
  const game = fixture(function (content) {
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 1, enemyId: "guardian" })];
    content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
    directLevel(content, "sentinel", 0).parameters.baseDamage = 10000;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release)),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assert.equal(result.state.enemies[0].ownerId, "guardian");
  assert.equal(result.state.enemies[0].maximumHpMilli, 110500);
  assert.equal(result.state.enemies[0].hpMilli, 105400);
});

test("damage selects one strongest active armor-break status instead of summing", () => {
  const testKernel = compileKernelWithSourceReplacement(
    "    advanceTick: advanceTick,",
    "    advanceTick: advanceTick,\n" +
      "    __testStrongestArmorBreakMilli: strongestArmorBreakMilli,"
  );
  assert.equal(
    testKernel.__testStrongestArmorBreakMilli([
      {
        appliedTick: 2, delayTimer: null, magnitude: 3200, sourceRuntimeId: 7,
        statusId: "armor-break", targetRuntimeId: 9, timer: null,
      },
      {
        appliedTick: 1, delayTimer: null, magnitude: 5000, sourceRuntimeId: 8,
        statusId: "armor-break", targetRuntimeId: 9, timer: null,
      },
    ], 9),
    5000
  );
});

test("Chronos slow changes canonical movement and expires before the affected movement phase", () => {
  const game = fixture(function (content) {
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 1 })];
    content.enemies.scout.speedWorldUnitsPerSecond = 60000;
    const level = content.defenses.chronos.levels[0];
    level.rangeWorldUnits = 1000000;
    const direct = directLevel(content, "chronos", 0);
    direct.parameters.baseDamage = 1;
    direct.parameters.cooldownMs = 100000;
    const slow = level.behaviors.find((behavior) => behavior.contractId === "slow");
    slow.parameters.durationMs = 100;
  });
  let result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      loadoutIds: ["chronos"], accessGrantIds: ["campaign.chronos"],
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "chronos" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  const slowApply = result.telemetry.records.find(function (record) {
    return record.kind === "effect" && record.statusId === "slow";
  });
  assert.deepEqual(
    [slowApply.action, slowApply.outcome, slowApply.sourceTowerRuntimeId, slowApply.effectKind],
    ["apply", "applied", 1, "status"]
  );
  assert.equal(result.state.enemies[0].distance, 950);
  assert.equal(result.state.effects.some((effect) => effect.statusId === "slow"), true);
  result = Kernel.advanceTick(game.binding, result.state, []);
  assert.equal(result.state.enemies[0].distance, 1596);
  const slowedMovement = result.telemetry.records.find((record) => record.kind === "movement-control");
  assert.deepEqual(slowedMovement.sourceEffectRuntimeIds, [1]);
  assert.deepEqual(slowedMovement.sourceRuntimeIds, [1]);
  assert.deepEqual(slowedMovement.sourceTowerRuntimeIds, [1]);
  while (result.state.tick < 6) result = Kernel.advanceTick(game.binding, result.state, []);
  assert.equal(result.state.effects.some((effect) => effect.statusId === "slow"), true);
  const beforeExpiryMovement = result.state.enemies[0].distance;
  result = Kernel.advanceTick(game.binding, result.state, []);
  assert.equal(result.state.effects.some((effect) => effect.statusId === "slow"), false);
  assert.equal(result.state.enemies[0].distance - beforeExpiryMovement, 950);
  assert.deepEqual(
    result.telemetry.records.filter((record) => record.kind === "effect")
      .map((record) => [record.action, record.statusId, record.outcome]),
    [["expire", "slow", "expired"]]
  );
});

test("Hoplite L3 creates guards, clamps marker contact, bashes once, then applies Resolve", () => {
  const game = fixture(function (content) {
    content.missions.m01.baseStartAether = 500;
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 1 })];
    content.enemies.scout.speedWorldUnitsPerSecond = 300000;
  });
  let result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      loadoutIds: ["hoplite"],
      accessGrantIds: ["campaign.hoplite"],
      tutorialUpgradeGateMode: "none",
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "hoplite" },
      { tick: 0, seq: 1, type: "upgrade", towerId: 1 },
      { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
      { tick: 0, seq: 3, type: "startWave" },
    ]
  );
  assert.equal(result.events.filter((event) => event.eventId === "guard.create").length, 3);
  assert.equal(result.state.enemies[0].distance, 4750);
  result = Kernel.advanceTick(game.binding, result.state, []);
  assert.equal(result.state.enemies[0].distance, 5000);
  assert.equal(result.state.enemies[0].hpMilli, 11800);
  assert.equal(result.events.some((event) => event.eventId === "guard.contact"), true);
  assert.equal(result.events.some((event) => event.eventId === "guard.bash"), true);
  assert.equal(result.events.some((event) => event.eventId === "guard.consume"), true);
  assert.equal(result.state.effects.some((effect) => effect.statusId === "stun"), true);
  assert.equal(result.state.effects.some((effect) => effect.statusId === "resolve"), true);
  const guardContact = result.telemetry.records.find(function (record) {
    return record.kind === "activation" && record.actionId === "guard-contact";
  });
  assert.deepEqual(
    [guardContact.outcome, guardContact.sourceTowerRuntimeId, guardContact.sourceRuntimeId],
    ["accepted", 1, 1]
  );
  const guardMovement = result.telemetry.records.find((record) => record.kind === "movement-control");
  assert.deepEqual(guardMovement.sourceRuntimeIds, [1]);
  assert.deepEqual(guardMovement.sourceTowerRuntimeIds, [1]);
  assert.equal(guardMovement.effectiveSpeedBp, 0);

  while (!result.state.effects.some(function (effect) {
    return effect.statusId === "resolve" && effect.delayTimer === null;
  })) {
    result = Kernel.advanceTick(game.binding, result.state, []);
  }
  const resolveActivation = result.telemetry.records.find(function (record) {
    return record.kind === "effect" && record.statusId === "resolve" &&
      record.action === "refresh";
  });
  assert.deepEqual([
    resolveActivation.effectKind,
    resolveActivation.outcome,
    resolveActivation.sourceRuntimeId,
    resolveActivation.sourceTowerRuntimeId,
  ], ["status", "refreshed", 1, null]);
  assert.equal(result.state.effects.some((effect) => effect.statusId === "stun"), false);
  let rejected = false;
  for (let guard = 0; guard < 10 && !rejected; guard += 1) {
    result = Kernel.advanceTick(game.binding, result.state, []);
    rejected = result.events.some((event) =>
      event.eventId === "guard.rejected" && event.payload.reasonId === "resolve-active"
    );
  }
  assert.equal(rejected, true);
});

test("same-tower Hoplite bash contacts retain their returned target order", () => {
  const game = fixture(function (content) {
    content.missions.m01.baseStartAether = 500;
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 2, intervalTicks: 0 })];
    content.enemies.scout.speedWorldUnitsPerSecond = 20000000;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      loadoutIds: ["hoplite"],
      accessGrantIds: ["campaign.hoplite"],
      tutorialUpgradeGateMode: "none",
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "hoplite" },
      { tick: 0, seq: 1, type: "upgrade", towerId: 1 },
      { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
      { tick: 0, seq: 3, type: "startWave" },
    ]
  );
  assert.deepEqual(
    result.telemetry.records.filter(function (record) {
      return record.kind === "activation" && record.actionId === "guard-contact" &&
        record.outcome === "accepted";
    }).map((record) => record.selectedTargetRuntimeIds[0]),
    [1, 2]
  );
  assert.deepEqual(
    result.telemetry.records.filter((record) => record.kind === "damage")
      .map((record) => [record.sourceRuntimeId, record.targetRuntimeId]),
    [[1, 1], [2, 2]]
  );
});

test("Oracle mark amplifies later exact damage, then expires before later damage", () => {
  const game = fixture(function (content) {
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 1 })];
    content.enemies.scout.hp = 100000;
    const oracle = content.defenses.oracle.levels[0];
    oracle.rangeWorldUnits = 1000000;
    const mark = oracle.behaviors.find((behavior) => behavior.id === "mark");
    mark.parameters.cadenceMs = 100000;
    mark.parameters.durationMs = 500;
    const sentinel = content.defenses.sentinel.levels[0];
    sentinel.rangeWorldUnits = 1000000;
    const direct = directLevel(content, "sentinel", 0);
    direct.parameters.baseDamage = 10000;
    direct.parameters.cooldownMs = 200;
  });
  let result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      loadoutIds: ["oracle", "sentinel"],
      loadoutSlotCap: 2,
      accessGrantIds: ["campaign.oracle", "campaign.sentinel"],
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "oracle" },
      { tick: 0, seq: 1, type: "build", padId: "p02", defenseId: "sentinel" },
      { tick: 0, seq: 2, type: "startWave" },
    ]
  );
  const markApply = result.telemetry.records.find(function (record) {
    return record.kind === "effect" && record.statusId === "mark";
  });
  assert.deepEqual(
    [markApply.action, markApply.sourceTowerRuntimeId, markApply.outcome],
    ["apply", 1, "applied"]
  );
  assert.equal(result.state.enemies[0].hpMilli, 75000);
  assert.equal(result.events.some((event) => event.eventId === "mark.apply"), true);
  while (result.state.tick < 13) result = Kernel.advanceTick(game.binding, result.state, []);
  assert.equal(result.state.enemies[0].hpMilli, 64200);
  const markedDamage = result.telemetry.records.find((record) => record.kind === "damage");
  assert.deepEqual(markedDamage.supportSourceTowerRuntimeIds, [1]);
  assert.equal(markedDamage.appliedHpDamageMilli, 10800);
  assert.equal(markedDamage.noExternalAppliedHpDamageMilli, 10000);
  while (result.state.tick < 31) result = Kernel.advanceTick(game.binding, result.state, []);
  assert.equal(result.events.some((event) => event.eventId === "mark.expire"), true);
  assert.equal(result.state.effects.some((effect) => effect.statusId === "mark"), false);
  assert.deepEqual(
    result.telemetry.records.filter((record) => record.kind === "effect")
      .map((record) => [record.action, record.statusId, record.outcome]),
    [["expire", "mark", "expired"]]
  );
  while (result.state.tick < 37) result = Kernel.advanceTick(game.binding, result.state, []);
  assert.equal(result.state.enemies[0].hpMilli, 43400);
});

test("same-tick intent tuple preserves snapshots and never retargets after an earlier kill", () => {
  const game = fixture(function (content) {
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 2, intervalTicks: 0 })];
    content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
    directLevel(content, "sentinel", 0).parameters.baseDamage = 100000;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release)),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "build", padId: "p02", defenseId: "sentinel" },
      { tick: 0, seq: 2, type: "startWave" },
    ]
  );
  assert.deepEqual(result.state.enemies.map((enemy) => [enemy.id, enemy.hpMilli]), [[2, 23800]]);
  assert.equal(result.state.scoreFacts.killScore, 40);
  assert.deepEqual(result.state.lineages.map((lineage) => lineage.claimed), [true, false]);
});

test("Siege splash cannot cross from its ground targetKinds into an air route", () => {
  const game = fixture(function (content) {
    const sourceWave = content.missions.m04.waves[0];
    const north = Object.assign({}, sourceWave.groups[0], { count: 1, order: 0 });
    const south = Object.assign({}, sourceWave.groups[1], { count: 1, order: 1 });
    oneWave(content, "m04", 0, [north, south]);
    content.maps.m04.routes.find((route) => route.id === "route.south").kind = "air";
    content.enemies.scout.routeKinds = ["air", "ground"];
    const level = content.defenses.siege.levels[0];
    level.rangeWorldUnits = 1000000;
    level.behaviors[0].parameters.radiusWorldUnits = 1000000;
    level.behaviors[0].parameters.baseDamage = 10000;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      missionId: "m04",
      loadoutIds: ["siege"],
      accessGrantIds: ["campaign.siege"],
      tutorialUpgradeGateMode: "none",
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "siege" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  const ground = result.state.enemies.find((enemy) => enemy.routeKind === "ground");
  const air = result.state.enemies.find((enemy) => enemy.routeKind === "air");
  assert.equal(ground.hpMilli, 13800);
  assert.equal(air.hpMilli, 23800);
});

test("splash activation eligibility includes a cloaked collateral selection", () => {
  const game = fixture(function (content) {
    const sourceWave = content.missions.m04.waves[0];
    oneWave(content, "m04", 0, [
      Object.assign({}, sourceWave.groups[0], {
        count: 1, enemyId: "echo", id: "m04.w01.g00", order: 0,
      }),
      Object.assign({}, sourceWave.groups[1], {
        count: 1, enemyId: "scout", id: "m04.w01.g01", order: 1,
      }),
    ]);
    const level = content.defenses.siege.levels[0];
    level.rangeWorldUnits = 1000000;
    level.behaviors[0].parameters.radiusWorldUnits = 1000000;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      missionId: "m04",
      loadoutIds: ["siege"],
      accessGrantIds: ["campaign.siege"],
      tutorialUpgradeGateMode: "none",
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "siege" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  const activation = result.telemetry.records.find(function (record) {
    return record.kind === "activation" && record.actionId === "splash-blast";
  });
  assert.deepEqual(activation.eligibleTargetRuntimeIds, [1, 2]);
  assert.deepEqual(activation.selectedTargetRuntimeIds, [1, 2]);
});

test("m04 FRONT ties across equal routes resolve by shared enemy runtime ID", () => {
  const game = fixture(function (content) {
    const sourceWave = content.missions.m04.waves[0];
    oneWave(content, "m04", 0, [
      Object.assign({}, sourceWave.groups[0], { count: 1, order: 0 }),
      Object.assign({}, sourceWave.groups[1], { count: 1, order: 1 }),
    ]);
    content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
    directLevel(content, "sentinel", 0).parameters.baseDamage = 1000;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      missionId: "m04", tutorialUpgradeGateMode: "none",
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assert.deepEqual(result.state.enemies.map((enemy) => [
    enemy.id, enemy.routeId, enemy.position.remainingDistance, enemy.hpMilli,
  ]), [
    [1, "route.north", result.state.enemies[1].position.remainingDistance, 22800],
    [2, "route.south", result.state.enemies[0].position.remainingDistance, 23800],
  ]);
});

test("m04 shared-route leaks update route and lineage facts once in enemy-ID order", () => {
  const game = fixture(function (content) {
    const sourceWave = content.missions.m04.waves[0];
    oneWave(content, "m04", 0, [
      Object.assign({}, sourceWave.groups[0], { count: 1, order: 0 }),
      Object.assign({}, sourceWave.groups[1], { count: 1, order: 1 }),
    ]);
    content.enemies.scout.speedWorldUnitsPerSecond = 20000000;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      missionId: "m04", tutorialUpgradeGateMode: "none",
    })),
    [{ tick: 0, seq: 0, type: "startWave" }]
  );
  assertTelemetry(result, 0);
  assert.deepEqual(
    result.telemetry.records.filter((record) => record.kind === "leak")
      .map((record) => [record.enemyRuntimeId, record.routeId, record.integrityDamage]),
    [[1, "route.north", 1], [2, "route.south", 1]]
  );
  assert.deepEqual(
    result.telemetry.records.filter((record) => record.kind === "movement-control")
      .map((record) => record.sourceEffectRuntimeIds),
    [[], []]
  );
  assert.equal(result.state.outcome, "victory");
  assert.equal(result.state.integrity, 23);
  assert.deepEqual(result.state.objectiveFacts.routeLeakCounts, [
    { leakCount: 1, routeId: "route.north" },
    { leakCount: 1, routeId: "route.south" },
  ]);
  assert.deepEqual(
    result.state.objectiveFacts.lineageTagLeakCounts.filter((record) => record.leakCount > 0),
    [
      { leakCount: 2, lineageTag: "regular" },
      { leakCount: 2, lineageTag: "swift" },
    ]
  );
  assert.deepEqual(result.state.objectiveResults.map((record) => record.complete), [true, true, false]);
});

test("the first simultaneous zero-integrity leak is immediately terminal", () => {
  const game = fixture(function (content) {
    const sourceWave = content.missions.m04.waves[0];
    oneWave(content, "m04", 0, [
      Object.assign({}, sourceWave.groups[0], { count: 1, order: 0 }),
      Object.assign({}, sourceWave.groups[1], { count: 1, order: 1 }),
    ]);
    content.enemies.scout.speedWorldUnitsPerSecond = 20000000;
    content.enemies.scout.leakIntegrity = 25;
  });
  const result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      missionId: "m04", tutorialUpgradeGateMode: "none",
    })),
    [{ tick: 0, seq: 0, type: "startWave" }]
  );
  assert.equal(result.state.outcome, "defeat");
  assert.equal(result.state.integrity, 0);
  assert.deepEqual(result.state.objectiveFacts.routeLeakCounts, [
    { leakCount: 1, routeId: "route.north" },
    { leakCount: 0, routeId: "route.south" },
  ]);
  assert.deepEqual(result.state.enemies.map((enemy) => enemy.id), [2]);
  assert.equal(result.state.score, 0);
  assert.throws(
    () => Kernel.advanceTick(game.binding, result.state, [{ malformed: true }]),
    /terminal/i
  );
});

test("Story bounty remainder carries through ordered kills and pays only on death", () => {
  const game = fixture(function (content) {
    const source = content.missions.m01.waves[0].groups[0];
    oneWave(content, "m01", 0, [
      Object.assign(clone(source), { count: 1, enemyId: "scout", id: "m01.w01.g00", order: 0 }),
      Object.assign(clone(source), { count: 1, enemyId: "raider", id: "m01.w01.g01", order: 1 }),
      Object.assign(clone(source), { count: 1, enemyId: "guardian", id: "m01.w01.g02", order: 2 }),
    ]);
    ["scout", "raider", "guardian"].forEach(function (enemyId) {
      content.enemies[enemyId].hp = 1;
      content.enemies[enemyId].armor = 0;
      content.enemies[enemyId].resistances = [];
    });
    content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
    const direct = directLevel(content, "sentinel", 0);
    direct.parameters.baseDamage = 100000;
    direct.parameters.cooldownMs = 17;
  });
  let result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release)),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assert.equal(result.state.management.aether, 138);
  assert.equal(result.state.management.bountyRemainder, 2000);
  while (result.state.scoreFacts.killScore < 100) {
    result = Kernel.advanceTick(game.binding, result.state, []);
  }
  assert.equal(result.state.management.aether, 141);
  assert.equal(result.state.management.bountyRemainder, 5000);
  while (result.state.scoreFacts.killScore < 240) {
    result = Kernel.advanceTick(game.binding, result.state, []);
  }
  assert.equal(result.state.management.aether, 147);
  assert.equal(result.state.management.bountyRemainder, 0);
  assert.deepEqual(result.state.scoreFacts, { killScore: 240, waveScore: 100 });
  assert.deepEqual(result.state.lineages.map((lineage) => lineage.claimed), [true, true, true]);
});

test("Oracle reveal enters, leaves, and is removed on a same-tick sell without orphan effects", () => {
  function oracleGame(speed) {
    return fixture(function (content) {
      const wave = oneWave(content, "m01", 0);
      wave.groups = [Object.assign({}, wave.groups[0], { count: 1, enemyId: "echo" })];
      content.enemies.echo.speedWorldUnitsPerSecond = speed;
    });
  }
  const replayHeader = function (game) {
    return header(game.release, {
      loadoutIds: ["oracle"], accessGrantIds: ["campaign.oracle"],
    });
  };
  const moving = oracleGame(50000);
  let result = Kernel.advanceTick(
    moving.binding,
    Kernel.createInitialState(moving.binding, replayHeader(moving)),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "oracle" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assert.equal(result.events.some((event) => event.eventId === "reveal.apply"), true);
  let removeTick = null;
  for (let guard = 0; guard < 180 && removeTick === null; guard += 1) {
    result = Kernel.advanceTick(moving.binding, result.state, []);
    if (result.events.some((event) => event.eventId === "reveal.remove")) {
      removeTick = result.state.tick - 1;
    }
  }
  assert.notEqual(removeTick, null);
  assert.equal(result.state.effects.some((effect) => effect.statusId === "reveal"), false);

  const sold = oracleGame(1);
  result = Kernel.advanceTick(
    sold.binding,
    Kernel.createInitialState(sold.binding, replayHeader(sold)),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "oracle" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assert.equal(result.state.effects.some((effect) => effect.statusId === "reveal"), true);
  result = Kernel.advanceTick(
    sold.binding, result.state, [{ tick: 1, seq: 0, type: "sell", towerId: 1 }]
  );
  assert.equal(result.events.some((event) => event.eventId === "reveal.remove"), true);
  assert.equal(result.state.effects.some((effect) => effect.statusId === "reveal"), false);
  assert.equal(result.state.timers.length, 0);
});

test("terminal death purges Oracle reveal membership with no dangling runtime ID", () => {
  const game = fixture(function (content) {
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 1, enemyId: "echo" })];
    content.defenses.oracle.levels[0].rangeWorldUnits = 1000000;
    content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
    directLevel(content, "sentinel", 0).parameters.baseDamage = 1000000000;
  });
  let result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      loadoutIds: ["oracle", "sentinel"],
      loadoutSlotCap: 2,
      accessGrantIds: ["campaign.oracle", "campaign.sentinel"],
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "oracle" },
      { tick: 0, seq: 1, type: "build", padId: "p02", defenseId: "sentinel" },
      { tick: 0, seq: 2, type: "startWave" },
    ]
  );
  assert.equal(result.state.enemies.length, 1);
  assert.deepEqual(result.state.timers[0].behaviorStates[0].state.revealedEnemyRuntimeIds, [1]);
  result = Kernel.advanceTick(game.binding, result.state, []);
  assert.equal(result.state.outcome, "victory");
  assert.deepEqual(result.state.enemies, []);
  assert.deepEqual(result.state.effects, []);
  assert.deepEqual(result.state.timers[0].behaviorStates[0].state.revealedEnemyRuntimeIds, []);
});

test("Sentinel no-target reset advances independently of residual cooldown", () => {
  const game = fixture(function (content) {
    content.missions.m01.baseStartAether = 500;
    const wave = oneWave(content, "m01", 0);
    wave.groups = [Object.assign({}, wave.groups[0], { count: 1 })];
    content.enemies.scout.speedWorldUnitsPerSecond = 50000;
    directLevel(content, "sentinel", 2).parameters.baseDamage = 1;
  });
  let result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      tutorialUpgradeGateMode: "none",
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "upgrade", towerId: 1 },
      { tick: 0, seq: 2, type: "upgrade", towerId: 1 },
      { tick: 0, seq: 3, type: "startWave" },
    ]
  );
  function directState(state) {
    return state.timers[0].behaviorStates[0];
  }
  assert.equal(directState(result.state).state.targetRuntimeId, 1);
  let firstIdle = null;
  for (let guard = 0; guard < 180 && firstIdle === null; guard += 1) {
    result = Kernel.advanceTick(game.binding, result.state, []);
    if (directState(result.state).state.idleElapsedTimeUnits > 0) firstIdle = result;
  }
  assert.notEqual(firstIdle, null);
  assert.equal(directState(firstIdle.state).state.idleElapsedTimeUnits, 1000);
  assert.equal(directState(firstIdle.state).timer.remainingUnits > 0, true);
  result = firstIdle;
  for (let count = 1; count < 59; count += 1) {
    result = Kernel.advanceTick(game.binding, result.state, []);
  }
  assert.equal(directState(result.state).state.idleElapsedTimeUnits, 59000);
  result = Kernel.advanceTick(game.binding, result.state, []);
  assert.deepEqual(directState(result.state).state, {
    acceptedHitCount: 0,
    idleElapsedTimeUnits: 0,
    targetRuntimeId: null,
  });
});

test("m05 current-source Talos thresholds warn now, release later, and preserve pod lineage jobs", () => {
  const source = compileCurrentSource();
  const game = fixture(function (content) {
    const wave = oneWave(content, "m05", 7);
    wave.groups = [wave.groups[0]];
    wave.deploymentGrantAether = 0;
    const talos = content.bosses["talos-prototype"];
    talos.hp = 100000;
    talos.armor = 0;
    talos.resistances = [];
    content.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
    directLevel(content, "sentinel", 0).parameters.baseDamage = 100000;
  }, source);
  let result = Kernel.advanceTick(
    game.binding,
    Kernel.createInitialState(game.binding, header(game.release, {
      missionId: "m05", tutorialUpgradeGateMode: "none",
    })),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assertTelemetry(result, 0);
  assert.equal(
    result.telemetry.records.find((record) => record.kind === "spawn").entityKind,
    "boss"
  );
  const thresholdDamage = result.telemetry.records.find((record) => record.kind === "damage");
  assert.equal(thresholdDamage.deferredHpDamageMilli > 0, true);
  assert.equal(thresholdDamage.overkillHpDamageMilli, 0);
  assert.equal(result.state.enemies[0].hpMilli, 63750);
  assert.equal(result.state.pendingBossReleases[0].dueTick, 20);
  assert.equal(result.state.pendingBossReleases[0].releasePlan.lineageId, "lineage.1");
  assert.deepEqual(result.events.map((event) => event.eventId), [
    "wave.deploy", "boss.spawn", "talos.phase-exit", "talos.phase-enter", "talos.threshold",
  ]);
  while (result.state.tick <= 20) result = Kernel.advanceTick(game.binding, result.state, []);
  assertTelemetry(result, 20);
  assert.deepEqual(
    result.telemetry.records.filter((record) => record.kind === "effect")
      .map((record) => [record.action, record.effectKind, record.outcome]),
    [
      ["apply", "boss-exposure", "applied"],
      ["apply", "resistance-override", "applied"],
    ]
  );
  assert.deepEqual(result.events.map((event) => event.eventId), [
    "talos.status", "talos.expose", "talos.pods",
  ]);
  assert.equal(result.state.pendingBossReleases.length, 0);
  assert.deepEqual(result.state.effects.map((effect) => [effect.kind, effect.magnitude]), [
    ["boss-exposure", 4000],
    ["resistance-override", 0],
  ]);
  assert.deepEqual(result.state.pendingSpawns.map((job) => job.lineageId), [
    "lineage.1", "lineage.1", "lineage.1",
  ]);
  const talosEvents = result.events.map((event) => event.eventId);
  while (result.state.enemies.some((enemy) => enemy.kind === "boss")) {
    result = Kernel.advanceTick(game.binding, result.state, []);
    result.events.forEach((event) => talosEvents.push(event.eventId));
  }
  assert.equal(result.state.lineages[0].claimed, false);
  assert.equal(result.state.pendingSpawns.length > 0, true);
  assert.equal(result.state.pendingSpawns.every((job) => job.lineageId === "lineage.1"), true);
  assert.equal(result.state.scoreFacts.killScore >= 2500, true);
  assert.equal(talosEvents.filter((eventId) => eventId === "talos.threshold").length, 2);
  assert.equal(talosEvents.filter((eventId) => eventId === "talos.expose").length, 3);
  assert.equal(talosEvents.filter((eventId) => eventId === "talos.pods").length, 3);
  assert.equal(result.state.outcome, "active");
  assert.equal(result.state.management.phase, "wave");
  const pod = result.state.enemies.find((enemy) => enemy.kind === "enemy");
  assert.equal(pod.lineageId, "lineage.1");
  assert.deepEqual(pod.lineageTags, ["boss", "heavy", "regular", "swift"]);
  for (let guard = 0; guard < 800 && result.state.outcome === "active"; guard += 1) {
    result = Kernel.advanceTick(game.binding, result.state, []);
  }
  assert.equal(result.state.outcome, "victory");
  assert.equal(result.state.enemies.length, 0);
  assert.equal(result.state.pendingSpawns.length, 0);
  assert.equal(result.state.pendingBossReleases.length, 0);
});

test("classic scripts share Node ABI identity and deterministic terminal final hash", () => {
  const terminalContent = clone(CONTENT);
  const terminalWave = terminalContent.missions.m01.waves[0];
  terminalWave.index = 1;
  terminalWave.groups = [Object.assign({}, terminalWave.groups[0], { count: 1 })];
  terminalContent.missions.m01.waves = [terminalWave];
  terminalContent.defenses.sentinel.levels[0].rangeWorldUnits = 1000000;
  directLevel(terminalContent, "sentinel", 0).parameters.baseDamage = 100000;
  const context = vm.createContext({ console: console });
  [
    "abi.js", "geometry.js", "timers.js", "economy.js", "movement.js", "effects.js",
    "targeting.js", "behaviors.js", "commands.js", "abi-v2.js", "commands-v2.js", "protocols.js",
    "relics.js", "management.js", "objectives.js", "kernel.js",
  ].forEach(function (name) {
    const file = path.join(__dirname, "..", "js", "sim", name);
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  });
  vm.runInContext(fs.readFileSync(RELEASE_PATH, "utf8"), context, { filename: RELEASE_PATH });
  vm.runInContext(fs.readFileSync(CONTENT_PATH, "utf8"), context, { filename: CONTENT_PATH });
  context.__headerJson = JSON.stringify(header(RELEASE));
  context.__contentJson = JSON.stringify(terminalContent);
  const classicJson = vm.runInContext(`(() => {
    const kernel = Game.AegisKernel;
    function freeze(value) {
      if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
      Object.keys(value).forEach((key) => freeze(value[key]));
      return Object.freeze(value);
    }
    const binding = kernel.createRulesetBinding({
      release: Game.AegisRelease.RELEASE,
      content: freeze(JSON.parse(__contentJson)),
    });
    const start = kernel.createInitialState(binding, JSON.parse(__headerJson));
    const result = kernel.advanceTick(binding, start, [
      {tick:0,seq:0,type:"build",padId:"p01",defenseId:"sentinel"},
      {tick:0,seq:1,type:"startWave"},
    ]);
    return JSON.stringify({
      abi: kernel.ABI_DESCRIPTOR_SHA256,
      canonical: Game.AegisSim.canonicalEncode(result.state),
      events: result.events.map((event) => event.eventId),
      hash: Game.AegisSim.sha256Hex(Game.AegisSim.canonicalBytes(result.state)),
    });
  })()`, context);
  const classic = JSON.parse(classicJson);
  deepFreeze(terminalContent);
  const nodeBinding = Kernel.createRulesetBinding({ release: RELEASE, content: terminalContent });
  const nodeResult = Kernel.advanceTick(
    nodeBinding,
    Kernel.createInitialState(nodeBinding, header(RELEASE)),
    [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]
  );
  assert.equal(classic.abi, Kernel.ABI_DESCRIPTOR_SHA256);
  assert.equal(nodeResult.state.outcome, "victory");
  assert.equal(classic.canonical, ABI.canonicalEncode(nodeResult.state));
  assert.equal(classic.hash, stateHash(nodeResult.state));
  assert.deepEqual(classic.events, nodeResult.events.map((event) => event.eventId));
});
