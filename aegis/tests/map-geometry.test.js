"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURES = path.join(__dirname, "fixtures", "maps");
const MapGeometry = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-geometry.js"));
const RuntimeGeometry = require(path.join(__dirname, "..", "js", "sim", "geometry.js"));
const { canonicalEncode } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "canonical.js"));

const GOLDENS = JSON.parse(fs.readFileSync(path.join(FIXTURES, "core-goldens.json"), "utf8"));
const LEGACY = JSON.parse(fs.readFileSync(path.join(FIXTURES, "legacy-r22.json"), "utf8"));

function routeDescriptor(route, kind, layerId) {
  return { route: route, kind: kind || "ground", layerId: layerId || "surface" };
}

function probe(id, range, targetKinds, baseline) {
  const value = { id: id, range: range, targetKinds: targetKinds || ["ground"] };
  if (baseline !== undefined) value.baseline = baseline;
  return value;
}

function analyzeOne(fixture, range, id) {
  const route = MapGeometry.compileRoute(fixture.route);
  const pad = MapGeometry.compilePad(fixture.pad);
  return MapGeometry.analyzeCoverage({
    routes: [routeDescriptor(route)],
    pads: [pad],
    probes: [probe(id || "probe", range)],
  }).pads[0].probes[0];
}

test("hidden grid constants and portal compilation emit the exact runtime route shape", () => {
  assert.deepEqual(MapGeometry.GRID, {
    columns: 40,
    rows: 25,
    cellWorldUnits: 4,
    distanceScale: 1000,
    cellMilliUnits: 4000,
    centerOffsetMilli: 2000,
  });
  assert.deepEqual(MapGeometry.cellCenterMilli(0, 0, false), { x: 2000, y: 2000 });
  assert.deepEqual(MapGeometry.cellCenterMilli(39, 24, false), { x: 158000, y: 98000 });

  const route = MapGeometry.compileRoute({
    id: "route.portal",
    nodes: [
      { column: -2, row: 5, portal: true },
      { column: 11, row: 5 },
      { column: 41, row: 5, portal: true },
    ],
  });
  assert.deepEqual(Object.keys(route), ["id", "length", "segments"]);
  assert.deepEqual(Object.keys(route.segments[0]), [
    "id", "index", "start", "length", "fromX", "fromY", "toX", "toY", "deltaX", "deltaY",
  ]);
  const runtime = RuntimeGeometry.freezeCompiledRoute(route);
  assert.deepEqual(runtime, route);
  assert.equal(Object.isFrozen(runtime), true);

  const irrational = MapGeometry.compileRoute({
    id: "route.floor-root",
    nodes: [{ column: 0, row: 0 }, { column: 1, row: 1 }],
  });
  assert.equal(irrational.segments[0].length, 5656);
  assert.equal(MapGeometry.integerSqrtFloor(2n), 1n);
  assert.equal(MapGeometry.integerSqrtFloor(32000000n), 5656n);
  assert.ok(5656n * 5656n <= 32000000n);
  assert.ok(5657n * 5657n > 32000000n);
});

test("straight coverage and an exact tangent have deterministic positive-window semantics", () => {
  const covered = analyzeOne(GOLDENS.straight, 20000, "range20");
  assert.equal(covered.totalExposureSubunits, GOLDENS.straight.range20.exposureSubunits);
  assert.deepEqual(covered.routes[0].windows, [{
    startSubunits: GOLDENS.straight.range20.startSubunits,
    endSubunits: GOLDENS.straight.range20.endSubunits,
    lengthSubunits: GOLDENS.straight.range20.exposureSubunits,
    segmentIds: ["route.straight:s000"],
  }]);
  assert.deepEqual(covered.routes[0].tangentContacts, []);
  assert.equal(covered.routes[0].reentryCount, 0);

  const tangent = analyzeOne(GOLDENS.straight, 16000, "range16");
  assert.equal(tangent.totalExposureSubunits, 0);
  assert.deepEqual(tangent.routes[0].windows, []);
  assert.deepEqual(tangent.routes[0].tangentContacts, [{
    progressSubunits: GOLDENS.straight.range16TangentSubunits,
    segmentIds: ["route.straight:s000"],
  }]);
});

