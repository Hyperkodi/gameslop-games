/* Armara Aegis deterministic management reducer v1.
   Pure build/upgrade/sell/wave/gate/policy state; combat behavior belongs to later reducers. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./abi.js"),
      require("./economy.js"),
      require("./movement.js"),
      require("./commands.js"),
      require("./commands-v2.js"),
      require("./protocols.js"),
      require("./relics.js")
    );
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before management.js");
  if (!game.AegisEconomy) throw new Error("Game.AegisEconomy must be installed before management.js");
  if (!game.AegisMovement) throw new Error("Game.AegisMovement must be installed before management.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before management.js");
  if (!game.AegisCommandsV2) throw new Error("Game.AegisCommandsV2 must be installed before management.js");
  if (!game.AegisProtocols) throw new Error("Game.AegisProtocols must be installed before management.js");
  if (!game.AegisRelics) throw new Error("Game.AegisRelics must be installed before management.js");
  const api = factory(
    game.AegisSim,
    game.AegisEconomy,
    game.AegisMovement,
    game.AegisCommands,
    game.AegisCommandsV2,
    game.AegisProtocols,
    game.AegisRelics
  );
  if (Object.prototype.hasOwnProperty.call(game, "AegisManagement")) {
    if (game.AegisManagement !== api) throw new Error("Game.AegisManagement is already installed");
    return;
  }
  Object.defineProperty(game, "AegisManagement", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (
  ABI,
  Economy,
  Movement,
  Commands,
  CommandsV2,
  Protocols,
  Relics
) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  if (!Economy || !Object.isFrozen(Economy) || Economy.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis economy API is required");
  }
  if (!Movement || !Object.isFrozen(Movement) || Movement.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis movement API is required");
  }
  if (!Commands || !Object.isFrozen(Commands) || Commands.ABI_DESCRIPTOR_SHA256 !== ABI.DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis commands API is required");
  }
  ["assertSafeInteger", "checkedAdd", "canonicalEncode"].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  ["addInvestment", "cumulativeInvestment", "sellRefund", "initialBountyRemainder", "creditFixedGrant"]
    .forEach(function (name) {
      if (typeof Economy[name] !== "function") throw new TypeError("Aegis economy API is missing " + name);
    });
  ["createRuntimeIdState", "allocateRuntimeId"].forEach(function (name) {
    if (typeof Movement[name] !== "function") throw new TypeError("Aegis movement API is missing " + name);
  });
  ["createCommandLimits", "normalizeCommandSequence"].forEach(function (name) {
    if (typeof Commands[name] !== "function") throw new TypeError("Aegis commands API is missing " + name);
  });
  if (!CommandsV2 || !Object.isFrozen(CommandsV2) || CommandsV2.COMMAND_SCHEMA_VERSION !== 2) {
    throw new TypeError("A matching frozen Aegis command-v2 API is required");
  }
  if (!Protocols || !Object.isFrozen(Protocols) ||
      Protocols.ABI_DESCRIPTOR_SHA256 !== CommandsV2.ABI_DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis Protocol API is required");
  }
  if (!Relics || !Object.isFrozen(Relics) ||
      Relics.ABI_DESCRIPTOR_SHA256 !== CommandsV2.ABI_DESCRIPTOR_SHA256) {
    throw new TypeError("A matching frozen Aegis Relic API is required");
  }
  ["planProtocolActivation", "resolveProtocolCastCost"].forEach(function (name) {
    if (typeof Protocols[name] !== "function") throw new TypeError("Aegis Protocol API is missing " + name);
  });
  ["applyBountyWithRemainder", "applyIntegerModifier", "resolveProtocolCastCostWithRelics"]
    .forEach(function (name) {
      if (typeof Relics[name] !== "function") {
        throw new TypeError("Aegis Relic API is missing " + name);
      }
    });

  const MANAGEMENT_SCHEMA_VERSION = 1;
  const PHASES = Object.freeze(["planning", "wave", "complete"]);
  const TUTORIAL_GATE_MODES = Object.freeze(ABI.DESCRIPTOR.tutorialUpgradeGate.modes.slice());
  const CONFIG_FIELDS = Object.freeze([
    "missionId",
    "resolvedStartAether",
    "tutorialUpgradeGateMode",
    "padIds",
    "waveStartGrants",
    "defenses",
  ]);
  const DEFENSE_FIELDS = Object.freeze([
    "id", "costsAether", "defaultTargetPolicy", "allowedTargetPolicies",
  ]);
  const STATE_FIELDS = Object.freeze([
    "schemaVersion",
    "missionId",
    "aether",
    "bountyRemainder",
    "phase",
    "activeWave",
    "clearedWaves",
    "tutorialUpgradeGateMode",
    "tutorialUpgradeGateOpen",
    "towers",
    "runtimeIds",
  ]);
  const TOWER_FIELDS = Object.freeze([
    "id", "padId", "defenseId", "level", "investedAether", "targetPolicy",
  ]);
  const LOWERCASE_AUTHORED_ID = /^[a-z][a-z0-9._:-]*$/;

  /* ABI v2 (compiled content schema 4) additions. Every v1 record shape above is retained
     byte-identically; a v2 config is recognized only by its explicit `abiVersion` field. */
  const MANAGEMENT_SCHEMA_VERSION_V2 = 2;
  const CONFIG_FIELDS_V2 = Object.freeze(CONFIG_FIELDS.concat([
    "abiVersion", "relicModifiers", "specializationAccessIds", "specializations",
  ]));
  const TOWER_FIELDS_V2 = Object.freeze(TOWER_FIELDS.concat([
    "disableSources", "paidCosts", "specializationId",
  ]));
  const DISABLE_SOURCE_FIELDS = Object.freeze(["expiryTick", "sourceId"]);
  const SPECIALIZATION_FIELDS = Object.freeze(["costAether", "defenseId", "id"]);
  const V2_ONLY_COMMAND_TYPES = Object.freeze([
    "activateMechanism", "activatePower", "deployReinforcement", "resetPlan", "specializeTower",
  ]);
  const MAX_DISABLE_SOURCES = 8;
  const MAX_PROTOCOL_RUNTIME_RECORDS = 3;
  const MAX_TOWER_PAID_COSTS = 3;
  const MAX_SPECIALIZATIONS = 128;
  const MAX_SPECIALIZATION_ACCESS_IDS = 128;
  const V2_LEVEL_CAP = 3;
  const SPECIALIZATION_LEVEL = 3;
  const RELIC_COST_STATS = Object.freeze({
    build: "build-cost",
    upgrade: "upgrade-cost",
    specialization: "specialization-cost",
    protocol: "protocol-cost",
  });

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

  function nonnegativeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return Object.is(value, -0) ? 0 : value;
  }

  function positiveInteger(value, label) {
    value = nonnegativeInteger(value, label);
    if (value === 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function lowercaseAuthoredId(value, label) {
    if (typeof value !== "string" || !LOWERCASE_AUTHORED_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase authored ID");
    }
    return value;
  }

  function booleanValue(value, label) {
    if (typeof value !== "boolean") throw new TypeError(label + " must be boolean");
    return value;
  }

  function freezeArray(items) {
    return Object.freeze(items);
  }

  function normalizePolicyList(value, defenseId) {
    if (!Array.isArray(value)) throw new TypeError("Defense " + defenseId + " target policies must be an array");
    ABI.canonicalEncode(value);
    const seen = new Set();
    let previousPolicyOrder = -1;
    const policies = value.map(function (policy) {
      if (typeof policy !== "string" || Commands.TARGET_POLICIES.indexOf(policy) === -1) {
        throw new TypeError("Defense " + defenseId + " has an unsupported target policy");
      }
      if (seen.has(policy)) throw new RangeError("Defense " + defenseId + " has a duplicate target policy");
      seen.add(policy);
      const policyOrder = Commands.TARGET_POLICIES.indexOf(policy);
      if (policyOrder <= previousPolicyOrder) {
        throw new RangeError("Defense " + defenseId + " target policies must use canonical policy order");
      }
      previousPolicyOrder = policyOrder;
      return policy;
    });
    return freezeArray(policies);
  }

  function normalizeDefense(value, index, abiVersion) {
    exactFields(value, DEFENSE_FIELDS, "Defense " + index);
    const id = lowercaseAuthoredId(value.id, "Defense " + index + " ID");
    /* ABI v1 defenses buy three linear levels. Under ABI v2 the third level is a
       specialization purchase, so the ordinary paid-level table has exactly two records. */
    const requiredLevels = abiVersion === 2 ? 2 : 3;
    if (!Array.isArray(value.costsAether) || value.costsAether.length !== requiredLevels) {
      throw new RangeError(
        "Defense " + id + " must contain exactly " +
        (requiredLevels === 2 ? "two" : "three") + " level costs"
      );
    }
    ABI.canonicalEncode(value.costsAether);
    const costsAether = freezeArray(value.costsAether.map(function (cost, levelIndex) {
      return positiveInteger(cost, "Defense " + id + " level " + (levelIndex + 1) + " cost");
    }));
    Economy.cumulativeInvestment(costsAether);

    const allowedTargetPolicies = normalizePolicyList(value.allowedTargetPolicies, id);
    let defaultTargetPolicy = value.defaultTargetPolicy;
    if (allowedTargetPolicies.length === 0) {
      if (defaultTargetPolicy !== null) {
        throw new TypeError("Defense " + id + " without target policies must use a null default");
      }
    } else if (typeof defaultTargetPolicy !== "string" ||
        allowedTargetPolicies.indexOf(defaultTargetPolicy) === -1) {
      throw new RangeError("Defense " + id + " default target policy must be allowed");
    }
    return Object.freeze({
      id: id,
      costsAether: costsAether,
      defaultTargetPolicy: defaultTargetPolicy,
      allowedTargetPolicies: allowedTargetPolicies,
    });
  }

  function configAbiVersion(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return 1;
    if (!Object.prototype.hasOwnProperty.call(input, "abiVersion")) return 1;
    if (input.abiVersion !== 2) throw new RangeError("Unsupported management config ABI version");
    return 2;
  }

  /* The table lists every authored branch in the release, not only the equipped families, so a
     branch belonging to another family denies as `foreign-specialization` rather than unknown. */
  function normalizeSpecializationTable(input) {
    if (!Array.isArray(input) || input.length > MAX_SPECIALIZATIONS) {
      throw new RangeError("Management config specializations must be a bounded array");
    }
    ABI.canonicalEncode(input);
    let previous = null;
    return freezeArray(input.map(function (record, index) {
      exactFields(record, SPECIALIZATION_FIELDS, "Specialization " + index);
      const id = lowercaseAuthoredId(record.id, "Specialization " + index + " ID");
      if (previous !== null && id <= previous) {
        throw new RangeError("Management config specializations must use strict ASCII ID order");
      }
      previous = id;
      const defenseId = lowercaseAuthoredId(record.defenseId, "Specialization " + id + " defense ID");
      return Object.freeze({
        costAether: positiveInteger(record.costAether, "Specialization " + id + " cost"),
        defenseId: defenseId,
        id: id,
      });
    }));
  }

  function normalizeRelicModifiers(input) {
    if (!Array.isArray(input)) throw new TypeError("Relic modifiers must be an array");
    ABI.canonicalEncode(input);
    let previous = null;
    return freezeArray(input.map(function (modifier, index) {
      if (!modifier || typeof modifier !== "object" || Array.isArray(modifier) ||
          typeof modifier.statId !== "string") {
        throw new TypeError("Relic modifier " + index + " must be a resolved modifier record");
      }
      if (previous !== null && modifier.statId <= previous) {
        throw new RangeError("Relic modifiers must use strict ASCII stat order");
      }
      previous = modifier.statId;
      if (!Object.prototype.hasOwnProperty.call(Relics.STAT_POLICIES, modifier.statId)) {
        throw new RangeError("Unknown resolved Relic stat " + modifier.statId);
      }
      /* Validate through the owning resolver so a hostile amount can never reach a cost. */
      if (Relics.STAT_POLICIES[modifier.statId].rounding === "mission-remainder") {
        Relics.applyBountyWithRemainder(0, modifier.amount, 0);
      } else {
        Relics.applyIntegerModifier(0, modifier);
      }
      return Object.freeze({
        amount: modifier.amount,
        operation: modifier.operation,
        rounding: modifier.rounding,
        statId: modifier.statId,
      });
    }));
  }

  function relicModifierByStat(config, statId) {
    if (config.abiVersion !== 2) return null;
    for (let index = 0; index < config.relicModifiers.length; index++) {
      if (config.relicModifiers[index].statId === statId) return config.relicModifiers[index];
    }
    return null;
  }

  /* R1/R2: one clamped basis-point sum resolved by relics.js, then exactly one rounding here. */
  function resolvedCostAether(config, statId, baseCostAether) {
    const modifier = relicModifierByStat(config, statId);
    if (modifier === null) return nonnegativeInteger(baseCostAether, "Base Aether cost");
    return Relics.applyIntegerModifier(baseCostAether, modifier);
  }

  function relicCostMultiplierBp(config, statId) {
    const modifier = relicModifierByStat(config, statId);
    return modifier === null ? ABI.BASIS_POINTS : modifier.amount;
  }

  function specializationById(config, specializationId) {
    for (let index = 0; index < config.specializations.length; index++) {
      if (config.specializations[index].id === specializationId) return config.specializations[index];
    }
    return null;
  }

  function normalizeSharedConfigFields(input, abiVersion) {
    const missionId = lowercaseAuthoredId(input.missionId, "Mission ID");
    const resolvedStartAether = nonnegativeInteger(input.resolvedStartAether, "Resolved starting Aether");
    if (typeof input.tutorialUpgradeGateMode !== "string" ||
        TUTORIAL_GATE_MODES.indexOf(input.tutorialUpgradeGateMode) === -1) {
      throw new RangeError("Unsupported tutorial Upgrade gate mode");
    }
    if (input.tutorialUpgradeGateMode === "m01-wave1" && missionId !== "m01") {
      throw new RangeError("The m01-wave1 tutorial Upgrade gate is valid only for Mission 1");
    }

    if (!Array.isArray(input.padIds) || input.padIds.length === 0) {
      throw new RangeError("Management config must contain at least one pad ID");
    }
    ABI.canonicalEncode(input.padIds);
    const padSet = new Set();
    const padIds = freezeArray(input.padIds.map(function (padId, index) {
      const normalized = lowercaseAuthoredId(padId, "Pad " + index + " ID");
      if (padSet.has(normalized)) throw new RangeError("Management config contains duplicate pad ID " + normalized);
      padSet.add(normalized);
      return normalized;
    }));

    if (!Array.isArray(input.waveStartGrants) || input.waveStartGrants.length === 0) {
      throw new RangeError("Management config must contain at least one wave-start grant");
    }
    ABI.canonicalEncode(input.waveStartGrants);
    const waveStartGrants = freezeArray(input.waveStartGrants.map(function (grant, index) {
      return nonnegativeInteger(grant, "Wave " + (index + 1) + " start grant");
    }));

    if (!Array.isArray(input.defenses) || input.defenses.length === 0) {
      throw new RangeError("Management config must contain at least one equipped defense");
    }
    ABI.canonicalEncode(input.defenses);
    const defenseSet = new Set();
    const defenses = freezeArray(input.defenses.map(function (defense, index) {
      const normalized = normalizeDefense(defense, index, abiVersion);
      if (defenseSet.has(normalized.id)) {
        throw new RangeError("Management config contains duplicate defense ID " + normalized.id);
      }
      defenseSet.add(normalized.id);
      return normalized;
    }));

    return {
      missionId: missionId,
      resolvedStartAether: resolvedStartAether,
      tutorialUpgradeGateMode: input.tutorialUpgradeGateMode,
      padIds: padIds,
      waveStartGrants: waveStartGrants,
      defenses: defenses,
    };
  }

  function normalizeManagementConfigV2(input) {
    exactFields(input, CONFIG_FIELDS_V2, "Management config");
    const shared = normalizeSharedConfigFields(input, 2);
    const specializations = normalizeSpecializationTable(input.specializations);
    if (!Array.isArray(input.specializationAccessIds) ||
        input.specializationAccessIds.length > MAX_SPECIALIZATION_ACCESS_IDS) {
      throw new RangeError("Specialization access IDs must be a bounded array");
    }
    ABI.canonicalEncode(input.specializationAccessIds);
    let previousAccessId = null;
    const specializationAccessIds = freezeArray(
      input.specializationAccessIds.map(function (accessId, index) {
        const normalized = lowercaseAuthoredId(accessId, "Specialization access " + index + " ID");
        if (previousAccessId !== null && normalized <= previousAccessId) {
          throw new RangeError("Specialization access IDs must use strict ASCII order");
        }
        previousAccessId = normalized;
        return normalized;
      })
    );
    return Object.freeze({
      abiVersion: 2,
      missionId: shared.missionId,
      resolvedStartAether: shared.resolvedStartAether,
      tutorialUpgradeGateMode: shared.tutorialUpgradeGateMode,
      padIds: shared.padIds,
      waveStartGrants: shared.waveStartGrants,
      defenses: shared.defenses,
      relicModifiers: normalizeRelicModifiers(input.relicModifiers),
      specializationAccessIds: specializationAccessIds,
      specializations: specializations,
    });
  }

  function normalizeManagementConfig(input) {
    if (configAbiVersion(input) === 2) return normalizeManagementConfigV2(input);
    exactFields(input, CONFIG_FIELDS, "Management config");
    return Object.freeze(normalizeSharedConfigFields(input, 1));
  }

  function defenseById(config, defenseId) {
    for (let index = 0; index < config.defenses.length; index++) {
      if (config.defenses[index].id === defenseId) return config.defenses[index];
    }
    return null;
  }

  function towerById(towers, towerId) {
    for (let index = 0; index < towers.length; index++) {
      if (towers[index].id === towerId) return towers[index];
    }
    return null;
  }

  function towerAtPad(towers, padId) {
    for (let index = 0; index < towers.length; index++) {
      if (towers[index].padId === padId) return towers[index];
    }
    return null;
  }

  function freezeTower(tower, abiVersion) {
    if (abiVersion !== 2) {
      return Object.freeze({
        id: tower.id,
        padId: tower.padId,
        defenseId: tower.defenseId,
        level: tower.level,
        investedAether: tower.investedAether,
        targetPolicy: tower.targetPolicy,
      });
    }
    return Object.freeze({
      id: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: tower.level,
      investedAether: tower.investedAether,
      targetPolicy: tower.targetPolicy,
      specializationId: tower.specializationId,
      paidCosts: freezeArray(tower.paidCosts.slice()),
      disableSources: freezeArray(tower.disableSources.map(function (source) {
        return Object.freeze({ expiryTick: source.expiryTick, sourceId: source.sourceId });
      })),
    });
  }

  function freezeState(values) {
    return Object.freeze({
      schemaVersion: values.schemaVersion || MANAGEMENT_SCHEMA_VERSION,
      missionId: values.missionId,
      aether: values.aether,
      bountyRemainder: values.bountyRemainder,
      phase: values.phase,
      activeWave: values.activeWave,
      clearedWaves: values.clearedWaves,
      tutorialUpgradeGateMode: values.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: values.tutorialUpgradeGateOpen,
      towers: values.towers,
      runtimeIds: values.runtimeIds,
    });
  }

  function normalizeDisableSources(value, towerId) {
    if (!Array.isArray(value) || value.length > MAX_DISABLE_SOURCES) {
      throw new RangeError("Tower " + towerId + " disable sources exceed the bounded collection");
    }
    ABI.canonicalEncode(value);
    let previous = null;
    return freezeArray(value.map(function (source, index) {
      exactFields(source, DISABLE_SOURCE_FIELDS, "Tower " + towerId + " disable source " + index);
      const sourceId = lowercaseAuthoredId(source.sourceId, "Disable source ID");
      if (previous !== null && sourceId <= previous) {
        throw new RangeError("Tower " + towerId + " disable sources must use strict ASCII ID order");
      }
      previous = sourceId;
      return Object.freeze({
        expiryTick: nonnegativeInteger(source.expiryTick, "Disable source expiry tick"),
        sourceId: sourceId,
      });
    }));
  }

  function normalizeTowerV2(value, index, config, seenIds, seenPads) {
    exactFields(value, TOWER_FIELDS_V2, "Tower " + index);
    const id = positiveInteger(value.id, "Tower " + index + " ID");
    if (seenIds.has(id)) throw new RangeError("Management state contains duplicate tower ID " + id);
    seenIds.add(id);
    const padId = lowercaseAuthoredId(value.padId, "Tower " + id + " pad ID");
    if (config.padIds.indexOf(padId) === -1) throw new RangeError("Tower " + id + " uses an unknown pad ID");
    if (seenPads.has(padId)) throw new RangeError("Management state contains two towers on pad " + padId);
    seenPads.add(padId);
    const defenseId = lowercaseAuthoredId(value.defenseId, "Tower " + id + " defense ID");
    const defense = defenseById(config, defenseId);
    if (!defense) throw new RangeError("Tower " + id + " uses an unknown defense ID");
    const level = positiveInteger(value.level, "Tower " + id + " level");
    if (level > V2_LEVEL_CAP) throw new RangeError("Tower " + id + " exceeds its maximum level");
    let specializationId = value.specializationId;
    if (level === SPECIALIZATION_LEVEL) {
      specializationId = lowercaseAuthoredId(specializationId, "Tower " + id + " specialization ID");
      const record = specializationById(config, specializationId);
      if (!record || record.defenseId !== defenseId) {
        throw new RangeError("Tower " + id + " uses a specialization its defense does not own");
      }
    } else if (specializationId !== null) {
      throw new RangeError("Tower " + id + " below Level 3 must not carry a specialization");
    }
    if (!Array.isArray(value.paidCosts) || value.paidCosts.length !== level ||
        value.paidCosts.length > MAX_TOWER_PAID_COSTS) {
      throw new RangeError("Tower " + id + " paid costs must record exactly one payment per level");
    }
    ABI.canonicalEncode(value.paidCosts);
    const paidCosts = freezeArray(value.paidCosts.map(function (cost, costIndex) {
      return positiveInteger(cost, "Tower " + id + " level " + (costIndex + 1) + " paid cost");
    }));
    const investedAether = nonnegativeInteger(value.investedAether, "Tower " + id + " invested Aether");
    if (investedAether !== Economy.cumulativeInvestment(paidCosts)) {
      throw new RangeError("Tower " + id + " investment does not match its actual paid costs");
    }
    if (defense.allowedTargetPolicies.length === 0) {
      if (value.targetPolicy !== null) throw new RangeError("Tower " + id + " must not have a target policy");
    } else if (typeof value.targetPolicy !== "string" ||
        defense.allowedTargetPolicies.indexOf(value.targetPolicy) === -1) {
      throw new RangeError("Tower " + id + " has a target policy its defense does not allow");
    }
    return freezeTower({
      id: id,
      padId: padId,
      defenseId: defenseId,
      level: level,
      investedAether: investedAether,
      targetPolicy: value.targetPolicy,
      specializationId: level === SPECIALIZATION_LEVEL ? specializationId : null,
      paidCosts: paidCosts,
      disableSources: normalizeDisableSources(value.disableSources, id),
    }, 2);
  }

  function normalizeTower(value, index, config, seenIds, seenPads) {
    if (config.abiVersion === 2) return normalizeTowerV2(value, index, config, seenIds, seenPads);
    exactFields(value, TOWER_FIELDS, "Tower " + index);
    const id = positiveInteger(value.id, "Tower " + index + " ID");
    if (seenIds.has(id)) throw new RangeError("Management state contains duplicate tower ID " + id);
    seenIds.add(id);
    const padId = lowercaseAuthoredId(value.padId, "Tower " + id + " pad ID");
    if (config.padIds.indexOf(padId) === -1) throw new RangeError("Tower " + id + " uses an unknown pad ID");
    if (seenPads.has(padId)) throw new RangeError("Management state contains two towers on pad " + padId);
    seenPads.add(padId);
    const defenseId = lowercaseAuthoredId(value.defenseId, "Tower " + id + " defense ID");
    const defense = defenseById(config, defenseId);
    if (!defense) throw new RangeError("Tower " + id + " uses an unknown defense ID");
    const level = positiveInteger(value.level, "Tower " + id + " level");
    if (level > defense.costsAether.length) throw new RangeError("Tower " + id + " exceeds its maximum level");
    const investedAether = nonnegativeInteger(value.investedAether, "Tower " + id + " invested Aether");
    const expectedInvestment = Economy.cumulativeInvestment(defense.costsAether.slice(0, level));
    if (investedAether !== expectedInvestment) {
      throw new RangeError("Tower " + id + " investment does not match its paid level costs");
    }
    if (defense.allowedTargetPolicies.length === 0) {
      if (value.targetPolicy !== null) throw new RangeError("Tower " + id + " must not have a target policy");
    } else if (typeof value.targetPolicy !== "string" ||
        defense.allowedTargetPolicies.indexOf(value.targetPolicy) === -1) {
      throw new RangeError("Tower " + id + " has a target policy its defense does not allow");
    }
    return freezeTower({
      id: id,
      padId: padId,
      defenseId: defenseId,
      level: level,
      investedAether: investedAether,
      targetPolicy: value.targetPolicy,
    });
  }

  /* Structural validation/canonicalization only. This never authenticates a cached,
     imported, or replay snapshot and never makes one authoritative; the owning
     kernel/replay flow must establish provenance before passing state here. */
  function normalizeManagementState(input, configInput) {
    const config = normalizeManagementConfig(configInput);
    const schemaVersion = config.abiVersion === 2
      ? MANAGEMENT_SCHEMA_VERSION_V2 : MANAGEMENT_SCHEMA_VERSION;
    exactFields(input, STATE_FIELDS, "Management state");
    if (input.schemaVersion !== schemaVersion) {
      throw new RangeError("Unsupported management state schema version");
    }
    if (input.missionId !== config.missionId) throw new RangeError("Management state mission does not match config");
    const aether = nonnegativeInteger(input.aether, "Management state Aether");
    const bounty = Economy.creditFixedGrant(input.bountyRemainder, 0);
    if (typeof input.phase !== "string" || PHASES.indexOf(input.phase) === -1) {
      throw new RangeError("Unsupported management phase");
    }
    const activeWave = nonnegativeInteger(input.activeWave, "Active wave");
    const clearedWaves = nonnegativeInteger(input.clearedWaves, "Cleared waves");
    const waveCount = config.waveStartGrants.length;
    if (clearedWaves > waveCount) throw new RangeError("Cleared waves exceed the configured wave count");
    if (input.phase === "planning" && (activeWave !== 0 || clearedWaves >= waveCount)) {
      throw new RangeError("Planning state must have no active wave and a remaining configured wave");
    }
    if (input.phase === "wave" &&
        (activeWave !== clearedWaves + 1 || activeWave > waveCount)) {
      throw new RangeError("Active wave must be the next uncleared configured wave");
    }
    if (input.phase === "complete" && (activeWave !== 0 || clearedWaves !== waveCount)) {
      throw new RangeError("Complete state must have every configured wave cleared");
    }
    if (input.tutorialUpgradeGateMode !== config.tutorialUpgradeGateMode) {
      throw new RangeError("Management state tutorial gate mode does not match config");
    }
    const tutorialUpgradeGateOpen = booleanValue(
      input.tutorialUpgradeGateOpen,
      "Tutorial Upgrade gate state"
    );
    if (config.tutorialUpgradeGateMode === "none" && !tutorialUpgradeGateOpen) {
      throw new RangeError("Tutorial Upgrade gate mode none must start and remain open");
    }
    if (!tutorialUpgradeGateOpen && clearedWaves >= 1) {
      throw new RangeError("Tutorial Upgrade gate must be open after Wave 1 clears");
    }

    if (!Array.isArray(input.towers)) throw new TypeError("Management state towers must be an array");
    ABI.canonicalEncode(input.towers);
    if (input.towers.length > config.padIds.length) throw new RangeError("Management state has more towers than pads");
    const seenIds = new Set();
    const seenPads = new Set();
    let previousTowerId = 0;
    const towers = freezeArray(input.towers.map(function (tower, index) {
      const normalized = normalizeTower(tower, index, config, seenIds, seenPads);
      if (normalized.id <= previousTowerId) {
        throw new RangeError("Management state towers must be ordered by increasing runtime ID");
      }
      previousTowerId = normalized.id;
      return normalized;
    }));

    const runtimeIds = Movement.allocateRuntimeId(input.runtimeIds, "tower", false).state;
    if (towers.length > 0 && runtimeIds.nextByDomain.tower <= towers[towers.length - 1].id) {
      throw new RangeError("Next tower runtime ID must be greater than every owned tower ID");
    }

    return freezeState({
      schemaVersion: schemaVersion,
      missionId: config.missionId,
      aether: aether,
      bountyRemainder: bounty.bountyRemainder,
      phase: input.phase,
      activeWave: activeWave,
      clearedWaves: clearedWaves,
      tutorialUpgradeGateMode: input.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: tutorialUpgradeGateOpen,
      towers: towers,
      runtimeIds: runtimeIds,
    });
  }

  function createManagementState(configInput) {
    const config = normalizeManagementConfig(configInput);
    return freezeState({
      schemaVersion: config.abiVersion === 2
        ? MANAGEMENT_SCHEMA_VERSION_V2 : MANAGEMENT_SCHEMA_VERSION,
      missionId: config.missionId,
      aether: config.resolvedStartAether,
      bountyRemainder: Economy.initialBountyRemainder(),
      phase: "planning",
      activeWave: 0,
      clearedWaves: 0,
      tutorialUpgradeGateMode: config.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: config.tutorialUpgradeGateMode === "none",
      towers: freezeArray([]),
      runtimeIds: Movement.createRuntimeIdState(),
    });
  }

  function freezeEvent(fields) {
    return Object.freeze(fields);
  }

  function deniedEvent(command, reason) {
    return freezeEvent({
      type: "denied",
      tick: command.tick,
      seq: command.seq,
      commandType: command.type,
      reason: reason,
    });
  }

  function transition(state, event) {
    return Object.freeze({ state: state, event: event });
  }

  function withState(state, changes) {
    return freezeState({
      schemaVersion: state.schemaVersion,
      missionId: state.missionId,
      aether: Object.prototype.hasOwnProperty.call(changes, "aether") ? changes.aether : state.aether,
      bountyRemainder: state.bountyRemainder,
      phase: Object.prototype.hasOwnProperty.call(changes, "phase") ? changes.phase : state.phase,
      activeWave: Object.prototype.hasOwnProperty.call(changes, "activeWave")
        ? changes.activeWave : state.activeWave,
      clearedWaves: Object.prototype.hasOwnProperty.call(changes, "clearedWaves")
        ? changes.clearedWaves : state.clearedWaves,
      tutorialUpgradeGateMode: state.tutorialUpgradeGateMode,
      tutorialUpgradeGateOpen: Object.prototype.hasOwnProperty.call(changes, "tutorialUpgradeGateOpen")
        ? changes.tutorialUpgradeGateOpen : state.tutorialUpgradeGateOpen,
      towers: Object.prototype.hasOwnProperty.call(changes, "towers") ? changes.towers : state.towers,
      runtimeIds: Object.prototype.hasOwnProperty.call(changes, "runtimeIds")
        ? changes.runtimeIds : state.runtimeIds,
    });
  }

  function applyBuild(state, config, command) {
    if (config.padIds.indexOf(command.padId) === -1) {
      return transition(state, deniedEvent(command, "unknown-pad"));
    }
    if (towerAtPad(state.towers, command.padId)) {
      return transition(state, deniedEvent(command, "pad-occupied"));
    }
    const defense = defenseById(config, command.defenseId);
    if (!defense) return transition(state, deniedEvent(command, "defense-not-equipped"));
    const costAether = resolvedCostAether(config, RELIC_COST_STATS.build, defense.costsAether[0]);
    if (state.aether < costAether) {
      return transition(state, deniedEvent(command, "insufficient-aether"));
    }

    const allocation = Movement.allocateRuntimeId(state.runtimeIds, "tower", true);
    const tower = freezeTower({
      id: allocation.runtimeId,
      padId: command.padId,
      defenseId: command.defenseId,
      level: 1,
      investedAether: costAether,
      targetPolicy: defense.defaultTargetPolicy,
      specializationId: null,
      paidCosts: [costAether],
      disableSources: [],
    }, config.abiVersion);
    const towers = freezeArray(state.towers.concat([tower]));
    const aether = ABI.checkedAdd(state.aether, -costAether);
    return transition(withState(state, {
      aether: aether,
      towers: towers,
      runtimeIds: allocation.state,
    }), freezeEvent({
      type: "build",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: tower.level,
      costAether: costAether,
      investedAether: tower.investedAether,
      aetherAfter: aether,
    }));
  }

  function applyUpgrade(state, config, command) {
    const tower = towerById(state.towers, command.towerId);
    if (!tower) return transition(state, deniedEvent(command, "unknown-tower"));
    if (!state.tutorialUpgradeGateOpen) {
      return transition(state, deniedEvent(command, ABI.DESCRIPTOR.tutorialUpgradeGate.denialReason));
    }
    const defense = defenseById(config, tower.defenseId);
    if (tower.level >= defense.costsAether.length) {
      /* Spec 7.1: under content schema v4 the Level 2 -> 3 step is a specialization purchase. */
      if (config.abiVersion === 2 && tower.level === defense.costsAether.length) {
        return transition(state, deniedEvent(command, "specialization-required"));
      }
      return transition(state, deniedEvent(command, "max-level"));
    }
    const costAether = resolvedCostAether(
      config,
      RELIC_COST_STATS.upgrade,
      defense.costsAether[tower.level]
    );
    if (state.aether < costAether) {
      return transition(state, deniedEvent(command, "insufficient-aether"));
    }
    const level = tower.level + 1;
    const investedAether = Economy.addInvestment(tower.investedAether, costAether);
    const upgraded = freezeTower({
      id: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: level,
      investedAether: investedAether,
      targetPolicy: tower.targetPolicy,
      specializationId: null,
      paidCosts: config.abiVersion === 2 ? tower.paidCosts.concat([costAether]) : [],
      disableSources: config.abiVersion === 2 ? tower.disableSources : [],
    }, config.abiVersion);
    const towers = freezeArray(state.towers.map(function (candidate) {
      return candidate.id === tower.id ? upgraded : candidate;
    }));
    const aether = ABI.checkedAdd(state.aether, -costAether);
    return transition(withState(state, { aether: aether, towers: towers }), freezeEvent({
      type: "upgrade",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: level,
      costAether: costAether,
      investedAether: investedAether,
      aetherAfter: aether,
    }));
  }

  function applySell(state, command) {
    const tower = towerById(state.towers, command.towerId);
    if (!tower) return transition(state, deniedEvent(command, "unknown-tower"));
    const refundAether = Economy.sellRefund(tower.investedAether);
    const aether = ABI.checkedAdd(state.aether, refundAether);
    const towers = freezeArray(state.towers.filter(function (candidate) {
      return candidate.id !== tower.id;
    }));
    return transition(withState(state, { aether: aether, towers: towers }), freezeEvent({
      type: "sell",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: tower.level,
      investedAether: tower.investedAether,
      refundAether: refundAether,
      aetherAfter: aether,
    }));
  }

  function applyStartWave(state, config, command) {
    if (state.phase === "wave") return transition(state, deniedEvent(command, "wave-active"));
    if (state.phase === "complete") return transition(state, deniedEvent(command, "campaign-complete"));
    const wave = state.clearedWaves + 1;
    const grantAether = config.waveStartGrants[wave - 1];
    const grant = Economy.creditFixedGrant(state.bountyRemainder, grantAether);
    const aether = ABI.checkedAdd(state.aether, grant.aetherAward);
    return transition(withState(state, {
      aether: aether,
      phase: "wave",
      activeWave: wave,
    }), freezeEvent({
      type: "waveStart",
      tick: command.tick,
      seq: command.seq,
      wave: wave,
      grantAether: grant.aetherAward,
      aetherAfter: aether,
    }));
  }

  function applySkipTutorialGate(state, command) {
    const opened = !state.tutorialUpgradeGateOpen;
    const nextState = opened
      ? withState(state, { tutorialUpgradeGateOpen: true })
      : state;
    return transition(nextState, freezeEvent({
      type: "tutorialGate",
      tick: command.tick,
      seq: command.seq,
      action: "skip",
      opened: opened,
    }));
  }

  function applySetTargetPolicy(state, config, command) {
    const tower = towerById(state.towers, command.towerId);
    if (!tower) return transition(state, deniedEvent(command, "unknown-tower"));
    const defense = defenseById(config, tower.defenseId);
    if (defense.allowedTargetPolicies.indexOf(command.policy) === -1) {
      return transition(state, deniedEvent(command, "target-policy-not-allowed"));
    }
    const changed = tower.targetPolicy !== command.policy;
    let nextState = state;
    if (changed) {
      const updated = freezeTower({
        id: tower.id,
        padId: tower.padId,
        defenseId: tower.defenseId,
        level: tower.level,
        investedAether: tower.investedAether,
        targetPolicy: command.policy,
        specializationId: config.abiVersion === 2 ? tower.specializationId : null,
        paidCosts: config.abiVersion === 2 ? tower.paidCosts : [],
        disableSources: config.abiVersion === 2 ? tower.disableSources : [],
      }, config.abiVersion);
      nextState = withState(state, {
        towers: freezeArray(state.towers.map(function (candidate) {
          return candidate.id === tower.id ? updated : candidate;
        })),
      });
    }
    return transition(nextState, freezeEvent({
      type: "targetPolicy",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      policy: command.policy,
      changed: changed,
    }));
  }

  const PROTOCOL_RUNTIME_FIELDS = Object.freeze([
    "effects", "equipped", "schedules", "sharedReadyTick", "wardCharges",
  ]);
  const EQUIPPED_PROTOCOL_FIELDS = Object.freeze([
    "acceptedCastCount", "loan", "protocolId", "readyTick", "tier",
  ]);

  function normalizeProtocolRuntime(input) {
    exactFields(input, PROTOCOL_RUNTIME_FIELDS, "Protocol runtime");
    if (!Array.isArray(input.equipped) || input.equipped.length > MAX_PROTOCOL_RUNTIME_RECORDS) {
      throw new RangeError("Protocol runtime records exceed the bounded collection");
    }
    const seen = new Set();
    const equipped = freezeArray(input.equipped.map(function (record, index) {
      exactFields(record, EQUIPPED_PROTOCOL_FIELDS, "Protocol runtime record " + index);
      const protocolId = lowercaseAuthoredId(record.protocolId, "Protocol runtime ID");
      if (seen.has(protocolId)) {
        throw new RangeError("Protocol runtime contains duplicate protocol " + protocolId);
      }
      seen.add(protocolId);
      return Object.freeze({
        acceptedCastCount: nonnegativeInteger(record.acceptedCastCount, "Accepted cast count"),
        loan: booleanValue(record.loan, "Protocol loan flag"),
        protocolId: protocolId,
        readyTick: nonnegativeInteger(record.readyTick, "Protocol ready tick"),
        tier: positiveInteger(record.tier, "Protocol tier"),
      });
    }));
    return Object.freeze({
      effects: freezeArray(input.effects.slice()),
      equipped: equipped,
      schedules: freezeArray(input.schedules.slice()),
      sharedReadyTick: nonnegativeInteger(input.sharedReadyTick, "Shared Protocol ready tick"),
      wardCharges: nonnegativeInteger(input.wardCharges, "Aegis Ward charges"),
    });
  }

  function protocolLedger(protocols) {
    const records = protocols.equipped.map(function (record) {
      return {
        acceptedCastCount: record.acceptedCastCount,
        protocolId: record.protocolId,
        readyTick: record.readyTick,
      };
    }).sort(function (left, right) {
      return left.protocolId < right.protocolId ? -1 : left.protocolId > right.protocolId ? 1 : 0;
    });
    return {
      sharedReadyTick: protocols.sharedReadyTick,
      protocols: records,
    };
  }

  function nextProtocolRuntime(protocols, plan) {
    return Object.freeze({
      effects: protocols.effects,
      equipped: freezeArray(protocols.equipped.map(function (record) {
        if (record.protocolId !== plan.protocolId) return record;
        return Object.freeze({
          acceptedCastCount: plan.ledgerUpdate.acceptedCastCount,
          loan: record.loan,
          protocolId: record.protocolId,
          readyTick: plan.ledgerUpdate.readyTick,
          tier: record.tier,
        });
      })),
      schedules: protocols.schedules,
      sharedReadyTick: plan.ledgerUpdate.sharedReadyTick,
      wardCharges: protocols.wardCharges,
    });
  }

  function protocolEffectKind(catalog, command) {
    for (let index = 0; index < catalog.protocols.length; index++) {
      const protocol = catalog.protocols[index];
      if (protocol.protocolId !== command.protocolId) continue;
      const tier = protocol.tiers[command.tier - 1];
      return tier && tier.tier === command.tier ? tier.effect.kind : null;
    }
    return null;
  }

  function protocolBaseCost(catalog, command) {
    for (let index = 0; index < catalog.protocols.length; index++) {
      const protocol = catalog.protocols[index];
      if (protocol.protocolId !== command.protocolId) continue;
      const tier = protocol.tiers[command.tier - 1];
      return tier && tier.tier === command.tier ? tier.baseCostAether : null;
    }
    return null;
  }

  function replaceTower(state, tower) {
    return freezeArray(state.towers.map(function (candidate) {
      return candidate.id === tower.id ? tower : candidate;
    }));
  }

  /* Spec 7.1 / plan 11.1: `specializeTower` replaces the Level 2 -> 3 upgrade under content v4. */
  function applySpecializeTower(state, config, command, runtime) {
    const tower = towerById(state.towers, command.towerRuntimeId);
    if (!tower) return transition(state, deniedEvent(command, "stale-tower"));
    if (!state.tutorialUpgradeGateOpen) {
      return transition(state, deniedEvent(command, ABI.DESCRIPTOR.tutorialUpgradeGate.denialReason));
    }
    if (tower.level !== SPECIALIZATION_LEVEL - 1) {
      return transition(state, deniedEvent(command, "wrong-level"));
    }
    const record = specializationById(config, command.specializationId);
    if (!record) return transition(state, deniedEvent(command, "unknown-specialization"));
    if (record.defenseId !== tower.defenseId) {
      return transition(state, deniedEvent(command, "foreign-specialization"));
    }
    if (config.specializationAccessIds.indexOf(record.id) === -1) {
      return transition(state, deniedEvent(command, "specialization-locked"));
    }
    const costAether = resolvedCostAether(
      config,
      RELIC_COST_STATS.specialization,
      record.costAether
    );
    if (state.aether < costAether) {
      return transition(state, deniedEvent(command, "insufficient-aether"));
    }
    const paidCosts = tower.paidCosts.concat([costAether]);
    const investedAether = Economy.addInvestment(tower.investedAether, costAether);
    const specialized = freezeTower({
      id: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: SPECIALIZATION_LEVEL,
      investedAether: investedAether,
      targetPolicy: tower.targetPolicy,
      specializationId: record.id,
      paidCosts: paidCosts,
      disableSources: tower.disableSources,
    }, 2);
    const aether = ABI.checkedAdd(state.aether, -costAether);
    return transition(withState(state, {
      aether: aether,
      towers: replaceTower(state, specialized),
    }), freezeEvent({
      type: "specialize",
      tick: command.tick,
      seq: command.seq,
      towerId: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: SPECIALIZATION_LEVEL,
      specializationId: record.id,
      costAether: costAether,
      investedAether: investedAether,
      aetherAfter: aether,
    }));
  }

  /* ADR-010: an accepted cast spends the same visible Aether as construction. Legality and
     cooldown arithmetic stay in protocols.js; this reducer owns only the payment/ledger write. */
  function applyActivatePower(state, config, command, runtime) {
    if (!runtime.protocolCatalog || !runtime.protocolLoadout) {
      return transition(state, deniedEvent(command, "not-available"));
    }
    const relicBp = relicCostMultiplierBp(config, RELIC_COST_STATS.protocol);
    const ledger = protocolLedger(runtime.protocols);
    const priorRecord = ledger.protocols.find(function (record) {
      return record.protocolId === command.protocolId;
    });
    const priorCasts = priorRecord ? priorRecord.acceptedCastCount : 0;
    const baseCostAether = protocolBaseCost(runtime.protocolCatalog, command);
    let contextAether = state.aether;
    let foldedCostAether = null;
    if (baseCostAether !== null) {
      /* R2: Titan Gear folds into ONE ceiling. protocols.js applies two, so the affordability
         boundary is translated here and an accepted cast always pays the folded cost. */
      foldedCostAether = Relics.resolveProtocolCastCostWithRelics(
        baseCostAether,
        priorCasts,
        relicBp
      );
      const planCostAether = Protocols.resolveProtocolCastCost(
        baseCostAether,
        priorCasts,
        relicBp,
        runtime.protocolCatalog.repeatCostStepBp
      ).resolvedCastCostAether;
      contextAether = Math.max(
        0,
        ABI.checkedAdd(state.aether, ABI.checkedAdd(planCostAether, -foldedCostAether))
      );
    }
    const plan = Protocols.planProtocolActivation({
      catalog: runtime.protocolCatalog,
      loadout: runtime.protocolLoadout,
      ledger: ledger,
      context: {
        currentTick: command.tick,
        phase: state.phase,
        aether: contextAether,
        protocolCostMultiplierBp: relicBp,
        boardBounds: runtime.boardBounds,
        routes: runtime.routes,
        targetSelection: runtime.selectProtocolTargets(command),
      },
      command: command,
    });
    if (!plan.accepted) {
      return transition(state, deniedEvent(command, plan.denialReason));
    }
    /* Never report an accepted cast the runtime cannot resolve. This check follows the closed
       Protocol denial order so a locked, mistargeted, or unaffordable cast still reports its
       own reason first; an authored effect kind whose runtime lands in a later batch is the
       last reason left, and it denies before any Aether moves. */
    const tierEffectKind = protocolEffectKind(runtime.protocolCatalog, command);
    if (tierEffectKind === null ||
        runtime.supportedEffectKinds.indexOf(tierEffectKind) === -1) {
      return transition(state, deniedEvent(command, "effect-not-implemented"));
    }
    const costAether = foldedCostAether;
    const aether = ABI.checkedAdd(state.aether, -costAether);
    runtime.protocols = nextProtocolRuntime(runtime.protocols, plan);
    runtime.protocolActivations.push(Object.freeze({
      costAether: costAether,
      protocolId: plan.protocolId,
      seq: command.seq,
      source: plan.source,
      target: plan.target,
      tick: command.tick,
      tier: plan.tier,
    }));
    return transition(withState(state, { aether: aether }), freezeEvent({
      type: "activatePower",
      tick: command.tick,
      seq: command.seq,
      protocolId: plan.protocolId,
      tier: plan.tier,
      source: plan.source,
      costAether: costAether,
      aetherAfter: aether,
    }));
  }

  /* K6 owns reinforcement/mechanism payment and lifecycle. Until then these deny honestly
     instead of reporting a success the simulation cannot deliver. */
  function applyDeployReinforcement(state, config, command, runtime) {
    return transition(state, deniedEvent(command, "not-available"));
  }

  function applyActivateMechanism(state, config, command, runtime) {
    return transition(state, deniedEvent(command, "not-available"));
  }

  /* Spec 12.2: Reset Plan is a planning-only undo of this bucket's construction at full cost. */
  function applyResetPlan(state, config, command, runtime) {
    if (state.phase !== "planning") {
      return transition(state, deniedEvent(command, "wrong-phase"));
    }
    const baselineTowerId = runtime.planningBaselineTowerId;
    const reverted = state.towers.filter(function (tower) { return tower.id >= baselineTowerId; });
    let refundAether = 0;
    reverted.forEach(function (tower) {
      refundAether = ABI.checkedAdd(refundAether, Economy.cumulativeInvestment(tower.paidCosts));
    });
    const aether = ABI.checkedAdd(state.aether, refundAether);
    const towers = freezeArray(state.towers.filter(function (tower) {
      return tower.id < baselineTowerId;
    }));
    return transition(withState(state, { aether: aether, towers: towers }), freezeEvent({
      type: "resetPlan",
      tick: command.tick,
      seq: command.seq,
      removedTowerCount: reverted.length,
      refundAether: refundAether,
      aetherAfter: aether,
    }));
  }

  function applyNormalizedCommand(state, config, command, runtime) {
    if (state.phase === "complete") {
      return transition(state, deniedEvent(command, "campaign-complete"));
    }
    if (command.type === "build") return applyBuild(state, config, command);
    if (command.type === "upgrade") return applyUpgrade(state, config, command);
    if (command.type === "sell") return applySell(state, command);
    if (command.type === "startWave") return applyStartWave(state, config, command);
    if (command.type === "skipTutorialGate") return applySkipTutorialGate(state, command);
    if (command.type === "setTargetPolicy") return applySetTargetPolicy(state, config, command);
    if (V2_ONLY_COMMAND_TYPES.indexOf(command.type) !== -1) {
      if (config.abiVersion !== 2 || !runtime) {
        return transition(state, deniedEvent(command, "unsupported-under-abi"));
      }
      if (command.type === "specializeTower") {
        return applySpecializeTower(state, config, command, runtime);
      }
      if (command.type === "activatePower") return applyActivatePower(state, config, command, runtime);
      if (command.type === "deployReinforcement") {
        return applyDeployReinforcement(state, config, command, runtime);
      }
      if (command.type === "activateMechanism") {
        return applyActivateMechanism(state, config, command, runtime);
      }
      return applyResetPlan(state, config, command, runtime);
    }
    /* ADR-014: an unknown command type is a stable denial event, never a throw. */
    return transition(state, deniedEvent(command, "unknown-command"));
  }

  function applyCommandBucket(stateInput, configInput, currentTickInput, commandInputs, limitOverrides) {
    const config = normalizeManagementConfig(configInput);
    let state = normalizeManagementState(stateInput, config);
    const limits = Commands.createCommandLimits(limitOverrides);
    const currentTick = nonnegativeInteger(currentTickInput, "Management command-bucket tick");
    if (currentTick > limits.maxTick) {
      throw new RangeError("Management command-bucket tick exceeds the maximum tick");
    }
    const commands = Commands.normalizeCommandSequence(commandInputs, limits);
    commands.forEach(function (command) {
      if (command.tick !== currentTick) {
        throw new RangeError("Every command in a management bucket must match its current tick");
      }
    });
    const events = [];
    commands.forEach(function (command) {
      const result = applyNormalizedCommand(state, config, command, null);
      state = result.state;
      events.push(result.event);
    });
    return Object.freeze({ state: state, events: freezeArray(events) });
  }

  const RUNTIME_FIELDS_V2 = Object.freeze([
    "boardBounds", "mechanism", "protocolCatalog", "protocolLoadout", "protocols", "reinforcement",
    "routes", "selectProtocolTargets", "supportedEffectKinds",
  ]);

  function normalizeCommandRuntime(input) {
    exactFields(
      Object.keys(input || {}).reduce(function (shape, key) {
        shape[key] = key === "selectProtocolTargets" ? null : input[key];
        return shape;
      }, {}),
      RUNTIME_FIELDS_V2,
      "Management command runtime"
    );
    if (typeof input.selectProtocolTargets !== "function") {
      throw new TypeError("Management command runtime requires a target-selection resolver");
    }
    return {
      boardBounds: input.boardBounds,
      mechanism: input.mechanism,
      planningBaselineTowerId: 0,
      protocolActivations: [],
      protocolCatalog: input.protocolCatalog,
      protocolLoadout: input.protocolLoadout,
      protocols: normalizeProtocolRuntime(input.protocols),
      reinforcement: input.reinforcement,
      routes: input.routes,
      selectProtocolTargets: input.selectProtocolTargets,
      supportedEffectKinds: input.supportedEffectKinds,
    };
  }

  /* ABI v2 bucket seam. Command syntax comes from commands-v2; legality, Aether, and the
     Protocol ledger stay reducer-owned exactly as they are under ABI v1. */
  function applyCommandBucketV2(stateInput, configInput, currentTickInput, commandInputs,
    runtimeInput, limitOverrides) {
    const config = normalizeManagementConfig(configInput);
    let state = normalizeManagementState(stateInput, config);
    const limits = CommandsV2.createCommandLimits(limitOverrides);
    const currentTick = nonnegativeInteger(currentTickInput, "Management command-bucket tick");
    if (currentTick > limits.maxTick) {
      throw new RangeError("Management command-bucket tick exceeds the maximum tick");
    }
    const commands = CommandsV2.normalizeCommandSequence(commandInputs, limits);
    commands.forEach(function (command) {
      if (command.tick !== currentTick) {
        throw new RangeError("Every command in a management bucket must match its current tick");
      }
    });
    const runtime = normalizeCommandRuntime(runtimeInput);
    runtime.planningBaselineTowerId = state.runtimeIds.nextByDomain.tower;
    const events = [];
    commands.forEach(function (command) {
      const result = applyNormalizedCommand(state, config, command, runtime);
      state = result.state;
      events.push(result.event);
    });
    return Object.freeze({
      state: state,
      events: freezeArray(events),
      protocols: runtime.protocols,
      protocolActivations: freezeArray(runtime.protocolActivations.slice()),
    });
  }

  /* ADR-014 disable primitives. A tower attacks only while `disableSources` is empty; an
     in-progress cooldown is never rescaled because the runtime is frozen, not retimed. */
  function withTowerDisableSources(state, config, towerRuntimeId, sources) {
    const tower = towerById(state.towers, towerRuntimeId);
    if (!tower) throw new RangeError("Unknown tower runtime ID " + towerRuntimeId);
    if (sources.length > MAX_DISABLE_SOURCES) {
      throw new RangeError("Tower disable sources exceed the bounded collection");
    }
    const updated = freezeTower({
      id: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: tower.level,
      investedAether: tower.investedAether,
      targetPolicy: tower.targetPolicy,
      specializationId: tower.specializationId,
      paidCosts: tower.paidCosts,
      disableSources: sources,
    }, 2);
    return normalizeManagementState(withState(state, { towers: replaceTower(state, updated) }), config);
  }

  function addDisableSource(stateInput, configInput, towerRuntimeId, sourceIdInput, expiryTickInput) {
    const config = normalizeManagementConfig(configInput);
    if (config.abiVersion !== 2) throw new RangeError("Disable sources require ABI v2");
    const state = normalizeManagementState(stateInput, config);
    const sourceId = lowercaseAuthoredId(sourceIdInput, "Disable source ID");
    const expiryTick = nonnegativeInteger(expiryTickInput, "Disable source expiry tick");
    const tower = towerById(state.towers, positiveInteger(towerRuntimeId, "Tower runtime ID"));
    if (!tower) throw new RangeError("Unknown tower runtime ID " + towerRuntimeId);
    const sources = tower.disableSources.filter(function (source) {
      return source.sourceId !== sourceId;
    }).concat([{ expiryTick: expiryTick, sourceId: sourceId }]);
    sources.sort(function (left, right) {
      return left.sourceId < right.sourceId ? -1 : left.sourceId > right.sourceId ? 1 : 0;
    });
    return withTowerDisableSources(state, config, tower.id, sources);
  }

  function removeDisableSource(stateInput, configInput, towerRuntimeId, sourceIdInput) {
    const config = normalizeManagementConfig(configInput);
    if (config.abiVersion !== 2) throw new RangeError("Disable sources require ABI v2");
    const state = normalizeManagementState(stateInput, config);
    const sourceId = lowercaseAuthoredId(sourceIdInput, "Disable source ID");
    const tower = towerById(state.towers, positiveInteger(towerRuntimeId, "Tower runtime ID"));
    if (!tower) throw new RangeError("Unknown tower runtime ID " + towerRuntimeId);
    return withTowerDisableSources(state, config, tower.id, tower.disableSources.filter(
      function (source) { return source.sourceId !== sourceId; }
    ));
  }

  /* Phase 2 (expiry-and-enable-transitions): a tower re-enables when its last source expires. */
  function expireDisableSources(stateInput, configInput, currentTickInput) {
    const config = normalizeManagementConfig(configInput);
    const state = normalizeManagementState(stateInput, config);
    if (config.abiVersion !== 2) {
      return Object.freeze({ state: state, enabledTowerRuntimeIds: freezeArray([]) });
    }
    const currentTick = nonnegativeInteger(currentTickInput, "Disable expiry tick");
    const enabled = [];
    const towers = freezeArray(state.towers.map(function (tower) {
      if (tower.disableSources.length === 0) return tower;
      const remaining = tower.disableSources.filter(function (source) {
        return source.expiryTick > currentTick;
      });
      if (remaining.length === tower.disableSources.length) return tower;
      if (remaining.length === 0) enabled.push(tower.id);
      return freezeTower({
        id: tower.id,
        padId: tower.padId,
        defenseId: tower.defenseId,
        level: tower.level,
        investedAether: tower.investedAether,
        targetPolicy: tower.targetPolicy,
        specializationId: tower.specializationId,
        paidCosts: tower.paidCosts,
        disableSources: remaining,
      }, 2);
    }));
    return Object.freeze({
      state: normalizeManagementState(withState(state, { towers: towers }), config),
      enabledTowerRuntimeIds: freezeArray(enabled.sort(function (left, right) {
        return left - right;
      })),
    });
  }

  function completeActiveWave(stateInput, configInput, tickInput) {
    const config = normalizeManagementConfig(configInput);
    const state = normalizeManagementState(stateInput, config);
    const tick = nonnegativeInteger(tickInput, "Wave-clear tick");
    if (state.phase !== "wave") throw new RangeError("No active wave is available to complete");
    const wave = state.activeWave;
    const campaignComplete = wave === config.waveStartGrants.length;
    const tutorialUpgradeGateOpened = wave === 1 && !state.tutorialUpgradeGateOpen;
    const nextState = withState(state, {
      phase: campaignComplete ? "complete" : "planning",
      activeWave: 0,
      clearedWaves: wave,
      tutorialUpgradeGateOpen: state.tutorialUpgradeGateOpen || wave === 1,
    });
    return transition(nextState, freezeEvent({
      type: "waveClear",
      tick: tick,
      wave: wave,
      tutorialUpgradeGateOpened: tutorialUpgradeGateOpened,
      campaignComplete: campaignComplete,
    }));
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    MANAGEMENT_SCHEMA_VERSION: MANAGEMENT_SCHEMA_VERSION,
    PHASES: PHASES,
    TUTORIAL_GATE_MODES: TUTORIAL_GATE_MODES,
    MANAGEMENT_SCHEMA_VERSION_V2: MANAGEMENT_SCHEMA_VERSION_V2,
    MAX_DISABLE_SOURCES: MAX_DISABLE_SOURCES,
    MAX_TOWER_PAID_COSTS: MAX_TOWER_PAID_COSTS,
    MAX_PROTOCOL_RUNTIME_RECORDS: MAX_PROTOCOL_RUNTIME_RECORDS,
    V2_ONLY_COMMAND_TYPES: V2_ONLY_COMMAND_TYPES,
    normalizeManagementConfig: normalizeManagementConfig,
    normalizeManagementState: normalizeManagementState,
    createManagementState: createManagementState,
    applyCommandBucket: applyCommandBucket,
    applyCommandBucketV2: applyCommandBucketV2,
    addDisableSource: addDisableSource,
    removeDisableSource: removeDisableSource,
    expireDisableSources: expireDisableSources,
    completeActiveWave: completeActiveWave,
  });
});
