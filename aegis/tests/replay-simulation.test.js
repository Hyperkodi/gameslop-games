"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const Commands = require("../js/sim/commands.js");

const SIM_ROOT = path.join(__dirname, "..", "js", "sim");
const RUNNER_SOURCE = fs.readFileSync(path.join(SIM_ROOT, "replay-runner.js"), "utf8");
const REPLAY_SOURCE = fs.readFileSync(path.join(SIM_ROOT, "replay.js"), "utf8");
const FIXTURE_ROOT = path.join(__dirname, "fixtures", "replays", "slice");
const RULESET_HASH = "sha256:" + "c".repeat(64);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture(missionId) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, missionId + ".valid.json"), "utf8"));
}

function telemetryRecordsV1() {
  return [
    {
      kind: "spawn", ordinal: 0, entityKind: "enemy", enemyRuntimeId: 1,
      ownerId: "scout", lineageId: "lineage.1", routeId: "route.main", waveId: "m01.w01",
      maximumHpMilli: 24000, initialShieldMilli: 0,
      baseSpeedDistanceUnitsPerSecond: 11000,
    },
    {
      kind: "aether-transaction", ordinal: 1, action: "build", sourceId: "command.build",
      commandSeq: 0, towerRuntimeId: 1, padId: "pad.p01", defenseId: "sentinel",
      levelBefore: 0, levelAfter: 1, debitAether: 50, creditAether: 0,
      investedBeforeAether: 0, investedAfterAether: 50,
      bankBeforeAether: 150, bankAfterAether: 100,
      bountyRemainderBefore: 0, bountyRemainderAfter: 0,
    },
    {
      kind: "activation", ordinal: 2, actionId: "direct-hit", behaviorId: "shot",
      sourceTowerRuntimeId: 1, sourceRuntimeId: 1, defenseId: "sentinel", level: 1,
      padId: "pad.p01", outcome: "accepted", eligibleTargetRuntimeIds: [1, 2],
      selectedTargetRuntimeIds: [1],
    },
    {
      kind: "movement-control", ordinal: 3, enemyRuntimeId: 1, ownerId: "scout",
      lineageId: "lineage.1", routeId: "route.main", priorRouteDistance: 0,
      nextRouteDistance: 100, actualAdvanceDistance: 100, effectiveSpeedBp: 9000,
      scaledReductionBp: 1000, sourceEffectRuntimeIds: [10, 12], sourceRuntimeIds: [7, 8],
      sourceTowerRuntimeIds: [3],
    },
    {
      kind: "damage", ordinal: 4, sourceTowerRuntimeId: 1, sourceRuntimeId: 1,
      defenseId: "sentinel", level: 1, padId: "pad.p01", targetRuntimeId: 1,
      targetOwnerId: "scout", targetLineageId: "lineage.1", targetRouteId: "route.main",
      damageTypeId: "kinetic", baseDamageMilli: 10000, preShieldDamageMilli: 10000,
      attemptedShieldDamageMilli: 0, appliedShieldDamageMilli: 0,
      eligibleHpDamageMilli: 10000, appliedHpDamageMilli: 10000,
      deferredHpDamageMilli: 0, overkillHpDamageMilli: 0,
      noExternalAppliedShieldDamageMilli: 0, noExternalAppliedHpDamageMilli: 10000,
      targetShieldBeforeMilli: 0, targetShieldAfterMilli: 0,
      targetHpBeforeMilli: 24000, targetHpAfterMilli: 14000,
      supportSourceTowerRuntimeIds: [], revealSourceTowerRuntimeIds: [],
    },
    {
      kind: "effect", ordinal: 5, action: "apply", sourceTowerRuntimeId: 2,
      sourceRuntimeId: 2, defenseId: "chronos", level: 1, padId: "pad.p02",
      targetRuntimeId: 1, targetOwnerId: "scout", targetRouteId: "route.main",
      effectKind: "status", statusId: "slow", requestedMagnitude: 3200,
      appliedMagnitude: 3200, requestedDurationTimeUnits: 72000,
      appliedDurationTimeUnits: 72000, outcome: "applied",
    },
    {
      kind: "leak", ordinal: 6, enemyRuntimeId: 2, ownerId: "scout",
      lineageId: "lineage.2", routeId: "route.main", hpMilli: 1,
      shieldMilli: 0, integrityDamage: 1,
    },
    {
      kind: "aether-transaction", ordinal: 7, action: "bounty", sourceId: "lineage.1",
      commandSeq: null, towerRuntimeId: null, padId: null, defenseId: null,
      levelBefore: null, levelAfter: null, debitAether: 0, creditAether: 2,
      investedBeforeAether: null, investedAfterAether: null,
      bankBeforeAether: 100, bankAfterAether: 102,
      bountyRemainderBefore: 0, bountyRemainderAfter: 0,
    },
    {
      kind: "effect", ordinal: 8, action: "remove", sourceTowerRuntimeId: null,
      sourceRuntimeId: 2, defenseId: null, level: null, padId: null,
      targetRuntimeId: 1, targetOwnerId: "scout", targetRouteId: "route.main",
      effectKind: "status", statusId: "slow", requestedMagnitude: 3200,
      appliedMagnitude: 0, requestedDurationTimeUnits: 72000,
      appliedDurationTimeUnits: 0, outcome: "removed",
    },
    {
      kind: "effect", ordinal: 9, action: "refresh", sourceTowerRuntimeId: null,
      sourceRuntimeId: 21, defenseId: null, level: null, padId: null,
      targetRuntimeId: 1, targetOwnerId: "scout", targetRouteId: "route.main",
      effectKind: "status", statusId: "resolve", requestedMagnitude: 0,
      appliedMagnitude: 0, requestedDurationTimeUnits: 60000,
      appliedDurationTimeUnits: 60000, outcome: "refreshed",
    },
    {
      kind: "aether-transaction", ordinal: 10, action: "sell", sourceId: "command.sell",
      commandSeq: 1, towerRuntimeId: 1, padId: "pad.p01", defenseId: "sentinel",
      levelBefore: 1, levelAfter: 0, debitAether: 0, creditAether: 35,
      investedBeforeAether: 50, investedAfterAether: 0,
      bankBeforeAether: 100, bankAfterAether: 135,
      bountyRemainderBefore: 0, bountyRemainderAfter: 0,
    },
  ];
}

