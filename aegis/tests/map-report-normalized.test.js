"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const M01_PATH = path.join(__dirname, "..", "content", "maps", "m01.json");
const FIXTURE_ROOT = path.join(__dirname, "fixtures", "maps-v2");
const MapIr = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-ir.js"));
const Report = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-report.js"));
const Validation = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-validation.js"));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fixture(name) {
  return readJson(path.join(FIXTURE_ROOT, name + ".json"));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function occurrences(text, pattern) {
  return (text.match(pattern) || []).length;
}

function assertSafeDeterministicSvg(artifacts, repeated) {
  assert.equal(artifacts.svgBytes.equals(repeated.svgBytes), true);
  assert.equal(artifacts.svgBytes.at(-1), 10);
  assert.equal(artifacts.svgBytes.includes(Buffer.from("\r", "utf8")), false);
  const svg = artifacts.svgBytes.toString("utf8");
  assert.doesNotMatch(svg, /<script\b|\son[a-z]+\s*=|\b(?:href|src)\s*=/i);
  assert.doesNotMatch(svg.replace('xmlns="http://www.w3.org/2000/svg"', ""), /https?:|data:/i);
}

test("legacy map-v1 JSON and SVG artifact bytes remain unchanged", () => {
  const artifacts = Report.createMissionArtifacts(Validation.validateMissionMap(Validation.readMapFile(M01_PATH)));
  assert.equal(sha256(artifacts.reportBytes), "e762dcba8c4be1f0b0382d6256f0f0894c2832b684f13416a3defdc9a34f2196");
  assert.equal(sha256(artifacts.svgBytes), "27618975ac08b57445c59c7d9f3cb2e8b209985cc429a8910b1b2a8fa8ca493b");
});

test("exact M01 map-v1 and map-v2 transcriptions produce identical normalized artifacts", () => {
  const migrated = Report.createNormalizedMapArtifacts(MapIr.normalizeMap(readJson(M01_PATH)));
  const authored = Report.createNormalizedMapArtifacts(MapIr.normalizeMap(fixture("m01-transcription")));

  assert.equal(migrated.reportBytes.equals(authored.reportBytes), true);
  assert.equal(migrated.svgBytes.equals(authored.svgBytes), true);
  assert.equal(Object.isFrozen(migrated), true);
  assert.equal(Object.isFrozen(migrated.report), true);
  assert.equal(Object.isFrozen(migrated.report.laneSegments[0].subsegments[0]), true);
  assert.deepEqual(migrated.report.grid, {
    columns: 40, rows: 25, cellWorldUnits: 4, widthWorldUnits: 160, heightWorldUnits: 100,
  });
  assert.equal(migrated.report.laneSegments.length, 1);
  assert.equal(occurrences(migrated.svgBytes.toString("utf8"), /<g id="pad-/g), 10);
  assert.equal(Report.renderNormalizedHeatmapSvg(migrated.report).equals(migrated.svgBytes), true);
  assertSafeDeterministicSvg(migrated, Report.createNormalizedMapArtifacts(MapIr.normalizeMap(readJson(M01_PATH))));
});

test("shared physical lanes render once even when multiple logical routes traverse them", () => {
  const ir = MapIr.normalizeMap(fixture("shared-trunk"));
  const artifacts = Report.createNormalizedMapArtifacts(ir);
  const report = artifacts.report;
  const svg = artifacts.svgBytes.toString("utf8");

  assert.equal(report.laneSegments.length, 3);
  assert.equal(report.laneSegments.filter(function (lane) { return lane.id === "lane.shared.trunk"; }).length, 1);
  assert.equal(report.routes.filter(function (route) {
    return route.laneSegments.some(function (lane) { return lane.laneSegmentId === "lane.shared.trunk"; });
  }).length, 2);
  assert.equal(occurrences(svg, /data-lane-segment-id="lane\.shared\.trunk"/g), 1);
  assert.equal(occurrences(svg, /data-lane-segment-id=/g), 3);
  assert.equal(occurrences(svg, /<g id="pad-/g), 3);
  assert.match(svg, /3 physical lanes, 2 logical routes, and 3 approved tower pads/);
  assertSafeDeterministicSvg(artifacts, Report.createNormalizedMapArtifacts(MapIr.normalizeMap(fixture("shared-trunk"))));
});

test("air lanes, bridge layers, and overpasses receive deterministic semantic treatments", () => {
  const overpassArtifacts = Report.createNormalizedMapArtifacts(MapIr.normalizeMap(fixture("overpass")));
  const overpassSvg = overpassArtifacts.svgBytes.toString("utf8");
  assert.match(overpassSvg, /data-lane-segment-id="lane\.vertical" data-kind="ground" data-layer="bridge"/);
  assert.match(overpassSvg, /data-crossing-kind="overpass" data-upper-layer="bridge"/);
  assert.ok(overpassSvg.indexOf('id="lane-lane.horizontal"') < overpassSvg.indexOf('id="lane-lane.vertical"'));
  assert.equal(occurrences(overpassSvg, /<g id="pad-/g), 1);
  assertSafeDeterministicSvg(overpassArtifacts, Report.createNormalizedMapArtifacts(MapIr.normalizeMap(fixture("overpass"))));

  const airSource = fixture("overpass");
  airSource.laneSegments[1].kind = "air";
  airSource.routes[1].kind = "air";
  airSource.crossings = [];
  const airArtifacts = Report.createNormalizedMapArtifacts(MapIr.normalizeMap(airSource));
  const airSvg = airArtifacts.svgBytes.toString("utf8");
  assert.match(airSvg, /data-lane-segment-id="lane\.vertical" data-kind="air" data-layer="bridge"/);
  assert.match(airSvg, /stroke="#5be7ff" stroke-width="1\.6" stroke-dasharray="4 2"/);
  assert.doesNotMatch(airSvg, /data-crossing-kind=/);
  assertSafeDeterministicSvg(airArtifacts, Report.createNormalizedMapArtifacts(MapIr.normalizeMap(airSource)));
});
