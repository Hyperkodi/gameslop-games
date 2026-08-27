"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const PRODUCTION_CONTENT = path.join(__dirname, "..", "content");
const M01_PATH = path.join(__dirname, "..", "content", "maps", "m01.json");
const LEGACY_PATH = path.join(__dirname, "fixtures", "maps", "legacy-proving-ground.json");
const CLI_PATH = path.join(REPO_ROOT, "tools", "analyze-aegis-map.js");
const Validation = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-validation.js"));
const Report = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-report.js"));
const Geometry = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-geometry.js"));
const MapIr = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-ir.js"));
const Cli = require(CLI_PATH);
const { canonicalEncode } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "canonical.js"));
const { AegisContentError } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "diagnostics.js"));

function freshM01(id) {
  const source = JSON.parse(fs.readFileSync(M01_PATH, "utf8"));
  if (id) source.id = id;
  return source;
}

function temporaryManifestSource(t, sourceReference) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-map-manifest-"));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  fs.cpSync(path.join(PRODUCTION_CONTENT, "abi"), path.join(root, "abi"), { recursive: true });
  fs.copyFileSync(
    path.join(PRODUCTION_CONTENT, "behavior-contracts.json"),
    path.join(root, "behavior-contracts.json")
  );
  const sourcePath = path.join(root, ...sourceReference.split("/"));
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.copyFileSync(M01_PATH, sourcePath);
  fs.writeFileSync(path.join(root, "schema-version.json"), JSON.stringify({
    schemaVersion: 2,
    contentVersion: "manifest-authority-test-2",
    sourceKind: "foundation",
    abiDescriptor: "abi/abi-v1.json",
    behaviorContracts: "behavior-contracts.json",
    missionMaps: [{ id: "m01", source: sourceReference }],
  }, null, 2) + "\n");
  return { root: root, sourcePath: sourcePath };
}

function diagnosticCode(fn, expected) {
  let captured;
  assert.throws(fn, function (error) {
    captured = error;
    assert.ok(error instanceof AegisContentError, error && error.stack);
    assert.equal(error.diagnostics[0].code, expected);
    return true;
  });
  return captured;
}

function probeFor(result, padId, probeId) {
  return result.analysis.pads.find(function (pad) { return pad.id === padId; }).probes.find(function (probe) {
    return probe.probeId === probeId;
  });
}

function overpassSource() {
  const source = freshM01("fixture-overpass");
  const bridge = {
    id: "route.bridge",
    kind: "ground",
    layerId: "bridge",
    nodes: [{ column: 12, row: -2, portal: true }, { column: 12, row: 26, portal: true }],
  };
  source.routes = [bridge, source.routes[0]];
  source.crossings = [{
    id: "cross.bridge-main",
    kind: "overpass",
    routeAId: "route.bridge",
    segmentAIndex: 0,
    routeBId: "route.main",
    segmentBIndex: 2,
    upperLayerId: "bridge",
  }];
  source.anchors = [
    { id: "bridge.entry", kind: "entry", column: 12, row: -2, routeId: "route.bridge" },
    { id: "bridge.gate", kind: "gate", column: 12, row: 26, routeId: "route.bridge" },
    source.anchors[0], source.anchors[1],
  ];
  for (const pad of source.pads) pad.kind = "specialist";
  return source;
}

