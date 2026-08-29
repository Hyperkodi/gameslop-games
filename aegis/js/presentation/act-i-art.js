/* Armara Aegis Act I developer-preview art contract for Piraeus Switchyard and
   Bronze Warden. Environment plates stay route-free; exact physical road IR owns
   every visible lane, cap, join, width, and world-anchored material placement. */
(function (root, factory) {
  "use strict";

  const commonJs = typeof module === "object" && module.exports;
  const game = root && root.Game;
  const api = factory(
    commonJs ? require("./camera.js") : game && game.AegisCamera,
    commonJs ? require("./road-geometry.js") : game && game.AegisRoadGeometry
  );
  if (commonJs) {
    module.exports = api;
    return;
  }
  const namespace = root.Game = root.Game || {};
  if (Object.prototype.hasOwnProperty.call(namespace, "AegisActIArt")) {
    throw new Error("Conflicting Game.AegisActIArt is already installed");
  }
  Object.defineProperty(namespace, "AegisActIArt", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (Camera, RoadGeometry) {
  "use strict";

  if (!Camera || !Camera.DEFAULT_CAMERA || !RoadGeometry ||
      typeof RoadGeometry.createRoadRenderPieces !== "function" || !RoadGeometry.WIDTHS) {
    throw new Error("Act I art requires the fixed camera and physical-road presentation modules");
  }

  const PATTERN = Object.freeze({
    kind: "world-anchored",
    originXMilliUnits: 0,
    originYMilliUnits: 0,
    tileMilliUnits: 16000,
  });

  const MISSION_DEFINITIONS = {
    m04: {
      environment: {
        href: "art/v2/m04/environment-piraeus-switchyard-v1.webp",
        widthPx: 2048,
        heightPx: 1280,
        alphaMode: "opaque",
        routeFree: true,
      },
      roadAsset: {
        href: "art/v2/m04/road-harbor-limestone-v1.webp",
        widthPx: 1024,
        heightPx: 1024,
        alphaMode: "opaque",
      },
      materialStyleId: "ancient-road.harbor-limestone",
      appearance: {
        ambientOcclusion: { color: "#122c35", opacity: 0.2 },
        shoulder: { color: "#cbbd96", opacity: 0.68 },
        core: { tintColor: "#ddd2ac", opacity: 0.78 },
      },
      lanes: [
        {
          id: "lane.north.approach",
          lengthMilliUnits: 121612,
          centerlineMilliUnits: [
            { x: -6000, y: 18000 },
            { x: 34000, y: 18000 },
            { x: 34000, y: 34000 },
            { x: 74000, y: 34000 },
            { x: 94000, y: 50000 },
          ],
        },
        {
          id: "lane.shared.trunk",
          lengthMilliUnits: 104000,
          centerlineMilliUnits: [
            { x: 94000, y: 50000 },
            { x: 118000, y: 50000 },
            { x: 118000, y: 82000 },
            { x: 166000, y: 82000 },
          ],
        },
        {
          id: "lane.south.approach",
          lengthMilliUnits: 121612,
          centerlineMilliUnits: [
            { x: -6000, y: 82000 },
            { x: 34000, y: 82000 },
            { x: 34000, y: 66000 },
            { x: 74000, y: 66000 },
            { x: 94000, y: 50000 },
          ],
        },
      ],
      endCapCount: 3,
      merge: {
        id: "join.harbor-merge",
        centerMilliUnits: { x: 94000, y: 50000 },
        incomingLaneSegmentIds: ["lane.north.approach", "lane.south.approach"],
        outgoingLaneSegmentIds: ["lane.shared.trunk"],
      },
    },
    m05: {
      environment: {
        href: "art/v2/m05/environment-bronze-warden-v1.webp",
        widthPx: 2048,
        heightPx: 1280,
        alphaMode: "opaque",
        routeFree: true,
      },
      roadAsset: {
        href: "art/v2/m05/road-foundry-blackstone-v1.webp",
        widthPx: 1024,
        heightPx: 1024,
        alphaMode: "opaque",
      },
      materialStyleId: "ancient-road.foundry-blackstone",
      appearance: {
        ambientOcclusion: { color: "#140f12", opacity: 0.26 },
        shoulder: { color: "#5d5145", opacity: 0.58 },
        core: { tintColor: "#74604a", opacity: 0.84 },
      },
      lanes: [
        {
          id: "lane.spiral",
          lengthMilliUnits: 464000,
          centerlineMilliUnits: [
            { x: -6000, y: 18000 },
            { x: 146000, y: 18000 },
            { x: 146000, y: 86000 },
            { x: 22000, y: 86000 },
            { x: 22000, y: 50000 },
            { x: 106000, y: 50000 },
          ],
        },
      ],
      endCapCount: 2,
      merge: null,
    },
  };

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key], visited); });
    return Object.freeze(value);
  }

  deepFreeze(MISSION_DEFINITIONS);

  function failGeometry(missionId) {
    throw new RangeError("Normalized map does not match the approved " +
      missionId.toUpperCase() + " physical-lane contract");
  }

  function sameStrings(left, right) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every(function (value, index) { return value === right[index]; });
  }

  function samePoints(left, right) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every(function (point, index) {
        return point && point.x === right[index].x && point.y === right[index].y;
      });
  }

  function requireExpectedLaneIds(map, definition) {
    if (!Array.isArray(map.laneSegments) || map.laneSegments.length !== definition.lanes.length) {
      failGeometry(map.id);
    }
    const actualIds = map.laneSegments.map(function (lane) { return lane && lane.id; });
    const expectedIds = definition.lanes.map(function (lane) { return lane.id; });
    if (!sameStrings(actualIds, expectedIds)) failGeometry(map.id);
  }

  function requireExactGeometry(geometry, definition) {
    if (geometry.physicalLaneCount !== definition.lanes.length ||
        geometry.lanePieces.length !== definition.lanes.length ||
        geometry.endCaps.length !== definition.endCapCount ||
        geometry.crossingPieces.length !== 0) {
      failGeometry(geometry.missionId);
    }
    geometry.lanePieces.forEach(function (lane, index) {
      const expected = definition.lanes[index];
      if (lane.laneSegmentId !== expected.id ||
          lane.lengthMilliUnits !== expected.lengthMilliUnits ||
          lane.materialStyleId !== definition.materialStyleId ||
          !samePoints(lane.centerlineMilliUnits, expected.centerlineMilliUnits)) {
        failGeometry(geometry.missionId);
      }
    });
    const expectedWidths = RoadGeometry.WIDTHS;
    if (geometry.widths.coreMilliUnits !== expectedWidths.coreMilliUnits ||
        geometry.widths.shoulderedMilliUnits !== expectedWidths.shoulderedMilliUnits ||
        geometry.widths.ambientOcclusionMilliUnits !== expectedWidths.maxAmbientOcclusionMilliUnits) {
      failGeometry(geometry.missionId);
    }
    if (definition.merge === null) {
      if (geometry.joinCaps.length !== 0) failGeometry(geometry.missionId);
      return;
    }
    if (geometry.joinCaps.length !== 1) failGeometry(geometry.missionId);
    const merge = geometry.joinCaps[0];
    if (merge.id !== definition.merge.id || merge.joinId !== definition.merge.id ||
        merge.kind !== "merge-cap" ||
        merge.centerMilliUnits.x !== definition.merge.centerMilliUnits.x ||
        merge.centerMilliUnits.y !== definition.merge.centerMilliUnits.y ||
        !sameStrings(merge.incomingLaneSegmentIds, definition.merge.incomingLaneSegmentIds) ||
        !sameStrings(merge.outgoingLaneSegmentIds, definition.merge.outgoingLaneSegmentIds)) {
      failGeometry(geometry.missionId);
    }
  }

  function createActIArtPresentation(map) {
    const definition = map && MISSION_DEFINITIONS[map.id];
    if (!map || map.schemaVersion !== 2 || map.sourceKind !== "campaign" || !definition) {
      throw new TypeError("Act I art requires normalized campaign map m04 or m05");
    }
    requireExpectedLaneIds(map, definition);
    const before = JSON.stringify(map);
    const styles = {};
    definition.lanes.forEach(function (lane) { styles[lane.id] = definition.materialStyleId; });
    RoadGeometry.validateMaterialStyleId(definition.materialStyleId, "Act I road material");
    const geometry = RoadGeometry.createRoadRenderPieces(map, {
      ambientOcclusionWidthMilliUnits: RoadGeometry.WIDTHS.maxAmbientOcclusionMilliUnits,
      laneMaterialStyleIds: styles,
    });
    if (JSON.stringify(map) !== before) {
      throw new Error("Physical-road presentation mutated normalized Act I map IR");
    }
    requireExactGeometry(geometry, definition);

    return deepFreeze({
      schemaVersion: 1,
      actIndex: 1,
      missionId: map.id,
      camera: {
        id: Camera.DEFAULT_CAMERA.id,
        x: Camera.DEFAULT_CAMERA.x,
        y: Camera.DEFAULT_CAMERA.y,
        width: Camera.DEFAULT_CAMERA.width,
        height: Camera.DEFAULT_CAMERA.height,
      },
      environment: definition.environment,
      road: {
        asset: definition.roadAsset,
        materialStyleId: definition.materialStyleId,
        pattern: PATTERN,
        widths: {
          coreMilliUnits: geometry.widths.coreMilliUnits,
          shoulderedMilliUnits: geometry.widths.shoulderedMilliUnits,
          ambientOcclusionMilliUnits: geometry.widths.ambientOcclusionMilliUnits,
        },
        appearance: definition.appearance,
        physicalLaneCount: geometry.physicalLaneCount,
        lanePieces: geometry.lanePieces,
        endCaps: geometry.endCaps,
        joinCaps: geometry.joinCaps,
        crossingPieces: geometry.crossingPieces,
      },
    });
  }

  return deepFreeze({
    VERSION: 1,
    PATTERN: PATTERN,
    MISSION_DEFINITIONS: MISSION_DEFINITIONS,
    createActIArtPresentation: createActIArtPresentation,
  });
});
