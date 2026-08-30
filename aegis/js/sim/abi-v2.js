/* Armara Aegis deterministic simulation ABI v2 identity.
   Additive authenticated contract over the immutable v1 exact-math foundation. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi.js"));
    return;
  }

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
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI_V1) {
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
