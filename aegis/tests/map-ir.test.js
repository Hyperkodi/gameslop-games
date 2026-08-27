"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURE_ROOT = path.join(__dirname, "fixtures", "maps-v2");
const M01_PATH = path.join(__dirname, "..", "content", "maps", "m01.json");
const MapIr = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-ir.js"));
const MapV2 = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-v2-validation.js"));
const ExistingValidation = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-validation.js"));
const Report = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-report.js"));
const { canonicalEncode } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "canonical.js"));
const { AegisContentError } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "diagnostics.js"));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fixture(name) {
  return readJson(path.join(FIXTURE_ROOT, name + ".json"));
}

function freshM01() {
  return readJson(M01_PATH);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function diagnostic(fn, code) {
  let captured;
  assert.throws(fn, function (error) {
    captured = error;
    assert.ok(error instanceof AegisContentError, error && error.stack);
    assert.equal(error.diagnostics[0].code, code);
    return true;
  });
  return captured.diagnostics[0];
}

function assertDeepFrozen(value, seen) {
  if (!value || typeof value !== "object") return;
  const visited = seen || new Set();
  if (visited.has(value)) return;
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Object.keys(value)) assertDeepFrozen(value[key], visited);
}

function strippedSegments(compiled) {
  return compiled.segments.map(function (segment) {
    return {
      index: segment.index,
      start: segment.start,
      length: segment.length,
      fromX: segment.fromX,
      fromY: segment.fromY,
      toX: segment.toX,
      toY: segment.toY,
      deltaX: segment.deltaX,
      deltaY: segment.deltaY,
    };
  });
}

function bindingCoverageValues(coverage) {
  return {
    analysisSubunitsPerMilli: coverage.analysisSubunitsPerMilli,
    pads: coverage.pads.map(function (pad) {
      return {
        id: pad.id,
        x: pad.x,
        y: pad.y,
        probes: pad.probes.map(function (probe) {
          return {
            probeId: probe.probeId,
            range: probe.range,
            classification: probe.classification,
            qualityExposureSubunits: probe.qualityExposureSubunits,
            totalExposureSubunits: probe.totalExposureSubunits,
            worstRouteExposureSubunits: probe.worstRouteExposureSubunits,
            routes: probe.routes.map(function (route) {
              return {
                routeId: route.routeId,
                kind: route.kind,
                layerId: route.layerId,
                exposureSubunits: route.exposureSubunits,
                longestWindowSubunits: route.longestWindowSubunits,
                meanProgressSubunits: route.meanProgressSubunits,
                meanStageBp: route.meanStageBp,
                reentryCount: route.reentryCount,
                classification: route.classification,
                tangentProgressSubunits: route.tangentContacts.map(function (contact) { return contact.progressSubunits; }),
                windows: route.windows.map(function (window) {
                  return {
                    startSubunits: window.startSubunits,
                    endSubunits: window.endSubunits,
                    lengthSubunits: window.lengthSubunits,
                  };
                }),
              };
            }),
          };
        }),
      };
    }),
  };
}