function telemetryV1(tick, records) {
  return deepFreeze({
    schemaVersion: 1,
    tick: tick,
    records: records === undefined ? [] : records,
  });
}

function artifactPair(overrides) {
  const missions = Object.assign({
    m01: { completedObjectives: 3, finalScore: 111, terminalTick: 3 },
    m04: { completedObjectives: 2, finalScore: 222, terminalTick: 4 },
    m05: { completedObjectives: 1, finalScore: 333, terminalTick: 5 },
  }, overrides && overrides.missions || {});
  const abiHash = "sha256:" + ABI.DESCRIPTOR_SHA256;
  return deepFreeze({
    release: {
      abiHash: abiHash,
      contentVersion: "slice-replay-test-v1",
      eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
      includedIds: { missions: Object.keys(missions).sort() },
      rulesetHash: overrides && overrides.rulesetHash || RULESET_HASH,
      schemaVersion: 3,
    },
    content: {
      abiHash: abiHash,
      contentVersion: "slice-replay-test-v1",
      eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
      missions: missions,
      schemaVersion: 3,
    },
  });
}

function createFakeKernel() {
  const bindings = new WeakMap();
  let stateFactory = null;
  let telemetryFactory = null;
  let tickResultFactory = null;
  const observations = {
    bindingInputs: [],
    headers: [],
    buckets: [],
  };

  function objectiveResults(completed) {
    return Object.freeze(["victory", "integrity", "mastery"].map(function (id, index) {
      return Object.freeze({ complete: index < completed, id: id });
    }));
  }

  function state(missionId, tick, commandCount, mission) {
    const terminal = tick === mission.terminalTick;
    if (stateFactory) {
      return stateFactory(
        missionId,
        tick,
        commandCount,
        terminal,
        mission.completedObjectives,
        mission.finalScore
      );
    }
    return Object.freeze({
      commandCount: commandCount,
      missionId: missionId,
      objectiveResults: objectiveResults(terminal ? mission.completedObjectives : 0),
      outcome: terminal ? "victory" : "active",
      score: terminal ? mission.finalScore + commandCount : 0,
      tick: tick,
    });
  }

  const api = Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    BALANCE_TELEMETRY_SCHEMA_VERSION: 1,
    COMMAND_SCHEMA_VERSION: ABI.DESCRIPTOR.commands.schemaVersion,
    EVENT_SCHEMA_VERSION: ABI.EVENT_SCHEMA_VERSION,
    MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK: 65536,
    MAX_BALANCE_TELEMETRY_TARGET_IDS: 4096,
    MAX_LOADOUT_IDS: 6,
    createRulesetBinding(input) {
      assert.deepEqual(Object.keys(input).sort(), ["content", "release"]);
      assert.equal(Object.isFrozen(input.release), true);
      assert.equal(Object.isFrozen(input.content), true);
      const binding = Object.freeze({});
      bindings.set(binding, { content: input.content, release: input.release });
      observations.bindingInputs.push(input);
      return binding;
    },
    createInitialState(binding, header) {
      const data = bindings.get(binding);
      if (!data) throw new TypeError("Fake Kernel received an unknown binding");
      assert.equal(Object.isFrozen(header), true);
      assert.deepEqual(Object.keys(header), [
        "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
        "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
        "accessGrantIds", "tutorialUpgradeGateMode",
      ]);
      const mission = data.content.missions[header.missionId];
      if (!mission) throw new RangeError("Fake Kernel mission is unavailable");
      observations.headers.push(header);
      return state(header.missionId, 0, 0, mission);
    },
    advanceTick(binding, priorState, commandBucket) {
      const data = bindings.get(binding);
      if (!data) throw new TypeError("Fake Kernel received an unknown binding");
      assert.equal(Object.isFrozen(priorState), true);
      assert.equal(Object.isFrozen(commandBucket), true);
      commandBucket.forEach(function (command) { assert.equal(command.tick, priorState.tick); });
      observations.buckets.push(commandBucket);
      const mission = data.content.missions[priorState.missionId];
      const next = state(
        priorState.missionId,
        priorState.tick + 1,
        priorState.commandCount + commandBucket.length,
        mission
      );
      const events = Object.freeze([]);
      const telemetry = telemetryFactory
        ? telemetryFactory(priorState.tick, priorState, next, commandBucket)
        : Object.freeze({
            schemaVersion: 1,
            tick: priorState.tick,
            records: Object.freeze([]),
          });
      if (tickResultFactory) {
        return tickResultFactory({
          events: events,
          inputTick: priorState.tick,
          state: next,
          telemetry: telemetry,
        });
      }
      return Object.freeze({ events: events, state: next, telemetry: telemetry });
    },
  });
  return {
    api: api,
    observations: observations,
    setStateFactory(factory) { stateFactory = factory; },
    setTelemetryFactory(factory) { telemetryFactory = factory; },
    setTickResultFactory(factory) { tickResultFactory = factory; },
  };
}

