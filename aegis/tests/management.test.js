"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const MANAGEMENT_PATH = path.join(__dirname, "..", "js", "sim", "management.js");
const Management = require(MANAGEMENT_PATH);

function config(overrides) {
  return Object.assign({
    missionId: "m01",
    resolvedStartAether: 150,
    tutorialUpgradeGateMode: "m01-wave1",
    padIds: ["p01", "p02", "p03"],
    waveStartGrants: [0, 5, 0, 0, 0, 60],
    defenses: [
      {
        id: "sentinel",
        costsAether: [60, 55, 95],
        defaultTargetPolicy: "FRONT",
        allowedTargetPolicies: ["FRONT", "STRONG", "FAST"],
      },
      {
        id: "siege",
        costsAether: [90, 85, 140],
        defaultTargetPolicy: "FRONT",
        allowedTargetPolicies: ["FRONT", "STRONG"],
      },
      {
        id: "oracle",
        costsAether: [70, 70, 110],
        defaultTargetPolicy: null,
        allowedTargetPolicies: [],
      },
    ],
  }, overrides);
}

function command(type, overrides) {
  const base = { tick: 0, seq: 0, type: type };
  if (type === "build") Object.assign(base, { padId: "p01", defenseId: "sentinel" });
  if (type === "upgrade" || type === "sell") Object.assign(base, { towerId: 1 });
  if (type === "setTargetPolicy") Object.assign(base, { towerId: 1, policy: "STRONG" });
  return Object.assign(base, overrides);
}

function mutableClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertDeepFrozen(value, seen) {
  if (!value || typeof value !== "object") return;
  seen = seen || new Set();
  if (seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Object.keys(value)) assertDeepFrozen(value[key], seen);
}

function apply(state, cfg, value) {
  const bucket = Management.applyCommandBucket(state, cfg, value.tick, [value]);
  return { state: bucket.state, event: bucket.events[0] };
}

test("config normalization is strict, canonical, caller-safe, and content-driven", () => {
  const caller = config();
  const before = mutableClone(caller);
  const normalized = Management.normalizeManagementConfig(caller);
  assert.deepEqual(caller, before);
  assert.notEqual(normalized, caller);
  assertDeepFrozen(normalized);
  assert.doesNotThrow(() => ABI.canonicalEncode(normalized));
  assert.equal(normalized.waveStartGrants[5], 60);
  assert.deepEqual(normalized.defenses[0].costsAether, [60, 55, 95]);

  caller.padIds[0] = "changed";
  caller.waveStartGrants[5] = 999;
  caller.defenses[0].costsAether[0] = 1;
  assert.equal(normalized.padIds[0], "p01");
  assert.equal(normalized.waveStartGrants[5], 60);
  assert.equal(normalized.defenses[0].costsAether[0], 60);

  assert.throws(() => Management.normalizeManagementConfig(
    Object.assign(config(), { extra: true })
  ), /exactly/i);
  assert.throws(() => Management.normalizeManagementConfig(
    config({ missionId: "m02", tutorialUpgradeGateMode: "m01-wave1" })
  ), /only for Mission 1/i);
  assert.throws(() => Management.normalizeManagementConfig(
    config({ padIds: ["p01", "p01"] })
  ), /duplicate pad/i);
  assert.throws(() => Management.normalizeManagementConfig(
    config({ waveStartGrants: [] })
  ), /at least one/i);
  assert.throws(() => Management.normalizeManagementConfig(
    config({ defenses: [Object.assign({}, config().defenses[0], { costsAether: [60, 55] })] })
  ), /exactly three/i);
  assert.throws(() => Management.normalizeManagementConfig(config({
    defenses: [{
      id: "support", costsAether: [1, 1, 1], defaultTargetPolicy: "FRONT",
      allowedTargetPolicies: [],
    }],
  })), /null default/i);
  assert.throws(() => Management.normalizeManagementConfig(config({
    defenses: [{
      id: "sentinel", costsAether: [60, 55, 95], defaultTargetPolicy: "FAST",
      allowedTargetPolicies: ["FRONT"],
    }],
  })), /default target policy/i);
  assert.throws(() => Management.normalizeManagementConfig(config({
    defenses: [{
      id: "sentinel", costsAether: [60, 55, 95], defaultTargetPolicy: "FRONT",
      allowedTargetPolicies: ["FAST", "FRONT"],
    }],
  })), /canonical policy order/i);
});