test("map-v1 m01 normalizes to the canonical v2 IR without changing binding review values", () => {
  const source = freshM01();
  const before = canonicalEncode(source);
  const existing = ExistingValidation.validateMissionMap(source);
  const ir = MapIr.normalizeMap(source);

  assert.equal(ir.schemaVersion, 2);
  assert.equal(ir.id, "m01");
  assert.equal(Object.prototype.hasOwnProperty.call(ir, "title"), false);
  assert.deepEqual(ir.laneSegments.map(function (lane) { return lane.id; }), ["lane.migrated.route.main"]);
  assert.equal(ir.laneSegments[0].compiled.length, 260000);
  assert.equal(
    canonicalEncode(ir.laneSegments[0].compiled.subsegments),
    canonicalEncode(strippedSegments(existing.routes[0].route))
  );
  assert.deepEqual(ir.routes, [{
    id: "route.main",
    kind: "ground",
    laneSegmentIds: ["lane.migrated.route.main"],
    entryAnchorId: "entry.west",
    gateAnchorId: "gate.east",
    length: 260000,
    segmentOffsets: [{
      laneSegmentId: "lane.migrated.route.main",
      routeOffset: 0,
      laneLength: 260000,
      remainingDistanceAtStart: 260000,
      remainingDistanceAtEnd: 0,
    }],
  }]);
  assert.deepEqual(ir.pads.map(function (pad) {
    return [pad.id, pad.x, pad.y, pad.intent, pad.declaredQuality, pad.selectionOrder];
  }), existing.pads.map(function (pad, index) {
    return [pad.id, pad.x, pad.y, pad.intent, pad.declaredQuality, index];
  }));
  assert.equal(canonicalEncode(bindingCoverageValues(ir.analysis.coverage)), canonicalEncode(bindingCoverageValues(existing.analysis)));
  assert.equal(canonicalEncode(ir.analysis.padClearances), canonicalEncode(existing.padChecks.map(function (check) {
    return Object.assign({ id: check.id }, check.clearance);
  })));
  assert.equal(canonicalEncode(ir.analysis.spreadCheck), canonicalEncode(existing.spreadCheck));
  assert.equal(canonicalEncode(ir.analysis.routeStageOrderCheck), canonicalEncode(existing.routeStageOrderCheck));
  assert.equal(canonicalEncode(source), before);
  assert.equal(Object.isFrozen(source), false);
  assert.equal(Object.isFrozen(source.routes[0].nodes[0]), false);
  assertDeepFrozen(ir);
  assert.doesNotThrow(function () { canonicalEncode(ir); });
});

test("an exact map-v2 transcription of m01 has identical normalized IR and analyzer-report bytes", () => {
  const migrated = MapIr.normalizeMap(freshM01());
  const authoredV2 = MapIr.normalizeMap(fixture("m01-transcription"));

  assert.equal(canonicalEncode(authoredV2.analysis), canonicalEncode(migrated.analysis));
  assert.equal(canonicalEncode(authoredV2), canonicalEncode(migrated));
  assert.equal(
    canonicalEncode(Report.createNormalizedMapReport(authoredV2)),
    canonicalEncode(Report.createNormalizedMapReport(migrated))
  );
});