function loadCommonJs(fakeKernel) {
  const runnerModule = { exports: {} };
  const loadRunner = vm.runInThisContext(
    "(function (module, require) {\n" + RUNNER_SOURCE + "\n})",
    { filename: "replay-runner.js" }
  );
  loadRunner(runnerModule, function (request) {
      if (request === "./abi.js") return ABI;
      if (request === "./commands.js") return Commands;
      if (request === "./kernel.js") return fakeKernel;
      throw new Error("Unexpected replay-runner require: " + request);
  });
  const Runner = runnerModule.exports;

  const replayModule = { exports: {} };
  const loadReplay = vm.runInThisContext(
    "(function (module, require) {\n" + REPLAY_SOURCE + "\n})",
    { filename: "replay.js" }
  );
  loadReplay(replayModule, function (request) {
      if (request === "./abi.js") return ABI;
      if (request === "./commands.js") return Commands;
      if (request === "./replay-runner.js") return Runner;
      throw new Error("Unexpected replay require: " + request);
  });
  return { Replay: replayModule.exports, Runner: Runner };
}

function loadClassic(fakeKernel) {
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(fs.readFileSync(path.join(SIM_ROOT, "abi.js"), "utf8"), context, { filename: "abi.js" });
  vm.runInContext(fs.readFileSync(path.join(SIM_ROOT, "commands.js"), "utf8"), context, { filename: "commands.js" });
  fakeKernel.setStateFactory(vm.runInContext([
    "(function (missionId, tick, commandCount, terminal, completedObjectives, finalScore) {",
    "  const results = ['victory', 'integrity', 'mastery'].map(function (id, index) {",
    "    return Object.freeze({ complete: terminal && index < completedObjectives, id: id });",
    "  });",
    "  return Object.freeze({",
    "    commandCount: commandCount,",
    "    missionId: missionId,",
    "    objectiveResults: Object.freeze(results),",
    "    outcome: terminal ? 'victory' : 'active',",
    "    score: terminal ? finalScore + commandCount : 0,",
    "    tick: tick,",
    "  });",
    "})",
  ].join("\n"), context));
  fakeKernel.setTelemetryFactory(vm.runInContext([
    "(function (tick) {",
    "  return Object.freeze({",
    "    schemaVersion: 1,",
    "    tick: tick,",
    "    records: Object.freeze([]),",
    "  });",
    "})",
  ].join("\n"), context));
  context.Game.AegisKernel = fakeKernel.api;
  vm.runInContext(RUNNER_SOURCE, context, { filename: "replay-runner.js" });
  vm.runInContext(REPLAY_SOURCE, context, { filename: "replay.js" });
  return context;
}

test("bound replay simulator executes m01/m04/m05 fixtures for exactly their completed ticks", () => {
  ["m01", "m04", "m05"].forEach(function (missionId) {
    const fake = createFakeKernel();
    const loaded = loadCommonJs(fake.api);
    const pair = artifactPair();
    const simulator = loaded.Replay.createBoundSimulator(pair);
    assert.equal(Object.isFrozen(loaded.Runner), true);
    assert.equal(Object.isFrozen(loaded.Runner.EXECUTION_LIMITS), true);
    assert.equal(Object.isFrozen(simulator), true);
    assert.equal(typeof simulator.simulateReplay, "function");

    const envelope = fixture(missionId);
    const before = clone(envelope);
    const result = simulator.simulateReplay(envelope);
    assert.deepEqual(envelope, before);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.finalState), true);
    assert.equal(result.finalState.tick, envelope.finalClaim.durationTicks);
    assert.equal(result.finalState.outcome, envelope.finalClaim.outcome);
    assert.equal(result.finalState.score, envelope.finalClaim.score);
    assert.equal(result.verifiedCheckpointCount, envelope.checkpoints.length);
    assert.equal(fake.observations.bindingInputs.length, 1);
    assert.equal(fake.observations.headers.length, 1);
    assert.equal(fake.observations.headers[0].loadoutSlotCap, envelope.loadoutSlotCap);
    assert.equal(fake.observations.buckets.length, envelope.finalClaim.durationTicks);
    assert.deepEqual(fake.observations.buckets.map(function (bucket) {
      return bucket.map(function (command) { return command.type; });
    }), [["startWave"]].concat(new Array(envelope.finalClaim.durationTicks - 1).fill([])));
  });
});

