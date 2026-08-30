/* Generated Armara Aegis ABI-v2 identity fixture.
   Mirrors the authenticated AegisSimV2 identity exported by games/aegis/js/sim/abi-v2.js so
   the schema-v4 compiler contract can be exercised before the complete twenty-module
   simulation bundle is assemblable. It is a nonproduction fixture, never a release artifact. */
(function (root) {
  "use strict";
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }
  const DESCRIPTOR = deepFreeze(JSON.parse("{\"authoredData\":{\"numbers\":\"safe-integers-only-without-negative-zero\",\"objectGraph\":\"plain-dense-tree-only-no-accessors-symbols-cycles-or-shared-references\",\"stableIdMaxLength\":128},\"baseAbiDescriptorSha256\":\"4a788f71581d4b1c4e79318d72ae45ffa1c6b79281c3ae32e6c29f22a8b2256b\",\"behaviorRegistry\":{\"id\":\"armara-aegis-behavior-registry\",\"version\":2},\"canonicalVersion\":1,\"commands\":{\"application\":\"beginning-of-tick-in-sequence-order\",\"authoredIdMaxLength\":128,\"families\":[{\"fields\":[\"tick\",\"seq\",\"type\",\"padId\",\"defenseId\"],\"type\":\"build\"},{\"fields\":[\"tick\",\"seq\",\"type\",\"towerId\"],\"type\":\"upgrade\"},{\"fields\":[\"tick\",\"seq\",\"type\",\"towerId\"],\"type\":\"sell\"},{\"fields\":[\"tick\",\"seq\",\"type\"],\"type\":\"startWave\"},{\"fields\":[\"tick\",\"seq\",\"type\"],\"type\":\"skipTutorialGate\"},{\"fields\":[\"tick\",\"seq\",\"type\",\"towerId\",\"policy\"],\"type\":\"setTargetPolicy\"},{\"fields\":[\"tick\",\"seq\",\"type\",\"towerRuntimeId\",\"specializationId\"],\"type\":\"specializeTower\"},{\"fields\":[\"tick\",\"seq\",\"type\",\"protocolId\",\"tier\",\"target\"],\"type\":\"activatePower\"},{\"fields\":[\"tick\",\"seq\",\"type\",\"reinforcementId\",\"markerId\"],\"type\":\"deployReinforcement\"},{\"fields\":[\"tick\",\"seq\",\"type\",\"mechanismId\",\"activationId\"],\"type\":\"activateMechanism\"},{\"fields\":[\"tick\",\"seq\",\"type\"],\"type\":\"resetPlan\"}],\"recordFields\":[\"tick\",\"seq\",\"type\"],\"schemaVersion\":2,\"sequence\":\"zero-based-strictly-increasing-within-tick\",\"targetUnion\":[{\"fields\":[\"kind\"],\"kind\":\"none\"},{\"fields\":[\"kind\",\"routeId\",\"routeDistance\"],\"kind\":\"route-point\"},{\"fields\":[\"kind\",\"towerRuntimeId\"],\"kind\":\"tower\"},{\"fields\":[\"kind\",\"originX\",\"originY\",\"aimX\",\"aimY\"],\"kind\":\"world-vector\"}]},\"exactMath\":{\"reexportPolicy\":\"same-frozen-function-identities\",\"sourceAbiDescriptorSha256\":\"4a788f71581d4b1c4e79318d72ae45ffa1c6b79281c3ae32e6c29f22a8b2256b\"},\"id\":\"armara-aegis-sim-abi\",\"phaseOrder\":[\"commands-and-aether-payments\",\"expiry-and-enable-transitions\",\"scheduled-protocol-mechanism-resolutions-and-spawns\",\"spawn-movement-control-and-contact\",\"tower-and-reinforcement-acquisition-and-attacks\",\"persistent-zone-pulses-and-terminal-damage\",\"leak-arbitration-and-ward\",\"bounty-income-objectives-and-score-facts\",\"cooldown-and-effect-decrement\",\"guarded-boss-wave-mission-transition-and-event-finalization\"],\"replay\":{\"declaredFormatDispatch\":\"never-inferred-from-optional-fields\",\"formatVersion\":2},\"semanticEvents\":{\"id\":\"armara-aegis-semantic-events\",\"schemaVersion\":2},\"version\":2}"));
  const AegisSimV2 = Object.freeze({
    DESCRIPTOR: DESCRIPTOR,
    DESCRIPTOR_SHA256: "5f02c369c5331f65196090e00cdf09a7aa4458376f35057c0b5750202a0ea76b",
    EVENT_SCHEMA_VERSION: 2,
    BEHAVIOR_REGISTRY_VERSION: 2,
    COMMAND_SCHEMA_VERSION: 2,
  });
  const api = Object.freeze({ AegisSimV2: AegisSimV2 });
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  const game = root.Game = root.Game || {};
  if (Object.prototype.hasOwnProperty.call(game, "AegisSimV2")) throw new Error("Game.AegisSimV2 is already installed");
  Object.defineProperty(game, "AegisSimV2", { value: AegisSimV2, writable: false, configurable: false, enumerable: true });
})(typeof globalThis !== "undefined" ? globalThis : this);