test("two routes share one compiled physical trunk and retain distinct route-local offsets", () => {
  const source = fixture("shared-trunk");
  const before = canonicalEncode(source);
  const ir = MapIr.normalizeMap(source);
  const trunk = ir.laneSegments.find(function (lane) { return lane.id === "lane.shared.trunk"; });
  const north = ir.routes.find(function (route) { return route.id === "route.north"; });
  const south = ir.routes.find(function (route) { return route.id === "route.south"; });

  assert.equal(Object.prototype.hasOwnProperty.call(ir, "title"), false);
  assert.equal(ir.laneSegments.filter(function (lane) { return lane.id === "lane.shared.trunk"; }).length, 1);
  assert.equal(trunk.compiled.length, 125941);
  assert.deepEqual(trunk.routeIds, ["route.north", "route.south"]);
  assert.equal(north.length, 194785);
  assert.equal(south.length, 209022);
  assert.deepEqual(north.segmentOffsets, [
    { laneSegmentId: "lane.north.approach", routeOffset: 0, laneLength: 68844, remainingDistanceAtStart: 194785, remainingDistanceAtEnd: 125941 },
    { laneSegmentId: "lane.shared.trunk", routeOffset: 68844, laneLength: 125941, remainingDistanceAtStart: 125941, remainingDistanceAtEnd: 0 },
  ]);
  assert.deepEqual(south.segmentOffsets, [
    { laneSegmentId: "lane.south.approach", routeOffset: 0, laneLength: 83081, remainingDistanceAtStart: 209022, remainingDistanceAtEnd: 125941 },
    { laneSegmentId: "lane.shared.trunk", routeOffset: 83081, laneLength: 125941, remainingDistanceAtStart: 125941, remainingDistanceAtEnd: 0 },
  ]);
  assert.deepEqual(MapIr.routePosition(ir, "route.north", "lane.north.approach", 20000), {
    routeId: "route.north", laneSegmentId: "lane.north.approach", laneOffset: 20000,
    routeDistance: 20000, remainingDistance: 174785,
  });
  assert.deepEqual(MapIr.routePosition(ir, "route.north", "lane.shared.trunk", 10000), {
    routeId: "route.north", laneSegmentId: "lane.shared.trunk", laneOffset: 10000,
    routeDistance: 78844, remainingDistance: 115941,
  });
  assert.deepEqual(MapIr.routePosition(ir, "route.south", "lane.shared.trunk", 10000), {
    routeId: "route.south", laneSegmentId: "lane.shared.trunk", laneOffset: 10000,
    routeDistance: 93081, remainingDistance: 115941,
  });
  assert.equal(MapIr.routePosition(ir, "route.south", "lane.shared.trunk", 125941).remainingDistance, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(north, "compiled"), false);
  assert.equal(canonicalEncode(source), before);
  assert.equal(Object.isFrozen(source), false);
  const northPad = ir.analysis.coverage.pads.find(function (pad) { return pad.id === "p01"; }).probes[0];
  assert.deepEqual(northPad.routes.map(function (route) { return [route.routeId, route.claimed, route.exposureSubunits]; }), [
    ["route.north", true, 24000000000],
    ["route.south", false, 0],
  ]);
  const mergePad = ir.analysis.coverage.pads.find(function (pad) { return pad.id === "p02"; }).probes[0];
  assert.equal(mergePad.qualityExposureSubunits, 24000000000);
  assert.deepEqual(mergePad.claimedRouteIds, ["route.north", "route.south"]);
  assert.ok(mergePad.routes.every(function (route) {
    return route.windows.every(function (window) {
      return window.segmentIds.every(function (id) { return id.startsWith("lane."); });
    });
  }));
  assertDeepFrozen(ir);
  assert.equal(canonicalEncode(MapIr.normalizeMap(fixture("shared-trunk"))), canonicalEncode(ir));
});

test("a shared middle can split into divergent suffixes and continuation joins remain valid", () => {
  const split = MapIr.normalizeMap(fixture("shared-middle-split"));
  const shared = split.laneSegments.find(function (lane) { return lane.id === "lane.shared.entry"; });
  const northExit = split.laneSegments.find(function (lane) { return lane.id === "lane.north.exit"; });
  assert.deepEqual(shared.routeIds, ["route.north", "route.south"]);
  assert.deepEqual(northExit.routeIds, ["route.north"]);
  assert.equal(split.joins[0].kind, "split");
  assert.deepEqual(split.analysis.routeProvenance[0].laneSegments.map(function (lane) {
    return [lane.laneSegmentId, lane.sharedRouteIds];
  }), [
    ["lane.shared.entry", ["route.north", "route.south"]],
    ["lane.north.exit", ["route.north"]],
  ]);

  const continuation = fixture("shared-middle-split");
  continuation.laneSegments = continuation.laneSegments.filter(function (lane) { return lane.id !== "lane.south.exit"; });
  continuation.routes = [continuation.routes[0]];
  continuation.joins[0].kind = "continuation";
  continuation.joins[0].outgoingLaneSegmentIds = ["lane.north.exit"];
  continuation.pads = [continuation.pads[0]];
  continuation.anchors = continuation.anchors.filter(function (anchor) { return anchor.id !== "gate.south"; });
  continuation.anchors[0].routeIds = ["route.north"];
  continuation.probes[0].routeIds = ["route.north"];
  assert.equal(MapIr.normalizeMap(continuation).joins[0].kind, "continuation");
});