test("Replay DEFAULT_LIMITS derives every normalized execution ceiling from ReplayRunner", () => {
  const fake = createFakeKernel();
  const loaded = loadCommonJs(fake.api);
  const limits = loaded.Runner.EXECUTION_LIMITS;
  assert.equal(limits.maxLoadoutIds, fake.api.MAX_LOADOUT_IDS);
  [
    "maxAccessGrantIds", "maxCampaignModifierIds", "maxCheckpoints", "maxCommandsPerTick",
    "maxDurationTicks", "maxLoadoutIds", "maxStringLength", "maxTotalCommands",
  ].forEach(function (key) {
    assert.equal(loaded.Replay.DEFAULT_LIMITS[key], limits[key], key);
  });
  assert.equal(loaded.Replay.DEFAULT_LIMITS.maxTick, limits.maxDurationTicks - 1);
});

test("binding is explicit, immutable, and rejects unsupported rulesets, missions, and slot caps", () => {
  const fake = createFakeKernel();
  const Replay = loadCommonJs(fake.api).Replay;
  const pair = artifactPair();
  assert.throws(
    () => Replay.createBoundSimulator({ release: clone(pair.release), content: pair.content }),
    /deeply frozen/i
  );
  assert.throws(
    () => Replay.createBoundSimulator({ release: pair.release, content: pair.content, profile: {} }),
    /exactly/i
  );
  const accessorInput = { release: pair.release };
  Object.defineProperty(accessorInput, "content", {
    enumerable: true,
    get() { throw new Error("binding getter must not run"); },
  });
  assert.throws(
    () => Replay.createBoundSimulator(accessorInput),
    /enumerable data properties/i
  );
  const mismatchedAbi = clone(pair);
  mismatchedAbi.content.abiHash = "sha256:" + "0".repeat(64);
  assert.throws(
    () => Replay.createBoundSimulator(deepFreeze(mismatchedAbi)),
    /ABI hashes do not match/i
  );
  const wrongEventSchema = clone(pair);
  wrongEventSchema.release.eventSchemaVersion += 1;
  wrongEventSchema.content.eventSchemaVersion += 1;
  assert.throws(
    () => Replay.createBoundSimulator(deepFreeze(wrongEventSchema)),
    /event schema version is unsupported/i
  );
  const simulator = Replay.createBoundSimulator(pair);
  const wrongRuleset = fixture("m01");
  wrongRuleset.rulesetHash = "sha256:" + "d".repeat(64);
  assert.throws(() => simulator.simulateReplay(wrongRuleset), /unsupported.*bound simulator/i);
  const wrongMission = fixture("m01");
  wrongMission.missionId = "m02";
  assert.throws(() => simulator.simulateReplay(wrongMission), /not included/i);
  const wrongCap = fixture("m01");
  wrongCap.loadoutSlotCap = 2;
  assert.throws(() => simulator.simulateReplay(wrongCap), /loadout IDs exceed.*slot cap/i);
});

test("every diagnostic boundary and every final claim field is verified", () => {
  const fake = createFakeKernel();
  const simulator = loadCommonJs(fake.api).Replay.createBoundSimulator(artifactPair());
  [0, 1, 2].forEach(function (checkpointIndex) {
    const bad = fixture("m01");
    bad.checkpoints[checkpointIndex].diagnosticHash = "fnv1a32:00000000";
    assert.throws(() => simulator.simulateReplay(bad), /checkpoint mismatch.*tick/i);
  });
  const mutations = [
    ["outcome", "defeat", /outcome claim/i],
    ["score", 113, /score claim/i],
    ["laurels", 2, /Laurel claim/i],
    ["finalStateHash", "0".repeat(64), /SHA-256 claim/i],
  ];
  mutations.forEach(function (record) {
    const bad = fixture("m01");
    bad.finalClaim[record[0]] = record[1];
    assert.throws(() => simulator.simulateReplay(bad), record[2]);
  });
});

test("terminal timing rejects both early and late outcomes without executing an extra tick", () => {
  const earlyFake = createFakeKernel();
  const earlyReplay = loadCommonJs(earlyFake.api).Replay;
  const earlyPair = artifactPair({ missions: { m01: { completedObjectives: 3, finalScore: 111, terminalTick: 2 } } });
  assert.throws(
    () => earlyReplay.createBoundSimulator(earlyPair).simulateReplay(fixture("m01")),
    /terminal state before.*final boundary/i
  );
  assert.equal(earlyFake.observations.buckets.length, 2);

  const lateFake = createFakeKernel();
  const lateReplay = loadCommonJs(lateFake.api).Replay;
  const latePair = artifactPair({ missions: { m01: { completedObjectives: 3, finalScore: 111, terminalTick: 4 } } });
  assert.throws(
    () => lateReplay.createBoundSimulator(latePair).simulateReplay(fixture("m01")),
    /did not reach a terminal state/i
  );
  assert.equal(lateFake.observations.buckets.length, 3);
});

