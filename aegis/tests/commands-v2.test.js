"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI_V1 = require("../js/sim/abi.js");
const ABI = require("../js/sim/abi-v2.js");
const CommandsV1 = require("../js/sim/commands.js");
const COMMANDS_V2_PATH = path.join(__dirname, "..", "js", "sim", "commands-v2.js");
const CommandsV2 = require(COMMANDS_V2_PATH);

function base(type, fields) {
  return Object.assign({ tick: 0, seq: 0, type: type }, fields);
}

function activate(target, fields) {
  return base("activatePower", Object.assign({
    protocolId: "temporal-edict",
    tier: 1,
    target: target,
  }, fields));
}

test("command schema v2 retains all six v1 records and adds the five approved families", () => {
  const commands = [
    base("build", { padId: "p01", defenseId: "sentinel" }),
    base("upgrade", { seq: 1, towerId: 1 }),
    base("sell", { seq: 2, towerId: 2 }),
    base("startWave", { seq: 3 }),
    base("skipTutorialGate", { seq: 4 }),
    base("setTargetPolicy", { seq: 5, towerId: 3, policy: "FAST" }),
    base("specializeTower", {
      seq: 6, towerRuntimeId: 3, specializationId: "sentinel-twin-lance",
    }),
    activate({ kind: "none" }, { seq: 7 }),
    base("deployReinforcement", {
      seq: 8, reinforcementId: "spartan-phalanx", markerId: "marker.p01",
    }),
    base("activateMechanism", {
      seq: 9, mechanismId: "bronze-city-gate", activationId: "gate.west",
    }),
    base("resetPlan", { seq: 10 }),
  ];

  const normalized = CommandsV2.normalizeCommandSequence(commands);
  assert.deepEqual(normalized, commands);
  assert.deepEqual(Array.from(CommandsV2.COMMAND_TYPES), [
    "build", "upgrade", "sell", "startWave", "skipTutorialGate", "setTargetPolicy",
    "specializeTower", "activatePower", "deployReinforcement", "activateMechanism", "resetPlan",
  ]);
  assert.deepEqual(Array.from(CommandsV2.TARGET_KINDS), [
    "none", "route-point", "tower", "world-vector",
  ]);
  assert.equal(CommandsV2.COMMAND_SCHEMA_VERSION, 2);
  assert.equal(CommandsV2.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);

  commands.slice(0, 6).forEach(function (command, index) {
    command.seq = 0;
    assert.deepEqual(CommandsV2.normalizeCommand(command), CommandsV1.normalizeCommand(command), index);
  });
  assert.throws(() => CommandsV1.normalizeCommand(commands[6]), /unsupported command type/i);
});

test("activatePower validates and freezes the four closed target records", () => {
  const vectors = [
    { kind: "none" },
    { kind: "route-point", routeId: "route.main", routeDistance: 123456 },
    { kind: "tower", towerRuntimeId: 7 },
    { kind: "world-vector", originX: -4000, originY: 12000, aimX: 30000, aimY: 18000 },
  ];
  vectors.forEach(function (target) {
    const normalized = CommandsV2.normalizeCommand(activate(target));
    assert.deepEqual(normalized.target, target);
    assert.notEqual(normalized.target, target);
    assert.equal(Object.isFrozen(normalized), true);
    assert.equal(Object.isFrozen(normalized.target), true);
    assert.doesNotThrow(() => ABI.canonicalEncode(normalized));
  });

  assert.throws(() => CommandsV2.normalizeTarget(null), /plain object/i);
  assert.throws(() => CommandsV2.normalizeTarget({ kind: "area" }), /target kind/i);
  assert.throws(() => CommandsV2.normalizeTarget({ kind: "none", routeId: "route.main" }), /exactly/i);
  assert.throws(() => CommandsV2.normalizeTarget({
    kind: "route-point", routeId: "Route.Main", routeDistance: 1,
  }), /lowercase authored ID/i);
  assert.throws(() => CommandsV2.normalizeTarget({
    kind: "route-point", routeId: "route.main", routeDistance: -1,
  }), /nonnegative/i);
  assert.throws(() => CommandsV2.normalizeTarget({ kind: "tower", towerRuntimeId: 0 }), /positive/i);
  assert.throws(() => CommandsV2.normalizeTarget({
    kind: "world-vector", originX: 0.5, originY: 0, aimX: 1, aimY: 1,
  }), /safe integer/i);
});

