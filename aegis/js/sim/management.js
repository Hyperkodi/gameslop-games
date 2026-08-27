/* Armara Aegis deterministic management reducer v1.
   Pure build/upgrade/sell/wave/gate/policy state; combat behavior belongs to later reducers. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./abi.js"),
      require("./economy.js"),
      require("./movement.js"),
      require("./commands.js")
    );
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before management.js");
  if (!game.AegisEconomy) throw new Error("Game.AegisEconomy must be installed before management.js");
  if (!game.AegisMovement) throw new Error("Game.AegisMovement must be installed before management.js");
  if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before management.js");
  const api = factory(game.AegisSim, game.AegisEconomy, game.AegisMovement, game.AegisCommands);
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
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI, Economy, Movement, Commands) {
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

  function normalizeDefense(value, index) {
    exactFields(value, DEFENSE_FIELDS, "Defense " + index);
    const id = lowercaseAuthoredId(value.id, "Defense " + index + " ID");
    if (!Array.isArray(value.costsAether) || value.costsAether.length !== 3) {
      throw new RangeError("Defense " + id + " must contain exactly three level costs");
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

  function normalizeManagementConfig(input) {
    exactFields(input, CONFIG_FIELDS, "Management config");
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
      const normalized = normalizeDefense(defense, index);
      if (defenseSet.has(normalized.id)) {
        throw new RangeError("Management config contains duplicate defense ID " + normalized.id);
      }
      defenseSet.add(normalized.id);
      return normalized;
    }));

    return Object.freeze({
      missionId: missionId,
      resolvedStartAether: resolvedStartAether,
      tutorialUpgradeGateMode: input.tutorialUpgradeGateMode,
      padIds: padIds,
      waveStartGrants: waveStartGrants,
      defenses: defenses,
    });
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

  function freezeTower(tower) {
    return Object.freeze({
      id: tower.id,
      padId: tower.padId,
      defenseId: tower.defenseId,
      level: tower.level,
      investedAether: tower.investedAether,
      targetPolicy: tower.targetPolicy,
    });
  }

  function freezeState(values) {
    return Object.freeze({
      schemaVersion: MANAGEMENT_SCHEMA_VERSION,
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

  function normalizeTower(value, index, config, seenIds, seenPads) {
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
    exactFields(input, STATE_FIELDS, "Management state");
    if (input.schemaVersion !== MANAGEMENT_SCHEMA_VERSION) {
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
    const costAether = defense.costsAether[0];
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
    });
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
      return transition(state, deniedEvent(command, "max-level"));
    }
    const costAether = defense.costsAether[tower.level];
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
    });
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
      });
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

  function applyNormalizedCommand(state, config, command) {
    if (state.phase === "complete") {
      return transition(state, deniedEvent(command, "campaign-complete"));
    }
    if (command.type === "build") return applyBuild(state, config, command);
    if (command.type === "upgrade") return applyUpgrade(state, config, command);
    if (command.type === "sell") return applySell(state, command);
    if (command.type === "startWave") return applyStartWave(state, config, command);
    if (command.type === "skipTutorialGate") return applySkipTutorialGate(state, command);
    if (command.type === "setTargetPolicy") return applySetTargetPolicy(state, config, command);
    throw new Error("Normalized command type is not implemented");
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
      const result = applyNormalizedCommand(state, config, command);
      state = result.state;
      events.push(result.event);
    });
    return Object.freeze({ state: state, events: freezeArray(events) });
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
    normalizeManagementConfig: normalizeManagementConfig,
    normalizeManagementState: normalizeManagementState,
    createManagementState: createManagementState,
    applyCommandBucket: applyCommandBucket,
    completeActiveWave: completeActiveWave,
  });
});
