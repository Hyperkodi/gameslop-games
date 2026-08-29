"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const ArtGuide = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "art-guide.js"));
const V3MapAdapter = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "v3-map-adapter.js"));

const DEFENSES_PATH = path.join(REPO_ROOT, "games", "aegis", "content", "defenses", "slice-v1.json");
const RULES_PATH = path.join(REPO_ROOT, "games", "aegis", "content", "campaign-rules", "slice-v1.json");
const RENDERER_PATH = path.join(REPO_ROOT, "tools", "render-aegis-art-guide.js");
const FIXED_CAMERA = Object.freeze({
  id: "camera.overscan-16x10-v1",
  x: -18000,
  y: -12000,
  width: 198400,
  height: 124000,
});

function json(inputPath) {
  return JSON.parse(fs.readFileSync(inputPath, "utf8"));
}

function pathsFor(id) {
  return {
    map: path.join(REPO_ROOT, "games", "aegis", "content", "maps", id + ".slice-v1.json"),
    mission: path.join(REPO_ROOT, "games", "aegis", "content", "missions", id + ".slice-v1.json"),
    output: path.join(REPO_ROOT, "docs", "aegis", "art-guides", id + "-production-guide.svg"),
  };
}

function normalized(id) {
  const inputs = pathsFor(id);
  return V3MapAdapter.normalizeAndValidateMap({
    mapSource: json(inputs.map),
    mission: json(inputs.mission),
    defenses: json(DEFENSES_PATH),
    campaignRules: json(RULES_PATH),
  });
}

function guide(id) {
  return ArtGuide.createArtGuideModel(normalized(id));
}

function svg(model) {
  return ArtGuide.renderArtGuideSvg(model);
}

function count(text, expression) {
  return (text.match(expression) || []).length;
}

test("M04 and M05 normalize through resolved V3 records into the exact fixed camera", function () {
  const m04 = guide("m04");
  const m05 = guide("m05");
  assert.deepEqual(m04.camera, FIXED_CAMERA);
  assert.deepEqual(m05.camera, FIXED_CAMERA);
  assert.deepEqual(m04.output, { widthPx: 2048, heightPx: 1280 });
  assert.deepEqual(m05.output, { widthPx: 2048, heightPx: 1280 });

  assert.deepEqual(m04.lanes.map(function (lane) { return lane.id; }), [
    "lane.north.approach",
    "lane.shared.trunk",
    "lane.south.approach",
  ]);
  assert.deepEqual(m04.lanes[1].points, [
    { x: 94000, y: 50000 },
    { x: 118000, y: 50000 },
    { x: 118000, y: 82000 },
    { x: 166000, y: 82000 },
  ]);
  assert.deepEqual(m04.joins, [{
    id: "join.harbor-merge",
    kind: "merge",
    x: 94000,
    y: 50000,
    incomingLaneSegmentIds: ["lane.north.approach", "lane.south.approach"],
    outgoingLaneSegmentIds: ["lane.shared.trunk"],
  }]);
  assert.equal(m04.pads.length, 10);
  assert.equal(m04.anchors.length, 3);

  assert.deepEqual(m05.lanes.map(function (lane) { return lane.id; }), ["lane.spiral"]);
  assert.deepEqual(m05.lanes[0].points, [
    { x: -6000, y: 18000 },
    { x: 146000, y: 18000 },
    { x: 146000, y: 86000 },
    { x: 22000, y: 86000 },
    { x: 22000, y: 50000 },
    { x: 106000, y: 50000 },
  ]);
  assert.equal(m05.pads.length, 12);
  assert.equal(m05.anchors.length, 2);
  [m04, m05].forEach(function (model) {
    assert.deepEqual(model.airLanes, []);
    assert.deepEqual(model.exclusions, []);
    assert.deepEqual(model.crossings, []);
    model.pads.forEach(function (pad) {
      assert.deepEqual(Object.keys(pad), ["id", "x", "y", "clearRadius"]);
      assert.equal(pad.clearRadius, 10000);
    });
  });
});

test("candidate SVGs render every normalized physical lane once and M04 shared trunk once", function () {
  [["m04", 3], ["m05", 1]].forEach(function (entry) {
    const model = guide(entry[0]);
    const first = svg(model);
    const second = svg(model);
    assert.deepEqual(first, second, entry[0] + " deterministic bytes");
    const text = first.toString("utf8");
    assert.match(text, /width="2048" height="1280" viewBox="-18 -12 198\.4 124"/);
    assert.equal(count(text, /id="visual-core-[^"]+"/g), entry[1]);
    model.lanes.forEach(function (lane) {
      assert.equal(count(text, new RegExp('id="visual-core-' + lane.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"', "g")), 1, lane.id);
    });
  });
  const m04 = svg(guide("m04")).toString("utf8");
  assert.equal(count(m04, /id="visual-core-lane\.shared\.trunk"/g), 1);
  assert.equal(count(m04, /id="tactical-lane\.shared\.trunk"/g), 1);
  assert.equal(count(m04, /id="calm-lane\.shared\.trunk"/g), 1);
});

test("candidate SVGs expose only neutral guide geometry and authored applicable features", function () {
  const m04 = svg(guide("m04")).toString("utf8");
  const m05 = svg(guide("m05")).toString("utf8");
  [[m04, 10, 3], [m05, 12, 2]].forEach(function (entry) {
    assert.match(entry[0], /id="safe-landmark-zone-board"[^>]+data-guide-only="true"/);
    assert.match(entry[0], /id="pad-clear-zones"[^>]+data-guide-only="true" data-semantic="neutral-clear-disk"/);
    assert.equal(count(entry[0], /<circle id="pad-clear-/g), entry[1]);
    assert.equal(count(entry[0], /<g id="anchor-/g), entry[2]);
    assert.match(entry[0], /This image is not player-facing art\.<\/desc>/);
    assert.doesNotMatch(entry[0], /declaredQuality|selectionOrder|claimedRoute|strong|standard|specialist|power|heatmap|best spot|player control/i);
    assert.doesNotMatch(entry[0], /id="air-clearance-|id="exclusion-/);
  });
  assert.equal(count(m04, /id="join-join\.harbor-merge"/g), 1);
  assert.match(m04, /data-kind="merge" data-incoming="lane\.north\.approach lane\.south\.approach" data-outgoing="lane\.shared\.trunk"/);
  assert.doesNotMatch(m05, /id="joins"|id="join-/);
});

test("checked-in Candidate-BAL guides are exact renderer output", function () {
  ["m04", "m05"].forEach(function (id) {
    const expected = svg(guide(id));
    const checkedIn = fs.readFileSync(pathsFor(id).output);
    assert.deepEqual(checkedIn, expected, id);
  });
});

test("CLI resolves explicit V3 context and reproduces both guides", function () {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-candidate-guides-"));
  try {
    ["m04", "m05"].forEach(function (id) {
      const inputs = pathsFor(id);
      const outputPath = path.join(temporaryRoot, id + ".svg");
      const result = childProcess.spawnSync(process.execPath, [
        RENDERER_PATH,
        inputs.map,
        outputPath,
        inputs.mission,
        DEFENSES_PATH,
        RULES_PATH,
      ], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(result.stderr, "");
      assert.equal(path.resolve(result.stdout.trim()), outputPath);
      assert.deepEqual(fs.readFileSync(outputPath), fs.readFileSync(inputs.output));
    });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