test("M1 compiles the exact binding route, clearances, stages, and R20/R22/R24 goldens", () => {
  const result = Validation.validateMissionMap(Validation.readMapFile(M01_PATH));
  assert.equal(result.approvalEligible, true);
  assert.equal(result.routes[0].route.length, 260000);
  assert.deepEqual(result.routes[0].nodes, [
    { column: -2, row: 5, portal: true }, { column: 11, row: 5 }, { column: 11, row: 18 },
    { column: 28, row: 18 }, { column: 28, row: 9 }, { column: 41, row: 9, portal: true },
  ]);
  assert.deepEqual(result.anchors.map(function (anchor) { return [anchor.id, anchor.kind, anchor.column, anchor.row]; }), [
    ["entry.west", "entry", -2, 5], ["gate.east", "gate", 41, 9],
  ]);

  const r20 = result.pads.map(function (pad) { return probeFor(result, pad.id, "r20").qualityExposureSubunits; });
  const r22 = result.pads.map(function (pad) { return probeFor(result, pad.id, "r22").qualityExposureSubunits; });
  const r24 = result.pads.map(function (pad) { return probeFor(result, pad.id, "r24").qualityExposureSubunits; });
  assert.deepEqual(r20, Array(10).fill(24000000000));
  assert.deepEqual(r22, [
    30199337740, 29538757784, 30199337740, 48529640518, 30199337740,
    30199337740, 29538757784, 48529640518, 29538757784, 30199337740,
  ]);
  assert.deepEqual(r24, [
    35777087638, 34673153509, 35777087638, 62310085960, 35777087638,
    35777087638, 34673153509, 62310085960, 34673153509, 35777087638,
  ]);
  assert.equal(Geometry.roundAnalysisSubunitsToMilli(30199337740), 30199);
  assert.deepEqual(result.pads.filter(function (pad) { return pad.declaredQuality === "strong"; }).map(function (pad) { return pad.id; }), ["p04", "p08"]);
  assert.deepEqual(result.padChecks.map(function (check) { return check.clearance.minimumLaneClearanceMilliUnits; }), Array(10).fill(16000));
  assert.equal(result.padChecks[4].clearance.minimumPadSpacingMilliUnits, 20000);
  assert.equal(result.padChecks[5].clearance.minimumPadSpacingMilliUnits, 20000);
  assert.equal(result.padChecks[6].clearance.minimumPadSpacingMilliUnits, 20000);
  assert.deepEqual(result.routeStageOrderCheck.stages.map(function (stage) { return stage.meanStageBp; }), [769, 2474, 3385, 4246, 4615, 5385, 6141, 6862, 8474, 9231]);
});

test("M1 report preserves exact merged windows, re-entry, longest window, mean stage, and worst-route evidence", () => {
  const result = Validation.validateMissionMap(Validation.readMapFile(M01_PATH));
  const p04 = probeFor(result, "p04", "r22");
  assert.equal(p04.routes.length, 1);
  assert.equal(p04.totalExposureSubunits, 48529640518);
  assert.equal(p04.worstRouteExposureSubunits, 48529640518);
  assert.equal(p04.routes[0].reentryCount, 1);
  assert.equal(p04.routes[0].longestWindowSubunits, 30199337740);
  assert.equal(p04.routes[0].meanProgressSubunits, 110402312217);
  assert.equal(p04.routes[0].meanStageBp, 4246);
  assert.deepEqual(p04.routes[0].windows.map(function (window) {
    return [window.startSubunits, window.endSubunits, window.segmentIds];
  }), [
    [78834848611, 97165151389, ["route.main:s001"]],
    [108900331130, 139099668870, ["route.main:s002"]],
  ]);
  const p02r20 = probeFor(result, "p02", "r20").routes[0];
  assert.deepEqual(p02r20.tangentContacts, [{ progressSubunits: 52000000000, segmentIds: ["route.main:s000"] }]);
  assert.equal(result.spreadCheck.numeratorSubunits, 48529640518);
  assert.equal(result.spreadCheck.denominatorSubunits, 29538757784);
  assert.equal(BigInt(result.spreadCheck.numeratorSubunits) * 100n <= BigInt(result.spreadCheck.denominatorSubunits) * 165n, true);
});

test("validation returns frozen normalized output without mutating or freezing caller-owned source", () => {
  const source = Validation.readMapFile(M01_PATH);
  const before = canonicalEncode(source);
  const result = Validation.validateMissionMap(source);
  assert.equal(canonicalEncode(source), before);
  assert.equal(Object.isFrozen(source), false);
  assert.equal(Object.isFrozen(source.routes[0].nodes[0]), false);
  assert.equal(Object.isExtensible(source.routes[0].nodes[0]), true);
  assert.notEqual(result.routes[0].nodes[0], source.routes[0].nodes[0]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.routes[0].nodes[0]), true);
  source.routes[0].nodes[0].auditProbe = true;
  assert.equal(result.routes[0].nodes[0].auditProbe, undefined);
});

