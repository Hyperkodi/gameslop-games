"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const EffectTimeline = require("../js/presentation/effect-timeline.js");
const CommandsV2 = require("../js/sim/commands-v2.js");

// Browser script order: the timeline delegates Protocol target syntax to Game.AegisCommandsV2,
// which itself requires the AegisSim -> AegisSimV2 -> AegisCommands chain.
const BROWSER_SCRIPT_CHAIN = Object.freeze([
  "../js/sim/abi.js", "../js/sim/abi-v2.js", "../js/sim/commands.js", "../js/sim/commands-v2.js",
]);

function runScript(context, relative) {
  const filename = path.join(__dirname, relative);
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
}

function browserContext(preinstalledGame) {
  const context = { globalThis: null };
  context.globalThis = context;
  if (preinstalledGame !== undefined) context.Game = preinstalledGame;
  BROWSER_SCRIPT_CHAIN.forEach(function (relative) { runScript(context, relative); });
  return context;
}

test("effect timeline publishes one frozen browser surface over the installed CommandsV2 target contract", () => {
  const context = browserContext();
  runScript(context, "../js/presentation/effect-timeline.js");
  assert.equal(context.Game.AegisEffectTimeline.VERSION, EffectTimeline.VERSION);
  assert.equal(typeof context.Game.AegisEffectTimeline.createTimeline, "function");
  assert.equal(Object.isFrozen(context.Game.AegisEffectTimeline), true);
  assert.deepEqual(Array.from(context.Game.AegisEffectTimeline.TARGET_KINDS), Array.from(EffectTimeline.TARGET_KINDS));

  const conflict = browserContext({ AegisEffectTimeline: {} });
  assert.throws(function () {
    runScript(conflict, "../js/presentation/effect-timeline.js");
  }, /Conflicting Game\.AegisEffectTimeline/i);

  const missing = { globalThis: null, Game: {} };
  missing.globalThis = missing;
  assert.throws(function () {
    runScript(missing, "../js/presentation/effect-timeline.js");
  }, /Game\.AegisCommandsV2 must be installed before effect-timeline\.js/i);
  assert.equal(Object.prototype.hasOwnProperty.call(missing.Game, "AegisEffectTimeline"), false);

  const noGame = { globalThis: null };
  noGame.globalThis = noGame;
  assert.throws(function () {
    runScript(noGame, "../js/presentation/effect-timeline.js");
  }, /Game\.AegisCommandsV2 must be installed before effect-timeline\.js/i);
});

function frozen(value) {
  if (!value || typeof value !== "object") return value;
  Object.keys(value).forEach(function (key) { frozen(value[key]); });
  return Object.freeze(value);
}

function fixture(configure) {
  const input = {
    currentTick: 120,
    ticksPerSecond: 60,
    historyLimit: 2,
    cueCatalog: {
      "skyfire.cloud": {
        cueId: "skyfire.cloud",
        fullMotionKind: "cloud-travel",
        reducedMotionKind: "opacity-scale",
        photosensitivityMotionKind: "opacity-scale",
        eventDurationTicks: 30,
        ariaLabel: "Skyfire cloud gathers",
      },
      "skyfire.strike": {
        cueId: "skyfire.strike",
        fullMotionKind: "sustained-bolt",
        reducedMotionKind: "static-bolt",
        photosensitivityMotionKind: "sustained-bolt",
        eventDurationTicks: 12,
        ariaLabel: "Skyfire strikes",
      },
      "ward.consume": {
        cueId: "ward.consume",
        fullMotionKind: "shield-ripple",
        reducedMotionKind: "opacity-scale",
        photosensitivityMotionKind: "opacity-scale",
        eventDurationTicks: 18,
        ariaLabel: "Aegis Ward prevents integrity loss",
      },
    },
    pending: [{
      startedTick: 100,
      eventOrdinal: 3,
      cueId: "skyfire.cloud",
      sourceKind: "protocol",
      sourceId: "zeus-skyfire",
      resolveTick: 154,
      endTick: 154,
      target: { kind: "none" },
    }],
    events: [
      {
        tick: 90, eventOrdinal: 0, cueId: "ward.consume", sourceKind: "protocol",
        sourceId: "aegis-ward", phase: "resolved", target: { kind: "none" },
      },
      {
        tick: 119, eventOrdinal: 1, cueId: "skyfire.strike", sourceKind: "protocol",
        sourceId: "zeus-skyfire", phase: "resolved", target: { kind: "route-point", routeId: "route.main", routeDistance: 42000 },
      },
      {
        tick: 120, eventOrdinal: 2, cueId: "ward.consume", sourceKind: "protocol",
        sourceId: "aegis-ward", phase: "consumed", target: { kind: "tower", towerRuntimeId: 7 },
      },
    ],
  };
  if (configure) configure(input);
  return frozen(input);
}

