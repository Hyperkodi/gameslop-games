/* Armara Aegis deterministic target eligibility and selection v1.
   Coordinates, range, and speed use ABI distance units. Cloak/reveal, active-enemy lifecycle,
   target-mask layer, and active shield membership are resolved by the caller before this adapter. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi.js"), require("./geometry.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before targeting.js");
  if (!game.AegisGeometry) throw new Error("Game.AegisGeometry must be installed before targeting.js");
  const api = factory(game.AegisSim, game.AegisGeometry);
  if (Object.prototype.hasOwnProperty.call(game, "AegisTargeting")) {
    if (game.AegisTargeting !== api) throw new Error("Game.AegisTargeting is already installed");
    return;
  }
  Object.defineProperty(game, "AegisTargeting", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI, Geometry) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  if (!Geometry || !Object.isFrozen(Geometry) ||
      Geometry.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256 ||
      typeof Geometry.isWithinSquaredRange !== "function" ||
      typeof Geometry.compareTargetPriority !== "function") {
    throw new TypeError("A matching frozen Aegis geometry API is required");
  }
  ["assertSafeInteger", "checkedAdd", "canonicalEncode"].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });

  const QUERY_FIELDS = Object.freeze(["originX", "originY", "range", "targetLayerIds"]);
  const CANDIDATE_FIELDS = Object.freeze([
    "baseSpeedDistanceUnitsPerSecond", "currentHpMilli", "id", "layerId", "remainingDistance",
    "revealEligible", "shieldPoolsMilli", "threatPriority", "x", "y",
  ]);
  const TARGET_POLICIES = Object.freeze(["FRONT", "STRONG", "FAST"]);
  const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

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

  function stableId(value, label) {
    if (typeof value !== "string" || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable ASCII ID");
    }
    return value;
  }

  function createTargetQuery(input) {
    exactFields(input, QUERY_FIELDS, "Target query");
    if (!Array.isArray(input.targetLayerIds)) throw new TypeError("Target layer IDs must be an array");
    ABI.canonicalEncode(input.targetLayerIds);
    const targetLayerIds = input.targetLayerIds.map(function (layerId, index) {
      return stableId(layerId, "Target layer ID " + index);
    });
    if (targetLayerIds.length === 0) {
      throw new RangeError("Damage target queries require at least one resolved target layer ID");
    }
    if (new Set(targetLayerIds).size !== targetLayerIds.length) {
      throw new RangeError("Target layer IDs cannot contain duplicates");
    }
    return Object.freeze({
      originX: ABI.assertSafeInteger(input.originX, "Target origin X"),
      originY: ABI.assertSafeInteger(input.originY, "Target origin Y"),
      range: nonnegativeInteger(input.range, "Target range"),
      targetLayerIds: Object.freeze(targetLayerIds),
    });
  }

  function checkedStrength(candidate) {
    let strength = candidate.currentHpMilli;
    candidate.shieldPoolsMilli.forEach(function (remainingMilli) {
      strength = ABI.checkedAdd(strength, remainingMilli);
    });
    return strength;
  }

  function createTargetCandidate(input) {
    exactFields(input, CANDIDATE_FIELDS, "Target candidate");
    if (typeof input.revealEligible !== "boolean") {
      throw new TypeError("Target reveal eligibility must be boolean");
    }
    if (!Array.isArray(input.shieldPoolsMilli)) {
      throw new TypeError("Active shield pool balances must be an array");
    }
    ABI.canonicalEncode(input.shieldPoolsMilli);
    const shieldPoolsMilli = input.shieldPoolsMilli.map(function (remainingMilli, index) {
      return positiveInteger(remainingMilli, "Active shield pool " + index + " milli-units");
    });
    const candidate = {
      baseSpeedDistanceUnitsPerSecond: nonnegativeInteger(
        input.baseSpeedDistanceUnitsPerSecond,
        "Unmodified base speed distance units per second"
      ),
      currentHpMilli: nonnegativeInteger(input.currentHpMilli, "Current HP milli-units"),
      id: positiveInteger(input.id, "Runtime enemy ID"),
      layerId: stableId(input.layerId, "Resolved target layer ID"),
      remainingDistance: nonnegativeInteger(input.remainingDistance, "Remaining route distance"),
      revealEligible: input.revealEligible,
      shieldPoolsMilli: Object.freeze(shieldPoolsMilli),
      threatPriority: nonnegativeInteger(input.threatPriority, "Threat priority"),
      x: ABI.assertSafeInteger(input.x, "Target X"),
      y: ABI.assertSafeInteger(input.y, "Target Y"),
    };
    checkedStrength(candidate);
    return Object.freeze(candidate);
  }

  function targetStrengthMilli(input) {
    return checkedStrength(createTargetCandidate(input));
  }

  function normalizedCandidates(inputs) {
    if (!Array.isArray(inputs)) throw new TypeError("Target candidates must be an array");
    ABI.canonicalEncode(inputs);
    const candidates = inputs.map(createTargetCandidate);
    const ids = new Set();
    candidates.forEach(function (candidate) {
      if (ids.has(candidate.id)) throw new RangeError("Target candidates contain a duplicate runtime enemy ID");
      ids.add(candidate.id);
    });
    return candidates;
  }

  function filterEligibleTargets(targetQuery, inputs) {
    const resolvedQuery = createTargetQuery(targetQuery);
    const candidates = normalizedCandidates(inputs);
    const targetLayers = new Set(resolvedQuery.targetLayerIds);
    return Object.freeze(candidates.filter(function (candidate) {
      return candidate.revealEligible &&
        targetLayers.has(candidate.layerId) &&
        Geometry.isWithinSquaredRange(
          resolvedQuery.originX,
          resolvedQuery.originY,
          candidate.x,
          candidate.y,
          resolvedQuery.range
        );
    }));
  }

  function requirePolicy(policy) {
    if (typeof policy !== "string" || TARGET_POLICIES.indexOf(policy) === -1) {
      throw new RangeError("Unknown target policy: " + String(policy));
    }
    return policy;
  }

  function compareRemainingThenId(left, right) {
    if (left.remainingDistance !== right.remainingDistance) {
      return left.remainingDistance < right.remainingDistance ? -1 : 1;
    }
    if (left.id === right.id) return 0;
    return left.id < right.id ? -1 : 1;
  }

  function compareTargets(policy, leftInput, rightInput) {
    requirePolicy(policy);
    const left = createTargetCandidate(leftInput);
    const right = createTargetCandidate(rightInput);
    if (policy === "FRONT") return Geometry.compareTargetPriority(left, right);
    if (policy === "STRONG") {
      const leftStrength = checkedStrength(left);
      const rightStrength = checkedStrength(right);
      if (leftStrength !== rightStrength) return leftStrength > rightStrength ? -1 : 1;
      return compareRemainingThenId(left, right);
    }
    if (left.baseSpeedDistanceUnitsPerSecond !== right.baseSpeedDistanceUnitsPerSecond) {
      return left.baseSpeedDistanceUnitsPerSecond > right.baseSpeedDistanceUnitsPerSecond ? -1 : 1;
    }
    return compareRemainingThenId(left, right);
  }

  function selectTarget(policy, targetQuery, inputs) {
    requirePolicy(policy);
    const eligible = filterEligibleTargets(targetQuery, inputs);
    if (eligible.length === 0) return null;
    let selected = eligible[0];
    for (let index = 1; index < eligible.length; index++) {
      if (compareTargets(policy, eligible[index], selected) < 0) selected = eligible[index];
    }
    return selected;
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    TARGET_POLICIES: TARGET_POLICIES,
    createTargetQuery: createTargetQuery,
    createTargetCandidate: createTargetCandidate,
    targetStrengthMilli: targetStrengthMilli,
    filterEligibleTargets: filterEligibleTargets,
    compareTargets: compareTargets,
    selectTarget: selectTarget,
  });
});