test("ReplayRunner validates the Kernel seam before accepting any replay data", () => {
  const missing = Object.freeze({ ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256 });
  assert.throws(() => loadCommonJs(missing), /Kernel API is missing/i);
  const fake = createFakeKernel();
  const mismatch = Object.freeze(Object.assign({}, fake.api, { ABI_DESCRIPTOR_SHA256: "0".repeat(64) }));
  assert.throws(() => loadCommonJs(mismatch), /ABI descriptor identity/i);
  const eventMismatch = Object.freeze(Object.assign({}, fake.api, {
    EVENT_SCHEMA_VERSION: ABI.EVENT_SCHEMA_VERSION + 1,
  }));
  assert.throws(() => loadCommonJs(eventMismatch), /event schema identity/i);
  const commandMismatch = Object.freeze(Object.assign({}, fake.api, {
    COMMAND_SCHEMA_VERSION: Commands.COMMAND_SCHEMA_VERSION + 1,
  }));
  assert.throws(() => loadCommonJs(commandMismatch), /command schema identity/i);

  [
    ["BALANCE_TELEMETRY_SCHEMA_VERSION", 2, /telemetry schema identity/i],
    ["MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK", 65535, /telemetry record limit/i],
    ["MAX_BALANCE_TELEMETRY_TARGET_IDS", 4095, /telemetry target limit/i],
    ["MAX_LOADOUT_IDS", 0, /loadout limit identity/i],
  ].forEach(function (entry) {
    const wrong = Object.freeze(Object.assign({}, fake.api, { [entry[0]]: entry[1] }));
    assert.throws(() => loadCommonJs(wrong), entry[2]);
  });
});

test("ReplayRunner accepts every closed balance telemetry v1 record shape", () => {
  const fake = createFakeKernel();
  fake.setTelemetryFactory(function (tick) {
    return telemetryV1(tick, tick === 0 ? telemetryRecordsV1() : []);
  });
  const result = loadCommonJs(fake.api).Replay
    .createBoundSimulator(artifactPair())
    .simulateReplay(fixture("m01"));
  assert.equal(result.finalState.tick, 3);
  assert.equal(result.verifiedCheckpointCount, 3);
});

test("ReplayRunner accepts partial-tick Hoplite clamps with the allocated stun provenance", () => {
  const movement = telemetryRecordsV1()[3];
  movement.ordinal = 0;
  movement.effectiveSpeedBp = 0;
  movement.scaledReductionBp = 10000;
  movement.sourceEffectRuntimeIds = [31];
  movement.sourceRuntimeIds = [21];
  movement.sourceTowerRuntimeIds = [11];
  const fake = createFakeKernel();
  fake.setTelemetryFactory(function (tick) {
    return telemetryV1(tick, tick === 0 ? [movement] : []);
  });
  const result = loadCommonJs(fake.api).Replay
    .createBoundSimulator(artifactPair())
    .simulateReplay(fixture("m01"));
  assert.equal(result.finalState.outcome, "victory");
});

test("Kernel tick results require exactly events, state, and telemetry", () => {
  [
    [function (parts) {
      return Object.freeze({ events: parts.events, state: parts.state });
    }, /must contain exactly/i],
    [function (parts) {
      return Object.freeze({
        events: parts.events,
        state: parts.state,
        telemetry: parts.telemetry,
        diagnostics: Object.freeze([]),
      });
    }, /must contain exactly/i],
  ].forEach(function (entry) {
    const fake = createFakeKernel();
    fake.setTickResultFactory(entry[0]);
    const simulator = loadCommonJs(fake.api).Replay.createBoundSimulator(artifactPair());
    assert.throws(() => simulator.simulateReplay(fixture("m01")), entry[1]);
  });
});

