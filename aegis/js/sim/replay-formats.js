/* Armara Aegis explicit replay-format registry.
   Callers declare the format; the registry never guesses from optional fields. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./replay.js"), require("./replay-v2.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisReplay) throw new Error("Game.AegisReplay must be installed before replay-formats.js");
  if (!game.AegisReplayV2) throw new Error("Game.AegisReplayV2 must be installed before replay-formats.js");
  const api = factory(game.AegisReplay, game.AegisReplayV2);
  if (Object.prototype.hasOwnProperty.call(game, "AegisReplayFormats")) {
    if (game.AegisReplayFormats !== api) throw new Error("Game.AegisReplayFormats is already installed");
    return;
  }
  Object.defineProperty(game, "AegisReplayFormats", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (ReplayV1, ReplayV2) {
  "use strict";

  if (!ReplayV1 || !Object.isFrozen(ReplayV1) || ReplayV1.FORMAT_VERSION !== 1) {
    throw new TypeError("A frozen replay-v1 API is required");
  }
  if (!ReplayV2 || !Object.isFrozen(ReplayV2) || ReplayV2.FORMAT_VERSION !== 2) {
    throw new TypeError("A frozen replay-v2 API is required");
  }
  [ReplayV1, ReplayV2].forEach(function (api, index) {
    ["normalizeReplayEnvelope", "parseReplayEnvelope", "canonicalEnvelopeString", "canonicalEnvelopeBytes"]
      .forEach(function (name) {
        if (typeof api[name] !== "function") {
          throw new TypeError("Replay-v" + (index + 1) + " API is missing " + name);
        }
      });
  });

  const FORMAT_VERSIONS = Object.freeze([1, 2]);

  function getReplayApi(formatVersion) {
    if (!Number.isSafeInteger(formatVersion) || Object.is(formatVersion, -0)) {
      throw new TypeError("Declared replay format version must be a safe integer");
    }
    if (formatVersion === 1) return ReplayV1;
    if (formatVersion === 2) return ReplayV2;
    throw new RangeError("Unsupported declared replay format version " + formatVersion);
  }

  function normalizeReplayEnvelope(formatVersion, value, limits) {
    return getReplayApi(formatVersion).normalizeReplayEnvelope(value, limits);
  }

  function parseReplayEnvelope(formatVersion, source, limits) {
    return getReplayApi(formatVersion).parseReplayEnvelope(source, limits);
  }

  function canonicalEnvelopeString(formatVersion, value, limits) {
    return getReplayApi(formatVersion).canonicalEnvelopeString(value, limits);
  }

  function canonicalEnvelopeBytes(formatVersion, value, limits) {
    return getReplayApi(formatVersion).canonicalEnvelopeBytes(value, limits);
  }

  return Object.freeze({
    FORMAT_VERSIONS: FORMAT_VERSIONS,
    getReplayApi: getReplayApi,
    normalizeReplayEnvelope: normalizeReplayEnvelope,
    parseReplayEnvelope: parseReplayEnvelope,
    canonicalEnvelopeString: canonicalEnvelopeString,
    canonicalEnvelopeBytes: canonicalEnvelopeBytes,
  });
});
