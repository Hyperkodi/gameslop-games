"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const COMMANDS_PATH = path.join(__dirname, "..", "js", "sim", "commands.js");
const Commands = require(COMMANDS_PATH);

const DEFAULT_LIMITS = {
  maxCommandsPerTick: 64,
  maxTick: 5184000,
  maxTotalCommands: 100000,
};

function build(overrides) {
  return Object.assign({
    tick: 0,
    seq: 0,
    type: "build",
    padId: "p01",
    defenseId: "sentinel",
  }, overrides);
}

function tower(type, overrides) {
  return Object.assign({ tick: 0, seq: 0, type: type, towerId: 1 }, overrides);
}

test("all six v1 command records normalize without reordering or field laundering", () => {
  const inputs = [
    build(),
    { tick: 0, seq: 1, type: "setTargetPolicy", towerId: 1, policy: "STRONG" },
    tower("upgrade", { tick: 1, seq: 0, towerId: 1 }),
    tower("sell", { tick: 1, seq: 1, towerId: 2 }),
    { tick: 2, seq: 0, type: "startWave" },
    { tick: 2, seq: 1, type: "skipTutorialGate" },
  ];
  const normalized = Commands.normalizeCommandSequence(inputs);
  assert.deepEqual(normalized, inputs);
  assert.deepEqual(Array.from(Commands.COMMAND_TYPES), [
    "build", "upgrade", "sell", "startWave", "skipTutorialGate", "setTargetPolicy",
  ]);
  assert.deepEqual(Array.from(Commands.TARGET_POLICIES), ["FRONT", "STRONG", "FAST"]);
  assert.equal(Commands.COMMAND_SCHEMA_VERSION, 1);
  assert.equal(Commands.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
});

test("command adapters require exact keys, exact types, lowercase authored IDs, and runtime IDs", () => {
  assert.throws(() => Commands.normalizeCommand(null), /plain object/i);
  assert.throws(() => Commands.normalizeCommand(build({ extra: true })), /exactly/i);
  const missing = build();
  delete missing.padId;
  assert.throws(() => Commands.normalizeCommand(missing), /exactly/i);
  assert.throws(() => Commands.normalizeCommand(build({ type: "resetPlan" })), /command type/i);
  assert.throws(() => Commands.normalizeCommand(build({ type: "overcharge" })), /command type/i);
  assert.throws(() => Commands.normalizeCommand(build({ padId: "P01" })), /lowercase authored ID/i);
  assert.throws(() => Commands.normalizeCommand(build({ padId: "bad pad" })), /lowercase authored ID/i);
  assert.throws(() => Commands.normalizeCommand(build({ defenseId: "sentinel/alt" })), /lowercase authored ID/i);
  assert.throws(() => Commands.normalizeCommand(tower("upgrade", { towerId: 0 })), /positive/i);
  assert.throws(() => Commands.normalizeCommand(tower("sell", { towerId: -1 })), /nonnegative/i);
  assert.throws(() => Commands.normalizeCommand(build({ tick: -1 })), /nonnegative/i);
  assert.throws(() => Commands.normalizeCommand(build({ seq: 0.5 })), /safe integer/i);
  assert.throws(
    () => Commands.normalizeCommand(build({ tick: Number.MAX_SAFE_INTEGER + 1 })),
    /safe integer/i
  );
  assert.throws(
    () => Commands.normalizeCommand(JSON.parse(
      '{"tick":0,"seq":0,"type":"startWave","__proto__":{"polluted":true}}'
    )),
    /exactly/i
  );
  assert.equal(Object.prototype.polluted, undefined);
});

test("command and limit descriptor validation rejects hostile graphs without reading or recursing", () => {
  const accessor = build();
  Object.defineProperty(accessor, "padId", {
    enumerable: true,
    get() { throw new Error("command getter must not execute"); },
  });
  assert.throws(() => Commands.normalizeCommand(accessor), /enumerable data propert/i);

  const hidden = build();
  Object.defineProperty(hidden, "padId", { value: "p01", enumerable: false });
  assert.throws(() => Commands.normalizeCommand(hidden), /enumerable data propert/i);

  const symbol = build();
  symbol[Symbol("hidden")] = true;
  assert.throws(() => Commands.normalizeCommand(symbol), /symbol propert/i);

  const inherited = Object.assign(Object.create({ inherited: true }), build());
  assert.throws(() => Commands.normalizeCommand(inherited), /plain object/i);
  const nullPrototype = Object.assign(Object.create(null), build());
  assert.equal(Commands.normalizeCommand(nullPrototype).padId, "p01");

  let deep = 0;
  for (let index = 0; index < 20000; index++) deep = { next: deep };
  const deepExtra = build({ extra: deep });
  assert.throws(() => Commands.normalizeCommand(deepExtra), function (error) {
    assert.notEqual(error && error.message, "Maximum call stack size exceeded");
    assert.match(String(error && error.message), /contain exactly/i);
    return true;
  });
  assert.throws(() => Commands.normalizeCommandSequence([deepExtra]), function (error) {
    assert.notEqual(error && error.message, "Maximum call stack size exceeded");
    assert.match(String(error && error.message), /contain exactly/i);
    return true;
  });

  const limitAccessor = {};
  Object.defineProperty(limitAccessor, "maxTick", {
    enumerable: true,
    get() { throw new Error("limit getter must not execute"); },
  });
  assert.throws(() => Commands.createCommandLimits(limitAccessor), /enumerable data propert/i);
  const hiddenLimit = {};
  Object.defineProperty(hiddenLimit, "maxTick", { value: 1, enumerable: false });
  assert.throws(() => Commands.createCommandLimits(hiddenLimit), /enumerable data propert/i);
  const symbolLimit = { maxTick: 1 };
  symbolLimit[Symbol("hidden")] = true;
  assert.throws(() => Commands.createCommandLimits(symbolLimit), /symbol propert/i);
  assert.throws(() => Commands.createCommandLimits({ surprise: deep }), /unknown command limit/i);
});

test("setTargetPolicy accepts only the three binding policies", () => {
  for (const policy of Commands.TARGET_POLICIES) {
    assert.equal(Commands.normalizeCommand({
      tick: 5, seq: 0, type: "setTargetPolicy", towerId: 9, policy: policy,
    }).policy, policy);
  }
  assert.throws(() => Commands.normalizeCommand({
    tick: 5, seq: 0, type: "setTargetPolicy", towerId: 9, policy: "front",
  }), /target policy/i);
  assert.throws(() => Commands.normalizeCommand({
    tick: 5, seq: 0, type: "setTargetPolicy", towerId: 9, policy: "RANDOM",
  }), /target policy/i);
});

test("authored order requires nondecreasing ticks and a fresh contiguous zero-based sequence", () => {
  assert.deepEqual(Commands.normalizeCommandSequence([]), []);
  assert.throws(() => Commands.normalizeCommandSequence([
    { tick: 1, seq: 0, type: "startWave" },
    { tick: 0, seq: 0, type: "startWave" },
  ]), /nondecreasing/i);
  assert.throws(() => Commands.normalizeCommandSequence([
    { tick: 0, seq: 1, type: "startWave" },
  ]), /first.*sequence.*zero/i);
  assert.throws(() => Commands.normalizeCommandSequence([
    { tick: 0, seq: 0, type: "startWave" },
    { tick: 0, seq: 2, type: "skipTutorialGate" },
  ]), /exactly.*previous/i);
  assert.throws(() => Commands.normalizeCommandSequence([
    { tick: 0, seq: 0, type: "startWave" },
    { tick: 1, seq: 1, type: "skipTutorialGate" },
  ]), /first.*sequence.*zero/i);
  assert.throws(() => Commands.normalizeCommandSequence([
    { tick: 0, seq: 0, type: "startWave" },
    { tick: 0, seq: 0, type: "skipTutorialGate" },
  ]), /exactly.*previous/i);
});

test("command sequences must be dense plain data arrays without hidden or extra properties", () => {
  const sparse = new Array(1);
  assert.throws(() => Commands.normalizeCommandSequence(sparse), /dense array/i);

  const accessor = [];
  Object.defineProperty(accessor, "0", {
    enumerable: true,
    get() { throw new Error("array getter must not execute"); },
  });
  assert.throws(() => Commands.normalizeCommandSequence(accessor), /enumerable data element/i);

  const hidden = [];
  Object.defineProperty(hidden, "0", { value: { tick: 0, seq: 0, type: "startWave" }, enumerable: false });
  assert.throws(() => Commands.normalizeCommandSequence(hidden), /enumerable data element/i);

  const extra = [{ tick: 0, seq: 0, type: "startWave" }];
  extra.note = true;
  assert.throws(() => Commands.normalizeCommandSequence(extra), /extra propert/i);
  const outOfRange = [{ tick: 0, seq: 0, type: "startWave" }];
  outOfRange["4294967295"] = true;
  assert.throws(() => Commands.normalizeCommandSequence(outOfRange), /extra propert/i);
  const symbol = [{ tick: 0, seq: 0, type: "startWave" }];
  symbol[Symbol("hidden")] = true;
  assert.throws(() => Commands.normalizeCommandSequence(symbol), /symbol propert/i);

  class CommandList extends Array {}
  const subclass = new CommandList();
  subclass.push({ tick: 0, seq: 0, type: "startWave" });
  assert.throws(() => Commands.normalizeCommandSequence(subclass), /plain array/i);
});

test("frozen security limits allow only known equal-or-stricter overrides", () => {
  assert.deepEqual(Commands.DEFAULT_LIMITS, DEFAULT_LIMITS);
  assert.equal(Object.isFrozen(Commands.DEFAULT_LIMITS), true);
  assert.equal(Commands.createCommandLimits(), Commands.DEFAULT_LIMITS);

  const strict = Commands.createCommandLimits({
    maxCommandsPerTick: 2,
    maxTick: 10,
    maxTotalCommands: 4,
  });
  assert.deepEqual(strict, { maxCommandsPerTick: 2, maxTick: 10, maxTotalCommands: 4 });
  assert.equal(Object.isFrozen(strict), true);
  assert.doesNotThrow(() => ABI.canonicalEncode(strict));

  assert.throws(() => Commands.createCommandLimits({ surprise: 1 }), /unknown command limit/i);
  assert.throws(() => Commands.createCommandLimits({ maxTick: DEFAULT_LIMITS.maxTick + 1 }), /cannot relax/i);
  assert.throws(
    () => Commands.createCommandLimits({ maxTotalCommands: DEFAULT_LIMITS.maxTotalCommands + 1 }),
    /cannot relax/i
  );
  assert.throws(
    () => Commands.createCommandLimits({ maxCommandsPerTick: DEFAULT_LIMITS.maxCommandsPerTick + 1 }),
    /cannot relax/i
  );
  assert.throws(() => Commands.createCommandLimits({ maxTick: -1 }), /nonnegative/i);
  assert.throws(() => Commands.createCommandLimits({ maxTotalCommands: 1.5 }), /safe integer/i);
});

test("sequence validation enforces maximum tick, total commands, and commands per tick", () => {
  assert.throws(() => Commands.normalizeCommandSequence([
    { tick: 2, seq: 0, type: "startWave" },
  ], { maxTick: 1 }), /maximum tick/i);
  assert.throws(() => Commands.normalizeCommandSequence([
    { tick: 0, seq: 0, type: "startWave" },
    { tick: 1, seq: 0, type: "startWave" },
  ], { maxTotalCommands: 1 }), /total command/i);
  assert.throws(() => Commands.normalizeCommandSequence([
    { tick: 0, seq: 0, type: "startWave" },
    { tick: 0, seq: 1, type: "skipTutorialGate" },
  ], { maxCommandsPerTick: 1 }), /commands per tick/i);
  assert.deepEqual(Commands.normalizeCommandSequence([], {
    maxCommandsPerTick: 0,
    maxTick: 0,
    maxTotalCommands: 0,
  }), []);
});

test("normalized commands are deeply frozen canonical copies and never mutate caller data", () => {
  const first = build({ padId: "m01.p01", defenseId: "apollo-guard" });
  const second = { tick: 0, seq: 1, type: "setTargetPolicy", towerId: 7, policy: "FAST" };
  const inputs = [first, second];
  const normalized = Commands.normalizeCommandSequence(inputs);

  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(normalized.every(Object.isFrozen), true);
  assert.doesNotThrow(() => ABI.canonicalEncode(normalized));
  assert.equal(Object.isFrozen(inputs), false);
  assert.equal(Object.isFrozen(first), false);
  first.padId = "changed";
  second.policy = "FRONT";
  inputs.push({ tick: 1, seq: 0, type: "startWave" });
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].padId, "m01.p01");
  assert.equal(normalized[1].policy, "FAST");

  const shared = build();
  assert.throws(() => Commands.normalizeCommandSequence([shared, shared]), /shared reference/i);
});

