"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MapIr = require("../../../tools/lib/aegis/map-ir.js");
const M01Art = require("../js/presentation/m01-art.js");

const AEGIS_ROOT = path.join(__dirname, "..");

function normalizedM01() {
  const source = JSON.parse(fs.readFileSync(path.join(AEGIS_ROOT, "content/maps/m01.json"), "utf8"));
  return MapIr.normalizeMap(source);
}

test("CommonJS and browser UMD expose one frozen Gate of Dawn art API", function () {
  assert.equal(typeof M01Art.createM01ArtPresentation, "function");
  assert.ok(Object.isFrozen(M01Art));
  assert.ok(Object.isFrozen(M01Art.ASSETS));

  const sandbox = { Game: {} };
  ["camera.js", "road-geometry.js", "m01-art.js"].forEach(function (filename) {
    const source = fs.readFileSync(path.join(AEGIS_ROOT, "js/presentation", filename), "utf8");
    vm.runInNewContext(source, sandbox, { filename: filename });
  });
  assert.equal(typeof sandbox.Game.AegisM01Art.createM01ArtPresentation, "function");
  assert.ok(Object.isFrozen(sandbox.Game.AegisM01Art));
});

test("M01 binds the fixed camera, route-free plate, and exact ancient material partition", function () {
  const map = normalizedM01();
  const before = JSON.stringify(map);
  const model = M01Art.createM01ArtPresentation(map);

  assert.equal(JSON.stringify(map), before, "presentation must not mutate the normalized map");
  assert.deepEqual(model.camera, {
    id: "camera.overscan-16x10-v1",
    x: -18000,
    y: -12000,
    width: 198400,
    height: 124000,
  });
  assert.deepEqual(model.environment, {
    href: "art/v2/m01/environment-gate-of-dawn-v4.webp",
    widthPx: 2048,
    heightPx: 1280,
  });
  assert.deepEqual(model.foundation, {
    href: "art/v2/m01/foundation-attican-v1.webp",
    widthPx: 1024,
    heightPx: 1024,
    alphaMode: "alpha",
  });
  assert.deepEqual(model.road.widths, {
    coreMilliUnits: 8000,
    shoulderedMilliUnits: 12000,
    ambientOcclusionMilliUnits: 14000,
  });
  assert.deepEqual(model.road.materialSpans.map(function (span) {
    return [span.id, span.startMilliUnits, span.endMilliUnits, span.asset.href];
  }), [
    ["earth", 0, 48000, "art/v2/m01/road-earth-v2.webp"],
    ["limestone", 48000, 184000, "art/v2/m01/road-limestone-v2.webp"],
    ["city-cobble", 184000, 260000, "art/v2/m01/road-city-cobble-v2.webp"],
  ]);
  assert.deepEqual(model.road.materialSpans[0].pointsMilliUnits, [
    { x: -6000, y: 22000 },
    { x: 42000, y: 22000 },
  ]);
  assert.deepEqual(model.road.materialSpans[1].pointsMilliUnits, [
    { x: 42000, y: 22000 },
    { x: 46000, y: 22000 },
    { x: 46000, y: 74000 },
    { x: 114000, y: 74000 },
    { x: 114000, y: 62000 },
  ]);
  assert.deepEqual(model.road.materialSpans[2].pointsMilliUnits, [
    { x: 114000, y: 62000 },
    { x: 114000, y: 38000 },
    { x: 166000, y: 38000 },
  ]);
  assert.deepEqual(model.road.transitions.map(function (transition) {
    return [transition.id, transition.boundaryMilliUnits, transition.pointsMilliUnits];
  }), [
    ["earth-to-limestone", 48000, [{ x: 39000, y: 22000 }, { x: 45000, y: 22000 }]],
    ["limestone-to-city-cobble", 184000, [{ x: 114000, y: 65000 }, { x: 114000, y: 59000 }]],
  ]);
  assert.equal(model.road.appearance.patternTileMilliUnits, 16000);
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.road.materialSpans[0].pointsMilliUnits[0]));
});

test("Gate of Dawn art rejects non-M01 and non-normalized maps", function () {
  assert.throws(function () {
    M01Art.createM01ArtPresentation({ schemaVersion: 2, sourceKind: "campaign", id: "m04" });
  }, /requires normalized campaign map m01/i);
  assert.throws(function () {
    M01Art.createM01ArtPresentation({ schemaVersion: 1, sourceKind: "campaign", id: "m01" });
  }, /requires normalized campaign map m01/i);
});

test("runtime asset and material vocabulary cannot regress to modern-road treatments", function () {
  const source = fs.readFileSync(path.join(AEGIS_ROOT, "js/presentation/m01-art.js"), "utf8");
  assert.doesNotMatch(source, /asphalt|center[- ]stripe|highway|modern curb/i);
  assert.match(source, /ancient-road\.packed-earth/);
  assert.match(source, /ancient-road\.worn-limestone/);
  assert.match(source, /ancient-road\.city-cobble/);
});
