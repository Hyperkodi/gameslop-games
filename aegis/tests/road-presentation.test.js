"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const RoadGeometry = require("../js/presentation/road-geometry.js");
const MapIr = require("../../../tools/lib/aegis/map-ir.js");

function segment(index, start, length, fromX, fromY, toX, toY) {
  return {
    id: "segment." + index,
    index: index,
    start: start,
    length: length,
    fromX: fromX,
    fromY: fromY,
    toX: toX,
    toY: toY,
    deltaX: toX - fromX,
    deltaY: toY - fromY,
  };
}

function reportFixture(overrides) {
  return Object.assign({
    schemaVersion: 2,
    missionId: "m04.synthetic",
    sourceKind: "campaign",
    policy: { roadWidthMilliUnits: 12000 },
    laneSegments: [],
    routes: [],
    joins: [],
    crossings: [],
  }, overrides || {});
}

function reportLane(id, layerId, routeIds, subsegments) {
  const last = subsegments[subsegments.length - 1];
  return {
    id: id,
    kind: "ground",
    layerId: layerId,
    lengthMilliUnits: last.start + last.length,
    routeIds: routeIds,
    subsegments: subsegments,
  };
}

test("CommonJS and browser UMD expose one frozen road geometry API", function () {
  assert.equal(typeof RoadGeometry.createRoadRenderPieces, "function");
  assert.ok(Object.isFrozen(RoadGeometry));
  assert.ok(Object.isFrozen(RoadGeometry.WIDTHS));

  const source = fs.readFileSync(path.join(__dirname, "../js/presentation/road-geometry.js"), "utf8");
  const sandbox = { Game: {} };
  vm.runInNewContext(source, sandbox, { filename: "road-geometry.js" });
  assert.equal(typeof sandbox.Game.AegisRoadGeometry.createRoadRenderPieces, "function");
  assert.ok(Object.isFrozen(sandbox.Game.AegisRoadGeometry));
});

test("M01 keeps the compiler-authored physical centerline and fixed width hierarchy", function () {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, "../content/maps/m01.json"), "utf8"));
  const ir = MapIr.normalizeMap(source);
  const before = JSON.stringify(ir);
  const result = RoadGeometry.createRoadRenderPieces(ir);

  assert.equal(result.widths.coreMilliUnits, 8000);
  assert.equal(result.widths.shoulderPerSideMilliUnits, 2000);
  assert.equal(result.widths.shoulderedMilliUnits, 12000);
  assert.equal(result.widths.ambientOcclusionMilliUnits, 14000);
  assert.equal(result.widths.maxAmbientOcclusionMilliUnits, 14000);
  assert.equal(result.lanePieces.length, 1);
  assert.deepEqual(result.lanePieces[0].centerlineMilliUnits, [
    { x: -6000, y: 22000 },
    { x: 46000, y: 22000 },
    { x: 46000, y: 74000 },
    { x: 114000, y: 74000 },
    { x: 114000, y: 38000 },
    { x: 166000, y: 38000 },
  ]);
  assert.equal(JSON.stringify(ir), before, "presentation normalization must not mutate compiler IR");
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.lanePieces));
  assert.ok(Object.isFrozen(result.lanePieces[0].centerlineMilliUnits[0]));
  assert.throws(function () {
    result.lanePieces[0].centerlineMilliUnits[0].x = 0;
  }, TypeError);
});