test("diagnostic probes may select a route subset without weakening entry or quality claims", () => {
  const source = fixture("shared-trunk");
  source.probes.push({
    id: "rdiag",
    rangeWorldUnits: 20,
    targetKinds: ["ground"],
    routeIds: ["route.north"],
  });
  const ir = MapIr.normalizeMap(source);
  const southDiagnostic = ir.analysis.coverage.pads.find(function (pad) { return pad.id === "p03"; }).probes.find(function (probe) {
    return probe.probeId === "rdiag";
  });
  assert.deepEqual(southDiagnostic.claimedRouteIds, []);
  assert.deepEqual(southDiagnostic.unclaimedRouteIds, ["route.north"]);
  assert.equal(southDiagnostic.qualityExposureSubunits, null);
  assert.equal(ir.analysis.spreadCheck.pass, true);
});

test("physical overpasses are canonical and every actual crossing must be declared exactly once", () => {
  const source = fixture("overpass");
  const ir = MapIr.normalizeMap(source);
  assert.deepEqual(ir.crossings, [{
    id: "cross.center",
    kind: "overpass",
    laneAId: "lane.horizontal",
    subsegmentAIndex: 0,
    laneBId: "lane.vertical",
    subsegmentBIndex: 0,
    upperLayerId: "bridge",
  }]);

  const undeclared = fixture("overpass");
  undeclared.crossings = [];
  diagnostic(function () { MapV2.validateMapV2(undeclared); }, "MAP_UNDECLARED_CROSSING");

  const sameLayer = fixture("overpass");
  sameLayer.laneSegments[1].layerId = "surface";
  diagnostic(function () { MapV2.validateMapV2(sameLayer); }, "MAP_OVERPASS_LAYER");

  const stale = fixture("overpass");
  stale.crossings[0].subsegmentBIndex = 1;
  diagnostic(function () { MapV2.validateMapV2(stale); }, "MAP_SUBSEGMENT_REFERENCE");

  const atGrade = fixture("overpass");
  atGrade.laneSegments[1].layerId = "surface";
  atGrade.crossings[0].kind = "at-grade";
  delete atGrade.crossings[0].upperLayerId;
  assert.equal(MapIr.normalizeMap(atGrade).crossings[0].kind, "at-grade");

  const reversedPair = fixture("overpass");
  reversedPair.crossings[0].laneAId = "lane.vertical";
  reversedPair.crossings[0].laneBId = "lane.horizontal";
  diagnostic(function () { MapV2.validateMapV2(reversedPair); }, "MAP_UNSTABLE_CROSSING");

  const duplicate = fixture("overpass");
  duplicate.crossings.push(Object.assign({}, duplicate.crossings[0], { id: "cross.duplicate" }));
  diagnostic(function () { MapV2.validateMapV2(duplicate); }, "MAP_DUPLICATE_CROSSING");

  const joinAsCrossing = fixture("shared-trunk");
  joinAsCrossing.crossings.push({
    id: "cross.join",
    kind: "at-grade",
    laneAId: "lane.north.approach",
    subsegmentAIndex: 1,
    laneBId: "lane.shared.trunk",
    subsegmentBIndex: 0,
  });
  diagnostic(function () { MapV2.validateMapV2(joinAsCrossing); }, "MAP_CROSSING_JOIN");
});

test("duplicate or overlapping physical geometry cannot impersonate shared identity", () => {
  const duplicate = fixture("shared-trunk");
  duplicate.laneSegments[2].nodes = clone(duplicate.laneSegments[0].nodes);
  duplicate.anchors[1].column = -2;
  duplicate.anchors[1].row = 4;
  diagnostic(function () { MapV2.validateMapV2(duplicate); }, "MAP_DUPLICATE_PHYSICAL_GEOMETRY");

  const overlap = fixture("shared-trunk");
  overlap.laneSegments[2].nodes = [
    { column: -1, row: 4, portal: true },
    { column: 9, row: 4 },
    { column: 12, row: 10 },
  ];
  overlap.anchors[1].column = -1;
  overlap.anchors[1].row = 4;
  diagnostic(function () { MapV2.validateMapV2(overlap); }, "MAP_PHYSICAL_OVERLAP");
});

