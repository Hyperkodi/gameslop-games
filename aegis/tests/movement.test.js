"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const Geometry = require("../js/sim/geometry.js");
const MOVEMENT_PATH = path.join(__dirname, "..", "js", "sim", "movement.js");
const Movement = require(MOVEMENT_PATH);

function compiledRoute() {
  return Geometry.freezeCompiledRoute({
    id: "route.movement",
    length: 15000,
    segments: [
      {
        id: "route.movement:s000", index: 0, start: 0, length: 5000,
        fromX: 0, fromY: 0, toX: 5000, toY: 0, deltaX: 5000, deltaY: 0,
      },
      {
        id: "route.movement:s001", index: 1, start: 5000, length: 5000,
        fromX: 5000, fromY: 0, toX: 8000, toY: 4000, deltaX: 3000, deltaY: 4000,
      },
      {
        id: "route.movement:s002", index: 2, start: 10000, length: 5000,
        fromX: 8000, fromY: 4000, toX: 8000, toY: -1000, deltaX: 0, deltaY: -5000,
      },
    ],
  });
}

test("non-divisible movement carries one exact remainder through a long golden vector", () => {
  assert.equal(Movement.MOVEMENT_DIVISOR, 600000);
  assert.equal(Movement.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  let state = Movement.createMovementState();
  let total = 0;
  const selected = [];
  for (let tick = 1; tick <= 120; tick++) {
    const transition = Movement.advanceMovementTick(state, 123457, 8765);
    state = transition.state;
    total += transition.advance;
    if (tick <= 10 || tick % 30 === 0) {
      selected.push([tick, transition.advance, state.remainder, total]);
    }
  }
  assert.deepEqual(selected, [
    [1, 1803, 300605, 1803],
    [2, 1804, 1210, 3607],
    [3, 1803, 301815, 5410],
    [4, 1804, 2420, 7214],
    [5, 1803, 303025, 9017],
    [6, 1804, 3630, 10821],
    [7, 1803, 304235, 12624],
    [8, 1804, 4840, 14428],
    [9, 1803, 305445, 16231],
    [10, 1804, 6050, 18035],
    [30, 1804, 18150, 54105],
    [60, 1804, 36300, 108210],
    [90, 1804, 54450, 162315],
    [120, 1804, 72600, 216420],
  ]);
});

test("speed changes, zero speed, and minimum speed preserve rather than reset carry", () => {
  const first = Movement.advanceMovementTick(Movement.createMovementState(), 137000, 10000);
  assert.deepEqual(first, {
    advance: 2283,
    numerator: 1370000000,
    state: { remainder: 200000 },
  });
  const changed = Movement.advanceMovementTick(first.state, 61000, 10000);
  assert.deepEqual(changed, {
    advance: 1017,
    numerator: 610200000,
    state: { remainder: 0 },
  });

  const carried = Movement.advanceMovementTick({ remainder: 234567 }, 0, 0);
  assert.deepEqual(carried, {
    advance: 0,
    numerator: 234567,
    state: { remainder: 234567 },
  });
  assert.deepEqual(Movement.advanceMovementTick(Movement.createMovementState(), 1, 1), {
    advance: 0,
    numerator: 1,
    state: { remainder: 1 },
  });
  const minimum = ABI.resolveStrongestSlowBp(10000, 10000, 2500);
  assert.deepEqual(Movement.advanceMovementTick(Movement.createMovementState(), 60000, minimum.effectiveSpeedBp), {
    advance: 250,
    numerator: 150000000,
    state: { remainder: 0 },
  });
});

test("route progress clamps at corners and path end without overshoot", () => {
  const route = compiledRoute();
  const corner = Movement.advanceRouteProgress(route.length, 4999, 1);
  assert.deepEqual(corner, {
    appliedAdvance: 1,
    distance: 5000,
    reachedEnd: false,
    remainingDistance: 10000,
  });
  assert.equal(Geometry.positionOnRoute(route, corner.distance).segmentIndex, 0);
  assert.equal(Geometry.positionOnRoute(route, corner.distance + 1).segmentIndex, 1);

  const nearEnd = Movement.advanceRouteProgress(route.length, 14900, 1000);
  assert.deepEqual(nearEnd, {
    appliedAdvance: 100,
    distance: 15000,
    reachedEnd: true,
    remainingDistance: 0,
  });
  assert.deepEqual(Geometry.positionOnRoute(route, nearEnd.distance), {
    routeId: "route.movement", segmentId: "route.movement:s002", segmentIndex: 2,
    distance: 15000, remainingDistance: 0, x: 8000, y: -1000,
  });
  assert.deepEqual(Movement.advanceRouteProgress(route.length, route.length, Number.MAX_SAFE_INTEGER), {
    appliedAdvance: 0,
    distance: 15000,
    reachedEnd: true,
    remainingDistance: 0,
  });
});

test("movement and route progress reject malformed and overflowing integer state", () => {
  assert.throws(() => Movement.advanceMovementTick({ remainder: -1 }, 1, 1), /nonnegative/i);
  assert.throws(() => Movement.advanceMovementTick({ remainder: 600000 }, 1, 1), /less than/i);
  assert.throws(() => Movement.advanceMovementTick({ remainder: 0, extra: 1 }, 1, 1), /exactly/i);
  assert.throws(() => Movement.advanceMovementTick(Movement.createMovementState(), -1, 1), /nonnegative/i);
  assert.throws(() => Movement.advanceMovementTick(Movement.createMovementState(), 1, 10001), /basis points/i);
  assert.throws(
    () => Movement.advanceMovementTick(Movement.createMovementState(), Number.MAX_SAFE_INTEGER, 10000),
    /safe integer range/i
  );
  assert.throws(() => Movement.advanceRouteProgress(0, 0, 0), /positive/i);
  assert.throws(() => Movement.advanceRouteProgress(100, 101, 0), /route length/i);
  assert.throws(() => Movement.advanceRouteProgress(100, 0, -1), /nonnegative/i);
});

test("named RNG streams are stable, distinct, and step only explicit uint32 state", () => {
  const first = Movement.createNamedRngStream(123456789, "waves.m01");
  const second = Movement.createNamedRngStream(123456789, "waves.m02");
  assert.deepEqual(first, { state: 3933053832, streamId: "waves.m01" });
  assert.deepEqual(second, { state: 3983386689, streamId: "waves.m02" });
  assert.notEqual(first.state, second.state);

  let stream = first;
  const values = [];
  for (let index = 0; index < 5; index++) {
    const step = Movement.stepNamedRngStream(stream);
    stream = step.state;
    values.push(step.uint32);
  }
  assert.deepEqual(values, [2090635033, 3039578700, 734104489, 125435705, 982032467]);
  assert.deepEqual(stream, { state: 205981009, streamId: "waves.m01" });
});

test("Fisher-Yates runs only for an explicit true group flag and false consumes no draw", () => {
  const original = ["a", "b", "c", "d", "e", "f"];
  const stream = Movement.createNamedRngStream(42, "group.test");
  const untouched = Movement.shuffleWithinGroup(original, false, stream);
  assert.deepEqual(untouched, {
    draws: 0,
    items: original,
    state: stream,
  });
  assert.notEqual(untouched.items, original);
  assert.deepEqual(
    Movement.stepNamedRngStream(untouched.state),
    Movement.stepNamedRngStream(stream)
  );

  const shuffled = Movement.shuffleWithinGroup(original, true, stream);
  assert.deepEqual(shuffled, {
    draws: 5,
    items: ["a", "f", "d", "b", "c", "e"],
    state: { state: 632269859, streamId: "group.test" },
  });
  assert.deepEqual(original, ["a", "b", "c", "d", "e", "f"]);
  assert.throws(() => Movement.shuffleWithinGroup(original, 1, stream), /boolean/i);
});

test("RNG and runtime-ID helpers reject malformed identities, counters, and overflow", () => {
  assert.throws(() => Movement.createNamedRngStream(-1, "stream"), /unsigned/i);
  assert.throws(() => Movement.createNamedRngStream(1, "bad\0stream"), /NUL/i);
  assert.throws(() => Movement.createNamedRngStream(1, "non-ascii-\u03c0"), /ASCII/i);
  assert.throws(
    () => Movement.stepNamedRngStream({ state: 4294967296, streamId: "stream" }),
    /unsigned 32-bit/i
  );
  assert.throws(
    () => Movement.stepNamedRngStream({ extra: 1, state: 1, streamId: "stream" }),
    /exactly/i
  );
  assert.throws(() => Movement.shuffleWithinGroup("abc", true,
    Movement.createNamedRngStream(1, "stream")), /array/i);

  const maxState = {
    nextByDomain: { tower: 1, enemy: Number.MAX_SAFE_INTEGER, summon: 1, projectile: 1, effect: 1 },
  };
  assert.equal(Movement.allocateRuntimeId(maxState, "enemy", false).runtimeId, null);
  assert.throws(() => Movement.allocateRuntimeId(maxState, "enemy", true), /safe integer range/i);
  assert.throws(() => Movement.allocateRuntimeId(Movement.createRuntimeIdState(), "unknown", true), /unknown/i);
  assert.throws(() => Movement.allocateRuntimeId(Movement.createRuntimeIdState(), "enemy", 1), /boolean/i);
  assert.throws(() => Movement.allocateRuntimeIdBatch(Movement.createRuntimeIdState(), [
    { accepted: true, authoredIndex: -1, domain: "enemy", sourceId: 1 },
  ]), /nonnegative/i);
  assert.throws(() => Movement.allocateRuntimeIdBatch(Movement.createRuntimeIdState(), [
    { accepted: true, authoredIndex: 0, domain: "enemy", sourceId: 0 },
  ]), /positive/i);
});

test("runtime IDs allocate only accepted creations and remain independent by frozen domain", () => {
  assert.deepEqual(Movement.RUNTIME_ID_DOMAINS, ["tower", "enemy", "summon", "projectile", "effect"]);
  assert.equal(Object.isFrozen(Movement.RUNTIME_ID_DOMAINS), true);
  let state = Movement.createRuntimeIdState();
  const enemyOne = Movement.allocateRuntimeId(state, "enemy", true);
  assert.equal(enemyOne.runtimeId, 1);
  state = enemyOne.state;

  const denied = Movement.allocateRuntimeId(state, "enemy", false);
  assert.equal(denied.runtimeId, null);
  assert.deepEqual(denied.state, state);
  state = Movement.preserveRuntimeIdsOnPlanReset(denied.state);

  const towerOne = Movement.allocateRuntimeId(state, "tower", true);
  assert.equal(towerOne.runtimeId, 1);
  const enemyTwo = Movement.allocateRuntimeId(towerOne.state, "enemy", true);
  assert.equal(enemyTwo.runtimeId, 2);
  assert.equal(enemyTwo.state.nextByDomain.tower, 2);
  assert.equal(enemyTwo.state.nextByDomain.enemy, 3);
  assert.equal(enemyTwo.state.nextByDomain.summon, 1);
});

test("batch IDs use runtime source ID then authored index and denied entries consume nothing", () => {
  const result = Movement.allocateRuntimeIdBatch(Movement.createRuntimeIdState(), [
    { accepted: true, authoredIndex: 1, domain: "enemy", sourceId: 2 },
    { accepted: true, authoredIndex: 2, domain: "enemy", sourceId: 1 },
    { accepted: false, authoredIndex: 0, domain: "enemy", sourceId: 1 },
    { accepted: true, authoredIndex: 1, domain: "summon", sourceId: 1 },
  ]);
  assert.deepEqual(result.allocations, [
    { accepted: false, authoredIndex: 0, domain: "enemy", runtimeId: null, sourceId: 1 },
    { accepted: true, authoredIndex: 1, domain: "summon", runtimeId: 1, sourceId: 1 },
    { accepted: true, authoredIndex: 2, domain: "enemy", runtimeId: 1, sourceId: 1 },
    { accepted: true, authoredIndex: 1, domain: "enemy", runtimeId: 2, sourceId: 2 },
  ]);
  assert.equal(result.state.nextByDomain.enemy, 3);
  assert.equal(result.state.nextByDomain.summon, 2);
  assert.throws(
    () => Movement.allocateRuntimeIdBatch(Movement.createRuntimeIdState(), [
      { accepted: true, authoredIndex: 0, domain: "enemy", sourceId: 1 },
      { accepted: true, authoredIndex: 0, domain: "summon", sourceId: 1 },
    ]),
    /duplicate/i
  );
});

test("movement, RNG, shuffle, and ID records are deeply frozen canonical state", () => {
  const shuffleInput = [{ id: "a", value: 1 }, { id: "b", value: 2 }];
  const shuffledObjects = Movement.shuffleWithinGroup(shuffleInput, true,
    Movement.createNamedRngStream(7, "shuffle.test"));
  const records = [
    Movement.advanceMovementTick(Movement.createMovementState(), 123457, 8765),
    Movement.advanceRouteProgress(10000, 500, 250),
    Movement.stepNamedRngStream(Movement.createNamedRngStream(7, "stream.test")),
    shuffledObjects,
    Movement.allocateRuntimeId(Movement.createRuntimeIdState(), "effect", true),
  ];
  for (const record of records) {
    assert.equal(Object.isFrozen(record), true);
    assert.doesNotThrow(() => ABI.canonicalEncode(record));
  }
  assert.equal(Object.isFrozen(records[0].state), true);
  assert.equal(Object.isFrozen(records[2].state), true);
  assert.equal(Object.isFrozen(records[3].items), true);
  assert.equal(Object.isFrozen(records[3].items[0]), true);
  assert.equal(Object.isFrozen(records[4].state.nextByDomain), true);
  assert.deepEqual(shuffleInput, [{ id: "a", value: 1 }, { id: "b", value: 2 }]);
  assert.equal(Object.isFrozen(shuffleInput), false);
  assert.equal(Object.isFrozen(shuffleInput[0]), false);
  assert.notEqual(shuffledObjects.items[0], shuffleInput[0]);
});

test("classic script consumes only frozen ABI and needs no geometry, kit, DOM, or network", () => {
  const abiSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8");
  const movementSource = fs.readFileSync(MOVEMENT_PATH, "utf8");
  const context = vm.createContext({});
  vm.runInContext(abiSource, context, { filename: "abi.js" });
  const injectedAbi = context.Game.AegisSim;
  vm.runInContext(movementSource, context, { filename: "movement.js" });

  assert.equal(context.Game.AegisSim, injectedAbi);
  assert.equal(Object.isFrozen(context.Game.AegisMovement), true);
  assert.equal(context.Game.AegisGeometry, undefined);
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.require, undefined);
  assert.throws(
    () => vm.runInContext(movementSource, vm.createContext({ Game: {} })),
    /AegisSim/i
  );
});