test("strict exact-key and node validation fail with stable diagnostics", () => {
  const unknown = freshM01("fixture-unknown");
  unknown.board.tiles = 1000;
  diagnosticCode(function () { Validation.validateMissionMap(unknown); }, "MAP_UNKNOWN_KEY");

  const nullNode = freshM01("fixture-null-node");
  nullNode.routes[0].nodes[1] = null;
  const nullError = diagnosticCode(function () { Validation.validateMissionMap(nullNode); }, "MAP_OBJECT");
  assert.equal(nullError.diagnostics[0].path, "/routes/0/nodes/1");

  const noPortal = freshM01("fixture-no-portal");
  delete noPortal.routes[0].nodes[0].portal;
  diagnosticCode(function () { Validation.validateMissionMap(noPortal); }, "MAP_PORTAL");

  const zero = freshM01("fixture-zero");
  zero.routes[0].nodes[2] = { column: 11, row: 5 };
  diagnosticCode(function () { Validation.validateMissionMap(zero); }, "MAP_ZERO_SEGMENT");

  const xmlControl = freshM01("fixture-xml-title");
  xmlControl.title = "Gate\u0001of Dawn";
  diagnosticCode(function () { Validation.validateMissionMap(xmlControl); }, "MAP_STRING_XML");
});

test("M1 binding rejects geometry-neutral node, anchor, layer, and probe drift", () => {
  const nodeFlag = freshM01();
  nodeFlag.routes[0].nodes[1].portal = false;
  diagnosticCode(function () { Validation.validateMissionMap(nodeFlag); }, "MAP_M01_ROUTE");

  const anchorId = freshM01();
  anchorId.anchors[0].id = "entry.west-renamed";
  diagnosticCode(function () { Validation.validateMissionMap(anchorId); }, "MAP_M01_ANCHORS");

  const layer = freshM01();
  layer.routes[0].layerId = "surface-renamed";
  diagnosticCode(function () { Validation.validateMissionMap(layer); }, "MAP_M01_ROUTE");

  const probe = freshM01();
  probe.probes[2].rangeWorldUnits = 25;
  diagnosticCode(function () { Validation.validateMissionMap(probe); }, "MAP_M01_PROBES");
});

test("ordinary-pad inset, lane, spacing, anchor, and exclusion clearances fail closed", () => {
  const lane = freshM01("fixture-lane");
  lane.pads[0].row = 8;
  diagnosticCode(function () { Validation.validateMissionMap(lane); }, "MAP_LANE_CLEARANCE");

  const spacing = freshM01("fixture-spacing");
  spacing.pads[5].column = 19;
  diagnosticCode(function () { Validation.validateMissionMap(spacing); }, "MAP_PAD_SPACING");

  const inset = freshM01("fixture-inset");
  inset.pads[0].column = 1;
  diagnosticCode(function () { Validation.validateMissionMap(inset); }, "MAP_BOARD_INSET");

  const prop = freshM01("fixture-prop");
  prop.anchors.push({ id: "prop.block", kind: "large-prop", column: 3, row: 9 });
  diagnosticCode(function () { Validation.validateMissionMap(prop); }, "MAP_ANCHOR_CLEARANCE");

  const mask = freshM01("fixture-mask");
  mask.exclusions.push({ id: "mask.block", kind: "circle", column: 3, row: 9, radiusWorldUnits: 4 });
  diagnosticCode(function () { Validation.validateMissionMap(mask); }, "MAP_EXCLUSION_CLEARANCE");
});

test("quality bands, entry exposure, spread, intent semantics, and role-probe scope are enforced", () => {
  const quality = freshM01("fixture-quality");
  quality.pads[0].declaredQuality = "strong";
  diagnosticCode(function () { Validation.validateMissionMap(quality); }, "MAP_QUALITY_MISMATCH");

  const exposure = freshM01("fixture-exposure");
  exposure.review.minimumEntryExposureMilliUnits = 30000;
  diagnosticCode(function () { Validation.validateMissionMap(exposure); }, "MAP_ENTRY_EXPOSURE");

  const spread = freshM01("fixture-spread");
  spread.review.maximumSpread.numerator = 164;
  diagnosticCode(function () { Validation.validateMissionMap(spread); }, "MAP_SPREAD");

  const unknown = freshM01("fixture-intent-unknown");
  unknown.pads[0].intent = "teleport";
  diagnosticCode(function () { Validation.validateMissionMap(unknown); }, "MAP_ENUM");

  const mismatch = freshM01("fixture-intent-mismatch");
  mismatch.pads[0].intent = "late";
  diagnosticCode(function () { Validation.validateMissionMap(mismatch); }, "MAP_INTENT_MISMATCH");

  const laterRole = freshM01("fixture-intent-role");
  laterRole.pads[0].intent = "air";
  diagnosticCode(function () { Validation.validateMissionMap(laterRole); }, "MAP_INTENT_PROBE_UNIMPLEMENTED");
});

