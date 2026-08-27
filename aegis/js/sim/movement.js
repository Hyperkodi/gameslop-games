/* Armara Aegis deterministic movement, named RNG, and runtime-ID helpers v1.
   Inputs are already-resolved simulation values; this module owns no routes, waves, or policies. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before movement.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisMovement")) {
    if (game.AegisMovement !== api) throw new Error("Game.AegisMovement is already installed");
    return;
  }
  Object.defineProperty(game, "AegisMovement", {
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
  [
    "assertSafeInteger",
    "checkedAdd",
    "checkedMultiply",
    "floorDivNonnegative",
    "canonicalEncode",
    "deriveNamedSeed",
    "mulberry32Step",
  ].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });

  const descriptor = ABI.DESCRIPTOR;
  const movementDivisor = descriptor.movement.divisor;
  if (!Number.isSafeInteger(movementDivisor) || movementDivisor <= 0 ||
      movementDivisor !== ABI.checkedMultiply(ABI.TICKS_PER_SECOND, ABI.BASIS_POINTS)) {
    throw new Error("Aegis movement divisor does not match the deterministic ABI");
  }
  if (descriptor.rng.algorithm !== "mulberry32" ||
      descriptor.rng.floatProjection !== "uint32 / 4294967296" ||
      descriptor.rng.groupShuffle !== "only-when-shuffleWithinGroup-is-true") {
    throw new Error("Aegis RNG descriptor does not match the deterministic helper");
  }
  if (descriptor.runtimeIds.initialValue !== 1 ||
      descriptor.runtimeIds.batchOrder[0] !== "source-id" ||
      descriptor.runtimeIds.batchOrder[1] !== "authored-index") {
    throw new Error("Aegis runtime-ID descriptor does not match the deterministic helper");
  }

  const RUNTIME_ID_DOMAINS = Object.freeze(descriptor.runtimeIds.domains.slice());
  if (RUNTIME_ID_DOMAINS.length === 0 || new Set(RUNTIME_ID_DOMAINS).size !== RUNTIME_ID_DOMAINS.length) {
    throw new Error("Aegis runtime-ID domains must be non-empty and unique");
  }
  const UINT32_MAX = 0xffffffff;
  const UINT32_RANGE = 4294967296;

  function exactFields(value, expected, label) {
    ABI.canonicalEncode(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const actual = Object.keys(value).sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
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

  function movementState(remainder) {
    nonnegativeInteger(remainder, "Movement remainder");
    if (remainder >= movementDivisor) {
      throw new RangeError("Movement remainder must be less than the movement divisor");
    }
    return Object.freeze({ remainder: remainder });
  }

  function requireMovementState(state) {
    exactFields(state, ["remainder"], "Movement state");
    return movementState(state.remainder);
  }

  function createMovementState() {
    return movementState(0);
  }

  function advanceMovementTick(state, speedDistanceUnitsPerSecond, effectiveSpeedBp) {
    const validated = requireMovementState(state);
    nonnegativeInteger(speedDistanceUnitsPerSecond, "Movement speed distance units per second");
    nonnegativeInteger(effectiveSpeedBp, "Effective speed basis points");
    if (effectiveSpeedBp > ABI.BASIS_POINTS) {
      throw new RangeError("Effective speed basis points cannot exceed " + ABI.BASIS_POINTS);
    }
    const numerator = ABI.checkedAdd(
      ABI.checkedMultiply(speedDistanceUnitsPerSecond, effectiveSpeedBp),
      validated.remainder
    );
    const advance = ABI.floorDivNonnegative(numerator, movementDivisor);
    return Object.freeze({
      advance: advance,
      numerator: numerator,
      state: movementState(numerator % movementDivisor),
    });
  }

  function advanceRouteProgress(routeLength, currentDistance, requestedAdvance) {
    positiveInteger(routeLength, "Compiled route length");
    nonnegativeInteger(currentDistance, "Current route distance");
    nonnegativeInteger(requestedAdvance, "Requested route advance");
    if (currentDistance > routeLength) {
      throw new RangeError("Current route distance cannot exceed the compiled route length");
    }
    const remainingBefore = ABI.checkedAdd(routeLength, -currentDistance);
    const appliedAdvance = requestedAdvance >= remainingBefore ? remainingBefore : requestedAdvance;
    const distance = appliedAdvance === remainingBefore
      ? routeLength
      : ABI.checkedAdd(currentDistance, appliedAdvance);
    return Object.freeze({
      appliedAdvance: appliedAdvance,
      distance: distance,
      reachedEnd: distance === routeLength,
      remainingDistance: ABI.checkedAdd(routeLength, -distance),
    });
  }

  function streamId(value) {
    // The ABI derivation validates non-empty ASCII and rejects NUL without duplicating its grammar.
    ABI.deriveNamedSeed(0, value);
    return value;
  }

  function unsigned32(value, label) {
    if (!Number.isSafeInteger(value) || value < 0 || value > UINT32_MAX) {
      throw new RangeError(label + " must be an unsigned 32-bit integer");
    }
    return value;
  }

  function namedRngState(id, state) {
    return Object.freeze({
      state: unsigned32(state, "Named RNG state"),
      streamId: streamId(id),
    });
  }

  function requireNamedRngState(state) {
    exactFields(state, ["state", "streamId"], "Named RNG stream state");
    return namedRngState(state.streamId, state.state);
  }

  function createNamedRngStream(unsignedMissionSeed, id) {
    return namedRngState(id, ABI.deriveNamedSeed(unsignedMissionSeed, id));
  }

  function stepNamedRngStream(stream) {
    const validated = requireNamedRngState(stream);
    const step = ABI.mulberry32Step(validated.state);
    return Object.freeze({
      state: namedRngState(validated.streamId, step.state),
      uint32: step.uint32,
    });
  }

  function immutableCanonicalClone(value) {
    ABI.canonicalEncode(value);

    function clone(current) {
      if (current === null || typeof current !== "object") return current;
      if (Array.isArray(current)) return Object.freeze(current.map(clone));
      const result = {};
      Object.keys(current).sort().forEach(function (key) {
        Object.defineProperty(result, key, {
          value: clone(current[key]),
          writable: false,
          configurable: false,
          enumerable: true,
        });
      });
      return Object.freeze(result);
    }

    return clone(value);
  }

  function shuffleWithinGroup(items, shuffleWithinGroupFlag, stream) {
    if (!Array.isArray(items)) throw new TypeError("Group shuffle items must be an array");
    if (typeof shuffleWithinGroupFlag !== "boolean") {
      throw new TypeError("shuffleWithinGroup must be boolean");
    }
    let currentStream = requireNamedRngState(stream);
    const immutableItems = immutableCanonicalClone(items);
    if (!shuffleWithinGroupFlag || immutableItems.length < 2) {
      return Object.freeze({
        draws: 0,
        items: immutableItems,
        state: currentStream,
      });
    }

    const shuffled = immutableItems.slice();
    let draws = 0;
    for (let index = shuffled.length - 1; index > 0; index--) {
      const step = ABI.mulberry32Step(currentStream.state);
      currentStream = namedRngState(currentStream.streamId, step.state);
      const projected = step.uint32 / UINT32_RANGE;
      const swapIndex = Math.floor(projected * (index + 1));
      const held = shuffled[index];
      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = held;
      draws++;
    }
    return Object.freeze({
      draws: draws,
      items: Object.freeze(shuffled),
      state: currentStream,
    });
  }

  function runtimeIdState(counters) {
    const nextByDomain = {};
    RUNTIME_ID_DOMAINS.forEach(function (domain) {
      nextByDomain[domain] = positiveInteger(counters[domain], "Next " + domain + " runtime ID");
    });
    return Object.freeze({ nextByDomain: Object.freeze(nextByDomain) });
  }

  function requireRuntimeIdState(state) {
    exactFields(state, ["nextByDomain"], "Runtime-ID state");
    exactFields(state.nextByDomain, RUNTIME_ID_DOMAINS, "Runtime-ID domain counters");
    return runtimeIdState(state.nextByDomain);
  }

  function createRuntimeIdState() {
    const counters = {};
    RUNTIME_ID_DOMAINS.forEach(function (domain) {
      counters[domain] = descriptor.runtimeIds.initialValue;
    });
    return runtimeIdState(counters);
  }

  function requireRuntimeIdDomain(domain) {
    if (typeof domain !== "string" || RUNTIME_ID_DOMAINS.indexOf(domain) === -1) {
      throw new RangeError("Unknown runtime-ID domain: " + String(domain));
    }
    return domain;
  }

  function allocateRuntimeId(state, domain, accepted) {
    const validated = requireRuntimeIdState(state);
    requireRuntimeIdDomain(domain);
    if (typeof accepted !== "boolean") throw new TypeError("Runtime creation acceptance must be boolean");
    if (!accepted) return Object.freeze({ runtimeId: null, state: validated });

    const runtimeId = validated.nextByDomain[domain];
    const counters = {};
    RUNTIME_ID_DOMAINS.forEach(function (candidateDomain) {
      counters[candidateDomain] = candidateDomain === domain
        ? ABI.checkedAdd(runtimeId, 1)
        : validated.nextByDomain[candidateDomain];
    });
    return Object.freeze({
      runtimeId: runtimeId,
      state: runtimeIdState(counters),
    });
  }

  function preserveRuntimeIdsOnPlanReset(state) {
    return requireRuntimeIdState(state);
  }

  function requireBatchRequest(request, index) {
    exactFields(request, ["accepted", "authoredIndex", "domain", "sourceId"], "Batch request " + index);
    if (typeof request.accepted !== "boolean") {
      throw new TypeError("Batch request " + index + " acceptance must be boolean");
    }
    return Object.freeze({
      accepted: request.accepted,
      authoredIndex: nonnegativeInteger(request.authoredIndex, "Batch request " + index + " authored index"),
      domain: requireRuntimeIdDomain(request.domain),
      sourceId: positiveInteger(request.sourceId, "Batch request " + index + " runtime source ID"),
    });
  }

  function allocateRuntimeIdBatch(state, requests) {
    let currentState = requireRuntimeIdState(state);
    if (!Array.isArray(requests)) throw new TypeError("Runtime-ID batch requests must be an array");
    ABI.canonicalEncode(requests);
    const ordered = requests.map(requireBatchRequest);
    ordered.sort(function (left, right) {
      if (left.sourceId !== right.sourceId) return left.sourceId < right.sourceId ? -1 : 1;
      if (left.authoredIndex !== right.authoredIndex) return left.authoredIndex < right.authoredIndex ? -1 : 1;
      return 0;
    });

    for (let index = 1; index < ordered.length; index++) {
      if (ordered[index - 1].sourceId === ordered[index].sourceId &&
          ordered[index - 1].authoredIndex === ordered[index].authoredIndex) {
        throw new RangeError("Runtime-ID batch contains a duplicate source ID and authored index pair");
      }
    }

    const allocations = [];
    ordered.forEach(function (request) {
      const allocation = allocateRuntimeId(currentState, request.domain, request.accepted);
      currentState = allocation.state;
      allocations.push(Object.freeze({
        accepted: request.accepted,
        authoredIndex: request.authoredIndex,
        domain: request.domain,
        runtimeId: allocation.runtimeId,
        sourceId: request.sourceId,
      }));
    });
    return Object.freeze({
      allocations: Object.freeze(allocations),
      state: currentState,
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    MOVEMENT_DIVISOR: movementDivisor,
    RUNTIME_ID_DOMAINS: RUNTIME_ID_DOMAINS,
    createMovementState: createMovementState,
    advanceMovementTick: advanceMovementTick,
    advanceRouteProgress: advanceRouteProgress,
    createNamedRngStream: createNamedRngStream,
    stepNamedRngStream: stepNamedRngStream,
    shuffleWithinGroup: shuffleWithinGroup,
    createRuntimeIdState: createRuntimeIdState,
    allocateRuntimeId: allocateRuntimeId,
    preserveRuntimeIdsOnPlanReset: preserveRuntimeIdsOnPlanReset,
    allocateRuntimeIdBatch: allocateRuntimeIdBatch,
  });
});
