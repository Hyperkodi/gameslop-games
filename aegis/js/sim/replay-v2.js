/* Armara Aegis deterministic replay envelope v2.
   Extends the immutable v1 header without changing historical replay parsing. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./abi-v2.js"),
      require("./commands-v2.js"),
      require("./replay.js")
    );
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSimV2) throw new Error("Game.AegisSimV2 must be installed before replay-v2.js");
  if (!game.AegisCommandsV2) throw new Error("Game.AegisCommandsV2 must be installed before replay-v2.js");
  if (!game.AegisReplay) throw new Error("Game.AegisReplay must be installed before replay-v2.js");
  const api = factory(
    game.AegisSimV2,
    game.AegisCommandsV2,
    game.AegisReplay
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisReplayV2")) {
    if (game.AegisReplayV2 !== api) throw new Error("Game.AegisReplayV2 is already installed");
    return;
  }
  Object.defineProperty(game, "AegisReplayV2", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI, CommandsV2, ReplayV1) {
  "use strict";

  const AUTHENTICATED_ABI_V2_SHA256 =
    "5f02c369c5331f65196090e00cdf09a7aa4458376f35057c0b5750202a0ea76b";
  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR) ||
      ABI.DESCRIPTOR.version !== 2 || ABI.DESCRIPTOR_SHA256 !== AUTHENTICATED_ABI_V2_SHA256 ||
      ABI.EVENT_SCHEMA_VERSION !== 2 || ABI.BEHAVIOR_REGISTRY_VERSION !== 2) {
    throw new TypeError("The authenticated frozen Aegis simulation ABI v2 is required");
  }
  if (!CommandsV2 || !Object.isFrozen(CommandsV2) || CommandsV2.COMMAND_SCHEMA_VERSION !== 2 ||
      CommandsV2.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis command-v2 API is required");
  }
  if (!ReplayV1 || !Object.isFrozen(ReplayV1) || ReplayV1.FORMAT_VERSION !== 1 ||
      typeof ReplayV1.normalizeReplayEnvelope !== "function") {
    throw new TypeError("A frozen Aegis replay-v1 API is required");
  }

  const FORMAT_VERSION = 2;
  const EVENT_SCHEMA_VERSION = 2;
  const COMMAND_SCHEMA_VERSION = 2;
  const STABLE_ID = /^[a-z][a-z0-9._:-]*$/;
  const TOP_LEVEL_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode", "protocolLoadout", "protocolSlotCap",
    "protocolAuthority", "missionProtocolLoan", "relicIds", "relicSlotCap", "reinforcementId",
    "specializationAccessIds", "inputs", "checkpoints", "finalClaim",
  ]);
  const PROTOCOL_LOADOUT_FIELDS = Object.freeze(["slot", "protocolId", "tier"]);
  const PROTOCOL_AUTHORITY_FIELDS = Object.freeze(["protocolId", "availableTier"]);
  const PROTOCOL_LOAN_FIELDS = Object.freeze(["protocolId", "tier"]);
  const BASE_LIMIT_KEYS = Object.freeze(Object.keys(ReplayV1.DEFAULT_LIMITS));
  const DEFAULT_LIMITS = Object.freeze(Object.assign({}, ReplayV1.DEFAULT_LIMITS, {
    maxProtocolLoadout: 2,
    maxProtocolAuthority: 64,
    maxRelicIds: 2,
    maxSpecializationAccessIds: 30,
  }));
  const LIMIT_KEYS = Object.freeze(Object.keys(DEFAULT_LIMITS).sort());

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function dataNames(value, label) {
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    names.forEach(function (name) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
    });
    return names;
  }

  function dataValue(value, key, label) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(label + "." + key + " must be an enumerable data property");
    }
    return descriptor.value;
  }

  function exactFields(value, expected, label, maximum) {
    if (!isPlainObject(value)) throw new TypeError(label + " must be a plain object");
    const actual = dataNames(value, label).sort();
    const wanted = expected.slice().sort();
    if (actual.length > maximum) throw new RangeError(label + " exceeds the object field limit");
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function wellFormedString(value, label, maximum) {
    if (typeof value !== "string") throw new TypeError(label + " must be a string");
    if (value.length > maximum) throw new RangeError(label + " exceeds the string length limit");
    for (let index = 0; index < value.length; index++) {
      const unit = value.charCodeAt(index);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) {
          throw new TypeError(label + " contains a lone Unicode surrogate");
        }
        index++;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) {
        throw new TypeError(label + " contains a lone Unicode surrogate");
      }
    }
    return value;
  }

  function stableId(value, label, limits) {
    wellFormedString(value, label, limits.maxStringLength);
    if (!STABLE_ID.test(value)) throw new TypeError(label + " must be a stable ASCII ID");
    return value;
  }

  function safeInteger(value, label, minimum, maximum) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(label + " must be a safe integer without negative zero");
    }
    if (value < minimum || value > maximum) {
      throw new RangeError(label + " must be between " + minimum + " and " + maximum);
    }
    return value;
  }

  function exactInteger(value, expected, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0) || value !== expected) {
      throw new RangeError(label + " must be " + expected);
    }
    return value;
  }

  function arrayValues(value, label, maximum) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError(label + " must be a plain array");
    }
    if (value.length > maximum) throw new RangeError(label + " exceeds its array length limit");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    const output = new Array(value.length);
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must be a dense array of enumerable data properties");
      }
      output[index] = descriptor.value;
    }
    names.forEach(function (name) {
      if (name === "length") return;
      if (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= value.length) {
        throw new TypeError(label + " cannot contain extra properties");
      }
    });
    return output;
  }

  function createReplayLimits(overrides) {
    if (overrides === undefined) return DEFAULT_LIMITS;
    if (!isPlainObject(overrides)) throw new TypeError("Replay-v2 limits must be a plain object");
    const names = dataNames(overrides, "Replay-v2 limits").sort();
    names.forEach(function (name) {
      if (LIMIT_KEYS.indexOf(name) === -1) throw new TypeError("Unknown replay-v2 limit " + name);
    });
    const output = {};
    LIMIT_KEYS.forEach(function (name) {
      const supplied = Object.prototype.hasOwnProperty.call(overrides, name)
        ? dataValue(overrides, name, "Replay-v2 limits")
        : DEFAULT_LIMITS[name];
      if (!Number.isSafeInteger(supplied) || Object.is(supplied, -0) || supplied < 0) {
        throw new RangeError("Replay-v2 limit " + name + " must be a nonnegative safe integer");
      }
      if (supplied > DEFAULT_LIMITS[name]) {
        throw new RangeError("Replay-v2 limit " + name + " cannot relax the default limit");
      }
      output[name] = supplied;
    });
    return Object.freeze(output);
  }

  function cloneDataGraph(value, limits) {
    const seen = new WeakSet();
    let objectNodes = 0;
    const maximumArray = Math.max(
      limits.maxArrayLength,
      limits.maxTotalCommands,
      limits.maxCheckpoints,
      limits.maxLoadoutIds,
      limits.maxCampaignModifierIds,
      limits.maxAccessGrantIds,
      limits.maxProtocolLoadout,
      limits.maxProtocolAuthority,
      limits.maxRelicIds,
      limits.maxSpecializationAccessIds
    );
    const maximumNodes = 256 + (limits.maxTotalCommands * 3);

    function clone(valueAtPath, path, depth) {
      if (valueAtPath === null || typeof valueAtPath === "boolean") return valueAtPath;
      if (typeof valueAtPath === "number") {
        if (!Number.isSafeInteger(valueAtPath) || Object.is(valueAtPath, -0)) {
          throw new TypeError(path + " numbers must be safe integers without negative zero");
        }
        return valueAtPath;
      }
      if (typeof valueAtPath === "string") {
        return wellFormedString(valueAtPath, path, limits.maxStringLength);
      }
      if (!valueAtPath || typeof valueAtPath !== "object") {
        throw new TypeError(path + " contains unsupported non-JSON data");
      }
      if (depth > limits.maxNestingDepth) throw new RangeError(path + " exceeds the nesting depth limit");
      if (seen.has(valueAtPath)) throw new TypeError(path + " contains a cycle or shared reference");
      seen.add(valueAtPath);
      objectNodes++;
      if (objectNodes > maximumNodes) throw new RangeError("Replay-v2 object graph exceeds its node limit");

      if (Array.isArray(valueAtPath)) {
        return arrayValues(valueAtPath, path, maximumArray).map(function (entry, index) {
          return clone(entry, path + "[" + index + "]", depth + 1);
        });
      }
      if (!isPlainObject(valueAtPath)) throw new TypeError(path + " must contain plain data objects");
      const names = dataNames(valueAtPath, path);
      if (names.length > limits.maxObjectFields) throw new RangeError(path + " exceeds the object field limit");
      const output = Object.create(null);
      names.forEach(function (name) {
        wellFormedString(name, path + " object key", limits.maxStringLength);
        if (!/^[\x00-\x7f]*$/.test(name)) throw new TypeError(path + " object keys must be ASCII");
        Object.defineProperty(output, name, {
          value: clone(dataValue(valueAtPath, name, path), path + "." + name, depth + 1),
          writable: true,
          configurable: true,
          enumerable: true,
        });
      });
      return output;
    }

    return clone(value, "Replay-v2 envelope", 0);
  }

  function orderedIdArray(value, label, maximum, limits) {
    const source = arrayValues(value, label, maximum);
    const output = [];
    let previous = null;
    source.forEach(function (entry, index) {
      const id = stableId(entry, label + "[" + index + "]", limits);
      if (previous !== null && id <= previous) {
        throw new TypeError(label + " must contain unique IDs in strict ASCII order");
      }
      previous = id;
      output.push(id);
    });
    return output;
  }

  function normalizeProtocolAuthority(value, limits) {
    const source = arrayValues(value, "Protocol authority", limits.maxProtocolAuthority);
    let previous = null;
    return source.map(function (record, index) {
      exactFields(record, PROTOCOL_AUTHORITY_FIELDS, "Protocol authority entry " + index, limits.maxObjectFields);
      const protocolId = stableId(
        dataValue(record, "protocolId", "Protocol authority entry"),
        "Protocol authority protocolId",
        limits
      );
      if (previous !== null && protocolId <= previous) {
        throw new TypeError("Protocol authority must contain unique Protocol IDs in strict ASCII order");
      }
      previous = protocolId;
      return {
        protocolId: protocolId,
        availableTier: safeInteger(
          dataValue(record, "availableTier", "Protocol authority entry"),
          "Protocol available tier", 1, 3
        ),
      };
    });
  }

  function normalizeProtocolLoadout(value, slotCap, authority, limits) {
    const source = arrayValues(value, "Protocol loadout", limits.maxProtocolLoadout);
    if (source.length > slotCap) throw new RangeError("Protocol loadout exceeds its Protocol slot cap");
    const ids = new Set();
    let previousSlot = -1;
    return source.map(function (record, index) {
      exactFields(record, PROTOCOL_LOADOUT_FIELDS, "Protocol loadout entry " + index, limits.maxObjectFields);
      const slot = safeInteger(dataValue(record, "slot", "Protocol loadout entry"), "Protocol slot", 0, 1);
      if (slot >= slotCap) throw new RangeError("Protocol loadout entry exceeds its Protocol slot cap");
      if (slot <= previousSlot) throw new TypeError("Protocol slots must be unique and in strict slot order");
      previousSlot = slot;
      const protocolId = stableId(
        dataValue(record, "protocolId", "Protocol loadout entry"),
        "Protocol loadout protocolId",
        limits
      );
      if (ids.has(protocolId)) throw new TypeError("Protocol loadout must contain unique Protocol IDs");
      ids.add(protocolId);
      const tier = safeInteger(dataValue(record, "tier", "Protocol loadout entry"), "Protocol tier", 1, 3);
      const owned = authority.get(protocolId);
      if (owned === undefined) throw new TypeError("Equipped Protocol requires permanent Protocol authority");
      if (tier > owned) throw new RangeError("Equipped Protocol tier exceeds its available tier");
      return {
        slot: slot,
        protocolId: protocolId,
        tier: tier,
      };
    });
  }

  function normalizeProtocolLoan(value, equippedIds, limits) {
    if (value === null) return null;
    exactFields(value, PROTOCOL_LOAN_FIELDS, "Mission Protocol loan", limits.maxObjectFields);
    const protocolId = stableId(
      dataValue(value, "protocolId", "Mission Protocol loan"),
      "Mission Protocol loan protocolId",
      limits
    );
    if (equippedIds.has(protocolId)) {
      throw new TypeError("Mission Protocol loan cannot duplicate an equipped Protocol");
    }
    return {
      protocolId: protocolId,
      tier: safeInteger(dataValue(value, "tier", "Mission Protocol loan"), "Mission Protocol loan tier", 1, 1),
    };
  }

  function v1Limits(limits) {
    const output = {};
    BASE_LIMIT_KEYS.forEach(function (key) { output[key] = limits[key]; });
    return output;
  }

  function normalizeReplayEnvelope(envelope, limitOverrides) {
    const limits = createReplayLimits(limitOverrides);
    const source = cloneDataGraph(envelope, limits);
    exactFields(source, TOP_LEVEL_FIELDS, "Replay-v2 envelope", limits.maxObjectFields);
    if (limits.maxNestingDepth < 3) throw new RangeError("Replay-v2 envelope exceeds the nesting depth limit");

    exactInteger(dataValue(source, "formatVersion", "Replay-v2 envelope"), FORMAT_VERSION, "Replay format version");
    exactInteger(
      dataValue(source, "eventSchemaVersion", "Replay-v2 envelope"),
      EVENT_SCHEMA_VERSION,
      "Replay event schema version"
    );

    const base = ReplayV1.normalizeReplayEnvelope({
      formatVersion: 1,
      rulesetHash: dataValue(source, "rulesetHash", "Replay-v2 envelope"),
      eventSchemaVersion: 1,
      missionId: dataValue(source, "missionId", "Replay-v2 envelope"),
      difficultyId: dataValue(source, "difficultyId", "Replay-v2 envelope"),
      assist: dataValue(source, "assist", "Replay-v2 envelope"),
      seed: dataValue(source, "seed", "Replay-v2 envelope"),
      loadoutIds: dataValue(source, "loadoutIds", "Replay-v2 envelope"),
      loadoutSlotCap: dataValue(source, "loadoutSlotCap", "Replay-v2 envelope"),
      campaignModifierIds: dataValue(source, "campaignModifierIds", "Replay-v2 envelope"),
      accessGrantIds: dataValue(source, "accessGrantIds", "Replay-v2 envelope"),
      tutorialUpgradeGateMode: dataValue(source, "tutorialUpgradeGateMode", "Replay-v2 envelope"),
      inputs: [],
      checkpoints: dataValue(source, "checkpoints", "Replay-v2 envelope"),
      finalClaim: dataValue(source, "finalClaim", "Replay-v2 envelope"),
    }, v1Limits(limits));

    const protocolSlotCap = safeInteger(
      dataValue(source, "protocolSlotCap", "Replay-v2 envelope"),
      "Protocol slot cap",
      0,
      limits.maxProtocolLoadout
    );
    const protocolAuthority = normalizeProtocolAuthority(
      dataValue(source, "protocolAuthority", "Replay-v2 envelope"), limits
    );
    const authority = new Map(protocolAuthority.map(function (entry) {
      return [entry.protocolId, entry.availableTier];
    }));
    const protocolLoadout = normalizeProtocolLoadout(
      dataValue(source, "protocolLoadout", "Replay-v2 envelope"),
      protocolSlotCap,
      authority,
      limits
    );
    const equippedIds = new Set(protocolLoadout.map(function (entry) { return entry.protocolId; }));
    const missionProtocolLoan = normalizeProtocolLoan(
      dataValue(source, "missionProtocolLoan", "Replay-v2 envelope"),
      equippedIds,
      limits
    );
    const relicSlotCap = safeInteger(
      dataValue(source, "relicSlotCap", "Replay-v2 envelope"),
      "Relic slot cap",
      0,
      limits.maxRelicIds
    );
    const relicIds = orderedIdArray(
      dataValue(source, "relicIds", "Replay-v2 envelope"),
      "Relic IDs",
      limits.maxRelicIds,
      limits
    );
    if (relicIds.length > relicSlotCap) throw new RangeError("Relic IDs exceed the Relic slot cap");
    const reinforcementValue = dataValue(source, "reinforcementId", "Replay-v2 envelope");
    const reinforcementId = reinforcementValue === null
      ? null
      : stableId(reinforcementValue, "Reinforcement ID", limits);
    const specializationAccessIds = orderedIdArray(
      dataValue(source, "specializationAccessIds", "Replay-v2 envelope"),
      "Specialization access IDs",
      limits.maxSpecializationAccessIds,
      limits
    );

    const inputs = CommandsV2.normalizeCommandSequence(
      dataValue(source, "inputs", "Replay-v2 envelope"),
      {
        maxTick: limits.maxTick,
        maxTotalCommands: limits.maxTotalCommands,
        maxCommandsPerTick: limits.maxCommandsPerTick,
      }
    );
    if (inputs.length && inputs[inputs.length - 1].tick >= base.finalClaim.durationTicks) {
      throw new RangeError("Replay input tick must be strictly less than final duration");
    }

    const normalized = {
      formatVersion: FORMAT_VERSION,
      rulesetHash: base.rulesetHash,
      eventSchemaVersion: EVENT_SCHEMA_VERSION,
      missionId: base.missionId,
      difficultyId: base.difficultyId,
      assist: base.assist,
      seed: base.seed,
      loadoutIds: base.loadoutIds.slice(),
      loadoutSlotCap: base.loadoutSlotCap,
      campaignModifierIds: base.campaignModifierIds.slice(),
      accessGrantIds: base.accessGrantIds.slice(),
      tutorialUpgradeGateMode: base.tutorialUpgradeGateMode,
      protocolLoadout: protocolLoadout,
      protocolSlotCap: protocolSlotCap,
      protocolAuthority: protocolAuthority,
      missionProtocolLoan: missionProtocolLoan,
      relicIds: relicIds,
      relicSlotCap: relicSlotCap,
      reinforcementId: reinforcementId,
      specializationAccessIds: specializationAccessIds,
      inputs: inputs.slice(),
      checkpoints: base.checkpoints.map(function (checkpoint) {
        return { tick: checkpoint.tick, diagnosticHash: checkpoint.diagnosticHash };
      }),
      finalClaim: {
        outcome: base.finalClaim.outcome,
        score: base.finalClaim.score,
        laurels: base.finalClaim.laurels,
        durationTicks: base.finalClaim.durationTicks,
        finalStateHash: base.finalClaim.finalStateHash,
      },
    };
    deepFreeze(normalized);
    if (ABI.canonicalBytes(normalized).length > limits.maxUtf8Bytes) {
      throw new RangeError("Canonical replay-v2 envelope exceeds the UTF-8 byte limit");
    }
    return normalized;
  }

  function decodeUtf8Strict(bytes) {
    let output = "";
    for (let index = 0; index < bytes.length;) {
      const first = bytes[index++];
      let point;
      let second;
      let third;
      let fourth;
      if (first <= 0x7f) {
        point = first;
      } else if (first >= 0xc2 && first <= 0xdf) {
        if (index >= bytes.length) throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        second = bytes[index++];
        if ((second & 0xc0) !== 0x80) throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        point = ((first & 0x1f) << 6) | (second & 0x3f);
      } else if (first >= 0xe0 && first <= 0xef) {
        if (index + 1 >= bytes.length) throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        second = bytes[index++];
        third = bytes[index++];
        if ((second & 0xc0) !== 0x80 || (third & 0xc0) !== 0x80 ||
            (first === 0xe0 && second < 0xa0) || (first === 0xed && second >= 0xa0)) {
          throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        }
        point = ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
      } else if (first >= 0xf0 && first <= 0xf4) {
        if (index + 2 >= bytes.length) throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        second = bytes[index++];
        third = bytes[index++];
        fourth = bytes[index++];
        if ((second & 0xc0) !== 0x80 || (third & 0xc0) !== 0x80 || (fourth & 0xc0) !== 0x80 ||
            (first === 0xf0 && second < 0x90) || (first === 0xf4 && second >= 0x90)) {
          throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
        }
        point = ((first & 7) << 18) | ((second & 63) << 12) | ((third & 63) << 6) | (fourth & 63);
      } else {
        throw new TypeError("Replay-v2 bytes contain invalid UTF-8");
      }
      if (point <= 0xffff) {
        output += String.fromCharCode(point);
      } else {
        const adjusted = point - 0x10000;
        output += String.fromCharCode(0xd800 + (adjusted >>> 10), 0xdc00 + (adjusted & 0x3ff));
      }
    }
    return output;
  }

  function sourceText(source, limits) {
    if (typeof source === "string") {
      if (source.charCodeAt(0) === 0xfeff) throw new TypeError("Replay-v2 JSON must not contain a BOM");
      wellFormedString(source, "Replay-v2 JSON", Number.MAX_SAFE_INTEGER);
      if (source.length > limits.maxUtf8Bytes || ABI.utf8Bytes(source).length > limits.maxUtf8Bytes) {
        throw new RangeError("Replay-v2 JSON exceeds the UTF-8 byte limit");
      }
      return source;
    }
    const isBytes = Boolean(source && typeof ArrayBuffer !== "undefined" &&
      typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(source) &&
      Object.prototype.toString.call(source) === "[object Uint8Array]");
    if (!isBytes) throw new TypeError("Replay-v2 source must be a string or Uint8Array");
    if (source.length > limits.maxUtf8Bytes) throw new RangeError("Replay-v2 JSON exceeds the UTF-8 byte limit");
    const bytes = new Uint8Array(source.length);
    for (let index = 0; index < source.length; index++) bytes[index] = source[index];
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      throw new TypeError("Replay-v2 JSON must not contain a BOM");
    }
    return decodeUtf8Strict(bytes);
  }

  function parseStrictJson(text, limits) {
    let position = 0;
    const arrayLimit = Math.max(
      limits.maxArrayLength,
      limits.maxTotalCommands,
      limits.maxCheckpoints,
      limits.maxLoadoutIds,
      limits.maxCampaignModifierIds,
      limits.maxAccessGrantIds,
      limits.maxSpecializationAccessIds
    );

    function fail(message) {
      throw new SyntaxError("Invalid replay-v2 JSON at character " + position + ": " + message);
    }
    function whitespace() {
      while (position < text.length && /[ \t\r\n]/.test(text.charAt(position))) position++;
    }
    function stringValue() {
      if (text.charCodeAt(position) !== 0x22) fail("expected string");
      position++;
      let output = "";
      while (position < text.length) {
        const unit = text.charCodeAt(position++);
        if (unit === 0x22) {
          wellFormedString(output, "Replay-v2 JSON string", limits.maxStringLength);
          return output;
        }
        if (unit <= 0x1f) fail("unescaped control character in string");
        if (unit !== 0x5c) {
          output += String.fromCharCode(unit);
        } else {
          if (position >= text.length) fail("unterminated escape");
          const escaped = text.charAt(position++);
          const simple = { '"': '"', "\\": "\\", "/": "/", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t" };
          if (Object.prototype.hasOwnProperty.call(simple, escaped)) {
            output += simple[escaped];
          } else if (escaped === "u") {
            if (position + 4 > text.length) fail("short Unicode escape");
            const digits = text.slice(position, position + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail("invalid Unicode escape");
            output += String.fromCharCode(parseInt(digits, 16));
            position += 4;
          } else {
            fail("invalid string escape");
          }
        }
        if (output.length > limits.maxStringLength) {
          throw new RangeError("Replay-v2 JSON string exceeds the string length limit");
        }
      }
      fail("unterminated string");
    }
    function numberValue() {
      const start = position;
      if (text.charCodeAt(position) === 0x2d) position++;
      if (text.charCodeAt(position) === 0x30) {
        position++;
      } else {
        const first = text.charCodeAt(position);
        if (first < 0x31 || first > 0x39) fail("invalid number");
        while (position < text.length && text.charCodeAt(position) >= 0x30 &&
               text.charCodeAt(position) <= 0x39) position++;
      }
      if (/[.eE]/.test(text.charAt(position))) fail("numbers must be integers");
      const output = Number(text.slice(start, position));
      if (!Number.isSafeInteger(output)) fail("number must be a safe integer");
      if (Object.is(output, -0)) fail("negative zero is not canonical");
      return output;
    }
    function arrayValue(depth) {
      position++;
      const output = [];
      whitespace();
      if (text.charCodeAt(position) === 0x5d) { position++; return output; }
      while (position < text.length) {
        if (output.length >= arrayLimit) throw new RangeError("Replay-v2 JSON array exceeds its limit");
        output.push(value(depth + 1));
        whitespace();
        const unit = text.charCodeAt(position++);
        if (unit === 0x5d) return output;
        if (unit !== 0x2c) fail("expected comma or closing bracket");
        whitespace();
      }
      fail("unterminated array");
    }
    function objectValue(depth) {
      position++;
      const output = Object.create(null);
      const keys = Object.create(null);
      let fields = 0;
      whitespace();
      if (text.charCodeAt(position) === 0x7d) { position++; return output; }
      while (position < text.length) {
        if (fields >= limits.maxObjectFields) throw new RangeError("Replay-v2 JSON object exceeds its field limit");
        if (text.charCodeAt(position) !== 0x22) fail("expected object key");
        const key = stringValue();
        if (Object.prototype.hasOwnProperty.call(keys, key)) fail("duplicate object key " + key);
        keys[key] = true;
        whitespace();
        if (text.charCodeAt(position++) !== 0x3a) fail("expected colon");
        whitespace();
        Object.defineProperty(output, key, {
          value: value(depth + 1), writable: true, configurable: true, enumerable: true,
        });
        fields++;
        whitespace();
        const unit = text.charCodeAt(position++);
        if (unit === 0x7d) return output;
        if (unit !== 0x2c) fail("expected comma or closing brace");
        whitespace();
      }
      fail("unterminated object");
    }
    function value(depth) {
      if (depth > limits.maxNestingDepth) throw new RangeError("Replay-v2 JSON exceeds the nesting depth limit");
      whitespace();
      const unit = text.charCodeAt(position);
      if (unit === 0x22) return stringValue();
      if (unit === 0x7b) return objectValue(depth);
      if (unit === 0x5b) return arrayValue(depth);
      if (unit === 0x2d || (unit >= 0x30 && unit <= 0x39)) return numberValue();
      if (text.slice(position, position + 4) === "true") { position += 4; return true; }
      if (text.slice(position, position + 5) === "false") { position += 5; return false; }
      if (text.slice(position, position + 4) === "null") { position += 4; return null; }
      fail("unexpected token");
    }

    whitespace();
    const output = value(0);
    whitespace();
    if (position !== text.length) fail("trailing data");
    return output;
  }

  function parseReplayEnvelope(source, limitOverrides) {
    const limits = createReplayLimits(limitOverrides);
    return normalizeReplayEnvelope(parseStrictJson(sourceText(source, limits), limits), limits);
  }

  function normalizedEnvelope(value, limits) {
    return typeof value === "string" || (value && typeof ArrayBuffer !== "undefined" &&
      typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(value))
      ? parseReplayEnvelope(value, limits)
      : normalizeReplayEnvelope(value, limits);
  }

  function canonicalEnvelopeString(value, limits) {
    return ABI.canonicalEncode(normalizedEnvelope(value, limits));
  }

  function canonicalEnvelopeBytes(value, limits) {
    return new Uint8Array(ABI.utf8Bytes(canonicalEnvelopeString(value, limits)));
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    FORMAT_VERSION: FORMAT_VERSION,
    EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
    COMMAND_SCHEMA_VERSION: COMMAND_SCHEMA_VERSION,
    DEFAULT_LIMITS: DEFAULT_LIMITS,
    createReplayLimits: createReplayLimits,
    parseReplayEnvelope: parseReplayEnvelope,
    normalizeReplayEnvelope: normalizeReplayEnvelope,
    canonicalEnvelopeString: canonicalEnvelopeString,
    canonicalEnvelopeBytes: canonicalEnvelopeBytes,
    diagnosticStateHash: ReplayV1.diagnosticStateHash,
    finalStateHash: ReplayV1.finalStateHash,
  });
});
