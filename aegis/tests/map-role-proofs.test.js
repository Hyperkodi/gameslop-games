"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURE_PATH = path.join(__dirname, "fixtures", "map-proofs", "valid-role-map.json");
const SHARED_PATH = path.join(__dirname, "fixtures", "maps-v2", "shared-trunk.json");
const M01_PATH = path.join(__dirname, "..", "content", "maps", "m01.json");
const MapIr = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-ir.js"));
const RoleProofs = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-role-proofs.js"));
const Report = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "map-report.js"));
const { canonicalEncode } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "canonical.js"));
const { AegisContentError } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "diagnostics.js"));

const ROLE_CONTEXT = Object.freeze({
  projectionRangeWorldUnits: 20,
  slotComparatorId: "fixture-slot-order",
  contactComparatorId: "fixture-contact-order",
  closedComparatorIds: Object.freeze(["fixture-contact-order", "fixture-slot-order"]),
  eligibleDefenseTagIds: Object.freeze(["control", "support"]),
  requireGuardProofs: true,
});

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
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

test("v2 role proofs compile immutable route-local evidence and complete fixed guard markers", () => {
  const source = fixture();
  const before = canonicalEncode(source);
  const ir = MapIr.normalizeMapForV3(source, { roleProofContext: ROLE_CONTEXT });

  assert.equal(canonicalEncode(source), before);
  assert.equal(ir.roleProofs.length, 4);
  assert.equal(Object.isFrozen(ir.roleProofs[0].markers[0].routeDistances[0]), true);
  assert.deepEqual(ir.roleProofs[0].markers[0], {
    id: "marker.p01.0",
    slotIndex: 0,
    padId: "p01",
    laneSegmentId: "lane.main",
    laneOffset: 20000,
    x: 14000,
    y: 50000,
    tangentX: 172000,
    tangentY: 0,
    routeDistances: [{ routeId: "route.main", routeDistance: 20000, remainingDistance: 152000 }],
  });
  const guard = ir.roleProofs[0];
  assert.equal(guard.slotComparatorId, ROLE_CONTEXT.slotComparatorId);
  assert.equal(guard.contactComparatorId, ROLE_CONTEXT.contactComparatorId);
  const support = ir.roleProofs[3];
  assert.equal(support.mode, "route-status");
  assert.deepEqual(support.routeProofRecords, [{
    routeId: "route.main",
    minimumExposureMilliUnits: 24000,
    expectedCoverageWindowCount: 1,
  }]);
});

test("claimed-route grading rejects zero exposure, unrescued by a high unclaimed route", () => {
  const source = fixture();
  source.pads[0].claimedRouteIds = ["route.missing"];
  diagnostic(function () { MapIr.normalizeMapForV3(source, { roleProofContext: ROLE_CONTEXT }); }, "MAP_ROUTE_REFERENCE");

  const twoRoute = fixture();
  twoRoute.laneSegments.push({
    id: "lane.remote",
    kind: "ground",
    layerId: "bridge",
    nodes: [{ column: -2, row: 22, portal: true }, { column: 41, row: 22, portal: true }],
  });
  twoRoute.routes.push({
    id: "route.remote",
    kind: "ground",
    laneSegmentIds: ["lane.remote"],
    entryAnchorId: "entry.remote",
    gateAnchorId: "gate.remote",
  });
  twoRoute.anchors.splice(1, 0, {
    id: "entry.remote", kind: "entry", column: -2, row: 22,
    laneSegmentId: "lane.remote", routeIds: ["route.remote"],
  });
  twoRoute.anchors.push({
    id: "gate.remote", kind: "gate", column: 41, row: 22,
    laneSegmentId: "lane.remote", routeIds: ["route.remote"],
  });
  twoRoute.probes[0].routeIds.push("route.remote");
  twoRoute.pads[0].claimedRouteIds = ["route.remote"];
  twoRoute.roleProofs = [];
  diagnostic(function () {
    MapIr.normalizeMapV2(twoRoute, { roleProofContext: Object.assign({}, ROLE_CONTEXT, { requireGuardProofs: false }) });
  }, "MAP_CLAIMED_ROUTE_EXPOSURE");
});