test("initial management state is a frozen canonical replay state with resolved economy and IDs", () => {
  const state = Management.createManagementState(config());
  assert.deepEqual(state, {
    schemaVersion: 1,
    missionId: "m01",
    aether: 150,
    bountyRemainder: 0,
    phase: "planning",
    activeWave: 0,
    clearedWaves: 0,
    tutorialUpgradeGateMode: "m01-wave1",
    tutorialUpgradeGateOpen: false,
    towers: [],
    runtimeIds: {
      nextByDomain: { tower: 1, enemy: 1, summon: 1, projectile: 1, effect: 1 },
    },
  });
  assert.equal(Management.MANAGEMENT_SCHEMA_VERSION, 1);
  assert.equal(Management.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assertDeepFrozen(state);
  assert.doesNotThrow(() => ABI.canonicalEncode(state));

  const immediate = Management.createManagementState(config({ tutorialUpgradeGateMode: "none" }));
  assert.equal(immediate.tutorialUpgradeGateOpen, true);
});

test("build legality preserves direct pad identity and denied creation never consumes a tower ID", () => {
  const cfg = config();
  let state = Management.createManagementState(cfg);
  const initialCanonical = ABI.canonicalEncode(state);

  const unknownPad = apply(state, cfg, command("build", { padId: "p99" }));
  assert.deepEqual(unknownPad.event, {
    type: "denied", tick: 0, seq: 0, commandType: "build", reason: "unknown-pad",
  });
  assert.equal(ABI.canonicalEncode(unknownPad.state), initialCanonical);
  assert.equal(unknownPad.state.runtimeIds.nextByDomain.tower, 1);

  const unknownDefense = apply(state, cfg, command("build", { defenseId: "apollo" }));
  assert.equal(unknownDefense.event.reason, "defense-not-equipped");
  assert.equal(unknownDefense.state.runtimeIds.nextByDomain.tower, 1);

  let result = apply(state, cfg, command("build"));
  state = result.state;
  assert.deepEqual(state.towers[0], {
    id: 1, padId: "p01", defenseId: "sentinel", level: 1,
    investedAether: 60, targetPolicy: "FRONT",
  });
  assert.equal(state.aether, 90);
  assert.equal(state.runtimeIds.nextByDomain.tower, 2);
  assert.deepEqual(result.event, {
    type: "build", tick: 0, seq: 0, towerId: 1, padId: "p01",
    defenseId: "sentinel", level: 1, costAether: 60, investedAether: 60, aetherAfter: 90,
  });

  const occupied = apply(state, cfg, command("build", { padId: "p01", defenseId: "siege" }));
  assert.equal(occupied.event.reason, "pad-occupied");
  assert.equal(occupied.state.runtimeIds.nextByDomain.tower, 2);

  result = apply(state, cfg, command("build", { padId: "p02", defenseId: "siege" }));
  state = result.state;
  assert.equal(state.towers[1].id, 2);
  assert.equal(state.towers[1].padId, "p02");
  assert.equal(state.aether, 0);

  const unaffordable = apply(state, cfg, command("build", { padId: "p03" }));
  assert.equal(unaffordable.event.reason, "insufficient-aether");
  assert.equal(unaffordable.state.runtimeIds.nextByDomain.tower, 3);

  result = apply(state, cfg, command("sell", { towerId: 1 }));
  state = result.state;
  assert.equal(state.aether, 42);
  assert.deepEqual(state.towers.map((tower) => tower.id), [2]);
  assert.equal(state.runtimeIds.nextByDomain.tower, 3);

  const stillUnaffordable = apply(state, cfg, command("build", { padId: "p03" }));
  assert.equal(stillUnaffordable.event.reason, "insufficient-aether");
  assert.equal(stillUnaffordable.state.runtimeIds.nextByDomain.tower, 3);
});

test("build then sell then build allocates tower IDs 1 then 2 without reuse", () => {
  const cfg = config({ tutorialUpgradeGateMode: "none" });
  let state = Management.createManagementState(cfg);
  let result = apply(state, cfg, command("build", { padId: "p01" }));
  assert.equal(result.event.towerId, 1);
  state = result.state;
  result = apply(state, cfg, command("sell", { towerId: 1 }));
  assert.equal(result.event.refundAether, 42);
  assert.equal(result.state.runtimeIds.nextByDomain.tower, 2);
  state = result.state;
  result = apply(state, cfg, command("build", { padId: "p02" }));
  assert.equal(result.event.towerId, 2);
  assert.deepEqual(result.state.towers.map((tower) => tower.id), [2]);
  assert.equal(result.state.runtimeIds.nextByDomain.tower, 3);
});

test("skip and Wave-1 clear independently release the only tutorial upgrade gate", () => {
  const cfg = config();
  let state = Management.createManagementState(cfg);
  state = apply(state, cfg, command("build")).state;

  const hostile = apply(state, cfg, command("upgrade"));
  assert.equal(hostile.event.reason, "tutorial-gated");
  assert.equal(hostile.state.aether, 90);
  assert.equal(hostile.state.towers[0].level, 1);

  let skipped = apply(state, cfg, command("skipTutorialGate"));
  assert.deepEqual(skipped.event, {
    type: "tutorialGate", tick: 0, seq: 0, action: "skip", opened: true,
  });
  assert.equal(skipped.state.tutorialUpgradeGateOpen, true);
  let upgraded = apply(skipped.state, cfg, command("upgrade"));
  assert.equal(upgraded.event.type, "upgrade");
  assert.equal(upgraded.state.towers[0].level, 2);
  assert.equal(upgraded.state.towers[0].investedAether, 115);
  assert.equal(upgraded.state.aether, 35);

  const replaySkip = apply(upgraded.state, cfg, command("skipTutorialGate"));
  assert.equal(replaySkip.event.opened, false);
  assert.deepEqual(replaySkip.state, upgraded.state);

  state = Management.createManagementState(cfg);
  state = apply(state, cfg, command("build")).state;
  state = apply(state, cfg, command("startWave")).state;
  const clear = Management.completeActiveWave(state, cfg, 600);
  assert.deepEqual(clear.event, {
    type: "waveClear", tick: 600, wave: 1,
    tutorialUpgradeGateOpened: true, campaignComplete: false,
  });
  assert.equal(clear.state.phase, "planning");
  assert.equal(clear.state.clearedWaves, 1);
  assert.equal(clear.state.tutorialUpgradeGateOpen, true);
  upgraded = apply(clear.state, cfg, command("upgrade"));
  assert.equal(upgraded.event.type, "upgrade");
  assert.equal(upgraded.state.towers[0].level, 2);
});

test("wave starts credit configured fixed grants once before activation and never overlap", () => {
  const cfg = config();
  let state = Management.createManagementState(cfg);
  let start = apply(state, cfg, command("startWave"));
  state = start.state;
  assert.deepEqual(start.event, {
    type: "waveStart", tick: 0, seq: 0, wave: 1, grantAether: 0, aetherAfter: 150,
  });
  assert.equal(state.phase, "wave");
  assert.equal(state.activeWave, 1);

  const overlap = apply(state, cfg, command("startWave"));
  assert.equal(overlap.event.reason, "wave-active");
  assert.equal(overlap.state.aether, 150);
  assert.equal(overlap.state.activeWave, 1);

  state = Management.completeActiveWave(state, cfg, 100).state;
  start = apply(state, cfg, command("startWave", { tick: 101 }));
  state = start.state;
  assert.equal(start.event.wave, 2);
  assert.equal(start.event.grantAether, 5);
  assert.equal(state.aether, 155);

  for (let wave = 2; wave <= 6; wave++) {
    state = Management.completeActiveWave(state, cfg, wave * 100).state;
    if (wave < 6) state = apply(state, cfg, command("startWave", { tick: wave * 100 + 1 })).state;
  }
  assert.equal(state.phase, "complete");
  assert.equal(state.clearedWaves, 6);
  assert.equal(state.aether, 215, "Wave 2's 5 and Wave 6's 60 are each credited once");
  const after = apply(state, cfg, command("startWave", { tick: 999 }));
  assert.equal(after.event.reason, "campaign-complete");
  assert.equal(after.state.aether, 215);
  assert.throws(() => Management.completeActiveWave(after.state, cfg, 1000), /No active wave/i);
});

test("every command is terminally denied after the configured campaign completes", () => {
  const cfg = config({ resolvedStartAether: 300, tutorialUpgradeGateMode: "none" });
  let state = Management.createManagementState(cfg);
  state = apply(state, cfg, command("build")).state;
  for (let wave = 1; wave <= 6; wave++) {
    state = apply(state, cfg, command("startWave", { tick: wave * 10 })).state;
    state = Management.completeActiveWave(state, cfg, wave * 10 + 1).state;
  }
  assert.equal(state.phase, "complete");
  const canonicalFinal = ABI.canonicalEncode(state);
  const nextTowerId = state.runtimeIds.nextByDomain.tower;
  const attempts = [
    command("build", { padId: "p02", defenseId: "siege" }),
    command("upgrade", { towerId: 1 }),
    command("sell", { towerId: 1 }),
    command("startWave"),
    command("skipTutorialGate"),
    command("setTargetPolicy", { towerId: 1, policy: "FAST" }),
  ];
  for (const attempt of attempts) {
    const result = apply(state, cfg, attempt);
    assert.deepEqual(result.event, {
      type: "denied", tick: 0, seq: 0,
      commandType: attempt.type, reason: "campaign-complete",
    });
    assert.equal(ABI.canonicalEncode(result.state), canonicalFinal);
    assert.equal(result.state.runtimeIds.nextByDomain.tower, nextTowerId);
  }
});

test("upgrade and sell use runtime tower identity with exact cumulative 70-percent refund", () => {
  const cfg = config({ resolvedStartAether: 430, tutorialUpgradeGateMode: "none" });
  let state = Management.createManagementState(cfg);
  state = apply(state, cfg, command("build", { padId: "p01", defenseId: "sentinel" })).state;
  state = apply(state, cfg, command("build", { padId: "p02", defenseId: "siege" })).state;
  assert.deepEqual(state.towers.map((tower) => [tower.id, tower.padId, tower.defenseId]), [
    [1, "p01", "sentinel"],
    [2, "p02", "siege"],
  ]);

  let result = apply(state, cfg, command("upgrade", { towerId: 2 }));
  state = result.state;
  assert.equal(state.towers[0].level, 1, "tower 1 on another pad is untouched");
  assert.equal(state.towers[1].level, 2);
  assert.equal(state.towers[1].investedAether, 175);
  result = apply(state, cfg, command("upgrade", { towerId: 2 }));
  state = result.state;
  assert.equal(state.towers[1].level, 3);
  assert.equal(state.towers[1].investedAether, 315);

  result = apply(state, cfg, command("sell", { towerId: 2 }));
  state = result.state;
  assert.deepEqual(result.event, {
    type: "sell", tick: 0, seq: 0, towerId: 2, padId: "p02", defenseId: "siege",
    level: 3, investedAether: 315, refundAether: 220, aetherAfter: 275,
  });
  assert.deepEqual(state.towers.map((tower) => tower.id), [1]);
  assert.equal(state.aether, 275);
  assert.equal(state.runtimeIds.nextByDomain.tower, 3, "selling never rewinds allocation");

  const resell = apply(state, cfg, command("sell", { towerId: 2 }));
  assert.equal(resell.event.reason, "unknown-tower");
  assert.equal(resell.state.aether, 275, "refund cannot be duplicated");
});

test("target policy changes enforce each defense's configured policy surface", () => {
  const cfg = config({ resolvedStartAether: 300, tutorialUpgradeGateMode: "none" });
  let state = Management.createManagementState(cfg);
  state = apply(state, cfg, command("build", { padId: "p01", defenseId: "sentinel" })).state;
  state = apply(state, cfg, command("build", { padId: "p02", defenseId: "oracle" })).state;
  assert.equal(state.towers[0].targetPolicy, "FRONT");
  assert.equal(state.towers[1].targetPolicy, null);

  let result = apply(state, cfg, command("setTargetPolicy", { towerId: 1, policy: "FAST" }));
  state = result.state;
  assert.deepEqual(result.event, {
    type: "targetPolicy", tick: 0, seq: 0, towerId: 1, policy: "FAST", changed: true,
  });
  assert.equal(state.towers[0].targetPolicy, "FAST");

  result = apply(state, cfg, command("setTargetPolicy", { towerId: 1, policy: "FAST" }));
  assert.equal(result.event.changed, false);
  assert.deepEqual(result.state, state);

  result = apply(state, cfg, command("setTargetPolicy", { towerId: 2, policy: "FRONT" }));
  assert.equal(result.event.reason, "target-policy-not-allowed");
  assert.equal(result.state.towers[1].targetPolicy, null);
  result = apply(state, cfg, command("setTargetPolicy", { towerId: 999, policy: "FRONT" }));
  assert.equal(result.event.reason, "unknown-tower");
});

test("ordered command batches are deterministic and denials roll back every authoritative field", () => {
  const cfg = config();
  const initial = Management.createManagementState(cfg);
  const commands = [
    command("build", { tick: 0, seq: 0 }),
    command("upgrade", { tick: 0, seq: 1 }),
    command("skipTutorialGate", { tick: 0, seq: 2 }),
    command("upgrade", { tick: 0, seq: 3 }),
    command("setTargetPolicy", { tick: 0, seq: 4, policy: "STRONG" }),
    command("sell", { tick: 0, seq: 5 }),
  ];
  const callerState = mutableClone(initial);
  const callerCommands = mutableClone(commands);
  const first = Management.applyCommandBucket(callerState, cfg, 0, callerCommands);
  const second = Management.applyCommandBucket(initial, cfg, 0, commands);
  assert.deepEqual(callerState, initial);
  assert.deepEqual(callerCommands, commands);
  assert.equal(ABI.canonicalEncode(first), ABI.canonicalEncode(second));
  assert.equal(
    ABI.sha256Hex(ABI.canonicalEncode(first)),
    ABI.sha256Hex(ABI.canonicalEncode(second))
  );
  assert.deepEqual(first.events.map((event) => [event.type, event.reason || null]), [
    ["build", null],
    ["denied", "tutorial-gated"],
    ["tutorialGate", null],
    ["upgrade", null],
    ["targetPolicy", null],
    ["sell", null],
  ]);
  assert.equal(first.state.aether, 115);
  assert.deepEqual(first.state.towers, []);
  assert.equal(first.state.runtimeIds.nextByDomain.tower, 2);
  assertDeepFrozen(first);
  assert.doesNotThrow(() => ABI.canonicalEncode(first));

  assert.throws(() => Management.applyCommandBucket(initial, cfg, 0, [
    command("build", { tick: 0, seq: 0 }),
    command("sell", { tick: 0, seq: 2 }),
  ]), /exactly one greater/i);
});

test("command buckets reject mismatched or cross-tick time collapse and bound currentTick", () => {
  const cfg = config();
  const initial = Management.createManagementState(cfg);
  const canonicalInitial = ABI.canonicalEncode(initial);

  assert.throws(() => Management.applyCommandBucket(initial, cfg, 1, [
    command("build", { tick: 0, seq: 0 }),
  ]), /must match its current tick/i);
  assert.throws(() => Management.applyCommandBucket(initial, cfg, 0, [
    command("build", { tick: 0, seq: 0 }),
    command("startWave", { tick: 1, seq: 0 }),
  ]), /must match its current tick/i);
  assert.throws(() => Management.applyCommandBucket(initial, cfg, 0, [
    command("build", { tick: 0, seq: 0 }),
    command("sell", { tick: 0, seq: 2 }),
  ]), /exactly one greater/i);
  assert.throws(() => Management.applyCommandBucket(initial, cfg, -1, []), /nonnegative/i);
  assert.throws(() => Management.applyCommandBucket(initial, cfg, 0.5, []), /safe integer/i);
  assert.throws(() => Management.applyCommandBucket(
    initial, cfg, 5184001, []
  ), /maximum tick/i);
  assert.throws(() => Management.applyCommandBucket(
    initial, cfg, 11, [], { maxTick: 10 }
  ), /maximum tick/i);
  assert.equal(ABI.canonicalEncode(initial), canonicalInitial);

  const empty = Management.applyCommandBucket(initial, cfg, 77, []);
  assert.equal(ABI.canonicalEncode(empty.state), canonicalInitial);
  assert.deepEqual(empty.events, []);
  assertDeepFrozen(empty);
});

test("state normalization rejects forged investment, occupancy, phase, gate, and ID rollback", () => {
  const cfg = config({ tutorialUpgradeGateMode: "none" });
  let state = Management.createManagementState(cfg);
  state = apply(state, cfg, command("build")).state;
  const caller = mutableClone(state);
  const normalized = Management.normalizeManagementState(caller, cfg);
  assert.deepEqual(caller, state);
  assert.notEqual(normalized, caller);
  assertDeepFrozen(normalized);

  const forgedInvestment = mutableClone(state);
  forgedInvestment.towers[0].investedAether = 59;
  assert.throws(() => Management.normalizeManagementState(forgedInvestment, cfg), /investment/i);

  const duplicatePad = mutableClone(state);
  duplicatePad.towers.push({
    id: 2, padId: "p01", defenseId: "sentinel", level: 1,
    investedAether: 60, targetPolicy: "FRONT",
  });
  duplicatePad.runtimeIds.nextByDomain.tower = 3;
  assert.throws(() => Management.normalizeManagementState(duplicatePad, cfg), /two towers/i);

  const rolledBackId = mutableClone(state);
  rolledBackId.runtimeIds.nextByDomain.tower = 1;
  assert.throws(() => Management.normalizeManagementState(rolledBackId, cfg), /greater than every/i);

  const illegalPlanning = mutableClone(state);
  illegalPlanning.activeWave = 1;
  assert.throws(() => Management.normalizeManagementState(illegalPlanning, cfg), /Planning state/i);

  const closedNoneGate = mutableClone(state);
  closedNoneGate.tutorialUpgradeGateOpen = false;
  assert.throws(() => Management.normalizeManagementState(closedNoneGate, cfg), /must start and remain open/i);
});

test("CommonJS and classic-script modes expose the same frozen four-dependency API", () => {
  assert.equal(Object.isFrozen(Management), true);
  assert.equal(Object.isFrozen(Management.PHASES), true);
  assert.equal(Object.isFrozen(Management.TUTORIAL_GATE_MODES), true);
  assert.deepEqual(
    Object.keys(Management).filter((key) => typeof Management[key] === "function"),
    [
      "normalizeManagementConfig",
      "normalizeManagementState",
      "createManagementState",
      "applyCommandBucket",
      "completeActiveWave",
    ]
  );
  assert.equal(Management.applyCommand, undefined);
  assert.equal(Management.applyCommandSequence, undefined);

  const source = fs.readFileSync(MANAGEMENT_PATH, "utf8");
  assert.deepEqual(
    Array.from(source.matchAll(/\brequire\("([^"]+)"\)/g), (match) => match[1]),
    ["./abi.js", "./economy.js", "./movement.js", "./commands.js"]
  );
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  for (const filename of ["abi.js", "economy.js", "movement.js", "commands.js", "management.js"]) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", "js", "sim", filename), "utf8"),
      context,
      { filename: filename }
    );
  }
  assert.equal(Object.isFrozen(context.Game.AegisManagement), true);
  assert.equal(context.Game.AegisManagement.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.localStorage, undefined);
  assert.equal(context.WebSocket, undefined);
  assert.equal(context.require, undefined);

  const parityConfig = config();
  const parityCommands = [
    command("build", { tick: 12, seq: 0 }),
    command("upgrade", { tick: 12, seq: 1 }),
    command("skipTutorialGate", { tick: 12, seq: 2 }),
    command("upgrade", { tick: 12, seq: 3 }),
    command("setTargetPolicy", { tick: 12, seq: 4, policy: "STRONG" }),
    command("sell", { tick: 12, seq: 5 }),
  ];
  const commonResult = Management.applyCommandBucket(
    Management.createManagementState(parityConfig), parityConfig, 12, parityCommands
  );
  assert.deepEqual(commonResult.events.map((event) => event.type), [
    "build", "denied", "tutorialGate", "upgrade", "targetPolicy", "sell",
  ]);
  assert.equal(commonResult.events[1].reason, "tutorial-gated");
  assert.equal(commonResult.events[5].refundAether, 80);
  assert.equal(commonResult.state.aether, 115);
  assert.deepEqual(commonResult.state.towers, []);
  assert.equal(commonResult.state.runtimeIds.nextByDomain.tower, 2);

  const classicCanonical = vm.runInContext(
    "(function () {" +
      "const cfg = " + JSON.stringify(parityConfig) + ";" +
      "const inputs = " + JSON.stringify(parityCommands) + ";" +
      "const state = Game.AegisManagement.createManagementState(cfg);" +
      "const result = Game.AegisManagement.applyCommandBucket(state, cfg, 12, inputs);" +
      "return Game.AegisSim.canonicalEncode(result);" +
    "})()",
    context
  );
  assert.equal(classicCanonical, ABI.canonicalEncode(commonResult));

  assert.throws(() => vm.runInNewContext(source, {}, {
    codeGeneration: { strings: false, wasm: false },
  }), /AegisSim/);
  assert.throws(() => vm.runInNewContext(source, {
    Game: { AegisSim: context.Game.AegisSim },
  }, {
    codeGeneration: { strings: false, wasm: false },
  }), /AegisEconomy/);
});
