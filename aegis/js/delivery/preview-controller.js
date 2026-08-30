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
    commonJs ? require("../presentation/share-card.js") : installedGame && installedGame.AegisShareCard,
    commonJs ? require("./battle-session.js") : installedGame && installedGame.AegisBattleSession,
    commonJs ? require("./shell.js") : installedGame && installedGame.AegisShell,
    commonJs ? require("../presentation/shell-view.js") : installedGame && installedGame.AegisShellView,
    commonJs ? require("./run-header-v2.js") : installedGame && installedGame.AegisRunHeaderV2,
    commonJs ? require("./session-store.js") : installedGame && installedGame.AegisSessionStore,
    commonJs ? require("../progression/profile-v2.js") : installedGame && installedGame.AegisProfileV2,
    commonJs ? require("../progression/progression.js") : installedGame && installedGame.AegisProgression
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
  ShareCard,
  BattleSession,
  Shell,
  ShellView,
  RunHeaderV2,
  SessionStore,
  Profile,
  Progression
) {
  "use strict";

  if (!Camera || !RoadGeometry || !M01Art || !ActIArt || !SpriteAtlas || !ShareCard) {
    throw new Error("Aegis preview requires camera, road, Act I art, sprite-atlas, and share-card presentation modules");
  }
  if (!BattleSession || !Shell || !ShellView || !RunHeaderV2 || !SessionStore || !Profile || !Progression) {
    throw new Error("Aegis preview requires the battle session, shell, shell view, run header, store, and progression modules");
  }

  const MAX_LOADOUT = 4;
  const VISUAL_FPS = 60;
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
  const COVERAGE_CACHE = new WeakMap();
  /* Presentation cadence only. Every pose boundary below is measured against the
     authoritative cooldown the kernel already publishes, never against frames. */
  const TOWER_ACTIVE_MS = 150;
  const TOWER_RECOVER_MS = 250;
  const TOWER_REST_FRAME = "idleA";
  const ENEMY_WALK_FRAMES = Object.freeze(["runA", "runB", "runC", "runB"]);
  const ENEMY_WALK_HOLD_TICKS = 8;
  const ENEMY_WALK_STAGGER_TICKS = 5;
  const PROJECTILE_TRAVEL_MS = 320;
  const PROJECTILE_IMPACT_FRACTION = 0.24;
  const MAX_PROJECTILE_CUES = 48;

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
      output = output.split("{" + placeholder.name + "}").join(value === null || value === undefined ? "-" : String(value));
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

  function resultCardModel(runtimeInput, state, options) {
    const runtime = assertRuntime(runtimeInput);
    const challengeLine = options && typeof options.challengeLine === "string" && options.challengeLine
      ? options.challengeLine : null;
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
      challengeLine: challengeLine,
    });
  }

  function attackCadenceLabel(view) {
    return view.cooldownMs === null ? "continuous" : "every " + view.cooldownMs + " ms";
  }

  /* The run header and the session live in battle-session.js so the shell can
     own navigation while one module owns the authoritative run. */
  const missionIdsFor = BattleSession.missionIdsFor;
  const createHeader = BattleSession.createHeader;
  const createSession = BattleSession.createSession;

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

  /* ---------------------------------------------------- coverage preview

     Spec 6.6 asks that selecting a site or previewing a build show the exact
     range circle and the road arc(s) that reach can affect. The windows below
     are the same merged coverage intervals the authoring analyzer computes, but
     they are derived here from the compiled route polyline at runtime and are
     never told to the player as bands, exposure figures, or quality labels. */

  /* Coverage walks the polyline in route-distance space, so each segment carries
     its own cumulative start recomputed from the compiled points themselves. */
  function coverageSegments(segments) {
    let start = 0;
    return segments.map(function (segment) {
      const length = Math.hypot(segment.toX - segment.fromX, segment.toY - segment.fromY);
      const record = {
        fromX: segment.fromX,
        fromY: segment.fromY,
        toX: segment.toX,
        toY: segment.toY,
        start: start,
        length: length,
      };
      start += length;
      return record;
    });
  }

  function segmentCoverageWindow(segment, x, y, range) {
    const deltaX = segment.toX - segment.fromX;
    const deltaY = segment.toY - segment.fromY;
    const length = segment.length;
    if (!(length > 0)) return null;
    const unitX = deltaX / length;
    const unitY = deltaY / length;
    const offsetX = x - segment.fromX;
    const offsetY = y - segment.fromY;
    const along = offsetX * unitX + offsetY * unitY;
    const perpendicular = Math.abs(offsetX * unitY - offsetY * unitX);
    if (perpendicular > range) return null;
    const half = Math.sqrt(Math.max(0, range * range - perpendicular * perpendicular));
    const start = Math.max(0, along - half);
    const end = Math.min(length, along + half);
    if (end <= start) return null;
    return { start: segment.start + start, end: segment.start + end };
  }

  function mergedCoverageWindows(segments, x, y, range) {
    const raw = [];
    segments.forEach(function (segment) {
      const window = segmentCoverageWindow(segment, x, y, range);
      if (window) raw.push(window);
    });
    raw.sort(function (left, right) { return left.start - right.start; });
    const merged = [];
    raw.forEach(function (candidate) {
      const current = merged[merged.length - 1];
      if (current && candidate.start <= current.end) {
        if (candidate.end > current.end) current.end = candidate.end;
        return;
      }
      merged.push({ start: candidate.start, end: candidate.end });
    });
    return merged;
  }

  function coveragePointAt(segments, distance) {
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (!(segment.length > 0)) continue;
      if (distance <= segment.start + segment.length || index === segments.length - 1) {
        const local = Math.max(0, Math.min(segment.length, distance - segment.start));
        return {
          x: Math.round(segment.fromX + (segment.toX - segment.fromX) * local / segment.length),
          y: Math.round(segment.fromY + (segment.toY - segment.fromY) * local / segment.length),
        };
      }
    }
    return null;
  }

  function coverageArcPoints(segments, window) {
    const points = [];
    const push = function (point) {
      if (!point) return;
      const previous = points[points.length - 1];
      if (previous && previous.x === point.x && previous.y === point.y) return;
      points.push(point);
    };
    push(coveragePointAt(segments, window.start));
    segments.forEach(function (segment) {
      const joint = segment.start + segment.length;
      if (joint > window.start && joint < window.end) push({ x: segment.toX, y: segment.toY });
    });
    push(coveragePointAt(segments, window.end));
    return points;
  }

  function coverageHint(routeCount, windowCount) {
    if (windowCount <= 0) return "No road within reach";
    if (routeCount > 1) {
      return windowCount === routeCount
        ? "Covers " + routeCount + " enemy paths"
        : "Covers " + windowCount + " stretches across " + routeCount + " enemy paths";
    }
    if (windowCount === 1) return "Covers one stretch of road";
    if (windowCount === 2) return "Covers the road twice";
    return "Covers the road " + windowCount + " times";
  }

  function computePadCoverage(routes, x, y, range) {
    const arcs = [];
    let routeCount = 0;
    routes.forEach(function (route) {
      const windows = mergedCoverageWindows(route.segments, x, y, range);
      if (windows.length) routeCount += 1;
      windows.forEach(function (window) {
        arcs.push({ routeId: route.id, points: coverageArcPoints(route.segments, window) });
      });
    });
    return deepFreeze({
      range: range,
      windowCount: arcs.length,
      hint: coverageHint(routeCount, arcs.length),
      arcs: arcs,
    });
  }

  function cachedPadCoverage(map, routes, pad, range) {
    let entry = COVERAGE_CACHE.get(map);
    if (!entry) {
      entry = {
        routes: routes.map(function (route) {
          return { id: route.id, segments: coverageSegments(route.segments) };
        }),
        byPad: new Map(),
      };
      COVERAGE_CACHE.set(map, entry);
    }
    const key = pad.id + "@" + range;
    let coverage = entry.byPad.get(key);
    if (!coverage) {
      coverage = computePadCoverage(entry.routes, pad.x, pad.y, range);
      entry.byPad.set(key, coverage);
    }
    return coverage;
  }

  const EMPTY_COVERAGE = deepFreeze({
    range: null,
    windowCount: 0,
    hint: "Select a tower to preview its reach",
    arcs: [],
  });

  function levelRangeMilliUnits(runtime, defenseId) {
    const defense = runtime.content.defenses[defenseId];
    if (!defense || !Array.isArray(defense.levels) || !defense.levels.length) return null;
    const range = defense.levels[0].rangeWorldUnits;
    return Number.isFinite(range) ? range : null;
  }

  /* The reach a build site is previewed at: the tower being inspected in the
     menu when there is one, otherwise the shortest reach the player could
     actually place, so an empty site never over-promises. */
  function previewRangeMilliUnits(runtime, state, previewDefenseId) {
    if (previewDefenseId) {
      const previewed = levelRangeMilliUnits(runtime, previewDefenseId);
      if (previewed !== null) return previewed;
    }
    const loadoutIds = Array.isArray(state.loadoutIds) ? state.loadoutIds : [];
    let shortest = null;
    loadoutIds.forEach(function (defenseId) {
      const range = levelRangeMilliUnits(runtime, defenseId);
      if (range === null) return;
      if (shortest === null || range < shortest) shortest = range;
    });
    return shortest;
  }

  /* ----------------------------------------------------- tower fire phase

     A tower "just fired" when its authoritative attack cooldown has only just
     been reloaded. `state.timers` carries the kernel's per-tower runtime record
     and each cooldown behavior's remaining time units; the authored cooldown of
     the same compiled behavior gives the full reload, so the elapsed reload is
     an exact canonical quantity rather than an animation counter. */

  function behaviorCooldownMs(behavior) {
    const parameters = behavior && behavior.parameters;
    if (!parameters) return null;
    if (own(parameters, "cooldownMs") && parameters.cooldownMs) return parameters.cooldownMs;
    if (own(parameters, "cadenceMs") && parameters.cadenceMs) return parameters.cadenceMs;
    return null;
  }

  function towerFireState(runtime, state, tower, level) {
    const runtimes = Array.isArray(state.timers) ? state.timers : null;
    if (!runtimes || !level || !Array.isArray(level.behaviors)) return null;
    const record = runtimes.find(function (candidate) {
      return candidate && candidate.towerRuntimeId === tower.id;
    });
    if (!record || !Array.isArray(record.behaviorStates)) return null;
    const ticksPerSecond = runtime.simulation.TICKS_PER_SECOND;
    if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0) return null;
    let nearest = null;
    record.behaviorStates.forEach(function (behaviorState) {
      const timer = behaviorState && behaviorState.timer;
      const remaining = timer && timer.remainingUnits;
      if (!Number.isFinite(remaining) || remaining <= 0) return;
      const behavior = level.behaviors[behaviorState.index] ||
        level.behaviors.find(function (candidate) { return candidate.id === behaviorState.behaviorId; });
      const cooldownMs = behaviorCooldownMs(behavior);
      if (!cooldownMs) return;
      /* An external rate source can shorten or lengthen the scheduled reload, so
         the reload actually in flight is never assumed shorter than what is left. */
      const reloadUnits = Math.max(cooldownMs * ticksPerSecond, remaining);
      const elapsedUnits = reloadUnits - remaining;
      if (nearest === null || elapsedUnits < nearest.elapsedUnits) {
        nearest = { elapsedUnits: elapsedUnits, reloadUnits: reloadUnits };
      }
    });
    return nearest;
  }

  function towerVisualState(fire, reduceMotion, ticksPerSecond) {
    const resting = { frameName: TOWER_REST_FRAME, action: "idle", progressBp: 0 };
    if (reduceMotion || !fire) return resting;
    if (fire) {
      const quarterReload = Math.floor(fire.reloadUnits / 4);
      const activeUnits = Math.min(TOWER_ACTIVE_MS * ticksPerSecond, quarterReload);
      const recoverUnits = Math.min(TOWER_RECOVER_MS * ticksPerSecond, quarterReload);
      if (activeUnits > 0 && fire.elapsedUnits < activeUnits) {
        return {
          frameName: "active",
          action: "active",
          progressBp: Math.floor(fire.elapsedUnits * 10000 / activeUnits),
        };
      }
      if (recoverUnits > 0 && fire.elapsedUnits < activeUnits + recoverUnits) {
        return {
          frameName: "recover",
          action: "recover",
          progressBp: Math.floor((fire.elapsedUnits - activeUnits) * 10000 / recoverUnits),
        };
      }
    }
    return resting;
  }

  function towerFrameBlend(tower) {
    if (!tower || tower.action === "idle") {
      return { from: TOWER_REST_FRAME, to: TOWER_REST_FRAME, mixBp: 0, recoilY: 0 };
    }
    const progress = Math.max(0, Math.min(1, tower.actionProgressBp / 10000));
    if (tower.action === "active") {
      return {
        from: TOWER_REST_FRAME,
        to: "active",
        mixBp: Math.min(10000, Math.round(progress / 0.58 * 10000)),
        recoilY: Math.round(Math.sin(Math.PI * progress) * 850),
      };
    }
    if (progress < 0.46) {
      return {
        from: "active",
        to: "recover",
        mixBp: Math.round(progress / 0.46 * 10000),
        recoilY: Math.round((1 - progress / 0.46) * 520),
      };
    }
    return {
      from: "recover",
      to: TOWER_REST_FRAME,
      mixBp: Math.round((progress - 0.46) / 0.54 * 10000),
      recoilY: 0,
    };
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

  /* Converts real kernel damage telemetry into short-lived presentation cues.
     The cue keeps its event-time endpoint so a killing shot still visibly lands
     after the authoritative enemy has been removed from the next state. Splash
     attacks emit one readable projectile per tower activation, not one per
     collateral target. */
  function projectileCuesForStep(runtimeInput, priorState, stepResult) {
    const runtime = assertRuntime(runtimeInput);
    const diagnostics = stepResult && stepResult.telemetry;
    const telemetry = Array.isArray(diagnostics) ? diagnostics
      : (diagnostics && Array.isArray(diagnostics.records) ? diagnostics.records : []);
    if (!priorState || !priorState.management || !Array.isArray(priorState.management.towers) ||
        !Array.isArray(priorState.enemies)) return deepFreeze([]);
    const mission = runtime.content.missions[priorState.missionId];
    const map = mission && runtime.content.maps[mission.mapId];
    if (!map || !Array.isArray(map.pads) || !Array.isArray(map.routes)) return deepFreeze([]);
    const towers = new Map(priorState.management.towers.map(function (tower) { return [tower.id, tower]; }));
    const pads = new Map(map.pads.map(function (pad) { return [pad.id, pad]; }));
    const enemies = new Map(priorState.enemies.map(function (enemy) { return [enemy.id, enemy]; }));
    const seenTowers = new Set();
    const durationTicks = Math.max(2, Math.round(
      PROJECTILE_TRAVEL_MS * runtime.simulation.TICKS_PER_SECOND / 1000
    ));
    const cues = [];
    telemetry.forEach(function (record) {
      if (!record || record.kind !== "damage" || !Number.isSafeInteger(record.sourceTowerRuntimeId) ||
          seenTowers.has(record.sourceTowerRuntimeId)) return;
      const tower = towers.get(record.sourceTowerRuntimeId);
      const pad = tower && pads.get(tower.padId);
      const enemy = enemies.get(record.targetRuntimeId);
      if (!tower || !pad || !enemy) return;
      const route = map.routes.find(function (candidate) { return candidate.id === enemy.routeId; });
      const segments = route ? routeSegments(map, route) : null;
      const target = presentationLanePosition(enemy.position, segments, enemy.id);
      seenTowers.add(tower.id);
      cues.push({
        id: priorState.tick + "-" + tower.id + "-" + enemy.id,
        bornTick: priorState.tick,
        durationTicks: durationTicks,
        towerRuntimeId: tower.id,
        targetRuntimeId: enemy.id,
        defenseId: tower.defenseId,
        fromX: pad.x,
        fromY: pad.y - 3600,
        toX: target.x,
        toY: target.y - 800,
      });
    });
    return deepFreeze(cues);
  }

  function battlefieldView(runtimeInput, state, selectedPadId, viewOptions) {
    const runtime = assertRuntime(runtimeInput);
    const options = viewOptions || {};
    const reduceMotion = options.reduceMotion === true;
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
    const menuRange = previewRangeMilliUnits(runtime, state, options.previewDefenseId);
    let selection = null;
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
        const visual = towerVisualState(
          towerFireState(runtime, state, tower, level),
          reduceMotion,
          runtime.simulation.TICKS_PER_SECOND
        );
        towerView = {
          id: tower.id,
          defenseId: tower.defenseId,
          level: tower.level,
          name: view.name,
          range: level.rangeWorldUnits,
          symbol: shortSymbol(tower.defenseId),
          frameName: visual.frameName,
          action: visual.action,
          actionProgressBp: visual.progressBp,
          asset: atlas ? {
            kind: "atlas",
            href: atlas.href,
            metadata: atlas.metadata,
            fallbackSymbol: shortSymbol(tower.defenseId),
          } : null,
        };
      }
      const reach = towerView ? towerView.range : menuRange;
      const coverage = Number.isFinite(reach) && reach > 0
        ? cachedPadCoverage(map, routes, pad, reach)
        : EMPTY_COVERAGE;
      const selected = selectedPadId === pad.id;
      if (selected && coverage !== EMPTY_COVERAGE) {
        selection = {
          padId: pad.id,
          x: pad.x,
          y: pad.y,
          range: coverage.range,
          windowCount: coverage.windowCount,
          hint: coverage.hint,
          arcs: coverage.arcs,
        };
      }
      return {
        id: pad.id,
        x: pad.x,
        y: pad.y,
        selected: selected,
        foundation: !tower && missionArt ? SHARED_FOUNDATION_ASSET : null,
        tower: towerView,
        coverage: {
          range: coverage.range,
          windowCount: coverage.windowCount,
          hint: coverage.hint,
        },
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
    const projectiles = (Array.isArray(options.projectiles) ? options.projectiles : []).map(function (cue) {
      const progress = Math.max(0, Math.min(1, (state.tick - cue.bornTick) / cue.durationTicks));
      const arc = cue.defenseId === "siege" ? 10500 : 2200;
      return Object.assign({}, cue, {
        progressBp: Math.round(progress * 10000),
        x: Math.round(cue.fromX + (cue.toX - cue.fromX) * progress),
        y: Math.round(cue.fromY + (cue.toY - cue.fromY) * progress - Math.sin(Math.PI * progress) * arc),
        impacting: progress >= 1 - PROJECTILE_IMPACT_FRACTION,
      });
    });
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
      selection: selection,
      enemies: enemies,
      projectiles: projectiles,
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

  function towerAttackEffect(documentObject, tower) {
    if (!tower || tower.action === "idle") return null;
    const progress = Math.max(0, Math.min(1, tower.actionProgressBp / 10000));
    const strength = tower.action === "active" ? 1 - progress * 0.35 : (1 - progress) * 0.65;
    const group = svgElement(documentObject, "g", {
      class: "preview-tower-effect preview-tower-effect-" + tower.defenseId,
      "data-action": tower.action,
      "data-progress-bp": tower.actionProgressBp,
      opacity: strength.toFixed(3),
    });
    if (tower.defenseId === "chronos" || tower.defenseId === "oracle") {
      group.appendChild(svgElement(documentObject, "ellipse", {
        class: "preview-tower-effect-ring preview-tower-effect-ring-a",
        cx: 0, cy: -1700, rx: 7200 + progress * 800, ry: 2600,
        transform: "rotate(" + Math.round(progress * 150) + " 0 -1700)",
      }));
      group.appendChild(svgElement(documentObject, "ellipse", {
        class: "preview-tower-effect-ring preview-tower-effect-ring-b",
        cx: 0, cy: -1700, rx: 4700, ry: 7200 + progress * 500,
        transform: "rotate(" + Math.round(-progress * 110) + " 0 -1700)",
      }));
      group.appendChild(svgElement(documentObject, "circle", {
        class: "preview-tower-effect-core", cx: 0, cy: -1700, r: 1200 + strength * 1050,
      }));
    } else if (tower.defenseId === "sentinel" || tower.defenseId === "hoplite") {
      const reach = 5400 + progress * 4300;
      group.appendChild(svgElement(documentObject, "line", {
        class: "preview-tower-effect-bolt", x1: 2400, y1: -3600, x2: reach, y2: -5000,
      }));
      group.appendChild(svgElement(documentObject, "circle", {
        class: "preview-tower-effect-muzzle", cx: 2800, cy: -3750, r: 850 + strength * 900,
      }));
      group.appendChild(svgElement(documentObject, "path", {
        class: "preview-tower-effect-spark",
        d: "M 2800 -6200 L 3300 -4400 L 5100 -4700 L 3600 -3600 L 4400 -1900 L 2850 -3000 L 1500 -1800 L 2200 -3650 L 600 -4500 L 2350 -4450 Z",
      }));
    } else {
      group.appendChild(svgElement(documentObject, "circle", {
        class: "preview-tower-effect-shell", cx: 2500 + progress * 4700, cy: -6500 - progress * 2600,
        r: 900 + strength * 650,
      }));
      group.appendChild(svgElement(documentObject, "circle", {
        class: "preview-tower-effect-shockwave", cx: 1700, cy: -5700,
        r: 1700 + progress * 3100,
      }));
    }
    return group;
  }

  function projectileEffect(documentObject, projectile, reduceMotion) {
    const progress = projectile.progressBp / 10000;
    const group = svgElement(documentObject, "g", {
      class: "preview-projectile preview-projectile-" + projectile.defenseId,
      "data-projectile-id": projectile.id,
      "data-tower-id": projectile.towerRuntimeId,
      "data-target-id": projectile.targetRuntimeId,
      "data-progress-bp": projectile.progressBp,
      "aria-hidden": "true",
    });
    if (!reduceMotion && !projectile.impacting) {
      group.appendChild(svgElement(documentObject, "line", {
        class: "preview-projectile-trail",
        x1: projectile.fromX,
        y1: projectile.fromY,
        x2: projectile.x,
        y2: projectile.y,
      }));
      group.appendChild(svgElement(documentObject, "circle", {
        class: "preview-projectile-core",
        cx: projectile.x,
        cy: projectile.y,
        r: projectile.defenseId === "siege" ? 1450 : 1050,
      }));
      group.appendChild(svgElement(documentObject, "circle", {
        class: "preview-projectile-glow",
        cx: projectile.x,
        cy: projectile.y,
        r: projectile.defenseId === "siege" ? 2600 : 1950,
      }));
    }
    if (progress < 0.28) {
      group.appendChild(svgElement(documentObject, "circle", {
        class: "preview-projectile-muzzle",
        cx: projectile.fromX,
        cy: projectile.fromY,
        r: 900 + Math.round((0.28 - progress) * 5200),
      }));
    }
    if (projectile.impacting || reduceMotion) {
      const impactProgress = reduceMotion ? 0.55
        : (progress - (1 - PROJECTILE_IMPACT_FRACTION)) / PROJECTILE_IMPACT_FRACTION;
      group.appendChild(svgElement(documentObject, "circle", {
        class: "preview-projectile-impact",
        cx: projectile.toX,
        cy: projectile.toY,
        r: 1700 + Math.round(Math.max(0, impactProgress) * 4300),
      }));
      group.appendChild(svgElement(documentObject, "path", {
        class: "preview-projectile-impact-star",
        transform: "translate(" + projectile.toX + " " + projectile.toY + ") scale(" +
          (0.7 + Math.max(0, impactProgress) * 0.55).toFixed(2) + ")",
        d: "M 0 -4300 L 950 -1250 L 4100 -1500 L 1550 450 L 2650 3400 L 0 1750 L -2650 3400 L -1550 450 L -4100 -1500 L -950 -1250 Z",
      }));
    }
    return group;
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

  /* The walk cycle reads as walking, not strobing: one pose is held for roughly
     an eighth of a second at the 60 Hz simulation rate, staggered per runtime so
     a column of hostiles does not march in lockstep. */
  function enemyFrameBlend(asset, tick, runtimeId, reduceMotion) {
    if (reduceMotion) {
      const frame = SpriteAtlas.enemyFrame(asset.metadata, "idleB");
      return { from: frame, to: frame, mixBp: 0 };
    }
    const phase = (tick + runtimeId * ENEMY_WALK_STAGGER_TICKS) %
      (ENEMY_WALK_HOLD_TICKS * ENEMY_WALK_FRAMES.length);
    const index = Math.floor(phase / ENEMY_WALK_HOLD_TICKS);
    const frameTick = phase % ENEMY_WALK_HOLD_TICKS;
    const nextIndex = (index + 1) % ENEMY_WALK_FRAMES.length;
    return {
      from: SpriteAtlas.enemyFrame(asset.metadata, ENEMY_WALK_FRAMES[index]),
      to: SpriteAtlas.enemyFrame(asset.metadata, ENEMY_WALK_FRAMES[nextIndex]),
      mixBp: Math.round(frameTick * 10000 / (ENEMY_WALK_HOLD_TICKS - 1)),
    };
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

  function mountBattle(runtimeInput, options) {
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
      siteList: requiredElement(documentObject, "previewSiteList"),
      storePanel: requiredElement(documentObject, "previewStorePanel"),
      storeClose: requiredElement(documentObject, "previewStoreClose"),
      store: requiredElement(documentObject, "previewStore"),
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
    /* Which tower the tower menu is currently previewing. It only steers the
       range circle, the covered-road highlight, and the plain-language coverage
       hint; it never touches a command or the authoritative state. */
    let previewDefenseId = null;
    let timer = null;
    let visualTicksSinceRender = 0;
    let projectileCues = [];
    let manuallyPaused = false;
    let fatalPaused = false;
    let renderedShareState = null;
    let renderedShareModel = null;
    let outcomeReported = false;
    const reduceMotion = typeof windowObject.matchMedia === "function" &&
      windowObject.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function currentMission() {
      return runtime.content.missions[ui.mission.value];
    }

    function populateMissions() {
      replaceChildren(ui.mission, missionIdsFor(runtime).map(function (missionId) {
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
        model = resultCardModel(runtime, state, {
          challengeLine: typeof options.resultChallengeLine === "function"
            ? options.resultChallengeLine(state) : null,
        });
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

    /* The menu opens already previewing something buildable, so an empty site
       shows a real range circle and covered road the moment it is chosen. */
    function defaultPreviewDefenseId(state, padId) {
      if (state.management.towers.some(function (tower) { return tower.padId === padId; })) return null;
      const loadoutIds = Array.isArray(state.loadoutIds) ? state.loadoutIds : [];
      const affordable = loadoutIds.find(function (defenseId) {
        return defenseView(runtime, defenseId, 1).costAether <= state.management.aether;
      });
      return affordable || loadoutIds[0] || null;
    }

    function selectPad(padId, message, focusSource) {
      selectedPadId = padId;
      selectedPadFocusSource = focusSource || "map";
      previewDefenseId = session ? defaultPreviewDefenseId(session.state, padId) : null;
      setFeedback(message || "Build site selected. Battle is paused while the tower menu is open.");
      render();
      revealBattlefield();
      focusWithoutScroll(ui.storeClose);
    }

    /* Previewing redraws the menu, so keyboard focus is put back on the same
       tower's Build control instead of falling out to the document. */
    function previewDefense(defenseId) {
      if (previewDefenseId === defenseId) return;
      const active = documentObject.activeElement;
      const focusedCard = active && typeof active.closest === "function"
        ? active.closest("[data-build-defense-id]") : null;
      const focusedDefenseId = focusedCard ? focusedCard.getAttribute("data-build-defense-id") : null;
      previewDefenseId = defenseId;
      render();
      if (!focusedDefenseId) return;
      const card = documentObject.querySelector('[data-build-defense-id="' + focusedDefenseId + '"]');
      const control = card && card.querySelector("button");
      if (control) control.focus();
    }

    function closeStore(feedbackMessage) {
      const wasCombat = session && session.state.management.phase === "wave";
      const returnPadId = selectedPadId;
      const returnSource = selectedPadFocusSource;
      selectedPadId = null;
      selectedPadFocusSource = "map";
      previewDefenseId = null;
      syncPauseState();
      setFeedback(feedbackMessage || (manuallyPaused
        ? "Tower menu closed; the battle remains paused."
        : (wasCombat ? "Tower menu closed; battle resumed." : "Tower menu closed.")));
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
      let queued = false;
      try {
        const beforePending = session.pendingCommandCount;
        session.command(fields);
        queued = session.pendingCommandCount > beforePending;
        setFeedback(message || (queued ? "Action queued." : "Action applied."));
      } catch (error) {
        setFeedback(String(error && error.message || error));
      }
      render();
      if (selectedPadId) focusWithoutScroll(ui.storeClose);
      return queued;
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
        /* Plain-language geometry only: how much road this reach touches, never
           the authored intent, quality, or exposure that decided it. */
        const reach = pad.coverage.hint;
        button.type = "button";
        button.setAttribute("data-site-pad-id", pad.id);
        button.setAttribute("data-site-number", String(index + 1));
        button.setAttribute("aria-pressed", String(pad.selected));
        button.setAttribute("aria-label", siteName + ". " + status + ". " + reach + ". Open tower menu.");
        if (pad.selected) button.classList.add("is-selected");
        if (pad.tower) button.classList.add("is-occupied");
        if (pad.coverage.windowCount > 1) button.classList.add("is-multi-cover");
        if (!pad.tower && !canAffordBuild) button.classList.add("is-unaffordable");
        button.appendChild(element(documentObject, "span", "preview-site-name", siteName));
        button.appendChild(element(documentObject, "span", "preview-site-state", status));
        button.appendChild(element(documentObject, "span", "preview-site-reach", reach));
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
      const view = battlefieldView(runtime, state, selectedPadId, {
        reduceMotion: reduceMotion,
        previewDefenseId: previewDefenseId,
        projectiles: projectileCues,
      });
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

      /* Spec 6.6: the selected site or previewed build shows its exact reach and
         the stretches of road that reach can affect. Nothing here names a band,
         a quality, a grid cell, or an exposure figure. */
      if (view.selection) {
        const coverageLayer = svgElement(documentObject, "g", {
          class: "preview-coverage-layer",
          "aria-hidden": "true",
        });
        view.selection.arcs.forEach(function (arc, index) {
          coverageLayer.appendChild(svgElement(documentObject, "path", {
            class: "preview-coverage-arc",
            d: pointsPath(arc.points),
            fill: "none",
            "stroke-width": view.roadWidth,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "data-coverage-index": String(index),
          }));
        });
        coverageLayer.appendChild(svgElement(documentObject, "circle", {
          class: "preview-tower-range",
          cx: view.selection.x,
          cy: view.selection.y,
          r: view.selection.range,
        }));
        svg.appendChild(coverageLayer);
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
          const blend = towerFrameBlend(pad.tower);
          const fromFrame = SpriteAtlas.towerFrame(
            pad.tower.asset.metadata, pad.tower.level, blend.from
          );
          const toFrame = SpriteAtlas.towerFrame(
            pad.tower.asset.metadata, pad.tower.level, blend.to
          );
          const effect = towerAttackEffect(documentObject, pad.tower);
          if (effect) group.appendChild(effect);
          const motion = svgElement(documentObject, "g", {
            class: "preview-tower-motion",
            transform: "translate(0 " + blend.recoilY + ")",
            "data-blend-bp": blend.mixBp,
          });
          const sprite = atlasSprite(documentObject, pad.tower.asset, fromFrame, {
            class: "preview-tower-sprite",
            x: -10500,
            y: -12500,
            width: 21000,
            height: 21000,
            opacity: ((10000 - blend.mixBp) / 10000).toFixed(3),
            "data-frame": pad.tower.frameName,
          }, "preview-tower-clip-" + pad.tower.id);
          sprite.setAttribute("data-action", pad.tower.action);
          motion.appendChild(sprite);
          if (blend.mixBp > 0 && blend.to !== blend.from) {
            motion.appendChild(atlasSprite(documentObject, pad.tower.asset, toFrame, {
              class: "preview-tower-sprite-blend",
              x: -10500,
              y: -12500,
              width: 21000,
              height: 21000,
              opacity: (blend.mixBp / 10000).toFixed(3),
              "data-frame": toFrame.frameName,
              "aria-hidden": "true",
            }, "preview-tower-blend-clip-" + pad.tower.id));
          }
          group.appendChild(motion);
        } else if (pad.tower) {
          group.appendChild(svgElement(documentObject, "text", {
            class: "preview-map-symbol preview-tower-symbol",
            x: 0,
            y: 1700,
            "text-anchor": "middle",
          }, pad.tower.symbol));
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
          const blend = enemyFrameBlend(enemy.asset, view.tick, enemy.id, reduceMotion);
          group.appendChild(atlasSprite(documentObject, enemy.asset, blend.from, {
            class: "preview-enemy-sprite",
            x: -size * 0.72,
            y: -size * 0.78,
            width: size * 1.44,
            height: size * 1.44,
            opacity: ((10000 - blend.mixBp) / 10000).toFixed(3),
            "data-frame": blend.from.frameName,
          }, "preview-enemy-clip-" + enemy.id));
          if (blend.mixBp > 0 && blend.to.frameName !== blend.from.frameName) {
            group.appendChild(atlasSprite(documentObject, enemy.asset, blend.to, {
              class: "preview-enemy-sprite-blend",
              x: -size * 0.72,
              y: -size * 0.78,
              width: size * 1.44,
              height: size * 1.44,
              opacity: (blend.mixBp / 10000).toFixed(3),
              "data-frame": blend.to.frameName,
              "aria-hidden": "true",
            }, "preview-enemy-blend-clip-" + enemy.id));
          }
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
      const projectileLayer = svgElement(documentObject, "g", {
        class: "preview-projectile-layer",
        "aria-hidden": "true",
      });
      view.projectiles.forEach(function (projectile) {
        projectileLayer.appendChild(projectileEffect(documentObject, projectile, reduceMotion));
      });
      svg.appendChild(projectileLayer);
      replaceChildren(ui.battlefield, [svg]);
      renderSiteSelector(view, state);
      return view;
    }

    /* Secondary reading stays reachable but never pushes the name, the exact
       cost, and the Build control off the visible part of the menu. */
    function appendTowerDetails(card, rows) {
      const details = element(documentObject, "details", "preview-card-details");
      details.appendChild(element(documentObject, "summary", "", "Tower details"));
      rows.forEach(function (row) {
        details.appendChild(element(documentObject, "p", row[0], row[1]));
      });
      card.appendChild(details);
    }

    function setTowerMenuFlag(open) {
      const body = documentObject.body;
      if (body && body.dataset) body.dataset.towerMenu = open ? "open" : "closed";
    }

    function renderStore(state, mission, view) {
      if (!selectedPadId) {
        ui.storePanel.hidden = true;
        setTowerMenuFlag(false);
        replaceChildren(ui.store, [element(documentObject, "p", "preview-empty", "Select a build site to open the tower menu.")]);
        return;
      }
      ui.storePanel.hidden = false;
      setTowerMenuFlag(true);
      const selectedIndex = view.pads.findIndex(function (pad) { return pad.id === selectedPadId; });
      const siteName = selectedIndex === -1 ? "Selected site" : "Site " + (selectedIndex + 1);
      /* Spec 15.2: the Aether bank and the selected-site context stay readable at
         every viewport, so the sheet repeats them instead of relying on scroll. */
      const context = element(documentObject, "p", "preview-store-context");
      context.appendChild(element(documentObject, "span", "preview-store-site", siteName));
      context.appendChild(element(documentObject, "span", "preview-store-bank",
        state.management.aether + " Aether available"));
      if (view.selection) {
        context.appendChild(element(documentObject, "span", "preview-store-reach", view.selection.hint));
      }
      const managementLocked = fatalPaused;
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
        card.appendChild(element(documentObject, "p", "preview-stats",
          "Damage " + view.damage + " · " + attackCadenceLabel(view) + " · Range " + view.range +
          " · Targets " + view.targetKinds.join(" + ")));
        appendTowerDetails(card, [
          ["", view.description],
          ["preview-muted", "Role: " + view.role],
          ["preview-muted", "Weakness: " + view.weakness],
        ]);
        const next = occupied.level < view.levelCount ? defenseView(runtime, occupied.defenseId, occupied.level + 1) : null;
        if (next) {
          const delta = element(documentObject, "section", "preview-upgrade-delta");
          delta.appendChild(element(documentObject, "h4", "", "NEXT: LEVEL " + (occupied.level + 1) + " - " + next.costAether + " AETHER"));
          delta.appendChild(element(documentObject, "p", "preview-stats",
            "Damage " + view.damage + " -> " + next.damage +
            " | Cadence " + attackCadenceLabel(view) + " -> " + attackCadenceLabel(next) +
            " | Range " + view.range + " -> " + next.range));
          delta.appendChild(element(documentObject, "p", "", next.description));
          card.appendChild(delta);
        }
        const actions = element(documentObject, "div", "preview-actions preview-card-actions");
        const upgrade = element(documentObject, "button", "", next
          ? "Upgrade for " + next.costAether + " Aether" : "Maximum level");
        upgrade.type = "button";
        const upgradeNeed = next ? next.costAether - state.management.aether : 0;
        upgrade.disabled = !next || !upgradeGateOpen || managementLocked || upgradeNeed > 0;
        if (upgradeNeed > 0) {
          upgrade.className = "is-unaffordable";
          upgrade.title = "Need " + upgradeNeed + " more Aether";
        }
        upgrade.addEventListener("click", function () {
          if (issue({ type: "upgrade", towerId: occupied.id }, "Tower upgrade queued.")) {
            closeStore(manuallyPaused
              ? "Tower upgrade queued. The battle remains paused."
              : "Tower upgrade queued. Battle resumed; applying now.");
          }
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
            if (issue({ type: "sell", towerId: occupied.id }, "Tower sale queued.")) {
              closeStore(manuallyPaused
                ? "Tower sale queued. The battle remains paused."
                : "Tower sale queued. Battle resumed; applying now.");
            }
          }
        });
        actions.appendChild(sell);
        card.appendChild(actions);
        if (!upgradeGateOpen && next) {
          card.appendChild(element(documentObject, "p", "preview-need",
            "Upgrades unlock after Wave 1. You can still build and sell during the wave."));
        } else if (next) {
          card.appendChild(element(documentObject, "p", upgradeNeed > 0 ? "preview-need" : "preview-ready",
            upgradeNeed > 0 ? "NEED " + upgradeNeed + " MORE AETHER TO UPGRADE" : "UPGRADE AVAILABLE"));
        }
        replaceChildren(ui.store, [context, card]);
        return;
      }

      const heading = element(documentObject, "p", "preview-store-heading", "Choose a tower for " + siteName);
      const grid = element(documentObject, "div", "preview-card-grid");
      state.loadoutIds.forEach(function (defenseId) {
        const view = defenseView(runtime, defenseId, 1);
        const card = element(documentObject, "article", "preview-card preview-build-card");
        card.setAttribute("data-build-defense-id", defenseId);
        if (defenseId === previewDefenseId) card.classList.add("is-previewed");
        appendTowerCardHeading(documentObject, card, view, "h4", view.name, "build-" + defenseId);
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
          if (issue({ type: "build", padId: selectedPadId, defenseId: defenseId }, "Tower construction queued.")) {
            closeStore(manuallyPaused
              ? "Tower construction queued. The battle remains paused."
              : "Tower construction queued. Battle resumed; applying now.");
          }
        });
        const actions = element(documentObject, "div", "preview-card-actions");
        actions.appendChild(build);
        actions.appendChild(element(documentObject, "span", need > 0 ? "preview-need" : "preview-ready",
          need > 0 ? "Need " + need + " more Aether" : "Affordable"));
        card.appendChild(actions);
        card.appendChild(element(documentObject, "p", "preview-stats",
          "Damage " + view.damage + " · " + attackCadenceLabel(view) + " · Range " + view.range +
          " · Targets " + view.targetKinds.join(" + ")));
        appendTowerDetails(card, [
          ["preview-role", "Role: " + view.role],
          ["", view.description],
          ["preview-muted", "Weakness: " + view.weakness],
        ]);
        /* Hovering or tabbing a tower previews its exact reach on the map. It
           moves the range circle and the covered-road highlight only. */
        ["mouseenter", "focusin"].forEach(function (eventName) {
          card.addEventListener(eventName, function () { previewDefense(defenseId); });
        });
        grid.appendChild(card);
      });
      replaceChildren(ui.store, [context, heading, grid]);
      revealPreviewedCard();
    }

    /* The menu can hold more towers than fit at once, so the tower being
       previewed is always scrolled inside the menu rather than off it. */
    function revealPreviewedCard() {
      if (!previewDefenseId) return;
      const card = typeof ui.store.querySelector === "function"
        ? ui.store.querySelector('[data-build-defense-id="' + previewDefenseId + '"]') : null;
      if (!card || typeof card.getBoundingClientRect !== "function") return;
      const panel = ui.storePanel;
      if (typeof panel.getBoundingClientRect !== "function") return;
      const cardBox = card.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      if (cardBox.top >= panelBox.top && cardBox.bottom <= panelBox.bottom) return;
      panel.scrollTop += cardBox.top - panelBox.top - 8;
    }

    function cadenceRenderWouldReplaceFocus() {
      const active = documentObject.activeElement;
      if (!active || active === documentObject.body) return false;
      /* A focused SVG foundation must never freeze combat presentation. The map
         is rebuilt at visual cadence, so that one node may yield focus after a
         repaint; blocking the repaint made enemies appear permanently parked at
         their spawn point in browsers that retain SVG focus after pointer input. */
      return [ui.store].some(function (container) {
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
      const battlefield = renderBattlefield(state);
      renderStore(state, mission, battlefield);
      syncCommandBarHeight();

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

    function resetSession(explicitHeader) {
      try {
        const header = explicitHeader || createHeader(runtime, {
          missionId: ui.mission.value,
          difficultyId: ui.difficulty.value,
          assist: ui.assist.checked,
          seed: Number(ui.seed.value),
          loadoutIds: selectedLoadout(),
        });
        session = createSession(runtime, header);
        outcomeReported = false;
        selectedPadId = null;
        manuallyPaused = false;
        fatalPaused = false;
        renderedShareState = null;
        renderedShareModel = null;
        visualTicksSinceRender = 0;
        projectileCues = [];
        setFeedback("Plan your defense. Choose an empty build site to place a tower.");
        render();
      } catch (error) {
        setFeedback(String(error && error.message || error));
      }
    }

    /* The battlefield is this screen's primary object, so the readouts and the
       run controls are grouped once into a single pinned command bar. Nothing is
       renamed, removed, or relabelled: the existing groups keep their headings,
       aria labels, and tab order inside the new wrapper. */
    let commandBar = null;

    function groupCommandBar() {
      const hud = ui.aether.closest ? ui.aether.closest(".preview-hud") : null;
      const actions = ui.startWave.closest ? ui.startWave.closest(".preview-actions") : null;
      if (!hud || !actions || !hud.parentNode) return;
      if (hud.parentNode.classList && hud.parentNode.classList.contains("preview-command-bar")) {
        commandBar = hud.parentNode;
        return;
      }
      const bar = element(documentObject, "div", "preview-command-bar");
      hud.parentNode.insertBefore(bar, hud);
      bar.appendChild(hud);
      bar.appendChild(actions);
      commandBar = bar;
    }

    /* Small screens pin the map directly under the command bar. The bar wraps at
       narrow widths, so its measured height, not a guessed one, is the offset. */
    function syncCommandBarHeight() {
      if (!commandBar || typeof commandBar.getBoundingClientRect !== "function") return;
      const region = optionalElement(documentObject, "battleRegion");
      if (!region || !region.style || typeof region.style.setProperty !== "function") return;
      const height = Math.round(commandBar.getBoundingClientRect().height);
      if (height > 0) region.style.setProperty("--aegis-battle-bar-height", height + "px");
    }

    /* Opening the tower menu brings the map into the band between the pinned bar
       and the sheet, so a build site is never hidden behind either of them. */
    function revealBattlefield() {
      const stage = ui.battlefield.parentNode;
      if (!stage || typeof stage.getBoundingClientRect !== "function") return;
      if (typeof windowObject.scrollBy !== "function") return;
      const box = stage.getBoundingClientRect();
      const barBox = commandBar && typeof commandBar.getBoundingClientRect === "function"
        ? commandBar.getBoundingClientRect() : null;
      /* The bar pins to the top of the viewport, so the band below it is measured
         against where the bar comes to rest, not where it happens to sit now. */
      const pinnedTop = (barBox ? Math.min(Math.max(0, barBox.bottom), barBox.height) : 0) + 8;
      const sheetStyle = typeof windowObject.getComputedStyle === "function"
        ? windowObject.getComputedStyle(ui.storePanel) : null;
      const viewportHeight = windowObject.innerHeight || 0;
      const sheetTop = sheetStyle && sheetStyle.position === "fixed" && !ui.storePanel.hidden
        ? ui.storePanel.getBoundingClientRect().top : viewportHeight;
      const safeBottom = Math.min(sheetTop, viewportHeight) - 8;
      if (box.bottom <= safeBottom && box.top >= pinnedTop) return;
      const delta = box.top - pinnedTop;
      if (Math.abs(delta) < 2) return;
      windowObject.scrollBy(0, delta);
    }

    function focusWithoutScroll(node) {
      if (!node || typeof node.focus !== "function") return;
      try {
        node.focus({ preventScroll: true });
      } catch (error) {
        node.focus();
      }
    }

    groupCommandBar();
    setTowerMenuFlag(false);
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
    if (options.autoStart !== false) resetSession();

    timer = windowObject.setInterval(function () {
      if (!session) return;
      try {
        const priorPhase = session.state.management.phase;
        const priorOutcome = session.state.outcome;
        const priorState = session.state;
        const result = session.step();
        if (!result.advanced) return;
        projectileCues = projectileCues
          .concat(projectileCuesForStep(runtime, priorState, result))
          .filter(function (cue) {
            return session.state.tick - cue.bornTick <= cue.durationTicks;
          })
          .slice(-MAX_PROJECTILE_CUES);
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
        if (!outcomeReported && session.state.outcome !== "active") {
          outcomeReported = true;
          if (typeof options.onOutcome === "function") options.onOutcome(session);
        }
      } catch (error) {
        fatalPaused = true;
        session.pause();
        setFeedback("Simulation stopped safely: " + String(error && error.message || error));
        render();
      }
    }, 1000 / runtime.simulation.TICKS_PER_SECOND);

    return Object.freeze({
      dispose: function () {
        if (timer !== null) windowObject.clearInterval(timer);
        timer = null;
      },
      startRun: function (header) { resetSession(header); },
      get session() { return session; },
      get manuallyPaused() { return manuallyPaused; },
      get storeOpen() { return Boolean(selectedPadId); },
      render: render,
    });
  }

  /* ------------------------------------------------------- campaign shell */

  function debugRequested(search) {
    if (typeof search !== "string" || !search) return false;
    const query = search.charAt(0) === "?" ? search.slice(1) : search;
    return query.split("&").some(function (pair) {
      const parts = pair.split("=");
      return parts[0] === "debug" && parts[1] === "1";
    });
  }

  function optionalElement(documentObject, id) {
    return typeof documentObject.getElementById === "function" ? documentObject.getElementById(id) : null;
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
    if (typeof element.setAttribute === "function") {
      if (hidden) element.setAttribute("hidden", "hidden");
      else if (typeof element.removeAttribute === "function") element.removeAttribute("hidden");
    }
  }

  /* Training grants trial access to every defense in the build without touching
     the stored profile: the synthetic snapshot is never written back. */
  function trainingSnapshot(snapshot, catalog) {
    return deepFreeze(Object.assign({}, snapshot, {
      defenseGrantIds: Object.keys(catalog.defenses).slice().sort(),
      defenseSlotCap: 6,
    }));
  }

  function mount(runtimeInput, options) {
    const runtime = assertRuntime(runtimeInput);
    options = options || {};
    const documentObject = options.document || (root && root.document);
    const windowObject = options.window || root;
    if (!documentObject || !windowObject) throw new TypeError("The Aegis shell requires a document and window");

    const search = options.search !== undefined ? options.search
      : (windowObject.location && windowObject.location.search) || "";
    const debug = options.debug === true || debugRequested(search);
    const shellRoot = requiredElement(documentObject, "shellRoot");
    const battleRegion = optionalElement(documentObject, "battleRegion");
    const resultCardRegion = optionalElement(documentObject, "resultCardRegion");
    const developerTools = optionalElement(documentObject, "previewDeveloperTools");
    const bootStatus = optionalElement(documentObject, "previewBootStatus");
    const reduceMotionPreferred = typeof windowObject.matchMedia === "function" &&
      windowObject.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const catalog = Shell.createCatalog({
      content: runtime.content,
      presentation: runtime.presentation,
      distanceScale: runtime.simulation && runtime.simulation.DISTANCE_SCALE,
      damageScale: runtime.simulation && runtime.simulation.DAMAGE_SCALE,
    });
    const contentIdentity = runtime.release.contentVersion;

    let profile = Profile.createProfileV2(contentIdentity);
    let store = SessionStore.openSessionProfileStore({
      namespace: runtime.descriptor.namespaces.profile,
      profile: profile,
    });
    let state = Shell.createInitialState({
      catalog: catalog,
      profile: profile,
      storageKind: "session",
      debug: debug,
      settings: { reducedMotion: reduceMotionPreferred },
    });
    let battle = null;
    let lastResultState = null;

    function context(extra) {
      return Object.assign({ catalog: catalog, profile: profile, state: state }, extra || {});
    }

    function notice(text, tone) {
      state = Shell.transition(context(), {
        type: "setNotice",
        notice: text === null ? null : { text: text, tone: tone || "quiet" },
      }).state;
    }

    function applyRootFlags() {
      const body = documentObject.body;
      if (!body || !body.dataset) return;
      body.dataset.screen = state.screen;
      body.dataset.mode = state.mode;
      body.dataset.debug = debug ? "1" : "0";
      body.dataset.reducedMotion = String(state.settings.reducedMotion);
      body.dataset.photosensitiveSafe = String(state.settings.photosensitiveSafe);
      body.dataset.storage = state.storageKind;
    }

    function currentWaves() {
      const mission = state.missionId === null ? null : runtime.content.missions[state.missionId];
      return mission && Array.isArray(mission.waves) ? mission.waves : [];
    }

    function screenModel() {
      return Shell.selectScreen(context({
        waves: currentWaves(),
        ticksPerSecond: runtime.simulation ? runtime.simulation.TICKS_PER_SECOND : 60,
      }));
    }

    function render() {
      applyRootFlags();
      setHidden(battleRegion, state.screen !== "battle");
      setHidden(resultCardRegion, state.screen !== "result");
      setHidden(developerTools, !debug);
      if (bootStatus) {
        /* Ordinary play shows no release identity: the honesty banner above it
           already states that this build is local and unverified. */
        bootStatus.textContent = debug
          ? "Candidate-BAL · " + runtime.release.approvalState + " · " + runtime.release.contentVersion
            + " · ABI v" + runtime.abiVersion + " · LOCAL / UNVERIFIED"
          : "";
        bootStatus.hidden = !debug;
      }
      const tree = ShellView.buildScreenTree(screenModel(), {
        storageKind: state.storageKind,
        notice: state.notice,
        reducedMotion: state.settings.reducedMotion,
        photosensitiveSafe: state.settings.photosensitiveSafe,
      });
      ShellView.mount(documentObject, shellRoot, tree, dispatch);
    }

    function apply(action) {
      const result = Shell.transition(context(), action);
      state = result.state;
      if (!result.ok) notice(result.reason, "warning");
      return result;
    }

    async function persistProfile(nextProfile, journalEntry) {
      profile = nextProfile;
      const written = await store.writeProfile(nextProfile, journalEntry || null);
      if (!written.ok) notice("Progress could not be saved: " + written.reason + ".", "warning");
      return written.ok;
    }

    function runEdit(edit) {
      if (state.mode === "training") {
        notice("Training does not change your campaign loadout.", "warning");
        render();
        return;
      }
      const plan = Shell.planLoadoutEdit(profile, edit);
      if (!plan.ok) {
        notice(plan.reason, "warning");
        render();
        return;
      }
      persistProfile(plan.profile, { kind: edit.kind }).then(function () {
        if (plan.notes.length) notice(plan.notes.join(" "), "ready");
        render();
      });
    }

    function toggleTower(defenseId) {
      const equipped = state.loadoutIds.slice();
      const index = equipped.indexOf(defenseId);
      if (index === -1) equipped.push(defenseId);
      else equipped.splice(index, 1);
      apply({ type: "setLoadout", loadoutIds: equipped });
      render();
    }

    function toggleProtocol(protocolId) {
      const current = profile.protocolLoadout.slice();
      const index = current.findIndex(function (entry) { return entry.protocolId === protocolId; });
      let loadout;
      if (index === -1) {
        const record = profile.protocols.find(function (entry) { return entry.id === protocolId; });
        const usedSlots = current.map(function (entry) { return entry.slot; });
        let slot = 0;
        while (usedSlots.indexOf(slot) !== -1) slot += 1;
        loadout = current.concat([{
          slot: slot,
          protocolId: protocolId,
          tier: record ? record.availableTier : 1,
        }]);
      } else {
        loadout = current.filter(function (entry) { return entry.protocolId !== protocolId; });
      }
      runEdit({ kind: "setProtocolLoadout", loadout: loadout });
    }

    function toggleRelic(relicId) {
      const current = profile.relicLoadoutIds.slice();
      const index = current.indexOf(relicId);
      const next = index === -1 ? current.concat([relicId])
        : current.filter(function (id) { return id !== relicId; });
      runEdit({ kind: "setRelicLoadout", relicIds: next });
    }

    function buildRunHeader() {
      const mission = runtime.content.missions[state.missionId];
      if (runtime.abiVersion === 2) {
        const baseSnapshot = Profile.resolveRunSnapshot(profile);
        const snapshot = state.mode === "training"
          ? trainingSnapshot(baseSnapshot, catalog) : baseSnapshot;
        return RunHeaderV2.createRunHeaderV2({
          snapshot: snapshot,
          protocolAuthority: RunHeaderV2.deriveProtocolAuthority(profile),
          mission: mission,
          loadoutIds: state.loadoutIds,
          accessGrantMappings: runtime.content.defenseUnlockGrantMappings,
          difficultyId: state.difficultyId,
          seed: state.seed,
          assist: state.assist,
          rulesetHash: runtime.binding.rulesetHash,
        });
      }
      return createHeader(runtime, {
        missionId: state.missionId,
        difficultyId: state.difficultyId,
        assist: state.assist,
        seed: state.seed,
        loadoutIds: state.loadoutIds,
      });
    }

    function startRun() {
      let header;
      try {
        header = buildRunHeader();
      } catch (error) {
        notice("This mission cannot start yet: " + String(error && error.message || error), "warning");
        render();
        return;
      }
      const result = apply({ type: "startRun", header: header });
      if (!result.ok) {
        render();
        return;
      }
      render();
      if (battle) battle.startRun(header);
    }

    function runAuthorizationFor(header) {
      return Progression.deriveRunAuthorization(
        Object.assign({}, header, {
          specializationAccessIds: header.specializationAccessIds || profile.specializationAccessIds,
        }),
        profile.contentIdentity
      );
    }

    async function commitVictory(runResult, header) {
      if (state.mode === "training" || runResult.outcome !== "victory") {
        return Object.assign({}, runResult, {
          persistence: {
            kind: state.mode === "training" ? "training" : state.storageKind,
            durable: false,
            message: state.mode === "training"
              ? "Training runs are never saved."
              : (runResult.outcome === "victory"
                ? "This victory is only in this browser tab."
                : "Defeats are not saved. Retry when you are ready."),
          },
        });
      }
      let plan;
      try {
        plan = Progression.planApplyVerifiedVictory(profile, {
          missionId: runResult.missionId,
          difficultyId: runResult.difficultyId,
          completedObjectiveIds: runResult.completedObjectiveIds,
          defenseEvidence: runResult.facts.defenseEvidence,
          runAuthorization: runAuthorizationFor(header),
        });
      } catch (error) {
        return Object.assign({}, runResult, {
          persistence: {
            kind: "session",
            durable: false,
            message: "Progress could not be recorded: "
              + String(error && error.message || error) + " The result below is real but unsaved.",
          },
        });
      }
      const committed = await store.commitVictory({
        profile: plan.profile,
        result: {
          resultId: runResult.missionId + ":" + runResult.difficultyId + ":" + runResult.seed,
          missionId: runResult.missionId,
          difficultyId: runResult.difficultyId,
          score: runResult.score,
          durationTicks: runResult.durationTicks,
        },
        journalEntry: { kind: "verified-victory", missionId: runResult.missionId },
      });
      if (!committed.ok) {
        return Object.assign({}, runResult, {
          persistence: {
            kind: "session", durable: false,
            message: "Progress could not be saved: " + committed.reason
              + ". The result below is real but unsaved.",
          },
        });
      }
      profile = plan.profile;
      return Object.assign({}, runResult, {
        newLaurelIds: plan.laurelIdsAdded || [],
        grantIdsApplied: plan.grantIdsApplied || [],
        masteryChanges: (plan.masteryChanges || []).map(function (change) {
          return {
            defenseId: change.defenseId,
            milestone: change.masteredAdded ? "mastered"
              : (change.temperedAdded ? "tempered" : "fielded"),
          };
        }),
        persistence: {
          kind: store.kind,
          durable: Boolean(committed.value && committed.value.durable),
          message: committed.value && committed.value.durable
            ? "Saved to this browser."
            : "SESSION ONLY. This victory is not saved and disappears when the page closes.",
        },
      });
    }

    function finishRun(session) {
      const header = state.runHeader;
      let runResult;
      try {
        runResult = BattleSession.createRunResult({
          runtime: runtime,
          header: header,
          state: session.state,
          events: session.events,
        });
      } catch (error) {
        notice("The run finished but its result could not be summarized: "
          + String(error && error.message || error), "warning");
        render();
        return;
      }
      lastResultState = session.state;
      commitVictory(runResult, header).then(function (finalResult) {
        apply({ type: "finishRun", result: finalResult });
        render();
      });
    }

    function exportRecovery() {
      store.exportRecovery().then(function (result) {
        notice(result.ok
          ? "Recovery data prepared. Copy it from the developer console readout."
          : "Recovery export failed: " + result.reason, result.ok ? "ready" : "warning");
        if (result.ok) windowObject.__gameslopRecovery = result.value;
        render();
      });
    }

    function importRecovery() {
      const bundle = windowObject.__gameslopRecovery || null;
      if (!bundle) {
        notice("No recovery data is loaded in this tab yet.", "warning");
        render();
        return;
      }
      store.importRecovery(bundle).then(function (result) {
        if (!result.ok) {
          notice("Recovery import failed: " + result.reason, "warning");
        } else if (result.value) {
          profile = Profile.validateProfileV2(result.value);
          notice("Recovery data imported.", "ready");
        }
        render();
      });
    }

    function dispatch(action, event) {
      if (!action || typeof action.type !== "string") return;
      switch (action.type) {
        case "continueCampaign": {
          apply({ type: "navigate", screen: "campaign" });
          const model = Shell.selectTitleScreen(context());
          apply({ type: "selectMission", missionId: model.continueMissionId });
          render();
          return;
        }
        case "toggleTower":
          toggleTower(action.defenseId);
          return;
        case "toggleAssist":
          apply({ type: "setAssist", assist: !state.assist });
          render();
          return;
        case "toggleProtocol":
          toggleProtocol(action.protocolId);
          return;
        case "toggleRelic":
          toggleRelic(action.relicId);
          return;
        case "toggleReinforcement":
          runEdit({
            kind: "setReinforcement",
            reinforcementId: profile.reinforcementId === action.reinforcementId
              ? null : action.reinforcementId,
          });
          return;
        case "clearTowers":
          apply({ type: "setLoadout", loadoutIds: [] });
          render();
          return;
        case "clearProtocols":
          runEdit({ kind: "clearProtocols" });
          return;
        case "clearRelics":
          runEdit({ kind: "clearRelics" });
          return;
        case "clearReinforcement":
          runEdit({ kind: "clearReinforcement" });
          return;
        case "allocateProtocolTier":
          runEdit({ kind: "allocateProtocolTier", protocolId: action.protocolId });
          return;
        case "refundProtocolTier":
          runEdit({ kind: "refundProtocolTier", protocolId: action.protocolId });
          return;
        case "startRun":
          startRun();
          return;
        case "rebindKey": {
          const key = action.key !== undefined ? action.key : (event && event.key);
          if (event && typeof event.preventDefault === "function") event.preventDefault();
          apply({ type: "rebindKey", actionId: action.actionId, key: key });
          render();
          return;
        }
        case "highlightGuide":
          /* Presentation-only guidance. The page never records, uploads, or
             posts anything, and nothing here gates a reward. */
          notice("Local highlight: start your device's screen recorder, press Retry or replay the "
            + "last wave, and stop after 10 to 20 seconds. Nothing is uploaded or posted from here.",
          "ready");
          render();
          return;
        case "exportRecovery":
          exportRecovery();
          return;
        case "importRecovery":
          importRecovery();
          return;
        default:
          apply(action);
          render();
      }
    }

    battle = mountBattle(runtime, {
      document: documentObject,
      window: windowObject,
      autoStart: false,
      onOutcome: finishRun,
      resultChallengeLine: function (terminalState) {
        if (!state.runHeader) return null;
        return Shell.badgeLine(Shell.usageBadges(catalog, BattleSession.deriveRunFacts({
          header: state.runHeader,
          events: battle && battle.session ? battle.session.events : [],
          state: terminalState,
        })));
      },
    });

    const probe = SessionStore.detectStorage(windowObject);
    SessionStore.openProfileStore({
      game: root && root.Game,
      namespace: runtime.descriptor.namespaces.profile,
      profile: profile,
    }).then(function (opened) {
      store = opened;
      return store.readProfile();
    }).then(function (read) {
      if (read && read.ok && read.value) {
        try {
          profile = Profile.reconcileProfileV2(read.value).profile;
        } catch (error) {
          profile = Profile.createProfileV2(contentIdentity);
        }
      }
      const durable = store.kind !== "session" && probe.durable;
      state = Shell.transition(context(), {
        type: "setStorageKind",
        storageKind: durable ? "durable" : "session",
      }).state;
    }).catch(function () {
      /* an unreadable profile is a session-only start, never a crash */
    }).then(function () {
      render();
      documentObject.body.dataset.ready = "1";
    });

    windowObject.__gameslop = {
      preview: true,
      releaseId: runtime.descriptor.id,
      abiVersion: runtime.abiVersion,
      debug: debug,
      get screen() { return state.screen; },
      get shellState() { return state; },
      get profile() { return profile; },
      get storageKind() { return state.storageKind; },
      get state() { return battle && battle.session && battle.session.state; },
      get paused() { return battle && battle.session && battle.session.paused; },
      get manuallyPaused() { return battle && battle.manuallyPaused; },
      get storeOpen() { return Boolean(battle && battle.storeOpen); },
      get lastResultState() { return lastResultState; },
    };
    /* A scripted screen driver for developer QA only. It dispatches the exact
       actions the rendered controls dispatch and is absent without ?debug=1. */
    if (debug) windowObject.__gameslop.dispatch = dispatch;

    render();

    return Object.freeze({
      dispose: function () { if (battle) battle.dispose(); },
      dispatch: dispatch,
      render: render,
      get battle() { return battle; },
      get catalog() { return catalog; },
      get profile() { return profile; },
      get shellState() { return state; },
    });
  }

  return deepFreeze({
    MAX_LOADOUT: MAX_LOADOUT,
    VISUAL_FPS: VISUAL_FPS,
    battlefieldView: battlefieldView,
    enemyFrameBlend: enemyFrameBlend,
    towerFrameBlend: towerFrameBlend,
    projectileCuesForStep: projectileCuesForStep,
    createHeader: createHeader,
    createSession: createSession,
    createRunResult: BattleSession.createRunResult,
    deriveRunFacts: BattleSession.deriveRunFacts,
    defenseView: defenseView,
    attackCadenceLabel: attackCadenceLabel,
    mount: mount,
    mountBattle: mountBattle,
    resultCardModel: resultCardModel,
  });
});
