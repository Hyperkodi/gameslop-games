/* Armara Aegis deterministic runtime geometry v1.
   Consumes compiler-authored integer milli-unit route records. Runtime queries use only checked
   integer interpolation and squared comparisons: no square roots, hypot, or point projection. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before geometry.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisGeometry")) {
    if (game.AegisGeometry !== api) throw new Error("Game.AegisGeometry is already installed");
    return;
  }
  Object.defineProperty(game, "AegisGeometry", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  ["assertSafeInteger", "checkedAdd", "checkedMultiply", "checkedMulDivFloor", "canonicalEncode"].forEach(
    function (name) {
      if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
    }
  );

  const ROUTE_FIELDS = Object.freeze(["id", "length", "segments"]);
  const SEGMENT_FIELDS = Object.freeze([
    "id", "index", "start", "length", "fromX", "fromY", "toX", "toY", "deltaX", "deltaY",
  ]);
  const ROUTE_SCHEMA = Object.freeze({
    version: 1,
    units: "integer-milli-units",
    routeFields: ROUTE_FIELDS,
    segmentFields: SEGMENT_FIELDS,
  });
  const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

  function exactFields(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const actual = Object.keys(value).sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) { return key !== wanted[index]; })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function stableId(value, label) {
    if (typeof value !== "string" || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable ASCII ID");
    }
    return value;
  }

  function nonnegativeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return value;
  }

  function positiveInteger(value, label) {
    nonnegativeInteger(value, label);
    if (value === 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function checkedDifference(end, start, label) {
    const result = end - start;
    ABI.assertSafeInteger(result, label);
    return result;
  }

  function freezeCompiledRoute(source) {
    ABI.canonicalEncode(source);
    exactFields(source, ROUTE_FIELDS, "Route");
    const routeId = stableId(source.id, "Route ID");
    const declaredLength = positiveInteger(source.length, "Route length");
    if (!Array.isArray(source.segments) || source.segments.length === 0) {
      throw new TypeError("Route segments must be a non-empty array");
    }

    const ids = new Set();
    const segments = [];
    let expectedStart = 0;
    let previousToX = null;
    let previousToY = null;
    for (let index = 0; index < source.segments.length; index++) {
      const input = source.segments[index];
      exactFields(input, SEGMENT_FIELDS, "Segment " + index);
      const id = stableId(input.id, "Segment " + index + " ID");
      if (ids.has(id)) throw new TypeError("Segment IDs must be unique: " + id);
      ids.add(id);
      if (input.index !== index) throw new RangeError("Segment index must equal authored order at " + index);
      const start = nonnegativeInteger(input.start, "Segment " + index + " start");
      const length = positiveInteger(input.length, "Segment " + index + " length");
      if (start !== expectedStart) throw new RangeError("Segment starts must be positive and contiguous at " + index);

      const fromX = ABI.assertSafeInteger(input.fromX, "Segment " + index + " fromX");
      const fromY = ABI.assertSafeInteger(input.fromY, "Segment " + index + " fromY");
      const toX = ABI.assertSafeInteger(input.toX, "Segment " + index + " toX");
      const toY = ABI.assertSafeInteger(input.toY, "Segment " + index + " toY");
      const deltaX = ABI.assertSafeInteger(input.deltaX, "Segment " + index + " deltaX");
      const deltaY = ABI.assertSafeInteger(input.deltaY, "Segment " + index + " deltaY");
      if (deltaX !== checkedDifference(toX, fromX, "Segment " + index + " computed deltaX") ||
          deltaY !== checkedDifference(toY, fromY, "Segment " + index + " computed deltaY")) {
        throw new RangeError("Segment deltas must equal endpoint differences at " + index);
      }
      const displacementSquared = ABI.checkedAdd(
        ABI.checkedMultiply(deltaX, deltaX),
        ABI.checkedMultiply(deltaY, deltaY)
      );
      const lengthSquared = ABI.checkedMultiply(length, length);
      const nextLength = ABI.checkedAdd(length, 1);
      const nextLengthSquared = ABI.checkedMultiply(nextLength, nextLength);
      if (displacementSquared < lengthSquared || displacementSquared >= nextLengthSquared) {
        throw new RangeError("Segment length must equal floor(isqrt(deltaX^2 + deltaY^2)) at " + index);
      }
      if (index > 0 && (fromX !== previousToX || fromY !== previousToY)) {
        throw new RangeError("Segment endpoints must be spatially contiguous at " + index);
      }

      const segment = Object.freeze({
        id: id,
        index: index,
        start: start,
        length: length,
        fromX: fromX,
        fromY: fromY,
        toX: toX,
        toY: toY,
        deltaX: deltaX,
        deltaY: deltaY,
      });
      segments.push(segment);
      expectedStart = ABI.checkedAdd(start, length);
      previousToX = toX;
      previousToY = toY;
    }
    if (expectedStart !== declaredLength) {
      throw new RangeError("Route length must equal the final contiguous segment end");
    }

    return Object.freeze({
      id: routeId,
      length: declaredLength,
      segments: Object.freeze(segments),
    });
  }

  function requireFrozenRoute(route) {
    if (!route || !Object.isFrozen(route) || !Array.isArray(route.segments) ||
        !Object.isFrozen(route.segments) || route.segments.length === 0 ||
        !route.segments.every(Object.isFrozen)) {
      throw new TypeError("Route must be produced by freezeCompiledRoute");
    }
    return route;
  }

  function signedInterpolatedDelta(delta, offset, length) {
    if (delta === 0 || offset === 0) return 0;
    const magnitude = ABI.checkedMulDivFloor(Math.abs(delta), [offset], [length]);
    return delta < 0 ? -magnitude : magnitude;
  }

  function positionOnRoute(route, requestedDistance) {
    requireFrozenRoute(route);
    ABI.assertSafeInteger(requestedDistance, "Route distance");
    const distance = Math.max(0, Math.min(route.length, requestedDistance));
    let segment = route.segments[route.segments.length - 1];
    for (let index = 0; index < route.segments.length; index++) {
      const candidate = route.segments[index];
      const end = ABI.checkedAdd(candidate.start, candidate.length);
      if (distance <= end) {
        segment = candidate;
        break;
      }
    }

    const offset = distance - segment.start;
    const x = ABI.checkedAdd(
      segment.fromX,
      signedInterpolatedDelta(segment.deltaX, offset, segment.length)
    );
    const y = ABI.checkedAdd(
      segment.fromY,
      signedInterpolatedDelta(segment.deltaY, offset, segment.length)
    );
    return Object.freeze({
      routeId: route.id,
      segmentId: segment.id,
      segmentIndex: segment.index,
      distance: distance,
      remainingDistance: route.length - distance,
      x: x,
      y: y,
    });
  }

  function isWithinSquaredRange(originX, originY, targetX, targetY, range) {
    ABI.assertSafeInteger(originX, "Origin X");
    ABI.assertSafeInteger(originY, "Origin Y");
    ABI.assertSafeInteger(targetX, "Target X");
    ABI.assertSafeInteger(targetY, "Target Y");
    nonnegativeInteger(range, "Range");
    const deltaX = checkedDifference(targetX, originX, "Squared-range delta X");
    const deltaY = checkedDifference(targetY, originY, "Squared-range delta Y");
    const distanceSquared = ABI.checkedAdd(
      ABI.checkedMultiply(deltaX, deltaX),
      ABI.checkedMultiply(deltaY, deltaY)
    );
    const rangeSquared = ABI.checkedMultiply(range, range);
    return distanceSquared <= rangeSquared;
  }

  function targetField(candidate, field, label, positive) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new TypeError(label + " must be an object");
    }
    const value = candidate[field];
    ABI.assertSafeInteger(value, label + " " + field);
    if (value < 0 || (positive && value === 0)) {
      throw new RangeError(label + " " + field + (positive ? " must be positive" : " must be nonnegative"));
    }
    return value;
  }

  function compareTargetPriority(left, right) {
    const leftRemaining = targetField(left, "remainingDistance", "Left target", false);
    const rightRemaining = targetField(right, "remainingDistance", "Right target", false);
    if (leftRemaining !== rightRemaining) return leftRemaining < rightRemaining ? -1 : 1;
    const leftThreat = targetField(left, "threatPriority", "Left target", false);
    const rightThreat = targetField(right, "threatPriority", "Right target", false);
    if (leftThreat !== rightThreat) return leftThreat > rightThreat ? -1 : 1;
    const leftId = targetField(left, "id", "Left target", true);
    const rightId = targetField(right, "id", "Right target", true);
    if (leftId === rightId) return 0;
    return leftId < rightId ? -1 : 1;
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    ROUTE_SCHEMA: ROUTE_SCHEMA,
    freezeCompiledRoute: freezeCompiledRoute,
    positionOnRoute: positionOnRoute,
    isWithinSquaredRange: isWithinSquaredRange,
    compareTargetPriority: compareTargetPriority,
  });
});
