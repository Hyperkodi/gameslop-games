/* Armara Aegis deterministic Relic modifier resolver v1.
   Relics resolve before a run into one immutable, named, clamped modifier set.
   Multipliers on one stat sum as basis-point deltas from 10000 (forge-ember + titan-gear
   build-cost = 10800 + 10800 - 10000 = 11600 bp; upgrade/specialization = 8800 + 10800 - 10000
   = 9600 bp), then clamp once to the named stat policy, then round once when applied to a
   concrete integer base. add-bp stats scale the base by (10000 + delta) / 10000 the same way. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi-v2.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSimV2) throw new Error("Game.AegisSimV2 must be installed before relics.js");
  const api = factory(game.AegisSimV2);
  if (Object.prototype.hasOwnProperty.call(game, "AegisRelics")) {
    if (game.AegisRelics !== api) throw new Error("Game.AegisRelics is already installed");
    return;
  }
  Object.defineProperty(game, "AegisRelics", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR) ||
      ABI.DESCRIPTOR.version !== 2 || ABI.BASIS_POINTS !== 10000) {
    throw new TypeError("The frozen Aegis simulation ABI v2 is required");
  }

  const RELIC_SCHEMA_VERSION = 1;
  const MAX_RELICS = 64;
  const MAX_EQUIPPED_RELICS = 2;
  const MAX_MODIFIERS_PER_SIDE = 16;
  /* Spec 5.1: resolvedCastCost = ceil(base x (10000 + 2500 x priorAcceptedCasts) / 10000). */
  const PROTOCOL_REPEAT_SURCHARGE_BP = 2500;
  const STABLE_ID = /^[a-z][a-z0-9._:-]*$/;
  const RELIC_FIELDS = Object.freeze([
    "id", "unlockGrantId", "benefitModifiers", "drawbackModifiers",
  ]);
  const MODIFIER_FIELDS = Object.freeze(["statId", "operation", "amount", "rounding"]);

  function policy(operation, rounding, baseAmount, minimum, maximum) {
    return {
      operation: operation,
      rounding: rounding,
      baseAmount: baseAmount,
      minimum: minimum,
      maximum: maximum,
    };
  }

  /* Catalog records may author any multiplier in 0..20000 bp (add-bp: -10000..10000);
     resolveRelicLoadout sums equipped deltas and then CLAMPS the sum to the policy
     minimum/maximum rather than rejecting it. applyIntegerModifier and
     resolveProtocolCastCostWithRelics, which consume resolved modifiers, REJECT amounts
     outside those same bounds because a resolved modifier can never legally carry them. */
  const STAT_POLICIES = deepFreeze({
    "bounty": policy("multiply-bp", "mission-remainder", 10000, 5000, 15000),
    "build-cost": policy("multiply-bp", "ceil", 10000, 7000, 14000),
    "protocol-cost": policy("multiply-bp", "ceil", 10000, 7000, 14000),
    "specialization-cost": policy("multiply-bp", "ceil", 10000, 7000, 14000),
    "starting-aether": policy("add", "none", 0, null, null),
    "starting-integrity": policy("add", "none", 0, null, null),
    "tower-control-duration": policy("multiply-bp", "floor", 10000, 5000, 14000),
    "tower-control-magnitude": policy("multiply-bp", "floor", 10000, 5000, 14000),
    "tower-direct-damage": policy("multiply-bp", "floor", 10000, 7000, 14000),
    "tower-displacement": policy("multiply-bp", "floor", 10000, 5000, 14000),
    "tower-dot-damage": policy("multiply-bp", "floor", 10000, 7000, 14000),
    "tower-range": policy("add-bp", "floor", 0, -2500, 2500),
    "tower-rate": policy("add-bp", "floor", 0, -3000, 4000),
    "upgrade-cost": policy("multiply-bp", "ceil", 10000, 7000, 14000),
  });
  const STAT_IDS = Object.freeze(Object.keys(STAT_POLICIES).sort());
  const STRICT_LIMITS = Object.freeze({
    maxDepth: 16,
    maxNodes: 1024,
    maxArrayLength: 128,
    maxObjectFields: 16,
    maxStringLength: ABI.AUTHORED_ID_MAX_LENGTH,
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function strictDataCopy(value, label) {
    const seen = new WeakSet();
    let nodes = 0;

    function copy(current, depth, path) {
      if (current === null || typeof current === "boolean") return current;
      if (typeof current === "number") {
        if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
          throw new TypeError(path + " must contain safe integers without negative zero");
        }
        return current;
      }
      if (typeof current === "string") {
        if (current.length > STRICT_LIMITS.maxStringLength) {
          throw new RangeError(path + " exceeds the string length limit");
        }
        return current;
      }
      if (!current || typeof current !== "object") {
        throw new TypeError(path + " contains unsupported data");
      }
      if (depth > STRICT_LIMITS.maxDepth) throw new RangeError(label + " exceeds the depth limit");
      if (seen.has(current)) throw new TypeError(label + " contains a cycle or shared reference");
      seen.add(current);
      nodes += 1;
      if (nodes > STRICT_LIMITS.maxNodes) throw new RangeError(label + " exceeds the node limit");
      if (Object.getOwnPropertySymbols(current).length !== 0) {
        throw new TypeError(path + " cannot contain symbol properties");
      }

      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) {
          throw new TypeError(path + " must be an ordinary array");
        }
        if (current.length > STRICT_LIMITS.maxArrayLength) {
          throw new RangeError(path + " exceeds the array length limit");
        }
        const names = Object.getOwnPropertyNames(current);
        names.forEach(function (name) {
          if (name === "length") return;
          if (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= current.length) {
            throw new TypeError(path + " cannot contain extra array properties");
          }
        });
        const output = new Array(current.length);
        for (let index = 0; index < current.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
              !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
            throw new TypeError(path + " must be a dense array of enumerable data properties");
          }
          output[index] = copy(descriptor.value, depth + 1, path + "[" + index + "]");
        }
        return output;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(path + " must be a plain object");
      }
      const names = Object.getOwnPropertyNames(current);
      if (names.length > STRICT_LIMITS.maxObjectFields) {
        throw new RangeError(path + " exceeds the object field limit");
      }
      const output = Object.create(null);
      names.forEach(function (name) {
        if (name.length > STRICT_LIMITS.maxStringLength) {
          throw new RangeError(path + " contains a property name that exceeds the string length limit");
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, name);
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
            !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
          throw new TypeError(path + " must contain only enumerable data properties");
        }
        Object.defineProperty(output, name, {
          value: copy(descriptor.value, depth + 1, path + "." + name),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      });
      return output;
    }

    return copy(value, 0, label);
  }

  function exactFields(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const actual = Object.keys(value).sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (name, index) {
      return name !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function stableId(value, label) {
    if (typeof value !== "string" || value.length > ABI.AUTHORED_ID_MAX_LENGTH || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a bounded stable ASCII ID");
    }
    return value;
  }

  function safeInteger(value, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(label + " must be a safe integer without negative zero");
    }
    return value;
  }

  function normalizeModifier(value, label) {
    exactFields(value, MODIFIER_FIELDS, label);
    const statId = stableId(value.statId, label + " statId");
    if (!Object.prototype.hasOwnProperty.call(STAT_POLICIES, statId)) {
      throw new RangeError(label + " uses unknown Relic stat " + statId);
    }
    const statPolicy = STAT_POLICIES[statId];
    if (value.operation !== statPolicy.operation || value.rounding !== statPolicy.rounding) {
      throw new RangeError(label + " operation/rounding differs from the named stat policy");
    }
    const amount = safeInteger(value.amount, label + " amount");
    if (statPolicy.operation === "multiply-bp" && (amount < 0 || amount > 20000)) {
      throw new RangeError(label + " multiplier is outside the authored bound");
    }
    if (statPolicy.operation === "add-bp" && (amount < -10000 || amount > 10000)) {
      throw new RangeError(label + " basis-point delta is outside the authored bound");
    }
    if (statPolicy.operation === "add" && (amount < -100000 || amount > 100000)) {
      throw new RangeError(label + " additive value is outside the authored bound");
    }
    return {
      statId: statId,
      operation: statPolicy.operation,
      amount: amount,
      rounding: statPolicy.rounding,
    };
  }

  function normalizeModifierSide(value, label, seenStats) {
    if (!Array.isArray(value) || value.length > MAX_MODIFIERS_PER_SIDE) {
      throw new RangeError(label + " must be a bounded modifier array");
    }
    return value.map(function (entry, index) {
      const modifier = normalizeModifier(entry, label + " " + index);
      if (seenStats.has(modifier.statId)) {
        throw new RangeError(label + " duplicates named stat " + modifier.statId);
      }
      seenStats.add(modifier.statId);
      return modifier;
    });
  }

  function normalizeRelicCatalog(value) {
    const source = strictDataCopy(value, "Relic catalog");
    if (!Array.isArray(source) || source.length > MAX_RELICS) {
      throw new RangeError("Relic catalog must be a bounded array");
    }
    let previous = null;
    const output = source.map(function (record, index) {
      const label = "Relic catalog record " + index;
      exactFields(record, RELIC_FIELDS, label);
      const id = stableId(record.id, label + " id");
      if (previous !== null && id <= previous) {
        throw new RangeError("Relic catalog IDs must be unique and in strict ASCII order");
      }
      previous = id;
      const unlockGrantId = stableId(record.unlockGrantId, label + " unlockGrantId");
      if (unlockGrantId !== "grant.relic." + id) {
        throw new RangeError(label + " unlock grant does not match its Relic ID");
      }
      const seenStats = new Set();
      const benefitModifiers = normalizeModifierSide(
        record.benefitModifiers,
        label + " benefit modifiers",
        seenStats
      );
      const drawbackModifiers = normalizeModifierSide(
        record.drawbackModifiers,
        label + " drawback modifiers",
        seenStats
      );
      if (benefitModifiers.length === 0 || drawbackModifiers.length === 0) {
        throw new RangeError(label + " must contain at least one benefit and drawback modifier");
      }
      return {
        id: id,
        unlockGrantId: unlockGrantId,
        benefitModifiers: benefitModifiers,
        drawbackModifiers: drawbackModifiers,
      };
    });
    return deepFreeze(output);
  }

  function clamp(value, minimum, maximum) {
    if (minimum !== null && value < minimum) return minimum;
    if (maximum !== null && value > maximum) return maximum;
    return value;
  }

  function resolveRelicLoadout(catalogValue, equippedValue, slotCapValue) {
    const catalog = normalizeRelicCatalog(catalogValue);
    const equipped = strictDataCopy(equippedValue, "Equipped Relic IDs");
    if (!Array.isArray(equipped) || equipped.length > MAX_EQUIPPED_RELICS) {
      throw new RangeError("Equipped Relic IDs must be a bounded array");
    }
    const slotCap = safeInteger(slotCapValue, "Relic slot cap");
    if (slotCap < 0 || slotCap > MAX_EQUIPPED_RELICS) {
      throw new RangeError("Relic slot cap must be between 0 and " + MAX_EQUIPPED_RELICS);
    }
    if (equipped.length > slotCap) throw new RangeError("Equipped Relics exceed the Relic slot cap");
    const catalogById = new Map(catalog.map(function (record) { return [record.id, record]; }));
    let previous = null;
    const records = equipped.map(function (entry, index) {
      const id = stableId(entry, "Equipped Relic ID " + index);
      if (previous !== null && id <= previous) {
        throw new RangeError("Equipped Relic IDs must be unique and in strict ASCII order");
      }
      previous = id;
      if (!catalogById.has(id)) throw new RangeError("Unknown Relic " + id);
      return catalogById.get(id);
    });

    const combined = new Map();
    records.forEach(function (record) {
      record.benefitModifiers.concat(record.drawbackModifiers).forEach(function (modifier) {
        const statPolicy = STAT_POLICIES[modifier.statId];
        const delta = statPolicy.operation === "multiply-bp"
          ? ABI.checkedAdd(modifier.amount, -ABI.BASIS_POINTS)
          : modifier.amount;
        const current = combined.has(modifier.statId)
          ? combined.get(modifier.statId)
          : statPolicy.baseAmount;
        combined.set(modifier.statId, ABI.checkedAdd(current, delta));
      });
    });

    const modifiers = Array.from(combined.keys()).sort().map(function (statId) {
      const statPolicy = STAT_POLICIES[statId];
      return {
        statId: statId,
        operation: statPolicy.operation,
        amount: clamp(combined.get(statId), statPolicy.minimum, statPolicy.maximum),
        rounding: statPolicy.rounding,
      };
    });
    return deepFreeze({
      schemaVersion: RELIC_SCHEMA_VERSION,
      equippedRelicIds: equipped.slice(),
      modifiers: modifiers,
    });
  }

  function normalizeResolvedModifier(value) {
    const source = strictDataCopy(value, "Resolved Relic modifier");
    return normalizeModifier(source, "Resolved Relic modifier");
  }

  function assertWithinPolicyClamp(amount, statPolicy, label) {
    if ((statPolicy.minimum !== null && amount < statPolicy.minimum) ||
        (statPolicy.maximum !== null && amount > statPolicy.maximum)) {
      throw new RangeError(label + " lies outside the named stat clamp bounds");
    }
    return amount;
  }

  function applyIntegerModifier(baseValue, modifierValue) {
    const base = safeInteger(baseValue, "Relic modifier base value");
    const modifier = normalizeResolvedModifier(modifierValue);
    const statPolicy = STAT_POLICIES[modifier.statId];
    assertWithinPolicyClamp(modifier.amount, statPolicy, "Resolved Relic modifier amount");
    if (modifier.operation === "add") {
      const sum = ABI.checkedAdd(base, modifier.amount);
      return sum < 0 ? 0 : sum;
    }
    const multiplierBp = modifier.operation === "add-bp"
      ? ABI.checkedAdd(ABI.BASIS_POINTS, modifier.amount)
      : modifier.amount;
    if (modifier.rounding === "floor") {
      if (base < 0) throw new RangeError("Floored Relic multipliers require a nonnegative base value");
      return ABI.checkedMulDivFloor(base, [multiplierBp], [ABI.BASIS_POINTS]);
    }
    if (modifier.rounding === "ceil") {
      if (base < 0) throw new RangeError("Ceiled Relic multipliers require a nonnegative base value");
      return ABI.checkedMulDivCeil(base, [multiplierBp], [ABI.BASIS_POINTS]);
    }
    throw new RangeError("Mission-remainder modifiers require applyBountyWithRemainder");
  }

  function resolveProtocolCastCostWithRelics(baseCostValue, priorAcceptedCastsValue, multiplierBpValue) {
    const baseCost = safeInteger(baseCostValue, "Protocol base cast cost");
    const priorAcceptedCasts = safeInteger(priorAcceptedCastsValue, "Prior accepted Protocol casts");
    const multiplierBp = safeInteger(multiplierBpValue, "Protocol cost multiplier basis points");
    if (baseCost < 0) throw new RangeError("Protocol base cast cost must be nonnegative");
    if (priorAcceptedCasts < 0) throw new RangeError("Prior accepted Protocol casts must be nonnegative");
    assertWithinPolicyClamp(
      multiplierBp,
      STAT_POLICIES["protocol-cost"],
      "Protocol cost multiplier basis points"
    );
    const escalationBp = ABI.checkedAdd(
      ABI.BASIS_POINTS,
      ABI.checkedMultiply(PROTOCOL_REPEAT_SURCHARGE_BP, priorAcceptedCasts)
    );
    return ABI.checkedMulDivCeil(
      baseCost,
      [escalationBp, multiplierBp],
      [ABI.BASIS_POINTS, ABI.BASIS_POINTS]
    );
  }

  function applyBountyWithRemainder(baseBountyValue, multiplierBpValue, remainderValue) {
    const baseBounty = safeInteger(baseBountyValue, "Base bounty");
    const multiplierBp = safeInteger(multiplierBpValue, "Bounty multiplier basis points");
    const remainder = safeInteger(remainderValue, "Bounty remainder");
    if (baseBounty < 0 || multiplierBp < 0 || remainder < 0 || remainder >= ABI.BASIS_POINTS) {
      throw new RangeError("Bounty inputs must be nonnegative and the remainder below 10000");
    }
    const numerator = ABI.checkedAdd(ABI.checkedMultiply(baseBounty, multiplierBp), remainder);
    return Object.freeze({
      aetherAward: ABI.floorDivNonnegative(numerator, ABI.BASIS_POINTS),
      bountyRemainder: numerator % ABI.BASIS_POINTS,
    });
  }

  return deepFreeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    RELIC_SCHEMA_VERSION: RELIC_SCHEMA_VERSION,
    STAT_POLICIES: STAT_POLICIES,
    STAT_IDS: STAT_IDS,
    normalizeRelicCatalog: normalizeRelicCatalog,
    resolveRelicLoadout: resolveRelicLoadout,
    applyIntegerModifier: applyIntegerModifier,
    resolveProtocolCastCostWithRelics: resolveProtocolCastCostWithRelics,
    applyBountyWithRemainder: applyBountyWithRemainder,
  });
});