test("route direction, connectivity, kind, repetition, and endpoint ownership fail closed", () => {
  const reverse = fixture("shared-trunk");
  reverse.routes[0].laneSegmentIds = ["lane.shared.trunk", "lane.north.approach"];
  diagnostic(function () { MapV2.validateMapV2(reverse); }, "MAP_ROUTE_DIRECTION");

  const repeated = fixture("shared-trunk");
  repeated.routes[0].laneSegmentIds.push("lane.shared.trunk");
  diagnostic(function () { MapV2.validateMapV2(repeated); }, "MAP_REPEATED_LANE");

  const wrongKind = fixture("shared-trunk");
  wrongKind.routes[0].kind = "air";
  diagnostic(function () { MapV2.validateMapV2(wrongKind); }, "MAP_ROUTE_KIND");

  const disconnected = fixture("shared-trunk");
  disconnected.joins = [];
  diagnostic(function () { MapV2.validateMapV2(disconnected); }, "MAP_UNDECLARED_JOIN");

  const unreachable = fixture("shared-trunk");
  unreachable.routes[0].gateAnchorId = "entry.north";
  diagnostic(function () { MapV2.validateMapV2(unreachable); }, "MAP_ROUTE_GATE");

  const cycle = fixture("shared-trunk");
  cycle.laneSegments = [
    { id: "lane.a.entry", kind: "ground", layerId: "surface", nodes: [{ column: -2, row: 5, portal: true }, { column: 5, row: 5 }] },
    { id: "lane.b.east", kind: "ground", layerId: "surface", nodes: [{ column: 5, row: 5 }, { column: 10, row: 5 }] },
    { id: "lane.c.south", kind: "ground", layerId: "surface", nodes: [{ column: 10, row: 5 }, { column: 10, row: 10 }] },
    { id: "lane.d.return", kind: "ground", layerId: "surface", nodes: [{ column: 10, row: 10 }, { column: 5, row: 5 }] },
    { id: "lane.e.exit", kind: "ground", layerId: "surface", nodes: [{ column: 5, row: 5 }, { column: 41, row: 15, portal: true }] },
  ];
  cycle.routes = [{
    id: "route.loop",
    kind: "ground",
    laneSegmentIds: ["lane.a.entry", "lane.b.east", "lane.c.south", "lane.d.return", "lane.e.exit"],
    entryAnchorId: "entry.loop",
    gateAnchorId: "gate.loop",
  }];
  cycle.joins = [
    { id: "join.ab", kind: "continuation", column: 5, row: 5, incomingLaneSegmentIds: ["lane.a.entry"], outgoingLaneSegmentIds: ["lane.b.east"] },
    { id: "join.bc", kind: "continuation", column: 10, row: 5, incomingLaneSegmentIds: ["lane.b.east"], outgoingLaneSegmentIds: ["lane.c.south"] },
    { id: "join.cd", kind: "continuation", column: 10, row: 10, incomingLaneSegmentIds: ["lane.c.south"], outgoingLaneSegmentIds: ["lane.d.return"] },
    { id: "join.de", kind: "continuation", column: 5, row: 5, incomingLaneSegmentIds: ["lane.d.return"], outgoingLaneSegmentIds: ["lane.e.exit"] },
  ];
  diagnostic(function () { MapV2.validateMapV2(cycle); }, "MAP_ROUTE_CYCLE");
});

