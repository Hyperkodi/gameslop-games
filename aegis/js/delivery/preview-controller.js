/* Armara Aegis Candidate-BAL developer-preview controller.
   The host sends commands and renders immutable state/events. Combat, economy,
   legality, objectives, and outcomes remain owned by the authenticated kernel. */
(function (root, factory) {
  "use strict";

  const commonJs = typeof module === "object" && module.exports;
  const installedGame = root && root.Game;
  const api = factory(
    root,
    commonJs ? require("../presentation/camera.js") : installedGame && installedGame.AegisCamera,
    commonJs ? require("../presentation/road-geometry.js") : installedGame && installedGame.AegisRoadGeometry,
    commonJs ? require("../presentation/m01-art.js") : installedGame && installedGame.AegisM01Art,
    commonJs ? require("../presentation/act-i-art.js") : installedGame && installedGame.AegisActIArt,
    commonJs ? require("../presentation/sprite-atlas.js") : installedGame && installedGame.AegisSpriteAtlas,
    commonJs ? require("../presentation/share-card.js") : installedGame && installedGame.AegisShareCard
  );
  if (commonJs) {
    module.exports = api;
    return;
  }
  const game = root.Game = root.Game || {};
  if (!game || (typeof game !== "object" && typeof game !== "function")) {
    throw new Error("Cannot install the Aegis preview controller into a non-object Game namespace");
  }
  if (Object.prototype.hasOwnProperty.call(game, "AegisPreviewController")) {
    throw new Error("Conflicting Game.AegisPreviewController is already installed");
  }
  Object.defineProperty(game, "AegisPreviewController", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (
  root,
  Camera,
  RoadGeometry,
  M01Art,
  ActIArt,
  SpriteAtlas,
  ShareCard
) {
  "use strict";

  if (!Camera || !RoadGeometry || !M01Art || !ActIArt || !SpriteAtlas || !ShareCard) {
    throw new Error("Aegis preview requires camera, road, Act I art, sprite-atlas, and share-card presentation modules");
  }

  const MAX_LOADOUT = 4;
  const VISUAL_FPS = 30;
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const STARTER_DEFENSE_IDS = Object.freeze(["chronos", "sentinel", "siege"]);
  const TARGET_POLICY_LABELS = Object.freeze({
    FRONT: "Closest to the gate",
    STRONG: "Highest health",
    FAST: "Fastest",
  });
  const TOWER_ATLASES = Object.freeze({
    hoplite: Object.freeze({
      href: "art/v2/shared/towers/hoplite-anim-v1.webp",
      metadata: SpriteAtlas.createTowerAtlasMetadata("shared.tower.hoplite.v1"),
    }),
    oracle: Object.freeze({
      href: "art/v2/shared/towers/oracle-anim-v1.webp",
      metadata: SpriteAtlas.createTowerAtlasMetadata("shared.tower.oracle.v1"),
    }),
    chronos: Object.freeze({
      href: "art/v2/m01/towers/chronos-anim-v1.webp",
      metadata: SpriteAtlas.createTowerAtlasMetadata("m01.tower.chronos.v1"),
    }),
    sentinel: Object.freeze({
      href: "art/v2/m01/towers/sentinel-anim-v1.webp",
      metadata: SpriteAtlas.createTowerAtlasMetadata("m01.tower.sentinel.v1"),
    }),
    siege: Object.freeze({
      href: "art/v2/m01/towers/siege-anim-v1.webp",
      metadata: SpriteAtlas.createTowerAtlasMetadata("m01.tower.siege.v1"),
    }),
  });
  const ENEMY_ATLASES = Object.freeze({
    echo: Object.freeze({
      href: "art/v2/shared/enemies/echo-anim-v1.webp",
      metadata: SpriteAtlas.createEnemyAtlasMetadata("shared.enemy.echo.v1"),
    }),
    guardian: Object.freeze({
      href: "art/v2/shared/enemies/guardian-anim-v1.webp",
      metadata: SpriteAtlas.createEnemyAtlasMetadata("shared.enemy.guardian.v1"),
    }),
    titan: Object.freeze({
      href: "art/v2/shared/enemies/titan-anim-v1.webp",
      metadata: SpriteAtlas.createEnemyAtlasMetadata("shared.enemy.titan.v1"),
    }),
    "talos-prototype": Object.freeze({
      href: "art/v2/shared/enemies/talos-anim-v1.webp",
      metadata: SpriteAtlas.createEnemyAtlasMetadata("shared.enemy.talos-prototype.v1"),
    }),
    raider: Object.freeze({
      href: "art/v2/m01/enemies/raider-anim-v1.webp",
      metadata: SpriteAtlas.createEnemyAtlasMetadata("m01.enemy.raider.v1"),
    }),
    scout: Object.freeze({
      href: "art/v2/m01/enemies/scout-anim-v1.webp",
      metadata: SpriteAtlas.createEnemyAtlasMetadata("m01.enemy.scout.v1"),
    }),
  });
  const STATIC_ENEMY_SPRITES = Object.freeze({});
  const ANCHOR_ASSETS = Object.freeze({
    entry: Object.freeze({ kind: "image", href: "skin/armara/breach.png" }),
    gate: Object.freeze({ kind: "image", href: "skin/armara/gate.png" }),
  });
  const SHARED_FOUNDATION_ASSET = Object.freeze({
    kind: "image",
    href: M01Art.ASSETS.foundation.href,
  });
  const ROAD_GEOMETRY_CACHE = new WeakMap();
  const M01_ART_CACHE = new WeakMap();
  const ACT_I_ART_CACHE = new WeakMap();

  function own(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function cachedRoadGeometry(map) {
    let geometry = ROAD_GEOMETRY_CACHE.get(map);
    if (!geometry) {
      geometry = RoadGeometry.createRoadRenderPieces(map, {
        ambientOcclusionWidthMilliUnits: RoadGeometry.WIDTHS.maxAmbientOcclusionMilliUnits,
      });
      ROAD_GEOMETRY_CACHE.set(map, geometry);
    }
    return geometry;
  }

  function cachedM01Art(map) {
    let art = M01_ART_CACHE.get(map);
    if (!art) {
      art = M01Art.createM01ArtPresentation(map);
      M01_ART_CACHE.set(map, art);
    }
    return art;
  }

  function cachedActIArt(map) {
    let art = ACT_I_ART_CACHE.get(map);
    if (!art) {
      art = ActIArt.createActIArtPresentation(map);
      ACT_I_ART_CACHE.set(map, art);
    }
    return art;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function assertRuntime(runtime) {
    if (!runtime || !runtime.binding || !runtime.content || !runtime.presentation ||
        !runtime.release || !runtime.descriptor || !runtime.kernel || !runtime.commands ||
        !runtime.economy || !runtime.simulation ||
        typeof runtime.kernel.createInitialState !== "function" ||
        typeof runtime.kernel.advanceTick !== "function" ||
        typeof runtime.commands.normalizeCommand !== "function") {
      throw new TypeError("Preview controller requires an authenticated Aegis runtime");
    }
    return runtime;
  }

  function presentationStrings(presentation) {
    if (!presentation || !Array.isArray(presentation.strings)) {
      throw new TypeError("Preview presentation companion requires a string catalog");
    }
    const records = Object.create(null);
    presentation.strings.forEach(function (record) {
      if (!record || typeof record.key !== "string" || typeof record.value !== "string" || own(records, record.key)) {
        throw new TypeError("Preview presentation strings require unique keyed records");
      }
      records[record.key] = record;
    });
    return records;
  }

  function stringValue(strings, key, fallback) {
    return strings[key] ? strings[key].value : fallback;
  }

  function scaled(value, scale) {
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(scale) || scale <= 0) return null;
    const whole = Math.trunc(value / scale);
    const remainder = value % scale;
    if (remainder === 0) return String(whole);
    return (value / scale).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  function firstParameter(level, key) {
    for (let index = 0; index < level.behaviors.length; index += 1) {
      const parameters = level.behaviors[index].parameters;
      if (parameters && own(parameters, key) && parameters[key] !== null) return parameters[key];
    }
    return null;
  }

  function firstNestedParameter(level, containerKey, key) {
    for (let index = 0; index < level.behaviors.length; index += 1) {
      const parameters = level.behaviors[index].parameters;
      const container = parameters && parameters[containerKey];
      if (container && own(container, key) && container[key] !== null) return container[key];
    }
    return null;
  }

  function behaviorByContract(level, contractId) {
    return level.behaviors.find(function (behavior) { return behavior.contractId === contractId; }) || null;
  }

  function descriptionValues(runtime, level) {
    const damageScale = runtime.simulation.DAMAGE_SCALE;
    const distanceScale = runtime.simulation.DISTANCE_SCALE;
    const direct = behaviorByContract(level, "direct");
    const splash = behaviorByContract(level, "splash");
    const slow = behaviorByContract(level, "slow");
    const spawn = behaviorByContract(level, "spawnUnit");
    const block = behaviorByContract(level, "block");
    const mark = level.behaviors.find(function (behavior) {
      return behavior.parameters && behavior.parameters.statusId === "mark";
    }) || null;
    const attack = direct || splash;
    const attackParameters = attack && attack.parameters;
    const slowParameters = slow && slow.parameters;
    const spawnParameters = spawn && spawn.parameters;
    const blockParameters = block && block.parameters;
    const markParameters = mark && mark.parameters;
    const combo = attackParameters && attackParameters.consecutiveHitCounter;
    const echo = slowParameters && slowParameters.echoCounter;
    const scan = markParameters && markParameters.scanCounter;
    const bash = blockParameters && blockParameters.bash;
    const center = attackParameters && attackParameters.centerBonus;
    const markPayload = markParameters && markParameters.statusPayload;
    return {
      damage: attackParameters ? scaled(attackParameters.baseDamage, damageScale) : null,
      cooldownMs: attackParameters ? attackParameters.cooldownMs : null,
      slowPercent: slowParameters ? slowParameters.magnitudeBp / 100 : null,
      durationMs: slowParameters ? slowParameters.durationMs :
        (scan ? scan.durationMs : (markParameters ? markParameters.durationMs : null)),
      requiredHits: combo ? combo.requiredAcceptedHits : (echo ? echo.requiredAcceptedHits : null),
      maximumTargets: echo ? echo.maximumSecondaryTargets :
        (scan ? scan.maximumTargets : (attackParameters && attackParameters.maximumTargets)),
      slotCount: spawnParameters ? spawnParameters.activeSlotCount : null,
      controlDurationMs: blockParameters ? blockParameters.durationMs : null,
      replenishMs: spawnParameters ? spawnParameters.replenishMs : null,
      bashDamage: bash ? scaled(bash.damage, damageScale) : null,
      stunDurationMs: bash ? bash.durationMs : null,
      markCount: markParameters ? markParameters.maximumTargets : null,
      amplificationPercent: markPayload && own(markPayload, "amountBp") ? markPayload.amountBp / 100 : null,
      range: scaled(level.rangeWorldUnits, distanceScale),
      radius: attackParameters && own(attackParameters, "radiusWorldUnits")
        ? scaled(attackParameters.radiusWorldUnits, distanceScale) : null,
      centerRadius: center ? scaled(center.radiusWorldUnits, distanceScale) : null,
      centerBonusPercent: center ? (center.damageCoefficientBp - 10000) / 100 : null,
      lockOnPercent: combo ? combo.bonusDamageBp / 100 : null,
      requiredScans: scan ? scan.requiredScans : null,
    };
  }

  function formatPresentationRecord(record, values) {
    if (!record) return null;
    let output = record.value;
    const placeholders = Array.isArray(record.placeholders) ? record.placeholders : [];
    placeholders.forEach(function (placeholder) {
      const value = values[placeholder.name];
      output = output.split("{" + placeholder.name + "}").join(value === null || value === undefined ? "—" : String(value));
    });
    return output;
  }

  function towerThumbnail(defenseId, level) {
    const atlas = TOWER_ATLASES[defenseId];
    if (!atlas) {
      return deepFreeze({ kind: "fallback", symbol: shortSymbol(defenseId) });
    }
    return deepFreeze({
      kind: "atlas",
      href: atlas.href,
      metadata: atlas.metadata,
      fallbackSymbol: shortSymbol(defenseId),
      frame: SpriteAtlas.towerFrame(atlas.metadata, level, "idleA"),
    });
  }

  function defenseView(runtimeInput, defenseId, levelNumber) {
    const runtime = assertRuntime(runtimeInput);
    const defense = runtime.content.defenses[defenseId];
    if (!defense) throw new RangeError("Unknown preview defense " + defenseId);
    if (!Number.isSafeInteger(levelNumber) || levelNumber < 1 || levelNumber > defense.levels.length) {
      throw new RangeError("Preview defense level is out of range");
    }
    const level = defense.levels[levelNumber - 1];
    const strings = presentationStrings(runtime.presentation);
    const descriptionKey = level.ui && level.ui.descriptionKey
      ? level.ui.descriptionKey
      : "defense." + defense.id + ".l" + levelNumber + ".description";
    const description = formatPresentationRecord(strings[descriptionKey], descriptionValues(runtime, level));
    const damage = firstParameter(level, "baseDamage");
    const cooldownMs = firstParameter(level, "cooldownMs") || firstParameter(level, "cadenceMs");
    const contracts = level.behaviors.map(function (behavior) { return behavior.contractId; });
    return deepFreeze({
      id: defense.id,
      level: levelNumber,
      levelCount: defense.levels.length,
      name: stringValue(strings, defense.nameKey, defense.id),
      role: stringValue(strings, defense.roleKey, "Role description unavailable"),
      weakness: stringValue(strings, defense.weaknessKey, "Weakness description unavailable"),
      description: description || ("Behaviors: " + contracts.join(", ")),
      costAether: level.purchase.costAether,
      purchaseKind: level.purchase.kind,
      damage: damage === null ? "support" : scaled(damage, runtime.simulation.DAMAGE_SCALE),
      attacksPerSecond: cooldownMs === null ? "continuous" : (1000 / cooldownMs).toFixed(2),
      cooldownMs: cooldownMs,
      range: scaled(level.rangeWorldUnits, runtime.simulation.DISTANCE_SCALE),
      targetKinds: defense.targetKinds.slice(),
      allowedTargetPolicyIds: defense.allowedTargetPolicyIds.slice(),
      defaultTargetPolicyId: defense.defaultTargetPolicyId,
      behaviorIds: contracts,
      thumbnail: towerThumbnail(defense.id, levelNumber),
    });
  }

  function missionTitle(runtime, missionId) {
    const mission = runtime.content.missions[missionId];
    const strings = presentationStrings(runtime.presentation);
    return mission ? stringValue(strings, mission.titleKey, missionId) : missionId;
  }

  function resultCardModel(runtimeInput, state) {
    const runtime = assertRuntime(runtimeInput);
    if (!state || (state.outcome !== "victory" && state.outcome !== "defeat") ||
        !state.management || !Number.isSafeInteger(state.management.clearedWaves)) {
      throw new TypeError("Preview result card requires a terminal authoritative kernel state");
    }
    const mission = runtime.content.missions[state.missionId];
    const difficulty = runtime.content.campaignRules.difficultyPresets.find(function (record) {
      return record.id === state.difficultyId;
    });
    if (!mission || !difficulty || !Number.isSafeInteger(difficulty.integrity)) {
      throw new RangeError("Preview result card requires compiled mission and difficulty records");
    }
    const totalWaves = mission.waves.length;
    const clearedWaves = state.outcome === "victory"
      ? totalWaves
      : Math.max(0, Math.min(totalWaves, state.management.clearedWaves));
    return ShareCard.createModel({
      widthPx: ShareCard.CARD_WIDTH_PX,
      heightPx: ShareCard.CARD_HEIGHT_PX,
      outcome: state.outcome,
      missionTitle: missionTitle(runtime, state.missionId),
      score: state.score,
      waves: { cleared: clearedWaves, total: totalWaves },
      gateHealth: { current: state.integrity, max: difficulty.integrity },
    });
  }

  function attackRateLabel(view) {
    return view.attacksPerSecond === "continuous" ? "continuous" : view.attacksPerSecond + "/sec";
  }

  function createHeader(runtimeInput, options) {
    const runtime = assertRuntime(runtimeInput);
    options = options || {};
    const missionId = options.missionId || runtime.descriptor.contentIds[0];
    const mission = runtime.content.missions[missionId];
    if (!mission || runtime.descriptor.contentIds.indexOf(missionId) === -1) {
      throw new RangeError("Mission is not available in the selected preview release");
    }
    const difficulties = runtime.content.campaignRules.difficultyPresets.map(function (record) { return record.id; });
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
      get state() { return state; },
      get paused() { return paused; },
      get pendingCommandCount() { return pendingCommands.length; },
      get inputs() { return Object.freeze(inputs.slice()); },
      get events() { return Object.freeze(events.slice()); },
    });
  }

  function routeSegments(map, route) {
    if (route.route && Array.isArray(route.route.segments)) return route.route.segments;
    if (Array.isArray(route.segments)) return route.segments;
    if (!Array.isArray(route.laneSegmentIds) || !Array.isArray(map.laneSegments)) {
      throw new RangeError("Preview route lacks compiled lane geometry: " + route.id);
    }
    const lanes = Object.create(null);
    map.laneSegments.forEach(function (lane) { lanes[lane.id] = lane; });
    const segments = [];
    route.laneSegmentIds.forEach(function (laneId) {
      const lane = lanes[laneId];
      const compiled = lane && lane.compiled;
      if (!compiled || !Array.isArray(compiled.subsegments)) {
        throw new RangeError("Preview route references missing compiled lane geometry: " + laneId);
      }
      compiled.subsegments.forEach(function (segment) { segments.push(segment); });
    });
    return segments;
  }

  function shortSymbol(id) {
    return String(id).split(/[.\-_]/).filter(Boolean).map(function (part) {
      return part.charAt(0);
    }).join("").slice(0, 2).toUpperCase() || "?";
  }

  function presentationLanePosition(position, segments, runtimeId) {
    const slot = (runtimeId % 3) - 1;
    if (slot === 0 || !Array.isArray(segments)) return { x: position.x, y: position.y };
    const segment = segments.find(function (candidate) {
      const dx = candidate.toX - candidate.fromX;
      const dy = candidate.toY - candidate.fromY;
      const px = position.x - candidate.fromX;
      const py = position.y - candidate.fromY;
      return dx * py === dy * px &&
        position.x >= Math.min(candidate.fromX, candidate.toX) &&
        position.x <= Math.max(candidate.fromX, candidate.toX) &&
        position.y >= Math.min(candidate.fromY, candidate.toY) &&
        position.y <= Math.max(candidate.fromY, candidate.toY);
    });
    if (!segment) return { x: position.x, y: position.y };
    const dx = segment.toX - segment.fromX;
    const dy = segment.toY - segment.fromY;
    const length = Math.hypot(dx, dy);
    if (length === 0) return { x: position.x, y: position.y };
    const spread = slot * 2300;
    return {
      x: Math.round(position.x - dy / length * spread),
      y: Math.round(position.y + dx / length * spread),
    };
  }

  function battlefieldView(runtimeInput, state, selectedPadId) {
    const runtime = assertRuntime(runtimeInput);
    if (!state || typeof state !== "object" || !state.management || !Array.isArray(state.management.towers) ||
        !Array.isArray(state.enemies) || !Array.isArray(state.routes)) {
      throw new TypeError("Preview battlefield requires an authoritative kernel state");
    }
    const mission = runtime.content.missions[state.missionId];
    const map = mission && runtime.content.maps[mission.mapId];
    if (!mission || !map || !map.board || !Array.isArray(map.routes) || !Array.isArray(map.pads)) {
      throw new RangeError("Preview battlefield requires a compiled mission map");
    }
    const scale = runtime.simulation.DISTANCE_SCALE;
    const board = {
      x: 0,
      y: 0,
      width: map.board.widthWorldUnits * scale,
      height: map.board.heightWorldUnits * scale,
    };
    const roadGeometry = cachedRoadGeometry(map);
    const roadWidth = roadGeometry.widths.shoulderedMilliUnits;
    const missionArt = state.missionId === "m01"
      ? cachedM01Art(map)
      : ((state.missionId === "m04" || state.missionId === "m05")
        ? cachedActIArt(map)
        : null);
    const routeLengthById = Object.create(null);
    state.routes.forEach(function (route) { routeLengthById[route.id] = route.length; });
    const routes = map.routes.map(function (route) {
      const segments = routeSegments(map, route).map(function (segment) {
        return {
          fromX: segment.fromX,
          fromY: segment.fromY,
          toX: segment.toX,
          toY: segment.toY,
        };
      });
      return {
        id: route.id,
        kind: route.kind,
        length: routeLengthById[route.id] || route.length,
        segments: segments,
      };
    });
    const towerByPad = Object.create(null);
    state.management.towers.forEach(function (tower) { towerByPad[tower.padId] = tower; });
    const pads = map.pads.slice().sort(function (left, right) {
      const leftOrder = Number.isSafeInteger(left.selectionOrder) ? left.selectionOrder : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isSafeInteger(right.selectionOrder) ? right.selectionOrder : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.id.localeCompare(right.id);
    }).map(function (pad) {
      const tower = towerByPad[pad.id] || null;
      let towerView = null;
      if (tower) {
        const view = defenseView(runtime, tower.defenseId, tower.level);
        const level = runtime.content.defenses[tower.defenseId].levels[tower.level - 1];
        const atlas = TOWER_ATLASES[tower.defenseId];
        towerView = {
          id: tower.id,
          defenseId: tower.defenseId,
          level: tower.level,
          name: view.name,
          range: level.rangeWorldUnits,
          symbol: shortSymbol(tower.defenseId),
          asset: atlas ? {
            kind: "atlas",
            href: atlas.href,
            metadata: atlas.metadata,
            fallbackSymbol: shortSymbol(tower.defenseId),
          } : null,
        };
      }
      return {
        id: pad.id,
        x: pad.x,
        y: pad.y,
        selected: selectedPadId === pad.id,
        foundation: !tower && missionArt ? SHARED_FOUNDATION_ASSET : null,
        tower: towerView,
      };
    });
    const strings = presentationStrings(runtime.presentation);
    const enemies = state.enemies.map(function (enemy) {
      const routeLength = routeLengthById[enemy.routeId] || 0;
      const owner = enemy.kind === "boss"
        ? runtime.content.bosses[enemy.ownerId]
        : runtime.content.enemies[enemy.ownerId];
      const atlas = ENEMY_ATLASES[enemy.ownerId];
      const spriteFile = STATIC_ENEMY_SPRITES[enemy.ownerId];
      const routeView = routes.find(function (route) { return route.id === enemy.routeId; });
      const displayPosition = presentationLanePosition(enemy.position, routeView && routeView.segments, enemy.id);
      return {
        id: enemy.id,
        ownerId: enemy.ownerId,
        name: owner ? stringValue(strings, owner.nameKey, owner.id) : enemy.ownerId,
        kind: enemy.kind,
        routeId: enemy.routeId,
        x: enemy.position.x,
        y: enemy.position.y,
        displayX: displayPosition.x,
        displayY: displayPosition.y,
        hpBp: enemy.maximumHpMilli > 0
          ? Math.max(0, Math.min(10000, Math.round(enemy.hpMilli / enemy.maximumHpMilli * 10000)))
          : 0,
        progressBp: routeLength > 0
          ? Math.max(0, Math.min(10000, Math.round(enemy.distance / routeLength * 10000)))
          : 0,
        symbol: shortSymbol(enemy.ownerId),
        asset: atlas ? {
          kind: "atlas",
          href: atlas.href,
          metadata: atlas.metadata,
          fallbackSymbol: shortSymbol(enemy.ownerId),
        } : (spriteFile ? {
          kind: "image",
          href: "skin/armara/" + spriteFile,
        } : null),
      };
    });
    const anchors = Array.isArray(map.anchors) ? map.anchors.map(function (anchor) {
      return { id: anchor.id, kind: anchor.kind, x: anchor.x, y: anchor.y };
    }).filter(function (anchor) {
      return Number.isSafeInteger(anchor.x) && Number.isSafeInteger(anchor.y);
    }) : [];
    return deepFreeze({
      missionId: state.missionId,
      tick: state.tick,
      roadWidth: roadWidth,
      board: board,
      viewBox: {
        minX: Camera.DEFAULT_CAMERA.x,
        minY: Camera.DEFAULT_CAMERA.y,
        width: Camera.DEFAULT_CAMERA.width,
        height: Camera.DEFAULT_CAMERA.height,
      },
      roadGeometry: roadGeometry,
      missionArt: missionArt,
      routes: routes,
      anchors: anchors,
      pads: pads,
      enemies: enemies,
    });
  }

  function element(documentObject, tag, className, text) {
    const node = documentObject.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgElement(documentObject, tag, attributes, text) {
    const node = documentObject.createElementNS(SVG_NAMESPACE, tag);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function spriteImage(documentObject, asset, attributes) {
    const image = svgElement(documentObject, "image", Object.assign({}, attributes, {
      href: asset.href,
      preserveAspectRatio: "xMidYMid meet",
      "data-asset-href": asset.href,
    }));
    if (typeof image.addEventListener === "function") {
      image.addEventListener("load", function () {
        image.setAttribute("data-asset-state", "loaded");
      });
      image.addEventListener("error", function () {
        image.setAttribute("data-asset-state", "error");
        image.setAttribute("visibility", "hidden");
      });
    }
    return image;
  }

  function atlasSprite(documentObject, asset, frame, attributes, clipId) {
    const x = attributes.x;
    const y = attributes.y;
    const width = attributes.width;
    const height = attributes.height;
    const wrapper = svgElement(documentObject, "g", {
      class: attributes.class,
      "data-frame": attributes["data-frame"],
      "data-asset-href": asset.href,
      "data-asset-state": "loading",
    });
    const definitions = svgElement(documentObject, "defs", {});
    const clip = svgElement(documentObject, "clipPath", {
      id: clipId,
      clipPathUnits: "userSpaceOnUse",
    });
    clip.appendChild(svgElement(documentObject, "rect", {
      x: x,
      y: y,
      width: width,
      height: height,
    }));
    definitions.appendChild(clip);
    wrapper.appendChild(definitions);
    const image = svgElement(documentObject, "image", {
      href: asset.href,
      x: x - frame.column * width,
      y: y - frame.row * height,
      width: width * asset.metadata.columns,
      height: height * asset.metadata.rows,
      preserveAspectRatio: "none",
      "clip-path": "url(#" + clipId + ")",
    });
    const fallback = svgElement(documentObject, "g", {
      class: "preview-sprite-fallback",
      visibility: "hidden",
      "aria-hidden": "true",
    });
    fallback.appendChild(svgElement(documentObject, "circle", {
      class: "preview-sprite-fallback-disc",
      cx: x + width / 2,
      cy: y + height / 2,
      r: Math.min(width, height) * 0.28,
      "stroke-width": Math.min(width, height) * 0.05,
    }));
    fallback.appendChild(svgElement(documentObject, "text", {
      class: "preview-sprite-fallback-glyph",
      x: x + width / 2,
      y: y + height / 2,
      "dominant-baseline": "central",
      "text-anchor": "middle",
      "font-size": Math.min(width, height) * 0.24,
      "stroke-width": Math.min(width, height) * 0.035,
    }, asset.fallbackSymbol || "?"));
    if (typeof image.addEventListener === "function") {
      image.addEventListener("load", function () {
        wrapper.setAttribute("data-asset-state", "loaded");
        fallback.setAttribute("visibility", "hidden");
      });
      image.addEventListener("error", function () {
        wrapper.setAttribute("data-asset-state", "error");
        image.setAttribute("visibility", "hidden");
        fallback.setAttribute("visibility", "visible");
      });
    }
    wrapper.appendChild(image);
    wrapper.appendChild(fallback);
    return wrapper;
  }

  function towerCardThumbnail(documentObject, view, clipKey) {
    const accessibleLabel = view.name + " level " + view.level + " tower preview";
    if (view.thumbnail.kind !== "atlas") {
      const fallback = element(
        documentObject,
        "div",
        "preview-tower-thumbnail-fallback",
        view.thumbnail.symbol
      );
      fallback.setAttribute("role", "img");
      fallback.setAttribute("aria-label", accessibleLabel);
      return fallback;
    }
    const svg = svgElement(documentObject, "svg", {
      class: "preview-tower-thumbnail-svg",
      viewBox: "0 0 100 100",
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-label": accessibleLabel,
      focusable: "false",
    });
    svg.appendChild(svgElement(documentObject, "title", {}, accessibleLabel));
    svg.appendChild(atlasSprite(documentObject, view.thumbnail, view.thumbnail.frame, {
      class: "preview-tower-thumbnail-sprite",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      "data-frame": view.thumbnail.frame.frameName,
    }, "preview-card-tower-clip-" + clipKey));
    return svg;
  }

  function appendTowerCardHeading(documentObject, card, view, headingTag, title, clipKey) {
    const heading = element(documentObject, "div", "preview-card-heading");
    heading.appendChild(towerCardThumbnail(documentObject, view, clipKey));
    heading.appendChild(element(documentObject, headingTag, "", title));
    card.appendChild(heading);
  }

  function towerAnimationFrame(asset, level, tick, runtimeId, reduceMotion) {
    const frameNames = ["idleA", "idleB", "active", "recover"];
    const index = reduceMotion ? 2 : Math.floor((tick + runtimeId * 7) / 9) % frameNames.length;
    return SpriteAtlas.towerFrame(asset.metadata, level, frameNames[index]);
  }

  function enemyAnimationFrame(asset, tick, runtimeId, reduceMotion) {
    const frameNames = ["runA", "runB", "runC", "runB"];
    const index = reduceMotion ? 0 : Math.floor((tick + runtimeId * 5) / 7) % frameNames.length;
    return SpriteAtlas.enemyFrame(asset.metadata, reduceMotion ? "idleB" : frameNames[index]);
  }

  function pointsPath(points) {
    return points.map(function (point, index) {
      return (index === 0 ? "M " : "L ") + point.x + " " + point.y;
    }).join(" ");
  }

  function appendM01RoadDefinitions(documentObject, defs, missionArt) {
    missionArt.road.materialSpans.forEach(function (span) {
      const pattern = svgElement(documentObject, "pattern", {
        id: "preview-road-material-" + span.id,
        patternUnits: "userSpaceOnUse",
        patternContentUnits: "userSpaceOnUse",
        x: 0,
        y: 0,
        width: missionArt.road.appearance.patternTileMilliUnits,
        height: missionArt.road.appearance.patternTileMilliUnits,
      });
      pattern.appendChild(svgElement(documentObject, "image", {
        href: span.asset.href,
        x: 0,
        y: 0,
        width: missionArt.road.appearance.patternTileMilliUnits,
        height: missionArt.road.appearance.patternTileMilliUnits,
        preserveAspectRatio: "none",
      }));
      defs.appendChild(pattern);
    });
    missionArt.road.transitions.forEach(function (transition) {
      const first = transition.pointsMilliUnits[0];
      const last = transition.pointsMilliUnits[transition.pointsMilliUnits.length - 1];
      const gradient = svgElement(documentObject, "linearGradient", {
        id: "preview-road-transition-" + transition.id,
        gradientUnits: "userSpaceOnUse",
        x1: first.x,
        y1: first.y,
        x2: last.x,
        y2: last.y,
      });
      [
        ["0", transition.fromColor, "0"],
        ["0.3", transition.fromColor, "0.92"],
        ["0.5", "#cdae72", "0.96"],
        ["0.7", transition.toColor, "0.92"],
        ["1", transition.toColor, "0"],
      ].forEach(function (stop) {
        gradient.appendChild(svgElement(documentObject, "stop", {
          offset: stop[0],
          "stop-color": stop[1],
          "stop-opacity": stop[2],
        }));
      });
      defs.appendChild(gradient);
    });
  }

  function roadStroke(documentObject, className, points, width, stroke, opacity, extra) {
    return svgElement(documentObject, "path", Object.assign({
      class: className,
      d: pointsPath(points),
      fill: "none",
      stroke: stroke,
      "stroke-width": width,
      "stroke-linecap": "butt",
      "stroke-linejoin": "round",
      opacity: opacity,
    }, extra || {}));
  }

  function roadTerminal(documentObject, className, point, radius, fill, opacity) {
    return svgElement(documentObject, "circle", {
      class: className,
      cx: point.x,
      cy: point.y,
      r: radius,
      fill: fill,
      opacity: opacity,
    });
  }

  function appendM01Road(documentObject, svg, missionArt) {
    const road = missionArt.road;
    const fullPath = road.centerlineMilliUnits;
    const firstSpan = road.materialSpans[0];
    const lastSpan = road.materialSpans[road.materialSpans.length - 1];
    const firstPoint = firstSpan.pointsMilliUnits[0];
    const lastPoint = lastSpan.pointsMilliUnits[lastSpan.pointsMilliUnits.length - 1];
    const layer = svgElement(documentObject, "g", {
      class: "preview-road-layer preview-road-layer-m01",
      "data-physical-lane-count": "1",
    });
    layer.appendChild(roadStroke(
      documentObject,
      "preview-road-ambient",
      fullPath,
      road.widths.ambientOcclusionMilliUnits,
      "#2a1b0d",
      road.appearance.ambientOcclusionOpacity,
      { "stroke-linecap": "round" }
    ));
    road.materialSpans.forEach(function (span) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-solid-underlay preview-road-solid-shoulder",
        span.pointsMilliUnits,
        road.widths.shoulderedMilliUnits,
        span.tintColor,
        0.76,
        { "data-material": span.styleId, "data-fallback-for": span.asset.href }
      ));
    });
    road.materialSpans.forEach(function (span) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-shoulder",
        span.pointsMilliUnits,
        road.widths.shoulderedMilliUnits,
        "url(#preview-road-material-" + span.id + ")",
        road.appearance.shoulderOpacity,
        { "data-material": span.styleId }
      ));
    });
    road.transitions.forEach(function (transition) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-shoulder-transition",
        transition.pointsMilliUnits,
        road.widths.shoulderedMilliUnits,
        "url(#preview-road-transition-" + transition.id + ")",
        road.appearance.shoulderTransitionOpacity,
        { "data-display-only": "true" }
      ));
    });
    layer.appendChild(roadTerminal(
      documentObject,
      "preview-road-terminal preview-road-solid-underlay preview-road-solid-shoulder",
      firstPoint,
      road.widths.shoulderedMilliUnits / 2,
      firstSpan.tintColor,
      0.76
    ));
    layer.appendChild(roadTerminal(
      documentObject,
      "preview-road-terminal preview-road-solid-underlay preview-road-solid-shoulder",
      lastPoint,
      road.widths.shoulderedMilliUnits / 2,
      lastSpan.tintColor,
      0.76
    ));
    layer.appendChild(roadTerminal(
      documentObject,
      "preview-road-terminal preview-road-terminal-shoulder",
      firstPoint,
      road.widths.shoulderedMilliUnits / 2,
      "url(#preview-road-material-" + firstSpan.id + ")",
      road.appearance.shoulderOpacity
    ));
    layer.appendChild(roadTerminal(
      documentObject,
      "preview-road-terminal preview-road-terminal-shoulder",
      lastPoint,
      road.widths.shoulderedMilliUnits / 2,
      "url(#preview-road-material-" + lastSpan.id + ")",
      road.appearance.shoulderOpacity
    ));
    road.materialSpans.forEach(function (span) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-solid-underlay preview-road-solid-core",
        span.pointsMilliUnits,
        road.widths.coreMilliUnits,
        span.tintColor,
        0.9,
        { "data-material": span.styleId, "data-fallback-for": span.asset.href }
      ));
    });
    road.materialSpans.forEach(function (span) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-core",
        span.pointsMilliUnits,
        road.widths.coreMilliUnits,
        "url(#preview-road-material-" + span.id + ")",
        span.coreOpacity,
        { "data-material": span.styleId }
      ));
    });
    road.transitions.forEach(function (transition) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-core-transition",
        transition.pointsMilliUnits,
        road.widths.coreMilliUnits,
        "url(#preview-road-transition-" + transition.id + ")",
        road.appearance.coreTransitionOpacity,
        { "data-display-only": "true" }
      ));
    });
    layer.appendChild(roadTerminal(
      documentObject,
      "preview-road-terminal preview-road-solid-underlay preview-road-solid-core",
      firstPoint,
      road.widths.coreMilliUnits / 2,
      firstSpan.tintColor,
      0.9
    ));
    layer.appendChild(roadTerminal(
      documentObject,
      "preview-road-terminal preview-road-solid-underlay preview-road-solid-core",
      lastPoint,
      road.widths.coreMilliUnits / 2,
      lastSpan.tintColor,
      0.9
    ));
    layer.appendChild(roadTerminal(
      documentObject,
      "preview-road-terminal preview-road-terminal-core",
      firstPoint,
      road.widths.coreMilliUnits / 2,
      "url(#preview-road-material-" + firstSpan.id + ")",
      firstSpan.coreOpacity
    ));
    layer.appendChild(roadTerminal(
      documentObject,
      "preview-road-terminal preview-road-terminal-core",
      lastPoint,
      road.widths.coreMilliUnits / 2,
      "url(#preview-road-material-" + lastSpan.id + ")",
      lastSpan.coreOpacity
    ));
    svg.appendChild(layer);
  }

  function actIRoadPatternId(missionArt) {
    return "preview-road-material-" + missionArt.missionId;
  }

  function appendActIRoadDefinitions(documentObject, defs, missionArt) {
    const road = missionArt.road;
    const pattern = svgElement(documentObject, "pattern", {
      id: actIRoadPatternId(missionArt),
      patternUnits: "userSpaceOnUse",
      patternContentUnits: "userSpaceOnUse",
      x: road.pattern.originXMilliUnits,
      y: road.pattern.originYMilliUnits,
      width: road.pattern.tileMilliUnits,
      height: road.pattern.tileMilliUnits,
    });
    pattern.appendChild(svgElement(documentObject, "image", {
      href: road.asset.href,
      x: road.pattern.originXMilliUnits,
      y: road.pattern.originYMilliUnits,
      width: road.pattern.tileMilliUnits,
      height: road.pattern.tileMilliUnits,
      preserveAspectRatio: "none",
    }));
    defs.appendChild(pattern);
  }

  function appendActIRoadCap(documentObject, layer, className, cap, radius, fill, opacity) {
    layer.appendChild(roadTerminal(
      documentObject,
      className,
      cap.centerMilliUnits,
      radius,
      fill,
      opacity
    ));
  }

  function appendActIRoad(documentObject, svg, missionArt) {
    const road = missionArt.road;
    const caps = road.endCaps.concat(road.joinCaps);
    const patternFill = "url(#" + actIRoadPatternId(missionArt) + ")";
    const layer = svgElement(documentObject, "g", {
      class: "preview-road-layer preview-road-layer-act-i preview-road-layer-" + missionArt.missionId,
      "data-physical-lane-count": road.physicalLaneCount,
      "data-material": road.materialStyleId,
    });
    road.lanePieces.forEach(function (piece) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-ambient",
        piece.centerlineMilliUnits,
        road.widths.ambientOcclusionMilliUnits,
        road.appearance.ambientOcclusion.color,
        road.appearance.ambientOcclusion.opacity,
        { "stroke-linecap": "round", "data-lane-segment-id": piece.laneSegmentId }
      ));
    });
    caps.forEach(function (cap) {
      appendActIRoadCap(
        documentObject,
        layer,
        "preview-road-terminal preview-road-terminal-ambient",
        cap,
        road.widths.ambientOcclusionMilliUnits / 2,
        road.appearance.ambientOcclusion.color,
        road.appearance.ambientOcclusion.opacity
      );
    });
    road.lanePieces.forEach(function (piece) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-shoulder preview-road-shoulder-act-i",
        piece.centerlineMilliUnits,
        road.widths.shoulderedMilliUnits,
        road.appearance.shoulder.color,
        road.appearance.shoulder.opacity,
        { "stroke-linecap": "round", "data-lane-segment-id": piece.laneSegmentId }
      ));
    });
    caps.forEach(function (cap) {
      appendActIRoadCap(
        documentObject,
        layer,
        "preview-road-terminal preview-road-terminal-shoulder",
        cap,
        road.widths.shoulderedMilliUnits / 2,
        road.appearance.shoulder.color,
        road.appearance.shoulder.opacity
      );
    });
    road.lanePieces.forEach(function (piece) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-solid-underlay preview-road-solid-core-act-i",
        piece.centerlineMilliUnits,
        road.widths.coreMilliUnits,
        road.appearance.core.tintColor,
        Math.min(0.92, road.appearance.core.opacity),
        { "stroke-linecap": "round", "data-lane-segment-id": piece.laneSegmentId,
          "data-fallback-for": road.asset.href }
      ));
    });
    caps.forEach(function (cap) {
      appendActIRoadCap(
        documentObject,
        layer,
        "preview-road-terminal preview-road-solid-underlay preview-road-solid-core-act-i",
        cap,
        road.widths.coreMilliUnits / 2,
        road.appearance.core.tintColor,
        Math.min(0.92, road.appearance.core.opacity)
      );
    });
    road.lanePieces.forEach(function (piece) {
      layer.appendChild(roadStroke(
        documentObject,
        "preview-road-core preview-road-core-act-i",
        piece.centerlineMilliUnits,
        road.widths.coreMilliUnits,
        patternFill,
        road.appearance.core.opacity,
        { "stroke-linecap": "round", "data-lane-segment-id": piece.laneSegmentId }
      ));
    });
    caps.forEach(function (cap) {
      appendActIRoadCap(
        documentObject,
        layer,
        "preview-road-terminal preview-road-terminal-core",
        cap,
        road.widths.coreMilliUnits / 2,
        patternFill,
        road.appearance.core.opacity
      );
    });
    svg.appendChild(layer);
  }

  function appendMissionRoadDefinitions(documentObject, defs, missionArt) {
    if (missionArt.missionId === "m01") appendM01RoadDefinitions(documentObject, defs, missionArt);
    else appendActIRoadDefinitions(documentObject, defs, missionArt);
  }

  function appendMissionRoad(documentObject, svg, missionArt) {
    if (missionArt.missionId === "m01") appendM01Road(documentObject, svg, missionArt);
    else appendActIRoad(documentObject, svg, missionArt);
  }

  function appendFallbackRoad(documentObject, svg, roadGeometry) {
    const layer = svgElement(documentObject, "g", {
      class: "preview-road-layer preview-road-layer-fallback",
      "data-physical-lane-count": roadGeometry.physicalLaneCount,
    });
    roadGeometry.lanePieces.forEach(function (piece) {
      [
        ["preview-road-ambient", roadGeometry.widths.ambientOcclusionMilliUnits, "#2a1b0d", 0.18],
        ["preview-road-fallback-shoulder", roadGeometry.widths.shoulderedMilliUnits, "#7c6848", 0.82],
        ["preview-road-fallback-core", roadGeometry.widths.coreMilliUnits, "#d3b779", 0.92],
      ].forEach(function (style) {
        layer.appendChild(roadStroke(
          documentObject,
          style[0],
          piece.centerlineMilliUnits,
          style[1],
          style[2],
          style[3],
          { "stroke-linecap": "round", "data-lane-segment-id": piece.laneSegmentId }
        ));
      });
    });
    roadGeometry.joinCaps.forEach(function (cap) {
      layer.appendChild(roadTerminal(
        documentObject,
        "preview-road-fallback-join",
        cap.centerMilliUnits,
        roadGeometry.widths.coreMilliUnits / 2,
        "#d3b779",
        0.92
      ));
    });
    svg.appendChild(layer);
  }

  function replaceChildren(target, children) {
    while (target.firstChild) target.removeChild(target.firstChild);
    children.forEach(function (child) { target.appendChild(child); });
  }

  function requiredElement(documentObject, id) {
    const node = documentObject.getElementById(id);
    if (!node) throw new Error("Preview page is missing #" + id);
    return node;
  }

  function mount(runtimeInput, options) {
    const runtime = assertRuntime(runtimeInput);
    options = options || {};
    const documentObject = options.document || (root && root.document);
    const windowObject = options.window || root;
    if (!documentObject || !windowObject) throw new TypeError("Preview mount requires a browser document and window");

    const ui = {
      bootStatus: requiredElement(documentObject, "previewBootStatus"),
      mission: requiredElement(documentObject, "previewMission"),
      difficulty: requiredElement(documentObject, "previewDifficulty"),
      assist: requiredElement(documentObject, "previewAssist"),
      seed: requiredElement(documentObject, "previewSeed"),
      loadout: requiredElement(documentObject, "previewLoadout"),
      reset: requiredElement(documentObject, "previewReset"),
      aether: requiredElement(documentObject, "previewAether"),
      integrity: requiredElement(documentObject, "previewIntegrity"),
      wave: requiredElement(documentObject, "previewWave"),
      score: requiredElement(documentObject, "previewScore"),
      clock: requiredElement(documentObject, "previewClock"),
      startWave: requiredElement(documentObject, "previewStartWave"),
      pause: requiredElement(documentObject, "previewPause"),
      skipTutorial: requiredElement(documentObject, "previewSkipTutorial"),
      battlefield: requiredElement(documentObject, "previewBattlefield"),
      battlefieldStatus: requiredElement(documentObject, "previewBattlefieldStatus"),
      siteList: requiredElement(documentObject, "previewSiteList"),
      storePanel: requiredElement(documentObject, "previewStorePanel"),
      storeClose: requiredElement(documentObject, "previewStoreClose"),
      store: requiredElement(documentObject, "previewStore"),
      towers: requiredElement(documentObject, "previewTowers"),
      objectives: requiredElement(documentObject, "previewObjectives"),
      events: requiredElement(documentObject, "previewEvents"),
      outcome: requiredElement(documentObject, "previewOutcome"),
      outcomeTitle: requiredElement(documentObject, "previewOutcomeTitle"),
      shareCard: requiredElement(documentObject, "previewShareCard"),
      shareStatus: requiredElement(documentObject, "previewShareStatus"),
      shareDownload: requiredElement(documentObject, "previewShareDownload"),
      feedback: requiredElement(documentObject, "previewFeedback"),
    };
    let session = null;
    let selectedPadId = null;
    let selectedPadFocusSource = "map";
    let timer = null;
    let visualTicksSinceRender = 0;
    let manuallyPaused = false;
    let fatalPaused = false;
    let renderedShareState = null;
    let renderedShareModel = null;
    const reduceMotion = typeof windowObject.matchMedia === "function" &&
      windowObject.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function currentMission() {
      return runtime.content.missions[ui.mission.value];
    }

    function populateMissions() {
      replaceChildren(ui.mission, runtime.descriptor.contentIds.map(function (missionId) {
        const option = element(documentObject, "option", "", missionTitle(runtime, missionId));
        option.value = missionId;
        return option;
      }));
      replaceChildren(ui.difficulty, runtime.content.campaignRules.difficultyPresets.map(function (difficulty) {
        const option = element(documentObject, "option", "", difficulty.id.toUpperCase());
        option.value = difficulty.id;
        if (difficulty.id === "strategos") option.selected = true;
        return option;
      }));
    }

    function populateLoadout() {
      const mission = currentMission();
      const strings = presentationStrings(runtime.presentation);
      const defaultIds = mission.id === "m01"
        ? STARTER_DEFENSE_IDS
        : mission.availableDefenseIds.slice(0, MAX_LOADOUT);
      replaceChildren(ui.loadout, mission.availableDefenseIds.map(function (defenseId) {
        const defense = runtime.content.defenses[defenseId];
        const label = element(documentObject, "label", "preview-check");
        const input = element(documentObject, "input");
        input.type = "checkbox";
        input.name = "preview-defense";
        input.value = defenseId;
        input.checked = defaultIds.includes(defenseId);
        label.appendChild(input);
        label.appendChild(documentObject.createTextNode(" " + stringValue(strings, defense.nameKey, defenseId)));
        return label;
      }));
    }

    function selectedLoadout() {
      return Array.from(ui.loadout.querySelectorAll('input[name="preview-defense"]:checked')).map(function (input) {
        return input.value;
      });
    }

    function loadShareImage(href) {
      return new Promise(function (resolve, reject) {
        const ImageConstructor = windowObject.Image;
        if (typeof ImageConstructor !== "function") {
          reject(new Error("This browser cannot load the local result-card artwork"));
          return;
        }
        const image = new ImageConstructor();
        image.onload = function () { resolve(image); };
        image.onerror = function () { reject(new Error("Unable to load " + href)); };
        image.src = new windowObject.URL(href, documentObject.baseURI).href;
      });
    }

    function renderResultCard(state) {
      if (renderedShareState === state) return;
      renderedShareState = state;
      renderedShareModel = null;
      ui.shareDownload.disabled = true;
      ui.shareStatus.textContent = "Rendering your local Armara result card...";
      let model;
      try {
        model = resultCardModel(runtime, state);
      } catch (error) {
        ui.shareStatus.textContent = "Result card unavailable: " + String(error && error.message || error);
        return;
      }
      ShareCard.render(model, {
        canvas: ui.shareCard,
        imageLoader: loadShareImage,
      }).then(function (result) {
        if (renderedShareState !== state) return;
        renderedShareModel = result.model;
        ui.shareDownload.disabled = false;
        ui.shareStatus.textContent = result.summary;
      }).catch(function (error) {
        if (renderedShareState !== state) return;
        ui.shareStatus.textContent = "Result card unavailable: " + String(error && error.message || error);
      });
    }

    function downloadResultCard() {
      if (!renderedShareModel || typeof ui.shareCard.toBlob !== "function") {
        ui.shareStatus.textContent = "Result card is not ready to download.";
        return;
      }
      try {
        ui.shareCard.toBlob(function (blob) {
          const urlApi = windowObject.URL;
          if (!blob || !urlApi || typeof urlApi.createObjectURL !== "function") {
            ui.shareStatus.textContent = "This browser could not create the local PNG.";
            return;
          }
          const href = urlApi.createObjectURL(blob);
          const anchor = documentObject.createElement("a");
          anchor.href = href;
          anchor.download = "armara-aegis-" + renderedShareModel.outcome + "-" +
            session.state.missionId + ".png";
          anchor.click();
          windowObject.setTimeout(function () { urlApi.revokeObjectURL(href); }, 0);
          ui.shareStatus.textContent = "Result card downloaded locally. Nothing was posted or uploaded.";
        }, "image/png");
      } catch (error) {
        ui.shareStatus.textContent = "This browser could not create the local PNG: " +
          String(error && error.message || error);
      }
    }

    function setFeedback(message) {
      ui.feedback.textContent = message;
    }

    function panelSuspendsCombat() {
      return Boolean(session && selectedPadId && session.state.outcome === "active" &&
        session.state.management.phase === "wave");
    }

    function syncPauseState() {
      if (!session) return;
      if (manuallyPaused || fatalPaused || panelSuspendsCombat()) session.pause();
      else session.resume();
    }

    function selectPad(padId, message, focusSource) {
      selectedPadId = padId;
      selectedPadFocusSource = focusSource || "map";
      setFeedback(message || "Build site selected. Battle is paused while the tower menu is open.");
      render();
      ui.storeClose.focus();
    }

    function closeStore() {
      const wasCombat = session && session.state.management.phase === "wave";
      const returnPadId = selectedPadId;
      const returnSource = selectedPadFocusSource;
      selectedPadId = null;
      selectedPadFocusSource = "map";
      syncPauseState();
      setFeedback(manuallyPaused
        ? "Tower menu closed; the battle remains paused."
        : (wasCombat ? "Tower menu closed; battle resumed." : "Tower menu closed."));
      render();
      const selector = returnSource === "site"
        ? '[data-site-pad-id="' + returnPadId + '"]'
        : (returnSource === "tower"
          ? '[data-tower-pad-id="' + returnPadId + '"]'
          : '[data-pad-id="' + returnPadId + '"]');
      const returnTarget = documentObject.querySelector(selector) ||
        documentObject.querySelector('[data-site-pad-id="' + returnPadId + '"]') ||
        documentObject.querySelector('[data-pad-id="' + returnPadId + '"]');
      if (returnTarget) returnTarget.focus();
    }

    function issue(fields, message) {
      try {
        const beforePending = session.pendingCommandCount;
        session.command(fields);
        setFeedback(session.pendingCommandCount > beforePending
          ? "Order ready. Close the tower menu to apply it and resume the battle."
          : (message || "Action applied."));
      } catch (error) {
        setFeedback(String(error && error.message || error));
      }
      render();
      if (selectedPadId) ui.storeClose.focus();
    }

    function renderSiteSelector(view, state) {
      const canAffordBuild = !Array.isArray(state.loadoutIds) || state.loadoutIds.some(function (defenseId) {
        return defenseView(runtime, defenseId, 1).costAether <= state.management.aether;
      });
      replaceChildren(ui.siteList, view.pads.map(function (pad, index) {
        const item = element(documentObject, "li", "preview-site-item");
        const button = element(documentObject, "button", "preview-site-button");
        const siteName = "Site " + (index + 1);
        const status = pad.tower
          ? pad.tower.name + " · Level " + pad.tower.level
          : (canAffordBuild ? "Empty" : "Empty · save more Aether");
        button.type = "button";
        button.setAttribute("data-site-pad-id", pad.id);
        button.setAttribute("data-site-number", String(index + 1));
        button.setAttribute("aria-pressed", String(pad.selected));
        button.setAttribute("aria-label", siteName + ". " + status + ". Open tower menu.");
        if (pad.selected) button.classList.add("is-selected");
        if (pad.tower) button.classList.add("is-occupied");
        if (!pad.tower && !canAffordBuild) button.classList.add("is-unaffordable");
        button.appendChild(element(documentObject, "span", "preview-site-name", siteName));
        button.appendChild(element(documentObject, "span", "preview-site-state", status));
        button.addEventListener("click", function () {
          selectPad(
            pad.id,
            pad.tower
              ? pad.tower.name + " level " + pad.tower.level + " selected. Upgrade, choose targets, or sell."
              : "Build site selected. Choose a tower.",
            "site"
          );
        });
        item.appendChild(button);
        return item;
      }));
    }

    function renderBattlefield(state) {
      const view = battlefieldView(runtime, state, selectedPadId);
      const svg = svgElement(documentObject, "svg", {
        class: "preview-battlefield-svg",
        viewBox: [view.viewBox.minX, view.viewBox.minY, view.viewBox.width, view.viewBox.height].join(" "),
        role: "group",
        "aria-labelledby": "previewBattlefieldSvgTitle previewBattlefieldSvgDescription",
        preserveAspectRatio: "xMidYMid meet",
      });
      svg.appendChild(svgElement(documentObject, "title", { id: "previewBattlefieldSvgTitle" },
        missionTitle(runtime, view.missionId) + " battlefield"));
      svg.appendChild(svgElement(documentObject, "desc", { id: "previewBattlefieldSvgDescription" },
        "Ancient Greek road map with clickable tower foundations, deployed towers, and approaching enemies."));
      const defs = svgElement(documentObject, "defs", {});
      if (view.missionArt) appendMissionRoadDefinitions(documentObject, defs, view.missionArt);
      svg.appendChild(defs);
      svg.appendChild(svgElement(documentObject, "rect", {
        class: "preview-battlefield-base",
        x: view.viewBox.minX,
        y: view.viewBox.minY,
        width: view.viewBox.width,
        height: view.viewBox.height,
      }));
      if (view.missionArt) {
        svg.appendChild(svgElement(documentObject, "image", {
          class: "preview-environment-plate",
          href: view.missionArt.environment.href,
          x: view.viewBox.minX,
          y: view.viewBox.minY,
          width: view.viewBox.width,
          height: view.viewBox.height,
          preserveAspectRatio: "none",
        }));
        appendMissionRoad(documentObject, svg, view.missionArt);
      } else {
        appendFallbackRoad(documentObject, svg, view.roadGeometry);
      }

      const selected = view.pads.find(function (pad) { return pad.selected && pad.tower; });
      if (selected) {
        svg.appendChild(svgElement(documentObject, "circle", {
          class: "preview-tower-range",
          cx: selected.x,
          cy: selected.y,
          r: selected.tower.range,
        }));
      }

      const anchorLayer = svgElement(documentObject, "g", { class: "preview-anchor-layer", "aria-hidden": "true" });
      view.anchors.forEach(function (anchor) {
        const group = svgElement(documentObject, "g", {
          class: "preview-anchor preview-anchor-" + anchor.kind,
          transform: "translate(" + anchor.x + " " + anchor.y + ")",
        });
        const anchorAsset = ANCHOR_ASSETS[anchor.kind];
        if (anchorAsset) {
          const size = anchor.kind === "gate" ? 17000 : 15000;
          group.appendChild(spriteImage(documentObject, anchorAsset, {
            class: "preview-anchor-sprite",
            x: -size / 2,
            y: -size * 0.68,
            width: size,
            height: size,
          }));
        }
        anchorLayer.appendChild(group);
      });
      svg.appendChild(anchorLayer);

      const padLayer = svgElement(documentObject, "g", { class: "preview-pad-layer" });
      const canAffordBuild = !Array.isArray(state.loadoutIds) || state.loadoutIds.some(function (defenseId) {
        return defenseView(runtime, defenseId, 1).costAether <= state.management.aether;
      });
      view.pads.forEach(function (pad) {
        const classNames = ["preview-map-pad"];
        if (pad.selected) classNames.push("is-selected");
        if (pad.tower) classNames.push("is-occupied");
        if (pad.foundation) classNames.push("has-foundation");
        if (!pad.tower && !canAffordBuild) classNames.push("is-unaffordable");
        const group = svgElement(documentObject, "g", {
          class: classNames.join(" "),
          transform: "translate(" + pad.x + " " + pad.y + ")",
          role: "button",
          tabindex: "0",
          "data-pad-id": pad.id,
          "aria-pressed": String(pad.selected),
          "aria-label": pad.tower
            ? pad.tower.name + ", level " + pad.tower.level + ". Open tower controls."
            : "Empty build site. Open tower menu.",
        });
        group.appendChild(svgElement(documentObject, "title", {}, pad.tower
          ? pad.tower.name + " · Level " + pad.tower.level
          : "Empty build site"));
        group.appendChild(svgElement(documentObject, "circle", { class: "preview-map-pad-halo", cx: 0, cy: 0, r: 7500 }));
        group.appendChild(svgElement(documentObject, "circle", { class: "preview-map-pad-core", cx: 0, cy: 0, r: 5600 }));
        if (pad.foundation) {
          group.appendChild(spriteImage(documentObject, pad.foundation, {
            class: "preview-map-pad-foundation",
            x: -7800,
            y: -7800,
            width: 15600,
            height: 15600,
          }));
        }
        if (pad.tower && pad.tower.asset && pad.tower.asset.kind === "atlas") {
          const frame = towerAnimationFrame(
            pad.tower.asset,
            pad.tower.level,
            view.tick,
            pad.tower.id,
            reduceMotion
          );
          group.appendChild(atlasSprite(documentObject, pad.tower.asset, frame, {
            class: "preview-tower-sprite",
            x: -10500,
            y: -12500,
            width: 21000,
            height: 21000,
            "data-frame": frame.frameName,
          }, "preview-tower-clip-" + pad.tower.id));
        } else if (pad.tower) {
          group.appendChild(svgElement(documentObject, "text", {
            class: "preview-map-symbol preview-tower-symbol",
            x: 0,
            y: 1700,
            "text-anchor": "middle",
          }, pad.tower.symbol));
        }
        if (pad.tower) {
          group.appendChild(svgElement(documentObject, "text", {
            class: "preview-map-level",
            x: 5200,
            y: -4300,
            "text-anchor": "middle",
          }, String(pad.tower.level)));
        }
        group.addEventListener("click", function () {
          selectPad(pad.id, pad.tower
            ? pad.tower.name + " level " + pad.tower.level + " selected. Upgrade, choose targets, or sell."
            : "Build site selected. Choose a tower.", "map");
        });
        group.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            group.dispatchEvent(new windowObject.Event("click"));
          }
        });
        padLayer.appendChild(group);
      });
      svg.appendChild(padLayer);

      const enemyLayer = svgElement(documentObject, "g", { class: "preview-enemy-layer", "aria-hidden": "true" });
      view.enemies.forEach(function (enemy) {
        const size = enemy.kind === "boss" ? 16000 : 10000;
        const phase = (view.tick + enemy.id * 7) % 24;
        const bob = reduceMotion ? 0 : (phase <= 12 ? phase : 24 - phase) * -85;
        const group = svgElement(documentObject, "g", {
          class: "preview-map-enemy preview-map-enemy-" + enemy.kind,
          transform: "translate(" + enemy.displayX + " " + (enemy.displayY + bob) + ")",
          "data-enemy-id": enemy.id,
        });
        group.appendChild(svgElement(documentObject, "title", {},
          enemy.name + " · " + Math.round(enemy.hpBp / 100) + "% vitality · " +
          Math.round(enemy.progressBp / 100) + "% route progress"));
        group.appendChild(svgElement(documentObject, "circle", {
          class: "preview-enemy-contrast",
          cx: 0,
          cy: 0,
          r: Math.floor(size * 0.43),
        }));
        if (enemy.asset && enemy.asset.kind === "atlas") {
          const frame = enemyAnimationFrame(enemy.asset, view.tick, enemy.id, reduceMotion);
          group.appendChild(atlasSprite(documentObject, enemy.asset, frame, {
            class: "preview-enemy-sprite",
            x: -size * 0.72,
            y: -size * 0.78,
            width: size * 1.44,
            height: size * 1.44,
            "data-frame": frame.frameName,
          }, "preview-enemy-clip-" + enemy.id));
        } else if (enemy.asset) {
          group.appendChild(spriteImage(documentObject, enemy.asset, {
            class: "preview-enemy-sprite",
            x: -size / 2,
            y: -size / 2,
            width: size,
            height: size,
          }));
        } else {
          group.appendChild(svgElement(documentObject, "text", {
            class: "preview-map-symbol preview-enemy-symbol",
            x: 0,
            y: 1300,
            "text-anchor": "middle",
          }, enemy.symbol));
        }
        group.appendChild(svgElement(documentObject, "rect", {
          class: "preview-hp-track",
          x: -size / 2,
          y: -size / 2 - 2200,
          width: size,
          height: 1200,
          rx: 500,
        }));
        group.appendChild(svgElement(documentObject, "rect", {
          class: "preview-hp-fill",
          x: -size / 2,
          y: -size / 2 - 2200,
          width: Math.max(0, Math.round(size * enemy.hpBp / 10000)),
          height: 1200,
          rx: 500,
        }));
        enemyLayer.appendChild(group);
      });
      svg.appendChild(enemyLayer);
      replaceChildren(ui.battlefield, [svg]);
      renderSiteSelector(view, state);
      ui.battlefieldStatus.textContent = view.enemies.length === 0
        ? "No enemies on the road · click a build site to deploy or manage a tower."
        : view.enemies.length + (view.enemies.length === 1 ? " enemy" : " enemies") +
          " on the road · defend the gate.";
    }

    function renderStore(state, mission) {
      if (!selectedPadId) {
        ui.storePanel.hidden = true;
        replaceChildren(ui.store, [element(documentObject, "p", "preview-empty", "Select a build site to open the tower menu.")]);
        return;
      }
      ui.storePanel.hidden = false;
      const commandWaiting = state.management.phase === "wave" && session.pendingCommandCount > 0;
      const managementLocked = manuallyPaused || fatalPaused || commandWaiting;
      const occupied = state.management.towers.find(function (tower) { return tower.padId === selectedPadId; });
      if (occupied) {
        const view = defenseView(runtime, occupied.defenseId, occupied.level);
        const upgradeGateOpen = state.management.tutorialUpgradeGateOpen;
        const card = element(documentObject, "article", "preview-card");
        appendTowerCardHeading(
          documentObject,
          card,
          view,
          "h3",
          view.name + " · LEVEL " + occupied.level,
          "manage-" + occupied.id + "-l" + occupied.level
        );
        card.appendChild(element(documentObject, "p", "", view.description));
        card.appendChild(element(documentObject, "p", "preview-stats",
          "Damage " + view.damage + " · " + attackRateLabel(view) + " · Range " + view.range +
          " · Targets " + view.targetKinds.join(" + ")));
        card.appendChild(element(documentObject, "p", "preview-muted", "Role: " + view.role));
        card.appendChild(element(documentObject, "p", "preview-muted", "Weakness: " + view.weakness));
        const next = occupied.level < view.levelCount ? defenseView(runtime, occupied.defenseId, occupied.level + 1) : null;
        if (next) {
          const delta = element(documentObject, "section", "preview-upgrade-delta");
          delta.appendChild(element(documentObject, "h4", "", "NEXT: LEVEL " + (occupied.level + 1) + " - " + next.costAether + " AETHER"));
          delta.appendChild(element(documentObject, "p", "preview-stats",
            "Damage " + view.damage + " -> " + next.damage +
            " | Rate " + attackRateLabel(view) + " -> " + attackRateLabel(next) +
            " | Range " + view.range + " -> " + next.range));
          delta.appendChild(element(documentObject, "p", "", next.description));
          card.appendChild(delta);
        }
        const actions = element(documentObject, "div", "preview-actions");
        const upgrade = element(documentObject, "button", "", next
          ? "Upgrade for " + next.costAether + " Aether" : "Maximum level");
        upgrade.type = "button";
        const upgradeNeed = next ? next.costAether - state.management.aether : 0;
        upgrade.disabled = !next || !upgradeGateOpen || managementLocked || upgradeNeed > 0;
        upgrade.hidden = !upgradeGateOpen;
        if (upgradeNeed > 0) {
          upgrade.className = "is-unaffordable";
          upgrade.title = "Need " + upgradeNeed + " more Aether";
        }
        upgrade.addEventListener("click", function () {
          issue({ type: "upgrade", towerId: occupied.id }, "Tower upgraded.");
        });
        actions.appendChild(upgrade);
        const policy = element(documentObject, "select");
        view.allowedTargetPolicyIds.forEach(function (policyId) {
          const option = element(documentObject, "option", "", TARGET_POLICY_LABELS[policyId] || policyId);
          option.value = policyId;
          option.selected = policyId === occupied.targetPolicy;
          policy.appendChild(option);
        });
        policy.disabled = managementLocked;
        policy.setAttribute("aria-label", "Target policy for " + view.name);
        policy.addEventListener("change", function () {
          issue({ type: "setTargetPolicy", towerId: occupied.id, policy: policy.value }, "Targeting changed.");
        });
        actions.appendChild(policy);
        const refund = runtime.economy.sellRefund(occupied.investedAether);
        const sell = element(documentObject, "button", "", "Sell for " + refund + " Aether");
        sell.type = "button";
        sell.disabled = managementLocked;
        sell.addEventListener("click", function () {
          const confirmed = windowObject.confirm(
            "Sell " + view.name + " for " + refund + " Aether?"
          );
          if (confirmed) {
            issue({ type: "sell", towerId: occupied.id }, "Tower sold.");
          }
        });
        actions.appendChild(sell);
        card.appendChild(actions);
        if (!upgradeGateOpen && next) {
          card.appendChild(element(documentObject, "p", "preview-need",
            "UPGRADES UNLOCK AFTER WAVE 1 OR SKIPPING THE TUTORIAL GATE"));
        } else if (next) {
          card.appendChild(element(documentObject, "p", upgradeNeed > 0 ? "preview-need" : "preview-ready",
            upgradeNeed > 0 ? "NEED " + upgradeNeed + " MORE AETHER TO UPGRADE" : "UPGRADE AVAILABLE"));
        }
        const nodes = [card];
        if (commandWaiting) nodes.push(element(documentObject, "p", "preview-ready",
          "ORDER READY — CLOSE THE TOWER MENU TO APPLY IT"));
        replaceChildren(ui.store, nodes);
        return;
      }

      const heading = element(documentObject, "h3", "", "CHOOSE A TOWER");
      const grid = element(documentObject, "div", "preview-card-grid");
      state.loadoutIds.forEach(function (defenseId) {
        const view = defenseView(runtime, defenseId, 1);
        const card = element(documentObject, "article", "preview-card");
        appendTowerCardHeading(documentObject, card, view, "h4", view.name, "build-" + defenseId);
        card.appendChild(element(documentObject, "p", "preview-role", "Role: " + view.role));
        card.appendChild(element(documentObject, "p", "", view.description));
        card.appendChild(element(documentObject, "p", "preview-stats",
          "Damage " + view.damage + " · " + attackRateLabel(view) + " · Range " + view.range +
          " · Targets " + view.targetKinds.join(" + ")));
        card.appendChild(element(documentObject, "p", "preview-muted", "Weakness: " + view.weakness));
        const build = element(documentObject, "button", "", "Build · " + view.costAether + " Aether");
        build.type = "button";
        const need = view.costAether - state.management.aether;
        build.disabled = managementLocked || need > 0;
        if (need > 0) {
          build.className = "is-unaffordable";
          build.title = "Need " + need + " more Aether";
        }
        build.setAttribute("aria-label", "Build " + view.name + " here for " + view.costAether + " Aether");
        build.addEventListener("click", function () {
          issue({ type: "build", padId: selectedPadId, defenseId: defenseId }, "Tower built.");
        });
        card.appendChild(build);
        card.appendChild(element(documentObject, "p", need > 0 ? "preview-need" : "preview-ready",
          need > 0 ? "NEED " + need + " MORE AETHER" : "AVAILABLE"));
        grid.appendChild(card);
      });
      const nodes = [heading, grid];
      if (commandWaiting) nodes.push(element(documentObject, "p", "preview-ready",
        "ORDER READY — CLOSE THE TOWER MENU TO APPLY IT"));
      replaceChildren(ui.store, nodes);
    }

    function cadenceRenderWouldReplaceFocus() {
      const active = documentObject.activeElement;
      if (!active || active === documentObject.body) return false;
      return [ui.battlefield, ui.siteList, ui.store, ui.towers].some(function (container) {
        return typeof container.contains === "function" && container.contains(active);
      });
    }

    function render() {
      if (!session) return;
      syncPauseState();
      const state = session.state;
      const mission = runtime.content.missions[state.missionId];
      ui.aether.textContent = String(state.management.aether);
      ui.integrity.textContent = String(state.integrity);
      ui.wave.textContent = String(state.management.activeWave || state.management.clearedWaves) + "/" + mission.waves.length;
      ui.score.textContent = String(state.score);
      ui.clock.textContent = String(state.tick);
      ui.startWave.disabled = state.management.phase !== "planning" || session.paused || state.outcome !== "active";
      ui.startWave.textContent = state.management.phase === "planning"
        ? "Start wave " + (state.management.clearedWaves + 1) : "Wave in progress";
      ui.pause.disabled = state.management.phase !== "wave" || state.outcome !== "active";
      ui.pause.textContent = manuallyPaused ? "Resume" : "Pause";
      ui.pause.setAttribute("aria-pressed", String(manuallyPaused));
      ui.skipTutorial.hidden = state.management.tutorialUpgradeGateOpen;
      ui.skipTutorial.disabled = manuallyPaused || fatalPaused;
      renderBattlefield(state);
      renderStore(state, mission);

      const towerNodes = state.management.towers.map(function (tower, index) {
        const view = defenseView(runtime, tower.defenseId, tower.level);
        const button = element(documentObject, "button", "preview-tower-row",
          "Tower " + (index + 1) + " · " + view.name + " · Level " + tower.level +
          " · " + tower.investedAether + " Aether invested · Targets " +
          (TARGET_POLICY_LABELS[tower.targetPolicy] || tower.targetPolicy).toLowerCase());
        button.type = "button";
        button.setAttribute("data-tower-pad-id", tower.padId);
        button.addEventListener("click", function () { selectPad(tower.padId, null, "tower"); });
        return button;
      });
      replaceChildren(ui.towers, towerNodes.length ? towerNodes : [element(documentObject, "p", "preview-empty", "No towers built.")]);

      const strings = presentationStrings(runtime.presentation);
      replaceChildren(ui.objectives, state.objectiveResults.map(function (objective) {
        const definition = mission.objectives.find(function (candidate) { return candidate.id === objective.id; });
        const title = definition ? stringValue(strings, definition.titleKey, objective.id) : objective.id;
        const row = element(documentObject, "li", objective.complete ? "is-complete" : "");
        row.textContent = title + ": " + objective.current + " / " + objective.target +
          " · " + (objective.complete ? "complete" : (objective.eligible ? "eligible" : "in progress"));
        return row;
      }));
      const recentEvents = session.events.slice(-20).reverse();
      replaceChildren(ui.events, recentEvents.length ? recentEvents.map(function (event) {
        const row = element(documentObject, "li");
        row.textContent = (event.eventId || event.type || "event") + (event.payload ? " · " + JSON.stringify(event.payload) : "");
        return row;
      }) : [element(documentObject, "li", "preview-empty", "No events yet.")]);

      ui.outcome.hidden = state.outcome === "active";
      if (state.outcome === "active") {
        renderedShareState = null;
        renderedShareModel = null;
        ui.shareDownload.disabled = true;
        ui.shareStatus.textContent = "";
      } else {
        ui.outcomeTitle.textContent = state.outcome === "victory" ? "LOCAL VICTORY" : "DEFEAT";
        renderResultCard(state);
      }
      ui.bootStatus.textContent = "Candidate-BAL · " + runtime.release.approvalState +
        " · " + runtime.release.contentVersion + " · LOCAL / UNVERIFIED";
    }

    function resetSession() {
      try {
        const header = createHeader(runtime, {
          missionId: ui.mission.value,
          difficultyId: ui.difficulty.value,
          assist: ui.assist.checked,
          seed: Number(ui.seed.value),
          loadoutIds: selectedLoadout(),
        });
        session = createSession(runtime, header);
        selectedPadId = null;
        manuallyPaused = false;
        fatalPaused = false;
        renderedShareState = null;
        renderedShareModel = null;
        visualTicksSinceRender = 0;
        setFeedback("Plan your defense. Choose an empty build site to place a tower.");
        render();
      } catch (error) {
        setFeedback(String(error && error.message || error));
      }
    }

    populateMissions();
    populateLoadout();
    ui.mission.addEventListener("change", populateLoadout);
    ui.loadout.addEventListener("change", function (event) {
      const selected = ui.loadout.querySelectorAll('input[name="preview-defense"]:checked');
      if (selected.length > MAX_LOADOUT && event.target && event.target.name === "preview-defense") {
        event.target.checked = false;
        setFeedback("The current campaign slice allows four equipped defenses.");
      }
    });
    ui.reset.addEventListener("click", resetSession);
    ui.startWave.addEventListener("click", function () { issue({ type: "startWave" }, "Wave started."); });
    ui.pause.addEventListener("click", function () {
      manuallyPaused = !manuallyPaused;
      syncPauseState();
      setFeedback(manuallyPaused
        ? "Battle paused."
        : (panelSuspendsCombat()
          ? "Manual pause released; close the tower menu to resume the battle."
          : "Battle resumed."));
      render();
    });
    ui.storeClose.addEventListener("click", closeStore);
    ui.shareDownload.addEventListener("click", downloadResultCard);
    documentObject.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && selectedPadId) {
        event.preventDefault();
        closeStore();
      }
    });
    ui.skipTutorial.addEventListener("click", function () {
      issue({ type: "skipTutorialGate" }, "Upgrades unlocked for this test.");
    });
    resetSession();

    timer = windowObject.setInterval(function () {
      if (!session) return;
      try {
        const priorPhase = session.state.management.phase;
        const priorOutcome = session.state.outcome;
        const result = session.step();
        if (!result.advanced) return;
        const commandEvent = result.events.slice().reverse().find(function (event) {
          return ["build", "upgrade", "sell", "targetPolicy", "denied"].includes(event.type);
        });
        if (commandEvent) {
          setFeedback(commandEvent.type === "denied"
            ? "That action is not available: " + commandEvent.reason + "."
            : "Queued " + commandEvent.type + " applied.");
        }
        visualTicksSinceRender += 1;
        const renderInterval = Math.max(1, Math.floor(runtime.simulation.TICKS_PER_SECOND / VISUAL_FPS));
        const structuralChange = session.state.management.phase !== priorPhase ||
          session.state.outcome !== priorOutcome;
        if (visualTicksSinceRender >= renderInterval || structuralChange) {
          if (structuralChange || !cadenceRenderWouldReplaceFocus()) {
            visualTicksSinceRender = 0;
            render();
          }
        }
      } catch (error) {
        fatalPaused = true;
        session.pause();
        setFeedback("Simulation stopped safely: " + String(error && error.message || error));
        render();
      }
    }, 1000 / runtime.simulation.TICKS_PER_SECOND);

    documentObject.body.dataset.ready = "1";
    windowObject.__gameslop = {
      preview: true,
      releaseId: runtime.descriptor.id,
      get state() { return session && session.state; },
      get paused() { return session && session.paused; },
      get manuallyPaused() { return manuallyPaused; },
      get storeOpen() { return Boolean(selectedPadId); },
    };
    return Object.freeze({
      dispose: function () {
        if (timer !== null) windowObject.clearInterval(timer);
        timer = null;
      },
      get session() { return session; },
      render: render,
    });
  }

  return deepFreeze({
    MAX_LOADOUT: MAX_LOADOUT,
    VISUAL_FPS: VISUAL_FPS,
    battlefieldView: battlefieldView,
    createHeader: createHeader,
    createSession: createSession,
    defenseView: defenseView,
    mount: mount,
    resultCardModel: resultCardModel,
  });
});