test("ReplayRunner fails closed on malformed, mutable, or noncanonical telemetry", () => {
  function rejects(factory, pattern) {
    const fake = createFakeKernel();
    fake.setTelemetryFactory(function (tick) {
      return tick === 0 ? factory(tick) : telemetryV1(tick);
    });
    const simulator = loadCommonJs(fake.api).Replay.createBoundSimulator(artifactPair());
    assert.throws(() => simulator.simulateReplay(fixture("m01")), pattern);
  }

  rejects(function (tick) {
    return deepFreeze({ schemaVersion: 1, tick: tick, records: [], extra: 0 });
  }, /must contain exactly/i);
  rejects(function (tick) {
    return deepFreeze({ schemaVersion: 1, tick: tick });
  }, /must contain exactly/i);
  rejects(function (tick) {
    const value = clone(telemetryV1(tick, [telemetryRecordsV1()[0]]));
    value.records[0].extra = 0;
    return deepFreeze(value);
  }, /must contain exactly/i);
  rejects(function (tick) {
    const value = clone(telemetryV1(tick, [telemetryRecordsV1()[0]]));
    delete value.records[0].ownerId;
    return deepFreeze(value);
  }, /must contain exactly/i);
  rejects(function (tick) {
    return { schemaVersion: 1, tick: tick, records: [] };
  }, /must be a frozen object/i);
  rejects(function (tick) {
    return Object.freeze({ schemaVersion: 1, tick: tick, records: [] });
  }, /records must be frozen/i);
  rejects(function (tick) {
    return Object.freeze({
      schemaVersion: 1,
      tick: tick,
      records: Object.freeze([telemetryRecordsV1()[0]]),
    });
  }, /record 0 must be a frozen object/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[4];
    const shared = Object.freeze([]);
    record.ordinal = 0;
    record.supportSourceTowerRuntimeIds = shared;
    record.revealSourceTowerRuntimeIds = shared;
    return telemetryV1(tick, [record]);
  }, /cycle or shared reference/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[0];
    record.ordinal = 0;
    record.maximumHpMilli = Number.MAX_SAFE_INTEGER + 1;
    return telemetryV1(tick, [record]);
  }, /safe integer/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[0];
    record.ordinal = 0;
    record.initialShieldMilli = -0;
    return telemetryV1(tick, [record]);
  }, /canonical positive zero/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[0];
    record.ordinal = 0;
    record.ownerId = null;
    return telemetryV1(tick, [record]);
  }, /must be a string/i);
});

test("ReplayRunner rejects bad telemetry identity, order, enums, arrays, and bounds", () => {
  function rejects(factory, pattern) {
    const fake = createFakeKernel();
    fake.setTelemetryFactory(function (tick) {
      return tick === 0 ? factory(tick) : telemetryV1(tick);
    });
    const simulator = loadCommonJs(fake.api).Replay.createBoundSimulator(artifactPair());
    assert.throws(() => simulator.simulateReplay(fixture("m01")), pattern);
  }

  rejects((tick) => deepFreeze({ schemaVersion: 2, tick: tick, records: [] }),
    /schema version is unsupported/i);
  rejects((tick) => telemetryV1(tick + 1), /input boundary tick/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[0];
    record.ordinal = 1;
    return telemetryV1(tick, [record]);
  }, /ordinal must be contiguous/i);
  rejects((tick) => telemetryV1(tick, [{ kind: "mystery", ordinal: 0 }]), /unknown kind/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[0];
    record.ordinal = 0;
    record.entityKind = "summon";
    return telemetryV1(tick, [record]);
  }, /closed balance telemetry/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[1];
    record.ordinal = 0;
    record.action = "refund";
    return telemetryV1(tick, [record]);
  }, /closed balance telemetry/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[1];
    record.ordinal = 0;
    record.commandSeq = null;
    return telemetryV1(tick, [record]);
  }, /commandSeq nullability/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[2];
    record.ordinal = 0;
    record.sourceTowerRuntimeId = null;
    return telemetryV1(tick, [record]);
  }, /must be a safe integer/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[2];
    record.ordinal = 0;
    record.outcome = "no-target";
    return telemetryV1(tick, [record]);
  }, /select targets only when accepted/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[2];
    record.ordinal = 0;
    record.eligibleTargetRuntimeIds = [2, 1];
    record.selectedTargetRuntimeIds = [];
    return telemetryV1(tick, [record]);
  }, /ascending unique runtime IDs/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[5];
    record.ordinal = 0;
    record.sourceTowerRuntimeId = null;
    record.defenseId = null;
    record.level = null;
    record.padId = null;
    return telemetryV1(tick, [record]);
  }, /require complete tower provenance/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[2];
    record.ordinal = 0;
    record.eligibleTargetRuntimeIds = Array.from({ length: 4097 }, (_, index) => index);
    record.selectedTargetRuntimeIds = [];
    return telemetryV1(tick, [record]);
  }, /execution limit/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[3];
    record.ordinal = 0;
    record.scaledReductionBp = 100;
    record.sourceEffectRuntimeIds = [1];
    record.sourceRuntimeIds = [];
    record.sourceTowerRuntimeIds = [];
    return telemetryV1(tick, [record]);
  }, /must be parallel/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[3];
    record.ordinal = 0;
    record.effectiveSpeedBp = 10000;
    record.scaledReductionBp = 0;
    record.sourceEffectRuntimeIds = [];
    record.sourceRuntimeIds = [];
    record.sourceTowerRuntimeIds = [3];
    return telemetryV1(tick, [record]);
  }, /no-control movement must have empty source arrays/i);
  rejects(function (tick) {
    const record = telemetryRecordsV1()[4];
    record.ordinal = 0;
    record.targetHpAfterMilli = 15000;
    return telemetryV1(tick, [record]);
  }, /HP damage must equal/i);
  rejects(function (tick) {
    return Object.freeze({
      schemaVersion: 1,
      tick: tick,
      records: Object.freeze(new Array(65537).fill(null)),
    });
  }, /records.*execution limit/i);
});

