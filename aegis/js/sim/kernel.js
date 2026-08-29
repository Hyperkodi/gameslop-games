/* Armara Aegis authoritative Candidate-slice fixed-tick kernel v1.
   This module binds immutable release/content identities and owns the canonical simulation state.
   Presentation, profile state, wall-clock time, and renderer callbacks are deliberately absent. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./abi.js"),
      require("./geometry.js"),
      require("./timers.js"),
      require("./economy.js"),
      require("./movement.js"),
      require("./effects.js"),
      require("./targeting.js"),
      require("./behaviors.js"),
      require("./commands.js"),
      require("./management.js"),
      require("./objectives.js")
    );
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before kernel.js");
  if (!game.AegisGeometry) throw new Error("Game.AegisGeometry must be installed before kernel.js");
  if (!game.AegisTimers) throw new Error("Game.AegisTimers must be installed before kernel.js");
  if (!game.AegisEconomy) throw new Error("Game.AegisEconomy must be installed before kernel.js");
  if (!game.AegisMovement) throw new Error("Game.AegisMovement must be installed before kernel.js");
  if (!game.AegisEffects) throw new Error("Game.AegisEffects must be installed before kernel.js");
  if (!game.AegisTargeting) throw new Error("Game.AegisTargeting must be installed before kernel.js");
  if (!game.AegisBehaviors) throw new Error("Game.AegisBehaviors must be installed before kernel.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before kernel.js");
  if (!game.AegisManagement) throw new Error("Game.AegisManagement must be installed before kernel.js");
  if (!game.AegisObjectives) throw new Error("Game.AegisObjectives must be installed before kernel.js");
  const api = factory(
    game.AegisSim,
    game.AegisGeometry,
    game.AegisTimers,
    game.AegisEconomy,
    game.AegisMovement,
    game.AegisEffects,
    game.AegisTargeting,
    game.AegisBehaviors,
    game.AegisCommands,
    game.AegisManagement,
    game.AegisObjectives
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisKernel")) {
    if (game.AegisKernel !== api) throw new Error("Game.AegisKernel is already installed");
    return;
  }
  Object.defineProperty(game, "AegisKernel", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (
  ABI,
  Geometry,
  Timers,
  Economy,
  Movement,
  Effects,
  Targeting,
  Behaviors,
  Commands,
  Management,
  Objectives
) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  const dependencies = [
    Geometry, Timers, Economy, Movement, Effects, Targeting, Behaviors, Commands, Management,
    Objectives,
  ];
  dependencies.forEach(function (dependency, index) {
    if (!dependency || !Object.isFrozen(dependency) ||
        dependency.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
      throw new TypeError("A frozen ABI-matched kernel dependency is required at index " + index);
    }
  });
  [
    "assertSafeInteger", "canonicalEncode", "checkedAdd", "checkedMulDivFloor", "sha256Hex",
  ].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  if (Commands.COMMAND_SCHEMA_VERSION !== ABI.DESCRIPTOR.commands.schemaVersion) {
    throw new Error("Aegis command schema identity does not match the simulation ABI");
  }
  if (Behaviors.EVENT_SCHEMA_VERSION !== ABI.EVENT_SCHEMA_VERSION ||
      Behaviors.BEHAVIOR_REGISTRY_VERSION !== ABI.BEHAVIOR_REGISTRY_VERSION) {
    throw new Error("Aegis behavior identities do not match the simulation ABI");
  }

  const KERNEL_SCHEMA_VERSION = 1;
  const BALANCE_TELEMETRY_SCHEMA_VERSION = 1;
  const MAX_ACTIVE_ENTITIES = 4096;
  const MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK = 65536;
  const MAX_BALANCE_TELEMETRY_TARGET_IDS = 4096;
  const MAX_LOADOUT_IDS = 6;
  const MAX_TARGET_CANDIDATES = 4096;
  const MAX_SEMANTIC_EVENTS_PER_TICK = 16384;
  const MAX_UINT32 = 0xffffffff;
  const HASH = /^sha256:[0-9a-f]{64}$/;
  const STABLE_LOWERCASE_ID = /^[a-z][a-z0-9._:-]*$/;
  const RELEASE_FIELDS = Object.freeze([
    "abiHash", "annexHash", "approvalState", "behaviorRegistryVersion", "contentArtifact",
    "contentHash", "contentVersion", "eventSchemaVersion", "includedIds", "presentationArtifact",
    "presentationHash", "releaseEligible", "rulesetHash", "schemaVersion", "simulationArtifact",
    "simulationHash", "sourceManifestHash", "sourceProvenance",
  ]);
  const CONTENT_FIELDS = Object.freeze([
    "abiHash", "behaviorContracts", "behaviorRegistryVersion", "bosses", "campaignRules",
    "contentVersion", "defenseUnlockGrantMappings", "defenses", "enemies", "eventCatalog",
    "eventSchemaVersion", "maps", "missions", "previewProofRecords", "schemaVersion", "summons",
  ]);
  const HEADER_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId", "assist",
    "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds", "accessGrantIds",
    "tutorialUpgradeGateMode",
  ]);
  const DIFFICULTY_IDS = Object.freeze(["story", "strategos", "titan"]);
  const TELEMETRY_RECORD_FIELDS = Object.freeze({
    "activation": Object.freeze([
      "actionId", "behaviorId", "defenseId", "eligibleTargetRuntimeIds", "kind", "level",
      "ordinal", "outcome", "padId", "selectedTargetRuntimeIds", "sourceRuntimeId",
      "sourceTowerRuntimeId",
    ]),
    "aether-transaction": Object.freeze([
      "action", "bankAfterAether", "bankBeforeAether", "bountyRemainderAfter",
      "bountyRemainderBefore", "commandSeq", "creditAether", "debitAether", "defenseId",
      "investedAfterAether", "investedBeforeAether", "kind", "levelAfter", "levelBefore",
      "ordinal", "padId", "sourceId", "towerRuntimeId",
    ]),
    "damage": Object.freeze([
      "appliedHpDamageMilli", "appliedShieldDamageMilli", "attemptedShieldDamageMilli",
      "baseDamageMilli", "damageTypeId", "defenseId", "deferredHpDamageMilli",
      "eligibleHpDamageMilli", "kind", "level", "noExternalAppliedHpDamageMilli",
      "noExternalAppliedShieldDamageMilli", "ordinal", "overkillHpDamageMilli", "padId",
      "preShieldDamageMilli", "revealSourceTowerRuntimeIds", "sourceRuntimeId",
      "sourceTowerRuntimeId", "supportSourceTowerRuntimeIds", "targetHpAfterMilli",
      "targetHpBeforeMilli", "targetLineageId", "targetOwnerId", "targetRouteId",
      "targetRuntimeId", "targetShieldAfterMilli", "targetShieldBeforeMilli",
    ]),
    "effect": Object.freeze([
      "action", "appliedDurationTimeUnits", "appliedMagnitude", "defenseId", "effectKind",
      "kind", "level", "ordinal", "outcome", "padId", "requestedDurationTimeUnits",
      "requestedMagnitude", "sourceRuntimeId", "sourceTowerRuntimeId", "statusId",
      "targetOwnerId", "targetRouteId", "targetRuntimeId",
    ]),
    "leak": Object.freeze([
      "enemyRuntimeId", "hpMilli", "integrityDamage", "kind", "lineageId", "ordinal",
      "ownerId", "routeId", "shieldMilli",
    ]),
    "movement-control": Object.freeze([
      "actualAdvanceDistance", "effectiveSpeedBp", "enemyRuntimeId", "kind", "lineageId",
      "nextRouteDistance", "ordinal", "ownerId", "priorRouteDistance", "routeId",
      "scaledReductionBp", "sourceEffectRuntimeIds", "sourceRuntimeIds",
      "sourceTowerRuntimeIds",
    ]),
    "spawn": Object.freeze([
      "baseSpeedDistanceUnitsPerSecond", "enemyRuntimeId", "entityKind", "initialShieldMilli",
      "kind", "lineageId", "maximumHpMilli", "ordinal", "ownerId", "routeId", "waveId",
    ]),
  });
  const TELEMETRY_AETHER_ACTIONS = Object.freeze([
    "build", "upgrade", "sell", "wave-start-grant", "wave-clear-grant", "bounty",
  ]);
  const TELEMETRY_ACTIVATION_ACTIONS = Object.freeze([
    "direct-hit", "splash-blast", "mark-scan", "guard-contact", "guard-create",
  ]);
  const TELEMETRY_ACTIVATION_OUTCOMES = Object.freeze(["accepted", "no-target", "rejected"]);
  const TELEMETRY_EFFECT_ACTIONS = Object.freeze(["apply", "refresh", "remove", "expire"]);
  const TELEMETRY_EFFECT_KINDS = Object.freeze([
    "status", "delayed-status", "external-amplification", "boss-exposure",
    "resistance-override",
  ]);
  const TELEMETRY_EFFECT_OUTCOMES = Object.freeze([
    "applied", "refreshed", "removed", "expired", "rejected",
  ]);
  const BEHAVIOR_LIMITS = Object.freeze({
    maxEntities: MAX_ACTIVE_ENTITIES,
    maxEvents: MAX_SEMANTIC_EVENTS_PER_TICK,
    maxTargets: MAX_TARGET_CANDIDATES,
  });
  const bindingRecords = new WeakMap();
  const stateRecords = new WeakMap();

  function own(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function exactFields(value, expected, label) {
    ABI.canonicalEncode(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const actual = Object.keys(value).sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object") return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.isFrozen(value) ? value : Object.freeze(value);
  }

  function cloneCanonical(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneCanonical);
    const result = {};
    Object.keys(value).forEach(function (key) { result[key] = cloneCanonical(value[key]); });
    return result;
  }

  function frozenCanonical(value) {
    ABI.canonicalEncode(value);
    return deepFreeze(cloneCanonical(value));
  }

  function nonnegativeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return Object.is(value, -0) ? 0 : value;
  }

  function positiveInteger(value, label) {
    nonnegativeInteger(value, label);
    if (value === 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function stableId(value, label) {
    if (typeof value !== "string" || !STABLE_LOWERCASE_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase ASCII ID");
    }
    return value;
  }

  function closedValue(value, allowed, label) {
    if (allowed.indexOf(value) === -1) {
      throw new RangeError(label + " is outside the closed telemetry vocabulary");
    }
    return value;
  }

  function nullablePositiveInteger(value, label) {
    return value === null ? null : positiveInteger(value, label);
  }

  function nullableStableId(value, label) {
    return value === null ? null : stableId(value, label);
  }

  function telemetryRuntimeIds(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    if (value.length > MAX_BALANCE_TELEMETRY_TARGET_IDS) {
      throw new RangeError(label + " exceeds the telemetry target-ID ceiling");
    }
    let previous = 0;
    value.forEach(function (runtimeId, index) {
      positiveInteger(runtimeId, label + " " + index);
      if (runtimeId <= previous) throw new RangeError(label + " must be ascending and unique");
      previous = runtimeId;
    });
    return value;
  }

  function validateTelemetryRecord(record) {
    const fields = TELEMETRY_RECORD_FIELDS[record.kind];
    if (!fields) throw new RangeError("Unknown balance telemetry record kind");
    exactFields(record, fields, "Balance telemetry " + record.kind + " record");
    nonnegativeInteger(record.ordinal, "Balance telemetry ordinal");
    if (record.kind === "spawn") {
      closedValue(record.entityKind, ["enemy", "boss"], "Spawn entity kind");
      positiveInteger(record.enemyRuntimeId, "Spawn enemy runtime ID");
      stableId(record.ownerId, "Spawn owner ID");
      stableId(record.lineageId, "Spawn lineage ID");
      stableId(record.routeId, "Spawn route ID");
      stableId(record.waveId, "Spawn wave ID");
      positiveInteger(record.maximumHpMilli, "Spawn maximum HP");
      nonnegativeInteger(record.initialShieldMilli, "Spawn initial shield");
      nonnegativeInteger(record.baseSpeedDistanceUnitsPerSecond, "Spawn base speed");
      return;
    }
    if (record.kind === "aether-transaction") {
      closedValue(record.action, TELEMETRY_AETHER_ACTIONS, "Aether action");
      stableId(record.sourceId, "Aether source ID");
      if (record.commandSeq === null) {
        if (["wave-clear-grant", "bounty"].indexOf(record.action) === -1) {
          throw new TypeError("This Aether action requires a command sequence");
        }
      } else {
        nonnegativeInteger(record.commandSeq, "Aether command sequence");
        if (["build", "upgrade", "sell", "wave-start-grant"].indexOf(record.action) === -1) {
          throw new TypeError("Internal Aether actions cannot carry a command sequence");
        }
      }
      const towerAction = ["build", "upgrade", "sell"].indexOf(record.action) !== -1;
      ["towerRuntimeId", "levelBefore", "levelAfter"].forEach(function (field) {
        if (towerAction) nonnegativeInteger(record[field], "Aether " + field);
        else if (record[field] !== null) throw new TypeError("Internal Aether identity must be null");
      });
      ["padId", "defenseId"].forEach(function (field) {
        if (towerAction) stableId(record[field], "Aether " + field);
        else if (record[field] !== null) throw new TypeError("Internal Aether identity must be null");
      });
      if (towerAction) positiveInteger(record.towerRuntimeId, "Aether tower runtime ID");
      ["investedBeforeAether", "investedAfterAether"].forEach(function (field) {
        if (towerAction) nonnegativeInteger(record[field], "Aether " + field);
        else if (record[field] !== null) throw new TypeError("Internal investment must be null");
      });
      [
        "debitAether", "creditAether", "bankBeforeAether", "bankAfterAether",
        "bountyRemainderBefore", "bountyRemainderAfter",
      ].forEach(function (field) { nonnegativeInteger(record[field], "Aether " + field); });
      if (record.action === "build" &&
          (record.levelBefore !== 0 || record.investedBeforeAether !== 0)) {
        throw new RangeError("Build telemetry must start at zero level and investment");
      }
      if (record.action === "sell" &&
          (record.levelAfter !== 0 || record.investedAfterAether !== 0)) {
        throw new RangeError("Sell telemetry must end at zero level and investment");
      }
      const expectedBank = ABI.checkedAdd(
        ABI.checkedAdd(record.bankBeforeAether, -record.debitAether),
        record.creditAether
      );
      if (record.bankAfterAether !== expectedBank) {
        throw new RangeError("Aether transaction does not conserve its bank delta");
      }
      return;
    }
    if (record.kind === "activation") {
      closedValue(record.actionId, TELEMETRY_ACTIVATION_ACTIONS, "Activation action");
      stableId(record.behaviorId, "Activation behavior ID");
      positiveInteger(record.sourceTowerRuntimeId, "Activation source tower runtime ID");
      positiveInteger(record.sourceRuntimeId, "Activation source runtime ID");
      stableId(record.defenseId, "Activation defense ID");
      positiveInteger(record.level, "Activation level");
      stableId(record.padId, "Activation pad ID");
      closedValue(record.outcome, TELEMETRY_ACTIVATION_OUTCOMES, "Activation outcome");
      telemetryRuntimeIds(record.eligibleTargetRuntimeIds, "Activation eligible targets");
      telemetryRuntimeIds(record.selectedTargetRuntimeIds, "Activation selected targets");
      return;
    }
    if (record.kind === "movement-control") {
      positiveInteger(record.enemyRuntimeId, "Movement enemy runtime ID");
      stableId(record.ownerId, "Movement owner ID");
      stableId(record.lineageId, "Movement lineage ID");
      stableId(record.routeId, "Movement route ID");
      [
        "priorRouteDistance", "nextRouteDistance", "actualAdvanceDistance", "effectiveSpeedBp",
        "scaledReductionBp",
      ].forEach(function (field) { nonnegativeInteger(record[field], "Movement " + field); });
      telemetryRuntimeIds(record.sourceEffectRuntimeIds, "Movement effect sources");
      telemetryRuntimeIds(record.sourceRuntimeIds, "Movement runtime sources");
      telemetryRuntimeIds(record.sourceTowerRuntimeIds, "Movement tower sources");
      if (record.sourceEffectRuntimeIds.length !== record.sourceRuntimeIds.length) {
        throw new RangeError("Movement effect and runtime source arrays must align");
      }
      return;
    }
    if (record.kind === "damage") {
      positiveInteger(record.sourceTowerRuntimeId, "Damage source tower runtime ID");
      positiveInteger(record.sourceRuntimeId, "Damage source runtime ID");
      stableId(record.defenseId, "Damage defense ID");
      positiveInteger(record.level, "Damage level");
      stableId(record.padId, "Damage pad ID");
      positiveInteger(record.targetRuntimeId, "Damage target runtime ID");
      stableId(record.targetOwnerId, "Damage target owner ID");
      stableId(record.targetLineageId, "Damage target lineage ID");
      stableId(record.targetRouteId, "Damage target route ID");
      stableId(record.damageTypeId, "Damage type ID");
      [
        "baseDamageMilli", "preShieldDamageMilli", "attemptedShieldDamageMilli",
        "appliedShieldDamageMilli", "eligibleHpDamageMilli", "appliedHpDamageMilli",
        "deferredHpDamageMilli", "overkillHpDamageMilli", "noExternalAppliedShieldDamageMilli",
        "noExternalAppliedHpDamageMilli", "targetShieldBeforeMilli", "targetShieldAfterMilli",
        "targetHpBeforeMilli", "targetHpAfterMilli",
      ].forEach(function (field) { nonnegativeInteger(record[field], "Damage " + field); });
      telemetryRuntimeIds(record.supportSourceTowerRuntimeIds, "Damage support sources");
      telemetryRuntimeIds(record.revealSourceTowerRuntimeIds, "Damage Reveal sources");
      return;
    }
    if (record.kind === "effect") {
      closedValue(record.action, TELEMETRY_EFFECT_ACTIONS, "Effect action");
      nullablePositiveInteger(record.sourceTowerRuntimeId, "Effect source tower runtime ID");
      positiveInteger(record.sourceRuntimeId, "Effect source runtime ID");
      nullableStableId(record.defenseId, "Effect defense ID");
      if (record.level !== null) positiveInteger(record.level, "Effect level");
      nullableStableId(record.padId, "Effect pad ID");
      const provenance = [record.sourceTowerRuntimeId, record.defenseId, record.level, record.padId];
      if (provenance.some(function (value) { return value === null; }) &&
          !provenance.every(function (value) { return value === null; })) {
        throw new TypeError("Effect tower provenance must be wholly present or absent");
      }
      positiveInteger(record.targetRuntimeId, "Effect target runtime ID");
      stableId(record.targetOwnerId, "Effect target owner ID");
      stableId(record.targetRouteId, "Effect target route ID");
      closedValue(record.effectKind, TELEMETRY_EFFECT_KINDS, "Effect runtime kind");
      stableId(record.statusId, "Effect status ID");
      [
        "requestedMagnitude", "appliedMagnitude", "requestedDurationTimeUnits",
        "appliedDurationTimeUnits",
      ].forEach(function (field) { nonnegativeInteger(record[field], "Effect " + field); });
      closedValue(record.outcome, TELEMETRY_EFFECT_OUTCOMES, "Effect outcome");
      return;
    }
    if (record.kind === "leak") {
      positiveInteger(record.enemyRuntimeId, "Leak enemy runtime ID");
      stableId(record.ownerId, "Leak owner ID");
      stableId(record.lineageId, "Leak lineage ID");
      stableId(record.routeId, "Leak route ID");
      ["hpMilli", "shieldMilli", "integrityDamage"].forEach(function (field) {
        nonnegativeInteger(record[field], "Leak " + field);
      });
    }
  }

  function createTelemetryCollector(tickInput) {
    const tick = nonnegativeInteger(tickInput, "Balance telemetry tick");
    const records = [];
    return Object.freeze({
      finish: function () {
        return frozenCanonical({
          schemaVersion: BALANCE_TELEMETRY_SCHEMA_VERSION,
          tick: tick,
          records: records,
        });
      },
      push: function (kind, values) {
        if (records.length >= MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK) {
          throw new RangeError("Balance telemetry exceeds the per-tick record ceiling");
        }
        if (!TELEMETRY_RECORD_FIELDS[kind]) {
          throw new RangeError("Unknown balance telemetry record kind");
        }
        const record = Object.assign({ kind: kind, ordinal: records.length }, values);
        validateTelemetryRecord(record);
        const frozen = frozenCanonical(record);
        records.push(frozen);
        return frozen;
      },
    });
  }

  function hash(value, label) {
    if (typeof value !== "string" || !HASH.test(value)) {
      throw new TypeError(label + " must be lowercase sha256:<64-hex>");
    }
    return value;
  }

  function booleanValue(value, label) {
    if (typeof value !== "boolean") throw new TypeError(label + " must be boolean");
    return value;
  }

  function requireFrozenArtifact(value, label) {
    if (!Object.isFrozen(value)) throw new TypeError(label + " must be an immutable compiled artifact");
    return value;
  }

  function idArray(value, label, options) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    const output = [];
    const seen = new Set();
    let previous = null;
    value.forEach(function (candidate, index) {
      const id = stableId(candidate, label + " " + index);
      if (seen.has(id)) throw new RangeError(label + " cannot contain duplicate IDs");
      if (options && options.sorted && previous !== null && id <= previous) {
        throw new RangeError(label + " must be in strict ASCII order");
      }
      seen.add(id);
      output.push(id);
      previous = id;
    });
    if (options && own(options, "maximum") && output.length > options.maximum) {
      throw new RangeError(label + " exceeds its maximum count");
    }
    if (options && options.nonempty && output.length === 0) {
      throw new RangeError(label + " must not be empty");
    }
    return Object.freeze(output);
  }

  function objectRecord(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be an object record");
    }
    return value;
  }

  function sortedObjectIds(record, label) {
    objectRecord(record, label);
    const ids = Object.keys(record).sort();
    ids.forEach(function (id) { stableId(id, label + " ID"); });
    return ids;
  }

  function sameIds(actual, expected, label) {
    if (!Array.isArray(actual) || actual.length !== expected.length ||
        actual.some(function (id, index) { return id !== expected[index]; })) {
      throw new RangeError(label + " does not match compiled content");
    }
  }

  function artifactName(prefix, digest, suffix) {
    return prefix + digest.slice("sha256:".length) + suffix;
  }

  function pad3(value) {
    return String(value).padStart(3, "0");
  }

  function validateReleaseAndContent(release, content) {
    requireFrozenArtifact(release, "Release record");
    requireFrozenArtifact(content, "Simulation content");
    exactFields(release, RELEASE_FIELDS, "Release record");
    exactFields(content, CONTENT_FIELDS, "Simulation content");
    if (release.schemaVersion !== 3 || content.schemaVersion !== 3) {
      throw new RangeError("Kernel requires release/content schema version 3");
    }
    const releaseAbiHash = hash(release.abiHash, "Release ABI hash");
    if (hash(content.abiHash, "Content ABI hash") !== releaseAbiHash) {
      throw new RangeError("Release and content ABI identities do not match");
    }
    stableId(release.contentVersion, "Release content version");
    if (content.contentVersion !== release.contentVersion) {
      throw new RangeError("Release and content versions do not match");
    }
    if (release.eventSchemaVersion !== ABI.EVENT_SCHEMA_VERSION ||
        content.eventSchemaVersion !== ABI.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Release/content event schema does not match the simulation ABI");
    }
    if (release.behaviorRegistryVersion !== ABI.BEHAVIOR_REGISTRY_VERSION ||
        content.behaviorRegistryVersion !== ABI.BEHAVIOR_REGISTRY_VERSION ||
        release.behaviorRegistryVersion !== Behaviors.BEHAVIOR_REGISTRY_VERSION) {
      throw new RangeError("Release/content behavior registry does not match the simulation artifact");
    }
    if (ABI.canonicalEncode(content.behaviorContracts) !== ABI.canonicalEncode(ABI.BEHAVIOR_CONTRACTS)) {
      throw new RangeError("Compiled behavior contracts do not match the simulation ABI");
    }
    const rulesetHash = hash(release.rulesetHash, "Release ruleset hash");
    const simulationHash = hash(release.simulationHash, "Release simulation hash");
    const contentHash = hash(release.contentHash, "Release content hash");
    if (release.simulationArtifact !== artifactName("aegis-sim.", simulationHash, ".js")) {
      throw new RangeError("Simulation artifact name does not match its release hash");
    }
    if (release.contentArtifact !== artifactName("aegis-content.", contentHash, ".js")) {
      throw new RangeError("Content artifact name does not match its release hash");
    }
    if (!release.includedIds || typeof release.includedIds !== "object" ||
        Array.isArray(release.includedIds)) {
      throw new TypeError("Release included IDs must be an object");
    }
    exactFields(release.includedIds, ["bosses", "defenses", "enemies", "missions"], "Included IDs");
    sameIds(release.includedIds.bosses, sortedObjectIds(content.bosses, "Compiled bosses"), "Included bosses");
    sameIds(
      release.includedIds.defenses,
      sortedObjectIds(content.defenses, "Compiled defenses"),
      "Included defenses"
    );
    sameIds(release.includedIds.enemies, sortedObjectIds(content.enemies, "Compiled enemies"), "Included enemies");
    sameIds(release.includedIds.missions, sortedObjectIds(content.missions, "Compiled missions"), "Included missions");
    objectRecord(content.maps, "Compiled maps");
    objectRecord(content.campaignRules, "Compiled campaign rules");
    objectRecord(content.eventCatalog, "Compiled semantic event catalog");
    Object.keys(content.eventCatalog).forEach(function (eventId) {
      const definition = content.eventCatalog[eventId];
      if (!definition || definition.id !== eventId || definition.version !== ABI.EVENT_SCHEMA_VERSION) {
        throw new RangeError("Compiled semantic event identity/version does not match " + eventId);
      }
    });
    return Object.freeze({
      contentHash: contentHash,
      releaseAbiHash: releaseAbiHash,
      rulesetHash: rulesetHash,
      simulationHash: simulationHash,
    });
  }

  function compiledRoute(map, routeSource) {
    const lanes = Object.create(null);
    map.laneSegments.forEach(function (lane) { lanes[lane.id] = lane; });
    if (!Array.isArray(routeSource.laneSegmentIds) ||
        !Array.isArray(routeSource.segmentOffsets) ||
        routeSource.laneSegmentIds.length !== routeSource.segmentOffsets.length) {
      throw new TypeError("Compiled route lane IDs and offsets must have equal array lengths");
    }
    const segments = [];
    routeSource.laneSegmentIds.forEach(function (laneId, laneIndex) {
      const lane = lanes[laneId];
      if (!lane || !lane.compiled || !Array.isArray(lane.compiled.subsegments)) {
        throw new RangeError("Compiled route references an unknown normalized lane segment " + laneId);
      }
      const offset = routeSource.segmentOffsets[laneIndex];
      if (!offset || offset.laneSegmentId !== laneId || offset.routeOffset < 0) {
        throw new RangeError("Compiled route segment offset does not match " + laneId);
      }
      lane.compiled.subsegments.forEach(function (segment) {
        const index = segments.length;
        segments.push({
          id: laneId + ":s" + pad3(segment.index),
          index: index,
          start: ABI.checkedAdd(offset.routeOffset, segment.start),
          length: segment.length,
          fromX: segment.fromX,
          fromY: segment.fromY,
          toX: segment.toX,
          toY: segment.toY,
          deltaX: segment.deltaX,
          deltaY: segment.deltaY,
        });
      });
    });
    return Geometry.freezeCompiledRoute({ id: routeSource.id, length: routeSource.length, segments: segments });
  }

  function compileMap(map, missionId) {
    objectRecord(map, "Compiled map " + missionId);
    if (map.id !== missionId || !Array.isArray(map.routes) || !Array.isArray(map.laneSegments) ||
        !Array.isArray(map.pads)) {
      throw new RangeError("Mission " + missionId + " compiled map identity/arrays are invalid");
    }
    const routes = map.routes.map(function (route) { return compiledRoute(map, route); });
    const routeIds = routes.map(function (route) { return route.id; });
    if (new Set(routeIds).size !== routeIds.length) throw new RangeError("Compiled map route IDs must be unique");
    const pads = map.pads.map(function (pad) {
      return Object.freeze({ id: stableId(pad.id, "Compiled pad ID"), x: pad.x, y: pad.y });
    });
    if (new Set(pads.map(function (pad) { return pad.id; })).size !== pads.length) {
      throw new RangeError("Compiled map pad IDs must be unique");
    }
    return Object.freeze({
      map: map,
      pads: Object.freeze(pads),
      routes: Object.freeze(routes),
    });
  }

  function createRulesetBinding(input) {
    exactFields(input, ["release", "content"], "Ruleset binding input");
    const release = input.release;
    const content = input.content;
    const identities = validateReleaseAndContent(release, content);
    const missions = Object.create(null);
    const missionIds = release.includedIds.missions.slice();
    missionIds.forEach(function (missionId) {
      const mission = content.missions[missionId];
      if (!mission || mission.id !== missionId) {
        throw new RangeError("Compiled mission identity does not match " + missionId);
      }
      const map = content.maps[mission.mapId];
      if (!map) throw new RangeError("Mission " + missionId + " references an unknown compiled map");
      const objectiveBindings = Object.freeze({
        story: Objectives.bindObjectives(mission.objectives, "story"),
        strategos: Objectives.bindObjectives(mission.objectives, "strategos"),
        titan: Objectives.bindObjectives(mission.objectives, "titan"),
      });
      missions[missionId] = Object.freeze({
        map: compileMap(map, mission.mapId),
        mission: mission,
        objectiveBindings: objectiveBindings,
      });
    });
    const binding = Object.freeze({
      abiHash: release.abiHash,
      behaviorRegistryVersion: ABI.BEHAVIOR_REGISTRY_VERSION,
      contentVersion: release.contentVersion,
      eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
      missionIds: Object.freeze(missionIds),
      rulesetHash: identities.rulesetHash,
      simulationHash: identities.simulationHash,
    });
    bindingRecords.set(binding, Object.freeze({ content: content, missions: missions, release: release }));
    return binding;
  }

  function requireBinding(binding) {
    const record = bindingRecords.get(binding);
    if (!record || !Object.isFrozen(binding)) {
      throw new TypeError("Ruleset binding must come from createRulesetBinding before Start");
    }
    return record;
  }

  function difficultyById(campaignRules, difficultyId) {
    if (DIFFICULTY_IDS.indexOf(difficultyId) === -1) {
      throw new RangeError("Unknown difficulty ID: " + difficultyId);
    }
    const record = campaignRules.difficultyPresets.find(function (candidate) {
      return candidate.id === difficultyId;
    });
    if (!record) throw new RangeError("Compiled content does not define difficulty " + difficultyId);
    return record;
  }

  function modifierAether(campaignRules, modifierIds) {
    let total = 0;
    modifierIds.forEach(function (modifierId) {
      const record = campaignRules.campaignModifierRecords.find(function (candidate) {
        return candidate.id === modifierId;
      });
      if (!record) throw new RangeError("Unknown campaign modifier " + modifierId);
      if (record.kind !== "start-aether-add" || record.scope !== "campaign") {
        throw new RangeError("Unsupported campaign modifier rule " + modifierId);
      }
      total = ABI.checkedAdd(total, nonnegativeInteger(record.amountAether, "Campaign modifier Aether"));
    });
    return total;
  }

  function validateLoadout(content, mission, header) {
    const available = new Set(mission.availableDefenseIds);
    const grants = new Set(header.accessGrantIds);
    const unlockByDefense = Object.create(null);
    content.defenseUnlockGrantMappings.forEach(function (mapping) {
      unlockByDefense[mapping.defenseId] = mapping.accessGrantId;
    });
    header.loadoutIds.forEach(function (defenseId) {
      if (!available.has(defenseId) || !content.defenses[defenseId]) {
        throw new RangeError("Loadout defense is not available for this mission: " + defenseId);
      }
      if (!unlockByDefense[defenseId] || !grants.has(unlockByDefense[defenseId])) {
        throw new RangeError("Loadout defense lacks its resolved access grant: " + defenseId);
      }
    });
    content.campaignRules.accessGrantIds.forEach(function (grantId) {
      stableId(grantId, "Compiled access grant ID");
    });
    header.accessGrantIds.forEach(function (grantId) {
      if (content.campaignRules.accessGrantIds.indexOf(grantId) === -1) {
        throw new RangeError("Unknown resolved access grant " + grantId);
      }
    });
  }

  function normalizeHeader(binding, record, input) {
    exactFields(input, HEADER_FIELDS, "Kernel replay header");
    if (input.formatVersion !== 1) throw new RangeError("Kernel replay format version must be 1");
    if (hash(input.rulesetHash, "Replay ruleset hash") !== binding.rulesetHash) {
      throw new RangeError("Replay ruleset identity does not match the binding");
    }
    if (input.eventSchemaVersion !== ABI.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Replay event schema does not match the simulation ABI");
    }
    const missionId = stableId(input.missionId, "Replay mission ID");
    if (!record.missions[missionId]) throw new RangeError("Replay mission is not in the bound release");
    const difficultyId = stableId(input.difficultyId, "Replay difficulty ID");
    difficultyById(record.content.campaignRules, difficultyId);
    const assist = booleanValue(input.assist, "Replay Assist flag");
    const seed = nonnegativeInteger(input.seed, "Replay seed");
    if (seed > MAX_UINT32) throw new RangeError("Replay seed must be an unsigned 32-bit integer");
    const loadoutIds = idArray(input.loadoutIds, "Replay loadout IDs", {
      maximum: MAX_LOADOUT_IDS,
      nonempty: true,
    });
    const loadoutSlotCap = positiveInteger(input.loadoutSlotCap, "Replay loadout slot cap");
    if (loadoutSlotCap > MAX_LOADOUT_IDS) {
      throw new RangeError("Replay loadout slot cap cannot exceed six");
    }
    if (loadoutIds.length > loadoutSlotCap) throw new RangeError("Replay loadout exceeds its slot cap");
    const campaignModifierIds = idArray(
      input.campaignModifierIds,
      "Replay campaign modifier IDs",
      { maximum: 64, sorted: true }
    );
    const accessGrantIds = idArray(input.accessGrantIds, "Replay access grant IDs", { maximum: 64 });
    const tutorialUpgradeGateMode = stableId(
      input.tutorialUpgradeGateMode,
      "Replay Tutorial Upgrade gate mode"
    );
    if (ABI.DESCRIPTOR.tutorialUpgradeGate.modes.indexOf(tutorialUpgradeGateMode) === -1) {
      throw new RangeError("Unsupported Tutorial Upgrade gate mode " + tutorialUpgradeGateMode);
    }
    return Object.freeze({
      accessGrantIds: accessGrantIds,
      assist: assist,
      campaignModifierIds: campaignModifierIds,
      difficultyId: difficultyId,
      eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
      formatVersion: 1,
      loadoutIds: loadoutIds,
      loadoutSlotCap: loadoutSlotCap,
      missionId: missionId,
      rulesetHash: binding.rulesetHash,
      seed: seed,
      tutorialUpgradeGateMode: tutorialUpgradeGateMode,
    });
  }

  function managementConfig(content, missionRuntime, header, resolvedStartAether) {
    const mission = missionRuntime.mission;
    return Management.normalizeManagementConfig({
      missionId: mission.id,
      resolvedStartAether: resolvedStartAether,
      tutorialUpgradeGateMode: header.tutorialUpgradeGateMode,
      padIds: missionRuntime.map.pads.map(function (pad) { return pad.id; }),
      waveStartGrants: mission.waves.map(function (wave) { return wave.deploymentGrantAether; }),
      defenses: header.loadoutIds.map(function (defenseId) {
        const defense = content.defenses[defenseId];
        return {
          id: defense.id,
          costsAether: defense.levels.map(function (level) { return level.purchase.costAether; }),
          defaultTargetPolicy: defense.defaultTargetPolicyId,
          allowedTargetPolicies: defense.allowedTargetPolicyIds.slice().sort(function (left, right) {
            return Commands.TARGET_POLICIES.indexOf(left) - Commands.TARGET_POLICIES.indexOf(right);
          }),
        };
      }),
    });
  }

  function behaviorDispatchId(behavior) {
    const dispatchId = behavior.contractId + "@" + behavior.version + "/" + behavior.deliveryKind;
    if (Object.keys(Behaviors.DISPATCH_IDS).every(function (key) {
      return Behaviors.DISPATCH_IDS[key] !== dispatchId;
    })) {
      throw new RangeError("Unsupported compiled behavior dispatch ID " + dispatchId);
    }
    return dispatchId;
  }

  function behaviorUsesCooldown(behavior) {
    return behavior.contractId === "direct" || behavior.contractId === "splash" ||
      (behavior.contractId === "aura" && behavior.deliveryKind === "periodic-targeted-status");
  }

  function guardMarkers(missionRuntime, padId) {
    const proof = missionRuntime.map.map.roleProofs.find(function (record) {
      return record.kind === "guard" && record.padId === padId;
    });
    if (!proof || !Array.isArray(proof.markers)) {
      throw new RangeError("Hoplite pad lacks its compiled guard marker proof: " + padId);
    }
    return proof.markers;
  }

  function initialBehaviorState(behavior, missionRuntime, tower) {
    const dispatchId = behaviorDispatchId(behavior);
    if (dispatchId === Behaviors.DISPATCH_IDS.GUARD_SLOTS) {
      return Behaviors.createBehaviorState(dispatchId, {
        markers: guardMarkers(missionRuntime, tower.padId),
      });
    }
    return Behaviors.createBehaviorState(dispatchId, {});
  }

  function createTowerRuntime(content, missionRuntime, tower, currentTick) {
    const defense = content.defenses[tower.defenseId];
    const level = defense.levels[tower.level - 1];
    return Object.freeze({
      behaviorStates: Object.freeze(level.behaviors.map(function (behavior, index) {
        return Object.freeze({
          behaviorId: behavior.id,
          dispatchId: behaviorDispatchId(behavior),
          index: index,
          state: initialBehaviorState(behavior, missionRuntime, tower),
          timer: behaviorUsesCooldown(behavior) ? Timers.createCooldownState() : null,
        });
      })),
      createdTick: currentTick,
      defenseId: tower.defenseId,
      level: tower.level,
      towerRuntimeId: tower.id,
    });
  }

  function syncTowerRuntimes(content, missionRuntime, priorRuntimes, towers, currentTick) {
    const priorById = Object.create(null);
    priorRuntimes.forEach(function (runtime) { priorById[runtime.towerRuntimeId] = runtime; });
    return Object.freeze(towers.map(function (tower) {
      const prior = priorById[tower.id];
      if (!prior) return createTowerRuntime(content, missionRuntime, tower, currentTick);
      if (prior.defenseId !== tower.defenseId) {
        throw new RangeError("A tower runtime cannot change defense identity");
      }
      const level = content.defenses[tower.defenseId].levels[tower.level - 1];
      const statesById = Object.create(null);
      prior.behaviorStates.forEach(function (behaviorState) {
        statesById[behaviorState.behaviorId] = behaviorState;
      });
      const behaviorStates = level.behaviors.map(function (behavior, index) {
        const dispatchId = behaviorDispatchId(behavior);
        const previous = statesById[behavior.id];
        if (!previous) {
          return Object.freeze({
            behaviorId: behavior.id,
            dispatchId: dispatchId,
            index: index,
            state: initialBehaviorState(behavior, missionRuntime, tower),
            timer: behaviorUsesCooldown(behavior) ? Timers.createCooldownState() : null,
          });
        }
        if (previous.dispatchId !== dispatchId) {
          throw new RangeError("An upgraded behavior cannot change dispatch identity");
        }
        return Object.freeze({
          behaviorId: behavior.id,
          dispatchId: dispatchId,
          index: index,
          state: previous.state,
          timer: previous.timer,
        });
      });
      return Object.freeze({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: prior.createdTick,
        defenseId: tower.defenseId,
        level: tower.level,
        towerRuntimeId: tower.id,
      });
    }));
  }

  function managementWith(state, config, changes) {
    return Management.normalizeManagementState({
      schemaVersion: state.schemaVersion,
      missionId: state.missionId,
      aether: own(changes, "aether") ? changes.aether : state.aether,
      bountyRemainder: own(changes, "bountyRemainder")
        ? changes.bountyRemainder : state.bountyRemainder,
      phase: state.phase,
      activeWave: state.activeWave,
      clearedWaves: state.clearedWaves,
      tutorialUpgradeGateMode: state.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: state.tutorialUpgradeGateOpen,
      towers: state.towers,
      runtimeIds: own(changes, "runtimeIds") ? changes.runtimeIds : state.runtimeIds,
    }, config);
  }

  function allocateRuntimeId(management, config, domain) {
    const allocation = Movement.allocateRuntimeId(management.runtimeIds, domain, true);
    return Object.freeze({
      management: managementWith(management, config, { runtimeIds: allocation.state }),
      runtimeId: allocation.runtimeId,
    });
  }

  function creditBounty(management, config, baseBounty, difficultyBountyBp) {
    const result = Economy.resolveBountyEvent(
      management.bountyRemainder,
      baseBounty,
      difficultyBountyBp
    );
    return Object.freeze({
      award: result.bountyAward,
      management: managementWith(management, config, {
        aether: ABI.checkedAdd(management.aether, result.bountyAward),
        bountyRemainder: result.bountyRemainder,
      }),
    });
  }

  function creditGrant(management, config, amount) {
    const result = Economy.creditFixedGrant(management.bountyRemainder, amount);
    return managementWith(management, config, {
      aether: ABI.checkedAdd(management.aether, result.aetherAward),
      bountyRemainder: result.bountyRemainder,
    });
  }

  function authoredLineageTags(content) {
    const tags = new Set();
    Object.keys(content.enemies).forEach(function (enemyId) {
      content.enemies[enemyId].tags.forEach(function (tag) { tags.add(tag); });
    });
    Object.keys(content.bosses).forEach(function (bossId) {
      content.bosses[bossId].tags.forEach(function (tag) { tags.add(tag); });
    });
    return Array.from(tags).sort();
  }

  function initialObjectiveFacts(content, missionRuntime, difficulty) {
    return Object.freeze({
      integrity: difficulty.integrity,
      lineageTagLeakCounts: Object.freeze(authoredLineageTags(content).map(function (lineageTag) {
        return Object.freeze({ leakCount: 0, lineageTag: lineageTag });
      })),
      outcome: "active",
      ownedTowerCount: 0,
      routeLeakCounts: Object.freeze(missionRuntime.map.routes.map(function (route) {
        return Object.freeze({ leakCount: 0, routeId: route.id });
      })),
    });
  }

  function objectiveProjection(binding, fullFacts) {
    const routeCounts = Object.create(null);
    fullFacts.routeLeakCounts.forEach(function (record) { routeCounts[record.routeId] = record.leakCount; });
    const lineageCounts = Object.create(null);
    fullFacts.lineageTagLeakCounts.forEach(function (record) {
      lineageCounts[record.lineageTag] = record.leakCount;
    });
    return Objectives.createObjectiveFacts(binding, {
      integrity: fullFacts.integrity,
      lineageTagLeakCounts: binding.lineageTagIds.map(function (lineageTag) {
        return { lineageTag: lineageTag, leakCount: lineageCounts[lineageTag] || 0 };
      }),
      outcome: fullFacts.outcome,
      ownedTowerCount: fullFacts.ownedTowerCount,
      routeLeakCounts: binding.routeIds.map(function (routeId) {
        return { routeId: routeId, leakCount: routeCounts[routeId] || 0 };
      }),
    });
  }

  function initialRoutes(missionRuntime) {
    return Object.freeze(missionRuntime.map.routes.map(function (route) {
      return Object.freeze({ id: route.id, length: route.length });
    }));
  }

  function semanticEvent(content, eventId, payload) {
    const definition = content.eventCatalog[eventId];
    if (!definition) throw new RangeError("Unknown compiled semantic event " + eventId);
    return Behaviors.validateSemanticEvent(content.eventCatalog, {
      eventId: eventId,
      phaseId: definition.phaseId,
      payload: payload,
    });
  }

  function appendEvents(target, additions) {
    additions.forEach(function (event) {
      if (target.length >= MAX_SEMANTIC_EVENTS_PER_TICK) {
        throw new RangeError("Semantic events exceed the kernel per-tick ceiling");
      }
      target.push(event);
    });
  }

  function routeSource(missionRuntime, routeId) {
    const source = missionRuntime.map.map.routes.find(function (route) { return route.id === routeId; });
    if (!source) throw new RangeError("Unknown mission route " + routeId);
    return source;
  }

  function frozenSpawnJob(values) {
    return Object.freeze({
      authoredIndex: values.authoredIndex,
      bountyPolicy: values.bountyPolicy,
      dueTick: values.dueTick,
      groupId: values.groupId,
      groupOrder: values.groupOrder,
      lineageId: values.lineageId,
      lineageTags: Object.freeze((values.lineageTags || []).slice()),
      ownerId: values.ownerId,
      routeDistance: values.routeDistance,
      routeId: values.routeId,
      sourceBossRuntimeId: values.sourceBossRuntimeId,
      spawnEventId: values.spawnEventId,
      spawnKind: values.spawnKind,
      waveId: values.waveId,
    });
  }

  function compareSpawnJobs(left, right) {
    if (left.dueTick !== right.dueTick) return left.dueTick < right.dueTick ? -1 : 1;
    if (left.groupOrder !== right.groupOrder) return left.groupOrder < right.groupOrder ? -1 : 1;
    if (left.authoredIndex !== right.authoredIndex) {
      return left.authoredIndex < right.authoredIndex ? -1 : 1;
    }
    if (left.groupId !== right.groupId) return left.groupId < right.groupId ? -1 : 1;
    return 0;
  }

  function scheduleWaveSpawns(wave, startTick) {
    const jobs = [];
    wave.groups.forEach(function (group, groupIndex) {
      if (group.order !== groupIndex) throw new RangeError("Wave group order must be contiguous");
      if (group.shuffleWithinGroup !== false || group.rngStreamId !== null) {
        throw new RangeError("Candidate slice shuffled spawn groups require a new authored RNG contract");
      }
      for (let authoredIndex = 0; authoredIndex < group.count; authoredIndex += 1) {
        const relativeTick = ABI.checkedAdd(
          group.firstTick,
          ABI.checkedMultiply(authoredIndex, group.intervalTicks)
        );
        jobs.push(frozenSpawnJob({
          authoredIndex: authoredIndex,
          bountyPolicy: group.bountyPolicy,
          dueTick: ABI.checkedAdd(startTick, relativeTick),
          groupId: group.id,
          groupOrder: group.order,
          lineageId: null,
          lineageTags: [],
          ownerId: group.spawnKind === "boss" ? group.bossId : group.enemyId,
          routeDistance: 0,
          routeId: group.routeId,
          sourceBossRuntimeId: null,
          spawnEventId: group.spawnEventId,
          spawnKind: group.spawnKind,
          waveId: wave.id,
        }));
      }
    });
    jobs.sort(compareSpawnJobs);
    return Object.freeze(jobs);
  }

  function sortedTagUnion(left, right) {
    return Object.freeze(Array.from(new Set(left.concat(right))).sort());
  }

  function createShieldRecords(owner, management, config, currentTick) {
    let nextManagement = management;
    const shields = [];
    owner.shieldPools.forEach(function (pool) {
      const allocation = allocateRuntimeId(nextManagement, config, "effect");
      nextManagement = allocation.management;
      shields.push(Object.freeze({
        poolId: pool.id,
        remainingMilli: pool.initialAmount,
        sourceId: allocation.runtimeId,
        timer: pool.durationMs === null
          ? null
          : Timers.applyStatusAfterExpiryPhase(
              Timers.authoredMillisecondsToTimeUnits(pool.durationMs),
              currentTick
            ),
      }));
    });
    return Object.freeze({ management: nextManagement, shields: Object.freeze(shields) });
  }

  function resolvedEnemySpeed(owner, difficulty, assist, content) {
    return ABI.checkedMulDivFloor(
      owner.speedWorldUnitsPerSecond,
      [difficulty.enemySpeedBp, assist ? content.campaignRules.assistRecord.enemySpeedBp : ABI.BASIS_POINTS],
      [ABI.BASIS_POINTS, ABI.BASIS_POINTS]
    );
  }

  function createEntity(content, missionRuntime, difficulty, assist, job, management, config, currentTick) {
    const isBoss = job.spawnKind === "boss";
    const owner = isBoss ? content.bosses[job.ownerId] : content.enemies[job.ownerId];
    if (!owner) throw new RangeError("Spawn job references an unknown owner " + job.ownerId);
    const route = missionRuntime.map.routes.find(function (candidate) { return candidate.id === job.routeId; });
    const routeRecord = routeSource(missionRuntime, job.routeId);
    if (!route || owner.routeKinds.indexOf(routeRecord.kind) === -1) {
      throw new RangeError("Spawn owner is incompatible with route " + job.routeId);
    }
    let allocation = allocateRuntimeId(management, config, "enemy");
    let nextManagement = allocation.management;
    const runtimeId = allocation.runtimeId;
    const maximumHpMilli = Math.max(1, ABI.checkedMulDivFloor(
      owner.hp,
      [difficulty.enemyHpBp],
      [ABI.BASIS_POINTS]
    ));
    const lineageId = job.lineageId === null ? "lineage." + runtimeId : job.lineageId;
    const lineageTags = job.lineageId === null
      ? Object.freeze(owner.tags.slice())
      : sortedTagUnion(job.lineageTags, owner.tags);
    const distance = Math.min(route.length, job.routeDistance);
    const position = Geometry.positionOnRoute(route, distance);
    const shields = createShieldRecords(owner, nextManagement, config, currentTick);
    nextManagement = shields.management;
    const traitStates = owner.traits.map(function (trait) {
      if (trait.kind !== "cloak" || trait.version !== 1) {
        throw new RangeError("Unsupported enemy trait " + trait.kind);
      }
      return Object.freeze({
        dispatchId: Behaviors.DISPATCH_IDS.CLOAK,
        kind: trait.kind,
        state: Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.CLOAK, {}),
      });
    });
    const entity = Object.freeze({
      armorMilli: owner.armor,
      baseSpeedDistanceUnitsPerSecond: resolvedEnemySpeed(owner, difficulty, assist, content),
      bossState: isBoss
        ? Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.TALOS, {
            currentHpMilli: maximumHpMilli,
            maximumHpMilli: maximumHpMilli,
          })
        : null,
      distance: distance,
      hpMilli: maximumHpMilli,
      id: runtimeId,
      kind: isBoss ? "boss" : "enemy",
      leakIntegrity: owner.leakIntegrity,
      lineageId: lineageId,
      lineageTags: lineageTags,
      maximumHpMilli: maximumHpMilli,
      movement: Movement.createMovementState(),
      ownerId: owner.id,
      position: position,
      routeId: route.id,
      routeKind: routeRecord.kind,
      scoreValue: owner.score,
      shields: shields.shields,
      tags: Object.freeze(owner.tags.slice()),
      threatPriority: owner.threatPriority,
      traitStates: Object.freeze(traitStates),
      waveId: job.waveId,
    });
    const lineage = job.lineageId === null ? Object.freeze({
      baseLineageBountyAether: owner.baseLineageBountyAether,
      bountyPolicy: job.bountyPolicy,
      claimed: false,
      lineageId: lineageId,
    }) : null;
    return Object.freeze({
      entity: entity,
      lineage: lineage,
      management: nextManagement,
      owner: owner,
      runtimeId: runtimeId,
    });
  }

  function spawnDueJobs(content, missionRuntime, difficulty, assist, jobs, enemies, lineages,
    management, config, currentTick, events, telemetry) {
    if (jobs.some(function (job) { return job.dueTick < currentTick; })) {
      throw new RangeError("A pending spawn job missed its authored due tick");
    }
    const due = jobs.filter(function (job) { return job.dueTick === currentTick; });
    const future = jobs.filter(function (job) { return job.dueTick > currentTick; });
    if (ABI.checkedAdd(enemies.length, due.length) > MAX_ACTIVE_ENTITIES) {
      throw new RangeError("Active hostile entities exceed the kernel ceiling");
    }
    let nextManagement = management;
    due.forEach(function (job) {
      const spawned = createEntity(
        content,
        missionRuntime,
        difficulty,
        assist,
        job,
        nextManagement,
        config,
        currentTick
      );
      nextManagement = spawned.management;
      enemies.push(spawned.entity);
      if (spawned.lineage !== null) lineages.push(spawned.lineage);
      telemetry.push("spawn", {
        entityKind: spawned.entity.kind,
        enemyRuntimeId: spawned.runtimeId,
        ownerId: spawned.owner.id,
        lineageId: spawned.entity.lineageId,
        routeId: spawned.entity.routeId,
        waveId: spawned.entity.waveId,
        maximumHpMilli: spawned.entity.maximumHpMilli,
        initialShieldMilli: totalShieldMilli(spawned.entity),
        baseSpeedDistanceUnitsPerSecond: spawned.entity.baseSpeedDistanceUnitsPerSecond,
      });
      if (job.spawnEventId !== null) {
        if (job.spawnKind === "boss") {
          events.push(semanticEvent(content, job.spawnEventId, {
            bossId: spawned.owner.id,
            bossRuntimeId: spawned.runtimeId,
            routeId: job.routeId,
            waveId: job.waveId,
          }));
        } else {
          events.push(semanticEvent(content, job.spawnEventId, {
            enemyId: spawned.owner.id,
            enemyRuntimeId: spawned.runtimeId,
            lineageTags: spawned.entity.lineageTags,
            routeId: job.routeId,
            waveId: job.waveId,
          }));
        }
      }
    });
    enemies.sort(function (left, right) { return left.id - right.id; });
    lineages.sort(function (left, right) {
      return left.lineageId < right.lineageId ? -1 : left.lineageId > right.lineageId ? 1 : 0;
    });
    return Object.freeze({
      enemies: Object.freeze(enemies),
      lineages: Object.freeze(lineages),
      management: nextManagement,
      pendingSpawns: Object.freeze(future),
    });
  }

  function behaviorRequest(content, behavior, state, input) {
    return {
      eventCatalog: content.eventCatalog,
      input: input,
      limits: BEHAVIOR_LIMITS,
      parameters: behavior.parameters,
      state: state,
    };
  }

  function towerByRuntimeId(towers, runtimeId) {
    return towers.find(function (tower) { return tower.id === runtimeId; });
  }

  function towerTelemetryIdentity(content, towers, runtimeId) {
    const tower = towerByRuntimeId(towers, runtimeId);
    if (!tower) return null;
    if (!content.defenses[tower.defenseId]) {
      throw new RangeError("Telemetry tower references an unknown defense");
    }
    return Object.freeze({
      defenseId: tower.defenseId,
      level: tower.level,
      padId: tower.padId,
      sourceTowerRuntimeId: tower.id,
    });
  }

  function mergeTelemetryTowers(prior, current) {
    const byId = Object.create(null);
    prior.concat(current).forEach(function (tower) { byId[tower.id] = tower; });
    return Object.freeze(Object.keys(byId).map(function (runtimeId) {
      return byId[runtimeId];
    }).sort(function (left, right) { return left.id - right.id; }));
  }

  function requiredTelemetryTarget(enemies, runtimeId) {
    const target = enemies.find(function (enemy) { return enemy.id === runtimeId; });
    if (!target) throw new RangeError("Effect telemetry target is not resolvable");
    return target;
  }

  function requiredTowerTelemetryIdentity(content, towers, runtimeId) {
    const identity = towerTelemetryIdentity(content, towers, runtimeId);
    if (identity === null) throw new RangeError("Telemetry player source has no owned tower");
    return identity;
  }

  function sortedUniqueRuntimeIds(values) {
    return Object.freeze(Array.from(new Set(values)).sort(function (left, right) {
      return left - right;
    }));
  }

  function totalShieldMilli(enemy) {
    return enemy.shields.reduce(function (total, shield) {
      return ABI.checkedAdd(total, shield.remainingMilli);
    }, 0);
  }

  function emitManagementAetherTelemetry(telemetry, managementBefore, managementResult,
    missionRuntime) {
    let bank = managementBefore.aether;
    const remainder = managementBefore.bountyRemainder;
    managementResult.events.forEach(function (event) {
      let values = null;
      if (event.type === "build") {
        values = {
          action: "build",
          sourceId: "command.build",
          commandSeq: event.seq,
          towerRuntimeId: event.towerId,
          padId: event.padId,
          defenseId: event.defenseId,
          levelBefore: 0,
          levelAfter: event.level,
          debitAether: event.costAether,
          creditAether: 0,
          investedBeforeAether: 0,
          investedAfterAether: event.investedAether,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      } else if (event.type === "upgrade") {
        values = {
          action: "upgrade",
          sourceId: "command.upgrade",
          commandSeq: event.seq,
          towerRuntimeId: event.towerId,
          padId: event.padId,
          defenseId: event.defenseId,
          levelBefore: ABI.checkedAdd(event.level, -1),
          levelAfter: event.level,
          debitAether: event.costAether,
          creditAether: 0,
          investedBeforeAether: ABI.checkedAdd(event.investedAether, -event.costAether),
          investedAfterAether: event.investedAether,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      } else if (event.type === "sell") {
        values = {
          action: "sell",
          sourceId: "command.sell",
          commandSeq: event.seq,
          towerRuntimeId: event.towerId,
          padId: event.padId,
          defenseId: event.defenseId,
          levelBefore: event.level,
          levelAfter: 0,
          debitAether: 0,
          creditAether: event.refundAether,
          investedBeforeAether: event.investedAether,
          investedAfterAether: 0,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      } else if (event.type === "waveStart") {
        const wave = missionRuntime.mission.waves[event.wave - 1];
        if (!wave) throw new RangeError("Wave-start telemetry has no compiled wave");
        values = {
          action: "wave-start-grant",
          sourceId: wave.id,
          commandSeq: event.seq,
          towerRuntimeId: null,
          padId: null,
          defenseId: null,
          levelBefore: null,
          levelAfter: null,
          debitAether: 0,
          creditAether: event.grantAether,
          investedBeforeAether: null,
          investedAfterAether: null,
          bankBeforeAether: bank,
          bankAfterAether: event.aetherAfter,
          bountyRemainderBefore: remainder,
          bountyRemainderAfter: remainder,
        };
      }
      if (values !== null) {
        telemetry.push("aether-transaction", values);
        bank = values.bankAfterAether;
      }
    });
    if (bank !== managementResult.state.aether ||
        remainder !== managementResult.state.bountyRemainder) {
      throw new Error("Management Aether telemetry diverged from its reducer result");
    }
  }

  function emitInternalAetherTelemetry(telemetry, action, sourceId, before, after) {
    const delta = ABI.checkedAdd(after.aether, -before.aether);
    telemetry.push("aether-transaction", {
      action: action,
      sourceId: sourceId,
      commandSeq: null,
      towerRuntimeId: null,
      padId: null,
      defenseId: null,
      levelBefore: null,
      levelAfter: null,
      debitAether: delta < 0 ? -delta : 0,
      creditAether: delta > 0 ? delta : 0,
      investedBeforeAether: null,
      investedAfterAether: null,
      bankBeforeAether: before.aether,
      bankAfterAether: after.aether,
      bountyRemainderBefore: before.bountyRemainder,
      bountyRemainderAfter: after.bountyRemainder,
    });
  }

  function activeSummonCount(towerRuntimes) {
    let count = 0;
    towerRuntimes.forEach(function (runtime) {
      runtime.behaviorStates.forEach(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.GUARD_SLOTS ||
            !behaviorState.state) return;
        behaviorState.state.slots.forEach(function (slot) {
          if (slot.summonRuntimeId !== null) count = ABI.checkedAdd(count, 1);
        });
      });
    });
    return count;
  }

  function runGuardScheduledSpawns(content, towerRuntimes, towers, management, config,
    currentTick, hostileCount, events, telemetry) {
    let nextManagement = management;
    let summonCount = activeSummonCount(towerRuntimes);
    const nextRuntimes = towerRuntimes.map(function (runtime) {
      const tower = towerByRuntimeId(towers, runtime.towerRuntimeId);
      const level = content.defenses[runtime.defenseId].levels[runtime.level - 1];
      const behaviorStates = runtime.behaviorStates.map(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.GUARD_SLOTS) return behaviorState;
        const behavior = level.behaviors[behaviorState.index];
        const nextSummonRuntimeId = nextManagement.runtimeIds.nextByDomain.summon;
        const result = Behaviors.dispatchBehavior(
          behaviorState.dispatchId,
          behaviorRequest(content, behavior, behaviorState.state, {
            actionId: "scheduled-spawns",
            elapsedTimeUnits: runtime.createdTick === currentTick ? 0 : ABI.TIME_UNITS_PER_TICK,
            nextSummonRuntimeId: nextSummonRuntimeId,
            towerRuntimeId: tower.id,
          })
        );
        if (result.created.length > 0 &&
            ABI.checkedAdd(hostileCount, ABI.checkedAdd(summonCount, result.created.length)) >
              MAX_ACTIVE_ENTITIES) {
          throw new RangeError("Active hostile and summon entities exceed the kernel ceiling");
        }
        result.created.forEach(function (created) {
          const allocation = allocateRuntimeId(nextManagement, config, "summon");
          if (allocation.runtimeId !== created.summonRuntimeId) {
            throw new Error("Guard behavior and kernel summon runtime IDs diverged");
          }
          nextManagement = allocation.management;
          summonCount = ABI.checkedAdd(summonCount, 1);
          telemetry.push("activation", {
            actionId: "guard-create",
            behaviorId: behavior.id,
            sourceTowerRuntimeId: tower.id,
            sourceRuntimeId: created.summonRuntimeId,
            defenseId: tower.defenseId,
            level: tower.level,
            padId: tower.padId,
            outcome: "accepted",
            eligibleTargetRuntimeIds: [],
            selectedTargetRuntimeIds: [],
          });
        });
        if (nextManagement.runtimeIds.nextByDomain.summon !== result.nextSummonRuntimeId) {
          throw new Error("Guard behavior returned a noncanonical next summon runtime ID");
        }
        appendEvents(events, result.events);
        return Object.freeze({
          behaviorId: behaviorState.behaviorId,
          dispatchId: behaviorState.dispatchId,
          index: behaviorState.index,
          state: result.state,
          timer: behaviorState.timer,
        });
      });
      return Object.freeze({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: runtime.createdTick,
        defenseId: runtime.defenseId,
        level: runtime.level,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    });
    return Object.freeze({
      management: nextManagement,
      towerRuntimes: Object.freeze(nextRuntimes),
    });
  }

  function freezeEffect(values) {
    return Object.freeze({
      appliedTick: values.appliedTick,
      coefficientBp: values.coefficientBp,
      damageTypeId: values.damageTypeId,
      delayTimer: values.delayTimer,
      id: values.id,
      kind: values.kind,
      magnitude: values.magnitude,
      secondaryDurationTimeUnits: values.secondaryDurationTimeUnits,
      sourceRuntimeId: values.sourceRuntimeId,
      sourceTypeId: values.sourceTypeId,
      statusId: values.statusId,
      targetRuntimeId: values.targetRuntimeId,
      timer: values.timer,
    });
  }

  function effectIdentity(effect) {
    return [
      effect.kind,
      effect.statusId,
      effect.damageTypeId,
      effect.sourceRuntimeId,
      effect.targetRuntimeId,
    ].join("\0");
  }

  function applyEffect(effects, management, config, values, currentTick) {
    const requested = {
      appliedTick: currentTick,
      coefficientBp: values.coefficientBp || ABI.BASIS_POINTS,
      damageTypeId: values.damageTypeId || null,
      delayTimer: values.delayTimeUnits
        ? Timers.applyStatusAfterExpiryPhase(values.delayTimeUnits, currentTick)
        : null,
      id: 0,
      kind: values.kind,
      magnitude: values.magnitude || 0,
      secondaryDurationTimeUnits: values.secondaryDurationTimeUnits || 0,
      sourceRuntimeId: values.sourceRuntimeId,
      sourceTypeId: values.sourceTypeId || null,
      statusId: values.statusId,
      targetRuntimeId: values.targetRuntimeId,
      timer: values.durationTimeUnits
        ? Timers.applyStatusAfterExpiryPhase(values.durationTimeUnits, currentTick)
        : null,
    };
    const identity = effectIdentity(requested);
    const existingIndex = effects.findIndex(function (effect) {
      return effectIdentity(effect) === identity;
    });
    let nextManagement = management;
    if (existingIndex >= 0) {
      requested.id = effects[existingIndex].id;
      const replaced = effects.slice();
      const effect = freezeEffect(requested);
      replaced[existingIndex] = effect;
      return Object.freeze({
        action: "refresh",
        effect: effect,
        effects: Object.freeze(replaced),
        management: nextManagement,
        outcome: "refreshed",
      });
    }
    const allocation = allocateRuntimeId(nextManagement, config, "effect");
    nextManagement = allocation.management;
    requested.id = allocation.runtimeId;
    const effect = freezeEffect(requested);
    const nextEffects = effects.concat([effect]);
    nextEffects.sort(function (left, right) { return left.id - right.id; });
    return Object.freeze({
      action: "apply",
      effect: effect,
      effects: Object.freeze(nextEffects),
      management: nextManagement,
      outcome: "applied",
    });
  }

  function effectRequestedDurationTimeUnits(effect) {
    if (effect.kind === "delayed-status") return effect.secondaryDurationTimeUnits;
    if (effect.timer !== null) return effect.timer.remainingUnits;
    return 0;
  }

  function pushEffectTelemetry(telemetry, action, outcome, effect, sourceTower,
    target, requestedMagnitude, appliedMagnitude, requestedDuration, appliedDuration) {
    telemetry.push("effect", {
      action: action,
      sourceTowerRuntimeId: sourceTower === null ? null : sourceTower.sourceTowerRuntimeId,
      sourceRuntimeId: effect.sourceRuntimeId,
      defenseId: sourceTower === null ? null : sourceTower.defenseId,
      level: sourceTower === null ? null : sourceTower.level,
      padId: sourceTower === null ? null : sourceTower.padId,
      targetRuntimeId: target.id,
      targetOwnerId: target.ownerId,
      targetRouteId: target.routeId,
      effectKind: effect.kind,
      statusId: effect.statusId,
      requestedMagnitude: requestedMagnitude,
      appliedMagnitude: appliedMagnitude,
      requestedDurationTimeUnits: requestedDuration,
      appliedDurationTimeUnits: appliedDuration,
      outcome: outcome,
    });
  }

  function pushAppliedEffectTelemetry(telemetry, applied, sourceTower, target) {
    const duration = effectRequestedDurationTimeUnits(applied.effect);
    pushEffectTelemetry(
      telemetry,
      applied.action,
      applied.outcome,
      applied.effect,
      sourceTower,
      target,
      applied.effect.magnitude,
      applied.effect.magnitude,
      duration,
      duration
    );
  }

  function pushRemovedEffectTelemetry(telemetry, action, outcome, effect, sourceTower, target) {
    pushEffectTelemetry(
      telemetry,
      action,
      outcome,
      effect,
      sourceTower,
      target,
      effect.magnitude,
      0,
      effectRequestedDurationTimeUnits(effect),
      0
    );
  }

  function effectSourceTowerIdentity(content, towers, effect) {
    if (effect.kind === "boss-exposure" || effect.kind === "resistance-override" ||
        effect.statusId === "stun" || effect.statusId === "resolve") {
      return null;
    }
    return towerTelemetryIdentity(content, towers, effect.sourceRuntimeId);
  }

  function removeEffects(effects, predicate) {
    return Object.freeze(effects.filter(function (effect) { return !predicate(effect); }));
  }

  function effectsForTarget(effects, targetRuntimeId, statusId) {
    return effects.filter(function (effect) {
      return effect.targetRuntimeId === targetRuntimeId &&
        (statusId === undefined || effect.statusId === statusId) &&
        effect.delayTimer === null;
    });
  }

  function hasStatus(effects, targetRuntimeId, statusId) {
    return effectsForTarget(effects, targetRuntimeId, statusId).length > 0;
  }

  function advanceShieldExpiry(enemy, currentTick) {
    const shields = [];
    enemy.shields.forEach(function (shield) {
      if (shield.timer === null) {
        shields.push(shield);
        return;
      }
      const advanced = Timers.advanceStatusExpiryPhase(shield.timer, currentTick);
      if (advanced.active) {
        shields.push(Object.freeze({
          poolId: shield.poolId,
          remainingMilli: shield.remainingMilli,
          sourceId: shield.sourceId,
          timer: advanced.state,
        }));
      }
    });
    const output = cloneCanonical(enemy);
    output.shields = shields;
    return Object.freeze(output);
  }

  function advanceEffectExpiry(effects, currentTick) {
    const activated = [];
    const expired = [];
    const lifecycle = [];
    const active = [];
    effects.forEach(function (effect) {
      if (effect.delayTimer !== null) {
        const delay = Timers.advanceStatusExpiryPhase(effect.delayTimer, currentTick);
        if (delay.active) {
          active.push(freezeEffect(Object.assign({}, effect, { delayTimer: delay.state })));
        } else {
          const nextEffect = freezeEffect(Object.assign({}, effect, {
            appliedTick: currentTick,
            delayTimer: null,
            kind: "status",
            timer: Timers.applyStatusAfterExpiryPhase(
              effect.secondaryDurationTimeUnits,
              currentTick
            ),
          }));
          active.push(nextEffect);
          const transition = Object.freeze({ effect: nextEffect, prior: effect });
          activated.push(transition);
          lifecycle.push(Object.freeze({ kind: "activated", transition: transition }));
        }
        return;
      }
      if (effect.timer === null) {
        active.push(effect);
        return;
      }
      const advanced = Timers.advanceStatusExpiryPhase(effect.timer, currentTick);
      if (advanced.active) {
        active.push(freezeEffect(Object.assign({}, effect, { timer: advanced.state })));
      } else {
        expired.push(effect);
        lifecycle.push(Object.freeze({ effect: effect, kind: "expired" }));
      }
    });
    return Object.freeze({
      activated: Object.freeze(activated),
      active: Object.freeze(active),
      expired: Object.freeze(expired),
      lifecycle: Object.freeze(lifecycle),
    });
  }

  function entityOwner(content, enemy) {
    const owner = enemy.kind === "boss" ? content.bosses[enemy.ownerId] : content.enemies[enemy.ownerId];
    if (!owner) throw new RangeError("Runtime entity references an unknown owner " + enemy.ownerId);
    return owner;
  }

  function movementReduction(content, enemy, effects) {
    if (hasStatus(effects, enemy.id, "stun")) {
      return Object.freeze({ effectiveSpeedBp: 0, scaledReductionBp: ABI.BASIS_POINTS });
    }
    const owner = entityOwner(content, enemy);
    const instances = effectsForTarget(effects, enemy.id).filter(function (effect) {
      return effect.statusId === "slow" || effect.statusId === "drench";
    }).map(function (effect) {
      return {
        appliedTick: effect.appliedTick,
        expiryTimeUnits: effect.timer === null ? Number.MAX_SAFE_INTEGER : effect.timer.remainingUnits,
        magnitude: effect.magnitude,
        sourceId: effect.sourceRuntimeId,
        statusId: effect.statusId,
      };
    });
    return Effects.resolveMovementReduction(
      instances,
      owner.control.slowControlBp,
      owner.control.minimumMovementBp
    );
  }

  function movementTelemetrySources(enemy, effects, reduction, towers) {
    let winners;
    if (hasStatus(effects, enemy.id, "stun")) {
      winners = effectsForTarget(effects, enemy.id, "stun").slice().sort(function (left, right) {
        return left.id - right.id;
      });
    } else if (reduction.source === null) {
      winners = [];
    } else {
      winners = effectsForTarget(effects, enemy.id).filter(function (effect) {
        return (effect.statusId === "slow" || effect.statusId === "drench") &&
          effect.sourceRuntimeId === reduction.source.sourceId;
      }).sort(function (left, right) { return left.id - right.id; });
      if (winners.length !== 1) {
        throw new RangeError("Movement telemetry cannot resolve its strongest effect source");
      }
    }
    const towerIds = [];
    winners.forEach(function (effect) {
      if (effect.statusId === "stun") return;
      if (towerByRuntimeId(towers, effect.sourceRuntimeId)) towerIds.push(effect.sourceRuntimeId);
    });
    return Object.freeze({
      sourceEffectRuntimeIds: Object.freeze(winners.map(function (effect) { return effect.id; })),
      sourceRuntimeIds: Object.freeze(winners.map(function (effect) {
        return effect.sourceRuntimeId;
      })),
      sourceTowerRuntimeIds: sortedUniqueRuntimeIds(towerIds),
    });
  }

  function replaceTowerBehaviorState(runtime, behaviorIndex, nextState) {
    const behaviorStates = runtime.behaviorStates.map(function (behaviorState) {
      if (behaviorState.index !== behaviorIndex) return behaviorState;
      return Object.freeze({
        behaviorId: behaviorState.behaviorId,
        dispatchId: behaviorState.dispatchId,
        index: behaviorState.index,
        state: nextState,
        timer: behaviorState.timer,
      });
    });
    return Object.freeze({
      behaviorStates: Object.freeze(behaviorStates),
      createdTick: runtime.createdTick,
      defenseId: runtime.defenseId,
      level: runtime.level,
      towerRuntimeId: runtime.towerRuntimeId,
    });
  }

  function guardTowerRequests(content, towerRuntimes) {
    const requests = [];
    towerRuntimes.forEach(function (runtime) {
      const level = content.defenses[runtime.defenseId].levels[runtime.level - 1];
      const slotState = runtime.behaviorStates.find(function (behaviorState) {
        return behaviorState.dispatchId === Behaviors.DISPATCH_IDS.GUARD_SLOTS;
      });
      if (!slotState) return;
      const blockState = runtime.behaviorStates.find(function (behaviorState) {
        return behaviorState.dispatchId === Behaviors.DISPATCH_IDS.BLOCK;
      });
      if (!blockState) throw new RangeError("Guard-slot behavior requires its bound block behavior");
      requests.push({
        blockIndex: blockState.index,
        parameters: level.behaviors[blockState.index].parameters,
        slotIndex: slotState.index,
        state: slotState.state,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    });
    return requests;
  }

  function runMovementAndGuards(content, missionRuntime, enemiesInput, effectsInput,
    towerRuntimesInput, management, config, currentTick, events, telemetry) {
    const plans = enemiesInput.map(function (enemy) {
      const reduction = movementReduction(content, enemy, effectsInput);
      const movement = Movement.advanceMovementTick(
        enemy.movement,
        enemy.baseSpeedDistanceUnitsPerSecond,
        reduction.effectiveSpeedBp
      );
      const route = missionRuntime.map.routes.find(function (candidate) {
        return candidate.id === enemy.routeId;
      });
      const progress = Movement.advanceRouteProgress(route.length, enemy.distance, movement.advance);
      return {
        enemy: enemy,
        movement: movement,
        progress: progress,
        reduction: reduction,
        route: route,
      };
    });
    const contacts = plans.filter(function (plan) {
      return plan.movement.advance > 0;
    }).map(function (plan) {
      const owner = entityOwner(content, plan.enemy);
      return {
        enemyRuntimeId: plan.enemy.id,
        hardControlActive: hasStatus(effectsInput, plan.enemy.id, "stun"),
        hardControlBp: owner.control.hardControlBp,
        nextRouteDistance: plan.progress.distance,
        priorRouteDistance: plan.enemy.distance,
        requestedForwardAdvance: plan.movement.advance,
        resolveActive: hasStatus(effectsInput, plan.enemy.id, "resolve"),
        routeId: plan.enemy.routeId,
        tags: plan.enemy.tags,
        targetKind: plan.enemy.routeKind,
      };
    });
    const guardRequests = guardTowerRequests(content, towerRuntimesInput);
    let towerRuntimes = towerRuntimesInput;
    let acceptedContacts = [];
    let queuedDamageIntents = [];
    if (guardRequests.length > 0 && contacts.length > 0) {
      const resolved = Behaviors.resolveGuardContactBatch({
        eventCatalog: content.eventCatalog,
        input: { actionId: "movement-contacts", contacts: contacts },
        limits: BEHAVIOR_LIMITS,
        towers: guardRequests.map(function (request) {
          return {
            parameters: request.parameters,
            state: request.state,
            towerRuntimeId: request.towerRuntimeId,
          };
        }),
      });
      appendEvents(events, resolved.events);
      acceptedContacts = resolved.acceptedContacts;
      resolved.events.forEach(function (event) {
        const request = guardRequests.find(function (candidate) {
          return (candidate.parameters.contactEventId === event.eventId ||
              candidate.parameters.rejectedEventId === event.eventId) &&
            candidate.state.slots.some(function (slot) {
              return slot.summonRuntimeId === event.payload.summonRuntimeId;
            });
        });
        if (!request) return;
        const tower = towerByRuntimeId(management.towers, request.towerRuntimeId);
        if (!tower) throw new RangeError("Guard activation source tower is not owned");
        const behavior = content.defenses[tower.defenseId].levels[tower.level - 1]
          .behaviors[request.blockIndex];
        const accepted = request.parameters.contactEventId === event.eventId;
        telemetry.push("activation", {
          actionId: "guard-contact",
          behaviorId: behavior.id,
          sourceTowerRuntimeId: tower.id,
          sourceRuntimeId: event.payload.summonRuntimeId,
          defenseId: tower.defenseId,
          level: tower.level,
          padId: tower.padId,
          outcome: accepted ? "accepted" : "rejected",
          eligibleTargetRuntimeIds: [event.payload.enemyRuntimeId],
          selectedTargetRuntimeIds: accepted ? [event.payload.enemyRuntimeId] : [],
        });
      });
      const guardTargetOrders = Object.create(null);
      queuedDamageIntents = resolved.queuedDamageIntents.map(function (intent) {
        const request = guardRequests.find(function (candidate) {
          return candidate.towerRuntimeId === intent.towerRuntimeId;
        });
        const accepted = resolved.acceptedContacts.find(function (contact) {
          return contact.towerRuntimeId === intent.towerRuntimeId &&
            contact.enemyRuntimeId === intent.targetRuntimeId;
        });
        if (!accepted) throw new Error("Guard bash intent has no accepted contact source");
        const orderKey = request.towerRuntimeId + "\0" + request.blockIndex;
        const targetOrder = guardTargetOrders[orderKey] || 0;
        guardTargetOrders[orderKey] = ABI.checkedAdd(targetOrder, 1);
        return Object.assign({}, intent, {
          behaviorIndex: request.blockIndex,
          eligibilityMode: null,
          isPrimary: true,
          sourceRuntimeId: accepted.summonRuntimeId,
          targetOrder: targetOrder,
        });
      });
      towerRuntimes = Object.freeze(towerRuntimesInput.map(function (runtime) {
        const result = resolved.towerStates.find(function (candidate) {
          return candidate.towerRuntimeId === runtime.towerRuntimeId;
        });
        const request = guardRequests.find(function (candidate) {
          return candidate.towerRuntimeId === runtime.towerRuntimeId;
        });
        return result ? replaceTowerBehaviorState(runtime, request.slotIndex, result.state) : runtime;
      }));
    }
    const contactByEnemy = Object.create(null);
    acceptedContacts.forEach(function (contact) { contactByEnemy[contact.enemyRuntimeId] = contact; });
    let effects = effectsInput;
    let nextManagement = management;
    const enemies = plans.map(function (plan) {
      const accepted = contactByEnemy[plan.enemy.id];
      const distance = accepted ? accepted.clampedRouteDistance : plan.progress.distance;
      const output = cloneCanonical(plan.enemy);
      output.distance = distance;
      output.movement = plan.movement.state;
      output.position = Geometry.positionOnRoute(plan.route, distance);
      let movementSources = movementTelemetrySources(
        plan.enemy,
        effectsInput,
        plan.reduction,
        management.towers
      );
      let effectiveSpeedBp = plan.reduction.effectiveSpeedBp;
      let scaledReductionBp = plan.reduction.scaledReductionBp;
      if (accepted) {
        const sourceTower = requiredTowerTelemetryIdentity(
          content,
          management.towers,
          accepted.towerRuntimeId
        );
        let applied = applyEffect(effects, nextManagement, config, {
          kind: "status",
          magnitude: ABI.BASIS_POINTS,
          sourceRuntimeId: accepted.summonRuntimeId,
          statusId: accepted.statusId,
          targetRuntimeId: plan.enemy.id,
          durationTimeUnits: accepted.durationTimeUnits,
        }, currentTick);
        effects = applied.effects;
        nextManagement = applied.management;
        pushAppliedEffectTelemetry(telemetry, applied, sourceTower, plan.enemy);
        movementSources = Object.freeze({
          sourceEffectRuntimeIds: Object.freeze([applied.effect.id]),
          sourceRuntimeIds: Object.freeze([accepted.summonRuntimeId]),
          sourceTowerRuntimeIds: Object.freeze([accepted.towerRuntimeId]),
        });
        effectiveSpeedBp = 0;
        scaledReductionBp = ABI.BASIS_POINTS;
        applied = applyEffect(effects, nextManagement, config, {
          kind: "delayed-status",
          magnitude: 0,
          sourceRuntimeId: accepted.summonRuntimeId,
          statusId: accepted.resolveStatusId,
          targetRuntimeId: plan.enemy.id,
          delayTimeUnits: accepted.resolveStartsAfterTimeUnits,
          secondaryDurationTimeUnits: accepted.resolveDurationTimeUnits,
        }, currentTick);
        effects = applied.effects;
        nextManagement = applied.management;
        pushAppliedEffectTelemetry(telemetry, applied, sourceTower, plan.enemy);
      }
      telemetry.push("movement-control", {
        enemyRuntimeId: plan.enemy.id,
        ownerId: plan.enemy.ownerId,
        lineageId: plan.enemy.lineageId,
        routeId: plan.enemy.routeId,
        priorRouteDistance: plan.enemy.distance,
        nextRouteDistance: distance,
        actualAdvanceDistance: ABI.checkedAdd(distance, -plan.enemy.distance),
        effectiveSpeedBp: effectiveSpeedBp,
        scaledReductionBp: scaledReductionBp,
        sourceEffectRuntimeIds: movementSources.sourceEffectRuntimeIds,
        sourceRuntimeIds: movementSources.sourceRuntimeIds,
        sourceTowerRuntimeIds: movementSources.sourceTowerRuntimeIds,
      });
      return Object.freeze(output);
    });
    return Object.freeze({
      effects: effects,
      enemies: Object.freeze(enemies),
      guardDamageIntents: Object.freeze(queuedDamageIntents),
      management: nextManagement,
      towerRuntimes: towerRuntimes,
    });
  }

  function cloakEligibility(content, enemy, effects, mode) {
    const traitIndex = enemy.traitStates.findIndex(function (trait) { return trait.kind === "cloak"; });
    if (traitIndex < 0) return true;
    const owner = entityOwner(content, enemy);
    const trait = owner.traits[traitIndex];
    const result = Behaviors.dispatchBehavior(
      Behaviors.DISPATCH_IDS.CLOAK,
      behaviorRequest(content, { parameters: trait }, enemy.traitStates[traitIndex].state, {
        actionId: "eligibility",
        revealActive: hasStatus(effects, enemy.id, "reveal"),
      })
    );
    if (mode === "continuous") return true;
    if (mode === "collateral") return result.eligibility.collateralEligible;
    return result.eligibility.directEligible;
  }

  function targetingCandidate(content, enemy, effects, mode) {
    return Targeting.createTargetCandidate({
      baseSpeedDistanceUnitsPerSecond: enemy.baseSpeedDistanceUnitsPerSecond,
      currentHpMilli: enemy.hpMilli,
      id: enemy.id,
      layerId: enemy.routeKind,
      remainingDistance: enemy.position.remainingDistance,
      revealEligible: cloakEligibility(content, enemy, effects, mode),
      shieldPoolsMilli: enemy.shields.map(function (shield) { return shield.remainingMilli; }),
      threatPriority: enemy.threatPriority,
      x: enemy.position.x,
      y: enemy.position.y,
    });
  }

  function towerPad(missionRuntime, tower) {
    const pad = missionRuntime.map.pads.find(function (candidate) { return candidate.id === tower.padId; });
    if (!pad) throw new RangeError("Tower references an unknown compiled pad " + tower.padId);
    return pad;
  }

  function eligibleTargets(content, missionRuntime, tower, defense, level, enemies, effects, mode) {
    if (enemies.length > MAX_TARGET_CANDIDATES) {
      throw new RangeError("Target candidates exceed the kernel ceiling");
    }
    const pad = towerPad(missionRuntime, tower);
    const query = Targeting.createTargetQuery({
      originX: pad.x,
      originY: pad.y,
      range: level.rangeWorldUnits,
      targetLayerIds: defense.targetKinds,
    });
    return Targeting.filterEligibleTargets(query, enemies.filter(function (enemy) {
      return enemy.hpMilli > 0;
    }).map(function (enemy) {
      return targetingCandidate(content, enemy, effects, mode);
    }));
  }

  function behaviorCandidate(enemy) {
    return {
      remainingRouteDistance: enemy.position.remainingDistance,
      routeId: enemy.routeId,
      runtimeId: enemy.id,
      targetKind: enemy.routeKind,
      threatPriority: enemy.threatPriority,
      x: enemy.position.x,
      y: enemy.position.y,
    };
  }

  function behaviorCandidateWithoutCoordinates(enemy) {
    return {
      remainingRouteDistance: enemy.position.remainingDistance,
      routeId: enemy.routeId,
      runtimeId: enemy.id,
      targetKind: enemy.routeKind,
      threatPriority: enemy.threatPriority,
    };
  }

  function replaceEnemyTraitState(enemy, traitIndex, nextState) {
    const output = cloneCanonical(enemy);
    output.traitStates[traitIndex].state = nextState;
    return Object.freeze(output);
  }

  function runStatusExpiry(content, missionRuntime, enemiesInput, effectsInput, towerRuntimesInput,
    towers, telemetryTowers, currentTick, events, telemetry) {
    const expiredEffects = advanceEffectExpiry(effectsInput, currentTick);
    let effects = expiredEffects.active;
    expiredEffects.lifecycle.forEach(function (lifecycle) {
      if (lifecycle.kind === "activated") {
        const effect = lifecycle.transition.effect;
        const duration = effectRequestedDurationTimeUnits(effect);
        pushEffectTelemetry(
          telemetry,
          "refresh",
          "refreshed",
          effect,
          effectSourceTowerIdentity(content, telemetryTowers, effect),
          requiredTelemetryTarget(enemiesInput, effect.targetRuntimeId),
          effect.magnitude,
          effect.magnitude,
          duration,
          duration
        );
        return;
      }
      pushRemovedEffectTelemetry(
        telemetry,
        "expire",
        "expired",
        lifecycle.effect,
        effectSourceTowerIdentity(content, telemetryTowers, lifecycle.effect),
        requiredTelemetryTarget(enemiesInput, lifecycle.effect.targetRuntimeId)
      );
    });
    let towerRuntimes = towerRuntimesInput;
    const runtimesById = Object.create(null);
    towerRuntimes.forEach(function (runtime) { runtimesById[runtime.towerRuntimeId] = runtime; });

    towerRuntimes = Object.freeze(towerRuntimes.map(function (runtime) {
      const tower = towerByRuntimeId(towers, runtime.towerRuntimeId);
      const defense = content.defenses[runtime.defenseId];
      const level = defense.levels[runtime.level - 1];
      let nextRuntime = runtime;
      runtime.behaviorStates.forEach(function (behaviorState) {
        const behavior = level.behaviors[behaviorState.index];
        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.REVEAL) {
          const eligible = tower
            ? eligibleTargets(
                content, missionRuntime, tower, defense, level, enemiesInput, effects, "continuous"
              ).map(function (candidate) { return candidate.id; })
            : [];
          const result = Behaviors.dispatchBehavior(
            behaviorState.dispatchId,
            behaviorRequest(content, behavior, behaviorState.state, {
              actionId: "status-expiry",
              eligibleEnemyRuntimeIds: eligible,
              sourceActive: tower !== undefined,
              towerRuntimeId: runtime.towerRuntimeId,
            })
          );
          appendEvents(events, result.events);
          result.statusIntents.forEach(function (intent) {
            if (intent.kind === "remove") {
              const removed = effects.filter(function (effect) {
                return effect.sourceRuntimeId === runtime.towerRuntimeId &&
                  effect.targetRuntimeId === intent.enemyRuntimeId &&
                  effect.statusId === intent.statusId;
              });
              effects = removeEffects(effects, function (effect) {
                return effect.sourceRuntimeId === runtime.towerRuntimeId &&
                  effect.targetRuntimeId === intent.enemyRuntimeId && effect.statusId === intent.statusId;
              });
              removed.forEach(function (effect) {
                pushRemovedEffectTelemetry(
                  telemetry,
                  "remove",
                  "removed",
                  effect,
                  requiredTowerTelemetryIdentity(content, telemetryTowers, runtime.towerRuntimeId),
                  requiredTelemetryTarget(enemiesInput, effect.targetRuntimeId)
                );
              });
            }
          });
          nextRuntime = replaceTowerBehaviorState(nextRuntime, behaviorState.index, result.state);
        }
        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.MARK) {
          const expiredEnemyRuntimeIds = expiredEffects.expired.filter(function (effect) {
            return effect.sourceRuntimeId === runtime.towerRuntimeId && effect.statusId === "mark";
          }).map(function (effect) { return effect.targetRuntimeId; }).sort(function (a, b) { return a - b; });
          if (expiredEnemyRuntimeIds.length > 0) {
            const result = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "status-expiry",
                expiredEnemyRuntimeIds: expiredEnemyRuntimeIds,
                towerRuntimeId: runtime.towerRuntimeId,
              })
            );
            appendEvents(events, result.events);
            nextRuntime = replaceTowerBehaviorState(nextRuntime, behaviorState.index, result.state);
          }
        }
      });
      return nextRuntime;
    }));

    const enemies = enemiesInput.map(function (enemy) {
      let nextEnemy = advanceShieldExpiry(enemy, currentTick);
      nextEnemy.traitStates.forEach(function (traitState, traitIndex) {
        if (traitState.dispatchId !== Behaviors.DISPATCH_IDS.CLOAK) return;
        const owner = entityOwner(content, nextEnemy);
        const result = Behaviors.dispatchBehavior(
          traitState.dispatchId,
          behaviorRequest(content, { parameters: owner.traits[traitIndex] }, traitState.state, {
            actionId: "status-expiry",
            elapsedTimeUnits: ABI.TIME_UNITS_PER_TICK,
            enemyRuntimeId: nextEnemy.id,
            revealActive: hasStatus(effects, nextEnemy.id, "reveal"),
          })
        );
        appendEvents(events, result.events);
        nextEnemy = replaceEnemyTraitState(nextEnemy, traitIndex, result.state);
      });
      return nextEnemy;
    });
    return Object.freeze({
      effects: effects,
      enemies: Object.freeze(enemies),
      towerRuntimes: towerRuntimes,
    });
  }

  function selectedTarget(policy, candidates) {
    if (candidates.length === 0) return null;
    let selected = candidates[0];
    for (let index = 1; index < candidates.length; index++) {
      if (Targeting.compareTargets(policy, candidates[index], selected) < 0) {
        selected = candidates[index];
      }
    }
    return selected;
  }

  function freezeBehaviorStateRecord(prior, state, timer) {
    return Object.freeze({
      behaviorId: prior.behaviorId,
      dispatchId: prior.dispatchId,
      index: prior.index,
      state: state,
      timer: timer,
    });
  }

  function directIntent(intent, behaviorIndex, targetOrder) {
    return Object.freeze({
      armorIgnoreBp: intent.armorIgnoreBp,
      baseDamageMilli: intent.baseDamageMilli,
      behaviorIndex: behaviorIndex,
      bossCoefficientBp: intent.bossCoefficientBp,
      damageTypeId: intent.damageTypeId,
      internalDamageCoefficientBp: intent.internalDamageCoefficientBp,
      isPrimary: true,
      eligibilityMode: "direct",
      shieldCoefficientBp: intent.shieldCoefficientBp,
      sourceRuntimeId: intent.towerRuntimeId,
      targetOrder: targetOrder,
      targetRuntimeId: intent.targetRuntimeId,
      towerRuntimeId: intent.towerRuntimeId,
    });
  }

  function splashIntent(intent, behaviorIndex, targetOrder, towerRuntimeId) {
    return Object.freeze({
      armorIgnoreBp: 0,
      baseDamageMilli: intent.baseDamageMilli,
      behaviorIndex: behaviorIndex,
      bossCoefficientBp: ABI.BASIS_POINTS,
      damageTypeId: intent.damageTypeId,
      internalDamageCoefficientBp: intent.damageCoefficientBp,
      isPrimary: intent.isPrimary,
      eligibilityMode: intent.isPrimary ? "direct" : "collateral",
      shieldCoefficientBp: ABI.BASIS_POINTS,
      sourceRuntimeId: towerRuntimeId,
      targetOrder: targetOrder,
      targetRuntimeId: intent.targetRuntimeId,
      towerRuntimeId: towerRuntimeId,
    });
  }

  function compareHitIntents(left, right) {
    if (left.towerRuntimeId !== right.towerRuntimeId) {
      return left.towerRuntimeId < right.towerRuntimeId ? -1 : 1;
    }
    if (left.behaviorIndex !== right.behaviorIndex) {
      return left.behaviorIndex < right.behaviorIndex ? -1 : 1;
    }
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    if (left.targetOrder !== right.targetOrder) return left.targetOrder < right.targetOrder ? -1 : 1;
    return 0;
  }

  function runTowerAttacks(content, missionRuntime, enemies, effects, towerRuntimesInput,
    towers, events, telemetry) {
    const hitIntents = [];
    const statusIntents = [];
    const towerRuntimes = towerRuntimesInput.map(function (runtime) {
      const tower = towerByRuntimeId(towers, runtime.towerRuntimeId);
      if (!tower) throw new RangeError("Combat runtime has no owned tower");
      const defense = content.defenses[runtime.defenseId];
      const level = defense.levels[runtime.level - 1];
      const behaviorStates = runtime.behaviorStates.slice();

      level.behaviors.forEach(function (behavior, behaviorIndex) {
        let behaviorState = behaviorStates[behaviorIndex];
        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.DIRECT) {
          const candidates = eligibleTargets(
            content, missionRuntime, tower, defense, level, enemies, effects, "direct"
          );
          const target = selectedTarget(tower.targetPolicy, candidates);
          const readyBeforeAdvance = behaviorState.timer.remainingUnits <= ABI.TIME_UNITS_PER_TICK;
          const cooldown = Timers.advanceCooldownAttackPhase(
            behaviorState.timer,
            target !== null,
            Timers.authoredMillisecondsToTimeUnits(behavior.parameters.cooldownMs),
            0
          );
          let nextBehaviorState = behaviorState.state;
          if (cooldown.attacked) {
            const result = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "accepted-primary-hit",
                targetRuntimeId: target.id,
                towerRuntimeId: tower.id,
              })
            );
            nextBehaviorState = result.state;
            appendEvents(events, result.events);
            hitIntents.push(directIntent(result.damageIntent, behaviorIndex, 0));
            telemetry.push("activation", {
              actionId: "direct-hit",
              behaviorId: behavior.id,
              sourceTowerRuntimeId: tower.id,
              sourceRuntimeId: tower.id,
              defenseId: tower.defenseId,
              level: tower.level,
              padId: tower.padId,
              outcome: "accepted",
              eligibleTargetRuntimeIds: sortedUniqueRuntimeIds(candidates.map(function (candidate) {
                return candidate.id;
              })),
              selectedTargetRuntimeIds: [target.id],
            });
            const primaryEnemy = enemies.find(function (enemy) { return enemy.id === target.id; });
            level.behaviors.forEach(function (linked, linkedIndex) {
              if (linked.contractId !== "slow" ||
                  linked.parameters.triggerBehaviorId !== behavior.id) return;
              const linkedState = behaviorStates[linkedIndex];
              const secondaryCandidates = enemies.filter(function (enemy) {
                return enemy.hpMilli > 0 && cloakEligibility(content, enemy, effects, "collateral");
              }).map(behaviorCandidate);
              const slow = Behaviors.dispatchBehavior(
                linkedState.dispatchId,
                behaviorRequest(content, linked, linkedState.state, {
                  actionId: "accepted-primary-hit",
                  primaryPosition: { x: primaryEnemy.position.x, y: primaryEnemy.position.y },
                  primaryTargetRuntimeId: primaryEnemy.id,
                  secondaryCandidates: secondaryCandidates,
                  towerRuntimeId: tower.id,
                })
              );
              appendEvents(events, slow.events);
              statusIntents.push(Object.assign({}, slow.primaryStatusIntent, {
                behaviorIndex: linkedIndex,
                kind: "status",
                sourceRuntimeId: tower.id,
                sourceTypeId: null,
                targetOrder: 0,
              }));
              slow.secondaryStatusIntents.forEach(function (intent, targetOrder) {
                statusIntents.push(Object.assign({}, intent, {
                  behaviorIndex: linkedIndex,
                  kind: "status",
                  sourceRuntimeId: tower.id,
                  sourceTypeId: null,
                  targetOrder: ABI.checkedAdd(targetOrder, 1),
                }));
              });
              behaviorStates[linkedIndex] = freezeBehaviorStateRecord(
                linkedState,
                slow.state,
                linkedState.timer
              );
            });
          } else if (target === null) {
            const idle = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "no-target",
                elapsedTimeUnits: ABI.TIME_UNITS_PER_TICK,
              })
            );
            nextBehaviorState = idle.state;
            appendEvents(events, idle.events);
            if (readyBeforeAdvance) {
              telemetry.push("activation", {
                actionId: "direct-hit",
                behaviorId: behavior.id,
                sourceTowerRuntimeId: tower.id,
                sourceRuntimeId: tower.id,
                defenseId: tower.defenseId,
                level: tower.level,
                padId: tower.padId,
                outcome: "no-target",
                eligibleTargetRuntimeIds: [],
                selectedTargetRuntimeIds: [],
              });
            }
          }
          behaviorStates[behaviorIndex] = freezeBehaviorStateRecord(
            behaviorState,
            nextBehaviorState,
            cooldown.state
          );
          return;
        }

        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.SPLASH) {
          const candidates = eligibleTargets(
            content, missionRuntime, tower, defense, level, enemies, effects, "direct"
          );
          const target = selectedTarget(tower.targetPolicy, candidates);
          const readyBeforeAdvance = behaviorState.timer.remainingUnits <= ABI.TIME_UNITS_PER_TICK;
          const cooldown = Timers.advanceCooldownAttackPhase(
            behaviorState.timer,
            target !== null,
            Timers.authoredMillisecondsToTimeUnits(behavior.parameters.cooldownMs),
            0
          );
          if (cooldown.attacked) {
            const primaryEnemy = enemies.find(function (enemy) { return enemy.id === target.id; });
            const secondaries = enemies.filter(function (enemy) {
              return enemy.hpMilli > 0 && defense.targetKinds.indexOf(enemy.routeKind) !== -1 &&
                cloakEligibility(content, enemy, effects, "collateral");
            }).map(behaviorCandidate);
            const result = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "resolve",
                primaryTarget: behaviorCandidate(primaryEnemy),
                secondaryCandidates: secondaries,
                towerRuntimeId: tower.id,
              })
            );
            appendEvents(events, result.events);
            result.hitIntents.forEach(function (intent, targetOrder) {
              hitIntents.push(splashIntent(intent, behaviorIndex, targetOrder, tower.id));
            });
            telemetry.push("activation", {
              actionId: "splash-blast",
              behaviorId: behavior.id,
              sourceTowerRuntimeId: tower.id,
              sourceRuntimeId: tower.id,
              defenseId: tower.defenseId,
              level: tower.level,
              padId: tower.padId,
              outcome: "accepted",
              eligibleTargetRuntimeIds: sortedUniqueRuntimeIds(
                candidates.map(function (candidate) { return candidate.id; })
                  .concat(secondaries.map(function (candidate) { return candidate.runtimeId; }))
              ),
              selectedTargetRuntimeIds: sortedUniqueRuntimeIds(result.hitIntents.map(function (intent) {
                return intent.targetRuntimeId;
              })),
            });
            behaviorStates[behaviorIndex] = freezeBehaviorStateRecord(
              behaviorState,
              result.state,
              cooldown.state
            );
          } else {
            if (target === null && readyBeforeAdvance) {
              telemetry.push("activation", {
                actionId: "splash-blast",
                behaviorId: behavior.id,
                sourceTowerRuntimeId: tower.id,
                sourceRuntimeId: tower.id,
                defenseId: tower.defenseId,
                level: tower.level,
                padId: tower.padId,
                outcome: "no-target",
                eligibleTargetRuntimeIds: [],
                selectedTargetRuntimeIds: [],
              });
            }
            behaviorStates[behaviorIndex] = freezeBehaviorStateRecord(
              behaviorState,
              behaviorState.state,
              cooldown.state
            );
          }
          return;
        }

        if (behaviorState.dispatchId === Behaviors.DISPATCH_IDS.MARK) {
          const candidates = eligibleTargets(
            content, missionRuntime, tower, defense, level, enemies, effects, "direct"
          );
          const cooldown = Timers.advanceCooldownAttackPhase(
            behaviorState.timer,
            candidates.length > 0,
            Timers.authoredMillisecondsToTimeUnits(behavior.parameters.cadenceMs),
            0
          );
          const readyBeforeAdvance = behaviorState.timer.remainingUnits <= ABI.TIME_UNITS_PER_TICK;
          let nextBehaviorState = behaviorState.state;
          if (cooldown.attacked) {
            const result = Behaviors.dispatchBehavior(
              behaviorState.dispatchId,
              behaviorRequest(content, behavior, behaviorState.state, {
                actionId: "scan",
                candidates: candidates.map(function (candidate) {
                  return behaviorCandidateWithoutCoordinates(enemies.find(function (enemy) {
                    return enemy.id === candidate.id;
                  }));
                }),
                towerRuntimeId: tower.id,
              })
            );
            nextBehaviorState = result.state;
            appendEvents(events, result.events);
            result.markIntents.forEach(function (intent, targetOrder) {
              statusIntents.push({
                behaviorIndex: behaviorIndex,
                durationTimeUnits: intent.durationTimeUnits,
                kind: "external-amplification",
                magnitudeBp: intent.amountBp,
                sourceRuntimeId: tower.id,
                sourceTypeId: intent.sourceTypeId,
                statusId: intent.statusId,
                targetOrder: targetOrder,
                targetRuntimeId: intent.targetRuntimeId,
              });
            });
            telemetry.push("activation", {
              actionId: "mark-scan",
              behaviorId: behavior.id,
              sourceTowerRuntimeId: tower.id,
              sourceRuntimeId: tower.id,
              defenseId: tower.defenseId,
              level: tower.level,
              padId: tower.padId,
              outcome: "accepted",
              eligibleTargetRuntimeIds: sortedUniqueRuntimeIds(candidates.map(function (candidate) {
                return candidate.id;
              })),
              selectedTargetRuntimeIds: sortedUniqueRuntimeIds(result.markIntents.map(function (intent) {
                return intent.targetRuntimeId;
              })),
            });
          } else if (candidates.length === 0 && readyBeforeAdvance) {
            telemetry.push("activation", {
              actionId: "mark-scan",
              behaviorId: behavior.id,
              sourceTowerRuntimeId: tower.id,
              sourceRuntimeId: tower.id,
              defenseId: tower.defenseId,
              level: tower.level,
              padId: tower.padId,
              outcome: "no-target",
              eligibleTargetRuntimeIds: [],
              selectedTargetRuntimeIds: [],
            });
          }
          behaviorStates[behaviorIndex] = freezeBehaviorStateRecord(
            behaviorState,
            nextBehaviorState,
            cooldown.state
          );
        }
      });
      return Object.freeze({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: runtime.createdTick,
        defenseId: runtime.defenseId,
        level: runtime.level,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    });
    hitIntents.sort(compareHitIntents);
    return Object.freeze({
      hitIntents: Object.freeze(hitIntents),
      statusIntents: Object.freeze(statusIntents),
      towerRuntimes: Object.freeze(towerRuntimes),
    });
  }

  function compareBossReleases(left, right) {
    if (left.dueTick !== right.dueTick) return left.dueTick < right.dueTick ? -1 : 1;
    if (left.releasePlan.bossRuntimeId !== right.releasePlan.bossRuntimeId) {
      return left.releasePlan.bossRuntimeId < right.releasePlan.bossRuntimeId ? -1 : 1;
    }
    return left.releasePlan.thresholdOrder - right.releasePlan.thresholdOrder;
  }

  function runTalosReleases(content, missionRuntime, pendingInput, pendingSpawnsInput, effectsInput,
    enemies, management, config, currentTick, events, telemetry) {
    if (pendingInput.some(function (record) { return record.dueTick < currentTick; })) {
      throw new RangeError("A Talos warning release missed its canonical due tick");
    }
    const due = pendingInput.filter(function (record) { return record.dueTick === currentTick; });
    const future = pendingInput.filter(function (record) { return record.dueTick > currentTick; });
    let pendingSpawns = pendingSpawnsInput.slice();
    let effects = effectsInput;
    let nextManagement = management;
    due.forEach(function (record) {
      const target = enemies.find(function (enemy) {
        return enemy.id === record.releasePlan.bossRuntimeId;
      }) || Object.freeze({
        id: record.releasePlan.bossRuntimeId,
        ownerId: "talos-prototype",
        routeId: record.releasePlan.routeId,
      });
      const result = Behaviors.dispatchBehavior(
        Behaviors.DISPATCH_IDS.TALOS,
        {
          eventCatalog: content.eventCatalog,
          input: { actionId: "warning-release", releasePlan: record.releasePlan },
          limits: BEHAVIOR_LIMITS,
          parameters: content.bosses["talos-prototype"],
          state: null,
        }
      );
      appendEvents(events, result.events);
      if (result.statusDeliveries.length !== 1) {
        throw new RangeError("Candidate Talos exposure requires exactly one status delivery");
      }
      const delivery = result.statusDeliveries[0];
      let applied = applyEffect(effects, nextManagement, config, {
        coefficientBp: result.exposure.damageCoefficientBp,
        durationTimeUnits: result.exposure.durationTimeUnits,
        kind: "boss-exposure",
        magnitude: delivery.magnitudeBp,
        sourceRuntimeId: result.exposure.targetRuntimeId,
        statusId: delivery.statusId,
        targetRuntimeId: result.exposure.targetRuntimeId,
      }, currentTick);
      effects = applied.effects;
      nextManagement = applied.management;
      pushAppliedEffectTelemetry(telemetry, applied, null, target);
      result.resistanceOverridePlans.forEach(function (override) {
        applied = applyEffect(effects, nextManagement, config, {
          damageTypeId: override.damageTypeId,
          durationTimeUnits: override.durationTimeUnits,
          kind: "resistance-override",
          magnitude: override.reductionBp,
          sourceRuntimeId: record.releasePlan.bossRuntimeId,
          statusId: "resistance-override",
          targetRuntimeId: override.targetRuntimeId,
        }, currentTick);
        effects = applied.effects;
        nextManagement = applied.management;
        pushAppliedEffectTelemetry(telemetry, applied, null, target);
      });
      result.childSpawnPlans.forEach(function (plan) {
        for (let childIndex = 0; childIndex < plan.count; childIndex += 1) {
          const relativeTick = ABI.checkedAdd(
            plan.firstDelayTicks,
            ABI.checkedMultiply(childIndex, plan.intervalTicks)
          );
          pendingSpawns.push(frozenSpawnJob({
            authoredIndex: childIndex,
            bountyPolicy: plan.bountyPolicy,
            dueTick: ABI.checkedAdd(currentTick, relativeTick),
            groupId: "talos." + record.releasePlan.thresholdId + "." + plan.order,
            groupOrder: ABI.checkedAdd(1000, ABI.checkedAdd(
              ABI.checkedMultiply(record.releasePlan.thresholdOrder, 100),
              plan.order
            )),
            lineageId: plan.lineageId,
            lineageTags: record.lineageTags,
            ownerId: plan.enemyId,
            routeDistance: ABI.checkedAdd(plan.routeDistance, plan.routeOffsetDistance),
            routeId: plan.routeId,
            sourceBossRuntimeId: plan.sourceBossRuntimeId,
            spawnEventId: null,
            spawnKind: "enemy",
            waveId: record.waveId,
          }));
        }
      });
    });
    pendingSpawns.sort(compareSpawnJobs);
    return Object.freeze({
      effects: effects,
      management: nextManagement,
      pendingBossReleases: Object.freeze(future),
      pendingSpawns: Object.freeze(pendingSpawns),
    });
  }

  function externalDamageEffects(effects, targetRuntimeId) {
    return effectsForTarget(effects, targetRuntimeId).filter(function (effect) {
      return effect.kind === "external-amplification";
    });
  }

  function externalDamageBonus(effects, targetRuntimeId) {
    const inputs = externalDamageEffects(effects, targetRuntimeId).map(function (effect) {
      return {
        appliedTick: effect.appliedTick,
        damageBp: effect.magnitude,
        expiryTimeUnits: effect.timer === null ? Number.MAX_SAFE_INTEGER : effect.timer.remainingUnits,
        magnitude: effect.magnitude,
        name: effect.statusId,
        rangeBp: 0,
        rateBp: 0,
        sourceId: effect.sourceRuntimeId,
        sourceType: effect.sourceTypeId,
      };
    });
    return Effects.resolveExternalAmplification(inputs).damageBp;
  }

  function nativeResistanceBp(content, enemy, effects, damageTypeId) {
    const overrides = effectsForTarget(effects, enemy.id).filter(function (effect) {
      return effect.kind === "resistance-override" && effect.damageTypeId === damageTypeId;
    }).sort(function (left, right) {
      if (left.appliedTick !== right.appliedTick) return right.appliedTick - left.appliedTick;
      return left.id - right.id;
    });
    if (overrides.length > 0) return overrides[0].magnitude;
    const resistance = entityOwner(content, enemy).resistances.find(function (record) {
      return record.damageTypeId === damageTypeId;
    });
    return resistance ? resistance.reductionBp : 0;
  }

  function exposureCoefficient(effects, targetRuntimeId) {
    const exposures = effectsForTarget(effects, targetRuntimeId).filter(function (effect) {
      return effect.kind === "boss-exposure";
    }).sort(function (left, right) {
      if (left.appliedTick !== right.appliedTick) return right.appliedTick - left.appliedTick;
      return left.id - right.id;
    });
    return exposures.length === 0 ? ABI.BASIS_POINTS : exposures[0].coefficientBp;
  }

  function strongestArmorBreakMilli(effects, targetRuntimeId) {
    const instances = effectsForTarget(effects, targetRuntimeId, "armor-break").map(function (effect) {
      return {
        appliedTick: effect.appliedTick,
        expiryTimeUnits: effect.timer === null ? Number.MAX_SAFE_INTEGER : effect.timer.remainingUnits,
        magnitude: effect.magnitude,
        sourceId: effect.sourceRuntimeId,
        statusId: effect.statusId,
      };
    });
    const strongest = Effects.selectStrongestStatus(instances);
    return strongest === null ? 0 : strongest.magnitude;
  }

  function consumeEnemyShields(enemy, shieldDamageMilli) {
    const input = enemy.shields.map(function (shield) {
      return {
        expiryTimeUnits: shield.timer === null ? Number.MAX_SAFE_INTEGER : shield.timer.remainingUnits,
        remainingMilli: shield.remainingMilli,
        sourceId: shield.sourceId,
      };
    });
    const consumed = Effects.consumeShieldPools(input, shieldDamageMilli);
    const remainingBySource = Object.create(null);
    consumed.pools.forEach(function (pool) { remainingBySource[pool.sourceId] = pool.remainingMilli; });
    const shields = enemy.shields.filter(function (shield) {
      return own(remainingBySource, shield.sourceId);
    }).map(function (shield) {
      return Object.freeze({
        poolId: shield.poolId,
        remainingMilli: remainingBySource[shield.sourceId],
        sourceId: shield.sourceId,
        timer: shield.timer,
      });
    });
    return Object.freeze({
      absorbedMilli: consumed.absorbedMilli,
      overflowMilli: consumed.overflowMilli,
      shields: Object.freeze(shields),
    });
  }

  function resolvedDamage(content, enemy, effects, intent, externalDamageBpOverride) {
    const internal = [intent.internalDamageCoefficientBp];
    if (enemy.kind === "boss") {
      internal.push(intent.bossCoefficientBp);
      internal.push(exposureCoefficient(effects, enemy.id));
    }
    const externalDamageBp = externalDamageBpOverride === undefined
      ? externalDamageBonus(effects, enemy.id)
      : nonnegativeInteger(externalDamageBpOverride, "Damage external amplification override");
    const preShield = ABI.preShieldDamageMilli(
      intent.baseDamageMilli,
      internal,
      externalDamageBp
    );
    const shieldDamage = ABI.shieldBoundDamageMilli(preShield, intent.shieldCoefficientBp);
    const shields = consumeEnemyShields(enemy, shieldDamage);
    const hp = ABI.resolveHpDamageMilli(
      shields.overflowMilli,
      enemy.armorMilli,
      strongestArmorBreakMilli(effects, enemy.id),
      intent.armorIgnoreBp,
      nativeResistanceBp(content, enemy, effects, intent.damageTypeId)
    );
    return Object.freeze({
      appliedShieldDamageMilli: shields.absorbedMilli,
      attemptedShieldDamageMilli: shieldDamage,
      hpDamageMilli: hp.hpDamageMilli,
      preShieldDamageMilli: preShield,
      shields: shields.shields,
    });
  }

  function revealTelemetrySources(content, enemy, effects, intent) {
    if (intent.eligibilityMode === null) return Object.freeze([]);
    const reveals = effectsForTarget(effects, enemy.id, "reveal");
    if (reveals.length === 0) return Object.freeze([]);
    const traitIndex = enemy.traitStates.findIndex(function (trait) { return trait.kind === "cloak"; });
    if (traitIndex < 0) return Object.freeze([]);
    const owner = entityOwner(content, enemy);
    const eligibility = Behaviors.dispatchBehavior(
      Behaviors.DISPATCH_IDS.CLOAK,
      behaviorRequest(content, { parameters: owner.traits[traitIndex] }, enemy.traitStates[traitIndex].state, {
        actionId: "eligibility",
        revealActive: false,
      })
    ).eligibility;
    const eligibleWithoutReveal = intent.eligibilityMode === "collateral"
      ? eligibility.collateralEligible
      : eligibility.directEligible;
    if (eligibleWithoutReveal) return Object.freeze([]);
    return sortedUniqueRuntimeIds(reveals.map(function (effect) { return effect.sourceRuntimeId; }));
  }

  function resolvedHpAfterDamage(content, enemy, damageMilli) {
    if (enemy.kind !== "boss") {
      return Math.max(0, ABI.checkedAdd(enemy.hpMilli, -Math.min(enemy.hpMilli, damageMilli)));
    }
    const result = Behaviors.dispatchBehavior(
      Behaviors.DISPATCH_IDS.TALOS,
      {
        eventCatalog: content.eventCatalog,
        input: {
          actionId: "resolved-hit",
          bossRuntimeId: enemy.id,
          damageMilli: damageMilli,
          lineageId: enemy.lineageId,
          routeDistance: enemy.distance,
          routeId: enemy.routeId,
        },
        limits: BEHAVIOR_LIMITS,
        parameters: content.bosses[enemy.ownerId],
        state: enemy.bossState,
      }
    );
    return result.state.currentHpMilli;
  }

  function applyCloakDamage(content, enemy, effects, sourceRuntimeId, hpDamageMilli, events) {
    if (hpDamageMilli === 0) return enemy;
    const traitIndex = enemy.traitStates.findIndex(function (trait) { return trait.kind === "cloak"; });
    if (traitIndex < 0) return enemy;
    const owner = entityOwner(content, enemy);
    const result = Behaviors.dispatchBehavior(
      Behaviors.DISPATCH_IDS.CLOAK,
      behaviorRequest(content, { parameters: owner.traits[traitIndex] }, enemy.traitStates[traitIndex].state, {
        actionId: "accepted-damage",
        enemyRuntimeId: enemy.id,
        hpDamageMilli: hpDamageMilli,
        revealActive: hasStatus(effects, enemy.id, "reveal"),
        sourceRuntimeId: sourceRuntimeId,
      })
    );
    appendEvents(events, result.events);
    return replaceEnemyTraitState(enemy, traitIndex, result.state);
  }

  function runDamage(content, enemiesInput, effects, intents, pendingBossReleasesInput,
    towers, currentTick, events, telemetry) {
    const enemies = enemiesInput.slice();
    const byId = Object.create(null);
    enemies.forEach(function (enemy, index) { byId[enemy.id] = index; });
    const pendingBossReleases = pendingBossReleasesInput.slice();
    intents.forEach(function (intent) {
      const enemyIndex = byId[intent.targetRuntimeId];
      if (enemyIndex === undefined) return;
      let enemy = enemies[enemyIndex];
      if (enemy.hpMilli === 0) return;
      const sourceTower = requiredTowerTelemetryIdentity(content, towers, intent.towerRuntimeId);
      const targetShieldBeforeMilli = totalShieldMilli(enemy);
      const damage = resolvedDamage(content, enemy, effects, intent);
      const noExternal = resolvedDamage(content, enemy, effects, intent, 0);
      const noExternalNextHp = resolvedHpAfterDamage(content, enemy, noExternal.hpDamageMilli);
      let nextHp;
      let bossState = enemy.bossState;
      if (enemy.kind === "boss") {
        const result = Behaviors.dispatchBehavior(
          Behaviors.DISPATCH_IDS.TALOS,
          {
            eventCatalog: content.eventCatalog,
            input: {
              actionId: "resolved-hit",
              bossRuntimeId: enemy.id,
              damageMilli: damage.hpDamageMilli,
              lineageId: enemy.lineageId,
              routeDistance: enemy.distance,
              routeId: enemy.routeId,
            },
            limits: BEHAVIOR_LIMITS,
            parameters: content.bosses[enemy.ownerId],
            state: enemy.bossState,
          }
        );
        appendEvents(events, result.events);
        bossState = result.state;
        nextHp = result.state.currentHpMilli;
        result.scheduledReleasePlans.forEach(function (releasePlan) {
          pendingBossReleases.push(Object.freeze({
            dueTick: ABI.checkedAdd(currentTick, releasePlan.releaseAfterTicks),
            lineageTags: Object.freeze(enemy.lineageTags.slice()),
            releasePlan: releasePlan,
            waveId: enemy.waveId,
          }));
        });
      } else {
        nextHp = Math.max(0, ABI.checkedAdd(enemy.hpMilli, -Math.min(enemy.hpMilli, damage.hpDamageMilli)));
      }
      const output = cloneCanonical(enemy);
      output.bossState = bossState;
      output.hpMilli = nextHp;
      output.shields = damage.shields;
      enemy = Object.freeze(output);
      const appliedHpDamageMilli = ABI.checkedAdd(enemies[enemyIndex].hpMilli, -enemy.hpMilli);
      const unappliedHpDamageMilli = ABI.checkedAdd(
        damage.hpDamageMilli,
        -Math.min(damage.hpDamageMilli, appliedHpDamageMilli)
      );
      const supportSourceTowerRuntimeIds = sortedUniqueRuntimeIds(
        externalDamageEffects(effects, enemy.id).map(function (effect) {
          return effect.sourceRuntimeId;
        })
      );
      telemetry.push("damage", {
        sourceTowerRuntimeId: sourceTower.sourceTowerRuntimeId,
        sourceRuntimeId: intent.sourceRuntimeId,
        defenseId: sourceTower.defenseId,
        level: sourceTower.level,
        padId: sourceTower.padId,
        targetRuntimeId: enemy.id,
        targetOwnerId: enemy.ownerId,
        targetLineageId: enemy.lineageId,
        targetRouteId: enemy.routeId,
        damageTypeId: intent.damageTypeId,
        baseDamageMilli: intent.baseDamageMilli,
        preShieldDamageMilli: damage.preShieldDamageMilli,
        attemptedShieldDamageMilli: damage.attemptedShieldDamageMilli,
        appliedShieldDamageMilli: damage.appliedShieldDamageMilli,
        eligibleHpDamageMilli: damage.hpDamageMilli,
        appliedHpDamageMilli: appliedHpDamageMilli,
        deferredHpDamageMilli: enemy.kind === "boss" && enemy.hpMilli > 0
          ? unappliedHpDamageMilli : 0,
        overkillHpDamageMilli: enemy.hpMilli === 0 ? unappliedHpDamageMilli : 0,
        noExternalAppliedShieldDamageMilli: noExternal.appliedShieldDamageMilli,
        noExternalAppliedHpDamageMilli: ABI.checkedAdd(
          enemies[enemyIndex].hpMilli,
          -noExternalNextHp
        ),
        targetShieldBeforeMilli: targetShieldBeforeMilli,
        targetShieldAfterMilli: totalShieldMilli(enemy),
        targetHpBeforeMilli: enemies[enemyIndex].hpMilli,
        targetHpAfterMilli: enemy.hpMilli,
        supportSourceTowerRuntimeIds: supportSourceTowerRuntimeIds,
        revealSourceTowerRuntimeIds: revealTelemetrySources(
          content,
          enemies[enemyIndex],
          effects,
          intent
        ),
      });
      enemy = applyCloakDamage(content, enemy, effects, intent.towerRuntimeId, damage.hpDamageMilli, events);
      enemies[enemyIndex] = enemy;
    });
    pendingBossReleases.sort(compareBossReleases);
    return Object.freeze({
      enemies: Object.freeze(enemies),
      pendingBossReleases: Object.freeze(pendingBossReleases),
    });
  }

  function resetWaveBehaviorStates(content, towerRuntimes) {
    return Object.freeze(towerRuntimes.map(function (runtime) {
      const level = content.defenses[runtime.defenseId].levels[runtime.level - 1];
      const behaviorStates = runtime.behaviorStates.map(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.SLOW &&
            behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.MARK) return behaviorState;
        const behavior = level.behaviors[behaviorState.index];
        const result = Behaviors.dispatchBehavior(
          behaviorState.dispatchId,
          behaviorRequest(content, behavior, behaviorState.state, { actionId: "wave-start" })
        );
        if (result.events.length !== 0) {
          throw new RangeError("Wave-start behavior reset cannot emit semantic events");
        }
        return freezeBehaviorStateRecord(behaviorState, result.state, behaviorState.timer);
      });
      return Object.freeze({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: runtime.createdTick,
        defenseId: runtime.defenseId,
        level: runtime.level,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    }));
  }

  function runRetiredRevealCleanup(content, priorRuntimes, priorTowers, towers, enemies,
    effectsInput, events, telemetry) {
    const activeTowerIds = new Set(towers.map(function (tower) { return tower.id; }));
    let effects = effectsInput;
    priorRuntimes.filter(function (runtime) {
      return !activeTowerIds.has(runtime.towerRuntimeId);
    }).forEach(function (runtime) {
      const level = content.defenses[runtime.defenseId].levels[runtime.level - 1];
      runtime.behaviorStates.forEach(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.REVEAL) return;
        const result = Behaviors.dispatchBehavior(
          behaviorState.dispatchId,
          behaviorRequest(content, level.behaviors[behaviorState.index], behaviorState.state, {
            actionId: "status-expiry",
            eligibleEnemyRuntimeIds: [],
            sourceActive: false,
            towerRuntimeId: runtime.towerRuntimeId,
          })
        );
        appendEvents(events, result.events);
        const removed = effects.filter(function (effect) {
          return effect.sourceRuntimeId === runtime.towerRuntimeId && effect.statusId === "reveal";
        });
        effects = removeEffects(effects, function (effect) {
          return effect.sourceRuntimeId === runtime.towerRuntimeId && effect.statusId === "reveal";
        });
        removed.forEach(function (effect) {
          pushRemovedEffectTelemetry(
            telemetry,
            "remove",
            "removed",
            effect,
            requiredTowerTelemetryIdentity(content, priorTowers, runtime.towerRuntimeId),
            requiredTelemetryTarget(enemies, effect.targetRuntimeId)
          );
        });
      });
    });
    return effects;
  }

  function planRevealSync(content, missionRuntime, enemies, effects,
    towerRuntimesInput, towers, events) {
    const statusIntents = [];
    const towerRuntimes = towerRuntimesInput.map(function (runtime) {
      const tower = towerByRuntimeId(towers, runtime.towerRuntimeId);
      if (!tower) throw new RangeError("Reveal sync runtime has no owned tower");
      const defense = content.defenses[runtime.defenseId];
      const level = defense.levels[runtime.level - 1];
      let nextRuntime = runtime;
      runtime.behaviorStates.forEach(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.REVEAL) return;
        const eligible = eligibleTargets(
          content,
          missionRuntime,
          tower,
          defense,
          level,
          enemies,
          effects,
          "continuous"
        ).map(function (candidate) { return candidate.id; });
        const result = Behaviors.dispatchBehavior(
          behaviorState.dispatchId,
          behaviorRequest(content, level.behaviors[behaviorState.index], behaviorState.state, {
            actionId: "shield-damage-and-status",
            eligibleEnemyRuntimeIds: eligible,
            sourceActive: true,
            towerRuntimeId: runtime.towerRuntimeId,
          })
        );
        appendEvents(events, result.events);
        result.statusIntents.forEach(function (intent) {
          if (intent.kind !== "apply") {
            throw new RangeError("Reveal apply phase returned a non-apply intent");
          }
          statusIntents.push({
            behaviorIndex: behaviorState.index,
            durationTimeUnits: null,
            kind: "status",
            magnitudeBp: 0,
            sourceRuntimeId: runtime.towerRuntimeId,
            sourceTypeId: null,
            statusId: intent.statusId,
            targetOrder: statusIntents.length,
            targetRuntimeId: intent.enemyRuntimeId,
          });
        });
        nextRuntime = replaceTowerBehaviorState(nextRuntime, behaviorState.index, result.state);
      });
      return nextRuntime;
    });
    return Object.freeze({
      statusIntents: Object.freeze(statusIntents),
      towerRuntimes: Object.freeze(towerRuntimes),
    });
  }

  function compareStatusIntents(left, right) {
    if (left.sourceRuntimeId !== right.sourceRuntimeId) {
      return left.sourceRuntimeId - right.sourceRuntimeId;
    }
    if (left.behaviorIndex !== right.behaviorIndex) {
      return left.behaviorIndex - right.behaviorIndex;
    }
    if (left.targetOrder !== right.targetOrder) return left.targetOrder - right.targetOrder;
    return left.targetRuntimeId - right.targetRuntimeId;
  }

  function applyTowerStatusIntents(content, towers, enemies, effectsInput, statusIntentsInput,
    management, config, currentTick, telemetry) {
    let effects = effectsInput;
    let nextManagement = management;
    const statusIntents = statusIntentsInput.slice().sort(compareStatusIntents);
    statusIntents.forEach(function (intent) {
      const target = enemies.find(function (enemy) {
        return enemy.id === intent.targetRuntimeId;
      });
      if (!target) {
        throw new RangeError("Tower status intent target is not available for telemetry");
      }
      const sourceTower = requiredTowerTelemetryIdentity(content, towers, intent.sourceRuntimeId);
      const requestedDuration = intent.durationTimeUnits === null ? 0 : intent.durationTimeUnits;
      if (target.hpMilli === 0) {
        pushEffectTelemetry(
          telemetry,
          "apply",
          "rejected",
          {
            kind: intent.kind,
            magnitude: intent.magnitudeBp,
            sourceRuntimeId: intent.sourceRuntimeId,
            statusId: intent.statusId,
          },
          sourceTower,
          target,
          intent.magnitudeBp,
          0,
          requestedDuration,
          0
        );
        return;
      }
      const applied = applyEffect(effects, nextManagement, config, {
        durationTimeUnits: intent.durationTimeUnits,
        kind: intent.kind,
        magnitude: intent.magnitudeBp,
        sourceRuntimeId: intent.sourceRuntimeId,
        sourceTypeId: intent.sourceTypeId,
        statusId: intent.statusId,
        targetRuntimeId: intent.targetRuntimeId,
      }, currentTick);
      effects = applied.effects;
      nextManagement = applied.management;
      pushAppliedEffectTelemetry(telemetry, applied, sourceTower, target);
    });
    return Object.freeze({ effects: effects, management: nextManagement });
  }

  function purgeRevealTargets(towerRuntimes, removedEnemyIdsInput) {
    const removedEnemyIds = new Set(removedEnemyIdsInput);
    if (removedEnemyIds.size === 0) return towerRuntimes;
    return Object.freeze(towerRuntimes.map(function (runtime) {
      let changed = false;
      const behaviorStates = runtime.behaviorStates.map(function (behaviorState) {
        if (behaviorState.dispatchId !== Behaviors.DISPATCH_IDS.REVEAL) return behaviorState;
        const retained = behaviorState.state.revealedEnemyRuntimeIds.filter(function (runtimeId) {
          return !removedEnemyIds.has(runtimeId);
        });
        if (retained.length === behaviorState.state.revealedEnemyRuntimeIds.length) {
          return behaviorState;
        }
        changed = true;
        return freezeBehaviorStateRecord(
          behaviorState,
          Object.freeze({ revealedEnemyRuntimeIds: Object.freeze(retained) }),
          behaviorState.timer
        );
      });
      if (!changed) return runtime;
      return Object.freeze({
        behaviorStates: Object.freeze(behaviorStates),
        createdTick: runtime.createdTick,
        defenseId: runtime.defenseId,
        level: runtime.level,
        towerRuntimeId: runtime.towerRuntimeId,
      });
    }));
  }

  function incrementLeakFacts(objectiveFacts, enemy) {
    const routeLeakCounts = objectiveFacts.routeLeakCounts.map(function (record) {
      return record.routeId === enemy.routeId
        ? Object.freeze({ leakCount: ABI.checkedAdd(record.leakCount, 1), routeId: record.routeId })
        : record;
    });
    const tags = new Set(enemy.lineageTags);
    const lineageTagLeakCounts = objectiveFacts.lineageTagLeakCounts.map(function (record) {
      return tags.has(record.lineageTag)
        ? Object.freeze({
            leakCount: ABI.checkedAdd(record.leakCount, 1),
            lineageTag: record.lineageTag,
          })
        : record;
    });
    return Object.freeze({
      integrity: objectiveFacts.integrity,
      lineageTagLeakCounts: Object.freeze(lineageTagLeakCounts),
      outcome: objectiveFacts.outcome,
      ownedTowerCount: objectiveFacts.ownedTowerCount,
      routeLeakCounts: Object.freeze(routeLeakCounts),
    });
  }

  function runLeaks(content, towers, enemiesInput, effectsInput, integrityInput,
    objectiveFactsInput, telemetry) {
    const reached = enemiesInput.filter(function (enemy) {
      return enemy.hpMilli > 0 && enemy.position.remainingDistance === 0;
    }).sort(function (left, right) { return left.id - right.id; });
    const leakedIds = new Set();
    let integrity = integrityInput;
    let objectiveFacts = objectiveFactsInput;
    let defeat = false;
    reached.some(function (enemy) {
      leakedIds.add(enemy.id);
      const integrityBefore = integrity;
      integrity = Math.max(0, ABI.checkedAdd(integrity, -Math.min(integrity, enemy.leakIntegrity)));
      telemetry.push("leak", {
        enemyRuntimeId: enemy.id,
        ownerId: enemy.ownerId,
        lineageId: enemy.lineageId,
        routeId: enemy.routeId,
        hpMilli: enemy.hpMilli,
        shieldMilli: totalShieldMilli(enemy),
        integrityDamage: ABI.checkedAdd(integrityBefore, -integrity),
      });
      objectiveFacts = incrementLeakFacts(objectiveFacts, enemy);
      if (integrity === 0) {
        defeat = true;
        return true;
      }
      return false;
    });
    const facts = cloneCanonical(objectiveFacts);
    facts.integrity = integrity;
    effectsInput.filter(function (effect) {
      return leakedIds.has(effect.targetRuntimeId);
    }).forEach(function (effect) {
      pushRemovedEffectTelemetry(
        telemetry,
        "remove",
        "removed",
        effect,
        effectSourceTowerIdentity(content, towers, effect),
        requiredTelemetryTarget(enemiesInput, effect.targetRuntimeId)
      );
    });
    return Object.freeze({
      defeat: defeat,
      effects: removeEffects(effectsInput, function (effect) {
        return leakedIds.has(effect.targetRuntimeId);
      }),
      enemies: Object.freeze(enemiesInput.filter(function (enemy) {
        return !leakedIds.has(enemy.id);
      })),
      integrity: integrity,
      objectiveFacts: deepFreeze(facts),
      removedEnemyIds: Object.freeze(Array.from(leakedIds).sort(function (a, b) { return a - b; })),
    });
  }

  function runTerminalDeaths(content, towers, enemiesInput, effectsInput, scoreFactsInput,
    telemetry) {
    const deaths = enemiesInput.filter(function (enemy) { return enemy.hpMilli === 0; })
      .sort(function (left, right) { return left.id - right.id; });
    let killScore = scoreFactsInput.killScore;
    deaths.forEach(function (enemy) {
      const owner = entityOwner(content, enemy);
      if (!owner.deathBehavior || owner.deathBehavior.kind !== "terminal") {
        throw new RangeError("Candidate slice kernel cannot resolve a nonterminal death behavior");
      }
      killScore = ABI.checkedAdd(killScore, enemy.scoreValue);
    });
    const deadIds = new Set(deaths.map(function (enemy) { return enemy.id; }));
    effectsInput.filter(function (effect) {
      return deadIds.has(effect.targetRuntimeId);
    }).forEach(function (effect) {
      pushRemovedEffectTelemetry(
        telemetry,
        "remove",
        "removed",
        effect,
        effectSourceTowerIdentity(content, towers, effect),
        requiredTelemetryTarget(enemiesInput, effect.targetRuntimeId)
      );
    });
    return Object.freeze({
      deaths: Object.freeze(deaths),
      effects: removeEffects(effectsInput, function (effect) {
        return deadIds.has(effect.targetRuntimeId);
      }),
      enemies: Object.freeze(enemiesInput.filter(function (enemy) { return !deadIds.has(enemy.id); })),
      scoreFacts: Object.freeze({ killScore: killScore, waveScore: scoreFactsInput.waveScore }),
    });
  }

  function runBounties(deaths, lineagesInput, management, config, difficulty, telemetry) {
    let nextManagement = management;
    let lineages = lineagesInput.slice();
    deaths.forEach(function (enemy) {
      const index = lineages.findIndex(function (lineage) {
        return lineage.lineageId === enemy.lineageId;
      });
      if (index < 0) throw new RangeError("Terminal entity has no canonical lineage ledger record");
      const lineage = lineages[index];
      if (lineage.bountyPolicy === "suppressed") return;
      if (lineage.bountyPolicy !== "base-lineage") {
        throw new RangeError("Unsupported Candidate bounty policy " + lineage.bountyPolicy);
      }
      if (lineage.claimed) return;
      const result = creditBounty(
        nextManagement,
        config,
        lineage.baseLineageBountyAether,
        difficulty.bountyBp
      );
      emitInternalAetherTelemetry(
        telemetry,
        "bounty",
        lineage.lineageId,
        nextManagement,
        result.management
      );
      nextManagement = result.management;
      lineages[index] = Object.freeze({
        baseLineageBountyAether: lineage.baseLineageBountyAether,
        bountyPolicy: lineage.bountyPolicy,
        claimed: true,
        lineageId: lineage.lineageId,
      });
    });
    return Object.freeze({
      lineages: Object.freeze(lineages),
      management: nextManagement,
    });
  }

  function terminalObjectiveAndScore(content, missionRuntime, difficulty, state, outcome,
    integrity, objectiveFactsInput, management, scoreFacts) {
    const objectiveFacts = cloneCanonical(objectiveFactsInput);
    objectiveFacts.integrity = integrity;
    objectiveFacts.outcome = outcome;
    objectiveFacts.ownedTowerCount = outcome === "victory" ? management.towers.length : 0;
    const frozenFacts = deepFreeze(objectiveFacts);
    const objectiveBinding = missionRuntime.objectiveBindings[state.difficultyId];
    const objectiveEvaluation = Objectives.evaluateObjectives(
      objectiveBinding,
      objectiveProjection(objectiveBinding, frozenFacts)
    );
    const scoreRecord = missionRuntime.mission.scoreRecord;
    if (scoreRecord.scoreRuleId !== content.campaignRules.scoreRules.id ||
        scoreRecord.scoreRuleId !== "campaign-score-v1") {
      throw new RangeError("Unsupported Candidate score rule");
    }
    let rawBase = ABI.checkedAdd(scoreFacts.killScore, scoreFacts.waveScore);
    if (outcome === "victory") {
      rawBase = ABI.checkedAdd(rawBase, scoreRecord.victoryScore);
      rawBase = ABI.checkedAdd(rawBase, ABI.checkedMultiply(integrity, scoreRecord.integrityPointScore));
      const mastery = objectiveEvaluation.objectiveResults.find(function (result) {
        return result.id === "mastery";
      });
      if (mastery && mastery.complete) {
        rawBase = ABI.checkedAdd(rawBase, scoreRecord.masteryObjectiveScore);
      }
    }
    let nonAetherScore = ABI.checkedMulDivFloor(
      rawBase,
      [difficulty.scoreBp],
      [ABI.BASIS_POINTS]
    );
    if (rawBase > 0 && nonAetherScore === 0) {
      nonAetherScore = content.campaignRules.scoreRules.minimumNonzeroScore;
    }
    let excludedStartAether = modifierAether(
      content.campaignRules,
      state.campaignModifierIds
    );
    if (state.assist) {
      excludedStartAether = ABI.checkedAdd(
        excludedStartAether,
        content.campaignRules.assistRecord.startAetherAdd
      );
    }
    const eligibleUnspentAether = Math.max(0, ABI.checkedAdd(
      management.aether,
      -Math.min(management.aether, excludedStartAether)
    ));
    const rawUnspentScore = ABI.checkedMultiply(
      eligibleUnspentAether,
      scoreRecord.rawUnspentScorePerEligibleAether
    );
    const unspentCap = Math.floor(
      nonAetherScore / content.campaignRules.scoreRules.unspentCapDivisor
    );
    const unspentScore = Math.min(rawUnspentScore, unspentCap);
    return Object.freeze({
      objectiveFacts: frozenFacts,
      objectiveResults: objectiveEvaluation.objectiveResults,
      score: ABI.checkedAdd(nonAetherScore, unspentScore),
    });
  }

  function orderedSemanticEvents(content, events) {
    if (events.length > MAX_SEMANTIC_EVENTS_PER_TICK) {
      throw new RangeError("Semantic events exceed the kernel per-tick ceiling");
    }
    const phaseOrder = ABI.DESCRIPTOR.phaseOrder;
    const ordered = events.map(function (event, index) {
      return { event: event, index: index, phase: phaseOrder.indexOf(event.phaseId) };
    });
    ordered.forEach(function (record) {
      if (record.phase < 0) throw new RangeError("Semantic event has an unknown ABI phase");
    });
    ordered.sort(function (left, right) {
      if (left.phase !== right.phase) return left.phase - right.phase;
      return left.index - right.index;
    });
    return Behaviors.validateSemanticEvents(
      content.eventCatalog,
      ordered.map(function (record) { return record.event; }),
      BEHAVIOR_LIMITS
    );
  }

  function registerState(binding, state) {
    ABI.canonicalEncode(state);
    deepFreeze(state);
    stateRecords.set(state, binding);
    return state;
  }

  function createInitialState(binding, headerInput) {
    const record = requireBinding(binding);
    const header = normalizeHeader(binding, record, headerInput);
    const missionRuntime = record.missions[header.missionId];
    validateLoadout(record.content, missionRuntime.mission, header);
    const difficulty = difficultyById(record.content.campaignRules, header.difficultyId);
    const start = Economy.resolveStartAether(
      missionRuntime.mission.baseStartAether,
      difficulty.startAetherBp,
      modifierAether(record.content.campaignRules, header.campaignModifierIds),
      header.assist ? record.content.campaignRules.assistRecord.startAetherAdd : 0
    );
    const config = managementConfig(record.content, missionRuntime, header, start.startAether);
    const management = Management.createManagementState(config);
    const objectiveBinding = missionRuntime.objectiveBindings[header.difficultyId];
    const objectiveFacts = initialObjectiveFacts(record.content, missionRuntime, difficulty);
    const objectiveEvaluation = Objectives.evaluateObjectives(
      objectiveBinding,
      objectiveProjection(objectiveBinding, objectiveFacts)
    );
    const state = {
      schemaVersion: KERNEL_SCHEMA_VERSION,
      rulesetHash: binding.rulesetHash,
      contentVersion: binding.contentVersion,
      tick: 0,
      missionId: header.missionId,
      difficultyId: header.difficultyId,
      assist: header.assist,
      seed: header.seed,
      loadoutIds: header.loadoutIds.slice(),
      loadoutSlotCap: header.loadoutSlotCap,
      campaignModifierIds: header.campaignModifierIds.slice(),
      accessGrantIds: header.accessGrantIds.slice(),
      tutorialUpgradeGateMode: header.tutorialUpgradeGateMode,
      management: management,
      routes: initialRoutes(missionRuntime),
      enemies: [],
      timers: [],
      effects: [],
      lineages: [],
      pendingSpawns: [],
      pendingBossReleases: [],
      rngStreams: [],
      objectiveFacts: objectiveFacts,
      objectiveResults: objectiveEvaluation.objectiveResults,
      integrity: difficulty.integrity,
      score: 0,
      scoreFacts: { killScore: 0, waveScore: 0 },
      outcome: "active",
      waveStartTick: null,
    };
    return registerState(binding, state);
  }

  function requireState(binding, state) {
    if (!state || stateRecords.get(state) !== binding || !Object.isFrozen(state)) {
      throw new TypeError("Kernel state must come from this binding's createInitialState/advanceTick seam");
    }
    return state;
  }

  function stateHeader(state) {
    return {
      accessGrantIds: state.accessGrantIds,
      assist: state.assist,
      campaignModifierIds: state.campaignModifierIds,
      difficultyId: state.difficultyId,
      eventSchemaVersion: ABI.EVENT_SCHEMA_VERSION,
      formatVersion: 1,
      loadoutIds: state.loadoutIds,
      loadoutSlotCap: state.loadoutSlotCap,
      missionId: state.missionId,
      rulesetHash: state.rulesetHash,
      seed: state.seed,
      tutorialUpgradeGateMode: state.tutorialUpgradeGateMode,
    };
  }

  function cloneStateWith(state, changes) {
    const output = cloneCanonical(state);
    Object.keys(changes).forEach(function (key) { output[key] = changes[key]; });
    return output;
  }

  function advanceTick(binding, stateInput, commandBucket) {
    const record = requireBinding(binding);
    const state = requireState(binding, stateInput);
    if (state.outcome !== "active") throw new RangeError("Terminal kernel state cannot advance");
    if (!Array.isArray(commandBucket)) throw new TypeError("Kernel command bucket must be an array");
    const telemetry = createTelemetryCollector(state.tick);
    ABI.canonicalEncode(commandBucket);
    const commands = Commands.normalizeCommandSequence(commandBucket);
    commands.forEach(function (command) {
      if (command.tick !== state.tick) {
        throw new RangeError("Every command in a kernel bucket must match the current tick");
      }
    });
    const missionRuntime = record.missions[state.missionId];
    const difficulty = difficultyById(record.content.campaignRules, state.difficultyId);
    const start = Economy.resolveStartAether(
      missionRuntime.mission.baseStartAether,
      difficulty.startAetherBp,
      modifierAether(record.content.campaignRules, state.campaignModifierIds),
      state.assist ? record.content.campaignRules.assistRecord.startAetherAdd : 0
    );
    const config = managementConfig(record.content, missionRuntime, stateHeader(state), start.startAether);
    const managementResult = Management.applyCommandBucket(
      state.management,
      config,
      state.tick,
      commands
    );
    emitManagementAetherTelemetry(telemetry, state.management, managementResult, missionRuntime);
    let management = managementResult.state;
    let towerRuntimes = syncTowerRuntimes(
      record.content,
      missionRuntime,
      state.timers,
      management.towers,
      state.tick
    );
    const acceptedWaveStarts = managementResult.events.filter(function (event) {
      return event.type === "waveStart";
    });
    if (acceptedWaveStarts.length > 1) {
      throw new RangeError("A command bucket cannot accept more than one wave start");
    }
    const acceptedWaveStart = acceptedWaveStarts.length === 1 ? acceptedWaveStarts[0] : null;

    /* ADR-008: planning is a suspended clock. Management changes are authoritative,
       but combat phases and tick advancement begin only with an accepted Start. */
    if (state.management.phase === "planning" && acceptedWaveStart === null) {
      if (state.enemies.length !== 0 || state.pendingSpawns.length !== 0 ||
          state.pendingBossReleases.length !== 0) {
        throw new RangeError("Planning state cannot retain hostile wave blockers");
      }
      const planningState = cloneStateWith(state, {
        management: management,
        timers: towerRuntimes,
      });
      return Object.freeze({
        events: Object.freeze([]),
        state: registerState(binding, planningState),
        telemetry: telemetry.finish(),
      });
    }

    const events = [];
    let pendingSpawns = state.pendingSpawns;
    let pendingBossReleases = state.pendingBossReleases;
    let enemies = state.enemies;
    let effects = state.effects;
    let lineages = state.lineages;
    let objectiveFacts = state.objectiveFacts;
    let objectiveResults = state.objectiveResults;
    let integrity = state.integrity;
    let scoreFacts = state.scoreFacts;
    let score = state.score;
    let outcome = state.outcome;
    let waveStartTick = state.waveStartTick;

    if (acceptedWaveStart !== null) {
      if (state.pendingSpawns.length !== 0 || state.pendingBossReleases.length !== 0 ||
          state.enemies.length !== 0) {
        throw new RangeError("Accepted wave start requires an exhausted prior wave");
      }
      const wave = missionRuntime.mission.waves[acceptedWaveStart.wave - 1];
      if (!wave || wave.index !== acceptedWaveStart.wave) {
        throw new RangeError("Accepted Management wave does not match compiled content");
      }
      pendingSpawns = scheduleWaveSpawns(wave, state.tick);
      towerRuntimes = resetWaveBehaviorStates(record.content, towerRuntimes);
      waveStartTick = state.tick;
      if (wave.deploymentGrantEventId !== null) {
        events.push(semanticEvent(record.content, wave.deploymentGrantEventId, {
          amountAether: acceptedWaveStart.grantAether,
          waveId: wave.id,
        }));
      }
    }

    /* scheduled-spawns */
    const dueHostileCount = pendingSpawns.filter(function (job) {
      return job.dueTick === state.tick;
    }).length;
    if (ABI.checkedAdd(
      ABI.checkedAdd(enemies.length, dueHostileCount),
      activeSummonCount(towerRuntimes)
    ) > MAX_ACTIVE_ENTITIES) {
      throw new RangeError("Active hostile and summon entities exceed the kernel ceiling");
    }
    const spawned = spawnDueJobs(
      record.content,
      missionRuntime,
      difficulty,
      state.assist,
      pendingSpawns,
      enemies.slice(),
      lineages.slice(),
      management,
      config,
      state.tick,
      events,
      telemetry
    );
    pendingSpawns = spawned.pendingSpawns;
    enemies = spawned.enemies;
    lineages = spawned.lineages;
    management = spawned.management;
    const guards = runGuardScheduledSpawns(
      record.content,
      towerRuntimes,
      management.towers,
      management,
      config,
      state.tick,
      enemies.length,
      events,
      telemetry
    );
    towerRuntimes = guards.towerRuntimes;
    management = guards.management;

    /* status-expiry */
    const expired = runStatusExpiry(
      record.content,
      missionRuntime,
      enemies,
      effects,
      towerRuntimes,
      management.towers,
      mergeTelemetryTowers(state.management.towers, management.towers),
      state.tick,
      events,
      telemetry
    );
    enemies = expired.enemies;
    effects = runRetiredRevealCleanup(
      record.content,
      state.timers,
      state.management.towers,
      management.towers,
      enemies,
      expired.effects,
      events,
      telemetry
    );
    towerRuntimes = expired.towerRuntimes;

    /* movement, including aggregate Guard arbitration */
    const moved = runMovementAndGuards(
      record.content,
      missionRuntime,
      enemies,
      effects,
      towerRuntimes,
      management,
      config,
      state.tick,
      events,
      telemetry
    );
    enemies = moved.enemies;
    effects = moved.effects;
    towerRuntimes = moved.towerRuntimes;
    management = moved.management;

    /* leaks are an immediate terminal boundary. */
    const leaked = runLeaks(
      record.content,
      management.towers,
      enemies,
      effects,
      integrity,
      objectiveFacts,
      telemetry
    );
    enemies = leaked.enemies;
    effects = leaked.effects;
    integrity = leaked.integrity;
    objectiveFacts = leaked.objectiveFacts;
    towerRuntimes = purgeRevealTargets(towerRuntimes, leaked.removedEnemyIds);
    if (leaked.defeat) {
      outcome = "defeat";
      const terminal = terminalObjectiveAndScore(
        record.content,
        missionRuntime,
        difficulty,
        state,
        outcome,
        integrity,
        objectiveFacts,
        management,
        scoreFacts
      );
      objectiveFacts = terminal.objectiveFacts;
      objectiveResults = terminal.objectiveResults;
      score = terminal.score;
      const defeatState = cloneStateWith(state, {
        effects: effects,
        enemies: enemies,
        integrity: integrity,
        lineages: lineages,
        management: management,
        objectiveFacts: objectiveFacts,
        objectiveResults: objectiveResults,
        outcome: outcome,
        pendingBossReleases: pendingBossReleases,
        pendingSpawns: pendingSpawns,
        score: score,
        scoreFacts: scoreFacts,
        tick: ABI.checkedAdd(state.tick, 1),
        timers: towerRuntimes,
        waveStartTick: waveStartTick,
      });
      return Object.freeze({
        events: orderedSemanticEvents(record.content, events),
        state: registerState(binding, defeatState),
        telemetry: telemetry.finish(),
      });
    }

    /* Continuous Reveal snapshots after movement but is not applied soon enough
       to alter this tick's already-frozen direct-acquisition eligibility. */
    const revealPlan = planRevealSync(
      record.content,
      missionRuntime,
      enemies,
      effects,
      towerRuntimes,
      management.towers,
      events,
      telemetry
    );
    towerRuntimes = revealPlan.towerRuntimes;

    /* tower-acquisition-and-attacks */
    const attacks = runTowerAttacks(
      record.content,
      missionRuntime,
      enemies,
      effects,
      towerRuntimes,
      management.towers,
      events,
      telemetry
    );
    towerRuntimes = attacks.towerRuntimes;
    const hitIntents = moved.guardDamageIntents.concat(attacks.hitIntents);
    hitIntents.sort(compareHitIntents);

    /* A matured Talos warning releases after this tick's expiry boundary, so its
       exposure/status timers begin now and can affect this phase's ordered hits. */
    const talosRelease = runTalosReleases(
      record.content,
      missionRuntime,
      pendingBossReleases,
      pendingSpawns,
      effects,
      enemies,
      management,
      config,
      state.tick,
      events,
      telemetry
    );
    pendingBossReleases = talosRelease.pendingBossReleases;
    pendingSpawns = talosRelease.pendingSpawns;
    effects = talosRelease.effects;
    management = talosRelease.management;
    if (pendingSpawns.some(function (job) { return job.dueTick <= state.tick; })) {
      throw new RangeError("Talos child release must schedule strictly after its release tick");
    }

    /* shield-damage-and-status, followed by guarded boss threshold scheduling. */
    const damaged = runDamage(
      record.content,
      enemies,
      effects,
      hitIntents,
      pendingBossReleases,
      management.towers,
      state.tick,
      events,
      telemetry
    );
    enemies = damaged.enemies;
    pendingBossReleases = damaged.pendingBossReleases;
    const statuses = applyTowerStatusIntents(
      record.content,
      management.towers,
      enemies,
      effects,
      revealPlan.statusIntents.concat(attacks.statusIntents),
      management,
      config,
      state.tick,
      telemetry
    );
    effects = statuses.effects;
    management = statuses.management;

    /* terminal death, then bounty. */
    const deaths = runTerminalDeaths(
      record.content,
      management.towers,
      enemies,
      effects,
      scoreFacts,
      telemetry
    );
    enemies = deaths.enemies;
    effects = deaths.effects;
    scoreFacts = deaths.scoreFacts;
    towerRuntimes = purgeRevealTargets(
      towerRuntimes,
      deaths.deaths.map(function (enemy) { return enemy.id; })
    );
    const bounties = runBounties(
      deaths.deaths,
      lineages,
      management,
      config,
      difficulty,
      telemetry
    );
    lineages = bounties.lineages;
    management = bounties.management;

    /* wave-clear */
    if (management.phase === "wave") {
      const activeWave = missionRuntime.mission.waves[management.activeWave - 1];
      if (!activeWave) throw new RangeError("Management active wave has no compiled wave record");
      const waveBlocked = enemies.some(function (enemy) { return enemy.waveId === activeWave.id; }) ||
        pendingSpawns.some(function (job) { return job.waveId === activeWave.id; }) ||
        pendingBossReleases.some(function (releasePlan) {
          return releasePlan.waveId === activeWave.id;
      });
      if (!waveBlocked) {
        const managementBeforeClearGrant = management;
        management = creditGrant(management, config, activeWave.clearGrantAether);
        emitInternalAetherTelemetry(
          telemetry,
          "wave-clear-grant",
          activeWave.id,
          managementBeforeClearGrant,
          management
        );
        if (activeWave.clearGrantEventId !== null) {
          events.push(semanticEvent(record.content, activeWave.clearGrantEventId, {
            amountAether: activeWave.clearGrantAether,
            waveId: activeWave.id,
          }));
        }
        scoreFacts = Object.freeze({
          killScore: scoreFacts.killScore,
          waveScore: ABI.checkedAdd(scoreFacts.waveScore, activeWave.waveClearScore),
        });
        management = Management.completeActiveWave(management, config, state.tick).state;
        waveStartTick = null;
        if (management.phase === "complete") {
          outcome = "victory";
          const terminal = terminalObjectiveAndScore(
            record.content,
            missionRuntime,
            difficulty,
            state,
            outcome,
            integrity,
            objectiveFacts,
            management,
            scoreFacts
          );
          objectiveFacts = terminal.objectiveFacts;
          objectiveResults = terminal.objectiveResults;
          score = terminal.score;
        }
      }
    }

    if (outcome === "active") {
      const objectiveBinding = missionRuntime.objectiveBindings[state.difficultyId];
      const evaluation = Objectives.evaluateObjectives(
        objectiveBinding,
        objectiveProjection(objectiveBinding, objectiveFacts)
      );
      objectiveResults = evaluation.objectiveResults;
    }
    const nextState = cloneStateWith(state, {
      effects: effects,
      enemies: enemies,
      integrity: integrity,
      lineages: lineages,
      management: management,
      objectiveFacts: objectiveFacts,
      objectiveResults: objectiveResults,
      outcome: outcome,
      pendingBossReleases: pendingBossReleases,
      pendingSpawns: pendingSpawns,
      score: score,
      scoreFacts: scoreFacts,
      tick: ABI.checkedAdd(state.tick, 1),
      timers: towerRuntimes,
      waveStartTick: waveStartTick,
    });
    return Object.freeze({
      events: orderedSemanticEvents(record.content, events),
      state: registerState(binding, nextState),
      telemetry: telemetry.finish(),
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    BALANCE_TELEMETRY_SCHEMA_VERSION: BALANCE_TELEMETRY_SCHEMA_VERSION,
    BEHAVIOR_REGISTRY_VERSION: ABI.BEHAVIOR_REGISTRY_VERSION,
    COMMAND_SCHEMA_VERSION: Commands.COMMAND_SCHEMA_VERSION,
    EVENT_SCHEMA_VERSION: ABI.EVENT_SCHEMA_VERSION,
    KERNEL_SCHEMA_VERSION: KERNEL_SCHEMA_VERSION,
    MAX_ACTIVE_ENTITIES: MAX_ACTIVE_ENTITIES,
    MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK: MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK,
    MAX_BALANCE_TELEMETRY_TARGET_IDS: MAX_BALANCE_TELEMETRY_TARGET_IDS,
    MAX_LOADOUT_IDS: MAX_LOADOUT_IDS,
    MAX_SEMANTIC_EVENTS_PER_TICK: MAX_SEMANTIC_EVENTS_PER_TICK,
    MAX_TARGET_CANDIDATES: MAX_TARGET_CANDIDATES,
    createRulesetBinding: createRulesetBinding,
    createInitialState: createInitialState,
    advanceTick: advanceTick,
  });
});