test("undeclared self-intersections and nonadjacent road-buffer collisions fail", () => {
  const selfCrossing = fixture("overpass");
  selfCrossing.laneSegments = [{
    id: "lane.self",
    kind: "ground",
    layerId: "surface",
    nodes: [
      { column: -2, row: 5, portal: true },
      { column: 20, row: 20 },
      { column: 5, row: 20 },
      { column: 20, row: 5 },
      { column: 41, row: 20, portal: true },
    ],
  }];
  selfCrossing.routes = [{ id: "route.self", kind: "ground", laneSegmentIds: ["lane.self"], entryAnchorId: "entry.self", gateAnchorId: "gate.self" }];
  selfCrossing.joins = [];
  selfCrossing.crossings = [];
  selfCrossing.anchors = [
    { id: "entry.self", kind: "entry", column: -2, row: 5, laneSegmentId: "lane.self", routeIds: ["route.self"] },
    { id: "gate.self", kind: "gate", column: 41, row: 20, laneSegmentId: "lane.self", routeIds: ["route.self"] },
  ];
  selfCrossing.pads[0].claimedRouteIds = ["route.self"];
  selfCrossing.probes[0].routeIds = ["route.self"];
  diagnostic(function () { MapV2.validateMapV2(selfCrossing); }, "MAP_UNDECLARED_CROSSING");

  const hairpin = fixture("overpass");
  hairpin.laneSegments = [{
    id: "lane.hairpin",
    kind: "ground",
    layerId: "surface",
    nodes: [
      { column: -2, row: 5, portal: true },
      { column: 20, row: 5 },
      { column: 20, row: 7 },
      { column: -2, row: 7, portal: true },
    ],
  }];
  hairpin.routes = [{ id: "route.hairpin", kind: "ground", laneSegmentIds: ["lane.hairpin"], entryAnchorId: "entry.hairpin", gateAnchorId: "gate.hairpin" }];
  hairpin.joins = [];
  hairpin.crossings = [];
  hairpin.anchors = [
    { id: "entry.hairpin", kind: "entry", column: -2, row: 5, laneSegmentId: "lane.hairpin", routeIds: ["route.hairpin"] },
    { id: "gate.hairpin", kind: "gate", column: -2, row: 7, laneSegmentId: "lane.hairpin", routeIds: ["route.hairpin"] },
  ];
  hairpin.pads[0].claimedRouteIds = ["route.hairpin"];
  hairpin.probes[0].routeIds = ["route.hairpin"];
  diagnostic(function () { MapV2.validateMapV2(hairpin); }, "MAP_ROAD_SELF_COLLISION");
});

test("join arity, staleness, endpoint agreement, and neighborhood bounds are exact", () => {
  const arity = fixture("shared-trunk");
  arity.joins[0].incomingLaneSegmentIds = ["lane.north.approach"];
  diagnostic(function () { MapV2.validateMapV2(arity); }, "MAP_JOIN_ARITY");

  const continuationArity = fixture("shared-trunk");
  continuationArity.joins[0].kind = "continuation";
  diagnostic(function () { MapV2.validateMapV2(continuationArity); }, "MAP_JOIN_ARITY");

  const splitArity = fixture("shared-trunk");
  splitArity.joins[0].kind = "split";
  diagnostic(function () { MapV2.validateMapV2(splitArity); }, "MAP_JOIN_ARITY");

  const endpoint = fixture("shared-trunk");
  endpoint.joins[0].column = 13;
  diagnostic(function () { MapV2.validateMapV2(endpoint); }, "MAP_JOIN_ENDPOINT");

  const stale = fixture("shared-trunk");
  stale.laneSegments.push({
    id: "lane.stale.approach",
    kind: "ground",
    layerId: "surface",
    nodes: [{ column: -2, row: 24, portal: true }, { column: 12, row: 10 }],
  });
  stale.joins[0].incomingLaneSegmentIds.push("lane.stale.approach");
  stale.routes.push({
    id: "route.stale",
    kind: "ground",
    laneSegmentIds: ["lane.stale.approach"],
    entryAnchorId: "entry.stale",
    gateAnchorId: "gate.stale",
  });
  stale.anchors.splice(2, 0, {
    id: "entry.stale",
    kind: "entry",
    column: -2,
    row: 24,
    laneSegmentId: "lane.stale.approach",
    routeIds: ["route.stale"],
  });
  stale.anchors.push({
    id: "gate.stale",
    kind: "gate",
    column: 12,
    row: 10,
    laneSegmentId: "lane.stale.approach",
    routeIds: ["route.stale"],
  });
  diagnostic(function () { MapV2.validateMapV2(stale); }, "MAP_STALE_JOIN");

  const shallow = fixture("shared-trunk");
  shallow.laneSegments[0].nodes = [
    { column: -2, row: 9, portal: true }, { column: 8, row: 9 }, { column: 12, row: 10 },
  ];
  shallow.laneSegments[2].nodes = [
    { column: -2, row: 11, portal: true }, { column: 8, row: 11 }, { column: 12, row: 10 },
  ];
  shallow.anchors[0].row = 9;
  shallow.anchors[1].row = 11;
  diagnostic(function () { MapV2.validateMapV2(shallow); }, "MAP_JOIN_NEIGHBORHOOD");
});

