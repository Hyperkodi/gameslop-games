/* Armara Aegis player key bindings.
   Ruling R7: one printable ASCII letter or digit per action, compared
   case-insensitively. Chords, Escape, Tab, Enter, Space, and function keys are
   refused with a stable reason. Escape stays the fixed, unbindable cancel key. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  const game = root.Game = root.Game || {};
  if (!game || (typeof game !== "object" && typeof game !== "function")) {
    throw new Error("Cannot install Aegis key bindings into a non-object Game namespace");
  }
  if (Object.prototype.hasOwnProperty.call(game, "AegisKeyBindings")) {
    if (game.AegisKeyBindings !== api) throw new Error("Conflicting Game.AegisKeyBindings is already installed");
    return;
  }
  Object.defineProperty(game, "AegisKeyBindings", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PRINTABLE = /^[A-Z0-9]$/;
  const CANCEL_KEY = "Escape";

  const ACTIONS = Object.freeze([
    Object.freeze({ id: "protocolSlot1", label: "Divine Protocol slot 1", defaultKey: "1" }),
    Object.freeze({ id: "protocolSlot2", label: "Divine Protocol slot 2", defaultKey: "2" }),
    Object.freeze({ id: "reinforcement", label: "Deploy reinforcement", defaultKey: "R" }),
    Object.freeze({ id: "mechanism", label: "Activate mission mechanism", defaultKey: "M" }),
    Object.freeze({ id: "startWave", label: "Start the next wave", defaultKey: "G" }),
    Object.freeze({ id: "pause", label: "Pause or resume", defaultKey: "P" }),
  ]);
  const ACTION_IDS = Object.freeze(ACTIONS.map(function (action) { return action.id; }));
  const ACTION_BY_ID = new Map(ACTIONS.map(function (action) { return [action.id, action]; }));

  /* Keys the browser, the operating system, or the fixed cancel contract owns. */
  const RESERVED_KEYS = Object.freeze([
    CANCEL_KEY, "Tab", "Enter", "Space", " ", "Backspace", "Delete", "Home", "End",
    "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Meta", "Control", "Alt", "Shift", "ContextMenu", "CapsLock", "Insert",
  ]);
  const RESERVED_SET = new Set(RESERVED_KEYS.map(function (key) { return key.toUpperCase(); }));
  const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/i;

  const REASONS = Object.freeze({
    empty: "A shortcut needs one letter or number key.",
    chord: "Shortcuts cannot use Control, Alt, Shift, or the Command key.",
    functionKey: "Function keys are reserved by the browser.",
    reserved: "That key is reserved by the browser or by Cancel.",
    unprintable: "Use a single letter (A-Z) or number (0-9).",
    unknownAction: "That control cannot be rebound.",
    duplicate: "That key is already used by another control.",
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  const DEFAULT_BINDINGS = deepFreeze(ACTIONS.reduce(function (bindings, action) {
    bindings[action.id] = action.defaultKey;
    return bindings;
  }, {}));

  function refusal(reasonCode) {
    return deepFreeze({ ok: false, reasonCode: reasonCode, reason: REASONS[reasonCode], key: null });
  }

  /* `input` is either a raw key string or a keyboard-event-shaped record. */
  function normalizeKey(input) {
    let key = input;
    if (input && typeof input === "object") {
      if (input.ctrlKey || input.altKey || input.metaKey) return refusal("chord");
      key = input.key;
    }
    if (typeof key !== "string" || key.length === 0) return refusal("empty");
    /* Reserved keys are compared before trimming so the literal space key,
       which the browser owns, is refused as reserved rather than as empty. */
    if (RESERVED_SET.has(key.toUpperCase())) return refusal("reserved");
    const trimmed = key.trim();
    if (trimmed.length === 0) return refusal("empty");
    if (FUNCTION_KEY.test(trimmed)) return refusal("functionKey");
    if (RESERVED_SET.has(trimmed.toUpperCase())) return refusal("reserved");
    if (trimmed.length !== 1) return refusal("unprintable");
    const upper = trimmed.toUpperCase();
    if (!PRINTABLE.test(upper)) return refusal("unprintable");
    return deepFreeze({ ok: true, reasonCode: null, reason: null, key: upper });
  }

  function normalizeBindings(value) {
    const bindings = {};
    ACTION_IDS.forEach(function (actionId) {
      const source = value && Object.prototype.hasOwnProperty.call(value, actionId)
        ? value[actionId]
        : DEFAULT_BINDINGS[actionId];
      const normalized = normalizeKey(source);
      bindings[actionId] = normalized.ok ? normalized.key : DEFAULT_BINDINGS[actionId];
    });
    return deepFreeze(bindings);
  }

  function planRebind(bindingsValue, actionId, keyInput) {
    const bindings = normalizeBindings(bindingsValue);
    if (!ACTION_BY_ID.has(actionId)) {
      return deepFreeze({
        ok: false, reasonCode: "unknownAction", reason: REASONS.unknownAction, bindings: bindings,
      });
    }
    const normalized = normalizeKey(keyInput);
    if (!normalized.ok) {
      return deepFreeze({
        ok: false, reasonCode: normalized.reasonCode, reason: normalized.reason, bindings: bindings,
      });
    }
    const collision = ACTION_IDS.find(function (candidate) {
      return candidate !== actionId && bindings[candidate] === normalized.key;
    });
    if (collision) {
      return deepFreeze({
        ok: false,
        reasonCode: "duplicate",
        reason: REASONS.duplicate + " (" + ACTION_BY_ID.get(collision).label + ")",
        bindings: bindings,
      });
    }
    const next = Object.assign({}, bindings);
    next[actionId] = normalized.key;
    return deepFreeze({ ok: true, reasonCode: null, reason: null, bindings: deepFreeze(next) });
  }

  function describeBindings(bindingsValue) {
    const bindings = normalizeBindings(bindingsValue);
    return deepFreeze(ACTIONS.map(function (action) {
      return {
        id: action.id,
        label: action.label,
        key: bindings[action.id],
        defaultKey: action.defaultKey,
        isDefault: bindings[action.id] === action.defaultKey,
        ariaLabel: action.label + ", currently the " + bindings[action.id] + " key. Press a letter or number to rebind.",
      };
    }));
  }

  return deepFreeze({
    ACTIONS: ACTIONS,
    ACTION_IDS: ACTION_IDS,
    CANCEL_KEY: CANCEL_KEY,
    DEFAULT_BINDINGS: DEFAULT_BINDINGS,
    REASONS: REASONS,
    RESERVED_KEYS: RESERVED_KEYS,
    describeBindings: describeBindings,
    normalizeBindings: normalizeBindings,
    normalizeKey: normalizeKey,
    planRebind: planRebind,
  });
});