test("syntactically valid but gameplay-illegal actions remain reducer responsibility", () => {
  assert.doesNotThrow(() => Commands.normalizeCommand(build({
    padId: "nonexistent.pad", defenseId: "unreleased-defense",
  })));
  assert.doesNotThrow(() => Commands.normalizeCommand(tower("sell", { towerId: 999999 })));
  assert.doesNotThrow(() => Commands.normalizeCommand({ tick: 0, seq: 0, type: "startWave" }));
});

test("CommonJS and classic-script modes expose the same frozen ABI-only command API", () => {
  assert.equal(Object.isFrozen(Commands), true);
  assert.equal(Object.isFrozen(Commands.COMMAND_TYPES), true);
  assert.equal(Object.isFrozen(Commands.TARGET_POLICIES), true);

  const source = fs.readFileSync(COMMANDS_PATH, "utf8");
  assert.deepEqual(
    Array.from(source.matchAll(/\brequire\("([^"]+)"\)/g), (match) => match[1]),
    ["./abi.js"]
  );
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8"), context);
  vm.runInContext(source, context);
  const classic = context.Game.AegisCommands;
  assert.equal(Object.isFrozen(classic), true);
  assert.equal(classic.ABI_DESCRIPTOR_SHA256, Commands.ABI_DESCRIPTOR_SHA256);
  assert.deepEqual(
    JSON.parse(vm.runInContext(
      'JSON.stringify(Game.AegisCommands.normalizeCommandSequence([' +
        '{tick:0,seq:0,type:"startWave"}' +
      ']))',
      context
    )),
    [{ tick: 0, seq: 0, type: "startWave" }]
  );
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.localStorage, undefined);
  assert.equal(context.WebSocket, undefined);

  assert.throws(() => vm.runInNewContext(source, {}, {
    codeGeneration: { strings: false, wasm: false },
  }), /AegisSim/);
  assert.throws(() => vm.runInNewContext(source, {
    Game: { AegisSim: { DESCRIPTOR: ABI.DESCRIPTOR } },
  }, {
    codeGeneration: { strings: false, wasm: false },
  }), /frozen Aegis simulation ABI/i);
});