test("quality bands and deterministic selection order derive only from claimed routes", () => {
  const quality = fixture();
  quality.pads[0].declaredQuality = "standard";
  diagnostic(function () { MapIr.normalizeMapForV3(quality, { roleProofContext: ROLE_CONTEXT }); }, "MAP_QUALITY_MISMATCH");

  const selection = fixture();
  selection.pads[0].selectionOrder = 1;
  selection.pads[1].selectionOrder = 0;
  diagnostic(function () { MapIr.normalizeMapForV3(selection, { roleProofContext: ROLE_CONTEXT }); }, "MAP_SELECTION_ORDER_DERIVED");

  const ir = MapIr.normalizeMapForV3(fixture(), { roleProofContext: ROLE_CONTEXT });
  assert.deepEqual(ir.analysis.selectionOrderCheck.records, [
    { padId: "p01", selectionOrder: 0, selectionStageBp: 1628, selectionRouteId: "route.main" },
    { padId: "p02", selectionOrder: 1, selectionStageBp: 3953, selectionRouteId: "route.main" },
    { padId: "p03", selectionOrder: 2, selectionStageBp: 6279, selectionRouteId: "route.main" },
  ]);
});

test("friendly-neighbor support proves the exact squared-distance graph and tag catalog", () => {
  const source = fixture();
  source.roleProofs[3] = {
    id: "proof.support.p02",
    kind: "support",
    version: 1,
    padId: "p02",
    rangeWorldUnits: 50,
    eligibleDefenseTagIds: ["support"],
    expectedNeighborPadIds: ["p01", "p03"],
    minimumEligibleNeighborCount: 2,
  };
  const ir = MapIr.normalizeMapForV3(source, { roleProofContext: ROLE_CONTEXT });
  assert.deepEqual(ir.roleProofs[3].expectedNeighborPadIds, ["p01", "p03"]);

  const stale = clone(source);
  stale.roleProofs[3].expectedNeighborPadIds = ["p01"];
  diagnostic(function () { MapIr.normalizeMapForV3(stale, { roleProofContext: ROLE_CONTEXT }); }, "ROLE_PROOF_NEIGHBORS");

  const unknownTag = clone(source);
  unknownTag.roleProofs[3].eligibleDefenseTagIds = ["unknown"];
  diagnostic(function () { MapIr.normalizeMapForV3(unknownTag, { roleProofContext: ROLE_CONTEXT }); }, "ROLE_PROOF_TAG_REFERENCE");
});

test("unknown proof kinds and line, mine, or air intent stay fail-closed", () => {
  for (const intent of ["line", "mine", "air"]) {
    const source = fixture();
    source.pads[0].intent = intent;
    diagnostic(function () { MapIr.normalizeMapForV3(source, { roleProofContext: ROLE_CONTEXT }); }, "ROLE_PROOF_UNIMPLEMENTED");
  }
  const unknown = fixture();
  unknown.roleProofs[0].kind = "future";
  diagnostic(function () { MapIr.normalizeMapForV3(unknown, { roleProofContext: ROLE_CONTEXT }); }, "ROLE_PROOF_UNIMPLEMENTED");
});

test("guard proofs reject range drift, duplicate points, bad shared membership, and short route spacing", () => {
  const range = fixture();
  range.roleProofs[0].projectionRangeWorldUnits = 21;
  diagnostic(function () { MapIr.normalizeMapForV3(range, { roleProofContext: ROLE_CONTEXT }); }, "GUARD_PROJECTION_RANGE");

  const duplicate = fixture();
  duplicate.roleProofs[0].markers[1].laneOffsetMilliUnits = 20000;
  diagnostic(function () { MapIr.normalizeMapForV3(duplicate, { roleProofContext: ROLE_CONTEXT }); }, "GUARD_MARKER_POINT");

  const membership = fixture();
  membership.roleProofs[0].markers[0].routeIds = [];
  diagnostic(function () { MapIr.normalizeMapForV3(membership, { roleProofContext: ROLE_CONTEXT }); }, "MAP_ARRAY");

  const spacing = fixture();
  spacing.roleProofs[0].markers[1].laneOffsetMilliUnits = 27000;
  diagnostic(function () { MapIr.normalizeMapForV3(spacing, { roleProofContext: ROLE_CONTEXT }); }, "GUARD_MARKER_SPACING");

  const duplicateSlot = fixture();
  duplicateSlot.roleProofs[0].markers[1].slotIndex = 0;
  diagnostic(function () { MapIr.normalizeMapForV3(duplicateSlot, { roleProofContext: ROLE_CONTEXT }); }, "GUARD_MARKER_SLOTS");

  const permuted = fixture();
  permuted.roleProofs[0].markers.reverse();
  assert.deepEqual(
    MapIr.normalizeMapForV3(permuted, { roleProofContext: ROLE_CONTEXT }).roleProofs[0].markers.map(function (marker) { return marker.slotIndex; }),
    [0, 1, 2]
  );
});

