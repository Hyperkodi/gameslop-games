/* Armara Aegis Gate of Dawn presentation model.
   This module owns M01's route-free environment plate and exact ancient-road
   material progression. Simulation and logical routes remain authoritative. */
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
  if (Object.prototype.hasOwnProperty.call(namespace, "AegisM01Art")) {
    throw new Error("Conflicting Game.AegisM01Art is already installed");
  }
  Object.defineProperty(namespace, "AegisM01Art", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (Camera, RoadGeometry) {
  "use strict";

  if (!Camera || !RoadGeometry || typeof RoadGeometry.createRoadRenderPieces !== "function") {
    throw new Error("Gate of Dawn art requires the camera and physical-road presentation modules");
  }

  const APPEARANCE = Object.freeze({
    ambientOcclusionOpacity: 0.18,
    shoulderOpacity: 0.5,
    shoulderTransitionOpacity: 0.62,
    coreTransitionOpacity: 0.78,
    transitionHalfLengthMilliUnits: 3000,
    patternTileMilliUnits: 16000,
  });

  const ASSETS = Object.freeze({
    environment: Object.freeze({
      href: "art/v2/m01/environment-gate-of-dawn-v4.webp",
      widthPx: 2048,
      heightPx: 1280,
    }),
    foundation: Object.freeze({
      href: "art/v2/m01/foundation-attican-v1.webp",
      widthPx: 1024,
      heightPx: 1024,
      alphaMode: "alpha",
    }),
    earth: Object.freeze({
      href: "art/v2/m01/road-earth-v2.webp",
      widthPx: 1024,
      heightPx: 1024,
    }),
    limestone: Object.freeze({
      href: "art/v2/m01/road-limestone-v2.webp",
      widthPx: 1024,
      heightPx: 1024,
    }),
    cityCobble: Object.freeze({
      href: "art/v2/m01/road-city-cobble-v2.webp",
      widthPx: 1024,
      heightPx: 1024,
    }),
  });

  const MATERIAL_SPANS = Object.freeze([
    Object.freeze({
      id: "earth",
      assetKey: "earth",
      styleId: "ancient-road.packed-earth",
      startMilliUnits: 0,
      endMilliUnits: 48000,
      coreOpacity: 0.82,
      tintColor: "#c99b55",
    }),
    Object.freeze({
      id: "limestone",
      assetKey: "limestone",
      styleId: "ancient-road.worn-limestone",
      startMilliUnits: 48000,
      endMilliUnits: 184000,
      coreOpacity: 0.58,
      tintColor: "#d2ba84",
    }),
    Object.freeze({
      id: "city-cobble",
      assetKey: "cityCobble",
      styleId: "ancient-road.city-cobble",
      startMilliUnits: 184000,
      endMilliUnits: 260000,
      coreOpacity: 0.78,
      tintColor: "#c6a96e",
    }),
  ]);

  const TRANSITIONS = Object.freeze([
    Object.freeze({
      id: "earth-to-limestone",
      fromSpanId: "earth",
      toSpanId: "limestone",
      boundaryMilliUnits: 48000,
    }),
    Object.freeze({
      id: "limestone-to-city-cobble",
      fromSpanId: "limestone",
      toSpanId: "city-cobble",
      boundaryMilliUnits: 184000,
    }),
  ]);

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key], visited); });
    return Object.freeze(value);
  }

  function safeInteger(value, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(label + " must be a safe integer and not negative zero");
    }
    return value;
  }

  function interpolate(origin, delta, offset, length, label) {
    const numerator = BigInt(delta) * BigInt(offset);
    const denominator = BigInt(length);
    if (numerator % denominator !== 0n) {
      throw new RangeError(label + " does not land on an exact road coordinate");
    }
    const result = BigInt(origin) + numerator / denominator;
    if (result < BigInt(Number.MIN_SAFE_INTEGER) || result > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError(label + " exceeds the safe-integer range");
    }
    return Number(result);
  }

  function pointAtDistance(segments, distance, totalLength) {
    safeInteger(distance, "Road material boundary");
    if (distance < 0 || distance > totalLength) {
      throw new RangeError("Road material boundary falls outside the physical lane");
    }
    if (distance === totalLength) {
      const finalSegment = segments[segments.length - 1];
      return { x: finalSegment.toX, y: finalSegment.toY };
    }
    const segment = segments.find(function (candidate) {
      return distance >= candidate.start && distance < candidate.start + candidate.length;
    });
    if (!segment) throw new RangeError("Road material boundary does not resolve to a physical segment");
    const offset = distance - segment.start;
    return {
      x: interpolate(segment.fromX, segment.deltaX, offset, segment.length, "Road material x"),
      y: interpolate(segment.fromY, segment.deltaY, offset, segment.length, "Road material y"),
    };
  }

  function samePoint(left, right) {
    return left.x === right.x && left.y === right.y;
  }

  function spanPoints(segments, start, end, totalLength) {
    const points = [pointAtDistance(segments, start, totalLength)];
    segments.forEach(function (segment) {
      const segmentEnd = segment.start + segment.length;
      if (segmentEnd > start && segmentEnd < end) {
        points.push({ x: segment.toX, y: segment.toY });
      }
    });
    const finalPoint = pointAtDistance(segments, end, totalLength);
    if (!samePoint(points[points.length - 1], finalPoint)) points.push(finalPoint);
    if (points.length < 2) throw new RangeError("Every M01 material span must cover physical road length");
    return points;
  }

  function createM01ArtPresentation(map) {
    if (!map || map.schemaVersion !== 2 || map.sourceKind !== "campaign" || map.id !== "m01") {
      throw new TypeError("Gate of Dawn art requires normalized campaign map m01");
    }
    const before = JSON.stringify(map);
    const geometry = RoadGeometry.createRoadRenderPieces(map, {
      ambientOcclusionWidthMilliUnits: RoadGeometry.WIDTHS.maxAmbientOcclusionMilliUnits,
    });
    if (JSON.stringify(map) !== before) throw new Error("Road presentation mutated the normalized M01 map");
    if (geometry.physicalLaneCount !== 1 || geometry.lanePieces.length !== 1) {
      throw new RangeError("Gate of Dawn must render exactly one physical ground lane");
    }
    const lane = geometry.lanePieces[0];
    if (lane.lengthMilliUnits !== 260000) {
      throw new RangeError("Gate of Dawn must retain its approved 260-world-unit road");
    }

    let expectedStart = 0;
    const spans = MATERIAL_SPANS.map(function (definition) {
      RoadGeometry.validateMaterialStyleId(definition.styleId, "M01 road material");
      if (definition.startMilliUnits !== expectedStart || definition.endMilliUnits <= expectedStart) {
        throw new RangeError("M01 road materials must be an exact ordered partition");
      }
      expectedStart = definition.endMilliUnits;
      return {
        id: definition.id,
        assetKey: definition.assetKey,
        asset: ASSETS[definition.assetKey],
        styleId: definition.styleId,
        startMilliUnits: definition.startMilliUnits,
        endMilliUnits: definition.endMilliUnits,
        coreOpacity: definition.coreOpacity,
        tintColor: definition.tintColor,
        pointsMilliUnits: spanPoints(
          lane.subsegments,
          definition.startMilliUnits,
          definition.endMilliUnits,
          lane.lengthMilliUnits
        ),
      };
    });
    if (expectedStart !== lane.lengthMilliUnits) {
      throw new RangeError("M01 road materials must cover the complete physical lane");
    }
    const spanById = new Map(spans.map(function (span) { return [span.id, span]; }));
    const transitions = TRANSITIONS.map(function (definition) {
      const from = spanById.get(definition.fromSpanId);
      const to = spanById.get(definition.toSpanId);
      if (!from || !to || from.endMilliUnits !== definition.boundaryMilliUnits ||
          to.startMilliUnits !== definition.boundaryMilliUnits) {
        throw new RangeError("M01 material transition does not match its exact boundary");
      }
      const start = definition.boundaryMilliUnits - APPEARANCE.transitionHalfLengthMilliUnits;
      const end = definition.boundaryMilliUnits + APPEARANCE.transitionHalfLengthMilliUnits;
      return {
        id: definition.id,
        boundaryMilliUnits: definition.boundaryMilliUnits,
        fromColor: from.tintColor,
        toColor: to.tintColor,
        pointsMilliUnits: spanPoints(lane.subsegments, start, end, lane.lengthMilliUnits),
      };
    });

    return deepFreeze({
      schemaVersion: 1,
      missionId: "m01",
      camera: {
        id: Camera.DEFAULT_CAMERA.id,
        x: Camera.DEFAULT_CAMERA.x,
        y: Camera.DEFAULT_CAMERA.y,
        width: Camera.DEFAULT_CAMERA.width,
        height: Camera.DEFAULT_CAMERA.height,
      },
      environment: {
        href: ASSETS.environment.href,
        widthPx: ASSETS.environment.widthPx,
        heightPx: ASSETS.environment.heightPx,
      },
      foundation: {
        href: ASSETS.foundation.href,
        widthPx: ASSETS.foundation.widthPx,
        heightPx: ASSETS.foundation.heightPx,
        alphaMode: ASSETS.foundation.alphaMode,
      },
      road: {
        centerlineMilliUnits: lane.centerlineMilliUnits.map(function (point) {
          return { x: point.x, y: point.y };
        }),
        widths: {
          coreMilliUnits: geometry.widths.coreMilliUnits,
          shoulderedMilliUnits: geometry.widths.shoulderedMilliUnits,
          ambientOcclusionMilliUnits: geometry.widths.ambientOcclusionMilliUnits,
        },
        appearance: APPEARANCE,
        materialSpans: spans,
        transitions: transitions,
      },
    });
  }

  return deepFreeze({
    VERSION: 1,
    APPEARANCE: APPEARANCE,
    ASSETS: ASSETS,
    MATERIAL_SPANS: MATERIAL_SPANS,
    TRANSITIONS: TRANSITIONS,
    createM01ArtPresentation: createM01ArtPresentation,
  });
});
