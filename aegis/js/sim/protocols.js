/* Armara Aegis pure Divine Protocol legality and payment planning v1.
   This module validates immutable inputs and never mutates simulation state. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi-v2.js"), require("./commands-v2.js"));
    return;
  }

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
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI, CommandsV2) {
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
