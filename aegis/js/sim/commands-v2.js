/* Armara Aegis deterministic structured command records v2.
   Additive syntax validation only; command legality remains reducer-owned. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi-v2.js"), require("./commands.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSimV2) throw new Error("Game.AegisSimV2 must be installed before commands-v2.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before commands-v2.js");
  const api = factory(game.AegisSimV2, game.AegisCommands);
  if (Object.prototype.hasOwnProperty.call(game, "AegisCommandsV2")) {
    if (game.AegisCommandsV2 !== api) throw new Error("Game.AegisCommandsV2 is already installed");
    return;
  }
  Object.defineProperty(game, "AegisCommandsV2", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI, CommandsV1) {
  "use strict";

  const AUTHENTICATED_ABI_V2_SHA256 =
    "5f02c369c5331f65196090e00cdf09a7aa4458376f35057c0b5750202a0ea76b";
  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR) ||
      ABI.DESCRIPTOR.version !== 2 || ABI.COMMAND_SCHEMA_VERSION !== 2 ||
      ABI.DESCRIPTOR_SHA256 !== AUTHENTICATED_ABI_V2_SHA256 ||
      ABI.DESCRIPTOR_SHA256 !== ABI.sha256Hex(ABI.DESCRIPTOR_CANONICAL)) {
    throw new TypeError("The authenticated frozen Aegis simulation ABI v2 is required");
  }
  if (!CommandsV1 || !Object.isFrozen(CommandsV1) ||
      CommandsV1.ABI_DESCRIPTOR_SHA256 !== ABI.BASE_ABI_DESCRIPTOR_SHA256 ||
      CommandsV1.COMMAND_SCHEMA_VERSION !== 1) {
    throw new TypeError("A matching frozen Aegis command-v1 API is required");
  }
  ["assertSafeInteger"].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  ["createCommandLimits", "normalizeCommand"].forEach(function (name) {
    if (typeof CommandsV1[name] !== "function") {
      throw new TypeError("Aegis command-v1 API is missing " + name);
    }
  });

  const COMMAND_SCHEMA_VERSION = 2;
  const ADDED_COMMAND_TYPES = Object.freeze([
    "specializeTower", "activatePower", "deployReinforcement", "activateMechanism", "resetPlan",
  ]);
  const COMMAND_TYPES = Object.freeze(CommandsV1.COMMAND_TYPES.concat(ADDED_COMMAND_TYPES));
  const TARGET_KINDS = Object.freeze(["none", "route-point", "tower", "world-vector"]);
  const TARGET_FIELDS = Object.freeze({
    none: Object.freeze(["kind"]),
    "route-point": Object.freeze(["kind", "routeId", "routeDistance"]),
    tower: Object.freeze(["kind", "towerRuntimeId"]),
    "world-vector": Object.freeze(["kind", "originX", "originY", "aimX", "aimY"]),
  });
  const ADDED_COMMAND_FIELDS = Object.freeze({
    specializeTower: Object.freeze([
      "tick", "seq", "type", "towerRuntimeId", "specializationId",
    ]),
    activatePower: Object.freeze([
      "tick", "seq", "type", "protocolId", "tier", "target",
    ]),
    deployReinforcement: Object.freeze([
      "tick", "seq", "type", "reinforcementId", "markerId",
    ]),
    activateMechanism: Object.freeze([
      "tick", "seq", "type", "mechanismId", "activationId",
    ]),
    resetPlan: Object.freeze(["tick", "seq", "type"]),
  });
  const LOWERCASE_AUTHORED_ID = /^[a-z][a-z0-9._:-]*$/;
  const MAX_AUTHORED_ID_LENGTH = ABI.AUTHORED_ID_MAX_LENGTH;
  const MAX_COMMAND_FIELDS = 6;
  const MAX_TARGET_FIELDS = 5;

  (function validateV2CommandDescriptor() {
    const descriptor = ABI.DESCRIPTOR.commands;
    if (!descriptor || descriptor.schemaVersion !== COMMAND_SCHEMA_VERSION ||
        descriptor.authoredIdMaxLength !== MAX_AUTHORED_ID_LENGTH ||
        descriptor.families.length !== COMMAND_TYPES.length ||
        descriptor.targetUnion.length !== TARGET_KINDS.length) {
      throw new Error("Aegis command-v2 records do not match the authenticated ABI v2");
    }
    descriptor.families.forEach(function (family, index) {
      const type = COMMAND_TYPES[index];
      const expected = CommandsV1.COMMAND_TYPES.indexOf(type) === -1
        ? ADDED_COMMAND_FIELDS[type]
        : family.fields;
      if (family.type !== type || expected.length !== family.fields.length ||
          expected.some(function (field, fieldIndex) { return field !== family.fields[fieldIndex]; })) {
        throw new Error("Aegis command-v2 family records do not match the authenticated ABI v2");
      }
    });
    descriptor.targetUnion.forEach(function (target, index) {
      const kind = TARGET_KINDS[index];
      const expected = TARGET_FIELDS[kind];
      if (target.kind !== kind || target.fields.length !== expected.length ||
          expected.some(function (field, fieldIndex) { return field !== target.fields[fieldIndex]; })) {
        throw new Error("Aegis command-v2 targets do not match the authenticated ABI v2");
      }
    });
  })();

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
    names.forEach(function (name) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
      descriptors[name] = descriptor;
    });
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
    if (value.length > maximum) throw new RangeError("Command sequence exceeds the total command limit");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("Command sequence cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length > value.length + 1) {
      throw new TypeError("Command sequence cannot contain extra properties");
    }
    const output = new Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor) throw new TypeError("Command sequence must be a dense array");
      if (!descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError("Command sequence must contain only enumerable data elements");
      }
      output[index] = descriptor.value;
    }
    names.forEach(function (key) {
      if (key === "length") return;
      if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        throw new TypeError("Command sequence cannot contain extra properties");
      }
    });
    return output;
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

  function protocolTier(value) {
    value = positiveInteger(value, "Protocol tier");
    if (value > 3) throw new RangeError("Protocol tier must be between 1 and 3");
    return value;
  }

  function lowercaseAuthoredId(value, label) {
    if (typeof value !== "string" || value.length > MAX_AUTHORED_ID_LENGTH ||
        !LOWERCASE_AUTHORED_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase authored ID");
    }
    return value;
  }

  function normalizeTarget(input) {
    const fields = plainDataObject(input, "Protocol target", MAX_TARGET_FIELDS);
    const kind = fieldValue(fields, "kind");
    if (typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(TARGET_FIELDS, kind)) {
      throw new TypeError("Unsupported Protocol target kind");
    }
    exactFields(fields, TARGET_FIELDS[kind], kind + " Protocol target");
    if (kind === "none") return Object.freeze({ kind: kind });
    if (kind === "route-point") {
      return Object.freeze({
        kind: kind,
        routeId: lowercaseAuthoredId(fieldValue(fields, "routeId"), "Protocol target route ID"),
        routeDistance: nonnegativeInteger(
          fieldValue(fields, "routeDistance"),
          "Protocol target route distance"
        ),
      });
    }
    if (kind === "tower") {
      return Object.freeze({
        kind: kind,
        towerRuntimeId: positiveInteger(
          fieldValue(fields, "towerRuntimeId"),
          "Protocol target tower runtime ID"
        ),
      });
    }
    return Object.freeze({
      kind: kind,
      originX: safeInteger(fieldValue(fields, "originX"), "Protocol target origin X"),
      originY: safeInteger(fieldValue(fields, "originY"), "Protocol target origin Y"),
      aimX: safeInteger(fieldValue(fields, "aimX"), "Protocol target aim X"),
      aimY: safeInteger(fieldValue(fields, "aimY"), "Protocol target aim Y"),
    });
  }

  function normalizeAddedCommand(fields, type) {
    exactFields(fields, ADDED_COMMAND_FIELDS[type], type + " command");
    const tick = nonnegativeInteger(fieldValue(fields, "tick"), "Command tick");
    const seq = nonnegativeInteger(fieldValue(fields, "seq"), "Command sequence");
    if (type === "specializeTower") {
      return Object.freeze({
        tick: tick,
        seq: seq,
        type: type,
        towerRuntimeId: positiveInteger(
          fieldValue(fields, "towerRuntimeId"),
          "Specialization tower runtime ID"
        ),
        specializationId: lowercaseAuthoredId(
          fieldValue(fields, "specializationId"),
          "Specialization ID"
        ),
      });
    }
    if (type === "activatePower") {
      return Object.freeze({
        tick: tick,
        seq: seq,
        type: type,
        protocolId: lowercaseAuthoredId(fieldValue(fields, "protocolId"), "Protocol ID"),
        tier: protocolTier(fieldValue(fields, "tier")),
        target: normalizeTarget(fieldValue(fields, "target")),
      });
    }
    if (type === "deployReinforcement") {
      return Object.freeze({
        tick: tick,
        seq: seq,
        type: type,
        reinforcementId: lowercaseAuthoredId(
          fieldValue(fields, "reinforcementId"),
          "Reinforcement ID"
        ),
        markerId: lowercaseAuthoredId(fieldValue(fields, "markerId"), "Reinforcement marker ID"),
      });
    }
    if (type === "activateMechanism") {
      return Object.freeze({
        tick: tick,
        seq: seq,
        type: type,
        mechanismId: lowercaseAuthoredId(fieldValue(fields, "mechanismId"), "Mechanism ID"),
        activationId: lowercaseAuthoredId(fieldValue(fields, "activationId"), "Mechanism activation ID"),
      });
    }
    return Object.freeze({ tick: tick, seq: seq, type: type });
  }

  function assertRetainedCommandStringLimits(command) {
    Object.getOwnPropertyNames(command).forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(command, key);
      if (descriptor && typeof descriptor.value === "string" &&
          descriptor.value.length > MAX_AUTHORED_ID_LENGTH) {
        throw new TypeError(
          "Command " + key + " exceeds the " + MAX_AUTHORED_ID_LENGTH + "-code-unit authored ID ceiling"
        );
      }
    });
    return command;
  }

  function normalizeCommand(input) {
    const fields = plainDataObject(input, "Command", MAX_COMMAND_FIELDS);
    const type = fieldValue(fields, "type");
    if (typeof type !== "string" || COMMAND_TYPES.indexOf(type) === -1) {
      throw new TypeError("Unsupported command type");
    }
    if (CommandsV1.COMMAND_TYPES.indexOf(type) !== -1) {
      return assertRetainedCommandStringLimits(CommandsV1.normalizeCommand(input));
    }
    return normalizeAddedCommand(fields, type);
  }

  function createCommandLimits(overrides) {
    return CommandsV1.createCommandLimits(overrides);
  }

  function normalizeCommandSequence(inputs, limitOverrides) {
    const limits = createCommandLimits(limitOverrides);
    const source = commandArrayValues(inputs, limits.maxTotalCommands);
    const identities = new WeakSet();
    const nestedTargetIdentities = new WeakSet();
    source.forEach(function (input) {
      if (input && typeof input === "object") {
        if (identities.has(input)) {
          throw new TypeError("Command sequence cannot contain a shared reference to a command object");
        }
        identities.add(input);
        const fields = plainDataObject(input, "Command", MAX_COMMAND_FIELDS);
        if (fieldValue(fields, "type") === "activatePower") {
          const target = fieldValue(fields, "target");
          if (target && typeof target === "object") {
            if (nestedTargetIdentities.has(target)) {
              throw new TypeError("Command sequence cannot contain a shared Protocol target reference");
            }
            nestedTargetIdentities.add(target);
          }
        }
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
    TARGET_KINDS: TARGET_KINDS,
    TARGET_POLICIES: CommandsV1.TARGET_POLICIES,
    DEFAULT_LIMITS: CommandsV1.DEFAULT_LIMITS,
    createCommandLimits: createCommandLimits,
    normalizeTarget: normalizeTarget,
    normalizeCommand: normalizeCommand,
    normalizeCommandSequence: normalizeCommandSequence,
  });
});