test("all added command payloads require exact fields and canonical primitive values", () => {
  assert.throws(() => CommandsV2.normalizeCommand(activate({ kind: "none" }, {
    protocolId: "Temporal-Edict",
  })), /lowercase authored ID/i);
  assert.throws(() => CommandsV2.normalizeCommand(activate({ kind: "none" }, { tier: 0 })), /tier/i);
  assert.throws(() => CommandsV2.normalizeCommand(activate({ kind: "none" }, { tier: 4 })), /tier/i);
  assert.throws(() => CommandsV2.normalizeCommand(activate({ kind: "none" }, { extra: true })), /exactly/i);

  assert.throws(() => CommandsV2.normalizeCommand(base("specializeTower", {
    towerRuntimeId: 0, specializationId: "sentinel-lock-on",
  })), /positive/i);
  assert.throws(() => CommandsV2.normalizeCommand(base("specializeTower", {
    towerRuntimeId: 1, specializationId: "Sentinel",
  })), /lowercase authored ID/i);
  assert.throws(() => CommandsV2.normalizeCommand(base("deployReinforcement", {
    reinforcementId: "spartan-phalanx", markerId: "bad marker",
  })), /lowercase authored ID/i);
  assert.throws(() => CommandsV2.normalizeCommand(base("activateMechanism", {
    mechanismId: "bridgefall", activationId: "Bridge.West",
  })), /lowercase authored ID/i);
  assert.throws(() => CommandsV2.normalizeCommand(base("resetPlan", { value: 1 })), /exactly/i);
  assert.throws(() => CommandsV2.normalizeCommand(base("castSpell", {})), /unsupported command type/i);
});

test("v2 command parsing rejects hostile nested target graphs without invoking accessors", () => {
  const accessorTarget = { kind: "tower" };
  Object.defineProperty(accessorTarget, "towerRuntimeId", {
    enumerable: true,
    get() { throw new Error("target getter must not execute"); },
  });
  assert.throws(() => CommandsV2.normalizeCommand(activate(accessorTarget)), /enumerable data propert/i);

  const hiddenTarget = { kind: "tower" };
  Object.defineProperty(hiddenTarget, "towerRuntimeId", { value: 1, enumerable: false });
  assert.throws(() => CommandsV2.normalizeCommand(activate(hiddenTarget)), /enumerable data propert/i);

  const symbolTarget = { kind: "none" };
  symbolTarget[Symbol("hidden")] = true;
  assert.throws(() => CommandsV2.normalizeCommand(activate(symbolTarget)), /symbol propert/i);

  const inheritedTarget = Object.assign(Object.create({ inherited: true }), { kind: "none" });
  assert.throws(() => CommandsV2.normalizeCommand(activate(inheritedTarget)), /plain object/i);

  const commandAccessor = activate({ kind: "none" });
  Object.defineProperty(commandAccessor, "target", {
    enumerable: true,
    get() { throw new Error("command getter must not execute"); },
  });
  assert.throws(() => CommandsV2.normalizeCommand(commandAccessor), /enumerable data propert/i);
});

test("authored IDs use the replay-v1 128-code-unit ceiling and shared nested targets fail closed", () => {
  const maximum = "a" + "b".repeat(127);
  assert.equal(CommandsV2.normalizeCommand(base("activateMechanism", {
    mechanismId: maximum, activationId: "a01",
  })).mechanismId.length, 128);
  assert.throws(() => CommandsV2.normalizeCommand(base("activateMechanism", {
    mechanismId: maximum + "c", activationId: "a01",
  })), /authored ID/i);

  const sharedTarget = { kind: "none" };
  assert.throws(() => CommandsV2.normalizeCommandSequence([
    activate(sharedTarget),
    activate(sharedTarget, { seq: 1, protocolId: "zeus-skyfire" }),
  ]), /shared Protocol target reference/i);
  assert.notStrictEqual(CommandsV2.normalizeCommand(activate(sharedTarget)).target, sharedTarget);
});

