/* Generated Armara Aegis stable developer release alias. */
(function (root) {
  "use strict";
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }
  const DATA = deepFreeze(JSON.parse("{\"approvalState\":\"candidate-balance\",\"contentVersion\":\"candidate-v4\",\"id\":\"candidate-v4\",\"releaseArtifact\":\"aegis-release.eff46ecae4d38957e4758ed3727201f7bc31351642e8e830c08876bdfd7c0fec.js\",\"releaseEligible\":false,\"releaseHash\":\"sha256:eff46ecae4d38957e4758ed3727201f7bc31351642e8e830c08876bdfd7c0fec\",\"schemaVersion\":1}"));
  const api = deepFreeze({ RELEASE_ALIAS: DATA });
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  const game = root.Game = root.Game || {};
  if (Object.prototype.hasOwnProperty.call(game, "AegisReleaseAlias")) throw new Error("Game.AegisReleaseAlias is already installed");
  Object.defineProperty(game, "AegisReleaseAlias", { value: api, writable: false, configurable: false, enumerable: true });
})(typeof globalThis !== "undefined" ? globalThis : this);
