/* Generated Armara Aegis stable developer release alias. */
(function (root) {
  "use strict";
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }
  const DATA = deepFreeze(JSON.parse("{\"approvalState\":\"candidate-balance\",\"contentVersion\":\"slice-dev-v1\",\"id\":\"slice-dev-v1\",\"releaseArtifact\":\"aegis-release.fafdf8b93bec904307f29cde862087597d03525be5ab90f30bd02e8733f87fd9.js\",\"releaseEligible\":false,\"releaseHash\":\"sha256:fafdf8b93bec904307f29cde862087597d03525be5ab90f30bd02e8733f87fd9\",\"schemaVersion\":1}"));
  const api = deepFreeze({ RELEASE_ALIAS: DATA });
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  const game = root.Game = root.Game || {};
  if (Object.prototype.hasOwnProperty.call(game, "AegisReleaseAlias")) throw new Error("Game.AegisReleaseAlias is already installed");
  Object.defineProperty(game, "AegisReleaseAlias", { value: api, writable: false, configurable: false, enumerable: true });
})(typeof globalThis !== "undefined" ? globalThis : this);