test("authored pad IDs and quality-probe mean stage must remain in stable order", () => {
  const ids = freshM01("fixture-id-order");
  const swap = ids.pads[0];
  ids.pads[0] = ids.pads[1];
  ids.pads[1] = swap;
  diagnosticCode(function () { Validation.validateMissionMap(ids); }, "MAP_UNSTABLE_ORDER");

  const stages = freshM01("fixture-stage-order");
  for (const key of ["column", "row", "intent", "declaredQuality"]) {
    const value = stages.pads[3][key];
    stages.pads[3][key] = stages.pads[4][key];
    stages.pads[4][key] = value;
  }
  diagnosticCode(function () { Validation.validateMissionMap(stages); }, "MAP_ROUTE_STAGE_ORDER");
});

test("ground routes require declared first-node entry or breach and last-node gate anchors", () => {
  const noGate = freshM01("fixture-no-gate");
  noGate.anchors = [noGate.anchors[0]];
  diagnosticCode(function () { Validation.validateMissionMap(noGate); }, "MAP_ROUTE_GATE");

  const wrongGate = freshM01("fixture-wrong-gate");
  wrongGate.anchors[1].column = 40;
  diagnosticCode(function () { Validation.validateMissionMap(wrongGate); }, "MAP_ANCHOR_ENDPOINT");
});

test("declared overpasses pass while missing, stale, duplicate, and overlapping crossings fail", () => {
  assert.doesNotThrow(function () { Validation.validateMissionMap(overpassSource()); });

  const missing = overpassSource();
  missing.crossings = [];
  diagnosticCode(function () { Validation.validateMissionMap(missing); }, "MAP_UNDECLARED_CROSSING");

  const stale = overpassSource();
  stale.routes[0].nodes = [{ column: 20, row: 0 }, { column: 20, row: 3 }];
  stale.anchors[0].column = 20;
  stale.anchors[0].row = 0;
  stale.anchors[1].column = 20;
  stale.anchors[1].row = 3;
  diagnosticCode(function () { Validation.validateMissionMap(stale); }, "MAP_STALE_CROSSING");

  const duplicate = overpassSource();
  duplicate.crossings.push(Object.assign({}, duplicate.crossings[0], { id: "cross.bridge-main-copy" }));
  diagnosticCode(function () { Validation.validateMissionMap(duplicate); }, "MAP_DUPLICATE_CROSSING");

  const overlap = overpassSource();
  overlap.routes[0].nodes = [{ column: 11, row: 6 }, { column: 11, row: 17 }];
  overlap.anchors[0].column = 11;
  overlap.anchors[0].row = 6;
  overlap.anchors[1].column = 11;
  overlap.anchors[1].row = 17;
  overlap.crossings = [];
  diagnosticCode(function () { Validation.validateMissionMap(overlap); }, "MAP_ROUTE_OVERLAP");
});

test("buffered same-layer near-passes, tight hairpins, exact reversals, and redundant nodes fail", () => {
  const near = overpassSource();
  near.routes[0].layerId = "surface";
  near.routes[0].nodes = [{ column: 12, row: 6 }, { column: 12, row: 15 }];
  near.anchors[0].column = 12;
  near.anchors[0].row = 6;
  near.anchors[1].column = 12;
  near.anchors[1].row = 15;
  near.crossings = [];
  diagnosticCode(function () { Validation.validateMissionMap(near); }, "MAP_LANE_OVERLAP");

  const hairpin = freshM01("fixture-hairpin");
  hairpin.routes[0].nodes = [
    { column: -2, row: 5, portal: true }, { column: 11, row: 5 }, { column: 11, row: 10 },
    { column: 13, row: 10 }, { column: 13, row: 5 }, { column: 38, row: 5 },
    { column: 41, row: 9, portal: true },
  ];
  diagnosticCode(function () { Validation.validateMissionMap(hairpin); }, "MAP_TIGHT_BEND");

  const reversal = freshM01("fixture-reversal");
  reversal.routes[0].nodes.splice(1, 0, { column: 20, row: 5 });
  diagnosticCode(function () { Validation.validateMissionMap(reversal); }, "MAP_TIGHT_BEND");

  const redundant = freshM01("fixture-redundant");
  redundant.routes[0].nodes.splice(1, 0, { column: 5, row: 5 });
  diagnosticCode(function () { Validation.validateMissionMap(redundant); }, "MAP_REDUNDANT_NODE");
});

