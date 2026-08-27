/* Generated Armara Aegis deterministic simulation bundle.
   Exact source hashes bind ABI and named deterministic modules in declared order. */
(function (ROOT) {
  "use strict";
  const HAS_COMMON_JS = typeof module !== "undefined" && !!module.exports;
  const BUNDLE_ROOT = HAS_COMMON_JS ? Object.create(null) : ROOT;

  /* source abi.js bytes=29935 sha256=d26d92e9bfe32b6d617e2d38273a8a87b3a245321dffeec87f9c485b2ce782d4 */
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
      version: 1,
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

  /* source economy.js bytes=5671 sha256=25b125622218b08b4934ad203c3a9741867b2378e21abdbbedc1488449fb68b1 */
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

  function resolveStartAether(
    baseStartAether,
    difficultyAetherBp,
    campaignModifierAether,
    assistAether
  ) {
    nonnegativeInteger(baseStartAether, "Base starting Aether");
    nonnegativeInteger(difficultyAetherBp, "Difficulty Aether basis points");
    nonnegativeInteger(campaignModifierAether, "Campaign modifier Aether");
    nonnegativeInteger(assistAether, "Assist Aether");

    const difficultyStartAether = ABI.checkedMulDivFloor(
      baseStartAether,
      [difficultyAetherBp],
      [BASIS_POINTS]
    );
    const afterCampaignModifierAether = ABI.checkedAdd(
      difficultyStartAether,
      campaignModifierAether
    );
    const startAether = ABI.checkedAdd(afterCampaignModifierAether, assistAether);
    return Object.freeze({
      baseStartAether: baseStartAether,
      difficultyAetherBp: difficultyAetherBp,
      difficultyStartAether: difficultyStartAether,
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

  const game = BUNDLE_ROOT.Game;
  if (!game || !game.AegisSim || !game.AegisGeometry || !game.AegisTimers || !game.AegisEconomy || !game.AegisMovement || !game.AegisEffects || !game.AegisTargeting) {
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
    module.exports = Object.freeze(commonJsApi);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
