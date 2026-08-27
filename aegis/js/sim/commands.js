/* Armara Aegis deterministic structured command records v1.
   This module validates replay input shape and ordering only. Gameplay legality belongs to the reducer. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi.js"));
    return;
  }

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
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI) {
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