test("timeline creates deterministic tick-ordinal-cue keys and full/reduced projections", () => {
  const model = EffectTimeline.createTimeline(fixture());

  assert.equal(model.schemaVersion, 1);
  assert.equal(model.currentTick, 120);
  assert.deepEqual(model.history.map(function (cue) { return cue.key; }), [
    "119:1:skyfire.strike",
    "120:2:ward.consume",
  ]);
  assert.deepEqual(model.fullMotion.cues.map(function (cue) { return cue.key; }), [
    "100:3:skyfire.cloud",
    "119:1:skyfire.strike",
    "120:2:ward.consume",
  ]);
  assert.deepEqual(model.reducedMotion.cues.map(function (cue) { return cue.key; }),
    model.fullMotion.cues.map(function (cue) { return cue.key; }));
  assert.equal(model.fullMotion.cues[0].motionKind, "cloud-travel");
  assert.equal(model.reducedMotion.cues[0].motionKind, "opacity-scale");
  assert.equal(model.fullMotion.cues[0].startTick, 100);
  assert.equal(model.fullMotion.cues[0].resolveTick, 154);
  assert.equal(model.reducedMotion.cues[0].resolveTick, 154,
    "Reduced Motion must preserve the authoritative telegraph boundary");
  assert.equal(model.fullMotion.cues[0].remainingTicks, 34);
  assert.equal(model.fullMotion.cues[0].progressBp, 3703);
  assert.deepEqual(model.photosensitivitySafe.cues.map(function (cue) { return cue.key; }),
    model.fullMotion.cues.map(function (cue) { return cue.key; }));
  assert.equal(model.photosensitivitySafe.cues[1].motionKind, "sustained-bolt");
  assert.equal(model.photosensitivityPolicy.rapidAlternatingFlashes, false);
  assert.deepEqual(EffectTimeline.SOURCE_KINDS, ["tower", "protocol", "mechanism", "unit"]);
  assert.deepEqual(model.announcements.map(function (entry) { return entry.text; }), [
    "Aegis Ward prevents integrity loss, used",
  ], "a pending cue that started on an earlier tick is not re-announced every tick");
  assert.equal(model.fullMotion.cues[0].ariaLabel, "Skyfire cloud gathers, telegraph pending, resolves in 1 second");
  assert.equal(model.fullMotion.cues[0].phase, "pending", "phase tokens stay machine-readable");
  assert.equal(model.history[1].phase, "consumed");
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.fullMotion.cues), true);
  assert.equal(Object.isFrozen(model.fullMotion.cues[0].target), true);
});

test("effect timeline preflight rejects hostile graphs and preserves semantic parity across motion modes", () => {
  const baseline = EffectTimeline.createTimeline(fixture());
  function semantic(cue) {
    const copy = Object.assign({}, cue);
    delete copy.motionKind;
    return copy;
  }
  assert.deepEqual(baseline.fullMotion.cues.map(semantic), baseline.reducedMotion.cues.map(semantic));
  assert.deepEqual(baseline.fullMotion.cues.map(semantic), baseline.photosensitivitySafe.cues.map(semantic));

  let getterCalls = 0;
  const getterInput = JSON.parse(JSON.stringify(fixture()));
  Object.defineProperty(getterInput, "events", {
    enumerable: true,
    get: function () { getterCalls += 1; return []; },
  });
  assert.throws(function () { EffectTimeline.createTimeline(getterInput); }, /data properties|accessor/i);
  assert.equal(getterCalls, 0);

  const sparse = JSON.parse(JSON.stringify(fixture()));
  sparse.events = new Array(2);
  assert.throws(function () { EffectTimeline.createTimeline(sparse); }, /dense/i);
  const symbolic = JSON.parse(JSON.stringify(fixture()));
  symbolic[Symbol("hostile")] = true;
  assert.throws(function () { EffectTimeline.createTimeline(symbolic); }, /symbols/i);
  const cyclic = JSON.parse(JSON.stringify(fixture()));
  cyclic.pending[0].loop = cyclic;
  assert.throws(function () { EffectTimeline.createTimeline(cyclic); }, /cycles|shared/i);
  const shared = JSON.parse(JSON.stringify(fixture()));
  shared.events[1].target = shared.events[0].target;
  assert.throws(function () { EffectTimeline.createTimeline(shared); }, /cycles|shared/i);
});