test("shared-lane guard membership is exact and guard intent can prove two claimed routes", () => {
  const source = JSON.parse(fs.readFileSync(SHARED_PATH, "utf8"));
  source.pads[1].intent = "guard";
  source.roleProofs = [{
    id: "proof.guard.merge",
    kind: "guard",
    version: 1,
    padId: "p02",
    projectionRangeWorldUnits: 26,
    markers: [
      { id: "marker.merge.0", slotIndex: 0, laneSegmentId: "lane.north.approach", laneOffsetMilliUnits: 60000, routeIds: ["route.north"] },
      { id: "marker.merge.1", slotIndex: 1, laneSegmentId: "lane.shared.trunk", laneOffsetMilliUnits: 16000, routeIds: ["route.north", "route.south"] },
      { id: "marker.merge.2", slotIndex: 2, laneSegmentId: "lane.shared.trunk", laneOffsetMilliUnits: 24000, routeIds: ["route.north", "route.south"] },
    ],
  }];
  const context = {
    projectionRangeWorldUnits: 26,
    slotComparatorId: "fixture-slot-order",
    contactComparatorId: "fixture-contact-order",
    closedComparatorIds: ["fixture-contact-order", "fixture-slot-order"],
    eligibleDefenseTagIds: [],
    requireGuardProofs: false,
  };
  const ir = MapIr.normalizeMapV2(source, { roleProofContext: context });
  assert.deepEqual(ir.roleProofs[0].markers[1].routeDistances.map(function (record) { return record.routeId; }), ["route.north", "route.south"]);

  const suppressed = clone(source);
  suppressed.roleProofs[0].markers[1].routeIds = ["route.north"];
  diagnostic(function () { MapIr.normalizeMapV2(suppressed, { roleProofContext: context }); }, "GUARD_MARKER_ROUTES");

  const disconnected = fixture();
  disconnected.pads[1].intent = "guard";
  diagnostic(function () { MapIr.normalizeMapForV3(disconnected, { roleProofContext: ROLE_CONTEXT }); }, "GUARD_INTENT_PROOF");
});

test("guard marker and contact ordering uses forward crossing, exact fractions, and prefilters", () => {
  assert.equal(RoleProofs.forwardCrossedMarker(10, 20, 20), true);
  assert.equal(RoleProofs.forwardCrossedMarker(10, 20, 10), false);
  assert.equal(RoleProofs.forwardCrossedMarker(20, 10, 15), false);

  const contacts = [
    { targetKind: "ground", hardControlBucketOccupied: false, hasResolve: false, otherwiseEligible: true,
      priorRouteDistance: 0, requestedForwardAdvance: 12, markerDistance: 6, routeId: "route.b", markerId: "m2", enemyId: 4 },
    { targetKind: "ground", hardControlBucketOccupied: false, hasResolve: false, otherwiseEligible: true,
      priorRouteDistance: 0, requestedForwardAdvance: 12, markerDistance: 4, routeId: "route.z", markerId: "m9", enemyId: 9 },
    { targetKind: "ground", hardControlBucketOccupied: false, hasResolve: false, otherwiseEligible: true,
      priorRouteDistance: 4, requestedForwardAdvance: 6, markerDistance: 7, routeId: "route.a", markerId: "m1", enemyId: 3 },
    { targetKind: "air", hardControlBucketOccupied: false, hasResolve: false, otherwiseEligible: true,
      priorRouteDistance: 0, requestedForwardAdvance: 12, markerDistance: 1, routeId: "route.a", markerId: "air", enemyId: 1 },
    { targetKind: "ground", hardControlBucketOccupied: true, hasResolve: false, otherwiseEligible: true,
      priorRouteDistance: 0, requestedForwardAdvance: 12, markerDistance: 1, routeId: "route.a", markerId: "occupied", enemyId: 1 },
    { targetKind: "ground", hardControlBucketOccupied: false, hasResolve: true, otherwiseEligible: true,
      priorRouteDistance: 0, requestedForwardAdvance: 12, markerDistance: 1, routeId: "route.a", markerId: "resolve", enemyId: 1 },
    { targetKind: "ground", hardControlBucketOccupied: false, hasResolve: false, otherwiseEligible: false,
      priorRouteDistance: 0, requestedForwardAdvance: 12, markerDistance: 1, routeId: "route.a", markerId: "ineligible", enemyId: 1 },
  ];
  const ordered = RoleProofs.orderGuardContacts(contacts, ROLE_CONTEXT);
  assert.deepEqual(ordered.map(function (item) { return item.markerId; }), ["m9", "m1", "m2"]);
  assert.equal(Object.isFrozen(ordered), true);
  assert.equal(canonicalEncode(RoleProofs.orderGuardContacts(contacts, ROLE_CONTEXT)), canonicalEncode(ordered));

  const sandbox = { contacts: clone(contacts), orderedJson: null };
  vm.runInNewContext(
    "const kernel = (" + RoleProofs.createGuardOrderingKernel.toString() + ")();" +
    "orderedJson = JSON.stringify(kernel.order(contacts));",
    sandbox,
    { filename: "guard-ordering-classic.js" }
  );
  assert.equal(sandbox.orderedJson, JSON.stringify(ordered));
});