test("touching windows merge at a covered waypoint while a one-unit smaller range re-enters", () => {
  const merged = analyzeOne(GOLDENS.corner, 20000, "range20");
  assert.equal(merged.totalExposureSubunits, GOLDENS.corner.range20.exposureSubunits);
  assert.equal(merged.routes[0].windows.length, 1);
  assert.equal(merged.routes[0].windows[0].startSubunits, GOLDENS.corner.range20.startSubunits);
  assert.equal(merged.routes[0].windows[0].endSubunits, GOLDENS.corner.range20.endSubunits);
  assert.deepEqual(merged.routes[0].windows[0].segmentIds, ["route.corner:s000", "route.corner:s001"]);
  assert.equal(merged.routes[0].reentryCount, 0);
  assert.equal(merged.routes[0].meanStageBp, GOLDENS.corner.range20.meanStageBp);

  const separated = analyzeOne(GOLDENS.corner, 19999, "range19.999");
  assert.equal(separated.routes[0].windows.length, 2);
  assert.equal(separated.routes[0].reentryCount, 1);
  assert.ok(separated.routes[0].windows[0].endSubunits < separated.routes[0].windows[1].startSubunits);
});

test("3-4-5 diagonal roots use directed BigInt rounding and exact one-unit boundaries", () => {
  const tangent = analyzeOne(GOLDENS.diagonal, 20000, "range20");
  assert.equal(tangent.totalExposureSubunits, 0);
  assert.equal(tangent.routes[0].tangentContacts[0].progressSubunits, GOLDENS.diagonal.range20TangentSubunits);

  const covered = analyzeOne(GOLDENS.diagonal, 22000, "range22");
  assert.equal(covered.totalExposureSubunits, GOLDENS.diagonal.range22.exposureSubunits);
  assert.equal(covered.routes[0].windows[0].startSubunits, GOLDENS.diagonal.range22.startSubunits);
  assert.equal(covered.routes[0].windows[0].endSubunits, GOLDENS.diagonal.range22.endSubunits);

  assert.equal(analyzeOne(GOLDENS.diagonal, 19999, "outside").totalExposureSubunits, 0);
  assert.ok(analyzeOne(GOLDENS.diagonal, 20001, "inside").totalExposureSubunits > 0);
});

test("two disconnected passes preserve re-entry, longest window, and weighted route stage", () => {
  const result = analyzeOne(GOLDENS.twoPass, 22000, "range22");
  assert.equal(result.totalExposureSubunits, GOLDENS.twoPass.range22.exposureSubunits);
  assert.equal(result.routes[0].windows.length, 2);
  assert.equal(result.routes[0].reentryCount, 1);
  assert.equal(result.routes[0].longestWindowSubunits, GOLDENS.twoPass.range22.longestWindowSubunits);
  assert.equal(result.routes[0].meanStageBp, GOLDENS.twoPass.range22.meanStageBp);
});

test("two-route reports retain a zero worst route instead of hiding it in the total", () => {
  const top = MapGeometry.compileRoute({
    id: "route.a", nodes: [{ column: 0, row: 5 }, { column: 20, row: 5 }],
  });
  const bottom = MapGeometry.compileRoute({
    id: "route.b", nodes: [{ column: 0, row: 15 }, { column: 20, row: 15 }],
  });
  const central = MapGeometry.compilePad({ id: "pad.central", column: 10, row: 10 });
  const offset = MapGeometry.compilePad({ id: "pad.offset", column: 10, row: 9 });
  const report = MapGeometry.analyzeCoverage({
    routes: [routeDescriptor(bottom), routeDescriptor(top)],
    pads: [offset, central],
    probes: [probe("both", 22000, ["ground"], 30200)],
  });
  const byId = Object.fromEntries(report.pads.map((pad) => [pad.id, pad.probes[0]]));
  assert.equal(byId["pad.central"].routes.length, 2);
  assert.ok(byId["pad.central"].worstRouteExposureSubunits > 0);
  assert.ok(byId["pad.offset"].totalExposureSubunits > 0);
  assert.equal(byId["pad.offset"].worstRouteExposureSubunits, 0);
  assert.equal(byId["pad.offset"].classification, "invalid");
  assert.deepEqual(report.spreads[0], {
    probeId: "both",
    kind: "infinite-zero-min",
    numeratorSubunits: byId["pad.central"].qualityExposureSubunits,
    denominatorSubunits: 0,
    maxPadIds: ["pad.central"],
    minPadIds: ["pad.offset"],
  });
  assert.equal(JSON.stringify(report).includes("Infinity"), false);
});