test("timeline history is bounded while active cues can include older pending work", () => {
  const model = EffectTimeline.createTimeline(fixture(function (input) {
    input.historyLimit = 1;
  }));
  assert.deepEqual(model.history.map(function (cue) { return cue.key; }), ["120:2:ward.consume"]);
  assert.equal(model.fullMotion.cues.some(function (cue) {
    return cue.key === "100:3:skyfire.cloud";
  }), true);
  assert.equal(model.historyDropped, 2);
});

test("timeline supports strict activation and world-vector targets without consulting a clock", () => {
  const originalNow = Date.now;
  Date.now = function () { throw new Error("wall clock must not be read"); };
  try {
    const model = EffectTimeline.createTimeline(fixture(function (input) {
      input.pending[0].target = { kind: "activation", activationId: "bridge.m17" };
      input.events[2].target = {
        kind: "world-vector",
        originX: 1000, originY: 2000, aimX: 4000, aimY: 8000,
      };
    }));
    assert.deepEqual(model.fullMotion.cues[0].target, { kind: "activation", activationId: "bridge.m17" });
    assert.deepEqual(model.history[1].target, {
      kind: "world-vector", originX: 1000, originY: 2000, aimX: 4000, aimY: 8000,
    });
  } finally {
    Date.now = originalNow;
  }
});

test("timeline targets preserve CommandsV2 canonical route and flat world-vector shapes", () => {
  const routeTarget = CommandsV2.normalizeTarget({
    kind: "route-point", routeId: "route.main", routeDistance: 42000,
  });
  const vectorTarget = CommandsV2.normalizeTarget({
    kind: "world-vector", originX: 10, originY: 20, aimX: 30, aimY: 40,
  });
  const route = EffectTimeline.createTimeline(fixture(function (input) {
    input.events[1].target = JSON.parse(JSON.stringify(routeTarget));
  }));
  const vector = EffectTimeline.createTimeline(fixture(function (input) {
    input.events[2].target = JSON.parse(JSON.stringify(vectorTarget));
  }));
  assert.deepEqual(route.history[0].target, routeTarget);
  assert.deepEqual(vector.history[1].target, vectorTarget);

  const zeroVector = CommandsV2.normalizeTarget({
    kind: "world-vector", originX: 10, originY: 20, aimX: 10, aimY: 20,
  });
  const zero = EffectTimeline.createTimeline(fixture(function (input) {
    input.events[2].target = JSON.parse(JSON.stringify(zeroVector));
  }));
  assert.deepEqual(zero.history[1].target, zeroVector);
});

test("timeline announces a pending cue only on its start tick and pluralizes remaining seconds", () => {
  function announcements(configure) {
    return EffectTimeline.createTimeline(fixture(configure)).announcements
      .map(function (entry) { return [entry.phase, entry.text]; });
  }
  function pendingText(configure) {
    return announcements(configure).find(function (entry) { return entry[0] === "pending"; })[1];
  }
  // Same tick: the consumed event (ordinal 2) sorts before the pending cue (ordinal 3).
  assert.deepEqual(announcements(function (input) {
    input.pending[0].startedTick = 120;
  }), [
    ["consumed", "Aegis Ward prevents integrity loss, used"],
    ["pending", "Skyfire cloud gathers, telegraph pending, resolves in 1 second"],
  ]);
  assert.equal(pendingText(function (input) {
    input.pending[0].startedTick = 120;
    input.pending[0].resolveTick = 120;
    input.pending[0].endTick = 120;
  }), "Skyfire cloud gathers, telegraph pending, resolves in 0 seconds");
  assert.equal(pendingText(function (input) {
    input.pending[0].startedTick = 120;
    input.pending[0].resolveTick = 240;
    input.pending[0].endTick = 240;
  }), "Skyfire cloud gathers, telegraph pending, resolves in 2 seconds");
  assert.deepEqual(announcements(function (input) {
    input.pending[0].startedTick = 119;
  }), [["consumed", "Aegis Ward prevents integrity loss, used"]]);
});