test("map-v1 v3 requires an exact supplement and map-v2 forbids one", () => {
  const m01 = JSON.parse(fs.readFileSync(M01_PATH, "utf8"));
  diagnostic(function () { MapIr.normalizeMapForV3(m01, { roleProofContext: Object.assign({}, ROLE_CONTEXT, { requireGuardProofs: false }) }); }, "MAP_PROOF_SUPPLEMENT_REQUIRED");

  const supplement = {
    schemaVersion: 1,
    id: "m01.guard-v1",
    mapId: "m01",
    normalizedMapSchemaVersion: 2,
    roleProofs: [],
  };
  const ir = MapIr.normalizeMapForV3(m01, {
    roleProofContext: Object.assign({}, ROLE_CONTEXT, { requireGuardProofs: false }),
    mapProofSupplement: supplement,
  });
  assert.equal(ir.id, "m01");
  assert.deepEqual(ir.roleProofs, []);

  diagnostic(function () {
    MapIr.normalizeMapForV3(m01, { roleProofContext: ROLE_CONTEXT, mapProofSupplement: supplement });
  }, "ROLE_PROOF_REQUIRED");

  const polluted = clone(supplement);
  polluted.pads = [];
  diagnostic(function () {
    MapIr.normalizeMapForV3(m01, {
      roleProofContext: Object.assign({}, ROLE_CONTEXT, { requireGuardProofs: false }), mapProofSupplement: polluted,
    });
  }, "MAP_UNKNOWN_KEY");

  diagnostic(function () {
    MapIr.normalizeMapForV3(fixture(), { roleProofContext: ROLE_CONTEXT, mapProofSupplement: supplement });
  }, "MAP_PROOF_SUPPLEMENT_FORBIDDEN");
});

test("proof changes affect normalized simulation bytes while normalized reports expose physical provenance", () => {
  const first = MapIr.normalizeMapForV3(fixture(), { roleProofContext: ROLE_CONTEXT });
  const changedSource = fixture();
  changedSource.roleProofs[3].routeProofRecords[0].minimumExposureMilliUnits = 23000;
  const changed = MapIr.normalizeMapForV3(changedSource, { roleProofContext: ROLE_CONTEXT });
  assert.notEqual(canonicalEncode(first), canonicalEncode(changed));

  const route = first.analysis.routeProvenance[0];
  assert.equal(route.laneSegments[0].laneSegmentId, "lane.main");
  assert.equal(route.laneSegments[0].subsegments[0].subsegmentIndex, 0);
  assert.equal(route.laneSegments[0].subsegments[0].layerId, "surface");
  assert.deepEqual(route.laneSegments[0].subsegments[0].sharedRouteIds, ["route.main"]);
  const report = Report.createNormalizedMapReport(first);
  assert.deepEqual(report.routes[0].laneSegments[0].sharedRouteIds, ["route.main"]);
  assert.equal(report.pads[0].probes[0].claimedRoutes[0].routeId, "route.main");
  assert.deepEqual(report.pads[0].probes[0].unclaimedRoutes, []);
});
