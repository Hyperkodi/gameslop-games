/* Armara Aegis deterministic replay executor v1.
   Binds one immutable release/content pair to one immutable Kernel dependency. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./abi.js"),
      require("./commands.js"),
      require("./kernel.js")
    );
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before replay-runner.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before replay-runner.js");
  if (!game.AegisKernel) throw new Error("Game.AegisKernel must be installed before replay-runner.js");
  const api = factory(
    game.AegisSim,
    game.AegisCommands,
    game.AegisKernel
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisReplayRunner")) {
    if (game.AegisReplayRunner !== api) throw new Error("Game.AegisReplayRunner is already installed");
    return;
  }
  Object.defineProperty(game, "AegisReplayRunner", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (
  ABI,
  Commands,
  Kernel
) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  [
    "assertSafeInteger", "canonicalBytes", "canonicalEncode", "fnv1a32Hex",
    "refundSeventyPercent", "sha256Hex",
  ].forEach(
    function (name) {
      if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
    }
  );
  if (!Commands || !Object.isFrozen(Commands) || !Object.isFrozen(Commands.DEFAULT_LIMITS) ||
      typeof Commands.normalizeCommandSequence !== "function") {
    throw new TypeError("A frozen Aegis Commands API is required");
  }
  if (Commands.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new Error("Aegis Commands ABI descriptor identity does not match the simulation ABI");
  }
  if (Commands.COMMAND_SCHEMA_VERSION !== ABI.DESCRIPTOR.commands.schemaVersion) {
    throw new Error("Aegis Commands schema identity does not match the simulation ABI");
  }
  if (!Kernel || !Object.isFrozen(Kernel)) throw new TypeError("A frozen Aegis Kernel API is required");
  ["createRulesetBinding", "createInitialState", "advanceTick"].forEach(function (name) {
    if (typeof Kernel[name] !== "function") throw new TypeError("Aegis Kernel API is missing " + name);
  });
  if (Kernel.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new Error("Aegis Kernel ABI descriptor identity does not match the simulation ABI");
  }
  if (Kernel.EVENT_SCHEMA_VERSION !== ABI.EVENT_SCHEMA_VERSION) {
    throw new Error("Aegis Kernel event schema identity does not match the simulation ABI");
  }
  if (Kernel.COMMAND_SCHEMA_VERSION !== ABI.DESCRIPTOR.commands.schemaVersion) {
    throw new Error("Aegis Kernel command schema identity does not match the simulation ABI");
  }
  if (!Number.isSafeInteger(Kernel.MAX_LOADOUT_IDS) || Kernel.MAX_LOADOUT_IDS < 1) {
    throw new Error("Aegis Kernel loadout limit identity is invalid");
  }

  const RUNNER_SCHEMA_VERSION = 1;
  const BALANCE_TELEMETRY_SCHEMA_VERSION = 1;
  const MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK = 65536;
  const MAX_BALANCE_TELEMETRY_TARGET_IDS = 4096;
  if (Kernel.BALANCE_TELEMETRY_SCHEMA_VERSION !== BALANCE_TELEMETRY_SCHEMA_VERSION) {
    throw new Error("Aegis Kernel balance telemetry schema identity does not match replay v1");
  }
  if (Kernel.MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK !==
      MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK) {
    throw new Error("Aegis Kernel balance telemetry record limit does not match replay v1");
  }
  if (Kernel.MAX_BALANCE_TELEMETRY_TARGET_IDS !== MAX_BALANCE_TELEMETRY_TARGET_IDS) {
    throw new Error("Aegis Kernel balance telemetry target limit does not match replay v1");
  }
  const RULESET_HASH = /^sha256:[0-9a-f]{64}$/;
  const DIAGNOSTIC_HASH = /^fnv1a32:[0-9a-f]{8}$/;
  const FINAL_STATE_HASH = /^[0-9a-f]{64}$/;
  const STABLE_ID = /^[a-z][a-z0-9._:-]*$/;
  const BOUND_INPUT_FIELDS = Object.freeze(["content", "normalizeReplayEnvelope", "release"]);
  const ENVELOPE_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode", "inputs", "checkpoints", "finalClaim",
  ]);
  const CHECKPOINT_FIELDS = Object.freeze(["tick", "diagnosticHash"]);
  const FINAL_CLAIM_FIELDS = Object.freeze([
    "outcome", "score", "laurels", "durationTicks", "finalStateHash",
  ]);
  const HEADER_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode",
  ]);
  const TELEMETRY_FIELDS = Object.freeze(["schemaVersion", "tick", "records"]);
  const TELEMETRY_RECORD_FIELDS = Object.freeze({
    "activation": Object.freeze([
      "kind", "ordinal", "actionId", "behaviorId", "sourceTowerRuntimeId",
      "sourceRuntimeId", "defenseId", "level", "padId", "outcome",
      "eligibleTargetRuntimeIds", "selectedTargetRuntimeIds",
    ]),
    "aether-transaction": Object.freeze([
      "kind", "ordinal", "action", "sourceId", "commandSeq", "towerRuntimeId",
      "padId", "defenseId", "levelBefore", "levelAfter", "debitAether",
      "creditAether", "investedBeforeAether", "investedAfterAether",
      "bankBeforeAether", "bankAfterAether", "bountyRemainderBefore",
      "bountyRemainderAfter",
    ]),
    "damage": Object.freeze([
      "kind", "ordinal", "sourceTowerRuntimeId", "sourceRuntimeId", "defenseId",
      "level", "padId", "targetRuntimeId", "targetOwnerId", "targetLineageId",
      "targetRouteId", "damageTypeId", "baseDamageMilli", "preShieldDamageMilli",
      "attemptedShieldDamageMilli", "appliedShieldDamageMilli",
      "eligibleHpDamageMilli", "appliedHpDamageMilli", "deferredHpDamageMilli",
      "overkillHpDamageMilli", "noExternalAppliedShieldDamageMilli",
      "noExternalAppliedHpDamageMilli", "targetShieldBeforeMilli",
      "targetShieldAfterMilli", "targetHpBeforeMilli", "targetHpAfterMilli",
      "supportSourceTowerRuntimeIds", "revealSourceTowerRuntimeIds",
    ]),
    "effect": Object.freeze([
      "kind", "ordinal", "action", "sourceTowerRuntimeId", "sourceRuntimeId",
      "defenseId", "level", "padId", "targetRuntimeId", "targetOwnerId",
      "targetRouteId", "effectKind", "statusId", "requestedMagnitude",
      "appliedMagnitude", "requestedDurationTimeUnits", "appliedDurationTimeUnits",
      "outcome",
    ]),
    "leak": Object.freeze([
      "kind", "ordinal", "enemyRuntimeId", "ownerId", "lineageId", "routeId",
      "hpMilli", "shieldMilli", "integrityDamage",
    ]),
    "movement-control": Object.freeze([
      "kind", "ordinal", "enemyRuntimeId", "ownerId", "lineageId", "routeId",
      "priorRouteDistance", "nextRouteDistance", "actualAdvanceDistance",
      "effectiveSpeedBp", "scaledReductionBp", "sourceEffectRuntimeIds",
      "sourceRuntimeIds", "sourceTowerRuntimeIds",
    ]),
    "spawn": Object.freeze([
      "kind", "ordinal", "entityKind", "enemyRuntimeId", "ownerId", "lineageId",
      "routeId", "waveId", "maximumHpMilli", "initialShieldMilli",
      "baseSpeedDistanceUnitsPerSecond",
    ]),
  });
  const TELEMETRY_ENUMS = Object.freeze({
    activationActionId: Object.freeze([
      "direct-hit", "splash-blast", "mark-scan", "guard-contact", "guard-create",
    ]),
    activationOutcome: Object.freeze(["accepted", "no-target", "rejected"]),
    aetherAction: Object.freeze([
      "build", "upgrade", "sell", "wave-start-grant", "wave-clear-grant", "bounty",
    ]),
    effectAction: Object.freeze(["apply", "refresh", "remove", "expire"]),
    effectKind: Object.freeze([
      "status", "delayed-status", "external-amplification", "boss-exposure",
      "resistance-override",
    ]),
    effectOutcome: Object.freeze(["applied", "refreshed", "removed", "expired", "rejected"]),
    entityKind: Object.freeze(["enemy", "boss"]),
  });
  const EXECUTION_LIMITS = Object.freeze({
    maxAccessGrantIds: 64,
    maxCampaignModifierIds: 64,
    maxCheckpoints: 4096,
    maxCommandsPerTick: Commands.DEFAULT_LIMITS.maxCommandsPerTick,
    maxDurationTicks: Commands.DEFAULT_LIMITS.maxTick,
    maxLoadoutIds: Kernel.MAX_LOADOUT_IDS,
    maxStringLength: 256,
    maxTotalCommands: 4096,
  });

  function exactFields(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const actual = Object.getOwnPropertyNames(value);
    actual.forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only enumerable data properties");
      }
    });
    actual.sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
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

  function nonnegativeInteger(value, label, maximum) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    if (maximum !== undefined && value > maximum) {
      throw new RangeError(label + " exceeds the execution limit");
    }
    return Object.is(value, -0) ? 0 : value;
  }

  function boundedString(value, label, pattern) {
    if (typeof value !== "string") throw new TypeError(label + " must be a string");
    if (value.length > EXECUTION_LIMITS.maxStringLength) {
      throw new RangeError(label + " exceeds the string length limit");
    }
    if (pattern && !pattern.test(value)) throw new TypeError(label + " has invalid syntax");
    return value;
  }

  function arrayDataValues(value, label, maximum) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    if (value.length > maximum) throw new RangeError(label + " exceeds the execution limit");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== value.length + 1 || names.indexOf("length") === -1) {
      throw new TypeError(label + " must be a dense array without extra properties");
    }
    const result = new Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) {
        throw new TypeError(label + " must contain only dense enumerable data elements");
      }
      result[index] = descriptor.value;
    }
    return result;
  }

  function idArray(value, label, maximum, options) {
    const values = arrayDataValues(value, label, maximum);
    if (options && options.nonempty && values.length === 0) {
      throw new RangeError(label + " must not be empty");
    }
    const seen = new Set();
    let previous = null;
    values.forEach(function (entry) {
      boundedString(entry, label + " entry", STABLE_ID);
      if (seen.has(entry)) throw new RangeError(label + " must contain unique IDs");
      if (options && options.sorted && previous !== null && entry <= previous) {
        throw new RangeError(label + " must use strict ASCII order");
      }
      seen.add(entry);
      previous = entry;
    });
    return values;
  }

  function requireDeepFrozenCanonical(value, label) {
    ABI.canonicalEncode(value);
    function visit(current) {
      if (current === null || typeof current !== "object") return;
      if (!Object.isFrozen(current)) throw new TypeError(label + " must be deeply frozen");
      if (Array.isArray(current)) {
        current.forEach(visit);
        return;
      }
      Object.keys(current).forEach(function (key) { visit(current[key]); });
    }
    visit(value);
    return value;
  }

  function requireOwn(value, key, label) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new TypeError(label + " is missing " + key);
    }
    return dataValue(value, key, label);
  }

  function requireArtifactPair(releaseInput, contentInput) {
    const release = requireDeepFrozenCanonical(releaseInput, "Aegis release record");
    const content = requireDeepFrozenCanonical(contentInput, "Aegis content artifact");
    if (!release || typeof release !== "object" || Array.isArray(release) ||
        !content || typeof content !== "object" || Array.isArray(content)) {
      throw new TypeError("Release and content must be immutable data objects");
    }
    const rulesetHash = requireOwn(release, "rulesetHash", "Aegis release record");
    if (typeof rulesetHash !== "string" || !RULESET_HASH.test(rulesetHash)) {
      throw new TypeError("Release ruleset hash must be lowercase sha256:<64-hex>");
    }
    const eventSchemaVersion = nonnegativeInteger(
      requireOwn(release, "eventSchemaVersion", "Aegis release record"),
      "Release event schema version"
    );
    if (eventSchemaVersion !== ABI.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Release event schema version is unsupported by this replay executor");
    }
    if (requireOwn(content, "eventSchemaVersion", "Aegis content artifact") !== eventSchemaVersion) {
      throw new RangeError("Release and content event schema versions do not match");
    }
    if (requireOwn(content, "contentVersion", "Aegis content artifact") !==
        requireOwn(release, "contentVersion", "Aegis release record")) {
      throw new RangeError("Release and content versions do not match");
    }
    if (requireOwn(content, "schemaVersion", "Aegis content artifact") !==
        requireOwn(release, "schemaVersion", "Aegis release record")) {
      throw new RangeError("Release and content schema versions do not match");
    }
    if (requireOwn(content, "abiHash", "Aegis content artifact") !==
        requireOwn(release, "abiHash", "Aegis release record")) {
      throw new RangeError("Release and content ABI hashes do not match");
    }
    const includedIds = requireOwn(release, "includedIds", "Aegis release record");
    if (!includedIds || typeof includedIds !== "object" ||
        !Array.isArray(includedIds.missions) || includedIds.missions.length === 0) {
      throw new TypeError("Release included mission IDs must be a nonempty array");
    }
    const missions = requireOwn(content, "missions", "Aegis content artifact");
    if (!missions || typeof missions !== "object" || Array.isArray(missions)) {
      throw new TypeError("Content missions must be an ID-keyed object");
    }
    return Object.freeze({ content: content, release: release });
  }

  function replayHeader(envelope) {
    const header = {};
    HEADER_FIELDS.forEach(function (key) { header[key] = envelope[key]; });
    return Object.freeze(header);
  }

  function validateExecutionEnvelope(envelope) {
    exactFields(envelope, ENVELOPE_FIELDS, "Normalized replay envelope");
    if (dataValue(envelope, "formatVersion", "Normalized replay envelope") !== 1) {
      throw new RangeError("Normalized replay format version must be 1");
    }
    boundedString(
      dataValue(envelope, "rulesetHash", "Normalized replay envelope"),
      "Normalized replay ruleset hash",
      RULESET_HASH
    );
    if (dataValue(envelope, "eventSchemaVersion", "Normalized replay envelope") !==
        ABI.EVENT_SCHEMA_VERSION) {
      throw new RangeError("Normalized replay event schema version is unsupported");
    }
    boundedString(
      dataValue(envelope, "missionId", "Normalized replay envelope"),
      "Normalized replay mission ID",
      STABLE_ID
    );
    boundedString(
      dataValue(envelope, "difficultyId", "Normalized replay envelope"),
      "Normalized replay difficulty ID",
      STABLE_ID
    );
    if (typeof dataValue(envelope, "assist", "Normalized replay envelope") !== "boolean") {
      throw new TypeError("Normalized replay Assist flag must be Boolean");
    }
    nonnegativeInteger(
      dataValue(envelope, "seed", "Normalized replay envelope"),
      "Normalized replay seed",
      0xffffffff
    );

    const loadoutIds = idArray(
      dataValue(envelope, "loadoutIds", "Normalized replay envelope"),
      "Normalized replay loadout IDs",
      EXECUTION_LIMITS.maxLoadoutIds,
      { nonempty: true }
    );
    const loadoutSlotCap = nonnegativeInteger(
      dataValue(envelope, "loadoutSlotCap", "Normalized replay envelope"),
      "Normalized replay loadout slot cap",
      EXECUTION_LIMITS.maxLoadoutIds
    );
    if (loadoutSlotCap < 1) throw new RangeError("Normalized replay loadout slot cap must be at least one");
    if (loadoutIds.length > loadoutSlotCap) {
      throw new RangeError("Normalized replay loadout exceeds its slot cap");
    }
    idArray(
      dataValue(envelope, "campaignModifierIds", "Normalized replay envelope"),
      "Normalized replay campaign modifier IDs",
      EXECUTION_LIMITS.maxCampaignModifierIds,
      { sorted: true }
    );
    idArray(
      dataValue(envelope, "accessGrantIds", "Normalized replay envelope"),
      "Normalized replay access grant IDs",
      EXECUTION_LIMITS.maxAccessGrantIds
    );
    const tutorialMode = boundedString(
      dataValue(envelope, "tutorialUpgradeGateMode", "Normalized replay envelope"),
      "Normalized replay tutorial gate mode"
    );
    if (tutorialMode !== "none" && tutorialMode !== "m01-wave1") {
      throw new RangeError("Normalized replay tutorial gate mode is unsupported");
    }

    const claim = dataValue(envelope, "finalClaim", "Normalized replay envelope");
    exactFields(claim, FINAL_CLAIM_FIELDS, "Normalized replay final claim");
    const outcome = dataValue(claim, "outcome", "Normalized replay final claim");
    if (outcome !== "victory" && outcome !== "defeat") {
      throw new RangeError("Normalized replay final outcome must be victory or defeat");
    }
    nonnegativeInteger(
      dataValue(claim, "score", "Normalized replay final claim"),
      "Normalized replay final score"
    );
    nonnegativeInteger(
      dataValue(claim, "laurels", "Normalized replay final claim"),
      "Normalized replay final Laurels",
      3
    );
    const durationTicks = nonnegativeInteger(
      dataValue(claim, "durationTicks", "Normalized replay final claim"),
      "Normalized replay final duration",
      EXECUTION_LIMITS.maxDurationTicks
    );
    boundedString(
      dataValue(claim, "finalStateHash", "Normalized replay final claim"),
      "Normalized replay final state hash",
      FINAL_STATE_HASH
    );

    const inputSource = dataValue(envelope, "inputs", "Normalized replay envelope");
    arrayDataValues(inputSource, "Normalized replay inputs", EXECUTION_LIMITS.maxTotalCommands);
    const normalizedInputs = Commands.normalizeCommandSequence(inputSource, {
      maxCommandsPerTick: EXECUTION_LIMITS.maxCommandsPerTick,
      maxTick: EXECUTION_LIMITS.maxDurationTicks - 1,
      maxTotalCommands: EXECUTION_LIMITS.maxTotalCommands,
    });
    normalizedInputs.forEach(function (command, commandIndex) {
      Object.keys(command).forEach(function (key) {
        if (typeof command[key] === "string") {
          boundedString(command[key], "Normalized replay command " + commandIndex + "." + key);
        }
      });
    });
    if (normalizedInputs.length && normalizedInputs[normalizedInputs.length - 1].tick >= durationTicks) {
      throw new RangeError("Normalized replay input tick must be before the final boundary");
    }
    if (ABI.canonicalEncode(normalizedInputs) !== ABI.canonicalEncode(inputSource)) {
      throw new TypeError("Normalized replay inputs must equal the canonical Commands sequence");
    }

    const checkpoints = arrayDataValues(
      dataValue(envelope, "checkpoints", "Normalized replay envelope"),
      "Normalized replay checkpoints",
      EXECUTION_LIMITS.maxCheckpoints
    );
    let previousCheckpointTick = -1;
    checkpoints.forEach(function (checkpoint, checkpointIndex) {
      exactFields(checkpoint, CHECKPOINT_FIELDS, "Normalized replay checkpoint " + checkpointIndex);
      const checkpointTick = nonnegativeInteger(
        dataValue(checkpoint, "tick", "Normalized replay checkpoint " + checkpointIndex),
        "Normalized replay checkpoint tick",
        durationTicks
      );
      if (checkpointTick <= previousCheckpointTick) {
        throw new RangeError("Normalized replay checkpoints must use strictly increasing ticks");
      }
      boundedString(
        dataValue(checkpoint, "diagnosticHash", "Normalized replay checkpoint " + checkpointIndex),
        "Normalized replay checkpoint diagnostic hash",
        DIAGNOSTIC_HASH
      );
      previousCheckpointTick = checkpointTick;
    });
  }

  function validateNormalizedBinding(envelope, pair) {
    if (envelope.rulesetHash !== pair.release.rulesetHash) {
      throw new RangeError("Replay ruleset hash is unsupported by this bound simulator");
    }
    if (envelope.eventSchemaVersion !== pair.release.eventSchemaVersion) {
      throw new RangeError("Replay event schema version does not match the bound release");
    }
    if (pair.release.includedIds.missions.indexOf(envelope.missionId) === -1 ||
        !Object.prototype.hasOwnProperty.call(pair.content.missions, envelope.missionId)) {
      throw new RangeError("Replay mission is not included in the bound ruleset");
    }
    if (envelope.loadoutIds.length > envelope.loadoutSlotCap) {
      throw new RangeError("Replay loadout exceeds its bound slot cap");
    }
  }

  function requireKernelState(state, expectedTick, label) {
    requireDeepFrozenCanonical(state, label);
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new TypeError(label + " must be a frozen canonical object");
    }
    const tick = nonnegativeInteger(requireOwn(state, "tick", label), label + " tick");
    if (tick !== expectedTick) throw new RangeError(label + " tick does not match completed ticks");
    const outcome = requireOwn(state, "outcome", label);
    if (outcome !== "active" && outcome !== "victory" && outcome !== "defeat") {
      throw new RangeError(label + " outcome must be active, victory, or defeat");
    }
    nonnegativeInteger(requireOwn(state, "score", label), label + " score");
    const objectiveResults = requireOwn(state, "objectiveResults", label);
    if (!Array.isArray(objectiveResults) || !Object.isFrozen(objectiveResults)) {
      throw new TypeError(label + " objective results must be a frozen array");
    }
    objectiveResults.forEach(function (result, index) {
      if (!result || typeof result !== "object" || !Object.isFrozen(result) ||
          typeof result.complete !== "boolean") {
        throw new TypeError(label + " objective result " + index + " must expose a frozen complete flag");
      }
    });
    return state;
  }

  function telemetryInteger(value, label, options) {
    if (options && options.nullable && value === null) return null;
    ABI.assertSafeInteger(value, label);
    if (Object.is(value, -0)) throw new TypeError(label + " must use canonical positive zero");
    if (!options || options.nonnegative !== false) {
      if (value < 0) throw new RangeError(label + " must be nonnegative");
    }
    if (options && options.positive && value < 1) {
      throw new RangeError(label + " must be positive");
    }
    return value;
  }

  function telemetryId(value, label, nullable) {
    if (nullable && value === null) return null;
    return boundedString(value, label, STABLE_ID);
  }

  function telemetryRuntimeId(value, label, nullable) {
    return telemetryInteger(value, label, { nullable: nullable, positive: true });
  }

  function telemetryEnum(value, allowed, label) {
    if (typeof value !== "string" || allowed.indexOf(value) === -1) {
      throw new RangeError(label + " is not a closed balance telemetry v1 value");
    }
    return value;
  }

  function telemetryRuntimeIds(value, label, options) {
    const values = arrayDataValues(value, label, MAX_BALANCE_TELEMETRY_TARGET_IDS);
    let previous = 0;
    values.forEach(function (entry, index) {
      telemetryRuntimeId(entry, label + "[" + index + "]", false);
      if (entry <= previous) {
        throw new RangeError(label + " must contain ascending unique runtime IDs");
      }
      previous = entry;
    });
    if (!options || !options.deferFreezeCheck) requireDeepFrozenCanonical(value, label);
    return values;
  }

  function requireTelemetryRecordShape(record, ordinal) {
    if (!record || typeof record !== "object" || Array.isArray(record) || !Object.isFrozen(record)) {
      throw new TypeError("Kernel balance telemetry record " + ordinal + " must be a frozen object");
    }
    const kind = dataValue(record, "kind", "Kernel balance telemetry record " + ordinal);
    if (typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(TELEMETRY_RECORD_FIELDS, kind)) {
      throw new RangeError("Kernel balance telemetry record " + ordinal + " has an unknown kind");
    }
    const label = "Kernel balance telemetry " + kind + " record " + ordinal;
    exactFields(record, TELEMETRY_RECORD_FIELDS[kind], label);
    const actualOrdinal = telemetryInteger(dataValue(record, "ordinal", label), label + ".ordinal");
    if (actualOrdinal !== ordinal) {
      throw new RangeError(label + " ordinal must be contiguous and reducer-ordered");
    }
    return Object.freeze({ kind: kind, label: label });
  }

  function requireSpawnTelemetry(record, label) {
    telemetryEnum(dataValue(record, "entityKind", label), TELEMETRY_ENUMS.entityKind,
      label + ".entityKind");
    telemetryRuntimeId(dataValue(record, "enemyRuntimeId", label), label + ".enemyRuntimeId", false);
    ["ownerId", "lineageId", "routeId", "waveId"].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    telemetryInteger(dataValue(record, "maximumHpMilli", label), label + ".maximumHpMilli",
      { positive: true });
    telemetryInteger(dataValue(record, "initialShieldMilli", label), label + ".initialShieldMilli");
    telemetryInteger(dataValue(record, "baseSpeedDistanceUnitsPerSecond", label),
      label + ".baseSpeedDistanceUnitsPerSecond", { positive: true });
  }

  function requireAetherTelemetry(record, label) {
    const action = telemetryEnum(dataValue(record, "action", label), TELEMETRY_ENUMS.aetherAction,
      label + ".action");
    const towerAction = action === "build" || action === "upgrade" || action === "sell";
    const sourceId = telemetryId(dataValue(record, "sourceId", label), label + ".sourceId", false);
    if (towerAction && sourceId !== "command." + action) {
      throw new RangeError(label + ".sourceId does not match its tower command action");
    }
    const commandSeq = dataValue(record, "commandSeq", label);
    const requiresCommand = towerAction || action === "wave-start-grant";
    if ((commandSeq === null) === requiresCommand) {
      throw new TypeError(label + ".commandSeq nullability does not match its action");
    }
    telemetryInteger(commandSeq, label + ".commandSeq", { nullable: !requiresCommand });

    ["towerRuntimeId"].forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) === towerAction) {
        throw new TypeError(label + "." + field + " nullability does not match its action");
      }
      telemetryRuntimeId(value, label + "." + field, !towerAction);
    });
    ["levelBefore", "levelAfter"].forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) === towerAction) {
        throw new TypeError(label + "." + field + " nullability does not match its action");
      }
      telemetryInteger(value, label + "." + field, { nullable: !towerAction });
    });
    ["padId", "defenseId"].forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) === towerAction) {
        throw new TypeError(label + "." + field + " nullability does not match its action");
      }
      telemetryId(value, label + "." + field, !towerAction);
    });

    const investmentFields = ["investedBeforeAether", "investedAfterAether"];
    investmentFields.forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) === towerAction) {
        throw new TypeError(label + "." + field + " nullability does not match its action");
      }
      telemetryInteger(value, label + "." + field, { nullable: !towerAction });
    });
    if (action === "build" && (record.levelBefore !== 0 || record.investedBeforeAether !== 0)) {
      throw new RangeError(label + " build must begin at level and investment zero");
    }
    if (action === "build" && record.levelAfter !== 1) {
      throw new RangeError(label + " build must create a level-one tower");
    }
    if (action === "sell" && (record.levelAfter !== 0 || record.investedAfterAether !== 0)) {
      throw new RangeError(label + " sell must end at level and investment zero");
    }
    if (action === "sell" && (record.levelBefore < 1 || record.investedBeforeAether < 1)) {
      throw new RangeError(label + " sell must remove a positively invested owned tower");
    }
    if (action === "upgrade" && record.levelAfter !== record.levelBefore + 1) {
      throw new RangeError(label + " upgrade must advance exactly one level");
    }
    if (action === "upgrade" && record.levelBefore < 1) {
      throw new RangeError(label + " upgrade must begin from an owned tower level");
    }

    [
      "debitAether", "creditAether", "bankBeforeAether", "bankAfterAether",
      "bountyRemainderBefore", "bountyRemainderAfter",
    ].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
    const resolvedBank = ABI.checkedAdd(record.bankBeforeAether,
      ABI.checkedAdd(record.creditAether, -record.debitAether));
    if (resolvedBank !== record.bankAfterAether) {
      throw new RangeError(label + " bank deltas do not conserve Aether");
    }
    if (action === "build" || action === "upgrade") {
      if (record.debitAether < 1 || record.creditAether !== 0) {
        throw new RangeError(label + " purchase actions must be positive debits without credit");
      }
      if (record.investedAfterAether !==
          ABI.checkedAdd(record.investedBeforeAether, record.debitAether)) {
        throw new RangeError(label + " purchase debit must equal its investment increase");
      }
    } else if (action === "sell") {
      if (record.debitAether !== 0 ||
          record.creditAether !== ABI.refundSeventyPercent(record.investedBeforeAether)) {
        throw new RangeError(label + " sell credit must equal the ABI seventy-percent refund");
      }
    } else if (record.debitAether !== 0) {
      throw new RangeError(label + " internal credits cannot debit Aether");
    }
    if (action !== "bounty" &&
        record.bountyRemainderBefore !== record.bountyRemainderAfter) {
      throw new RangeError(label + " only bounty may change the bounty remainder");
    }
  }

  function requireActivationTelemetry(record, label) {
    telemetryEnum(dataValue(record, "actionId", label), TELEMETRY_ENUMS.activationActionId,
      label + ".actionId");
    telemetryId(dataValue(record, "behaviorId", label), label + ".behaviorId", false);
    telemetryRuntimeId(dataValue(record, "sourceTowerRuntimeId", label),
      label + ".sourceTowerRuntimeId", false);
    telemetryRuntimeId(dataValue(record, "sourceRuntimeId", label), label + ".sourceRuntimeId", false);
    telemetryId(dataValue(record, "defenseId", label), label + ".defenseId", false);
    telemetryInteger(dataValue(record, "level", label), label + ".level", { positive: true });
    telemetryId(dataValue(record, "padId", label), label + ".padId", false);
    const outcome = telemetryEnum(dataValue(record, "outcome", label),
      TELEMETRY_ENUMS.activationOutcome, label + ".outcome");
    const eligible = telemetryRuntimeIds(dataValue(record, "eligibleTargetRuntimeIds", label),
      label + ".eligibleTargetRuntimeIds");
    const selected = telemetryRuntimeIds(dataValue(record, "selectedTargetRuntimeIds", label),
      label + ".selectedTargetRuntimeIds");
    if (outcome !== "accepted" && selected.length !== 0) {
      throw new RangeError(label + " may select targets only when accepted");
    }
    let eligibleIndex = 0;
    selected.forEach(function (runtimeId) {
      while (eligibleIndex < eligible.length && eligible[eligibleIndex] < runtimeId) eligibleIndex += 1;
      if (eligible[eligibleIndex] !== runtimeId) {
        throw new RangeError(label + " selected targets must be eligible targets");
      }
    });
    if (outcome === "no-target") {
      if (["direct-hit", "splash-blast", "mark-scan"].indexOf(record.actionId) === -1 ||
          eligible.length !== 0) {
        throw new RangeError(label + " no-target must be a ready empty tower attack or scan");
      }
    } else if (outcome === "rejected") {
      if (record.actionId !== "guard-contact" || eligible.length === 0) {
        throw new RangeError(label + " rejected activation must be an eligible guard contact");
      }
    } else if (record.actionId === "guard-create") {
      if (eligible.length !== 0 || selected.length !== 0) {
        throw new RangeError(label + " guard creation cannot contain target IDs");
      }
    } else {
      if (eligible.length === 0 || selected.length === 0) {
        throw new RangeError(label + " accepted combat activation must select an eligible target");
      }
      if ((record.actionId === "direct-hit" || record.actionId === "guard-contact") &&
          selected.length !== 1) {
        throw new RangeError(label + " direct hits and guard contacts select exactly one target");
      }
    }
  }

  function requireMovementTelemetry(record, label) {
    telemetryRuntimeId(dataValue(record, "enemyRuntimeId", label), label + ".enemyRuntimeId", false);
    ["ownerId", "lineageId", "routeId"].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    [
      "priorRouteDistance", "nextRouteDistance", "actualAdvanceDistance", "effectiveSpeedBp",
      "scaledReductionBp",
    ].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
    const effectIds = telemetryRuntimeIds(dataValue(record, "sourceEffectRuntimeIds", label),
      label + ".sourceEffectRuntimeIds");
    const sourceIds = telemetryRuntimeIds(dataValue(record, "sourceRuntimeIds", label),
      label + ".sourceRuntimeIds");
    const towerIds = telemetryRuntimeIds(dataValue(record, "sourceTowerRuntimeIds", label),
      label + ".sourceTowerRuntimeIds");
    if (effectIds.length !== sourceIds.length) {
      throw new RangeError(label + " effect/source runtime arrays must be parallel");
    }
    if (record.scaledReductionBp === 0 &&
        (effectIds.length !== 0 || sourceIds.length !== 0 || towerIds.length !== 0)) {
      throw new RangeError(label + " no-control movement must have empty source arrays");
    }
    if (record.scaledReductionBp > 0 && effectIds.length === 0) {
      throw new RangeError(label + " controlled movement must identify its winning source");
    }
    if (record.nextRouteDistance < record.priorRouteDistance ||
        record.nextRouteDistance - record.priorRouteDistance !== record.actualAdvanceDistance) {
      throw new RangeError(label + " route-distance delta must equal actual advance");
    }
  }

  function requireDamageTelemetry(record, label) {
    ["sourceTowerRuntimeId", "sourceRuntimeId", "level", "targetRuntimeId"].forEach(function (field) {
      if (field === "level") {
        telemetryInteger(dataValue(record, field, label), label + "." + field, { positive: true });
      } else {
        telemetryRuntimeId(dataValue(record, field, label), label + "." + field, false);
      }
    });
    [
      "defenseId", "padId", "targetOwnerId", "targetLineageId", "targetRouteId", "damageTypeId",
    ].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    [
      "baseDamageMilli", "preShieldDamageMilli", "attemptedShieldDamageMilli",
      "appliedShieldDamageMilli", "eligibleHpDamageMilli", "appliedHpDamageMilli",
      "deferredHpDamageMilli", "overkillHpDamageMilli",
      "noExternalAppliedShieldDamageMilli", "noExternalAppliedHpDamageMilli",
      "targetShieldBeforeMilli", "targetShieldAfterMilli", "targetHpBeforeMilli",
      "targetHpAfterMilli",
    ].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
    if (record.targetShieldBeforeMilli - record.targetShieldAfterMilli !==
        record.appliedShieldDamageMilli) {
      throw new RangeError(label + " applied shield damage must equal the shield-pool delta");
    }
    if (record.targetHpBeforeMilli - record.targetHpAfterMilli !== record.appliedHpDamageMilli) {
      throw new RangeError(label + " applied HP damage must equal the HP-pool delta");
    }
    if (record.noExternalAppliedShieldDamageMilli > record.appliedShieldDamageMilli ||
        record.noExternalAppliedHpDamageMilli > record.appliedHpDamageMilli) {
      throw new RangeError(label + " no-external damage cannot exceed actual applied damage");
    }
    if (record.appliedShieldDamageMilli > record.attemptedShieldDamageMilli ||
        record.appliedShieldDamageMilli > record.targetShieldBeforeMilli) {
      throw new RangeError(label + " applied shield damage exceeds an attempted or available pool");
    }
    const resolvedEligibleHp = ABI.checkedAdd(
      record.appliedHpDamageMilli,
      ABI.checkedAdd(record.deferredHpDamageMilli, record.overkillHpDamageMilli)
    );
    if (record.eligibleHpDamageMilli !== resolvedEligibleHp) {
      throw new RangeError(label + " eligible HP damage must partition into applied, deferred, and overkill");
    }
    if (record.deferredHpDamageMilli > 0 && record.overkillHpDamageMilli > 0) {
      throw new RangeError(label + " threshold-deferred and terminal-overkill damage are exclusive");
    }
    if (record.deferredHpDamageMilli > 0 && record.targetHpAfterMilli === 0) {
      throw new RangeError(label + " threshold-deferred damage requires a surviving target");
    }
    if (record.overkillHpDamageMilli > 0 && record.targetHpAfterMilli !== 0) {
      throw new RangeError(label + " terminal overkill requires a zero-HP target");
    }
    const supportSources = telemetryRuntimeIds(
      dataValue(record, "supportSourceTowerRuntimeIds", label),
      label + ".supportSourceTowerRuntimeIds");
    telemetryRuntimeIds(dataValue(record, "revealSourceTowerRuntimeIds", label),
      label + ".revealSourceTowerRuntimeIds");
    if (supportSources.length === 0 &&
        (record.noExternalAppliedShieldDamageMilli !== record.appliedShieldDamageMilli ||
          record.noExternalAppliedHpDamageMilli !== record.appliedHpDamageMilli)) {
      throw new RangeError(label + " damage without support sources must equal its no-external result");
    }
  }

  function requireEffectTelemetry(record, label) {
    const action = telemetryEnum(dataValue(record, "action", label), TELEMETRY_ENUMS.effectAction,
      label + ".action");
    const effectKind = telemetryEnum(dataValue(record, "effectKind", label),
      TELEMETRY_ENUMS.effectKind, label + ".effectKind");
    telemetryRuntimeId(dataValue(record, "sourceRuntimeId", label), label + ".sourceRuntimeId", false);
    telemetryRuntimeId(dataValue(record, "targetRuntimeId", label), label + ".targetRuntimeId", false);
    const playerSourceFields = ["sourceTowerRuntimeId", "level"];
    const authoredSourceFields = ["defenseId", "padId"];
    const playerNull = dataValue(record, "sourceTowerRuntimeId", label) === null;
    playerSourceFields.forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) !== playerNull) {
        throw new TypeError(label + " player-source identity fields must share nullability");
      }
      if (field === "level") {
        telemetryInteger(value, label + "." + field, { nullable: playerNull, positive: true });
      } else {
        telemetryRuntimeId(value, label + "." + field, playerNull);
      }
    });
    authoredSourceFields.forEach(function (field) {
      const value = dataValue(record, field, label);
      if ((value === null) !== playerNull) {
        throw new TypeError(label + " player-source identity fields must share nullability");
      }
      telemetryId(value, label + "." + field, playerNull);
    });
    // The delayed-status -> active-status transition retains its earlier streamed tower
    // provenance. Replay can validate only this closed transition shape; the bounded
    // balance fold must match and inherit the prior delayed-status apply record.
    const delayedActivationRefresh = playerNull && action === "refresh" &&
      dataValue(record, "outcome", label) === "refreshed" && effectKind === "status";
    if (playerNull && (action === "apply" || action === "refresh") &&
        effectKind !== "boss-exposure" && effectKind !== "resistance-override" &&
        !delayedActivationRefresh) {
      throw new TypeError(label + " apply/refresh player effects require complete tower provenance");
    }
    ["targetOwnerId", "targetRouteId", "statusId"].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    [
      "requestedMagnitude", "appliedMagnitude", "requestedDurationTimeUnits",
      "appliedDurationTimeUnits",
    ].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
    const outcome = telemetryEnum(dataValue(record, "outcome", label),
      TELEMETRY_ENUMS.effectOutcome, label + ".outcome");
    const allowedOutcomes = action === "apply" ? ["applied", "rejected"]
      : action === "refresh" ? ["refreshed", "rejected"]
      : action === "remove" ? ["removed"] : ["expired"];
    if (allowedOutcomes.indexOf(outcome) === -1) {
      throw new RangeError(label + " action/outcome pair is invalid");
    }
    if ((outcome === "rejected" || action === "remove" || action === "expire") &&
        (record.appliedMagnitude !== 0 || record.appliedDurationTimeUnits !== 0)) {
      throw new RangeError(label + " non-active effect outcomes must apply zero magnitude and duration");
    }
  }

  function requireLeakTelemetry(record, label) {
    telemetryRuntimeId(dataValue(record, "enemyRuntimeId", label), label + ".enemyRuntimeId", false);
    ["ownerId", "lineageId", "routeId"].forEach(function (field) {
      telemetryId(dataValue(record, field, label), label + "." + field, false);
    });
    ["hpMilli", "shieldMilli", "integrityDamage"].forEach(function (field) {
      telemetryInteger(dataValue(record, field, label), label + "." + field);
    });
  }

  function requireBalanceTelemetry(telemetry, expectedTick) {
    if (!telemetry || typeof telemetry !== "object" || Array.isArray(telemetry) ||
        !Object.isFrozen(telemetry)) {
      throw new TypeError("Kernel balance telemetry must be a frozen object");
    }
    exactFields(telemetry, TELEMETRY_FIELDS, "Kernel balance telemetry");
    if (dataValue(telemetry, "schemaVersion", "Kernel balance telemetry") !==
        BALANCE_TELEMETRY_SCHEMA_VERSION) {
      throw new RangeError("Kernel balance telemetry schema version is unsupported");
    }
    const tick = telemetryInteger(dataValue(telemetry, "tick", "Kernel balance telemetry"),
      "Kernel balance telemetry tick");
    if (tick !== expectedTick) {
      throw new RangeError("Kernel balance telemetry tick must equal the input boundary tick");
    }
    const records = arrayDataValues(dataValue(telemetry, "records", "Kernel balance telemetry"),
      "Kernel balance telemetry records", MAX_BALANCE_TELEMETRY_RECORDS_PER_TICK);
    if (!Object.isFrozen(telemetry.records)) {
      throw new TypeError("Kernel balance telemetry records must be frozen");
    }
    records.forEach(function (record, ordinal) {
      const shape = requireTelemetryRecordShape(record, ordinal);
      if (shape.kind === "spawn") requireSpawnTelemetry(record, shape.label);
      else if (shape.kind === "aether-transaction") requireAetherTelemetry(record, shape.label);
      else if (shape.kind === "activation") requireActivationTelemetry(record, shape.label);
      else if (shape.kind === "movement-control") requireMovementTelemetry(record, shape.label);
      else if (shape.kind === "damage") requireDamageTelemetry(record, shape.label);
      else if (shape.kind === "effect") requireEffectTelemetry(record, shape.label);
      else if (shape.kind === "leak") requireLeakTelemetry(record, shape.label);
    });
    requireDeepFrozenCanonical(telemetry, "Kernel balance telemetry");
    return telemetry;
  }

  function requireTickResult(result, expectedTick, inputTick) {
    if (!result || typeof result !== "object" || Array.isArray(result) || !Object.isFrozen(result)) {
      throw new TypeError("Kernel advanceTick must return a frozen result object");
    }
    exactFields(result, ["events", "state", "telemetry"], "Kernel tick result");
    if (!Array.isArray(result.events) || !Object.isFrozen(result.events)) {
      throw new TypeError("Kernel tick events must be a frozen array");
    }
    requireDeepFrozenCanonical(result.events, "Kernel tick events");
    requireBalanceTelemetry(result.telemetry, inputTick);
    return requireKernelState(result.state, expectedTick, "Kernel tick state");
  }

  function diagnosticStateHash(state) {
    return "fnv1a32:" + ABI.fnv1a32Hex(ABI.canonicalBytes(state));
  }

  function finalStateHash(state) {
    return ABI.sha256Hex(ABI.canonicalBytes(state));
  }

  function countLaurels(state) {
    let count = 0;
    state.objectiveResults.forEach(function (result) {
      if (result.complete) count += 1;
    });
    return count;
  }

  function runNormalizedReplay(binding, pair, envelope) {
    validateNormalizedBinding(envelope, pair);
    const durationTicks = envelope.finalClaim.durationTicks;
    let state = requireKernelState(
      Kernel.createInitialState(binding, replayHeader(envelope)),
      0,
      "Kernel initial state"
    );
    if (state.outcome !== "active") {
      throw new RangeError("Kernel initial state must be active before any completed replay tick");
    }

    let inputIndex = 0;
    let checkpointIndex = 0;
    function verifyCheckpointAtCurrentTick() {
      if (checkpointIndex >= envelope.checkpoints.length) return;
      const checkpoint = envelope.checkpoints[checkpointIndex];
      if (checkpoint.tick !== state.tick) return;
      const actual = diagnosticStateHash(state);
      if (actual !== checkpoint.diagnosticHash) {
        throw new Error("Replay diagnostic checkpoint mismatch at tick " + state.tick);
      }
      checkpointIndex += 1;
    }

    verifyCheckpointAtCurrentTick();
    for (let tick = 0; tick < durationTicks; tick += 1) {
      if (state.tick !== tick) throw new RangeError("Kernel state tick drifted before replay advance");
      if (state.outcome !== "active") {
        throw new RangeError("Replay reached a terminal state before its claimed final boundary");
      }
      const bucket = [];
      while (inputIndex < envelope.inputs.length && envelope.inputs[inputIndex].tick === tick) {
        bucket.push(envelope.inputs[inputIndex]);
        inputIndex += 1;
      }
      const result = Kernel.advanceTick(binding, state, Object.freeze(bucket));
      state = requireTickResult(result, tick + 1, tick);
      if (state.outcome !== "active" && state.tick < durationTicks) {
        throw new RangeError("Replay reached a terminal state before its claimed final boundary");
      }
      if (state.outcome === "active" && state.tick === durationTicks) {
        throw new RangeError("Replay did not reach a terminal state at its claimed final boundary");
      }
      verifyCheckpointAtCurrentTick();
    }

    if (inputIndex !== envelope.inputs.length) {
      throw new RangeError("Replay contains an input outside the executed tick interval");
    }
    if (checkpointIndex !== envelope.checkpoints.length) {
      throw new RangeError("Replay contains an unverified diagnostic checkpoint");
    }
    if (state.outcome === "active") {
      throw new RangeError("Replay did not reach a terminal state at its claimed final boundary");
    }
    if (state.outcome !== envelope.finalClaim.outcome) {
      throw new Error("Replay final outcome claim does not match the simulated state");
    }
    if (state.score !== envelope.finalClaim.score) {
      throw new Error("Replay final score claim does not match the simulated state");
    }
    if (countLaurels(state) !== envelope.finalClaim.laurels) {
      throw new Error("Replay final Laurel claim does not match the simulated objectives");
    }
    if (state.tick !== durationTicks) {
      throw new Error("Replay final duration claim does not match the simulated state");
    }
    if (finalStateHash(state) !== envelope.finalClaim.finalStateHash) {
      throw new Error("Replay final state SHA-256 claim does not match the simulated state");
    }
    return Object.freeze({
      finalState: state,
      verifiedCheckpointCount: checkpointIndex,
    });
  }

  function createBoundSimulator(input) {
    exactFields(input, BOUND_INPUT_FIELDS, "Replay runner binding input");
    if (typeof input.normalizeReplayEnvelope !== "function") {
      throw new TypeError("Replay runner requires the strict v1 envelope normalizer");
    }
    const pair = requireArtifactPair(input.release, input.content);
    const binding = Kernel.createRulesetBinding({ release: pair.release, content: pair.content });
    if (!binding || typeof binding !== "object" || !Object.isFrozen(binding)) {
      throw new TypeError("Kernel createRulesetBinding must return an opaque frozen binding");
    }
    const normalize = input.normalizeReplayEnvelope;
    return Object.freeze({
      simulateReplay: function (envelopeInput) {
        const envelope = normalize(envelopeInput);
        validateExecutionEnvelope(envelope);
        requireDeepFrozenCanonical(envelope, "Normalized replay envelope");
        return runNormalizedReplay(binding, pair, envelope);
      },
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    EXECUTION_LIMITS: EXECUTION_LIMITS,
    RUNNER_SCHEMA_VERSION: RUNNER_SCHEMA_VERSION,
    createBoundSimulator: createBoundSimulator,
  });
});
