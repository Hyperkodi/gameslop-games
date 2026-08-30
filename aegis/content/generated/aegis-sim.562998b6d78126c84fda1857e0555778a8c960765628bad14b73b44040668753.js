/* Generated Armara Aegis deterministic simulation bundle.
   Exact source hashes bind ABI and named deterministic modules in declared order. */
(function (ROOT) {
  "use strict";
  const HAS_COMMON_JS = typeof module !== "undefined" && !!module.exports;
  const BUNDLE_ROOT = HAS_COMMON_JS ? Object.create(null) : ROOT;

  /* source abi.js bytes=32198 sha256=6f054337c8285e025ed10dc32e8917b080f6196a40e237234ac83b7d4bcb70cc */
/* Armara Aegis deterministic simulation ABI v1.
   Pure exact-integer helpers shared by source tests and future generated simulation artifacts.
   This file intentionally has no dependency on the DOM, network, storage, or GameSlopKit. */
(function (root, factory) {
  "use strict";

  const api = factory();

  const game = root.Game || {};
  if (!root.Game) {
    Object.defineProperty(root, "Game", {
      value: game,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  if (Object.prototype.hasOwnProperty.call(game, "AegisSim")) {
    if (game.AegisSim !== api) throw new Error("Game.AegisSim is already installed");
    return;
  }
  Object.defineProperty(game, "AegisSim", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function () {
  "use strict";

  const TICKS_PER_SECOND = 60;
  const TIME_UNITS_PER_SECOND = 60000;
  const TIME_UNITS_PER_TICK = 1000;
  const DISTANCE_SCALE = 1000;
  const DAMAGE_SCALE = 1000;
  const BASIS_POINTS = 10000;
  const MAX_AUTHORED_DECIMAL_PLACES = 3;
  const MAX_UINT32 = 0xffffffff;
  const EVENT_SCHEMA_VERSION = 1;
  const BEHAVIOR_REGISTRY_VERSION = 1;

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  const DESCRIPTOR = deepFreeze({
    id: "armara-aegis-sim-abi",
    version: 1,
    canonicalVersion: 1,
    safeIntegerMax: Number.MAX_SAFE_INTEGER,
    ticksPerSecond: TICKS_PER_SECOND,
    timeUnitsPerSecond: TIME_UNITS_PER_SECOND,
    timeUnitsPerTick: TIME_UNITS_PER_TICK,
    distanceScale: DISTANCE_SCALE,
    damageScale: DAMAGE_SCALE,
    basisPoints: BASIS_POINTS,
    maxAuthoredDecimalPlaces: MAX_AUTHORED_DECIMAL_PLACES,
    externalCapsBp: { damage: 2000, range: 1200, rate: 1500 },
    phaseOrder: [
      "commands",
      "scheduled-spawns",
      "status-expiry",
      "movement",
      "leaks",
      "tower-acquisition-and-attacks",
      "shield-damage-and-status",
      "guarded-boss-threshold-transition",
      "terminal-death-execute-children-and-revival",
      "bounty",
      "wave-clear",
    ],
    commands: {
      schemaVersion: 1,
      recordFields: ["tick", "seq", "type"],
      sequence: "zero-based-strictly-increasing-within-tick",
      application: "beginning-of-tick-in-sequence-order",
      acceptedWaveStartGrant: "credited-before-scheduled-spawns",
    },
    runtimeIds: {
      domains: ["tower", "enemy", "summon", "projectile", "effect"],
      initialValue: 1,
      allocation: "accepted-creation-only-monotonic-per-domain",
      denialOrPlanReset: "never-rewinds-a-counter",
      batchOrder: ["source-id", "authored-index"],
    },
    timers: {
      decrementUnitsPerTick: TIME_UNITS_PER_TICK,
      due: "after-named-phase-decrement-when-remaining-is-less-than-or-equal-to-zero",
      overshoot: "negative-remainder-carried-into-repeated-schedule",
      repeatingEventCap: "strict-authored-per-tick",
      simultaneousOrder: ["authored-order", "stable-runtime-id"],
    },
    cooldown: {
      initialRemainingUnits: 0,
      decrement: "subtract-timeUnitsPerTick-only-when-positive-during-attack-phase",
      due: "zero-is-already-due",
      attacksPerTowerPerTickMax: 1,
      noTarget: "clamp-to-zero-and-reacquire-next-eligible-attack-phase",
      scheduleFormula: "remaining += ceil(baseCooldownUnits * basisPoints / (basisPoints + externalRateBp))",
      activeRescale: "forbidden-on-upgrade-link-unlink-enable-disable-or-source-change",
      minimumEffectiveCooldownUnits: TIME_UNITS_PER_TICK,
    },
    movement: {
      formula: "numerator = speedDistanceUnitsPerSecond * effectiveSpeedBp + remainder",
      divisor: TICKS_PER_SECOND * BASIS_POINTS,
      advance: "floor(numerator / divisor)",
      remainder: "numerator % divisor",
      remainderOnSpeedChange: "preserved",
      displacementDivision: "signed-truncate-toward-zero",
      routeBounds: "clamped",
    },
    geometry: {
      coordinates: "compiled-integer-distance-units",
      compilerSegmentLength: "floor-bigint-isqrt(dx-squared-plus-dy-squared)",
      routeLength: "checked-sum-of-positive-segment-lengths",
      waypointOwnership: "exact-interior-boundary-belongs-to-incoming-segment-route-start-to-first",
      interpolation: "start + trunc(distanceIntoSegment * signedDelta / segmentLength)",
      rangeEligibility: "dx-squared-plus-dy-squared-less-than-or-equal-to-range-squared",
      arithmetic: "checked-safe-integer-products-at-runtime",
    },
    statuses: {
      expiryPhase: "status-expiry",
      decrementUnitsPerTick: TIME_UNITS_PER_TICK,
      removal: "before-movement-and-targeting-when-remaining-is-less-than-or-equal-to-zero",
      appliedAfterExpiry: "first-decrement-on-next-tick",
      instanceComparator: ["magnitude-desc", "expiry-desc", "source-id-asc"],
    },
    division: {
      nonnegative: "floor",
      signed: "truncate-toward-zero",
      ceiling: "quotient-plus-nonzero-remainder",
      rational: "cross-cancel-before-checked-multiplication",
    },
    formulas: {
      authoredMilliseconds: "milliseconds * 60",
      effectiveCooldown: "ceil(baseCooldownUnits * 10000 / (10000 + externalRateBp))",
      effectiveRange: "floor(baseRangeUnits * (10000 + externalRangeBp) / 10000)",
      scaledSlow: "floor(strongestReductionBp * enemySlowControlBp / 10000)",
      effectiveSpeed: "max(enemyMinMovementBp, 10000 - scaledReductionBp)",
      preShieldDamage: "floor(baseDamageMilli * product(internalDamageBp) * (10000 + externalDamageBp) / 10000^(internalCount + 1))",
      sellRefund: "floor(investedAether * 70 / 100)",
    },
    damagePipeline: {
      internalCoefficientOrder: ["lock-on", "crit", "center-hit", "pierce", "chain-or-fork", "boss"],
      externalResolution: "same-name-strongest-then-distinct-source-types-in-ascii-order-then-cap",
      resolutionOrder: [
        "reveal-and-target-eligibility-snapshot",
        "base-milli-damage",
        "internal-coefficients",
        "external-damage-amplification",
        "authored-shield-coefficient",
        "ordered-shield-pool-consumption",
        "armor-ignore-and-armor-break",
        "native-resistance",
        "minimum-positive-hp-application",
        "authored-status-application",
        "guarded-boss-threshold-transition",
        "terminal-death-or-execute",
        "children-or-revival-scheduling",
        "bounty",
      ],
      coefficientRounding: "cross-cancel-then-one-floor-at-pre-shield-boundary",
      shieldPoolOrder: ["earliest-expiry", "source-id-asc"],
      minimumPositiveNonimmuneHpDamageMilli: 1,
      executeBosses: false,
    },
    behaviorRegistry: {
      id: "armara-aegis-behavior-registry",
      version: BEHAVIOR_REGISTRY_VERSION,
      dispatch: "stable-ascii-behavior-id",
      membership: "simulation-artifact-owned-and-ruleset-hashed",
      arbitraryExecutableContent: "forbidden",
      contracts: [
        { id: "armorBreak", version: 1 },
        { id: "aura", version: 1 },
        { id: "block", version: 1 },
        { id: "bossScript", version: 1 },
        { id: "chain", version: 1 },
        { id: "direct", version: 1 },
        { id: "dot", version: 1 },
        { id: "execute", version: 1 },
        { id: "slow", version: 1 },
        { id: "spawnUnit", version: 1 },
        { id: "splash", version: 1 },
      ],
    },
    canonicalEncoding: {
      version: 1,
      format: "utf8-json-no-whitespace",
      keys: "ascii-lexicographic",
      arrays: "authored-order",
      numbers: "safe-integers-only",
      objectGraph: "tree-only-no-cycles-or-shared-references",
      allowedTypes: ["integer", "boolean", "string", "null", "array", "ascii-keyed-object"],
    },
    hashes: {
      diagnostic: { algorithm: "fnv1a32", input: "canonical-utf8-bytes", output: "uint32" },
      finalState: { algorithm: "sha256", input: "canonical-utf8-bytes", output: "lowercase-hex" },
      ruleset: {
        algorithm: "sha256",
        framing: "uint64be-byte-length-prefix-before-each-input",
        inputs: ["abi-descriptor-bytes", "simulation-artifact-bytes", "compiled-content-bytes"],
      },
    },
    rng: {
      algorithm: "mulberry32",
      namedSeed: "fnv1a32-utf8(unsignedMissionSeed + NUL + streamId)",
      streamId: "non-empty-ascii-without-nul",
      state: "explicit-uint32-in-canonical-authoritative-simulation-state",
      stateTransition: "mulberry32Step(uint32-state)->{state,uint32}",
      floatProjection: "uint32 / 4294967296",
      consumption: "declared-simulation-sites-only-in-stable-authored-order",
      cosmeticConsumption: "forbidden",
      groupShuffle: "only-when-shuffleWithinGroup-is-true",
      consumptionChange: "changes-ruleset-identity",
    },
    tutorialUpgradeGate: {
      modes: ["m01-wave1", "none"],
      skipCommand: "skipTutorialGate",
      denialReason: "tutorial-gated",
      profileLookupDuringReplay: "forbidden",
    },
  });

  function assertSafeInteger(value, label) {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError((label || "Value") + " must be a safe integer");
    }
    return value;
  }

  function assertNonnegativeSafeInteger(value, label) {
    assertSafeInteger(value, label);
    if (value < 0) throw new RangeError((label || "Value") + " must be nonnegative");
    return value;
  }

  function assertPositiveSafeInteger(value, label) {
    assertSafeInteger(value, label);
    if (value <= 0) throw new RangeError((label || "Value") + " must be positive");
    return value;
  }

  function checkedAdd(left, right) {
    assertSafeInteger(left, "Left addend");
    assertSafeInteger(right, "Right addend");
    const result = left + right;
    if (!Number.isSafeInteger(result)) throw new RangeError("Addition leaves the safe integer range");
    return result;
  }

  function checkedMultiply(left, right) {
    assertSafeInteger(left, "Left factor");
    assertSafeInteger(right, "Right factor");
    const result = left * right;
    if (!Number.isSafeInteger(result)) throw new RangeError("Multiplication leaves the safe integer range");
    return result;
  }

  function floorDivNonnegative(numerator, denominator) {
    assertNonnegativeSafeInteger(numerator, "Numerator");
    assertPositiveSafeInteger(denominator, "Denominator");
    return Math.floor(numerator / denominator);
  }

  function ceilDivNonnegative(numerator, denominator) {
    assertNonnegativeSafeInteger(numerator, "Numerator");
    assertPositiveSafeInteger(denominator, "Denominator");
    const quotient = Math.floor(numerator / denominator);
    return quotient + (numerator % denominator === 0 ? 0 : 1);
  }

  function truncDivSigned(numerator, denominator) {
    assertSafeInteger(numerator, "Numerator");
    assertPositiveSafeInteger(denominator, "Denominator");
    return Math.trunc(numerator / denominator);
  }

  function greatestCommonDivisor(left, right) {
    left = Math.abs(assertSafeInteger(left, "Left GCD operand"));
    right = Math.abs(assertSafeInteger(right, "Right GCD operand"));
    while (right !== 0) {
      const remainder = left % right;
      left = right;
      right = remainder;
    }
    return left;
  }

  function validatedFactors(values, label, denominators) {
    if (!Array.isArray(values)) throw new TypeError(label + " must be an array");
    return values.map(function (value, index) {
      if (denominators) return assertPositiveSafeInteger(value, label + "[" + index + "] denominator");
      return assertNonnegativeSafeInteger(value, label + "[" + index + "]");
    });
  }

  function crossCancelledProducts(base, numeratorFactors, denominatorFactors) {
    const numerators = [assertNonnegativeSafeInteger(base, "Base")].concat(
      validatedFactors(numeratorFactors, "Numerator factors", false)
    );
    const denominators = validatedFactors(denominatorFactors, "Denominator factors", true);

    for (let numeratorIndex = 0; numeratorIndex < numerators.length; numeratorIndex++) {
      for (let denominatorIndex = 0; denominatorIndex < denominators.length; denominatorIndex++) {
        const divisor = greatestCommonDivisor(numerators[numeratorIndex], denominators[denominatorIndex]);
        if (divisor > 1) {
          numerators[numeratorIndex] /= divisor;
          denominators[denominatorIndex] /= divisor;
        }
      }
    }

    let numeratorProduct = 1;
    for (let i = 0; i < numerators.length; i++) {
      numeratorProduct = checkedMultiply(numeratorProduct, numerators[i]);
    }
    let denominatorProduct = 1;
    for (let i = 0; i < denominators.length; i++) {
      denominatorProduct = checkedMultiply(denominatorProduct, denominators[i]);
    }
    return { numerator: numeratorProduct, denominator: denominatorProduct };
  }

  function checkedMulDivFloor(base, numeratorFactors, denominatorFactors) {
    const products = crossCancelledProducts(base, numeratorFactors, denominatorFactors);
    return floorDivNonnegative(products.numerator, products.denominator);
  }

  function checkedMulDivCeil(base, numeratorFactors, denominatorFactors) {
    const products = crossCancelledProducts(base, numeratorFactors, denominatorFactors);
    return ceilDivNonnegative(products.numerator, products.denominator);
  }

  function parseExactDecimal(text, scale) {
    if (typeof text !== "string") throw new TypeError("Exact decimal input must be a string");
    scale = scale === undefined ? DISTANCE_SCALE : scale;
    assertPositiveSafeInteger(scale, "Decimal scale");

    const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]{1,3}))?$/.exec(text);
    if (!match) throw new TypeError("Invalid exact decimal: " + text);

    const whole = Number(match[2]);
    assertSafeInteger(whole, "Decimal whole part");
    const fractionText = match[3] || "";
    const fractionDivisor = Math.pow(10, fractionText.length);
    if (scale % fractionDivisor !== 0) {
      throw new RangeError("Decimal scale cannot represent " + text + " exactly");
    }

    const scaledWhole = checkedMultiply(whole, scale);
    const fraction = fractionText === "" ? 0 : Number(fractionText);
    const scaledFraction = checkedMultiply(fraction, scale / fractionDivisor);
    const magnitude = checkedAdd(scaledWhole, scaledFraction);
    return match[1] === "-" && magnitude !== 0 ? -magnitude : magnitude;
  }

  function assertCappedBasisPoints(value, cap, label) {
    assertNonnegativeSafeInteger(value, label);
    if (value > cap) throw new RangeError(label + " exceed the ABI cap of " + cap);
    return value;
  }

  function authoredMillisecondsToTimeUnits(milliseconds) {
    assertNonnegativeSafeInteger(milliseconds, "Authored milliseconds");
    return checkedMultiply(milliseconds, TICKS_PER_SECOND);
  }

  function effectiveCooldownUnits(baseCooldownUnits, externalRateBp) {
    assertPositiveSafeInteger(baseCooldownUnits, "Base cooldown units");
    assertCappedBasisPoints(externalRateBp, DESCRIPTOR.externalCapsBp.rate, "External rate basis points");
    return checkedMulDivCeil(
      baseCooldownUnits,
      [BASIS_POINTS],
      [checkedAdd(BASIS_POINTS, externalRateBp)]
    );
  }

  function effectiveRangeUnits(baseRangeUnits, externalRangeBp) {
    assertNonnegativeSafeInteger(baseRangeUnits, "Base range units");
    assertCappedBasisPoints(externalRangeBp, DESCRIPTOR.externalCapsBp.range, "External range basis points");
    return checkedMulDivFloor(
      baseRangeUnits,
      [checkedAdd(BASIS_POINTS, externalRangeBp)],
      [BASIS_POINTS]
    );
  }

  function resolveStrongestSlowBp(strongestReductionBp, enemySlowControlBp, enemyMinMovementBp) {
    assertCappedBasisPoints(strongestReductionBp, BASIS_POINTS, "Strongest movement reduction basis points");
    assertCappedBasisPoints(enemySlowControlBp, BASIS_POINTS, "Enemy slow control basis points");
    assertCappedBasisPoints(enemyMinMovementBp, BASIS_POINTS, "Enemy minimum movement basis points");
    const scaledReductionBp = checkedMulDivFloor(
      strongestReductionBp,
      [enemySlowControlBp],
      [BASIS_POINTS]
    );
    return {
      scaledReductionBp: scaledReductionBp,
      effectiveSpeedBp: Math.max(enemyMinMovementBp, BASIS_POINTS - scaledReductionBp),
    };
  }

  function preShieldDamageMilli(baseDamageMilli, internalDamageBp, externalDamageBp) {
    assertNonnegativeSafeInteger(baseDamageMilli, "Base damage milli");
    const internal = validatedFactors(internalDamageBp, "Internal damage coefficients", false);
    assertNonnegativeSafeInteger(externalDamageBp, "External damage basis points");
    if (externalDamageBp > DESCRIPTOR.externalCapsBp.damage) {
      throw new RangeError("External damage basis points exceed the ABI cap");
    }
    const externalCoefficient = checkedAdd(BASIS_POINTS, externalDamageBp);
    const numerators = internal.concat([externalCoefficient]);
    const denominators = Array(internal.length + 1).fill(BASIS_POINTS);
    return checkedMulDivFloor(baseDamageMilli, numerators, denominators);
  }

  function shieldBoundDamageMilli(preShieldDamage, shieldCoefficientBp) {
    assertNonnegativeSafeInteger(preShieldDamage, "Pre-shield damage milli");
    assertNonnegativeSafeInteger(shieldCoefficientBp, "Shield coefficient basis points");
    return checkedMulDivFloor(
      preShieldDamage,
      [shieldCoefficientBp],
      [BASIS_POINTS]
    );
  }

  function resolveHpDamageMilli(
    shieldOverflowMilli,
    armorMilli,
    armorBreakMilli,
    armorIgnoreBp,
    nativeResistanceBp
  ) {
    assertNonnegativeSafeInteger(shieldOverflowMilli, "Shield overflow damage milli");
    assertNonnegativeSafeInteger(armorMilli, "Armor milli");
    assertNonnegativeSafeInteger(armorBreakMilli, "Armor-break milli");
    assertCappedBasisPoints(armorIgnoreBp, BASIS_POINTS, "Armor-ignore basis points");
    assertCappedBasisPoints(nativeResistanceBp, BASIS_POINTS, "Native resistance basis points");

    const effectiveArmorMilli = Math.max(0, checkedAdd(armorMilli, -armorBreakMilli));
    const mitigatingArmorMilli = checkedMulDivFloor(
      effectiveArmorMilli,
      [checkedAdd(BASIS_POINTS, -armorIgnoreBp)],
      [BASIS_POINTS]
    );
    const postArmorMilli = Math.max(
      0,
      checkedAdd(shieldOverflowMilli, -mitigatingArmorMilli)
    );
    const resistanceCoefficientBp = checkedAdd(BASIS_POINTS, -nativeResistanceBp);
    const postResistanceMilli = postArmorMilli === 0 || resistanceCoefficientBp === 0
      ? 0
      : checkedMulDivFloor(
          postArmorMilli,
          [resistanceCoefficientBp],
          [BASIS_POINTS]
        );
    const hpDamageMilli = postArmorMilli > 0 && resistanceCoefficientBp > 0
      ? Math.max(1, postResistanceMilli)
      : 0;

    return Object.freeze({
      effectiveArmorMilli: effectiveArmorMilli,
      hpDamageMilli: hpDamageMilli,
      mitigatingArmorMilli: mitigatingArmorMilli,
      postArmorMilli: postArmorMilli,
      postResistanceMilli: postResistanceMilli,
    });
  }

  function refundSeventyPercent(invested) {
    assertNonnegativeSafeInteger(invested, "Invested Aether");
    const hundreds = Math.floor(invested / 100);
    const remainder = invested % 100;
    return checkedAdd(checkedMultiply(hundreds, 70), Math.floor(remainder * 70 / 100));
  }

  function isAscii(value) {
    for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) > 0x7f) return false;
    return true;
  }

  function utf8Bytes(value) {
    if (typeof value !== "string") throw new TypeError("UTF-8 input must be a string");
    const bytes = [];
    for (let i = 0; i < value.length; i++) {
      let codePoint = value.charCodeAt(i);
      if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
        const low = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
        if (low >= 0xdc00 && low <= 0xdfff) {
          codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
          i++;
        } else {
          codePoint = 0xfffd;
        }
      } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
        codePoint = 0xfffd;
      }

      if (codePoint <= 0x7f) {
        bytes.push(codePoint);
      } else if (codePoint <= 0x7ff) {
        bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
      } else if (codePoint <= 0xffff) {
        bytes.push(
          0xe0 | (codePoint >>> 12),
          0x80 | ((codePoint >>> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      } else {
        bytes.push(
          0xf0 | (codePoint >>> 18),
          0x80 | ((codePoint >>> 12) & 0x3f),
          0x80 | ((codePoint >>> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      }
    }
    return Uint8Array.from(bytes);
  }

  const SHA256_INITIAL = Object.freeze([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const SHA256_CONSTANTS = Object.freeze([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function hashInputBytes(value) {
    if (typeof value === "string") return utf8Bytes(value);
    if (value instanceof Uint8Array) return value;
    throw new TypeError("Hash input must be a string or Uint8Array bytes");
  }

  function rotateRight(value, places) {
    return ((value >>> places) | (value << (32 - places))) >>> 0;
  }

  function sha256Bytes(value) {
    const source = hashInputBytes(value);
    const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
    if (!Number.isSafeInteger(paddedLength)) throw new RangeError("SHA-256 input is too large");
    const message = new Uint8Array(paddedLength);
    message.set(source);
    message[source.length] = 0x80;

    const bitLengthHigh = Math.floor(source.length / 0x20000000) >>> 0;
    const bitLengthLow = (source.length * 8) >>> 0;
    const lengthOffset = paddedLength - 8;
    message[lengthOffset] = bitLengthHigh >>> 24;
    message[lengthOffset + 1] = bitLengthHigh >>> 16;
    message[lengthOffset + 2] = bitLengthHigh >>> 8;
    message[lengthOffset + 3] = bitLengthHigh;
    message[lengthOffset + 4] = bitLengthLow >>> 24;
    message[lengthOffset + 5] = bitLengthLow >>> 16;
    message[lengthOffset + 6] = bitLengthLow >>> 8;
    message[lengthOffset + 7] = bitLengthLow;

    const hash = SHA256_INITIAL.slice();
    const words = new Uint32Array(64);
    for (let offset = 0; offset < message.length; offset += 64) {
      for (let i = 0; i < 16; i++) {
        const at = offset + i * 4;
        words[i] = (
          (message[at] << 24) |
          (message[at + 1] << 16) |
          (message[at + 2] << 8) |
          message[at + 3]
        ) >>> 0;
      }
      for (let i = 16; i < 64; i++) {
        const smallSigma0 = (
          rotateRight(words[i - 15], 7) ^
          rotateRight(words[i - 15], 18) ^
          (words[i - 15] >>> 3)
        ) >>> 0;
        const smallSigma1 = (
          rotateRight(words[i - 2], 17) ^
          rotateRight(words[i - 2], 19) ^
          (words[i - 2] >>> 10)
        ) >>> 0;
        words[i] = (words[i - 16] + smallSigma0 + words[i - 7] + smallSigma1) >>> 0;
      }

      let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
      let e = hash[4], f = hash[5], g = hash[6], h = hash[7];
      for (let i = 0; i < 64; i++) {
        const bigSigma1 = (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
        const choose = ((e & f) ^ ((~e) & g)) >>> 0;
        const temporary1 = (h + bigSigma1 + choose + SHA256_CONSTANTS[i] + words[i]) >>> 0;
        const bigSigma0 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
        const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const temporary2 = (bigSigma0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temporary1) >>> 0;
        d = c; c = b; b = a; a = (temporary1 + temporary2) >>> 0;
      }

      hash[0] = (hash[0] + a) >>> 0;
      hash[1] = (hash[1] + b) >>> 0;
      hash[2] = (hash[2] + c) >>> 0;
      hash[3] = (hash[3] + d) >>> 0;
      hash[4] = (hash[4] + e) >>> 0;
      hash[5] = (hash[5] + f) >>> 0;
      hash[6] = (hash[6] + g) >>> 0;
      hash[7] = (hash[7] + h) >>> 0;
    }

    const output = new Uint8Array(32);
    for (let i = 0; i < hash.length; i++) {
      output[i * 4] = hash[i] >>> 24;
      output[i * 4 + 1] = hash[i] >>> 16;
      output[i * 4 + 2] = hash[i] >>> 8;
      output[i * 4 + 3] = hash[i];
    }
    return output;
  }

  function sha256Hex(value) {
    const bytes = sha256Bytes(value);
    let result = "";
    for (let i = 0; i < bytes.length; i++) result += ("0" + bytes[i].toString(16)).slice(-2);
    return result;
  }

  function canonicalEncode(value) {
    const seen = new WeakSet();

    function encode(current) {
      if (current === null) return "null";
      const type = typeof current;
      if (type === "boolean") return current ? "true" : "false";
      if (type === "string") return JSON.stringify(current);
      if (type === "number") {
        if (!Number.isSafeInteger(current)) {
          throw new TypeError("Canonical numbers must be safe integers");
        }
        return Object.is(current, -0) ? "0" : String(current);
      }
      if (type !== "object") throw new TypeError("Unsupported canonical value type: " + type);
      if (seen.has(current)) throw new TypeError("Canonical state cannot contain a cycle or shared reference");
      seen.add(current);

      if (Array.isArray(current)) {
        if (Object.getOwnPropertySymbols(current).length) {
          throw new TypeError("Canonical arrays cannot have symbol properties");
        }
        const ownNames = Object.getOwnPropertyNames(current);
        for (let i = 0; i < current.length; i++) {
          if (!Object.prototype.hasOwnProperty.call(current, i)) {
            throw new TypeError("Canonical arrays cannot be sparse");
          }
        }
        for (let i = 0; i < ownNames.length; i++) {
          const name = ownNames[i];
          if (name === "length") continue;
          if (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= current.length) {
            throw new TypeError("Canonical arrays cannot have extra properties");
          }
          const property = Object.getOwnPropertyDescriptor(current, name);
          if (!property.enumerable || property.get || property.set) {
            throw new TypeError("Canonical array elements must be enumerable data properties");
          }
        }
        return "[" + current.map(encode).join(",") + "]";
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError("Canonical objects must be plain objects");
      }
      if (Object.getOwnPropertySymbols(current).length) {
        throw new TypeError("Canonical objects cannot have symbol properties");
      }

      const names = Object.getOwnPropertyNames(current);
      for (let i = 0; i < names.length; i++) {
        const key = names[i];
        if (!isAscii(key)) throw new TypeError("Canonical object keys must be ASCII");
        const property = Object.getOwnPropertyDescriptor(current, key);
        if (!property.enumerable || property.get || property.set) {
          throw new TypeError("Canonical object properties must be enumerable data properties");
        }
      }
      names.sort();
      return "{" + names.map(function (key) {
        return JSON.stringify(key) + ":" + encode(current[key]);
      }).join(",") + "}";
    }

    return encode(value);
  }

  function canonicalBytes(value) {
    return utf8Bytes(canonicalEncode(value));
  }

  function fnv1a32(value) {
    const bytes = hashInputBytes(value);
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  function fnv1a32Hex(value) {
    return ("00000000" + fnv1a32(value).toString(16)).slice(-8);
  }

  function assertUnsigned32(value, label) {
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_UINT32) {
      throw new RangeError((label || "Value") + " must be an unsigned 32-bit integer");
    }
    return value >>> 0;
  }

  function deriveNamedSeed(unsignedMissionSeed, streamId) {
    assertUnsigned32(unsignedMissionSeed, "Unsigned mission seed");
    if (typeof streamId !== "string" || streamId.length === 0 || !isAscii(streamId)) {
      throw new TypeError("Stream ID must be a non-empty ASCII string");
    }
    if (streamId.indexOf("\0") !== -1) throw new TypeError("Stream ID cannot contain NUL");
    return fnv1a32(String(unsignedMissionSeed) + "\0" + streamId);
  }

  function mulberry32Step(seed) {
    const state = (assertUnsigned32(seed, "Mulberry32 state") + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return Object.freeze({ state: state, uint32: (value ^ (value >>> 14)) >>> 0 });
  }

  function mulberry32(seed) {
    let state = assertUnsigned32(seed, "Mulberry32 seed");
    return function next() {
      const step = mulberry32Step(state);
      state = step.state;
      return step.uint32 / 4294967296;
    };
  }

  const DESCRIPTOR_CANONICAL = canonicalEncode(DESCRIPTOR);
  const DESCRIPTOR_SHA256 = sha256Hex(DESCRIPTOR_CANONICAL);
  const BEHAVIOR_CONTRACTS = DESCRIPTOR.behaviorRegistry.contracts;

  function descriptorCanonicalBytes() {
    return utf8Bytes(DESCRIPTOR_CANONICAL);
  }

  return Object.freeze({
    DESCRIPTOR: DESCRIPTOR,
    DESCRIPTOR_CANONICAL: DESCRIPTOR_CANONICAL,
    DESCRIPTOR_SHA256: DESCRIPTOR_SHA256,
    BEHAVIOR_CONTRACTS: BEHAVIOR_CONTRACTS,
    EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
    BEHAVIOR_REGISTRY_VERSION: BEHAVIOR_REGISTRY_VERSION,
    TICKS_PER_SECOND: TICKS_PER_SECOND,
    TIME_UNITS_PER_SECOND: TIME_UNITS_PER_SECOND,
    TIME_UNITS_PER_TICK: TIME_UNITS_PER_TICK,
    DISTANCE_SCALE: DISTANCE_SCALE,
    DAMAGE_SCALE: DAMAGE_SCALE,
    BASIS_POINTS: BASIS_POINTS,
    MAX_AUTHORED_DECIMAL_PLACES: MAX_AUTHORED_DECIMAL_PLACES,
    assertSafeInteger: assertSafeInteger,
    checkedAdd: checkedAdd,
    checkedMultiply: checkedMultiply,
    floorDivNonnegative: floorDivNonnegative,
    ceilDivNonnegative: ceilDivNonnegative,
    truncDivSigned: truncDivSigned,
    checkedMulDivFloor: checkedMulDivFloor,
    checkedMulDivCeil: checkedMulDivCeil,
    parseExactDecimal: parseExactDecimal,
    authoredMillisecondsToTimeUnits: authoredMillisecondsToTimeUnits,
    effectiveCooldownUnits: effectiveCooldownUnits,
    effectiveRangeUnits: effectiveRangeUnits,
    resolveStrongestSlowBp: resolveStrongestSlowBp,
    preShieldDamageMilli: preShieldDamageMilli,
    shieldBoundDamageMilli: shieldBoundDamageMilli,
    resolveHpDamageMilli: resolveHpDamageMilli,
    refundSeventyPercent: refundSeventyPercent,
    utf8Bytes: utf8Bytes,
    canonicalEncode: canonicalEncode,
    canonicalBytes: canonicalBytes,
    descriptorCanonicalBytes: descriptorCanonicalBytes,
    fnv1a32: fnv1a32,
    fnv1a32Hex: fnv1a32Hex,
    sha256Bytes: sha256Bytes,
    sha256Hex: sha256Hex,
    deriveNamedSeed: deriveNamedSeed,
    mulberry32Step: mulberry32Step,
    mulberry32: mulberry32,
  });
});

  /* source geometry.js bytes=10425 sha256=c3566966d4e5d66e00d8856f299df5297e1077f36179011daa76153fb7c4e04a */
/* Armara Aegis deterministic runtime geometry v1.
   Consumes compiler-authored integer milli-unit route records. Runtime queries use only checked
   integer interpolation and squared comparisons: no square roots, hypot, or point projection. */
(function (root, factory) {
  "use strict";


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
})(BUNDLE_ROOT, function (ABI) {
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

  /* source timers.js bytes=9256 sha256=80811f100310227dad28077ed308898013a8eb42a3818f2a9ed47d8070eb3393 */
/* Armara Aegis deterministic timer transitions v1.
   Every call advances exactly one named fixed-tick phase. Eligibility/disable policy and status
   winner selection remain caller decisions; this module applies only the frozen ABI arithmetic. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before timers.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisTimers")) {
    if (game.AegisTimers !== api) throw new Error("Game.AegisTimers is already installed");
    return;
  }
  Object.defineProperty(game, "AegisTimers", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (ABI) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  [
    "assertSafeInteger",
    "checkedAdd",
    "checkedMultiply",
    "floorDivNonnegative",
    "authoredMillisecondsToTimeUnits",
    "effectiveCooldownUnits",
    "canonicalEncode",
  ].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });

  const descriptor = ABI.DESCRIPTOR;
  const tickUnits = ABI.TIME_UNITS_PER_TICK;
  if (!Number.isSafeInteger(tickUnits) || tickUnits <= 0 ||
      ABI.checkedMultiply(tickUnits, ABI.TICKS_PER_SECOND) !== ABI.TIME_UNITS_PER_SECOND ||
      descriptor.timers.decrementUnitsPerTick !== tickUnits ||
      descriptor.statuses.decrementUnitsPerTick !== tickUnits ||
      descriptor.cooldown.initialRemainingUnits !== 0 ||
      descriptor.cooldown.attacksPerTowerPerTickMax !== 1 ||
      descriptor.cooldown.minimumEffectiveCooldownUnits !== tickUnits) {
    throw new Error("Aegis timer ABI invariants do not match the deterministic scheduler");
  }

  const commandPhase = descriptor.phaseOrder.indexOf("commands");
  const statusPhase = descriptor.phaseOrder.indexOf("status-expiry");
  const attackPhase = descriptor.phaseOrder.indexOf("tower-acquisition-and-attacks");
  if (commandPhase < 0 || statusPhase <= commandPhase || attackPhase <= statusPhase) {
    throw new Error("Aegis phase order must place commands before status expiry before attacks");
  }

  const TIMING = Object.freeze({
    ticksPerSecond: ABI.TICKS_PER_SECOND,
    timeUnitsPerSecond: ABI.TIME_UNITS_PER_SECOND,
    timeUnitsPerTick: tickUnits,
  });

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

  function cooldownState(remainingUnits) {
    return Object.freeze({ remainingUnits: nonnegativeInteger(remainingUnits, "Cooldown remaining units") });
  }

  function requireCooldownState(state) {
    exactFields(state, ["remainingUnits"], "Cooldown state");
    return nonnegativeInteger(state.remainingUnits, "Cooldown remaining units");
  }

  function createCooldownState() {
    return cooldownState(descriptor.cooldown.initialRemainingUnits);
  }

  function advanceCooldownAttackPhase(state, hasTarget, baseCooldownUnits, externalRateBp) {
    const remaining = requireCooldownState(state);
    if (typeof hasTarget !== "boolean") throw new TypeError("Cooldown target eligibility must be boolean");

    // Validate the current schedule inputs on every call, but apply them only when an attack is due.
    // Thus an upgrade or rate-source change never rescales `remaining` in place.
    const effectiveCooldown = ABI.effectiveCooldownUnits(baseCooldownUnits, externalRateBp);
    if (effectiveCooldown < descriptor.cooldown.minimumEffectiveCooldownUnits) {
      throw new RangeError("Effective cooldown must be at least one tick");
    }

    const afterDecrement = remaining > 0 ? ABI.checkedAdd(remaining, -tickUnits) : 0;
    if (afterDecrement > 0) {
      return Object.freeze({
        attacked: false,
        scheduledUnits: null,
        state: cooldownState(afterDecrement),
      });
    }
    if (!hasTarget) {
      return Object.freeze({
        attacked: false,
        scheduledUnits: null,
        state: cooldownState(0),
      });
    }

    return Object.freeze({
      attacked: true,
      scheduledUnits: effectiveCooldown,
      state: cooldownState(ABI.checkedAdd(afterDecrement, effectiveCooldown)),
    });
  }

  function repeatingTimerState(remainingUnits, creation) {
    ABI.assertSafeInteger(remainingUnits, "Repeating timer remaining units");
    if (creation && remainingUnits < 0) {
      throw new RangeError("Initial repeating timer remaining units must be nonnegative");
    }
    return Object.freeze({ remainingUnits: Object.is(remainingUnits, -0) ? 0 : remainingUnits });
  }

  function createRepeatingTimerState(initialRemainingUnits) {
    return repeatingTimerState(initialRemainingUnits, true);
  }

  function requireRepeatingTimerState(state) {
    exactFields(state, ["remainingUnits"], "Repeating timer state");
    return ABI.assertSafeInteger(state.remainingUnits, "Repeating timer remaining units");
  }

  function advanceRepeatingTimerPhase(state, intervalUnits, eventCap) {
    const remaining = requireRepeatingTimerState(state);
    positiveInteger(intervalUnits, "Repeating timer interval units");
    positiveInteger(eventCap, "Repeating timer event cap");
    const afterDecrement = ABI.checkedAdd(remaining, -tickUnits);
    if (afterDecrement > 0) {
      return Object.freeze({
        eventsFired: 0,
        state: repeatingTimerState(afterDecrement, false),
      });
    }

    const debt = -afterDecrement;
    const completeIntervalsInDebt = ABI.floorDivNonnegative(debt, intervalUnits);
    const eventsFired = completeIntervalsInDebt >= eventCap
      ? eventCap
      : ABI.checkedAdd(completeIntervalsInDebt, 1);
    let nextRemaining;
    if (eventsFired <= completeIntervalsInDebt) {
      const paidDebt = ABI.checkedMultiply(eventsFired, intervalUnits);
      const debtRemaining = ABI.checkedAdd(debt, -paidDebt);
      nextRemaining = debtRemaining === 0 ? 0 : -debtRemaining;
    } else {
      nextRemaining = ABI.checkedAdd(intervalUnits, -(debt % intervalUnits));
    }

    return Object.freeze({
      eventsFired: eventsFired,
      state: repeatingTimerState(nextRemaining, false),
    });
  }

  function statusState(lastExpiryTick, remainingUnits) {
    return Object.freeze({
      lastExpiryTick: nonnegativeInteger(lastExpiryTick, "Status last expiry tick"),
      remainingUnits: positiveInteger(remainingUnits, "Status remaining units"),
    });
  }

  function applyStatusAfterExpiryPhase(durationUnits, appliedTick) {
    positiveInteger(durationUnits, "Status duration units");
    nonnegativeInteger(appliedTick, "Status application tick");
    ABI.checkedAdd(appliedTick, 1);
    return statusState(appliedTick, durationUnits);
  }

  function requireStatusState(state) {
    exactFields(state, ["lastExpiryTick", "remainingUnits"], "Status state");
    return statusState(state.lastExpiryTick, state.remainingUnits);
  }

  function advanceStatusExpiryPhase(state, currentTick) {
    const validated = requireStatusState(state);
    nonnegativeInteger(currentTick, "Current status-expiry tick");
    const expectedTick = ABI.checkedAdd(validated.lastExpiryTick, 1);
    if (currentTick !== expectedTick) {
      throw new RangeError("An applied status must advance at the expiry phase of the next tick");
    }

    const nextRemaining = ABI.checkedAdd(validated.remainingUnits, -tickUnits);
    if (nextRemaining <= 0) {
      return Object.freeze({ active: false, expired: true, state: null });
    }
    return Object.freeze({
      active: true,
      expired: false,
      state: statusState(currentTick, nextRemaining),
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    TIMING: TIMING,
    authoredMillisecondsToTimeUnits: ABI.authoredMillisecondsToTimeUnits,
    createCooldownState: createCooldownState,
    advanceCooldownAttackPhase: advanceCooldownAttackPhase,
    createRepeatingTimerState: createRepeatingTimerState,
    advanceRepeatingTimerPhase: advanceRepeatingTimerPhase,
    applyStatusAfterExpiryPhase: applyStatusAfterExpiryPhase,
    advanceStatusExpiryPhase: advanceStatusExpiryPhase,
  });
});

  /* source economy.js bytes=6371 sha256=be8e9352a18af6bebb8f51120b5c80e2464b4f9227b6b8f84314d60156861944 */
/* Armara Aegis deterministic runtime economy v1.
   Pure checked-integer helpers for investment, campaign start Aether, and mission bounty carry. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before economy.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisEconomy")) {
    if (game.AegisEconomy !== api) throw new Error("Game.AegisEconomy is already installed");
    return;
  }
  Object.defineProperty(game, "AegisEconomy", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (ABI) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  [
    "assertSafeInteger",
    "checkedAdd",
    "checkedMultiply",
    "checkedMulDivFloor",
    "floorDivNonnegative",
    "refundSeventyPercent",
    "canonicalEncode",
  ].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  if (ABI.BASIS_POINTS !== 10000 || ABI.DESCRIPTOR.basisPoints !== ABI.BASIS_POINTS) {
    throw new RangeError("Aegis economy requires the frozen 10000-point basis");
  }

  const BASIS_POINTS = ABI.BASIS_POINTS;

  function nonnegativeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return value;
  }

  function bountyRemainder(value) {
    nonnegativeInteger(value, "Bounty remainder");
    if (value >= BASIS_POINTS) {
      throw new RangeError("Bounty remainder must be less than " + BASIS_POINTS);
    }
    return value;
  }

  function addInvestment(currentInvestedAether, paidCostAether) {
    nonnegativeInteger(currentInvestedAether, "Current invested Aether");
    nonnegativeInteger(paidCostAether, "Paid Aether cost");
    return ABI.checkedAdd(currentInvestedAether, paidCostAether);
  }

  function cumulativeInvestment(paidCostsAether) {
    ABI.canonicalEncode(paidCostsAether);
    if (!Array.isArray(paidCostsAether)) throw new TypeError("Paid Aether costs must be an array");
    let investedAether = 0;
    for (let index = 0; index < paidCostsAether.length; index++) {
      investedAether = addInvestment(investedAether, paidCostsAether[index]);
    }
    return investedAether;
  }

  function sellRefund(investedAether) {
    nonnegativeInteger(investedAether, "Invested Aether");
    return ABI.refundSeventyPercent(investedAether);
  }

  function summarizeInvestment(paidCostsAether) {
    const investedAether = cumulativeInvestment(paidCostsAether);
    return Object.freeze({
      investedAether: investedAether,
      sellRefundAether: sellRefund(investedAether),
    });
  }

  /* Spec 8.2: an additive Relic Aether stage resolves after difficulty and before the campaign
     Reserve/Assist additions. R4: a stage that would resolve below zero clamps to zero instead
     of throwing, so a low-envelope Broken Aegis loadout remains legal. Omitting the argument
     keeps the exact ABI v1 arithmetic. */
  function resolveStartAether(
    baseStartAether,
    difficultyAetherBp,
    campaignModifierAether,
    assistAether,
    relicStartAether
  ) {
    nonnegativeInteger(baseStartAether, "Base starting Aether");
    nonnegativeInteger(difficultyAetherBp, "Difficulty Aether basis points");
    nonnegativeInteger(campaignModifierAether, "Campaign modifier Aether");
    nonnegativeInteger(assistAether, "Assist Aether");
    const relicAether = relicStartAether === undefined ? 0 : relicStartAether;
    ABI.assertSafeInteger(relicAether, "Relic starting Aether");

    const difficultyStartAether = ABI.checkedMulDivFloor(
      baseStartAether,
      [difficultyAetherBp],
      [BASIS_POINTS]
    );
    const relicSum = ABI.checkedAdd(difficultyStartAether, relicAether);
    const afterRelicAether = relicSum < 0 ? 0 : relicSum;
    const afterCampaignModifierAether = ABI.checkedAdd(
      afterRelicAether,
      campaignModifierAether
    );
    const startAether = ABI.checkedAdd(afterCampaignModifierAether, assistAether);
    return Object.freeze({
      baseStartAether: baseStartAether,
      difficultyAetherBp: difficultyAetherBp,
      difficultyStartAether: difficultyStartAether,
      relicStartAether: relicAether,
      afterRelicAether: afterRelicAether,
      campaignModifierAether: campaignModifierAether,
      afterCampaignModifierAether: afterCampaignModifierAether,
      assistAether: assistAether,
      startAether: startAether,
    });
  }

  function initialBountyRemainder() {
    return 0;
  }

  function resolveBountyEvent(previousBountyRemainder, baseLineageBounty, difficultyBountyBp) {
    const previous = bountyRemainder(previousBountyRemainder);
    nonnegativeInteger(baseLineageBounty, "Base lineage bounty");
    nonnegativeInteger(difficultyBountyBp, "Difficulty bounty basis points");
    const bountyNumerator = ABI.checkedAdd(
      previous,
      ABI.checkedMultiply(baseLineageBounty, difficultyBountyBp)
    );
    const bountyAward = ABI.floorDivNonnegative(bountyNumerator, BASIS_POINTS);
    return Object.freeze({
      bountyNumerator: bountyNumerator,
      bountyAward: bountyAward,
      bountyRemainder: bountyNumerator % BASIS_POINTS,
    });
  }

  function creditFixedGrant(previousBountyRemainder, fixedGrantAether) {
    const previous = bountyRemainder(previousBountyRemainder);
    nonnegativeInteger(fixedGrantAether, "Fixed Aether grant");
    return Object.freeze({
      aetherAward: fixedGrantAether,
      bountyRemainder: previous,
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    BASIS_POINTS: BASIS_POINTS,
    addInvestment: addInvestment,
    cumulativeInvestment: cumulativeInvestment,
    sellRefund: sellRefund,
    summarizeInvestment: summarizeInvestment,
    resolveStartAether: resolveStartAether,
    initialBountyRemainder: initialBountyRemainder,
    resolveBountyEvent: resolveBountyEvent,
    creditFixedGrant: creditFixedGrant,
  });
});

  /* source movement.js bytes=13339 sha256=f0243272ba6a2d993206f3aa2dfdab4b5bf794d6339691267cb3d89ab562e890 */
/* Armara Aegis deterministic movement, named RNG, and runtime-ID helpers v1.
   Inputs are already-resolved simulation values; this module owns no routes, waves, or policies. */
(function (root, factory) {
  "use strict";


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
})(BUNDLE_ROOT, function (ABI) {
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

  /* source effects.js bytes=14776 sha256=55bd1761dff7eb5e1c2eed73e2c406244fb49f255070677069c4baadb4f250fa */
/* Armara Aegis deterministic status, amplification, and shield-pool resolution v1.
   This module selects already-accepted complete instances. It does not create lifecycle timing,
   apply shield coefficients, mitigate armor/resistance, execute, or choose authored effects. */
(function (root, factory) {
  "use strict";


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
})(BUNDLE_ROOT, function (ABI) {
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

  /* source targeting.js bytes=9306 sha256=2e34f54e8b8f5676a1d4b9abf938de091861d0a0592f60ea3c8aa3fc677f13be */
/* Armara Aegis deterministic target eligibility and selection v1.
   Coordinates, range, and speed use ABI distance units. Cloak/reveal, active-enemy lifecycle,
   target-mask layer, and active shield membership are resolved by the caller before this adapter. */
(function (root, factory) {
  "use strict";


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
})(BUNDLE_ROOT, function (ABI, Geometry) {
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

  /* source behaviors.js bytes=94601 sha256=35c621e8088ab95beb2b5e55487388b60998cab535407b510676fbeb16ba39e8 */
/* Armara Aegis closed deterministic behavior reducers v1.
   This module turns compiler-validated behavior records into canonical intents. It never owns HP,
   routes, renderer state, persistence, wall-clock time, or presentation callbacks. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before behaviors.js");
  if (!game.AegisGeometry) throw new Error("Game.AegisGeometry must be installed before behaviors.js");
  if (!game.AegisTimers) throw new Error("Game.AegisTimers must be installed before behaviors.js");
  if (!game.AegisMovement) throw new Error("Game.AegisMovement must be installed before behaviors.js");
  if (!game.AegisEffects) throw new Error("Game.AegisEffects must be installed before behaviors.js");
  if (!game.AegisTargeting) throw new Error("Game.AegisTargeting must be installed before behaviors.js");
  const api = factory(
    game.AegisSim,
    game.AegisGeometry,
    game.AegisTimers,
    game.AegisMovement,
    game.AegisEffects,
    game.AegisTargeting
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisBehaviors")) {
    if (game.AegisBehaviors !== api) throw new Error("Game.AegisBehaviors is already installed");
    return;
  }
  Object.defineProperty(game, "AegisBehaviors", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (
  ABI,
  Geometry,
  Timers,
  Movement,
  Effects,
  Targeting
) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  [Geometry, Timers, Movement, Effects, Targeting].forEach(function (dependency, index) {
    if (!dependency || !Object.isFrozen(dependency) ||
        dependency.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
      throw new TypeError("A frozen ABI-matched Aegis behavior dependency is required at index " + index);
    }
  });
  [
    "assertSafeInteger", "authoredMillisecondsToTimeUnits", "canonicalEncode", "checkedAdd",
    "checkedMulDivFloor", "checkedMultiply",
  ].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  if (typeof Geometry.isWithinSquaredRange !== "function" ||
      typeof Effects.resolveMovementReduction !== "function" ||
      typeof Timers.authoredMillisecondsToTimeUnits !== "function" ||
      typeof Movement.allocateRuntimeId !== "function" ||
      typeof Targeting.compareTargets !== "function") {
    throw new TypeError("Aegis behavior dependencies do not expose the reviewed v1 seams");
  }

  const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
  const PHASE_ORDER = ABI.DESCRIPTOR.phaseOrder;
  const DISPATCH_IDS = Object.freeze({
    REVEAL: "aura@1/continuous-range-status",
    MARK: "aura@1/periodic-targeted-status",
    BLOCK: "block@1/marker-contact-control",
    TALOS: "bossScript@1/guarded-hp-thresholds",
    DIRECT: "direct@1/instant-primary-hit",
    SLOW: "slow@1/primary-status",
    GUARD_SLOTS: "spawnUnit@1/guard-slots",
    SPLASH: "splash@1/primary-centered-radius",
    CLOAK: "trait.cloak@1",
  });
  const KNOWN_DISPATCH_IDS = Object.freeze(Object.keys(DISPATCH_IDS).map(function (key) {
    return DISPATCH_IDS[key];
  }));

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function cloneCanonical(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneCanonical);
    const output = {};
    Object.keys(value).forEach(function (key) { output[key] = cloneCanonical(value[key]); });
    return output;
  }

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

  function stableId(value, label) {
    if (typeof value !== "string" || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable ASCII ID");
    }
    return value;
  }

  function safeInteger(value, label) {
    return ABI.assertSafeInteger(value, label);
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

  function requireBoolean(value, label) {
    if (typeof value !== "boolean") throw new TypeError(label + " must be boolean");
    return value;
  }

  function requireArray(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    ABI.canonicalEncode(value);
    return value;
  }

  function uniquePositiveIds(values, label) {
    const seen = new Set();
    return requireArray(values, label).map(function (value, index) {
      const id = positiveInteger(value, label + " " + index);
      if (seen.has(id)) throw new RangeError(label + " contains a duplicate runtime ID: " + id);
      seen.add(id);
      return id;
    });
  }

  function asciiCompare(left, right) {
    if (left === right) return 0;
    return left < right ? -1 : 1;
  }

  function requireDispatchId(dispatchId) {
    if (typeof dispatchId !== "string" || KNOWN_DISPATCH_IDS.indexOf(dispatchId) === -1) {
      throw new RangeError("Unknown behavior dispatch ID: " + String(dispatchId));
    }
    return dispatchId;
  }

  function requireLimits(input) {
    exactFields(input, ["maxEntities", "maxEvents", "maxTargets"], "Behavior limits");
    return Object.freeze({
      maxEntities: positiveInteger(input.maxEntities, "Behavior entity cap"),
      maxEvents: positiveInteger(input.maxEvents, "Behavior event cap"),
      maxTargets: positiveInteger(input.maxTargets, "Behavior target cap"),
    });
  }

  function enforceInputEntityCap(values, limits, label) {
    if (values.length > limits.maxEntities) {
      throw new RangeError(label + " exceeds the behavior entity cap");
    }
  }

  /* ADR-014: one behavior registry serves both ABI versions. A compiled event catalog carries
     its own event-schema version and phase vocabulary; the owning kernel binds that schema to
     the exact frozen catalog object once, before any tick. An unbound catalog stays on the
     immutable ABI v1 schema, so every historical release keeps its exact validation. */
  const DEFAULT_EVENT_SCHEMA = deepFreeze({
    eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
    phaseAliases: {},
    phaseOrder: PHASE_ORDER.slice(),
  });
  const EVENT_SCHEMA_FIELDS = Object.freeze([
    "eventSchemaVersion", "phaseAliases", "phaseOrder",
  ]);
  const SUPPORTED_EVENT_SCHEMA_VERSIONS = Object.freeze([1, 2]);
  const MAX_EVENT_PHASES = 32;
  const CATALOG_EVENT_SCHEMAS = new WeakMap();

  function normalizeEventSchema(input) {
    exactFields(input, EVENT_SCHEMA_FIELDS, "Semantic event schema");
    if (SUPPORTED_EVENT_SCHEMA_VERSIONS.indexOf(input.eventSchemaVersion) === -1) {
      throw new RangeError("Unsupported semantic event schema version");
    }
    const phaseOrder = requireArray(input.phaseOrder, "Semantic event phase order");
    if (phaseOrder.length === 0 || phaseOrder.length > MAX_EVENT_PHASES) {
      throw new RangeError("Semantic event phase order must be a bounded nonempty list");
    }
    const known = new Set();
    phaseOrder.forEach(function (phaseId, index) {
      stableId(phaseId, "Semantic event phase " + index);
      if (known.has(phaseId)) throw new RangeError("Semantic event phase order must be unique");
      known.add(phaseId);
    });
    if (!input.phaseAliases || typeof input.phaseAliases !== "object" ||
        Array.isArray(input.phaseAliases)) {
      throw new TypeError("Semantic event phase aliases must be a plain object");
    }
    ABI.canonicalEncode(input.phaseAliases);
    const aliasNames = Object.keys(input.phaseAliases);
    if (aliasNames.length > MAX_EVENT_PHASES) {
      throw new RangeError("Semantic event phase aliases exceed the bounded phase list");
    }
    const phaseAliases = {};
    aliasNames.forEach(function (name) {
      stableId(name, "Semantic event phase alias");
      const target = stableId(input.phaseAliases[name], "Semantic event phase alias target");
      if (!known.has(target)) {
        throw new RangeError("Semantic event phase alias targets an unknown phase: " + target);
      }
      phaseAliases[name] = target;
    });
    return deepFreeze({
      eventSchemaVersion: input.eventSchemaVersion,
      phaseAliases: phaseAliases,
      phaseOrder: phaseOrder.slice(),
    });
  }

  function bindEventCatalogSchema(eventCatalog, schemaInput) {
    if (!eventCatalog || typeof eventCatalog !== "object" || Array.isArray(eventCatalog)) {
      throw new TypeError("Compiled semantic event catalog must be an object");
    }
    const schema = normalizeEventSchema(schemaInput);
    const existing = CATALOG_EVENT_SCHEMAS.get(eventCatalog);
    if (existing) {
      if (ABI.canonicalEncode(existing) !== ABI.canonicalEncode(schema)) {
        throw new RangeError("A semantic event catalog cannot carry two event schemas");
      }
      return existing;
    }
    CATALOG_EVENT_SCHEMAS.set(eventCatalog, schema);
    return schema;
  }

  function catalogEventSchema(eventCatalog) {
    const schema = CATALOG_EVENT_SCHEMAS.get(eventCatalog);
    return schema === undefined ? DEFAULT_EVENT_SCHEMA : schema;
  }

  function phaseIndex(phaseId, schema) {
    const order = (schema || DEFAULT_EVENT_SCHEMA).phaseOrder;
    const index = order.indexOf(phaseId);
    if (index === -1) throw new RangeError("Unknown semantic event phase: " + String(phaseId));
    return index;
  }

  function validatePayloadValue(field, value, label) {
    if (value === null) {
      if (!field.nullable) throw new TypeError(label + " cannot be null");
      return null;
    }
    if (field.type === "integer") return safeInteger(value, label);
    if (field.type === "boolean") return requireBoolean(value, label);
    if (field.type === "id" || field.type === "string-key") return stableId(value, label);
    if (field.type === "id-array") {
      const ids = requireArray(value, label);
      const seen = new Set();
      ids.forEach(function (id, index) {
        stableId(id, label + " " + index);
        if (seen.has(id)) throw new RangeError(label + " contains a duplicate ID: " + id);
        seen.add(id);
      });
      return value;
    }
    throw new RangeError("Unknown semantic payload type: " + String(field.type));
  }

  function validateSemanticEvent(eventCatalog, input) {
    if (!eventCatalog || typeof eventCatalog !== "object" || Array.isArray(eventCatalog)) {
      throw new TypeError("Compiled semantic event catalog must be an object");
    }
    ABI.canonicalEncode(eventCatalog);
    exactFields(input, ["eventId", "payload", "phaseId"], "Semantic event");
    const eventId = stableId(input.eventId, "Semantic event ID");
    if (!Object.prototype.hasOwnProperty.call(eventCatalog, eventId)) {
      throw new RangeError("Unknown semantic event ID: " + eventId);
    }
    const definition = eventCatalog[eventId];
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
      throw new TypeError("Semantic event definition must be an object");
    }
    const schema = catalogEventSchema(eventCatalog);
    if (definition.id !== eventId || definition.version !== schema.eventSchemaVersion) {
      throw new RangeError("Semantic event definition/version does not match " + eventId);
    }
    const phaseId = stableId(input.phaseId, "Semantic event phase ID");
    phaseIndex(phaseId, schema);
    if (definition.phaseId !== phaseId) {
      throw new RangeError("Semantic event phase does not match catalog for " + eventId);
    }
    const fields = requireArray(definition.payloadFields, "Semantic event payload fields");
    const requiredNames = fields.filter(function (field) { return field.required; }).map(function (field) {
      return field.name;
    });
    const optionalNames = fields.filter(function (field) { return !field.required; }).map(function (field) {
      return field.name;
    });
    ABI.canonicalEncode(input.payload);
    if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
      throw new TypeError("Semantic event payload must be a plain object");
    }
    const actualNames = Object.keys(input.payload);
    requiredNames.forEach(function (name) {
      if (!Object.prototype.hasOwnProperty.call(input.payload, name)) {
        throw new TypeError("Semantic event payload must contain exactly the catalog fields");
      }
    });
    actualNames.forEach(function (name) {
      if (requiredNames.indexOf(name) === -1 && optionalNames.indexOf(name) === -1) {
        throw new TypeError("Semantic event payload must contain exactly the catalog fields");
      }
    });
    fields.forEach(function (field) {
      if (!field || typeof field !== "object" || Array.isArray(field)) {
        throw new TypeError("Semantic payload field definition must be an object");
      }
      stableId(field.name, "Semantic payload field name");
      requireBoolean(field.required, "Semantic payload field required flag");
      requireBoolean(field.nullable, "Semantic payload field nullable flag");
      if (["integer", "boolean", "id", "id-array", "string-key"].indexOf(field.type) === -1) {
        throw new RangeError("Unknown semantic payload type: " + String(field.type));
      }
      if (Object.prototype.hasOwnProperty.call(input.payload, field.name)) {
        validatePayloadValue(field, input.payload[field.name], "Semantic payload " + field.name);
      }
    });
    return deepFreeze({
      eventId: eventId,
      phaseId: phaseId,
      payload: cloneCanonical(input.payload),
    });
  }

  function validateSemanticEvents(eventCatalog, inputs, limitsInput) {
    const limits = requireLimits(limitsInput);
    const events = requireArray(inputs, "Semantic events");
    if (events.length > limits.maxEvents) throw new RangeError("Semantic events exceed the event cap");
    let priorPhase = -1;
    const schema = catalogEventSchema(eventCatalog);
    const validated = events.map(function (event) {
      const next = validateSemanticEvent(eventCatalog, event);
      const nextPhase = phaseIndex(next.phaseId, schema);
      if (nextPhase < priorPhase) {
        throw new RangeError("Semantic events violate ABI phase order");
      }
      priorPhase = nextPhase;
      return next;
    });
    return Object.freeze(validated);
  }

  function semanticEvent(eventCatalog, eventId, payload) {
    if (!Object.prototype.hasOwnProperty.call(eventCatalog, eventId)) {
      throw new RangeError("Unknown semantic event ID: " + eventId);
    }
    const definition = eventCatalog[eventId];
    return validateSemanticEvent(eventCatalog, {
      eventId: eventId,
      phaseId: definition.phaseId,
      payload: payload,
    });
  }

  function requireCatalogEventPhase(eventCatalog, eventId, expectedPhaseId) {
    stableId(eventId, "Semantic event-plan ID");
    if (!eventCatalog || !Object.prototype.hasOwnProperty.call(eventCatalog, eventId)) {
      throw new RangeError("Unknown semantic event ID: " + eventId);
    }
    const definition = eventCatalog[eventId];
    const schema = catalogEventSchema(eventCatalog);
    const resolvedPhaseId = Object.prototype.hasOwnProperty.call(schema.phaseAliases, expectedPhaseId)
      ? schema.phaseAliases[expectedPhaseId]
      : expectedPhaseId;
    if (definition.id !== eventId || definition.version !== schema.eventSchemaVersion ||
        definition.phaseId !== resolvedPhaseId) {
      throw new RangeError("Semantic event-plan phase/version does not match " + eventId);
    }
    phaseIndex(resolvedPhaseId, schema);
    return eventId;
  }

  function finalizeResult(result, eventCatalog, limits) {
    const output = Object.assign({}, result);
    output.events = validateSemanticEvents(eventCatalog, output.events || [], limits);
    ABI.canonicalEncode(output);
    return deepFreeze(output);
  }

  function emptyObject(input, label) {
    exactFields(input || {}, [], label);
  }

  function markerRecord(input, index) {
    const compiledMarker = Object.prototype.hasOwnProperty.call(input, "id");
    exactFields(input, compiledMarker
      ? [
          "id", "laneOffset", "laneSegmentId", "padId", "routeDistances", "slotIndex",
          "tangentX", "tangentY", "x", "y",
        ]
      : ["markerId", "routeDistances", "slotIndex"], "Guard marker " + index);
    const routeDistances = requireArray(
      input.routeDistances,
      "Guard marker route distances"
    ).map(function (record, routeIndex) {
      exactFields(
        record,
        ["remainingDistance", "routeDistance", "routeId"],
        "Guard marker route distance " + routeIndex
      );
      return Object.freeze({
        remainingDistance: nonnegativeInteger(
          record.remainingDistance,
          "Guard marker remaining distance"
        ),
        routeDistance: nonnegativeInteger(record.routeDistance, "Guard marker route distance"),
        routeId: stableId(record.routeId, "Guard marker route ID"),
      });
    });
    if (routeDistances.length === 0) throw new RangeError("Guard marker needs a route distance");
    for (let routeIndex = 1; routeIndex < routeDistances.length; routeIndex += 1) {
      if (asciiCompare(routeDistances[routeIndex - 1].routeId, routeDistances[routeIndex].routeId) >= 0) {
        throw new RangeError("Guard marker route distances must be unique ASCII sorted");
      }
    }
    return Object.freeze({
      markerId: stableId(compiledMarker ? input.id : input.markerId, "Guard marker ID"),
      routeDistances: Object.freeze(routeDistances),
      slotIndex: nonnegativeInteger(input.slotIndex, "Guard marker slot index"),
    });
  }

  function createGuardState(initializer) {
    exactFields(initializer, ["markers"], "Guard behavior initializer");
    const markers = requireArray(initializer.markers, "Guard markers").map(markerRecord);
    markers.sort(function (left, right) {
      if (left.slotIndex !== right.slotIndex) return left.slotIndex < right.slotIndex ? -1 : 1;
      return asciiCompare(left.markerId, right.markerId);
    });
    const markerIds = new Set();
    markers.forEach(function (marker, index) {
      if (marker.slotIndex !== index) throw new RangeError("Guard marker slot indices must be contiguous");
      if (markerIds.has(marker.markerId)) throw new RangeError("Guard markers contain a duplicate marker ID");
      markerIds.add(marker.markerId);
    });
    return deepFreeze({
      slots: markers.map(function (marker) {
        return {
          markerId: marker.markerId,
          replenishDurationTimeUnits: 0,
          replenishRemainingTimeUnits: 0,
          routeDistances: marker.routeDistances.map(function (record) {
            return Object.assign({}, record);
          }),
          slotIndex: marker.slotIndex,
          summonRuntimeId: null,
        };
      }),
    });
  }

  function createBehaviorState(dispatchId, initializer) {
    requireDispatchId(dispatchId);
    initializer = initializer || {};
    ABI.canonicalEncode(initializer);
    if (dispatchId === DISPATCH_IDS.DIRECT) {
      emptyObject(initializer, "Direct behavior initializer");
      return Object.freeze({
        acceptedHitCount: 0,
        idleElapsedTimeUnits: 0,
        targetRuntimeId: null,
      });
    }
    if (dispatchId === DISPATCH_IDS.SLOW) {
      emptyObject(initializer, "Slow behavior initializer");
      return Object.freeze({ acceptedPrimaryHitCount: 0 });
    }
    if (dispatchId === DISPATCH_IDS.MARK) {
      emptyObject(initializer, "Mark behavior initializer");
      return Object.freeze({ acceptedScanCount: 0 });
    }
    if (dispatchId === DISPATCH_IDS.GUARD_SLOTS) return createGuardState(initializer);
    if (dispatchId === DISPATCH_IDS.REVEAL) {
      emptyObject(initializer, "Reveal behavior initializer");
      return deepFreeze({ revealedEnemyRuntimeIds: [] });
    }
    if (dispatchId === DISPATCH_IDS.CLOAK) {
      emptyObject(initializer, "Cloak behavior initializer");
      return Object.freeze({ exposedRemainingTimeUnits: 0, wasVisible: false });
    }
    if (dispatchId === DISPATCH_IDS.TALOS) {
      exactFields(
        initializer,
        ["currentHpMilli", "maximumHpMilli"],
        "Talos behavior initializer"
      );
      const maximumHpMilli = positiveInteger(
        initializer.maximumHpMilli,
        "Talos runtime maximum HP"
      );
      const currentHpMilli = positiveInteger(initializer.currentHpMilli, "Talos current HP");
      if (currentHpMilli > maximumHpMilli) {
        throw new RangeError("Talos current HP exceeds runtime maximum HP");
      }
      return Object.freeze({
        currentHpMilli: currentHpMilli,
        currentPhaseOrder: 0,
        maximumHpMilli: maximumHpMilli,
        nextThresholdOrder: 0,
      });
    }
    emptyObject(initializer, "Stateless behavior initializer");
    return null;
  }

  function requireRequest(input) {
    exactFields(input, ["eventCatalog", "input", "limits", "parameters", "state"], "Behavior request");
    return {
      eventCatalog: input.eventCatalog,
      input: input.input,
      limits: requireLimits(input.limits),
      parameters: input.parameters,
      state: input.state,
    };
  }

  function requireDirectState(input) {
    exactFields(
      input,
      ["acceptedHitCount", "idleElapsedTimeUnits", "targetRuntimeId"],
      "Direct behavior state"
    );
    return {
      acceptedHitCount: nonnegativeInteger(input.acceptedHitCount, "Direct accepted-hit count"),
      idleElapsedTimeUnits: nonnegativeInteger(
        input.idleElapsedTimeUnits,
        "Direct idle elapsed time units"
      ),
      targetRuntimeId: input.targetRuntimeId === null
        ? null
        : positiveInteger(input.targetRuntimeId, "Direct target runtime ID"),
    };
  }

  function validateSentinelCounter(counter) {
    if (counter === null) return null;
    if (!counter || counter.kind !== "same-target-accepted-hits") {
      throw new RangeError("Unknown direct consecutive-hit counter rule");
    }
    if (counter.resetOnTargetChange !== true || counter.emptyActivationAdvances !== false ||
        counter.secondaryEffectsAdvance !== false) {
      throw new RangeError("Unsupported direct consecutive-hit counter flags");
    }
    positiveInteger(counter.requiredAcceptedHits, "Direct required accepted hits");
    nonnegativeInteger(counter.bonusDamageBp, "Direct bonus damage basis points");
    positiveInteger(counter.resetAfterNoTargetMs, "Direct no-target reset milliseconds");
    requireBoolean(counter.bonusAppliesToThresholdHit, "Direct threshold-hit bonus flag");
    stableId(counter.semanticEventId, "Direct combo semantic event ID");
    return counter;
  }

  function resolveDirect(request) {
    const parameters = request.parameters;
    if (parameters.maximumTargets !== 1) throw new RangeError("Direct behavior requires one primary target");
    const baseDamageMilli = positiveInteger(parameters.baseDamage, "Direct base damage");
    const armorIgnoreBp = nonnegativeInteger(parameters.armorIgnoreBp, "Direct armor ignore");
    const bossCoefficientBp = positiveInteger(
      parameters.bossCoefficientBp,
      "Direct boss coefficient"
    );
    const shieldCoefficientBp = positiveInteger(
      parameters.shieldCoefficientBp,
      "Direct shield coefficient"
    );
    const damageTypeId = stableId(parameters.damageTypeId, "Direct damage type ID");
    const counter = validateSentinelCounter(parameters.consecutiveHitCounter);
    const state = requireDirectState(request.state);
    if ((state.targetRuntimeId === null &&
         (state.acceptedHitCount !== 0 || state.idleElapsedTimeUnits !== 0)) ||
        (counter !== null && state.acceptedHitCount > counter.requiredAcceptedHits) ||
        (counter === null && state.acceptedHitCount !== 0)) {
      throw new RangeError("Direct counter state is inconsistent with its authored rule");
    }
    const input = request.input;
    stableId(input.actionId, "Direct action ID");
    let nextState = state;
    let coefficient = ABI.BASIS_POINTS;
    let damageIntent = null;
    const events = [];

    if (input.actionId === "no-target") {
      exactFields(input, ["actionId", "elapsedTimeUnits"], "Direct no-target input");
      const elapsedTimeUnits = nonnegativeInteger(
        input.elapsedTimeUnits,
        "Direct no-target elapsed time units"
      );
      if (counter !== null && state.targetRuntimeId !== null) {
        const resetTimeUnits = Timers.authoredMillisecondsToTimeUnits(counter.resetAfterNoTargetMs);
        const total = ABI.checkedAdd(state.idleElapsedTimeUnits, elapsedTimeUnits);
        nextState = total >= resetTimeUnits
          ? { acceptedHitCount: 0, idleElapsedTimeUnits: 0, targetRuntimeId: null }
          : {
              acceptedHitCount: state.acceptedHitCount,
              idleElapsedTimeUnits: total,
              targetRuntimeId: state.targetRuntimeId,
            };
      }
    } else if (input.actionId === "secondary-effect") {
      exactFields(input, ["actionId", "targetRuntimeId", "towerRuntimeId"], "Direct secondary input");
      positiveInteger(input.targetRuntimeId, "Direct secondary target runtime ID");
      positiveInteger(input.towerRuntimeId, "Direct secondary tower runtime ID");
    } else if (input.actionId === "accepted-primary-hit") {
      exactFields(input, ["actionId", "targetRuntimeId", "towerRuntimeId"], "Direct hit input");
      const targetRuntimeId = positiveInteger(input.targetRuntimeId, "Direct target runtime ID");
      const towerRuntimeId = positiveInteger(input.towerRuntimeId, "Direct tower runtime ID");
      if (counter !== null) {
        const sameTarget = state.targetRuntimeId === targetRuntimeId;
        const priorCount = sameTarget ? state.acceptedHitCount : 0;
        const incremented = Math.min(counter.requiredAcceptedHits, ABI.checkedAdd(priorCount, 1));
        const bonusActive = counter.bonusAppliesToThresholdHit
          ? incremented >= counter.requiredAcceptedHits
          : priorCount >= counter.requiredAcceptedHits;
        nextState = {
          acceptedHitCount: incremented,
          idleElapsedTimeUnits: 0,
          targetRuntimeId: targetRuntimeId,
        };
        if (bonusActive) {
          coefficient = ABI.checkedAdd(ABI.BASIS_POINTS, counter.bonusDamageBp);
          events.push(semanticEvent(request.eventCatalog, counter.semanticEventId, {
            acceptedHitCount: incremented,
            damageCoefficientBp: coefficient,
            targetRuntimeId: targetRuntimeId,
            towerRuntimeId: towerRuntimeId,
          }));
        }
      }
      damageIntent = {
        armorIgnoreBp: armorIgnoreBp,
        baseDamageMilli: baseDamageMilli,
        bossCoefficientBp: bossCoefficientBp,
        damageTypeId: damageTypeId,
        internalDamageCoefficientBp: coefficient,
        shieldCoefficientBp: shieldCoefficientBp,
        targetRuntimeId: targetRuntimeId,
        towerRuntimeId: towerRuntimeId,
      };
    } else {
      throw new RangeError("Unknown direct behavior action ID: " + input.actionId);
    }

    return finalizeResult({
      damageCoefficientBp: coefficient,
      damageIntent: damageIntent,
      events: events,
      state: nextState,
    }, request.eventCatalog, request.limits);
  }

  function requireSlowState(input) {
    exactFields(input, ["acceptedPrimaryHitCount"], "Slow behavior state");
    return {
      acceptedPrimaryHitCount: nonnegativeInteger(
        input.acceptedPrimaryHitCount,
        "Slow accepted-primary-hit count"
      ),
    };
  }

  function validateEchoCounter(counter) {
    if (counter === null) return null;
    if (!counter || counter.kind !== "every-n-accepted-primary-hits") {
      throw new RangeError("Unknown slow echo counter rule");
    }
    if (counter.comparatorId !== "secondary-route-front-v1") {
      throw new RangeError("Unknown slow secondary comparator ID: " + String(counter.comparatorId));
    }
    if (counter.resetRuleId !== "counter-reset-on-wave-start") {
      throw new RangeError("Unknown slow counter reset rule ID: " + String(counter.resetRuleId));
    }
    if (counter.emptyActivationAdvances !== false || counter.recursive !== false) {
      throw new RangeError("Unsupported slow echo counter flags");
    }
    positiveInteger(counter.requiredAcceptedHits, "Slow echo required hits");
    positiveInteger(counter.maximumSecondaryTargets, "Slow echo maximum secondary targets");
    positiveInteger(counter.radiusWorldUnits, "Slow echo radius");
    positiveInteger(counter.magnitudeBp, "Slow echo magnitude");
    positiveInteger(counter.durationMs, "Slow echo duration");
    stableId(counter.semanticEventId, "Slow echo semantic event ID");
    return counter;
  }

  function targetCandidate(input, index, coordinatesRequired) {
    const fields = [
      "remainingRouteDistance", "routeId", "runtimeId", "targetKind", "threatPriority",
    ];
    if (coordinatesRequired) fields.push("x", "y");
    exactFields(input, fields, "Behavior target candidate " + index);
    return Object.freeze({
      remainingRouteDistance: nonnegativeInteger(
        input.remainingRouteDistance,
        "Target remaining route distance"
      ),
      routeId: stableId(input.routeId, "Target route ID"),
      runtimeId: positiveInteger(input.runtimeId, "Target runtime ID"),
      targetKind: stableId(input.targetKind, "Target kind"),
      threatPriority: nonnegativeInteger(input.threatPriority, "Target threat priority"),
      x: coordinatesRequired ? safeInteger(input.x, "Target X") : 0,
      y: coordinatesRequired ? safeInteger(input.y, "Target Y") : 0,
    });
  }

  function compareRouteFront(left, right) {
    return Geometry.compareTargetPriority({
      id: left.runtimeId,
      remainingDistance: left.remainingRouteDistance,
      threatPriority: left.threatPriority,
    }, {
      id: right.runtimeId,
      remainingDistance: right.remainingRouteDistance,
      threatPriority: right.threatPriority,
    });
  }

  function uniqueCandidates(inputs, limits, coordinatesRequired, label) {
    const candidates = requireArray(inputs, label).map(function (candidate, index) {
      return targetCandidate(candidate, index, coordinatesRequired);
    });
    enforceInputEntityCap(candidates, limits, label);
    const ids = new Set();
    candidates.forEach(function (candidate) {
      if (ids.has(candidate.runtimeId)) throw new RangeError(label + " contains a duplicate runtime ID");
      ids.add(candidate.runtimeId);
    });
    return candidates;
  }

  function resolveSlow(request) {
    const parameters = request.parameters;
    if (parameters.statusId !== "slow" || parameters.controlKind !== "slow") {
      throw new RangeError("Unknown slow behavior status/control rule");
    }
    const counter = validateEchoCounter(parameters.echoCounter);
    const state = requireSlowState(request.state);
    if ((counter === null && state.acceptedPrimaryHitCount !== 0) ||
        (counter !== null && state.acceptedPrimaryHitCount >= counter.requiredAcceptedHits)) {
      throw new RangeError("Slow counter state exceeds its authored bound");
    }
    const input = request.input;
    stableId(input.actionId, "Slow action ID");

    if (input.actionId === "wave-start") {
      exactFields(input, ["actionId"], "Slow wave-start input");
      return finalizeResult({
        events: [], primaryStatusIntent: null, secondaryStatusIntents: [],
        state: { acceptedPrimaryHitCount: 0 },
      }, request.eventCatalog, request.limits);
    }
    if (input.actionId === "secondary-effect") {
      exactFields(input, ["actionId"], "Slow secondary-effect input");
      return finalizeResult({
        events: [], primaryStatusIntent: null, secondaryStatusIntents: [], state: state,
      }, request.eventCatalog, request.limits);
    }
    if (input.actionId !== "accepted-primary-hit") {
      throw new RangeError("Unknown slow behavior action ID: " + input.actionId);
    }
    exactFields(input, [
      "actionId", "primaryPosition", "primaryTargetRuntimeId", "secondaryCandidates", "towerRuntimeId",
    ], "Slow primary-hit input");
    exactFields(input.primaryPosition, ["x", "y"], "Slow primary position");
    const primaryX = safeInteger(input.primaryPosition.x, "Slow primary X");
    const primaryY = safeInteger(input.primaryPosition.y, "Slow primary Y");
    positiveInteger(input.primaryTargetRuntimeId, "Slow primary target runtime ID");
    positiveInteger(input.towerRuntimeId, "Slow tower runtime ID");
    const primaryStatusIntent = {
      durationTimeUnits: Timers.authoredMillisecondsToTimeUnits(
        positiveInteger(parameters.durationMs, "Slow primary duration")
      ),
      magnitudeBp: positiveInteger(parameters.magnitudeBp, "Slow primary magnitude"),
      statusId: parameters.statusId,
      targetRuntimeId: input.primaryTargetRuntimeId,
    };
    const candidates = uniqueCandidates(
      input.secondaryCandidates,
      request.limits,
      true,
      "Slow secondary candidates"
    ).filter(function (candidate) {
      return candidate.runtimeId !== input.primaryTargetRuntimeId &&
        Geometry.isWithinSquaredRange(
          primaryX,
          primaryY,
          candidate.x,
          candidate.y,
          counter === null ? 0 : counter.radiusWorldUnits
        );
    });
    if (ABI.checkedAdd(1, candidates.length) > request.limits.maxEntities) {
      throw new RangeError("Slow primary and secondary inputs exceed the behavior entity cap");
    }

    if (counter === null) {
      return finalizeResult({
        events: [], primaryStatusIntent: primaryStatusIntent,
        secondaryStatusIntents: [], state: state,
      }, request.eventCatalog, request.limits);
    }
    const due = ABI.checkedAdd(state.acceptedPrimaryHitCount, 1) >= counter.requiredAcceptedHits;
    if (!due) {
      return finalizeResult({
        events: [],
        primaryStatusIntent: primaryStatusIntent,
        secondaryStatusIntents: [],
        state: { acceptedPrimaryHitCount: ABI.checkedAdd(state.acceptedPrimaryHitCount, 1) },
      }, request.eventCatalog, request.limits);
    }
    if (candidates.length === 0 && !counter.emptyActivationAdvances) {
      return finalizeResult({
        events: [], primaryStatusIntent: primaryStatusIntent,
        secondaryStatusIntents: [], state: state,
      }, request.eventCatalog, request.limits);
    }
    candidates.sort(compareRouteFront);
    const selected = candidates.slice(0, counter.maximumSecondaryTargets);
    if (selected.length > request.limits.maxTargets) {
      throw new RangeError("Slow echo targets exceed the behavior target cap");
    }
    const intents = selected.map(function (candidate) {
      return {
        durationTimeUnits: Timers.authoredMillisecondsToTimeUnits(counter.durationMs),
        magnitudeBp: counter.magnitudeBp,
        statusId: parameters.statusId,
        targetRuntimeId: candidate.runtimeId,
      };
    });
    const events = selected.length === 0 ? [] : [semanticEvent(
      request.eventCatalog,
      counter.semanticEventId,
      {
        durationMs: counter.durationMs,
        magnitudeBp: counter.magnitudeBp,
        primaryTargetRuntimeId: input.primaryTargetRuntimeId,
        secondaryTargetCount: selected.length,
        statusId: parameters.statusId,
        towerRuntimeId: input.towerRuntimeId,
      }
    )];
    return finalizeResult({
      events: events,
      primaryStatusIntent: primaryStatusIntent,
      secondaryStatusIntents: intents,
      state: { acceptedPrimaryHitCount: 0 },
    }, request.eventCatalog, request.limits);
  }

  function resolveSplash(request) {
    const parameters = request.parameters;
    const baseDamageMilli = positiveInteger(parameters.baseDamage, "Splash base damage");
    const damageTypeId = stableId(parameters.damageTypeId, "Splash damage type ID");
    if (parameters.primaryFirst !== true || parameters.maximumPrimaryTargets !== 1) {
      throw new RangeError("Unsupported splash primary rule");
    }
    if (parameters.secondaryComparatorId !== "secondary-route-front-v1") {
      throw new RangeError("Unknown splash secondary comparator ID: " + parameters.secondaryComparatorId);
    }
    const input = request.input;
    exactFields(input, ["actionId", "primaryTarget", "secondaryCandidates", "towerRuntimeId"], "Splash input");
    if (input.actionId !== "resolve") throw new RangeError("Unknown splash behavior action ID: " + input.actionId);
    const primary = targetCandidate(input.primaryTarget, 0, true);
    const towerRuntimeId = positiveInteger(input.towerRuntimeId, "Splash tower runtime ID");
    const radius = positiveInteger(parameters.radiusWorldUnits, "Splash radius");
    const secondaries = uniqueCandidates(
      input.secondaryCandidates,
      request.limits,
      true,
      "Splash secondary candidates"
    ).filter(function (candidate) {
      return candidate.runtimeId !== primary.runtimeId &&
        Geometry.isWithinSquaredRange(primary.x, primary.y, candidate.x, candidate.y, radius);
    });
    if (ABI.checkedAdd(1, secondaries.length) > request.limits.maxEntities) {
      throw new RangeError("Splash primary and secondary inputs exceed the behavior entity cap");
    }
    secondaries.sort(compareRouteFront);
    const totalTargets = ABI.checkedAdd(1, secondaries.length);
    if (totalTargets > request.limits.maxTargets) {
      throw new RangeError("Splash output exceeds the behavior target cap");
    }
    const ordered = [primary].concat(secondaries);
    const center = parameters.centerBonus;
    if (center !== null) {
      if (center.appliesToPrimary !== true || center.appliesToSecondary !== true) {
        throw new RangeError("Unsupported splash center applicability rule");
      }
      positiveInteger(center.radiusWorldUnits, "Splash center radius");
      positiveInteger(center.damageCoefficientBp, "Splash center damage coefficient");
      stableId(center.semanticEventId, "Splash center semantic event ID");
    }
    const events = [];
    const hitIntents = ordered.map(function (candidate, index) {
      const centerEligible = center !== null &&
        Geometry.isWithinSquaredRange(primary.x, primary.y, candidate.x, candidate.y, center.radiusWorldUnits) &&
        ((index === 0 && center.appliesToPrimary) || (index > 0 && center.appliesToSecondary));
      const coefficient = centerEligible ? center.damageCoefficientBp : ABI.BASIS_POINTS;
      if (centerEligible) {
        events.push(semanticEvent(request.eventCatalog, center.semanticEventId, {
          damageCoefficientBp: coefficient,
          targetRuntimeId: candidate.runtimeId,
          towerRuntimeId: towerRuntimeId,
        }));
      }
      return {
        baseDamageMilli: baseDamageMilli,
        damageCoefficientBp: coefficient,
        damageTypeId: damageTypeId,
        isPrimary: index === 0,
        targetRuntimeId: candidate.runtimeId,
      };
    });
    return finalizeResult({ events: events, hitIntents: hitIntents, state: null }, request.eventCatalog, request.limits);
  }

  function requireGuardState(input) {
    exactFields(input, ["slots"], "Guard behavior state");
    const slots = requireArray(input.slots, "Guard state slots").map(function (slot, index) {
      exactFields(slot, [
        "markerId", "replenishDurationTimeUnits", "replenishRemainingTimeUnits",
        "routeDistances", "slotIndex", "summonRuntimeId",
      ], "Guard state slot " + index);
      if (slot.slotIndex !== index) throw new RangeError("Guard state slot indices must be contiguous");
      const routeDistances = requireArray(slot.routeDistances, "Guard state route distances").map(
        function (record, routeIndex) {
          exactFields(
            record,
            ["remainingDistance", "routeDistance", "routeId"],
            "Guard state route distance " + routeIndex
          );
          return {
            remainingDistance: nonnegativeInteger(
              record.remainingDistance,
              "Guard state remaining distance"
            ),
            routeDistance: nonnegativeInteger(record.routeDistance, "Guard state route distance"),
            routeId: stableId(record.routeId, "Guard state route ID"),
          };
        }
      );
      if (routeDistances.length === 0) throw new RangeError("Guard state slot needs a route distance");
      for (let routeIndex = 1; routeIndex < routeDistances.length; routeIndex += 1) {
        if (asciiCompare(routeDistances[routeIndex - 1].routeId, routeDistances[routeIndex].routeId) >= 0) {
          throw new RangeError("Guard state route distances must be unique ASCII sorted");
        }
      }
      return {
        markerId: stableId(slot.markerId, "Guard state marker ID"),
        replenishDurationTimeUnits: nonnegativeInteger(
          slot.replenishDurationTimeUnits,
          "Guard replenish duration"
        ),
        replenishRemainingTimeUnits: nonnegativeInteger(
          slot.replenishRemainingTimeUnits,
          "Guard replenish remaining time"
        ),
        routeDistances: routeDistances,
        slotIndex: slot.slotIndex,
        summonRuntimeId: slot.summonRuntimeId === null
          ? null
          : positiveInteger(slot.summonRuntimeId, "Guard summon runtime ID"),
      };
    });
    const markerIds = new Set();
    const summonRuntimeIds = new Set();
    slots.forEach(function (slot) {
      if (markerIds.has(slot.markerId)) {
        throw new RangeError("Guard state contains a duplicate marker ID");
      }
      markerIds.add(slot.markerId);
      if (slot.summonRuntimeId !== null) {
        if (summonRuntimeIds.has(slot.summonRuntimeId)) {
          throw new RangeError("Guard state contains a duplicate summon runtime ID");
        }
        summonRuntimeIds.add(slot.summonRuntimeId);
      }
    });
    return { slots: slots };
  }

  function cloneGuardSlot(slot) {
    const output = Object.assign({}, slot);
    output.routeDistances = slot.routeDistances.map(function (record) {
      return Object.assign({}, record);
    });
    return output;
  }

  function resolveGuardSlots(request) {
    const parameters = request.parameters;
    if (parameters.summonRecordId !== "hoplite-guard") {
      throw new RangeError("Unknown guard summon record ID: " + parameters.summonRecordId);
    }
    if (parameters.slotComparatorId !== "guard-contact-v1") {
      throw new RangeError("Unknown guard slot comparator ID: " + parameters.slotComparatorId);
    }
    if (parameters.initialReady !== true || parameters.markerProofKind !== "guard" ||
        parameters.markerProofVersion !== 1) {
      throw new RangeError("Unsupported guard marker/initial readiness rule");
    }
    const activeSlotCount = positiveInteger(parameters.activeSlotCount, "Active guard slot count");
    const createCap = positiveInteger(
      parameters.maximumCreateEventsPerTick,
      "Guard create-event cap"
    );
    const replenishUnits = Timers.authoredMillisecondsToTimeUnits(
      positiveInteger(parameters.replenishMs, "Guard replenish milliseconds")
    );
    stableId(parameters.createEventId, "Guard create event ID");
    const state = requireGuardState(request.state);
    if (activeSlotCount > state.slots.length) throw new RangeError("Active guard slots exceed authored markers");
    const input = request.input;
    exactFields(
      input,
      ["actionId", "elapsedTimeUnits", "nextSummonRuntimeId", "towerRuntimeId"],
      "Guard scheduled-spawns input"
    );
    if (input.actionId !== "scheduled-spawns") {
      throw new RangeError("Unknown guard-slot behavior action ID: " + input.actionId);
    }
    const elapsed = nonnegativeInteger(input.elapsedTimeUnits, "Guard elapsed time units");
    let nextRuntimeId = positiveInteger(input.nextSummonRuntimeId, "Next summon runtime ID");
    const towerRuntimeId = positiveInteger(input.towerRuntimeId, "Guard tower runtime ID");
    const slots = state.slots.map(cloneGuardSlot);
    const created = [];
    const events = [];
    for (let index = 0; index < activeSlotCount; index += 1) {
      const slot = slots[index];
      slot.replenishDurationTimeUnits = replenishUnits;
      if (slot.summonRuntimeId !== null) continue;
      slot.replenishRemainingTimeUnits = Math.max(0, ABI.checkedAdd(
        slot.replenishRemainingTimeUnits,
        -Math.min(slot.replenishRemainingTimeUnits, elapsed)
      ));
      if (slot.replenishRemainingTimeUnits > 0) continue;
      if (created.length >= createCap) break;
      if (created.length >= request.limits.maxEntities) {
        throw new RangeError("Guard creation exceeds the behavior entity cap");
      }
      if (events.length >= request.limits.maxEvents) {
        throw new RangeError("Guard creation exceeds the behavior event cap");
      }
      const summonRuntimeId = nextRuntimeId;
      nextRuntimeId = ABI.checkedAdd(nextRuntimeId, 1);
      slot.summonRuntimeId = summonRuntimeId;
      slot.replenishRemainingTimeUnits = 0;
      created.push({
        markerId: slot.markerId,
        slotIndex: slot.slotIndex,
        summonRuntimeId: summonRuntimeId,
      });
      events.push(semanticEvent(request.eventCatalog, parameters.createEventId, {
        markerId: slot.markerId,
        slotIndex: slot.slotIndex,
        summonRuntimeId: summonRuntimeId,
        towerRuntimeId: towerRuntimeId,
      }));
    }
    return finalizeResult({
      created: created,
      events: events,
      nextSummonRuntimeId: nextRuntimeId,
      state: { slots: slots },
    }, request.eventCatalog, request.limits);
  }

  function contactRecord(input, index) {
    exactFields(input, [
      "enemyRuntimeId", "hardControlActive", "hardControlBp", "nextRouteDistance",
      "priorRouteDistance", "requestedForwardAdvance", "resolveActive", "routeId", "tags",
      "targetKind",
    ], "Guard contact candidate " + index);
    const tags = requireArray(input.tags, "Guard contact tags").map(function (tag) {
      return stableId(tag, "Guard contact tag");
    });
    return {
      enemyRuntimeId: positiveInteger(input.enemyRuntimeId, "Guard contact enemy runtime ID"),
      hardControlActive: requireBoolean(input.hardControlActive, "Hard-control active flag"),
      hardControlBp: nonnegativeInteger(input.hardControlBp, "Hard-control basis points"),
      nextRouteDistance: nonnegativeInteger(input.nextRouteDistance, "Next route distance"),
      priorRouteDistance: nonnegativeInteger(input.priorRouteDistance, "Prior route distance"),
      requestedForwardAdvance: positiveInteger(
        input.requestedForwardAdvance,
        "Requested forward advance"
      ),
      resolveActive: requireBoolean(input.resolveActive, "Resolve active flag"),
      routeId: stableId(input.routeId, "Guard contact route ID"),
      tags: tags,
      targetKind: stableId(input.targetKind, "Guard contact target kind"),
    };
  }

  function resolveDurationUnits(tags) {
    if (tags.indexOf("boss") !== -1) return Timers.authoredMillisecondsToTimeUnits(2500);
    if (tags.indexOf("heavy") !== -1) return Timers.authoredMillisecondsToTimeUnits(1500);
    return Timers.authoredMillisecondsToTimeUnits(1000);
  }

  function compareCrossings(left, right) {
    const leftProduct = ABI.checkedMultiply(left.numerator, right.denominator);
    const rightProduct = ABI.checkedMultiply(right.numerator, left.denominator);
    if (leftProduct !== rightProduct) return leftProduct < rightProduct ? -1 : 1;
    const routeOrder = asciiCompare(left.routeId, right.routeId);
    if (routeOrder !== 0) return routeOrder;
    if (left.markerRouteDistance !== right.markerRouteDistance) {
      return left.markerRouteDistance < right.markerRouteDistance ? -1 : 1;
    }
    const markerOrder = asciiCompare(left.slot.markerId, right.slot.markerId);
    if (markerOrder !== 0) return markerOrder;
    if (left.contact.enemyRuntimeId === right.contact.enemyRuntimeId) return 0;
    return left.contact.enemyRuntimeId < right.contact.enemyRuntimeId ? -1 : 1;
  }

  function validateBlockParameters(parameters) {
    if (parameters.summonRecordId !== "hoplite-guard" || parameters.statusId !== "stun" ||
        parameters.resolveStatusId !== "resolve" || parameters.contactDamage !== 0) {
      throw new RangeError("Unknown or unsupported guard summon/status/contact-damage rule");
    }
    if (parameters.prefilterRuleId !== "guard-ground-control-resolve-eligible") {
      throw new RangeError("Unknown guard prefilter rule ID: " + parameters.prefilterRuleId);
    }
    if (parameters.contactComparatorId !== "guard-contact-v1") {
      throw new RangeError("Unknown guard contact comparator ID: " + parameters.contactComparatorId);
    }
    const contactDurationMs = positiveInteger(parameters.durationMs, "Guard contact duration");
    stableId(parameters.damageTypeId, "Guard damage type ID");
    stableId(parameters.contactEventId, "Guard contact event ID");
    stableId(parameters.rejectedEventId, "Guard rejected event ID");
    if (parameters.bash !== null) {
      exactFields(parameters.bash, [
        "damage", "damageTypeId", "durationMs", "hardControlBucketId", "kind",
        "semanticEventId", "statusId",
      ], "Hoplite bash parameters");
      if (parameters.bash.kind !== "first-eligible-contact-per-summon") {
        throw new RangeError("Unknown Hoplite bash rule ID");
      }
      positiveInteger(parameters.bash.damage, "Hoplite bash damage");
      const bashDurationMs = positiveInteger(parameters.bash.durationMs, "Hoplite bash impact duration");
      if (bashDurationMs > contactDurationMs) {
        throw new RangeError("Hoplite bash impact duration cannot exceed the enclosing contact duration");
      }
      if (parameters.bash.damageTypeId !== parameters.damageTypeId ||
          parameters.bash.statusId !== parameters.statusId ||
          parameters.bash.hardControlBucketId !== "hard-control") {
        throw new RangeError("Hoplite bash must share the contact damage type, status, and hard-control bucket");
      }
      stableId(parameters.bash.semanticEventId, "Hoplite bash semantic event ID");
    }
    return parameters;
  }

  function resolveGuardContactBatch(input) {
    exactFields(
      input,
      ["eventCatalog", "input", "limits", "towers"],
      "Aggregate guard-contact request"
    );
    const limits = requireLimits(input.limits);
    exactFields(input.input, ["actionId", "contacts"], "Aggregate guard movement input");
    if (input.input.actionId !== "movement-contacts") {
      throw new RangeError("Unknown guard-contact behavior action ID: " + input.input.actionId);
    }
    const contacts = requireArray(
      input.input.contacts,
      "Guard contact candidates"
    ).map(contactRecord);
    enforceInputEntityCap(contacts, limits, "Guard contact candidates");
    const ids = new Set();
    contacts.forEach(function (contact) {
      if (ids.has(contact.enemyRuntimeId)) throw new RangeError("Duplicate guard contact enemy ID");
      ids.add(contact.enemyRuntimeId);
    });

    const towers = requireArray(input.towers, "Aggregate guard towers").map(function (
      tower,
      towerIndex
    ) {
      exactFields(
        tower,
        ["parameters", "state", "towerRuntimeId"],
        "Aggregate guard tower " + towerIndex
      );
      return {
        parameters: validateBlockParameters(tower.parameters),
        slots: requireGuardState(tower.state).slots.map(cloneGuardSlot),
        towerRuntimeId: positiveInteger(tower.towerRuntimeId, "Guard tower runtime ID"),
      };
    });
    enforceInputEntityCap(towers, limits, "Aggregate guard towers");
    towers.sort(function (left, right) {
      return left.towerRuntimeId < right.towerRuntimeId ? -1 :
        left.towerRuntimeId > right.towerRuntimeId ? 1 : 0;
    });
    const towerRuntimeIds = new Set();
    const markerIds = new Set();
    const summonRuntimeIds = new Set();
    let totalSlots = 0;
    towers.forEach(function (tower) {
      if (towerRuntimeIds.has(tower.towerRuntimeId)) {
        throw new RangeError("Aggregate guard towers contain a duplicate tower runtime ID");
      }
      towerRuntimeIds.add(tower.towerRuntimeId);
      totalSlots = ABI.checkedAdd(totalSlots, tower.slots.length);
      tower.slots.forEach(function (slot) {
        if (markerIds.has(slot.markerId)) {
          throw new RangeError("Aggregate guard towers contain a duplicate marker ID");
        }
        markerIds.add(slot.markerId);
        if (slot.summonRuntimeId !== null) {
          if (summonRuntimeIds.has(slot.summonRuntimeId)) {
            throw new RangeError("Aggregate guard towers contain a duplicate summon runtime ID");
          }
          summonRuntimeIds.add(slot.summonRuntimeId);
        }
      });
    });
    if (totalSlots > limits.maxEntities) {
      throw new RangeError("Aggregate guard slots exceed the behavior entity cap");
    }

    const crossings = [];
    towers.forEach(function (tower) {
      tower.slots.forEach(function (slot) {
        if (slot.summonRuntimeId === null) return;
        contacts.forEach(function (contact) {
          const routeDistance = slot.routeDistances.find(function (record) {
            return record.routeId === contact.routeId;
          });
          if (!routeDistance ||
              !(contact.priorRouteDistance < routeDistance.routeDistance &&
                routeDistance.routeDistance <= contact.nextRouteDistance)) return;
          crossings.push({
            contact: contact,
            denominator: contact.requestedForwardAdvance,
            markerRouteDistance: routeDistance.routeDistance,
            numerator: ABI.checkedAdd(routeDistance.routeDistance, -contact.priorRouteDistance),
            routeId: routeDistance.routeId,
            slot: slot,
            summonRuntimeId: slot.summonRuntimeId,
            tower: tower,
          });
        });
      });
    });
    crossings.sort(compareCrossings);
    const usedSummons = new Set();
    const usedEnemies = new Set();
    const acceptedContacts = [];
    const events = [];
    const queuedDamageIntents = [];
    crossings.forEach(function (crossing) {
      const slot = crossing.slot;
      const contact = crossing.contact;
      const tower = crossing.tower;
      const parameters = tower.parameters;
      const summonRuntimeId = crossing.summonRuntimeId;
      if (usedSummons.has(summonRuntimeId) || usedEnemies.has(contact.enemyRuntimeId)) return;
      if (contact.targetKind !== "ground") return;
      let rejectionReason = null;
      if (contact.resolveActive) rejectionReason = "resolve-active";
      else if (contact.hardControlActive) rejectionReason = "hard-control-occupied";
      if (rejectionReason !== null) {
        events.push(semanticEvent(input.eventCatalog, parameters.rejectedEventId, {
          enemyRuntimeId: contact.enemyRuntimeId,
          markerId: slot.markerId,
          reasonId: rejectionReason,
          summonRuntimeId: summonRuntimeId,
        }));
        return;
      }
      const bash = parameters.bash;
      const compoundDurationMs = parameters.durationMs;
      const authoredDurationUnits = Timers.authoredMillisecondsToTimeUnits(compoundDurationMs);
      let durationTimeUnits = ABI.checkedMulDivFloor(
        authoredDurationUnits,
        [contact.hardControlBp],
        [ABI.BASIS_POINTS]
      );
      if (contact.hardControlBp > 0 && durationTimeUnits < ABI.TIME_UNITS_PER_TICK) {
        durationTimeUnits = ABI.TIME_UNITS_PER_TICK;
      }
      if (durationTimeUnits === 0) {
        events.push(semanticEvent(input.eventCatalog, parameters.rejectedEventId, {
          enemyRuntimeId: contact.enemyRuntimeId,
          markerId: slot.markerId,
          reasonId: "control-scaled-to-zero",
          summonRuntimeId: summonRuntimeId,
        }));
        return;
      }
      usedSummons.add(summonRuntimeId);
      usedEnemies.add(contact.enemyRuntimeId);
      const resolveTimeUnits = resolveDurationUnits(contact.tags);
      acceptedContacts.push({
        bashImpactDurationTimeUnits: bash === null
          ? 0
          : Timers.authoredMillisecondsToTimeUnits(bash.durationMs),
        clampedRouteDistance: crossing.markerRouteDistance,
        durationTimeUnits: durationTimeUnits,
        enemyRuntimeId: contact.enemyRuntimeId,
        haltForwardMovement: true,
        hardControlBucketId: "hard-control",
        markerId: slot.markerId,
        resolveDurationTimeUnits: resolveTimeUnits,
        resolveStartsAfterTimeUnits: durationTimeUnits,
        resolveStatusId: parameters.resolveStatusId,
        routeId: crossing.routeId,
        statusId: parameters.statusId,
        summonRuntimeId: summonRuntimeId,
        towerRuntimeId: tower.towerRuntimeId,
      });
      if (durationTimeUnits % ABI.TICKS_PER_SECOND !== 0) {
        throw new RangeError("Guard event duration is not exactly representable in integer milliseconds");
      }
      events.push(semanticEvent(input.eventCatalog, parameters.contactEventId, {
        durationMs: durationTimeUnits / ABI.TICKS_PER_SECOND,
        enemyRuntimeId: contact.enemyRuntimeId,
        markerId: slot.markerId,
        summonRuntimeId: summonRuntimeId,
      }));
      if (bash !== null) {
        events.push(semanticEvent(input.eventCatalog, bash.semanticEventId, {
          damageMilli: bash.damage,
          durationMs: bash.durationMs,
          enemyRuntimeId: contact.enemyRuntimeId,
          statusId: bash.statusId,
          summonRuntimeId: summonRuntimeId,
          towerRuntimeId: tower.towerRuntimeId,
        }));
        queuedDamageIntents.push({
          armorIgnoreBp: 0,
          baseDamageMilli: bash.damage,
          bossCoefficientBp: ABI.BASIS_POINTS,
          damageTypeId: bash.damageTypeId,
          internalDamageCoefficientBp: ABI.BASIS_POINTS,
          shieldCoefficientBp: ABI.BASIS_POINTS,
          targetRuntimeId: contact.enemyRuntimeId,
          towerRuntimeId: tower.towerRuntimeId,
        });
      }
      events.push(semanticEvent(input.eventCatalog, "guard.consume", {
        enemyRuntimeId: contact.enemyRuntimeId,
        markerId: slot.markerId,
        summonRuntimeId: summonRuntimeId,
      }));
      tower.slots[slot.slotIndex].summonRuntimeId = null;
      tower.slots[slot.slotIndex].replenishRemainingTimeUnits = slot.replenishDurationTimeUnits;
    });
    if (acceptedContacts.length > limits.maxTargets) {
      throw new RangeError("Guard contacts exceed the behavior target cap");
    }
    return finalizeResult({
      acceptedContacts: acceptedContacts,
      events: events,
      queuedDamageIntents: queuedDamageIntents,
      towerStates: towers.map(function (tower) {
        return {
          state: { slots: tower.slots },
          towerRuntimeId: tower.towerRuntimeId,
        };
      }),
    }, input.eventCatalog, limits);
  }

  function resolveBlock(request) {
    const input = request.input;
    exactFields(input, ["actionId", "contacts", "towerRuntimeId"], "Guard movement input");
    const towerRuntimeId = positiveInteger(input.towerRuntimeId, "Guard tower runtime ID");
    const aggregate = resolveGuardContactBatch({
      eventCatalog: request.eventCatalog,
      input: { actionId: input.actionId, contacts: input.contacts },
      limits: request.limits,
      towers: [{
        parameters: request.parameters,
        state: request.state,
        towerRuntimeId: towerRuntimeId,
      }],
    });
    return finalizeResult({
      acceptedContacts: aggregate.acceptedContacts,
      events: aggregate.events,
      queuedDamageIntents: aggregate.queuedDamageIntents,
      state: aggregate.towerStates[0].state,
    }, request.eventCatalog, request.limits);
  }

  function requireRevealState(input) {
    exactFields(input, ["revealedEnemyRuntimeIds"], "Reveal behavior state");
    const ids = uniquePositiveIds(input.revealedEnemyRuntimeIds, "Revealed enemy runtime IDs");
    for (let index = 1; index < ids.length; index += 1) {
      if (ids[index - 1] >= ids[index]) throw new RangeError("Revealed enemy runtime IDs must be sorted");
    }
    return { revealedEnemyRuntimeIds: ids };
  }

  function validateRevealRules(parameters) {
    if (parameters.eligibilityRuleId !== "continuous-reveal-eligible" ||
        parameters.removalRuleId !== "source-out-of-range-or-removed" ||
        parameters.stackRuleId !== "strongest-magnitude-expiry-source" ||
        parameters.statusPayload.kind !== "acquisition-reveal" ||
        parameters.statusPayload.collateralEligibilityRuleId !== "collateral-cloak-eligible") {
      throw new RangeError("Unknown continuous reveal rule ID");
    }
    if (parameters.statusId !== "reveal") throw new RangeError("Unsupported reveal status ID");
  }

  function resolveReveal(request) {
    validateRevealRules(request.parameters);
    const state = requireRevealState(request.state);
    const input = request.input;
    if (input.actionId !== "status-expiry" && input.actionId !== "shield-damage-and-status") {
      throw new RangeError("Unknown reveal behavior action ID: " + String(input.actionId));
    }
    exactFields(input, [
      "actionId", "eligibleEnemyRuntimeIds", "sourceActive", "towerRuntimeId",
    ], "Reveal sync input");
    const sourceActive = requireBoolean(input.sourceActive, "Reveal source-active flag");
    const towerRuntimeId = positiveInteger(input.towerRuntimeId, "Reveal tower runtime ID");
    const eligible = sourceActive
      ? uniquePositiveIds(input.eligibleEnemyRuntimeIds, "Reveal eligible enemy runtime IDs")
      : [];
    enforceInputEntityCap(eligible, request.limits, "Reveal eligible enemies");
    eligible.sort(function (left, right) { return left - right; });
    const current = state.revealedEnemyRuntimeIds;
    const currentSet = new Set(current);
    const eligibleSet = new Set(eligible);
    const events = [];
    const statusIntents = [];
    let nextIds;
    if (input.actionId === "status-expiry") {
      const removed = current.filter(function (id) { return !eligibleSet.has(id); });
      removed.forEach(function (enemyRuntimeId) {
        statusIntents.push({ enemyRuntimeId: enemyRuntimeId, kind: "remove", statusId: "reveal" });
        events.push(semanticEvent(request.eventCatalog, request.parameters.removeEventId, {
          enemyRuntimeId: enemyRuntimeId,
          statusId: "reveal",
          towerRuntimeId: towerRuntimeId,
        }));
      });
      nextIds = current.filter(function (id) { return eligibleSet.has(id); });
    } else {
      const added = eligible.filter(function (id) { return !currentSet.has(id); });
      added.forEach(function (enemyRuntimeId) {
        statusIntents.push({ enemyRuntimeId: enemyRuntimeId, kind: "apply", statusId: "reveal" });
        events.push(semanticEvent(request.eventCatalog, request.parameters.applyEventId, {
          enemyRuntimeId: enemyRuntimeId,
          statusId: "reveal",
          towerRuntimeId: towerRuntimeId,
        }));
      });
      nextIds = current.concat(added).sort(function (left, right) { return left - right; });
    }
    if (statusIntents.length > request.limits.maxTargets) {
      throw new RangeError("Reveal changes exceed the behavior target cap");
    }
    return finalizeResult({
      events: events,
      state: { revealedEnemyRuntimeIds: nextIds },
      statusIntents: statusIntents,
    }, request.eventCatalog, request.limits);
  }

  function requireMarkState(input) {
    exactFields(input, ["acceptedScanCount"], "Mark behavior state");
    return { acceptedScanCount: nonnegativeInteger(input.acceptedScanCount, "Accepted mark scan count") };
  }

  function validateScanCounter(counter) {
    if (counter === null) return null;
    if (counter.kind !== "every-n-scans" || counter.resetRuleId !== "counter-reset-on-wave-start" ||
        counter.emptyScanAdvances !== false || counter.recursive !== false ||
        counter.targetPolicySource.kind !== "fixed" ||
        counter.targetPolicySource.targetPolicyId !== "FRONT") {
      throw new RangeError("Unknown or unsupported Oracle scan-counter rule");
    }
    positiveInteger(counter.requiredScans, "Oracle required scans");
    positiveInteger(counter.maximumTargets, "Oracle capstone maximum targets");
    positiveInteger(counter.durationMs, "Oracle capstone duration");
    stableId(counter.semanticEventId, "Oracle capstone semantic event ID");
    return counter;
  }

  function resolveMark(request) {
    const parameters = request.parameters;
    if (parameters.statusId !== "mark" ||
        parameters.statusPayload.kind !== "external-damage-amplification" ||
        parameters.stackRuleId !== "strongest-magnitude-expiry-source" ||
        parameters.targetPolicySource.kind !== "fixed" ||
        parameters.targetPolicySource.targetPolicyId !== "FRONT") {
      throw new RangeError("Unknown Oracle mark delivery rule");
    }
    const counter = validateScanCounter(parameters.scanCounter);
    const state = requireMarkState(request.state);
    if ((counter === null && state.acceptedScanCount !== 0) ||
        (counter !== null && state.acceptedScanCount >= counter.requiredScans)) {
      throw new RangeError("Mark counter state exceeds its authored bound");
    }
    const input = request.input;
    if (input.actionId === "wave-start") {
      exactFields(input, ["actionId"], "Mark wave-start input");
      return finalizeResult({
        events: [], expiredStatusIntents: [], markIntents: [],
        state: { acceptedScanCount: 0 },
      },
        request.eventCatalog, request.limits);
    }
    if (input.actionId === "status-expiry") {
      exactFields(
        input,
        ["actionId", "expiredEnemyRuntimeIds", "towerRuntimeId"],
        "Mark status-expiry input"
      );
      const towerRuntimeId = positiveInteger(input.towerRuntimeId, "Mark tower runtime ID");
      const expiredIds = uniquePositiveIds(
        input.expiredEnemyRuntimeIds,
        "Expired mark enemy runtime IDs"
      );
      enforceInputEntityCap(expiredIds, request.limits, "Expired mark enemies");
      expiredIds.sort(function (left, right) { return left - right; });
      if (expiredIds.length > request.limits.maxTargets) {
        throw new RangeError("Expired marks exceed the behavior target cap");
      }
      const expiryEvents = expiredIds.map(function (enemyRuntimeId) {
        return semanticEvent(request.eventCatalog, parameters.expireEventId, {
          enemyRuntimeId: enemyRuntimeId,
          statusId: "mark",
          towerRuntimeId: towerRuntimeId,
        });
      });
      return finalizeResult({
        events: expiryEvents,
        expiredStatusIntents: expiredIds.map(function (enemyRuntimeId) {
          return { enemyRuntimeId: enemyRuntimeId, statusId: "mark" };
        }),
        markIntents: [],
        state: state,
      }, request.eventCatalog, request.limits);
    }
    if (input.actionId !== "scan") {
      throw new RangeError("Unknown mark behavior action ID: " + String(input.actionId));
    }
    exactFields(input, ["actionId", "candidates", "towerRuntimeId"], "Mark scan input");
    const towerRuntimeId = positiveInteger(input.towerRuntimeId, "Mark tower runtime ID");
    const candidates = uniqueCandidates(input.candidates, request.limits, false, "Mark candidates");
    if (candidates.length === 0) {
      return finalizeResult({
        events: [], expiredStatusIntents: [], markIntents: [], state: state,
      }, request.eventCatalog, request.limits);
    }
    candidates.sort(compareRouteFront);
    const nextCount = counter === null ? 0 : ABI.checkedAdd(state.acceptedScanCount, 1);
    const capstoneDue = counter !== null && nextCount >= counter.requiredScans;
    const maximumTargets = capstoneDue
      ? counter.maximumTargets
      : positiveInteger(parameters.maximumTargets, "Mark maximum targets");
    const selected = candidates.slice(0, maximumTargets);
    if (selected.length > request.limits.maxTargets) {
      throw new RangeError("Mark targets exceed the behavior target cap");
    }
    const durationMs = capstoneDue ? counter.durationMs : parameters.durationMs;
    const markIntents = selected.map(function (candidate) {
      return {
        amountBp: nonnegativeInteger(parameters.statusPayload.amountBp, "Mark amount basis points"),
        durationTimeUnits: Timers.authoredMillisecondsToTimeUnits(
          positiveInteger(durationMs, "Mark duration")
        ),
        sourceTypeId: stableId(parameters.statusPayload.sourceTypeId, "Mark source type ID"),
        statusId: "mark",
        targetRuntimeId: candidate.runtimeId,
      };
    });
    const scanCount = counter === null ? 1 : nextCount;
    const events = [semanticEvent(request.eventCatalog, parameters.scanEventId, {
      scanCount: scanCount,
      targetCount: selected.length,
      towerRuntimeId: towerRuntimeId,
    })];
    selected.forEach(function (candidate) {
      events.push(semanticEvent(request.eventCatalog, parameters.applyEventId, {
        amountBp: parameters.statusPayload.amountBp,
        durationMs: durationMs,
        enemyRuntimeId: candidate.runtimeId,
        sourceTypeId: parameters.statusPayload.sourceTypeId,
        statusId: "mark",
        towerRuntimeId: towerRuntimeId,
      }));
    });
    if (capstoneDue) {
      events.push(semanticEvent(request.eventCatalog, counter.semanticEventId, {
        durationMs: counter.durationMs,
        scanCount: nextCount,
        statusId: "mark",
        targetCount: selected.length,
        towerRuntimeId: towerRuntimeId,
      }));
    }
    return finalizeResult({
      events: events,
      expiredStatusIntents: [],
      markIntents: markIntents,
      state: { acceptedScanCount: capstoneDue ? 0 : nextCount },
    }, request.eventCatalog, request.limits);
  }

  function requireCloakState(input) {
    exactFields(input, ["exposedRemainingTimeUnits", "wasVisible"], "Cloak behavior state");
    return {
      exposedRemainingTimeUnits: nonnegativeInteger(
        input.exposedRemainingTimeUnits,
        "Echo exposure remaining time"
      ),
      wasVisible: requireBoolean(input.wasVisible, "Echo prior visibility flag"),
    };
  }

  function cloakEligibility(state, revealActive) {
    const visible = revealActive || state.exposedRemainingTimeUnits > 0;
    return {
      collateralEligible: true,
      directEligible: visible,
      isCloaked: !visible,
    };
  }

  function validateCloakRules(parameters) {
    if (parameters.directTargetEligibilityRuleId !== "direct-visible-or-exposed" ||
        parameters.collateralEligibilityRuleId !== "collateral-cloak-eligible" ||
        parameters.continuousRevealRuleId !== "continuous-reveal-eligible" ||
        parameters.damageExposeStatusId !== "exposed" || parameters.revealStatusId !== "reveal") {
      throw new RangeError("Unknown Echo cloak rule ID");
    }
  }

  function resolveCloak(request) {
    validateCloakRules(request.parameters);
    const state = requireCloakState(request.state);
    const input = request.input;
    stableId(input.actionId, "Cloak action ID");
    if (input.actionId === "eligibility") {
      exactFields(input, ["actionId", "revealActive"], "Cloak eligibility input");
      const reveal = requireBoolean(input.revealActive, "Reveal active flag");
      const eligibility = cloakEligibility(state, reveal);
      return finalizeResult({
        eligibility: eligibility,
        events: [],
        state: {
          exposedRemainingTimeUnits: state.exposedRemainingTimeUnits,
          wasVisible: state.wasVisible,
        },
      }, request.eventCatalog, request.limits);
    }
    if (input.actionId === "accepted-damage") {
      exactFields(input, [
        "actionId", "enemyRuntimeId", "hpDamageMilli", "revealActive", "sourceRuntimeId",
      ], "Cloak damage input");
      positiveInteger(input.hpDamageMilli, "Echo accepted HP damage");
      const revealActive = requireBoolean(input.revealActive, "Reveal active flag");
      const enemyRuntimeId = positiveInteger(input.enemyRuntimeId, "Echo enemy runtime ID");
      const sourceRuntimeId = positiveInteger(input.sourceRuntimeId, "Echo damage source runtime ID");
      const durationMs = positiveInteger(
        request.parameters.damageExposeDurationMs,
        "Echo damage exposure duration"
      );
      const nextState = {
        exposedRemainingTimeUnits: Timers.authoredMillisecondsToTimeUnits(durationMs),
        wasVisible: true,
      };
      const exposureEvents = [];
      if (!state.wasVisible && !revealActive) exposureEvents.push(semanticEvent(
        request.eventCatalog,
        "echo.exposed",
        {
          durationMs: durationMs,
          enemyRuntimeId: enemyRuntimeId,
          sourceRuntimeId: sourceRuntimeId,
          statusId: "exposed",
        }
      ));
      return finalizeResult({
        eligibility: cloakEligibility(nextState, revealActive),
        events: exposureEvents,
        state: nextState,
      }, request.eventCatalog, request.limits);
    }
    if (input.actionId === "status-expiry") {
      exactFields(input, [
        "actionId", "elapsedTimeUnits", "enemyRuntimeId", "revealActive",
      ], "Cloak expiry input");
      const elapsed = nonnegativeInteger(input.elapsedTimeUnits, "Echo expiry elapsed time");
      const enemyRuntimeId = positiveInteger(input.enemyRuntimeId, "Echo enemy runtime ID");
      const reveal = requireBoolean(input.revealActive, "Reveal active flag");
      const remaining = Math.max(0, ABI.checkedAdd(
        state.exposedRemainingTimeUnits,
        -Math.min(state.exposedRemainingTimeUnits, elapsed)
      ));
      const interim = { exposedRemainingTimeUnits: remaining, wasVisible: state.wasVisible };
      const eligibility = cloakEligibility(interim, reveal);
      const events = [];
      if (state.wasVisible && eligibility.isCloaked) {
        events.push(semanticEvent(request.eventCatalog, "echo.cloak", {
          enemyRuntimeId: enemyRuntimeId,
          statusId: "cloak",
        }));
      }
      return finalizeResult({
        eligibility: eligibility,
        events: events,
        state: { exposedRemainingTimeUnits: remaining, wasVisible: !eligibility.isCloaked },
      }, request.eventCatalog, request.limits);
    }
    throw new RangeError("Unknown cloak behavior action ID: " + input.actionId);
  }

  function requireTalosState(input) {
    exactFields(
      input,
      ["currentHpMilli", "currentPhaseOrder", "maximumHpMilli", "nextThresholdOrder"],
      "Talos behavior state"
    );
    const state = {
      currentHpMilli: nonnegativeInteger(input.currentHpMilli, "Talos current HP"),
      currentPhaseOrder: nonnegativeInteger(input.currentPhaseOrder, "Talos current phase order"),
      maximumHpMilli: positiveInteger(input.maximumHpMilli, "Talos runtime maximum HP"),
      nextThresholdOrder: nonnegativeInteger(input.nextThresholdOrder, "Talos next threshold order"),
    };
    if (state.currentHpMilli > state.maximumHpMilli) {
      throw new RangeError("Talos current HP exceeds runtime maximum HP");
    }
    return state;
  }

  function thresholdHpMilli(maxHpMilli, thresholdHpBp) {
    return ABI.checkedMulDivFloor(maxHpMilli, [thresholdHpBp], [ABI.BASIS_POINTS]);
  }

  function requireTalosDefinition(definition) {
    if (definition.id !== "talos-prototype" || definition.executeBehavior.kind !== "forbidden" ||
        definition.thresholdScript.contractId !== "bossScript" ||
        definition.thresholdScript.version !== 1 ||
        definition.thresholdScript.deliveryKind !== "guarded-hp-thresholds") {
      throw new RangeError("Unknown or unsupported Talos boss-script rule");
    }
    const script = definition.thresholdScript.parameters;
    if (script.maximumTransitionsPerResolvedHit !== 1) {
      throw new RangeError("Talos must permit exactly one threshold transition per resolved hit");
    }
    return {
      phases: requireArray(definition.phaseRecords, "Talos phases"),
      script: script,
      thresholds: requireArray(script.thresholds, "Talos thresholds"),
    };
  }

  function requireTalosTransitionOrder(threshold) {
    const eventIds = requireArray(
      threshold.transitionEventIds,
      "Talos transition semantic event IDs"
    );
    const expected = ["talos.threshold", "talos.expose", "talos.pods"];
    if (eventIds.length !== expected.length || eventIds.some(function (eventId, index) {
      return eventId !== expected[index];
    })) {
      throw new RangeError(
        "Talos transitionEventIds require source amendment to talos.threshold, talos.expose, talos.pods"
      );
    }
  }

  function compileTalosThreshold(request, threshold, routeId) {
    requireTalosTransitionOrder(threshold);
    const statusDeliveries = requireArray(
      threshold.statusDeliveries,
      "Talos status deliveries"
    ).map(function (delivery, index) {
      if (delivery.order !== index) throw new RangeError("Talos status delivery order must be contiguous");
      if (delivery.stackRuleId !== "refresh-same-source") {
        throw new RangeError("Unknown Talos status stack rule ID: " + delivery.stackRuleId);
      }
      const semanticEventIds = requireArray(
        delivery.semanticEventIds,
        "Talos status semantic event IDs"
      ).map(function (eventId) {
        return requireCatalogEventPhase(
          request.eventCatalog,
          eventId,
          "shield-damage-and-status"
        );
      });
      return {
        durationMs: positiveInteger(delivery.durationMs, "Talos status duration"),
        magnitudeBp: nonnegativeInteger(delivery.magnitudeBp, "Talos status magnitude"),
        order: delivery.order,
        semanticEventIds: semanticEventIds,
        stackRuleId: delivery.stackRuleId,
        statusId: stableId(delivery.statusId, "Talos status ID"),
      };
    });
    if (statusDeliveries.length !== 1 || statusDeliveries[0].statusId !== "exposed" ||
        threshold.exposedDamageCoefficientBp !==
          ABI.checkedAdd(ABI.BASIS_POINTS, statusDeliveries[0].magnitudeBp)) {
      throw new RangeError("Talos exposure coefficient must equal 10000 plus its single status delta");
    }
    const children = requireArray(
      threshold.childSpawnRecords,
      "Talos child spawn records"
    ).map(function (child, index) {
      if (child.order !== index || child.lineageOwnership !== "parent-lineage" ||
          child.bountyPolicy !== "suppressed") {
        throw new RangeError("Talos child spawn order/lineage/bounty policy is invalid");
      }
      let fixedRouteId = null;
      let resolvedRouteId;
      if (child.routeOwnership === "inherit") {
        if (child.fixedRouteId !== null) {
          throw new RangeError("Inherited Talos child route must have null fixedRouteId");
        }
        resolvedRouteId = routeId;
      } else if (child.routeOwnership === "fixed") {
        fixedRouteId = stableId(child.fixedRouteId, "Talos fixed child route ID");
        resolvedRouteId = fixedRouteId;
      } else {
        throw new RangeError("Unknown Talos child route ownership ID: " + child.routeOwnership);
      }
      return {
        bountyPolicy: "suppressed",
        count: positiveInteger(child.count, "Talos child count"),
        enemyId: stableId(child.enemyId, "Talos child enemy ID"),
        firstDelayTicks: nonnegativeInteger(child.firstDelayTicks, "Talos child first delay"),
        fixedRouteId: fixedRouteId,
        intervalTicks: positiveInteger(child.intervalTicks, "Talos child interval"),
        lineageOwnership: "parent-lineage",
        order: child.order,
        routeId: resolvedRouteId,
        routeOffsetDistance: nonnegativeInteger(child.routeOffsetDistance, "Talos child route offset"),
      };
    });
    const childTotal = children.reduce(function (sum, child) {
      return ABI.checkedAdd(sum, child.count);
    }, 0);
    if (childTotal > request.limits.maxEntities) {
      throw new RangeError("Talos child plan exceeds the behavior entity cap");
    }
    const resistanceOverridePlans = requireArray(
      threshold.resistanceOverrides,
      "Talos resistance overrides"
    ).map(function (override, index) {
      exactFields(
        override,
        ["damageTypeId", "reductionBp"],
        "Talos resistance override " + index
      );
      return {
        damageTypeId: stableId(override.damageTypeId, "Talos resistance damage type ID"),
        reductionBp: nonnegativeInteger(override.reductionBp, "Talos resistance reduction"),
      };
    });
    requireCatalogEventPhase(
      request.eventCatalog,
      "talos.expose",
      "guarded-boss-threshold-transition"
    );
    requireCatalogEventPhase(
      request.eventCatalog,
      "talos.pods",
      "terminal-death-execute-children-and-revival"
    );
    return {
      childSpawnPlans: children,
      damageCoefficientBp: positiveInteger(
        threshold.exposedDamageCoefficientBp,
        "Talos exposed damage coefficient"
      ),
      exposedDurationMs: positiveInteger(
        threshold.exposedWindowDurationMs,
        "Talos exposed-window duration"
      ),
      maximumCreateEventsPerTick: positiveInteger(
        threshold.maximumCreateEventsPerTick,
        "Talos maximum create events per tick"
      ),
      resistanceOverridePlans: resistanceOverridePlans,
      statusDeliveries: statusDeliveries,
    };
  }

  function requireTalosReleasePlan(input, records) {
    exactFields(input, [
      "bossRuntimeId", "lineageId", "releaseAfterTicks", "routeDistance", "routeId",
      "thresholdId", "thresholdOrder",
    ], "Talos warning release plan");
    const thresholdOrder = nonnegativeInteger(input.thresholdOrder, "Talos release threshold order");
    if (thresholdOrder >= records.thresholds.length) {
      throw new RangeError("Talos release threshold order exceeds authored thresholds");
    }
    const threshold = records.thresholds[thresholdOrder];
    const thresholdId = stableId(input.thresholdId, "Talos release threshold ID");
    if (threshold.id !== thresholdId || threshold.order !== thresholdOrder) {
      throw new RangeError("Talos release plan does not match its authored threshold");
    }
    const releaseAfterTicks = positiveInteger(
      input.releaseAfterTicks,
      "Talos release delay ticks"
    );
    if (releaseAfterTicks !== threshold.warningDelayTicks) {
      throw new RangeError("Talos release delay does not match its authored warning");
    }
    return {
      bossRuntimeId: positiveInteger(input.bossRuntimeId, "Talos release boss runtime ID"),
      lineageId: stableId(input.lineageId, "Talos release lineage ID"),
      releaseAfterTicks: releaseAfterTicks,
      routeDistance: nonnegativeInteger(input.routeDistance, "Talos release route distance"),
      routeId: stableId(input.routeId, "Talos release route ID"),
      threshold: threshold,
      thresholdId: thresholdId,
      thresholdOrder: thresholdOrder,
    };
  }

  function resolveTalosWarningRelease(request, records) {
    if (request.state !== null) {
      throw new TypeError("Talos warning release must be independent of boss runtime state");
    }
    exactFields(request.input, ["actionId", "releasePlan"], "Talos warning-release input");
    const plan = requireTalosReleasePlan(request.input.releasePlan, records);
    const compiled = compileTalosThreshold(request, plan.threshold, plan.routeId);
    const exposedDurationTimeUnits = Timers.authoredMillisecondsToTimeUnits(
      compiled.exposedDurationMs
    );
    const events = [];
    compiled.statusDeliveries.forEach(function (delivery) {
      delivery.semanticEventIds.forEach(function (eventId) {
        events.push(semanticEvent(request.eventCatalog, eventId, {
          bossRuntimeId: plan.bossRuntimeId,
          durationMs: delivery.durationMs,
          magnitudeBp: delivery.magnitudeBp,
          statusId: delivery.statusId,
          thresholdId: plan.thresholdId,
        }));
      });
    });
    events.push(semanticEvent(request.eventCatalog, "talos.expose", {
      bossRuntimeId: plan.bossRuntimeId,
      damageCoefficientBp: compiled.damageCoefficientBp,
      durationMs: compiled.exposedDurationMs,
      thresholdId: plan.thresholdId,
    }));
    compiled.childSpawnPlans.forEach(function (child) {
      events.push(semanticEvent(request.eventCatalog, "talos.pods", {
        bossRuntimeId: plan.bossRuntimeId,
        enemyId: child.enemyId,
        lineageId: plan.lineageId,
        podCount: child.count,
        thresholdId: plan.thresholdId,
      }));
    });
    return finalizeResult({
      childSpawnPlans: compiled.childSpawnPlans.map(function (child) {
        return Object.assign({}, child, {
          lineageId: plan.lineageId,
          routeDistance: plan.routeDistance,
          sourceBossRuntimeId: plan.bossRuntimeId,
        });
      }),
      events: events,
      exposure: {
        damageCoefficientBp: compiled.damageCoefficientBp,
        durationTimeUnits: exposedDurationTimeUnits,
        internalCoefficientStageId: "boss",
        targetRuntimeId: plan.bossRuntimeId,
      },
      maximumCreateEventsPerTick: compiled.maximumCreateEventsPerTick,
      resistanceOverridePlans: compiled.resistanceOverridePlans.map(function (override) {
        return {
          damageTypeId: override.damageTypeId,
          durationTimeUnits: exposedDurationTimeUnits,
          reductionBp: override.reductionBp,
          targetRuntimeId: plan.bossRuntimeId,
        };
      }),
      scheduledReleasePlans: [],
      state: null,
      statusDeliveries: compiled.statusDeliveries.map(function (delivery) {
        return {
          durationTimeUnits: Timers.authoredMillisecondsToTimeUnits(delivery.durationMs),
          magnitudeBp: delivery.magnitudeBp,
          order: delivery.order,
          semanticEventIds: delivery.semanticEventIds,
          stackRuleId: delivery.stackRuleId,
          statusId: delivery.statusId,
          targetRuntimeId: plan.bossRuntimeId,
        };
      }),
    }, request.eventCatalog, request.limits);
  }

  function resolveTalos(request) {
    const records = requireTalosDefinition(request.parameters);
    const input = request.input;
    stableId(input.actionId, "Talos behavior action ID");
    if (input.actionId === "warning-release") {
      return resolveTalosWarningRelease(request, records);
    }
    exactFields(input, [
      "actionId", "bossRuntimeId", "damageMilli", "lineageId", "routeDistance", "routeId",
    ], "Talos resolved-hit input");
    if (input.actionId !== "resolved-hit") {
      throw new RangeError("Unknown Talos behavior action ID: " + input.actionId);
    }
    const state = requireTalosState(request.state);
    const bossRuntimeId = positiveInteger(input.bossRuntimeId, "Talos runtime ID");
    const damageMilli = nonnegativeInteger(input.damageMilli, "Talos resolved damage");
    const lineageId = stableId(input.lineageId, "Talos lineage ID");
    const routeDistance = nonnegativeInteger(input.routeDistance, "Talos route distance");
    const routeId = stableId(input.routeId, "Talos route ID");
    const thresholds = records.thresholds;
    const phases = records.phases;
    if (state.nextThresholdOrder > thresholds.length || state.currentPhaseOrder >= phases.length) {
      throw new RangeError("Talos state indices exceed authored records");
    }
    if (state.currentHpMilli === 0) throw new RangeError("Terminal Talos state cannot accept another hit");
    if (state.nextThresholdOrder !== state.currentPhaseOrder) {
      throw new RangeError("Talos phase and next-threshold indices must advance together");
    }
    const currentHpRatioBp = Math.max(1, ABI.checkedMulDivFloor(
      state.currentHpMilli,
      [ABI.BASIS_POINTS],
      [state.maximumHpMilli]
    ));
    const currentPhase = phases[state.currentPhaseOrder];
    if (currentHpRatioBp < currentPhase.hpLowerInclusiveBp ||
        currentHpRatioBp > currentPhase.hpUpperInclusiveBp) {
      throw new RangeError("Talos HP does not belong to its current phase");
    }
    const proposedHp = Math.max(0, ABI.checkedAdd(state.currentHpMilli, -damageMilli));
    const threshold = state.nextThresholdOrder < thresholds.length
      ? thresholds[state.nextThresholdOrder]
      : null;
    const clampHp = threshold === null
      ? null
      : thresholdHpMilli(state.maximumHpMilli, threshold.thresholdHpBp);
    const crosses = threshold !== null && proposedHp <= clampHp && state.currentHpMilli > clampHp;
    if (!crosses) {
      const nextHp = proposedHp;
      return finalizeResult({
        appliedDamageMilli: ABI.checkedAdd(state.currentHpMilli, -nextHp),
        childSpawnPlans: [],
        discardedDamageMilli: Math.max(0, ABI.checkedAdd(damageMilli, -ABI.checkedAdd(state.currentHpMilli, -nextHp))),
        events: [],
        exposure: null,
        resistanceOverridePlans: [],
        scheduledReleasePlans: [],
        state: {
          currentHpMilli: nextHp,
          currentPhaseOrder: state.currentPhaseOrder,
          maximumHpMilli: state.maximumHpMilli,
          nextThresholdOrder: state.nextThresholdOrder,
        },
        statusDeliveries: [],
      }, request.eventCatalog, request.limits);
    }
    if (threshold.order !== state.nextThresholdOrder || threshold.clampHpToThreshold !== true) {
      throw new RangeError("Talos threshold order/clamp rule is invalid");
    }
    const nextPhaseOrder = ABI.checkedAdd(state.currentPhaseOrder, 1);
    if (nextPhaseOrder >= phases.length) throw new RangeError("Talos threshold has no following phase");
    const oldPhase = phases[state.currentPhaseOrder];
    const nextPhase = phases[nextPhaseOrder];
    const appliedDamage = ABI.checkedAdd(state.currentHpMilli, -clampHp);
    const discardedDamage = ABI.checkedAdd(damageMilli, -appliedDamage);
    const warningDelayTicks = positiveInteger(threshold.warningDelayTicks, "Talos warning delay");
    compileTalosThreshold(request, threshold, routeId);
    const hpRatioBp = threshold.thresholdHpBp;
    requireCatalogEventPhase(
      request.eventCatalog,
      oldPhase.exitEventId,
      "guarded-boss-threshold-transition"
    );
    requireCatalogEventPhase(
      request.eventCatalog,
      nextPhase.enterEventId,
      "guarded-boss-threshold-transition"
    );
    requireCatalogEventPhase(
      request.eventCatalog,
      "talos.threshold",
      "guarded-boss-threshold-transition"
    );
    const immediateEvents = [
      semanticEvent(request.eventCatalog, oldPhase.exitEventId, {
        bossRuntimeId: bossRuntimeId,
        hpRatioBp: hpRatioBp,
        phaseId: stableId(oldPhase.id, "Talos old phase ID"),
      }),
      semanticEvent(request.eventCatalog, nextPhase.enterEventId, {
        bossRuntimeId: bossRuntimeId,
        hpRatioBp: hpRatioBp,
        phaseId: stableId(nextPhase.id, "Talos next phase ID"),
      }),
      semanticEvent(request.eventCatalog, "talos.threshold", {
        bossRuntimeId: bossRuntimeId,
        thresholdHpBp: threshold.thresholdHpBp,
        thresholdId: stableId(threshold.id, "Talos threshold ID"),
        warningDelayTicks: warningDelayTicks,
      }),
    ];
    return finalizeResult({
      appliedDamageMilli: appliedDamage,
      childSpawnPlans: [],
      discardedDamageMilli: discardedDamage,
      events: immediateEvents,
      exposure: null,
      resistanceOverridePlans: [],
      scheduledReleasePlans: [{
        bossRuntimeId: bossRuntimeId,
        lineageId: lineageId,
        releaseAfterTicks: warningDelayTicks,
        routeDistance: routeDistance,
        routeId: routeId,
        thresholdId: threshold.id,
        thresholdOrder: threshold.order,
      }],
      state: {
        currentHpMilli: clampHp,
        currentPhaseOrder: nextPhaseOrder,
        maximumHpMilli: state.maximumHpMilli,
        nextThresholdOrder: ABI.checkedAdd(state.nextThresholdOrder, 1),
      },
      statusDeliveries: [],
    }, request.eventCatalog, request.limits);
  }

  function dispatchBehavior(dispatchId, input) {
    requireDispatchId(dispatchId);
    const request = requireRequest(input);
    if (dispatchId === DISPATCH_IDS.DIRECT) return resolveDirect(request);
    if (dispatchId === DISPATCH_IDS.SLOW) return resolveSlow(request);
    if (dispatchId === DISPATCH_IDS.SPLASH) return resolveSplash(request);
    if (dispatchId === DISPATCH_IDS.GUARD_SLOTS) return resolveGuardSlots(request);
    if (dispatchId === DISPATCH_IDS.BLOCK) return resolveBlock(request);
    if (dispatchId === DISPATCH_IDS.REVEAL) return resolveReveal(request);
    if (dispatchId === DISPATCH_IDS.MARK) return resolveMark(request);
    if (dispatchId === DISPATCH_IDS.CLOAK) return resolveCloak(request);
    if (dispatchId === DISPATCH_IDS.TALOS) return resolveTalos(request);
    throw new RangeError("Unknown behavior dispatch ID: " + dispatchId);
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    BEHAVIOR_REGISTRY_VERSION: ABI.BEHAVIOR_REGISTRY_VERSION,
    DISPATCH_IDS: DISPATCH_IDS,
    EVENT_SCHEMA_VERSION: ABI.EVENT_SCHEMA_VERSION,
    createBehaviorState: createBehaviorState,
    dispatchBehavior: dispatchBehavior,
    resolveGuardContactBatch: resolveGuardContactBatch,
    resolveMovementReduction: Effects.resolveMovementReduction,
    bindEventCatalogSchema: bindEventCatalogSchema,
    validateSemanticEvent: validateSemanticEvent,
    validateSemanticEvents: validateSemanticEvents,
  });
});

  /* source commands.js bytes=11572 sha256=bb0626b79c4ac0652d91402915422e1c7a8e40c014916bd0e3477db6289bc656 */
/* Armara Aegis deterministic structured command records v1.
   This module validates replay input shape and ordering only. Gameplay legality belongs to the reducer. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before commands.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisCommands")) {
    if (game.AegisCommands !== api) throw new Error("Game.AegisCommands is already installed");
    return;
  }
  Object.defineProperty(game, "AegisCommands", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (ABI) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  ["assertSafeInteger"].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });

  const descriptor = ABI.DESCRIPTOR;
  if (
    !descriptor.commands ||
    descriptor.commands.schemaVersion !== 1 ||
    descriptor.commands.recordFields.join("\0") !== ["tick", "seq", "type"].join("\0") ||
    descriptor.commands.sequence !== "zero-based-strictly-increasing-within-tick" ||
    !descriptor.tutorialUpgradeGate ||
    descriptor.tutorialUpgradeGate.skipCommand !== "skipTutorialGate"
  ) {
    throw new Error("Aegis command records do not match the deterministic ABI");
  }

  const COMMAND_SCHEMA_VERSION = 1;
  const COMMAND_TYPES = Object.freeze([
    "build", "upgrade", "sell", "startWave", "skipTutorialGate", "setTargetPolicy",
  ]);
  const TARGET_POLICIES = Object.freeze(["FRONT", "STRONG", "FAST"]);
  const COMMAND_FIELDS = Object.freeze({
    build: Object.freeze(["tick", "seq", "type", "padId", "defenseId"]),
    upgrade: Object.freeze(["tick", "seq", "type", "towerId"]),
    sell: Object.freeze(["tick", "seq", "type", "towerId"]),
    startWave: Object.freeze(["tick", "seq", "type"]),
    skipTutorialGate: Object.freeze(["tick", "seq", "type"]),
    setTargetPolicy: Object.freeze(["tick", "seq", "type", "towerId", "policy"]),
  });
  const LIMIT_FIELDS = Object.freeze(["maxCommandsPerTick", "maxTick", "maxTotalCommands"]);
  const MAX_COMMAND_FIELDS = 5;
  const MAX_LIMIT_FIELDS = LIMIT_FIELDS.length;
  const DEFAULT_LIMITS = Object.freeze({
    maxCommandsPerTick: 64,
    maxTick: 24 * 60 * 60 * descriptor.ticksPerSecond,
    maxTotalCommands: 100000,
  });
  const LOWERCASE_AUTHORED_ID = /^[a-z][a-z0-9._:-]*$/;

  function plainDataObject(value, label, maximumFields) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(label + " must be a plain object");
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length > maximumFields) {
      throw new TypeError(label + " has unsupported shape and must contain exactly an approved field set");
    }
    const descriptors = Object.create(null);
    for (let index = 0; index < names.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, names[index]);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
      descriptors[names[index]] = descriptor;
    }
    return { descriptors: descriptors, names: names };
  }

  function exactFields(fields, expected, label) {
    const actual = fields.names.slice().sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function fieldValue(fields, key) {
    return Object.prototype.hasOwnProperty.call(fields.descriptors, key)
      ? fields.descriptors[key].value
      : undefined;
  }

  function commandArrayValues(value, maximum) {
    if (!Array.isArray(value)) throw new TypeError("Command sequence must be an array");
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError("Command sequence must be a plain array");
    }
    if (value.length > maximum) {
      throw new RangeError("Command sequence exceeds the total command limit");
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("Command sequence cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length > value.length + 1) {
      throw new TypeError("Command sequence cannot contain extra properties");
    }
    const output = new Array(value.length);
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor) throw new TypeError("Command sequence must be a dense array");
      if (!descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError("Command sequence must contain only enumerable data elements");
      }
      output[index] = descriptor.value;
    }
    for (let index = 0; index < names.length; index++) {
      const key = names[index];
      if (key === "length") continue;
      if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        throw new TypeError("Command sequence cannot contain extra properties");
      }
    }
    return output;
  }

  function nonnegativeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return Object.is(value, -0) ? 0 : value;
  }

  function positiveInteger(value, label) {
    value = nonnegativeInteger(value, label);
    if (value === 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function lowercaseAuthoredId(value, label) {
    if (typeof value !== "string" || !LOWERCASE_AUTHORED_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase authored ID");
    }
    return value;
  }

  function baseFields(input) {
    return {
      tick: nonnegativeInteger(input.tick, "Command tick"),
      seq: nonnegativeInteger(input.seq, "Command sequence"),
      type: input.type,
    };
  }

  function normalizeCommand(input) {
    const fields = plainDataObject(input, "Command", MAX_COMMAND_FIELDS);
    const type = fieldValue(fields, "type");
    if (typeof type !== "string" ||
        !Object.prototype.hasOwnProperty.call(COMMAND_FIELDS, type)) {
      throw new TypeError("Unsupported command type");
    }
    exactFields(fields, COMMAND_FIELDS[type], type + " command");
    const values = Object.create(null);
    fields.names.forEach(function (key) { values[key] = fieldValue(fields, key); });
    const base = baseFields(values);

    if (type === "build") {
      return Object.freeze({
        tick: base.tick,
        seq: base.seq,
        type: base.type,
        padId: lowercaseAuthoredId(values.padId, "Build pad ID"),
        defenseId: lowercaseAuthoredId(values.defenseId, "Build defense ID"),
      });
    }
    if (type === "upgrade" || type === "sell") {
      return Object.freeze({
        tick: base.tick,
        seq: base.seq,
        type: base.type,
        towerId: positiveInteger(values.towerId, "Command tower ID"),
      });
    }
    if (type === "setTargetPolicy") {
      if (typeof values.policy !== "string" || TARGET_POLICIES.indexOf(values.policy) === -1) {
        throw new TypeError("Unsupported target policy");
      }
      return Object.freeze({
        tick: base.tick,
        seq: base.seq,
        type: base.type,
        towerId: positiveInteger(values.towerId, "Command tower ID"),
        policy: values.policy,
      });
    }
    return Object.freeze({ tick: base.tick, seq: base.seq, type: base.type });
  }

  function createCommandLimits(overrides) {
    if (overrides === undefined) return DEFAULT_LIMITS;
    const fields = plainDataObject(overrides, "Command limit overrides", MAX_LIMIT_FIELDS);
    fields.names.forEach(function (key) {
      if (LIMIT_FIELDS.indexOf(key) === -1) throw new TypeError("Unknown command limit " + key);
    });

    const values = {};
    LIMIT_FIELDS.forEach(function (key) {
      const value = Object.prototype.hasOwnProperty.call(fields.descriptors, key)
        ? nonnegativeInteger(fieldValue(fields, key), "Command limit " + key)
        : DEFAULT_LIMITS[key];
      if (value > DEFAULT_LIMITS[key]) {
        throw new RangeError("Command limit " + key + " cannot relax the frozen default");
      }
      values[key] = value;
    });
    return Object.freeze({
      maxCommandsPerTick: values.maxCommandsPerTick,
      maxTick: values.maxTick,
      maxTotalCommands: values.maxTotalCommands,
    });
  }

  function normalizeCommandSequence(inputs, limitOverrides) {
    const limits = createCommandLimits(limitOverrides);
    const source = commandArrayValues(inputs, limits.maxTotalCommands);
    const identities = new WeakSet();
    source.forEach(function (input) {
      if (input && typeof input === "object") {
        if (identities.has(input)) {
          throw new TypeError("Command sequence cannot contain a shared reference to a command object");
        }
        identities.add(input);
      }
    });

    const normalized = [];
    let previousTick = -1;
    let previousSeq = -1;
    let commandsThisTick = 0;
    source.forEach(function (input, index) {
      const command = normalizeCommand(input);
      if (command.tick > limits.maxTick) {
        throw new RangeError("Command " + index + " exceeds the maximum tick");
      }
      if (index > 0 && command.tick < previousTick) {
        throw new RangeError("Command ticks must be nondecreasing in authored order");
      }
      if (index === 0 || command.tick !== previousTick) {
        if (command.seq !== 0) {
          throw new RangeError("The first command sequence at each tick must be zero");
        }
        commandsThisTick = 1;
      } else {
        if (previousSeq === Number.MAX_SAFE_INTEGER || command.seq !== previousSeq + 1) {
          throw new RangeError("A command sequence must be exactly one greater than the previous sequence");
        }
        commandsThisTick += 1;
      }
      if (commandsThisTick > limits.maxCommandsPerTick) {
        throw new RangeError("Command sequence exceeds the commands per tick limit");
      }
      normalized.push(command);
      previousTick = command.tick;
      previousSeq = command.seq;
    });
    return Object.freeze(normalized);
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    COMMAND_SCHEMA_VERSION: COMMAND_SCHEMA_VERSION,
    COMMAND_TYPES: COMMAND_TYPES,
    TARGET_POLICIES: TARGET_POLICIES,
    DEFAULT_LIMITS: DEFAULT_LIMITS,
    createCommandLimits: createCommandLimits,
    normalizeCommand: normalizeCommand,
    normalizeCommandSequence: normalizeCommandSequence,
  });
});

  /* source abi-v2.js bytes=8608 sha256=a79a3635c43c51199273c19fb4238b7ff764e27b49295bd17c1901524e5c528b */
/* Armara Aegis deterministic simulation ABI v2 identity.
   Additive authenticated contract over the immutable v1 exact-math foundation. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before abi-v2.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisSimV2")) {
    if (game.AegisSimV2 !== api) throw new Error("Game.AegisSimV2 is already installed");
    return;
  }
  Object.defineProperty(game, "AegisSimV2", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (ABI_V1) {
  "use strict";

  const BASE_ABI_DESCRIPTOR_SHA256 =
    "4a788f71581d4b1c4e79318d72ae45ffa1c6b79281c3ae32e6c29f22a8b2256b";
  if (!ABI_V1 || !Object.isFrozen(ABI_V1) || !Object.isFrozen(ABI_V1.DESCRIPTOR) ||
      ABI_V1.DESCRIPTOR.version !== 1 ||
      ABI_V1.DESCRIPTOR_SHA256 !== BASE_ABI_DESCRIPTOR_SHA256) {
    throw new TypeError("The authenticated frozen Aegis simulation ABI v1 is required");
  }
  ["canonicalEncode", "canonicalBytes", "sha256Hex", "utf8Bytes"].forEach(function (name) {
    if (typeof ABI_V1[name] !== "function") throw new TypeError("Aegis ABI v1 is missing " + name);
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  const COMMAND_FAMILIES = [
    { type: "build", fields: ["tick", "seq", "type", "padId", "defenseId"] },
    { type: "upgrade", fields: ["tick", "seq", "type", "towerId"] },
    { type: "sell", fields: ["tick", "seq", "type", "towerId"] },
    { type: "startWave", fields: ["tick", "seq", "type"] },
    { type: "skipTutorialGate", fields: ["tick", "seq", "type"] },
    { type: "setTargetPolicy", fields: ["tick", "seq", "type", "towerId", "policy"] },
    {
      type: "specializeTower",
      fields: ["tick", "seq", "type", "towerRuntimeId", "specializationId"],
    },
    { type: "activatePower", fields: ["tick", "seq", "type", "protocolId", "tier", "target"] },
    {
      type: "deployReinforcement",
      fields: ["tick", "seq", "type", "reinforcementId", "markerId"],
    },
    {
      type: "activateMechanism",
      fields: ["tick", "seq", "type", "mechanismId", "activationId"],
    },
    { type: "resetPlan", fields: ["tick", "seq", "type"] },
  ];
  const TARGET_UNION = [
    { kind: "none", fields: ["kind"] },
    { kind: "route-point", fields: ["kind", "routeId", "routeDistance"] },
    { kind: "tower", fields: ["kind", "towerRuntimeId"] },
    { kind: "world-vector", fields: ["kind", "originX", "originY", "aimX", "aimY"] },
  ];
  const DESCRIPTOR = deepFreeze({
    id: "armara-aegis-sim-abi",
    version: 2,
    canonicalVersion: ABI_V1.DESCRIPTOR.canonicalVersion,
    baseAbiDescriptorSha256: BASE_ABI_DESCRIPTOR_SHA256,
    exactMath: {
      sourceAbiDescriptorSha256: BASE_ABI_DESCRIPTOR_SHA256,
      reexportPolicy: "same-frozen-function-identities",
    },
    authoredData: {
      stableIdMaxLength: 128,
      numbers: "safe-integers-only-without-negative-zero",
      objectGraph: "plain-dense-tree-only-no-accessors-symbols-cycles-or-shared-references",
    },
    commands: {
      schemaVersion: 2,
      recordFields: ["tick", "seq", "type"],
      sequence: "zero-based-strictly-increasing-within-tick",
      application: "beginning-of-tick-in-sequence-order",
      authoredIdMaxLength: 128,
      families: COMMAND_FAMILIES,
      targetUnion: TARGET_UNION,
    },
    semanticEvents: {
      id: "armara-aegis-semantic-events",
      schemaVersion: 2,
    },
    behaviorRegistry: {
      id: "armara-aegis-behavior-registry",
      version: 2,
    },
    replay: {
      formatVersion: 2,
      declaredFormatDispatch: "never-inferred-from-optional-fields",
    },
    phaseOrder: [
      "commands-and-aether-payments",
      "expiry-and-enable-transitions",
      "scheduled-protocol-mechanism-resolutions-and-spawns",
      "spawn-movement-control-and-contact",
      "tower-and-reinforcement-acquisition-and-attacks",
      "persistent-zone-pulses-and-terminal-damage",
      "leak-arbitration-and-ward",
      "bounty-income-objectives-and-score-facts",
      "cooldown-and-effect-decrement",
      "guarded-boss-wave-mission-transition-and-event-finalization",
    ],
  });
  const DESCRIPTOR_CANONICAL = ABI_V1.canonicalEncode(DESCRIPTOR);
  const DESCRIPTOR_SHA256 = ABI_V1.sha256Hex(DESCRIPTOR_CANONICAL);

  function descriptorCanonicalBytes() {
    return ABI_V1.utf8Bytes(DESCRIPTOR_CANONICAL);
  }

  /* The ABI-v2 behavior contract registry. It retains every reviewed v1 contract unchanged and
     adds the version-2 contracts the Level-3 specialization records require. Contracts are not
     part of the pinned descriptor, so this table does not change DESCRIPTOR_SHA256; compiled v4
     content declares a byte-equal copy that the kernel authenticates against this authority. */
  const BEHAVIOR_CONTRACTS = Object.freeze([
    Object.freeze({ id: "armorBreak", version: 1 }),
    Object.freeze({ id: "armorBreak", version: 2 }),
    Object.freeze({ id: "aura", version: 1 }),
    Object.freeze({ id: "aura", version: 2 }),
    Object.freeze({ id: "beam", version: 2 }),
    Object.freeze({ id: "block", version: 1 }),
    Object.freeze({ id: "block", version: 2 }),
    Object.freeze({ id: "bossScript", version: 1 }),
    Object.freeze({ id: "chain", version: 1 }),
    Object.freeze({ id: "chain", version: 2 }),
    Object.freeze({ id: "control", version: 2 }),
    Object.freeze({ id: "direct", version: 1 }),
    Object.freeze({ id: "direct", version: 2 }),
    Object.freeze({ id: "dot", version: 1 }),
    Object.freeze({ id: "drone", version: 2 }),
    Object.freeze({ id: "execute", version: 1 }),
    Object.freeze({ id: "execute", version: 2 }),
    Object.freeze({ id: "link", version: 2 }),
    Object.freeze({ id: "mine", version: 2 }),
    Object.freeze({ id: "slow", version: 1 }),
    Object.freeze({ id: "slow", version: 2 }),
    Object.freeze({ id: "spawnUnit", version: 1 }),
    Object.freeze({ id: "spawnUnit", version: 2 }),
    Object.freeze({ id: "splash", version: 1 }),
    Object.freeze({ id: "splash", version: 2 }),
  ]);

  return Object.freeze({
    BEHAVIOR_CONTRACTS: BEHAVIOR_CONTRACTS,
    DESCRIPTOR: DESCRIPTOR,
    DESCRIPTOR_CANONICAL: DESCRIPTOR_CANONICAL,
    DESCRIPTOR_SHA256: DESCRIPTOR_SHA256,
    BASE_ABI_DESCRIPTOR_SHA256: BASE_ABI_DESCRIPTOR_SHA256,
    COMMAND_SCHEMA_VERSION: 2,
    EVENT_SCHEMA_VERSION: 2,
    BEHAVIOR_REGISTRY_VERSION: 2,
    AUTHORED_ID_MAX_LENGTH: 128,
    TICKS_PER_SECOND: ABI_V1.TICKS_PER_SECOND,
    TIME_UNITS_PER_SECOND: ABI_V1.TIME_UNITS_PER_SECOND,
    TIME_UNITS_PER_TICK: ABI_V1.TIME_UNITS_PER_TICK,
    DISTANCE_SCALE: ABI_V1.DISTANCE_SCALE,
    DAMAGE_SCALE: ABI_V1.DAMAGE_SCALE,
    BASIS_POINTS: ABI_V1.BASIS_POINTS,
    MAX_AUTHORED_DECIMAL_PLACES: ABI_V1.MAX_AUTHORED_DECIMAL_PLACES,
    assertSafeInteger: ABI_V1.assertSafeInteger,
    checkedAdd: ABI_V1.checkedAdd,
    checkedMultiply: ABI_V1.checkedMultiply,
    floorDivNonnegative: ABI_V1.floorDivNonnegative,
    ceilDivNonnegative: ABI_V1.ceilDivNonnegative,
    truncDivSigned: ABI_V1.truncDivSigned,
    checkedMulDivFloor: ABI_V1.checkedMulDivFloor,
    checkedMulDivCeil: ABI_V1.checkedMulDivCeil,
    parseExactDecimal: ABI_V1.parseExactDecimal,
    authoredMillisecondsToTimeUnits: ABI_V1.authoredMillisecondsToTimeUnits,
    effectiveCooldownUnits: ABI_V1.effectiveCooldownUnits,
    effectiveRangeUnits: ABI_V1.effectiveRangeUnits,
    resolveStrongestSlowBp: ABI_V1.resolveStrongestSlowBp,
    preShieldDamageMilli: ABI_V1.preShieldDamageMilli,
    shieldBoundDamageMilli: ABI_V1.shieldBoundDamageMilli,
    resolveHpDamageMilli: ABI_V1.resolveHpDamageMilli,
    refundSeventyPercent: ABI_V1.refundSeventyPercent,
    utf8Bytes: ABI_V1.utf8Bytes,
    canonicalEncode: ABI_V1.canonicalEncode,
    canonicalBytes: ABI_V1.canonicalBytes,
    descriptorCanonicalBytes: descriptorCanonicalBytes,
    fnv1a32: ABI_V1.fnv1a32,
    fnv1a32Hex: ABI_V1.fnv1a32Hex,
    sha256Bytes: ABI_V1.sha256Bytes,
    sha256Hex: ABI_V1.sha256Hex,
    deriveNamedSeed: ABI_V1.deriveNamedSeed,
    mulberry32Step: ABI_V1.mulberry32Step,
    mulberry32: ABI_V1.mulberry32,
  });
});

  /* source commands-v2.js bytes=16302 sha256=b9d22487206345a611d283169c41142dfad7bba904186bfc33f2ec6b329b7cd8 */
/* Armara Aegis deterministic structured command records v2.
   Additive syntax validation only; command legality remains reducer-owned. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSimV2) throw new Error("Game.AegisSimV2 must be installed before commands-v2.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before commands-v2.js");
  const api = factory(game.AegisSimV2, game.AegisCommands);
  if (Object.prototype.hasOwnProperty.call(game, "AegisCommandsV2")) {
    if (game.AegisCommandsV2 !== api) throw new Error("Game.AegisCommandsV2 is already installed");
    return;
  }
  Object.defineProperty(game, "AegisCommandsV2", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (ABI, CommandsV1) {
  "use strict";

  const AUTHENTICATED_ABI_V2_SHA256 =
    "5f02c369c5331f65196090e00cdf09a7aa4458376f35057c0b5750202a0ea76b";
  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR) ||
      ABI.DESCRIPTOR.version !== 2 || ABI.COMMAND_SCHEMA_VERSION !== 2 ||
      ABI.DESCRIPTOR_SHA256 !== AUTHENTICATED_ABI_V2_SHA256 ||
      ABI.DESCRIPTOR_SHA256 !== ABI.sha256Hex(ABI.DESCRIPTOR_CANONICAL)) {
    throw new TypeError("The authenticated frozen Aegis simulation ABI v2 is required");
  }
  if (!CommandsV1 || !Object.isFrozen(CommandsV1) ||
      CommandsV1.ABI_DESCRIPTOR_SHA256 !== ABI.BASE_ABI_DESCRIPTOR_SHA256 ||
      CommandsV1.COMMAND_SCHEMA_VERSION !== 1) {
    throw new TypeError("A matching frozen Aegis command-v1 API is required");
  }
  ["assertSafeInteger"].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  ["createCommandLimits", "normalizeCommand"].forEach(function (name) {
    if (typeof CommandsV1[name] !== "function") {
      throw new TypeError("Aegis command-v1 API is missing " + name);
    }
  });

  const COMMAND_SCHEMA_VERSION = 2;
  const ADDED_COMMAND_TYPES = Object.freeze([
    "specializeTower", "activatePower", "deployReinforcement", "activateMechanism", "resetPlan",
  ]);
  const COMMAND_TYPES = Object.freeze(CommandsV1.COMMAND_TYPES.concat(ADDED_COMMAND_TYPES));
  const TARGET_KINDS = Object.freeze(["none", "route-point", "tower", "world-vector"]);
  const TARGET_FIELDS = Object.freeze({
    none: Object.freeze(["kind"]),
    "route-point": Object.freeze(["kind", "routeId", "routeDistance"]),
    tower: Object.freeze(["kind", "towerRuntimeId"]),
    "world-vector": Object.freeze(["kind", "originX", "originY", "aimX", "aimY"]),
  });
  const ADDED_COMMAND_FIELDS = Object.freeze({
    specializeTower: Object.freeze([
      "tick", "seq", "type", "towerRuntimeId", "specializationId",
    ]),
    activatePower: Object.freeze([
      "tick", "seq", "type", "protocolId", "tier", "target",
    ]),
    deployReinforcement: Object.freeze([
      "tick", "seq", "type", "reinforcementId", "markerId",
    ]),
    activateMechanism: Object.freeze([
      "tick", "seq", "type", "mechanismId", "activationId",
    ]),
    resetPlan: Object.freeze(["tick", "seq", "type"]),
  });
  const LOWERCASE_AUTHORED_ID = /^[a-z][a-z0-9._:-]*$/;
  const MAX_AUTHORED_ID_LENGTH = ABI.AUTHORED_ID_MAX_LENGTH;
  const MAX_COMMAND_FIELDS = 6;
  const MAX_TARGET_FIELDS = 5;

  (function validateV2CommandDescriptor() {
    const descriptor = ABI.DESCRIPTOR.commands;
    if (!descriptor || descriptor.schemaVersion !== COMMAND_SCHEMA_VERSION ||
        descriptor.authoredIdMaxLength !== MAX_AUTHORED_ID_LENGTH ||
        descriptor.families.length !== COMMAND_TYPES.length ||
        descriptor.targetUnion.length !== TARGET_KINDS.length) {
      throw new Error("Aegis command-v2 records do not match the authenticated ABI v2");
    }
    descriptor.families.forEach(function (family, index) {
      const type = COMMAND_TYPES[index];
      const expected = CommandsV1.COMMAND_TYPES.indexOf(type) === -1
        ? ADDED_COMMAND_FIELDS[type]
        : family.fields;
      if (family.type !== type || expected.length !== family.fields.length ||
          expected.some(function (field, fieldIndex) { return field !== family.fields[fieldIndex]; })) {
        throw new Error("Aegis command-v2 family records do not match the authenticated ABI v2");
      }
    });
    descriptor.targetUnion.forEach(function (target, index) {
      const kind = TARGET_KINDS[index];
      const expected = TARGET_FIELDS[kind];
      if (target.kind !== kind || target.fields.length !== expected.length ||
          expected.some(function (field, fieldIndex) { return field !== target.fields[fieldIndex]; })) {
        throw new Error("Aegis command-v2 targets do not match the authenticated ABI v2");
      }
    });
  })();

  function plainDataObject(value, label, maximumFields) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(label + " must be a plain object");
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length > maximumFields) {
      throw new TypeError(label + " has unsupported shape and must contain exactly an approved field set");
    }
    const descriptors = Object.create(null);
    names.forEach(function (name) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
      descriptors[name] = descriptor;
    });
    return { descriptors: descriptors, names: names };
  }

  function exactFields(fields, expected, label) {
    const actual = fields.names.slice().sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function fieldValue(fields, key) {
    return Object.prototype.hasOwnProperty.call(fields.descriptors, key)
      ? fields.descriptors[key].value
      : undefined;
  }

  function commandArrayValues(value, maximum) {
    if (!Array.isArray(value)) throw new TypeError("Command sequence must be an array");
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError("Command sequence must be a plain array");
    }
    if (value.length > maximum) throw new RangeError("Command sequence exceeds the total command limit");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("Command sequence cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length > value.length + 1) {
      throw new TypeError("Command sequence cannot contain extra properties");
    }
    const output = new Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor) throw new TypeError("Command sequence must be a dense array");
      if (!descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError("Command sequence must contain only enumerable data elements");
      }
      output[index] = descriptor.value;
    }
    names.forEach(function (key) {
      if (key === "length") return;
      if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        throw new TypeError("Command sequence cannot contain extra properties");
      }
    });
    return output;
  }

  function safeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    return Object.is(value, -0) ? 0 : value;
  }

  function nonnegativeInteger(value, label) {
    value = safeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return value;
  }

  function positiveInteger(value, label) {
    value = nonnegativeInteger(value, label);
    if (value === 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function protocolTier(value) {
    value = positiveInteger(value, "Protocol tier");
    if (value > 3) throw new RangeError("Protocol tier must be between 1 and 3");
    return value;
  }

  function lowercaseAuthoredId(value, label) {
    if (typeof value !== "string" || value.length > MAX_AUTHORED_ID_LENGTH ||
        !LOWERCASE_AUTHORED_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase authored ID");
    }
    return value;
  }

  function normalizeTarget(input) {
    const fields = plainDataObject(input, "Protocol target", MAX_TARGET_FIELDS);
    const kind = fieldValue(fields, "kind");
    if (typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(TARGET_FIELDS, kind)) {
      throw new TypeError("Unsupported Protocol target kind");
    }
    exactFields(fields, TARGET_FIELDS[kind], kind + " Protocol target");
    if (kind === "none") return Object.freeze({ kind: kind });
    if (kind === "route-point") {
      return Object.freeze({
        kind: kind,
        routeId: lowercaseAuthoredId(fieldValue(fields, "routeId"), "Protocol target route ID"),
        routeDistance: nonnegativeInteger(
          fieldValue(fields, "routeDistance"),
          "Protocol target route distance"
        ),
      });
    }
    if (kind === "tower") {
      return Object.freeze({
        kind: kind,
        towerRuntimeId: positiveInteger(
          fieldValue(fields, "towerRuntimeId"),
          "Protocol target tower runtime ID"
        ),
      });
    }
    return Object.freeze({
      kind: kind,
      originX: safeInteger(fieldValue(fields, "originX"), "Protocol target origin X"),
      originY: safeInteger(fieldValue(fields, "originY"), "Protocol target origin Y"),
      aimX: safeInteger(fieldValue(fields, "aimX"), "Protocol target aim X"),
      aimY: safeInteger(fieldValue(fields, "aimY"), "Protocol target aim Y"),
    });
  }

  function normalizeAddedCommand(fields, type) {
    exactFields(fields, ADDED_COMMAND_FIELDS[type], type + " command");
    const tick = nonnegativeInteger(fieldValue(fields, "tick"), "Command tick");
    const seq = nonnegativeInteger(fieldValue(fields, "seq"), "Command sequence");
    if (type === "specializeTower") {
      return Object.freeze({
        tick: tick,
        seq: seq,
        type: type,
        towerRuntimeId: positiveInteger(
          fieldValue(fields, "towerRuntimeId"),
          "Specialization tower runtime ID"
        ),
        specializationId: lowercaseAuthoredId(
          fieldValue(fields, "specializationId"),
          "Specialization ID"
        ),
      });
    }
    if (type === "activatePower") {
      return Object.freeze({
        tick: tick,
        seq: seq,
        type: type,
        protocolId: lowercaseAuthoredId(fieldValue(fields, "protocolId"), "Protocol ID"),
        tier: protocolTier(fieldValue(fields, "tier")),
        target: normalizeTarget(fieldValue(fields, "target")),
      });
    }
    if (type === "deployReinforcement") {
      return Object.freeze({
        tick: tick,
        seq: seq,
        type: type,
        reinforcementId: lowercaseAuthoredId(
          fieldValue(fields, "reinforcementId"),
          "Reinforcement ID"
        ),
        markerId: lowercaseAuthoredId(fieldValue(fields, "markerId"), "Reinforcement marker ID"),
      });
    }
    if (type === "activateMechanism") {
      return Object.freeze({
        tick: tick,
        seq: seq,
        type: type,
        mechanismId: lowercaseAuthoredId(fieldValue(fields, "mechanismId"), "Mechanism ID"),
        activationId: lowercaseAuthoredId(fieldValue(fields, "activationId"), "Mechanism activation ID"),
      });
    }
    return Object.freeze({ tick: tick, seq: seq, type: type });
  }

  function assertRetainedCommandStringLimits(command) {
    Object.getOwnPropertyNames(command).forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(command, key);
      if (descriptor && typeof descriptor.value === "string" &&
          descriptor.value.length > MAX_AUTHORED_ID_LENGTH) {
        throw new TypeError(
          "Command " + key + " exceeds the " + MAX_AUTHORED_ID_LENGTH + "-code-unit authored ID ceiling"
        );
      }
    });
    return command;
  }

  function normalizeCommand(input) {
    const fields = plainDataObject(input, "Command", MAX_COMMAND_FIELDS);
    const type = fieldValue(fields, "type");
    if (typeof type !== "string" || COMMAND_TYPES.indexOf(type) === -1) {
      throw new TypeError("Unsupported command type");
    }
    if (CommandsV1.COMMAND_TYPES.indexOf(type) !== -1) {
      return assertRetainedCommandStringLimits(CommandsV1.normalizeCommand(input));
    }
    return normalizeAddedCommand(fields, type);
  }

  function createCommandLimits(overrides) {
    return CommandsV1.createCommandLimits(overrides);
  }

  function normalizeCommandSequence(inputs, limitOverrides) {
    const limits = createCommandLimits(limitOverrides);
    const source = commandArrayValues(inputs, limits.maxTotalCommands);
    const identities = new WeakSet();
    const nestedTargetIdentities = new WeakSet();
    source.forEach(function (input) {
      if (input && typeof input === "object") {
        if (identities.has(input)) {
          throw new TypeError("Command sequence cannot contain a shared reference to a command object");
        }
        identities.add(input);
        const fields = plainDataObject(input, "Command", MAX_COMMAND_FIELDS);
        if (fieldValue(fields, "type") === "activatePower") {
          const target = fieldValue(fields, "target");
          if (target && typeof target === "object") {
            if (nestedTargetIdentities.has(target)) {
              throw new TypeError("Command sequence cannot contain a shared Protocol target reference");
            }
            nestedTargetIdentities.add(target);
          }
        }
      }
    });

    const normalized = [];
    let previousTick = -1;
    let previousSeq = -1;
    let commandsThisTick = 0;
    source.forEach(function (input, index) {
      const command = normalizeCommand(input);
      if (command.tick > limits.maxTick) {
        throw new RangeError("Command " + index + " exceeds the maximum tick");
      }
      if (index > 0 && command.tick < previousTick) {
        throw new RangeError("Command ticks must be nondecreasing in authored order");
      }
      if (index === 0 || command.tick !== previousTick) {
        if (command.seq !== 0) {
          throw new RangeError("The first command sequence at each tick must be zero");
        }
        commandsThisTick = 1;
      } else {
        if (previousSeq === Number.MAX_SAFE_INTEGER || command.seq !== previousSeq + 1) {
          throw new RangeError("A command sequence must be exactly one greater than the previous sequence");
        }
        commandsThisTick += 1;
      }
      if (commandsThisTick > limits.maxCommandsPerTick) {
        throw new RangeError("Command sequence exceeds the commands per tick limit");
      }
      normalized.push(command);
      previousTick = command.tick;
      previousSeq = command.seq;
    });
    return Object.freeze(normalized);
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    COMMAND_SCHEMA_VERSION: COMMAND_SCHEMA_VERSION,
    COMMAND_TYPES: COMMAND_TYPES,
    TARGET_KINDS: TARGET_KINDS,
    TARGET_POLICIES: CommandsV1.TARGET_POLICIES,
    DEFAULT_LIMITS: CommandsV1.DEFAULT_LIMITS,
    createCommandLimits: createCommandLimits,
    normalizeTarget: normalizeTarget,
    normalizeCommand: normalizeCommand,
    normalizeCommandSequence: normalizeCommandSequence,
  });
});

  /* source protocols.js bytes=45054 sha256=60c324db1a642a3a5e38e56d083a887d9e5f24d03b7f371a6289d48d06885d3f */
/* Armara Aegis pure Divine Protocol legality and payment planning v1.
   This module validates immutable inputs and never mutates simulation state. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSimV2) throw new Error("Game.AegisSimV2 must be installed before protocols.js");
  if (!game.AegisCommandsV2) throw new Error("Game.AegisCommandsV2 must be installed before protocols.js");
  const api = factory(game.AegisSimV2, game.AegisCommandsV2);
  if (Object.prototype.hasOwnProperty.call(game, "AegisProtocols")) {
    if (game.AegisProtocols !== api) throw new Error("Game.AegisProtocols is already installed");
    return;
  }
  Object.defineProperty(game, "AegisProtocols", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (ABI, CommandsV2) {
  "use strict";

  const AUTHENTICATED_ABI_V2_SHA256 =
    "5f02c369c5331f65196090e00cdf09a7aa4458376f35057c0b5750202a0ea76b";
  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR) ||
      ABI.DESCRIPTOR.version !== 2 || ABI.DESCRIPTOR_SHA256 !== AUTHENTICATED_ABI_V2_SHA256 ||
      ABI.EVENT_SCHEMA_VERSION !== 2 || ABI.BEHAVIOR_REGISTRY_VERSION !== 2) {
    throw new TypeError("The authenticated frozen Aegis simulation ABI v2 is required");
  }
  if (!CommandsV2 || !Object.isFrozen(CommandsV2) ||
      CommandsV2.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256 ||
      CommandsV2.COMMAND_SCHEMA_VERSION !== 2) {
    throw new TypeError("A matching frozen Aegis command-v2 API is required");
  }
  [
    "assertSafeInteger", "checkedAdd", "checkedMultiply", "checkedMulDivCeil",
  ].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  ["normalizeCommand"].forEach(function (name) {
    if (typeof CommandsV2[name] !== "function") {
      throw new TypeError("Aegis command-v2 API is missing " + name);
    }
  });
  if (ABI.BASIS_POINTS !== 10000 || ABI.TICKS_PER_SECOND !== 60) {
    throw new RangeError("Protocol planning requires the frozen Aegis integer basis and tick rate");
  }

  const PROTOCOL_LEGALITY_SCHEMA_VERSION = 1;
  const UNIVERSAL_SHARED_COOLDOWN_MS = 15000;
  const MAX_PROTOCOL_SLOTS = 2;
  const MIN_PROTOCOL_COST_MULTIPLIER_BP = 7000;
  const MAX_PROTOCOL_COST_MULTIPLIER_BP = 14000;
  const MAX_CATALOG_RECORDS = 64;
  const MAX_TOWERS = 4096;
  const MAX_ROUTES = 128;
  const LOWERCASE_AUTHORED_ID = /^[a-z][a-z0-9._:-]*$/;
  const MAX_AUTHORED_ID_LENGTH = ABI.AUTHORED_ID_MAX_LENGTH;
  const CAST_POLICY_IDS = Object.freeze(["once-per-mission", "repeat-surcharge"]);
  const PHASES = Object.freeze(["planning", "wave", "complete"]);
  const MAX_ACCEPTED_CAST_COUNT = CommandsV2.DEFAULT_LIMITS && CommandsV2.DEFAULT_LIMITS.maxTotalCommands;
  if (MAX_ACCEPTED_CAST_COUNT !== 100000) {
    throw new RangeError("Protocol planning requires the reviewed 100000 command-sequence ceiling");
  }
  const EFFECT_KINDS = Object.freeze([
    "aimed-petrify-cone", "bargain-mark", "global-ascension-field", "global-slow-field", "leak-ward",
    "route-front-rewind", "route-point-surge", "scheduled-global-damage",
    "tower-cluster-amplification", "tower-overclock",
  ]);
  const WARD_EFFECT_KINDS = Object.freeze(["leak-ward"]);
  const FUTURE_SPAWN_FIELD_KINDS = Object.freeze(["global-ascension-field", "global-slow-field"]);
  const NORMALIZED_CATALOGS = new WeakSet();
  const NORMALIZED_LOADOUTS = new WeakMap();
  const NORMALIZED_LEDGERS = new WeakMap();
  const DENIAL_REASONS = Object.freeze({
    UNKNOWN_PROTOCOL: "unknown-protocol",
    PROTOCOL_LOCKED: "protocol-locked",
    PROTOCOL_UNEQUIPPED: "protocol-unequipped",
    TIER_MISMATCH: "tier-mismatch",
    MISSION_LOAN_MISMATCH: "mission-loan-mismatch",
    WRONG_PHASE: "wrong-phase",
    WRONG_TARGET_KIND: "wrong-target-kind",
    SHARED_COOLDOWN: "shared-cooldown",
    PROTOCOL_COOLDOWN: "protocol-cooldown",
    ONCE_PER_MISSION: "once-per-mission",
    INSUFFICIENT_AETHER: "insufficient-aether",
    MISSING_ELIGIBLE_TARGET: "missing-eligible-target",
    UNKNOWN_ROUTE: "unknown-route",
    ROUTE_DISTANCE_OUT_OF_RANGE: "route-distance-out-of-range",
    STALE_TOWER: "stale-tower",
    OUT_OF_BOARD_VECTOR: "out-of-board-vector",
    ZERO_LENGTH_VECTOR: "zero-length-vector",
  });

  function plainDataObject(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(label + " must be a plain object");
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    const actual = names.slice().sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
    const fields = Object.create(null);
    names.forEach(function (name) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
      fields[name] = descriptor.value;
    });
    return fields;
  }

  function plainArrayValues(value, label, maximumLength) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(label + " must be a plain array");
    }
    if (value.length > maximumLength) throw new RangeError(label + " exceeds its maximum length");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length > value.length + 1) throw new TypeError(label + " cannot contain extra properties");
    const output = new Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor) throw new TypeError(label + " must be a dense array");
      if (!descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data elements");
      }
      output[index] = descriptor.value;
    }
    names.forEach(function (key) {
      if (key === "length") return;
      if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        throw new TypeError(label + " cannot contain extra properties");
      }
    });
    return output;
  }

  function rejectSharedObjectReferences(values, label) {
    const identities = new WeakSet();
    values.forEach(function (value) {
      if (!value || typeof value !== "object") return;
      if (identities.has(value)) throw new TypeError(label + " cannot contain shared object references");
      identities.add(value);
    });
  }

  function safeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    return Object.is(value, -0) ? 0 : value;
  }

  function nonnegativeInteger(value, label) {
    value = safeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return value;
  }

  function positiveInteger(value, label) {
    value = nonnegativeInteger(value, label);
    if (value === 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function tierNumber(value, label) {
    value = positiveInteger(value, label);
    if (value > 3) throw new RangeError(label + " must be between 1 and 3");
    return value;
  }

  function lowercaseAuthoredId(value, label) {
    if (typeof value !== "string" || value.length > MAX_AUTHORED_ID_LENGTH ||
        !LOWERCASE_AUTHORED_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase authored ID");
    }
    return value;
  }

  function assertStrictAsciiOrder(previous, current, label) {
    if (previous !== null && previous >= current) {
      throw new RangeError(label + " must use unique strict ASCII order");
    }
  }

  function cloneCanonicalData(input, label) {
    const seen = new WeakSet();
    let nodes = 0;
    function clone(value, path, depth) {
      if (value === null || typeof value === "boolean") return value;
      if (typeof value === "number") return safeInteger(value, path);
      if (typeof value === "string") {
        if (value.length > MAX_AUTHORED_ID_LENGTH) throw new RangeError(path + " exceeds the string limit");
        return value;
      }
      if (!value || typeof value !== "object") throw new TypeError(path + " is not canonical data");
      if (depth > 32) throw new RangeError(label + " exceeds the nesting-depth limit");
      if (seen.has(value)) throw new TypeError(label + " cannot contain cycles or shared references");
      seen.add(value);
      nodes += 1;
      if (nodes > 4096) throw new RangeError(label + " exceeds the object-node limit");
      if (Array.isArray(value)) {
        const values = plainArrayValues(value, path, 256);
        return Object.freeze(values.map(function (entry, index) {
          return clone(entry, path + "[" + index + "]", depth + 1);
        }));
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(path + " must contain plain data objects");
      }
      if (Object.getOwnPropertySymbols(value).length !== 0) {
        throw new TypeError(path + " cannot contain symbol properties");
      }
      const names = Object.getOwnPropertyNames(value);
      if (names.length > 64) throw new RangeError(path + " exceeds the object-field limit");
      const output = {};
      names.forEach(function (name) {
        if (name === "__proto__") throw new TypeError(path + " object keys cannot be __proto__");
        if (!/^[\x00-\x7f]+$/.test(name)) throw new TypeError(path + " object keys must be ASCII");
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
          throw new TypeError(path + " must contain only enumerable data properties");
        }
        Object.defineProperty(output, name, {
          value: clone(descriptor.value, path + "." + name, depth + 1),
          writable: true,
          configurable: true,
          enumerable: true,
        });
      });
      return Object.freeze(output);
    }
    return clone(input, label, 0);
  }

  function catalogProtocolById(catalog, protocolId) {
    for (let index = 0; index < catalog.protocols.length; index += 1) {
      if (catalog.protocols[index].protocolId === protocolId) return catalog.protocols[index];
    }
    return null;
  }

  function catalogTierByNumber(protocol, tier) {
    if (!protocol || tier < 1 || tier > protocol.tiers.length) return null;
    const record = protocol.tiers[tier - 1];
    return record && record.tier === tier ? record : null;
  }

  function normalizeProtocolTier(input, protocolId, expectedTier, sharedCooldownRuleMs, castPolicyId) {
    const fields = plainDataObject(input, [
      "tier", "baseCostAether", "cooldownMs", "sharedCooldownMs", "maximumAcceptedCasts",
      "effect", "eventIds",
    ], "Protocol " + protocolId + " tier " + expectedTier);
    const tier = tierNumber(fields.tier, "Protocol " + protocolId + " tier number");
    if (tier !== expectedTier) {
      throw new RangeError("Protocol " + protocolId + " tiers must use exact tier order 1, 2, 3");
    }
    const sharedCooldownMs = nonnegativeInteger(
      fields.sharedCooldownMs,
      "Protocol " + protocolId + " shared cooldown milliseconds"
    );
    if (sharedCooldownMs !== sharedCooldownRuleMs) {
      throw new RangeError(
        "Protocol " + protocolId + " shared cooldown does not match its runtime catalog rule"
      );
    }
    let maximumAcceptedCasts = fields.maximumAcceptedCasts;
    if (maximumAcceptedCasts !== null) {
      maximumAcceptedCasts = positiveInteger(
        maximumAcceptedCasts,
        "Protocol " + protocolId + " maximum accepted casts"
      );
    }
    if ((castPolicyId === "repeat-surcharge" && maximumAcceptedCasts !== null) ||
        (castPolicyId === "once-per-mission" && maximumAcceptedCasts !== 1)) {
      throw new RangeError("Protocol " + protocolId + " cast ceiling does not match " + castPolicyId);
    }
    const effect = cloneCanonicalData(fields.effect, "Protocol " + protocolId + " tier effect");
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
      throw new TypeError("Protocol " + protocolId + " tier effect must be a plain effect record");
    }
    if (!Object.prototype.hasOwnProperty.call(effect, "kind") || typeof effect.kind !== "string" ||
        EFFECT_KINDS.indexOf(effect.kind) === -1) {
      throw new TypeError("Protocol " + protocolId + " has an unsupported effect kind");
    }
    if (Object.prototype.hasOwnProperty.call(effect, "affectsFutureSpawns") &&
        typeof effect.affectsFutureSpawns !== "boolean") {
      throw new TypeError("Protocol " + protocolId + " effect affectsFutureSpawns must be a boolean");
    }
    return Object.freeze({
      tier: tier,
      baseCostAether: positiveInteger(fields.baseCostAether, "Protocol " + protocolId + " base cost"),
      cooldownMs: nonnegativeInteger(fields.cooldownMs, "Protocol " + protocolId + " cooldown milliseconds"),
      sharedCooldownMs: sharedCooldownMs,
      maximumAcceptedCasts: maximumAcceptedCasts,
      effect: effect,
      eventIds: cloneCanonicalData(fields.eventIds, "Protocol " + protocolId + " tier event IDs"),
    });
  }

  function normalizeProtocolCatalog(input) {
    if (NORMALIZED_CATALOGS.has(input)) return input;
    const catalogFields = plainDataObject(input, [
      "maximumSlotCap", "protocols", "repeatCostStepBp", "sharedCooldownMs",
    ], "Protocol runtime catalog");
    const maximumSlotCap = nonnegativeInteger(catalogFields.maximumSlotCap, "Protocol maximum slot cap");
    if (maximumSlotCap > MAX_PROTOCOL_SLOTS) throw new RangeError("Protocol maximum slot cap exceeds 2");
    const repeatCostStepBp = positiveInteger(catalogFields.repeatCostStepBp, "Protocol repeat cost step");
    const sharedCooldownMs = nonnegativeInteger(catalogFields.sharedCooldownMs, "Protocol shared cooldown rule");
    if (sharedCooldownMs !== UNIVERSAL_SHARED_COOLDOWN_MS) {
      throw new RangeError("Protocol shared cooldown rule must be 15000 ms");
    }
    const source = plainArrayValues(catalogFields.protocols, "Protocol catalog", MAX_CATALOG_RECORDS);
    if (source.length === 0) throw new RangeError("Protocol catalog must not be empty");
    rejectSharedObjectReferences(source, "Protocol catalog");
    let previousProtocolId = null;
    const normalized = source.map(function (record, index) {
      const fields = plainDataObject(record, [
        "protocolId", "castPolicyId", "targetKind", "tiers", "eventIds",
      ], "Protocol " + index);
      const protocolId = lowercaseAuthoredId(fields.protocolId, "Protocol " + index + " ID");
      assertStrictAsciiOrder(previousProtocolId, protocolId, "Protocol catalog IDs");
      previousProtocolId = protocolId;
      if (typeof fields.targetKind !== "string" || CommandsV2.TARGET_KINDS.indexOf(fields.targetKind) === -1) {
        throw new TypeError("Protocol " + protocolId + " has an unsupported target kind");
      }
      if (typeof fields.castPolicyId !== "string" || CAST_POLICY_IDS.indexOf(fields.castPolicyId) === -1) {
        throw new TypeError("Protocol " + protocolId + " has an unsupported cast policy");
      }
      const tierSource = plainArrayValues(fields.tiers, "Protocol " + protocolId + " tiers", 3);
      if (tierSource.length !== 3) {
        throw new RangeError("Protocol " + protocolId + " must contain exactly three tiers");
      }
      rejectSharedObjectReferences(tierSource, "Protocol " + protocolId + " tiers");
      const tiers = Object.freeze(tierSource.map(function (tier, tierIndex) {
        return normalizeProtocolTier(
          tier, protocolId, tierIndex + 1, sharedCooldownMs, fields.castPolicyId
        );
      }));
      if (tiers[1].maximumAcceptedCasts !== tiers[0].maximumAcceptedCasts ||
          tiers[2].maximumAcceptedCasts !== tiers[0].maximumAcceptedCasts) {
        throw new RangeError("Protocol " + protocolId + " maximum accepted casts must be tier-invariant");
      }
      return Object.freeze({
        protocolId: protocolId,
        castPolicyId: fields.castPolicyId,
        targetKind: fields.targetKind,
        tiers: tiers,
        eventIds: cloneCanonicalData(fields.eventIds, "Protocol " + protocolId + " event IDs"),
      });
    });
    const catalog = Object.freeze({
      maximumSlotCap: maximumSlotCap,
      protocols: Object.freeze(normalized),
      repeatCostStepBp: repeatCostStepBp,
      sharedCooldownMs: sharedCooldownMs,
    });
    NORMALIZED_CATALOGS.add(catalog);
    return catalog;
  }

  function adaptCompiledProtocolContent(input) {
    const fields = plainDataObject(input, [
      "schemaVersion", "eventSchemaVersion", "behaviorRegistryVersion", "commandSchemaVersion",
      "replayFormatVersion", "profileSchemaVersion", "protocolRules", "relicRules",
      "reinforcementRules", "protocols", "relics", "specializations", "reinforcements",
      "mechanisms", "grantRecords", "missionProgression",
    ], "Compiled v4 unlock content");
    if (fields.schemaVersion !== 4 || fields.eventSchemaVersion !== 2 ||
        fields.behaviorRegistryVersion !== 2 || fields.commandSchemaVersion !== 2 ||
        fields.replayFormatVersion !== 2 || fields.profileSchemaVersion !== 2) {
      throw new RangeError("Compiled v4 Protocol content has incompatible version identities");
    }
    const rules = plainDataObject(fields.protocolRules, [
      "initialSlotCap", "maximumSlotCap", "maximumLaurels", "repeatCostStepBp",
      "sharedCooldownMs", "respecPolicyId", "tierCosts",
    ], "Compiled v4 Protocol rules");
    nonnegativeInteger(rules.initialSlotCap, "Compiled initial Protocol slot cap");
    nonnegativeInteger(rules.maximumLaurels, "Compiled maximum Laurels");
    lowercaseAuthoredId(rules.respecPolicyId, "Compiled Protocol respec policy ID");
    cloneCanonicalData(rules.tierCosts, "Compiled Protocol tier costs");
    const source = plainArrayValues(fields.protocols, "Compiled v4 Protocols", MAX_CATALOG_RECORDS);
    rejectSharedObjectReferences(source, "Compiled v4 Protocols");
    const protocols = source.map(function (record, index) {
      const values = plainDataObject(record, [
        "id", "unlockGrantId", "castPolicyId", "targetKind", "tiers", "eventIds",
      ], "Compiled Protocol " + index);
      lowercaseAuthoredId(values.unlockGrantId, "Compiled Protocol unlock grant ID");
      const tierSource = plainArrayValues(values.tiers, "Compiled Protocol tiers", 3);
      const tiers = tierSource.map(function (tier, tierIndex) {
        const tierValues = plainDataObject(tier, [
          "tier", "incrementalLaurels", "cumulativeLaurels", "baseCostAether", "cooldownMs",
          "sharedCooldownMs", "maximumAcceptedCasts", "effect", "eventIds",
        ], "Compiled Protocol tier " + tierIndex);
        nonnegativeInteger(tierValues.incrementalLaurels, "Compiled incremental Laurels");
        nonnegativeInteger(tierValues.cumulativeLaurels, "Compiled cumulative Laurels");
        return {
          tier: tierValues.tier,
          baseCostAether: tierValues.baseCostAether,
          cooldownMs: tierValues.cooldownMs,
          sharedCooldownMs: tierValues.sharedCooldownMs,
          maximumAcceptedCasts: tierValues.maximumAcceptedCasts,
          effect: cloneCanonicalData(tierValues.effect, "Compiled Protocol effect"),
          eventIds: cloneCanonicalData(tierValues.eventIds, "Compiled Protocol tier event IDs"),
        };
      });
      return {
        protocolId: values.id,
        castPolicyId: values.castPolicyId,
        targetKind: values.targetKind,
        tiers: tiers,
        eventIds: cloneCanonicalData(values.eventIds, "Compiled Protocol event IDs"),
      };
    });
    return normalizeProtocolCatalog({
      maximumSlotCap: rules.maximumSlotCap,
      protocols: protocols,
      repeatCostStepBp: rules.repeatCostStepBp,
      sharedCooldownMs: rules.sharedCooldownMs,
    });
  }

  function normalizeProtocolAuthority(input, label, catalog) {
    const source = plainArrayValues(input, label, MAX_CATALOG_RECORDS);
    rejectSharedObjectReferences(source, label);
    let previous = null;
    return Object.freeze(source.map(function (record, index) {
      const fields = plainDataObject(record, ["protocolId", "availableTier"], label + " entry " + index);
      const protocolId = lowercaseAuthoredId(fields.protocolId, label + " Protocol ID");
      assertStrictAsciiOrder(previous, protocolId, label);
      previous = protocolId;
      if (!catalogProtocolById(catalog, protocolId)) {
        throw new RangeError(label + " contains unknown protocol " + protocolId);
      }
      return Object.freeze({
        protocolId: protocolId,
        availableTier: tierNumber(fields.availableTier, label + " available tier"),
      });
    }));
  }

  function normalizeEquippedProtocol(input, index, catalog, authorityById, slotCap) {
    const fields = plainDataObject(
      input,
      ["slot", "protocolId", "tier"],
      "Equipped Protocol " + index
    );
    const slot = nonnegativeInteger(fields.slot, "Equipped Protocol slot");
    if (slot >= slotCap) throw new RangeError("Equipped Protocol slot exceeds the Protocol slot cap");
    const protocolId = lowercaseAuthoredId(fields.protocolId, "Equipped Protocol ID");
    const protocol = catalogProtocolById(catalog, protocolId);
    if (!protocol) throw new RangeError("Equipped Protocol uses unknown protocol " + protocolId);
    const authority = authorityById[protocolId];
    if (!authority) throw new RangeError("Cannot equip locked protocol " + protocolId);
    const tier = tierNumber(fields.tier, "Equipped Protocol tier");
    if (!catalogTierByNumber(protocol, tier)) {
      throw new RangeError("Equipped Protocol tier does not exist for " + protocolId);
    }
    if (tier > authority.availableTier) {
      throw new RangeError("Equipped Protocol tier exceeds permanent authority for " + protocolId);
    }
    return Object.freeze({ slot: slot, protocolId: protocolId, tier: tier });
  }

  function normalizeMissionLoan(input, catalog) {
    if (input === null) return null;
    const fields = plainDataObject(input, ["protocolId", "tier"], "Mission Protocol loan");
    const protocolId = lowercaseAuthoredId(fields.protocolId, "Mission Protocol loan ID");
    const protocol = catalogProtocolById(catalog, protocolId);
    if (!protocol) throw new RangeError("Mission Protocol loan uses unknown protocol " + protocolId);
    const tier = tierNumber(fields.tier, "Mission Protocol loan tier");
    if (!catalogTierByNumber(protocol, tier)) {
      throw new RangeError("Mission Protocol loan tier does not exist for " + protocolId);
    }
    if (tier !== 1) throw new RangeError("Mission Protocol loans must use Tier 1");
    return Object.freeze({ protocolId: protocolId, tier: tier });
  }

  function normalizeProtocolLoadout(input, catalogInput) {
    const catalog = normalizeProtocolCatalog(catalogInput);
    if (NORMALIZED_LOADOUTS.get(input) === catalog) return input;
    const fields = plainDataObject(input, [
      "slotCap", "protocolAuthority", "protocols", "missionLoan",
    ], "Protocol loadout");
    const slotCap = nonnegativeInteger(fields.slotCap, "Protocol slot cap");
    if (slotCap > MAX_PROTOCOL_SLOTS) {
      throw new RangeError("Protocol slot cap cannot exceed " + MAX_PROTOCOL_SLOTS);
    }
    if (slotCap > catalog.maximumSlotCap) {
      throw new RangeError("Protocol slot cap exceeds the runtime catalog maximum");
    }
    const protocolAuthority = normalizeProtocolAuthority(
      fields.protocolAuthority,
      "Protocol authority",
      catalog
    );
    const authorityById = Object.create(null);
    protocolAuthority.forEach(function (record) { authorityById[record.protocolId] = record; });
    const source = plainArrayValues(fields.protocols, "Equipped Protocols", MAX_PROTOCOL_SLOTS);
    if (source.length > slotCap) throw new RangeError("Equipped Protocols exceed the Protocol slot cap");
    rejectSharedObjectReferences(source, "Equipped Protocols");
    let previousSlot = -1;
    const equippedIds = new Set();
    const protocols = Object.freeze(source.map(function (record, index) {
      const normalized = normalizeEquippedProtocol(record, index, catalog, authorityById, slotCap);
      if (normalized.slot <= previousSlot) {
        throw new RangeError("Equipped Protocol slots must use unique strict slot order");
      }
      previousSlot = normalized.slot;
      if (equippedIds.has(normalized.protocolId)) {
        throw new RangeError("Protocol loadout contains duplicate protocol " + normalized.protocolId);
      }
      equippedIds.add(normalized.protocolId);
      return normalized;
    }));
    const missionLoan = normalizeMissionLoan(fields.missionLoan, catalog);
    if (missionLoan && equippedIds.has(missionLoan.protocolId)) {
      throw new RangeError("Mission Protocol loan cannot duplicate an equipped Protocol");
    }
    const loadout = Object.freeze({
      slotCap: slotCap,
      protocolAuthority: protocolAuthority,
      protocols: protocols,
      missionLoan: missionLoan,
    });
    NORMALIZED_LOADOUTS.set(loadout, catalog);
    return loadout;
  }

  function normalizeProtocolRuntimeLedger(input, catalogInput) {
    const catalog = normalizeProtocolCatalog(catalogInput);
    if (NORMALIZED_LEDGERS.get(input) === catalog) return input;
    const fields = plainDataObject(input, ["sharedReadyTick", "protocols"], "Protocol runtime ledger");
    const source = plainArrayValues(fields.protocols, "Protocol runtime records", MAX_CATALOG_RECORDS);
    rejectSharedObjectReferences(source, "Protocol runtime records");
    let previous = null;
    const protocols = Object.freeze(source.map(function (record, index) {
      const values = plainDataObject(
        record,
        ["protocolId", "readyTick", "acceptedCastCount"],
        "Protocol runtime record " + index
      );
      const protocolId = lowercaseAuthoredId(values.protocolId, "Protocol runtime ID");
      assertStrictAsciiOrder(previous, protocolId, "Protocol runtime IDs");
      previous = protocolId;
      const protocol = catalogProtocolById(catalog, protocolId);
      if (!protocol) throw new RangeError("Protocol runtime contains unknown protocol " + protocolId);
      const acceptedCastCount = nonnegativeInteger(
        values.acceptedCastCount,
        "Protocol accepted cast count"
      );
      if (acceptedCastCount > MAX_ACCEPTED_CAST_COUNT) {
        throw new RangeError("Protocol accepted cast count exceeds the reviewed ceiling");
      }
      const maximum = protocol.tiers[0].maximumAcceptedCasts;
      if (maximum !== null && acceptedCastCount > maximum) {
        throw new RangeError("Protocol accepted cast count exceeds its maximum");
      }
      return Object.freeze({
        protocolId: protocolId,
        readyTick: nonnegativeInteger(values.readyTick, "Protocol ready tick"),
        acceptedCastCount: acceptedCastCount,
      });
    }));
    const ledger = Object.freeze({
      sharedReadyTick: nonnegativeInteger(fields.sharedReadyTick, "Shared Protocol ready tick"),
      protocols: protocols,
    });
    NORMALIZED_LEDGERS.set(ledger, catalog);
    return ledger;
  }

  function normalizeBoardBounds(input) {
    const fields = plainDataObject(input, ["minX", "minY", "maxX", "maxY"], "Protocol board bounds");
    const bounds = {
      minX: safeInteger(fields.minX, "Board minimum X"),
      minY: safeInteger(fields.minY, "Board minimum Y"),
      maxX: safeInteger(fields.maxX, "Board maximum X"),
      maxY: safeInteger(fields.maxY, "Board maximum Y"),
    };
    if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
      throw new RangeError("Protocol board bounds minimums cannot exceed maximums");
    }
    return Object.freeze(bounds);
  }

  function normalizeRoutes(input) {
    const source = plainArrayValues(input, "Protocol routes", MAX_ROUTES);
    rejectSharedObjectReferences(source, "Protocol routes");
    let previous = null;
    return Object.freeze(source.map(function (record, index) {
      const fields = plainDataObject(record, ["routeId", "routeLength"], "Protocol route " + index);
      const routeId = lowercaseAuthoredId(fields.routeId, "Protocol route ID");
      assertStrictAsciiOrder(previous, routeId, "Protocol route IDs");
      previous = routeId;
      return Object.freeze({
        routeId: routeId,
        routeLength: positiveInteger(fields.routeLength, "Protocol route length"),
      });
    }));
  }

  function normalizeRuntimeIds(input, label) {
    const source = plainArrayValues(input, label, MAX_TOWERS);
    let previous = 0;
    return Object.freeze(source.map(function (value, index) {
      const runtimeId = positiveInteger(value, label + " entry " + index);
      if (runtimeId <= previous) throw new RangeError(label + " must use unique increasing order");
      previous = runtimeId;
      return runtimeId;
    }));
  }

  function normalizeTargetSelection(input, catalog) {
    if (input === null) return null;
    const fields = plainDataObject(input, [
      "protocolId", "target", "eligibleTargetIds",
    ], "Protocol target-selection proof");
    const protocolId = lowercaseAuthoredId(fields.protocolId, "Target-selection Protocol ID");
    if (!catalogProtocolById(catalog, protocolId)) {
      throw new RangeError("Target-selection proof uses an unknown Protocol");
    }
    return Object.freeze({
      protocolId: protocolId,
      target: CommandsV2.normalizeTarget(fields.target),
      eligibleTargetIds: normalizeRuntimeIds(fields.eligibleTargetIds, "Eligible target runtime IDs"),
    });
  }

  function normalizeActivationContext(input, catalog) {
    const fields = plainDataObject(input, [
      "currentTick", "phase", "aether", "protocolCostMultiplierBp", "boardBounds", "routes",
      "targetSelection",
    ], "Protocol activation context");
    if (typeof fields.phase !== "string" || PHASES.indexOf(fields.phase) === -1) {
      throw new RangeError("Unsupported Protocol activation phase");
    }
    const protocolCostMultiplierBp = positiveInteger(
      fields.protocolCostMultiplierBp,
      "Protocol cost multiplier"
    );
    if (protocolCostMultiplierBp < MIN_PROTOCOL_COST_MULTIPLIER_BP ||
        protocolCostMultiplierBp > MAX_PROTOCOL_COST_MULTIPLIER_BP) {
      throw new RangeError(
        "Protocol cost multiplier must be between " + MIN_PROTOCOL_COST_MULTIPLIER_BP +
        " and " + MAX_PROTOCOL_COST_MULTIPLIER_BP + " basis points"
      );
    }
    return Object.freeze({
      currentTick: nonnegativeInteger(fields.currentTick, "Protocol activation current tick"),
      phase: fields.phase,
      aether: nonnegativeInteger(fields.aether, "Protocol activation Aether"),
      protocolCostMultiplierBp: protocolCostMultiplierBp,
      boardBounds: normalizeBoardBounds(fields.boardBounds),
      routes: normalizeRoutes(fields.routes),
      targetSelection: normalizeTargetSelection(fields.targetSelection, catalog),
    });
  }

  function resolveProtocolCastCost(
    baseCostAether,
    priorAcceptedCasts,
    protocolCostMultiplierBp,
    repeatCostStepBp
  ) {
    baseCostAether = positiveInteger(baseCostAether, "Protocol base cost");
    priorAcceptedCasts = nonnegativeInteger(priorAcceptedCasts, "Prior accepted Protocol casts");
    protocolCostMultiplierBp = positiveInteger(
      protocolCostMultiplierBp,
      "Protocol cost multiplier"
    );
    if (protocolCostMultiplierBp < MIN_PROTOCOL_COST_MULTIPLIER_BP ||
        protocolCostMultiplierBp > MAX_PROTOCOL_COST_MULTIPLIER_BP) {
      throw new RangeError("Protocol cost multiplier is outside the reviewed clamp");
    }
    repeatCostStepBp = positiveInteger(repeatCostStepBp, "Protocol repeat cost step");
    const repeatMultiplierBp = ABI.checkedAdd(
      ABI.BASIS_POINTS,
      ABI.checkedMultiply(repeatCostStepBp, priorAcceptedCasts)
    );
    const repeatedCostAether = ABI.checkedMulDivCeil(
      baseCostAether,
      [repeatMultiplierBp],
      [ABI.BASIS_POINTS]
    );
    const resolvedCastCostAether = ABI.checkedMulDivCeil(
      repeatedCostAether,
      [protocolCostMultiplierBp],
      [ABI.BASIS_POINTS]
    );
    return Object.freeze({
      baseCostAether: baseCostAether,
      priorAcceptedCasts: priorAcceptedCasts,
      repeatMultiplierBp: repeatMultiplierBp,
      repeatedCostAether: repeatedCostAether,
      protocolCostMultiplierBp: protocolCostMultiplierBp,
      repeatCostStepBp: repeatCostStepBp,
      resolvedCastCostAether: resolvedCastCostAether,
    });
  }

  function runtimeRecordById(ledger, protocolId) {
    for (let index = 0; index < ledger.protocols.length; index += 1) {
      if (ledger.protocols[index].protocolId === protocolId) return ledger.protocols[index];
    }
    return Object.freeze({ protocolId: protocolId, readyTick: 0, acceptedCastCount: 0 });
  }

  function equippedProtocolById(loadout, protocolId) {
    for (let index = 0; index < loadout.protocols.length; index += 1) {
      if (loadout.protocols[index].protocolId === protocolId) return loadout.protocols[index];
    }
    return null;
  }

  function protocolAuthorityById(loadout, protocolId) {
    for (let index = 0; index < loadout.protocolAuthority.length; index += 1) {
      if (loadout.protocolAuthority[index].protocolId === protocolId) {
        return loadout.protocolAuthority[index];
      }
    }
    return null;
  }

  function routeById(routes, routeId) {
    for (let index = 0; index < routes.length; index += 1) {
      if (routes[index].routeId === routeId) return routes[index];
    }
    return null;
  }

  function pointWithinBounds(x, y, bounds) {
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
  }

  // Closed rule (spec 5.2): an empty eligible list is lawful only for global effects that attach to
  // future simulation events: the leak ward, and global fields that declare affectsFutureSpawns.
  // Annex ruling: scheduled global damage (Zeus Skyfire) counts as immediate for selection purposes:
  // it requires a nonempty eligible list at acceptance even though strikes resolve later.
  function protocolAllowsEmptySelection(protocol, tier) {
    if (protocol.targetKind !== "none") return false;
    const effect = tier.effect;
    if (WARD_EFFECT_KINDS.indexOf(effect.kind) !== -1) return true;
    if (FUTURE_SPAWN_FIELD_KINDS.indexOf(effect.kind) !== -1) {
      return Object.prototype.hasOwnProperty.call(effect, "affectsFutureSpawns") &&
        effect.affectsFutureSpawns === true;
    }
    return false;
  }

  function assertSelectionMatchesCommand(selection, command) {
    if (selection === null) return;
    if (selection.protocolId !== command.protocolId ||
        ABI.canonicalEncode(selection.target) !== ABI.canonicalEncode(command.target)) {
      throw new RangeError("Protocol target-selection proof does not match the exact command target");
    }
  }

  function targetDenialReason(protocol, tier, target, context) {
    const selection = context.targetSelection;
    const allowsEmpty = protocolAllowsEmptySelection(protocol, tier);
    if (selection === null) {
      return allowsEmpty ? null : DENIAL_REASONS.MISSING_ELIGIBLE_TARGET;
    }
    if (selection.eligibleTargetIds.length === 0 && !allowsEmpty) {
      return DENIAL_REASONS.MISSING_ELIGIBLE_TARGET;
    }
    if (target.kind === "none") return null;
    if (target.kind === "route-point") {
      const route = routeById(context.routes, target.routeId);
      if (!route) return DENIAL_REASONS.UNKNOWN_ROUTE;
      if (target.routeDistance > route.routeLength) {
        return DENIAL_REASONS.ROUTE_DISTANCE_OUT_OF_RANGE;
      }
      return null;
    }
    if (target.kind === "tower") {
      if (selection.eligibleTargetIds.indexOf(target.towerRuntimeId) === -1) {
        return DENIAL_REASONS.STALE_TOWER;
      }
      return null;
    }
    if (!pointWithinBounds(target.originX, target.originY, context.boardBounds) ||
        !pointWithinBounds(target.aimX, target.aimY, context.boardBounds)) {
      return DENIAL_REASONS.OUT_OF_BOARD_VECTOR;
    }
    if (target.originX === target.aimX && target.originY === target.aimY) {
      return DENIAL_REASONS.ZERO_LENGTH_VECTOR;
    }
    return null;
  }

  function millisecondsToTicks(milliseconds) {
    return ABI.checkedMulDivCeil(
      nonnegativeInteger(milliseconds, "Protocol cooldown milliseconds"),
      [ABI.TICKS_PER_SECOND],
      [1000]
    );
  }

  function deniedPlan(command, context, ledger, reason, source, resolvedCost) {
    return Object.freeze({
      accepted: false,
      aetherAfter: context.aether,
      denialReason: reason,
      ledgerUpdate: null,
      nextLedger: ledger,
      protocolId: command.protocolId,
      resolvedCastCostAether: resolvedCost,
      source: source,
      target: command.target,
      tier: command.tier,
    });
  }

  function nextLedgerAfterAcceptance(ledger, protocolId, acceptedCastCount, readyTick, sharedReadyTick) {
    const records = [];
    let replaced = false;
    ledger.protocols.forEach(function (record) {
      if (record.protocolId === protocolId) {
        records.push(Object.freeze({
          protocolId: protocolId,
          readyTick: readyTick,
          acceptedCastCount: acceptedCastCount,
        }));
        replaced = true;
        return;
      }
      records.push(Object.freeze({
        protocolId: record.protocolId,
        readyTick: record.readyTick,
        acceptedCastCount: record.acceptedCastCount,
      }));
    });
    if (!replaced) {
      records.push(Object.freeze({
        protocolId: protocolId,
        readyTick: readyTick,
        acceptedCastCount: acceptedCastCount,
      }));
      records.sort(function (left, right) {
        return left.protocolId < right.protocolId ? -1 : left.protocolId > right.protocolId ? 1 : 0;
      });
    }
    return Object.freeze({
      sharedReadyTick: sharedReadyTick,
      protocols: Object.freeze(records),
    });
  }

  function planProtocolActivation(input) {
    const fields = plainDataObject(
      input,
      ["catalog", "loadout", "ledger", "context", "command"],
      "Protocol activation input"
    );
    const catalog = normalizeProtocolCatalog(fields.catalog);
    const loadout = normalizeProtocolLoadout(fields.loadout, catalog);
    const ledger = normalizeProtocolRuntimeLedger(fields.ledger, catalog);
    const context = normalizeActivationContext(fields.context, catalog);
    const command = CommandsV2.normalizeCommand(fields.command);
    if (command.type !== "activatePower") {
      throw new TypeError("Protocol activation planning requires an activatePower command");
    }
    assertSelectionMatchesCommand(context.targetSelection, command);
    if (command.tick !== context.currentTick) {
      throw new RangeError("Protocol command tick must equal the current tick boundary");
    }

    const protocol = catalogProtocolById(catalog, command.protocolId);
    if (!protocol) {
      return deniedPlan(command, context, ledger, DENIAL_REASONS.UNKNOWN_PROTOCOL, null, null);
    }
    const missionLoan = loadout.missionLoan &&
      loadout.missionLoan.protocolId === command.protocolId ? loadout.missionLoan : null;
    const equipped = equippedProtocolById(loadout, command.protocolId);
    let source = null;
    if (missionLoan) {
      if (missionLoan.tier !== command.tier) {
        return deniedPlan(
          command, context, ledger, DENIAL_REASONS.MISSION_LOAN_MISMATCH, "mission-loan", null
        );
      }
      source = "mission-loan";
    } else {
      if (!protocolAuthorityById(loadout, command.protocolId)) {
        return deniedPlan(command, context, ledger, DENIAL_REASONS.PROTOCOL_LOCKED, null, null);
      }
      if (!equipped) {
        return deniedPlan(command, context, ledger, DENIAL_REASONS.PROTOCOL_UNEQUIPPED, null, null);
      }
      if (equipped.tier !== command.tier) {
        return deniedPlan(command, context, ledger, DENIAL_REASONS.TIER_MISMATCH, "loadout", null);
      }
      source = "loadout";
    }

    const tier = catalogTierByNumber(protocol, command.tier);
    // Defensive only: loadout/loan validation and the closed 1..3 command tier already guarantee this tier.
    if (!tier) {
      return deniedPlan(command, context, ledger, DENIAL_REASONS.TIER_MISMATCH, source, null);
    }
    if (protocol.targetKind !== command.target.kind) {
      return deniedPlan(command, context, ledger, DENIAL_REASONS.WRONG_TARGET_KIND, source, null);
    }

    const runtime = runtimeRecordById(ledger, command.protocolId);
    const cost = resolveProtocolCastCost(
      tier.baseCostAether,
      runtime.acceptedCastCount,
      context.protocolCostMultiplierBp,
      catalog.repeatCostStepBp
    );
    if (context.phase !== "wave") {
      return deniedPlan(
        command, context, ledger, DENIAL_REASONS.WRONG_PHASE, source, cost.resolvedCastCostAether
      );
    }
    if (context.currentTick < ledger.sharedReadyTick) {
      return deniedPlan(
        command, context, ledger, DENIAL_REASONS.SHARED_COOLDOWN, source, cost.resolvedCastCostAether
      );
    }
    if (context.currentTick < runtime.readyTick) {
      return deniedPlan(
        command, context, ledger, DENIAL_REASONS.PROTOCOL_COOLDOWN, source, cost.resolvedCastCostAether
      );
    }
    if (protocol.castPolicyId === "once-per-mission" && runtime.acceptedCastCount >= 1) {
      return deniedPlan(
        command,
        context,
        ledger,
        DENIAL_REASONS.ONCE_PER_MISSION,
        source,
        cost.resolvedCastCostAether
      );
    }
    if (context.aether < cost.resolvedCastCostAether) {
      return deniedPlan(
        command, context, ledger, DENIAL_REASONS.INSUFFICIENT_AETHER, source, cost.resolvedCastCostAether
      );
    }
    const targetReason = targetDenialReason(protocol, tier, command.target, context);
    if (targetReason !== null) {
      return deniedPlan(command, context, ledger, targetReason, source, cost.resolvedCastCostAether);
    }

    const acceptedCastCount = ABI.checkedAdd(runtime.acceptedCastCount, 1);
    const readyTick = ABI.checkedAdd(context.currentTick, millisecondsToTicks(tier.cooldownMs));
    const sharedReadyTick = ABI.checkedAdd(
      context.currentTick,
      millisecondsToTicks(tier.sharedCooldownMs)
    );
    const ledgerUpdate = Object.freeze({
      protocolId: command.protocolId,
      acceptedCastCount: acceptedCastCount,
      readyTick: readyTick,
      sharedReadyTick: sharedReadyTick,
    });
    const nextLedger = nextLedgerAfterAcceptance(
      ledger,
      command.protocolId,
      acceptedCastCount,
      readyTick,
      sharedReadyTick
    );
    return Object.freeze({
      accepted: true,
      aetherAfter: ABI.checkedAdd(context.aether, -cost.resolvedCastCostAether),
      denialReason: null,
      ledgerUpdate: ledgerUpdate,
      nextLedger: nextLedger,
      protocolId: command.protocolId,
      resolvedCastCostAether: cost.resolvedCastCostAether,
      source: source,
      target: command.target,
      tier: command.tier,
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    COMMAND_SCHEMA_VERSION: CommandsV2.COMMAND_SCHEMA_VERSION,
    PROTOCOL_LEGALITY_SCHEMA_VERSION: PROTOCOL_LEGALITY_SCHEMA_VERSION,
    UNIVERSAL_SHARED_COOLDOWN_MS: UNIVERSAL_SHARED_COOLDOWN_MS,
    MAX_PROTOCOL_SLOTS: MAX_PROTOCOL_SLOTS,
    MAX_ACCEPTED_CAST_COUNT: MAX_ACCEPTED_CAST_COUNT,
    CAST_POLICY_IDS: CAST_POLICY_IDS,
    EFFECT_KINDS: EFFECT_KINDS,
    DENIAL_REASONS: DENIAL_REASONS,
    PHASES: PHASES,
    adaptCompiledProtocolContent: adaptCompiledProtocolContent,
    normalizeProtocolCatalog: normalizeProtocolCatalog,
    normalizeProtocolLoadout: normalizeProtocolLoadout,
    normalizeProtocolRuntimeLedger: normalizeProtocolRuntimeLedger,
    resolveProtocolCastCost: resolveProtocolCastCost,
    planProtocolActivation: planProtocolActivation,
  });
});

  /* source relics.js bytes=18841 sha256=c8dd8c896ba8c3f15d4a5160923b02035760271b6ae25445f1ed2a61f3fe2d47 */
/* Armara Aegis deterministic Relic modifier resolver v1.
   Relics resolve before a run into one immutable, named, clamped modifier set.
   Multipliers on one stat sum as basis-point deltas from 10000 (forge-ember + titan-gear
   build-cost = 10800 + 10800 - 10000 = 11600 bp; upgrade/specialization = 8800 + 10800 - 10000
   = 9600 bp), then clamp once to the named stat policy, then round once when applied to a
   concrete integer base. add-bp stats scale the base by (10000 + delta) / 10000 the same way. */
(function (root, factory) {
  "use strict";


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
})(BUNDLE_ROOT, function (ABI) {
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

  /* source management.js bytes=63514 sha256=2efdcf8cac3fa710ef4bd20ffed9b0acd17bdb8481f19ae9eba0df47af560e39 */
/* Armara Aegis deterministic management reducer v1.
   Pure build/upgrade/sell/wave/gate/policy state; combat behavior belongs to later reducers. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before management.js");
  if (!game.AegisEconomy) throw new Error("Game.AegisEconomy must be installed before management.js");
  if (!game.AegisMovement) throw new Error("Game.AegisMovement must be installed before management.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before management.js");
  if (!game.AegisCommandsV2) throw new Error("Game.AegisCommandsV2 must be installed before management.js");
  if (!game.AegisProtocols) throw new Error("Game.AegisProtocols must be installed before management.js");
  if (!game.AegisRelics) throw new Error("Game.AegisRelics must be installed before management.js");
  const api = factory(
    game.AegisSim,
    game.AegisEconomy,
    game.AegisMovement,
    game.AegisCommands,
    game.AegisCommandsV2,
    game.AegisProtocols,
    game.AegisRelics
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisManagement")) {
    if (game.AegisManagement !== api) throw new Error("Game.AegisManagement is already installed");
    return;
  }
  Object.defineProperty(game, "AegisManagement", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (
  ABI,
  Economy,
  Movement,
  Commands,
  CommandsV2,
  Protocols,
  Relics
) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  if (!Economy || !Object.isFrozen(Economy) || Economy.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis economy API is required");
  }
  if (!Movement || !Object.isFrozen(Movement) || Movement.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis movement API is required");
  }
  if (!Commands || !Object.isFrozen(Commands) || Commands.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis commands API is required");
  }
  ["assertSafeInteger", "checkedAdd", "canonicalEncode"].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  ["addInvestment", "cumulativeInvestment", "sellRefund", "initialBountyRemainder", "creditFixedGrant"]
    .forEach(function (name) {
      if (typeof Economy[name] !== "function") throw new TypeError("Aegis economy API is missing " + name);
    });
  ["createRuntimeIdState", "allocateRuntimeId"].forEach(function (name) {
    if (typeof Movement[name] !== "function") throw new TypeError("Aegis movement API is missing " + name);
  });
  ["createCommandLimits", "normalizeCommandSequence"].forEach(function (name) {
    if (typeof Commands[name] !== "function") throw new TypeError("Aegis commands API is missing " + name);
  });
  if (!CommandsV2 || !Object.isFrozen(CommandsV2) || CommandsV2.COMMAND_SCHEMA_VERSION !== 2) {
    throw new TypeError("A matching frozen Aegis command-v2 API is required");
  }
  if (!Protocols || !Object.isFrozen(Protocols) ||
      Protocols.ABI_DESCRIPTOR_SHA256 !== CommandsV2.ABI_DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis Protocol API is required");
  }
  if (!Relics || !Object.isFrozen(Relics) ||
      Relics.ABI_DESCRIPTOR_SHA256 !== CommandsV2.ABI_DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis Relic API is required");
  }
  ["planProtocolActivation", "resolveProtocolCastCost"].forEach(function (name) {
    if (typeof Protocols[name] !== "function") throw new TypeError("Aegis Protocol API is missing " + name);
  });
  ["applyBountyWithRemainder", "applyIntegerModifier", "resolveProtocolCastCostWithRelics"]
    .forEach(function (name) {
      if (typeof Relics[name] !== "function") {
        throw new TypeError("Aegis Relic API is missing " + name);
      }
    });

  const MANAGEMENT_SCHEMA_VERSION = 1;
  const PHASES = Object.freeze(["planning", "wave", "complete"]);
  const TUTORIAL_GATE_MODES = Object.freeze(ABI.DESCRIPTOR.tutorialUpgradeGate.modes.slice());
  const CONFIG_FIELDS = Object.freeze([
    "missionId",
    "resolvedStartAether",
    "tutorialUpgradeGateMode",
    "padIds",
    "waveStartGrants",
    "defenses",
  ]);
  const DEFENSE_FIELDS = Object.freeze([
    "id", "costsAether", "defaultTargetPolicy", "allowedTargetPolicies",
  ]);
  const STATE_FIELDS = Object.freeze([
    "schemaVersion",
    "missionId",
    "aether",
    "bountyRemainder",
    "phase",
    "activeWave",
    "clearedWaves",
    "tutorialUpgradeGateMode",
    "tutorialUpgradeGateOpen",
    "towers",
    "runtimeIds",
  ]);
  const TOWER_FIELDS = Object.freeze([
    "id", "padId", "defenseId", "level", "investedAether", "targetPolicy",
  ]);
  const LOWERCASE_AUTHORED_ID = /^[a-z][a-z0-9._:-]*$/;

  /* ABI v2 (compiled content schema 4) additions. Every v1 record shape above is retained
     byte-identically; a v2 config is recognized only by its explicit `abiVersion` field. */
  const MANAGEMENT_SCHEMA_VERSION_V2 = 2;
  const CONFIG_FIELDS_V2 = Object.freeze(CONFIG_FIELDS.concat([
    "abiVersion", "relicModifiers", "specializationAccessIds", "specializations",
  ]));
  const TOWER_FIELDS_V2 = Object.freeze(TOWER_FIELDS.concat([
    "disableSources", "paidCosts", "specializationId",
  ]));
  const DISABLE_SOURCE_FIELDS = Object.freeze(["expiryTick", "sourceId"]);
  const SPECIALIZATION_FIELDS = Object.freeze(["costAether", "defenseId", "id"]);
  const V2_ONLY_COMMAND_TYPES = Object.freeze([
    "activateMechanism", "activatePower", "deployReinforcement", "resetPlan", "specializeTower",
  ]);
  const MAX_DISABLE_SOURCES = 8;
  const MAX_PROTOCOL_RUNTIME_RECORDS = 3;
  const MAX_TOWER_PAID_COSTS = 3;
  const MAX_SPECIALIZATIONS = 128;
  const MAX_SPECIALIZATION_ACCESS_IDS = 128;
  const V2_LEVEL_CAP = 3;
  const SPECIALIZATION_LEVEL = 3;
  const RELIC_COST_STATS = Object.freeze({
    build: "build-cost",
    upgrade: "upgrade-cost",
    specialization: "specialization-cost",
    protocol: "protocol-cost",
  });

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
    return Object.is(value, -0) ? 0 : value;
  }

  function positiveInteger(value, label) {
    value = nonnegativeInteger(value, label);
    if (value === 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function lowercaseAuthoredId(value, label) {
    if (typeof value !== "string" || !LOWERCASE_AUTHORED_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase authored ID");
    }
    return value;
  }

  function booleanValue(value, label) {
    if (typeof value !== "boolean") throw new TypeError(label + " must be boolean");
    return value;
  }

  function freezeArray(items) {
    return Object.freeze(items);
  }

  function normalizePolicyList(value, defenseId) {
    if (!Array.isArray(value)) throw new TypeError("Defense " + defenseId + " target policies must be an array");
    ABI.canonicalEncode(value);
    const seen = new Set();
    let previousPolicyOrder = -1;
    const policies = value.map(function (policy) {
      if (typeof policy !== "string" || Commands.TARGET_POLICIES.indexOf(policy) === -1) {
        throw new TypeError("Defense " + defenseId + " has an unsupported target policy");
      }
      if (seen.has(policy)) throw new RangeError("Defense " + defenseId + " has a duplicate target policy");
      seen.add(policy);
      const policyOrder = Commands.TARGET_POLICIES.indexOf(policy);
      if (policyOrder <= previousPolicyOrder) {
        throw new RangeError("Defense " + defenseId + " target policies must use canonical policy order");
      }
      previousPolicyOrder = policyOrder;
      return policy;
    });
    return freezeArray(policies);
  }

  function normalizeDefense(value, index, abiVersion) {
    exactFields(value, DEFENSE_FIELDS, "Defense " + index);
    const id = lowercaseAuthoredId(value.id, "Defense " + index + " ID");
    /* ABI v1 defenses buy three linear levels. Under ABI v2 the third level is a
       specialization purchase, so the ordinary paid-level table has exactly two records. */
    const requiredLevels = abiVersion === 2 ? 2 : 3;
    if (!Array.isArray(value.costsAether) || value.costsAether.length !== requiredLevels) {
      throw new RangeError(
        "Defense " + id + " must contain exactly " +
        (requiredLevels === 2 ? "two" : "three") + " level costs"
      );
    }
    ABI.canonicalEncode(value.costsAether);
    const costsAether = freezeArray(value.costsAether.map(function (cost, levelIndex) {
      return positiveInteger(cost, "Defense " + id + " level " + (levelIndex + 1) + " cost");
    }));
    Economy.cumulativeInvestment(costsAether);

    const allowedTargetPolicies = normalizePolicyList(value.allowedTargetPolicies, id);
    let defaultTargetPolicy = value.defaultTargetPolicy;
    if (allowedTargetPolicies.length === 0) {
      if (defaultTargetPolicy !== null) {
        throw new TypeError("Defense " + id + " without target policies must use a null default");
      }
    } else if (typeof defaultTargetPolicy !== "string" ||
        allowedTargetPolicies.indexOf(defaultTargetPolicy) === -1) {
      throw new RangeError("Defense " + id + " default target policy must be allowed");
    }
    return Object.freeze({
      id: id,
      costsAether: costsAether,
      defaultTargetPolicy: defaultTargetPolicy,
      allowedTargetPolicies: allowedTargetPolicies,
    });
  }

  function configAbiVersion(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return 1;
    if (!Object.prototype.hasOwnProperty.call(input, "abiVersion")) return 1;
    if (input.abiVersion !== 2) throw new RangeError("Unsupported management config ABI version");
    return 2;
  }

  /* The table lists every authored branch in the release, not only the equipped families, so a
     branch belonging to another family denies as `foreign-specialization` rather than unknown. */
  function normalizeSpecializationTable(input) {
    if (!Array.isArray(input) || input.length > MAX_SPECIALIZATIONS) {
      throw new RangeError("Management config specializations must be a bounded array");
    }
    ABI.canonicalEncode(input);
    let previous = null;
    return freezeArray(input.map(function (record, index) {
      exactFields(record, SPECIALIZATION_FIELDS, "Specialization " + index);
      const id = lowercaseAuthoredId(record.id, "Specialization " + index + " ID");
      if (previous !== null && id <= previous) {
        throw new RangeError("Management config specializations must use strict ASCII ID order");
      }
      previous = id;
      const defenseId = lowercaseAuthoredId(record.defenseId, "Specialization " + id + " defense ID");
      return Object.freeze({
        costAether: positiveInteger(record.costAether, "Specialization " + id + " cost"),
        defenseId: defenseId,
        id: id,
      });
    }));
  }

  function normalizeRelicModifiers(input) {
    if (!Array.isArray(input)) throw new TypeError("Relic modifiers must be an array");
    ABI.canonicalEncode(input);
    let previous = null;
    return freezeArray(input.map(function (modifier, index) {
      if (!modifier || typeof modifier !== "object" || Array.isArray(modifier) ||
          typeof modifier.statId !== "string") {
        throw new TypeError("Relic modifier " + index + " must be a resolved modifier record");
      }
      if (previous !== null && modifier.statId <= previous) {
        throw new RangeError("Relic modifiers must use strict ASCII stat order");
      }
      previous = modifier.statId;
      if (!Object.prototype.hasOwnProperty.call(Relics.STAT_POLICIES, modifier.statId)) {
        throw new RangeError("Unknown resolved Relic stat " + modifier.statId);
      }
      /* Validate through the owning resolver so a hostile amount can never reach a cost. */
      if (Relics.STAT_POLICIES[modifier.statId].rounding === "mission-remainder") {
        Relics.applyBountyWithRemainder(0, modifier.amount, 0);
      } else {
        Relics.applyIntegerModifier(0, modifier);
      }
      return Object.freeze({
        amount: modifier.amount,
        operation: modifier.operation,
        rounding: modifier.rounding,
        statId: modifier.statId,
      });
    }));
  }

  function relicModifierByStat(config, statId) {
    if (config.abiVersion !== 2) return null;
    for (let index = 0; index < config.relicModifiers.length; index++) {
      if (config.relicModifiers[index].statId === statId) return config.relicModifiers[index];
    }
    return null;
  }

  /* R1/R2: one clamped basis-point sum resolved by relics.js, then exactly one rounding here. */
  function resolvedCostAether(config, statId, baseCostAether) {
    const modifier = relicModifierByStat(config, statId);
    if (modifier === null) return nonnegativeInteger(baseCostAether, "Base Aether cost");
    return Relics.applyIntegerModifier(baseCostAether, modifier);
  }

  function relicCostMultiplierBp(config, statId) {
    const modifier = relicModifierByStat(config, statId);
    return modifier === null ? ABI.BASIS_POINTS : modifier.amount;
  }

  function specializationById(config, specializationId) {
    for (let index = 0; index < config.specializations.length; index++) {
      if (config.specializations[index].id === specializationId) return config.specializations[index];
    }
    return null;
  }

  function normalizeSharedConfigFields(input, abiVersion) {
    const missionId = lowercaseAuthoredId(input.missionId, "Mission ID");
    const resolvedStartAether = nonnegativeInteger(input.resolvedStartAether, "Resolved starting Aether");
    if (typeof input.tutorialUpgradeGateMode !== "string" ||
        TUTORIAL_GATE_MODES.indexOf(input.tutorialUpgradeGateMode) === -1) {
      throw new RangeError("Unsupported tutorial Upgrade gate mode");
    }
    if (input.tutorialUpgradeGateMode === "m01-wave1" && missionId !== "m01") {
      throw new RangeError("The m01-wave1 tutorial Upgrade gate is valid only for Mission 1");
    }

    if (!Array.isArray(input.padIds) || input.padIds.length === 0) {
      throw new RangeError("Management config must contain at least one pad ID");
    }
    ABI.canonicalEncode(input.padIds);
    const padSet = new Set();
    const padIds = freezeArray(input.padIds.map(function (padId, index) {
      const normalized = lowercaseAuthoredId(padId, "Pad " + index + " ID");
      if (padSet.has(normalized)) throw new RangeError("Management config contains duplicate pad ID " + normalized);
      padSet.add(normalized);
      return normalized;
    }));

    if (!Array.isArray(input.waveStartGrants) || input.waveStartGrants.length === 0) {
      throw new RangeError("Management config must contain at least one wave-start grant");
    }
    ABI.canonicalEncode(input.waveStartGrants);
    const waveStartGrants = freezeArray(input.waveStartGrants.map(function (grant, index) {
      return nonnegativeInteger(grant, "Wave " + (index + 1) + " start grant");
    }));

    if (!Array.isArray(input.defenses) || input.defenses.length === 0) {
      throw new RangeError("Management config must contain at least one equipped defense");
    }
    ABI.canonicalEncode(input.defenses);
    const defenseSet = new Set();
    const defenses = freezeArray(input.defenses.map(function (defense, index) {
      const normalized = normalizeDefense(defense, index, abiVersion);
      if (defenseSet.has(normalized.id)) {
        throw new RangeError("Management config contains duplicate defense ID " + normalized.id);
      }
      defenseSet.add(normalized.id);
      return normalized;
    }));

    return {
      missionId: missionId,
      resolvedStartAether: resolvedStartAether,
      tutorialUpgradeGateMode: input.tutorialUpgradeGateMode,
      padIds: padIds,
      waveStartGrants: waveStartGrants,
      defenses: defenses,
    };
  }

  function normalizeManagementConfigV2(input) {
    exactFields(input, CONFIG_FIELDS_V2, "Management config");
    const shared = normalizeSharedConfigFields(input, 2);
    const specializations = normalizeSpecializationTable(input.specializations);
    if (!Array.isArray(input.specializationAccessIds) ||
        input.specializationAccessIds.length > MAX_SPECIALIZATION_ACCESS_IDS) {
      throw new RangeError("Specialization access IDs must be a bounded array");
    }
    ABI.canonicalEncode(input.specializationAccessIds);
    let previousAccessId = null;
    const specializationAccessIds = freezeArray(
      input.specializationAccessIds.map(function (accessId, index) {
        const normalized = lowercaseAuthoredId(accessId, "Specialization access " + index + " ID");
        if (previousAccessId !== null && normalized <= previousAccessId) {
          throw new RangeError("Specialization access IDs must use strict ASCII order");
        }
        previousAccessId = normalized;
        return normalized;
      })
    );
    return Object.freeze({
      abiVersion: 2,
      missionId: shared.missionId,
      resolvedStartAether: shared.resolvedStartAether,
      tutorialUpgradeGateMode: shared.tutorialUpgradeGateMode,
      padIds: shared.padIds,
      waveStartGrants: shared.waveStartGrants,
      defenses: shared.defenses,
      relicModifiers: normalizeRelicModifiers(input.relicModifiers),
      specializationAccessIds: specializationAccessIds,
      specializations: specializations,
    });
  }

  function normalizeManagementConfig(input) {
    if (configAbiVersion(input) === 2) return normalizeManagementConfigV2(input);
    exactFields(input, CONFIG_FIELDS, "Management config");
    return Object.freeze(normalizeSharedConfigFields(input, 1));
  }

  function defenseById(config, defenseId) {
    for (let index = 0; index < config.defenses.length; index++) {
      if (config.defenses[index].id === defenseId) return config.defenses[index];
    }
    return null;
  }

  function towerById(towers, towerId) {
    for (let index = 0; index < towers.length; index++) {
      if (towers[index].id === towerId) return towers[index];
    }
    return null;
  }

  function towerAtPad(towers, padId) {
    for (let index = 0; index < towers.length; index++) {
      if (towers[index].padId === padId) return towers[index];
    }
    return null;
  }

  function freezeTower(tower, abiVersion) {
    if (abiVersion !== 2) {
      return Object.freeze({
        id: tower.id,
        padId: tower.padId,
        defenseId: tower.defenseId,
        level: tower.level,
        investedAether: tower.investedAether,
        targetPolicy: tower.targetPolicy,
      });
    }
    return Object.freeze({
      id: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: tower.level,
      investedAether: tower.investedAether,
      targetPolicy: tower.targetPolicy,
      specializationId: tower.specializationId,
      paidCosts: freezeArray(tower.paidCosts.slice()),
      disableSources: freezeArray(tower.disableSources.map(function (source) {
        return Object.freeze({ expiryTick: source.expiryTick, sourceId: source.sourceId });
      })),
    });
  }

  function freezeState(values) {
    return Object.freeze({
      schemaVersion: values.schemaVersion || MANAGEMENT_SCHEMA_VERSION,
      missionId: values.missionId,
      aether: values.aether,
      bountyRemainder: values.bountyRemainder,
      phase: values.phase,
      activeWave: values.activeWave,
      clearedWaves: values.clearedWaves,
      tutorialUpgradeGateMode: values.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: values.tutorialUpgradeGateOpen,
      towers: values.towers,
      runtimeIds: values.runtimeIds,
    });
  }

  function normalizeDisableSources(value, towerId) {
    if (!Array.isArray(value) || value.length > MAX_DISABLE_SOURCES) {
      throw new RangeError("Tower " + towerId + " disable sources exceed the bounded collection");
    }
    ABI.canonicalEncode(value);
    let previous = null;
    return freezeArray(value.map(function (source, index) {
      exactFields(source, DISABLE_SOURCE_FIELDS, "Tower " + towerId + " disable source " + index);
      const sourceId = lowercaseAuthoredId(source.sourceId, "Disable source ID");
      if (previous !== null && sourceId <= previous) {
        throw new RangeError("Tower " + towerId + " disable sources must use strict ASCII ID order");
      }
      previous = sourceId;
      return Object.freeze({
        expiryTick: nonnegativeInteger(source.expiryTick, "Disable source expiry tick"),
        sourceId: sourceId,
      });
    }));
  }

  function normalizeTowerV2(value, index, config, seenIds, seenPads) {
    exactFields(value, TOWER_FIELDS_V2, "Tower " + index);
    const id = positiveInteger(value.id, "Tower " + index + " ID");
    if (seenIds.has(id)) throw new RangeError("Management state contains duplicate tower ID " + id);
    seenIds.add(id);
    const padId = lowercaseAuthoredId(value.padId, "Tower " + id + " pad ID");
    if (config.padIds.indexOf(padId) === -1) throw new RangeError("Tower " + id + " uses an unknown pad ID");
    if (seenPads.has(padId)) throw new RangeError("Management state contains two towers on pad " + padId);
    seenPads.add(padId);
    const defenseId = lowercaseAuthoredId(value.defenseId, "Tower " + id + " defense ID");
    const defense = defenseById(config, defenseId);
    if (!defense) throw new RangeError("Tower " + id + " uses an unknown defense ID");
    const level = positiveInteger(value.level, "Tower " + id + " level");
    if (level > V2_LEVEL_CAP) throw new RangeError("Tower " + id + " exceeds its maximum level");
    let specializationId = value.specializationId;
    if (level === SPECIALIZATION_LEVEL) {
      specializationId = lowercaseAuthoredId(specializationId, "Tower " + id + " specialization ID");
      const record = specializationById(config, specializationId);
      if (!record || record.defenseId !== defenseId) {
        throw new RangeError("Tower " + id + " uses a specialization its defense does not own");
      }
    } else if (specializationId !== null) {
      throw new RangeError("Tower " + id + " below Level 3 must not carry a specialization");
    }
    if (!Array.isArray(value.paidCosts) || value.paidCosts.length !== level ||
        value.paidCosts.length > MAX_TOWER_PAID_COSTS) {
      throw new RangeError("Tower " + id + " paid costs must record exactly one payment per level");
    }
    ABI.canonicalEncode(value.paidCosts);
    const paidCosts = freezeArray(value.paidCosts.map(function (cost, costIndex) {
      return positiveInteger(cost, "Tower " + id + " level " + (costIndex + 1) + " paid cost");
    }));
    const investedAether = nonnegativeInteger(value.investedAether, "Tower " + id + " invested Aether");
    if (investedAether !== Economy.cumulativeInvestment(paidCosts)) {
      throw new RangeError("Tower " + id + " investment does not match its actual paid costs");
    }
    if (defense.allowedTargetPolicies.length === 0) {
      if (value.targetPolicy !== null) throw new RangeError("Tower " + id + " must not have a target policy");
    } else if (typeof value.targetPolicy !== "string" ||
        defense.allowedTargetPolicies.indexOf(value.targetPolicy) === -1) {
      throw new RangeError("Tower " + id + " has a target policy its defense does not allow");
    }
    return freezeTower({
      id: id,
      padId: padId,
      defenseId: defenseId,
      level: level,
      investedAether: investedAether,
      targetPolicy: value.targetPolicy,
      specializationId: level === SPECIALIZATION_LEVEL ? specializationId : null,
      paidCosts: paidCosts,
      disableSources: normalizeDisableSources(value.disableSources, id),
    }, 2);
  }

  function normalizeTower(value, index, config, seenIds, seenPads) {
    if (config.abiVersion === 2) return normalizeTowerV2(value, index, config, seenIds, seenPads);
    exactFields(value, TOWER_FIELDS, "Tower " + index);
    const id = positiveInteger(value.id, "Tower " + index + " ID");
    if (seenIds.has(id)) throw new RangeError("Management state contains duplicate tower ID " + id);
    seenIds.add(id);
    const padId = lowercaseAuthoredId(value.padId, "Tower " + id + " pad ID");
    if (config.padIds.indexOf(padId) === -1) throw new RangeError("Tower " + id + " uses an unknown pad ID");
    if (seenPads.has(padId)) throw new RangeError("Management state contains two towers on pad " + padId);
    seenPads.add(padId);
    const defenseId = lowercaseAuthoredId(value.defenseId, "Tower " + id + " defense ID");
    const defense = defenseById(config, defenseId);
    if (!defense) throw new RangeError("Tower " + id + " uses an unknown defense ID");
    const level = positiveInteger(value.level, "Tower " + id + " level");
    if (level > defense.costsAether.length) throw new RangeError("Tower " + id + " exceeds its maximum level");
    const investedAether = nonnegativeInteger(value.investedAether, "Tower " + id + " invested Aether");
    const expectedInvestment = Economy.cumulativeInvestment(defense.costsAether.slice(0, level));
    if (investedAether !== expectedInvestment) {
      throw new RangeError("Tower " + id + " investment does not match its paid level costs");
    }
    if (defense.allowedTargetPolicies.length === 0) {
      if (value.targetPolicy !== null) throw new RangeError("Tower " + id + " must not have a target policy");
    } else if (typeof value.targetPolicy !== "string" ||
        defense.allowedTargetPolicies.indexOf(value.targetPolicy) === -1) {
      throw new RangeError("Tower " + id + " has a target policy its defense does not allow");
    }
    return freezeTower({
      id: id,
      padId: padId,
      defenseId: defenseId,
      level: level,
      investedAether: investedAether,
      targetPolicy: value.targetPolicy,
    });
  }

  /* Structural validation/canonicalization only. This never authenticates a cached,
     imported, or replay snapshot and never makes one authoritative; the owning
     kernel/replay flow must establish provenance before passing state here. */
  function normalizeManagementState(input, configInput) {
    const config = normalizeManagementConfig(configInput);
    const schemaVersion = config.abiVersion === 2
      ? MANAGEMENT_SCHEMA_VERSION_V2 : MANAGEMENT_SCHEMA_VERSION;
    exactFields(input, STATE_FIELDS, "Management state");
    if (input.schemaVersion !== schemaVersion) {
      throw new RangeError("Unsupported management state schema version");
    }
    if (input.missionId !== config.missionId) throw new RangeError("Management state mission does not match config");
    const aether = nonnegativeInteger(input.aether, "Management state Aether");
    const bounty = Economy.creditFixedGrant(input.bountyRemainder, 0);
    if (typeof input.phase !== "string" || PHASES.indexOf(input.phase) === -1) {
      throw new RangeError("Unsupported management phase");
    }
    const activeWave = nonnegativeInteger(input.activeWave, "Active wave");
    const clearedWaves = nonnegativeInteger(input.clearedWaves, "Cleared waves");
    const waveCount = config.waveStartGrants.length;
    if (clearedWaves > waveCount) throw new RangeError("Cleared waves exceed the configured wave count");
    if (input.phase === "planning" && (activeWave !== 0 || clearedWaves >= waveCount)) {
      throw new RangeError("Planning state must have no active wave and a remaining configured wave");
    }
    if (input.phase === "wave" &&
        (activeWave !== clearedWaves + 1 || activeWave > waveCount)) {
      throw new RangeError("Active wave must be the next uncleared configured wave");
    }
    if (input.phase === "complete" && (activeWave !== 0 || clearedWaves !== waveCount)) {
      throw new RangeError("Complete state must have every configured wave cleared");
    }
    if (input.tutorialUpgradeGateMode !== config.tutorialUpgradeGateMode) {
      throw new RangeError("Management state tutorial gate mode does not match config");
    }
    const tutorialUpgradeGateOpen = booleanValue(
      input.tutorialUpgradeGateOpen,
      "Tutorial Upgrade gate state"
    );
    if (config.tutorialUpgradeGateMode === "none" && !tutorialUpgradeGateOpen) {
      throw new RangeError("Tutorial Upgrade gate mode none must start and remain open");
    }
    if (!tutorialUpgradeGateOpen && clearedWaves >= 1) {
      throw new RangeError("Tutorial Upgrade gate must be open after Wave 1 clears");
    }

    if (!Array.isArray(input.towers)) throw new TypeError("Management state towers must be an array");
    ABI.canonicalEncode(input.towers);
    if (input.towers.length > config.padIds.length) throw new RangeError("Management state has more towers than pads");
    const seenIds = new Set();
    const seenPads = new Set();
    let previousTowerId = 0;
    const towers = freezeArray(input.towers.map(function (tower, index) {
      const normalized = normalizeTower(tower, index, config, seenIds, seenPads);
      if (normalized.id <= previousTowerId) {
        throw new RangeError("Management state towers must be ordered by increasing runtime ID");
      }
      previousTowerId = normalized.id;
      return normalized;
    }));

    const runtimeIds = Movement.allocateRuntimeId(input.runtimeIds, "tower", false).state;
    if (towers.length > 0 && runtimeIds.nextByDomain.tower <= towers[towers.length - 1].id) {
      throw new RangeError("Next tower runtime ID must be greater than every owned tower ID");
    }

    return freezeState({
      schemaVersion: schemaVersion,
      missionId: config.missionId,
      aether: aether,
      bountyRemainder: bounty.bountyRemainder,
      phase: input.phase,
      activeWave: activeWave,
      clearedWaves: clearedWaves,
      tutorialUpgradeGateMode: input.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: tutorialUpgradeGateOpen,
      towers: towers,
      runtimeIds: runtimeIds,
    });
  }

  function createManagementState(configInput) {
    const config = normalizeManagementConfig(configInput);
    return freezeState({
      schemaVersion: config.abiVersion === 2
        ? MANAGEMENT_SCHEMA_VERSION_V2 : MANAGEMENT_SCHEMA_VERSION,
      missionId: config.missionId,
      aether: config.resolvedStartAether,
      bountyRemainder: Economy.initialBountyRemainder(),
      phase: "planning",
      activeWave: 0,
      clearedWaves: 0,
      tutorialUpgradeGateMode: config.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: config.tutorialUpgradeGateMode === "none",
      towers: freezeArray([]),
      runtimeIds: Movement.createRuntimeIdState(),
    });
  }

  function freezeEvent(fields) {
    return Object.freeze(fields);
  }

  function deniedEvent(command, reason) {
    return freezeEvent({
      type: "denied",
      tick: command.tick,
      seq: command.seq,
      commandType: command.type,
      reason: reason,
    });
  }

  function transition(state, event) {
    return Object.freeze({ state: state, event: event });
  }

  function withState(state, changes) {
    return freezeState({
      schemaVersion: state.schemaVersion,
      missionId: state.missionId,
      aether: Object.prototype.hasOwnProperty.call(changes, "aether") ? changes.aether : state.aether,
      bountyRemainder: state.bountyRemainder,
      phase: Object.prototype.hasOwnProperty.call(changes, "phase") ? changes.phase : state.phase,
      activeWave: Object.prototype.hasOwnProperty.call(changes, "activeWave")
        ? changes.activeWave : state.activeWave,
      clearedWaves: Object.prototype.hasOwnProperty.call(changes, "clearedWaves")
        ? changes.clearedWaves : state.clearedWaves,
      tutorialUpgradeGateMode: state.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: Object.prototype.hasOwnProperty.call(changes, "tutorialUpgradeGateOpen")
        ? changes.tutorialUpgradeGateOpen : state.tutorialUpgradeGateOpen,
      towers: Object.prototype.hasOwnProperty.call(changes, "towers") ? changes.towers : state.towers,
      runtimeIds: Object.prototype.hasOwnProperty.call(changes, "runtimeIds")
        ? changes.runtimeIds : state.runtimeIds,
    });
  }

  function applyBuild(state, config, command) {
    if (config.padIds.indexOf(command.padId) === -1) {
      return transition(state, deniedEvent(command, "unknown-pad"));
    }
    if (towerAtPad(state.towers, command.padId)) {
      return transition(state, deniedEvent(command, "pad-occupied"));
    }
    const defense = defenseById(config, command.defenseId);
    if (!defense) return transition(state, deniedEvent(command, "defense-not-equipped"));
    const costAether = resolvedCostAether(config, RELIC_COST_STATS.build, defense.costsAether[0]);
    if (state.aether < costAether) {
      return transition(state, deniedEvent(command, "insufficient-aether"));
    }

    const allocation = Movement.allocateRuntimeId(state.runtimeIds, "tower", true);
    const tower = freezeTower({
      id: allocation.runtimeId,
      padId: command.padId,
      defenseId: command.defenseId,
      level: 1,
      investedAether: costAether,
      targetPolicy: defense.defaultTargetPolicy,
      specializationId: null,
      paidCosts: [costAether],
      disableSources: [],
    }, config.abiVersion);
    const towers = freezeArray(state.towers.concat([tower]));
    const aether = ABI.checkedAdd(state.aether, -costAether);
    return transition(withState(state, {
      aether: aether,
      towers: towers,
      runtimeIds: allocation.state,
    }), freezeEvent({
      type: "build",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: tower.level,
      costAether: costAether,
      investedAether: tower.investedAether,
      aetherAfter: aether,
    }));
  }

  function applyUpgrade(state, config, command) {
    const tower = towerById(state.towers, command.towerId);
    if (!tower) return transition(state, deniedEvent(command, "unknown-tower"));
    if (!state.tutorialUpgradeGateOpen) {
      return transition(state, deniedEvent(command, ABI.DESCRIPTOR.tutorialUpgradeGate.denialReason));
    }
    const defense = defenseById(config, tower.defenseId);
    if (tower.level >= defense.costsAether.length) {
      /* Spec 7.1: under content schema v4 the Level 2 -> 3 step is a specialization purchase. */
      if (config.abiVersion === 2 && tower.level === defense.costsAether.length) {
        return transition(state, deniedEvent(command, "specialization-required"));
      }
      return transition(state, deniedEvent(command, "max-level"));
    }
    const costAether = resolvedCostAether(
      config,
      RELIC_COST_STATS.upgrade,
      defense.costsAether[tower.level]
    );
    if (state.aether < costAether) {
      return transition(state, deniedEvent(command, "insufficient-aether"));
    }
    const level = tower.level + 1;
    const investedAether = Economy.addInvestment(tower.investedAether, costAether);
    const upgraded = freezeTower({
      id: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: level,
      investedAether: investedAether,
      targetPolicy: tower.targetPolicy,
      specializationId: null,
      paidCosts: config.abiVersion === 2 ? tower.paidCosts.concat([costAether]) : [],
      disableSources: config.abiVersion === 2 ? tower.disableSources : [],
    }, config.abiVersion);
    const towers = freezeArray(state.towers.map(function (candidate) {
      return candidate.id === tower.id ? upgraded : candidate;
    }));
    const aether = ABI.checkedAdd(state.aether, -costAether);
    return transition(withState(state, { aether: aether, towers: towers }), freezeEvent({
      type: "upgrade",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: level,
      costAether: costAether,
      investedAether: investedAether,
      aetherAfter: aether,
    }));
  }

  function applySell(state, command) {
    const tower = towerById(state.towers, command.towerId);
    if (!tower) return transition(state, deniedEvent(command, "unknown-tower"));
    const refundAether = Economy.sellRefund(tower.investedAether);
    const aether = ABI.checkedAdd(state.aether, refundAether);
    const towers = freezeArray(state.towers.filter(function (candidate) {
      return candidate.id !== tower.id;
    }));
    return transition(withState(state, { aether: aether, towers: towers }), freezeEvent({
      type: "sell",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: tower.level,
      investedAether: tower.investedAether,
      refundAether: refundAether,
      aetherAfter: aether,
    }));
  }

  function applyStartWave(state, config, command) {
    if (state.phase === "wave") return transition(state, deniedEvent(command, "wave-active"));
    if (state.phase === "complete") return transition(state, deniedEvent(command, "campaign-complete"));
    const wave = state.clearedWaves + 1;
    const grantAether = config.waveStartGrants[wave - 1];
    const grant = Economy.creditFixedGrant(state.bountyRemainder, grantAether);
    const aether = ABI.checkedAdd(state.aether, grant.aetherAward);
    return transition(withState(state, {
      aether: aether,
      phase: "wave",
      activeWave: wave,
    }), freezeEvent({
      type: "waveStart",
      tick: command.tick,
      seq: command.seq,
      wave: wave,
      grantAether: grant.aetherAward,
      aetherAfter: aether,
    }));
  }

  function applySkipTutorialGate(state, command) {
    const opened = !state.tutorialUpgradeGateOpen;
    const nextState = opened
      ? withState(state, { tutorialUpgradeGateOpen: true })
      : state;
    return transition(nextState, freezeEvent({
      type: "tutorialGate",
      tick: command.tick,
      seq: command.seq,
      action: "skip",
      opened: opened,
    }));
  }

  function applySetTargetPolicy(state, config, command) {
    const tower = towerById(state.towers, command.towerId);
    if (!tower) return transition(state, deniedEvent(command, "unknown-tower"));
    const defense = defenseById(config, tower.defenseId);
    if (defense.allowedTargetPolicies.indexOf(command.policy) === -1) {
      return transition(state, deniedEvent(command, "target-policy-not-allowed"));
    }
    const changed = tower.targetPolicy !== command.policy;
    let nextState = state;
    if (changed) {
      const updated = freezeTower({
        id: tower.id,
        padId: tower.padId,
        defenseId: tower.defenseId,
        level: tower.level,
        investedAether: tower.investedAether,
        targetPolicy: command.policy,
        specializationId: config.abiVersion === 2 ? tower.specializationId : null,
        paidCosts: config.abiVersion === 2 ? tower.paidCosts : [],
        disableSources: config.abiVersion === 2 ? tower.disableSources : [],
      }, config.abiVersion);
      nextState = withState(state, {
        towers: freezeArray(state.towers.map(function (candidate) {
          return candidate.id === tower.id ? updated : candidate;
        })),
      });
    }
    return transition(nextState, freezeEvent({
      type: "targetPolicy",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      policy: command.policy,
      changed: changed,
    }));
  }

  const PROTOCOL_RUNTIME_FIELDS = Object.freeze([
    "effects", "equipped", "schedules", "sharedReadyTick", "wardCharges",
  ]);
  const EQUIPPED_PROTOCOL_FIELDS = Object.freeze([
    "acceptedCastCount", "loan", "protocolId", "readyTick", "tier",
  ]);

  function normalizeProtocolRuntime(input) {
    exactFields(input, PROTOCOL_RUNTIME_FIELDS, "Protocol runtime");
    if (!Array.isArray(input.equipped) || input.equipped.length > MAX_PROTOCOL_RUNTIME_RECORDS) {
      throw new RangeError("Protocol runtime records exceed the bounded collection");
    }
    const seen = new Set();
    const equipped = freezeArray(input.equipped.map(function (record, index) {
      exactFields(record, EQUIPPED_PROTOCOL_FIELDS, "Protocol runtime record " + index);
      const protocolId = lowercaseAuthoredId(record.protocolId, "Protocol runtime ID");
      if (seen.has(protocolId)) {
        throw new RangeError("Protocol runtime contains duplicate protocol " + protocolId);
      }
      seen.add(protocolId);
      return Object.freeze({
        acceptedCastCount: nonnegativeInteger(record.acceptedCastCount, "Accepted cast count"),
        loan: booleanValue(record.loan, "Protocol loan flag"),
        protocolId: protocolId,
        readyTick: nonnegativeInteger(record.readyTick, "Protocol ready tick"),
        tier: positiveInteger(record.tier, "Protocol tier"),
      });
    }));
    return Object.freeze({
      effects: freezeArray(input.effects.slice()),
      equipped: equipped,
      schedules: freezeArray(input.schedules.slice()),
      sharedReadyTick: nonnegativeInteger(input.sharedReadyTick, "Shared Protocol ready tick"),
      wardCharges: nonnegativeInteger(input.wardCharges, "Aegis Ward charges"),
    });
  }

  function protocolLedger(protocols) {
    const records = protocols.equipped.map(function (record) {
      return {
        acceptedCastCount: record.acceptedCastCount,
        protocolId: record.protocolId,
        readyTick: record.readyTick,
      };
    }).sort(function (left, right) {
      return left.protocolId < right.protocolId ? -1 : left.protocolId > right.protocolId ? 1 : 0;
    });
    return {
      sharedReadyTick: protocols.sharedReadyTick,
      protocols: records,
    };
  }

  function nextProtocolRuntime(protocols, plan) {
    return Object.freeze({
      effects: protocols.effects,
      equipped: freezeArray(protocols.equipped.map(function (record) {
        if (record.protocolId !== plan.protocolId) return record;
        return Object.freeze({
          acceptedCastCount: plan.ledgerUpdate.acceptedCastCount,
          loan: record.loan,
          protocolId: record.protocolId,
          readyTick: plan.ledgerUpdate.readyTick,
          tier: record.tier,
        });
      })),
      schedules: protocols.schedules,
      sharedReadyTick: plan.ledgerUpdate.sharedReadyTick,
      wardCharges: protocols.wardCharges,
    });
  }

  function protocolEffectKind(catalog, command) {
    for (let index = 0; index < catalog.protocols.length; index++) {
      const protocol = catalog.protocols[index];
      if (protocol.protocolId !== command.protocolId) continue;
      const tier = protocol.tiers[command.tier - 1];
      return tier && tier.tier === command.tier ? tier.effect.kind : null;
    }
    return null;
  }

  function protocolBaseCost(catalog, command) {
    for (let index = 0; index < catalog.protocols.length; index++) {
      const protocol = catalog.protocols[index];
      if (protocol.protocolId !== command.protocolId) continue;
      const tier = protocol.tiers[command.tier - 1];
      return tier && tier.tier === command.tier ? tier.baseCostAether : null;
    }
    return null;
  }

  function replaceTower(state, tower) {
    return freezeArray(state.towers.map(function (candidate) {
      return candidate.id === tower.id ? tower : candidate;
    }));
  }

  /* Spec 7.1 / plan 11.1: `specializeTower` replaces the Level 2 -> 3 upgrade under content v4. */
  function applySpecializeTower(state, config, command, runtime) {
    const tower = towerById(state.towers, command.towerRuntimeId);
    if (!tower) return transition(state, deniedEvent(command, "stale-tower"));
    if (!state.tutorialUpgradeGateOpen) {
      return transition(state, deniedEvent(command, ABI.DESCRIPTOR.tutorialUpgradeGate.denialReason));
    }
    if (tower.level !== SPECIALIZATION_LEVEL - 1) {
      return transition(state, deniedEvent(command, "wrong-level"));
    }
    const record = specializationById(config, command.specializationId);
    if (!record) return transition(state, deniedEvent(command, "unknown-specialization"));
    if (record.defenseId !== tower.defenseId) {
      return transition(state, deniedEvent(command, "foreign-specialization"));
    }
    if (config.specializationAccessIds.indexOf(record.id) === -1) {
      return transition(state, deniedEvent(command, "specialization-locked"));
    }
    const costAether = resolvedCostAether(
      config,
      RELIC_COST_STATS.specialization,
      record.costAether
    );
    if (state.aether < costAether) {
      return transition(state, deniedEvent(command, "insufficient-aether"));
    }
    const paidCosts = tower.paidCosts.concat([costAether]);
    const investedAether = Economy.addInvestment(tower.investedAether, costAether);
    const specialized = freezeTower({
      id: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: SPECIALIZATION_LEVEL,
      investedAether: investedAether,
      targetPolicy: tower.targetPolicy,
      specializationId: record.id,
      paidCosts: paidCosts,
      disableSources: tower.disableSources,
    }, 2);
    const aether = ABI.checkedAdd(state.aether, -costAether);
    return transition(withState(state, {
      aether: aether,
      towers: replaceTower(state, specialized),
    }), freezeEvent({
      type: "specialize",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: SPECIALIZATION_LEVEL,
      specializationId: record.id,
      costAether: costAether,
      investedAether: investedAether,
      aetherAfter: aether,
    }));
  }

  /* ADR-010: an accepted cast spends the same visible Aether as construction. Legality and
     cooldown arithmetic stay in protocols.js; this reducer owns only the payment/ledger write. */
  function applyActivatePower(state, config, command, runtime) {
    if (!runtime.protocolCatalog || !runtime.protocolLoadout) {
      return transition(state, deniedEvent(command, "not-available"));
    }
    const relicBp = relicCostMultiplierBp(config, RELIC_COST_STATS.protocol);
    const ledger = protocolLedger(runtime.protocols);
    const priorRecord = ledger.protocols.find(function (record) {
      return record.protocolId === command.protocolId;
    });
    const priorCasts = priorRecord ? priorRecord.acceptedCastCount : 0;
    const baseCostAether = protocolBaseCost(runtime.protocolCatalog, command);
    let contextAether = state.aether;
    let foldedCostAether = null;
    if (baseCostAether !== null) {
      /* R2: Titan Gear folds into ONE ceiling. protocols.js applies two, so the affordability
         boundary is translated here and an accepted cast always pays the folded cost. */
      foldedCostAether = Relics.resolveProtocolCastCostWithRelics(
        baseCostAether,
        priorCasts,
        relicBp
      );
      const planCostAether = Protocols.resolveProtocolCastCost(
        baseCostAether,
        priorCasts,
        relicBp,
        runtime.protocolCatalog.repeatCostStepBp
      ).resolvedCastCostAether;
      contextAether = Math.max(
        0,
        ABI.checkedAdd(state.aether, ABI.checkedAdd(planCostAether, -foldedCostAether))
      );
    }
    const plan = Protocols.planProtocolActivation({
      catalog: runtime.protocolCatalog,
      loadout: runtime.protocolLoadout,
      ledger: ledger,
      context: {
        currentTick: command.tick,
        phase: state.phase,
        aether: contextAether,
        protocolCostMultiplierBp: relicBp,
        boardBounds: runtime.boardBounds,
        routes: runtime.routes,
        targetSelection: runtime.selectProtocolTargets(command),
      },
      command: command,
    });
    if (!plan.accepted) {
      return transition(state, deniedEvent(command, plan.denialReason));
    }
    /* Never report an accepted cast the runtime cannot resolve. This check follows the closed
       Protocol denial order so a locked, mistargeted, or unaffordable cast still reports its
       own reason first; an authored effect kind whose runtime lands in a later batch is the
       last reason left, and it denies before any Aether moves. */
    const tierEffectKind = protocolEffectKind(runtime.protocolCatalog, command);
    if (tierEffectKind === null ||
        runtime.supportedEffectKinds.indexOf(tierEffectKind) === -1) {
      return transition(state, deniedEvent(command, "effect-not-implemented"));
    }
    const costAether = foldedCostAether;
    const aether = ABI.checkedAdd(state.aether, -costAether);
    runtime.protocols = nextProtocolRuntime(runtime.protocols, plan);
    runtime.protocolActivations.push(Object.freeze({
      costAether: costAether,
      protocolId: plan.protocolId,
      seq: command.seq,
      source: plan.source,
      target: plan.target,
      tick: command.tick,
      tier: plan.tier,
    }));
    return transition(withState(state, { aether: aether }), freezeEvent({
      type: "activatePower",
      tick: command.tick,
      seq: command.seq,
      protocolId: plan.protocolId,
      tier: plan.tier,
      source: plan.source,
      costAether: costAether,
      aetherAfter: aether,
    }));
  }

  /* K6 owns reinforcement/mechanism payment and lifecycle. Until then these deny honestly
     instead of reporting a success the simulation cannot deliver. */
  function applyDeployReinforcement(state, config, command, runtime) {
    return transition(state, deniedEvent(command, "not-available"));
  }

  function applyActivateMechanism(state, config, command, runtime) {
    return transition(state, deniedEvent(command, "not-available"));
  }

  /* Spec 12.2: Reset Plan is a planning-only undo of this bucket's construction at full cost. */
  function applyResetPlan(state, config, command, runtime) {
    if (state.phase !== "planning") {
      return transition(state, deniedEvent(command, "wrong-phase"));
    }
    const baselineTowerId = runtime.planningBaselineTowerId;
    const reverted = state.towers.filter(function (tower) { return tower.id >= baselineTowerId; });
    let refundAether = 0;
    reverted.forEach(function (tower) {
      refundAether = ABI.checkedAdd(refundAether, Economy.cumulativeInvestment(tower.paidCosts));
    });
    const aether = ABI.checkedAdd(state.aether, refundAether);
    const towers = freezeArray(state.towers.filter(function (tower) {
      return tower.id < baselineTowerId;
    }));
    return transition(withState(state, { aether: aether, towers: towers }), freezeEvent({
      type: "resetPlan",
      tick: command.tick,
      seq: command.seq,
      removedTowerCount: reverted.length,
      refundAether: refundAether,
      aetherAfter: aether,
    }));
  }

  function applyNormalizedCommand(state, config, command, runtime) {
    if (state.phase === "complete") {
      return transition(state, deniedEvent(command, "campaign-complete"));
    }
    if (command.type === "build") return applyBuild(state, config, command);
    if (command.type === "upgrade") return applyUpgrade(state, config, command);
    if (command.type === "sell") return applySell(state, command);
    if (command.type === "startWave") return applyStartWave(state, config, command);
    if (command.type === "skipTutorialGate") return applySkipTutorialGate(state, command);
    if (command.type === "setTargetPolicy") return applySetTargetPolicy(state, config, command);
    if (V2_ONLY_COMMAND_TYPES.indexOf(command.type) !== -1) {
      if (config.abiVersion !== 2 || !runtime) {
        return transition(state, deniedEvent(command, "unsupported-under-abi"));
      }
      if (command.type === "specializeTower") {
        return applySpecializeTower(state, config, command, runtime);
      }
      if (command.type === "activatePower") return applyActivatePower(state, config, command, runtime);
      if (command.type === "deployReinforcement") {
        return applyDeployReinforcement(state, config, command, runtime);
      }
      if (command.type === "activateMechanism") {
        return applyActivateMechanism(state, config, command, runtime);
      }
      return applyResetPlan(state, config, command, runtime);
    }
    /* ADR-014: an unknown command type is a stable denial event, never a throw. */
    return transition(state, deniedEvent(command, "unknown-command"));
  }

  function applyCommandBucket(stateInput, configInput, currentTickInput, commandInputs, limitOverrides) {
    const config = normalizeManagementConfig(configInput);
    let state = normalizeManagementState(stateInput, config);
    const limits = Commands.createCommandLimits(limitOverrides);
    const currentTick = nonnegativeInteger(currentTickInput, "Management command-bucket tick");
    if (currentTick > limits.maxTick) {
      throw new RangeError("Management command-bucket tick exceeds the maximum tick");
    }
    const commands = Commands.normalizeCommandSequence(commandInputs, limits);
    commands.forEach(function (command) {
      if (command.tick !== currentTick) {
        throw new RangeError("Every command in a management bucket must match its current tick");
      }
    });
    const events = [];
    commands.forEach(function (command) {
      const result = applyNormalizedCommand(state, config, command, null);
      state = result.state;
      events.push(result.event);
    });
    return Object.freeze({ state: state, events: freezeArray(events) });
  }

  const RUNTIME_FIELDS_V2 = Object.freeze([
    "boardBounds", "mechanism", "protocolCatalog", "protocolLoadout", "protocols", "reinforcement",
    "routes", "selectProtocolTargets", "supportedEffectKinds",
  ]);

  function normalizeCommandRuntime(input) {
    exactFields(
      Object.keys(input || {}).reduce(function (shape, key) {
        shape[key] = key === "selectProtocolTargets" ? null : input[key];
        return shape;
      }, {}),
      RUNTIME_FIELDS_V2,
      "Management command runtime"
    );
    if (typeof input.selectProtocolTargets !== "function") {
      throw new TypeError("Management command runtime requires a target-selection resolver");
    }
    return {
      boardBounds: input.boardBounds,
      mechanism: input.mechanism,
      planningBaselineTowerId: 0,
      protocolActivations: [],
      protocolCatalog: input.protocolCatalog,
      protocolLoadout: input.protocolLoadout,
      protocols: normalizeProtocolRuntime(input.protocols),
      reinforcement: input.reinforcement,
      routes: input.routes,
      selectProtocolTargets: input.selectProtocolTargets,
      supportedEffectKinds: input.supportedEffectKinds,
    };
  }

  /* ABI v2 bucket seam. Command syntax comes from commands-v2; legality, Aether, and the
     Protocol ledger stay reducer-owned exactly as they are under ABI v1. */
  function applyCommandBucketV2(stateInput, configInput, currentTickInput, commandInputs,
    runtimeInput, limitOverrides) {
    const config = normalizeManagementConfig(configInput);
    let state = normalizeManagementState(stateInput, config);
    const limits = CommandsV2.createCommandLimits(limitOverrides);
    const currentTick = nonnegativeInteger(currentTickInput, "Management command-bucket tick");
    if (currentTick > limits.maxTick) {
      throw new RangeError("Management command-bucket tick exceeds the maximum tick");
    }
    const commands = CommandsV2.normalizeCommandSequence(commandInputs, limits);
    commands.forEach(function (command) {
      if (command.tick !== currentTick) {
        throw new RangeError("Every command in a management bucket must match its current tick");
      }
    });
    const runtime = normalizeCommandRuntime(runtimeInput);
    runtime.planningBaselineTowerId = state.runtimeIds.nextByDomain.tower;
    const events = [];
    commands.forEach(function (command) {
      const result = applyNormalizedCommand(state, config, command, runtime);
      state = result.state;
      events.push(result.event);
    });
    return Object.freeze({
      state: state,
      events: freezeArray(events),
      protocols: runtime.protocols,
      protocolActivations: freezeArray(runtime.protocolActivations.slice()),
    });
  }

  /* ADR-014 disable primitives. A tower attacks only while `disableSources` is empty; an
     in-progress cooldown is never rescaled because the runtime is frozen, not retimed. */
  function withTowerDisableSources(state, config, towerRuntimeId, sources) {
    const tower = towerById(state.towers, towerRuntimeId);
    if (!tower) throw new RangeError("Unknown tower runtime ID " + towerRuntimeId);
    if (sources.length > MAX_DISABLE_SOURCES) {
      throw new RangeError("Tower disable sources exceed the bounded collection");
    }
    const updated = freezeTower({
      id: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: tower.level,
      investedAether: tower.investedAether,
      targetPolicy: tower.targetPolicy,
      specializationId: tower.specializationId,
      paidCosts: tower.paidCosts,
      disableSources: sources,
    }, 2);
    return normalizeManagementState(withState(state, { towers: replaceTower(state, updated) }), config);
  }

  function addDisableSource(stateInput, configInput, towerRuntimeId, sourceIdInput, expiryTickInput) {
    const config = normalizeManagementConfig(configInput);
    if (config.abiVersion !== 2) throw new RangeError("Disable sources require ABI v2");
    const state = normalizeManagementState(stateInput, config);
    const sourceId = lowercaseAuthoredId(sourceIdInput, "Disable source ID");
    const expiryTick = nonnegativeInteger(expiryTickInput, "Disable source expiry tick");
    const tower = towerById(state.towers, positiveInteger(towerRuntimeId, "Tower runtime ID"));
    if (!tower) throw new RangeError("Unknown tower runtime ID " + towerRuntimeId);
    const sources = tower.disableSources.filter(function (source) {
      return source.sourceId !== sourceId;
    }).concat([{ expiryTick: expiryTick, sourceId: sourceId }]);
    sources.sort(function (left, right) {
      return left.sourceId < right.sourceId ? -1 : left.sourceId > right.sourceId ? 1 : 0;
    });
    return withTowerDisableSources(state, config, tower.id, sources);
  }

  function removeDisableSource(stateInput, configInput, towerRuntimeId, sourceIdInput) {
    const config = normalizeManagementConfig(configInput);
    if (config.abiVersion !== 2) throw new RangeError("Disable sources require ABI v2");
    const state = normalizeManagementState(stateInput, config);
    const sourceId = lowercaseAuthoredId(sourceIdInput, "Disable source ID");
    const tower = towerById(state.towers, positiveInteger(towerRuntimeId, "Tower runtime ID"));
    if (!tower) throw new RangeError("Unknown tower runtime ID " + towerRuntimeId);
    return withTowerDisableSources(state, config, tower.id, tower.disableSources.filter(
      function (source) { return source.sourceId !== sourceId; }
    ));
  }

  /* Phase 2 (expiry-and-enable-transitions): a tower re-enables when its last source expires. */
  function expireDisableSources(stateInput, configInput, currentTickInput) {
    const config = normalizeManagementConfig(configInput);
    const state = normalizeManagementState(stateInput, config);
    if (config.abiVersion !== 2) {
      return Object.freeze({ state: state, enabledTowerRuntimeIds: freezeArray([]) });
    }
    const currentTick = nonnegativeInteger(currentTickInput, "Disable expiry tick");
    const enabled = [];
    const towers = freezeArray(state.towers.map(function (tower) {
      if (tower.disableSources.length === 0) return tower;
      const remaining = tower.disableSources.filter(function (source) {
        return source.expiryTick > currentTick;
      });
      if (remaining.length === tower.disableSources.length) return tower;
      if (remaining.length === 0) enabled.push(tower.id);
      return freezeTower({
        id: tower.id,
        padId: tower.padId,
        defenseId: tower.defenseId,
        level: tower.level,
        investedAether: tower.investedAether,
        targetPolicy: tower.targetPolicy,
        specializationId: tower.specializationId,
        paidCosts: tower.paidCosts,
        disableSources: remaining,
      }, 2);
    }));
    return Object.freeze({
      state: normalizeManagementState(withState(state, { towers: towers }), config),
      enabledTowerRuntimeIds: freezeArray(enabled.sort(function (left, right) {
        return left - right;
      })),
    });
  }

  function completeActiveWave(stateInput, configInput, tickInput) {
    const config = normalizeManagementConfig(configInput);
    const state = normalizeManagementState(stateInput, config);
    const tick = nonnegativeInteger(tickInput, "Wave-clear tick");
    if (state.phase !== "wave") throw new RangeError("No active wave is available to complete");
    const wave = state.activeWave;
    const campaignComplete = wave === config.waveStartGrants.length;
    const tutorialUpgradeGateOpened = wave === 1 && !state.tutorialUpgradeGateOpen;
    const nextState = withState(state, {
      phase: campaignComplete ? "complete" : "planning",
      activeWave: 0,
      clearedWaves: wave,
      tutorialUpgradeGateOpen: state.tutorialUpgradeGateOpen || wave === 1,
    });
    return transition(nextState, freezeEvent({
      type: "waveClear",
      tick: tick,
      wave: wave,
      tutorialUpgradeGateOpened: tutorialUpgradeGateOpened,
      campaignComplete: campaignComplete,
    }));
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    MANAGEMENT_SCHEMA_VERSION: MANAGEMENT_SCHEMA_VERSION,
    PHASES: PHASES,
    TUTORIAL_GATE_MODES: TUTORIAL_GATE_MODES,
    MANAGEMENT_SCHEMA_VERSION_V2: MANAGEMENT_SCHEMA_VERSION_V2,
    MAX_DISABLE_SOURCES: MAX_DISABLE_SOURCES,
    MAX_TOWER_PAID_COSTS: MAX_TOWER_PAID_COSTS,
    MAX_PROTOCOL_RUNTIME_RECORDS: MAX_PROTOCOL_RUNTIME_RECORDS,
    V2_ONLY_COMMAND_TYPES: V2_ONLY_COMMAND_TYPES,
    normalizeManagementConfig: normalizeManagementConfig,
    normalizeManagementState: normalizeManagementState,
    createManagementState: createManagementState,
    applyCommandBucket: applyCommandBucket,
    applyCommandBucketV2: applyCommandBucketV2,
    addDisableSource: addDisableSource,
    removeDisableSource: removeDisableSource,
    expireDisableSources: expireDisableSources,
    completeActiveWave: completeActiveWave,
  });
});

  /* source objectives.js bytes=13829 sha256=167481f897c1398bd16cd763708531a788aae72150225520bcba7de30f5164bd */
/* Armara Aegis deterministic Candidate-slice objective engine v1.
   Binds reviewed objective content before Start and evaluates only canonical kernel facts. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before objectives.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisObjectives")) {
    if (game.AegisObjectives !== api) throw new Error("Game.AegisObjectives is already installed");
    return;
  }
  Object.defineProperty(game, "AegisObjectives", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (ABI) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  ["assertSafeInteger", "canonicalEncode", "checkedAdd"].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  if (!ABI.DESCRIPTOR.canonicalEncoding ||
      ABI.DESCRIPTOR.canonicalEncoding.version !== 1 ||
      ABI.DESCRIPTOR.canonicalEncoding.arrays !== "authored-order") {
    throw new Error("Aegis objectives require the frozen canonical ABI v1 ordering contract");
  }

  const OBJECTIVE_SCHEMA_VERSION = 1;
  const DIFFICULTY_IDS = Object.freeze(["story", "strategos", "titan"]);
  const OUTCOMES = Object.freeze(["active", "defeat", "victory"]);
  const OBJECTIVE_IDS = Object.freeze(["victory", "integrity", "mastery"]);
  const BASE_RECORD_FIELDS = Object.freeze([
    "id", "kind", "titleKey", "descriptionKey", "progressKey",
  ]);
  const FACT_FIELDS = Object.freeze([
    "integrity", "lineageTagLeakCounts", "outcome", "ownedTowerCount", "routeLeakCounts",
  ]);
  const STABLE_LOWERCASE_ID = /^[a-z][a-z0-9._:-]*$/;
  const bindings = new WeakSet();

  function exactFields(value, expected, label) {
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

  function requireArray(value, label, exactLength) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    if (exactLength !== undefined && value.length !== exactLength) {
      throw new RangeError(label + " must contain exactly " + exactLength + " records");
    }
    return value;
  }

  function nonnegativeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return Object.is(value, -0) ? 0 : value;
  }

  function stableLowercaseId(value, label) {
    if (typeof value !== "string" || !STABLE_LOWERCASE_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase ID or string key");
    }
    return value;
  }

  function requireDifficultyId(value) {
    if (typeof value !== "string" || DIFFICULTY_IDS.indexOf(value) === -1) {
      throw new RangeError("Unknown objective difficulty ID: " + String(value));
    }
    return value;
  }

  function validatePresentationKeys(record, label) {
    stableLowercaseId(record.titleKey, label + " title key");
    stableLowercaseId(record.descriptionKey, label + " description key");
    stableLowercaseId(record.progressKey, label + " progress key");
  }

  function sortedUniqueIds(value, label, minimumLength) {
    requireArray(value, label);
    if (value.length < minimumLength) {
      throw new RangeError(label + " must contain at least " + minimumLength + " ID");
    }
    const output = [];
    let prior = null;
    value.forEach(function (id, index) {
      const normalized = stableLowercaseId(id, label + " " + index);
      if (prior !== null && prior >= normalized) {
        throw new RangeError(label + " must be unique and in strict ASCII order");
      }
      output.push(normalized);
      prior = normalized;
    });
    return Object.freeze(output);
  }

  function frozenPredicate(value) {
    return Object.freeze(value);
  }

  function frozenRecord(id, kind, predicate) {
    return Object.freeze({ id: id, kind: kind, predicate: predicate });
  }

  function bindObjectives(objectiveRecords, difficultyIdInput) {
    ABI.canonicalEncode(objectiveRecords);
    const difficultyId = requireDifficultyId(difficultyIdInput);
    requireArray(objectiveRecords, "Objective records", OBJECTIVE_IDS.length);

    const records = [];
    let routeIds = Object.freeze([]);
    let lineageTagIds = Object.freeze([]);
    objectiveRecords.forEach(function (record, index) {
      const expectedId = OBJECTIVE_IDS[index];
      const label = "Objective record " + index;
      if (!record || record.id !== expectedId || record.kind !== expectedId) {
        throw new RangeError("Objective records must remain in victory, integrity, mastery order");
      }
      stableLowercaseId(record.id, label + " ID");
      validatePresentationKeys(record, label);

      if (expectedId === "victory") {
        exactFields(record, BASE_RECORD_FIELDS.concat(["predicate"]), label);
        if (record.predicate !== "mission-victory") {
          throw new RangeError("Victory objective predicate must be mission-victory");
        }
        records.push(frozenRecord(
          "victory",
          "victory",
          frozenPredicate({ kind: "mission-victory" })
        ));
        return;
      }

      if (expectedId === "integrity") {
        exactFields(record, BASE_RECORD_FIELDS.concat(["thresholdRecords"]), label);
        requireArray(record.thresholdRecords, "Integrity threshold records", DIFFICULTY_IDS.length);
        let selectedMinimum = null;
        record.thresholdRecords.forEach(function (threshold, thresholdIndex) {
          const thresholdLabel = "Integrity threshold record " + thresholdIndex;
          exactFields(threshold, ["difficultyId", "minimumIntegrity"], thresholdLabel);
          if (threshold.difficultyId !== DIFFICULTY_IDS[thresholdIndex]) {
            throw new RangeError("Integrity threshold records must remain in difficulty order");
          }
          const minimumIntegrity = nonnegativeInteger(
            threshold.minimumIntegrity,
            thresholdLabel + " minimum integrity"
          );
          if (threshold.difficultyId === difficultyId) selectedMinimum = minimumIntegrity;
        });
        records.push(frozenRecord(
          "integrity",
          "integrity",
          frozenPredicate({ kind: "minimum-integrity", minimumIntegrity: selectedMinimum })
        ));
        return;
      }

      exactFields(record, BASE_RECORD_FIELDS.concat(["predicate"]), label);
      const predicate = record.predicate;
      if (!predicate || typeof predicate !== "object" || Array.isArray(predicate)) {
        throw new TypeError("Mastery predicate must be a plain object");
      }
      stableLowercaseId(predicate.kind, "Mastery predicate kind");
      if (predicate.kind === "maximum-owned-towers-at-victory") {
        exactFields(predicate, ["kind", "maximum"], "Maximum-tower mastery predicate");
        records.push(frozenRecord(
          "mastery",
          "mastery",
          frozenPredicate({
            kind: predicate.kind,
            maximum: nonnegativeInteger(predicate.maximum, "Maximum owned towers"),
          })
        ));
        return;
      }
      if (predicate.kind === "no-leaks-from-routes") {
        exactFields(predicate, ["kind", "routeIds"], "Route-leak mastery predicate");
        routeIds = sortedUniqueIds(predicate.routeIds, "Mastery route IDs", 1);
        records.push(frozenRecord(
          "mastery",
          "mastery",
          frozenPredicate({ kind: predicate.kind, routeIds: Object.freeze(routeIds.slice()) })
        ));
        return;
      }
      if (predicate.kind === "no-leaks-from-lineage-tag") {
        exactFields(predicate, ["kind", "lineageTag"], "Lineage-leak mastery predicate");
        const lineageTag = stableLowercaseId(predicate.lineageTag, "Mastery lineage tag");
        lineageTagIds = Object.freeze([lineageTag]);
        records.push(frozenRecord(
          "mastery",
          "mastery",
          frozenPredicate({ kind: predicate.kind, lineageTag: lineageTag })
        ));
        return;
      }
      throw new RangeError("Unsupported mastery predicate: " + String(predicate.kind));
    });

    const binding = Object.freeze({
      difficultyId: difficultyId,
      lineageTagIds: lineageTagIds,
      records: Object.freeze(records),
      routeIds: routeIds,
      schemaVersion: OBJECTIVE_SCHEMA_VERSION,
    });
    bindings.add(binding);
    return binding;
  }

  function requireBinding(binding) {
    if (!binding || typeof binding !== "object" || !bindings.has(binding) || !Object.isFrozen(binding)) {
      throw new TypeError("Objective binding must come from bindObjectives before Start");
    }
    return binding;
  }

  function validateLeakCounters(value, expectedIds, idField, label) {
    requireArray(value, label, expectedIds.length);
    const counters = value.map(function (record, index) {
      const recordLabel = label + " record " + index;
      exactFields(record, [idField, "leakCount"], recordLabel);
      const id = stableLowercaseId(record[idField], recordLabel + " ID");
      if (id !== expectedIds[index]) {
        throw new RangeError(label + " must match the binding exactly and remain in binding order");
      }
      const output = { leakCount: nonnegativeInteger(record.leakCount, recordLabel + " leak count") };
      output[idField] = id;
      if (idField === "routeId") {
        return Object.freeze({ routeId: output.routeId, leakCount: output.leakCount });
      }
      return Object.freeze({ lineageTag: output.lineageTag, leakCount: output.leakCount });
    });
    return Object.freeze(counters);
  }

  function createObjectiveFacts(bindingInput, input) {
    const binding = requireBinding(bindingInput);
    ABI.canonicalEncode(input);
    exactFields(input, FACT_FIELDS, "Objective facts");
    if (typeof input.outcome !== "string" || OUTCOMES.indexOf(input.outcome) === -1) {
      throw new RangeError("Unknown objective outcome: " + String(input.outcome));
    }
    return Object.freeze({
      integrity: nonnegativeInteger(input.integrity, "Objective integrity"),
      lineageTagLeakCounts: validateLeakCounters(
        input.lineageTagLeakCounts,
        binding.lineageTagIds,
        "lineageTag",
        "Lineage-tag leak counters"
      ),
      outcome: input.outcome,
      ownedTowerCount: nonnegativeInteger(input.ownedTowerCount, "Objective owned tower count"),
      routeLeakCounts: validateLeakCounters(
        input.routeLeakCounts,
        binding.routeIds,
        "routeId",
        "Route leak counters"
      ),
    });
  }

  function sumLeakCounters(counters) {
    let total = 0;
    counters.forEach(function (record) {
      total = ABI.checkedAdd(total, record.leakCount);
    });
    return total;
  }

  function objectiveProgress(bindingRecord, facts) {
    const predicate = bindingRecord.predicate;
    let current;
    let target;
    let relation;
    if (predicate.kind === "mission-victory") {
      current = facts.outcome === "victory" ? 1 : 0;
      target = 1;
      relation = "at-least";
    } else if (predicate.kind === "minimum-integrity") {
      current = facts.integrity;
      target = predicate.minimumIntegrity;
      relation = "at-least";
    } else if (predicate.kind === "maximum-owned-towers-at-victory") {
      current = facts.ownedTowerCount;
      target = predicate.maximum;
      relation = "at-most";
    } else if (predicate.kind === "no-leaks-from-routes") {
      current = sumLeakCounters(facts.routeLeakCounts);
      target = 0;
      relation = "at-most";
    } else if (predicate.kind === "no-leaks-from-lineage-tag") {
      current = sumLeakCounters(facts.lineageTagLeakCounts);
      target = 0;
      relation = "at-most";
    } else {
      throw new RangeError("Unsupported bound objective predicate: " + String(predicate.kind));
    }
    const eligible = relation === "at-least" ? current >= target : current <= target;
    return Object.freeze({
      complete: facts.outcome === "victory" && eligible,
      current: current,
      eligible: eligible,
      id: bindingRecord.id,
      kind: bindingRecord.kind,
      predicateKind: predicate.kind,
      relation: relation,
      target: target,
    });
  }

  function evaluateObjectives(bindingInput, factsInput) {
    const binding = requireBinding(bindingInput);
    const facts = createObjectiveFacts(binding, factsInput);
    const objectiveResults = binding.records.map(function (record) {
      return objectiveProgress(record, facts);
    });
    let completedCount = 0;
    objectiveResults.forEach(function (result) {
      if (result.complete) completedCount = ABI.checkedAdd(completedCount, 1);
    });
    return Object.freeze({
      completedCount: completedCount,
      objectiveResults: Object.freeze(objectiveResults),
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    OBJECTIVE_SCHEMA_VERSION: OBJECTIVE_SCHEMA_VERSION,
    OUTCOMES: OUTCOMES,
    bindObjectives: bindObjectives,
    createObjectiveFacts: createObjectiveFacts,
    evaluateObjectives: evaluateObjectives,
  });
});

  /* source kernel.js bytes=220836 sha256=a310b1693015937fc1126632be43549913ffb36e2915c890eed36aff51b658e6 */
/* Armara Aegis authoritative Candidate-slice fixed-tick kernel v1.
   This module binds immutable release/content identities and owns the canonical simulation state.
   Presentation, profile state, wall-clock time, and renderer callbacks are deliberately absent. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before kernel.js");
  if (!game.AegisGeometry) throw new Error("Game.AegisGeometry must be installed before kernel.js");
  if (!game.AegisTimers) throw new Error("Game.AegisTimers must be installed before kernel.js");
  if (!game.AegisEconomy) throw new Error("Game.AegisEconomy must be installed before kernel.js");
  if (!game.AegisMovement) throw new Error("Game.AegisMovement must be installed before kernel.js");
  if (!game.AegisEffects) throw new Error("Game.AegisEffects must be installed before kernel.js");
  if (!game.AegisTargeting) throw new Error("Game.AegisTargeting must be installed before kernel.js");
  if (!game.AegisBehaviors) throw new Error("Game.AegisBehaviors must be installed before kernel.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before kernel.js");
  if (!game.AegisManagement) throw new Error("Game.AegisManagement must be installed before kernel.js");
  if (!game.AegisObjectives) throw new Error("Game.AegisObjectives must be installed before kernel.js");
  if (!game.AegisSimV2) throw new Error("Game.AegisSimV2 must be installed before kernel.js");
  if (!game.AegisCommandsV2) throw new Error("Game.AegisCommandsV2 must be installed before kernel.js");
  if (!game.AegisProtocols) throw new Error("Game.AegisProtocols must be installed before kernel.js");
  if (!game.AegisRelics) throw new Error("Game.AegisRelics must be installed before kernel.js");
  const api = factory(
    game.AegisSim,
    game.AegisGeometry,
    game.AegisTimers,
    game.AegisEconomy,
    game.AegisMovement,
    game.AegisEffects,
    game.AegisTargeting,
    game.AegisBehaviors,
    game.AegisCommands,
    game.AegisManagement,
    game.AegisObjectives,
    game.AegisSimV2,
    game.AegisCommandsV2,
    game.AegisProtocols,
    game.AegisRelics
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisKernel")) {
    if (game.AegisKernel !== api) throw new Error("Game.AegisKernel is already installed");
    return;
  }
  Object.defineProperty(game, "AegisKernel", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (
  ABI,
  Geometry,
  Timers,
  Economy,
  Movement,
  Effects,
  Targeting,
  Behaviors,
  Commands,
  Management,
  Objectives,
  ABIV2,
  CommandsV2,
  Protocols,
  Relics
) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  const dependencies = [
    Geometry, Timers, Economy, Movement, Effects, Targeting, Behaviors, Commands, Management,
    Objectives,
  ];
  dependencies.forEach(function (dependency, index) {
    if (!dependency || !Object.isFrozen(dependency) ||
        dependency.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
      throw new TypeError("A frozen ABI-matched kernel dependency is required at index " + index);
    }
  });
  [
    "assertSafeInteger", "canonicalEncode", "checkedAdd", "checkedMulDivFloor", "sha256Hex",
  ].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  if (Commands.COMMAND_SCHEMA_VERSION !== ABI.DESCRIPTOR.commands.schemaVersion) {
    throw new Error("Aegis command schema identity does not match the simulation ABI");
  }
  if (Behaviors.EVENT_SCHEMA_VERSION !== ABI.EVENT_SCHEMA_VERSION ||
      Behaviors.BEHAVIOR_REGISTRY_VERSION !== ABI.BEHAVIOR_REGISTRY_VERSION) {
    throw new Error("Aegis behavior identities do not match the simulation ABI");
  }

  if (!ABIV2 || !Object.isFrozen(ABIV2) || !Object.isFrozen(ABIV2.DESCRIPTOR) ||
      ABIV2.DESCRIPTOR.version !== 2 ||
      ABIV2.BASE_ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256 ||
      ABIV2.DESCRIPTOR_SHA256 !== ABIV2.sha256Hex(ABIV2.DESCRIPTOR_CANONICAL)) {
    throw new TypeError("The authenticated frozen Aegis simulation ABI v2 is required");
  }
  [CommandsV2, Protocols, Relics].forEach(function (dependency, index) {
    if (!dependency || !Object.isFrozen(dependency) ||
        dependency.ABI_DESCRIPTOR_SHA256 !== ABIV2.DESCRIPTOR_SHA256) {
      throw new TypeError("A frozen ABI-v2-matched kernel dependency is required at index " + index);
    }
  });
  if (CommandsV2.COMMAND_SCHEMA_VERSION !== ABIV2.DESCRIPTOR.commands.schemaVersion) {
    throw new Error("Aegis command-v2 schema identity does not match the simulation ABI v2");
  }
  if (typeof Management.applyCommandBucketV2 !== "function" ||
      typeof Management.expireDisableSources !== "function" ||
      Management.MANAGEMENT_SCHEMA_VERSION_V2 !== 2) {
    throw new TypeError("A matching ABI-v2 Aegis management reducer is required");
  }
  if (typeof Behaviors.bindEventCatalogSchema !== "function") {
    throw new TypeError("A matching ABI-v2 Aegis behavior registry is required");
  }

  const KERNEL_SCHEMA_VERSION = 1;
  const KERNEL_SCHEMA_VERSION_V2 = 2;
  const BALANCE_TELEMETRY_SCHEMA_VERSION = 1;
  const MAX_ACTIVE_ENTITIES = 4096;
  const MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK = 65536;
  const MAX_BALANCE_TELEMETRY_TARGET_IDS = 4096;
  const MAX_LOADOUT_IDS = 6;
  const MAX_TARGET_CANDIDATES = 4096;
  const MAX_SEMANTIC_EVENTS_PER_TICK = 16384;
  const MAX_UINT32 = 0xffffffff;
  const HASH = /^sha256:[0-9a-f]{64}$/;
  const STABLE_LOWERCASE_ID = /^[a-z][a-z0-9._:-]*$/;
  const RELEASE_FIELDS = Object.freeze([
    "abiHash", "annexHash", "approvalState", "behaviorRegistryVersion", "contentArtifact",
    "contentHash", "contentVersion", "eventSchemaVersion", "includedIds", "presentationArtifact",
    "presentationHash", "releaseEligible", "rulesetHash", "schemaVersion", "simulationArtifact",
    "simulationHash", "sourceManifestHash", "sourceProvenance",
  ]);
  /* A schema-4 release record additionally declares the versioned contracts it binds and the
     globals its bundle installs, so the loader can authenticate an ABI-v2 build without inferring
     anything from filenames. Historical records keep the exact v3 field set above. */
  const RELEASE_FIELDS_V2 = Object.freeze(RELEASE_FIELDS.concat([
    "abiVersion", "commandSchemaVersion", "contentIds", "developerOnly",
    "replayFormatVersion", "requiredGlobals",
  ]).sort());
  const CONTENT_FIELDS = Object.freeze([
    "abiHash", "behaviorContracts", "behaviorRegistryVersion", "bosses", "campaignRules",
    "contentVersion", "defenseUnlockGrantMappings", "defenses", "enemies", "eventCatalog",
    "eventSchemaVersion", "maps", "missions", "previewProofRecords", "schemaVersion", "summons",
  ]);
  const HEADER_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId", "assist",
    "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds", "accessGrantIds",
    "tutorialUpgradeGateMode",
  ]);
  const DIFFICULTY_IDS = Object.freeze(["story", "strategos", "titan"]);

  /* ABI v2 / compiled content schema 4. Every v1 record above is retained byte-identically. */
  const MAX_PROTOCOL_EFFECTS = 64;
  const MAX_PROTOCOL_SCHEDULES = 64;
  const MAX_DISABLE_SOURCES = Management.MAX_DISABLE_SOURCES;
  const MAX_MECHANISM_ZONES = 16;
  const MAX_PROTOCOL_SLOTS = Protocols.MAX_PROTOCOL_SLOTS;
  const MAX_RELIC_IDS = 2;
  const MAX_SPECIALIZATION_ACCESS_IDS = 128;
  const MAX_UNLOCK_CATALOG_RECORDS = 128;
  const V2_UNLOCK_FIELDS = Object.freeze([
    "behaviorRegistryVersion", "commandSchemaVersion", "eventSchemaVersion", "grantRecords",
    "mechanisms", "missionProgression", "profileSchemaVersion", "protocolRules", "protocols",
    "reinforcementRules", "reinforcements", "relicRules", "relics", "replayFormatVersion",
    "schemaVersion", "specializations",
  ]);
  const CONTENT_FIELDS_V2 = Object.freeze(CONTENT_FIELDS.concat([
    "abiVersion", "commandSchemaVersion", "grantRecords", "mechanisms", "missionProgression",
    "profileSchemaVersion", "protocolRules", "protocols", "reinforcementRules", "reinforcements",
    "relicRules", "relics", "replayFormatVersion", "specializations",
  ]));
  /* `acts` is compiled narrative copy (spec 18.2). A compiled v4 artifact carries it, and the
     kernel accepts it so that artifact loads; content assembled without narrative stays legal.
     The kernel never reads it: no simulation value, header field, replay header, or record key
     derives from an act record. */
  const CONTENT_PRESENTATION_FIELDS_V2 = Object.freeze(["acts"]);

  function contentFieldsFor(content, abiVersion) {
    if (abiVersion !== 2) return CONTENT_FIELDS;
    const present = CONTENT_PRESENTATION_FIELDS_V2.filter(function (key) {
      return content !== null && typeof content === "object" && own(content, key);
    });
    return present.length === 0 ? CONTENT_FIELDS_V2 : CONTENT_FIELDS_V2.concat(present);
  }
  const HEADER_FIELDS_V2 = Object.freeze(HEADER_FIELDS.concat([
    "missionProtocolLoan", "protocolAuthority", "protocolLoadout", "protocolSlotCap", "relicIds",
    "relicSlotCap", "reinforcementId", "specializationAccessIds",
  ]));
  const SPECIALIZATION_RECORD_FIELDS = Object.freeze([
    "behaviors", "branchRoleId", "defenseId", "id", "isDefault", "level", "nameKey", "purchase",
    "rangeWorldUnits", "ui", "unlockGrantId",
  ]);
  const V2_PHASE_IDS = Object.freeze(ABIV2.DESCRIPTOR.phaseOrder.slice());
  /* Every retained ABI v1 semantic event keeps its authored phase name; the v4 catalog states the
     v2 phase it now resolves in. The alias table is the sole translation and preserves the exact
     relative order of every event a single v1 behavior emits. */
  const V1_TO_V2_PHASE_ALIASES = Object.freeze({
    "commands": "commands-and-aether-payments",
    "scheduled-spawns": "spawn-movement-control-and-contact",
    "status-expiry": "expiry-and-enable-transitions",
    "movement": "spawn-movement-control-and-contact",
    "leaks": "leak-arbitration-and-ward",
    "tower-acquisition-and-attacks": "tower-and-reinforcement-acquisition-and-attacks",
    "shield-damage-and-status": "persistent-zone-pulses-and-terminal-damage",
    "guarded-boss-threshold-transition": "persistent-zone-pulses-and-terminal-damage",
    "terminal-death-execute-children-and-revival": "persistent-zone-pulses-and-terminal-damage",
    "bounty": "bounty-income-objectives-and-score-facts",
    "wave-clear": "guarded-boss-wave-mission-transition-and-event-finalization",
  });
  const V2_EVENT_SCHEMA = Object.freeze({
    eventSchemaVersion: ABIV2.EVENT_SCHEMA_VERSION,
    phaseAliases: V1_TO_V2_PHASE_ALIASES,
    phaseOrder: V2_PHASE_IDS,
  });
  /* K1 resolves the Temporal Edict global field end to end. Every other authored effect kind is
     the next lane's work and is denied honestly rather than reported as an accepted cast. */
  const SUPPORTED_PROTOCOL_EFFECT_KINDS = Object.freeze(["global-slow-field"]);
  const RELIC_STAT_BOUNTY = "bounty";
  const RELIC_STAT_START_AETHER = "starting-aether";
  const RELIC_STAT_START_INTEGRITY = "starting-integrity";
  const TELEMETRY_RECORD_FIELDS = Object.freeze({
    "activation": Object.freeze([
      "actionId", "behaviorId", "defenseId", "eligibleTargetRuntimeIds", "kind", "level",
      "ordinal", "outcome", "padId", "selectedTargetRuntimeIds", "sourceRuntimeId",
      "sourceTowerRuntimeId",
    ]),
    "aether-transaction": Object.freeze([
      "action", "bankAfterAether", "bankBeforeAether", "bountyRemainderAfter",
      "bountyRemainderBefore", "commandSeq", "creditAether", "debitAether", "defenseId",
      "investedAfterAether", "investedBeforeAether", "kind", "levelAfter", "levelBefore",
      "ordinal", "padId", "sourceId", "towerRuntimeId",
    ]),
    "damage": Object.freeze([
      "appliedHpDamageMilli", "appliedShieldDamageMilli", "attemptedShieldDamageMilli",
      "baseDamageMilli", "damageTypeId", "defenseId", "deferredHpDamageMilli",
      "eligibleHpDamageMilli", "kind", "level", "noExternalAppliedHpDamageMilli",
      "noExternalAppliedShieldDamageMilli", "ordinal", "overkillHpDamageMilli", "padId",
      "preShieldDamageMilli", "revealSourceTowerRuntimeIds", "sourceRuntimeId",
      "sourceTowerRuntimeId", "supportSourceTowerRuntimeIds", "targetHpAfterMilli",
      "targetHpBeforeMilli", "targetLineageId", "targetOwnerId", "targetRouteId",
      "targetRuntimeId", "targetShieldAfterMilli", "targetShieldBeforeMilli",
    ]),
    "effect": Object.freeze([
      "action", "appliedDurationTimeUnits", "appliedMagnitude", "defenseId", "effectKind",
      "kind", "level", "ordinal", "outcome", "padId", "requestedDurationTimeUnits",
      "requestedMagnitude", "sourceRuntimeId", "sourceTowerRuntimeId", "statusId",
      "targetOwnerId", "targetRouteId", "targetRuntimeId",
    ]),
    "leak": Object.freeze([
      "enemyRuntimeId", "hpMilli", "integrityDamage", "kind", "lineageId", "ordinal",
      "ownerId", "routeId", "shieldMilli",
    ]),
    "movement-control": Object.freeze([
      "actualAdvanceDistance", "effectiveSpeedBp", "enemyRuntimeId", "kind", "lineageId",
      "nextRouteDistance", "ordinal", "ownerId", "priorRouteDistance", "routeId",
      "scaledReductionBp", "sourceEffectRuntimeIds", "sourceRuntimeIds",
      "sourceTowerRuntimeIds",
    ]),
    "spawn": Object.freeze([
      "baseSpeedDistanceUnitsPerSecond", "enemyRuntimeId", "entityKind", "initialShieldMilli",
      "kind", "lineageId", "maximumHpMilli", "ordinal", "ownerId", "routeId", "waveId",
    ]),
  });
  const TELEMETRY_AETHER_ACTIONS = Object.freeze([
    "build", "upgrade", "sell", "wave-start-grant", "wave-clear-grant", "bounty",
    "specialize", "protocol-cast", "reset-plan-refund",
  ]);
  const TELEMETRY_ACTIVATION_ACTIONS = Object.freeze([
    "direct-hit", "splash-blast", "mark-scan", "guard-contact", "guard-create",
  ]);
  const TELEMETRY_ACTIVATION_OUTCOMES = Object.freeze(["accepted", "no-target", "rejected"]);
  const TELEMETRY_EFFECT_ACTIONS = Object.freeze(["apply", "refresh", "remove", "expire"]);
  const TELEMETRY_EFFECT_KINDS = Object.freeze([
    "status", "delayed-status", "external-amplification", "boss-exposure",
    "resistance-override",
  ]);
  const TELEMETRY_EFFECT_OUTCOMES = Object.freeze([
    "applied", "refreshed", "removed", "expired", "rejected",
  ]);
  const BEHAVIOR_LIMITS = Object.freeze({
    maxEntities: MAX_ACTIVE_ENTITIES,
    maxEvents: MAX_SEMANTIC_EVENTS_PER_TICK,
    maxTargets: MAX_TARGET_CANDIDATES,
  });
  const bindingRecords = new WeakMap();
  const stateRecords = new WeakMap();

  function own(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

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

  function deepFreeze(value) {
    if (!value || typeof value !== "object") return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.isFrozen(value) ? value : Object.freeze(value);
  }

  function cloneCanonical(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneCanonical);
    const result = {};
    Object.keys(value).forEach(function (key) { result[key] = cloneCanonical(value[key]); });
    return result;
  }

  function frozenCanonical(value) {
    ABI.canonicalEncode(value);
    return deepFreeze(cloneCanonical(value));
  }

  function nonnegativeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return Object.is(value, -0) ? 0 : value;
  }

  function positiveInteger(value, label) {
    nonnegativeInteger(value, label);
    if (value === 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function stableId(value, label) {
    if (typeof value !== "string" || !STABLE_LOWERCASE_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase ASCII ID");
    }
    return value;
  }

  function closedValue(value, allowed, label) {
    if (allowed.indexOf(value) === -1) {
      throw new RangeError(label + " is outside the closed telemetry vocabulary");
    }
    return value;
  }

  function nullablePositiveInteger(value, label) {
    return value === null ? null : positiveInteger(value, label);
  }

  function nullableStableId(value, label) {
    return value === null ? null : stableId(value, label);
  }

  function telemetryRuntimeIds(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    if (value.length > MAX_BALANCE_TELEMETRY_TARGET_IDS) {
      throw new RangeError(label + " exceeds the telemetry target-ID ceiling");
    }
    let previous = 0;
    value.forEach(function (runtimeId, index) {
      positiveInteger(runtimeId, label + " " + index);
      if (runtimeId <= previous) throw new RangeError(label + " must be ascending and unique");
      previous = runtimeId;
    });
    return value;
  }

  function validateTelemetryRecord(record) {
    const fields = TELEMETRY_RECORD_FIELDS[record.kind];
    if (!fields) throw new RangeError("Unknown balance telemetry record kind");
    exactFields(record, fields, "Balance telemetry " + record.kind + " record");
    nonnegativeInteger(record.ordinal, "Balance telemetry ordinal");
    if (record.kind === "spawn") {
      closedValue(record.entityKind, ["enemy", "boss"], "Spawn entity kind");
      positiveInteger(record.enemyRuntimeId, "Spawn enemy runtime ID");
      stableId(record.ownerId, "Spawn owner ID");
      stableId(record.lineageId, "Spawn lineage ID");
      stableId(record.routeId, "Spawn route ID");
      stableId(record.waveId, "Spawn wave ID");
      positiveInteger(record.maximumHpMilli, "Spawn maximum HP");
      nonnegativeInteger(record.initialShieldMilli, "Spawn initial shield");
      nonnegativeInteger(record.baseSpeedDistanceUnitsPerSecond, "Spawn base speed");
      return;
    }
    if (record.kind === "aether-transaction") {
      closedValue(record.action, TELEMETRY_AETHER_ACTIONS, "Aether action");
      stableId(record.sourceId, "Aether source ID");
      if (record.commandSeq === null) {
        if (["wave-clear-grant", "bounty"].indexOf(record.action) === -1) {
          throw new TypeError("This Aether action requires a command sequence");
        }
      } else {
        nonnegativeInteger(record.commandSeq, "Aether command sequence");
        if ([
          "build", "upgrade", "sell", "wave-start-grant", "specialize", "protocol-cast",
          "reset-plan-refund",
        ].indexOf(record.action) === -1) {
          throw new TypeError("Internal Aether actions cannot carry a command sequence");
        }
      }
      const towerAction = ["build", "upgrade", "sell", "specialize"].indexOf(record.action) !== -1;
      ["towerRuntimeId", "levelBefore", "levelAfter"].forEach(function (field) {
        if (towerAction) nonnegativeInteger(record[field], "Aether " + field);
        else if (record[field] !== null) throw new TypeError("Internal Aether identity must be null");
      });
      ["padId", "defenseId"].forEach(function (field) {
        if (towerAction) stableId(record[field], "Aether " + field);
        else if (record[field] !== null) throw new TypeError("Internal Aether identity must be null");
      });
      if (towerAction) positiveInteger(record.towerRuntimeId, "Aether tower runtime ID");
      ["investedBeforeAether", "investedAfterAether"].forEach(function (field) {
        if (towerAction) nonnegativeInteger(record[field], "Aether " + field);
        else if (record[field] !== null) throw new TypeError("Internal investment must be null");
      });
      [
        "debitAether", "creditAether", "bankBeforeAether", "bankAfterAether",
        "bountyRemainderBefore", "bountyRemainderAfter",
      ].forEach(function (field) { nonnegativeInteger(record[field], "Aether " + field); });
      if (record.action === "build" &&
          (record.levelBefore !== 0 || record.investedBeforeAether !== 0)) {
        throw new RangeError("Build telemetry must start at zero level and investment");
      }
      if (record.action === "sell" &&
          (record.levelAfter !== 0 || record.investedAfterAether !== 0)) {
        throw new RangeError("Sell telemetry must end at zero level and investment");
      }
      const expectedBank = ABI.checkedAdd(
        ABI.checkedAdd(record.bankBeforeAether, -record.debitAether),
        record.creditAether
      );
      if (record.bankAfterAether !== expectedBank) {
        throw new RangeError("Aether transaction does not conserve its bank delta");
      }
      return;
    }
    if (record.kind === "activation") {
      closedValue(record.actionId, TELEMETRY_ACTIVATION_ACTIONS, "Activation action");
      stableId(record.behaviorId, "Activation behavior ID");
      positiveInteger(record.sourceTowerRuntimeId, "Activation source tower runtime ID");
      positiveInteger(record.sourceRuntimeId, "Activation source runtime ID");
      stableId(record.defenseId, "Activation defense ID");
      positiveInteger(record.level, "Activation level");
      stableId(record.padId, "Activation pad ID");
      closedValue(record.outcome, TELEMETRY_ACTIVATION_OUTCOMES, "Activation outcome");
      telemetryRuntimeIds(record.eligibleTargetRuntimeIds, "Activation eligible targets");
      telemetryRuntimeIds(record.selectedTargetRuntimeIds, "Activation selected targets");
      return;
    }
    if (record.kind === "movement-control") {
      positiveInteger(record.enemyRuntimeId, "Movement enemy runtime ID");
      stableId(record.ownerId, "Movement owner ID");
      stableId(record.lineageId, "Movement lineage ID");
      stableId(record.routeId, "Movement route ID");
      [
        "priorRouteDistance", "nextRouteDistance", "actualAdvanceDistance", "effectiveSpeedBp",
        "scaledReductionBp",
      ].forEach(function (field) { nonnegativeInteger(record[field], "Movement " + field); });
      telemetryRuntimeIds(record.sourceEffectRuntimeIds, "Movement effect sources");
      telemetryRuntimeIds(record.sourceRuntimeIds, "Movement runtime sources");
      telemetryRuntimeIds(record.sourceTowerRuntimeIds, "Movement tower sources");
      if (record.sourceEffectRuntimeIds.length !== record.sourceRuntimeIds.length) {
        throw new RangeError("Movement effect and runtime source arrays must align");
      }
      return;
    }
    if (record.kind === "damage") {
      /* ADR-014: a damage record carries a tower identity only when its combat source is a
         `tower`. Protocol, mechanism, and unit sources earn no defense attribution, so their
         four tower-identity fields are null together and never partially populated. */
      positiveInteger(record.sourceRuntimeId, "Damage source runtime ID");
      if (record.sourceTowerRuntimeId === null) {
        ["defenseId", "level", "padId"].forEach(function (field) {
          if (record[field] !== null) {
            throw new TypeError("A non-tower damage source cannot carry tower attribution");
          }
        });
      } else {
        positiveInteger(record.sourceTowerRuntimeId, "Damage source tower runtime ID");
        stableId(record.defenseId, "Damage defense ID");
        positiveInteger(record.level, "Damage level");
        stableId(record.padId, "Damage pad ID");
      }
      positiveInteger(record.targetRuntimeId, "Damage target runtime ID");
      stableId(record.targetOwnerId, "Damage target owner ID");
      stableId(record.targetLineageId, "Damage target lineage ID");
      stableId(record.targetRouteId, "Damage target route ID");
      stableId(record.damageTypeId, "Damage type ID");
      [
        "baseDamageMilli", "preShieldDamageMilli", "attemptedShieldDamageMilli",
        "appliedShieldDamageMilli", "eligibleHpDamageMilli", "appliedHpDamageMilli",
        "deferredHpDamageMilli", "overkillHpDamageMilli", "noExternalAppliedShieldDamageMilli",
        "noExternalAppliedHpDamageMilli", "targetShieldBeforeMilli", "targetShieldAfterMilli",
        "targetHpBeforeMilli", "targetHpAfterMilli",
      ].forEach(function (field) { nonnegativeInteger(record[field], "Damage " + field); });
      telemetryRuntimeIds(record.supportSourceTowerRuntimeIds, "Damage support sources");
      telemetryRuntimeIds(record.revealSourceTowerRuntimeIds, "Damage Reveal sources");
      return;
    }
    if (record.kind === "effect") {
      closedValue(record.action, TELEMETRY_EFFECT_ACTIONS, "Effect action");
      nullablePositiveInteger(record.sourceTowerRuntimeId, "Effect source tower runtime ID");
      positiveInteger(record.sourceRuntimeId, "Effect source runtime ID");
      nullableStableId(record.defenseId, "Effect defense ID");
      if (record.level !== null) positiveInteger(record.level, "Effect level");
      nullableStableId(record.padId, "Effect pad ID");
      const provenance = [record.sourceTowerRuntimeId, record.defenseId, record.level, record.padId];
      if (provenance.some(function (value) { return value === null; }) &&
          !provenance.every(function (value) { return value === null; })) {
        throw new TypeError("Effect tower provenance must be wholly present or absent");
      }
      positiveInteger(record.targetRuntimeId, "Effect target runtime ID");
      stableId(record.targetOwnerId, "Effect target owner ID");
      stableId(record.targetRouteId, "Effect target route ID");
      closedValue(record.effectKind, TELEMETRY_EFFECT_KINDS, "Effect runtime kind");
      stableId(record.statusId, "Effect status ID");
      [
        "requestedMagnitude", "appliedMagnitude", "requestedDurationTimeUnits",
        "appliedDurationTimeUnits",
      ].forEach(function (field) { nonnegativeInteger(record[field], "Effect " + field); });
      closedValue(record.outcome, TELEMETRY_EFFECT_OUTCOMES, "Effect outcome");
      return;
    }
    if (record.kind === "leak") {
      positiveInteger(record.enemyRuntimeId, "Leak enemy runtime ID");
      stableId(record.ownerId, "Leak owner ID");
      stableId(record.lineageId, "Leak lineage ID");
      stableId(record.routeId, "Leak route ID");
      ["hpMilli", "shieldMilli", "integrityDamage"].forEach(function (field) {
        nonnegativeInteger(record[field], "Leak " + field);
      });
    }
  }

  function createTelemetryCollector(tickInput) {
    const tick = nonnegativeInteger(tickInput, "Balance telemetry tick");
    const records = [];
    return Object.freeze({
      finish: function () {
        return frozenCanonical({
          schemaVersion: BALANCE_TELEMETRY_SCHEMA_VERSION,
          tick: tick,
          records: records,
        });
      },
      push: function (kind, values) {
        if (records.length >= MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK) {
          throw new RangeError("Balance telemetry exceeds the per-tick record ceiling");
        }
        if (!TELEMETRY_RECORD_FIELDS[kind]) {
          throw new RangeError("Unknown balance telemetry record kind");
        }
        const record = Object.assign({ kind: kind, ordinal: records.length }, values);
        validateTelemetryRecord(record);
        const frozen = frozenCanonical(record);
        records.push(frozen);
        return frozen;
      },
    });
  }

  function hash(value, label) {
    if (typeof value !== "string" || !HASH.test(value)) {
      throw new TypeError(label + " must be lowercase sha256:<64-hex>");
    }
    return value;
  }

  function booleanValue(value, label) {
    if (typeof value !== "boolean") throw new TypeError(label + " must be boolean");
    return value;
  }

  function requireFrozenArtifact(value, label) {
    if (!Object.isFrozen(value)) throw new TypeError(label + " must be an immutable compiled artifact");
    return value;
  }

  function idArray(value, label, options) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    const output = [];
    const seen = new Set();
    let previous = null;
    value.forEach(function (candidate, index) {
      const id = stableId(candidate, label + " " + index);
      if (seen.has(id)) throw new RangeError(label + " cannot contain duplicate IDs");
      if (options && options.sorted && previous !== null && id <= previous) {
        throw new RangeError(label + " must be in strict ASCII order");
      }
      seen.add(id);
      output.push(id);
      previous = id;
    });
    if (options && own(options, "maximum") && output.length > options.maximum) {
      throw new RangeError(label + " exceeds its maximum count");
    }
    if (options && options.nonempty && output.length === 0) {
      throw new RangeError(label + " must not be empty");
    }
    return Object.freeze(output);
  }

  function objectRecord(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be an object record");
    }
    return value;
  }

  function sortedObjectIds(record, label) {
    objectRecord(record, label);
    const ids = Object.keys(record).sort();
    ids.forEach(function (id) { stableId(id, label + " ID"); });
    return ids;
  }

  function sameIds(actual, expected, label) {
    if (!Array.isArray(actual) || actual.length !== expected.length ||
        actual.some(function (id, index) { return id !== expected[index]; })) {
      throw new RangeError(label + " does not match compiled content");
    }
  }

  function artifactName(prefix, digest, suffix) {
    return prefix + digest.slice("sha256:".length) + suffix;
  }

  function pad3(value) {
    return String(value).padStart(3, "0");
  }

  /* ADR-014 / plan 20.3: the authenticated compiled content schema selects the ABI version.
     `3` binds ABI v1 with byte-identical historical outcomes; `4` binds ABI v2. */
  function bindingAbiVersion(release, content) {
    if (content.schemaVersion === 3 && release.schemaVersion === 3) return 1;
    if (content.schemaVersion === 4 && release.schemaVersion === 4) return 2;
    throw new RangeError("Kernel requires matching release/content schema version 3 or 4");
  }

  function validateUnlockCollections(content) {
    V2_UNLOCK_FIELDS.forEach(function (field) {
      if (!own(content, field)) {
        throw new RangeError("Compiled v4 content is missing its unlock record " + field);
      }
    });
    if (content.commandSchemaVersion !== ABIV2.COMMAND_SCHEMA_VERSION ||
        content.replayFormatVersion !== ABIV2.DESCRIPTOR.replay.formatVersion) {
      throw new RangeError("Compiled v4 content command/replay identities do not match ABI v2");
    }
    ["mechanisms", "protocols", "reinforcements", "relics", "grantRecords", "missionProgression"]
      .forEach(function (field) {
        if (!Array.isArray(content[field]) || content[field].length > MAX_UNLOCK_CATALOG_RECORDS) {
          throw new RangeError("Compiled v4 unlock collection " + field + " must be bounded");
        }
      });
    objectRecord(content.specializations, "Compiled specializations");
    const specializationIds = sortedObjectIds(content.specializations, "Compiled specializations");
    if (specializationIds.length > MAX_UNLOCK_CATALOG_RECORDS) {
      throw new RangeError("Compiled specializations exceed the bounded catalog");
    }
    specializationIds.forEach(function (specializationId) {
      const record = content.specializations[specializationId];
      exactFields(record, SPECIALIZATION_RECORD_FIELDS, "Specialization " + specializationId);
      if (record.id !== specializationId || record.level !== 3 ||
          !content.defenses[record.defenseId] ||
          record.purchase.kind !== "specialize" ||
          !Array.isArray(record.behaviors)) {
        throw new RangeError("Specialization record does not match " + specializationId);
      }
      positiveInteger(record.purchase.costAether, "Specialization " + specializationId + " cost");
      positiveInteger(record.rangeWorldUnits, "Specialization " + specializationId + " range");
      booleanValue(record.isDefault, "Specialization " + specializationId + " default flag");
    });
    sortedObjectIds(content.defenses, "Compiled defenses").forEach(function (defenseId) {
      const defense = content.defenses[defenseId];
      if (!Array.isArray(defense.levels) || defense.levels.length !== 2) {
        throw new RangeError("Compiled v4 defense " + defenseId + " must declare two paid levels");
      }
      const branchIds = defense.specializationIds;
      if (!Array.isArray(branchIds) || branchIds.length !== 2) {
        throw new RangeError("Compiled v4 defense " + defenseId + " must declare two branches");
      }
      branchIds.forEach(function (branchId) {
        const record = content.specializations[branchId];
        if (!record || record.defenseId !== defenseId) {
          throw new RangeError("Defense " + defenseId + " references a foreign branch " + branchId);
        }
      });
      if (content.specializations[branchIds[0]].isDefault !== true ||
          content.specializations[branchIds[1]].isDefault !== false) {
        throw new RangeError("Defense " + defenseId + " branches must list its default first");
      }
    });
    sortedObjectIds(content.missions, "Compiled missions").forEach(function (missionId) {
      const mission = content.missions[missionId];
      if (!own(mission, "protocolLoan") || !own(mission, "mechanism") ||
          !own(mission, "reinforcementMarkers") || !Array.isArray(mission.reinforcementMarkers)) {
        throw new RangeError("Compiled v4 mission " + missionId + " is missing its unlock records");
      }
      if (mission.protocolLoan !== null) {
        exactFields(mission.protocolLoan, ["protocolId", "tier"], "Mission " + missionId + " loan");
        if (mission.protocolLoan.tier !== 1) {
          throw new RangeError("Mission " + missionId + " Protocol loan must be Tier 1");
        }
      }
    });
    return Object.freeze(V2_UNLOCK_FIELDS.reduce(function (record, field) {
      record[field] = content[field];
      return record;
    }, {}));
  }

  function validateReleaseAndContent(release, content) {
    requireFrozenArtifact(release, "Release record");
    requireFrozenArtifact(content, "Simulation content");
    const abiVersion = bindingAbiVersion(release, content);
    exactFields(
      release,
      abiVersion === 2 ? RELEASE_FIELDS_V2 : RELEASE_FIELDS,
      "Release record"
    );
    const abi = abiVersion === 2 ? ABIV2 : ABI;
    exactFields(content, contentFieldsFor(content, abiVersion), "Simulation content");
    const releaseAbiHash = hash(release.abiHash, "Release ABI hash");
    if (hash(content.abiHash, "Content ABI hash") !== releaseAbiHash) {
      throw new RangeError("Release and content ABI identities do not match");
    }
    if (abiVersion === 2 && releaseAbiHash !== "sha256:" + ABIV2.DESCRIPTOR_SHA256) {
      throw new RangeError("Release ABI identity does not match the authenticated simulation ABI v2");
    }
    stableId(release.contentVersion, "Release content version");
    if (content.contentVersion !== release.contentVersion) {
      throw new RangeError("Release and content versions do not match");
    }
    if (release.eventSchemaVersion !== abi.EVENT_SCHEMA_VERSION ||
        content.eventSchemaVersion !== abi.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Release/content event schema does not match the simulation ABI");
    }
    if (release.behaviorRegistryVersion !== abi.BEHAVIOR_REGISTRY_VERSION ||
        content.behaviorRegistryVersion !== abi.BEHAVIOR_REGISTRY_VERSION ||
        (abiVersion === 1 && release.behaviorRegistryVersion !== Behaviors.BEHAVIOR_REGISTRY_VERSION)) {
      throw new RangeError("Release/content behavior registry does not match the simulation artifact");
    }
    if (ABI.canonicalEncode(content.behaviorContracts) !== ABI.canonicalEncode(abi.BEHAVIOR_CONTRACTS)) {
      throw new RangeError("Compiled behavior contracts do not match the simulation ABI");
    }
    const rulesetHash = hash(release.rulesetHash, "Release ruleset hash");
    const simulationHash = hash(release.simulationHash, "Release simulation hash");
    const contentHash = hash(release.contentHash, "Release content hash");
    if (release.simulationArtifact !== artifactName("aegis-sim.", simulationHash, ".js")) {
      throw new RangeError("Simulation artifact name does not match its release hash");
    }
    if (release.contentArtifact !== artifactName("aegis-content.", contentHash, ".js")) {
      throw new RangeError("Content artifact name does not match its release hash");
    }
    if (!release.includedIds || typeof release.includedIds !== "object" ||
        Array.isArray(release.includedIds)) {
      throw new TypeError("Release included IDs must be an object");
    }
    exactFields(
      release.includedIds,
      abiVersion === 2
        ? ["bosses", "defenses", "enemies", "missions", "specializations"]
        : ["bosses", "defenses", "enemies", "missions"],
      "Included IDs"
    );
    sameIds(release.includedIds.bosses, sortedObjectIds(content.bosses, "Compiled bosses"), "Included bosses");
    sameIds(
      release.includedIds.defenses,
      sortedObjectIds(content.defenses, "Compiled defenses"),
      "Included defenses"
    );
    sameIds(release.includedIds.enemies, sortedObjectIds(content.enemies, "Compiled enemies"), "Included enemies");
    sameIds(release.includedIds.missions, sortedObjectIds(content.missions, "Compiled missions"), "Included missions");
    objectRecord(content.maps, "Compiled maps");
    objectRecord(content.campaignRules, "Compiled campaign rules");
    objectRecord(content.eventCatalog, "Compiled semantic event catalog");
    if (abiVersion === 2) Behaviors.bindEventCatalogSchema(content.eventCatalog, V2_EVENT_SCHEMA);
    Object.keys(content.eventCatalog).forEach(function (eventId) {
      const definition = content.eventCatalog[eventId];
      if (!definition || definition.id !== eventId || definition.version !== abi.EVENT_SCHEMA_VERSION) {
        throw new RangeError("Compiled semantic event identity/version does not match " + eventId);
      }
      if (abiVersion === 2 && V2_PHASE_IDS.indexOf(definition.phaseId) === -1) {
        throw new RangeError("Compiled semantic event phase is not an ABI v2 phase: " + eventId);
      }
    });
    return Object.freeze({
      abiVersion: abiVersion,
      contentHash: contentHash,
      releaseAbiHash: releaseAbiHash,
      rulesetHash: rulesetHash,
      simulationHash: simulationHash,
      unlocks: abiVersion === 2 ? validateUnlockCollections(content) : null,
    });
  }

  function compiledRoute(map, routeSource) {
    const lanes = Object.create(null);
    map.laneSegments.forEach(function (lane) { lanes[lane.id] = lane; });
    if (!Array.isArray(routeSource.laneSegmentIds) ||
        !Array.isArray(routeSource.segmentOffsets) ||
        routeSource.laneSegmentIds.length !== routeSource.segmentOffsets.length) {
      throw new TypeError("Compiled route lane IDs and offsets must have equal array lengths");
    }
    const segments = [];
    routeSource.laneSegmentIds.forEach(function (laneId, laneIndex) {
      const lane = lanes[laneId];
      if (!lane || !lane.compiled || !Array.isArray(lane.compiled.subsegments)) {
        throw new RangeError("Compiled route references an unknown normalized lane segment " + laneId);
      }
      const offset = routeSource.segmentOffsets[laneIndex];
      if (!offset || offset.laneSegmentId !== laneId || offset.routeOffset < 0) {
        throw new RangeError("Compiled route segment offset does not match " + laneId);
      }
      lane.compiled.subsegments.forEach(function (segment) {
        const index = segments.length;
        segments.push({
          id: laneId + ":s" + pad3(segment.index),
          index: index,
          start: ABI.checkedAdd(offset.routeOffset, segment.start),
          length: segment.length,
          fromX: segment.fromX,
          fromY: segment.fromY,
          toX: segment.toX,
          toY: segment.toY,
          deltaX: segment.deltaX,
          deltaY: segment.deltaY,
        });
      });
    });
    return Geometry.freezeCompiledRoute({ id: routeSource.id, length: routeSource.length, segments: segments });
  }

  function compileMap(map, missionId) {
    objectRecord(map, "Compiled map " + missionId);
    if (map.id !== missionId || !Array.isArray(map.routes) || !Array.isArray(map.laneSegments) ||
        !Array.isArray(map.pads)) {
      throw new RangeError("Mission " + missionId + " compiled map identity/arrays are invalid");
    }
    const routes = map.routes.map(function (route) { return compiledRoute(map, route); });
    const routeIds = routes.map(function (route) { return route.id; });
    if (new Set(routeIds).size !== routeIds.length) throw new RangeError("Compiled map route IDs must be unique");
    const pads = map.pads.map(function (pad) {
      return Object.freeze({ id: stableId(pad.id, "Compiled pad ID"), x: pad.x, y: pad.y });
    });
    if (new Set(pads.map(function (pad) { return pad.id; })).size !== pads.length) {
      throw new RangeError("Compiled map pad IDs must be unique");
    }
    return Object.freeze({
      map: map,
      pads: Object.freeze(pads),
      routes: Object.freeze(routes),
    });
  }

  function createRulesetBinding(input) {
    exactFields(input, ["release", "content"], "Ruleset binding input");
    const release = input.release;
    const content = input.content;
    const identities = validateReleaseAndContent(release, content);
    const missions = Object.create(null);
    const missionIds = release.includedIds.missions.slice();
    missionIds.forEach(function (missionId) {
      const mission = content.missions[missionId];
      if (!mission || mission.id !== missionId) {
        throw new RangeError("Compiled mission identity does not match " + missionId);
      }
      const map = content.maps[mission.mapId];
      if (!map) throw new RangeError("Mission " + missionId + " references an unknown compiled map");
      const objectiveBindings = Object.freeze({
        story: Objectives.bindObjectives(mission.objectives, "story"),
        strategos: Objectives.bindObjectives(mission.objectives, "strategos"),
        titan: Objectives.bindObjectives(mission.objectives, "titan"),
      });
      missions[missionId] = Object.freeze({
        map: compileMap(map, mission.mapId),
        mission: mission,
        objectiveBindings: objectiveBindings,
      });
    });
    const abi = identities.abiVersion === 2 ? ABIV2 : ABI;
    const binding = Object.freeze({
      abiHash: release.abiHash,
      abiVersion: identities.abiVersion,
      behaviorRegistryVersion: abi.BEHAVIOR_REGISTRY_VERSION,
      contentVersion: release.contentVersion,
      eventSchemaVersion: abi.EVENT_SCHEMA_VERSION,
      missionIds: Object.freeze(missionIds),
      rulesetHash: identities.rulesetHash,
      simulationHash: identities.simulationHash,
    });
    bindingRecords.set(binding, Object.freeze({
      abiVersion: identities.abiVersion,
      content: content,
      missions: missions,
      protocolCatalog: identities.abiVersion === 2
        ? Protocols.adaptCompiledProtocolContent(identities.unlocks) : null,
      release: release,
    }));
    return binding;
  }

  function requireBinding(binding) {
    const record = bindingRecords.get(binding);
    if (!record || !Object.isFrozen(binding)) {
      throw new TypeError("Ruleset binding must come from createRulesetBinding before Start");
    }
    return record;
  }

  function difficultyById(campaignRules, difficultyId) {
    if (DIFFICULTY_IDS.indexOf(difficultyId) === -1) {
      throw new RangeError("Unknown difficulty ID: " + difficultyId);
    }
    const record = campaignRules.difficultyPresets.find(function (candidate) {
      return candidate.id === difficultyId;
    });
    if (!record) throw new RangeError("Compiled content does not define difficulty " + difficultyId);
    return record;
  }

  function modifierAether(campaignRules, modifierIds) {
    let total = 0;
    modifierIds.forEach(function (modifierId) {
      const record = campaignRules.campaignModifierRecords.find(function (candidate) {
        return candidate.id === modifierId;
      });
      if (!record) throw new RangeError("Unknown campaign modifier " + modifierId);
      if (record.kind !== "start-aether-add" || record.scope !== "campaign") {
        throw new RangeError("Unsupported campaign modifier rule " + modifierId);
      }
      total = ABI.checkedAdd(total, nonnegativeInteger(record.amountAether, "Campaign modifier Aether"));
    });
    return total;
  }

  function validateLoadout(content, mission, header) {
    const available = new Set(mission.availableDefenseIds);
    const grants = new Set(header.accessGrantIds);
    const unlockByDefense = Object.create(null);
    content.defenseUnlockGrantMappings.forEach(function (mapping) {
      unlockByDefense[mapping.defenseId] = mapping.accessGrantId;
    });
    header.loadoutIds.forEach(function (defenseId) {
      if (!available.has(defenseId) || !content.defenses[defenseId]) {
        throw new RangeError("Loadout defense is not available for this mission: " + defenseId);
      }
      if (!unlockByDefense[defenseId] || !grants.has(unlockByDefense[defenseId])) {
        throw new RangeError("Loadout defense lacks its resolved access grant: " + defenseId);
      }
    });
    content.campaignRules.accessGrantIds.forEach(function (grantId) {
      stableId(grantId, "Compiled access grant ID");
    });
    header.accessGrantIds.forEach(function (grantId) {
      if (content.campaignRules.accessGrantIds.indexOf(grantId) === -1) {
        throw new RangeError("Unknown resolved access grant " + grantId);
      }
    });
  }

  function normalizeHeader(binding, record, input) {
    exactFields(input, HEADER_FIELDS, "Kernel replay header");
    if (input.formatVersion !== 1) throw new RangeError("Kernel replay format version must be 1");
    if (hash(input.rulesetHash, "Replay ruleset hash") !== binding.rulesetHash) {
      throw new RangeError("Replay ruleset identity does not match the binding");
    }
    if (input.eventSchemaVersion !== ABI.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Replay event schema does not match the simulation ABI");
    }
    const missionId = stableId(input.missionId, "Replay mission ID");
    if (!record.missions[missionId]) throw new RangeError("Replay mission is not in the bound release");
    const difficultyId = stableId(input.difficultyId, "Replay difficulty ID");
    difficultyById(record.content.campaignRules, difficultyId);
    const assist = booleanValue(input.assist, "Replay Assist flag");
    const seed = nonnegativeInteger(input.seed, "Replay seed");
    if (seed > MAX_UINT32) throw new RangeError("Replay seed must be an unsigned 32-bit integer");
    const loadoutIds = idArray(input.loadoutIds, "Replay loadout IDs", {
      maximum: MAX_LOADOUT_IDS,
      nonempty: true,
    });
    const loadoutSlotCap = positiveInteger(input.loadoutSlotCap, "Replay loadout slot cap");
    if (loadoutSlotCap > MAX_LOADOUT_IDS) {
      throw new RangeError("Replay loadout slot cap cannot exceed six");
    }
    if (loadoutIds.length > loadoutSlotCap) throw new RangeError("Replay loadout exceeds its slot cap");
    const campaignModifierIds = idArray(
      input.campaignModifierIds,
      "Replay campaign modifier IDs",
      { maximum: 64, sorted: true }
    );
    const accessGrantIds = idArray(input.accessGrantIds, "Replay access grant IDs", { maximum: 64 });
    const tutorialUpgradeGateMode = stableId(
      input.tutorialUpgradeGateMode,
      "Replay Tutorial Upgrade gate mode"
    );
    if (ABI.DESCRIPTOR.tutorialUpgradeGate.modes.indexOf(tutorialUpgradeGateMode) === -1) {
      throw new RangeError("Unsupported Tutorial Upgrade gate mode " + tutorialUpgradeGateMode);
    }
    return Object.freeze({
      accessGrantIds: accessGrantIds,
      assist: assist,
      campaignModifierIds: campaignModifierIds,
      difficultyId: difficultyId,
      eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
      formatVersion: 1,
      loadoutIds: loadoutIds,
      loadoutSlotCap: loadoutSlotCap,
      missionId: missionId,
      rulesetHash: binding.rulesetHash,
      seed: seed,
      tutorialUpgradeGateMode: tutorialUpgradeGateMode,
    });
  }

  function normalizeHeaderV2(binding, record, input) {
    exactFields(input, HEADER_FIELDS_V2, "Kernel replay-v2 header");
    if (input.formatVersion !== 2) throw new RangeError("Kernel replay format version must be 2");
    if (input.eventSchemaVersion !== ABIV2.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Replay event schema does not match the simulation ABI");
    }
    const base = normalizeHeader(binding, record, {
      accessGrantIds: input.accessGrantIds,
      assist: input.assist,
      campaignModifierIds: input.campaignModifierIds,
      difficultyId: input.difficultyId,
      eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
      formatVersion: 1,
      loadoutIds: input.loadoutIds,
      loadoutSlotCap: input.loadoutSlotCap,
      missionId: input.missionId,
      rulesetHash: input.rulesetHash,
      seed: input.seed,
      tutorialUpgradeGateMode: input.tutorialUpgradeGateMode,
    });
    const content = record.content;
    const mission = record.missions[base.missionId].mission;
    const protocolSlotCap = nonnegativeInteger(input.protocolSlotCap, "Protocol slot cap");
    if (protocolSlotCap > MAX_PROTOCOL_SLOTS) {
      throw new RangeError("Protocol slot cap cannot exceed " + MAX_PROTOCOL_SLOTS);
    }
    /* Equipped tier <= permanent authority, Tier-1 loans, and unknown IDs are all rejected by
       the owning Protocol resolver rather than re-implemented here. */
    const loadout = Protocols.normalizeProtocolLoadout({
      slotCap: protocolSlotCap,
      protocolAuthority: input.protocolAuthority,
      protocols: input.protocolLoadout,
      missionLoan: input.missionProtocolLoan,
    }, record.protocolCatalog);
    const authoredLoan = mission.protocolLoan;
    if (ABI.canonicalEncode(loadout.missionLoan) !== ABI.canonicalEncode(authoredLoan)) {
      throw new RangeError("Replay Protocol loan does not match the authored mission loan");
    }
    const relicSlotCap = nonnegativeInteger(input.relicSlotCap, "Relic slot cap");
    if (relicSlotCap > MAX_RELIC_IDS) {
      throw new RangeError("Relic slot cap cannot exceed " + MAX_RELIC_IDS);
    }
    const relicIds = idArray(input.relicIds, "Replay Relic IDs", {
      maximum: MAX_RELIC_IDS,
      sorted: true,
    });
    if (relicIds.length > relicSlotCap) throw new RangeError("Replay Relics exceed the Relic slot cap");
    Relics.resolveRelicLoadout(content.relics, relicIds, relicSlotCap);
    const reinforcementId = nullableStableId(input.reinforcementId, "Replay reinforcement ID");
    if (reinforcementId !== null && !content.reinforcements.some(function (record2) {
      return record2.id === reinforcementId;
    })) {
      throw new RangeError("Replay reinforcement is not in the bound release");
    }
    const specializationAccessIds = idArray(
      input.specializationAccessIds,
      "Replay specialization access IDs",
      { maximum: MAX_SPECIALIZATION_ACCESS_IDS, sorted: true }
    );
    specializationAccessIds.forEach(function (specializationId) {
      if (!content.specializations[specializationId]) {
        throw new RangeError("Unknown specialization access grant " + specializationId);
      }
    });
    return Object.freeze({
      accessGrantIds: base.accessGrantIds,
      assist: base.assist,
      campaignModifierIds: base.campaignModifierIds,
      difficultyId: base.difficultyId,
      eventSchemaVersion: ABIV2.EVENT_SCHEMA_VERSION,
      formatVersion: 2,
      loadoutIds: base.loadoutIds,
      loadoutSlotCap: base.loadoutSlotCap,
      missionId: base.missionId,
      missionProtocolLoan: loadout.missionLoan,
      protocolAuthority: loadout.protocolAuthority,
      protocolLoadout: loadout.protocols,
      protocolSlotCap: protocolSlotCap,
      relicIds: Object.freeze(relicIds),
      relicSlotCap: relicSlotCap,
      reinforcementId: reinforcementId,
      rulesetHash: base.rulesetHash,
      seed: base.seed,
      specializationAccessIds: Object.freeze(specializationAccessIds),
      tutorialUpgradeGateMode: base.tutorialUpgradeGateMode,
    });
  }

  function relicModifierByStat(relics, statId) {
    for (let index = 0; index < relics.modifiers.length; index++) {
      if (relics.modifiers[index].statId === statId) return relics.modifiers[index];
    }
    return null;
  }

  function relicAdditiveAmount(relics, statId) {
    const modifier = relicModifierByStat(relics, statId);
    return modifier === null ? 0 : modifier.amount;
  }

  function relicBountyBp(relics) {
    const modifier = relicModifierByStat(relics, RELIC_STAT_BOUNTY);
    return modifier === null ? null : modifier.amount;
  }

  function managementConfigV2(content, missionRuntime, header, resolvedStartAether, relics) {
    const base = managementConfigInput(content, missionRuntime, header, resolvedStartAether);
    const specializations = Object.keys(content.specializations).sort().map(function (id) {
      const record = content.specializations[id];
      return {
        costAether: record.purchase.costAether,
        defenseId: record.defenseId,
        id: record.id,
      };
    });
    return Management.normalizeManagementConfig({
      abiVersion: 2,
      defenses: base.defenses,
      missionId: base.missionId,
      padIds: base.padIds,
      relicModifiers: relics.modifiers.map(function (modifier) {
        return {
          amount: modifier.amount,
          operation: modifier.operation,
          rounding: modifier.rounding,
          statId: modifier.statId,
        };
      }),
      resolvedStartAether: resolvedStartAether,
      specializationAccessIds: header.specializationAccessIds.slice(),
      specializations: specializations,
      tutorialUpgradeGateMode: base.tutorialUpgradeGateMode,
      waveStartGrants: base.waveStartGrants,
    });
  }

  function managementConfigInput(content, missionRuntime, header, resolvedStartAether) {
    const mission = missionRuntime.mission;
    return {
      missionId: mission.id,
      resolvedStartAether: resolvedStartAether,
      tutorialUpgradeGateMode: header.tutorialUpgradeGateMode,
      padIds: missionRuntime.map.pads.map(function (pad) { return pad.id; }),
      waveStartGrants: mission.waves.map(function (wave) { return wave.deploymentGrantAether; }),
      defenses: header.loadoutIds.map(function (defenseId) {
        const defense = content.defenses[defenseId];
        return {
          id: defense.id,
          costsAether: defense.levels.map(function (level) { return level.purchase.costAether; }),
          defaultTargetPolicy: defense.defaultTargetPolicyId,
          allowedTargetPolicies: defense.allowedTargetPolicyIds.slice().sort(function (left, right) {
            return Commands.TARGET_POLICIES.indexOf(left) - Commands.TARGET_POLICIES.indexOf(right);
          }),
        };
      }),
    };
  }

  function managementConfig(content, missionRuntime, header, resolvedStartAether) {
    return Management.normalizeManagementConfig(
      managementConfigInput(content, missionRuntime, header, resolvedStartAether)
    );
  }

  function behaviorDispatchId(behavior) {
    const dispatchId = behavior.contractId + "@" + behavior.version + "/" + behavior.deliveryKind;
    if (Object.keys(Behaviors.DISPATCH_IDS).every(function (key) {
      return Behaviors.DISPATCH_IDS[key] !== dispatchId;
    })) {
      throw new RangeError("Unsupported compiled behavior dispatch ID " + dispatchId);
    }
    return dispatchId;
  }

  function behaviorUsesCooldown(behavior) {
    return behavior.contractId === "direct" || behavior.contractId === "splash" ||
      (behavior.contractId === "aura" && behavior.deliveryKind === "periodic-targeted-status");
  }

  function guardMarkers(missionRuntime, padId) {
    const proof = missionRuntime.map.map.roleProofs.find(function (record) {
      return record.kind === "guard" && record.padId === padId;
    });
    if (!proof || !Array.isArray(proof.markers)) {
      throw new RangeError("Hoplite pad lacks its compiled guard marker proof: " + padId);
    }
    return proof.markers;
  }

  function initialBehaviorState(behavior, missionRuntime, tower) {
    const dispatchId = behaviorDispatchId(behavior);
    if (dispatchId === Behaviors.DISPATCH_IDS.GUARD_SLOTS) {
      return Behaviors.createBehaviorState(dispatchId, {
        markers: guardMarkers(missionRuntime, tower.padId),
      });
    }
    return Behaviors.createBehaviorState(dispatchId, {});
  }

  /* ADR-002: under content schema v4 the third level is an authored specialization record with
     the same level-record semantics. ABI v1 content keeps its three linear level records. */
  function levelRecord(content, defenseId, level, specializationId) {
    const defense = content.defenses[defenseId];
    if (!defense) throw new RangeError("Unknown compiled defense " + defenseId);
    if (level <= defense.levels.length) return defense.levels[level - 1];
    const record = content.specializations && specializationId
      ? content.specializations[specializationId] : null;
    if (!record || record.defenseId !== defenseId || record.level !== level) {
      throw new RangeError("Tower level has no compiled level or specialization record");
    }
    return record;
  }

  function runtimeLevelRecord(content, runtime) {
    return levelRecord(content, runtime.defenseId, runtime.level, runtime.specializationId);
  }

  function freezeTowerRuntime(values) {
    const record = {
      behaviorStates: values.behaviorStates,
      createdTick: values.createdTick,
      defenseId: values.defenseId,
      level: values.level,
      towerRuntimeId: values.towerRuntimeId,
    };
    /* ABI v1 towers have no branch field at all, so their canonical bytes never change. */
    if (values.specializationId !== undefined) record.specializationId = values.specializationId;
    return Object.freeze(record);
  }

  function createTowerRuntime(content, missionRuntime, tower, currentTick) {
    const level = levelRecord(content, tower.defenseId, tower.level, tower.specializationId);
    return freezeTowerRuntime({
      behaviorStates: Object.freeze(level.behaviors.map(function (behavior, index) {
        return Object.freeze({
          behaviorId: behavior.id,
          dispatchId: behaviorDispatchId(behavior),
          index: index,
          state: initialBehaviorState(behavior, missionRuntime, tower),
          timer: behaviorUsesCooldown(behavior) ? Timers.createCooldownState() : null,
        });
      })),
      createdTick: currentTick,
      defenseId: tower.defenseId,
      level: tower.level,
      specializationId: tower.specializationId,
      towerRuntimeId: tower.id,
    });
  }

  function syncTowerRuntimes(content, missionRuntime, priorRuntimes, towers, currentTick) {
    const priorById = Object.create(null);
    priorRuntimes.forEach(function (runtime) { priorById[runtime.towerRuntimeId] = runtime; });
    return Object.freeze(towers.map(function (tower) {
      const prior = priorById[tower.id];
      if (!prior) return createTowerRuntime(content, missionRuntime, tower, currentTick);
      if (prior.defenseId !== tower.defenseId) {
        throw new RangeError("A tower runtime cannot change defense identity");
      }
      const level = levelRecord(content, tower.defenseId, tower.level, tower.specializationId);
      const statesById = Object.create(null);
      prior.behaviorStates.forEach(function (behaviorState) {
        statesById[behaviorState.behaviorId] = behaviorState;
      });
      const behaviorStates = level.behaviors.map(function (behavior, index) {
        const dispatchId = behaviorDispatchId(behavior);
        const previous = statesById[behavior.id];
        if (!previous) {
          return Object.freeze({
            behaviorId: behavior.id,
            dispatchId: dispatchId,
            index: index,
            state: initialBehaviorState(behavior, missionRuntime, tower),
            timer: behaviorUsesCooldown(behavior) ? Timers.createCooldownState() : null,
          });
        }
        if (previous.dispatchId !== dispatchId) {
          throw new RangeError("An upgraded behavior cannot change dispatch identity");
        }
        return Object.freeze({
          behaviorId: behavior.id,
          dispatchId: dispatchId,
          index: index,
          state: previous.state,
          timer: previous.timer,
        });
      });
      return freezeTowerRuntime({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: prior.createdTick,
        defenseId: tower.defenseId,
        level: tower.level,
        specializationId: tower.specializationId,
        towerRuntimeId: tower.id,
      });
    }));
  }

  function managementWith(state, config, changes) {
    return Management.normalizeManagementState({
      schemaVersion: state.schemaVersion,
      missionId: state.missionId,
      aether: own(changes, "aether") ? changes.aether : state.aether,
      bountyRemainder: own(changes, "bountyRemainder")
        ? changes.bountyRemainder : state.bountyRemainder,
      phase: state.phase,
      activeWave: state.activeWave,
      clearedWaves: state.clearedWaves,
      tutorialUpgradeGateMode: state.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: state.tutorialUpgradeGateOpen,
      towers: state.towers,
      runtimeIds: own(changes, "runtimeIds") ? changes.runtimeIds : state.runtimeIds,
    }, config);
  }

  function allocateRuntimeId(management, config, domain) {
    const allocation = Movement.allocateRuntimeId(management.runtimeIds, domain, true);
    return Object.freeze({
      management: managementWith(management, config, { runtimeIds: allocation.state }),
      runtimeId: allocation.runtimeId,
    });
  }

  /* Spec 8.2 conservation: the mission keeps exactly ONE bounty remainder domain. The authored
     difficulty and Relic basis points therefore compose once, at the single mission-constant
     rounding, and every kill then divides by 10000 once and carries the whole fraction forward.
     No per-kill fraction is discarded, so total awarded Aether is conserved to the last unit. */
  function creditBounty(management, config, baseBounty, difficultyBountyBp, relicBountyBp) {
    const result = relicBountyBp === null || relicBountyBp === undefined
      ? Economy.resolveBountyEvent(management.bountyRemainder, baseBounty, difficultyBountyBp)
      : Relics.applyBountyWithRemainder(
          baseBounty,
          ABI.checkedMulDivFloor(difficultyBountyBp, [relicBountyBp], [ABI.BASIS_POINTS]),
          management.bountyRemainder
        );
    const award = own(result, "bountyAward") ? result.bountyAward : result.aetherAward;
    return Object.freeze({
      award: award,
      management: managementWith(management, config, {
        aether: ABI.checkedAdd(management.aether, award),
        bountyRemainder: result.bountyRemainder,
      }),
    });
  }

  function creditGrant(management, config, amount) {
    const result = Economy.creditFixedGrant(management.bountyRemainder, amount);
    return managementWith(management, config, {
      aether: ABI.checkedAdd(management.aether, result.aetherAward),
      bountyRemainder: result.bountyRemainder,
    });
  }

  function authoredLineageTags(content) {
    const tags = new Set();
    Object.keys(content.enemies).forEach(function (enemyId) {
      content.enemies[enemyId].tags.forEach(function (tag) { tags.add(tag); });
    });
    Object.keys(content.bosses).forEach(function (bossId) {
      content.bosses[bossId].tags.forEach(function (tag) { tags.add(tag); });
    });
    return Array.from(tags).sort();
  }

  function initialObjectiveFacts(content, missionRuntime, difficulty) {
    return Object.freeze({
      integrity: difficulty.integrity,
      lineageTagLeakCounts: Object.freeze(authoredLineageTags(content).map(function (lineageTag) {
        return Object.freeze({ leakCount: 0, lineageTag: lineageTag });
      })),
      outcome: "active",
      ownedTowerCount: 0,
      routeLeakCounts: Object.freeze(missionRuntime.map.routes.map(function (route) {
        return Object.freeze({ leakCount: 0, routeId: route.id });
      })),
    });
  }

  function objectiveProjection(binding, fullFacts) {
    const routeCounts = Object.create(null);
    fullFacts.routeLeakCounts.forEach(function (record) { routeCounts[record.routeId] = record.leakCount; });
    const lineageCounts = Object.create(null);
    fullFacts.lineageTagLeakCounts.forEach(function (record) {
      lineageCounts[record.lineageTag] = record.leakCount;
    });
    return Objectives.createObjectiveFacts(binding, {
      integrity: fullFacts.integrity,
      lineageTagLeakCounts: binding.lineageTagIds.map(function (lineageTag) {
        return { lineageTag: lineageTag, leakCount: lineageCounts[lineageTag] || 0 };
      }),
      outcome: fullFacts.outcome,
      ownedTowerCount: fullFacts.ownedTowerCount,
      routeLeakCounts: binding.routeIds.map(function (routeId) {
        return { routeId: routeId, leakCount: routeCounts[routeId] || 0 };
      }),
    });
  }

  function initialRoutes(missionRuntime) {
    return Object.freeze(missionRuntime.map.routes.map(function (route) {
      return Object.freeze({ id: route.id, length: route.length });
    }));
  }

  function semanticEvent(content, eventId, payload) {
    const definition = content.eventCatalog[eventId];
    if (!definition) throw new RangeError("Unknown compiled semantic event " + eventId);
    return Behaviors.validateSemanticEvent(content.eventCatalog, {
      eventId: eventId,
      phaseId: definition.phaseId,
      payload: payload,
    });
  }

  function appendEvents(target, additions) {
    additions.forEach(function (event) {
      if (target.length >= MAX_SEMANTIC_EVENTS_PER_TICK) {
        throw new RangeError("Semantic events exceed the kernel per-tick ceiling");
      }
      target.push(event);
    });
  }

  function routeSource(missionRuntime, routeId) {
    const source = missionRuntime.map.map.routes.find(function (route) { return route.id === routeId; });
    if (!source) throw new RangeError("Unknown mission route " + routeId);
    return source;
  }

  function frozenSpawnJob(values) {
    return Object.freeze({
      authoredIndex: values.authoredIndex,
      bountyPolicy: values.bountyPolicy,
      dueTick: values.dueTick,
      groupId: values.groupId,
      groupOrder: values.groupOrder,
      lineageId: values.lineageId,
      lineageTags: Object.freeze((values.lineageTags || []).slice()),
      ownerId: values.ownerId,
      routeDistance: values.routeDistance,
      routeId: values.routeId,
      sourceBossRuntimeId: values.sourceBossRuntimeId,
      spawnEventId: values.spawnEventId,
      spawnKind: values.spawnKind,
      waveId: values.waveId,
    });
  }

  function compareSpawnJobs(left, right) {
    if (left.dueTick !== right.dueTick) return left.dueTick < right.dueTick ? -1 : 1;
    if (left.groupOrder !== right.groupOrder) return left.groupOrder < right.groupOrder ? -1 : 1;
    if (left.authoredIndex !== right.authoredIndex) {
      return left.authoredIndex < right.authoredIndex ? -1 : 1;
    }
    if (left.groupId !== right.groupId) return left.groupId < right.groupId ? -1 : 1;
    return 0;
  }

  function scheduleWaveSpawns(wave, startTick) {
    const jobs = [];
    wave.groups.forEach(function (group, groupIndex) {
      if (group.order !== groupIndex) throw new RangeError("Wave group order must be contiguous");
      if (group.shuffleWithinGroup !== false || group.rngStreamId !== null) {
        throw new RangeError("Candidate slice shuffled spawn groups require a new authored RNG contract");
      }
      for (let authoredIndex = 0; authoredIndex < group.count; authoredIndex += 1) {
        const relativeTick = ABI.checkedAdd(
          group.firstTick,
          ABI.checkedMultiply(authoredIndex, group.intervalTicks)
        );
        jobs.push(frozenSpawnJob({
          authoredIndex: authoredIndex,
          bountyPolicy: group.bountyPolicy,
          dueTick: ABI.checkedAdd(startTick, relativeTick),
          groupId: group.id,
          groupOrder: group.order,
          lineageId: null,
          lineageTags: [],
          ownerId: group.spawnKind === "boss" ? group.bossId : group.enemyId,
          routeDistance: 0,
          routeId: group.routeId,
          sourceBossRuntimeId: null,
          spawnEventId: group.spawnEventId,
          spawnKind: group.spawnKind,
          waveId: wave.id,
        }));
      }
    });
    jobs.sort(compareSpawnJobs);
    return Object.freeze(jobs);
  }

  function sortedTagUnion(left, right) {
    return Object.freeze(Array.from(new Set(left.concat(right))).sort());
  }

  function createShieldRecords(owner, management, config, currentTick) {
    let nextManagement = management;
    const shields = [];
    owner.shieldPools.forEach(function (pool) {
      const allocation = allocateRuntimeId(nextManagement, config, "effect");
      nextManagement = allocation.management;
      shields.push(Object.freeze({
        poolId: pool.id,
        remainingMilli: pool.initialAmount,
        sourceId: allocation.runtimeId,
        timer: pool.durationMs === null
          ? null
          : Timers.applyStatusAfterExpiryPhase(
              Timers.authoredMillisecondsToTimeUnits(pool.durationMs),
              currentTick
            ),
      }));
    });
    return Object.freeze({ management: nextManagement, shields: Object.freeze(shields) });
  }

  function resolvedEnemySpeed(owner, difficulty, assist, content) {
    return ABI.checkedMulDivFloor(
      owner.speedWorldUnitsPerSecond,
      [difficulty.enemySpeedBp, assist ? content.campaignRules.assistRecord.enemySpeedBp : ABI.BASIS_POINTS],
      [ABI.BASIS_POINTS, ABI.BASIS_POINTS]
    );
  }

  function createEntity(content, missionRuntime, difficulty, assist, job, management, config, currentTick) {
    const isBoss = job.spawnKind === "boss";
    const owner = isBoss ? content.bosses[job.ownerId] : content.enemies[job.ownerId];
    if (!owner) throw new RangeError("Spawn job references an unknown owner " + job.ownerId);
    const route = missionRuntime.map.routes.find(function (candidate) { return candidate.id === job.routeId; });
    const routeRecord = routeSource(missionRuntime, job.routeId);
    if (!route || owner.routeKinds.indexOf(routeRecord.kind) === -1) {
      throw new RangeError("Spawn owner is incompatible with route " + job.routeId);
    }
    let allocation = allocateRuntimeId(management, config, "enemy");
    let nextManagement = allocation.management;
    const runtimeId = allocation.runtimeId;
    const maximumHpMilli = Math.max(1, ABI.checkedMulDivFloor(
      owner.hp,
      [difficulty.enemyHpBp],
      [ABI.BASIS_POINTS]
    ));
    const lineageId = job.lineageId === null ? "lineage." + runtimeId : job.lineageId;
    const lineageTags = job.lineageId === null
      ? Object.freeze(owner.tags.slice())
      : sortedTagUnion(job.lineageTags, owner.tags);
    const distance = Math.min(route.length, job.routeDistance);
    const position = Geometry.positionOnRoute(route, distance);
    const shields = createShieldRecords(owner, nextManagement, config, currentTick);
    nextManagement = shields.management;
    const traitStates = owner.traits.map(function (trait) {
      if (trait.kind !== "cloak" || trait.version !== 1) {
        throw new RangeError("Unsupported enemy trait " + trait.kind);
      }
      return Object.freeze({
        dispatchId: Behaviors.DISPATCH_IDS.CLOAK,
        kind: trait.kind,
        state: Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.CLOAK, {}),
      });
    });
    const entity = Object.freeze({
      armorMilli: owner.armor,
      baseSpeedDistanceUnitsPerSecond: resolvedEnemySpeed(owner, difficulty, assist, content),
      bossState: isBoss
        ? Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.TALOS, {
            currentHpMilli: maximumHpMilli,
            maximumHpMilli: maximumHpMilli,
          })
        : null,
      distance: distance,
      hpMilli: maximumHpMilli,
      id: runtimeId,
      kind: isBoss ? "boss" : "enemy",
      leakIntegrity: owner.leakIntegrity,
      lineageId: lineageId,
      lineageTags: lineageTags,
      maximumHpMilli: maximumHpMilli,
      movement: Movement.createMovementState(),
      ownerId: owner.id,
      position: position,
      routeId: route.id,
      routeKind: routeRecord.kind,
      scoreValue: owner.score,
      shields: shields.shields,
      tags: Object.freeze(owner.tags.slice()),
      threatPriority: owner.threatPriority,
      traitStates: Object.freeze(traitStates),
      waveId: job.waveId,
    });
    const lineage = job.lineageId === null ? Object.freeze({
      baseLineageBountyAether: owner.baseLineageBountyAether,
      bountyPolicy: job.bountyPolicy,
      claimed: false,
      lineageId: lineageId,
    }) : null;
    return Object.freeze({
      entity: entity,
      lineage: lineage,
      management: nextManagement,
      owner: owner,
      runtimeId: runtimeId,
    });
  }

  function spawnDueJobs(content, missionRuntime, difficulty, assist, jobs, enemies, lineages,
    management, config, currentTick, events, telemetry) {
    if (jobs.some(function (job) { return job.dueTick < currentTick; })) {
      throw new RangeError("A pending spawn job missed its authored due tick");
    }
    const due = jobs.filter(function (job) { return job.dueTick === currentTick; });
    const future = jobs.filter(function (job) { return job.dueTick > currentTick; });
    if (ABI.checkedAdd(enemies.length, due.length) > MAX_ACTIVE_ENTITIES) {
      throw new RangeError("Active hostile entities exceed the kernel ceiling");
    }
    let nextManagement = management;
    due.forEach(function (job) {
      const spawned = createEntity(
        content,
        missionRuntime,
        difficulty,
        assist,
        job,
        nextManagement,
        config,
        currentTick
      );
      nextManagement = spawned.management;
      enemies.push(spawned.entity);
      if (spawned.lineage !== null) lineages.push(spawned.lineage);
      telemetry.push("spawn", {
        entityKind: spawned.entity.kind,
        enemyRuntimeId: spawned.runtimeId,
        ownerId: spawned.owner.id,
        lineageId: spawned.entity.lineageId,
        routeId: spawned.entity.routeId,
        waveId: spawned.entity.waveId,
        maximumHpMilli: spawned.entity.maximumHpMilli,
        initialShieldMilli: totalShieldMilli(spawned.entity),
        baseSpeedDistanceUnitsPerSecond: spawned.entity.baseSpeedDistanceUnitsPerSecond,
      });
      if (job.spawnEventId !== null) {
        if (job.spawnKind === "boss") {
          events.push(semanticEvent(content, job.spawnEventId, {
            bossId: spawned.owner.id,
            bossRuntimeId: spawned.runtimeId,
            routeId: job.routeId,
            waveId: job.waveId,
          }));
        } else {
          events.push(semanticEvent(content, job.spawnEventId, {
            enemyId: spawned.owner.id,
            enemyRuntimeId: spawned.runtimeId,
            lineageTags: spawned.entity.lineageTags,
            routeId: job.routeId,
            waveId: job.waveId,
          }));
        }
      }
    });
    enemies.sort(function (left, right) { return left.id - right.id; });
    lineages.sort(function (left, right) {
      return left.lineageId < right.lineageId ? -1 : left.lineageId > right.lineageId ? 1 : 0;
    });
    return Object.freeze({
      enemies: Object.freeze(enemies),
      lineages: Object.freeze(lineages),
      management: nextManagement,
      pendingSpawns: Object.freeze(future),
    });
  }

  function behaviorRequest(content, behavior, state, input) {
    return {
      eventCatalog: content.eventCatalog,
      input: input,
      limits: BEHAVIOR_LIMITS,
      parameters: behavior.parameters,
      state: state,
    };
  }

  function towerByRuntimeId(towers, runtimeId) {
    return towers.find(function (tower) { return tower.id === runtimeId; });
  }

  function towerTelemetryIdentity(content, towers, runtimeId) {
    const tower = towerByRuntimeId(towers, runtimeId);
    if (!tower) return null;
    if (!content.defenses[tower.defenseId]) {
      throw new RangeError("Telemetry tower references an unknown defense");
    }
    return Object.freeze({
      defenseId: tower.defenseId,
      level: tower.level,
      padId: tower.padId,
      sourceTowerRuntimeId: tower.id,
    });
  }

  function mergeTelemetryTowers(prior, current) {
    const byId = Object.create(null);
    prior.concat(current).forEach(function (tower) { byId[tower.id] = tower; });
    return Object.freeze(Object.keys(byId).map(function (runtimeId) {
      return byId[runtimeId];
    }).sort(function (left, right) { return left.id - right.id; }));
  }

  function requiredTelemetryTarget(enemies, runtimeId) {
    const target = enemies.find(function (enemy) { return enemy.id === runtimeId; });
    if (!target) throw new RangeError("Effect telemetry target is not resolvable");
    return target;
  }

  function requiredTowerTelemetryIdentity(content, towers, runtimeId) {
    const identity = towerTelemetryIdentity(content, towers, runtimeId);
    if (identity === null) throw new RangeError("Telemetry player source has no owned tower");
    return identity;
  }

  function sortedUniqueRuntimeIds(values) {
    return Object.freeze(Array.from(new Set(values)).sort(function (left, right) {
      return left - right;
    }));
  }

  function totalShieldMilli(enemy) {
    return enemy.shields.reduce(function (total, shield) {
      return ABI.checkedAdd(total, shield.remainingMilli);
    }, 0);
  }

  function emitManagementAetherTelemetry(telemetry, managementBefore, managementResult,
    missionRuntime) {
    let bank = managementBefore.aether;
    const remainder = managementBefore.bountyRemainder;
    managementResult.events.forEach(function (event) {
      let values = null;
      if (event.type === "build") {
        values = {
          action: "build",
          sourceId: "command.build",
          commandSeq: event.seq,
          towerRuntimeId: event.towerId,
          padId: event.padId,
          defenseId: event.defenseId,
          levelBefore: 0,
          levelAfter: event.level,
          debitAether: event.costAether,
          creditAether: 0,
          investedBeforeAether: 0,
          investedAfterAether: event.investedAether,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      } else if (event.type === "upgrade") {
        values = {
          action: "upgrade",
          sourceId: "command.upgrade",
          commandSeq: event.seq,
          towerRuntimeId: event.towerId,
          padId: event.padId,
          defenseId: event.defenseId,
          levelBefore: ABI.checkedAdd(event.level, -1),
          levelAfter: event.level,
          debitAether: event.costAether,
          creditAether: 0,
          investedBeforeAether: ABI.checkedAdd(event.investedAether, -event.costAether),
          investedAfterAether: event.investedAether,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      } else if (event.type === "sell") {
        values = {
          action: "sell",
          sourceId: "command.sell",
          commandSeq: event.seq,
          towerRuntimeId: event.towerId,
          padId: event.padId,
          defenseId: event.defenseId,
          levelBefore: event.level,
          levelAfter: 0,
          debitAether: 0,
          creditAether: event.refundAether,
          investedBeforeAether: event.investedAether,
          investedAfterAether: 0,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      } else if (event.type === "waveStart") {
        const wave = missionRuntime.mission.waves[event.wave - 1];
        if (!wave) throw new RangeError("Wave-start telemetry has no compiled wave");
        values = {
          action: "wave-start-grant",
          sourceId: wave.id,
          commandSeq: event.seq,
          towerRuntimeId: null,
          padId: null,
          defenseId: null,
          levelBefore: null,
          levelAfter: null,
          debitAether: 0,
          creditAether: event.grantAether,
          investedBeforeAether: null,
          investedAfterAether: null,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      }
      if (event.type === "specialize") {
        values = {
          action: "specialize",
          sourceId: "command.specialize-tower",
          commandSeq: event.seq,
          towerRuntimeId: event.towerId,
          padId: event.padId,
          defenseId: event.defenseId,
          levelBefore: ABI.checkedAdd(event.level, -1),
          levelAfter: event.level,
          debitAether: event.costAether,
          creditAether: 0,
          investedBeforeAether: ABI.checkedAdd(event.investedAether, -event.costAether),
          investedAfterAether: event.investedAether,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      } else if (event.type === "activatePower") {
        values = {
          action: "protocol-cast",
          sourceId: event.protocolId,
          commandSeq: event.seq,
          towerRuntimeId: null,
          padId: null,
          defenseId: null,
          levelBefore: null,
          levelAfter: null,
          debitAether: event.costAether,
          creditAether: 0,
          investedBeforeAether: null,
          investedAfterAether: null,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      } else if (event.type === "resetPlan") {
        values = {
          action: "reset-plan-refund",
          sourceId: "command.reset-plan",
          commandSeq: event.seq,
          towerRuntimeId: null,
          padId: null,
          defenseId: null,
          levelBefore: null,
          levelAfter: null,
          debitAether: 0,
          creditAether: event.refundAether,
          investedBeforeAether: null,
          investedAfterAether: null,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      }
      if (values !== null) {
        telemetry.push("aether-transaction", values);
        bank = values.bankAfterAether;
      }
    });
    if (bank !== managementResult.state.aether ||
        remainder !== managementResult.state.bountyRemainder) {
      throw new Error("Management Aether telemetry diverged from its reducer result");
    }
  }

  function emitInternalAetherTelemetry(telemetry, action, sourceId, before, after) {
    const delta = ABI.checkedAdd(after.aether, -before.aether);
    telemetry.push("aether-transaction", {
      action: action,
      sourceId: sourceId,
      commandSeq: null,
      towerRuntimeId: null,
      padId: null,
      defenseId: null,
      levelBefore: null,
      levelAfter: null,
      debitAether: delta < 0 ? -delta : 0,
      creditAether: delta > 0 ? delta : 0,
      investedBeforeAether: null,
      investedAfterAether: null,
      bankBeforeAether: before.aether,
      bankAfterAether: after.aether,
      bountyRemainderBefore: before.bountyRemainder,
      bountyRemainderAfter: after.bountyRemainder,
    });
  }

  function activeSummonCount(towerRuntimes) {
    let count = 0;
    towerRuntimes.forEach(function (runtime) {
      runtime.behaviorStates.forEach(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.GUARD_SLOTS ||
            !behaviorState.state) return;
        behaviorState.state.slots.forEach(function (slot) {
          if (slot.summonRuntimeId !== null) count = ABI.checkedAdd(count, 1);
        });
      });
    });
    return count;
  }

  function runGuardScheduledSpawns(content, towerRuntimes, towers, management, config,
    currentTick, hostileCount, events, telemetry) {
    let nextManagement = management;
    let summonCount = activeSummonCount(towerRuntimes);
    const nextRuntimes = towerRuntimes.map(function (runtime) {
      const tower = towerByRuntimeId(towers, runtime.towerRuntimeId);
      const level = runtimeLevelRecord(content, runtime);
      const behaviorStates = runtime.behaviorStates.map(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.GUARD_SLOTS) return behaviorState;
        const behavior = level.behaviors[behaviorState.index];
        const nextSummonRuntimeId = nextManagement.runtimeIds.nextByDomain.summon;
        const result = Behaviors.dispatchBehavior(
          behaviorState.dispatchId,
          behaviorRequest(content, behavior, behaviorState.state, {
            actionId: "scheduled-spawns",
            elapsedTimeUnits: runtime.createdTick === currentTick ? 0 : ABI.TIME_UNITS_PER_TICK,
            nextSummonRuntimeId: nextSummonRuntimeId,
            towerRuntimeId: tower.id,
          })
        );
        if (result.created.length > 0 &&
            ABI.checkedAdd(hostileCount, ABI.checkedAdd(summonCount, result.created.length)) >
              MAX_ACTIVE_ENTITIES) {
          throw new RangeError("Active hostile and summon entities exceed the kernel ceiling");
        }
        result.created.forEach(function (created) {
          const allocation = allocateRuntimeId(nextManagement, config, "summon");
          if (allocation.runtimeId !== created.summonRuntimeId) {
            throw new Error("Guard behavior and kernel summon runtime IDs diverged");
          }
          nextManagement = allocation.management;
          summonCount = ABI.checkedAdd(summonCount, 1);
          telemetry.push("activation", {
            actionId: "guard-create",
            behaviorId: behavior.id,
            sourceTowerRuntimeId: tower.id,
            sourceRuntimeId: created.summonRuntimeId,
            defenseId: tower.defenseId,
            level: tower.level,
            padId: tower.padId,
            outcome: "accepted",
            eligibleTargetRuntimeIds: [],
            selectedTargetRuntimeIds: [],
          });
        });
        if (nextManagement.runtimeIds.nextByDomain.summon !== result.nextSummonRuntimeId) {
          throw new Error("Guard behavior returned a noncanonical next summon runtime ID");
        }
        appendEvents(events, result.events);
        return Object.freeze({
          behaviorId: behaviorState.behaviorId,
          dispatchId: behaviorState.dispatchId,
          index: behaviorState.index,
          state: result.state,
          timer: behaviorState.timer,
        });
      });
      return freezeTowerRuntime({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: runtime.createdTick,
        defenseId: runtime.defenseId,
        level: runtime.level,
        specializationId: runtime.specializationId,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    });
    return Object.freeze({
      management: nextManagement,
      towerRuntimes: Object.freeze(nextRuntimes),
    });
  }

  function freezeEffect(values) {
    return Object.freeze({
      appliedTick: values.appliedTick,
      coefficientBp: values.coefficientBp,
      damageTypeId: values.damageTypeId,
      delayTimer: values.delayTimer,
      id: values.id,
      kind: values.kind,
      magnitude: values.magnitude,
      secondaryDurationTimeUnits: values.secondaryDurationTimeUnits,
      sourceRuntimeId: values.sourceRuntimeId,
      sourceTypeId: values.sourceTypeId,
      statusId: values.statusId,
      targetRuntimeId: values.targetRuntimeId,
      timer: values.timer,
    });
  }

  function effectIdentity(effect) {
    return [
      effect.kind,
      effect.statusId,
      effect.damageTypeId,
      effect.sourceRuntimeId,
      effect.targetRuntimeId,
    ].join("\0");
  }

  function applyEffect(effects, management, config, values, currentTick) {
    const requested = {
      appliedTick: currentTick,
      coefficientBp: values.coefficientBp || ABI.BASIS_POINTS,
      damageTypeId: values.damageTypeId || null,
      delayTimer: values.delayTimeUnits
        ? Timers.applyStatusAfterExpiryPhase(values.delayTimeUnits, currentTick)
        : null,
      id: 0,
      kind: values.kind,
      magnitude: values.magnitude || 0,
      secondaryDurationTimeUnits: values.secondaryDurationTimeUnits || 0,
      sourceRuntimeId: values.sourceRuntimeId,
      sourceTypeId: values.sourceTypeId || null,
      statusId: values.statusId,
      targetRuntimeId: values.targetRuntimeId,
      timer: values.durationTimeUnits
        ? Timers.applyStatusAfterExpiryPhase(values.durationTimeUnits, currentTick)
        : null,
    };
    const identity = effectIdentity(requested);
    const existingIndex = effects.findIndex(function (effect) {
      return effectIdentity(effect) === identity;
    });
    let nextManagement = management;
    if (existingIndex >= 0) {
      requested.id = effects[existingIndex].id;
      const replaced = effects.slice();
      const effect = freezeEffect(requested);
      replaced[existingIndex] = effect;
      return Object.freeze({
        action: "refresh",
        effect: effect,
        effects: Object.freeze(replaced),
        management: nextManagement,
        outcome: "refreshed",
      });
    }
    const allocation = allocateRuntimeId(nextManagement, config, "effect");
    nextManagement = allocation.management;
    requested.id = allocation.runtimeId;
    const effect = freezeEffect(requested);
    const nextEffects = effects.concat([effect]);
    nextEffects.sort(function (left, right) { return left.id - right.id; });
    return Object.freeze({
      action: "apply",
      effect: effect,
      effects: Object.freeze(nextEffects),
      management: nextManagement,
      outcome: "applied",
    });
  }

  function effectRequestedDurationTimeUnits(effect) {
    if (effect.kind === "delayed-status") return effect.secondaryDurationTimeUnits;
    if (effect.timer !== null) return effect.timer.remainingUnits;
    return 0;
  }

  function pushEffectTelemetry(telemetry, action, outcome, effect, sourceTower,
    target, requestedMagnitude, appliedMagnitude, requestedDuration, appliedDuration) {
    telemetry.push("effect", {
      action: action,
      sourceTowerRuntimeId: sourceTower === null ? null : sourceTower.sourceTowerRuntimeId,
      sourceRuntimeId: effect.sourceRuntimeId,
      defenseId: sourceTower === null ? null : sourceTower.defenseId,
      level: sourceTower === null ? null : sourceTower.level,
      padId: sourceTower === null ? null : sourceTower.padId,
      targetRuntimeId: target.id,
      targetOwnerId: target.ownerId,
      targetRouteId: target.routeId,
      effectKind: effect.kind,
      statusId: effect.statusId,
      requestedMagnitude: requestedMagnitude,
      appliedMagnitude: appliedMagnitude,
      requestedDurationTimeUnits: requestedDuration,
      appliedDurationTimeUnits: appliedDuration,
      outcome: outcome,
    });
  }

  function pushAppliedEffectTelemetry(telemetry, applied, sourceTower, target) {
    const duration = effectRequestedDurationTimeUnits(applied.effect);
    pushEffectTelemetry(
      telemetry,
      applied.action,
      applied.outcome,
      applied.effect,
      sourceTower,
      target,
      applied.effect.magnitude,
      applied.effect.magnitude,
      duration,
      duration
    );
  }

  function pushRemovedEffectTelemetry(telemetry, action, outcome, effect, sourceTower, target) {
    pushEffectTelemetry(
      telemetry,
      action,
      outcome,
      effect,
      sourceTower,
      target,
      effect.magnitude,
      0,
      effectRequestedDurationTimeUnits(effect),
      0
    );
  }

  function effectSourceTowerIdentity(content, towers, effect) {
    if (effect.kind === "boss-exposure" || effect.kind === "resistance-override" ||
        effect.statusId === "stun" || effect.statusId === "resolve") {
      return null;
    }
    return towerTelemetryIdentity(content, towers, effect.sourceRuntimeId);
  }

  function removeEffects(effects, predicate) {
    return Object.freeze(effects.filter(function (effect) { return !predicate(effect); }));
  }

  function effectsForTarget(effects, targetRuntimeId, statusId) {
    return effects.filter(function (effect) {
      return effect.targetRuntimeId === targetRuntimeId &&
        (statusId === undefined || effect.statusId === statusId) &&
        effect.delayTimer === null;
    });
  }

  function hasStatus(effects, targetRuntimeId, statusId) {
    return effectsForTarget(effects, targetRuntimeId, statusId).length > 0;
  }

  function advanceShieldExpiry(enemy, currentTick) {
    const shields = [];
    enemy.shields.forEach(function (shield) {
      if (shield.timer === null) {
        shields.push(shield);
        return;
      }
      const advanced = Timers.advanceStatusExpiryPhase(shield.timer, currentTick);
      if (advanced.active) {
        shields.push(Object.freeze({
          poolId: shield.poolId,
          remainingMilli: shield.remainingMilli,
          sourceId: shield.sourceId,
          timer: advanced.state,
        }));
      }
    });
    const output = cloneCanonical(enemy);
    output.shields = shields;
    return Object.freeze(output);
  }

  function advanceEffectExpiry(effects, currentTick) {
    const activated = [];
    const expired = [];
    const lifecycle = [];
    const active = [];
    effects.forEach(function (effect) {
      if (effect.delayTimer !== null) {
        const delay = Timers.advanceStatusExpiryPhase(effect.delayTimer, currentTick);
        if (delay.active) {
          active.push(freezeEffect(Object.assign({}, effect, { delayTimer: delay.state })));
        } else {
          const nextEffect = freezeEffect(Object.assign({}, effect, {
            appliedTick: currentTick,
            delayTimer: null,
            kind: "status",
            timer: Timers.applyStatusAfterExpiryPhase(
              effect.secondaryDurationTimeUnits,
              currentTick
            ),
          }));
          active.push(nextEffect);
          const transition = Object.freeze({ effect: nextEffect, prior: effect });
          activated.push(transition);
          lifecycle.push(Object.freeze({ kind: "activated", transition: transition }));
        }
        return;
      }
      if (effect.timer === null) {
        active.push(effect);
        return;
      }
      const advanced = Timers.advanceStatusExpiryPhase(effect.timer, currentTick);
      if (advanced.active) {
        active.push(freezeEffect(Object.assign({}, effect, { timer: advanced.state })));
      } else {
        expired.push(effect);
        lifecycle.push(Object.freeze({ effect: effect, kind: "expired" }));
      }
    });
    return Object.freeze({
      activated: Object.freeze(activated),
      active: Object.freeze(active),
      expired: Object.freeze(expired),
      lifecycle: Object.freeze(lifecycle),
    });
  }

  function entityOwner(content, enemy) {
    const owner = enemy.kind === "boss" ? content.bosses[enemy.ownerId] : content.enemies[enemy.ownerId];
    if (!owner) throw new RangeError("Runtime entity references an unknown owner " + enemy.ownerId);
    return owner;
  }

  function movementReduction(content, enemy, effects) {
    if (hasStatus(effects, enemy.id, "stun")) {
      return Object.freeze({ effectiveSpeedBp: 0, scaledReductionBp: ABI.BASIS_POINTS });
    }
    const owner = entityOwner(content, enemy);
    const instances = effectsForTarget(effects, enemy.id).filter(function (effect) {
      return effect.statusId === "slow" || effect.statusId === "drench";
    }).map(function (effect) {
      return {
        appliedTick: effect.appliedTick,
        expiryTimeUnits: effect.timer === null ? Number.MAX_SAFE_INTEGER : effect.timer.remainingUnits,
        magnitude: effect.magnitude,
        sourceId: effect.sourceRuntimeId,
        statusId: effect.statusId,
      };
    });
    return Effects.resolveMovementReduction(
      instances,
      owner.control.slowControlBp,
      owner.control.minimumMovementBp
    );
  }

  function movementTelemetrySources(enemy, effects, reduction, towers) {
    let winners;
    if (hasStatus(effects, enemy.id, "stun")) {
      winners = effectsForTarget(effects, enemy.id, "stun").slice().sort(function (left, right) {
        return left.id - right.id;
      });
    } else if (reduction.source === null) {
      winners = [];
    } else {
      winners = effectsForTarget(effects, enemy.id).filter(function (effect) {
        return (effect.statusId === "slow" || effect.statusId === "drench") &&
          effect.sourceRuntimeId === reduction.source.sourceId;
      }).sort(function (left, right) { return left.id - right.id; });
      if (winners.length !== 1) {
        throw new RangeError("Movement telemetry cannot resolve its strongest effect source");
      }
    }
    const towerIds = [];
    winners.forEach(function (effect) {
      if (effect.statusId === "stun") return;
      if (towerByRuntimeId(towers, effect.sourceRuntimeId)) towerIds.push(effect.sourceRuntimeId);
    });
    return Object.freeze({
      sourceEffectRuntimeIds: Object.freeze(winners.map(function (effect) { return effect.id; })),
      sourceRuntimeIds: Object.freeze(winners.map(function (effect) {
        return effect.sourceRuntimeId;
      })),
      sourceTowerRuntimeIds: sortedUniqueRuntimeIds(towerIds),
    });
  }

  function replaceTowerBehaviorState(runtime, behaviorIndex, nextState) {
    const behaviorStates = runtime.behaviorStates.map(function (behaviorState) {
      if (behaviorState.index !== behaviorIndex) return behaviorState;
      return Object.freeze({
        behaviorId: behaviorState.behaviorId,
        dispatchId: behaviorState.dispatchId,
        index: behaviorState.index,
        state: nextState,
        timer: behaviorState.timer,
      });
    });
    return freezeTowerRuntime({
      behaviorStates: Object.freeze(behaviorStates),
      createdTick: runtime.createdTick,
      defenseId: runtime.defenseId,
      level: runtime.level,
      specializationId: runtime.specializationId,
      towerRuntimeId: runtime.towerRuntimeId,
    });
  }

  function guardTowerRequests(content, towerRuntimes) {
    const requests = [];
    towerRuntimes.forEach(function (runtime) {
      const level = runtimeLevelRecord(content, runtime);
      const slotState = runtime.behaviorStates.find(function (behaviorState) {
        return behaviorState.dispatchId === Behaviors.DISPATCH_IDS.GUARD_SLOTS;
      });
      if (!slotState) return;
      const blockState = runtime.behaviorStates.find(function (behaviorState) {
        return behaviorState.dispatchId === Behaviors.DISPATCH_IDS.BLOCK;
      });
      if (!blockState) throw new RangeError("Guard-slot behavior requires its bound block behavior");
      requests.push({
        blockIndex: blockState.index,
        parameters: level.behaviors[blockState.index].parameters,
        slotIndex: slotState.index,
        state: slotState.state,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    });
    return requests;
  }

  function runMovementAndGuards(content, missionRuntime, enemiesInput, effectsInput,
    towerRuntimesInput, management, config, currentTick, events, telemetry) {
    const plans = enemiesInput.map(function (enemy) {
      const reduction = movementReduction(content, enemy, effectsInput);
      const movement = Movement.advanceMovementTick(
        enemy.movement,
        enemy.baseSpeedDistanceUnitsPerSecond,
        reduction.effectiveSpeedBp
      );
      const route = missionRuntime.map.routes.find(function (candidate) {
        return candidate.id === enemy.routeId;
      });
      const progress = Movement.advanceRouteProgress(route.length, enemy.distance, movement.advance);
      return {
        enemy: enemy,
        movement: movement,
        progress: progress,
        reduction: reduction,
        route: route,
      };
    });
    const contacts = plans.filter(function (plan) {
      return plan.movement.advance > 0;
    }).map(function (plan) {
      const owner = entityOwner(content, plan.enemy);
      return {
        enemyRuntimeId: plan.enemy.id,
        hardControlActive: hasStatus(effectsInput, plan.enemy.id, "stun"),
        hardControlBp: owner.control.hardControlBp,
        nextRouteDistance: plan.progress.distance,
        priorRouteDistance: plan.enemy.distance,
        requestedForwardAdvance: plan.movement.advance,
        resolveActive: hasStatus(effectsInput, plan.enemy.id, "resolve"),
        routeId: plan.enemy.routeId,
        tags: plan.enemy.tags,
        targetKind: plan.enemy.routeKind,
      };
    });
    const guardRequests = guardTowerRequests(content, towerRuntimesInput);
    let towerRuntimes = towerRuntimesInput;
    let acceptedContacts = [];
    let queuedDamageIntents = [];
    if (guardRequests.length > 0 && contacts.length > 0) {
      const resolved = Behaviors.resolveGuardContactBatch({
        eventCatalog: content.eventCatalog,
        input: { actionId: "movement-contacts", contacts: contacts },
        limits: BEHAVIOR_LIMITS,
        towers: guardRequests.map(function (request) {
          return {
            parameters: request.parameters,
            state: request.state,
            towerRuntimeId: request.towerRuntimeId,
          };
        }),
      });
      appendEvents(events, resolved.events);
      acceptedContacts = resolved.acceptedContacts;
      resolved.events.forEach(function (event) {
        const request = guardRequests.find(function (candidate) {
          return (candidate.parameters.contactEventId === event.eventId ||
              candidate.parameters.rejectedEventId === event.eventId) &&
            candidate.state.slots.some(function (slot) {
              return slot.summonRuntimeId === event.payload.summonRuntimeId;
            });
        });
        if (!request) return;
        const tower = towerByRuntimeId(management.towers, request.towerRuntimeId);
        if (!tower) throw new RangeError("Guard activation source tower is not owned");
        const behavior = levelRecord(content, tower.defenseId, tower.level, tower.specializationId)
          .behaviors[request.blockIndex];
        const accepted = request.parameters.contactEventId === event.eventId;
        telemetry.push("activation", {
          actionId: "guard-contact",
          behaviorId: behavior.id,
          sourceTowerRuntimeId: tower.id,
          sourceRuntimeId: event.payload.summonRuntimeId,
          defenseId: tower.defenseId,
          level: tower.level,
          padId: tower.padId,
          outcome: accepted ? "accepted" : "rejected",
          eligibleTargetRuntimeIds: [event.payload.enemyRuntimeId],
          selectedTargetRuntimeIds: accepted ? [event.payload.enemyRuntimeId] : [],
        });
      });
      const guardTargetOrders = Object.create(null);
      queuedDamageIntents = resolved.queuedDamageIntents.map(function (intent) {
        const request = guardRequests.find(function (candidate) {
          return candidate.towerRuntimeId === intent.towerRuntimeId;
        });
        const accepted = resolved.acceptedContacts.find(function (contact) {
          return contact.towerRuntimeId === intent.towerRuntimeId &&
            contact.enemyRuntimeId === intent.targetRuntimeId;
        });
        if (!accepted) throw new Error("Guard bash intent has no accepted contact source");
        const orderKey = request.towerRuntimeId + "\0" + request.blockIndex;
        const targetOrder = guardTargetOrders[orderKey] || 0;
        guardTargetOrders[orderKey] = ABI.checkedAdd(targetOrder, 1);
        return Object.assign({}, intent, {
          behaviorIndex: request.blockIndex,
          eligibilityMode: null,
          isPrimary: true,
          sourceRuntimeId: accepted.summonRuntimeId,
          targetOrder: targetOrder,
        });
      });
      towerRuntimes = Object.freeze(towerRuntimesInput.map(function (runtime) {
        const result = resolved.towerStates.find(function (candidate) {
          return candidate.towerRuntimeId === runtime.towerRuntimeId;
        });
        const request = guardRequests.find(function (candidate) {
          return candidate.towerRuntimeId === runtime.towerRuntimeId;
        });
        return result ? replaceTowerBehaviorState(runtime, request.slotIndex, result.state) : runtime;
      }));
    }
    const contactByEnemy = Object.create(null);
    acceptedContacts.forEach(function (contact) { contactByEnemy[contact.enemyRuntimeId] = contact; });
    let effects = effectsInput;
    let nextManagement = management;
    const enemies = plans.map(function (plan) {
      const accepted = contactByEnemy[plan.enemy.id];
      const distance = accepted ? accepted.clampedRouteDistance : plan.progress.distance;
      const output = cloneCanonical(plan.enemy);
      output.distance = distance;
      output.movement = plan.movement.state;
      output.position = Geometry.positionOnRoute(plan.route, distance);
      let movementSources = movementTelemetrySources(
        plan.enemy,
        effectsInput,
        plan.reduction,
        management.towers
      );
      let effectiveSpeedBp = plan.reduction.effectiveSpeedBp;
      let scaledReductionBp = plan.reduction.scaledReductionBp;
      if (accepted) {
        const sourceTower = requiredTowerTelemetryIdentity(
          content,
          management.towers,
          accepted.towerRuntimeId
        );
        let applied = applyEffect(effects, nextManagement, config, {
          kind: "status",
          magnitude: ABI.BASIS_POINTS,
          sourceRuntimeId: accepted.summonRuntimeId,
          statusId: accepted.statusId,
          targetRuntimeId: plan.enemy.id,
          durationTimeUnits: accepted.durationTimeUnits,
        }, currentTick);
        effects = applied.effects;
        nextManagement = applied.management;
        pushAppliedEffectTelemetry(telemetry, applied, sourceTower, plan.enemy);
        movementSources = Object.freeze({
          sourceEffectRuntimeIds: Object.freeze([applied.effect.id]),
          sourceRuntimeIds: Object.freeze([accepted.summonRuntimeId]),
          sourceTowerRuntimeIds: Object.freeze([accepted.towerRuntimeId]),
        });
        effectiveSpeedBp = 0;
        scaledReductionBp = ABI.BASIS_POINTS;
        applied = applyEffect(effects, nextManagement, config, {
          kind: "delayed-status",
          magnitude: 0,
          sourceRuntimeId: accepted.summonRuntimeId,
          statusId: accepted.resolveStatusId,
          targetRuntimeId: plan.enemy.id,
          delayTimeUnits: accepted.resolveStartsAfterTimeUnits,
          secondaryDurationTimeUnits: accepted.resolveDurationTimeUnits,
        }, currentTick);
        effects = applied.effects;
        nextManagement = applied.management;
        pushAppliedEffectTelemetry(telemetry, applied, sourceTower, plan.enemy);
      }
      telemetry.push("movement-control", {
        enemyRuntimeId: plan.enemy.id,
        ownerId: plan.enemy.ownerId,
        lineageId: plan.enemy.lineageId,
        routeId: plan.enemy.routeId,
        priorRouteDistance: plan.enemy.distance,
        nextRouteDistance: distance,
        actualAdvanceDistance: ABI.checkedAdd(distance, -plan.enemy.distance),
        effectiveSpeedBp: effectiveSpeedBp,
        scaledReductionBp: scaledReductionBp,
        sourceEffectRuntimeIds: movementSources.sourceEffectRuntimeIds,
        sourceRuntimeIds: movementSources.sourceRuntimeIds,
        sourceTowerRuntimeIds: movementSources.sourceTowerRuntimeIds,
      });
      return Object.freeze(output);
    });
    return Object.freeze({
      effects: effects,
      enemies: Object.freeze(enemies),
      guardDamageIntents: Object.freeze(queuedDamageIntents),
      management: nextManagement,
      towerRuntimes: towerRuntimes,
    });
  }

  function cloakEligibility(content, enemy, effects, mode) {
    const traitIndex = enemy.traitStates.findIndex(function (trait) { return trait.kind === "cloak"; });
    if (traitIndex < 0) return true;
    const owner = entityOwner(content, enemy);
    const trait = owner.traits[traitIndex];
    const result = Behaviors.dispatchBehavior(
      Behaviors.DISPATCH_IDS.CLOAK,
      behaviorRequest(content, { parameters: trait }, enemy.traitStates[traitIndex].state, {
        actionId: "eligibility",
        revealActive: hasStatus(effects, enemy.id, "reveal"),
      })
    );
    if (mode === "continuous") return true;
    if (mode === "collateral") return result.eligibility.collateralEligible;
    return result.eligibility.directEligible;
  }

  function targetingCandidate(content, enemy, effects, mode) {
    return Targeting.createTargetCandidate({
      baseSpeedDistanceUnitsPerSecond: enemy.baseSpeedDistanceUnitsPerSecond,
      currentHpMilli: enemy.hpMilli,
      id: enemy.id,
      layerId: enemy.routeKind,
      remainingDistance: enemy.position.remainingDistance,
      revealEligible: cloakEligibility(content, enemy, effects, mode),
      shieldPoolsMilli: enemy.shields.map(function (shield) { return shield.remainingMilli; }),
      threatPriority: enemy.threatPriority,
      x: enemy.position.x,
      y: enemy.position.y,
    });
  }

  function towerPad(missionRuntime, tower) {
    const pad = missionRuntime.map.pads.find(function (candidate) { return candidate.id === tower.padId; });
    if (!pad) throw new RangeError("Tower references an unknown compiled pad " + tower.padId);
    return pad;
  }

  function eligibleTargets(content, missionRuntime, tower, defense, level, enemies, effects, mode) {
    if (enemies.length > MAX_TARGET_CANDIDATES) {
      throw new RangeError("Target candidates exceed the kernel ceiling");
    }
    const pad = towerPad(missionRuntime, tower);
    const query = Targeting.createTargetQuery({
      originX: pad.x,
      originY: pad.y,
      range: level.rangeWorldUnits,
      targetLayerIds: defense.targetKinds,
    });
    return Targeting.filterEligibleTargets(query, enemies.filter(function (enemy) {
      return enemy.hpMilli > 0;
    }).map(function (enemy) {
      return targetingCandidate(content, enemy, effects, mode);
    }));
  }

  function behaviorCandidate(enemy) {
    return {
      remainingRouteDistance: enemy.position.remainingDistance,
      routeId: enemy.routeId,
      runtimeId: enemy.id,
      targetKind: enemy.routeKind,
      threatPriority: enemy.threatPriority,
      x: enemy.position.x,
      y: enemy.position.y,
    };
  }

  function behaviorCandidateWithoutCoordinates(enemy) {
    return {
      remainingRouteDistance: enemy.position.remainingDistance,
      routeId: enemy.routeId,
      runtimeId: enemy.id,
      targetKind: enemy.routeKind,
      threatPriority: enemy.threatPriority,
    };
  }

  function replaceEnemyTraitState(enemy, traitIndex, nextState) {
    const output = cloneCanonical(enemy);
    output.traitStates[traitIndex].state = nextState;
    return Object.freeze(output);
  }

  function runStatusExpiry(content, missionRuntime, enemiesInput, effectsInput, towerRuntimesInput,
    towers, telemetryTowers, currentTick, events, telemetry) {
    const expiredEffects = advanceEffectExpiry(effectsInput, currentTick);
    let effects = expiredEffects.active;
    expiredEffects.lifecycle.forEach(function (lifecycle) {
      if (lifecycle.kind === "activated") {
        const effect = lifecycle.transition.effect;
        const duration = effectRequestedDurationTimeUnits(effect);
        pushEffectTelemetry(
          telemetry,
          "refresh",
          "refreshed",
          effect,
          effectSourceTowerIdentity(content, telemetryTowers, effect),
          requiredTelemetryTarget(enemiesInput, effect.targetRuntimeId),
          effect.magnitude,
          effect.magnitude,
          duration,
          duration
        );
        return;
      }
      pushRemovedEffectTelemetry(
        telemetry,
        "expire",
        "expired",
        lifecycle.effect,
        effectSourceTowerIdentity(content, telemetryTowers, lifecycle.effect),
        requiredTelemetryTarget(enemiesInput, lifecycle.effect.targetRuntimeId)
      );
    });
    let towerRuntimes = towerRuntimesInput;
    const runtimesById = Object.create(null);
    towerRuntimes.forEach(function (runtime) { runtimesById[runtime.towerRuntimeId] = runtime; });

    towerRuntimes = Object.freeze(towerRuntimes.map(function (runtime) {
      const tower = towerByRuntimeId(towers, runtime.towerRuntimeId);
      const defense = content.defenses[runtime.defenseId];
      const level = runtimeLevelRecord(content, runtime);
      let nextRuntime = runtime;
      runtime.behaviorStates.forEach(function (behaviorState) {
        const behavior = level.behaviors[behaviorState.index];
        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.REVEAL) {
          const eligible = tower
            ? eligibleTargets(
                content, missionRuntime, tower, defense, level, enemiesInput, effects, "continuous"
              ).map(function (candidate) { return candidate.id; })
            : [];
          const result = Behaviors.dispatchBehavior(
            behaviorState.dispatchId,
            behaviorRequest(content, behavior, behaviorState.state, {
              actionId: "status-expiry",
              eligibleEnemyRuntimeIds: eligible,
              sourceActive: tower !== undefined,
              towerRuntimeId: runtime.towerRuntimeId,
            })
          );
          appendEvents(events, result.events);
          result.statusIntents.forEach(function (intent) {
            if (intent.kind === "remove") {
              const removed = effects.filter(function (effect) {
                return effect.sourceRuntimeId === runtime.towerRuntimeId &&
                  effect.targetRuntimeId === intent.enemyRuntimeId &&
                  effect.statusId === intent.statusId;
              });
              effects = removeEffects(effects, function (effect) {
                return effect.sourceRuntimeId === runtime.towerRuntimeId &&
                  effect.targetRuntimeId === intent.enemyRuntimeId && effect.statusId === intent.statusId;
              });
              removed.forEach(function (effect) {
                pushRemovedEffectTelemetry(
                  telemetry,
                  "remove",
                  "removed",
                  effect,
                  requiredTowerTelemetryIdentity(content, telemetryTowers, runtime.towerRuntimeId),
                  requiredTelemetryTarget(enemiesInput, effect.targetRuntimeId)
                );
              });
            }
          });
          nextRuntime = replaceTowerBehaviorState(nextRuntime, behaviorState.index, result.state);
        }
        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.MARK) {
          const expiredEnemyRuntimeIds = expiredEffects.expired.filter(function (effect) {
            return effect.sourceRuntimeId === runtime.towerRuntimeId && effect.statusId === "mark";
          }).map(function (effect) { return effect.targetRuntimeId; }).sort(function (a, b) { return a - b; });
          if (expiredEnemyRuntimeIds.length > 0) {
            const result = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "status-expiry",
                expiredEnemyRuntimeIds: expiredEnemyRuntimeIds,
                towerRuntimeId: runtime.towerRuntimeId,
              })
            );
            appendEvents(events, result.events);
            nextRuntime = replaceTowerBehaviorState(nextRuntime, behaviorState.index, result.state);
          }
        }
      });
      return nextRuntime;
    }));

    const enemies = enemiesInput.map(function (enemy) {
      let nextEnemy = advanceShieldExpiry(enemy, currentTick);
      nextEnemy.traitStates.forEach(function (traitState, traitIndex) {
        if (traitState.dispatchId !== Behaviors.DISPATCH_IDS.CLOAK) return;
        const owner = entityOwner(content, nextEnemy);
        const result = Behaviors.dispatchBehavior(
          traitState.dispatchId,
          behaviorRequest(content, { parameters: owner.traits[traitIndex] }, traitState.state, {
            actionId: "status-expiry",
            elapsedTimeUnits: ABI.TIME_UNITS_PER_TICK,
            enemyRuntimeId: nextEnemy.id,
            revealActive: hasStatus(effects, nextEnemy.id, "reveal"),
          })
        );
        appendEvents(events, result.events);
        nextEnemy = replaceEnemyTraitState(nextEnemy, traitIndex, result.state);
      });
      return nextEnemy;
    });
    return Object.freeze({
      effects: effects,
      enemies: Object.freeze(enemies),
      towerRuntimes: towerRuntimes,
    });
  }

  function selectedTarget(policy, candidates) {
    if (candidates.length === 0) return null;
    let selected = candidates[0];
    for (let index = 1; index < candidates.length; index++) {
      if (Targeting.compareTargets(policy, candidates[index], selected) < 0) {
        selected = candidates[index];
      }
    }
    return selected;
  }

  function freezeBehaviorStateRecord(prior, state, timer) {
    return Object.freeze({
      behaviorId: prior.behaviorId,
      dispatchId: prior.dispatchId,
      index: prior.index,
      state: state,
      timer: timer,
    });
  }

  /* ADR-014: one closed combat-source record travels with every hit and status intent.
     `tower` is the only kind ABI v1 can produce, so v1 outcomes stay byte-identical, and only
     `tower` sources ever earn defense mastery attribution. */
  const COMBAT_SOURCE_KINDS = Object.freeze(["mechanism", "protocol", "tower", "unit"]);
  const NON_TOWER_TELEMETRY_IDENTITY = Object.freeze({
    defenseId: null,
    level: null,
    padId: null,
    sourceTowerRuntimeId: null,
  });

  function combatSource(kind, sourceId, runtimeId) {
    if (COMBAT_SOURCE_KINDS.indexOf(kind) === -1) {
      throw new RangeError("Unknown combat source kind " + String(kind));
    }
    return Object.freeze({
      kind: kind,
      runtimeId: runtimeId === null ? null : positiveInteger(runtimeId, "Combat source runtime ID"),
      sourceId: sourceId === null ? null : stableId(sourceId, "Combat source ID"),
    });
  }

  function towerCombatSource(towerRuntimeId) {
    return combatSource("tower", null, towerRuntimeId);
  }

  function intentCombatSource(intent) {
    return intent.source ? intent.source : towerCombatSource(intent.towerRuntimeId);
  }

  function intentTowerRuntimeId(intent) {
    const source = intentCombatSource(intent);
    return source.kind === "tower" ? source.runtimeId : null;
  }

  function directIntent(intent, behaviorIndex, targetOrder) {
    return Object.freeze({
      armorIgnoreBp: intent.armorIgnoreBp,
      baseDamageMilli: intent.baseDamageMilli,
      behaviorIndex: behaviorIndex,
      bossCoefficientBp: intent.bossCoefficientBp,
      damageTypeId: intent.damageTypeId,
      internalDamageCoefficientBp: intent.internalDamageCoefficientBp,
      isPrimary: true,
      eligibilityMode: "direct",
      shieldCoefficientBp: intent.shieldCoefficientBp,
      source: towerCombatSource(intent.towerRuntimeId),
      sourceRuntimeId: intent.towerRuntimeId,
      targetOrder: targetOrder,
      targetRuntimeId: intent.targetRuntimeId,
      towerRuntimeId: intent.towerRuntimeId,
    });
  }

  function splashIntent(intent, behaviorIndex, targetOrder, towerRuntimeId) {
    return Object.freeze({
      armorIgnoreBp: 0,
      baseDamageMilli: intent.baseDamageMilli,
      behaviorIndex: behaviorIndex,
      bossCoefficientBp: ABI.BASIS_POINTS,
      damageTypeId: intent.damageTypeId,
      internalDamageCoefficientBp: intent.damageCoefficientBp,
      isPrimary: intent.isPrimary,
      eligibilityMode: intent.isPrimary ? "direct" : "collateral",
      shieldCoefficientBp: ABI.BASIS_POINTS,
      source: towerCombatSource(towerRuntimeId),
      sourceRuntimeId: towerRuntimeId,
      targetOrder: targetOrder,
      targetRuntimeId: intent.targetRuntimeId,
      towerRuntimeId: towerRuntimeId,
    });
  }

  function compareHitIntents(left, right) {
    if (left.towerRuntimeId !== right.towerRuntimeId) {
      return left.towerRuntimeId < right.towerRuntimeId ? -1 : 1;
    }
    if (left.behaviorIndex !== right.behaviorIndex) {
      return left.behaviorIndex < right.behaviorIndex ? -1 : 1;
    }
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    if (left.targetOrder !== right.targetOrder) return left.targetOrder < right.targetOrder ? -1 : 1;
    return 0;
  }

  function runTowerAttacks(content, missionRuntime, enemies, effects, towerRuntimesInput,
    towers, events, telemetry) {
    const hitIntents = [];
    const statusIntents = [];
    const towerRuntimes = towerRuntimesInput.map(function (runtime) {
      const tower = towerByRuntimeId(towers, runtime.towerRuntimeId);
      if (!tower) throw new RangeError("Combat runtime has no owned tower");
      /* ADR-014: a tower attacks only while its disable-source set is empty. The runtime is
         frozen rather than retimed, so an in-progress cooldown is never rescaled. */
      if (tower.disableSources && tower.disableSources.length > 0) return runtime;
      const defense = content.defenses[runtime.defenseId];
      const level = runtimeLevelRecord(content, runtime);
      const behaviorStates = runtime.behaviorStates.slice();

      level.behaviors.forEach(function (behavior, behaviorIndex) {
        let behaviorState = behaviorStates[behaviorIndex];
        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.DIRECT) {
          const candidates = eligibleTargets(
            content, missionRuntime, tower, defense, level, enemies, effects, "direct"
          );
          const target = selectedTarget(tower.targetPolicy, candidates);
          const readyBeforeAdvance = behaviorState.timer.remainingUnits <= ABI.TIME_UNITS_PER_TICK;
          const cooldown = Timers.advanceCooldownAttackPhase(
            behaviorState.timer,
            target !== null,
            Timers.authoredMillisecondsToTimeUnits(behavior.parameters.cooldownMs),
            0
          );
          let nextBehaviorState = behaviorState.state;
          if (cooldown.attacked) {
            const result = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "accepted-primary-hit",
                targetRuntimeId: target.id,
                towerRuntimeId: tower.id,
              })
            );
            nextBehaviorState = result.state;
            appendEvents(events, result.events);
            hitIntents.push(directIntent(result.damageIntent, behaviorIndex, 0));
            telemetry.push("activation", {
              actionId: "direct-hit",
              behaviorId: behavior.id,
              sourceTowerRuntimeId: tower.id,
              sourceRuntimeId: tower.id,
              defenseId: tower.defenseId,
              level: tower.level,
              padId: tower.padId,
              outcome: "accepted",
              eligibleTargetRuntimeIds: sortedUniqueRuntimeIds(candidates.map(function (candidate) {
                return candidate.id;
              })),
              selectedTargetRuntimeIds: [target.id],
            });
            const primaryEnemy = enemies.find(function (enemy) { return enemy.id === target.id; });
            level.behaviors.forEach(function (linked, linkedIndex) {
              if (linked.contractId !== "slow" ||
                  linked.parameters.triggerBehaviorId !== behavior.id) return;
              const linkedState = behaviorStates[linkedIndex];
              const secondaryCandidates = enemies.filter(function (enemy) {
                return enemy.hpMilli > 0 && cloakEligibility(content, enemy, effects, "collateral");
              }).map(behaviorCandidate);
              const slow = Behaviors.dispatchBehavior(
                linkedState.dispatchId,
                behaviorRequest(content, linked, linkedState.state, {
                  actionId: "accepted-primary-hit",
                  primaryPosition: { x: primaryEnemy.position.x, y: primaryEnemy.position.y },
                  primaryTargetRuntimeId: primaryEnemy.id,
                  secondaryCandidates: secondaryCandidates,
                  towerRuntimeId: tower.id,
                })
              );
              appendEvents(events, slow.events);
              statusIntents.push(Object.assign({}, slow.primaryStatusIntent, {
                behaviorIndex: linkedIndex,
                kind: "status",
                sourceRuntimeId: tower.id,
                sourceTypeId: null,
                targetOrder: 0,
              }));
              slow.secondaryStatusIntents.forEach(function (intent, targetOrder) {
                statusIntents.push(Object.assign({}, intent, {
                  behaviorIndex: linkedIndex,
                  kind: "status",
                  sourceRuntimeId: tower.id,
                  sourceTypeId: null,
                  targetOrder: ABI.checkedAdd(targetOrder, 1),
                }));
              });
              behaviorStates[linkedIndex] = freezeBehaviorStateRecord(
                linkedState,
                slow.state,
                linkedState.timer
              );
            });
          } else if (target === null) {
            const idle = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "no-target",
                elapsedTimeUnits: ABI.TIME_UNITS_PER_TICK,
              })
            );
            nextBehaviorState = idle.state;
            appendEvents(events, idle.events);
            if (readyBeforeAdvance) {
              telemetry.push("activation", {
                actionId: "direct-hit",
                behaviorId: behavior.id,
                sourceTowerRuntimeId: tower.id,
                sourceRuntimeId: tower.id,
                defenseId: tower.defenseId,
                level: tower.level,
                padId: tower.padId,
                outcome: "no-target",
                eligibleTargetRuntimeIds: [],
                selectedTargetRuntimeIds: [],
              });
            }
          }
          behaviorStates[behaviorIndex] = freezeBehaviorStateRecord(
            behaviorState,
            nextBehaviorState,
            cooldown.state
          );
          return;
        }

        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.SPLASH) {
          const candidates = eligibleTargets(
            content, missionRuntime, tower, defense, level, enemies, effects, "direct"
          );
          const target = selectedTarget(tower.targetPolicy, candidates);
          const readyBeforeAdvance = behaviorState.timer.remainingUnits <= ABI.TIME_UNITS_PER_TICK;
          const cooldown = Timers.advanceCooldownAttackPhase(
            behaviorState.timer,
            target !== null,
            Timers.authoredMillisecondsToTimeUnits(behavior.parameters.cooldownMs),
            0
          );
          if (cooldown.attacked) {
            const primaryEnemy = enemies.find(function (enemy) { return enemy.id === target.id; });
            const secondaries = enemies.filter(function (enemy) {
              return enemy.hpMilli > 0 && defense.targetKinds.indexOf(enemy.routeKind) !== -1 &&
                cloakEligibility(content, enemy, effects, "collateral");
            }).map(behaviorCandidate);
            const result = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "resolve",
                primaryTarget: behaviorCandidate(primaryEnemy),
                secondaryCandidates: secondaries,
                towerRuntimeId: tower.id,
              })
            );
            appendEvents(events, result.events);
            result.hitIntents.forEach(function (intent, targetOrder) {
              hitIntents.push(splashIntent(intent, behaviorIndex, targetOrder, tower.id));
            });
            telemetry.push("activation", {
              actionId: "splash-blast",
              behaviorId: behavior.id,
              sourceTowerRuntimeId: tower.id,
              sourceRuntimeId: tower.id,
              defenseId: tower.defenseId,
              level: tower.level,
              padId: tower.padId,
              outcome: "accepted",
              eligibleTargetRuntimeIds: sortedUniqueRuntimeIds(
                candidates.map(function (candidate) { return candidate.id; })
                  .concat(secondaries.map(function (candidate) { return candidate.runtimeId; }))
              ),
              selectedTargetRuntimeIds: sortedUniqueRuntimeIds(result.hitIntents.map(function (intent) {
                return intent.targetRuntimeId;
              })),
            });
            behaviorStates[behaviorIndex] = freezeBehaviorStateRecord(
              behaviorState,
              result.state,
              cooldown.state
            );
          } else {
            if (target === null && readyBeforeAdvance) {
              telemetry.push("activation", {
                actionId: "splash-blast",
                behaviorId: behavior.id,
                sourceTowerRuntimeId: tower.id,
                sourceRuntimeId: tower.id,
                defenseId: tower.defenseId,
                level: tower.level,
                padId: tower.padId,
                outcome: "no-target",
                eligibleTargetRuntimeIds: [],
                selectedTargetRuntimeIds: [],
              });
            }
            behaviorStates[behaviorIndex] = freezeBehaviorStateRecord(
              behaviorState,
              behaviorState.state,
              cooldown.state
            );
          }
          return;
        }

        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.MARK) {
          const candidates = eligibleTargets(
            content, missionRuntime, tower, defense, level, enemies, effects, "direct"
          );
          const cooldown = Timers.advanceCooldownAttackPhase(
            behaviorState.timer,
            candidates.length > 0,
            Timers.authoredMillisecondsToTimeUnits(behavior.parameters.cadenceMs),
            0
          );
          const readyBeforeAdvance = behaviorState.timer.remainingUnits <= ABI.TIME_UNITS_PER_TICK;
          let nextBehaviorState = behaviorState.state;
          if (cooldown.attacked) {
            const result = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "scan",
                candidates: candidates.map(function (candidate) {
                  return behaviorCandidateWithoutCoordinates(enemies.find(function (enemy) {
                    return enemy.id === candidate.id;
                  }));
                }),
                towerRuntimeId: tower.id,
              })
            );
            nextBehaviorState = result.state;
            appendEvents(events, result.events);
            result.markIntents.forEach(function (intent, targetOrder) {
              statusIntents.push({
                behaviorIndex: behaviorIndex,
                durationTimeUnits: intent.durationTimeUnits,
                kind: "external-amplification",
                magnitudeBp: intent.amountBp,
                sourceRuntimeId: tower.id,
                sourceTypeId: intent.sourceTypeId,
                statusId: intent.statusId,
                targetOrder: targetOrder,
                targetRuntimeId: intent.targetRuntimeId,
              });
            });
            telemetry.push("activation", {
              actionId: "mark-scan",
              behaviorId: behavior.id,
              sourceTowerRuntimeId: tower.id,
              sourceRuntimeId: tower.id,
              defenseId: tower.defenseId,
              level: tower.level,
              padId: tower.padId,
              outcome: "accepted",
              eligibleTargetRuntimeIds: sortedUniqueRuntimeIds(candidates.map(function (candidate) {
                return candidate.id;
              })),
              selectedTargetRuntimeIds: sortedUniqueRuntimeIds(result.markIntents.map(function (intent) {
                return intent.targetRuntimeId;
              })),
            });
          } else if (candidates.length === 0 && readyBeforeAdvance) {
            telemetry.push("activation", {
              actionId: "mark-scan",
              behaviorId: behavior.id,
              sourceTowerRuntimeId: tower.id,
              sourceRuntimeId: tower.id,
              defenseId: tower.defenseId,
              level: tower.level,
              padId: tower.padId,
              outcome: "no-target",
              eligibleTargetRuntimeIds: [],
              selectedTargetRuntimeIds: [],
            });
          }
          behaviorStates[behaviorIndex] = freezeBehaviorStateRecord(
            behaviorState,
            nextBehaviorState,
            cooldown.state
          );
        }
      });
      return freezeTowerRuntime({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: runtime.createdTick,
        defenseId: runtime.defenseId,
        level: runtime.level,
        specializationId: runtime.specializationId,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    });
    hitIntents.sort(compareHitIntents);
    return Object.freeze({
      hitIntents: Object.freeze(hitIntents),
      statusIntents: Object.freeze(statusIntents),
      towerRuntimes: Object.freeze(towerRuntimes),
    });
  }

  function compareBossReleases(left, right) {
    if (left.dueTick !== right.dueTick) return left.dueTick < right.dueTick ? -1 : 1;
    if (left.releasePlan.bossRuntimeId !== right.releasePlan.bossRuntimeId) {
      return left.releasePlan.bossRuntimeId < right.releasePlan.bossRuntimeId ? -1 : 1;
    }
    return left.releasePlan.thresholdOrder - right.releasePlan.thresholdOrder;
  }

  function runTalosReleases(content, missionRuntime, pendingInput, pendingSpawnsInput, effectsInput,
    enemies, management, config, currentTick, events, telemetry) {
    if (pendingInput.some(function (record) { return record.dueTick < currentTick; })) {
      throw new RangeError("A Talos warning release missed its canonical due tick");
    }
    const due = pendingInput.filter(function (record) { return record.dueTick === currentTick; });
    const future = pendingInput.filter(function (record) { return record.dueTick > currentTick; });
    let pendingSpawns = pendingSpawnsInput.slice();
    let effects = effectsInput;
    let nextManagement = management;
    due.forEach(function (record) {
      const target = enemies.find(function (enemy) {
        return enemy.id === record.releasePlan.bossRuntimeId;
      }) || Object.freeze({
        id: record.releasePlan.bossRuntimeId,
        ownerId: "talos-prototype",
        routeId: record.releasePlan.routeId,
      });
      const result = Behaviors.dispatchBehavior(
        Behaviors.DISPATCH_IDS.TALOS,
        {
          eventCatalog: content.eventCatalog,
          input: { actionId: "warning-release", releasePlan: record.releasePlan },
          limits: BEHAVIOR_LIMITS,
          parameters: content.bosses["talos-prototype"],
          state: null,
        }
      );
      appendEvents(events, result.events);
      if (result.statusDeliveries.length !== 1) {
        throw new RangeError("Candidate Talos exposure requires exactly one status delivery");
      }
      const delivery = result.statusDeliveries[0];
      let applied = applyEffect(effects, nextManagement, config, {
        coefficientBp: result.exposure.damageCoefficientBp,
        durationTimeUnits: result.exposure.durationTimeUnits,
        kind: "boss-exposure",
        magnitude: delivery.magnitudeBp,
        sourceRuntimeId: result.exposure.targetRuntimeId,
        statusId: delivery.statusId,
        targetRuntimeId: result.exposure.targetRuntimeId,
      }, currentTick);
      effects = applied.effects;
      nextManagement = applied.management;
      pushAppliedEffectTelemetry(telemetry, applied, null, target);
      result.resistanceOverridePlans.forEach(function (override) {
        applied = applyEffect(effects, nextManagement, config, {
          damageTypeId: override.damageTypeId,
          durationTimeUnits: override.durationTimeUnits,
          kind: "resistance-override",
          magnitude: override.reductionBp,
          sourceRuntimeId: record.releasePlan.bossRuntimeId,
          statusId: "resistance-override",
          targetRuntimeId: override.targetRuntimeId,
        }, currentTick);
        effects = applied.effects;
        nextManagement = applied.management;
        pushAppliedEffectTelemetry(telemetry, applied, null, target);
      });
      result.childSpawnPlans.forEach(function (plan) {
        for (let childIndex = 0; childIndex < plan.count; childIndex += 1) {
          const relativeTick = ABI.checkedAdd(
            plan.firstDelayTicks,
            ABI.checkedMultiply(childIndex, plan.intervalTicks)
          );
          pendingSpawns.push(frozenSpawnJob({
            authoredIndex: childIndex,
            bountyPolicy: plan.bountyPolicy,
            dueTick: ABI.checkedAdd(currentTick, relativeTick),
            groupId: "talos." + record.releasePlan.thresholdId + "." + plan.order,
            groupOrder: ABI.checkedAdd(1000, ABI.checkedAdd(
              ABI.checkedMultiply(record.releasePlan.thresholdOrder, 100),
              plan.order
            )),
            lineageId: plan.lineageId,
            lineageTags: record.lineageTags,
            ownerId: plan.enemyId,
            routeDistance: ABI.checkedAdd(plan.routeDistance, plan.routeOffsetDistance),
            routeId: plan.routeId,
            sourceBossRuntimeId: plan.sourceBossRuntimeId,
            spawnEventId: null,
            spawnKind: "enemy",
            waveId: record.waveId,
          }));
        }
      });
    });
    pendingSpawns.sort(compareSpawnJobs);
    return Object.freeze({
      effects: effects,
      management: nextManagement,
      pendingBossReleases: Object.freeze(future),
      pendingSpawns: Object.freeze(pendingSpawns),
    });
  }

  function externalDamageEffects(effects, targetRuntimeId) {
    return effectsForTarget(effects, targetRuntimeId).filter(function (effect) {
      return effect.kind === "external-amplification";
    });
  }

  function externalDamageBonus(effects, targetRuntimeId) {
    const inputs = externalDamageEffects(effects, targetRuntimeId).map(function (effect) {
      return {
        appliedTick: effect.appliedTick,
        damageBp: effect.magnitude,
        expiryTimeUnits: effect.timer === null ? Number.MAX_SAFE_INTEGER : effect.timer.remainingUnits,
        magnitude: effect.magnitude,
        name: effect.statusId,
        rangeBp: 0,
        rateBp: 0,
        sourceId: effect.sourceRuntimeId,
        sourceType: effect.sourceTypeId,
      };
    });
    return Effects.resolveExternalAmplification(inputs).damageBp;
  }

  function nativeResistanceBp(content, enemy, effects, damageTypeId) {
    const overrides = effectsForTarget(effects, enemy.id).filter(function (effect) {
      return effect.kind === "resistance-override" && effect.damageTypeId === damageTypeId;
    }).sort(function (left, right) {
      if (left.appliedTick !== right.appliedTick) return right.appliedTick - left.appliedTick;
      return left.id - right.id;
    });
    if (overrides.length > 0) return overrides[0].magnitude;
    const resistance = entityOwner(content, enemy).resistances.find(function (record) {
      return record.damageTypeId === damageTypeId;
    });
    return resistance ? resistance.reductionBp : 0;
  }

  function exposureCoefficient(effects, targetRuntimeId) {
    const exposures = effectsForTarget(effects, targetRuntimeId).filter(function (effect) {
      return effect.kind === "boss-exposure";
    }).sort(function (left, right) {
      if (left.appliedTick !== right.appliedTick) return right.appliedTick - left.appliedTick;
      return left.id - right.id;
    });
    return exposures.length === 0 ? ABI.BASIS_POINTS : exposures[0].coefficientBp;
  }

  function strongestArmorBreakMilli(effects, targetRuntimeId) {
    const instances = effectsForTarget(effects, targetRuntimeId, "armor-break").map(function (effect) {
      return {
        appliedTick: effect.appliedTick,
        expiryTimeUnits: effect.timer === null ? Number.MAX_SAFE_INTEGER : effect.timer.remainingUnits,
        magnitude: effect.magnitude,
        sourceId: effect.sourceRuntimeId,
        statusId: effect.statusId,
      };
    });
    const strongest = Effects.selectStrongestStatus(instances);
    return strongest === null ? 0 : strongest.magnitude;
  }

  function consumeEnemyShields(enemy, shieldDamageMilli) {
    const input = enemy.shields.map(function (shield) {
      return {
        expiryTimeUnits: shield.timer === null ? Number.MAX_SAFE_INTEGER : shield.timer.remainingUnits,
        remainingMilli: shield.remainingMilli,
        sourceId: shield.sourceId,
      };
    });
    const consumed = Effects.consumeShieldPools(input, shieldDamageMilli);
    const remainingBySource = Object.create(null);
    consumed.pools.forEach(function (pool) { remainingBySource[pool.sourceId] = pool.remainingMilli; });
    const shields = enemy.shields.filter(function (shield) {
      return own(remainingBySource, shield.sourceId);
    }).map(function (shield) {
      return Object.freeze({
        poolId: shield.poolId,
        remainingMilli: remainingBySource[shield.sourceId],
        sourceId: shield.sourceId,
        timer: shield.timer,
      });
    });
    return Object.freeze({
      absorbedMilli: consumed.absorbedMilli,
      overflowMilli: consumed.overflowMilli,
      shields: Object.freeze(shields),
    });
  }

  function resolvedDamage(content, enemy, effects, intent, externalDamageBpOverride) {
    const internal = [intent.internalDamageCoefficientBp];
    if (enemy.kind === "boss") {
      internal.push(intent.bossCoefficientBp);
      internal.push(exposureCoefficient(effects, enemy.id));
    }
    const externalDamageBp = externalDamageBpOverride === undefined
      ? externalDamageBonus(effects, enemy.id)
      : nonnegativeInteger(externalDamageBpOverride, "Damage external amplification override");
    const preShield = ABI.preShieldDamageMilli(
      intent.baseDamageMilli,
      internal,
      externalDamageBp
    );
    const shieldDamage = ABI.shieldBoundDamageMilli(preShield, intent.shieldCoefficientBp);
    const shields = consumeEnemyShields(enemy, shieldDamage);
    const hp = ABI.resolveHpDamageMilli(
      shields.overflowMilli,
      enemy.armorMilli,
      strongestArmorBreakMilli(effects, enemy.id),
      intent.armorIgnoreBp,
      nativeResistanceBp(content, enemy, effects, intent.damageTypeId)
    );
    return Object.freeze({
      appliedShieldDamageMilli: shields.absorbedMilli,
      attemptedShieldDamageMilli: shieldDamage,
      hpDamageMilli: hp.hpDamageMilli,
      preShieldDamageMilli: preShield,
      shields: shields.shields,
    });
  }

  function revealTelemetrySources(content, enemy, effects, intent) {
    if (intent.eligibilityMode === null) return Object.freeze([]);
    const reveals = effectsForTarget(effects, enemy.id, "reveal");
    if (reveals.length === 0) return Object.freeze([]);
    const traitIndex = enemy.traitStates.findIndex(function (trait) { return trait.kind === "cloak"; });
    if (traitIndex < 0) return Object.freeze([]);
    const owner = entityOwner(content, enemy);
    const eligibility = Behaviors.dispatchBehavior(
      Behaviors.DISPATCH_IDS.CLOAK,
      behaviorRequest(content, { parameters: owner.traits[traitIndex] }, enemy.traitStates[traitIndex].state, {
        actionId: "eligibility",
        revealActive: false,
      })
    ).eligibility;
    const eligibleWithoutReveal = intent.eligibilityMode === "collateral"
      ? eligibility.collateralEligible
      : eligibility.directEligible;
    if (eligibleWithoutReveal) return Object.freeze([]);
    return sortedUniqueRuntimeIds(reveals.map(function (effect) { return effect.sourceRuntimeId; }));
  }

  function resolvedHpAfterDamage(content, enemy, damageMilli) {
    if (enemy.kind !== "boss") {
      return Math.max(0, ABI.checkedAdd(enemy.hpMilli, -Math.min(enemy.hpMilli, damageMilli)));
    }
    const result = Behaviors.dispatchBehavior(
      Behaviors.DISPATCH_IDS.TALOS,
      {
        eventCatalog: content.eventCatalog,
        input: {
          actionId: "resolved-hit",
          bossRuntimeId: enemy.id,
          damageMilli: damageMilli,
          lineageId: enemy.lineageId,
          routeDistance: enemy.distance,
          routeId: enemy.routeId,
        },
        limits: BEHAVIOR_LIMITS,
        parameters: content.bosses[enemy.ownerId],
        state: enemy.bossState,
      }
    );
    return result.state.currentHpMilli;
  }

  function applyCloakDamage(content, enemy, effects, sourceRuntimeId, hpDamageMilli, events) {
    if (hpDamageMilli === 0) return enemy;
    const traitIndex = enemy.traitStates.findIndex(function (trait) { return trait.kind === "cloak"; });
    if (traitIndex < 0) return enemy;
    const owner = entityOwner(content, enemy);
    const result = Behaviors.dispatchBehavior(
      Behaviors.DISPATCH_IDS.CLOAK,
      behaviorRequest(content, { parameters: owner.traits[traitIndex] }, enemy.traitStates[traitIndex].state, {
        actionId: "accepted-damage",
        enemyRuntimeId: enemy.id,
        hpDamageMilli: hpDamageMilli,
        revealActive: hasStatus(effects, enemy.id, "reveal"),
        sourceRuntimeId: sourceRuntimeId,
      })
    );
    appendEvents(events, result.events);
    return replaceEnemyTraitState(enemy, traitIndex, result.state);
  }

  function runDamage(content, enemiesInput, effects, intents, pendingBossReleasesInput,
    towers, currentTick, events, telemetry) {
    const enemies = enemiesInput.slice();
    const byId = Object.create(null);
    enemies.forEach(function (enemy, index) { byId[enemy.id] = index; });
    const pendingBossReleases = pendingBossReleasesInput.slice();
    intents.forEach(function (intent) {
      const enemyIndex = byId[intent.targetRuntimeId];
      if (enemyIndex === undefined) return;
      let enemy = enemies[enemyIndex];
      if (enemy.hpMilli === 0) return;
      const source = intentCombatSource(intent);
      const sourceTower = source.kind === "tower"
        ? requiredTowerTelemetryIdentity(content, towers, source.runtimeId)
        : NON_TOWER_TELEMETRY_IDENTITY;
      const targetShieldBeforeMilli = totalShieldMilli(enemy);
      const damage = resolvedDamage(content, enemy, effects, intent);
      const noExternal = resolvedDamage(content, enemy, effects, intent, 0);
      const noExternalNextHp = resolvedHpAfterDamage(content, enemy, noExternal.hpDamageMilli);
      let nextHp;
      let bossState = enemy.bossState;
      if (enemy.kind === "boss") {
        const result = Behaviors.dispatchBehavior(
          Behaviors.DISPATCH_IDS.TALOS,
          {
            eventCatalog: content.eventCatalog,
            input: {
              actionId: "resolved-hit",
              bossRuntimeId: enemy.id,
              damageMilli: damage.hpDamageMilli,
              lineageId: enemy.lineageId,
              routeDistance: enemy.distance,
              routeId: enemy.routeId,
            },
            limits: BEHAVIOR_LIMITS,
            parameters: content.bosses[enemy.ownerId],
            state: enemy.bossState,
          }
        );
        appendEvents(events, result.events);
        bossState = result.state;
        nextHp = result.state.currentHpMilli;
        result.scheduledReleasePlans.forEach(function (releasePlan) {
          pendingBossReleases.push(Object.freeze({
            dueTick: ABI.checkedAdd(currentTick, releasePlan.releaseAfterTicks),
            lineageTags: Object.freeze(enemy.lineageTags.slice()),
            releasePlan: releasePlan,
            waveId: enemy.waveId,
          }));
        });
      } else {
        nextHp = Math.max(0, ABI.checkedAdd(enemy.hpMilli, -Math.min(enemy.hpMilli, damage.hpDamageMilli)));
      }
      const output = cloneCanonical(enemy);
      output.bossState = bossState;
      output.hpMilli = nextHp;
      output.shields = damage.shields;
      enemy = Object.freeze(output);
      const appliedHpDamageMilli = ABI.checkedAdd(enemies[enemyIndex].hpMilli, -enemy.hpMilli);
      const unappliedHpDamageMilli = ABI.checkedAdd(
        damage.hpDamageMilli,
        -Math.min(damage.hpDamageMilli, appliedHpDamageMilli)
      );
      const supportSourceTowerRuntimeIds = sortedUniqueRuntimeIds(
        externalDamageEffects(effects, enemy.id).map(function (effect) {
          return effect.sourceRuntimeId;
        })
      );
      telemetry.push("damage", {
        sourceTowerRuntimeId: sourceTower.sourceTowerRuntimeId,
        sourceRuntimeId: intent.sourceRuntimeId,
        defenseId: sourceTower.defenseId,
        level: sourceTower.level,
        padId: sourceTower.padId,
        targetRuntimeId: enemy.id,
        targetOwnerId: enemy.ownerId,
        targetLineageId: enemy.lineageId,
        targetRouteId: enemy.routeId,
        damageTypeId: intent.damageTypeId,
        baseDamageMilli: intent.baseDamageMilli,
        preShieldDamageMilli: damage.preShieldDamageMilli,
        attemptedShieldDamageMilli: damage.attemptedShieldDamageMilli,
        appliedShieldDamageMilli: damage.appliedShieldDamageMilli,
        eligibleHpDamageMilli: damage.hpDamageMilli,
        appliedHpDamageMilli: appliedHpDamageMilli,
        deferredHpDamageMilli: enemy.kind === "boss" && enemy.hpMilli > 0
          ? unappliedHpDamageMilli : 0,
        overkillHpDamageMilli: enemy.hpMilli === 0 ? unappliedHpDamageMilli : 0,
        noExternalAppliedShieldDamageMilli: noExternal.appliedShieldDamageMilli,
        noExternalAppliedHpDamageMilli: ABI.checkedAdd(
          enemies[enemyIndex].hpMilli,
          -noExternalNextHp
        ),
        targetShieldBeforeMilli: targetShieldBeforeMilli,
        targetShieldAfterMilli: totalShieldMilli(enemy),
        targetHpBeforeMilli: enemies[enemyIndex].hpMilli,
        targetHpAfterMilli: enemy.hpMilli,
        supportSourceTowerRuntimeIds: supportSourceTowerRuntimeIds,
        revealSourceTowerRuntimeIds: revealTelemetrySources(
          content,
          enemies[enemyIndex],
          effects,
          intent
        ),
      });
      enemy = applyCloakDamage(
        content, enemy, effects, intentTowerRuntimeId(intent), damage.hpDamageMilli, events
      );
      enemies[enemyIndex] = enemy;
    });
    pendingBossReleases.sort(compareBossReleases);
    return Object.freeze({
      enemies: Object.freeze(enemies),
      pendingBossReleases: Object.freeze(pendingBossReleases),
    });
  }

  function resetWaveBehaviorStates(content, towerRuntimes) {
    return Object.freeze(towerRuntimes.map(function (runtime) {
      const level = runtimeLevelRecord(content, runtime);
      const behaviorStates = runtime.behaviorStates.map(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.SLOW &&
            behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.MARK) return behaviorState;
        const behavior = level.behaviors[behaviorState.index];
        const result = Behaviors.dispatchBehavior(
          behaviorState.dispatchId,
          behaviorRequest(content, behavior, behaviorState.state, { actionId: "wave-start" })
        );
        if (result.events.length !== 0) {
          throw new RangeError("Wave-start behavior reset cannot emit semantic events");
        }
        return freezeBehaviorStateRecord(behaviorState, result.state, behaviorState.timer);
      });
      return freezeTowerRuntime({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: runtime.createdTick,
        defenseId: runtime.defenseId,
        level: runtime.level,
        specializationId: runtime.specializationId,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    }));
  }

  function runRetiredRevealCleanup(content, priorRuntimes, priorTowers, towers, enemies,
    effectsInput, events, telemetry) {
    const activeTowerIds = new Set(towers.map(function (tower) { return tower.id; }));
    let effects = effectsInput;
    priorRuntimes.filter(function (runtime) {
      return !activeTowerIds.has(runtime.towerRuntimeId);
    }).forEach(function (runtime) {
      const level = runtimeLevelRecord(content, runtime);
      runtime.behaviorStates.forEach(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.REVEAL) return;
        const result = Behaviors.dispatchBehavior(
          behaviorState.dispatchId,
          behaviorRequest(content, level.behaviors[behaviorState.index], behaviorState.state, {
            actionId: "status-expiry",
            eligibleEnemyRuntimeIds: [],
            sourceActive: false,
            towerRuntimeId: runtime.towerRuntimeId,
          })
        );
        appendEvents(events, result.events);
        const removed = effects.filter(function (effect) {
          return effect.sourceRuntimeId === runtime.towerRuntimeId && effect.statusId === "reveal";
        });
        effects = removeEffects(effects, function (effect) {
          return effect.sourceRuntimeId === runtime.towerRuntimeId && effect.statusId === "reveal";
        });
        removed.forEach(function (effect) {
          pushRemovedEffectTelemetry(
            telemetry,
            "remove",
            "removed",
            effect,
            requiredTowerTelemetryIdentity(content, priorTowers, runtime.towerRuntimeId),
            requiredTelemetryTarget(enemies, effect.targetRuntimeId)
          );
        });
      });
    });
    return effects;
  }

  function planRevealSync(content, missionRuntime, enemies, effects,
    towerRuntimesInput, towers, events) {
    const statusIntents = [];
    const towerRuntimes = towerRuntimesInput.map(function (runtime) {
      const tower = towerByRuntimeId(towers, runtime.towerRuntimeId);
      if (!tower) throw new RangeError("Reveal sync runtime has no owned tower");
      const defense = content.defenses[runtime.defenseId];
      const level = runtimeLevelRecord(content, runtime);
      let nextRuntime = runtime;
      runtime.behaviorStates.forEach(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.REVEAL) return;
        const eligible = eligibleTargets(
          content,
          missionRuntime,
          tower,
          defense,
          level,
          enemies,
          effects,
          "continuous"
        ).map(function (candidate) { return candidate.id; });
        const result = Behaviors.dispatchBehavior(
          behaviorState.dispatchId,
          behaviorRequest(content, level.behaviors[behaviorState.index], behaviorState.state, {
            actionId: "shield-damage-and-status",
            eligibleEnemyRuntimeIds: eligible,
            sourceActive: true,
            towerRuntimeId: runtime.towerRuntimeId,
          })
        );
        appendEvents(events, result.events);
        result.statusIntents.forEach(function (intent) {
          if (intent.kind !== "apply") {
            throw new RangeError("Reveal apply phase returned a non-apply intent");
          }
          statusIntents.push({
            behaviorIndex: behaviorState.index,
            durationTimeUnits: null,
            kind: "status",
            magnitudeBp: 0,
            sourceRuntimeId: runtime.towerRuntimeId,
            sourceTypeId: null,
            statusId: intent.statusId,
            targetOrder: statusIntents.length,
            targetRuntimeId: intent.enemyRuntimeId,
          });
        });
        nextRuntime = replaceTowerBehaviorState(nextRuntime, behaviorState.index, result.state);
      });
      return nextRuntime;
    });
    return Object.freeze({
      statusIntents: Object.freeze(statusIntents),
      towerRuntimes: Object.freeze(towerRuntimes),
    });
  }

  function compareStatusIntents(left, right) {
    if (left.sourceRuntimeId !== right.sourceRuntimeId) {
      return left.sourceRuntimeId - right.sourceRuntimeId;
    }
    if (left.behaviorIndex !== right.behaviorIndex) {
      return left.behaviorIndex - right.behaviorIndex;
    }
    if (left.targetOrder !== right.targetOrder) return left.targetOrder - right.targetOrder;
    return left.targetRuntimeId - right.targetRuntimeId;
  }

  function applyTowerStatusIntents(content, towers, enemies, effectsInput, statusIntentsInput,
    management, config, currentTick, telemetry) {
    let effects = effectsInput;
    let nextManagement = management;
    const statusIntents = statusIntentsInput.slice().sort(compareStatusIntents);
    statusIntents.forEach(function (intent) {
      const target = enemies.find(function (enemy) {
        return enemy.id === intent.targetRuntimeId;
      });
      if (!target) {
        throw new RangeError("Tower status intent target is not available for telemetry");
      }
      const sourceTower = requiredTowerTelemetryIdentity(content, towers, intent.sourceRuntimeId);
      const requestedDuration = intent.durationTimeUnits === null ? 0 : intent.durationTimeUnits;
      if (target.hpMilli === 0) {
        pushEffectTelemetry(
          telemetry,
          "apply",
          "rejected",
          {
            kind: intent.kind,
            magnitude: intent.magnitudeBp,
            sourceRuntimeId: intent.sourceRuntimeId,
            statusId: intent.statusId,
          },
          sourceTower,
          target,
          intent.magnitudeBp,
          0,
          requestedDuration,
          0
        );
        return;
      }
      const applied = applyEffect(effects, nextManagement, config, {
        durationTimeUnits: intent.durationTimeUnits,
        kind: intent.kind,
        magnitude: intent.magnitudeBp,
        sourceRuntimeId: intent.sourceRuntimeId,
        sourceTypeId: intent.sourceTypeId,
        statusId: intent.statusId,
        targetRuntimeId: intent.targetRuntimeId,
      }, currentTick);
      effects = applied.effects;
      nextManagement = applied.management;
      pushAppliedEffectTelemetry(telemetry, applied, sourceTower, target);
    });
    return Object.freeze({ effects: effects, management: nextManagement });
  }

  function purgeRevealTargets(towerRuntimes, removedEnemyIdsInput) {
    const removedEnemyIds = new Set(removedEnemyIdsInput);
    if (removedEnemyIds.size === 0) return towerRuntimes;
    return Object.freeze(towerRuntimes.map(function (runtime) {
      let changed = false;
      const behaviorStates = runtime.behaviorStates.map(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.REVEAL) return behaviorState;
        const retained = behaviorState.state.revealedEnemyRuntimeIds.filter(function (runtimeId) {
          return !removedEnemyIds.has(runtimeId);
        });
        if (retained.length === behaviorState.state.revealedEnemyRuntimeIds.length) {
          return behaviorState;
        }
        changed = true;
        return freezeBehaviorStateRecord(
          behaviorState,
          Object.freeze({ revealedEnemyRuntimeIds: Object.freeze(retained) }),
          behaviorState.timer
        );
      });
      if (!changed) return runtime;
      return freezeTowerRuntime({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: runtime.createdTick,
        defenseId: runtime.defenseId,
        level: runtime.level,
        specializationId: runtime.specializationId,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    }));
  }

  function incrementLeakFacts(objectiveFacts, enemy) {
    const routeLeakCounts = objectiveFacts.routeLeakCounts.map(function (record) {
      return record.routeId === enemy.routeId
        ? Object.freeze({ leakCount: ABI.checkedAdd(record.leakCount, 1), routeId: record.routeId })
        : record;
    });
    const tags = new Set(enemy.lineageTags);
    const lineageTagLeakCounts = objectiveFacts.lineageTagLeakCounts.map(function (record) {
      return tags.has(record.lineageTag)
        ? Object.freeze({
            leakCount: ABI.checkedAdd(record.leakCount, 1),
            lineageTag: record.lineageTag,
          })
        : record;
    });
    return Object.freeze({
      integrity: objectiveFacts.integrity,
      lineageTagLeakCounts: Object.freeze(lineageTagLeakCounts),
      outcome: objectiveFacts.outcome,
      ownedTowerCount: objectiveFacts.ownedTowerCount,
      routeLeakCounts: Object.freeze(routeLeakCounts),
    });
  }

  function runLeaks(content, towers, enemiesInput, effectsInput, integrityInput,
    objectiveFactsInput, telemetry) {
    const reached = enemiesInput.filter(function (enemy) {
      return enemy.hpMilli > 0 && enemy.position.remainingDistance === 0;
    }).sort(function (left, right) { return left.id - right.id; });
    const leakedIds = new Set();
    let integrity = integrityInput;
    let objectiveFacts = objectiveFactsInput;
    let defeat = false;
    reached.some(function (enemy) {
      leakedIds.add(enemy.id);
      const integrityBefore = integrity;
      integrity = Math.max(0, ABI.checkedAdd(integrity, -Math.min(integrity, enemy.leakIntegrity)));
      telemetry.push("leak", {
        enemyRuntimeId: enemy.id,
        ownerId: enemy.ownerId,
        lineageId: enemy.lineageId,
        routeId: enemy.routeId,
        hpMilli: enemy.hpMilli,
        shieldMilli: totalShieldMilli(enemy),
        integrityDamage: ABI.checkedAdd(integrityBefore, -integrity),
      });
      objectiveFacts = incrementLeakFacts(objectiveFacts, enemy);
      if (integrity === 0) {
        defeat = true;
        return true;
      }
      return false;
    });
    const facts = cloneCanonical(objectiveFacts);
    facts.integrity = integrity;
    effectsInput.filter(function (effect) {
      return leakedIds.has(effect.targetRuntimeId);
    }).forEach(function (effect) {
      pushRemovedEffectTelemetry(
        telemetry,
        "remove",
        "removed",
        effect,
        effectSourceTowerIdentity(content, towers, effect),
        requiredTelemetryTarget(enemiesInput, effect.targetRuntimeId)
      );
    });
    return Object.freeze({
      defeat: defeat,
      effects: removeEffects(effectsInput, function (effect) {
        return leakedIds.has(effect.targetRuntimeId);
      }),
      enemies: Object.freeze(enemiesInput.filter(function (enemy) {
        return !leakedIds.has(enemy.id);
      })),
      integrity: integrity,
      objectiveFacts: deepFreeze(facts),
      removedEnemyIds: Object.freeze(Array.from(leakedIds).sort(function (a, b) { return a - b; })),
    });
  }

  function runTerminalDeaths(content, towers, enemiesInput, effectsInput, scoreFactsInput,
    telemetry) {
    const deaths = enemiesInput.filter(function (enemy) { return enemy.hpMilli === 0; })
      .sort(function (left, right) { return left.id - right.id; });
    let killScore = scoreFactsInput.killScore;
    deaths.forEach(function (enemy) {
      const owner = entityOwner(content, enemy);
      if (!owner.deathBehavior || owner.deathBehavior.kind !== "terminal") {
        throw new RangeError("Candidate slice kernel cannot resolve a nonterminal death behavior");
      }
      killScore = ABI.checkedAdd(killScore, enemy.scoreValue);
    });
    const deadIds = new Set(deaths.map(function (enemy) { return enemy.id; }));
    effectsInput.filter(function (effect) {
      return deadIds.has(effect.targetRuntimeId);
    }).forEach(function (effect) {
      pushRemovedEffectTelemetry(
        telemetry,
        "remove",
        "removed",
        effect,
        effectSourceTowerIdentity(content, towers, effect),
        requiredTelemetryTarget(enemiesInput, effect.targetRuntimeId)
      );
    });
    return Object.freeze({
      deaths: Object.freeze(deaths),
      effects: removeEffects(effectsInput, function (effect) {
        return deadIds.has(effect.targetRuntimeId);
      }),
      enemies: Object.freeze(enemiesInput.filter(function (enemy) { return !deadIds.has(enemy.id); })),
      scoreFacts: Object.freeze({ killScore: killScore, waveScore: scoreFactsInput.waveScore }),
    });
  }

  function runBounties(deaths, lineagesInput, management, config, difficulty, telemetry,
    relicBountyBp) {
    let nextManagement = management;
    let lineages = lineagesInput.slice();
    deaths.forEach(function (enemy) {
      const index = lineages.findIndex(function (lineage) {
        return lineage.lineageId === enemy.lineageId;
      });
      if (index < 0) throw new RangeError("Terminal entity has no canonical lineage ledger record");
      const lineage = lineages[index];
      if (lineage.bountyPolicy === "suppressed") return;
      if (lineage.bountyPolicy !== "base-lineage") {
        throw new RangeError("Unsupported Candidate bounty policy " + lineage.bountyPolicy);
      }
      if (lineage.claimed) return;
      const result = creditBounty(
        nextManagement,
        config,
        lineage.baseLineageBountyAether,
        difficulty.bountyBp,
        relicBountyBp === undefined ? null : relicBountyBp
      );
      emitInternalAetherTelemetry(
        telemetry,
        "bounty",
        lineage.lineageId,
        nextManagement,
        result.management
      );
      nextManagement = result.management;
      lineages[index] = Object.freeze({
        baseLineageBountyAether: lineage.baseLineageBountyAether,
        bountyPolicy: lineage.bountyPolicy,
        claimed: true,
        lineageId: lineage.lineageId,
      });
    });
    return Object.freeze({
      lineages: Object.freeze(lineages),
      management: nextManagement,
    });
  }

  function terminalObjectiveAndScore(content, missionRuntime, difficulty, state, outcome,
    integrity, objectiveFactsInput, management, scoreFacts) {
    const objectiveFacts = cloneCanonical(objectiveFactsInput);
    objectiveFacts.integrity = integrity;
    objectiveFacts.outcome = outcome;
    objectiveFacts.ownedTowerCount = outcome === "victory" ? management.towers.length : 0;
    const frozenFacts = deepFreeze(objectiveFacts);
    const objectiveBinding = missionRuntime.objectiveBindings[state.difficultyId];
    const objectiveEvaluation = Objectives.evaluateObjectives(
      objectiveBinding,
      objectiveProjection(objectiveBinding, frozenFacts)
    );
    const scoreRecord = missionRuntime.mission.scoreRecord;
    if (scoreRecord.scoreRuleId !== content.campaignRules.scoreRules.id ||
        scoreRecord.scoreRuleId !== "campaign-score-v1") {
      throw new RangeError("Unsupported Candidate score rule");
    }
    let rawBase = ABI.checkedAdd(scoreFacts.killScore, scoreFacts.waveScore);
    if (outcome === "victory") {
      rawBase = ABI.checkedAdd(rawBase, scoreRecord.victoryScore);
      rawBase = ABI.checkedAdd(rawBase, ABI.checkedMultiply(integrity, scoreRecord.integrityPointScore));
      const mastery = objectiveEvaluation.objectiveResults.find(function (result) {
        return result.id === "mastery";
      });
      if (mastery && mastery.complete) {
        rawBase = ABI.checkedAdd(rawBase, scoreRecord.masteryObjectiveScore);
      }
    }
    let nonAetherScore = ABI.checkedMulDivFloor(
      rawBase,
      [difficulty.scoreBp],
      [ABI.BASIS_POINTS]
    );
    if (rawBase > 0 && nonAetherScore === 0) {
      nonAetherScore = content.campaignRules.scoreRules.minimumNonzeroScore;
    }
    let excludedStartAether = modifierAether(
      content.campaignRules,
      state.campaignModifierIds
    );
    if (state.assist) {
      excludedStartAether = ABI.checkedAdd(
        excludedStartAether,
        content.campaignRules.assistRecord.startAetherAdd
      );
    }
    const eligibleUnspentAether = Math.max(0, ABI.checkedAdd(
      management.aether,
      -Math.min(management.aether, excludedStartAether)
    ));
    const rawUnspentScore = ABI.checkedMultiply(
      eligibleUnspentAether,
      scoreRecord.rawUnspentScorePerEligibleAether
    );
    const unspentCap = Math.floor(
      nonAetherScore / content.campaignRules.scoreRules.unspentCapDivisor
    );
    const unspentScore = Math.min(rawUnspentScore, unspentCap);
    return Object.freeze({
      objectiveFacts: frozenFacts,
      objectiveResults: objectiveEvaluation.objectiveResults,
      score: ABI.checkedAdd(nonAetherScore, unspentScore),
    });
  }

  function orderedSemanticEvents(content, events) {
    if (events.length > MAX_SEMANTIC_EVENTS_PER_TICK) {
      throw new RangeError("Semantic events exceed the kernel per-tick ceiling");
    }
    const phaseOrder = content.schemaVersion === 4 ? V2_PHASE_IDS : ABI.DESCRIPTOR.phaseOrder;
    const ordered = events.map(function (event, index) {
      return { event: event, index: index, phase: phaseOrder.indexOf(event.phaseId) };
    });
    ordered.forEach(function (record) {
      if (record.phase < 0) throw new RangeError("Semantic event has an unknown ABI phase");
    });
    ordered.sort(function (left, right) {
      if (left.phase !== right.phase) return left.phase - right.phase;
      return left.index - right.index;
    });
    return Behaviors.validateSemanticEvents(
      content.eventCatalog,
      ordered.map(function (record) { return record.event; }),
      BEHAVIOR_LIMITS
    );
  }

  /* A v4 event catalog owns its payload field set. The kernel offers the complete fact record
     and the catalog decides which of those facts it publishes; a declared required fact that the
     kernel cannot supply is a content/kernel disagreement and fails the tick. */
  function semanticEventWithFacts(content, eventId, facts) {
    const definition = content.eventCatalog[eventId];
    if (!definition) throw new RangeError("Unknown compiled semantic event " + eventId);
    const payload = {};
    definition.payloadFields.forEach(function (field) {
      if (own(facts, field.name)) {
        payload[field.name] = facts[field.name];
        return;
      }
      if (field.required) {
        throw new RangeError("Semantic event " + eventId + " requires unavailable fact " + field.name);
      }
    });
    return semanticEvent(content, eventId, payload);
  }

  function protocolTierRecord(catalog, protocolId, tier) {
    for (let index = 0; index < catalog.protocols.length; index++) {
      const protocol = catalog.protocols[index];
      if (protocol.protocolId !== protocolId) continue;
      const record = protocol.tiers[tier - 1];
      if (record && record.tier === tier) return record;
    }
    throw new RangeError("Accepted Protocol activation has no compiled tier record");
  }

  function initialProtocolRuntime(header) {
    const equipped = header.protocolLoadout.map(function (record) {
      return Object.freeze({
        acceptedCastCount: 0,
        loan: false,
        protocolId: record.protocolId,
        readyTick: 0,
        tier: record.tier,
      });
    });
    if (header.missionProtocolLoan !== null) {
      equipped.push(Object.freeze({
        acceptedCastCount: 0,
        loan: true,
        protocolId: header.missionProtocolLoan.protocolId,
        readyTick: 0,
        tier: header.missionProtocolLoan.tier,
      }));
    }
    return Object.freeze({
      effects: Object.freeze([]),
      equipped: Object.freeze(equipped),
      schedules: Object.freeze([]),
      sharedReadyTick: 0,
      wardCharges: 0,
    });
  }

  /* Every bounded v2 collection is checked before the tick mutates anything at all. */
  function assertBoundedV2State(state) {
    if (state.protocols.effects.length > MAX_PROTOCOL_EFFECTS) {
      throw new RangeError("Protocol effects exceed the kernel ceiling");
    }
    if (state.protocols.schedules.length > MAX_PROTOCOL_SCHEDULES) {
      throw new RangeError("Protocol schedules exceed the kernel ceiling");
    }
    if (state.protocols.equipped.length > ABI.checkedAdd(MAX_PROTOCOL_SLOTS, 1)) {
      throw new RangeError("Protocol runtime records exceed the kernel ceiling");
    }
    if (state.mechanism.zones.length > MAX_MECHANISM_ZONES) {
      throw new RangeError("Mechanism zones exceed the kernel ceiling");
    }
    state.management.towers.forEach(function (tower) {
      if (tower.disableSources.length > MAX_DISABLE_SOURCES) {
        throw new RangeError("Tower disable sources exceed the kernel ceiling");
      }
    });
  }

  function activeProtocolField(fields, currentTick) {
    return fields.filter(function (field) { return field.expiryTick > currentTick; });
  }

  /* Spec 6.1: one field, one movement-reduction instance per affected enemy, and every instance
     keeps the field's ORIGINAL expiry rather than a fresh full duration from its own start. */
  function applyGlobalSlowField(field, enemies, effectsInput, managementInput, config,
    currentTick, telemetry) {
    let effects = effectsInput;
    let management = managementInput;
    const remainingUnits = ABI.checkedMultiply(
      ABI.checkedAdd(field.expiryTick, -currentTick),
      ABI.TIME_UNITS_PER_TICK
    );
    if (remainingUnits <= 0) {
      return Object.freeze({ effects: effects, management: management, appliedCount: 0 });
    }
    let appliedCount = 0;
    enemies.forEach(function (enemy) {
      if (enemy.hpMilli === 0) return;
      const applied = applyEffect(effects, management, config, {
        durationTimeUnits: remainingUnits,
        kind: "status",
        magnitude: field.magnitudeBp,
        sourceRuntimeId: field.effectRuntimeId,
        sourceTypeId: "protocol",
        statusId: "slow",
        targetRuntimeId: enemy.id,
      }, currentTick);
      effects = applied.effects;
      management = applied.management;
      appliedCount += 1;
      pushAppliedEffectTelemetry(telemetry, applied, null, enemy);
    });
    return Object.freeze({
      appliedCount: appliedCount,
      effects: effects,
      management: management,
    });
  }

  function registerState(binding, state) {
    ABI.canonicalEncode(state);
    deepFreeze(state);
    stateRecords.set(state, binding);
    return state;
  }

  function createInitialStateV2(binding, record, headerInput) {
    const header = normalizeHeaderV2(binding, record, headerInput);
    const missionRuntime = record.missions[header.missionId];
    validateLoadout(record.content, missionRuntime.mission, header);
    const difficulty = difficultyById(record.content.campaignRules, header.difficultyId);
    const relics = Relics.resolveRelicLoadout(
      record.content.relics,
      header.relicIds,
      header.relicSlotCap
    );
    const start = Economy.resolveStartAether(
      missionRuntime.mission.baseStartAether,
      difficulty.startAetherBp,
      modifierAether(record.content.campaignRules, header.campaignModifierIds),
      header.assist ? record.content.campaignRules.assistRecord.startAetherAdd : 0,
      relicAdditiveAmount(relics, RELIC_STAT_START_AETHER)
    );
    /* Spec 8.2: Relic integrity is additive on both the starting and maximum pool. */
    const integrity = Math.max(0, ABI.checkedAdd(
      difficulty.integrity,
      relicAdditiveAmount(relics, RELIC_STAT_START_INTEGRITY)
    ));
    const config = managementConfigV2(
      record.content,
      missionRuntime,
      header,
      start.startAether,
      relics
    );
    const management = Management.createManagementState(config);
    const objectiveBinding = missionRuntime.objectiveBindings[header.difficultyId];
    const objectiveFacts = deepFreeze(Object.assign(
      cloneCanonical(initialObjectiveFacts(record.content, missionRuntime, difficulty)),
      { integrity: integrity }
    ));
    const objectiveEvaluation = Objectives.evaluateObjectives(
      objectiveBinding,
      objectiveProjection(objectiveBinding, objectiveFacts)
    );
    const state = {
      schemaVersion: KERNEL_SCHEMA_VERSION_V2,
      rulesetHash: binding.rulesetHash,
      contentVersion: binding.contentVersion,
      tick: 0,
      missionId: header.missionId,
      difficultyId: header.difficultyId,
      assist: header.assist,
      seed: header.seed,
      loadoutIds: header.loadoutIds.slice(),
      loadoutSlotCap: header.loadoutSlotCap,
      campaignModifierIds: header.campaignModifierIds.slice(),
      accessGrantIds: header.accessGrantIds.slice(),
      tutorialUpgradeGateMode: header.tutorialUpgradeGateMode,
      protocolLoadout: header.protocolLoadout.map(function (entry) {
        return { protocolId: entry.protocolId, slot: entry.slot, tier: entry.tier };
      }),
      protocolSlotCap: header.protocolSlotCap,
      protocolAuthority: header.protocolAuthority.map(function (entry) {
        return { availableTier: entry.availableTier, protocolId: entry.protocolId };
      }),
      missionProtocolLoan: header.missionProtocolLoan === null ? null : {
        protocolId: header.missionProtocolLoan.protocolId,
        tier: header.missionProtocolLoan.tier,
      },
      relicIds: header.relicIds.slice(),
      relicSlotCap: header.relicSlotCap,
      reinforcementId: header.reinforcementId,
      specializationAccessIds: header.specializationAccessIds.slice(),
      management: management,
      routes: initialRoutes(missionRuntime),
      enemies: [],
      timers: [],
      effects: [],
      lineages: [],
      pendingSpawns: [],
      pendingBossReleases: [],
      rngStreams: [],
      protocols: initialProtocolRuntime(header),
      income: {
        protocolAetherEarned: 0,
        specializationAetherEarned: 0,
        wardPreventedIntegrity: 0,
      },
      relics: cloneCanonical(relics),
      reinforcement: {
        liveUnitId: null,
        readyTick: 0,
        reinforcementId: header.reinforcementId,
      },
      mechanism: {
        activationsUsed: 0,
        mechanismId: missionRuntime.mission.mechanism === null
          ? null : missionRuntime.mission.mechanism.mechanismId,
        pending: null,
        readyTick: 0,
        zones: [],
      },
      objectiveFacts: objectiveFacts,
      objectiveResults: objectiveEvaluation.objectiveResults,
      integrity: integrity,
      score: 0,
      scoreFacts: { killScore: 0, waveScore: 0 },
      outcome: "active",
      waveStartTick: null,
    };
    return registerState(binding, state);
  }

  function createInitialState(binding, headerInput) {
    const record = requireBinding(binding);
    if (record.abiVersion === 2) return createInitialStateV2(binding, record, headerInput);
    const header = normalizeHeader(binding, record, headerInput);
    const missionRuntime = record.missions[header.missionId];
    validateLoadout(record.content, missionRuntime.mission, header);
    const difficulty = difficultyById(record.content.campaignRules, header.difficultyId);
    const start = Economy.resolveStartAether(
      missionRuntime.mission.baseStartAether,
      difficulty.startAetherBp,
      modifierAether(record.content.campaignRules, header.campaignModifierIds),
      header.assist ? record.content.campaignRules.assistRecord.startAetherAdd : 0
    );
    const config = managementConfig(record.content, missionRuntime, header, start.startAether);
    const management = Management.createManagementState(config);
    const objectiveBinding = missionRuntime.objectiveBindings[header.difficultyId];
    const objectiveFacts = initialObjectiveFacts(record.content, missionRuntime, difficulty);
    const objectiveEvaluation = Objectives.evaluateObjectives(
      objectiveBinding,
      objectiveProjection(objectiveBinding, objectiveFacts)
    );
    const state = {
      schemaVersion: KERNEL_SCHEMA_VERSION,
      rulesetHash: binding.rulesetHash,
      contentVersion: binding.contentVersion,
      tick: 0,
      missionId: header.missionId,
      difficultyId: header.difficultyId,
      assist: header.assist,
      seed: header.seed,
      loadoutIds: header.loadoutIds.slice(),
      loadoutSlotCap: header.loadoutSlotCap,
      campaignModifierIds: header.campaignModifierIds.slice(),
      accessGrantIds: header.accessGrantIds.slice(),
      tutorialUpgradeGateMode: header.tutorialUpgradeGateMode,
      management: management,
      routes: initialRoutes(missionRuntime),
      enemies: [],
      timers: [],
      effects: [],
      lineages: [],
      pendingSpawns: [],
      pendingBossReleases: [],
      rngStreams: [],
      objectiveFacts: objectiveFacts,
      objectiveResults: objectiveEvaluation.objectiveResults,
      integrity: difficulty.integrity,
      score: 0,
      scoreFacts: { killScore: 0, waveScore: 0 },
      outcome: "active",
      waveStartTick: null,
    };
    return registerState(binding, state);
  }

  function requireState(binding, state) {
    if (!state || stateRecords.get(state) !== binding || !Object.isFrozen(state)) {
      throw new TypeError("Kernel state must come from this binding's createInitialState/advanceTick seam");
    }
    return state;
  }

  function stateHeader(state) {
    return {
      accessGrantIds: state.accessGrantIds,
      assist: state.assist,
      campaignModifierIds: state.campaignModifierIds,
      difficultyId: state.difficultyId,
      eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
      formatVersion: 1,
      loadoutIds: state.loadoutIds,
      loadoutSlotCap: state.loadoutSlotCap,
      missionId: state.missionId,
      rulesetHash: state.rulesetHash,
      seed: state.seed,
      tutorialUpgradeGateMode: state.tutorialUpgradeGateMode,
    };
  }

  function stateHeaderV2(state) {
    return {
      accessGrantIds: state.accessGrantIds,
      assist: state.assist,
      campaignModifierIds: state.campaignModifierIds,
      difficultyId: state.difficultyId,
      eventSchemaVersion: ABIV2.EVENT_SCHEMA_VERSION,
      formatVersion: 2,
      loadoutIds: state.loadoutIds,
      loadoutSlotCap: state.loadoutSlotCap,
      missionId: state.missionId,
      missionProtocolLoan: state.missionProtocolLoan,
      protocolAuthority: state.protocolAuthority,
      protocolLoadout: state.protocolLoadout,
      protocolSlotCap: state.protocolSlotCap,
      relicIds: state.relicIds,
      relicSlotCap: state.relicSlotCap,
      reinforcementId: state.reinforcementId,
      rulesetHash: state.rulesetHash,
      seed: state.seed,
      specializationAccessIds: state.specializationAccessIds,
      tutorialUpgradeGateMode: state.tutorialUpgradeGateMode,
    };
  }

  function cloneStateWith(state, changes) {
    const output = cloneCanonical(state);
    Object.keys(changes).forEach(function (key) { output[key] = changes[key]; });
    return output;
  }

  /* ADR-014: ONE reducer, two declared phase tables. Every function called below is the same
     phase function ABI v1 runs; only the declared order differs, and `phaseTrace` is a
     noncanonical diagnostic that is excluded from every hash exactly like `telemetry`. */
  function advanceTickV2(binding, record, state, commandBucket) {
    const content = record.content;
    const telemetry = createTelemetryCollector(state.tick);
    const phaseTrace = [];
    assertBoundedV2State(state);
    ABI.canonicalEncode(commandBucket);
    const commands = CommandsV2.normalizeCommandSequence(commandBucket);
    commands.forEach(function (command) {
      if (command.tick !== state.tick) {
        throw new RangeError("Every command in a kernel bucket must match the current tick");
      }
    });
    const missionRuntime = record.missions[state.missionId];
    const difficulty = difficultyById(content.campaignRules, state.difficultyId);
    const relics = state.relics;
    const start = Economy.resolveStartAether(
      missionRuntime.mission.baseStartAether,
      difficulty.startAetherBp,
      modifierAether(content.campaignRules, state.campaignModifierIds),
      state.assist ? content.campaignRules.assistRecord.startAetherAdd : 0,
      relicAdditiveAmount(relics, RELIC_STAT_START_AETHER)
    );
    const config = managementConfigV2(
      content,
      missionRuntime,
      stateHeaderV2(state),
      start.startAether,
      relics
    );
    const liveEnemyRuntimeIds = Object.freeze(state.enemies.filter(function (enemy) {
      return enemy.hpMilli > 0;
    }).map(function (enemy) { return enemy.id; }).sort(function (left, right) {
      return left - right;
    }));
    const board = missionRuntime.map.map.board;
    const boardBounds = Object.freeze({
      minX: 0,
      minY: 0,
      maxX: ABI.checkedMultiply(board.widthWorldUnits, ABI.DISTANCE_SCALE),
      maxY: ABI.checkedMultiply(board.heightWorldUnits, ABI.DISTANCE_SCALE),
    });
    const routes = Object.freeze(state.routes.map(function (route) {
      return Object.freeze({ routeId: route.id, routeLength: route.length });
    }).sort(function (left, right) {
      return left.routeId < right.routeId ? -1 : left.routeId > right.routeId ? 1 : 0;
    }));

    /* PHASE 1 --------------------------------------- commands-and-aether-payments */
    phaseTrace.push(V2_PHASE_IDS[0]);
    const managementResult = Management.applyCommandBucketV2(
      state.management,
      config,
      state.tick,
      commands,
      {
        boardBounds: boardBounds,
        mechanism: state.mechanism,
        protocolCatalog: record.protocolCatalog,
        protocolLoadout: {
          slotCap: state.protocolSlotCap,
          protocolAuthority: state.protocolAuthority,
          protocols: state.protocolLoadout,
          missionLoan: state.missionProtocolLoan,
        },
        protocols: state.protocols,
        reinforcement: state.reinforcement,
        routes: routes,
        /* K1 proves only global (`none`) selections. Route, tower, and cone selections are the
           next lane's work, so they resolve to no proof and the Protocol resolver denies them
           with its own `missing-eligible-target` rather than paying for an unproven target. */
        selectProtocolTargets: function (command) {
          if (command.target.kind !== "none") return null;
          return {
            protocolId: command.protocolId,
            target: command.target,
            eligibleTargetIds: liveEnemyRuntimeIds.slice(),
          };
        },
        supportedEffectKinds: SUPPORTED_PROTOCOL_EFFECT_KINDS,
      }
    );
    emitManagementAetherTelemetry(telemetry, state.management, managementResult, missionRuntime);
    let management = managementResult.state;
    let protocols = managementResult.protocols;
    let towerRuntimes = syncTowerRuntimes(
      content,
      missionRuntime,
      state.timers,
      management.towers,
      state.tick
    );
    const acceptedWaveStarts = managementResult.events.filter(function (event) {
      return event.type === "waveStart";
    });
    if (acceptedWaveStarts.length > 1) {
      throw new RangeError("A command bucket cannot accept more than one wave start");
    }
    const acceptedWaveStart = acceptedWaveStarts.length === 1 ? acceptedWaveStarts[0] : null;

    if (state.management.phase === "planning" && acceptedWaveStart === null) {
      if (state.enemies.length !== 0 || state.pendingSpawns.length !== 0 ||
          state.pendingBossReleases.length !== 0) {
        throw new RangeError("Planning state cannot retain hostile wave blockers");
      }
      const planningState = cloneStateWith(state, {
        management: management,
        protocols: protocols,
        timers: towerRuntimes,
      });
      return Object.freeze({
        commandEvents: managementResult.events,
        events: Object.freeze([]),
        phaseTrace: Object.freeze(phaseTrace.slice()),
        state: registerState(binding, planningState),
        telemetry: telemetry.finish(),
      });
    }

    const events = [];
    let pendingSpawns = state.pendingSpawns;
    let pendingBossReleases = state.pendingBossReleases;
    let enemies = state.enemies;
    let effects = state.effects;
    let lineages = state.lineages;
    let objectiveFacts = state.objectiveFacts;
    let objectiveResults = state.objectiveResults;
    let integrity = state.integrity;
    let scoreFacts = state.scoreFacts;
    let score = state.score;
    let outcome = state.outcome;
    let waveStartTick = state.waveStartTick;
    let protocolFields = protocols.effects.slice();

    if (acceptedWaveStart !== null) {
      if (state.pendingSpawns.length !== 0 || state.pendingBossReleases.length !== 0 ||
          state.enemies.length !== 0) {
        throw new RangeError("Accepted wave start requires an exhausted prior wave");
      }
      const wave = missionRuntime.mission.waves[acceptedWaveStart.wave - 1];
      if (!wave || wave.index !== acceptedWaveStart.wave) {
        throw new RangeError("Accepted Management wave does not match compiled content");
      }
      pendingSpawns = scheduleWaveSpawns(wave, state.tick);
      towerRuntimes = resetWaveBehaviorStates(content, towerRuntimes);
      waveStartTick = state.tick;
      if (wave.deploymentGrantEventId !== null) {
        events.push(semanticEvent(content, wave.deploymentGrantEventId, {
          amountAether: acceptedWaveStart.grantAether,
          waveId: wave.id,
        }));
      }
    }

    /* PHASE 2 ------------------------------- expiry-and-enable-transitions */
    phaseTrace.push(V2_PHASE_IDS[1]);
    const enableTransition = Management.expireDisableSources(management, config, state.tick);
    management = enableTransition.state;
    const expired = runStatusExpiry(
      content,
      missionRuntime,
      enemies,
      effects,
      towerRuntimes,
      management.towers,
      mergeTelemetryTowers(state.management.towers, management.towers),
      state.tick,
      events,
      telemetry
    );
    enemies = expired.enemies;
    effects = runRetiredRevealCleanup(
      content,
      state.timers,
      state.management.towers,
      management.towers,
      enemies,
      expired.effects,
      events,
      telemetry
    );
    towerRuntimes = expired.towerRuntimes;

    /* PHASE 3 ------- scheduled-protocol-mechanism-resolutions-and-spawns */
    phaseTrace.push(V2_PHASE_IDS[2]);
    managementResult.protocolActivations.forEach(function (activation) {
      const tierRecord = protocolTierRecord(
        record.protocolCatalog,
        activation.protocolId,
        activation.tier
      );
      const effect = tierRecord.effect;
      if (SUPPORTED_PROTOCOL_EFFECT_KINDS.indexOf(effect.kind) === -1) {
        throw new RangeError("Kernel cannot resolve Protocol effect kind " + effect.kind);
      }
      const durationUnits = Timers.authoredMillisecondsToTimeUnits(effect.durationMs);
      const durationTicks = ABI.ceilDivNonnegative(durationUnits, ABI.TIME_UNITS_PER_TICK);
      if (durationTicks <= 0) throw new RangeError("A Protocol field must last at least one tick");
      const allocation = allocateRuntimeId(management, config, "effect");
      management = allocation.management;
      const field = Object.freeze({
        appliedTick: state.tick,
        carryAcrossWave: effect.carryAcrossWave === true,
        effectRuntimeId: allocation.runtimeId,
        expiryTick: ABI.checkedAdd(state.tick, durationTicks),
        kind: effect.kind,
        magnitudeBp: effect.magnitudeBp,
        protocolId: activation.protocolId,
        sourceKind: "protocol",
        tier: activation.tier,
      });
      if (ABI.checkedAdd(protocolFields.length, 1) > MAX_PROTOCOL_EFFECTS) {
        throw new RangeError("Protocol effects exceed the kernel ceiling");
      }
      protocolFields.push(field);
      const applied = applyGlobalSlowField(
        field, enemies, effects, management, config, state.tick, telemetry
      );
      effects = applied.effects;
      management = applied.management;
      events.push(semanticEventWithFacts(content, tierRecord.eventIds[0], {
        affectedEnemyCount: applied.appliedCount,
        costAether: activation.costAether,
        durationTimeUnits: durationUnits,
        magnitudeBp: field.magnitudeBp,
        protocolId: field.protocolId,
        tier: field.tier,
      }));
    });

    /* PHASE 4 ------------------------- spawn-movement-control-and-contact */
    phaseTrace.push(V2_PHASE_IDS[3]);
    const dueHostileCount = pendingSpawns.filter(function (job) {
      return job.dueTick === state.tick;
    }).length;
    if (ABI.checkedAdd(
      ABI.checkedAdd(enemies.length, dueHostileCount),
      activeSummonCount(towerRuntimes)
    ) > MAX_ACTIVE_ENTITIES) {
      throw new RangeError("Active hostile and summon entities exceed the kernel ceiling");
    }
    const priorEnemyIds = new Set(enemies.map(function (enemy) { return enemy.id; }));
    const spawned = spawnDueJobs(
      content, missionRuntime, difficulty, state.assist, pendingSpawns, enemies.slice(),
      lineages.slice(), management, config, state.tick, events, telemetry
    );
    pendingSpawns = spawned.pendingSpawns;
    enemies = spawned.enemies;
    lineages = spawned.lineages;
    management = spawned.management;
    /* Spec 6.1: a hostile that spawns while the field is live inherits the field's remaining
       duration, never a fresh full duration. */
    const freshEnemies = enemies.filter(function (enemy) { return !priorEnemyIds.has(enemy.id); });
    if (freshEnemies.length > 0) {
      activeProtocolField(protocolFields, state.tick).forEach(function (field) {
        const applied = applyGlobalSlowField(
          field, freshEnemies, effects, management, config, state.tick, telemetry
        );
        effects = applied.effects;
        management = applied.management;
      });
    }
    const guards = runGuardScheduledSpawns(
      content, towerRuntimes, management.towers, management, config, state.tick,
      enemies.length, events, telemetry
    );
    towerRuntimes = guards.towerRuntimes;
    management = guards.management;
    const moved = runMovementAndGuards(
      content, missionRuntime, enemies, effects, towerRuntimes, management, config,
      state.tick, events, telemetry
    );
    enemies = moved.enemies;
    effects = moved.effects;
    towerRuntimes = moved.towerRuntimes;
    management = moved.management;

    /* PHASE 5 ------- tower-and-reinforcement-acquisition-and-attacks */
    phaseTrace.push(V2_PHASE_IDS[4]);
    const revealPlan = planRevealSync(
      content, missionRuntime, enemies, effects, towerRuntimes, management.towers, events, telemetry
    );
    towerRuntimes = revealPlan.towerRuntimes;
    const attacks = runTowerAttacks(
      content, missionRuntime, enemies, effects, towerRuntimes, management.towers, events, telemetry
    );
    towerRuntimes = attacks.towerRuntimes;
    const hitIntents = moved.guardDamageIntents.concat(attacks.hitIntents);
    hitIntents.sort(compareHitIntents);

    /* PHASE 6 ---------- persistent-zone-pulses-and-terminal-damage */
    phaseTrace.push(V2_PHASE_IDS[5]);
    const talosRelease = runTalosReleases(
      content, missionRuntime, pendingBossReleases, pendingSpawns, effects, enemies, management,
      config, state.tick, events, telemetry
    );
    pendingBossReleases = talosRelease.pendingBossReleases;
    pendingSpawns = talosRelease.pendingSpawns;
    effects = talosRelease.effects;
    management = talosRelease.management;
    if (pendingSpawns.some(function (job) { return job.dueTick <= state.tick; })) {
      throw new RangeError("Talos child release must schedule strictly after its release tick");
    }
    const damaged = runDamage(
      content, enemies, effects, hitIntents, pendingBossReleases, management.towers, state.tick,
      events, telemetry
    );
    enemies = damaged.enemies;
    pendingBossReleases = damaged.pendingBossReleases;
    const statuses = applyTowerStatusIntents(
      content, management.towers, enemies, effects,
      revealPlan.statusIntents.concat(attacks.statusIntents), management, config, state.tick,
      telemetry
    );
    effects = statuses.effects;
    management = statuses.management;
    const deaths = runTerminalDeaths(
      content, management.towers, enemies, effects, scoreFacts, telemetry
    );
    enemies = deaths.enemies;
    effects = deaths.effects;
    scoreFacts = deaths.scoreFacts;
    towerRuntimes = purgeRevealTargets(
      towerRuntimes,
      deaths.deaths.map(function (enemy) { return enemy.id; })
    );

    /* PHASE 7 ----------------------------------- leak-arbitration-and-ward */
    phaseTrace.push(V2_PHASE_IDS[6]);
    const leaked = runLeaks(
      content, management.towers, enemies, effects, integrity, objectiveFacts, telemetry
    );
    enemies = leaked.enemies;
    effects = leaked.effects;
    integrity = leaked.integrity;
    objectiveFacts = leaked.objectiveFacts;
    towerRuntimes = purgeRevealTargets(towerRuntimes, leaked.removedEnemyIds);

    function finalize(nextOutcome) {
      /* ADR-008: a terminal tick still enters every remaining declared phase as a
         deterministic no-op and commits one complete tick boundary. */
      while (phaseTrace.length < V2_PHASE_IDS.length) {
        phaseTrace.push(V2_PHASE_IDS[phaseTrace.length]);
      }
      const terminal = terminalObjectiveAndScore(
        content, missionRuntime, difficulty, state, nextOutcome, integrity, objectiveFacts,
        management, scoreFacts
      );
      const terminalState = cloneStateWith(state, {
        effects: effects,
        enemies: enemies,
        integrity: integrity,
        lineages: lineages,
        management: management,
        objectiveFacts: terminal.objectiveFacts,
        objectiveResults: terminal.objectiveResults,
        outcome: nextOutcome,
        pendingBossReleases: pendingBossReleases,
        pendingSpawns: pendingSpawns,
        protocols: Object.freeze(Object.assign({}, protocols, {
          effects: Object.freeze(protocolFields.slice()),
        })),
        score: terminal.score,
        scoreFacts: scoreFacts,
        tick: ABI.checkedAdd(state.tick, 1),
        timers: towerRuntimes,
        waveStartTick: waveStartTick,
      });
      return Object.freeze({
        commandEvents: managementResult.events,
        events: orderedSemanticEvents(content, events),
        phaseTrace: Object.freeze(phaseTrace.slice()),
        state: registerState(binding, terminalState),
        telemetry: telemetry.finish(),
      });
    }

    if (leaked.defeat) return finalize("defeat");

    /* PHASE 8 ---------- bounty-income-objectives-and-score-facts */
    phaseTrace.push(V2_PHASE_IDS[7]);
    const bounties = runBounties(
      deaths.deaths, lineages, management, config, difficulty, telemetry, relicBountyBp(relics)
    );
    lineages = bounties.lineages;
    management = bounties.management;

    /* PHASE 9 ------------------------------- cooldown-and-effect-decrement */
    phaseTrace.push(V2_PHASE_IDS[8]);
    const survivingFields = [];
    protocolFields.forEach(function (field) {
      if (field.expiryTick > state.tick) {
        survivingFields.push(field);
        return;
      }
      const tierRecord = protocolTierRecord(record.protocolCatalog, field.protocolId, field.tier);
      events.push(semanticEventWithFacts(content, tierRecord.eventIds[1], {
        protocolId: field.protocolId,
        tier: field.tier,
      }));
    });
    protocolFields = survivingFields;

    /* PHASE 10 --- guarded-boss-wave-mission-transition-and-event-finalization */
    phaseTrace.push(V2_PHASE_IDS[9]);
    if (management.phase === "wave") {
      const activeWave = missionRuntime.mission.waves[management.activeWave - 1];
      if (!activeWave) throw new RangeError("Management active wave has no compiled wave record");
      const waveBlocked = enemies.some(function (enemy) { return enemy.waveId === activeWave.id; }) ||
        pendingSpawns.some(function (job) { return job.waveId === activeWave.id; }) ||
        pendingBossReleases.some(function (releasePlan) {
          return releasePlan.waveId === activeWave.id;
        });
      if (!waveBlocked) {
        const managementBeforeClearGrant = management;
        management = creditGrant(management, config, activeWave.clearGrantAether);
        emitInternalAetherTelemetry(
          telemetry, "wave-clear-grant", activeWave.id, managementBeforeClearGrant, management
        );
        if (activeWave.clearGrantEventId !== null) {
          events.push(semanticEvent(content, activeWave.clearGrantEventId, {
            amountAether: activeWave.clearGrantAether,
            waveId: activeWave.id,
          }));
        }
        scoreFacts = Object.freeze({
          killScore: scoreFacts.killScore,
          waveScore: ABI.checkedAdd(scoreFacts.waveScore, activeWave.waveClearScore),
        });
        management = Management.completeActiveWave(management, config, state.tick).state;
        waveStartTick = null;
        /* Spec 5.1: temporary effects end at wave clear unless the record carries across. */
        const carried = [];
        protocolFields.forEach(function (field) {
          if (field.carryAcrossWave) {
            carried.push(field);
            return;
          }
          const tierRecord = protocolTierRecord(
            record.protocolCatalog, field.protocolId, field.tier
          );
          events.push(semanticEventWithFacts(content, tierRecord.eventIds[1], {
            protocolId: field.protocolId,
            tier: field.tier,
          }));
        });
        protocolFields = carried;
        if (management.phase === "complete") return finalize("victory");
      }
    }

    const objectiveBinding = missionRuntime.objectiveBindings[state.difficultyId];
    objectiveResults = Objectives.evaluateObjectives(
      objectiveBinding,
      objectiveProjection(objectiveBinding, objectiveFacts)
    ).objectiveResults;
    const nextState = cloneStateWith(state, {
      effects: effects,
      enemies: enemies,
      integrity: integrity,
      lineages: lineages,
      management: management,
      objectiveFacts: objectiveFacts,
      objectiveResults: objectiveResults,
      outcome: outcome,
      pendingBossReleases: pendingBossReleases,
      pendingSpawns: pendingSpawns,
      protocols: Object.freeze(Object.assign({}, protocols, {
        effects: Object.freeze(protocolFields.slice()),
      })),
      score: score,
      scoreFacts: scoreFacts,
      tick: ABI.checkedAdd(state.tick, 1),
      timers: towerRuntimes,
      waveStartTick: waveStartTick,
    });
    return Object.freeze({
      commandEvents: managementResult.events,
      events: orderedSemanticEvents(content, events),
      phaseTrace: Object.freeze(phaseTrace.slice()),
      state: registerState(binding, nextState),
      telemetry: telemetry.finish(),
    });
  }

  function advanceTick(binding, stateInput, commandBucket) {
    const record = requireBinding(binding);
    const state = requireState(binding, stateInput);
    if (state.outcome !== "active") throw new RangeError("Terminal kernel state cannot advance");
    if (!Array.isArray(commandBucket)) throw new TypeError("Kernel command bucket must be an array");
    if (record.abiVersion === 2) return advanceTickV2(binding, record, state, commandBucket);
    const telemetry = createTelemetryCollector(state.tick);
    ABI.canonicalEncode(commandBucket);
    const commands = Commands.normalizeCommandSequence(commandBucket);
    commands.forEach(function (command) {
      if (command.tick !== state.tick) {
        throw new RangeError("Every command in a kernel bucket must match the current tick");
      }
    });
    const missionRuntime = record.missions[state.missionId];
    const difficulty = difficultyById(record.content.campaignRules, state.difficultyId);
    const start = Economy.resolveStartAether(
      missionRuntime.mission.baseStartAether,
      difficulty.startAetherBp,
      modifierAether(record.content.campaignRules, state.campaignModifierIds),
      state.assist ? record.content.campaignRules.assistRecord.startAetherAdd : 0
    );
    const config = managementConfig(record.content, missionRuntime, stateHeader(state), start.startAether);
    const managementResult = Management.applyCommandBucket(
      state.management,
      config,
      state.tick,
      commands
    );
    emitManagementAetherTelemetry(telemetry, state.management, managementResult, missionRuntime);
    let management = managementResult.state;
    let towerRuntimes = syncTowerRuntimes(
      record.content,
      missionRuntime,
      state.timers,
      management.towers,
      state.tick
    );
    const acceptedWaveStarts = managementResult.events.filter(function (event) {
      return event.type === "waveStart";
    });
    if (acceptedWaveStarts.length > 1) {
      throw new RangeError("A command bucket cannot accept more than one wave start");
    }
    const acceptedWaveStart = acceptedWaveStarts.length === 1 ? acceptedWaveStarts[0] : null;

    /* ADR-008: planning is a suspended clock. Management changes are authoritative,
       but combat phases and tick advancement begin only with an accepted Start. */
    if (state.management.phase === "planning" && acceptedWaveStart === null) {
      if (state.enemies.length !== 0 || state.pendingSpawns.length !== 0 ||
          state.pendingBossReleases.length !== 0) {
        throw new RangeError("Planning state cannot retain hostile wave blockers");
      }
      const planningState = cloneStateWith(state, {
        management: management,
        timers: towerRuntimes,
      });
      return Object.freeze({
        events: Object.freeze([]),
        state: registerState(binding, planningState),
        telemetry: telemetry.finish(),
      });
    }

    const events = [];
    let pendingSpawns = state.pendingSpawns;
    let pendingBossReleases = state.pendingBossReleases;
    let enemies = state.enemies;
    let effects = state.effects;
    let lineages = state.lineages;
    let objectiveFacts = state.objectiveFacts;
    let objectiveResults = state.objectiveResults;
    let integrity = state.integrity;
    let scoreFacts = state.scoreFacts;
    let score = state.score;
    let outcome = state.outcome;
    let waveStartTick = state.waveStartTick;

    if (acceptedWaveStart !== null) {
      if (state.pendingSpawns.length !== 0 || state.pendingBossReleases.length !== 0 ||
          state.enemies.length !== 0) {
        throw new RangeError("Accepted wave start requires an exhausted prior wave");
      }
      const wave = missionRuntime.mission.waves[acceptedWaveStart.wave - 1];
      if (!wave || wave.index !== acceptedWaveStart.wave) {
        throw new RangeError("Accepted Management wave does not match compiled content");
      }
      pendingSpawns = scheduleWaveSpawns(wave, state.tick);
      towerRuntimes = resetWaveBehaviorStates(record.content, towerRuntimes);
      waveStartTick = state.tick;
      if (wave.deploymentGrantEventId !== null) {
        events.push(semanticEvent(record.content, wave.deploymentGrantEventId, {
          amountAether: acceptedWaveStart.grantAether,
          waveId: wave.id,
        }));
      }
    }

    /* scheduled-spawns */
    const dueHostileCount = pendingSpawns.filter(function (job) {
      return job.dueTick === state.tick;
    }).length;
    if (ABI.checkedAdd(
      ABI.checkedAdd(enemies.length, dueHostileCount),
      activeSummonCount(towerRuntimes)
    ) > MAX_ACTIVE_ENTITIES) {
      throw new RangeError("Active hostile and summon entities exceed the kernel ceiling");
    }
    const spawned = spawnDueJobs(
      record.content,
      missionRuntime,
      difficulty,
      state.assist,
      pendingSpawns,
      enemies.slice(),
      lineages.slice(),
      management,
      config,
      state.tick,
      events,
      telemetry
    );
    pendingSpawns = spawned.pendingSpawns;
    enemies = spawned.enemies;
    lineages = spawned.lineages;
    management = spawned.management;
    const guards = runGuardScheduledSpawns(
      record.content,
      towerRuntimes,
      management.towers,
      management,
      config,
      state.tick,
      enemies.length,
      events,
      telemetry
    );
    towerRuntimes = guards.towerRuntimes;
    management = guards.management;

    /* status-expiry */
    const expired = runStatusExpiry(
      record.content,
      missionRuntime,
      enemies,
      effects,
      towerRuntimes,
      management.towers,
      mergeTelemetryTowers(state.management.towers, management.towers),
      state.tick,
      events,
      telemetry
    );
    enemies = expired.enemies;
    effects = runRetiredRevealCleanup(
      record.content,
      state.timers,
      state.management.towers,
      management.towers,
      enemies,
      expired.effects,
      events,
      telemetry
    );
    towerRuntimes = expired.towerRuntimes;

    /* movement, including aggregate Guard arbitration */
    const moved = runMovementAndGuards(
      record.content,
      missionRuntime,
      enemies,
      effects,
      towerRuntimes,
      management,
      config,
      state.tick,
      events,
      telemetry
    );
    enemies = moved.enemies;
    effects = moved.effects;
    towerRuntimes = moved.towerRuntimes;
    management = moved.management;

    /* leaks are an immediate terminal boundary. */
    const leaked = runLeaks(
      record.content,
      management.towers,
      enemies,
      effects,
      integrity,
      objectiveFacts,
      telemetry
    );
    enemies = leaked.enemies;
    effects = leaked.effects;
    integrity = leaked.integrity;
    objectiveFacts = leaked.objectiveFacts;
    towerRuntimes = purgeRevealTargets(towerRuntimes, leaked.removedEnemyIds);
    if (leaked.defeat) {
      outcome = "defeat";
      const terminal = terminalObjectiveAndScore(
        record.content,
        missionRuntime,
        difficulty,
        state,
        outcome,
        integrity,
        objectiveFacts,
        management,
        scoreFacts
      );
      objectiveFacts = terminal.objectiveFacts;
      objectiveResults = terminal.objectiveResults;
      score = terminal.score;
      const defeatState = cloneStateWith(state, {
        effects: effects,
        enemies: enemies,
        integrity: integrity,
        lineages: lineages,
        management: management,
        objectiveFacts: objectiveFacts,
        objectiveResults: objectiveResults,
        outcome: outcome,
        pendingBossReleases: pendingBossReleases,
        pendingSpawns: pendingSpawns,
        score: score,
        scoreFacts: scoreFacts,
        tick: ABI.checkedAdd(state.tick, 1),
        timers: towerRuntimes,
        waveStartTick: waveStartTick,
      });
      return Object.freeze({
        events: orderedSemanticEvents(record.content, events),
        state: registerState(binding, defeatState),
        telemetry: telemetry.finish(),
      });
    }

    /* Continuous Reveal snapshots after movement but is not applied soon enough
       to alter this tick's already-frozen direct-acquisition eligibility. */
    const revealPlan = planRevealSync(
      record.content,
      missionRuntime,
      enemies,
      effects,
      towerRuntimes,
      management.towers,
      events,
      telemetry
    );
    towerRuntimes = revealPlan.towerRuntimes;

    /* tower-acquisition-and-attacks */
    const attacks = runTowerAttacks(
      record.content,
      missionRuntime,
      enemies,
      effects,
      towerRuntimes,
      management.towers,
      events,
      telemetry
    );
    towerRuntimes = attacks.towerRuntimes;
    const hitIntents = moved.guardDamageIntents.concat(attacks.hitIntents);
    hitIntents.sort(compareHitIntents);

    /* A matured Talos warning releases after this tick's expiry boundary, so its
       exposure/status timers begin now and can affect this phase's ordered hits. */
    const talosRelease = runTalosReleases(
      record.content,
      missionRuntime,
      pendingBossReleases,
      pendingSpawns,
      effects,
      enemies,
      management,
      config,
      state.tick,
      events,
      telemetry
    );
    pendingBossReleases = talosRelease.pendingBossReleases;
    pendingSpawns = talosRelease.pendingSpawns;
    effects = talosRelease.effects;
    management = talosRelease.management;
    if (pendingSpawns.some(function (job) { return job.dueTick <= state.tick; })) {
      throw new RangeError("Talos child release must schedule strictly after its release tick");
    }

    /* shield-damage-and-status, followed by guarded boss threshold scheduling. */
    const damaged = runDamage(
      record.content,
      enemies,
      effects,
      hitIntents,
      pendingBossReleases,
      management.towers,
      state.tick,
      events,
      telemetry
    );
    enemies = damaged.enemies;
    pendingBossReleases = damaged.pendingBossReleases;
    const statuses = applyTowerStatusIntents(
      record.content,
      management.towers,
      enemies,
      effects,
      revealPlan.statusIntents.concat(attacks.statusIntents),
      management,
      config,
      state.tick,
      telemetry
    );
    effects = statuses.effects;
    management = statuses.management;

    /* terminal death, then bounty. */
    const deaths = runTerminalDeaths(
      record.content,
      management.towers,
      enemies,
      effects,
      scoreFacts,
      telemetry
    );
    enemies = deaths.enemies;
    effects = deaths.effects;
    scoreFacts = deaths.scoreFacts;
    towerRuntimes = purgeRevealTargets(
      towerRuntimes,
      deaths.deaths.map(function (enemy) { return enemy.id; })
    );
    const bounties = runBounties(
      deaths.deaths,
      lineages,
      management,
      config,
      difficulty,
      telemetry
    );
    lineages = bounties.lineages;
    management = bounties.management;

    /* wave-clear */
    if (management.phase === "wave") {
      const activeWave = missionRuntime.mission.waves[management.activeWave - 1];
      if (!activeWave) throw new RangeError("Management active wave has no compiled wave record");
      const waveBlocked = enemies.some(function (enemy) { return enemy.waveId === activeWave.id; }) ||
        pendingSpawns.some(function (job) { return job.waveId === activeWave.id; }) ||
        pendingBossReleases.some(function (releasePlan) {
          return releasePlan.waveId === activeWave.id;
      });
      if (!waveBlocked) {
        const managementBeforeClearGrant = management;
        management = creditGrant(management, config, activeWave.clearGrantAether);
        emitInternalAetherTelemetry(
          telemetry,
          "wave-clear-grant",
          activeWave.id,
          managementBeforeClearGrant,
          management
        );
        if (activeWave.clearGrantEventId !== null) {
          events.push(semanticEvent(record.content, activeWave.clearGrantEventId, {
            amountAether: activeWave.clearGrantAether,
            waveId: activeWave.id,
          }));
        }
        scoreFacts = Object.freeze({
          killScore: scoreFacts.killScore,
          waveScore: ABI.checkedAdd(scoreFacts.waveScore, activeWave.waveClearScore),
        });
        management = Management.completeActiveWave(management, config, state.tick).state;
        waveStartTick = null;
        if (management.phase === "complete") {
          outcome = "victory";
          const terminal = terminalObjectiveAndScore(
            record.content,
            missionRuntime,
            difficulty,
            state,
            outcome,
            integrity,
            objectiveFacts,
            management,
            scoreFacts
          );
          objectiveFacts = terminal.objectiveFacts;
          objectiveResults = terminal.objectiveResults;
          score = terminal.score;
        }
      }
    }

    if (outcome === "active") {
      const objectiveBinding = missionRuntime.objectiveBindings[state.difficultyId];
      const evaluation = Objectives.evaluateObjectives(
        objectiveBinding,
        objectiveProjection(objectiveBinding, objectiveFacts)
      );
      objectiveResults = evaluation.objectiveResults;
    }
    const nextState = cloneStateWith(state, {
      effects: effects,
      enemies: enemies,
      integrity: integrity,
      lineages: lineages,
      management: management,
      objectiveFacts: objectiveFacts,
      objectiveResults: objectiveResults,
      outcome: outcome,
      pendingBossReleases: pendingBossReleases,
      pendingSpawns: pendingSpawns,
      score: score,
      scoreFacts: scoreFacts,
      tick: ABI.checkedAdd(state.tick, 1),
      timers: towerRuntimes,
      waveStartTick: waveStartTick,
    });
    return Object.freeze({
      events: orderedSemanticEvents(record.content, events),
      state: registerState(binding, nextState),
      telemetry: telemetry.finish(),
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    BALANCE_TELEMETRY_SCHEMA_VERSION: BALANCE_TELEMETRY_SCHEMA_VERSION,
    BEHAVIOR_REGISTRY_VERSION: ABI.BEHAVIOR_REGISTRY_VERSION,
    COMMAND_SCHEMA_VERSION: Commands.COMMAND_SCHEMA_VERSION,
    EVENT_SCHEMA_VERSION: ABI.EVENT_SCHEMA_VERSION,
    KERNEL_SCHEMA_VERSION: KERNEL_SCHEMA_VERSION,
    MAX_ACTIVE_ENTITIES: MAX_ACTIVE_ENTITIES,
    MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK: MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK,
    MAX_BALANCE_TELEMETRY_TARGET_IDS: MAX_BALANCE_TELEMETRY_TARGET_IDS,
    MAX_LOADOUT_IDS: MAX_LOADOUT_IDS,
    MAX_SEMANTIC_EVENTS_PER_TICK: MAX_SEMANTIC_EVENTS_PER_TICK,
    MAX_TARGET_CANDIDATES: MAX_TARGET_CANDIDATES,
    KERNEL_SCHEMA_VERSION_V2: KERNEL_SCHEMA_VERSION_V2,
    MAX_DISABLE_SOURCES: MAX_DISABLE_SOURCES,
    MAX_MECHANISM_ZONES: MAX_MECHANISM_ZONES,
    MAX_PROTOCOL_EFFECTS: MAX_PROTOCOL_EFFECTS,
    MAX_PROTOCOL_SCHEDULES: MAX_PROTOCOL_SCHEDULES,
    MAX_PROTOCOL_SLOTS: MAX_PROTOCOL_SLOTS,
    MAX_RELIC_IDS: MAX_RELIC_IDS,
    MAX_SPECIALIZATION_ACCESS_IDS: MAX_SPECIALIZATION_ACCESS_IDS,
    ABI_V2_DESCRIPTOR_SHA256: ABIV2.DESCRIPTOR_SHA256,
    COMBAT_SOURCE_KINDS: COMBAT_SOURCE_KINDS,
    SUPPORTED_PROTOCOL_EFFECT_KINDS: SUPPORTED_PROTOCOL_EFFECT_KINDS,
    V2_PHASE_IDS: V2_PHASE_IDS,
    addTowerDisableSource: Management.addDisableSource,
    removeTowerDisableSource: Management.removeDisableSource,
    createRulesetBinding: createRulesetBinding,
    createInitialState: createInitialState,
    advanceTick: advanceTick,
  });
});

  /* source replay-runner.js bytes=51714 sha256=6e7c2cc89adc5a4a98ff6f8267f97b454914ae914b3ac3165e2d3de5f90442bb */
/* Armara Aegis deterministic replay executor v1.
   Binds one immutable release/content pair to one immutable Kernel dependency. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before replay-runner.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before replay-runner.js");
  if (!game.AegisKernel) throw new Error("Game.AegisKernel must be installed before replay-runner.js");
  const api = factory(
    game.AegisSim,
    game.AegisCommands,
    game.AegisKernel
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisReplayRunner")) {
    if (game.AegisReplayRunner !== api) throw new Error("Game.AegisReplayRunner is already installed");
    return;
  }
  Object.defineProperty(game, "AegisReplayRunner", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (
  ABI,
  Commands,
  Kernel
) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  [
    "assertSafeInteger", "canonicalBytes", "canonicalEncode", "fnv1a32Hex",
    "refundSeventyPercent", "sha256Hex",
  ].forEach(
    function (name) {
      if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
    }
  );
  if (!Commands || !Object.isFrozen(Commands) || !Object.isFrozen(Commands.DEFAULT_LIMITS) ||
      typeof Commands.normalizeCommandSequence !== "function") {
    throw new TypeError("A frozen Aegis Commands API is required");
  }
  if (Commands.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new Error("Aegis Commands ABI descriptor identity does not match the simulation ABI");
  }
  if (Commands.COMMAND_SCHEMA_VERSION !== ABI.DESCRIPTOR.commands.schemaVersion) {
    throw new Error("Aegis Commands schema identity does not match the simulation ABI");
  }
  if (!Kernel || !Object.isFrozen(Kernel)) throw new TypeError("A frozen Aegis Kernel API is required");
  ["createRulesetBinding", "createInitialState", "advanceTick"].forEach(function (name) {
    if (typeof Kernel[name] !== "function") throw new TypeError("Aegis Kernel API is missing " + name);
  });
  if (Kernel.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new Error("Aegis Kernel ABI descriptor identity does not match the simulation ABI");
  }
  if (Kernel.EVENT_SCHEMA_VERSION !== ABI.EVENT_SCHEMA_VERSION) {
    throw new Error("Aegis Kernel event schema identity does not match the simulation ABI");
  }
  if (Kernel.COMMAND_SCHEMA_VERSION !== ABI.DESCRIPTOR.commands.schemaVersion) {
    throw new Error("Aegis Kernel command schema identity does not match the simulation ABI");
  }
  if (!Number.isSafeInteger(Kernel.MAX_LOADOUT_IDS) || Kernel.MAX_LOADOUT_IDS < 1) {
    throw new Error("Aegis Kernel loadout limit identity is invalid");
  }

  const RUNNER_SCHEMA_VERSION = 1;
  const BALANCE_TELEMETRY_SCHEMA_VERSION = 1;
  const MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK = 65536;
  const MAX_BALANCE_TELEMETRY_TARGET_IDS = 4096;
  if (Kernel.BALANCE_TELEMETRY_SCHEMA_VERSION !== BALANCE_TELEMETRY_SCHEMA_VERSION) {
    throw new Error("Aegis Kernel balance telemetry schema identity does not match replay v1");
  }
  if (Kernel.MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK !==
      MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK) {
    throw new Error("Aegis Kernel balance telemetry record limit does not match replay v1");
  }
  if (Kernel.MAX_BALANCE_TELEMETRY_TARGET_IDS !== MAX_BALANCE_TELEMETRY_TARGET_IDS) {
    throw new Error("Aegis Kernel balance telemetry target limit does not match replay v1");
  }
  const RULESET_HASH = /^sha256:[0-9a-f]{64}$/;
  const DIAGNOSTIC_HASH = /^fnv1a32:[0-9a-f]{8}$/;
  const FINAL_STATE_HASH = /^[0-9a-f]{64}$/;
  const STABLE_ID = /^[a-z][a-z0-9._:-]*$/;
  const BOUND_INPUT_FIELDS = Object.freeze(["content", "normalizeReplayEnvelope", "release"]);
  const ENVELOPE_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode", "inputs", "checkpoints", "finalClaim",
  ]);
  const CHECKPOINT_FIELDS = Object.freeze(["tick", "diagnosticHash"]);
  const FINAL_CLAIM_FIELDS = Object.freeze([
    "outcome", "score", "laurels", "durationTicks", "finalStateHash",
  ]);
  const HEADER_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode",
  ]);
  const TELEMETRY_FIELDS = Object.freeze(["schemaVersion", "tick", "records"]);
  const TELEMETRY_RECORD_FIELDS = Object.freeze({
    "activation": Object.freeze([
      "kind", "ordinal", "actionId", "behaviorId", "sourceTowerRuntimeId",
      "sourceRuntimeId", "defenseId", "level", "padId", "outcome",
      "eligibleTargetRuntimeIds", "selectedTargetRuntimeIds",
    ]),
    "aether-transaction": Object.freeze([
      "kind", "ordinal", "action", "sourceId", "commandSeq", "towerRuntimeId",
      "padId", "defenseId", "levelBefore", "levelAfter", "debitAether",
      "creditAether", "investedBeforeAether", "investedAfterAether",
      "bankBeforeAether", "bankAfterAether", "bountyRemainderBefore",
      "bountyRemainderAfter",
    ]),
    "damage": Object.freeze([
      "kind", "ordinal", "sourceTowerRuntimeId", "sourceRuntimeId", "defenseId",
      "level", "padId", "targetRuntimeId", "targetOwnerId", "targetLineageId",
      "targetRouteId", "damageTypeId", "baseDamageMilli", "preShieldDamageMilli",
      "attemptedShieldDamageMilli", "appliedShieldDamageMilli",
      "eligibleHpDamageMilli", "appliedHpDamageMilli", "deferredHpDamageMilli",
      "overkillHpDamageMilli", "noExternalAppliedShieldDamageMilli",
      "noExternalAppliedHpDamageMilli", "targetShieldBeforeMilli",
      "targetShieldAfterMilli", "targetHpBeforeMilli", "targetHpAfterMilli",
      "supportSourceTowerRuntimeIds", "revealSourceTowerRuntimeIds",
    ]),
    "effect": Object.freeze([
      "kind", "ordinal", "action", "sourceTowerRuntimeId", "sourceRuntimeId",
      "defenseId", "level", "padId", "targetRuntimeId", "targetOwnerId",
      "targetRouteId", "effectKind", "statusId", "requestedMagnitude",
      "appliedMagnitude", "requestedDurationTimeUnits", "appliedDurationTimeUnits",
      "outcome",
    ]),
    "leak": Object.freeze([
      "kind", "ordinal", "enemyRuntimeId", "ownerId", "lineageId", "routeId",
      "hpMilli", "shieldMilli", "integrityDamage",
    ]),
    "movement-control": Object.freeze([
      "kind", "ordinal", "enemyRuntimeId", "ownerId", "lineageId", "routeId",
      "priorRouteDistance", "nextRouteDistance", "actualAdvanceDistance",
      "effectiveSpeedBp", "scaledReductionBp", "sourceEffectRuntimeIds",
      "sourceRuntimeIds", "sourceTowerRuntimeIds",
    ]),
    "spawn": Object.freeze([
      "kind", "ordinal", "entityKind", "enemyRuntimeId", "ownerId", "lineageId",
      "routeId", "waveId", "maximumHpMilli", "initialShieldMilli",
      "baseSpeedDistanceUnitsPerSecond",
    ]),
  });
  const TELEMETRY_ENUMS = Object.freeze({
    activationActionId: Object.freeze([
      "direct-hit", "splash-blast", "mark-scan", "guard-contact", "guard-create",
    ]),
    activationOutcome: Object.freeze(["accepted", "no-target", "rejected"]),
    aetherAction: Object.freeze([
      "build", "upgrade", "sell", "wave-start-grant", "wave-clear-grant", "bounty",
    ]),
    effectAction: Object.freeze(["apply", "refresh", "remove", "expire"]),
    effectKind: Object.freeze([
      "status", "delayed-status", "external-amplification", "boss-exposure",
      "resistance-override",
    ]),
    effectOutcome: Object.freeze(["applied", "refreshed", "removed", "expired", "rejected"]),
    entityKind: Object.freeze(["enemy", "boss"]),
  });
  const EXECUTION_LIMITS = Object.freeze({
    maxAccessGrantIds: 64,
    maxCampaignModifierIds: 64,
    maxCheckpoints: 4096,
    maxCommandsPerTick: Commands.DEFAULT_LIMITS.maxCommandsPerTick,
    maxDurationTicks: Commands.DEFAULT_LIMITS.maxTick,
    maxLoadoutIds: Kernel.MAX_LOADOUT_IDS,
    maxStringLength: 256,
    maxTotalCommands: 4096,
  });

  function exactFields(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const actual = Object.getOwnPropertyNames(value);
    actual.forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
    });
    actual.sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function dataValue(value, key, label) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(label + "." + key + " must be an enumerable data property");
    }
    return descriptor.value;
  }

  function nonnegativeInteger(value, label, maximum) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    if (maximum !== undefined && value > maximum) {
      throw new RangeError(label + " exceeds the execution limit");
    }
    return Object.is(value, -0) ? 0 : value;
  }

  function boundedString(value, label, pattern) {
    if (typeof value !== "string") throw new TypeError(label + " must be a string");
    if (value.length > EXECUTION_LIMITS.maxStringLength) {
      throw new RangeError(label + " exceeds the string length limit");
    }
    if (pattern && !pattern.test(value)) throw new TypeError(label + " has invalid syntax");
    return value;
  }

  function arrayDataValues(value, label, maximum) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    if (value.length > maximum) throw new RangeError(label + " exceeds the execution limit");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== value.length + 1 || names.indexOf("length") === -1) {
      throw new TypeError(label + " must be a dense array without extra properties");
    }
    const result = new Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only dense enumerable data elements");
      }
      result[index] = descriptor.value;
    }
    return result;
  }

  function idArray(value, label, maximum, options) {
    const values = arrayDataValues(value, label, maximum);
    if (options && options.nonempty && values.length === 0) {
      throw new RangeError(label + " must not be empty");
    }
    const seen = new Set();
    let previous = null;
    values.forEach(function (entry) {
      boundedString(entry, label + " entry", STABLE_ID);
      if (seen.has(entry)) throw new RangeError(label + " must contain unique IDs");
      if (options && options.sorted && previous !== null && entry <= previous) {
        throw new RangeError(label + " must use strict ASCII order");
      }
      seen.add(entry);
      previous = entry;
    });
    return values;
  }

  function requireDeepFrozenCanonical(value, label) {
    ABI.canonicalEncode(value);
    function visit(current) {
      if (current === null || typeof current !== "object") return;
      if (!Object.isFrozen(current)) throw new TypeError(label + " must be deeply frozen");
      if (Array.isArray(current)) {
        current.forEach(visit);
        return;
      }
      Object.keys(current).forEach(function (key) { visit(current[key]); });
    }
    visit(value);
    return value;
  }

  function requireOwn(value, key, label) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new TypeError(label + " is missing " + key);
    }
    return dataValue(value, key, label);
  }

  function requireArtifactPair(releaseInput, contentInput) {
    const release = requireDeepFrozenCanonical(releaseInput, "Aegis release record");
    const content = requireDeepFrozenCanonical(contentInput, "Aegis content artifact");
    if (!release || typeof release !== "object" || Array.isArray(release) ||
        !content || typeof content !== "object" || Array.isArray(content)) {
      throw new TypeError("Release and content must be immutable data objects");
    }
    const rulesetHash = requireOwn(release, "rulesetHash", "Aegis release record");
    if (typeof rulesetHash !== "string" || !RULESET_HASH.test(rulesetHash)) {
      throw new TypeError("Release ruleset hash must be lowercase sha256:<64-hex>");
    }
    const eventSchemaVersion = nonnegativeInteger(
      requireOwn(release, "eventSchemaVersion", "Aegis release record"),
      "Release event schema version"
    );
    if (eventSchemaVersion !== ABI.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Release event schema version is unsupported by this replay executor");
    }
    if (requireOwn(content, "eventSchemaVersion", "Aegis content artifact") !== eventSchemaVersion) {
      throw new RangeError("Release and content event schema versions do not match");
    }
    if (requireOwn(content, "contentVersion", "Aegis content artifact") !==
        requireOwn(release, "contentVersion", "Aegis release record")) {
      throw new RangeError("Release and content versions do not match");
    }
    if (requireOwn(content, "schemaVersion", "Aegis content artifact") !==
        requireOwn(release, "schemaVersion", "Aegis release record")) {
      throw new RangeError("Release and content schema versions do not match");
    }
    if (requireOwn(content, "abiHash", "Aegis content artifact") !==
        requireOwn(release, "abiHash", "Aegis release record")) {
      throw new RangeError("Release and content ABI hashes do not match");
    }
    const includedIds = requireOwn(release, "includedIds", "Aegis release record");
    if (!includedIds || typeof includedIds !== "object" ||
        !Array.isArray(includedIds.missions) || includedIds.missions.length === 0) {
      throw new TypeError("Release included mission IDs must be a nonempty array");
    }
    const missions = requireOwn(content, "missions", "Aegis content artifact");
    if (!missions || typeof missions !== "object" || Array.isArray(missions)) {
      throw new TypeError("Content missions must be an ID-keyed object");
    }
    return Object.freeze({ content: content, release: release });
  }

  function replayHeader(envelope) {
    const header = {};
    HEADER_FIELDS.forEach(function (key) { header[key] = envelope[key]; });
    return Object.freeze(header);
  }

  function validateExecutionEnvelope(envelope) {
    exactFields(envelope, ENVELOPE_FIELDS, "Normalized replay envelope");
    if (dataValue(envelope, "formatVersion", "Normalized replay envelope") !== 1) {
      throw new RangeError("Normalized replay format version must be 1");
    }
    boundedString(
      dataValue(envelope, "rulesetHash", "Normalized replay envelope"),
      "Normalized replay ruleset hash",
      RULESET_HASH
    );
    if (dataValue(envelope, "eventSchemaVersion", "Normalized replay envelope") !==
        ABI.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Normalized replay event schema version is unsupported");
    }
    boundedString(
      dataValue(envelope, "missionId", "Normalized replay envelope"),
      "Normalized replay mission ID",
      STABLE_ID
    );
    boundedString(
      dataValue(envelope, "difficultyId", "Normalized replay envelope"),
      "Normalized replay difficulty ID",
      STABLE_ID
    );
    if (typeof dataValue(envelope, "assist", "Normalized replay envelope") !== "boolean") {
      throw new TypeError("Normalized replay Assist flag must be Boolean");
    }
    nonnegativeInteger(
      dataValue(envelope, "seed", "Normalized replay envelope"),
      "Normalized replay seed",
      0xffffffff
    );

    const loadoutIds = idArray(
      dataValue(envelope, "loadoutIds", "Normalized replay envelope"),
      "Normalized replay loadout IDs",
      EXECUTION_LIMITS.maxLoadoutIds,
      { nonempty: true }
    );
    const loadoutSlotCap = nonnegativeInteger(
      dataValue(envelope, "loadoutSlotCap", "Normalized replay envelope"),
      "Normalized replay loadout slot cap",
      EXECUTION_LIMITS.maxLoadoutIds
    );
    if (loadoutSlotCap < 1) throw new RangeError("Normalized replay loadout slot cap must be at least one");
    if (loadoutIds.length > loadoutSlotCap) {
      throw new RangeError("Normalized replay loadout exceeds its slot cap");
    }
    idArray(
      dataValue(envelope, "campaignModifierIds", "Normalized replay envelope"),
      "Normalized replay campaign modifier IDs",
      EXECUTION_LIMITS.maxCampaignModifierIds,
      { sorted: true }
    );
    idArray(
      dataValue(envelope, "accessGrantIds", "Normalized replay envelope"),
      "Normalized replay access grant IDs",
      EXECUTION_LIMITS.maxAccessGrantIds
    );
    const tutorialMode = boundedString(
      dataValue(envelope, "tutorialUpgradeGateMode", "Normalized replay envelope"),
      "Normalized replay tutorial gate mode"
    );
    if (tutorialMode !== "none" && tutorialMode !== "m01-wave1") {
      throw new RangeError("Normalized replay tutorial gate mode is unsupported");
    }

    const claim = dataValue(envelope, "finalClaim", "Normalized replay envelope");
    exactFields(claim, FINAL_CLAIM_FIELDS, "Normalized replay final claim");
    const outcome = dataValue(claim, "outcome", "Normalized replay final claim");
    if (outcome !== "victory" && outcome !== "defeat") {
      throw new RangeError("Normalized replay final outcome must be victory or defeat");
    }
    nonnegativeInteger(
      dataValue(claim, "score", "Normalized replay final claim"),
      "Normalized replay final score"
    );
    nonnegativeInteger(
      dataValue(claim, "laurels", "Normalized replay final claim"),
      "Normalized replay final Laurels",
      3
    );
    const durationTicks = nonnegativeInteger(
      dataValue(claim, "durationTicks", "Normalized replay final claim"),
      "Normalized replay final duration",
      EXECUTION_LIMITS.maxDurationTicks
    );
    boundedString(
      dataValue(claim, "finalStateHash", "Normalized replay final claim"),
      "Normalized replay final state hash",
      FINAL_STATE_HASH
    );

    const inputSource = dataValue(envelope, "inputs", "Normalized replay envelope");
    arrayDataValues(inputSource, "Normalized replay inputs", EXECUTION_LIMITS.maxTotalCommands);
    const normalizedInputs = Commands.normalizeCommandSequence(inputSource, {
      maxCommandsPerTick: EXECUTION_LIMITS.maxCommandsPerTick,
      maxTick: EXECUTION_LIMITS.maxDurationTicks - 1,
      maxTotalCommands: EXECUTION_LIMITS.maxTotalCommands,
    });
    normalizedInputs.forEach(function (command, commandIndex) {
      Object.keys(command).forEach(function (key) {
        if (typeof command[key] === "string") {
          boundedString(command[key], "Normalized replay command " + commandIndex + "." + key);
        }
      });
    });
    if (normalizedInputs.length && normalizedInputs[normalizedInputs.length - 1].tick >= durationTicks) {
      throw new RangeError("Normalized replay input tick must be before the final boundary");
    }
    if (ABI.canonicalEncode(normalizedInputs) !== ABI.canonicalEncode(inputSource)) {
      throw new TypeError("Normalized replay inputs must equal the canonical Commands sequence");
    }

    const checkpoints = arrayDataValues(
      dataValue(envelope, "checkpoints", "Normalized replay envelope"),
      "Normalized replay checkpoints",
      EXECUTION_LIMITS.maxCheckpoints
    );
    let previousCheckpointTick = -1;
    checkpoints.forEach(function (checkpoint, checkpointIndex) {
      exactFields(checkpoint, CHECKPOINT_FIELDS, "Normalized replay checkpoint " + checkpointIndex);
      const checkpointTick = nonnegativeInteger(
        dataValue(checkpoint, "tick", "Normalized replay checkpoint " + checkpointIndex),
        "Normalized replay checkpoint tick",
        durationTicks
      );
      if (checkpointTick <= previousCheckpointTick) {
        throw new RangeError("Normalized replay checkpoints must use strictly increasing ticks");
      }
      boundedString(
        dataValue(checkpoint, "diagnosticHash", "Normalized replay checkpoint " + checkpointIndex),
        "Normalized replay checkpoint diagnostic hash",
        DIAGNOSTIC_HASH
      );
      previousCheckpointTick = checkpointTick;
    });
  }

  function validateNormalizedBinding(envelope, pair) {
    if (envelope.rulesetHash !== pair.release.rulesetHash) {
      throw new RangeError("Replay ruleset hash is unsupported by this bound simulator");
    }
    if (envelope.eventSchemaVersion !== pair.release.eventSchemaVersion) {
      throw new RangeError("Replay event schema version does not match the bound release");
    }
    if (pair.release.includedIds.missions.indexOf(envelope.missionId) === -1 ||
        !Object.prototype.hasOwnProperty.call(pair.content.missions, envelope.missionId)) {
      throw new RangeError("Replay mission is not included in the bound ruleset");
    }
    if (envelope.loadoutIds.length > envelope.loadoutSlotCap) {
      throw new RangeError("Replay loadout exceeds its bound slot cap");
    }
  }

  function requireKernelState(state, expectedTick, label) {
    requireDeepFrozenCanonical(state, label);
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new TypeError(label + " must be a frozen canonical object");
    }
    const tick = nonnegativeInteger(requireOwn(state, "tick", label), label + " tick");
    if (tick !== expectedTick) throw new RangeError(label + " tick does not match completed ticks");
    const outcome = requireOwn(state, "outcome", label);
    if (outcome !== "active" && outcome !== "victory" && outcome !== "defeat") {
      throw new RangeError(label + " outcome must be active, victory, or defeat");
    }
    nonnegativeInteger(requireOwn(state, "score", label), label + " score");
    const objectiveResults = requireOwn(state, "objectiveResults", label);
    if (!Array.isArray(objectiveResults) || !Object.isFrozen(objectiveResults)) {
      throw new TypeError(label + " objective results must be a frozen array");
    }
    objectiveResults.forEach(function (result, index) {
      if (!result || typeof result !== "object" || !Object.isFrozen(result) ||
          typeof result.complete !== "boolean") {
        throw new TypeError(label + " objective result " + index + " must expose a frozen complete flag");
      }
    });
    return state;
  }

  function telemetryInteger(value, label, options) {
    if (options && options.nullable && value === null) return null;
    ABI.assertSafeInteger(value, label);
    if (Object.is(value, -0)) throw new TypeError(label + " must use canonical positive zero");
    if (!options || options.nonnegative !== false) {
      if (value < 0) throw new RangeError(label + " must be nonnegative");
    }
    if (options && options.positive && value < 1) {
      throw new RangeError(label + " must be positive");
    }
    return value;
  }

  function telemetryId(value, label, nullable) {
    if (nullable && value === null) return null;
    return boundedString(value, label, STABLE_ID);
  }

  function telemetryRuntimeId(value, label, nullable) {
    return telemetryInteger(value, label, { nullable: nullable, positive: true });
  }

  function telemetryEnum(value, allowed, label) {
    if (typeof value !== "string" || allowed.indexOf(value) === -1) {
      throw new RangeError(label + " is not a closed balance telemetry v1 value");
    }
    return value;
  }

  function telemetryRuntimeIds(value, label, options) {
    const values = arrayDataValues(value, label, MAX_BALANCE_TELEMETRY_TARGET_IDS);
    let previous = 0;
    values.forEach(function (entry, index) {
      telemetryRuntimeId(entry, label + "[" + index + "]", false);
      if (entry <= previous) {
        throw new RangeError(label + " must contain ascending unique runtime IDs");
      }
      previous = entry;
    });
    if (!options || !options.deferFreezeCheck) requireDeepFrozenCanonical(value, label);
    return values;
  }

  function requireTelemetryRecordShape(record, ordinal) {
    if (!record || typeof record !== "object" || Array.isArray(record) || !Object.isFrozen(record)) {
      throw new TypeError("Kernel balance telemetry record " + ordinal + " must be a frozen object");
    }
    const kind = dataValue(record, "kind", "Kernel balance telemetry record " + ordinal);
    if (typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(TELEMETRY_RECORD_FIELDS, kind)) {
      throw new RangeError("Kernel balance telemetry record " + ordinal + " has an unknown kind");
    }
    const label = "Kernel balance telemetry " + kind + " record " + ordinal;
    exactFields(record, TELEMETRY_RECORD_FIELDS[kind], label);
    const actualOrdinal = telemetryInteger(dataValue(record, "ordinal", label), label + ".ordinal");
    if (actualOrdinal !== ordinal) {
      throw new RangeError(label + " ordinal must be contiguous and reducer-ordered");
    }
    return Object.freeze({ kind: kind, label: label });
  }

  function requireSpawnTelemetry(record, label) {
    telemetryEnum(dataValue(record, "entityKind", label), TELEMETRY_ENUMS.entityKind,
      label + ".entityKind");
    telemetryRuntimeId(dataValue(record, "enemyRuntimeId", label), label + ".enemyRuntimeId", false);
    ["ownerId", "lineageId", "routeId", "waveId"].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    telemetryInteger(dataValue(record, "maximumHpMilli", label), label + ".maximumHpMilli",
      { positive: true });
    telemetryInteger(dataValue(record, "initialShieldMilli", label), label + ".initialShieldMilli");
    telemetryInteger(dataValue(record, "baseSpeedDistanceUnitsPerSecond", label),
      label + ".baseSpeedDistanceUnitsPerSecond", { positive: true });
  }

  function requireAetherTelemetry(record, label) {
    const action = telemetryEnum(dataValue(record, "action", label), TELEMETRY_ENUMS.aetherAction,
      label + ".action");
    const towerAction = action === "build" || action === "upgrade" || action === "sell";
    const sourceId = telemetryId(dataValue(record, "sourceId", label), label + ".sourceId", false);
    if (towerAction && sourceId !== "command." + action) {
      throw new RangeError(label + ".sourceId does not match its tower command action");
    }
    const commandSeq = dataValue(record, "commandSeq", label);
    const requiresCommand = towerAction || action === "wave-start-grant";
    if ((commandSeq === null) === requiresCommand) {
      throw new TypeError(label + ".commandSeq nullability does not match its action");
    }
    telemetryInteger(commandSeq, label + ".commandSeq", { nullable: !requiresCommand });

    ["towerRuntimeId"].forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) === towerAction) {
        throw new TypeError(label + "." + field + " nullability does not match its action");
      }
      telemetryRuntimeId(value, label + "." + field, !towerAction);
    });
    ["levelBefore", "levelAfter"].forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) === towerAction) {
        throw new TypeError(label + "." + field + " nullability does not match its action");
      }
      telemetryInteger(value, label + "." + field, { nullable: !towerAction });
    });
    ["padId", "defenseId"].forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) === towerAction) {
        throw new TypeError(label + "." + field + " nullability does not match its action");
      }
      telemetryId(value, label + "." + field, !towerAction);
    });

    const investmentFields = ["investedBeforeAether", "investedAfterAether"];
    investmentFields.forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) === towerAction) {
        throw new TypeError(label + "." + field + " nullability does not match its action");
      }
      telemetryInteger(value, label + "." + field, { nullable: !towerAction });
    });
    if (action === "build" && (record.levelBefore !== 0 || record.investedBeforeAether !== 0)) {
      throw new RangeError(label + " build must begin at level and investment zero");
    }
    if (action === "build" && record.levelAfter !== 1) {
      throw new RangeError(label + " build must create a level-one tower");
    }
    if (action === "sell" && (record.levelAfter !== 0 || record.investedAfterAether !== 0)) {
      throw new RangeError(label + " sell must end at level and investment zero");
    }
    if (action === "sell" && (record.levelBefore < 1 || record.investedBeforeAether < 1)) {
      throw new RangeError(label + " sell must remove a positively invested owned tower");
    }
    if (action === "upgrade" && record.levelAfter !== record.levelBefore + 1) {
      throw new RangeError(label + " upgrade must advance exactly one level");
    }
    if (action === "upgrade" && record.levelBefore < 1) {
      throw new RangeError(label + " upgrade must begin from an owned tower level");
    }

    [
      "debitAether", "creditAether", "bankBeforeAether", "bankAfterAether",
      "bountyRemainderBefore", "bountyRemainderAfter",
    ].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
    const resolvedBank = ABI.checkedAdd(record.bankBeforeAether,
      ABI.checkedAdd(record.creditAether, -record.debitAether));
    if (resolvedBank !== record.bankAfterAether) {
      throw new RangeError(label + " bank deltas do not conserve Aether");
    }
    if (action === "build" || action === "upgrade") {
      if (record.debitAether < 1 || record.creditAether !== 0) {
        throw new RangeError(label + " purchase actions must be positive debits without credit");
      }
      if (record.investedAfterAether !==
          ABI.checkedAdd(record.investedBeforeAether, record.debitAether)) {
        throw new RangeError(label + " purchase debit must equal its investment increase");
      }
    } else if (action === "sell") {
      if (record.debitAether !== 0 ||
          record.creditAether !== ABI.refundSeventyPercent(record.investedBeforeAether)) {
        throw new RangeError(label + " sell credit must equal the ABI seventy-percent refund");
      }
    } else if (record.debitAether !== 0) {
      throw new RangeError(label + " internal credits cannot debit Aether");
    }
    if (action !== "bounty" &&
        record.bountyRemainderBefore !== record.bountyRemainderAfter) {
      throw new RangeError(label + " only bounty may change the bounty remainder");
    }
  }

  function requireActivationTelemetry(record, label) {
    telemetryEnum(dataValue(record, "actionId", label), TELEMETRY_ENUMS.activationActionId,
      label + ".actionId");
    telemetryId(dataValue(record, "behaviorId", label), label + ".behaviorId", false);
    telemetryRuntimeId(dataValue(record, "sourceTowerRuntimeId", label),
      label + ".sourceTowerRuntimeId", false);
    telemetryRuntimeId(dataValue(record, "sourceRuntimeId", label), label + ".sourceRuntimeId", false);
    telemetryId(dataValue(record, "defenseId", label), label + ".defenseId", false);
    telemetryInteger(dataValue(record, "level", label), label + ".level", { positive: true });
    telemetryId(dataValue(record, "padId", label), label + ".padId", false);
    const outcome = telemetryEnum(dataValue(record, "outcome", label),
      TELEMETRY_ENUMS.activationOutcome, label + ".outcome");
    const eligible = telemetryRuntimeIds(dataValue(record, "eligibleTargetRuntimeIds", label),
      label + ".eligibleTargetRuntimeIds");
    const selected = telemetryRuntimeIds(dataValue(record, "selectedTargetRuntimeIds", label),
      label + ".selectedTargetRuntimeIds");
    if (outcome !== "accepted" && selected.length !== 0) {
      throw new RangeError(label + " may select targets only when accepted");
    }
    let eligibleIndex = 0;
    selected.forEach(function (runtimeId) {
      while (eligibleIndex < eligible.length && eligible[eligibleIndex] < runtimeId) eligibleIndex += 1;
      if (eligible[eligibleIndex] !== runtimeId) {
        throw new RangeError(label + " selected targets must be eligible targets");
      }
    });
    if (outcome === "no-target") {
      if (["direct-hit", "splash-blast", "mark-scan"].indexOf(record.actionId) === -1 ||
          eligible.length !== 0) {
        throw new RangeError(label + " no-target must be a ready empty tower attack or scan");
      }
    } else if (outcome === "rejected") {
      if (record.actionId !== "guard-contact" || eligible.length === 0) {
        throw new RangeError(label + " rejected activation must be an eligible guard contact");
      }
    } else if (record.actionId === "guard-create") {
      if (eligible.length !== 0 || selected.length !== 0) {
        throw new RangeError(label + " guard creation cannot contain target IDs");
      }
    } else {
      if (eligible.length === 0 || selected.length === 0) {
        throw new RangeError(label + " accepted combat activation must select an eligible target");
      }
      if ((record.actionId === "direct-hit" || record.actionId === "guard-contact") &&
          selected.length !== 1) {
        throw new RangeError(label + " direct hits and guard contacts select exactly one target");
      }
    }
  }

  function requireMovementTelemetry(record, label) {
    telemetryRuntimeId(dataValue(record, "enemyRuntimeId", label), label + ".enemyRuntimeId", false);
    ["ownerId", "lineageId", "routeId"].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    [
      "priorRouteDistance", "nextRouteDistance", "actualAdvanceDistance", "effectiveSpeedBp",
      "scaledReductionBp",
    ].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
    const effectIds = telemetryRuntimeIds(dataValue(record, "sourceEffectRuntimeIds", label),
      label + ".sourceEffectRuntimeIds");
    const sourceIds = telemetryRuntimeIds(dataValue(record, "sourceRuntimeIds", label),
      label + ".sourceRuntimeIds");
    const towerIds = telemetryRuntimeIds(dataValue(record, "sourceTowerRuntimeIds", label),
      label + ".sourceTowerRuntimeIds");
    if (effectIds.length !== sourceIds.length) {
      throw new RangeError(label + " effect/source runtime arrays must be parallel");
    }
    if (record.scaledReductionBp === 0 &&
        (effectIds.length !== 0 || sourceIds.length !== 0 || towerIds.length !== 0)) {
      throw new RangeError(label + " no-control movement must have empty source arrays");
    }
    if (record.scaledReductionBp > 0 && effectIds.length === 0) {
      throw new RangeError(label + " controlled movement must identify its winning source");
    }
    if (record.nextRouteDistance < record.priorRouteDistance ||
        record.nextRouteDistance - record.priorRouteDistance !== record.actualAdvanceDistance) {
      throw new RangeError(label + " route-distance delta must equal actual advance");
    }
  }

  function requireDamageTelemetry(record, label) {
    ["sourceTowerRuntimeId", "sourceRuntimeId", "level", "targetRuntimeId"].forEach(function (field) {
      if (field === "level") {
        telemetryInteger(dataValue(record, field, label), label + "." + field, { positive: true });
      } else {
        telemetryRuntimeId(dataValue(record, field, label), label + "." + field, false);
      }
    });
    [
      "defenseId", "padId", "targetOwnerId", "targetLineageId", "targetRouteId", "damageTypeId",
    ].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    [
      "baseDamageMilli", "preShieldDamageMilli", "attemptedShieldDamageMilli",
      "appliedShieldDamageMilli", "eligibleHpDamageMilli", "appliedHpDamageMilli",
      "deferredHpDamageMilli", "overkillHpDamageMilli",
      "noExternalAppliedShieldDamageMilli", "noExternalAppliedHpDamageMilli",
      "targetShieldBeforeMilli", "targetShieldAfterMilli", "targetHpBeforeMilli",
      "targetHpAfterMilli",
    ].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
    if (record.targetShieldBeforeMilli - record.targetShieldAfterMilli !==
        record.appliedShieldDamageMilli) {
      throw new RangeError(label + " applied shield damage must equal the shield-pool delta");
    }
    if (record.targetHpBeforeMilli - record.targetHpAfterMilli !== record.appliedHpDamageMilli) {
      throw new RangeError(label + " applied HP damage must equal the HP-pool delta");
    }
    if (record.noExternalAppliedShieldDamageMilli > record.appliedShieldDamageMilli ||
        record.noExternalAppliedHpDamageMilli > record.appliedHpDamageMilli) {
      throw new RangeError(label + " no-external damage cannot exceed actual applied damage");
    }
    if (record.appliedShieldDamageMilli > record.attemptedShieldDamageMilli ||
        record.appliedShieldDamageMilli > record.targetShieldBeforeMilli) {
      throw new RangeError(label + " applied shield damage exceeds an attempted or available pool");
    }
    const resolvedEligibleHp = ABI.checkedAdd(
      record.appliedHpDamageMilli,
      ABI.checkedAdd(record.deferredHpDamageMilli, record.overkillHpDamageMilli)
    );
    if (record.eligibleHpDamageMilli !== resolvedEligibleHp) {
      throw new RangeError(label + " eligible HP damage must partition into applied, deferred, and overkill");
    }
    if (record.deferredHpDamageMilli > 0 && record.overkillHpDamageMilli > 0) {
      throw new RangeError(label + " threshold-deferred and terminal-overkill damage are exclusive");
    }
    if (record.deferredHpDamageMilli > 0 && record.targetHpAfterMilli === 0) {
      throw new RangeError(label + " threshold-deferred damage requires a surviving target");
    }
    if (record.overkillHpDamageMilli > 0 && record.targetHpAfterMilli !== 0) {
      throw new RangeError(label + " terminal overkill requires a zero-HP target");
    }
    const supportSources = telemetryRuntimeIds(
      dataValue(record, "supportSourceTowerRuntimeIds", label),
      label + ".supportSourceTowerRuntimeIds");
    telemetryRuntimeIds(dataValue(record, "revealSourceTowerRuntimeIds", label),
      label + ".revealSourceTowerRuntimeIds");
    if (supportSources.length === 0 &&
        (record.noExternalAppliedShieldDamageMilli !== record.appliedShieldDamageMilli ||
          record.noExternalAppliedHpDamageMilli !== record.appliedHpDamageMilli)) {
      throw new RangeError(label + " damage without support sources must equal its no-external result");
    }
  }

  function requireEffectTelemetry(record, label) {
    const action = telemetryEnum(dataValue(record, "action", label), TELEMETRY_ENUMS.effectAction,
      label + ".action");
    const effectKind = telemetryEnum(dataValue(record, "effectKind", label),
      TELEMETRY_ENUMS.effectKind, label + ".effectKind");
    telemetryRuntimeId(dataValue(record, "sourceRuntimeId", label), label + ".sourceRuntimeId", false);
    telemetryRuntimeId(dataValue(record, "targetRuntimeId", label), label + ".targetRuntimeId", false);
    const playerSourceFields = ["sourceTowerRuntimeId", "level"];
    const authoredSourceFields = ["defenseId", "padId"];
    const playerNull = dataValue(record, "sourceTowerRuntimeId", label) === null;
    playerSourceFields.forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) !== playerNull) {
        throw new TypeError(label + " player-source identity fields must share nullability");
      }
      if (field === "level") {
        telemetryInteger(value, label + "." + field, { nullable: playerNull, positive: true });
      } else {
        telemetryRuntimeId(value, label + "." + field, playerNull);
      }
    });
    authoredSourceFields.forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) !== playerNull) {
        throw new TypeError(label + " player-source identity fields must share nullability");
      }
      telemetryId(value, label + "." + field, playerNull);
    });
    // The delayed-status -> active-status transition retains its earlier streamed tower
    // provenance. Replay can validate only this closed transition shape; the bounded
    // balance fold must match and inherit the prior delayed-status apply record.
    const delayedActivationRefresh = playerNull && action === "refresh" &&
      dataValue(record, "outcome", label) === "refreshed" && effectKind === "status";
    if (playerNull && (action === "apply" || action === "refresh") &&
        effectKind !== "boss-exposure" && effectKind !== "resistance-override" &&
        !delayedActivationRefresh) {
      throw new TypeError(label + " apply/refresh player effects require complete tower provenance");
    }
    ["targetOwnerId", "targetRouteId", "statusId"].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    [
      "requestedMagnitude", "appliedMagnitude", "requestedDurationTimeUnits",
      "appliedDurationTimeUnits",
    ].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
    const outcome = telemetryEnum(dataValue(record, "outcome", label),
      TELEMETRY_ENUMS.effectOutcome, label + ".outcome");
    const allowedOutcomes = action === "apply" ? ["applied", "rejected"]
      : action === "refresh" ? ["refreshed", "rejected"]
      : action === "remove" ? ["removed"] : ["expired"];
    if (allowedOutcomes.indexOf(outcome) === -1) {
      throw new RangeError(label + " action/outcome pair is invalid");
    }
    if ((outcome === "rejected" || action === "remove" || action === "expire") &&
        (record.appliedMagnitude !== 0 || record.appliedDurationTimeUnits !== 0)) {
      throw new RangeError(label + " non-active effect outcomes must apply zero magnitude and duration");
    }
  }

  function requireLeakTelemetry(record, label) {
    telemetryRuntimeId(dataValue(record, "enemyRuntimeId", label), label + ".enemyRuntimeId", false);
    ["ownerId", "lineageId", "routeId"].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    ["hpMilli", "shieldMilli", "integrityDamage"].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
  }

  function requireBalanceTelemetry(telemetry, expectedTick) {
    if (!telemetry || typeof telemetry !== "object" || Array.isArray(telemetry) ||
        !Object.isFrozen(telemetry)) {
      throw new TypeError("Kernel balance telemetry must be a frozen object");
    }
    exactFields(telemetry, TELEMETRY_FIELDS, "Kernel balance telemetry");
    if (dataValue(telemetry, "schemaVersion", "Kernel balance telemetry") !==
        BALANCE_TELEMETRY_SCHEMA_VERSION) {
      throw new RangeError("Kernel balance telemetry schema version is unsupported");
    }
    const tick = telemetryInteger(dataValue(telemetry, "tick", "Kernel balance telemetry"),
      "Kernel balance telemetry tick");
    if (tick !== expectedTick) {
      throw new RangeError("Kernel balance telemetry tick must equal the input boundary tick");
    }
    const records = arrayDataValues(dataValue(telemetry, "records", "Kernel balance telemetry"),
      "Kernel balance telemetry records", MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK);
    if (!Object.isFrozen(telemetry.records)) {
      throw new TypeError("Kernel balance telemetry records must be frozen");
    }
    records.forEach(function (record, ordinal) {
      const shape = requireTelemetryRecordShape(record, ordinal);
      if (shape.kind === "spawn") requireSpawnTelemetry(record, shape.label);
      else if (shape.kind === "aether-transaction") requireAetherTelemetry(record, shape.label);
      else if (shape.kind === "activation") requireActivationTelemetry(record, shape.label);
      else if (shape.kind === "movement-control") requireMovementTelemetry(record, shape.label);
      else if (shape.kind === "damage") requireDamageTelemetry(record, shape.label);
      else if (shape.kind === "effect") requireEffectTelemetry(record, shape.label);
      else if (shape.kind === "leak") requireLeakTelemetry(record, shape.label);
    });
    requireDeepFrozenCanonical(telemetry, "Kernel balance telemetry");
    return telemetry;
  }

  function requireTickResult(result, expectedTick, inputTick) {
    if (!result || typeof result !== "object" || Array.isArray(result) || !Object.isFrozen(result)) {
      throw new TypeError("Kernel advanceTick must return a frozen result object");
    }
    exactFields(result, ["events", "state", "telemetry"], "Kernel tick result");
    if (!Array.isArray(result.events) || !Object.isFrozen(result.events)) {
      throw new TypeError("Kernel tick events must be a frozen array");
    }
    requireDeepFrozenCanonical(result.events, "Kernel tick events");
    requireBalanceTelemetry(result.telemetry, inputTick);
    return requireKernelState(result.state, expectedTick, "Kernel tick state");
  }

  function diagnosticStateHash(state) {
    return "fnv1a32:" + ABI.fnv1a32Hex(ABI.canonicalBytes(state));
  }

  function finalStateHash(state) {
    return ABI.sha256Hex(ABI.canonicalBytes(state));
  }

  function countLaurels(state) {
    let count = 0;
    state.objectiveResults.forEach(function (result) {
      if (result.complete) count += 1;
    });
    return count;
  }

  function runNormalizedReplay(binding, pair, envelope) {
    validateNormalizedBinding(envelope, pair);
    const durationTicks = envelope.finalClaim.durationTicks;
    let state = requireKernelState(
      Kernel.createInitialState(binding, replayHeader(envelope)),
      0,
      "Kernel initial state"
    );
    if (state.outcome !== "active") {
      throw new RangeError("Kernel initial state must be active before any completed replay tick");
    }

    let inputIndex = 0;
    let checkpointIndex = 0;
    function verifyCheckpointAtCurrentTick() {
      if (checkpointIndex >= envelope.checkpoints.length) return;
      const checkpoint = envelope.checkpoints[checkpointIndex];
      if (checkpoint.tick !== state.tick) return;
      const actual = diagnosticStateHash(state);
      if (actual !== checkpoint.diagnosticHash) {
        throw new Error("Replay diagnostic checkpoint mismatch at tick " + state.tick);
      }
      checkpointIndex += 1;
    }

    verifyCheckpointAtCurrentTick();
    for (let tick = 0; tick < durationTicks; tick += 1) {
      if (state.tick !== tick) throw new RangeError("Kernel state tick drifted before replay advance");
      if (state.outcome !== "active") {
        throw new RangeError("Replay reached a terminal state before its claimed final boundary");
      }
      const bucket = [];
      while (inputIndex < envelope.inputs.length && envelope.inputs[inputIndex].tick === tick) {
        bucket.push(envelope.inputs[inputIndex]);
        inputIndex += 1;
      }
      const result = Kernel.advanceTick(binding, state, Object.freeze(bucket));
      state = requireTickResult(result, tick + 1, tick);
      if (state.outcome !== "active" && state.tick < durationTicks) {
        throw new RangeError("Replay reached a terminal state before its claimed final boundary");
      }
      if (state.outcome === "active" && state.tick === durationTicks) {
        throw new RangeError("Replay did not reach a terminal state at its claimed final boundary");
      }
      verifyCheckpointAtCurrentTick();
    }

    if (inputIndex !== envelope.inputs.length) {
      throw new RangeError("Replay contains an input outside the executed tick interval");
    }
    if (checkpointIndex !== envelope.checkpoints.length) {
      throw new RangeError("Replay contains an unverified diagnostic checkpoint");
    }
    if (state.outcome === "active") {
      throw new RangeError("Replay did not reach a terminal state at its claimed final boundary");
    }
    if (state.outcome !== envelope.finalClaim.outcome) {
      throw new Error("Replay final outcome claim does not match the simulated state");
    }
    if (state.score !== envelope.finalClaim.score) {
      throw new Error("Replay final score claim does not match the simulated state");
    }
    if (countLaurels(state) !== envelope.finalClaim.laurels) {
      throw new Error("Replay final Laurel claim does not match the simulated objectives");
    }
    if (state.tick !== durationTicks) {
      throw new Error("Replay final duration claim does not match the simulated state");
    }
    if (finalStateHash(state) !== envelope.finalClaim.finalStateHash) {
      throw new Error("Replay final state SHA-256 claim does not match the simulated state");
    }
    return Object.freeze({
      finalState: state,
      verifiedCheckpointCount: checkpointIndex,
    });
  }

  function createBoundSimulator(input) {
    exactFields(input, BOUND_INPUT_FIELDS, "Replay runner binding input");
    if (typeof input.normalizeReplayEnvelope !== "function") {
      throw new TypeError("Replay runner requires the strict v1 envelope normalizer");
    }
    const pair = requireArtifactPair(input.release, input.content);
    const binding = Kernel.createRulesetBinding({ release: pair.release, content: pair.content });
    if (!binding || typeof binding !== "object" || !Object.isFrozen(binding)) {
      throw new TypeError("Kernel createRulesetBinding must return an opaque frozen binding");
    }
    const normalize = input.normalizeReplayEnvelope;
    return Object.freeze({
      simulateReplay: function (envelopeInput) {
        const envelope = normalize(envelopeInput);
        validateExecutionEnvelope(envelope);
        requireDeepFrozenCanonical(envelope, "Normalized replay envelope");
        return runNormalizedReplay(binding, pair, envelope);
      },
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    EXECUTION_LIMITS: EXECUTION_LIMITS,
    RUNNER_SCHEMA_VERSION: RUNNER_SCHEMA_VERSION,
    createBoundSimulator: createBoundSimulator,
  });
});

  /* source replay.js bytes=34743 sha256=62b4953f376f4fafb694d05adfe8ee2ffd3e9acfbfcc465361719d344e95c41c */
/* Armara Aegis deterministic replay envelope and bound execution API v1.
   Strict, bounded parsing plus explicit immutable ruleset simulation without platform I/O. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before replay.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before replay.js");
  if (!game.AegisReplayRunner) throw new Error("Game.AegisReplayRunner must be installed before replay.js");
  const api = factory(
    game.AegisSim,
    game.AegisCommands,
    game.AegisReplayRunner
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisReplay")) {
    if (game.AegisReplay !== api) throw new Error("Game.AegisReplay is already installed");
    return;
  }
  Object.defineProperty(game, "AegisReplay", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (
  ABI,
  Commands,
  ReplayRunner
) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  ["canonicalEncode", "canonicalBytes", "utf8Bytes", "fnv1a32Hex", "sha256Hex"].forEach(
    function (name) {
      if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
    }
  );
  if (
    !Commands ||
    !Object.isFrozen(Commands) ||
    !Object.isFrozen(Commands.DEFAULT_LIMITS) ||
    typeof Commands.normalizeCommandSequence !== "function"
  ) {
    throw new TypeError("A frozen Aegis Commands API is required");
  }
  if (Commands.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new Error("Aegis Commands ABI descriptor identity does not match the simulation ABI");
  }
  if (!ReplayRunner || !Object.isFrozen(ReplayRunner) ||
      typeof ReplayRunner.createBoundSimulator !== "function") {
    throw new TypeError("A frozen Aegis ReplayRunner API is required");
  }
  if (ReplayRunner.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new Error("Aegis ReplayRunner ABI descriptor identity does not match the simulation ABI");
  }
  if (!ReplayRunner.EXECUTION_LIMITS || !Object.isFrozen(ReplayRunner.EXECUTION_LIMITS)) {
    throw new TypeError("A frozen Aegis ReplayRunner execution-limit record is required");
  }
  const EXECUTION_LIMITS = ReplayRunner.EXECUTION_LIMITS;
  const executionLimitKeys = [
    "maxAccessGrantIds", "maxCampaignModifierIds", "maxCheckpoints", "maxCommandsPerTick",
    "maxDurationTicks", "maxLoadoutIds", "maxStringLength", "maxTotalCommands",
  ];
  if (Object.keys(EXECUTION_LIMITS).sort().join("\u0000") !== executionLimitKeys.sort().join("\u0000")) {
    throw new TypeError("Aegis ReplayRunner execution-limit fields are invalid");
  }
  executionLimitKeys.forEach(function (key) {
    if (!Number.isSafeInteger(EXECUTION_LIMITS[key]) || EXECUTION_LIMITS[key] < 1) {
      throw new RangeError("Aegis ReplayRunner execution limit is invalid: " + key);
    }
  });
  if (EXECUTION_LIMITS.maxCommandsPerTick !== Commands.DEFAULT_LIMITS.maxCommandsPerTick ||
      EXECUTION_LIMITS.maxDurationTicks !== Commands.DEFAULT_LIMITS.maxTick) {
    throw new RangeError("Aegis ReplayRunner and Commands execution limits do not match");
  }

  const FORMAT_VERSION = 1;
  const EVENT_SCHEMA_VERSION = ABI.EVENT_SCHEMA_VERSION;
  const COMMAND_SCHEMA_VERSION = Commands.COMMAND_SCHEMA_VERSION;
  const MAX_UINT32 = 0xffffffff;
  const STABLE_ID = /^[a-z][a-z0-9._:-]*$/;
  const RULESET_HASH = /^sha256:[0-9a-f]{64}$/;
  const DIAGNOSTIC_HASH = /^fnv1a32:[0-9a-f]{8}$/;
  const FINAL_STATE_HASH = /^[0-9a-f]{64}$/;
  const DIFFICULTY_IDS = Object.freeze(["story", "strategos", "titan"]);
  const TOP_LEVEL_FIELDS = Object.freeze([
    "formatVersion",
    "rulesetHash",
    "eventSchemaVersion",
    "missionId",
    "difficultyId",
    "assist",
    "seed",
    "loadoutIds",
    "loadoutSlotCap",
    "campaignModifierIds",
    "accessGrantIds",
    "tutorialUpgradeGateMode",
    "inputs",
    "checkpoints",
    "finalClaim",
  ]);
  const CHECKPOINT_FIELDS = Object.freeze(["tick", "diagnosticHash"]);
  const FINAL_CLAIM_FIELDS = Object.freeze([
    "outcome",
    "score",
    "laurels",
    "durationTicks",
    "finalStateHash",
  ]);
  // Commands keeps a reusable 100,000-record hard ceiling. A portable replay is deliberately
  // tighter. ReplayRunner owns every normalized-execution ceiling so direct runner callers and
  // parsed Replay callers cannot diverge; parser-only byte/tree ceilings remain local here.
  const DEFAULT_LIMITS = Object.freeze({
    maxUtf8Bytes: 4 * 1024 * 1024,
    // A 24-hour duration processes command ticks 0..5,183,999 inclusively.
    maxTick: EXECUTION_LIMITS.maxDurationTicks - 1,
    maxTotalCommands: EXECUTION_LIMITS.maxTotalCommands,
    maxCommandsPerTick: EXECUTION_LIMITS.maxCommandsPerTick,
    maxArrayLength: 256,
    maxStringLength: EXECUTION_LIMITS.maxStringLength,
    maxObjectFields: 64,
    maxNestingDepth: 32,
    maxLoadoutIds: EXECUTION_LIMITS.maxLoadoutIds,
    maxCampaignModifierIds: EXECUTION_LIMITS.maxCampaignModifierIds,
    maxAccessGrantIds: EXECUTION_LIMITS.maxAccessGrantIds,
    maxCheckpoints: EXECUTION_LIMITS.maxCheckpoints,
    maxDurationTicks: EXECUTION_LIMITS.maxDurationTicks,
  });
  const LIMIT_KEYS = Object.freeze(Object.keys(DEFAULT_LIMITS).sort());

  if (COMMAND_SCHEMA_VERSION !== ABI.DESCRIPTOR.commands.schemaVersion) {
    throw new Error("Aegis Commands schema does not match the simulation ABI");
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function enumerableDataNames(value, label) {
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    for (let index = 0; index < names.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, names[index]);
      if (!descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
    }
    return names;
  }

  function exactFields(value, expected, label, maximum) {
    if (!isPlainObject(value)) throw new TypeError(label + " must be a plain object");
    const names = enumerableDataNames(value, label).sort();
    if (maximum !== undefined && names.length > maximum) {
      throw new RangeError(label + " exceeds the object field limit");
    }
    const wanted = expected.slice().sort();
    if (names.length !== wanted.length || names.some(function (name, index) { return name !== wanted[index]; })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function dataValue(value, key, label) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(label + "." + key + " must be an enumerable data property");
    }
    return descriptor.value;
  }

  function createReplayLimits(overrides) {
    if (overrides === undefined) return DEFAULT_LIMITS;
    if (!isPlainObject(overrides)) throw new TypeError("Replay limits must be a plain object");
    const names = enumerableDataNames(overrides, "Replay limits").sort();
    for (let index = 0; index < names.length; index++) {
      if (LIMIT_KEYS.indexOf(names[index]) === -1) {
        throw new TypeError("Unknown replay limit " + names[index]);
      }
    }
    const result = {};
    for (let index = 0; index < LIMIT_KEYS.length; index++) {
      const key = LIMIT_KEYS[index];
      const supplied = Object.prototype.hasOwnProperty.call(overrides, key)
        ? dataValue(overrides, key, "Replay limits")
        : DEFAULT_LIMITS[key];
      if (!Number.isSafeInteger(supplied) || supplied < 0) {
        throw new RangeError("Replay limit " + key + " must be a nonnegative safe integer");
      }
      if (supplied > DEFAULT_LIMITS[key]) {
        throw new RangeError("Replay limit " + key + " cannot relax the default limit");
      }
      result[key] = supplied;
    }
    return Object.freeze(result);
  }

  function wellFormedString(value, label, maxLength) {
    if (typeof value !== "string") throw new TypeError(label + " must be a string");
    if (value.length > maxLength) throw new RangeError(label + " exceeds the string length limit");
    for (let index = 0; index < value.length; index++) {
      const unit = value.charCodeAt(index);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) {
          throw new TypeError(label + " contains a lone Unicode surrogate");
        }
        index++;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) {
        throw new TypeError(label + " contains a lone Unicode surrogate");
      }
    }
    return value;
  }

  function stableId(value, label, limits) {
    wellFormedString(value, label, limits.maxStringLength);
    if (!STABLE_ID.test(value)) throw new TypeError(label + " must be a stable ASCII ID");
    return value;
  }

  function nonnegativeInteger(value, label, maximum) {
    if (!Number.isSafeInteger(value)) throw new TypeError(label + " must be a safe integer");
    if (Object.is(value, -0)) throw new TypeError(label + " cannot be negative zero");
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    if (maximum !== undefined && value > maximum) throw new RangeError(label + " exceeds its limit");
    return value;
  }

  function exactInteger(value, expected, label) {
    if (Object.is(value, -0)) throw new TypeError(label + " cannot be negative zero");
    if (!Number.isSafeInteger(value) || value !== expected) {
      throw new RangeError(label + " must be " + expected);
    }
    return value;
  }

  function booleanValue(value, label) {
    if (typeof value !== "boolean") throw new TypeError(label + " must be boolean");
    return value;
  }

  function arrayDataValues(value, label, maximum) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    if (value.length > maximum) throw new RangeError(label + " exceeds its array length limit");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    for (let index = 0; index < value.length; index++) {
      const key = String(index);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must be a dense array of enumerable data elements");
      }
    }
    for (let index = 0; index < names.length; index++) {
      const key = names[index];
      if (key === "length") continue;
      if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        throw new TypeError(label + " cannot contain extra properties");
      }
    }
    const output = new Array(value.length);
    for (let index = 0; index < value.length; index++) {
      output[index] = Object.getOwnPropertyDescriptor(value, String(index)).value;
    }
    return output;
  }

  function idArray(value, label, maximum, limits, sorted) {
    const source = arrayDataValues(value, label, maximum);
    const output = new Array(source.length);
    let previous = null;
    const seen = Object.create(null);
    for (let index = 0; index < source.length; index++) {
      const id = stableId(source[index], label + "[" + index + "]", limits);
      if (Object.prototype.hasOwnProperty.call(seen, id)) {
        throw new TypeError(label + " must contain unique IDs");
      }
      if (sorted && previous !== null && id <= previous) {
        throw new TypeError(label + " must be in strict ASCII order");
      }
      seen[id] = true;
      previous = id;
      output[index] = id;
    }
    return output;
  }

  function cloneCanonical(value, limits, seen, depth, label) {
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) throw new TypeError(label + " numbers must be safe integers");
      if (Object.is(value, -0)) throw new TypeError(label + " cannot contain negative zero");
      return value;
    }
    if (typeof value === "string") return wellFormedString(value, label, limits.maxStringLength);
    if (!value || typeof value !== "object") throw new TypeError(label + " contains an unsupported value");
    if (depth > limits.maxNestingDepth) throw new RangeError(label + " exceeds the nesting depth limit");
    if (seen.has(value)) throw new TypeError(label + " cannot contain cycles or shared references");
    seen.add(value);

    if (Array.isArray(value)) {
      const source = arrayDataValues(value, label, limits.maxArrayLength);
      return source.map(function (item, index) {
        return cloneCanonical(item, limits, seen, depth + 1, label + "[" + index + "]");
      });
    }
    if (!isPlainObject(value)) throw new TypeError(label + " must contain only plain objects");
    const names = enumerableDataNames(value, label);
    if (names.length > limits.maxObjectFields) throw new RangeError(label + " exceeds the object field limit");
    const output = Object.create(null);
    for (let index = 0; index < names.length; index++) {
      const key = names[index];
      wellFormedString(key, label + " object key", limits.maxStringLength);
      if (!/^[\x00-\x7f]*$/.test(key)) throw new TypeError(label + " object keys must be ASCII");
      Object.defineProperty(output, key, {
        value: cloneCanonical(dataValue(value, key, label), limits, seen, depth + 1, label + "." + key),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    return output;
  }

  function decodeUtf8Strict(bytes) {
    let result = "";
    for (let index = 0; index < bytes.length;) {
      const first = bytes[index++];
      let codePoint;
      let second;
      let third;
      let fourth;
      if (first <= 0x7f) {
        codePoint = first;
      } else if (first >= 0xc2 && first <= 0xdf) {
        if (index >= bytes.length) throw new TypeError("Replay bytes contain invalid UTF-8");
        second = bytes[index++];
        if ((second & 0xc0) !== 0x80) throw new TypeError("Replay bytes contain invalid UTF-8");
        codePoint = ((first & 0x1f) << 6) | (second & 0x3f);
      } else if (first >= 0xe0 && first <= 0xef) {
        if (index + 1 >= bytes.length) throw new TypeError("Replay bytes contain invalid UTF-8");
        second = bytes[index++];
        third = bytes[index++];
        if (
          (third & 0xc0) !== 0x80 ||
          (second & 0xc0) !== 0x80 ||
          (first === 0xe0 && second < 0xa0) ||
          (first === 0xed && second >= 0xa0)
        ) {
          throw new TypeError("Replay bytes contain invalid UTF-8");
        }
        codePoint = ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
      } else if (first >= 0xf0 && first <= 0xf4) {
        if (index + 2 >= bytes.length) throw new TypeError("Replay bytes contain invalid UTF-8");
        second = bytes[index++];
        third = bytes[index++];
        fourth = bytes[index++];
        if (
          (second & 0xc0) !== 0x80 ||
          (third & 0xc0) !== 0x80 ||
          (fourth & 0xc0) !== 0x80 ||
          (first === 0xf0 && second < 0x90) ||
          (first === 0xf4 && second >= 0x90)
        ) {
          throw new TypeError("Replay bytes contain invalid UTF-8");
        }
        codePoint = (
          ((first & 0x07) << 18) |
          ((second & 0x3f) << 12) |
          ((third & 0x3f) << 6) |
          (fourth & 0x3f)
        );
      } else {
        throw new TypeError("Replay bytes contain invalid UTF-8");
      }

      if (codePoint <= 0xffff) {
        result += String.fromCharCode(codePoint);
      } else {
        const adjusted = codePoint - 0x10000;
        result += String.fromCharCode(0xd800 + (adjusted >>> 10), 0xdc00 + (adjusted & 0x3ff));
      }
    }
    return result;
  }

  function isUint8Bytes(value) {
    return Boolean(
      value &&
      typeof ArrayBuffer !== "undefined" &&
      typeof ArrayBuffer.isView === "function" &&
      ArrayBuffer.isView(value) &&
      Object.prototype.toString.call(value) === "[object Uint8Array]"
    );
  }

  function sourceText(source, limits) {
    if (typeof source === "string") {
      if (source.charCodeAt(0) === 0xfeff) throw new TypeError("Replay JSON must not contain a BOM");
      if (source.length > limits.maxUtf8Bytes) {
        throw new RangeError("Replay JSON exceeds the UTF-8 byte limit");
      }
      wellFormedString(source, "Replay JSON", Number.MAX_SAFE_INTEGER);
      const byteLength = ABI.utf8Bytes(source).length;
      if (byteLength > limits.maxUtf8Bytes) throw new RangeError("Replay JSON exceeds the UTF-8 byte limit");
      return source;
    }
    if (!isUint8Bytes(source)) {
      throw new TypeError("Replay source must be a string or Uint8Array");
    }
    if (source.length > limits.maxUtf8Bytes) throw new RangeError("Replay JSON exceeds the UTF-8 byte limit");
    const bytes = new Uint8Array(source.length);
    for (let index = 0; index < source.length; index++) bytes[index] = source[index];
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      throw new TypeError("Replay JSON must not contain a BOM");
    }
    return decodeUtf8Strict(bytes);
  }

  function parseStrictJson(text, limits) {
    let position = 0;
    const parserArrayLimit = Math.max(
      limits.maxArrayLength,
      limits.maxLoadoutIds,
      limits.maxCampaignModifierIds,
      limits.maxAccessGrantIds,
      limits.maxCheckpoints,
      limits.maxTotalCommands
    );

    function fail(message) {
      throw new SyntaxError("Invalid replay JSON at character " + position + ": " + message);
    }

    function whitespace() {
      while (position < text.length) {
        const unit = text.charCodeAt(position);
        if (unit !== 0x20 && unit !== 0x09 && unit !== 0x0a && unit !== 0x0d) break;
        position++;
      }
    }

    function stringValue() {
      if (text.charCodeAt(position) !== 0x22) fail("expected string");
      position++;
      let output = "";
      while (position < text.length) {
        const unit = text.charCodeAt(position++);
        if (unit === 0x22) {
          wellFormedString(output, "Replay JSON string", limits.maxStringLength);
          return output;
        }
        if (unit <= 0x1f) fail("unescaped control character in string");
        if (unit !== 0x5c) {
          output += String.fromCharCode(unit);
        } else {
          if (position >= text.length) fail("unterminated escape");
          const escaped = text.charAt(position++);
          const simple = { '"': '"', "\\": "\\", "/": "/", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t" };
          if (Object.prototype.hasOwnProperty.call(simple, escaped)) {
            output += simple[escaped];
          } else if (escaped === "u") {
            if (position + 4 > text.length) fail("short Unicode escape");
            const digits = text.slice(position, position + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail("invalid Unicode escape");
            output += String.fromCharCode(parseInt(digits, 16));
            position += 4;
          } else {
            fail("invalid string escape");
          }
        }
        if (output.length > limits.maxStringLength) {
          throw new RangeError("Replay JSON string exceeds the string length limit");
        }
      }
      fail("unterminated string");
    }

    function numberValue() {
      const start = position;
      if (text.charCodeAt(position) === 0x2d) position++;
      if (text.charCodeAt(position) === 0x30) {
        position++;
      } else {
        const first = text.charCodeAt(position);
        if (first < 0x31 || first > 0x39) fail("invalid number");
        do { position++; }
        while (position < text.length && text.charCodeAt(position) >= 0x30 && text.charCodeAt(position) <= 0x39);
      }
      const next = text.charAt(position);
      if (next === "." || next === "e" || next === "E") {
        fail("numbers must be integers");
      }
      const value = Number(text.slice(start, position));
      if (!Number.isSafeInteger(value)) fail("number must be a safe integer");
      if (Object.is(value, -0)) fail("negative zero is not canonical");
      return value;
    }

    function arrayValue(depth) {
      position++;
      const result = [];
      whitespace();
      if (text.charCodeAt(position) === 0x5d) {
        position++;
        return result;
      }
      while (position < text.length) {
        if (result.length >= parserArrayLimit) {
          throw new RangeError("Replay JSON array exceeds the parser array limit");
        }
        result.push(value(depth + 1));
        whitespace();
        const unit = text.charCodeAt(position++);
        if (unit === 0x5d) return result;
        if (unit !== 0x2c) fail("expected comma or closing bracket");
        whitespace();
      }
      fail("unterminated array");
    }

    function objectValue(depth) {
      position++;
      const result = Object.create(null);
      const seenKeys = Object.create(null);
      let fieldCount = 0;
      whitespace();
      if (text.charCodeAt(position) === 0x7d) {
        position++;
        return result;
      }
      while (position < text.length) {
        if (fieldCount >= limits.maxObjectFields) {
          throw new RangeError("Replay JSON object exceeds the field limit");
        }
        if (text.charCodeAt(position) !== 0x22) fail("expected object key");
        const key = stringValue();
        if (Object.prototype.hasOwnProperty.call(seenKeys, key)) fail("duplicate object key " + key);
        seenKeys[key] = true;
        whitespace();
        if (text.charCodeAt(position++) !== 0x3a) fail("expected colon");
        whitespace();
        Object.defineProperty(result, key, {
          value: value(depth + 1),
          writable: true,
          configurable: true,
          enumerable: true,
        });
        fieldCount++;
        whitespace();
        const unit = text.charCodeAt(position++);
        if (unit === 0x7d) return result;
        if (unit !== 0x2c) fail("expected comma or closing brace");
        whitespace();
      }
      fail("unterminated object");
    }

    function value(depth) {
      if (depth > limits.maxNestingDepth) throw new RangeError("Replay JSON exceeds the nesting depth limit");
      whitespace();
      const unit = text.charCodeAt(position);
      if (unit === 0x22) return stringValue();
      if (unit === 0x7b) return objectValue(depth);
      if (unit === 0x5b) return arrayValue(depth);
      if (unit === 0x2d || (unit >= 0x30 && unit <= 0x39)) return numberValue();
      if (text.slice(position, position + 4) === "true") { position += 4; return true; }
      if (text.slice(position, position + 5) === "false") { position += 5; return false; }
      if (text.slice(position, position + 4) === "null") { position += 4; return null; }
      fail("unexpected token");
    }

    whitespace();
    const parsed = value(0);
    whitespace();
    if (position !== text.length) fail("trailing data");
    return parsed;
  }

  function normalizeReplayEnvelope(envelope, limitOverrides) {
    const limits = createReplayLimits(limitOverrides);
    exactFields(envelope, TOP_LEVEL_FIELDS, "Replay envelope", limits.maxObjectFields);
    if (limits.maxNestingDepth < 2) {
      throw new RangeError("Replay envelope exceeds the nesting depth limit");
    }

    const formatVersion = exactInteger(
      dataValue(envelope, "formatVersion", "Replay envelope"),
      FORMAT_VERSION,
      "Replay format version"
    );
    const rulesetHash = dataValue(envelope, "rulesetHash", "Replay envelope");
    wellFormedString(rulesetHash, "Replay ruleset hash", limits.maxStringLength);
    if (typeof rulesetHash !== "string" || !RULESET_HASH.test(rulesetHash)) {
      throw new TypeError("Replay ruleset hash must be lowercase sha256:<64-hex>");
    }
    const eventSchemaVersion = exactInteger(
      dataValue(envelope, "eventSchemaVersion", "Replay envelope"),
      EVENT_SCHEMA_VERSION,
      "Replay event schema version"
    );
    const missionId = stableId(dataValue(envelope, "missionId", "Replay envelope"), "Mission ID", limits);
    const difficultyId = stableId(
      dataValue(envelope, "difficultyId", "Replay envelope"),
      "Difficulty ID",
      limits
    );
    if (DIFFICULTY_IDS.indexOf(difficultyId) === -1) {
      throw new RangeError("Replay difficulty ID must be story, strategos, or titan");
    }
    const assist = booleanValue(dataValue(envelope, "assist", "Replay envelope"), "Replay Assist flag");
    const seed = nonnegativeInteger(dataValue(envelope, "seed", "Replay envelope"), "Replay seed", MAX_UINT32);
    const loadoutIds = idArray(
      dataValue(envelope, "loadoutIds", "Replay envelope"),
      "Replay loadout IDs",
      limits.maxLoadoutIds,
      limits,
      false
    );
    if (loadoutIds.length === 0) throw new RangeError("Replay loadout IDs must not be empty");
    const loadoutSlotCap = nonnegativeInteger(
      dataValue(envelope, "loadoutSlotCap", "Replay envelope"),
      "Replay loadout slot cap",
      6
    );
    if (loadoutSlotCap < 1) throw new RangeError("Replay loadout slot cap must be at least one");
    if (loadoutIds.length > loadoutSlotCap) {
      throw new RangeError("Replay loadout IDs exceed the resolved slot cap");
    }
    const campaignModifierIds = idArray(
      dataValue(envelope, "campaignModifierIds", "Replay envelope"),
      "Replay campaign modifier IDs",
      limits.maxCampaignModifierIds,
      limits,
      true
    );
    const accessGrantIds = idArray(
      dataValue(envelope, "accessGrantIds", "Replay envelope"),
      "Replay access grant IDs",
      limits.maxAccessGrantIds,
      limits,
      false
    );
    const tutorialUpgradeGateMode = stableId(
      dataValue(envelope, "tutorialUpgradeGateMode", "Replay envelope"),
      "Tutorial Upgrade gate mode",
      limits
    );
    if (ABI.DESCRIPTOR.tutorialUpgradeGate.modes.indexOf(tutorialUpgradeGateMode) === -1) {
      throw new RangeError("Unsupported Tutorial Upgrade gate mode " + tutorialUpgradeGateMode);
    }

    const rawInputs = arrayDataValues(
      dataValue(envelope, "inputs", "Replay envelope"),
      "Replay inputs",
      limits.maxTotalCommands
    );
    const inputGraph = new WeakSet();
    const inputClone = rawInputs.map(function (input, index) {
      return cloneCanonical(input, limits, inputGraph, 0, "Replay input " + index);
    });
    if (inputClone.length && limits.maxNestingDepth < 3) {
      throw new RangeError("Replay inputs exceed the nesting depth limit");
    }
    const inputs = Commands.normalizeCommandSequence(inputClone, {
      maxCommandsPerTick: limits.maxCommandsPerTick,
      maxTick: limits.maxTick,
      maxTotalCommands: limits.maxTotalCommands,
    });
    if (
      !Array.isArray(inputs) ||
      inputs.length !== inputClone.length ||
      ABI.canonicalEncode(inputs) !== ABI.canonicalEncode(inputClone)
    ) {
      throw new Error("Aegis Commands must preserve every normalized replay input");
    }

    const checkpointSource = arrayDataValues(
      dataValue(envelope, "checkpoints", "Replay envelope"),
      "Replay checkpoints",
      limits.maxCheckpoints
    );
    const checkpoints = new Array(checkpointSource.length);
    if (checkpointSource.length && limits.maxNestingDepth < 3) {
      throw new RangeError("Replay checkpoints exceed the nesting depth limit");
    }
    let previousCheckpointTick = -1;
    for (let index = 0; index < checkpointSource.length; index++) {
      const source = checkpointSource[index];
      exactFields(source, CHECKPOINT_FIELDS, "Replay checkpoint " + index, limits.maxObjectFields);
      const tick = nonnegativeInteger(
        dataValue(source, "tick", "Replay checkpoint " + index),
        "Replay checkpoint tick",
        limits.maxTick
      );
      if (tick <= previousCheckpointTick) {
        throw new RangeError("Replay checkpoints must be in strictly increasing tick order");
      }
      const diagnosticHash = dataValue(source, "diagnosticHash", "Replay checkpoint " + index);
      wellFormedString(diagnosticHash, "Replay checkpoint diagnostic hash", limits.maxStringLength);
      if (typeof diagnosticHash !== "string" || !DIAGNOSTIC_HASH.test(diagnosticHash)) {
        throw new TypeError("Replay checkpoint diagnostic hash must be lowercase fnv1a32:<8-hex>");
      }
      checkpoints[index] = { tick: tick, diagnosticHash: diagnosticHash };
      previousCheckpointTick = tick;
    }

    const claimSource = dataValue(envelope, "finalClaim", "Replay envelope");
    exactFields(claimSource, FINAL_CLAIM_FIELDS, "Replay final claim", limits.maxObjectFields);
    const outcome = dataValue(claimSource, "outcome", "Replay final claim");
    wellFormedString(outcome, "Replay final outcome", limits.maxStringLength);
    if (outcome !== "victory" && outcome !== "defeat") {
      throw new RangeError("Replay final outcome must be victory or defeat");
    }
    const score = nonnegativeInteger(dataValue(claimSource, "score", "Replay final claim"), "Replay final score");
    const laurels = nonnegativeInteger(
      dataValue(claimSource, "laurels", "Replay final claim"),
      "Replay final Laurels",
      3
    );
    const durationTicks = nonnegativeInteger(
      dataValue(claimSource, "durationTicks", "Replay final claim"),
      "Replay final duration",
      limits.maxDurationTicks
    );
    const claimedHash = dataValue(claimSource, "finalStateHash", "Replay final claim");
    wellFormedString(claimedHash, "Replay final state hash", limits.maxStringLength);
    if (typeof claimedHash !== "string" || !FINAL_STATE_HASH.test(claimedHash)) {
      throw new TypeError("Replay final state hash must be lowercase 64-hex SHA-256");
    }
    if (checkpoints.length && checkpoints[checkpoints.length - 1].tick > durationTicks) {
      throw new RangeError("Replay checkpoint tick cannot exceed final duration");
    }
    // durationTicks is the resulting state tick after processing buckets 0..N-1. A command at N
    // was never processed, so this structural boundary is strict; simulation later verifies claims.
    if (inputs.length && inputs[inputs.length - 1].tick >= durationTicks) {
      throw new RangeError("Replay input tick must be strictly less than final duration");
    }

    // Direct object callers must obey the same canonical tree contract as parsed JSON. This runs
    // only after every field-specific count/depth bound above, so malformed graphs cannot bypass
    // replay resource ceilings before canonical validation.
    ABI.canonicalEncode(envelope);

    const normalized = {
      formatVersion: formatVersion,
      rulesetHash: rulesetHash,
      eventSchemaVersion: eventSchemaVersion,
      missionId: missionId,
      difficultyId: difficultyId,
      assist: assist,
      seed: seed,
      loadoutIds: loadoutIds,
      loadoutSlotCap: loadoutSlotCap,
      campaignModifierIds: campaignModifierIds,
      accessGrantIds: accessGrantIds,
      tutorialUpgradeGateMode: tutorialUpgradeGateMode,
      inputs: inputs,
      checkpoints: checkpoints,
      finalClaim: {
        outcome: outcome,
        score: score,
        laurels: laurels,
        durationTicks: durationTicks,
        finalStateHash: claimedHash,
      },
    };
    deepFreeze(normalized);
    const byteLength = ABI.canonicalBytes(normalized).length;
    if (byteLength > limits.maxUtf8Bytes) {
      throw new RangeError("Canonical replay envelope exceeds the UTF-8 byte limit");
    }
    return normalized;
  }

  function parseReplayEnvelope(source, limitOverrides) {
    const limits = createReplayLimits(limitOverrides);
    const parsed = parseStrictJson(sourceText(source, limits), limits);
    return normalizeReplayEnvelope(parsed, limits);
  }

  function normalizedEnvelope(value, limits) {
    return typeof value === "string" || isUint8Bytes(value)
      ? parseReplayEnvelope(value, limits)
      : normalizeReplayEnvelope(value, limits);
  }

  function canonicalEnvelopeString(value, limits) {
    return ABI.canonicalEncode(normalizedEnvelope(value, limits));
  }

  function canonicalEnvelopeBytes(value, limits) {
    const encoded = canonicalEnvelopeString(value, limits);
    const bytes = ABI.utf8Bytes(encoded);
    return new Uint8Array(bytes);
  }

  function diagnosticStateHash(state) {
    return "fnv1a32:" + ABI.fnv1a32Hex(ABI.canonicalBytes(state));
  }

  function finalStateHash(state) {
    return ABI.sha256Hex(ABI.canonicalBytes(state));
  }

  function createBoundSimulator(input) {
    exactFields(input, ["content", "release"], "Replay binding input", DEFAULT_LIMITS.maxObjectFields);
    return ReplayRunner.createBoundSimulator({
      content: dataValue(input, "content", "Replay binding input"),
      normalizeReplayEnvelope: normalizeReplayEnvelope,
      release: dataValue(input, "release", "Replay binding input"),
    });
  }

  return Object.freeze({
    FORMAT_VERSION: FORMAT_VERSION,
    EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
    COMMAND_SCHEMA_VERSION: COMMAND_SCHEMA_VERSION,
    DEFAULT_LIMITS: DEFAULT_LIMITS,
    createReplayLimits: createReplayLimits,
    parseReplayEnvelope: parseReplayEnvelope,
    normalizeReplayEnvelope: normalizeReplayEnvelope,
    canonicalEnvelopeString: canonicalEnvelopeString,
    canonicalEnvelopeBytes: canonicalEnvelopeBytes,
    diagnosticStateHash: diagnosticStateHash,
    finalStateHash: finalStateHash,
    createBoundSimulator: createBoundSimulator,
  });
});

  /* source replay-v2.js bytes=31365 sha256=bb5218fea40ad717268bd6f288cff0635d57c5e63c03ffde5a73216c825e013d */
/* Armara Aegis deterministic replay envelope v2.
   Extends the immutable v1 header without changing historical replay parsing. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisSimV2) throw new Error("Game.AegisSimV2 must be installed before replay-v2.js");
  if (!game.AegisCommandsV2) throw new Error("Game.AegisCommandsV2 must be installed before replay-v2.js");
  if (!game.AegisReplay) throw new Error("Game.AegisReplay must be installed before replay-v2.js");
  const api = factory(
    game.AegisSimV2,
    game.AegisCommandsV2,
    game.AegisReplay
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisReplayV2")) {
    if (game.AegisReplayV2 !== api) throw new Error("Game.AegisReplayV2 is already installed");
    return;
  }
  Object.defineProperty(game, "AegisReplayV2", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (
  ABI,
  CommandsV2,
  ReplayV1
) {
  "use strict";

  const AUTHENTICATED_ABI_V2_SHA256 =
    "5f02c369c5331f65196090e00cdf09a7aa4458376f35057c0b5750202a0ea76b";
  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR) ||
      ABI.DESCRIPTOR.version !== 2 || ABI.DESCRIPTOR_SHA256 !== AUTHENTICATED_ABI_V2_SHA256 ||
      ABI.EVENT_SCHEMA_VERSION !== 2 || ABI.BEHAVIOR_REGISTRY_VERSION !== 2) {
    throw new TypeError("The authenticated frozen Aegis simulation ABI v2 is required");
  }
  if (!CommandsV2 || !Object.isFrozen(CommandsV2) || CommandsV2.COMMAND_SCHEMA_VERSION !== 2 ||
      CommandsV2.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis command-v2 API is required");
  }
  if (!ReplayV1 || !Object.isFrozen(ReplayV1) || ReplayV1.FORMAT_VERSION !== 1 ||
      typeof ReplayV1.normalizeReplayEnvelope !== "function") {
    throw new TypeError("A frozen Aegis replay-v1 API is required");
  }

  const FORMAT_VERSION = 2;
  const EVENT_SCHEMA_VERSION = 2;
  const COMMAND_SCHEMA_VERSION = 2;
  const STABLE_ID = /^[a-z][a-z0-9._:-]*$/;
  const TOP_LEVEL_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode", "protocolLoadout", "protocolSlotCap",
    "protocolAuthority", "missionProtocolLoan", "relicIds", "relicSlotCap", "reinforcementId",
    "specializationAccessIds", "inputs", "checkpoints", "finalClaim",
  ]);
  const PROTOCOL_LOADOUT_FIELDS = Object.freeze(["slot", "protocolId", "tier"]);
  const PROTOCOL_AUTHORITY_FIELDS = Object.freeze(["protocolId", "availableTier"]);
  const PROTOCOL_LOAN_FIELDS = Object.freeze(["protocolId", "tier"]);
  const BASE_LIMIT_KEYS = Object.freeze(Object.keys(ReplayV1.DEFAULT_LIMITS));
  const DEFAULT_LIMITS = Object.freeze(Object.assign({}, ReplayV1.DEFAULT_LIMITS, {
    maxProtocolLoadout: 2,
    maxProtocolAuthority: 64,
    maxRelicIds: 2,
    maxSpecializationAccessIds: 30,
  }));
  const LIMIT_KEYS = Object.freeze(Object.keys(DEFAULT_LIMITS).sort());

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function dataNames(value, label) {
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    names.forEach(function (name) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
    });
    return names;
  }

  function dataValue(value, key, label) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(label + "." + key + " must be an enumerable data property");
    }
    return descriptor.value;
  }

  function exactFields(value, expected, label, maximum) {
    if (!isPlainObject(value)) throw new TypeError(label + " must be a plain object");
    const actual = dataNames(value, label).sort();
    const wanted = expected.slice().sort();
    if (actual.length > maximum) throw new RangeError(label + " exceeds the object field limit");
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function wellFormedString(value, label, maximum) {
    if (typeof value !== "string") throw new TypeError(label + " must be a string");
    if (value.length > maximum) throw new RangeError(label + " exceeds the string length limit");
    for (let index = 0; index < value.length; index++) {
      const unit = value.charCodeAt(index);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) {
          throw new TypeError(label + " contains a lone Unicode surrogate");
        }
        index++;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) {
        throw new TypeError(label + " contains a lone Unicode surrogate");
      }
    }
    return value;
  }

  function stableId(value, label, limits) {
    wellFormedString(value, label, limits.maxStringLength);
    if (!STABLE_ID.test(value)) throw new TypeError(label + " must be a stable ASCII ID");
    return value;
  }

  function safeInteger(value, label, minimum, maximum) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(label + " must be a safe integer without negative zero");
    }
    if (value < minimum || value > maximum) {
      throw new RangeError(label + " must be between " + minimum + " and " + maximum);
    }
    return value;
  }

  function exactInteger(value, expected, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0) || value !== expected) {
      throw new RangeError(label + " must be " + expected);
    }
    return value;
  }

  function arrayValues(value, label, maximum) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(label + " must be a plain array");
    }
    if (value.length > maximum) throw new RangeError(label + " exceeds its array length limit");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    const output = new Array(value.length);
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must be a dense array of enumerable data properties");
      }
      output[index] = descriptor.value;
    }
    names.forEach(function (name) {
      if (name === "length") return;
      if (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= value.length) {
        throw new TypeError(label + " cannot contain extra properties");
      }
    });
    return output;
  }

  function createReplayLimits(overrides) {
    if (overrides === undefined) return DEFAULT_LIMITS;
    if (!isPlainObject(overrides)) throw new TypeError("Replay-v2 limits must be a plain object");
    const names = dataNames(overrides, "Replay-v2 limits").sort();
    names.forEach(function (name) {
      if (LIMIT_KEYS.indexOf(name) === -1) throw new TypeError("Unknown replay-v2 limit " + name);
    });
    const output = {};
    LIMIT_KEYS.forEach(function (name) {
      const supplied = Object.prototype.hasOwnProperty.call(overrides, name)
        ? dataValue(overrides, name, "Replay-v2 limits")
        : DEFAULT_LIMITS[name];
      if (!Number.isSafeInteger(supplied) || Object.is(supplied, -0) || supplied < 0) {
        throw new RangeError("Replay-v2 limit " + name + " must be a nonnegative safe integer");
      }
      if (supplied > DEFAULT_LIMITS[name]) {
        throw new RangeError("Replay-v2 limit " + name + " cannot relax the default limit");
      }
      output[name] = supplied;
    });
    return Object.freeze(output);
  }

  function cloneDataGraph(value, limits) {
    const seen = new WeakSet();
    let objectNodes = 0;
    const maximumArray = Math.max(
      limits.maxArrayLength,
      limits.maxTotalCommands,
      limits.maxCheckpoints,
      limits.maxLoadoutIds,
      limits.maxCampaignModifierIds,
      limits.maxAccessGrantIds,
      limits.maxProtocolLoadout,
      limits.maxProtocolAuthority,
      limits.maxRelicIds,
      limits.maxSpecializationAccessIds
    );
    const maximumNodes = 256 + (limits.maxTotalCommands * 3);

    function clone(valueAtPath, path, depth) {
      if (valueAtPath === null || typeof valueAtPath === "boolean") return valueAtPath;
      if (typeof valueAtPath === "number") {
        if (!Number.isSafeInteger(valueAtPath) || Object.is(valueAtPath, -0)) {
          throw new TypeError(path + " numbers must be safe integers without negative zero");
        }
        return valueAtPath;
      }
      if (typeof valueAtPath === "string") {
        return wellFormedString(valueAtPath, path, limits.maxStringLength);
      }
      if (!valueAtPath || typeof valueAtPath !== "object") {
        throw new TypeError(path + " contains unsupported non-JSON data");
      }
      if (depth > limits.maxNestingDepth) throw new RangeError(path + " exceeds the nesting depth limit");
      if (seen.has(valueAtPath)) throw new TypeError(path + " contains a cycle or shared reference");
      seen.add(valueAtPath);
      objectNodes++;
      if (objectNodes > maximumNodes) throw new RangeError("Replay-v2 object graph exceeds its node limit");

      if (Array.isArray(valueAtPath)) {
        return arrayValues(valueAtPath, path, maximumArray).map(function (entry, index) {
          return clone(entry, path + "[" + index + "]", depth + 1);
        });
      }
      if (!isPlainObject(valueAtPath)) throw new TypeError(path + " must contain plain data objects");
      const names = dataNames(valueAtPath, path);
      if (names.length > limits.maxObjectFields) throw new RangeError(path + " exceeds the object field limit");
      const output = Object.create(null);
      names.forEach(function (name) {
        wellFormedString(name, path + " object key", limits.maxStringLength);
        if (!/^[\x00-\x7f]*$/.test(name)) throw new TypeError(path + " object keys must be ASCII");
        Object.defineProperty(output, name, {
          value: clone(dataValue(valueAtPath, name, path), path + "." + name, depth + 1),
          writable: true,
          configurable: true,
          enumerable: true,
        });
      });
      return output;
    }

    return clone(value, "Replay-v2 envelope", 0);
  }

  function orderedIdArray(value, label, maximum, limits) {
    const source = arrayValues(value, label, maximum);
    const output = [];
    let previous = null;
    source.forEach(function (entry, index) {
      const id = stableId(entry, label + "[" + index + "]", limits);
      if (previous !== null && id <= previous) {
        throw new TypeError(label + " must contain unique IDs in strict ASCII order");
      }
      previous = id;
      output.push(id);
    });
    return output;
  }

  function normalizeProtocolAuthority(value, limits) {
    const source = arrayValues(value, "Protocol authority", limits.maxProtocolAuthority);
    let previous = null;
    return source.map(function (record, index) {
      exactFields(record, PROTOCOL_AUTHORITY_FIELDS, "Protocol authority entry " + index, limits.maxObjectFields);
      const protocolId = stableId(
        dataValue(record, "protocolId", "Protocol authority entry"),
        "Protocol authority protocolId",
        limits
      );
      if (previous !== null && protocolId <= previous) {
        throw new TypeError("Protocol authority must contain unique Protocol IDs in strict ASCII order");
      }
      previous = protocolId;
      return {
        protocolId: protocolId,
        availableTier: safeInteger(
          dataValue(record, "availableTier", "Protocol authority entry"),
          "Protocol available tier", 1, 3
        ),
      };
    });
  }

  function normalizeProtocolLoadout(value, slotCap, authority, limits) {
    const source = arrayValues(value, "Protocol loadout", limits.maxProtocolLoadout);
    if (source.length > slotCap) throw new RangeError("Protocol loadout exceeds its Protocol slot cap");
    const ids = new Set();
    let previousSlot = -1;
    return source.map(function (record, index) {
      exactFields(record, PROTOCOL_LOADOUT_FIELDS, "Protocol loadout entry " + index, limits.maxObjectFields);
      const slot = safeInteger(dataValue(record, "slot", "Protocol loadout entry"), "Protocol slot", 0, 1);
      if (slot >= slotCap) throw new RangeError("Protocol loadout entry exceeds its Protocol slot cap");
      if (slot <= previousSlot) throw new TypeError("Protocol slots must be unique and in strict slot order");
      previousSlot = slot;
      const protocolId = stableId(
        dataValue(record, "protocolId", "Protocol loadout entry"),
        "Protocol loadout protocolId",
        limits
      );
      if (ids.has(protocolId)) throw new TypeError("Protocol loadout must contain unique Protocol IDs");
      ids.add(protocolId);
      const tier = safeInteger(dataValue(record, "tier", "Protocol loadout entry"), "Protocol tier", 1, 3);
      const owned = authority.get(protocolId);
      if (owned === undefined) throw new TypeError("Equipped Protocol requires permanent Protocol authority");
      if (tier > owned) throw new RangeError("Equipped Protocol tier exceeds its available tier");
      return {
        slot: slot,
        protocolId: protocolId,
        tier: tier,
      };
    });
  }

  function normalizeProtocolLoan(value, equippedIds, limits) {
    if (value === null) return null;
    exactFields(value, PROTOCOL_LOAN_FIELDS, "Mission Protocol loan", limits.maxObjectFields);
    const protocolId = stableId(
      dataValue(value, "protocolId", "Mission Protocol loan"),
      "Mission Protocol loan protocolId",
      limits
    );
    if (equippedIds.has(protocolId)) {
      throw new TypeError("Mission Protocol loan cannot duplicate an equipped Protocol");
    }
    return {
      protocolId: protocolId,
      tier: safeInteger(dataValue(value, "tier", "Mission Protocol loan"), "Mission Protocol loan tier", 1, 1),
    };
  }

  function v1Limits(limits) {
    const output = {};
    BASE_LIMIT_KEYS.forEach(function (key) { output[key] = limits[key]; });
    return output;
  }

  function normalizeReplayEnvelope(envelope, limitOverrides) {
    const limits = createReplayLimits(limitOverrides);
    const source = cloneDataGraph(envelope, limits);
    exactFields(source, TOP_LEVEL_FIELDS, "Replay-v2 envelope", limits.maxObjectFields);
    if (limits.maxNestingDepth < 3) throw new RangeError("Replay-v2 envelope exceeds the nesting depth limit");

    exactInteger(dataValue(source, "formatVersion", "Replay-v2 envelope"), FORMAT_VERSION, "Replay format version");
    exactInteger(
      dataValue(source, "eventSchemaVersion", "Replay-v2 envelope"),
      EVENT_SCHEMA_VERSION,
      "Replay event schema version"
    );

    const base = ReplayV1.normalizeReplayEnvelope({
      formatVersion: 1,
      rulesetHash: dataValue(source, "rulesetHash", "Replay-v2 envelope"),
      eventSchemaVersion: 1,
      missionId: dataValue(source, "missionId", "Replay-v2 envelope"),
      difficultyId: dataValue(source, "difficultyId", "Replay-v2 envelope"),
      assist: dataValue(source, "assist", "Replay-v2 envelope"),
      seed: dataValue(source, "seed", "Replay-v2 envelope"),
      loadoutIds: dataValue(source, "loadoutIds", "Replay-v2 envelope"),
      loadoutSlotCap: dataValue(source, "loadoutSlotCap", "Replay-v2 envelope"),
      campaignModifierIds: dataValue(source, "campaignModifierIds", "Replay-v2 envelope"),
      accessGrantIds: dataValue(source, "accessGrantIds", "Replay-v2 envelope"),
      tutorialUpgradeGateMode: dataValue(source, "tutorialUpgradeGateMode", "Replay-v2 envelope"),
      inputs: [],
      checkpoints: dataValue(source, "checkpoints", "Replay-v2 envelope"),
      finalClaim: dataValue(source, "finalClaim", "Replay-v2 envelope"),
    }, v1Limits(limits));

    const protocolSlotCap = safeInteger(
      dataValue(source, "protocolSlotCap", "Replay-v2 envelope"),
      "Protocol slot cap",
      0,
      limits.maxProtocolLoadout
    );
    const protocolAuthority = normalizeProtocolAuthority(
      dataValue(source, "protocolAuthority", "Replay-v2 envelope"), limits
    );
    const authority = new Map(protocolAuthority.map(function (entry) {
      return [entry.protocolId, entry.availableTier];
    }));
    const protocolLoadout = normalizeProtocolLoadout(
      dataValue(source, "protocolLoadout", "Replay-v2 envelope"),
      protocolSlotCap,
      authority,
      limits
    );
    const equippedIds = new Set(protocolLoadout.map(function (entry) { return entry.protocolId; }));
    const missionProtocolLoan = normalizeProtocolLoan(
      dataValue(source, "missionProtocolLoan", "Replay-v2 envelope"),
      equippedIds,
      limits
    );
    const relicSlotCap = safeInteger(
      dataValue(source, "relicSlotCap", "Replay-v2 envelope"),
      "Relic slot cap",
      0,
      limits.maxRelicIds
    );
    const relicIds = orderedIdArray(
      dataValue(source, "relicIds", "Replay-v2 envelope"),
      "Relic IDs",
      limits.maxRelicIds,
      limits
    );
    if (relicIds.length > relicSlotCap) throw new RangeError("Relic IDs exceed the Relic slot cap");
    const reinforcementValue = dataValue(source, "reinforcementId", "Replay-v2 envelope");
    const reinforcementId = reinforcementValue === null
      ? null
      : stableId(reinforcementValue, "Reinforcement ID", limits);
    const specializationAccessIds = orderedIdArray(
      dataValue(source, "specializationAccessIds", "Replay-v2 envelope"),
      "Specialization access IDs",
      limits.maxSpecializationAccessIds,
      limits
    );

    const inputs = CommandsV2.normalizeCommandSequence(
      dataValue(source, "inputs", "Replay-v2 envelope"),
      {
        maxTick: limits.maxTick,
        maxTotalCommands: limits.maxTotalCommands,
        maxCommandsPerTick: limits.maxCommandsPerTick,
      }
    );
    if (inputs.length && inputs[inputs.length - 1].tick >= base.finalClaim.durationTicks) {
      throw new RangeError("Replay input tick must be strictly less than final duration");
    }

    const normalized = {
      formatVersion: FORMAT_VERSION,
      rulesetHash: base.rulesetHash,
      eventSchemaVersion: EVENT_SCHEMA_VERSION,
      missionId: base.missionId,
      difficultyId: base.difficultyId,
      assist: base.assist,
      seed: base.seed,
      loadoutIds: base.loadoutIds.slice(),
      loadoutSlotCap: base.loadoutSlotCap,
      campaignModifierIds: base.campaignModifierIds.slice(),
      accessGrantIds: base.accessGrantIds.slice(),
      tutorialUpgradeGateMode: base.tutorialUpgradeGateMode,
      protocolLoadout: protocolLoadout,
      protocolSlotCap: protocolSlotCap,
      protocolAuthority: protocolAuthority,
      missionProtocolLoan: missionProtocolLoan,
      relicIds: relicIds,
      relicSlotCap: relicSlotCap,
      reinforcementId: reinforcementId,
      specializationAccessIds: specializationAccessIds,
      inputs: inputs.slice(),
      checkpoints: base.checkpoints.map(function (checkpoint) {
        return { tick: checkpoint.tick, diagnosticHash: checkpoint.diagnosticHash };
      }),
      finalClaim: {
        outcome: base.finalClaim.outcome,
        score: base.finalClaim.score,
        laurels: base.finalClaim.laurels,
        durationTicks: base.finalClaim.durationTicks,
        finalStateHash: base.finalClaim.finalStateHash,
      },
    };
    deepFreeze(normalized);
    if (ABI.canonicalBytes(normalized).length > limits.maxUtf8Bytes) {
      throw new RangeError("Canonical replay-v2 envelope exceeds the UTF-8 byte limit");
    }
    return normalized;
  }

  function decodeUtf8Strict(bytes) {
    let output = "";
    for (let index = 0; index < bytes.length;) {
      const first = bytes[index++];
      let point;
      let second;
      let third;
      let fourth;
      if (first <= 0x7f) {
        point = first;
      } else if (first >= 0xc2 && first <= 0xdf) {
        if (index >= bytes.length) throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        second = bytes[index++];
        if ((second & 0xc0) !== 0x80) throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        point = ((first & 0x1f) << 6) | (second & 0x3f);
      } else if (first >= 0xe0 && first <= 0xef) {
        if (index + 1 >= bytes.length) throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        second = bytes[index++];
        third = bytes[index++];
        if ((second & 0xc0) !== 0x80 || (third & 0xc0) !== 0x80 ||
            (first === 0xe0 && second < 0xa0) || (first === 0xed && second >= 0xa0)) {
          throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        }
        point = ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
      } else if (first >= 0xf0 && first <= 0xf4) {
        if (index + 2 >= bytes.length) throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        second = bytes[index++];
        third = bytes[index++];
        fourth = bytes[index++];
        if ((second & 0xc0) !== 0x80 || (third & 0xc0) !== 0x80 || (fourth & 0xc0) !== 0x80 ||
            (first === 0xf0 && second < 0x90) || (first === 0xf4 && second >= 0x90)) {
          throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        }
        point = ((first & 7) << 18) | ((second & 63) << 12) | ((third & 63) << 6) | (fourth & 63);
      } else {
        throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
      }
      if (point <= 0xffff) {
        output += String.fromCharCode(point);
      } else {
        const adjusted = point - 0x10000;
        output += String.fromCharCode(0xd800 + (adjusted >>> 10), 0xdc00 + (adjusted & 0x3ff));
      }
    }
    return output;
  }

  function sourceText(source, limits) {
    if (typeof source === "string") {
      if (source.charCodeAt(0) === 0xfeff) throw new TypeError("Replay-v2 JSON must not contain a BOM");
      wellFormedString(source, "Replay-v2 JSON", Number.MAX_SAFE_INTEGER);
      if (source.length > limits.maxUtf8Bytes || ABI.utf8Bytes(source).length > limits.maxUtf8Bytes) {
        throw new RangeError("Replay-v2 JSON exceeds the UTF-8 byte limit");
      }
      return source;
    }
    const isBytes = Boolean(source && typeof ArrayBuffer !== "undefined" &&
      typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(source) &&
      Object.prototype.toString.call(source) === "[object Uint8Array]");
    if (!isBytes) throw new TypeError("Replay-v2 source must be a string or Uint8Array");
    if (source.length > limits.maxUtf8Bytes) throw new RangeError("Replay-v2 JSON exceeds the UTF-8 byte limit");
    const bytes = new Uint8Array(source.length);
    for (let index = 0; index < source.length; index++) bytes[index] = source[index];
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      throw new TypeError("Replay-v2 JSON must not contain a BOM");
    }
    return decodeUtf8Strict(bytes);
  }

  function parseStrictJson(text, limits) {
    let position = 0;
    const arrayLimit = Math.max(
      limits.maxArrayLength,
      limits.maxTotalCommands,
      limits.maxCheckpoints,
      limits.maxLoadoutIds,
      limits.maxCampaignModifierIds,
      limits.maxAccessGrantIds,
      limits.maxSpecializationAccessIds
    );

    function fail(message) {
      throw new SyntaxError("Invalid replay-v2 JSON at character " + position + ": " + message);
    }
    function whitespace() {
      while (position < text.length && /[ \t\r\n]/.test(text.charAt(position))) position++;
    }
    function stringValue() {
      if (text.charCodeAt(position) !== 0x22) fail("expected string");
      position++;
      let output = "";
      while (position < text.length) {
        const unit = text.charCodeAt(position++);
        if (unit === 0x22) {
          wellFormedString(output, "Replay-v2 JSON string", limits.maxStringLength);
          return output;
        }
        if (unit <= 0x1f) fail("unescaped control character in string");
        if (unit !== 0x5c) {
          output += String.fromCharCode(unit);
        } else {
          if (position >= text.length) fail("unterminated escape");
          const escaped = text.charAt(position++);
          const simple = { '"': '"', "\\": "\\", "/": "/", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t" };
          if (Object.prototype.hasOwnProperty.call(simple, escaped)) {
            output += simple[escaped];
          } else if (escaped === "u") {
            if (position + 4 > text.length) fail("short Unicode escape");
            const digits = text.slice(position, position + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail("invalid Unicode escape");
            output += String.fromCharCode(parseInt(digits, 16));
            position += 4;
          } else {
            fail("invalid string escape");
          }
        }
        if (output.length > limits.maxStringLength) {
          throw new RangeError("Replay-v2 JSON string exceeds the string length limit");
        }
      }
      fail("unterminated string");
    }
    function numberValue() {
      const start = position;
      if (text.charCodeAt(position) === 0x2d) position++;
      if (text.charCodeAt(position) === 0x30) {
        position++;
      } else {
        const first = text.charCodeAt(position);
        if (first < 0x31 || first > 0x39) fail("invalid number");
        while (position < text.length && text.charCodeAt(position) >= 0x30 &&
               text.charCodeAt(position) <= 0x39) position++;
      }
      if (/[.eE]/.test(text.charAt(position))) fail("numbers must be integers");
      const output = Number(text.slice(start, position));
      if (!Number.isSafeInteger(output)) fail("number must be a safe integer");
      if (Object.is(output, -0)) fail("negative zero is not canonical");
      return output;
    }
    function arrayValue(depth) {
      position++;
      const output = [];
      whitespace();
      if (text.charCodeAt(position) === 0x5d) { position++; return output; }
      while (position < text.length) {
        if (output.length >= arrayLimit) throw new RangeError("Replay-v2 JSON array exceeds its limit");
        output.push(value(depth + 1));
        whitespace();
        const unit = text.charCodeAt(position++);
        if (unit === 0x5d) return output;
        if (unit !== 0x2c) fail("expected comma or closing bracket");
        whitespace();
      }
      fail("unterminated array");
    }
    function objectValue(depth) {
      position++;
      const output = Object.create(null);
      const keys = Object.create(null);
      let fields = 0;
      whitespace();
      if (text.charCodeAt(position) === 0x7d) { position++; return output; }
      while (position < text.length) {
        if (fields >= limits.maxObjectFields) throw new RangeError("Replay-v2 JSON object exceeds its field limit");
        if (text.charCodeAt(position) !== 0x22) fail("expected object key");
        const key = stringValue();
        if (Object.prototype.hasOwnProperty.call(keys, key)) fail("duplicate object key " + key);
        keys[key] = true;
        whitespace();
        if (text.charCodeAt(position++) !== 0x3a) fail("expected colon");
        whitespace();
        Object.defineProperty(output, key, {
          value: value(depth + 1), writable: true, configurable: true, enumerable: true,
        });
        fields++;
        whitespace();
        const unit = text.charCodeAt(position++);
        if (unit === 0x7d) return output;
        if (unit !== 0x2c) fail("expected comma or closing brace");
        whitespace();
      }
      fail("unterminated object");
    }
    function value(depth) {
      if (depth > limits.maxNestingDepth) throw new RangeError("Replay-v2 JSON exceeds the nesting depth limit");
      whitespace();
      const unit = text.charCodeAt(position);
      if (unit === 0x22) return stringValue();
      if (unit === 0x7b) return objectValue(depth);
      if (unit === 0x5b) return arrayValue(depth);
      if (unit === 0x2d || (unit >= 0x30 && unit <= 0x39)) return numberValue();
      if (text.slice(position, position + 4) === "true") { position += 4; return true; }
      if (text.slice(position, position + 5) === "false") { position += 5; return false; }
      if (text.slice(position, position + 4) === "null") { position += 4; return null; }
      fail("unexpected token");
    }

    whitespace();
    const output = value(0);
    whitespace();
    if (position !== text.length) fail("trailing data");
    return output;
  }

  function parseReplayEnvelope(source, limitOverrides) {
    const limits = createReplayLimits(limitOverrides);
    return normalizeReplayEnvelope(parseStrictJson(sourceText(source, limits), limits), limits);
  }

  function normalizedEnvelope(value, limits) {
    return typeof value === "string" || (value && typeof ArrayBuffer !== "undefined" &&
      typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(value))
      ? parseReplayEnvelope(value, limits)
      : normalizeReplayEnvelope(value, limits);
  }

  function canonicalEnvelopeString(value, limits) {
    return ABI.canonicalEncode(normalizedEnvelope(value, limits));
  }

  function canonicalEnvelopeBytes(value, limits) {
    return new Uint8Array(ABI.utf8Bytes(canonicalEnvelopeString(value, limits)));
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    FORMAT_VERSION: FORMAT_VERSION,
    EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
    COMMAND_SCHEMA_VERSION: COMMAND_SCHEMA_VERSION,
    DEFAULT_LIMITS: DEFAULT_LIMITS,
    createReplayLimits: createReplayLimits,
    parseReplayEnvelope: parseReplayEnvelope,
    normalizeReplayEnvelope: normalizeReplayEnvelope,
    canonicalEnvelopeString: canonicalEnvelopeString,
    canonicalEnvelopeBytes: canonicalEnvelopeBytes,
    diagnosticStateHash: ReplayV1.diagnosticStateHash,
    finalStateHash: ReplayV1.finalStateHash,
  });
});

  /* source replay-formats.js bytes=3096 sha256=1162b7eb5c9b00caf6e82291c157332b240c2c9665249f76678c11f65fbd0e80 */
/* Armara Aegis explicit replay-format registry.
   Callers declare the format; the registry never guesses from optional fields. */
(function (root, factory) {
  "use strict";


  const game = root.Game;
  if (!game || !game.AegisReplay) throw new Error("Game.AegisReplay must be installed before replay-formats.js");
  if (!game.AegisReplayV2) throw new Error("Game.AegisReplayV2 must be installed before replay-formats.js");
  const api = factory(game.AegisReplay, game.AegisReplayV2);
  if (Object.prototype.hasOwnProperty.call(game, "AegisReplayFormats")) {
    if (game.AegisReplayFormats !== api) throw new Error("Game.AegisReplayFormats is already installed");
    return;
  }
  Object.defineProperty(game, "AegisReplayFormats", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(BUNDLE_ROOT, function (ReplayV1, ReplayV2) {
  "use strict";

  if (!ReplayV1 || !Object.isFrozen(ReplayV1) || ReplayV1.FORMAT_VERSION !== 1) {
    throw new TypeError("A frozen replay-v1 API is required");
  }
  if (!ReplayV2 || !Object.isFrozen(ReplayV2) || ReplayV2.FORMAT_VERSION !== 2) {
    throw new TypeError("A frozen replay-v2 API is required");
  }
  [ReplayV1, ReplayV2].forEach(function (api, index) {
    ["normalizeReplayEnvelope", "parseReplayEnvelope", "canonicalEnvelopeString", "canonicalEnvelopeBytes"]
      .forEach(function (name) {
        if (typeof api[name] !== "function") {
          throw new TypeError("Replay-v" + (index + 1) + " API is missing " + name);
        }
      });
  });

  const FORMAT_VERSIONS = Object.freeze([1, 2]);

  function getReplayApi(formatVersion) {
    if (!Number.isSafeInteger(formatVersion) || Object.is(formatVersion, -0)) {
      throw new TypeError("Declared replay format version must be a safe integer");
    }
    if (formatVersion === 1) return ReplayV1;
    if (formatVersion === 2) return ReplayV2;
    throw new RangeError("Unsupported declared replay format version " + formatVersion);
  }

  function normalizeReplayEnvelope(formatVersion, value, limits) {
    return getReplayApi(formatVersion).normalizeReplayEnvelope(value, limits);
  }

  function parseReplayEnvelope(formatVersion, source, limits) {
    return getReplayApi(formatVersion).parseReplayEnvelope(source, limits);
  }

  function canonicalEnvelopeString(formatVersion, value, limits) {
    return getReplayApi(formatVersion).canonicalEnvelopeString(value, limits);
  }

  function canonicalEnvelopeBytes(formatVersion, value, limits) {
    return getReplayApi(formatVersion).canonicalEnvelopeBytes(value, limits);
  }

  return Object.freeze({
    FORMAT_VERSIONS: FORMAT_VERSIONS,
    getReplayApi: getReplayApi,
    normalizeReplayEnvelope: normalizeReplayEnvelope,
    parseReplayEnvelope: parseReplayEnvelope,
    canonicalEnvelopeString: canonicalEnvelopeString,
    canonicalEnvelopeBytes: canonicalEnvelopeBytes,
  });
});

  const game = BUNDLE_ROOT.Game;
  if (
    !game ||
    !game.AegisSim ||
    !game.AegisGeometry ||
    !game.AegisTimers ||
    !game.AegisEconomy ||
    !game.AegisMovement ||
    !game.AegisEffects ||
    !game.AegisTargeting ||
    !game.AegisBehaviors ||
    !game.AegisCommands ||
    !game.AegisSimV2 ||
    !game.AegisCommandsV2 ||
    !game.AegisProtocols ||
    !game.AegisRelics ||
    !game.AegisManagement ||
    !game.AegisObjectives ||
    !game.AegisKernel ||
    !game.AegisReplayRunner ||
    !game.AegisReplay ||
    !game.AegisReplayV2 ||
    !game.AegisReplayFormats
  ) {
    throw new Error("Aegis simulation bundle did not install every declared module");
  }
  if (HAS_COMMON_JS) {
    const commonJsApi = {};
    Object.keys(game.AegisSim).forEach(function (key) { commonJsApi[key] = game.AegisSim[key]; });
    commonJsApi.AegisSim = game.AegisSim;
    commonJsApi.AegisGeometry = game.AegisGeometry;
    commonJsApi.AegisTimers = game.AegisTimers;
    commonJsApi.AegisEconomy = game.AegisEconomy;
    commonJsApi.AegisMovement = game.AegisMovement;
    commonJsApi.AegisEffects = game.AegisEffects;
    commonJsApi.AegisTargeting = game.AegisTargeting;
    commonJsApi.AegisBehaviors = game.AegisBehaviors;
    commonJsApi.AegisCommands = game.AegisCommands;
    commonJsApi.AegisSimV2 = game.AegisSimV2;
    commonJsApi.AegisCommandsV2 = game.AegisCommandsV2;
    commonJsApi.AegisProtocols = game.AegisProtocols;
    commonJsApi.AegisRelics = game.AegisRelics;
    commonJsApi.AegisManagement = game.AegisManagement;
    commonJsApi.AegisObjectives = game.AegisObjectives;
    commonJsApi.AegisKernel = game.AegisKernel;
    commonJsApi.AegisReplayRunner = game.AegisReplayRunner;
    commonJsApi.AegisReplay = game.AegisReplay;
    commonJsApi.AegisReplayV2 = game.AegisReplayV2;
    commonJsApi.AegisReplayFormats = game.AegisReplayFormats;
    module.exports = Object.freeze(commonJsApi);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