test("a synthetic M04 paints the shared physical trunk once and emits one merge cap", function () {
  const joinX = 10000;
  const joinY = 10000;
  const north = reportLane("lane.north.approach", "surface", ["route.north"], [
    segment(0, 0, 10000, 0, 10000, joinX, joinY),
  ]);
  const south = reportLane("lane.south.approach", "surface", ["route.south"], [
    segment(0, 0, 10000, 0, 20000, joinX, joinY),
  ]);
  const trunk = reportLane("lane.shared.trunk", "surface", ["route.north", "route.south"], [
    segment(0, 0, 20000, joinX, joinY, 30000, joinY),
  ]);
  const input = reportFixture({
    laneSegments: [trunk, south, north],
    routes: [
      { id: "route.north", laneSegments: [{ laneSegmentId: north.id }, { laneSegmentId: trunk.id }] },
      { id: "route.south", laneSegments: [{ laneSegmentId: south.id }, { laneSegmentId: trunk.id }] },
    ],
    joins: [{
      id: "join.harbor-merge",
      kind: "merge",
      centerMilliUnits: { x: joinX, y: joinY },
      incomingLaneSegmentIds: [north.id, south.id],
      outgoingLaneSegmentIds: [trunk.id],
    }],
  });

  const result = RoadGeometry.createRoadRenderPieces(input);
  assert.deepEqual(result.lanePieces.map(function (piece) { return piece.laneSegmentId; }), [
    "lane.north.approach",
    "lane.shared.trunk",
    "lane.south.approach",
  ]);
  assert.equal(result.lanePieces.filter(function (piece) {
    return piece.laneSegmentId === "lane.shared.trunk";
  }).length, 1, "logical route traversal records must not repaint shared geometry");
  assert.equal(result.joinCaps.length, 1);
  assert.equal(result.joinCaps[0].kind, "merge-cap");
  assert.deepEqual(result.joinCaps[0].centerMilliUnits, { x: joinX, y: joinY });
  assert.equal(result.endCaps.length, 3, "joined endpoints are replaced by the single merge cap");
  assert.ok(result.endCaps.every(function (cap) {
    return cap.centerMilliUnits.x !== joinX || cap.centerMilliUnits.y !== joinY;
  }));
});

test("overpass declarations deterministically render the lower lane before the declared upper layer", function () {
  const lower = reportLane("lane.lower", "surface", ["route.lower"], [
    segment(0, 0, 20000, -10000, 0, 10000, 0),
  ]);
  const upper = reportLane("lane.upper", "bridge.deck", ["route.upper"], [
    segment(0, 0, 20000, 0, -10000, 0, 10000),
  ]);
  const input = reportFixture({
    laneSegments: [upper, lower],
    crossings: [{
      id: "crossing.bridge",
      kind: "overpass",
      laneAId: upper.id,
      subsegmentAIndex: 0,
      laneBId: lower.id,
      subsegmentBIndex: 0,
      upperLayerId: "bridge.deck",
    }],
  });

  const first = RoadGeometry.createRoadRenderPieces(input);
  const second = RoadGeometry.createRoadRenderPieces(Object.assign({}, input, {
    laneSegments: input.laneSegments.slice().reverse(),
  }));
  assert.deepEqual(first.lanePieces.map(function (piece) { return piece.laneSegmentId; }), [
    "lane.lower",
    "lane.upper",
  ]);
  assert.deepEqual(second.lanePieces, first.lanePieces);
  assert.deepEqual(first.crossingPieces[0], {
    id: "crossing.bridge",
    kind: "overpass-crossing",
    lowerLaneSegmentId: "lane.lower",
    lowerSubsegmentIndex: 0,
    lowerLayerId: "surface",
    upperLaneSegmentId: "lane.upper",
    upperSubsegmentIndex: 0,
    upperLayerId: "bridge.deck",
  });
});

test("road styling rejects asphalt, center stripes, and ambient shadows wider than 14 units", function () {
  const lane = reportLane("lane.one", "surface", ["route.one"], [
    segment(0, 0, 10000, 0, 0, 10000, 0),
  ]);
  const input = reportFixture({ laneSegments: [lane] });

  assert.throws(function () {
    RoadGeometry.createRoadRenderPieces(input, { materialStyleId: "ancient-road.asphalt" });
  }, /forbidden.*asphalt/i);
  assert.throws(function () {
    RoadGeometry.createRoadRenderPieces(input, { materialStyleId: "ancient-road.center-stripe" });
  }, /forbidden.*center-stripe/i);
  assert.throws(function () {
    RoadGeometry.createRoadRenderPieces(input, { ambientOcclusionWidthMilliUnits: 14001 });
  }, /ambient occlusion.*12000.*14000/i);
});
