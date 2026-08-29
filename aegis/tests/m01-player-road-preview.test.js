"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const MapIr = require("../../../tools/lib/aegis/map-ir.js");
const PlayerRoad = require("../../../tools/lib/aegis/m01-player-road-preview.js");
const RenderTool = require("../../../tools/render-aegis-m01-road-preview.js");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const M01_PATH = path.join(__dirname, "../content/maps/m01.json");

function normalizedM01() {
  return MapIr.normalizeMap(JSON.parse(fs.readFileSync(M01_PATH, "utf8")));
}

function approvedAssets() {
  return RenderTool.loadApprovedAssets(REPO_ROOT);
}

function stripEmbeddedImages(svg) {
  return svg.replace(/data:image\/webp;base64,[A-Za-z0-9+/=]+/g, "EMBEDDED_WEBP");
}

test("approved M01 WebP sources have deterministic production dimensions", function () {
  const assets = approvedAssets();
  assert.deepEqual(assets.environment.dimensions, { width: 2048, height: 1280 });
  ["earth", "limestone", "cityCobble"].forEach(function (key) {
    assert.deepEqual(assets[key].dimensions, { width: 1024, height: 1024 });
    assert.match(assets[key].href, /^data:image\/webp;base64,/);
  });
  assert.equal(Object.isFrozen(assets), true);
  assert.equal(Object.isFrozen(assets.environment.dimensions), true);
});

test("M01 player model uses the fixed camera, one physical lane, and exact material spans", function () {
  const ir = normalizedM01();
  const before = JSON.stringify(ir);
  const model = PlayerRoad.createM01PlayerRoadModel(ir, approvedAssets());

  assert.deepEqual(model.camera, {
    id: "camera.overscan-16x10-v1",
    x: -18000,
    y: -12000,
    width: 198400,
    height: 124000,
  });
  assert.deepEqual(model.output, { widthPx: 2048, heightPx: 1280 });
  assert.equal(model.road.physicalLaneCount, 1);
  assert.deepEqual(model.road.widths, {
    coreMilliUnits: 8000,
    shoulderPerSideMilliUnits: 2000,
    shoulderedMilliUnits: 12000,
    ambientOcclusionMilliUnits: 14000,
  });
  assert.deepEqual(model.road.appearance, {
    ambientOcclusionOpacity: 0.18,
    shoulderOpacity: 0.5,
    shoulderTransitionOpacity: 0.62,
    coreTransitionOpacity: 0.78,
  });
  assert.deepEqual(model.road.centerlineMilliUnits, [
    { x: -6000, y: 22000 },
    { x: 46000, y: 22000 },
    { x: 46000, y: 74000 },
    { x: 114000, y: 74000 },
    { x: 114000, y: 38000 },
    { x: 166000, y: 38000 },
  ]);
  assert.deepEqual(model.road.materialSpans.map(function (span) {
    return {
      id: span.id,
      startMilliUnits: span.startMilliUnits,
      endMilliUnits: span.endMilliUnits,
      pointsMilliUnits: span.pointsMilliUnits,
    };
  }), [
    {
      id: "earth",
      startMilliUnits: 0,
      endMilliUnits: 48000,
      pointsMilliUnits: [{ x: -6000, y: 22000 }, { x: 42000, y: 22000 }],
    },
    {
      id: "limestone",
      startMilliUnits: 48000,
      endMilliUnits: 184000,
      pointsMilliUnits: [
        { x: 42000, y: 22000 },
        { x: 46000, y: 22000 },
        { x: 46000, y: 74000 },
        { x: 114000, y: 74000 },
        { x: 114000, y: 62000 },
      ],
    },
    {
      id: "city-cobble",
      startMilliUnits: 184000,
      endMilliUnits: 260000,
      pointsMilliUnits: [
        { x: 114000, y: 62000 },
        { x: 114000, y: 38000 },
        { x: 166000, y: 38000 },
      ],
    },
  ]);
  assert.deepEqual(model.road.materialSpans.map(function (span) {
    return { id: span.id, coreOpacity: span.coreOpacity, tintColor: span.tintColor };
  }), [
    { id: "earth", coreOpacity: 0.82, tintColor: "#c99b55" },
    { id: "limestone", coreOpacity: 0.58, tintColor: "#d2ba84" },
    { id: "city-cobble", coreOpacity: 0.78, tintColor: "#c6a96e" },
  ]);
  assert.deepEqual(model.road.visualTransitions, [
    {
      id: "earth-to-limestone",
      boundaryMilliUnits: 48000,
      startMilliUnits: 45000,
      endMilliUnits: 51000,
      fromColor: "#c99b55",
      toColor: "#d2ba84",
      pointsMilliUnits: [{ x: 39000, y: 22000 }, { x: 45000, y: 22000 }],
    },
    {
      id: "limestone-to-city-cobble",
      boundaryMilliUnits: 184000,
      startMilliUnits: 181000,
      endMilliUnits: 187000,
      fromColor: "#d2ba84",
      toColor: "#c6a96e",
      pointsMilliUnits: [{ x: 114000, y: 65000 }, { x: 114000, y: 59000 }],
    },
  ]);
  assert.equal(JSON.stringify(ir), before, "preview modeling must not mutate map IR");
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.road.materialSpans[1].pointsMilliUnits[0]), true);
});

