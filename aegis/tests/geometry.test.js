"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const GEOMETRY_PATH = path.join(__dirname, "..", "js", "sim", "geometry.js");
const Geometry = require(GEOMETRY_PATH);

function routeSource() {
  return {
    id: "route.test",
    length: 15000,
    segments: [
      {
        id: "route.test:s000", index: 0, start: 0, length: 5000,
        fromX: -2000, fromY: 0, toX: 3000, toY: 0, deltaX: 5000, deltaY: 0,
      },
      {
        id: "route.test:s001", index: 1, start: 5000, length: 5000,
        fromX: 3000, fromY: 0, toX: 0, toY: 4000, deltaX: -3000, deltaY: 4000,
      },
      {
        id: "route.test:s002", index: 2, start: 10000, length: 5000,
        fromX: 0, fromY: 4000, toX: 0, toY: -1000, deltaX: 0, deltaY: -5000,
      },
    ],
  };
}

test("compiled route validation returns a deeply frozen canonical-safe copy", () => {
  const source = routeSource();
  const route = Geometry.freezeCompiledRoute(source);
  assert.notEqual(route, source);
  assert.deepEqual(route, source);
  assert.equal(Object.isFrozen(route), true);
  assert.equal(Object.isFrozen(route.segments), true);
  assert.equal(route.segments.every(Object.isFrozen), true);
  assert.doesNotThrow(() => ABI.canonicalEncode(route));
  source.segments[0].toX = 999999;
  assert.equal(route.segments[0].toX, 3000);
  assert.equal(Geometry.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
});

test("route positions cover horizontal, signed negative, and 3-4-5 diagonal interpolation", () => {
  const route = Geometry.freezeCompiledRoute(routeSource());
  assert.deepEqual(Geometry.positionOnRoute(route, 2500), {
    routeId: "route.test", segmentId: "route.test:s000", segmentIndex: 0,
    distance: 2500, remainingDistance: 12500, x: 500, y: 0,
  });
  assert.deepEqual(Geometry.positionOnRoute(route, 7500), {
    routeId: "route.test", segmentId: "route.test:s001", segmentIndex: 1,
    distance: 7500, remainingDistance: 7500, x: 1500, y: 2000,
  });
  assert.deepEqual(Geometry.positionOnRoute(route, 12500), {
    routeId: "route.test", segmentId: "route.test:s002", segmentIndex: 2,
    distance: 12500, remainingDistance: 2500, x: 0, y: 1500,
  });

  const oneUnit = Geometry.positionOnRoute(route, 5001);
  assert.equal(oneUnit.x, 3000, "negative 3/5 interpolation truncates toward zero");
  assert.equal(oneUnit.y, 0, "positive 4/5 interpolation floors to zero");
});

test("exact waypoints belong to the incoming segment while before and after select deterministically", () => {
  const route = Geometry.freezeCompiledRoute(routeSource());
  assert.deepEqual(
    [Geometry.positionOnRoute(route, 4999).segmentIndex, Geometry.positionOnRoute(route, 5000).segmentIndex,
      Geometry.positionOnRoute(route, 5001).segmentIndex],
    [0, 0, 1]
  );
  assert.deepEqual(Geometry.positionOnRoute(route, 5000), {
    routeId: "route.test", segmentId: "route.test:s000", segmentIndex: 0,
    distance: 5000, remainingDistance: 10000, x: 3000, y: 0,
  });
  assert.deepEqual(
    [Geometry.positionOnRoute(route, 9999).segmentIndex, Geometry.positionOnRoute(route, 10000).segmentIndex,
      Geometry.positionOnRoute(route, 10001).segmentIndex],
    [1, 1, 2]
  );
});

test("route positions clamp both ends and always use first/start and last/final segments", () => {
  const route = Geometry.freezeCompiledRoute(routeSource());
  assert.deepEqual(Geometry.positionOnRoute(route, -500), {
    routeId: "route.test", segmentId: "route.test:s000", segmentIndex: 0,
    distance: 0, remainingDistance: 15000, x: -2000, y: 0,
  });
  assert.deepEqual(Geometry.positionOnRoute(route, 999999), {
    routeId: "route.test", segmentId: "route.test:s002", segmentIndex: 2,
    distance: 15000, remainingDistance: 0, x: 0, y: -1000,
  });
  assert.throws(() => Geometry.positionOnRoute(route, 1.5), /safe integer/i);
});

test("malformed, discontinuous, unstable, and overflowing compiled routes fail closed", () => {
  const cases = [];
  const empty = routeSource(); empty.segments = []; cases.push(empty);
  const zero = routeSource(); zero.segments[0].length = 0; cases.push(zero);
  const gap = routeSource(); gap.segments[1].start = 5001; cases.push(gap);
  const disconnected = routeSource(); disconnected.segments[1].fromX = 3001; cases.push(disconnected);
  const badDelta = routeSource(); badDelta.segments[1].deltaX = -2999; cases.push(badDelta);
  const badLength = routeSource();
  badLength.segments[1].length = 6000;
  badLength.segments[2].start = 11000;
  badLength.length = 16000;
  cases.push(badLength);
  const duplicateId = routeSource(); duplicateId.segments[1].id = duplicateId.segments[0].id; cases.push(duplicateId);
  const wrongIndex = routeSource(); wrongIndex.segments[1].index = 9; cases.push(wrongIndex);
  const wrongTotal = routeSource(); wrongTotal.length = 14999; cases.push(wrongTotal);
  const unstableId = routeSource(); unstableId.id = "route bad"; cases.push(unstableId);
  const floatValue = routeSource(); floatValue.segments[0].toX = 3000.5; cases.push(floatValue);
  const unknownKey = routeSource(); unknownKey.extra = 1; cases.push(unknownKey);
  const overflow = routeSource(); overflow.segments[2].start = Number.MAX_SAFE_INTEGER; cases.push(overflow);

  for (const candidate of cases) {
    assert.throws(() => Geometry.freezeCompiledRoute(candidate), Error, JSON.stringify(candidate).slice(0, 80));
  }
});

test("squared range eligibility is inclusive at tangency and exact one unit inside/outside", () => {
  assert.equal(Geometry.isWithinSquaredRange(0, 0, 3000, 4000, 5000), true);
  assert.equal(Geometry.isWithinSquaredRange(0, 0, 2999, 4000, 5000), true);
  assert.equal(Geometry.isWithinSquaredRange(0, 0, 3001, 4000, 5000), false);
  assert.equal(Geometry.isWithinSquaredRange(-1000, -1000, -4000, -5000, 5000), true);
  assert.throws(
    () => Geometry.isWithinSquaredRange(Number.MIN_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER, 0, 1),
    /safe integer/i
  );
  assert.throws(() => Geometry.isWithinSquaredRange(0, 0, 1, 1, Number.MAX_SAFE_INTEGER), /safe integer/i);
});

test("target comparator uses remaining distance, then higher threat, then lower runtime id", () => {
  const shortRoute = Geometry.freezeCompiledRoute({
    id: "route.short", length: 10000,
    segments: [{
      id: "route.short:s000", index: 0, start: 0, length: 10000,
      fromX: 0, fromY: 0, toX: 10000, toY: 0, deltaX: 10000, deltaY: 0,
    }],
  });
  const longRoute = Geometry.freezeCompiledRoute({
    id: "route.long", length: 30000,
    segments: [{
      id: "route.long:s000", index: 0, start: 0, length: 30000,
      fromX: 0, fromY: 1000, toX: 30000, toY: 1000, deltaX: 30000, deltaY: 0,
    }],
  });
  const shortPosition = Geometry.positionOnRoute(shortRoute, 8000);
  const longPosition = Geometry.positionOnRoute(longRoute, 29000);
  const shortEnemy = { remainingDistance: shortPosition.remainingDistance, threatPriority: 99, id: 1 };
  const longEnemy = { remainingDistance: longPosition.remainingDistance, threatPriority: 1, id: 50 };
  assert.equal(Geometry.compareTargetPriority(longEnemy, shortEnemy), -1);
  assert.equal(Geometry.compareTargetPriority(shortEnemy, longEnemy), 1);

  assert.equal(
    Geometry.compareTargetPriority(
      { remainingDistance: 1000, threatPriority: 8, id: 20 },
      { remainingDistance: 1000, threatPriority: 7, id: 1 }
    ),
    -1
  );
  assert.equal(
    Geometry.compareTargetPriority(
      { remainingDistance: 1000, threatPriority: 8, id: 2 },
      { remainingDistance: 1000, threatPriority: 8, id: 3 }
    ),
    -1
  );
  assert.equal(
    Geometry.compareTargetPriority(
      { remainingDistance: 1000, threatPriority: 8, id: 2 },
      { remainingDistance: 1000, threatPriority: 8, id: 2 }
    ),
    0
  );
});

test("classic script consumes only injected frozen Game.AegisSim and performs no projection math", () => {
  const abiSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8");
  const geometrySource = fs.readFileSync(GEOMETRY_PATH, "utf8");
  assert.doesNotMatch(geometrySource, /Math\.(?:sqrt|hypot)\b/);

  const context = vm.createContext({});
  vm.runInContext(abiSource, context, { filename: "abi.js" });
  const injectedAbi = context.Game.AegisSim;
  vm.runInContext(geometrySource, context, { filename: "geometry.js" });
  assert.equal(context.Game.AegisSim, injectedAbi);
  assert.ok(context.Game.AegisGeometry);
  assert.equal(Object.isFrozen(context.Game.AegisGeometry), true);
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.require, undefined);
  assert.equal(context.Game.AegisGeometry.ABI_DESCRIPTOR_SHA256, context.Game.AegisSim.DESCRIPTOR_SHA256);

  const missingAbi = vm.createContext({ Game: {} });
  assert.throws(() => vm.runInContext(geometrySource, missingAbi), /AegisSim/i);
});