test("ReplayRunner rejects semantically impossible telemetry field combinations", () => {
  function rejectsRecord(recordIndex, mutate, pattern) {
    const fake = createFakeKernel();
    fake.setTelemetryFactory(function (tick) {
      if (tick !== 0) return telemetryV1(tick);
      const record = telemetryRecordsV1()[recordIndex];
      record.ordinal = 0;
      mutate(record);
      return telemetryV1(tick, [record]);
    });
    const simulator = loadCommonJs(fake.api).Replay.createBoundSimulator(artifactPair());
    assert.throws(() => simulator.simulateReplay(fixture("m01")), pattern);
  }

  rejectsRecord(5, (record) => { record.outcome = "removed"; }, /action\/outcome pair/i);
  rejectsRecord(8, (record) => { record.appliedMagnitude = 1; }, /apply zero magnitude and duration/i);

  rejectsRecord(2, (record) => {
    record.outcome = "no-target";
    record.selectedTargetRuntimeIds = [];
  }, /ready empty tower attack or scan/i);
  rejectsRecord(2, (record) => {
    record.outcome = "rejected";
    record.selectedTargetRuntimeIds = [];
  }, /rejected activation must be.*guard contact/i);
  rejectsRecord(2, (record) => {
    record.eligibleTargetRuntimeIds = [];
    record.selectedTargetRuntimeIds = [];
  }, /accepted combat activation must select/i);
  rejectsRecord(2, (record) => { record.selectedTargetRuntimeIds = [3]; },
    /selected targets must be eligible/i);

  rejectsRecord(3, (record) => { record.nextRouteDistance = 101; },
    /route-distance delta must equal actual advance/i);
  rejectsRecord(3, (record) => {
    record.sourceEffectRuntimeIds = [];
    record.sourceRuntimeIds = [];
    record.sourceTowerRuntimeIds = [];
  }, /controlled movement must identify its winning source/i);

  rejectsRecord(1, (record) => { record.sourceId = "build"; }, /sourceId does not match/i);
  rejectsRecord(1, (record) => { record.levelAfter = 2; }, /build must create a level-one tower/i);
  rejectsRecord(1, (record) => {
    record.action = "upgrade";
    record.sourceId = "command.upgrade";
  }, /upgrade must begin from an owned tower level/i);
  rejectsRecord(1, (record) => {
    record.debitAether = 0;
    record.bankAfterAether = record.bankBeforeAether;
  }, /purchase actions must be positive debits/i);
  rejectsRecord(7, (record) => {
    record.action = "wave-clear-grant";
    record.sourceId = "m01.w01";
    record.debitAether = 1;
    record.bankAfterAether = 101;
  }, /internal credits cannot debit/i);
  rejectsRecord(7, (record) => {
    record.action = "wave-clear-grant";
    record.sourceId = "m01.w01";
    record.bountyRemainderAfter = 1;
  }, /only bounty may change/i);
  rejectsRecord(10, (record) => {
    record.creditAether = 34;
    record.bankAfterAether = 134;
  }, /seventy-percent refund/i);

  rejectsRecord(4, (record) => { record.eligibleHpDamageMilli = 9999; },
    /eligible HP damage must partition/i);
  rejectsRecord(4, (record) => { record.noExternalAppliedHpDamageMilli = 10001; },
    /no-external damage cannot exceed/i);
  rejectsRecord(4, (record) => { record.noExternalAppliedHpDamageMilli = 9999; },
    /without support sources must equal/i);
  rejectsRecord(4, (record) => {
    record.eligibleHpDamageMilli = 12000;
    record.deferredHpDamageMilli = 1000;
    record.overkillHpDamageMilli = 1000;
  }, /threshold-deferred and terminal-overkill.*exclusive/i);
  rejectsRecord(4, (record) => {
    record.eligibleHpDamageMilli = 11000;
    record.overkillHpDamageMilli = 1000;
  }, /terminal overkill requires a zero-HP target/i);
});

test("valid telemetry changes never affect checkpoints, final hashes, or replay claims", () => {
  const emptyFake = createFakeKernel();
  const factFake = createFakeKernel();
  factFake.setTelemetryFactory(function (tick) {
    const records = tick === 0 ? telemetryRecordsV1() : [];
    if (records.length) records[0].maximumHpMilli = 77777;
    return telemetryV1(tick, records);
  });
  const pair = artifactPair();
  const envelope = fixture("m01");
  const emptyResult = loadCommonJs(emptyFake.api).Replay
    .createBoundSimulator(pair).simulateReplay(envelope);
  const factResult = loadCommonJs(factFake.api).Replay
    .createBoundSimulator(pair).simulateReplay(envelope);
  assert.deepEqual(clone(factResult), clone(emptyResult));
  assert.equal(factResult.verifiedCheckpointCount, envelope.checkpoints.length);
  assert.equal(factResult.finalState.score, envelope.finalClaim.score);
  assert.equal(ABI.sha256Hex(ABI.canonicalBytes(factResult.finalState)),
    envelope.finalClaim.finalStateHash);
  assert.equal(Object.prototype.hasOwnProperty.call(factResult, "telemetry"), false);
});