test("standalone SVG is byte-deterministic, textured, and contains no player-facing guide leakage", function () {
  const model = PlayerRoad.createM01PlayerRoadModel(normalizedM01(), approvedAssets());
  const first = PlayerRoad.renderM01PlayerRoadSvg(model);
  const second = PlayerRoad.renderM01PlayerRoadSvg(model);
  assert.ok(Buffer.isBuffer(first));
  assert.deepEqual(second, first);

  const svg = first.toString("utf8");
  const markup = stripEmbeddedImages(svg);
  assert.match(markup, /viewBox="-18 -12 198\.4 124"/);
  assert.equal((markup.match(/id="physical-road-m01"/g) || []).length, 1);
  assert.equal((markup.match(/href="#physical-road-m01"/g) || []).length, 1);
  assert.equal((markup.match(/<pattern id="material-/g) || []).length, 3);
  assert.equal((markup.match(/<linearGradient id="transition-gradient-/g) || []).length, 2);
  assert.match(markup, /id="road-ambient-occlusion"[^>]+stroke-opacity="0\.18"[^>]+stroke-width="14"/);
  assert.equal((markup.match(/class="road-shoulder"/g) || []).length, 3);
  assert.equal((markup.match(/class="road-core"/g) || []).length, 3);
  assert.equal((markup.match(/class="road-shoulder-transition"/g) || []).length, 2);
  assert.equal((markup.match(/class="road-core-transition"/g) || []).length, 2);
  assert.match(markup, /class="road-shoulder"[^>]+stroke-width="12"[^>]+opacity="0\.5"/);
  assert.match(markup, /class="road-core" href="#material-span-limestone"[^>]+stroke-width="8"[^>]+opacity="0\.58"/);
  assert.match(markup, /class="road-shoulder-transition"[^>]+stroke-width="12"[^>]+opacity="0\.62"[^>]+data-display-only="true"/);
  assert.match(markup, /class="road-core-transition"[^>]+stroke-width="8"[^>]+opacity="0\.78"[^>]+data-display-only="true"/);
  assert.doesNotMatch(markup, /<text\b|stroke-dasharray|asphalt|center[-_. ]?stripe|route\.main|lane\.migrated|data-pad|pad-clear|production guide/i);
  assert.match(markup, /<title id="title">Gate of Dawn battlefield<\/title>/);
  assert.match(svg, /data:image\/webp;base64,/);
});

test("CLI output equals the pure renderer and remains self-contained", function () {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-m01-road-preview-"));
  const outputPath = path.join(temporaryDirectory, "m01-player-road-preview.svg");
  const writes = [];
  try {
    const returned = RenderTool.main([outputPath], {
      stdout: { write: function (value) { writes.push(String(value)); } },
    });
    assert.equal(returned, outputPath);
    assert.equal(writes.length, 1);
    assert.equal(path.resolve(writes[0].trim()), outputPath);
    const expected = PlayerRoad.renderM01PlayerRoadSvg(
      PlayerRoad.createM01PlayerRoadModel(normalizedM01(), approvedAssets())
    );
    assert.deepEqual(fs.readFileSync(outputPath), expected);
    assert.doesNotMatch(fs.readFileSync(outputPath, "utf8"), /(?:\.\.\/)+games\/aegis\/art/);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