test("declared overpass layers remain separate and air target masks are explicit", () => {
  const horizontal = MapGeometry.compileRoute({
    id: "route.ground", nodes: [{ column: 0, row: 10 }, { column: 20, row: 10 }],
  });
  const vertical = MapGeometry.compileRoute({
    id: "route.bridge", nodes: [{ column: 10, row: 0 }, { column: 10, row: 20 }],
  });
  const pad = MapGeometry.compilePad({ id: "pad.overpass", column: 6, row: 6 });
  const overpass = MapGeometry.analyzeCoverage({
    routes: [routeDescriptor(horizontal, "ground", "surface"), routeDescriptor(vertical, "ground", "bridge-1")],
    pads: [pad],
    probes: [probe("ground", 20000, ["ground"])],
  }).pads[0].probes[0];
  assert.deepEqual(overpass.routes.map((route) => [route.routeId, route.layerId, route.exposureSubunits]), [
    ["route.bridge", "bridge-1", 24000000000],
    ["route.ground", "surface", 24000000000],
  ]);
  assert.equal(overpass.routes.length, 2);

  const air = MapGeometry.compileRoute({
    id: "route.air", nodes: [{ column: 0, row: 15 }, { column: 20, row: 15 }],
  });
  const central = MapGeometry.compilePad({ id: "pad.air-test", column: 10, row: 10 });
  const masks = MapGeometry.analyzeCoverage({
    routes: [routeDescriptor(horizontal, "ground", "surface"), routeDescriptor(air, "air", "air-1")],
    pads: [central],
    probes: [probe("air-only", 22000, ["air"]), probe("both", 22000, ["ground", "air"]), probe("ground-only", 22000, ["ground"])],
  }).pads[0].probes;
  assert.deepEqual(masks.map((entry) => [entry.probeId, entry.routes.map((route) => route.kind)]), [
    ["air-only", ["air"]],
    ["both", ["air", "ground"]],
    ["ground-only", ["ground"]],
  ]);
});

test("Q boundaries and spread decisions use integer cross multiplication", () => {
  const baselineSubunits = 30200 * MapGeometry.ANALYSIS_SUBUNITS_PER_MILLI;
  assert.equal(MapGeometry.classifyExposure(baselineSubunits * 3 / 5, 30200), "specialist");
  assert.equal(MapGeometry.classifyExposure(baselineSubunits * 17 / 20, 30200), "standard");
  assert.equal(MapGeometry.classifyExposure(baselineSubunits * 5 / 4, 30200), "strong");
  assert.equal(MapGeometry.classifyExposure(baselineSubunits * 17 / 10, 30200), "power");
  assert.equal(MapGeometry.classifyExposure(baselineSubunits * 2, 30200), "power");
  assert.equal(MapGeometry.classifyExposure(baselineSubunits * 2 + 1, 30200), "rejected");
  assert.equal(MapGeometry.spreadWithin({ kind: "finite", numeratorSubunits: 165, denominatorSubunits: 100 }, 165, 100), true);
  assert.equal(MapGeometry.spreadWithin({ kind: "finite", numeratorSubunits: 166, denominatorSubunits: 100 }, 165, 100), false);
  assert.equal(MapGeometry.spreadWithin({ kind: "infinite-zero-min", numeratorSubunits: 1, denominatorSubunits: 0 }, 165, 100), false);
});