test("portal bounds, safe integers, strict source ordering, and exact keys fail closed", () => {
  const portal = fixture("shared-trunk");
  portal.laneSegments[0].nodes[0].column = -5;
  portal.anchors[0].column = -5;
  diagnostic(function () { MapV2.validateMapV2(portal); }, "MAP_PORTAL_BOUNDS");

  const unsafe = fixture("shared-trunk");
  unsafe.laneSegments[0].nodes[0].column = Number.MAX_SAFE_INTEGER + 1;
  unsafe.anchors[0].column = Number.MAX_SAFE_INTEGER + 1;
  diagnostic(function () { MapV2.validateMapV2(unsafe); }, "MAP_SAFE_INTEGER");

  const reordered = fixture("shared-trunk");
  const first = reordered.laneSegments[0];
  reordered.laneSegments[0] = reordered.laneSegments[1];
  reordered.laneSegments[1] = first;
  diagnostic(function () { MapV2.validateMapV2(reordered); }, "MAP_UNSTABLE_ORDER");

  const unknown = fixture("shared-trunk");
  unknown.routes[0].rendererPath = "forbidden";
  diagnostic(function () { MapV2.validateMapV2(unknown); }, "MAP_UNKNOWN_KEY");

  const internalPortal = fixture("shared-trunk");
  internalPortal.laneSegments[0].nodes[1].portal = true;
  diagnostic(function () { MapV2.validateMapV2(internalPortal); }, "MAP_PORTAL_BOUNDS");

  const tooManyNodes = fixture("shared-trunk");
  tooManyNodes.laneSegments[0].nodes = Array.from({ length: 65 }, function (_, index) {
    return { column: index % 40, row: Math.floor(index / 40) };
  });
  diagnostic(function () { MapV2.validateMapV2(tooManyNodes); }, "MAP_LIMIT");

  const tooManyRoutes = fixture("shared-trunk");
  tooManyRoutes.routes = Array.from({ length: 17 }, function (_, index) {
    return Object.assign(clone(tooManyRoutes.routes[0]), { id: "route.limit." + String(index).padStart(2, "0") });
  });
  diagnostic(function () { MapV2.validateMapV2(tooManyRoutes); }, "MAP_LIMIT");

  const tooDeep = fixture("shared-trunk");
  let cursor = tooDeep;
  for (let index = 0; index < 33; index++) {
    cursor.nested = {};
    cursor = cursor.nested;
  }
  diagnostic(function () { MapV2.validateMapV2(tooDeep); }, "MAP_LIMIT");

  const whitespaceTitle = fixture("shared-trunk");
  whitespaceTitle.title = " \t ";
  diagnostic(function () { MapV2.validateMapV2(whitespaceTitle); }, "MAP_STRING");

  const loneSurrogateTitle = fixture("shared-trunk");
  loneSurrogateTitle.title = "Broken \ud800 title";
  diagnostic(function () { MapV2.validateMapV2(loneSurrogateTitle); }, "MAP_STRING_XML");
});

