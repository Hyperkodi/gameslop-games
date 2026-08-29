/* Armara Aegis closed deterministic behavior reducers v1.
   This module turns compiler-validated behavior records into canonical intents. It never owns HP,
   routes, renderer state, persistence, wall-clock time, or presentation callbacks. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./abi.js"),
      require("./geometry.js"),
      require("./timers.js"),
      require("./movement.js"),
      require("./effects.js"),
      require("./targeting.js")
    );
    return;
  }

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
})(typeof globalThis !== "undefined" ? globalThis : this, function (
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

  function phaseIndex(phaseId) {
    const index = PHASE_ORDER.indexOf(phaseId);
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
    if (definition.id !== eventId || definition.version !== ABI.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Semantic event definition/version does not match " + eventId);
    }
    const phaseId = stableId(input.phaseId, "Semantic event phase ID");
    phaseIndex(phaseId);
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
    const validated = events.map(function (event) {
      const next = validateSemanticEvent(eventCatalog, event);
      const nextPhase = phaseIndex(next.phaseId);
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
    if (definition.id !== eventId || definition.version !== ABI.EVENT_SCHEMA_VERSION ||
        definition.phaseId !== expectedPhaseId) {
      throw new RangeError("Semantic event-plan phase/version does not match " + eventId);
    }
    phaseIndex(expectedPhaseId);
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
    validateSemanticEvent: validateSemanticEvent,
    validateSemanticEvents: validateSemanticEvents,
  });
});
