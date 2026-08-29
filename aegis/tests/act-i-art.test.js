"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MapIr = require("../../../tools/lib/aegis/map-ir.js");
const ActIArt = require("../js/presentation/act-i-art.js");

const AEGIS_ROOT = path.join(__dirname, "..");
const ROLE_PROOF_CONTEXT = Object.freeze({
  projectionRangeWorldUnits: 22,
  slotComparatorId: "guard-contact-v1",
  contactComparatorId: "guard-contact-v1",
  closedComparatorIds: Object.freeze([
    "base-speed-desc",
    "guard-contact-v1",
    "hp-plus-shields-desc",
    "immutable-enemy-id-asc",
    "remaining-route-distance-asc",
    "secondary-route-front-v1",
    "threat-priority-desc",
  ]),
  eligibleDefenseTagIds: Object.freeze(["area", "control", "direct", "guard", "support"]),
  requireGuardProofs: true,
});

function normalizedMission(id) {
  const source = JSON.parse(fs.readFileSync(
    path.join(AEGIS_ROOT, "content", "maps", id + ".slice-v1.json"),
    "utf8"
  ));
  return MapIr.normalizeMapForV3(source, { roleProofContext: ROLE_PROOF_CONTEXT });
}

function laneSummary(model) {
  return model.road.lanePieces.map(function (lane) {
    return {
      id: lane.laneSegmentId,
      length: lane.lengthMilliUnits,
      centerline: lane.centerlineMilliUnits,
    };
  });
}

test("CommonJS and browser UMD expose one frozen Act I art API", function () {
  assert.equal(typeof ActIArt.createActIArtPresentation, "function");
  assert.ok(Object.isFrozen(ActIArt));
  assert.ok(Object.isFrozen(ActIArt.MISSION_DEFINITIONS));
  assert.ok(Object.isFrozen(ActIArt.MISSION_DEFINITIONS.m04.appearance.core));

  const sandbox = { Game: {} };
  ["camera.js", "road-geometry.js", "act-i-art.js"].forEach(function (filename) {
    const source = fs.readFileSync(path.join(AEGIS_ROOT, "js", "presentation", filename), "utf8");
    vm.runInNewContext(source, sandbox, { filename: filename });
  });
  assert.equal(typeof sandbox.Game.AegisActIArt.createActIArtPresentation, "function");
  assert.ok(Object.isFrozen(sandbox.Game.AegisActIArt));
});

test("M04 binds its route-free harbor plate and world-anchored limestone treatment", function () {
  const map = normalizedMission("m04");
  const before = JSON.stringify(map);
  const model = ActIArt.createActIArtPresentation(map);

  assert.equal(JSON.stringify(map), before, "presentation must not mutate normalized campaign IR");
  assert.deepEqual(model.camera, {
    id: "camera.overscan-16x10-v1",
    x: -18000,
    y: -12000,
    width: 198400,
    height: 124000,
  });
  assert.deepEqual(model.environment, {
    href: "art/v2/m04/environment-piraeus-switchyard-v1.webp",
    widthPx: 2048,
    heightPx: 1280,
    alphaMode: "opaque",
    routeFree: true,
  });
  assert.deepEqual(model.road.asset, {
    href: "art/v2/m04/road-harbor-limestone-v1.webp",
    widthPx: 1024,
    heightPx: 1024,
    alphaMode: "opaque",
  });
  assert.deepEqual(model.road.pattern, {
    kind: "world-anchored",
    originXMilliUnits: 0,
    originYMilliUnits: 0,
    tileMilliUnits: 16000,
  });
  assert.deepEqual(model.road.appearance, {
    ambientOcclusion: { color: "#122c35", opacity: 0.2 },
    shoulder: { color: "#cbbd96", opacity: 0.68 },
    core: { tintColor: "#ddd2ac", opacity: 0.78 },
  });
  assert.deepEqual(model.road.widths, {
    coreMilliUnits: 8000,
    shoulderedMilliUnits: 12000,
    ambientOcclusionMilliUnits: 14000,
  });
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.road.lanePieces[0].centerlineMilliUnits[0]));
});