test("invalid grid nodes, portal placement, zero segments, IDs, and duplicates fail closed", () => {
  assert.throws(() => MapGeometry.compilePad({ id: "pad.out", column: -1, row: 0 }), /grid|bounds/i);
  assert.throws(() => MapGeometry.compileRoute({
    id: "route.out", nodes: [{ column: -1, row: 5 }, { column: 2, row: 5 }],
  }), /portal/i);
  assert.throws(() => MapGeometry.compileRoute({
    id: "route.internal-portal",
    nodes: [{ column: 0, row: 5 }, { column: -1, row: 5, portal: true }, { column: 2, row: 5 }],
  }), /endpoint/i);
  assert.throws(() => MapGeometry.compileRoute({
    id: "route.zero", nodes: [{ column: 0, row: 5 }, { column: 0, row: 5 }],
  }), /zero|distinct/i);
  assert.throws(() => MapGeometry.compileRoute({
    id: "route bad", nodes: [{ column: 0, row: 5 }, { column: 2, row: 5 }],
  }), /ASCII|ID/i);

  const route = MapGeometry.compileRoute(GOLDENS.straight.route);
  const pad = MapGeometry.compilePad(GOLDENS.straight.pad);
  assert.throws(() => MapGeometry.analyzeCoverage({
    routes: [routeDescriptor(route), routeDescriptor(route)], pads: [pad], probes: [probe("p", 20000)],
  }), /duplicate/i);
});

test("legacy R22 golden reproduces one-based weak/dead and dominant pads exactly", () => {
  const report = MapGeometry.analyzeCoverage({
    routes: [routeDescriptor(LEGACY.route)],
    pads: LEGACY.pads,
    probes: [probe("r22", 22000, ["ground"], 30200)],
  });
  const exposureMilli = report.pads.map((pad) => MapGeometry.roundAnalysisSubunitsToMilli(
    pad.probes[0].totalExposureSubunits
  ));
  assert.deepEqual(exposureMilli, LEGACY.expectedExposureMilli);
  assert.deepEqual(report.pads.map((pad) => pad.probes[0].classification), [
    "standard", "invalid", "standard", "standard", "invalid",
    "power", "standard", "invalid", "power", "standard",
  ]);
  assert.deepEqual(report.spreads[0].minPadIds, ["legacy.p05"]);
  assert.deepEqual(report.spreads[0].maxPadIds, ["legacy.p06"]);
});

test("an endpoint-only legacy tangent deduplicates its two incident segments", () => {
  const report = MapGeometry.analyzeCoverage({
    routes: [routeDescriptor(LEGACY.route)],
    pads: [LEGACY.pads[7]],
    probes: [probe("r20", 20000, ["ground"])],
  }).pads[0].probes[0].routes[0];
  assert.equal(report.exposureSubunits, 0);
  assert.deepEqual(report.windows, []);
  assert.deepEqual(report.tangentContacts, [{
    progressSubunits: 198000000000,
    segmentIds: ["legacy.route.main:s004", "legacy.route.main:s005"],
  }]);
  assert.equal(report.reentryCount, 0);
});

test("report ordering is stable, deeply frozen, canonical-safe, and float-free", () => {
  const a = MapGeometry.compileRoute({ id: "route.a", nodes: [{ column: 0, row: 5 }, { column: 20, row: 5 }] });
  const z = MapGeometry.compileRoute({ id: "route.z", nodes: [{ column: 0, row: 15 }, { column: 20, row: 15 }] });
  const report = MapGeometry.analyzeCoverage({
    routes: [routeDescriptor(z, "air", "z"), routeDescriptor(a, "ground", "a")],
    pads: [MapGeometry.compilePad({ id: "pad.z", column: 10, row: 10 }), MapGeometry.compilePad({ id: "pad.a", column: 10, row: 9 })],
    probes: [probe("z", 22000, ["ground", "air"]), probe("a", 20000, ["ground"])],
  });
  assert.deepEqual(report.pads.map((pad) => pad.id), ["pad.a", "pad.z"]);
  assert.deepEqual(report.pads[0].probes.map((entry) => entry.probeId), ["a", "z"]);
  assert.deepEqual(report.pads[0].probes[1].routes.map((entry) => entry.routeId), ["route.a", "route.z"]);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.pads[0].probes[0].routes), true);
  assert.doesNotThrow(() => canonicalEncode(report));
  assert.doesNotMatch(fs.readFileSync(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-geometry.js"), "utf8"), /Math\.(?:sqrt|hypot)\b/);
});
