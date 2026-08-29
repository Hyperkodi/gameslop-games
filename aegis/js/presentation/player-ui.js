/* Armara Aegis player-facing unlock and command-deck projections.
   Pure presentation only: no DOM, storage, wall clock, command dispatch, or state mutation. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  let game = root.Game;
  if (game === undefined) {
    game = {};
    root.Game = game;
  }
  if (!game || (typeof game !== "object" && typeof game !== "function")) {
    throw new Error("Cannot install Aegis player UI into a non-object Game namespace");
  }
  const existing = game.AegisPlayerUi;
  if (existing !== undefined && existing !== api) {
    throw new Error("Conflicting Game.AegisPlayerUi is already installed");
  }
  if (existing === undefined) {
    Object.defineProperty(game, "AegisPlayerUi", {
      value: api,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const PROTOCOL_SLOT_COUNT = 2;
  // Spec section 4: an unlock mission loans its featured Protocol at Tier 1 and the loan is never upgraded.
  const LOAN_TIER = 1;
  const PRIMARY_TARGET_SIZE_PX = 48;
  const SECONDARY_TARGET_SIZE_PX = 44;
  const BASIS_POINTS = 10000;
  // Mirrors the reducer clamp for Relic cost multipliers: sim/protocols.js
  // MIN_PROTOCOL_COST_MULTIPLIER_BP / MAX_PROTOCOL_COST_MULTIPLIER_BP and the sim/relics.js
  // "protocol-cost" / "specialization-cost" policies (multiply-bp, ceil, 7000..14000). Those
  // constants are module-private there, so they are mirrored here rather than imported.
  const MIN_COST_MULTIPLIER_BP = 7000;
  const MAX_COST_MULTIPLIER_BP = 14000;
  const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
  const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
  // Spec section 12.2: one rebindable printable key per action; chords and browser-reserved keys
  // (Escape, Tab, Enter, Space, F-keys, Ctrl/Alt/Meta combinations) are never accepted.
  const KEY_BINDING = /^[A-Za-z0-9]$/;
  const MISSION_ID = /^m(?:0[1-9]|[1-9][0-9]*)$/;
  // Human phrases for machine-readable status tokens (spec section 15.2: plain player text).
  const RELIC_STATUS_PHRASES = Object.freeze({
    equipped: "Equipped", available: "Available to equip", locked: "Locked",
  });
  const SPECIALIZATION_STATUS_PHRASES = Object.freeze({
    selected: "Selected", pending: "Pending", unavailable: "Unavailable",
    unaffordable: "Not enough Aether", ready: "Ready",
  });
  const CONTROL_TEXT = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;
  const UNSAFE_TEXT = /[<>]/;
  const PHASES = Object.freeze(["planning", "wave", "complete"]);
  const READINESS = Object.freeze([
    "ready", "targeting", "cooldown", "unaffordable", "unavailable", "pending",
  ]);
  const TARGET_KINDS = Object.freeze(["none", "route-point", "tower", "world-vector"]);
  const DATA_LIMITS = Object.freeze({
    maximumDepth: 32,
    maximumNodes: 8192,
    maximumArrayLength: 512,
    maximumObjectFields: 64,
    maximumStringLength: 4096,
  });

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.getOwnPropertyNames(value).forEach(function (key) {
      deepFreeze(value[key], visited);
    });
    return Object.freeze(value);
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  /* Validates the caller's graph and returns a private snapshot of it: every property is read exactly
     once through its own-property descriptor, and the copy uses null-prototype objects and fresh dense
     arrays. Projection code reads only the snapshot, so a Proxy or getter-shaped caller object can
     never present one value to validation and another value to projection. */
  function preflightDataGraph(root, label) {
    const seen = new WeakSet();
    let nodes = 0;
    function visit(value, depth, path) {
      if (typeof value === "string") {
        if (value.length > DATA_LIMITS.maximumStringLength) {
          throw new RangeError(label + " exceeds the string bound at " + path);
        }
        return value;
      }
      if (value === null || typeof value !== "object") return value;
      if (depth > DATA_LIMITS.maximumDepth) throw new RangeError(label + " exceeds the depth bound");
      nodes += 1;
      if (nodes > DATA_LIMITS.maximumNodes) throw new RangeError(label + " exceeds the node bound");
      if (seen.has(value)) throw new TypeError(label + " cannot contain cycles or shared references");
      seen.add(value);
      if (Object.getOwnPropertySymbols(value).length !== 0) {
        throw new TypeError(label + " cannot contain symbol properties");
      }
      const names = Object.getOwnPropertyNames(value);
      if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) {
          throw new TypeError(label + " arrays must be ordinary arrays");
        }
        if (value.length > DATA_LIMITS.maximumArrayLength) throw new RangeError(label + " exceeds the array bound");
        if (names.length !== value.length + 1 || names[names.length - 1] !== "length") {
          throw new TypeError(label + " arrays must be dense and contain no extra properties");
        }
        const arrayCopy = new Array(value.length);
        for (let index = 0; index < value.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
            throw new TypeError(label + " arrays must contain enumerable data elements");
          }
          arrayCopy[index] = visit(descriptor.value, depth + 1, path + "[" + index + "]");
        }
        return arrayCopy;
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(label + " objects must use Object or null prototypes");
      }
      if (names.length > DATA_LIMITS.maximumObjectFields) {
        throw new RangeError(label + " exceeds the object-field bound");
      }
      const objectCopy = Object.create(null);
      names.forEach(function (name) {
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
          throw new TypeError(label + " objects must contain enumerable data properties");
        }
        objectCopy[name] = visit(descriptor.value, depth + 1, path + "/" + name);
      });
      return objectCopy;
    }
    return visit(root, 0, "/");
  }

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactFields(value, fields, label) {
    if (!isPlainObject(value)) throw new TypeError(label + " must be a plain object");
    const expected = fields.slice().sort();
    const actual = Object.keys(value).sort();
    const unknown = actual.find(function (key) { return expected.indexOf(key) === -1; });
    if (unknown) throw new TypeError(label + " has unknown field " + unknown);
    const missing = expected.find(function (key) { return actual.indexOf(key) === -1; });
    if (missing) throw new TypeError(label + " is missing field " + missing);
  }

  function safeInteger(value, minimum, maximum, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(label + " must be a safe integer and not negative zero");
    }
    if (value < minimum || value > maximum) {
      throw new RangeError(label + " must be from " + minimum + " through " + maximum);
    }
    return value;
  }

  function nonnegativeInteger(value, label) {
    return safeInteger(value, 0, Number.MAX_SAFE_INTEGER, label);
  }

  function positiveInteger(value, label) {
    return safeInteger(value, 1, Number.MAX_SAFE_INTEGER, label);
  }

  function booleanValue(value, label) {
    if (typeof value !== "boolean") throw new TypeError(label + " must be boolean");
    return value;
  }

  function enumValue(value, allowed, label) {
    if (allowed.indexOf(value) === -1) {
      throw new RangeError(label + " must be one of " + allowed.join(", "));
    }
    return value;
  }

  function stableId(value, label) {
    if (typeof value !== "string" || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable ASCII ID");
    }
    return value;
  }

  function safeText(value, label, maximum) {
    const limit = maximum || 320;
    if (typeof value !== "string" || value.length < 1 || value.length > limit || value.trim() !== value) {
      throw new TypeError(label + " must be trimmed text from 1 through " + limit + " characters");
    }
    if (CONTROL_TEXT.test(value) || UNSAFE_TEXT.test(value)) {
      throw new TypeError(label + " contains unsafe control or markup characters");
    }
    return value;
  }

  function keyBinding(value, label) {
    if (value === null) return null;
    if (typeof value !== "string" || !KEY_BINDING.test(value)) {
      throw new TypeError(label + " must be a single printable key (A-Z or 0-9); " +
        "chords and browser-reserved keys are not allowed");
    }
    // Upper-case is the canonical key hint, so "q" and "Q" describe the same physical key.
    return value.toUpperCase();
  }

  function distinctBindings(values, label) {
    const used = new Set();
    values.forEach(function (value) {
      if (value === null) return;
      if (used.has(value)) throw new RangeError(label + " cannot contain duplicate key bindings");
      used.add(value);
    });
  }

  function nullableStableId(value, label) {
    return value === null ? null : stableId(value, label);
  }

  function nullablePositiveInteger(value, label) {
    return value === null ? null : positiveInteger(value, label);
  }

  function uniqueIdArray(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    const seen = new Set();
    return value.map(function (entry, index) {
      const id = stableId(entry, label + "[" + index + "]");
      if (seen.has(id)) throw new RangeError(label + " contains duplicate ID " + id);
      seen.add(id);
      return id;
    });
  }

  function checkedAdd(left, right, label) {
    const result = left + right;
    if (!Number.isSafeInteger(result)) throw new RangeError(label + " exceeds the safe integer range");
    return result;
  }

  function ceilProductRatio(left, right, denominator, label) {
    const numeratorBig = BigInt(left) * BigInt(right);
    const denominatorBig = BigInt(denominator);
    const result = (numeratorBig + denominatorBig - 1n) / denominatorBig;
    if (result > MAX_SAFE_BIGINT) throw new RangeError(label + " exceeds the safe integer range");
    return Number(result);
  }

  function remainingTicks(readyTick, tick) {
    return readyTick > tick ? readyTick - tick : 0;
  }

  function wholeSeconds(ticks, ticksPerSecond) {
    return ticks === 0 ? 0 : Math.ceil(ticks / ticksPerSecond);
  }

  function secondsLabel(seconds) {
    return seconds + " " + (seconds === 1 ? "second" : "seconds");
  }

  function collection(value, fields, normalize, label) {
    if (!isPlainObject(value)) throw new TypeError(label + " must be an ASCII-keyed object");
    const result = Object.create(null);
    Object.keys(value).sort().forEach(function (key) {
      stableId(key, label + " key");
      const source = value[key];
      exactFields(source, fields, label + " " + key);
      const record = normalize(source, label + " " + key);
      if (record.id !== key) throw new RangeError(label + " key " + key + " must equal record id");
      result[key] = record;
    });
    return result;
  }

  function nullableMaximum(value, label) {
    return value === null ? null : positiveInteger(value, label);
  }

  function millisecondsToTicks(milliseconds, ticksPerSecond, label) {
    return ceilProductRatio(milliseconds, ticksPerSecond, 1000, label);
  }

  function normalizeProtocolTier(source, expectedTier, label) {
    exactFields(source, [
      "tier", "baseCostAether", "cooldownMs", "durationMs", "maximumAcceptedCasts", "effectText",
    ], label);
    const tier = safeInteger(source.tier, 1, 3, label + " tier");
    if (tier !== expectedTier) throw new RangeError(label + " must use exact tier order");
    return {
      tier: tier,
      baseCostAether: positiveInteger(source.baseCostAether, label + " baseCostAether"),
      cooldownMs: nonnegativeInteger(source.cooldownMs, label + " cooldownMs"),
      durationMs: nonnegativeInteger(source.durationMs, label + " durationMs"),
      maximumAcceptedCasts: nullableMaximum(
        source.maximumAcceptedCasts, label + " maximumAcceptedCasts"
      ),
      effectText: safeText(source.effectText, label + " effectText"),
    };
  }

  function normalizeProtocol(source, label) {
    const protocolId = stableId(source.protocolId, label + " protocolId");
    const targetKind = enumValue(source.targetKind, TARGET_KINDS, label + " targetKind");
    const castPolicyId = enumValue(
      source.castPolicyId, ["repeat-surcharge", "once-per-mission"], label + " castPolicyId"
    );
    if (!Array.isArray(source.tiers) || source.tiers.length !== 3) {
      throw new RangeError(label + " tiers must contain exactly three records");
    }
    const tiers = source.tiers.map(function (tier, index) {
      return normalizeProtocolTier(tier, index + 1, label + " tiers[" + index + "]");
    });
    if (tiers.some(function (tier) {
      return tier.maximumAcceptedCasts !== tiers[0].maximumAcceptedCasts;
    })) {
      throw new RangeError(label + " maximumAcceptedCasts must be tier-invariant");
    }
    const expectedMaximum = castPolicyId === "once-per-mission" ? 1 : null;
    if (tiers[0].maximumAcceptedCasts !== expectedMaximum) {
      throw new RangeError(label + " maximumAcceptedCasts must match castPolicyId");
    }
    return {
      id: protocolId,
      protocolId: protocolId,
      name: safeText(source.name, label + " name", 96),
      targetKind: targetKind,
      castPolicyId: castPolicyId,
      tiers: tiers,
    };
  }

  function normalizeProtocolRuntime(source, label) {
    exactFields(source, ["protocolId", "readyTick", "acceptedCastCount"], label);
    return {
      protocolId: stableId(source.protocolId, label + " protocolId"),
      readyTick: nonnegativeInteger(source.readyTick, label + " readyTick"),
      acceptedCastCount: nonnegativeInteger(source.acceptedCastCount, label + " acceptedCastCount"),
    };
  }

  function normalizeProtocolLoadout(source, label) {
    exactFields(source, ["slot", "protocolId", "tier"], label);
    return {
      slot: safeInteger(source.slot, 0, PROTOCOL_SLOT_COUNT - 1, label + " slot"),
      protocolId: stableId(source.protocolId, label + " protocolId"),
      tier: safeInteger(source.tier, 1, 3, label + " tier"),
    };
  }

  function normalizeMissionLoan(source, label) {
    if (source === null) return null;
    exactFields(source, ["protocolId", "tier"], label);
    if (!Number.isSafeInteger(source.tier) || source.tier !== LOAN_TIER) {
      throw new RangeError(label + " tier must be Tier " + LOAN_TIER +
        "; tutorial loans are never upgraded during a run");
    }
    return {
      protocolId: stableId(source.protocolId, label + " protocolId"),
      tier: LOAN_TIER,
    };
  }

  function targetMode(targetKind) {
    return targetKind === "none" ? "instant-confirm" : targetKind;
  }

  function protocolCost(tier, casts, rules, multiplierBp) {
    const repeatStep = ceilProductRatio(rules.repeatCostStepBp, casts, 1, "Protocol repeat surcharge");
    const repeatFactor = checkedAdd(rules.repeatCostBaseBp, repeatStep, "Protocol repeat factor");
    const escalated = ceilProductRatio(
      tier.baseCostAether, repeatFactor, BASIS_POINTS, "Protocol escalated cost"
    );
    const resolved = ceilProductRatio(escalated, multiplierBp, BASIS_POINTS, "Protocol resolved cost");
    return {
      baseCostAether: tier.baseCostAether,
      repeatSurchargeAether: escalated - tier.baseCostAether,
      escalatedCostAether: escalated,
      costMultiplierBp: multiplierBp,
      resolvedCostAether: resolved,
    };
  }

  function emptyProtocolCard(slot, locked, keyHint) {
    return {
      slot: slot,
      slotLabel: String(slot + 1),
      keyHint: keyHint,
      kind: "empty",
      locked: locked,
      protocolId: null,
      name: null,
      tier: null,
      source: null,
      targetKind: null,
      targetMode: null,
      requiresTarget: false,
      baseCostAether: null,
      resolvedCostAether: null,
      affordable: false,
      baseCooldownMs: null,
      baseCooldownSeconds: null,
      individualCooldownRemainingTicks: 0,
      individualCooldownRemainingSeconds: 0,
      sharedCooldownRemainingTicks: 0,
      sharedCooldownRemainingSeconds: 0,
      cooldownRemainingTicks: 0,
      cooldownRemainingSeconds: 0,
      effect: null,
      readiness: "unavailable",
      readinessReasonCode: locked ? "slot-locked" : "slot-empty",
      readinessReasonText: locked ? "This Protocol slot is locked." : "No Divine Protocol is equipped.",
      minimumTargetSizePx: PRIMARY_TARGET_SIZE_PX,
      ariaLabel: "Divine Protocol slot " + (slot + 1) + (locked ? ", locked" : ", empty"),
    };
  }

  function protocolReadiness(input) {
    if (input.phase === "planning") {
      return { readiness: "unavailable", code: "planning-phase", text: "Available after the wave starts." };
    }
    if (input.phase === "complete") {
      return { readiness: "unavailable", code: "mission-complete", text: "The mission is complete." };
    }
    if (input.pending) {
      return { readiness: "pending", code: "effect-pending", text: "The accepted effect is pending." };
    }
    if (input.onceUnavailable) {
      return { readiness: "unavailable", code: "once-per-mission-used", text: "Already used this mission." };
    }
    if (input.targeting) {
      return { readiness: "targeting", code: "targeting", text: "Choose a legal target, then confirm or cancel." };
    }
    if (input.sharedCooldownTicks > 0) {
      return { readiness: "cooldown", code: "shared-cooldown", text: "Shared Protocol cooldown is active." };
    }
    if (input.individualCooldownTicks > 0) {
      return { readiness: "cooldown", code: "individual-cooldown", text: "This Protocol is cooling down." };
    }
    if (!input.affordable) {
      return { readiness: "unaffordable", code: "insufficient-aether", text: "Not enough Aether." };
    }
    return { readiness: "ready", code: "ready", text: "Ready to activate." };
  }

  function readinessText(readiness, cooldownSeconds, shortage) {
    if (readiness === "ready") return "ready";
    if (readiness === "targeting") return "targeting, confirm or cancel";
    if (readiness === "cooldown") return "cooldown " + secondsLabel(cooldownSeconds);
    if (readiness === "unaffordable") return "needs " + shortage + " more Aether";
    if (readiness === "pending") return "effect pending";
    return "unavailable";
  }

  function createProtocolTray(callerInput) {
    const input = preflightDataGraph(callerInput, "Protocol tray input");
    exactFields(input, ["content", "state", "local", "bindings"], "Protocol tray input");
    const protocolBindingFields = Object.keys(input.bindings);
    protocolBindingFields.forEach(function (field) {
      if (["protocolSlots", "reinforcement", "mechanism"].indexOf(field) === -1) {
        throw new TypeError("Protocol bindings has unknown field " + field);
      }
    });
    if (!hasOwn(input.bindings, "protocolSlots")) throw new TypeError("Protocol bindings is missing field protocolSlots");
    if (!Array.isArray(input.bindings.protocolSlots) ||
        input.bindings.protocolSlots.length !== PROTOCOL_SLOT_COUNT) {
      throw new RangeError("Protocol bindings must contain exactly two slot entries");
    }
    const protocolBindings = input.bindings.protocolSlots.map(function (value, index) {
      return keyBinding(value, "Protocol slot " + index + " binding");
    });
    const reinforcementBinding = hasOwn(input.bindings, "reinforcement")
      ? keyBinding(input.bindings.reinforcement, "Reinforcement binding") : null;
    const mechanismBinding = hasOwn(input.bindings, "mechanism")
      ? keyBinding(input.bindings.mechanism, "Mechanism binding") : null;
    distinctBindings(protocolBindings.concat([reinforcementBinding, mechanismBinding]), "Action bindings");
    exactFields(input.content, ["protocolRules", "protocols"], "Protocol tray content");
    exactFields(input.content.protocolRules, ["repeatCostStepBp"], "Protocol rules");
    // sim/protocols.js normalizes repeatCostStepBp with positiveInteger (>= 1 bp).
    const rules = {
      repeatCostBaseBp: BASIS_POINTS,
      repeatCostStepBp: positiveInteger(
        input.content.protocolRules.repeatCostStepBp, "Protocol repeatCostStepBp"
      ),
    };
    const protocols = collection(input.content.protocols,
      ["protocolId", "name", "targetKind", "castPolicyId", "tiers"], normalizeProtocol, "Protocols");

    exactFields(input.state, [
      "tick", "ticksPerSecond", "phase", "aether", "protocolSlotCap", "protocolLoadout",
      "missionLoan", "protocolRuntimes", "pendingProtocolIds", "sharedReadyTick",
      "protocolCostMultiplierBp",
    ], "Protocol canonical state");
    const state = {
      tick: nonnegativeInteger(input.state.tick, "Protocol state tick"),
      ticksPerSecond: positiveInteger(input.state.ticksPerSecond, "Protocol state ticksPerSecond"),
      phase: enumValue(input.state.phase, PHASES, "Protocol state phase"),
      aether: nonnegativeInteger(input.state.aether, "Protocol state aether"),
      protocolSlotCap: safeInteger(input.state.protocolSlotCap, 0, PROTOCOL_SLOT_COUNT, "Protocol slot cap"),
      sharedReadyTick: nonnegativeInteger(input.state.sharedReadyTick, "Protocol sharedReadyTick"),
      protocolCostMultiplierBp: safeInteger(
        input.state.protocolCostMultiplierBp, MIN_COST_MULTIPLIER_BP, MAX_COST_MULTIPLIER_BP,
        "Protocol cost multiplier"
      ),
    };
    if (!Array.isArray(input.state.protocolLoadout) || input.state.protocolLoadout.length > PROTOCOL_SLOT_COUNT) {
      throw new RangeError("Protocol loadout must be an array with at most two records");
    }
    const loadout = input.state.protocolLoadout.map(function (record, index) {
      return normalizeProtocolLoadout(record, "Protocol loadout[" + index + "]");
    });
    const occupiedSlots = new Set();
    const occupiedProtocols = new Set();
    loadout.forEach(function (entry) {
      if (occupiedSlots.has(entry.slot)) throw new RangeError("Duplicate Protocol slot " + entry.slot);
      if (occupiedProtocols.has(entry.protocolId)) {
        throw new RangeError("Duplicate Protocol ID " + entry.protocolId);
      }
      if (entry.slot >= state.protocolSlotCap) throw new RangeError("Protocol loadout uses a locked slot");
      if (!hasOwn(protocols, entry.protocolId)) {
        throw new RangeError("Protocol loadout references unknown Protocol " + entry.protocolId);
      }
      occupiedSlots.add(entry.slot);
      occupiedProtocols.add(entry.protocolId);
    });
    const missionLoan = normalizeMissionLoan(input.state.missionLoan, "Mission Protocol loan");
    if (missionLoan !== null) {
      if (!hasOwn(protocols, missionLoan.protocolId)) {
        throw new RangeError("Mission Protocol loan references unknown Protocol " + missionLoan.protocolId);
      }
      if (occupiedProtocols.has(missionLoan.protocolId)) {
        throw new RangeError("Mission Protocol loan duplicates an equipped Protocol");
      }
    }
    if (!Array.isArray(input.state.protocolRuntimes) || input.state.protocolRuntimes.length > 64) {
      throw new RangeError("Protocol runtimes must be a bounded array of at most 64 records");
    }
    const runtimes = Object.create(null);
    input.state.protocolRuntimes.forEach(function (record, index) {
      const runtime = normalizeProtocolRuntime(record, "Protocol runtimes[" + index + "]");
      if (hasOwn(runtimes, runtime.protocolId)) {
        throw new RangeError("Duplicate Protocol runtime " + runtime.protocolId);
      }
      if (!hasOwn(protocols, runtime.protocolId)) {
        throw new RangeError("Protocol runtime references unknown Protocol " + runtime.protocolId);
      }
      runtimes[runtime.protocolId] = runtime;
    });
    const pendingIds = uniqueIdArray(input.state.pendingProtocolIds, "Pending Protocol IDs");
    pendingIds.forEach(function (protocolId) {
      if (!hasOwn(protocols, protocolId)) {
        throw new RangeError("Pending state references unknown Protocol " + protocolId);
      }
      if (!occupiedProtocols.has(protocolId) &&
          (!missionLoan || missionLoan.protocolId !== protocolId)) {
        throw new RangeError("Pending Protocol is not equipped or loaned: " + protocolId);
      }
    });
    const pending = new Set(pendingIds);

    exactFields(input.local, ["targeting"], "Protocol local state");
    let targeting = null;
    if (input.local.targeting !== null) {
      exactFields(input.local.targeting, ["source", "slot", "protocolId"], "Protocol local targeting");
      targeting = {
        source: enumValue(input.local.targeting.source, ["loadout", "mission-loan"], "Targeting source"),
        slot: input.local.targeting.slot === null ? null :
          safeInteger(input.local.targeting.slot, 0, PROTOCOL_SLOT_COUNT - 1, "Targeting slot"),
        protocolId: stableId(input.local.targeting.protocolId, "Targeting protocolId"),
      };
      if (targeting.source === "loadout") {
        const targetEntry = loadout.find(function (entry) { return entry.slot === targeting.slot; });
        if (!targetEntry || targetEntry.protocolId !== targeting.protocolId) {
          throw new RangeError("Local targeting does not match Protocol slot " + targeting.slot);
        }
      } else if (targeting.slot !== null || !missionLoan ||
          missionLoan.protocolId !== targeting.protocolId) {
        throw new RangeError("Local targeting does not match the Mission Protocol loan");
      }
    }

    const sharedTicks = remainingTicks(state.sharedReadyTick, state.tick);
    function runtimeFor(protocolId) {
      return hasOwn(runtimes, protocolId) ? runtimes[protocolId] : {
        protocolId: protocolId,
        readyTick: 0,
        acceptedCastCount: 0,
      };
    }

    function createProtocolCard(equipped, source, slot) {
      const protocol = protocols[equipped.protocolId];
      const tier = protocol.tiers.find(function (candidate) { return candidate.tier === equipped.tier; });
      if (!tier) {
        throw new RangeError("Protocol " + protocol.protocolId +
          " does not define equipped tier " + equipped.tier);
      }
      const runtime = runtimeFor(protocol.protocolId);
      if (tier.maximumAcceptedCasts !== null &&
          runtime.acceptedCastCount > tier.maximumAcceptedCasts) {
        throw new RangeError("Protocol runtime exceeds maximumAcceptedCasts for " + protocol.protocolId);
      }
      const cost = protocolCost(tier, runtime.acceptedCastCount, rules, state.protocolCostMultiplierBp);
      const individualTicks = remainingTicks(runtime.readyTick, state.tick);
      const cooldownTicks = Math.max(individualTicks, sharedTicks);
      const affordable = state.aether >= cost.resolvedCostAether;
      const onceUnavailable = protocol.castPolicyId === "once-per-mission" &&
        runtime.acceptedCastCount >= tier.maximumAcceptedCasts;
      const isTargeting = targeting !== null && targeting.source === source &&
        targeting.slot === slot && targeting.protocolId === protocol.protocolId;
      const readiness = protocolReadiness({
        phase: state.phase,
        onceUnavailable: onceUnavailable,
        pending: pending.has(protocol.protocolId),
        targeting: isTargeting,
        sharedCooldownTicks: sharedTicks,
        individualCooldownTicks: individualTicks,
        affordable: affordable,
      });
      const cooldownSeconds = wholeSeconds(cooldownTicks, state.ticksPerSecond);
      const shortage = affordable ? 0 : cost.resolvedCostAether - state.aether;
      const targetSummary = protocol.targetKind === "none" ? "Global" :
        protocol.targetKind === "route-point" ? "Choose a point on a route" :
          protocol.targetKind === "tower" ? "Choose one eligible tower" : "Aim a battlefield cone";
      return {
        slot: slot,
        slotLabel: source === "mission-loan" ? "Tutorial loan" : String(slot + 1),
        keyHint: source === "mission-loan" ? null : protocolBindings[slot],
        kind: source === "mission-loan" ? "tutorial-loan" : "protocol",
        locked: false,
        protocolId: protocol.protocolId,
        name: protocol.name,
        tier: tier.tier,
        source: source,
        targetKind: protocol.targetKind,
        targetMode: targetMode(protocol.targetKind),
        requiresTarget: protocol.targetKind !== "none",
        baseCostAether: tier.baseCostAether,
        repeatSurchargeAether: cost.repeatSurchargeAether,
        escalatedCostAether: cost.escalatedCostAether,
        costMultiplierBp: cost.costMultiplierBp,
        resolvedCostAether: cost.resolvedCostAether,
        affordable: affordable,
        baseCooldownMs: tier.cooldownMs,
        baseCooldownSeconds: Math.ceil(tier.cooldownMs / 1000),
        individualCooldownRemainingTicks: individualTicks,
        individualCooldownRemainingSeconds: wholeSeconds(individualTicks, state.ticksPerSecond),
        sharedCooldownRemainingTicks: sharedTicks,
        sharedCooldownRemainingSeconds: wholeSeconds(sharedTicks, state.ticksPerSecond),
        cooldownRemainingTicks: cooldownTicks,
        cooldownRemainingSeconds: cooldownSeconds,
        effect: {
          durationMs: tier.durationMs,
          durationTicks: millisecondsToTicks(
            tier.durationMs, state.ticksPerSecond, "Protocol effect duration"
          ),
          text: tier.effectText,
        },
        readiness: readiness.readiness,
        readinessReasonCode: readiness.code,
        readinessReasonText: readiness.text,
        summary: {
          target: { kind: protocol.targetKind, text: targetSummary },
          effect: { text: tier.effectText },
          duration: {
            milliseconds: tier.durationMs,
            ticks: millisecondsToTicks(tier.durationMs, state.ticksPerSecond, "Protocol summary duration"),
          },
          cost: cost,
          cooldown: {
            baseMilliseconds: tier.cooldownMs,
            individualRemainingTicks: individualTicks,
            individualRemainingSeconds: wholeSeconds(individualTicks, state.ticksPerSecond),
            sharedRemainingTicks: sharedTicks,
            sharedRemainingSeconds: wholeSeconds(sharedTicks, state.ticksPerSecond),
          },
        },
        minimumTargetSizePx: PRIMARY_TARGET_SIZE_PX,
        ariaLabel: (source === "mission-loan" ? "Tutorial loan, " : "") + protocol.name +
          ", Tier " + tier.tier + ". " + targetSummary + ". " + tier.effectText +
          " Base cost " + tier.baseCostAether + " Aether plus " + cost.repeatSurchargeAether +
          " repeat surcharge; resolved cost " + cost.resolvedCostAether + " Aether. " +
          readinessText(readiness.readiness, cooldownSeconds, shortage),
      };
    }

    const cards = [];
    for (let slot = 0; slot < PROTOCOL_SLOT_COUNT; slot += 1) {
      const equipped = loadout.find(function (entry) { return entry.slot === slot; });
      if (!equipped) {
        cards.push(emptyProtocolCard(slot, slot >= state.protocolSlotCap, protocolBindings[slot]));
        continue;
      }
      cards.push(createProtocolCard(equipped, "loadout", slot));
    }

    return deepFreeze({
      schemaVersion: VERSION,
      tick: state.tick,
      aether: state.aether,
      slotCap: state.protocolSlotCap,
      protocolSlots: cards,
      tutorialLoan: missionLoan === null ? null :
        createProtocolCard(missionLoan, "mission-loan", null),
    });
  }

  function normalizeRelic(source, label) {
    return {
      id: stableId(source.id, label + " id"),
      name: safeText(source.name, label + " name", 96),
      benefitText: safeText(source.benefitText, label + " benefitText"),
      drawbackText: safeText(source.drawbackText, label + " drawbackText"),
      unlockSource: safeText(source.unlockSource, label + " unlockSource", 160),
    };
  }

  function createRelicCards(callerInput) {
    const input = preflightDataGraph(callerInput, "Relic cards input");
    exactFields(input, ["content", "state"], "Relic cards input");
    exactFields(input.content, ["relics"], "Relic cards content");
    const relics = collection(input.content.relics,
      ["id", "name", "benefitText", "drawbackText", "unlockSource"], normalizeRelic, "Relics");
    exactFields(input.state, ["slotCap", "unlockedIds", "equippedIds", "slotUnlockSource"], "Relic card state");
    const slotCap = safeInteger(input.state.slotCap, 0, 2, "Relic slot cap");
    // The Relics loadout section's unlock source (spec section 8.1: first slot after m06, second after m15).
    const slotUnlockSource = safeText(input.state.slotUnlockSource, "Relic slot unlockSource", 160);
    const unlockedIds = uniqueIdArray(input.state.unlockedIds, "Unlocked Relic IDs");
    const equippedIds = uniqueIdArray(input.state.equippedIds, "Equipped Relic IDs");
    if (equippedIds.length > slotCap) throw new RangeError("Equipped Relics exceed the Relic slot cap");
    const unlocked = new Set(unlockedIds);
    const equipped = new Set(equippedIds);
    unlockedIds.concat(equippedIds).forEach(function (id) {
      if (!hasOwn(relics, id)) throw new RangeError("Relic state references unknown Relic " + id);
    });
    equippedIds.forEach(function (id) {
      if (!unlocked.has(id)) throw new RangeError("Equipped Relic is not unlocked: " + id);
    });
    return deepFreeze(Object.keys(relics).sort().map(function (id) {
      const relic = relics[id];
      const status = equipped.has(id) ? "equipped" : (unlocked.has(id) ? "available" : "locked");
      const equippedIndex = equippedIds.indexOf(id);
      const slotsFull = equippedIds.length >= slotCap;
      let reasonCode;
      let reasonText;
      if (status === "equipped") { reasonCode = "equipped"; reasonText = "Equipped."; }
      else if (status === "locked") { reasonCode = "relic-locked"; reasonText = "This Relic is locked."; }
      else if (slotCap === 0) { reasonCode = "relic-slot-locked"; reasonText = "Relic slots are locked. " + slotUnlockSource; }
      else if (slotsFull) { reasonCode = "relic-slots-full"; reasonText = "All unlocked Relic slots are full."; }
      else { reasonCode = "available"; reasonText = "Available to equip."; }
      return {
        id: id,
        name: relic.name,
        benefitText: relic.benefitText,
        drawbackText: relic.drawbackText,
        unlockSource: relic.unlockSource,
        status: status,
        equippedSlot: equippedIndex === -1 ? null : equippedIndex + 1,
        inspectable: true,
        canEquip: status === "available" && !slotsFull,
        reasonCode: reasonCode,
        reasonText: reasonText,
        minimumTargetSizePx: SECONDARY_TARGET_SIZE_PX,
        ariaLabel: relic.name + ". Benefit: " + relic.benefitText + " Drawback: " +
          relic.drawbackText + " Status: " + RELIC_STATUS_PHRASES[status] + ".",
      };
    }));
  }

  function normalizeSpecialization(source, label) {
    return {
      id: stableId(source.id, label + " id"),
      defenseId: stableId(source.defenseId, label + " defenseId"),
      name: safeText(source.name, label + " name", 96),
      costAether: positiveInteger(source.costAether, label + " costAether"),
      effectText: safeText(source.effectText, label + " effectText"),
      tradeoffText: safeText(source.tradeoffText, label + " tradeoffText"),
      isDefault: booleanValue(source.isDefault, label + " isDefault"),
    };
  }

  function createSpecializationCards(callerInput) {
    const input = preflightDataGraph(callerInput, "Specialization cards input");
    exactFields(input, ["content", "state"], "Specialization cards input");
    exactFields(input.content, ["specializations"], "Specialization cards content");
    const specializations = collection(input.content.specializations,
      ["id", "defenseId", "name", "costAether", "effectText", "tradeoffText", "isDefault"],
      normalizeSpecialization, "Specializations");
    exactFields(input.state, [
      "phase", "aether", "pendingSpecialization", "specializationCostMultiplierBp", "tower",
    ], "Specialization canonical state");
    const phase = enumValue(input.state.phase, PHASES, "Specialization phase");
    const aether = nonnegativeInteger(input.state.aether, "Specialization aether");
    // Relic "specialization-cost" modifiers (forge-ember x8800 bp, titan-gear x10800 bp) arrive
    // pre-summed and clamped by the reducer; the card resolves ceil(cost x multiplier / 10000).
    const costMultiplierBp = safeInteger(
      input.state.specializationCostMultiplierBp, MIN_COST_MULTIPLIER_BP, MAX_COST_MULTIPLIER_BP,
      "Specialization cost multiplier"
    );
    let pendingId = null;
    let pendingTowerRuntimeId = null;
    if (input.state.pendingSpecialization !== null) {
      exactFields(input.state.pendingSpecialization, ["towerRuntimeId", "specializationId"], "Pending specialization");
      pendingTowerRuntimeId = positiveInteger(input.state.pendingSpecialization.towerRuntimeId,
        "Pending specialization towerRuntimeId");
      pendingId = stableId(input.state.pendingSpecialization.specializationId,
        "Pending specialization ID");
    }
    if (input.state.tower === null) {
      if (pendingId !== null) throw new RangeError("A pending specialization requires a selected tower");
      return deepFreeze([]);
    }
    exactFields(input.state.tower, [
      "runtimeId", "defenseId", "level", "availableSpecializationIds", "selectedSpecializationId",
    ], "Selected tower specialization state");
    const tower = {
      runtimeId: positiveInteger(input.state.tower.runtimeId, "Selected tower runtimeId"),
      defenseId: stableId(input.state.tower.defenseId, "Selected tower defenseId"),
      level: safeInteger(input.state.tower.level, 1, 3, "Selected tower level"),
      availableIds: uniqueIdArray(
        input.state.tower.availableSpecializationIds, "Available specialization IDs"
      ),
      selectedId: nullableStableId(
        input.state.tower.selectedSpecializationId, "Selected specialization ID"
      ),
    };
    const candidates = Object.keys(specializations).map(function (id) { return specializations[id]; })
      .filter(function (record) { return record.defenseId === tower.defenseId; })
      .sort(function (left, right) {
        if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
        return left.id < right.id ? -1 : (left.id > right.id ? 1 : 0);
      });
    if (candidates.length !== 2 || candidates.filter(function (record) { return record.isDefault; }).length !== 1) {
      throw new RangeError("Selected defense must have exactly two specializations and one default");
    }
    if (candidates[0].costAether !== candidates[1].costAether) {
      throw new RangeError("Both defense specializations must use the same Level-3 cost");
    }
    const candidateIds = new Set(candidates.map(function (record) { return record.id; }));
    const availableIds = new Set(tower.availableIds);
    tower.availableIds.forEach(function (id) {
      if (!candidateIds.has(id)) throw new RangeError("Available specialization does not match selected defense: " + id);
    });
    // Spec section 7.1: the family default (its campaign capstone) is always available, so a Level-2
    // tower can always specialize; an availability set that omits it is not a legal canonical state.
    if (!availableIds.has(candidates[0].id)) {
      throw new RangeError("Available specialization IDs must include the default specialization " + candidates[0].id);
    }
    const resolvedCostAether = ceilProductRatio(
      candidates[0].costAether, costMultiplierBp, BASIS_POINTS, "Specialization resolved cost"
    );
    if (tower.selectedId !== null && (!candidateIds.has(tower.selectedId) || !availableIds.has(tower.selectedId))) {
      throw new RangeError("Selected specialization must be available for the selected defense");
    }
    if (pendingId !== null && (pendingTowerRuntimeId !== tower.runtimeId ||
        !candidateIds.has(pendingId) || !availableIds.has(pendingId))) {
      throw new RangeError("Pending specialization must match the selected tower and be available");
    }
    if (tower.level === 1 && (tower.selectedId !== null || pendingId !== null)) {
      throw new RangeError("Level-1 towers cannot have selected or pending specializations");
    }
    if (tower.level === 2 && tower.selectedId !== null) {
      throw new RangeError("Level-2 towers cannot already have a selected specialization");
    }
    if (tower.level === 3 && (tower.selectedId === null || pendingId !== null)) {
      throw new RangeError("Level-3 towers require one selected and no pending specialization");
    }
    return deepFreeze(candidates.map(function (record) {
      let status;
      let reasonCode;
      let reasonText;
      if (tower.selectedId === record.id) status = "selected";
      else if (pendingId !== null) status = pendingId === record.id ? "pending" : "unavailable";
      else if (phase === "complete" || tower.level !== 2 || tower.availableIds.indexOf(record.id) === -1) {
        status = "unavailable";
      } else if (aether < resolvedCostAether) status = "unaffordable";
      else status = "ready";
      if (status === "selected") { reasonCode = "selected"; reasonText = "Selected for this tower."; }
      else if (status === "pending") { reasonCode = "selection-pending"; reasonText = "Selection is pending."; }
      else if (phase === "complete") { reasonCode = "mission-complete"; reasonText = "The mission is complete."; }
      else if (tower.level === 1) { reasonCode = "requires-level-2"; reasonText = "Upgrade this tower to Level 2 first."; }
      else if (tower.level === 3) { reasonCode = "already-specialized"; reasonText = "This tower is already specialized."; }
      else if (tower.availableIds.indexOf(record.id) === -1) {
        reasonCode = "specialization-locked"; reasonText = "This specialization is locked.";
      } else if (status === "unavailable") {
        reasonCode = "other-selection-pending"; reasonText = "Another specialization is pending.";
      } else if (status === "unaffordable") {
        reasonCode = "insufficient-aether"; reasonText = "Not enough Aether.";
      } else { reasonCode = "ready"; reasonText = "Ready to specialize."; }
      const costText = resolvedCostAether === record.costAether
        ? "costs " + resolvedCostAether + " Aether"
        : "costs " + resolvedCostAether + " Aether (base " + record.costAether + ")";
      return {
        id: record.id,
        defenseId: record.defenseId,
        towerRuntimeId: tower.runtimeId,
        name: record.name,
        baseCostAether: record.costAether,
        costMultiplierBp: costMultiplierBp,
        resolvedCostAether: resolvedCostAether,
        effectText: record.effectText,
        tradeoffText: record.tradeoffText,
        isDefault: record.isDefault,
        status: status,
        readinessReasonCode: reasonCode,
        readinessReasonText: reasonText,
        canSelect: status === "ready",
        minimumTargetSizePx: PRIMARY_TARGET_SIZE_PX,
        ariaLabel: record.name + ", " + costText + ". " + record.effectText +
          " Tradeoff: " + record.tradeoffText + " Status: " + SPECIALIZATION_STATUS_PHRASES[status] + ".",
      };
    }));
  }

  function normalizeReinforcement(source, label) {
    return {
      id: stableId(source.id, label + " id"),
      name: safeText(source.name, label + " name", 96),
      roleText: safeText(source.roleText, label + " roleText"),
      costAether: positiveInteger(source.costAether, label + " costAether"),
      cooldownMs: positiveInteger(source.cooldownMs, label + " cooldownMs"),
      lifetimeMs: positiveInteger(source.lifetimeMs, label + " lifetimeMs"),
    };
  }

  function reinforcementReadiness(state) {
    if (state.phase === "planning") return { readiness: "unavailable", code: "planning-phase", text: "Available after the wave starts." };
    if (state.phase === "complete") return { readiness: "unavailable", code: "mission-complete", text: "The mission is complete." };
    if (state.pending) return { readiness: "pending", code: "deployment-pending", text: "Deployment is pending." };
    if (state.live) return { readiness: "unavailable", code: "unit-active", text: "A reinforcement is already active." };
    if (!state.markerAvailable) return { readiness: "unavailable", code: "missing-marker", text: "No compatible reinforcement marker is available." };
    if (state.cooldownTicks > 0) return { readiness: "cooldown", code: "individual-cooldown", text: "This reinforcement is cooling down." };
    if (!state.affordable) return { readiness: "unaffordable", code: "insufficient-aether", text: "Not enough Aether." };
    return { readiness: "ready", code: "ready", text: "Ready to deploy." };
  }

  function emptyReinforcementControl(keyHint) {
    return deepFreeze({
      kind: "empty",
      id: null,
      name: null,
      keyHint: keyHint,
      roleText: null,
      costAether: null,
      cooldownRemainingTicks: 0,
      cooldownRemainingSeconds: 0,
      lifetimeTicks: null,
      activeRemainingLifetimeTicks: 0,
      activeRemainingLifetimeSeconds: 0,
      targetMode: "reinforcement-marker",
      readiness: "unavailable",
      readinessReasonCode: "slot-empty",
      readinessReasonText: "No reinforcement is equipped.",
      minimumTargetSizePx: PRIMARY_TARGET_SIZE_PX,
      ariaLabel: "Reinforcement slot, empty",
    });
  }

  function createReinforcementControl(callerInput) {
    const input = preflightDataGraph(callerInput, "Reinforcement control input");
    exactFields(input, ["content", "state", "bindings"], "Reinforcement control input");
    const reinforcementBindingFields = Object.keys(input.bindings);
    reinforcementBindingFields.forEach(function (field) {
      if (["activate", "protocolSlots", "mechanism"].indexOf(field) === -1) {
        throw new TypeError("Reinforcement bindings has unknown field " + field);
      }
    });
    if (!hasOwn(input.bindings, "activate")) throw new TypeError("Reinforcement bindings is missing field activate");
    const activateBinding = keyBinding(input.bindings.activate, "Reinforcement activate binding");
    if (hasOwn(input.bindings, "protocolSlots") && (!Array.isArray(input.bindings.protocolSlots) ||
        input.bindings.protocolSlots.length !== PROTOCOL_SLOT_COUNT)) {
      throw new RangeError("Protocol bindings must contain exactly two slot entries");
    }
    const reinforcementProtocolBindings = hasOwn(input.bindings, "protocolSlots")
      ? input.bindings.protocolSlots.map(function (value, index) {
        return keyBinding(value, "Protocol slot " + index + " binding");
      }) : [];
    const reinforcementMechanismBinding = hasOwn(input.bindings, "mechanism")
      ? keyBinding(input.bindings.mechanism, "Mechanism binding") : null;
    distinctBindings(reinforcementProtocolBindings.concat([activateBinding, reinforcementMechanismBinding]), "Action bindings");
    exactFields(input.content, ["reinforcements"], "Reinforcement content");
    const reinforcements = collection(input.content.reinforcements,
      ["id", "name", "roleText", "costAether", "cooldownMs", "lifetimeMs"],
      normalizeReinforcement, "Reinforcements");
    exactFields(input.state, [
      "tick", "ticksPerSecond", "phase", "aether", "equippedId", "readyTick", "liveUnitId",
      "liveUnitExpiresTick", "markerAvailable", "pending",
    ], "Reinforcement canonical state");
    const tick = nonnegativeInteger(input.state.tick, "Reinforcement tick");
    const ticksPerSecond = positiveInteger(input.state.ticksPerSecond, "Reinforcement ticksPerSecond");
    const phase = enumValue(input.state.phase, PHASES, "Reinforcement phase");
    const aether = nonnegativeInteger(input.state.aether, "Reinforcement aether");
    const equippedId = nullableStableId(input.state.equippedId, "Equipped reinforcement ID");
    const readyTick = nonnegativeInteger(input.state.readyTick, "Reinforcement readyTick");
    const liveUnitId = nullablePositiveInteger(input.state.liveUnitId, "Live reinforcement runtime ID");
    const liveUnitExpiresTick = input.state.liveUnitExpiresTick === null ? null :
      nonnegativeInteger(input.state.liveUnitExpiresTick, "Live reinforcement expiry tick");
    const markerAvailable = booleanValue(input.state.markerAvailable, "Reinforcement markerAvailable");
    const pending = booleanValue(input.state.pending, "Reinforcement pending");
    if (equippedId === null) {
      if (liveUnitId !== null || liveUnitExpiresTick !== null || pending) {
        throw new RangeError("Empty reinforcement state cannot be live or pending");
      }
      return emptyReinforcementControl(activateBinding);
    }
    if ((liveUnitId === null) !== (liveUnitExpiresTick === null)) {
      throw new RangeError("Live reinforcement ID and expiry tick must appear together");
    }
    if (liveUnitExpiresTick !== null && liveUnitExpiresTick < tick) {
      throw new RangeError("Live reinforcement expiry cannot be before the current tick");
    }
    const record = reinforcements[equippedId];
    if (!record) throw new RangeError("Reinforcement state references unknown reinforcement " + equippedId);
    const cooldownTicks = remainingTicks(readyTick, tick);
    const affordable = aether >= record.costAether;
    const readiness = reinforcementReadiness({
      phase: phase,
      markerAvailable: markerAvailable,
      live: liveUnitId !== null,
      pending: pending,
      cooldownTicks: cooldownTicks,
      affordable: affordable,
    });
    const cooldownSeconds = wholeSeconds(cooldownTicks, ticksPerSecond);
    const lifetimeTicks = millisecondsToTicks(record.lifetimeMs, ticksPerSecond, "Reinforcement lifetime");
    const activeRemainingLifetimeTicks = liveUnitExpiresTick === null ? 0 : liveUnitExpiresTick - tick;
    return deepFreeze({
      kind: "reinforcement",
      id: record.id,
      name: record.name,
      keyHint: activateBinding,
      roleText: record.roleText,
      costAether: record.costAether,
      cooldownRemainingTicks: cooldownTicks,
      cooldownRemainingSeconds: cooldownSeconds,
      cooldownMs: record.cooldownMs,
      lifetimeMs: record.lifetimeMs,
      lifetimeTicks: lifetimeTicks,
      activeRemainingLifetimeTicks: activeRemainingLifetimeTicks,
      activeRemainingLifetimeSeconds: wholeSeconds(activeRemainingLifetimeTicks, ticksPerSecond),
      targetMode: "reinforcement-marker",
      readiness: readiness.readiness,
      readinessReasonCode: readiness.code,
      readinessReasonText: readiness.text,
      minimumTargetSizePx: PRIMARY_TARGET_SIZE_PX,
      ariaLabel: record.name + ", costs " + record.costAether + " Aether, " + record.roleText + " " +
        readinessText(readiness.readiness, cooldownSeconds, affordable ? 0 : record.costAether - aether),
    });
  }

  function normalizeMechanism(source, label) {
    return {
      id: stableId(source.id, label + " id"),
      name: safeText(source.name, label + " name", 96),
      effectText: safeText(source.effectText, label + " effectText"),
      costAether: positiveInteger(source.costAether, label + " costAether"),
      cooldownMs: nonnegativeInteger(source.cooldownMs, label + " cooldownMs"),
      maximumActivations: positiveInteger(source.maximumActivations, label + " maximumActivations"),
    };
  }

  function normalizeMechanismRuntime(source, label) {
    exactFields(source, [
      "mechanismId", "activationId", "readyTick", "acceptedActivationCount", "pending", "activationAvailable",
    ], label);
    return {
      mechanismId: stableId(source.mechanismId, label + " mechanismId"),
      activationId: stableId(source.activationId, label + " activationId"),
      readyTick: nonnegativeInteger(source.readyTick, label + " readyTick"),
      acceptedActivationCount: nonnegativeInteger(source.acceptedActivationCount, label + " acceptedActivationCount"),
      pending: booleanValue(source.pending, label + " pending"),
      activationAvailable: booleanValue(source.activationAvailable, label + " activationAvailable"),
    };
  }

  function mechanismReadiness(state) {
    if (state.phase === "planning") return { readiness: "unavailable", code: "planning-phase", text: "Available after the wave starts." };
    if (state.phase === "complete") return { readiness: "unavailable", code: "mission-complete", text: "The mission is complete." };
    if (state.pending) return { readiness: "pending", code: "activation-pending", text: "Activation is pending." };
    if (state.exhausted) return { readiness: "unavailable", code: "activation-limit-reached", text: "This mechanism has reached its mission activation limit." };
    if (!state.activationAvailable) return { readiness: "unavailable", code: "missing-activation", text: "No compatible map activation is available." };
    if (state.cooldownTicks > 0) return { readiness: "cooldown", code: "individual-cooldown", text: "This mechanism is cooling down." };
    if (!state.affordable) return { readiness: "unaffordable", code: "insufficient-aether", text: "Not enough Aether." };
    return { readiness: "ready", code: "ready", text: "Ready to activate." };
  }

  function createMechanismCards(callerInput) {
    const input = preflightDataGraph(callerInput, "Mechanism cards input");
    exactFields(input, ["content", "state", "bindings"], "Mechanism cards input");
    const mechanismBindingFields = Object.keys(input.bindings);
    mechanismBindingFields.forEach(function (field) {
      if (["activate", "protocolSlots", "reinforcement"].indexOf(field) === -1) {
        throw new TypeError("Mechanism bindings has unknown field " + field);
      }
    });
    if (!hasOwn(input.bindings, "activate")) throw new TypeError("Mechanism bindings is missing field activate");
    const activateBinding = keyBinding(input.bindings.activate, "Mechanism activate binding");
    if (hasOwn(input.bindings, "protocolSlots") && (!Array.isArray(input.bindings.protocolSlots) ||
        input.bindings.protocolSlots.length !== PROTOCOL_SLOT_COUNT)) {
      throw new RangeError("Protocol bindings must contain exactly two slot entries");
    }
    const mechanismProtocolBindings = hasOwn(input.bindings, "protocolSlots")
      ? input.bindings.protocolSlots.map(function (value, index) {
        return keyBinding(value, "Protocol slot " + index + " binding");
      }) : [];
    const mechanismReinforcementBinding = hasOwn(input.bindings, "reinforcement")
      ? keyBinding(input.bindings.reinforcement, "Reinforcement binding") : null;
    distinctBindings(mechanismProtocolBindings.concat([activateBinding, mechanismReinforcementBinding]), "Action bindings");
    exactFields(input.content, ["mechanisms"], "Mechanism cards content");
    const mechanisms = collection(input.content.mechanisms,
      ["id", "name", "effectText", "costAether", "cooldownMs", "maximumActivations"],
      normalizeMechanism, "Mechanisms");
    exactFields(input.state, ["tick", "ticksPerSecond", "phase", "aether", "runtimes"],
      "Mechanism canonical state");
    const tick = nonnegativeInteger(input.state.tick, "Mechanism tick");
    const ticksPerSecond = positiveInteger(input.state.ticksPerSecond, "Mechanism ticksPerSecond");
    const phase = enumValue(input.state.phase, PHASES, "Mechanism phase");
    const aether = nonnegativeInteger(input.state.aether, "Mechanism aether");
    // Spec section 10/12.2: a mission has one mechanism and one key hint, so two runtimes would share a key.
    if (!Array.isArray(input.state.runtimes) || input.state.runtimes.length > 1) {
      throw new RangeError("Mechanism canonical state must contain at most one mechanism runtime; " +
        "a mission exposes one mechanism control and one key binding");
    }
    const ids = new Set();
    return deepFreeze(input.state.runtimes.map(function (source, index) {
      const runtime = normalizeMechanismRuntime(source, "Mechanism runtimes[" + index + "]");
      if (ids.has(runtime.mechanismId)) throw new RangeError("Duplicate mechanism runtime " + runtime.mechanismId);
      ids.add(runtime.mechanismId);
      if (!hasOwn(mechanisms, runtime.mechanismId)) {
        throw new RangeError("Mechanism state references unknown mechanism " + runtime.mechanismId);
      }
      const record = mechanisms[runtime.mechanismId];
      if (runtime.acceptedActivationCount > record.maximumActivations) {
        throw new RangeError("Mechanism accepted activation count exceeds its mission limit");
      }
      const cooldownTicks = remainingTicks(runtime.readyTick, tick);
      const affordable = aether >= record.costAether;
      const readiness = mechanismReadiness({
        phase: phase,
        activationAvailable: runtime.activationAvailable,
        pending: runtime.pending,
        exhausted: runtime.acceptedActivationCount >= record.maximumActivations,
        cooldownTicks: cooldownTicks,
        affordable: affordable,
      });
      const cooldownSeconds = wholeSeconds(cooldownTicks, ticksPerSecond);
      return {
        kind: "mechanism",
        id: record.id,
        activationId: runtime.activationId,
        name: record.name,
        keyHint: activateBinding,
        effectText: record.effectText,
        costAether: record.costAether,
        cooldownMs: record.cooldownMs,
        maximumActivations: record.maximumActivations,
        acceptedActivationCount: runtime.acceptedActivationCount,
        cooldownRemainingTicks: cooldownTicks,
        cooldownRemainingSeconds: cooldownSeconds,
        targetMode: "activation-id",
        readiness: readiness.readiness,
        readinessReasonCode: readiness.code,
        readinessReasonText: readiness.text,
        minimumTargetSizePx: PRIMARY_TARGET_SIZE_PX,
        ariaLabel: record.name + ", costs " + record.costAether + " Aether, " + record.effectText + " " +
          readiness.text,
      };
    }));
  }

  const LOADOUT_SECTIONS = Object.freeze([
    { id: "towers", title: "Towers", maximumSlots: 15 },
    { id: "protocols", title: "Divine Protocols", maximumSlots: 2 },
    { id: "relics", title: "Relics", maximumSlots: 2 },
    { id: "reinforcement", title: "Reinforcement", maximumSlots: 1 },
  ]);

  function normalizeLoadoutSection(source, definition) {
    exactFields(source, ["slotCap", "equippedIds", "unlockSource"], "Loadout " + definition.id);
    const slotCap = safeInteger(source.slotCap, 0, definition.maximumSlots,
      "Loadout " + definition.id + " slotCap");
    const equippedIds = uniqueIdArray(source.equippedIds, "Loadout " + definition.id + " equippedIds");
    if (equippedIds.length > slotCap) {
      throw new RangeError("Loadout " + definition.id + " exceeds its slot cap");
    }
    const unlockSource = safeText(source.unlockSource, "Loadout " + definition.id + " unlockSource", 160);
    return {
      id: definition.id,
      title: definition.title,
      slotCap: slotCap,
      usedSlots: equippedIds.length,
      emptySlots: slotCap - equippedIds.length,
      equippedIds: equippedIds,
      unlockSource: unlockSource,
      clearLabel: "Clear " + definition.title,
      canClear: equippedIds.length > 0,
      minimumTargetSizePx: SECONDARY_TARGET_SIZE_PX,
      ariaLabel: definition.title + ", " + equippedIds.length + " of " + slotCap +
        " slots used. " + unlockSource,
    };
  }

  function createLoadoutModel(callerInput) {
    const input = preflightDataGraph(callerInput, "Loadout input");
    exactFields(input, LOADOUT_SECTIONS.map(function (entry) { return entry.id; }), "Loadout input");
    return deepFreeze({
      schemaVersion: VERSION,
      sections: LOADOUT_SECTIONS.map(function (definition) {
        return normalizeLoadoutSection(input[definition.id], definition);
      }),
    });
  }

  function normalizeUnlock(source, label) {
    const sourceMissionId = source.sourceMissionId;
    if (typeof sourceMissionId !== "string" || !MISSION_ID.test(sourceMissionId)) {
      throw new TypeError(label + " sourceMissionId must be an mNN mission ID");
    }
    return {
      id: stableId(source.id, label + " id"),
      order: positiveInteger(source.order, label + " order"),
      category: stableId(source.category, label + " category"),
      name: safeText(source.name, label + " name", 96),
      description: safeText(source.description, label + " description"),
      sourceMissionId: sourceMissionId,
    };
  }

  function missionNumber(missionId) {
    return Number(missionId.slice(1));
  }

  function createUnlockCards(callerInput) {
    const input = preflightDataGraph(callerInput, "Unlock cards input");
    exactFields(input, ["content", "state"], "Unlock cards input");
    exactFields(input.content, ["unlocks"], "Unlock cards content");
    const unlocks = collection(input.content.unlocks,
      ["id", "order", "category", "name", "description", "sourceMissionId"],
      normalizeUnlock, "Unlocks");
    exactFields(input.state, ["unlockedIds"], "Unlock card state");
    const unlockedIds = uniqueIdArray(input.state.unlockedIds, "Unlocked reward IDs");
    const unlocked = new Set(unlockedIds);
    unlockedIds.forEach(function (id) {
      if (!hasOwn(unlocks, id)) throw new RangeError("Unlock state references unknown reward " + id);
    });
    const ordered = Object.keys(unlocks).map(function (id) { return unlocks[id]; }).sort(function (left, right) {
      if (left.order !== right.order) return left.order - right.order;
      return left.id < right.id ? -1 : (left.id > right.id ? 1 : 0);
    });
    const lockedOrders = ordered.filter(function (record) { return !unlocked.has(record.id); })
      .map(function (record) { return record.order; });
    const nextOrder = lockedOrders.length ? Math.min.apply(Math, lockedOrders) : null;
    return deepFreeze(ordered.map(function (record) {
      const status = unlocked.has(record.id) ? "unlocked" :
        (record.order === nextOrder ? "next" : "locked");
      const statusText = status === "next" ? "Next unlock" : (status === "unlocked" ? "Unlocked" : "Locked");
      return {
        id: record.id,
        order: record.order,
        category: record.category,
        name: record.name,
        description: record.description,
        sourceMissionId: record.sourceMissionId,
        status: status,
        inspectable: true,
        minimumTargetSizePx: SECONDARY_TARGET_SIZE_PX,
        ariaLabel: statusText + ": " + record.name + ", after mission " +
          missionNumber(record.sourceMissionId) + ". " + record.description,
      };
    }));
  }

  return deepFreeze({
    VERSION: VERSION,
    PROTOCOL_SLOT_COUNT: PROTOCOL_SLOT_COUNT,
    LOAN_TIER: LOAN_TIER,
    MIN_COST_MULTIPLIER_BP: MIN_COST_MULTIPLIER_BP,
    MAX_COST_MULTIPLIER_BP: MAX_COST_MULTIPLIER_BP,
    PRIMARY_TARGET_SIZE_PX: PRIMARY_TARGET_SIZE_PX,
    SECONDARY_TARGET_SIZE_PX: SECONDARY_TARGET_SIZE_PX,
    DATA_LIMITS: DATA_LIMITS,
    READINESS: READINESS,
    TARGET_KINDS: TARGET_KINDS,
    createProtocolTray: createProtocolTray,
    createRelicCards: createRelicCards,
    createSpecializationCards: createSpecializationCards,
    createReinforcementControl: createReinforcementControl,
    createMechanismCards: createMechanismCards,
    createLoadoutModel: createLoadoutModel,
    createUnlockCards: createUnlockCards,
  });
});