test("deterministic JSON and script-free SVG artifacts retain rounded evidence and portal convention", () => {
  const validated = Validation.validateMissionMap(Validation.readMapFile(M01_PATH));
  const first = Report.createMissionArtifacts(validated);
  const second = Report.createMissionArtifacts(validated);
  assert.equal(first.reportBytes.equals(second.reportBytes), true);
  assert.equal(first.svgBytes.equals(second.svgBytes), true);
  assert.equal(Object.isFrozen(first.report), true);
  assert.equal(Object.isFrozen(first.report.pads[0].checks), true);
  const parsed = JSON.parse(first.reportBytes.toString("utf8"));
  assert.equal(parsed.approvalEligible, true);
  assert.equal(parsed.policy.endpointAnchorConvention, "off-board-portal-cell-center");
  assert.equal(parsed.policy.roadWidthMilliUnits, 12000);
  assert.equal(parsed.policy.roadHalfWidthMilliUnits, 6000);
  assert.deepEqual(parsed.probes.map(function (probe) {
    return [probe.id, probe.rangeMilliUnits, probe.baselineMilliUnits];
  }), [["r20", 20000, null], ["r22", 22000, 30200], ["r24", 24000, null]]);
  assert.equal(parsed.pads[0].roundedQualityExposureMilliUnits, 30199);
  assert.deepEqual(parsed.routeStageOrderCheck.stages.map(function (stage) { return stage.meanStageBp; }), [769, 2474, 3385, 4246, 4615, 5385, 6141, 6862, 8474, 9231]);
  assert.equal(first.reportBytes.includes(Buffer.from("Infinity")), false);
  const svg = first.svgBytes.toString("utf8");
  assert.match(svg, /viewBox="0 0 160 100"/);
  assert.match(svg, /data-exposure-milli="30199"/);
  assert.doesNotMatch(svg, /<script\b|\son[a-z]+\s*=|\b(?:href|src)\s*=/i);
  assert.doesNotMatch(svg.replace('xmlns="http://www.w3.org/2000/svg"', ""), /https?:|data:/i);
});

test("normalized v2 reports add route-local physical provenance without changing the v1 report mode", () => {
  const sharedPath = path.join(__dirname, "fixtures", "maps-v2", "shared-trunk.json");
  const ir = MapIr.normalizeMap(JSON.parse(fs.readFileSync(sharedPath, "utf8")));
  const report = Report.createNormalizedMapReport(ir);
  assert.equal(report.schemaVersion, 2);
  assert.deepEqual(report.routes[0].laneSegments.map(function (lane) {
    return [lane.laneSegmentId, lane.sharedRouteIds, lane.routeOffset, lane.remainingDistanceAtEnd];
  }), [
    ["lane.north.approach", ["route.north"], 0, 125941],
    ["lane.shared.trunk", ["route.north", "route.south"], 68844, 0],
  ]);
  assert.deepEqual(report.pads[0].probes[0].claimedRoutes.map(function (route) { return route.routeId; }), ["route.north"]);
  assert.deepEqual(report.pads[0].probes[0].unclaimedRoutes.map(function (route) { return route.routeId; }), ["route.south"]);
  assert.equal(Report.renderReportJson(report).equals(Report.renderReportJson(Report.createNormalizedMapReport(ir))), true);
});

test("artifact checks detect a stale JSON report and SVG independently without writing", (t) => {
  const artifacts = Report.createMissionArtifacts(Validation.validateMissionMap(Validation.readMapFile(M01_PATH)));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-map-artifacts-"));
  const reportPath = path.join(temporary, "m01-pad-report.json");
  const svgPath = path.join(temporary, "m01-pad-heatmap.svg");
  t.after(function () { fs.rmSync(temporary, { recursive: true, force: true }); });
  fs.writeFileSync(reportPath, artifacts.reportBytes);
  fs.writeFileSync(svgPath, artifacts.svgBytes);
  assert.doesNotThrow(function () {
    Cli.checkMissionArtifacts("m01", artifacts, { report: reportPath, svg: svgPath });
  });
  fs.appendFileSync(reportPath, " ");
  diagnosticCode(function () {
    Cli.checkMissionArtifacts("m01", artifacts, { report: reportPath, svg: svgPath });
  }, "MAP_ARTIFACT_STALE");
  fs.writeFileSync(reportPath, artifacts.reportBytes);
  fs.appendFileSync(svgPath, "<!-- stale -->\n");
  diagnosticCode(function () {
    Cli.checkMissionArtifacts("m01", artifacts, { report: reportPath, svg: svgPath });
  }, "MAP_ARTIFACT_STALE");
});

