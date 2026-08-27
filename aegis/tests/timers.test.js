"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const TIMERS_PATH = path.join(__dirname, "..", "js", "sim", "timers.js");
const Timers = require(TIMERS_PATH);

function cooldownGolden(milliseconds, finalTick) {
  const baseCooldownUnits = ABI.authoredMillisecondsToTimeUnits(milliseconds);
  let state = Timers.createCooldownState();
  const attacks = [];
  for (let tick = 0; tick <= finalTick; tick++) {
    const transition = Timers.advanceCooldownAttackPhase(state, true, baseCooldownUnits, 0);
    state = transition.state;
    if (transition.attacked) attacks.push([tick, state.remainingUnits]);
  }
  return attacks;
}

test("timing identity is frozen, canonical, and uses exact authored milliseconds", () => {
  assert.deepEqual(Timers.TIMING, {
    ticksPerSecond: 60,
    timeUnitsPerSecond: 60000,
    timeUnitsPerTick: 1000,
  });
  assert.equal(Object.isFrozen(Timers.TIMING), true);
  assert.equal(Timers.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assert.equal(Timers.authoredMillisecondsToTimeUnits(410), 24600);
  assert.equal(Timers.authoredMillisecondsToTimeUnits(1350), 81000);
  assert.doesNotThrow(() => ABI.canonicalEncode(Timers.TIMING));
});

test("410 ms cooldown carries sub-tick overshoot through a long golden cadence", () => {
  assert.deepEqual(cooldownGolden(410, 246), [
    [0, 24600],
    [25, 24200],
    [50, 23800],
    [74, 24400],
    [99, 24000],
    [123, 24600],
    [148, 24200],
    [173, 23800],
    [197, 24400],
    [222, 24000],
    [246, 24600],
  ]);
});

test("1350 ms cooldown remains exact over whole-tick boundaries", () => {
  assert.deepEqual(cooldownGolden(1350, 243), [
    [0, 81000],
    [81, 81000],
    [162, 81000],
    [243, 81000],
  ]);
});

test("idle towers clamp ready cooldown and reacquire next phase without active rescaling", () => {
  const base = ABI.authoredMillisecondsToTimeUnits(410);
  const idle = Timers.advanceCooldownAttackPhase(Timers.createCooldownState(), false, base, 0);
  assert.deepEqual(idle, {
    attacked: false,
    scheduledUnits: null,
    state: { remainingUnits: 0 },
  });

  const acquired = Timers.advanceCooldownAttackPhase(idle.state, true, base, 0);
  assert.equal(acquired.attacked, true);
  assert.equal(acquired.scheduledUnits, 24600);
  assert.equal(acquired.state.remainingUnits, 24600);

  let state = acquired.state;
  const fasterRateBp = 1500;
  for (let tick = 1; tick < 25; tick++) {
    const transition = Timers.advanceCooldownAttackPhase(state, true, base, fasterRateBp);
    assert.equal(transition.attacked, false);
    assert.equal(transition.scheduledUnits, null);
    state = transition.state;
  }
  assert.equal(state.remainingUnits, 600);

  const due = Timers.advanceCooldownAttackPhase(state, true, base, fasterRateBp);
  assert.equal(due.attacked, true);
  assert.equal(due.scheduledUnits, 21392);
  assert.equal(due.state.remainingUnits, 20992);
});

test("repeating spawn timers preserve overshoot and enforce the authored event cap", () => {
  let state = Timers.createRepeatingTimerState(500);
  const vector = [];
  for (let tick = 0; tick < 8; tick++) {
    const transition = Timers.advanceRepeatingTimerPhase(state, 2400, 3);
    state = transition.state;
    vector.push([transition.eventsFired, state.remainingUnits]);
  }
  assert.deepEqual(vector, [
    [1, 1900], [0, 900], [1, 2300], [0, 1300],
    [0, 300], [1, 1700], [0, 700], [1, 2100],
  ]);

  let capped = Timers.createRepeatingTimerState(0);
  const cappedVector = [];
  for (let tick = 0; tick < 3; tick++) {
    const transition = Timers.advanceRepeatingTimerPhase(capped, 400, 2);
    capped = transition.state;
    cappedVector.push([transition.eventsFired, capped.remainingUnits]);
  }
  assert.deepEqual(cappedVector, [[2, -200], [2, -400], [2, -600]]);

  const uncappedDebt = Timers.advanceRepeatingTimerPhase(
    Timers.createRepeatingTimerState(0),
    400,
    3
  );
  assert.deepEqual(uncappedDebt, { eventsFired: 3, state: { remainingUnits: 200 } });
});

test("status expiry happens after commands and before attacks, and reapply waits until next tick", () => {
  let status = Timers.applyStatusAfterExpiryPhase(1500, 0);
  assert.deepEqual(status, { lastExpiryTick: 0, remainingUnits: 1500 });

  const tickOneExpiry = Timers.advanceStatusExpiryPhase(status, 1);
  assert.equal(tickOneExpiry.active, true);
  assert.equal(tickOneExpiry.expired, false);
  status = tickOneExpiry.state;
  assert.equal(status.remainingUnits, 500);

  // Tick-two commands run before expiry, so they still observe the status.
  assert.notEqual(status, null);
  const tickTwoExpiry = Timers.advanceStatusExpiryPhase(status, 2);
  assert.deepEqual(tickTwoExpiry, { active: false, expired: true, state: null });
  // Tick-two acquisition/attacks run after expiry, so they no longer observe it.
  assert.equal(tickTwoExpiry.state, null);

  // An accepted tick-two attack reapplication occurs after expiry and starts decrementing at tick three.
  status = Timers.applyStatusAfterExpiryPhase(1500, 2);
  const tickThreeExpiry = Timers.advanceStatusExpiryPhase(status, 3);
  assert.equal(tickThreeExpiry.state.remainingUnits, 500);
  assert.deepEqual(Timers.advanceStatusExpiryPhase(tickThreeExpiry.state, 4), {
    active: false,
    expired: true,
    state: null,
  });
});

test("timer transitions reject malformed, out-of-phase, below-minimum, and overflowing inputs", () => {
  const ready = Timers.createCooldownState();
  assert.throws(() => Timers.advanceCooldownAttackPhase(ready, 1, 24600, 0), /boolean/i);
  assert.throws(() => Timers.advanceCooldownAttackPhase({ remainingUnits: -1 }, true, 24600, 0), /nonnegative/i);
  assert.throws(() => Timers.advanceCooldownAttackPhase({ remainingUnits: 0, extra: 1 }, true, 24600, 0), /exactly/i);
  assert.throws(() => Timers.advanceCooldownAttackPhase(ready, true, 1000, 1500), /at least one tick/i);
  assert.throws(() => Timers.advanceCooldownAttackPhase(ready, true, 24600, 1501), /cap/i);

  assert.throws(() => Timers.createRepeatingTimerState(-1), /nonnegative/i);
  assert.throws(() => Timers.advanceRepeatingTimerPhase({ remainingUnits: 0 }, 0, 1), /positive/i);
  assert.throws(() => Timers.advanceRepeatingTimerPhase({ remainingUnits: 0 }, 1, 0), /positive/i);
  assert.throws(
    () => Timers.advanceRepeatingTimerPhase({ remainingUnits: Number.MIN_SAFE_INTEGER }, 1, 1),
    /safe integer range/i
  );

  const status = Timers.applyStatusAfterExpiryPhase(1000, 10);
  assert.throws(() => Timers.advanceStatusExpiryPhase(status, 10), /next tick/i);
  assert.throws(() => Timers.advanceStatusExpiryPhase(status, 12), /next tick/i);
  assert.throws(() => Timers.applyStatusAfterExpiryPhase(1000, Number.MAX_SAFE_INTEGER), /safe integer range/i);
  assert.throws(() => Timers.applyStatusAfterExpiryPhase(0, 0), /positive/i);
});

test("all timer state is immutable canonical data and inputs are never mutated", () => {
  const input = { remainingUnits: 500 };
  const transition = Timers.advanceRepeatingTimerPhase(input, 2400, 2);
  assert.deepEqual(input, { remainingUnits: 500 });
  assert.equal(Object.isFrozen(transition), true);
  assert.equal(Object.isFrozen(transition.state), true);
  assert.doesNotThrow(() => ABI.canonicalEncode(transition));

  const cooldown = Timers.advanceCooldownAttackPhase(Timers.createCooldownState(), true, 24600, 0);
  assert.equal(Object.isFrozen(cooldown), true);
  assert.equal(Object.isFrozen(cooldown.state), true);
  assert.doesNotThrow(() => ABI.canonicalEncode(cooldown));

  const status = Timers.applyStatusAfterExpiryPhase(1500, 0);
  assert.equal(Object.isFrozen(status), true);
  assert.doesNotThrow(() => ABI.canonicalEncode(status));
});

test("classic script consumes only frozen Game.AegisSim and needs no kit, DOM, or network", () => {
  const abiSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8");
  const timersSource = fs.readFileSync(TIMERS_PATH, "utf8");
  const context = vm.createContext({});
  vm.runInContext(abiSource, context, { filename: "abi.js" });
  const injectedAbi = context.Game.AegisSim;
  vm.runInContext(timersSource, context, { filename: "timers.js" });

  assert.equal(context.Game.AegisSim, injectedAbi);
  assert.equal(Object.isFrozen(context.Game.AegisTimers), true);
  assert.equal(context.Game.AegisTimers.ABI_DESCRIPTOR_SHA256, injectedAbi.DESCRIPTOR_SHA256);
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.require, undefined);

  assert.throws(
    () => vm.runInContext(timersSource, vm.createContext({ Game: {} })),
    /AegisSim/i
  );
});
