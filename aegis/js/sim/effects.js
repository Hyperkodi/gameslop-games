/* Armara Aegis deterministic status, amplification, and shield-pool resolution v1.
   This module selects already-accepted complete instances. It does not create lifecycle timing,
   apply shield coefficients, mitigate armor/resistance, execute, or choose authored effects. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before effects.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisEffects")) {
    if (game.AegisEffects !== api) throw new Error("Game.AegisEffects is already installed");
    return;
  }
  Object.defineProperty(game, "AegisEffects", {
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
  ["assertSafeInteger", "checkedAdd", "canonicalEncode", "resolveStrongestSlowBp"].forEach(
    function (name) {
      if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
    }
  );

  const descriptor = ABI.DESCRIPTOR;
  if (descriptor.statuses.instanceComparator.join("\0") !==
      ["magnitude-desc", "expiry-desc", "source-id-asc"].join("\0") ||
      descriptor.damagePipeline.externalResolution !==
        "same-name-strongest-then-distinct-source-types-in-ascii-order-then-cap" ||
      descriptor.damagePipeline.shieldPoolOrder.join("\0") !==
        ["earliest-expiry", "source-id-asc"].join("\0")) {
    throw new Error("Aegis effect ordering does not match the deterministic ABI");
  }

  const STATUS_FIELDS = Object.freeze([
    "appliedTick", "expiryTimeUnits", "magnitude", "sourceId", "statusId",
  ]);
  const AURA_FIELDS = Object.freeze(["auraId", "magnitude", "sourceId"]);
  const EXTERNAL_FIELDS = Object.freeze([
    "appliedTick", "damageBp", "expiryTimeUnits", "magnitude", "name", "rangeBp",
    "rateBp", "sourceId", "sourceType",
  ]);
  const SHIELD_FIELDS = Object.freeze(["expiryTimeUnits", "remainingMilli", "sourceId"]);
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

  function createStatusInstance(input) {
    exactFields(input, STATUS_FIELDS, "Status instance");
    // `appliedTick` and `expiryTimeUnits` are separate authored/runtime facts. Their conversion is
    // deliberately not inferred here; the ABI only freezes how active instances compare.
    return Object.freeze({
      appliedTick: nonnegativeInteger(input.appliedTick, "Status application tick"),
      expiryTimeUnits: positiveInteger(input.expiryTimeUnits, "Status expiry time units"),
      magnitude: nonnegativeInteger(input.magnitude, "Status magnitude"),
      sourceId: positiveInteger(input.sourceId, "Status runtime source ID"),
      statusId: stableId(input.statusId, "Status ID"),
    });
  }

  function compareCompleteInstances(left, right) {
    if (left.magnitude !== right.magnitude) return left.magnitude > right.magnitude ? -1 : 1;
    if (left.expiryTimeUnits !== right.expiryTimeUnits) {
      return left.expiryTimeUnits > right.expiryTimeUnits ? -1 : 1;
    }
    if (left.sourceId === right.sourceId) return 0;
    return left.sourceId < right.sourceId ? -1 : 1;
  }

  function compareStatusInstances(left, right) {
    const leftInstance = createStatusInstance(left);
    const rightInstance = createStatusInstance(right);
    if (leftInstance.statusId !== rightInstance.statusId) {
      throw new RangeError("Status comparator requires matching status IDs");
    }
    return compareCompleteInstances(leftInstance, rightInstance);
  }

  function uniqueInstances(instances, identity, label) {
    const identities = new Set();
    instances.forEach(function (instance) {
      const key = identity(instance);
      if (identities.has(key)) throw new RangeError(label + " contains a duplicate source identity: " + key);
      identities.add(key);
    });
  }

  function normalizedStatuses(inputs) {
    if (!Array.isArray(inputs)) throw new TypeError("Status instances must be an array");
    ABI.canonicalEncode(inputs);
    const instances = inputs.map(createStatusInstance);
    uniqueInstances(instances, function (instance) {
      return instance.statusId + "\0" + instance.sourceId;
    }, "Status instances");
    return instances;
  }

  function strongestCompleteInstance(instances) {
    if (instances.length === 0) return null;
    let strongest = instances[0];
    for (let index = 1; index < instances.length; index++) {
      if (compareCompleteInstances(instances[index], strongest) < 0) strongest = instances[index];
    }
    return strongest;
  }

  function selectStrongestStatus(inputs) {
    const instances = normalizedStatuses(inputs);
    if (instances.length > 1) {
      const statusId = instances[0].statusId;
      for (let index = 1; index < instances.length; index++) {
        if (instances[index].statusId !== statusId) {
          throw new RangeError("Strongest-status selection requires matching status IDs");
        }
      }
    }
    return strongestCompleteInstance(instances);
  }

  function resolveMovementReduction(inputs, enemySlowControlBp, enemyMinMovementBp) {
    const movementInstances = normalizedStatuses(inputs).filter(function (instance) {
      return instance.statusId === "slow" || instance.statusId === "drench";
    });
    // Slow and drench share one comparator bucket whose frozen final tie is source ID. A single
    // runtime source therefore cannot contribute both names to that bucket or input order would
    // decide which complete source record is exposed to presentation.
    uniqueInstances(movementInstances, function (instance) {
      return String(instance.sourceId);
    }, "Movement reduction instances");
    movementInstances.forEach(function (instance) {
      if (instance.magnitude > ABI.BASIS_POINTS) {
        throw new RangeError("Movement reduction magnitude must be valid basis points");
      }
    });
    const source = strongestCompleteInstance(movementInstances);
    const strongestReductionBp = source === null ? 0 : source.magnitude;
    const resolved = ABI.resolveStrongestSlowBp(
      strongestReductionBp,
      enemySlowControlBp,
      enemyMinMovementBp
    );
    return Object.freeze({
      effectiveSpeedBp: resolved.effectiveSpeedBp,
      scaledReductionBp: resolved.scaledReductionBp,
      source: source,
      strongestReductionBp: strongestReductionBp,
    });
  }

  function createFriendlyAuraInstance(input) {
    exactFields(input, AURA_FIELDS, "Friendly aura instance");
    return Object.freeze({
      auraId: stableId(input.auraId, "Friendly aura ID"),
      magnitude: nonnegativeInteger(input.magnitude, "Friendly aura magnitude"),
      sourceId: positiveInteger(input.sourceId, "Friendly aura runtime source ID"),
    });
  }

  function selectFriendlyAura(inputs, requestedAuraId) {
    if (!Array.isArray(inputs)) throw new TypeError("Friendly aura instances must be an array");
    ABI.canonicalEncode(inputs);
    const auraId = stableId(requestedAuraId, "Requested friendly aura ID");
    const instances = inputs.map(createFriendlyAuraInstance);
    uniqueInstances(instances, function (instance) {
      return instance.auraId + "\0" + instance.sourceId;
    }, "Friendly aura instances");
    const eligible = instances.filter(function (instance) { return instance.auraId === auraId; });
    if (eligible.length === 0) return null;
    let strongest = eligible[0];
    for (let index = 1; index < eligible.length; index++) {
      const candidate = eligible[index];
      if (candidate.magnitude > strongest.magnitude ||
          (candidate.magnitude === strongest.magnitude && candidate.sourceId < strongest.sourceId)) {
        strongest = candidate;
      }
    }
    return strongest;
  }

  function createExternalAmplificationInstance(input) {
    exactFields(input, EXTERNAL_FIELDS, "External amplification instance");
    return Object.freeze({
      appliedTick: nonnegativeInteger(input.appliedTick, "External source application tick"),
      damageBp: nonnegativeInteger(input.damageBp, "External damage bonus basis points"),
      expiryTimeUnits: positiveInteger(input.expiryTimeUnits, "External source expiry time units"),
      magnitude: nonnegativeInteger(input.magnitude, "External source magnitude"),
      name: stableId(input.name, "External source name"),
      rangeBp: nonnegativeInteger(input.rangeBp, "External range bonus basis points"),
      rateBp: nonnegativeInteger(input.rateBp, "External rate bonus basis points"),
      sourceId: positiveInteger(input.sourceId, "External runtime source ID"),
      sourceType: stableId(input.sourceType, "External source type"),
    });
  }

  function compareAscii(left, right) {
    if (left === right) return 0;
    return left < right ? -1 : 1;
  }

  function resolveExternalAmplification(inputs) {
    if (!Array.isArray(inputs)) throw new TypeError("External amplification instances must be an array");
    ABI.canonicalEncode(inputs);
    const instances = inputs.map(createExternalAmplificationInstance);
    uniqueInstances(instances, function (instance) {
      // The frozen comparator ends at runtime source ID. Treat a same-name contribution from
      // that same source as one identity even if a malformed caller labels its source type
      // differently; otherwise an exact comparator tie would preserve input order.
      return instance.name + "\0" + instance.sourceId;
    }, "External amplification instances");

    const groups = new Map();
    instances.forEach(function (instance) {
      if (!groups.has(instance.name)) groups.set(instance.name, []);
      groups.get(instance.name).push(instance);
    });
    const survivors = [];
    groups.forEach(function (sameName) {
      survivors.push(strongestCompleteInstance(sameName));
    });
    survivors.sort(function (left, right) {
      const typeOrder = compareAscii(left.sourceType, right.sourceType);
      if (typeOrder !== 0) return typeOrder;
      const nameOrder = compareAscii(left.name, right.name);
      if (nameOrder !== 0) return nameOrder;
      if (left.sourceId === right.sourceId) return 0;
      return left.sourceId < right.sourceId ? -1 : 1;
    });

    let damageBp = 0;
    let rateBp = 0;
    let rangeBp = 0;
    survivors.forEach(function (source) {
      damageBp = ABI.checkedAdd(damageBp, source.damageBp);
      rateBp = ABI.checkedAdd(rateBp, source.rateBp);
      rangeBp = ABI.checkedAdd(rangeBp, source.rangeBp);
    });
    return Object.freeze({
      damageBp: Math.min(damageBp, descriptor.externalCapsBp.damage),
      rangeBp: Math.min(rangeBp, descriptor.externalCapsBp.range),
      rateBp: Math.min(rateBp, descriptor.externalCapsBp.rate),
      sources: Object.freeze(survivors),
    });
  }

  function createShieldPool(input) {
    exactFields(input, SHIELD_FIELDS, "Shield pool");
    return Object.freeze({
      expiryTimeUnits: positiveInteger(input.expiryTimeUnits, "Shield expiry time units"),
      remainingMilli: positiveInteger(input.remainingMilli, "Shield remaining milli-units"),
      sourceId: positiveInteger(input.sourceId, "Shield runtime source ID"),
    });
  }

  function consumeShieldPools(inputs, shieldBoundDamageMilli) {
    if (!Array.isArray(inputs)) throw new TypeError("Shield pools must be an array");
    ABI.canonicalEncode(inputs);
    nonnegativeInteger(shieldBoundDamageMilli, "Shield-bound damage milli-units");
    const pools = inputs.map(createShieldPool);
    uniqueInstances(pools, function (pool) { return String(pool.sourceId); }, "Shield pools");
    pools.sort(function (left, right) {
      if (left.expiryTimeUnits !== right.expiryTimeUnits) {
        return left.expiryTimeUnits < right.expiryTimeUnits ? -1 : 1;
      }
      if (left.sourceId === right.sourceId) return 0;
      return left.sourceId < right.sourceId ? -1 : 1;
    });

    let overflowMilli = shieldBoundDamageMilli;
    let absorbedMilli = 0;
    const remainingPools = [];
    pools.forEach(function (pool) {
      if (overflowMilli === 0) {
        remainingPools.push(pool);
        return;
      }
      const absorbedFromPool = Math.min(pool.remainingMilli, overflowMilli);
      absorbedMilli = ABI.checkedAdd(absorbedMilli, absorbedFromPool);
      overflowMilli = ABI.checkedAdd(overflowMilli, -absorbedFromPool);
      const poolRemaining = ABI.checkedAdd(pool.remainingMilli, -absorbedFromPool);
      if (poolRemaining > 0) {
        remainingPools.push(createShieldPool({
          expiryTimeUnits: pool.expiryTimeUnits,
          remainingMilli: poolRemaining,
          sourceId: pool.sourceId,
        }));
      }
    });
    return Object.freeze({
      absorbedMilli: absorbedMilli,
      overflowMilli: overflowMilli,
      pools: Object.freeze(remainingPools),
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    createStatusInstance: createStatusInstance,
    compareStatusInstances: compareStatusInstances,
    selectStrongestStatus: selectStrongestStatus,
    resolveMovementReduction: resolveMovementReduction,
    createFriendlyAuraInstance: createFriendlyAuraInstance,
    selectFriendlyAura: selectFriendlyAura,
    createExternalAmplificationInstance: createExternalAmplificationInstance,
    resolveExternalAmplification: resolveExternalAmplification,
    consumeShieldPools: consumeShieldPools,
  });
});