test("analyzer discovers only manifest-declared IDs and honors a nonconventional source path", (t) => {
  const fixture = temporaryManifestSource(t, "authored/act-one/gate-of-dawn.source.json");
  const unlistedDirectory = path.join(fixture.root, "maps");
  fs.mkdirSync(unlistedDirectory);
  fs.writeFileSync(path.join(unlistedDirectory, "m02.json"), "{ definitely-not-json\n");

  assert.deepEqual(Cli.listMissionIds(fixture.root), ["m01"]);
  const tree = Cli.campaignSourceTree(fixture.root);
  assert.equal(
    fs.realpathSync(Cli.sourcePathForMission("m01", tree)),
    fs.realpathSync(fixture.sourcePath)
  );
  const loaded = Cli.loadMission("m01", tree);
  const direct = Validation.validateMissionMap(Validation.readMapFile(fixture.sourcePath));
  assert.equal(canonicalEncode(loaded), canonicalEncode(direct));
  assert.equal(Cli.analyzeCampaign("m01", tree).validated, loaded);
  diagnosticCode(function () { Cli.loadMission("m02", tree); }, "MAP_MISSION_MISSING");
});

test("legacy report-only mode reproduces one-based weak/dead 2/5/8 and dominant 6/9", () => {
  const result = Validation.validateLegacyMap(Validation.readMapFile(LEGACY_PATH));
  assert.equal(result.approvalEligible, false);
  assert.equal(result.mode, "report-known-issues");
  assert.deepEqual(result.observedExposureMilliUnits, [30199, 13068, 30199, 27403, 0, 59899, 33941, 5539, 58122, 27928]);
  assert.deepEqual(result.knownIssues.weakOrDeadPadIds, ["legacy.p02", "legacy.p05", "legacy.p08"]);
  assert.deepEqual(result.knownIssues.dominantPadIds, ["legacy.p06", "legacy.p09"]);
  assert.throws(function () { Report.createMissionArtifacts(result); }, /campaign|Legacy|approval/i);
});

test("CLI parsing, exit codes, mission ordering, check modes, and legacy isolation are deterministic", () => {
  assert.deepEqual(Cli.parseArgs(["--mission", "m01", "--check"]), { mission: "m01", all: false, action: "check" });
  assert.deepEqual(Cli.parseArgs(["--all", "--check"]), { mission: null, all: true, action: "check" });
  assert.deepEqual(Cli.parseArgs(["--mission", "legacy-proving-ground", "--report-known-issues"]), {
    mission: "legacy-proving-ground", all: false, action: "report-known-issues",
  });
  let stderr = "";
  const usageStatus = Cli.main(["--mission", "legacy-proving-ground", "--write"], {
    stdout: { write: function () {} }, stderr: { write: function (value) { stderr += value; } },
  });
  assert.equal(usageStatus, 2);
  assert.match(stderr, /report-only/);
  const ids = Cli.listMissionIds();
  assert.deepEqual(ids, ids.slice().sort());
  assert.ok(ids.includes("m01"));

  const commands = [
    ["--mission", "m01", "--check"],
    ["--all", "--check"],
    ["--mission", "legacy-proving-ground", "--report-known-issues"],
  ];
  for (const args of commands) {
    const run = childProcess.spawnSync(process.execPath, [CLI_PATH].concat(args), { cwd: REPO_ROOT, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stderr, "");
  }
  const legacy = childProcess.spawnSync(process.execPath, [CLI_PATH, "--mission", "legacy-proving-ground", "--report-known-issues"], {
    cwd: REPO_ROOT, encoding: "utf8",
  });
  assert.equal(JSON.parse(legacy.stdout).approvalEligible, false);
});
