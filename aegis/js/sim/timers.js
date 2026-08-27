/* Armara Aegis deterministic timer transitions v1.
   Every call advances exactly one named fixed-tick phase. Eligibility/disable policy and status
   winner selection remain caller decisions; this module applies only the frozen ABI arithmetic. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi.js"));
    return;
  }

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
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI) {
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
