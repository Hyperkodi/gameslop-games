/* Armara Aegis deterministic replay envelope and bound execution API v1.
   Strict, bounded parsing plus explicit immutable ruleset simulation without platform I/O. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./abi.js"),
      require("./commands.js"),
      require("./replay-runner.js")
    );
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before replay.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before replay.js");
  if (!game.AegisReplayRunner) throw new Error("Game.AegisReplayRunner must be installed before replay.js");
  const api = factory(
    game.AegisSim,
    game.AegisCommands,
    game.AegisReplayRunner
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisReplay")) {
    if (game.AegisReplay !== api) throw new Error("Game.AegisReplay is already installed");
    return;
  }
  Object.defineProperty(game, "AegisReplay", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (
  ABI,
  Commands,
  ReplayRunner
) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  ["canonicalEncode", "canonicalBytes", "utf8Bytes", "fnv1a32Hex", "sha256Hex"].forEach(
    function (name) {
      if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
    }
  );
  if (
    !Commands ||
    !Object.isFrozen(Commands) ||
    !Object.isFrozen(Commands.DEFAULT_LIMITS) ||
    typeof Commands.normalizeCommandSequence !== "function"
  ) {
    throw new TypeError("A frozen Aegis Commands API is required");
  }
  if (Commands.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new Error("Aegis Commands ABI descriptor identity does not match the simulation ABI");
  }
  if (!ReplayRunner || !Object.isFrozen(ReplayRunner) ||
      typeof ReplayRunner.createBoundSimulator !== "function") {
    throw new TypeError("A frozen Aegis ReplayRunner API is required");
  }
  if (ReplayRunner.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new Error("Aegis ReplayRunner ABI descriptor identity does not match the simulation ABI");
  }
  if (!ReplayRunner.EXECUTION_LIMITS || !Object.isFrozen(ReplayRunner.EXECUTION_LIMITS)) {
    throw new TypeError("A frozen Aegis ReplayRunner execution-limit record is required");
  }
  const EXECUTION_LIMITS = ReplayRunner.EXECUTION_LIMITS;
  const executionLimitKeys = [
    "maxAccessGrantIds", "maxCampaignModifierIds", "maxCheckpoints", "maxCommandsPerTick",
    "maxDurationTicks", "maxLoadoutIds", "maxStringLength", "maxTotalCommands",
  ];
  if (Object.keys(EXECUTION_LIMITS).sort().join("\u0000") !== executionLimitKeys.sort().join("\u0000")) {
    throw new TypeError("Aegis ReplayRunner execution-limit fields are invalid");
  }
  executionLimitKeys.forEach(function (key) {
    if (!Number.isSafeInteger(EXECUTION_LIMITS[key]) || EXECUTION_LIMITS[key] < 1) {
      throw new RangeError("Aegis ReplayRunner execution limit is invalid: " + key);
    }
  });
  if (EXECUTION_LIMITS.maxCommandsPerTick !== Commands.DEFAULT_LIMITS.maxCommandsPerTick ||
      EXECUTION_LIMITS.maxDurationTicks !== Commands.DEFAULT_LIMITS.maxTick) {
    throw new RangeError("Aegis ReplayRunner and Commands execution limits do not match");
  }

  const FORMAT_VERSION = 1;
  const EVENT_SCHEMA_VERSION = ABI.EVENT_SCHEMA_VERSION;
  const COMMAND_SCHEMA_VERSION = Commands.COMMAND_SCHEMA_VERSION;
  const MAX_UINT32 = 0xffffffff;
  const STABLE_ID = /^[a-z][a-z0-9._:-]*$/;
  const RULESET_HASH = /^sha256:[0-9a-f]{64}$/;
  const DIAGNOSTIC_HASH = /^fnv1a32:[0-9a-f]{8}$/;
  const FINAL_STATE_HASH = /^[0-9a-f]{64}$/;
  const DIFFICULTY_IDS = Object.freeze(["story", "strategos", "titan"]);
  const TOP_LEVEL_FIELDS = Object.freeze([
    "formatVersion",
    "rulesetHash",
    "eventSchemaVersion",
    "missionId",
    "difficultyId",
    "assist",
    "seed",
    "loadoutIds",
    "loadoutSlotCap",
    "campaignModifierIds",
    "accessGrantIds",
    "tutorialUpgradeGateMode",
    "inputs",
    "checkpoints",
    "finalClaim",
  ]);
  const CHECKPOINT_FIELDS = Object.freeze(["tick", "diagnosticHash"]);
  const FINAL_CLAIM_FIELDS = Object.freeze([
    "outcome",
    "score",
    "laurels",
    "durationTicks",
    "finalStateHash",
  ]);
  // Commands keeps a reusable 100,000-record hard ceiling. A portable replay is deliberately
  // tighter. ReplayRunner owns every normalized-execution ceiling so direct runner callers and
  // parsed Replay callers cannot diverge; parser-only byte/tree ceilings remain local here.
  const DEFAULT_LIMITS = Object.freeze({
    maxUtf8Bytes: 4 * 1024 * 1024,
    // A 24-hour duration processes command ticks 0..5,183,999 inclusively.
    maxTick: EXECUTION_LIMITS.maxDurationTicks - 1,
    maxTotalCommands: EXECUTION_LIMITS.maxTotalCommands,
    maxCommandsPerTick: EXECUTION_LIMITS.maxCommandsPerTick,
    maxArrayLength: 256,
    maxStringLength: EXECUTION_LIMITS.maxStringLength,
    maxObjectFields: 64,
    maxNestingDepth: 32,
    maxLoadoutIds: EXECUTION_LIMITS.maxLoadoutIds,
    maxCampaignModifierIds: EXECUTION_LIMITS.maxCampaignModifierIds,
    maxAccessGrantIds: EXECUTION_LIMITS.maxAccessGrantIds,
    maxCheckpoints: EXECUTION_LIMITS.maxCheckpoints,
    maxDurationTicks: EXECUTION_LIMITS.maxDurationTicks,
  });
  const LIMIT_KEYS = Object.freeze(Object.keys(DEFAULT_LIMITS).sort());

  if (COMMAND_SCHEMA_VERSION !== ABI.DESCRIPTOR.commands.schemaVersion) {
    throw new Error("Aegis Commands schema does not match the simulation ABI");
  }

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

  function enumerableDataNames(value, label) {
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    for (let index = 0; index < names.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, names[index]);
      if (!descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
    }
    return names;
  }

  function exactFields(value, expected, label, maximum) {
    if (!isPlainObject(value)) throw new TypeError(label + " must be a plain object");
    const names = enumerableDataNames(value, label).sort();
    if (maximum !== undefined && names.length > maximum) {
      throw new RangeError(label + " exceeds the object field limit");
    }
    const wanted = expected.slice().sort();
    if (names.length !== wanted.length || names.some(function (name, index) { return name !== wanted[index]; })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function dataValue(value, key, label) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(label + "." + key + " must be an enumerable data property");
    }
    return descriptor.value;
  }

  function createReplayLimits(overrides) {
    if (overrides === undefined) return DEFAULT_LIMITS;
    if (!isPlainObject(overrides)) throw new TypeError("Replay limits must be a plain object");
    const names = enumerableDataNames(overrides, "Replay limits").sort();
    for (let index = 0; index < names.length; index++) {
      if (LIMIT_KEYS.indexOf(names[index]) === -1) {
        throw new TypeError("Unknown replay limit " + names[index]);
      }
    }
    const result = {};
    for (let index = 0; index < LIMIT_KEYS.length; index++) {
      const key = LIMIT_KEYS[index];
      const supplied = Object.prototype.hasOwnProperty.call(overrides, key)
        ? dataValue(overrides, key, "Replay limits")
        : DEFAULT_LIMITS[key];
      if (!Number.isSafeInteger(supplied) || supplied < 0) {
        throw new RangeError("Replay limit " + key + " must be a nonnegative safe integer");
      }
      if (supplied > DEFAULT_LIMITS[key]) {
        throw new RangeError("Replay limit " + key + " cannot relax the default limit");
      }
      result[key] = supplied;
    }
    return Object.freeze(result);
  }

  function wellFormedString(value, label, maxLength) {
    if (typeof value !== "string") throw new TypeError(label + " must be a string");
    if (value.length > maxLength) throw new RangeError(label + " exceeds the string length limit");
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

  function nonnegativeInteger(value, label, maximum) {
    if (!Number.isSafeInteger(value)) throw new TypeError(label + " must be a safe integer");
    if (Object.is(value, -0)) throw new TypeError(label + " cannot be negative zero");
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    if (maximum !== undefined && value > maximum) throw new RangeError(label + " exceeds its limit");
    return value;
  }

  function exactInteger(value, expected, label) {
    if (Object.is(value, -0)) throw new TypeError(label + " cannot be negative zero");
    if (!Number.isSafeInteger(value) || value !== expected) {
      throw new RangeError(label + " must be " + expected);
    }
    return value;
  }

  function booleanValue(value, label) {
    if (typeof value !== "boolean") throw new TypeError(label + " must be boolean");
    return value;
  }

  function arrayDataValues(value, label, maximum) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    if (value.length > maximum) throw new RangeError(label + " exceeds its array length limit");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    for (let index = 0; index < value.length; index++) {
      const key = String(index);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must be a dense array of enumerable data elements");
      }
    }
    for (let index = 0; index < names.length; index++) {
      const key = names[index];
      if (key === "length") continue;
      if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        throw new TypeError(label + " cannot contain extra properties");
      }
    }
    const output = new Array(value.length);
    for (let index = 0; index < value.length; index++) {
      output[index] = Object.getOwnPropertyDescriptor(value, String(index)).value;
    }
    return output;
  }

  function idArray(value, label, maximum, limits, sorted) {
    const source = arrayDataValues(value, label, maximum);
    const output = new Array(source.length);
    let previous = null;
    const seen = Object.create(null);
    for (let index = 0; index < source.length; index++) {
      const id = stableId(source[index], label + "[" + index + "]", limits);
      if (Object.prototype.hasOwnProperty.call(seen, id)) {
        throw new TypeError(label + " must contain unique IDs");
      }
      if (sorted && previous !== null && id <= previous) {
        throw new TypeError(label + " must be in strict ASCII order");
      }
      seen[id] = true;
      previous = id;
      output[index] = id;
    }
    return output;
  }

  function cloneCanonical(value, limits, seen, depth, label) {
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) throw new TypeError(label + " numbers must be safe integers");
      if (Object.is(value, -0)) throw new TypeError(label + " cannot contain negative zero");
      return value;
    }
    if (typeof value === "string") return wellFormedString(value, label, limits.maxStringLength);
    if (!value || typeof value !== "object") throw new TypeError(label + " contains an unsupported value");
    if (depth > limits.maxNestingDepth) throw new RangeError(label + " exceeds the nesting depth limit");
    if (seen.has(value)) throw new TypeError(label + " cannot contain cycles or shared references");
    seen.add(value);

    if (Array.isArray(value)) {
      const source = arrayDataValues(value, label, limits.maxArrayLength);
      return source.map(function (item, index) {
        return cloneCanonical(item, limits, seen, depth + 1, label + "[" + index + "]");
      });
    }
    if (!isPlainObject(value)) throw new TypeError(label + " must contain only plain objects");
    const names = enumerableDataNames(value, label);
    if (names.length > limits.maxObjectFields) throw new RangeError(label + " exceeds the object field limit");
    const output = Object.create(null);
    for (let index = 0; index < names.length; index++) {
      const key = names[index];
      wellFormedString(key, label + " object key", limits.maxStringLength);
      if (!/^[\x00-\x7f]*$/.test(key)) throw new TypeError(label + " object keys must be ASCII");
      Object.defineProperty(output, key, {
        value: cloneCanonical(dataValue(value, key, label), limits, seen, depth + 1, label + "." + key),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    return output;
  }

  function decodeUtf8Strict(bytes) {
    let result = "";
    for (let index = 0; index < bytes.length;) {
      const first = bytes[index++];
      let codePoint;
      let second;
      let third;
      let fourth;
      if (first <= 0x7f) {
        codePoint = first;
      } else if (first >= 0xc2 && first <= 0xdf) {
        if (index >= bytes.length) throw new TypeError("Replay bytes contain invalid UTF-8");
        second = bytes[index++];
        if ((second & 0xc0) !== 0x80) throw new TypeError("Replay bytes contain invalid UTF-8");
        codePoint = ((first & 0x1f) << 6) | (second & 0x3f);
      } else if (first >= 0xe0 && first <= 0xef) {
        if (index + 1 >= bytes.length) throw new TypeError("Replay bytes contain invalid UTF-8");
        second = bytes[index++];
        third = bytes[index++];
        if (
          (third & 0xc0) !== 0x80 ||
          (second & 0xc0) !== 0x80 ||
          (first === 0xe0 && second < 0xa0) ||
          (first === 0xed && second >= 0xa0)
        ) {
          throw new TypeError("Replay bytes contain invalid UTF-8");
        }
        codePoint = ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
      } else if (first >= 0xf0 && first <= 0xf4) {
        if (index + 2 >= bytes.length) throw new TypeError("Replay bytes contain invalid UTF-8");
        second = bytes[index++];
        third = bytes[index++];
        fourth = bytes[index++];
        if (
          (second & 0xc0) !== 0x80 ||
          (third & 0xc0) !== 0x80 ||
          (fourth & 0xc0) !== 0x80 ||
          (first === 0xf0 && second < 0x90) ||
          (first === 0xf4 && second >= 0x90)
        ) {
          throw new TypeError("Replay bytes contain invalid UTF-8");
        }
        codePoint = (
          ((first & 0x07) << 18) |
          ((second & 0x3f) << 12) |
          ((third & 0x3f) << 6) |
          (fourth & 0x3f)
        );
      } else {
        throw new TypeError("Replay bytes contain invalid UTF-8");
      }

      if (codePoint <= 0xffff) {
        result += String.fromCharCode(codePoint);
      } else {
        const adjusted = codePoint - 0x10000;
        result += String.fromCharCode(0xd800 + (adjusted >>> 10), 0xdc00 + (adjusted & 0x3ff));
      }
    }
    return result;
  }

  function isUint8Bytes(value) {
    return Boolean(
      value &&
      typeof ArrayBuffer !== "undefined" &&
      typeof ArrayBuffer.isView === "function" &&
      ArrayBuffer.isView(value) &&
      Object.prototype.toString.call(value) === "[object Uint8Array]"
    );
  }

  function sourceText(source, limits) {
    if (typeof source === "string") {
      if (source.charCodeAt(0) === 0xfeff) throw new TypeError("Replay JSON must not contain a BOM");
      if (source.length > limits.maxUtf8Bytes) {
        throw new RangeError("Replay JSON exceeds the UTF-8 byte limit");
      }
      wellFormedString(source, "Replay JSON", Number.MAX_SAFE_INTEGER);
      const byteLength = ABI.utf8Bytes(source).length;
      if (byteLength > limits.maxUtf8Bytes) throw new RangeError("Replay JSON exceeds the UTF-8 byte limit");
      return source;
    }
    if (!isUint8Bytes(source)) {
      throw new TypeError("Replay source must be a string or Uint8Array");
    }
    if (source.length > limits.maxUtf8Bytes) throw new RangeError("Replay JSON exceeds the UTF-8 byte limit");
    const bytes = new Uint8Array(source.length);
    for (let index = 0; index < source.length; index++) bytes[index] = source[index];
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      throw new TypeError("Replay JSON must not contain a BOM");
    }
    return decodeUtf8Strict(bytes);
  }

  function parseStrictJson(text, limits) {
    let position = 0;
    const parserArrayLimit = Math.max(
      limits.maxArrayLength,
      limits.maxLoadoutIds,
      limits.maxCampaignModifierIds,
      limits.maxAccessGrantIds,
      limits.maxCheckpoints,
      limits.maxTotalCommands
    );

    function fail(message) {
      throw new SyntaxError("Invalid replay JSON at character " + position + ": " + message);
    }

    function whitespace() {
      while (position < text.length) {
        const unit = text.charCodeAt(position);
        if (unit !== 0x20 && unit !== 0x09 && unit !== 0x0a && unit !== 0x0d) break;
        position++;
      }
    }

    function stringValue() {
      if (text.charCodeAt(position) !== 0x22) fail("expected string");
      position++;
      let output = "";
      while (position < text.length) {
        const unit = text.charCodeAt(position++);
        if (unit === 0x22) {
          wellFormedString(output, "Replay JSON string", limits.maxStringLength);
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
          throw new RangeError("Replay JSON string exceeds the string length limit");
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
        do { position++; }
        while (position < text.length && text.charCodeAt(position) >= 0x30 && text.charCodeAt(position) <= 0x39);
      }
      const next = text.charAt(position);
      if (next === "." || next === "e" || next === "E") {
        fail("numbers must be integers");
      }
      const value = Number(text.slice(start, position));
      if (!Number.isSafeInteger(value)) fail("number must be a safe integer");
      if (Object.is(value, -0)) fail("negative zero is not canonical");
      return value;
    }

    function arrayValue(depth) {
      position++;
      const result = [];
      whitespace();
      if (text.charCodeAt(position) === 0x5d) {
        position++;
        return result;
      }
      while (position < text.length) {
        if (result.length >= parserArrayLimit) {
          throw new RangeError("Replay JSON array exceeds the parser array limit");
        }
        result.push(value(depth + 1));
        whitespace();
        const unit = text.charCodeAt(position++);
        if (unit === 0x5d) return result;
        if (unit !== 0x2c) fail("expected comma or closing bracket");
        whitespace();
      }
      fail("unterminated array");
    }

    function objectValue(depth) {
      position++;
      const result = Object.create(null);
      const seenKeys = Object.create(null);
      let fieldCount = 0;
      whitespace();
      if (text.charCodeAt(position) === 0x7d) {
        position++;
        return result;
      }
      while (position < text.length) {
        if (fieldCount >= limits.maxObjectFields) {
          throw new RangeError("Replay JSON object exceeds the field limit");
        }
        if (text.charCodeAt(position) !== 0x22) fail("expected object key");
        const key = stringValue();
        if (Object.prototype.hasOwnProperty.call(seenKeys, key)) fail("duplicate object key " + key);
        seenKeys[key] = true;
        whitespace();
        if (text.charCodeAt(position++) !== 0x3a) fail("expected colon");
        whitespace();
        Object.defineProperty(result, key, {
          value: value(depth + 1),
          writable: true,
          configurable: true,
          enumerable: true,
        });
        fieldCount++;
        whitespace();
        const unit = text.charCodeAt(position++);
        if (unit === 0x7d) return result;
        if (unit !== 0x2c) fail("expected comma or closing brace");
        whitespace();
      }
      fail("unterminated object");
    }

    function value(depth) {
      if (depth > limits.maxNestingDepth) throw new RangeError("Replay JSON exceeds the nesting depth limit");
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
    const parsed = value(0);
    whitespace();
    if (position !== text.length) fail("trailing data");
    return parsed;
  }

  function normalizeReplayEnvelope(envelope, limitOverrides) {
    const limits = createReplayLimits(limitOverrides);
    exactFields(envelope, TOP_LEVEL_FIELDS, "Replay envelope", limits.maxObjectFields);
    if (limits.maxNestingDepth < 2) {
      throw new RangeError("Replay envelope exceeds the nesting depth limit");
    }

    const formatVersion = exactInteger(
      dataValue(envelope, "formatVersion", "Replay envelope"),
      FORMAT_VERSION,
      "Replay format version"
    );
    const rulesetHash = dataValue(envelope, "rulesetHash", "Replay envelope");
    wellFormedString(rulesetHash, "Replay ruleset hash", limits.maxStringLength);
    if (typeof rulesetHash !== "string" || !RULESET_HASH.test(rulesetHash)) {
      throw new TypeError("Replay ruleset hash must be lowercase sha256:<64-hex>");
    }
    const eventSchemaVersion = exactInteger(
      dataValue(envelope, "eventSchemaVersion", "Replay envelope"),
      EVENT_SCHEMA_VERSION,
      "Replay event schema version"
    );
    const missionId = stableId(dataValue(envelope, "missionId", "Replay envelope"), "Mission ID", limits);
    const difficultyId = stableId(
      dataValue(envelope, "difficultyId", "Replay envelope"),
      "Difficulty ID",
      limits
    );
    if (DIFFICULTY_IDS.indexOf(difficultyId) === -1) {
      throw new RangeError("Replay difficulty ID must be story, strategos, or titan");
    }
    const assist = booleanValue(dataValue(envelope, "assist", "Replay envelope"), "Replay Assist flag");
    const seed = nonnegativeInteger(dataValue(envelope, "seed", "Replay envelope"), "Replay seed", MAX_UINT32);
    const loadoutIds = idArray(
      dataValue(envelope, "loadoutIds", "Replay envelope"),
      "Replay loadout IDs",
      limits.maxLoadoutIds,
      limits,
      false
    );
    if (loadoutIds.length === 0) throw new RangeError("Replay loadout IDs must not be empty");
    const loadoutSlotCap = nonnegativeInteger(
      dataValue(envelope, "loadoutSlotCap", "Replay envelope"),
      "Replay loadout slot cap",
      6
    );
    if (loadoutSlotCap < 1) throw new RangeError("Replay loadout slot cap must be at least one");
    if (loadoutIds.length > loadoutSlotCap) {
      throw new RangeError("Replay loadout IDs exceed the resolved slot cap");
    }
    const campaignModifierIds = idArray(
      dataValue(envelope, "campaignModifierIds", "Replay envelope"),
      "Replay campaign modifier IDs",
      limits.maxCampaignModifierIds,
      limits,
      true
    );
    const accessGrantIds = idArray(
      dataValue(envelope, "accessGrantIds", "Replay envelope"),
      "Replay access grant IDs",
      limits.maxAccessGrantIds,
      limits,
      false
    );
    const tutorialUpgradeGateMode = stableId(
      dataValue(envelope, "tutorialUpgradeGateMode", "Replay envelope"),
      "Tutorial Upgrade gate mode",
      limits
    );
    if (ABI.DESCRIPTOR.tutorialUpgradeGate.modes.indexOf(tutorialUpgradeGateMode) === -1) {
      throw new RangeError("Unsupported Tutorial Upgrade gate mode " + tutorialUpgradeGateMode);
    }

    const rawInputs = arrayDataValues(
      dataValue(envelope, "inputs", "Replay envelope"),
      "Replay inputs",
      limits.maxTotalCommands
    );
    const inputGraph = new WeakSet();
    const inputClone = rawInputs.map(function (input, index) {
      return cloneCanonical(input, limits, inputGraph, 0, "Replay input " + index);
    });
    if (inputClone.length && limits.maxNestingDepth < 3) {
      throw new RangeError("Replay inputs exceed the nesting depth limit");
    }
    const inputs = Commands.normalizeCommandSequence(inputClone, {
      maxCommandsPerTick: limits.maxCommandsPerTick,
      maxTick: limits.maxTick,
      maxTotalCommands: limits.maxTotalCommands,
    });
    if (
      !Array.isArray(inputs) ||
      inputs.length !== inputClone.length ||
      ABI.canonicalEncode(inputs) !== ABI.canonicalEncode(inputClone)
    ) {
      throw new Error("Aegis Commands must preserve every normalized replay input");
    }

    const checkpointSource = arrayDataValues(
      dataValue(envelope, "checkpoints", "Replay envelope"),
      "Replay checkpoints",
      limits.maxCheckpoints
    );
    const checkpoints = new Array(checkpointSource.length);
    if (checkpointSource.length && limits.maxNestingDepth < 3) {
      throw new RangeError("Replay checkpoints exceed the nesting depth limit");
    }
    let previousCheckpointTick = -1;
    for (let index = 0; index < checkpointSource.length; index++) {
      const source = checkpointSource[index];
      exactFields(source, CHECKPOINT_FIELDS, "Replay checkpoint " + index, limits.maxObjectFields);
      const tick = nonnegativeInteger(
        dataValue(source, "tick", "Replay checkpoint " + index),
        "Replay checkpoint tick",
        limits.maxTick
      );
      if (tick <= previousCheckpointTick) {
        throw new RangeError("Replay checkpoints must be in strictly increasing tick order");
      }
      const diagnosticHash = dataValue(source, "diagnosticHash", "Replay checkpoint " + index);
      wellFormedString(diagnosticHash, "Replay checkpoint diagnostic hash", limits.maxStringLength);
      if (typeof diagnosticHash !== "string" || !DIAGNOSTIC_HASH.test(diagnosticHash)) {
        throw new TypeError("Replay checkpoint diagnostic hash must be lowercase fnv1a32:<8-hex>");
      }
      checkpoints[index] = { tick: tick, diagnosticHash: diagnosticHash };
      previousCheckpointTick = tick;
    }

    const claimSource = dataValue(envelope, "finalClaim", "Replay envelope");
    exactFields(claimSource, FINAL_CLAIM_FIELDS, "Replay final claim", limits.maxObjectFields);
    const outcome = dataValue(claimSource, "outcome", "Replay final claim");
    wellFormedString(outcome, "Replay final outcome", limits.maxStringLength);
    if (outcome !== "victory" && outcome !== "defeat") {
      throw new RangeError("Replay final outcome must be victory or defeat");
    }
    const score = nonnegativeInteger(dataValue(claimSource, "score", "Replay final claim"), "Replay final score");
    const laurels = nonnegativeInteger(
      dataValue(claimSource, "laurels", "Replay final claim"),
      "Replay final Laurels",
      3
    );
    const durationTicks = nonnegativeInteger(
      dataValue(claimSource, "durationTicks", "Replay final claim"),
      "Replay final duration",
      limits.maxDurationTicks
    );
    const claimedHash = dataValue(claimSource, "finalStateHash", "Replay final claim");
    wellFormedString(claimedHash, "Replay final state hash", limits.maxStringLength);
    if (typeof claimedHash !== "string" || !FINAL_STATE_HASH.test(claimedHash)) {
      throw new TypeError("Replay final state hash must be lowercase 64-hex SHA-256");
    }
    if (checkpoints.length && checkpoints[checkpoints.length - 1].tick > durationTicks) {
      throw new RangeError("Replay checkpoint tick cannot exceed final duration");
    }
    // durationTicks is the resulting state tick after processing buckets 0..N-1. A command at N
    // was never processed, so this structural boundary is strict; simulation later verifies claims.
    if (inputs.length && inputs[inputs.length - 1].tick >= durationTicks) {
      throw new RangeError("Replay input tick must be strictly less than final duration");
    }

    // Direct object callers must obey the same canonical tree contract as parsed JSON. This runs
    // only after every field-specific count/depth bound above, so malformed graphs cannot bypass
    // replay resource ceilings before canonical validation.
    ABI.canonicalEncode(envelope);

    const normalized = {
      formatVersion: formatVersion,
      rulesetHash: rulesetHash,
      eventSchemaVersion: eventSchemaVersion,
      missionId: missionId,
      difficultyId: difficultyId,
      assist: assist,
      seed: seed,
      loadoutIds: loadoutIds,
      loadoutSlotCap: loadoutSlotCap,
      campaignModifierIds: campaignModifierIds,
      accessGrantIds: accessGrantIds,
      tutorialUpgradeGateMode: tutorialUpgradeGateMode,
      inputs: inputs,
      checkpoints: checkpoints,
      finalClaim: {
        outcome: outcome,
        score: score,
        laurels: laurels,
        durationTicks: durationTicks,
        finalStateHash: claimedHash,
      },
    };
    deepFreeze(normalized);
    const byteLength = ABI.canonicalBytes(normalized).length;
    if (byteLength > limits.maxUtf8Bytes) {
      throw new RangeError("Canonical replay envelope exceeds the UTF-8 byte limit");
    }
    return normalized;
  }

  function parseReplayEnvelope(source, limitOverrides) {
    const limits = createReplayLimits(limitOverrides);
    const parsed = parseStrictJson(sourceText(source, limits), limits);
    return normalizeReplayEnvelope(parsed, limits);
  }

  function normalizedEnvelope(value, limits) {
    return typeof value === "string" || isUint8Bytes(value)
      ? parseReplayEnvelope(value, limits)
      : normalizeReplayEnvelope(value, limits);
  }

  function canonicalEnvelopeString(value, limits) {
    return ABI.canonicalEncode(normalizedEnvelope(value, limits));
  }

  function canonicalEnvelopeBytes(value, limits) {
    const encoded = canonicalEnvelopeString(value, limits);
    const bytes = ABI.utf8Bytes(encoded);
    return new Uint8Array(bytes);
  }

  function diagnosticStateHash(state) {
    return "fnv1a32:" + ABI.fnv1a32Hex(ABI.canonicalBytes(state));
  }

  function finalStateHash(state) {
    return ABI.sha256Hex(ABI.canonicalBytes(state));
  }

  function createBoundSimulator(input) {
    exactFields(input, ["content", "release"], "Replay binding input", DEFAULT_LIMITS.maxObjectFields);
    return ReplayRunner.createBoundSimulator({
      content: dataValue(input, "content", "Replay binding input"),
      normalizeReplayEnvelope: normalizeReplayEnvelope,
      release: dataValue(input, "release", "Replay binding input"),
    });
  }

  return Object.freeze({
    FORMAT_VERSION: FORMAT_VERSION,
    EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
    COMMAND_SCHEMA_VERSION: COMMAND_SCHEMA_VERSION,
    DEFAULT_LIMITS: DEFAULT_LIMITS,
    createReplayLimits: createReplayLimits,
    parseReplayEnvelope: parseReplayEnvelope,
    normalizeReplayEnvelope: normalizeReplayEnvelope,
    canonicalEnvelopeString: canonicalEnvelopeString,
    canonicalEnvelopeBytes: canonicalEnvelopeBytes,
    diagnosticStateHash: diagnosticStateHash,
    finalStateHash: finalStateHash,
    createBoundSimulator: createBoundSimulator,
  });
});
