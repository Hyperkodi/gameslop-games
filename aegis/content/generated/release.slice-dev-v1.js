/* Generated Armara Aegis stable developer release alias. */
(function (root) {
  "use strict";
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }
  const DATA = deepFreeze(JSON.parse("{\"approvalState\":\"candidate-balance\",\"contentVersion\":\"slice-dev-v1\",\"id\":\"slice-dev-v1\",\"releaseArtifact\":\"aegis-release.2088026d70b83101f0a1e6399685d79f3d95673708eaed92842d1e01dcba0309.js\",\"releaseEligible\":false,\"releaseHash\":\"sha256:2088026d70b83101f0a1e6399685d79f3d95673708eaed92842d1e01dcba0309\",\"schemaVersion\":1}"));
  const api = deepFreeze({ RELEASE_ALIAS: DATA });
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  const game = root.Game = root.Game || {};
  if (Object.prototype.hasOwnProperty.call(game, "AegisReleaseAlias")) throw new Error("Game.AegisReleaseAlias is already installed");
  Object.defineProperty(game, "AegisReleaseAlias", { value: api, writable: false, configurable: false, enumerable: true });
})(typeof globalThis !== "undefined" ? globalThis : this);
