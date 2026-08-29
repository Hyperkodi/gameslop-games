/* Pure tick-keyed Aegis presentation cues; no DOM, storage, simulation mutation, or wall clock.
   Protocol target syntax is delegated to the Commands-v2 contract so the two can never drift. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../sim/commands-v2.js"));
    return;
  }
  const game = root.Game;
  if (!game || (typeof game !== "object" && typeof game !== "function") || !game.AegisCommandsV2) {
    throw new Error("Game.AegisCommandsV2 must be installed before effect-timeline.js");
  }
  const api = factory(game.AegisCommandsV2);
  if (game.AegisEffectTimeline !== undefined && game.AegisEffectTimeline !== api) {
    throw new Error("Conflicting Game.AegisEffectTimeline is already installed");
  }
  if (game.AegisEffectTimeline === undefined) Object.defineProperty(game, "AegisEffectTimeline", {
    value: api, enumerable: true, configurable: false, writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (CommandsV2) {
  "use strict";
  if (!CommandsV2 || !Object.isFrozen(CommandsV2) || typeof CommandsV2.normalizeTarget !== "function" ||
      !Array.isArray(CommandsV2.TARGET_KINDS) || !Object.isFrozen(CommandsV2.TARGET_KINDS)) {
    throw new TypeError("A frozen Aegis command-v2 API with normalizeTarget is required");
  }
  const VERSION = 1;
  const MAX_EVENT_INPUT = 512;
  const MAX_PENDING_INPUT = 64;
  const MAX_HISTORY_LIMIT = 256;
  const MAX_EVENT_ORDINAL = 65535;
  const DATA_LIMITS = Object.freeze({
    maximumDepth: 32, maximumNodes: 8192, maximumArrayLength: 512,
    maximumObjectFields: 64, maximumStringLength: 4096,
  });
  const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
  const CONTROL_TEXT = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;
  const SOURCE_KINDS = Object.freeze(["tower", "protocol", "mechanism", "unit"]);
  // Protocol target union (none / route-point / tower / world-vector) is owned by Commands-v2.
  const PROTOCOL_TARGET_KINDS = CommandsV2.TARGET_KINDS;
  // Mechanism-cue union: presentation-only targets for map mechanism cues. NOT part of the
  // Commands-v2 Protocol target union; `activateMechanism` commands carry an activationId field instead.
  const MECHANISM_CUE_TARGET_KINDS = Object.freeze(["activation"]);
  const TARGET_KINDS = Object.freeze(PROTOCOL_TARGET_KINDS.concat(MECHANISM_CUE_TARGET_KINDS));
  const PRESENTATION_PHASES = Object.freeze([
    "accepted", "telegraph", "resolved", "consumed", "expired", "denied", "activated", "pending",
  ]);
  // Human phrases for machine-readable phase tokens; `phase` fields keep the raw token.
  const PHASE_PHRASES = Object.freeze({
    accepted: "accepted", telegraph: "telegraph", resolved: "resolved", consumed: "used",
    expired: "expired", denied: "denied", activated: "activated",
  });
  const REDUCED_MOTION_KINDS = Object.freeze([
    "opacity-scale", "static-bolt", "static-field", "static-ring", "no-motion",
  ]);
  const PHOTOSENSITIVITY_MOTION_KINDS = Object.freeze([
    "opacity-scale", "sustained-bolt", "static-field", "static-ring", "no-motion",
  ]);

  function freeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.getOwnPropertyNames(value).forEach(function (key) { freeze(value[key], visited); });
    return Object.freeze(value);
  }
  const PHOTOSENSITIVITY_POLICY = freeze({
    id: "photosensitivity-safe-v1", rapidAlternatingFlashes: false, cameraShake: false,
    fullFieldFlashCount: 0, lightningTreatment: "one-sustained-bolt-per-authoritative-strike",
  });
  function hasOwn(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }

  /* Validates the caller's graph and returns a private snapshot (null-prototype objects, fresh dense
     arrays); each property is read exactly once through its descriptor and projection reads only the copy. */
  function preflight(root, label) {
    const seen = new WeakSet();
    let nodes = 0;
    function visit(value, depth, path) {
      if (typeof value === "string") {
        if (value.length > DATA_LIMITS.maximumStringLength) throw new RangeError(label + " string bound at " + path);
        return value;
      }
      if (value === null || typeof value !== "object") return value;
      if (depth > DATA_LIMITS.maximumDepth) throw new RangeError(label + " depth bound");
      if (++nodes > DATA_LIMITS.maximumNodes) throw new RangeError(label + " node bound");
      if (seen.has(value)) throw new TypeError(label + " cannot contain cycles or shared references");
      seen.add(value);
      if (Object.getOwnPropertySymbols(value).length) throw new TypeError(label + " cannot contain symbols");
      const names = Object.getOwnPropertyNames(value);
      if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) throw new TypeError(label + " arrays must be ordinary");
        if (value.length > DATA_LIMITS.maximumArrayLength) throw new RangeError(label + " array bound");
        if (names.length !== value.length + 1 || names[names.length - 1] !== "length") {
          throw new TypeError(label + " arrays must be dense without extra properties");
        }
        const arrayCopy = new Array(value.length);
        for (let index = 0; index < value.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
            throw new TypeError(label + " arrays require enumerable data elements");
          }
          arrayCopy[index] = visit(descriptor.value, depth + 1, path + "[" + index + "]");
        }
        return arrayCopy;
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) throw new TypeError(label + " objects must be plain/null");
      if (names.length > DATA_LIMITS.maximumObjectFields) throw new RangeError(label + " object-field bound");
      const objectCopy = Object.create(null);
      names.forEach(function (name) {
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
          throw new TypeError(label + " objects require enumerable data properties");
        }
        objectCopy[name] = visit(descriptor.value, depth + 1, path + "/" + name);
      });
      return objectCopy;
    }
    return visit(root, 0, "/");
  }
  function plain(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
  function exact(value, fields, label) {
    if (!plain(value)) throw new TypeError(label + " must be a plain object");
    const actual = Object.keys(value).sort();
    const expected = fields.slice().sort();
    const unknown = actual.find(function (key) { return expected.indexOf(key) < 0; });
    if (unknown) throw new TypeError(label + " has unknown field " + unknown);
    const missing = expected.find(function (key) { return actual.indexOf(key) < 0; });
    if (missing) throw new TypeError(label + " is missing field " + missing);
  }
  function integer(value, minimum, maximum, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError(label + " must be a safe integer");
    if (value < minimum || value > maximum) throw new RangeError(label + " is out of range");
    return value;
  }
  function id(value, label) {
    if (typeof value !== "string" || !STABLE_ID.test(value)) throw new TypeError(label + " must be a stable ASCII ID");
    return value;
  }
  function member(value, values, label) {
    if (values.indexOf(value) < 0) throw new RangeError(label + " must be one of " + values.join(", "));
    return value;
  }
  function text(value, label) {
    if (typeof value !== "string" || value.length < 1 || value.length > 160 || value.trim() !== value ||
        CONTROL_TEXT.test(value) || /[<>]/.test(value)) throw new TypeError(label + " must be safe trimmed text");
    return value;
  }
  function add(left, right, label) {
    const value = left + right;
    if (!Number.isSafeInteger(value)) throw new RangeError(label + " overflows");
    return value;
  }
  function canonicalTarget(source, label) {
    if (!plain(source)) throw new TypeError(label + " must be a plain object");
    // Mechanism-cue union (presentation only): validated here, never by Commands-v2.
    if (hasOwn(source, "kind") && MECHANISM_CUE_TARGET_KINDS.indexOf(source.kind) !== -1) {
      exact(source, ["kind", "activationId"], label);
      return { kind: source.kind, activationId: id(source.activationId, label + " activationId") };
    }
    // Protocol union (none / route-point / tower / world-vector): syntax, routeId rules, integer
    // bounds, and signed-zero normalization are owned by CommandsV2.normalizeTarget.
    try {
      return CommandsV2.normalizeTarget(source);
    } catch (error) {
      const Rethrow = error instanceof Error ? error.constructor : Error;
      throw new Rethrow(label + ": " + (error && error.message ? error.message : String(error)));
    }
  }

  function catalog(source) {
    if (!plain(source)) throw new TypeError("Cue catalog must be a plain object");
    const output = Object.create(null);
    Object.keys(source).sort().forEach(function (key) {
      const record = source[key];
      exact(record, ["cueId", "fullMotionKind", "reducedMotionKind", "photosensitivityMotionKind",
        "eventDurationTicks", "ariaLabel"], "Cue " + key);
      if (id(record.cueId, "Cue ID") !== key) throw new RangeError("Cue key must equal cueId");
      output[key] = { cueId: key, fullMotionKind: id(record.fullMotionKind, "Full motion kind"),
        reducedMotionKind: member(record.reducedMotionKind, REDUCED_MOTION_KINDS, "Reduced motion kind"),
        photosensitivityMotionKind: member(record.photosensitivityMotionKind,
          PHOTOSENSITIVITY_MOTION_KINDS, "Photosensitivity motion kind"),
        eventDurationTicks: integer(record.eventDurationTicks, 1, Number.MAX_SAFE_INTEGER, "Event duration"),
        ariaLabel: text(record.ariaLabel, "Cue ariaLabel") };
    });
    return output;
  }
  function key(tick, ordinal, cueId) { return tick + ":" + ordinal + ":" + cueId; }
  function base(source, tickField, label, definitions) {
    const tick = integer(source[tickField], 0, Number.MAX_SAFE_INTEGER, label + " tick");
    const ordinal = integer(source.eventOrdinal, 0, MAX_EVENT_ORDINAL, label + " ordinal");
    const cueId = id(source.cueId, label + " cueId");
    if (!hasOwn(definitions, cueId)) throw new RangeError(label + " references unknown cue " + cueId);
    return { key: key(tick, ordinal, cueId), tick: tick, eventOrdinal: ordinal, cueId: cueId,
      sourceKind: member(source.sourceKind, SOURCE_KINDS, label + " sourceKind"),
      sourceId: id(source.sourceId, label + " sourceId"), target: canonicalTarget(source.target, label + " target"),
      definition: definitions[cueId] };
  }
  function pendingCue(source, index, now, definitions) {
    const label = "Pending cue " + index;
    exact(source, ["startedTick", "eventOrdinal", "cueId", "sourceKind", "sourceId", "resolveTick", "endTick", "target"], label);
    const value = base(source, "startedTick", label, definitions);
    value.resolveTick = integer(source.resolveTick, 0, Number.MAX_SAFE_INTEGER, label + " resolveTick");
    value.endTick = integer(source.endTick, 0, Number.MAX_SAFE_INTEGER, label + " endTick");
    if (value.tick > value.resolveTick || value.resolveTick > value.endTick || value.tick > now || value.endTick < now) {
      throw new RangeError(label + " has invalid pending cue tick order");
    }
    value.phase = "pending"; value.pending = true; return value;
  }
  function eventCue(source, index, now, definitions) {
    const label = "Semantic event " + index;
    exact(source, ["tick", "eventOrdinal", "cueId", "sourceKind", "sourceId", "phase", "target"], label);
    const value = base(source, "tick", label, definitions);
    if (value.tick > now) throw new RangeError(label + " is a future semantic event");
    value.phase = member(source.phase, PRESENTATION_PHASES.slice(0, -1), label + " phase");
    value.resolveTick = value.tick;
    value.endTick = add(value.tick, value.definition.eventDurationTicks, label + " endTick");
    value.pending = false; return value;
  }
  function compare(left, right) {
    if (left.tick !== right.tick) return left.tick < right.tick ? -1 : 1;
    if (left.eventOrdinal !== right.eventOrdinal) return left.eventOrdinal < right.eventOrdinal ? -1 : 1;
    return left.cueId < right.cueId ? -1 : left.cueId > right.cueId ? 1 : 0;
  }
  function progress(start, end, now) {
    if (end <= start) return now >= end ? 10000 : 0;
    const elapsed = Math.max(0, Math.min(end - start, now - start));
    return Number(BigInt(elapsed) * 10000n / BigInt(end - start));
  }
  function seconds(count) { return count + " " + (count === 1 ? "second" : "seconds"); }
  function ariaLabel(value, now, ticksPerSecond) {
    if (value.pending) {
      const resolveSeconds = Math.ceil(Math.max(0, value.resolveTick - now) / ticksPerSecond);
      return value.definition.ariaLabel + ", telegraph pending, resolves in " + seconds(resolveSeconds);
    }
    return value.definition.ariaLabel + ", " + PHASE_PHRASES[value.phase];
  }
  function project(value, now, ticksPerSecond, mode) {
    const motion = mode === "full" ? value.definition.fullMotionKind : mode === "reduced"
      ? value.definition.reducedMotionKind : value.definition.photosensitivityMotionKind;
    return { key: value.key, cueId: value.cueId, sourceKind: value.sourceKind, sourceId: value.sourceId,
      phase: value.phase, startTick: value.tick, resolveTick: value.resolveTick, endTick: value.endTick,
      remainingTicks: Math.max(0, value.endTick - now), progressBp: progress(value.tick, value.endTick, now),
      target: value.target, motionKind: motion, ariaLabel: ariaLabel(value, now, ticksPerSecond) };
  }
  function projection(active, now, ticksPerSecond, mode) {
    return { mode: mode, cues: active.map(function (cue) { return project(cue, now, ticksPerSecond, mode); }) };
  }
  function history(value) {
    return { key: value.key, tick: value.tick, eventOrdinal: value.eventOrdinal, cueId: value.cueId,
      sourceKind: value.sourceKind, sourceId: value.sourceId, phase: value.phase, target: value.target,
      ariaLabel: ariaLabel(value, value.tick, 1) };
  }

  function createTimeline(callerInput) {
    const input = preflight(callerInput, "Effect timeline input");
    exact(input, ["currentTick", "ticksPerSecond", "historyLimit", "cueCatalog", "pending", "events"], "Effect timeline input");
    const now = integer(input.currentTick, 0, Number.MAX_SAFE_INTEGER, "Current tick");
    const ticksPerSecond = integer(input.ticksPerSecond, 1, Number.MAX_SAFE_INTEGER, "Ticks per second");
    const historyLimit = integer(input.historyLimit, 1, MAX_HISTORY_LIMIT, "History limit");
    const definitions = catalog(input.cueCatalog);
    if (!Array.isArray(input.pending) || input.pending.length > MAX_PENDING_INPUT) throw new RangeError("Pending cues must be bounded");
    if (!Array.isArray(input.events) || input.events.length > MAX_EVENT_INPUT) throw new RangeError("Semantic events must be bounded");
    const pending = input.pending.map(function (value, index) { return pendingCue(value, index, now, definitions); });
    const events = input.events.map(function (value, index) { return eventCue(value, index, now, definitions); }).sort(compare);
    const keys = new Set();
    pending.concat(events).forEach(function (cue) {
      if (keys.has(cue.key)) throw new RangeError("Duplicate cue key " + cue.key);
      keys.add(cue.key);
    });
    const kept = events.slice(Math.max(0, events.length - historyLimit));
    const active = pending.concat(events.filter(function (event) { return event.endTick >= now; })).sort(compare);
    // Announce each cue once, on the tick it starts; pending telegraphs are not repeated every tick.
    const announcements = pending.concat(events).filter(function (cue) { return cue.tick === now; }).sort(compare)
      .map(function (cue) { return { key: cue.key + ":announcement", cueKey: cue.key, phase: cue.phase,
        text: ariaLabel(cue, now, ticksPerSecond) }; });
    return freeze({ schemaVersion: VERSION, currentTick: now, ticksPerSecond: ticksPerSecond,
      historyLimit: historyLimit, historyDropped: events.length - kept.length, history: kept.map(history),
      fullMotion: projection(active, now, ticksPerSecond, "full"),
      reducedMotion: projection(active, now, ticksPerSecond, "reduced"),
      photosensitivitySafe: projection(active, now, ticksPerSecond, "photosensitivity"),
      photosensitivityPolicy: PHOTOSENSITIVITY_POLICY, announcements: announcements });
  }
  return freeze({ VERSION: VERSION, MAX_EVENT_INPUT: MAX_EVENT_INPUT, MAX_PENDING_INPUT: MAX_PENDING_INPUT,
    MAX_HISTORY_LIMIT: MAX_HISTORY_LIMIT, DATA_LIMITS: DATA_LIMITS, SOURCE_KINDS: SOURCE_KINDS,
    TARGET_KINDS: TARGET_KINDS, PROTOCOL_TARGET_KINDS: PROTOCOL_TARGET_KINDS,
    MECHANISM_CUE_TARGET_KINDS: MECHANISM_CUE_TARGET_KINDS, PRESENTATION_PHASES: PRESENTATION_PHASES,
    REDUCED_MOTION_KINDS: REDUCED_MOTION_KINDS,
    PHOTOSENSITIVITY_MOTION_KINDS: PHOTOSENSITIVITY_MOTION_KINDS,
    PHOTOSENSITIVITY_POLICY: PHOTOSENSITIVITY_POLICY, createTimeline: createTimeline });
});