test("timeline announcements and labels map phase tokens to plain phrases", () => {
  const phrases = {
    accepted: "accepted", telegraph: "telegraph", resolved: "resolved", consumed: "used",
    expired: "expired", denied: "denied", activated: "activated",
  };
  Object.keys(phrases).forEach(function (phase) {
    const model = EffectTimeline.createTimeline(fixture(function (input) {
      input.events[2].phase = phase;
    }));
    assert.equal(model.history[1].phase, phase);
    assert.equal(model.history[1].ariaLabel, "Aegis Ward prevents integrity loss, " + phrases[phase]);
    assert.equal(model.announcements[0].text, "Aegis Ward prevents integrity loss, " + phrases[phase]);
    assert.equal(model.fullMotion.cues[2].ariaLabel, "Aegis Ward prevents integrity loss, " + phrases[phase]);
  });
});

function targetCorpus() {
  const longId = "r" + new Array(128).join("x");
  return [
    ["none", function () { return { kind: "none" }; }],
    ["route-point", function () { return { kind: "route-point", routeId: "route.main", routeDistance: 42000 }; }],
    ["route-point zero distance", function () { return { kind: "route-point", routeId: "a", routeDistance: 0 }; }],
    ["route-point negative-zero distance", function () { return { kind: "route-point", routeId: "route.main", routeDistance: -0 }; }],
    ["route-point 128-character id", function () { return { kind: "route-point", routeId: longId, routeDistance: 1 }; }],
    ["route-point 129-character id", function () { return { kind: "route-point", routeId: longId + "x", routeDistance: 1 }; }],
    ["route-point uppercase id", function () { return { kind: "route-point", routeId: "Route.Main", routeDistance: 1 }; }],
    ["route-point digit-first id", function () { return { kind: "route-point", routeId: "1route", routeDistance: 1 }; }],
    ["route-point empty id", function () { return { kind: "route-point", routeId: "", routeDistance: 1 }; }],
    ["route-point negative distance", function () { return { kind: "route-point", routeId: "route.main", routeDistance: -1 }; }],
    ["route-point fractional distance", function () { return { kind: "route-point", routeId: "route.main", routeDistance: 1.5 }; }],
    ["route-point string distance", function () { return { kind: "route-point", routeId: "route.main", routeDistance: "1" }; }],
    ["route-point missing distance", function () { return { kind: "route-point", routeId: "route.main" }; }],
    ["route-point extra field", function () { return { kind: "route-point", routeId: "route.main", routeDistance: 1, extra: 1 }; }],
    ["tower", function () { return { kind: "tower", towerRuntimeId: 7 }; }],
    ["tower zero", function () { return { kind: "tower", towerRuntimeId: 0 }; }],
    ["tower negative-zero", function () { return { kind: "tower", towerRuntimeId: -0 }; }],
    ["tower unsafe", function () { return { kind: "tower", towerRuntimeId: Number.MAX_SAFE_INTEGER + 1 }; }],
    ["tower with route fields", function () { return { kind: "tower", towerRuntimeId: 7, routeId: "route.main" }; }],
    ["world-vector", function () { return { kind: "world-vector", originX: 10, originY: 20, aimX: 30, aimY: 40 }; }],
    ["world-vector negative", function () { return { kind: "world-vector", originX: -10, originY: -20, aimX: -30, aimY: -40 }; }],
    ["world-vector negative-zero", function () { return { kind: "world-vector", originX: -0, originY: 0, aimX: -0, aimY: 0 }; }],
    ["world-vector zero length", function () { return { kind: "world-vector", originX: 5, originY: 5, aimX: 5, aimY: 5 }; }],
    ["world-vector NaN", function () { return { kind: "world-vector", originX: NaN, originY: 0, aimX: 0, aimY: 0 }; }],
    ["world-vector Infinity", function () { return { kind: "world-vector", originX: 0, originY: Infinity, aimX: 0, aimY: 0 }; }],
    ["world-vector fractional", function () { return { kind: "world-vector", originX: 0, originY: 0, aimX: 0.5, aimY: 0 }; }],
    ["world-vector missing aimY", function () { return { kind: "world-vector", originX: 0, originY: 0, aimX: 0 }; }],
    ["world-vector nested", function () { return { kind: "world-vector", origin: { x: 0, y: 0 }, aim: { x: 1, y: 1 } }; }],
    ["unknown kind", function () { return { kind: "unit" }; }],
    ["numeric kind", function () { return { kind: 1 }; }],
    ["missing kind", function () { return {}; }],
    ["none with extra field", function () { return { kind: "none", routeId: "route.main" }; }],
    ["null-prototype none", function () { const value = Object.create(null); value.kind = "none"; return value; }],
  ];
}

function outcome(run) {
  try {
    return { accepted: true, value: run() };
  } catch (error) {
    return { accepted: false, name: error.name };
  }
}