test("non-ground point crossings preserve v1 semantics while physical overlap still fails", () => {
  const air = fixture("overpass");
  air.laneSegments[1].kind = "air";
  air.routes[1].kind = "air";
  air.crossings = [];
  assert.doesNotThrow(function () { MapV2.validateMapV2(air); });

  const declared = clone(air);
  declared.crossings = [{
    id: "cross.air",
    kind: "overpass",
    laneAId: "lane.horizontal",
    subsegmentAIndex: 0,
    laneBId: "lane.vertical",
    subsegmentBIndex: 0,
    upperLayerId: "bridge",
  }];
  diagnostic(function () { MapV2.validateMapV2(declared); }, "MAP_CROSSING_KIND");

  const overlap = clone(air);
  overlap.laneSegments[1].nodes = [
    { column: 5, row: 12 },
    { column: 25, row: 12 },
  ];
  overlap.anchors[1].column = 5;
  overlap.anchors[1].row = 12;
  overlap.anchors[3].column = 25;
  overlap.anchors[3].row = 12;
  diagnostic(function () { MapV2.validateMapV2(overlap); }, "MAP_PHYSICAL_OVERLAP");
});

test("routePosition rejects invalid, unsafe, and out-of-lane offsets", () => {
  const ir = MapIr.normalizeMap(fixture("shared-trunk"));
  diagnostic(function () { MapIr.routePosition(ir, "route.unknown", "lane.shared.trunk", 0); }, "MAP_ROUTE_REFERENCE");
  diagnostic(function () { MapIr.routePosition(ir, "route.north", "lane.shared.trunk", -1); }, "MAP_ROUTE_OFFSET");
  diagnostic(function () { MapIr.routePosition(ir, "route.north", "lane.shared.trunk", Number.MAX_SAFE_INTEGER + 1); }, "MAP_ROUTE_OFFSET");
  diagnostic(function () { MapIr.routePosition(ir, "route.north", "lane.shared.trunk", 125942); }, "MAP_ROUTE_OFFSET");

  const corrupted = clone(ir);
  corrupted.routes[0].segmentOffsets[0].routeOffset = Number.MAX_SAFE_INTEGER;
  diagnostic(function () { MapIr.routePosition(corrupted, "route.north", "lane.north.approach", 1); }, "MAP_ROUTE_OFFSET");
});

test("selection indices are contiguous and unknown role-proof behavior stays fail-closed", () => {
  const selection = fixture("shared-trunk");
  selection.pads[1].selectionOrder = 1;
  diagnostic(function () { MapV2.validateMapV2(selection); }, "MAP_SELECTION_ORDER");

  const proof = fixture("shared-trunk");
  proof.roleProofs.push({ id: "proof.future", kind: "future", version: 1, padId: "p01" });
  diagnostic(function () { MapV2.validateMapV2(proof); }, "ROLE_PROOF_UNIMPLEMENTED");
});

test("validation copies plain caller data and rejects cycles/shared-reference laundering", () => {
  const source = fixture("shared-trunk");
  const before = canonicalEncode(source);
  const validated = MapV2.validateMapV2(source);
  assert.equal(canonicalEncode(source), before);
  assert.equal(Object.isFrozen(source), false);
  assertDeepFrozen(validated);
  assert.doesNotThrow(function () { canonicalEncode(validated); });

  const shared = fixture("shared-trunk");
  shared.laneSegments[2].nodes[1] = shared.laneSegments[0].nodes[1];
  diagnostic(function () { MapV2.validateMapV2(shared); }, "MAP_SHARED_REFERENCE");

  const cyclic = fixture("shared-trunk");
  cyclic.loop = cyclic;
  diagnostic(function () { MapV2.validateMapV2(cyclic); }, "MAP_SHARED_REFERENCE");
});
