"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const ArtGuide = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "art-guide.js"));
const MapIr = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-ir.js"));
const { AegisContentError } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "diagnostics.js"));

function m01() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "maps", "m01.json"), "utf8"));
}

function expectDiagnostic(fn, code) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    return true;
  });
}

test("M01 art guide is a deterministic fixed-camera physical-lane model", () => {
  const ir = MapIr.normalizeMap(m01());
  const first = ArtGuide.createArtGuideModel(ir);
  const second = ArtGuide.createArtGuideModel(ir);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(first.camera, {
    id: "camera.overscan-16x10-v1",
    x: -18000,
    y: -12000,
    width: 198400,
    height: 124000,
  });
  assert.deepEqual(first.widths, {
    coreMilliUnits: 8000,
    tacticalMilliUnits: 12000,
    calmMilliUnits: 16000,
    padClearRadiusMilliUnits: 10000,
  });
  assert.equal(first.lanes.length, 1);
  assert.equal(first.airLanes.length, 0);
  assert.deepEqual(first.lanes[0].points, [
    { x: -6000, y: 22000 },
    { x: 46000, y: 22000 },
    { x: 46000, y: 74000 },
    { x: 114000, y: 74000 },
    { x: 114000, y: 38000 },
    { x: 166000, y: 38000 },
  ]);
  assert.equal(first.pads.length, 10);
  assert.equal(first.pads.some(function (pad) { return Object.hasOwn(pad, "declaredQuality"); }), false);
});

test("M01 SVG guide contains each physical lane once and no player strategy data", () => {
  const model = ArtGuide.createArtGuideModel(MapIr.normalizeMap(m01()));
  const first = ArtGuide.renderArtGuideSvg(model);
  const second = ArtGuide.renderArtGuideSvg(model);
  assert.equal(first.equals(second), true);
  const text = first.toString("utf8");
  assert.match(text, /width="2048" height="1280" viewBox="-18 -12 198\.4 124"/);
  assert.equal((text.match(/id="visual-core-lane\.migrated\.route\.main"/g) || []).length, 1);
  assert.match(text, /stroke-width="8"/);
  assert.match(text, /stroke-width="12"/);
  assert.match(text, /stroke-width="16"/);
  assert.doesNotMatch(text, /declaredQuality|strong|standard|specialist|heatmap|best spot/i);
  assert.doesNotMatch(text, /asphalt|lane paint|center stripe/i);
});

test("art guide locks the canonical camera, contains complete clear zones, and enforces road width", () => {
  const ir = MapIr.normalizeMap(m01());
  expectDiagnostic(function () {
    ArtGuide.createArtGuideModel(ir, { id: "camera.bad", x: -18000, y: -12000, width: 198000, height: 124000 });
  }, "ART_GUIDE_CAMERA");
  expectDiagnostic(function () {
    ArtGuide.createArtGuideModel(ir, { id: "camera.small", x: 0, y: 0, width: 160000, height: 100000 });
  }, "ART_GUIDE_CAMERA_IDENTITY");
  const escapedPad = JSON.parse(JSON.stringify(ir));
  escapedPad.pads[0].x = -17000;
  expectDiagnostic(function () { ArtGuide.createArtGuideModel(escapedPad); }, "ART_GUIDE_CAMERA_CONTAINMENT");
  const wrongRoad = Object.assign({}, ir, { road: Object.assign({}, ir.road, { widthMilliUnits: 8000 }) });
  expectDiagnostic(function () { ArtGuide.createArtGuideModel(wrongRoad); }, "ART_GUIDE_ROAD_WIDTH");
});

test("art guide reserves air clearance without painting an air lane as physical road", () => {
  const source = JSON.parse(JSON.stringify(MapIr.normalizeMap(m01())));
  const airLane = JSON.parse(JSON.stringify(source.laneSegments[0]));
  airLane.id = "lane.test.air";
  airLane.kind = "air";
  airLane.layerId = "layer.air";
  airLane.routeIds = ["route.test.air"];
  source.laneSegments.push(airLane);

  const model = ArtGuide.createArtGuideModel(source);
  assert.equal(model.lanes.length, 1);
  assert.equal(model.airLanes.length, 1);
  const svg = ArtGuide.renderArtGuideSvg(model).toString("utf8");
  assert.match(svg, /id="air-clearance-lane\.test\.air"/);
  assert.doesNotMatch(svg, /id="visual-core-lane\.test\.air"/);
  assert.doesNotMatch(svg, /id="tactical-lane\.test\.air"/);
});