test("timeline Protocol target syntax matches CommandsV2.normalizeTarget accept/reject and normalized records", () => {
  targetCorpus().forEach(function (entry) {
    const label = entry[0];
    const build = entry[1];
    const commands = outcome(function () { return CommandsV2.normalizeTarget(build()); });
    const timeline = outcome(function () {
      return EffectTimeline.createTimeline(fixture(function (input) { input.events[2].target = build(); }));
    });
    assert.equal(timeline.accepted, commands.accepted, "accept/reject parity for " + label);
    if (!commands.accepted) {
      assert.equal(timeline.name, commands.name, "error class parity for " + label);
      return;
    }
    const projected = timeline.value.history[1].target;
    assert.deepEqual(projected, commands.value, "normalized record parity for " + label);
    Object.keys(commands.value).forEach(function (field) {
      assert.equal(Object.is(projected[field], commands.value[field]), true,
        "field " + field + " must be identical (including signed zero) for " + label);
    });
    assert.deepEqual(timeline.value.fullMotion.cues[2].target, commands.value, "active cue parity for " + label);
  });
  const accepted = targetCorpus().filter(function (entry) {
    return outcome(function () { return CommandsV2.normalizeTarget(entry[1]()); }).accepted;
  });
  assert.equal(accepted.length, 11, "corpus keeps a meaningful accepted subset");
});

test("timeline normalizes negative zero in Protocol targets exactly like CommandsV2", () => {
  const model = EffectTimeline.createTimeline(fixture(function (input) {
    input.events[2].target = { kind: "world-vector", originX: -0, originY: 0, aimX: -0, aimY: -0 };
    input.events[1].target = { kind: "route-point", routeId: "route.main", routeDistance: -0 };
  }));
  assert.equal(Object.is(model.history[1].target.originX, 0), true);
  assert.equal(Object.is(model.history[1].target.aimX, 0), true);
  assert.equal(Object.is(model.history[1].target.aimY, 0), true);
  assert.equal(Object.is(model.history[0].target.routeDistance, 0), true);
  assert.deepEqual(model.history[0].target, CommandsV2.normalizeTarget({
    kind: "route-point", routeId: "route.main", routeDistance: -0,
  }));
});

test("timeline keeps the mechanism-cue activation target outside the CommandsV2 Protocol union", () => {
  assert.deepEqual(Array.from(EffectTimeline.TARGET_KINDS), Array.from(CommandsV2.TARGET_KINDS).concat(["activation"]));
  assert.throws(function () {
    CommandsV2.normalizeTarget({ kind: "activation", activationId: "bridge.m17" });
  }, /Unsupported Protocol target kind/i);
  const model = EffectTimeline.createTimeline(fixture(function (input) {
    input.events[2].target = { kind: "activation", activationId: "bridge.m17" };
  }));
  assert.deepEqual(model.history[1].target, { kind: "activation", activationId: "bridge.m17" });
  assert.throws(function () {
    EffectTimeline.createTimeline(fixture(function (input) {
      input.events[2].target = { kind: "activation", activationId: "bridge.m17", routeId: "route.main" };
    }));
  }, /unknown field routeId/i);
  assert.throws(function () {
    EffectTimeline.createTimeline(fixture(function (input) {
      input.events[2].target = { kind: "activation", activationId: "" };
    }));
  }, /activationId/i);
});

test("timeline fails closed on unknown cues, duplicate keys, future events, invalid pending bounds, and extra fields", () => {
  assert.throws(function () {
    EffectTimeline.createTimeline(fixture(function (input) { input.events[0].cueId = "missing.cue"; }));
  }, /unknown cue/i);

  assert.throws(function () {
    EffectTimeline.createTimeline(fixture(function (input) {
      input.events[1] = JSON.parse(JSON.stringify(input.events[2]));
    }));
  }, /duplicate cue key/i);

  assert.throws(function () {
    EffectTimeline.createTimeline(fixture(function (input) { input.events[0].tick = 121; }));
  }, /future semantic event/i);

  assert.throws(function () {
    EffectTimeline.createTimeline(fixture(function (input) { input.pending[0].resolveTick = 99; }));
  }, /pending cue tick order/i);

  assert.throws(function () {
    EffectTimeline.createTimeline(fixture(function (input) { input.wallClockMs = 10; }));
  }, /unknown field wallClockMs/i);

  assert.throws(function () {
    EffectTimeline.createTimeline(fixture(function (input) {
      input.events = new Array(EffectTimeline.MAX_EVENT_INPUT + 1).fill(input.events[0]);
    }));
  }, /bound/i);
});