test("M04 renders three unique physical lanes, the shared trunk once, and one exact merge", function () {
  const model = ActIArt.createActIArtPresentation(normalizedMission("m04"));
  assert.equal(model.road.physicalLaneCount, 3);
  assert.deepEqual(laneSummary(model), [
    {
      id: "lane.north.approach",
      length: 121612,
      centerline: [
        { x: -6000, y: 18000 },
        { x: 34000, y: 18000 },
        { x: 34000, y: 34000 },
        { x: 74000, y: 34000 },
        { x: 94000, y: 50000 },
      ],
    },
    {
      id: "lane.shared.trunk",
      length: 104000,
      centerline: [
        { x: 94000, y: 50000 },
        { x: 118000, y: 50000 },
        { x: 118000, y: 82000 },
        { x: 166000, y: 82000 },
      ],
    },
    {
      id: "lane.south.approach",
      length: 121612,
      centerline: [
        { x: -6000, y: 82000 },
        { x: 34000, y: 82000 },
        { x: 34000, y: 66000 },
        { x: 74000, y: 66000 },
        { x: 94000, y: 50000 },
      ],
    },
  ]);
  assert.equal(model.road.lanePieces.filter(function (lane) {
    return lane.laneSegmentId === "lane.shared.trunk";
  }).length, 1);
  assert.deepEqual(model.road.joinCaps, [{
    id: "join.harbor-merge",
    kind: "merge-cap",
    joinId: "join.harbor-merge",
    centerMilliUnits: { x: 94000, y: 50000 },
    incomingLaneSegmentIds: ["lane.north.approach", "lane.south.approach"],
    outgoingLaneSegmentIds: ["lane.shared.trunk"],
    layerIds: ["surface"],
    renderAfterLaneOrder: 2,
  }]);
  assert.equal(model.road.endCaps.length, 3);
  assert.deepEqual(model.road.crossingPieces, []);
});

test("M05 binds its foundry plate and preserves the one exact physical spiral", function () {
  const map = normalizedMission("m05");
  const before = JSON.stringify(map);
  const model = ActIArt.createActIArtPresentation(map);

  assert.equal(JSON.stringify(map), before);
  assert.deepEqual(model.environment, {
    href: "art/v2/m05/environment-bronze-warden-v1.webp",
    widthPx: 2048,
    heightPx: 1280,
    alphaMode: "opaque",
    routeFree: true,
  });
  assert.deepEqual(model.road.asset, {
    href: "art/v2/m05/road-foundry-blackstone-v1.webp",
    widthPx: 1024,
    heightPx: 1024,
    alphaMode: "opaque",
  });
  assert.deepEqual(model.road.pattern, {
    kind: "world-anchored",
    originXMilliUnits: 0,
    originYMilliUnits: 0,
    tileMilliUnits: 16000,
  });
  assert.deepEqual(model.road.appearance, {
    ambientOcclusion: { color: "#140f12", opacity: 0.26 },
    shoulder: { color: "#5d5145", opacity: 0.58 },
    core: { tintColor: "#74604a", opacity: 0.84 },
  });
  assert.deepEqual(model.road.widths, {
    coreMilliUnits: 8000,
    shoulderedMilliUnits: 12000,
    ambientOcclusionMilliUnits: 14000,
  });
  assert.equal(model.road.physicalLaneCount, 1);
  assert.deepEqual(laneSummary(model), [{
    id: "lane.spiral",
    length: 464000,
    centerline: [
      { x: -6000, y: 18000 },
      { x: 146000, y: 18000 },
      { x: 146000, y: 86000 },
      { x: 22000, y: 86000 },
      { x: 22000, y: 50000 },
      { x: 106000, y: 50000 },
    ],
  }]);
  assert.equal(model.road.endCaps.length, 2);
  assert.deepEqual(model.road.joinCaps, []);
  assert.deepEqual(model.road.crossingPieces, []);
});

test("Act I art rejects non-campaign inputs, unowned missions, and geometry drift", function () {
  assert.throws(function () {
    ActIArt.createActIArtPresentation({ schemaVersion: 1, sourceKind: "campaign", id: "m04" });
  }, /normalized campaign map m04 or m05/i);
  assert.throws(function () {
    ActIArt.createActIArtPresentation({ schemaVersion: 2, sourceKind: "campaign", id: "m06" });
  }, /normalized campaign map m04 or m05/i);

  const drifted = JSON.parse(JSON.stringify(normalizedMission("m05")));
  drifted.id = "m04";
  assert.throws(function () {
    ActIArt.createActIArtPresentation(drifted);
  }, /approved m04 physical-lane contract/i);
});

test("Act I runtime art vocabulary excludes modern road treatments", function () {
  const source = fs.readFileSync(path.join(AEGIS_ROOT, "js", "presentation", "act-i-art.js"), "utf8");
  assert.doesNotMatch(source, /asphalt|center[- ]stripe|highway|modern curb|rubber tire/i);
  assert.match(source, /ancient-road\.harbor-limestone/);
  assert.match(source, /ancient-road\.foundry-blackstone/);
});
