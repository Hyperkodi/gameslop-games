/* Armara Aegis battle session.
   Owns one authoritative run: the immutable start header, the command bucket,
   deterministic stepping, and the canonical facts a result screen may report.
   The shell owns navigation; this module never touches the DOM. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  const game = root.Game = root.Game || {};
  if (!game || (typeof game !== "object" && typeof game !== "function")) {
    throw new Error("Cannot install the Aegis battle session into a non-object Game namespace");
  }
  if (Object.prototype.hasOwnProperty.call(game, "AegisBattleSession")) {
    if (game.AegisBattleSession !== api) throw new Error("Conflicting Game.AegisBattleSession is already installed");
    return;
  }
  Object.defineProperty(game, "AegisBattleSession", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_LOADOUT = 4;
  const STARTER_DEFENSE_IDS = Object.freeze(["chronos", "sentinel", "siege"]);
  const PROTOCOL_ACCEPTED = /^protocol\.([a-z0-9-]+)\.accepted$/;
  const MECHANISM_ACCEPTED = /^mechanism\.([a-z0-9-]+)\.(?:accepted|activated)$/;
  const REINFORCEMENT_ACCEPTED = /^reinforcement\.([a-z0-9-]+)\.(?:accepted|deployed)$/;

  function own(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function assertRuntime(runtime) {
    if (!runtime || !runtime.binding || !runtime.content || !runtime.release || !runtime.descriptor ||
        !runtime.kernel || !runtime.commands ||
        typeof runtime.kernel.createInitialState !== "function" ||
        typeof runtime.kernel.advanceTick !== "function" ||
        typeof runtime.commands.normalizeCommand !== "function") {
      throw new TypeError("A battle session requires an authenticated Aegis runtime");
    }
    return runtime;
  }

  function missionIdsFor(runtime) {
    if (Array.isArray(runtime.contentIds) && runtime.contentIds.length) return runtime.contentIds;
    return runtime.descriptor.contentIds;
  }

  /* ABI v1 start header for the historical proving-ground path. ABI v2 runs use
     run-header-v2.js instead; both are built exactly once, before the run. */
  function createHeader(runtimeInput, options) {
    const runtime = assertRuntime(runtimeInput);
    options = options || {};
    const missionIds = missionIdsFor(runtime);
    const missionId = options.missionId || missionIds[0];
    const mission = runtime.content.missions[missionId];
    if (!mission || missionIds.indexOf(missionId) === -1) {
      throw new RangeError("Mission is not available in the selected preview release");
    }
    const difficulties = runtime.content.campaignRules.difficultyPresets.map(function (record) {
      return record.id;
    });
    const difficultyId = options.difficultyId || "strategos";
    if (difficulties.indexOf(difficultyId) === -1) throw new RangeError("Unknown preview difficulty");
    const seed = options.seed === undefined ? 1 : Number(options.seed);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError("Preview seed must be an unsigned 32-bit integer");
    }
    const defaultLoadoutIds = mission.id === "m01"
      ? STARTER_DEFENSE_IDS.filter(function (id) { return mission.availableDefenseIds.includes(id); })
      : mission.availableDefenseIds.slice(0, MAX_LOADOUT);
    const loadoutIds = (options.loadoutIds || defaultLoadoutIds).slice();
    if (!loadoutIds.length || loadoutIds.length > MAX_LOADOUT ||
        new Set(loadoutIds).size !== loadoutIds.length || loadoutIds.some(function (id) {
          return mission.availableDefenseIds.indexOf(id) === -1 || !runtime.content.defenses[id];
        })) {
      throw new RangeError("Preview loadout must contain one to four unique mission defenses");
    }
    const grantByDefense = Object.create(null);
    runtime.content.defenseUnlockGrantMappings.forEach(function (record) {
      grantByDefense[record.defenseId] = record.accessGrantId;
    });
    const accessGrantIds = loadoutIds.map(function (id) {
      if (!grantByDefense[id]) throw new RangeError("Preview defense lacks an access-grant mapping: " + id);
      return grantByDefense[id];
    });
    const tutorialUpgradeGateMode = mission.tutorial && mission.tutorial.upgradeGateMode
      ? mission.tutorial.upgradeGateMode : "none";
    return deepFreeze({
      formatVersion: 1,
      rulesetHash: runtime.binding.rulesetHash,
      eventSchemaVersion: runtime.release.eventSchemaVersion,
      missionId: missionId,
      difficultyId: difficultyId,
      assist: options.assist === true,
      seed: seed,
      loadoutIds: loadoutIds,
      loadoutSlotCap: MAX_LOADOUT,
      campaignModifierIds: [],
      accessGrantIds: accessGrantIds,
      tutorialUpgradeGateMode: tutorialUpgradeGateMode,
    });
  }

  function createSession(runtimeInput, headerInput) {
    const runtime = assertRuntime(runtimeInput);
    const header = headerInput || createHeader(runtime);
    let state = runtime.kernel.createInitialState(runtime.binding, header);
    let planningBaseState = state;
    let planningCommands = [];
    let pendingCommands = [];
    let inputs = [];
    let events = [];
    let paused = false;

    function canonicalCommand(fields, tick, seq) {
      const command = Object.assign({ tick: tick, seq: seq }, fields);
      return runtime.commands.normalizeCommand(command);
    }

    function command(fields) {
      if (state.outcome !== "active") throw new RangeError("Terminal preview state cannot accept commands");
      if (!fields || typeof fields !== "object" || Array.isArray(fields) ||
          own(fields, "tick") || own(fields, "seq")) {
        throw new TypeError("Preview command fields must omit host-owned tick and sequence");
      }
      if (state.management.phase === "planning") {
        if (!planningBaseState) planningBaseState = state;
        const normalized = canonicalCommand(fields, state.tick, planningCommands.length);
        const candidateCommands = planningCommands.concat([normalized]);
        const result = runtime.kernel.advanceTick(runtime.binding, planningBaseState, candidateCommands);
        planningCommands = candidateCommands;
        inputs.push(normalized);
        state = result.state;
        events = events.concat(result.events);
        if (state.management.phase !== "planning") {
          planningBaseState = null;
          planningCommands = [];
        }
        return state;
      }
      const normalized = canonicalCommand(fields, state.tick, pendingCommands.length);
      pendingCommands.push(normalized);
      inputs.push(normalized);
      return state;
    }

    function step() {
      if (paused || state.outcome !== "active" || state.management.phase === "planning") {
        return Object.freeze({ advanced: false, events: Object.freeze([]), state: state });
      }
      const bucket = pendingCommands;
      pendingCommands = [];
      const result = runtime.kernel.advanceTick(runtime.binding, state, bucket);
      state = result.state;
      events = events.concat(result.events);
      if (state.management.phase === "planning") {
        planningBaseState = state;
        planningCommands = [];
      }
      return Object.freeze({ advanced: true, events: result.events, state: state });
    }

    function pause() {
      paused = true;
      return paused;
    }

    function resume() {
      paused = false;
      return paused;
    }

    return Object.freeze({
      command: command,
      step: step,
      pause: pause,
      resume: resume,
      get header() { return header; },
      get state() { return state; },
      get paused() { return paused; },
      get pendingCommandCount() { return pendingCommands.length; },
      get inputs() { return Object.freeze(inputs.slice()); },
      get events() { return Object.freeze(events.slice()); },
    });
  }

  /* ------------------------------------------------------------- run facts */

  function eventId(event) {
    if (!event || typeof event !== "object") return "";
    if (typeof event.eventId === "string") return event.eventId;
    if (typeof event.type === "string") return event.type;
    return "";
  }

  /* Canonical facts only. Presentation never adds a badge the run did not earn,
     and reading these facts never changes them. */
  function deriveRunFacts(callerInput) {
    const input = callerInput || {};
    const header = input.header || {};
    const events = Array.isArray(input.events) ? input.events : [];
    const state = input.state || null;
    const tierByProtocol = new Map();
    (header.protocolLoadout || []).forEach(function (entry) {
      tierByProtocol.set(entry.protocolId, entry.tier);
    });
    if (header.missionProtocolLoan) {
      tierByProtocol.set(header.missionProtocolLoan.protocolId, header.missionProtocolLoan.tier);
    }
    const castCounts = new Map();
    let reinforcementDeployments = 0;
    let mechanismActivations = 0;
    let mechanismId = null;
    events.forEach(function (event) {
      const id = eventId(event);
      const protocolMatch = PROTOCOL_ACCEPTED.exec(id);
      if (protocolMatch) {
        castCounts.set(protocolMatch[1], (castCounts.get(protocolMatch[1]) || 0) + 1);
        return;
      }
      if (REINFORCEMENT_ACCEPTED.test(id)) {
        reinforcementDeployments += 1;
        return;
      }
      const mechanismMatch = MECHANISM_ACCEPTED.exec(id);
      if (mechanismMatch) {
        mechanismActivations += 1;
        if (mechanismId === null) mechanismId = mechanismMatch[1];
      }
    });
    const towers = state && state.management && Array.isArray(state.management.towers)
      ? state.management.towers : [];
    const highestLevel = new Map();
    const branchesByDefense = new Map();
    const specializationIds = new Set();
    towers.forEach(function (tower) {
      const current = highestLevel.get(tower.defenseId) || 0;
      if (tower.level > current) highestLevel.set(tower.defenseId, tower.level);
      if (!branchesByDefense.has(tower.defenseId)) branchesByDefense.set(tower.defenseId, new Set());
      if (tower.specializationId) {
        specializationIds.add(tower.specializationId);
        branchesByDefense.get(tower.defenseId).add(tower.specializationId);
      }
    });
    return deepFreeze({
      protocolCasts: Array.from(castCounts.keys()).sort().map(function (protocolId) {
        return {
          protocolId: protocolId,
          tier: tierByProtocol.has(protocolId) ? tierByProtocol.get(protocolId) : 1,
          casts: castCounts.get(protocolId),
        };
      }),
      relicIds: (header.relicIds || []).slice(),
      specializationIds: Array.from(specializationIds).sort(),
      reinforcementId: reinforcementDeployments > 0 ? (header.reinforcementId || null) : null,
      reinforcementDeployments: reinforcementDeployments,
      mechanismId: mechanismId,
      mechanismActivations: mechanismActivations,
      defenseEvidence: Array.from(highestLevel.keys()).sort().map(function (defenseId) {
        return {
          defenseId: defenseId,
          highestLevel: highestLevel.get(defenseId),
          specializationIds: Array.from(branchesByDefense.get(defenseId) || []).sort(),
        };
      }),
    });
  }

  function createRunResult(callerInput) {
    const input = callerInput || {};
    const runtime = assertRuntime(input.runtime);
    const header = input.header;
    const state = input.state;
    if (!header || !state) throw new TypeError("A run result requires the start header and terminal state");
    if (state.outcome !== "victory" && state.outcome !== "defeat") {
      throw new RangeError("A run result requires a terminal outcome");
    }
    const mission = runtime.content.missions[state.missionId];
    const difficulty = runtime.content.campaignRules.difficultyPresets.find(function (record) {
      return record.id === state.difficultyId;
    });
    const totalWaves = mission ? mission.waves.length : 0;
    const cleared = state.outcome === "victory"
      ? totalWaves
      : Math.max(0, Math.min(totalWaves, state.management.clearedWaves || 0));
    const completedObjectiveIds = (state.objectiveResults || []).filter(function (objective) {
      return objective.complete === true;
    }).map(function (objective) { return objective.id; }).sort();
    return deepFreeze({
      outcome: state.outcome,
      missionId: state.missionId,
      difficultyId: state.difficultyId,
      assist: header.assist === true,
      seed: header.seed,
      score: state.score,
      gateHealth: state.integrity,
      maximumGateHealth: difficulty ? difficulty.integrity : null,
      durationTicks: state.tick,
      waves: { cleared: cleared, total: totalWaves },
      completedObjectiveIds: completedObjectiveIds,
      facts: deriveRunFacts({ header: header, events: input.events, state: state }),
      newLaurelIds: [],
      grantIdsApplied: [],
      masteryChanges: [],
      persistence: { kind: "session", durable: false, message: null },
    });
  }

  return deepFreeze({
    MAX_LOADOUT: MAX_LOADOUT,
    STARTER_DEFENSE_IDS: STARTER_DEFENSE_IDS,
    assertRuntime: assertRuntime,
    createHeader: createHeader,
    createSession: createSession,
    createRunResult: createRunResult,
    deriveRunFacts: deriveRunFacts,
  });
});