test("ReplayRunner independently bounds hostile normalizer output before Kernel execution", () => {
  const fake = createFakeKernel();
  const loaded = loadCommonJs(fake.api);
  const pair = artifactPair();
  const limits = loaded.Runner.EXECUTION_LIMITS;
  const simulator = loaded.Runner.createBoundSimulator({
    content: pair.content,
    normalizeReplayEnvelope(value) { return value; },
    release: pair.release,
  });

  function reject(source, pattern) {
    assert.throws(() => simulator.simulateReplay(deepFreeze(source)), pattern);
  }

  const longDuration = fixture("m01");
  longDuration.finalClaim.durationTicks = limits.maxDurationTicks + 1;
  longDuration.checkpoints = [];
  reject(longDuration, /final duration.*execution limit/i);

  const tooManyInputs = fixture("m01");
  tooManyInputs.inputs = Array.from({ length: limits.maxTotalCommands + 1 }, function (_, index) {
    return { tick: 0, seq: index, type: "startWave" };
  });
  tooManyInputs.checkpoints = [];
  reject(tooManyInputs, /inputs.*execution limit/i);

  const crowdedTick = fixture("m01");
  crowdedTick.inputs = Array.from({ length: limits.maxCommandsPerTick + 1 }, function (_, index) {
    return { tick: 0, seq: index, type: "startWave" };
  });
  crowdedTick.checkpoints = [];
  reject(crowdedTick, /commands per tick limit/i);

  const tooManyCheckpoints = fixture("m01");
  tooManyCheckpoints.finalClaim.durationTicks = limits.maxCheckpoints;
  tooManyCheckpoints.checkpoints = Array.from({ length: limits.maxCheckpoints + 1 }, function (_, tick) {
    return { tick: tick, diagnosticHash: "fnv1a32:1234abcd" };
  });
  reject(tooManyCheckpoints, /checkpoints.*execution limit/i);

  [
    ["loadoutIds", limits.maxLoadoutIds, "tower", /loadout IDs.*execution limit/i],
    ["campaignModifierIds", limits.maxCampaignModifierIds, "modifier", /modifier IDs.*execution limit/i],
    ["accessGrantIds", limits.maxAccessGrantIds, "grant", /access grant IDs.*execution limit/i],
  ].forEach(function (record) {
    const bad = fixture("m01");
    bad[record[0]] = Array.from({ length: record[1] + 1 }, function (_, index) {
      return record[2] + String(index).padStart(4, "0");
    });
    reject(bad, record[3]);
  });

  const negativeTick = fixture("m01");
  negativeTick.inputs = [{ tick: -1, seq: 0, type: "startWave" }];
  negativeTick.checkpoints = [];
  reject(negativeTick, /command tick must be nonnegative/i);

  const skippedSequence = fixture("m01");
  skippedSequence.inputs = [{ tick: 0, seq: 1, type: "startWave" }];
  skippedSequence.checkpoints = [];
  reject(skippedSequence, /first command sequence.*zero/i);

  const inputAtFinalBoundary = fixture("m01");
  inputAtFinalBoundary.inputs = [{ tick: 3, seq: 0, type: "startWave" }];
  inputAtFinalBoundary.checkpoints = [];
  reject(inputAtFinalBoundary, /input tick.*before the final boundary/i);

  const checkpointPastFinalBoundary = fixture("m01");
  checkpointPastFinalBoundary.checkpoints = [
    { tick: 4, diagnosticHash: "fnv1a32:1234abcd" },
  ];
  reject(checkpointPastFinalBoundary, /checkpoint tick.*execution limit/i);

  assert.equal(fake.observations.headers.length, 0);
  assert.equal(fake.observations.buckets.length, 0);
});

test("CommonJS and classic scripts expose frozen replay execution parity without platform APIs", () => {
  const commonFake = createFakeKernel();
  const common = loadCommonJs(commonFake.api);
  const classicFake = createFakeKernel();
  const context = loadClassic(classicFake);
  const pair = artifactPair();
  const envelope = fixture("m04");
  const expected = common.Replay.createBoundSimulator(pair).simulateReplay(envelope);
  context.pairJson = JSON.stringify(pair);
  context.envelopeJson = JSON.stringify(envelope);
  vm.runInContext([
    "function replayTestFreeze(value) {",
    "  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;",
    "  Object.keys(value).forEach(function (key) { replayTestFreeze(value[key]); });",
    "  return Object.freeze(value);",
    "}",
    "pair = replayTestFreeze(JSON.parse(pairJson));",
    "envelope = JSON.parse(envelopeJson);",
  ].join("\n"), context);
  const actualJson = vm.runInContext(
    "JSON.stringify(Game.AegisReplay.createBoundSimulator(pair).simulateReplay(envelope))",
    context
  );
  assert.deepEqual(JSON.parse(actualJson), clone(expected));
  assert.equal(Object.isFrozen(context.Game.AegisReplayRunner), true);
  assert.equal(Object.isFrozen(context.Game.AegisReplay), true);
  assert.equal(context.require, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.localStorage, undefined);
  assert.equal(context.document, undefined);
});