test("v2 command sequence preserves dense zero-based per-tick ordering and frozen limits", () => {
  const sequence = [
    activate({ kind: "none" }),
    base("resetPlan", { tick: 0, seq: 1 }),
    base("startWave", { tick: 1, seq: 0 }),
  ];
  const normalized = CommandsV2.normalizeCommandSequence(sequence, {
    maxCommandsPerTick: 2, maxTick: 1, maxTotalCommands: 3,
  });
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(normalized.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(normalized[0].target), true);
  assert.equal(CommandsV2.DEFAULT_LIMITS, CommandsV1.DEFAULT_LIMITS);
  assert.equal(CommandsV2.TARGET_POLICIES, CommandsV1.TARGET_POLICIES);

  assert.throws(() => CommandsV2.normalizeCommandSequence([
    activate({ kind: "none" }, { seq: 1 }),
  ]), /first.*sequence.*zero/i);
  assert.throws(() => CommandsV2.normalizeCommandSequence([
    activate({ kind: "none" }), base("resetPlan", { seq: 2 }),
  ]), /exactly.*previous/i);
  assert.throws(() => CommandsV2.normalizeCommandSequence([
    base("resetPlan", { tick: 1 }), base("resetPlan", { tick: 0 }),
  ]), /nondecreasing/i);

  const sparse = new Array(1);
  assert.throws(() => CommandsV2.normalizeCommandSequence(sparse), /dense array/i);
  const shared = activate({ kind: "none" });
  assert.throws(() => CommandsV2.normalizeCommandSequence([shared, shared]), /shared reference/i);
});

test("normalization copies caller data deeply enough to prevent post-parse target mutation", () => {
  const target = { kind: "route-point", routeId: "route.main", routeDistance: 42000 };
  const command = activate(target);
  const normalized = CommandsV2.normalizeCommand(command);
  target.routeId = "route.changed";
  target.routeDistance = 0;
  command.protocolId = "changed";
  assert.deepEqual(normalized, {
    tick: 0,
    seq: 0,
    type: "activatePower",
    protocolId: "temporal-edict",
    tier: 1,
    target: { kind: "route-point", routeId: "route.main", routeDistance: 42000 },
  });
});

test("CommonJS and classic-script modes expose the same frozen dependency-only v2 API", () => {
  assert.equal(Object.isFrozen(CommandsV2), true);
  assert.equal(Object.isFrozen(CommandsV2.COMMAND_TYPES), true);
  assert.equal(Object.isFrozen(CommandsV2.TARGET_KINDS), true);

  const source = fs.readFileSync(COMMANDS_V2_PATH, "utf8");
  assert.deepEqual(
    Array.from(source.matchAll(/\brequire\("([^"]+)"\)/g), (match) => match[1]),
    ["./abi-v2.js", "./commands.js"]
  );
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi-v2.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "sim", "commands.js"), "utf8"), context);
  vm.runInContext(source, context);
  const classic = context.Game.AegisCommandsV2;
  assert.equal(Object.isFrozen(classic), true);
  assert.deepEqual(JSON.parse(vm.runInContext(
    'JSON.stringify(Game.AegisCommandsV2.normalizeCommand(' +
      '{tick:0,seq:0,type:"activatePower",protocolId:"temporal-edict",tier:1,target:{kind:"none"}}))',
    context
  )), activate({ kind: "none" }));
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.localStorage, undefined);

  assert.throws(() => vm.runInNewContext(source, {}, {
    codeGeneration: { strings: false, wasm: false },
  }), /AegisSimV2/);
  assert.throws(() => vm.runInNewContext(source, {
    Game: { AegisSimV2: ABI_V1, AegisCommands: CommandsV1 },
  }, {
    codeGeneration: { strings: false, wasm: false },
  }), /ABI v2/i);
});

test("retained v1 command families enforce the 128-code-unit authored ID ceiling through both entry points", () => {
  const maximum = "a" + "b".repeat(127);
  const overflow = maximum + "c";
  assert.equal(
    CommandsV2.normalizeCommand(base("build", { padId: maximum, defenseId: "sentinel" })).padId.length,
    128
  );
  assert.equal(CommandsV2.normalizeCommandSequence([
    base("build", { padId: maximum, defenseId: maximum }),
  ])[0].defenseId.length, 128);
  assert.throws(() => CommandsV2.normalizeCommand(base("build", {
    padId: overflow, defenseId: "sentinel",
  })), { name: "TypeError", message: /authored ID|128/ });
  assert.throws(() => CommandsV2.normalizeCommandSequence([
    base("build", { padId: overflow, defenseId: "sentinel" }),
  ]), /authored ID|128/);
  assert.throws(() => CommandsV2.normalizeCommand(base("build", {
    padId: "p01", defenseId: overflow,
  })), /authored ID|128/);
  assert.throws(() => CommandsV2.normalizeCommandSequence([
    base("build", { padId: "p01", defenseId: "sentinel" }),
    base("build", { seq: 1, padId: "p02", defenseId: overflow }),
  ]), /authored ID|128/);
});
