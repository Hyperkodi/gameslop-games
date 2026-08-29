/* Armara Aegis physical-road presentation geometry v1.
   Consumes normalized map/compiler lane IR. Logical routes are metadata only: each physical lane
   is emitted exactly once, with joins and crossings kept as explicit deterministic render records. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

  const game = root.Game || (root.Game = {});
  if (Object.prototype.hasOwnProperty.call(game, "AegisRoadGeometry")) {
    if (game.AegisRoadGeometry !== api) throw new Error("Game.AegisRoadGeometry is already installed");
    return;
  }
  Object.defineProperty(game, "AegisRoadGeometry", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HAS_OWN = Object.prototype.hasOwnProperty;
  const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
  const DEFAULT_MATERIAL_STYLE_ID = "ancient-road.vector-fallback";
  const OPTION_KEYS = Object.freeze([
    "ambientOcclusionWidthMilliUnits",
    "laneMaterialStyleIds",
    "materialStyleId",
  ]);
  const WIDTHS = Object.freeze({
    coreWorldUnits: 8,
    coreMilliUnits: 8000,
    shoulderedWorldUnits: 12,
    shoulderedMilliUnits: 12000,
    shoulderPerSideWorldUnits: 2,
    shoulderPerSideMilliUnits: 2000,
    maxAmbientOcclusionWorldUnits: 14,
    maxAmbientOcclusionMilliUnits: 14000,
  });

  function hasOwn(value, key) {
    return HAS_OWN.call(value, key);
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function plainRecord(value, label) {
    if (!isPlainRecord(value)) throw new TypeError(label + " must be a plain object");
    return value;
  }

  function stableId(value, label) {
    if (typeof value !== "string" || value.length > 128 || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable ASCII ID of at most 128 characters");
    }
    return value;
  }

  function safeInteger(value, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(label + " must be a safe integer and not negative zero");
    }
    return value;
  }

  function nonnegativeInteger(value, label) {
    safeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return value;
  }

  function positiveInteger(value, label) {
    nonnegativeInteger(value, label);
    if (value === 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function checkedAdd(left, right, label) {
    const result = BigInt(left) + BigInt(right);
    if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError(label + " exceeds the safe-integer range");
    }
    return Number(result);
  }

  function checkedNegate(value, label) {
    const result = -BigInt(value);
    if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError(label + " exceeds the safe-integer range");
    }
    return Number(result);
  }

  function asciiCompare(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key], visited); });
    return Object.freeze(value);
  }

  function sortedUniqueIds(value, label, allowEmpty) {
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
      throw new TypeError(label + " must be " + (allowEmpty ? "an" : "a nonempty") + " array");
    }
    const copy = value.map(function (item, index) {
      return stableId(item, label + "[" + index + "]");
    }).sort(asciiCompare);
    for (let index = 1; index < copy.length; index += 1) {
      if (copy[index] === copy[index - 1]) throw new TypeError(label + " must not contain duplicate IDs");
    }
    return copy;
  }

  function validateMaterialStyleId(value, label) {
    const styleId = stableId(value, label || "materialStyleId");
    const lower = styleId.toLowerCase();
    const compact = lower.replace(/[._:-]/g, "");
    let forbidden = null;
    if (lower.indexOf("asphalt") !== -1) forbidden = "asphalt";
    else if (lower.indexOf("tarmac") !== -1) forbidden = "tarmac";
    else if (compact.indexOf("centerstripe") !== -1 || compact.indexOf("centrestripe") !== -1 ||
             compact.indexOf("centerline") !== -1 || compact.indexOf("centreline") !== -1) {
      forbidden = "center-stripe";
    } else if (compact.indexOf("moderncurb") !== -1 || compact.indexOf("highwaycurb") !== -1) {
      forbidden = "modern-curb";
    }
    if (forbidden !== null) {
      throw new RangeError((label || "materialStyleId") + " contains forbidden road treatment " + forbidden);
    }
    if (lower.indexOf("ancient-road.") !== 0) {
      throw new RangeError((label || "materialStyleId") + " must use the ancient-road namespace");
    }
    return styleId;
  }

  function normalizedOptions(value) {
    const options = value === undefined ? {} : plainRecord(value, "options");
    Object.keys(options).forEach(function (key) {
      if (OPTION_KEYS.indexOf(key) === -1) throw new TypeError("Unknown road presentation option " + key);
    });
    const defaultStyleId = validateMaterialStyleId(
      hasOwn(options, "materialStyleId") ? options.materialStyleId : DEFAULT_MATERIAL_STYLE_ID,
      "options.materialStyleId"
    );
    const ambientOcclusionWidthMilliUnits = hasOwn(options, "ambientOcclusionWidthMilliUnits") ?
      safeInteger(options.ambientOcclusionWidthMilliUnits, "options.ambientOcclusionWidthMilliUnits") :
      WIDTHS.maxAmbientOcclusionMilliUnits;
    if (ambientOcclusionWidthMilliUnits < WIDTHS.shoulderedMilliUnits ||
        ambientOcclusionWidthMilliUnits > WIDTHS.maxAmbientOcclusionMilliUnits) {
      throw new RangeError("Ambient occlusion width must be between 12000 and 14000 milli-units");
    }
    const laneStyles = new Map();
    if (hasOwn(options, "laneMaterialStyleIds")) {
      const source = plainRecord(options.laneMaterialStyleIds, "options.laneMaterialStyleIds");
      Object.keys(source).sort(asciiCompare).forEach(function (laneId) {
        stableId(laneId, "options.laneMaterialStyleIds key");
        laneStyles.set(laneId, validateMaterialStyleId(
          source[laneId],
          "options.laneMaterialStyleIds[" + laneId + "]"
        ));
      });
    }
    return {
      defaultStyleId: defaultStyleId,
      ambientOcclusionWidthMilliUnits: ambientOcclusionWidthMilliUnits,
      laneStyles: laneStyles,
    };
  }

  function inputRoadWidth(input) {
    const widths = [];
    if (isPlainRecord(input.policy) && hasOwn(input.policy, "roadWidthMilliUnits")) {
      widths.push(safeInteger(input.policy.roadWidthMilliUnits, "map.policy.roadWidthMilliUnits"));
    }
    if (isPlainRecord(input.road) && hasOwn(input.road, "widthMilliUnits")) {
      widths.push(safeInteger(input.road.widthMilliUnits, "map.road.widthMilliUnits"));
    }
    if (widths.length === 0) {
      throw new TypeError("Normalized map IR must declare road width in policy or road");
    }
    if (widths.some(function (width) { return width !== WIDTHS.shoulderedMilliUnits; })) {
      throw new RangeError("Normalized road width must be exactly 12000 milli-units including shoulders");
    }
    return widths[0];
  }

  function segmentSource(lane, label) {
    if (Array.isArray(lane.subsegments)) return lane.subsegments;
    if (isPlainRecord(lane.compiled) && Array.isArray(lane.compiled.subsegments)) {
      return lane.compiled.subsegments;
    }
    throw new TypeError(label + " must provide subsegments or compiled.subsegments");
  }

  function laneLength(lane, label) {
    if (hasOwn(lane, "lengthMilliUnits")) {
      return positiveInteger(lane.lengthMilliUnits, label + ".lengthMilliUnits");
    }
    if (isPlainRecord(lane.compiled) && hasOwn(lane.compiled, "length")) {
      return positiveInteger(lane.compiled.length, label + ".compiled.length");
    }
    throw new TypeError(label + " must provide lengthMilliUnits or compiled.length");
  }

  function normalizedSegment(value, index, expectedStart, priorEnd, generatedId, label) {
    const segment = plainRecord(value, label);
    if (safeInteger(segment.index, label + ".index") !== index) {
      throw new RangeError(label + ".index must match physical subsegment order");
    }
    const id = hasOwn(segment, "id") ? stableId(segment.id, label + ".id") : generatedId;
    const start = nonnegativeInteger(segment.start, label + ".start");
    const length = positiveInteger(segment.length, label + ".length");
    if (start !== expectedStart) throw new RangeError(label + ".start must be contiguous");
    const fromX = safeInteger(segment.fromX, label + ".fromX");
    const fromY = safeInteger(segment.fromY, label + ".fromY");
    const toX = safeInteger(segment.toX, label + ".toX");
    const toY = safeInteger(segment.toY, label + ".toY");
    const deltaX = safeInteger(segment.deltaX, label + ".deltaX");
    const deltaY = safeInteger(segment.deltaY, label + ".deltaY");
    if (BigInt(toX) - BigInt(fromX) !== BigInt(deltaX) ||
        BigInt(toY) - BigInt(fromY) !== BigInt(deltaY)) {
      throw new RangeError(label + " delta must exactly match its endpoints");
    }
    if (deltaX === 0 && deltaY === 0) throw new RangeError(label + " must have distinct endpoints");
    if (priorEnd && (priorEnd.x !== fromX || priorEnd.y !== fromY)) {
      throw new RangeError(label + " must begin at the previous physical subsegment endpoint");
    }
    return {
      output: {
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
      },
      nextStart: checkedAdd(start, length, label + " end distance"),
      end: { x: toX, y: toY },
    };
  }

  function normalizedLane(value, index, options) {
    const label = "map.laneSegments[" + index + "]";
    const lane = plainRecord(value, label);
    const id = stableId(lane.id, label + ".id");
    if (lane.kind !== "ground" && lane.kind !== "air") {
      throw new RangeError(label + ".kind must be ground or air");
    }
    const layerId = stableId(lane.layerId, label + ".layerId");
    const routeIds = sortedUniqueIds(lane.routeIds, label + ".routeIds", false);
    const source = segmentSource(lane, label);
    if (source.length === 0) throw new TypeError(label + " must contain at least one physical subsegment");
    const lengthMilliUnits = laneLength(lane, label);
    const subsegments = [];
    const centerlineMilliUnits = [];
    let expectedStart = 0;
    let priorEnd = null;
    source.forEach(function (item, segmentIndex) {
      const normalized = normalizedSegment(
        item,
        segmentIndex,
        expectedStart,
        priorEnd,
        id + ".subsegment." + segmentIndex,
        label + ".subsegments[" + segmentIndex + "]"
      );
      if (segmentIndex === 0) {
        centerlineMilliUnits.push({ x: normalized.output.fromX, y: normalized.output.fromY });
      }
      centerlineMilliUnits.push({ x: normalized.output.toX, y: normalized.output.toY });
      subsegments.push(normalized.output);
      expectedStart = normalized.nextStart;
      priorEnd = normalized.end;
    });
    if (expectedStart !== lengthMilliUnits) {
      throw new RangeError(label + " length does not match its physical subsegments");
    }
    return {
      id: id,
      kind: lane.kind,
      layerId: layerId,
      routeIds: routeIds,
      lengthMilliUnits: lengthMilliUnits,
      subsegments: subsegments,
      centerlineMilliUnits: centerlineMilliUnits,
      materialStyleId: options.laneStyles.has(id) ? options.laneStyles.get(id) : options.defaultStyleId,
    };
  }

  function geometrySignature(lane) {
    const forward = lane.centerlineMilliUnits.map(function (point) { return point.x + "," + point.y; }).join(";");
    const reverse = lane.centerlineMilliUnits.slice().reverse().map(function (point) {
      return point.x + "," + point.y;
    }).join(";");
    return lane.kind + "|" + lane.layerId + "|" + (forward < reverse ? forward : reverse);
  }

  function normalizePhysicalLanes(input, options) {
    if (!Array.isArray(input.laneSegments) || input.laneSegments.length === 0) {
      throw new TypeError("Normalized map IR must contain physical laneSegments");
    }
    const lanes = input.laneSegments.map(function (lane, index) {
      return normalizedLane(lane, index, options);
    });
    const ids = new Set();
    const signatures = new Map();
    lanes.forEach(function (lane) {
      if (ids.has(lane.id)) throw new TypeError("Physical lane ID " + lane.id + " is duplicated");
      ids.add(lane.id);
      const signature = geometrySignature(lane);
      if (signatures.has(signature)) {
        throw new TypeError("Physical road geometry is duplicated by " + signatures.get(signature) + " and " + lane.id);
      }
      signatures.set(signature, lane.id);
    });
    options.laneStyles.forEach(function (_styleId, laneId) {
      if (!ids.has(laneId)) throw new TypeError("Material style override references unknown lane " + laneId);
    });
    return lanes;
  }

  function normalizeCrossings(input, laneById) {
    if (!Array.isArray(input.crossings)) throw new TypeError("map.crossings must be an array");
    const ids = new Set();
    const edges = [];
    const pieces = input.crossings.map(function (value, index) {
      const label = "map.crossings[" + index + "]";
      const crossing = plainRecord(value, label);
      const id = stableId(crossing.id, label + ".id");
      if (ids.has(id)) throw new TypeError("Crossing ID " + id + " is duplicated");
      ids.add(id);
      if (crossing.kind !== "at-grade" && crossing.kind !== "overpass") {
        throw new RangeError(label + ".kind must be at-grade or overpass");
      }
      const laneAId = stableId(crossing.laneAId, label + ".laneAId");
      const laneBId = stableId(crossing.laneBId, label + ".laneBId");
      if (laneAId === laneBId) throw new RangeError(label + " must reference two distinct physical lanes");
      const laneA = laneById.get(laneAId);
      const laneB = laneById.get(laneBId);
      if (!laneA || !laneB) throw new RangeError(label + " references an unknown physical lane");
      if (laneA.kind !== "ground" || laneB.kind !== "ground") {
        throw new RangeError(label + " may only reference ground road lanes");
      }
      const indexA = nonnegativeInteger(crossing.subsegmentAIndex, label + ".subsegmentAIndex");
      const indexB = nonnegativeInteger(crossing.subsegmentBIndex, label + ".subsegmentBIndex");
      if (indexA >= laneA.subsegments.length || indexB >= laneB.subsegments.length) {
        throw new RangeError(label + " references an unknown physical subsegment");
      }
      if (crossing.kind === "at-grade") {
        if (laneA.layerId !== laneB.layerId) {
          throw new RangeError(label + " at-grade lanes must share one layer");
        }
        if (hasOwn(crossing, "upperLayerId")) {
          throw new RangeError(label + " at-grade crossing must not declare upperLayerId");
        }
        const ordered = [{ lane: laneA, index: indexA }, { lane: laneB, index: indexB }].sort(function (left, right) {
          return asciiCompare(left.lane.id, right.lane.id);
        });
        return {
          id: id,
          kind: "at-grade-crossing",
          laneASegmentId: ordered[0].lane.id,
          laneASubsegmentIndex: ordered[0].index,
          laneBSegmentId: ordered[1].lane.id,
          laneBSubsegmentIndex: ordered[1].index,
          layerId: laneA.layerId,
        };
      }
      const upperLayerId = stableId(crossing.upperLayerId, label + ".upperLayerId");
      if (laneA.layerId === laneB.layerId) {
        throw new RangeError(label + " overpass lanes must use distinct layers");
      }
      let upper;
      let lower;
      if (laneA.layerId === upperLayerId) {
        upper = { lane: laneA, index: indexA };
        lower = { lane: laneB, index: indexB };
      } else if (laneB.layerId === upperLayerId) {
        upper = { lane: laneB, index: indexB };
        lower = { lane: laneA, index: indexA };
      } else {
        throw new RangeError(label + ".upperLayerId must name one crossing lane layer");
      }
      edges.push({ lowerId: lower.lane.id, upperId: upper.lane.id });
      return {
        id: id,
        kind: "overpass-crossing",
        lowerLaneSegmentId: lower.lane.id,
        lowerSubsegmentIndex: lower.index,
        lowerLayerId: lower.lane.layerId,
        upperLaneSegmentId: upper.lane.id,
        upperSubsegmentIndex: upper.index,
        upperLayerId: upper.lane.layerId,
      };
    });
    pieces.sort(function (left, right) { return asciiCompare(left.id, right.id); });
    return { pieces: pieces, edges: edges };
  }

  function orderedGroundLanes(lanes, edges) {
    const ground = lanes.filter(function (lane) { return lane.kind === "ground"; });
    if (ground.length === 0) throw new RangeError("Normalized map IR contains no ground road lanes");
    const laneById = new Map(ground.map(function (lane) { return [lane.id, lane]; }));
    const outgoing = new Map(ground.map(function (lane) { return [lane.id, new Set()]; }));
    const indegree = new Map(ground.map(function (lane) { return [lane.id, 0]; }));
    edges.forEach(function (edge) {
      if (!laneById.has(edge.lowerId) || !laneById.has(edge.upperId)) {
        throw new RangeError("Crossing layer order references a non-road lane");
      }
      if (!outgoing.get(edge.lowerId).has(edge.upperId)) {
        outgoing.get(edge.lowerId).add(edge.upperId);
        indegree.set(edge.upperId, indegree.get(edge.upperId) + 1);
      }
    });
    function compareLaneIds(leftId, rightId) {
      const left = laneById.get(leftId);
      const right = laneById.get(rightId);
      const layer = asciiCompare(left.layerId, right.layerId);
      return layer === 0 ? asciiCompare(left.id, right.id) : layer;
    }
    const ready = ground.filter(function (lane) { return indegree.get(lane.id) === 0; })
      .map(function (lane) { return lane.id; }).sort(compareLaneIds);
    const ordered = [];
    while (ready.length > 0) {
      const laneId = ready.shift();
      ordered.push(laneById.get(laneId));
      Array.from(outgoing.get(laneId)).sort(compareLaneIds).forEach(function (upperId) {
        const next = indegree.get(upperId) - 1;
        indegree.set(upperId, next);
        if (next === 0) {
          ready.push(upperId);
          ready.sort(compareLaneIds);
        }
      });
    }
    if (ordered.length !== ground.length) throw new RangeError("Overpass declarations create a cyclic layer order");
    return ordered;
  }

  function joinCenter(join, label) {
    if (hasOwn(join, "centerMilliUnits")) {
      const center = plainRecord(join.centerMilliUnits, label + ".centerMilliUnits");
      return {
        x: safeInteger(center.x, label + ".centerMilliUnits.x"),
        y: safeInteger(center.y, label + ".centerMilliUnits.y"),
      };
    }
    return {
      x: safeInteger(join.x, label + ".x"),
      y: safeInteger(join.y, label + ".y"),
    };
  }

  function samePoint(left, right) {
    return left.x === right.x && left.y === right.y;
  }

  function normalizeJoins(input, laneById, laneOrder) {
    if (!Array.isArray(input.joins)) throw new TypeError("map.joins must be an array");
    const ids = new Set();
    const connectedEnds = new Set();
    const caps = [];
    input.joins.forEach(function (value, index) {
      const label = "map.joins[" + index + "]";
      const join = plainRecord(value, label);
      const id = stableId(join.id, label + ".id");
      if (ids.has(id)) throw new TypeError("Join ID " + id + " is duplicated");
      ids.add(id);
      if (join.kind !== "continuation" && join.kind !== "merge" && join.kind !== "split") {
        throw new RangeError(label + ".kind must be continuation, merge, or split");
      }
      const incomingIds = sortedUniqueIds(join.incomingLaneSegmentIds, label + ".incomingLaneSegmentIds", false);
      const outgoingIds = sortedUniqueIds(join.outgoingLaneSegmentIds, label + ".outgoingLaneSegmentIds", false);
      if ((join.kind === "continuation" && (incomingIds.length !== 1 || outgoingIds.length !== 1)) ||
          (join.kind === "merge" && (incomingIds.length < 2 || outgoingIds.length !== 1)) ||
          (join.kind === "split" && (incomingIds.length !== 1 || outgoingIds.length < 2))) {
        throw new RangeError(label + " has invalid " + join.kind + " arity");
      }
      const allIds = incomingIds.concat(outgoingIds);
      if (new Set(allIds).size !== allIds.length) throw new RangeError(label + " must not reuse one lane on both sides");
      const members = allIds.map(function (laneId) {
        const lane = laneById.get(laneId);
        if (!lane) throw new RangeError(label + " references unknown physical lane " + laneId);
        return lane;
      });
      const allAir = members.every(function (lane) { return lane.kind === "air"; });
      const allGround = members.every(function (lane) { return lane.kind === "ground"; });
      if (!allAir && !allGround) throw new RangeError(label + " must not join ground and air lanes");
      const center = joinCenter(join, label);
      incomingIds.forEach(function (laneId) {
        const lane = laneById.get(laneId);
        const segment = lane.subsegments[lane.subsegments.length - 1];
        if (!samePoint(center, { x: segment.toX, y: segment.toY })) {
          throw new RangeError(label + " center must equal incoming lane " + laneId + " endpoint");
        }
        const key = laneId + "|end";
        if (connectedEnds.has(key)) throw new RangeError("Physical lane endpoint " + key + " belongs to multiple joins");
        connectedEnds.add(key);
      });
      outgoingIds.forEach(function (laneId) {
        const lane = laneById.get(laneId);
        const segment = lane.subsegments[0];
        if (!samePoint(center, { x: segment.fromX, y: segment.fromY })) {
          throw new RangeError(label + " center must equal outgoing lane " + laneId + " start point");
        }
        const key = laneId + "|start";
        if (connectedEnds.has(key)) throw new RangeError("Physical lane endpoint " + key + " belongs to multiple joins");
        connectedEnds.add(key);
      });
      if (allAir) return;
      const layerIds = Array.from(new Set(members.map(function (lane) { return lane.layerId; }))).sort(asciiCompare);
      const renderAfterLaneOrder = Math.max.apply(null, allIds.map(function (laneId) { return laneOrder.get(laneId); }));
      caps.push({
        id: id,
        kind: join.kind + "-cap",
        joinId: id,
        centerMilliUnits: center,
        incomingLaneSegmentIds: incomingIds,
        outgoingLaneSegmentIds: outgoingIds,
        layerIds: layerIds,
        renderAfterLaneOrder: renderAfterLaneOrder,
      });
    });
    caps.sort(function (left, right) {
      return left.renderAfterLaneOrder - right.renderAfterLaneOrder || asciiCompare(left.id, right.id);
    });
    return { caps: caps, connectedEnds: connectedEnds };
  }

  function makeLanePiece(lane, renderOrder, widths) {
    return {
      id: "road-lane." + lane.id,
      kind: "road-lane",
      laneSegmentId: lane.id,
      layerId: lane.layerId,
      materialStyleId: lane.materialStyleId,
      logicalRouteIds: lane.routeIds.slice(),
      lengthMilliUnits: lane.lengthMilliUnits,
      coreWidthMilliUnits: widths.coreMilliUnits,
      shoulderedWidthMilliUnits: widths.shoulderedMilliUnits,
      ambientOcclusionWidthMilliUnits: widths.ambientOcclusionMilliUnits,
      centerlineMilliUnits: lane.centerlineMilliUnits.map(function (point) {
        return { x: point.x, y: point.y };
      }),
      subsegments: lane.subsegments.map(function (segment) { return Object.assign({}, segment); }),
      renderOrder: renderOrder,
    };
  }

  function makeEndCap(lane, end, renderOrder) {
    const first = lane.subsegments[0];
    const last = lane.subsegments[lane.subsegments.length - 1];
    const isStart = end === "start";
    const segment = isStart ? first : last;
    return {
      id: "road-end." + lane.id + "." + end,
      kind: "terminal-cap",
      laneSegmentId: lane.id,
      end: end,
      layerId: lane.layerId,
      centerMilliUnits: isStart ? { x: segment.fromX, y: segment.fromY } : { x: segment.toX, y: segment.toY },
      outwardTangentMilliUnits: isStart ? {
        x: checkedNegate(segment.deltaX, "start cap tangent x"),
        y: checkedNegate(segment.deltaY, "start cap tangent y"),
      } : { x: segment.deltaX, y: segment.deltaY },
      renderAfterLaneOrder: renderOrder,
    };
  }

  function createRoadRenderPieces(value, optionValue) {
    const input = plainRecord(value, "map");
    if (input.schemaVersion !== 2 || input.sourceKind !== "campaign") {
      throw new TypeError("Road presentation requires normalized campaign map schema 2 IR");
    }
    const missionId = stableId(
      hasOwn(input, "missionId") ? input.missionId : input.id,
      hasOwn(input, "missionId") ? "map.missionId" : "map.id"
    );
    inputRoadWidth(input);
    const options = normalizedOptions(optionValue);
    const lanes = normalizePhysicalLanes(input, options);
    const laneById = new Map(lanes.map(function (lane) { return [lane.id, lane]; }));
    const crossingResult = normalizeCrossings(input, laneById);
    const groundLanes = orderedGroundLanes(lanes, crossingResult.edges);
    const laneOrder = new Map(groundLanes.map(function (lane, index) { return [lane.id, index]; }));
    const joinResult = normalizeJoins(input, laneById, laneOrder);
    const widths = {
      coreMilliUnits: WIDTHS.coreMilliUnits,
      shoulderPerSideMilliUnits: WIDTHS.shoulderPerSideMilliUnits,
      shoulderedMilliUnits: WIDTHS.shoulderedMilliUnits,
      corridorMilliUnits: WIDTHS.shoulderedMilliUnits,
      ambientOcclusionMilliUnits: options.ambientOcclusionWidthMilliUnits,
      maxAmbientOcclusionMilliUnits: WIDTHS.maxAmbientOcclusionMilliUnits,
    };
    const lanePieces = groundLanes.map(function (lane, index) {
      return makeLanePiece(lane, index, widths);
    });
    const endCaps = [];
    groundLanes.forEach(function (lane, index) {
      if (!joinResult.connectedEnds.has(lane.id + "|start")) endCaps.push(makeEndCap(lane, "start", index));
      if (!joinResult.connectedEnds.has(lane.id + "|end")) endCaps.push(makeEndCap(lane, "end", index));
    });
    endCaps.sort(function (left, right) {
      return left.renderAfterLaneOrder - right.renderAfterLaneOrder ||
        asciiCompare(left.laneSegmentId, right.laneSegmentId) ||
        (left.end === right.end ? 0 : (left.end === "start" ? -1 : 1));
    });
    const renderPieces = [];
    lanePieces.forEach(function (lanePiece) {
      renderPieces.push(lanePiece);
      joinResult.caps.filter(function (cap) {
        return cap.renderAfterLaneOrder === lanePiece.renderOrder;
      }).forEach(function (cap) { renderPieces.push(cap); });
      endCaps.filter(function (cap) {
        return cap.renderAfterLaneOrder === lanePiece.renderOrder;
      }).forEach(function (cap) { renderPieces.push(cap); });
    });
    return deepFreeze({
      schemaVersion: 1,
      missionId: missionId,
      units: "milli-world-unit",
      defaultMaterialStyleId: options.defaultStyleId,
      widths: widths,
      physicalLaneCount: lanePieces.length,
      ignoredAirLaneSegmentIds: lanes.filter(function (lane) { return lane.kind === "air"; })
        .map(function (lane) { return lane.id; }).sort(asciiCompare),
      lanePieces: lanePieces,
      endCaps: endCaps,
      joinCaps: joinResult.caps,
      crossingPieces: crossingResult.pieces,
      renderPieces: renderPieces,
    });
  }

  return deepFreeze({
    VERSION: 1,
    WIDTHS: WIDTHS,
    DEFAULT_MATERIAL_STYLE_ID: DEFAULT_MATERIAL_STYLE_ID,
    validateMaterialStyleId: validateMaterialStyleId,
    createRoadRenderPieces: createRoadRenderPieces,
    normalizeRoadGeometry: createRoadRenderPieces,
  });
});
