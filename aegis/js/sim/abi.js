/* Armara Aegis deterministic simulation ABI v1.
   Pure exact-integer helpers shared by source tests and future generated simulation artifacts.
   This file intentionally has no dependency on the DOM, network, storage, or GameSlopKit. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }

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
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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
