/* Armara Aegis engine - pure deterministic tower-defense logic.
   No DOM, timers, or renderer state. Classic script in browsers and CommonJS in Node. */
(function (global) {
  "use strict";

  const R = typeof require === "function" ? require("../../_kit/rng.js") : global.GameSlopKit;
  const G = global.Game = global.Game || {};

  const WORLD_W = 160;
  const WORLD_H = 100;
  const START_GOLD = 160;
  const START_INTEGRITY = 20;
  const LAST_WAVE = 12;
  const EPSILON = 1e-9;

  const PATH = [
    { x: -8, y: 18 }, { x: 42, y: 18 }, { x: 42, y: 48 }, { x: 88, y: 48 },
    { x: 88, y: 76 }, { x: 132, y: 76 }, { x: 132, y: 44 }, { x: 168, y: 44 },
  ];

  const PADS = [
    { x: 18, y: 34 }, { x: 61, y: 17 }, { x: 61, y: 64 }, { x: 76, y: 31 },
    { x: 104, y: 32 }, { x: 105, y: 61 }, { x: 106, y: 90 }, { x: 148, y: 88 },
    { x: 148, y: 61 }, { x: 148, y: 27 },
  ];

  const TOWER_STATS = {
    sentinel: [
      { buildCost: 40, damage: 8, cooldownMs: 450, range: 22 },
      { upgradeCost: 35, damage: 12, cooldownMs: 410, range: 24 },
      { upgradeCost: 60, damage: 18, cooldownMs: 360, range: 26 },
    ],
    chronos: [
      { buildCost: 55, damage: 3, cooldownMs: 800, range: 20, slowPct: 0.35, slowMs: 1500 },
      { upgradeCost: 45, damage: 5, cooldownMs: 720, range: 22, slowPct: 0.45, slowMs: 1700 },
      { upgradeCost: 75, damage: 8, cooldownMs: 650, range: 24, slowPct: 0.55, slowMs: 1900 },
    ],
    siege: [
      { buildCost: 75, damage: 18, cooldownMs: 1350, range: 24, splash: 5 },
      { upgradeCost: 60, damage: 28, cooldownMs: 1250, range: 26, splash: 6 },
      { upgradeCost: 90, damage: 42, cooldownMs: 1150, range: 28, splash: 7 },
    ],
  };

  const ENEMY_STATS = {
    scout: { hp: 20, speed: 9, armor: 0, bounty: 6, score: 60, leak: 1 },
    raider: { hp: 40, speed: 6, armor: 0, bounty: 9, score: 90, leak: 1 },
    guardian: { hp: 85, speed: 4.2, armor: 3, bounty: 14, score: 140, leak: 2 },
    titan: { hp: 240, speed: 2.8, armor: 2, bounty: 30, score: 400, leak: 5 },
  };

  function repeated(type, count) {
    return Array.from({ length: count }, function () { return type; });
  }

  function roster() {
    const out = [];
    for (let i = 0; i < arguments.length; i += 2) {
      out.push.apply(out, repeated(arguments[i], arguments[i + 1]));
    }
    return out;
  }

  const WAVES = [
    roster("raider", 8),
    roster("scout", 12),
    roster("raider", 8, "scout", 6),
    roster("guardian", 8, "scout", 6),
    roster("raider", 12, "scout", 10),
    roster("titan", 1, "raider", 10, "scout", 6),
    roster("guardian", 12, "scout", 12),
    roster("raider", 16, "guardian", 10),
    roster("titan", 2, "raider", 12, "scout", 8),
    roster("guardian", 14, "scout", 16),
    roster("titan", 2, "guardian", 16, "raider", 10),
    roster("titan", 3, "guardian", 18, "scout", 18),
  ];

  const SEGMENTS = [];
  let PATH_LENGTH = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    SEGMENTS.push({ a: a, b: b, start: PATH_LENGTH, length: length });
    PATH_LENGTH += length;
  }

  function clamp(value, low, high) {
    return value < low ? low : (value > high ? high : value);
  }

  function pointOnPath(progress) {
    const distance = clamp(progress, 0, PATH_LENGTH);
    for (let i = 0; i < SEGMENTS.length; i++) {
      const segment = SEGMENTS[i];
      if (distance <= segment.start + segment.length + EPSILON) {
        const t = segment.length === 0 ? 0 : clamp((distance - segment.start) / segment.length, 0, 1);
        return {
          x: segment.a.x + (segment.b.x - segment.a.x) * t,
          y: segment.a.y + (segment.b.y - segment.a.y) * t,
          segment: i,
        };
      }
    }
    const end = PATH[PATH.length - 1];
    return { x: end.x, y: end.y, segment: SEGMENTS.length - 1 };
  }

  function shuffled(rng, values) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = copy[i]; copy[i] = copy[j]; copy[j] = temp;
    }
    return copy;
  }

  function createEngine(opts) {
    opts = opts || {};

    const state = {
      status: "ready",
      score: 0,
      seed: 0,
      inputLog: [],
      tick: 0,
      gold: START_GOLD,
      integrity: START_INTEGRITY,
      wave: 0,
      phase: "planning",
      outcome: null,
      selectedPad: 0,
      selectedType: "sentinel",
      towers: [],
      enemies: [],
      spawnQueue: [],
      spawnIntervalMs: 0,
      spawnTimerMs: 0,
      nextTowerId: 1,
      nextEnemyId: 1,
    };

    let rng = null;

    function reset(seed) {
      if (seed === undefined) seed = opts.seed === undefined ? (Date.now() >>> 0) : opts.seed;
      state.status = "ready";
      state.score = 0;
      state.seed = seed >>> 0;
      state.inputLog = [];
      state.tick = 0;
      state.gold = START_GOLD;
      state.integrity = START_INTEGRITY;
      state.wave = 0;
      state.phase = "planning";
      state.outcome = null;
      state.selectedPad = 0;
      state.selectedType = "sentinel";
      state.towers = [];
      state.enemies = [];
      state.spawnQueue = [];
      state.spawnIntervalMs = 0;
      state.spawnTimerMs = 0;
      state.nextTowerId = 1;
      state.nextEnemyId = 1;
      rng = R.mulberry32(state.seed);
    }

    function towerStats(tower) {
      if (!tower || !TOWER_STATS[tower.type]) return null;
      return TOWER_STATS[tower.type][tower.level - 1] || null;
    }

    function denied(reason, command) {
      return [{ type: "denied", reason: reason, command: command }];
    }

    function selectPad(index, command) {
      if (!Number.isInteger(index) || index < 0 || index >= PADS.length) return denied("invalid-pad", command);
      state.selectedPad = index;
      return [{ type: "select", pad: index }];
    }

    function towerAtPad(pad) {
      for (let i = 0; i < state.towers.length; i++) {
        if (state.towers[i].pad === pad) return state.towers[i];
      }
      return null;
    }

    function build(type, command) {
      const levels = TOWER_STATS[type];
      if (!levels) return denied("unknown-tower", command);
      if (towerAtPad(state.selectedPad)) return denied("occupied-pad", command);
      const cost = levels[0].buildCost;
      if (state.gold < cost) return denied("insufficient-gold", command);

      const tower = {
        id: state.nextTowerId++,
        pad: state.selectedPad,
        type: type,
        level: 1,
        invested: cost,
        cooldownMs: 0,
      };
      state.gold -= cost;
      state.selectedType = type;
      state.towers.push(tower);
      return [{ type: "build", towerId: tower.id, pad: tower.pad, towerType: type, level: 1, cost: cost }];
    }

    function upgrade(command) {
      const tower = towerAtPad(state.selectedPad);
      if (!tower) return denied("empty-pad", command);
      if (tower.level >= 3) return denied("max-level", command);
      const next = TOWER_STATS[tower.type][tower.level];
      const cost = next.upgradeCost;
      if (state.gold < cost) return denied("insufficient-gold", command);
      state.gold -= cost;
      tower.level++;
      tower.invested += cost;
      return [{ type: "upgrade", towerId: tower.id, pad: tower.pad, towerType: tower.type, level: tower.level, cost: cost }];
    }

    function sell(command) {
      const tower = towerAtPad(state.selectedPad);
      if (!tower) return denied("empty-pad", command);
      const invested = tower.invested;
      const refund = Math.floor(invested * 0.70);
      state.towers = state.towers.filter(function (candidate) { return candidate.id !== tower.id; });
      state.gold += refund;
      return [{
        type: "sell", towerId: tower.id, pad: tower.pad, towerType: tower.type,
        level: tower.level, invested: invested, refund: refund,
      }];
    }

    function startWave(command) {
      if (state.phase !== "planning") return denied("wave-active", command);
      if (state.wave >= LAST_WAVE) return denied("campaign-complete", command);
      state.wave++;
      state.phase = "combat";
      state.spawnQueue = shuffled(rng, WAVES[state.wave - 1]);
      state.spawnIntervalMs = Math.max(420, 850 - 30 * (state.wave - 1));
      state.spawnTimerMs = 0;
      return [{ type: "wave", wave: state.wave }];
    }

    function syncEnemy(enemy) {
      if (!enemy || enemy.detached) return enemy;
      const point = pointOnPath(enemy.progress);
      enemy.x = point.x;
      enemy.y = point.y;
      enemy.segment = point.segment;
      return enemy;
    }

    function enemyFor(type, overrides) {
      const stats = ENEMY_STATS[type];
      if (!stats) throw new Error("Unknown enemy type: " + type);
      overrides = overrides || {};
      const wave = overrides.wave === undefined ? Math.max(1, state.wave) : Math.max(1, overrides.wave);
      const scaledHp = Math.ceil(stats.hp * (1 + 0.12 * (wave - 1)));
      const progress = overrides.progress === undefined ? 0 : overrides.progress;
      const position = pointOnPath(progress);
      const enemy = {
        id: state.nextEnemyId++,
        type: type,
        hp: scaledHp,
        maxHp: scaledHp,
        speed: stats.speed,
        armor: stats.armor,
        bounty: stats.bounty,
        scoreValue: stats.score,
        leak: stats.leak,
        progress: progress,
        x: position.x,
        y: position.y,
        segment: position.segment,
        slowPct: 0,
        slowMs: 0,
        detached: false,
        dead: false,
      };
      Object.assign(enemy, overrides);
      if (overrides.hp !== undefined && overrides.maxHp === undefined) enemy.maxHp = overrides.hp;
      if (!enemy.detached && overrides.x === undefined && overrides.y === undefined) syncEnemy(enemy);
      return enemy;
    }

    function addEnemy(type, overrides) {
      const enemy = enemyFor(type, overrides);
      state.enemies.push(enemy);
      return enemy;
    }

    function spawnEnemy(type, events) {
      const enemy = addEnemy(type);
      events.push({ type: "spawn", enemyId: enemy.id, enemyType: enemy.type, wave: state.wave });
      return enemy;
    }

    function applySlow(enemy, pct, durationMs) {
      if (!enemy || enemy.dead || durationMs <= 0 || pct <= 0) return false;
      if (enemy.slowMs > 0 && pct + EPSILON < enemy.slowPct) return false;
      enemy.slowPct = pct;
      enemy.slowMs = durationMs;
      return true;
    }

    function advanceEnemy(enemy, dt) {
      if (!enemy || enemy.dead || dt <= 0) return enemy;
      let remaining = dt;
      let distance = 0;
      if (enemy.slowMs > 0) {
        const slowedFor = Math.min(remaining, enemy.slowMs);
        distance += enemy.speed * (1 - enemy.slowPct) * slowedFor / 1000;
        enemy.slowMs -= slowedFor;
        remaining -= slowedFor;
        if (enemy.slowMs <= EPSILON) {
          enemy.slowMs = 0;
          enemy.slowPct = 0;
        }
      }
      if (remaining > 0) distance += enemy.speed * remaining / 1000;
      enemy.progress = Math.min(PATH_LENGTH, enemy.progress + distance);
      syncEnemy(enemy);
      return enemy;
    }

    function findTarget(tower) {
      const stats = towerStats(tower);
      if (!stats) return null;
      const pad = PADS[tower.pad];
      let best = null;
      for (let i = 0; i < state.enemies.length; i++) {
        const enemy = state.enemies[i];
        if (enemy.dead || enemy.hp <= 0) continue;
        if (Math.hypot(enemy.x - pad.x, enemy.y - pad.y) > stats.range + EPSILON) continue;
        if (!best || enemy.progress > best.progress + EPSILON ||
            (Math.abs(enemy.progress - best.progress) <= EPSILON && enemy.id < best.id)) {
          best = enemy;
        }
      }
      return best;
    }

    function appliedDamage(rawDamage, enemy) {
      return Math.max(1, rawDamage - enemy.armor);
    }

    function finishKills(killed, events) {
      for (let i = 0; i < killed.length; i++) {
        const enemy = killed[i];
        if (enemy.dead) continue;
        enemy.dead = true;
        state.gold += enemy.bounty;
        state.score += enemy.scoreValue;
        events.push({
          type: "kill", enemyId: enemy.id, enemyType: enemy.type,
          bounty: enemy.bounty, score: enemy.scoreValue,
        });
      }
      if (killed.length) state.enemies = state.enemies.filter(function (enemy) { return !enemy.dead; });
    }

    function attack(tower, target, events) {
      const stats = towerStats(tower);
      let hits;
      if (tower.type === "siege") {
        hits = state.enemies.filter(function (enemy) {
          return !enemy.dead && enemy.hp > 0 && Math.hypot(enemy.x - target.x, enemy.y - target.y) <= stats.splash + EPSILON;
        });
      } else {
        hits = [target];
      }

      const killed = [];
      for (let i = 0; i < hits.length; i++) {
        const enemy = hits[i];
        enemy.hp -= appliedDamage(stats.damage, enemy);
        if (tower.type === "chronos" && enemy.hp > 0) applySlow(enemy, stats.slowPct, stats.slowMs);
        if (enemy.hp <= 0) {
          enemy.hp = 0;
          killed.push(enemy);
        }
      }

      events.push({
        type: "attack", towerId: tower.id, towerType: tower.type, targetId: target.id,
        targetX: target.x, targetY: target.y, hitIds: hits.map(function (enemy) { return enemy.id; }),
      });
      finishKills(killed, events);
    }

    function processTowerAttacks(dt, events) {
      for (let i = 0; i < state.towers.length; i++) {
        const tower = state.towers[i];
        const stats = towerStats(tower);
        tower.cooldownMs -= dt;
        let guard = 0;
        while (tower.cooldownMs <= EPSILON && guard++ < 1000) {
          const target = findTarget(tower);
          if (!target) {
            tower.cooldownMs = 0;
            break;
          }
          attack(tower, target, events);
          tower.cooldownMs += stats.cooldownMs;
        }
      }
    }

    function processSpawns(dt, events) {
      if (state.phase !== "combat" || state.spawnQueue.length === 0) return;
      state.spawnTimerMs -= dt;
      while (state.spawnQueue.length && state.spawnTimerMs <= EPSILON) {
        spawnEnemy(state.spawnQueue.shift(), events);
        state.spawnTimerMs += state.spawnIntervalMs;
      }
    }

    function endDefeat(events) {
      state.integrity = 0;
      state.status = "over";
      state.phase = "complete";
      state.outcome = "defeat";
      events.push({ type: "breach", integrity: 0 });
      events.push({ type: "gameover", outcome: "defeat" });
    }

    function processMovement(dt, events) {
      const survivors = [];
      for (let i = 0; i < state.enemies.length; i++) {
        const enemy = state.enemies[i];
        advanceEnemy(enemy, dt);
        if (!enemy.detached && enemy.progress >= PATH_LENGTH - EPSILON) {
          state.integrity = Math.max(0, state.integrity - enemy.leak);
          events.push({
            type: "leak", enemyId: enemy.id, enemyType: enemy.type,
            amount: enemy.leak, integrity: state.integrity,
          });
          if (state.integrity <= 0) {
            for (let j = i + 1; j < state.enemies.length; j++) survivors.push(state.enemies[j]);
            state.enemies = survivors;
            endDefeat(events);
            return false;
          }
        } else {
          survivors.push(enemy);
        }
      }
      state.enemies = survivors;
      return true;
    }

    function clearWave(events) {
      const reward = 20 + 5 * state.wave;
      const score = 100 * state.wave;
      state.gold += reward;
      state.score += score;
      state.phase = "planning";
      state.spawnTimerMs = 0;
      for (let i = 0; i < state.towers.length; i++) state.towers[i].cooldownMs = 0;
      events.push({ type: "waveclear", wave: state.wave, gold: reward, score: score });

      if (state.wave === LAST_WAVE) {
        const victoryScore = state.integrity * 100;
        state.score += victoryScore;
        state.status = "over";
        state.phase = "complete";
        state.outcome = "victory";
        events.push({ type: "victory", integrity: state.integrity, score: victoryScore });
        events.push({ type: "gameover", outcome: "victory" });
      }
    }

    function tick(dt) {
      if (state.status !== "playing") return [];
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt < 0) dt = 0;
      state.tick++;
      const events = [];

      processSpawns(dt, events);
      if (!processMovement(dt, events)) return events;
      processTowerAttacks(dt, events);

      if (state.phase === "combat" && state.spawnQueue.length === 0 && state.enemies.length === 0) {
        clearWave(events);
      }
      return events;
    }

    function dispatch(action) {
      state.inputLog.push([state.tick, action]);
      if (action === "start") {
        if (state.status === "ready") state.status = "playing";
        return [];
      }
      if (action === "pause") {
        if (state.status === "playing") state.status = "paused";
        return [];
      }
      if (action === "resume") {
        if (state.status === "paused") state.status = "playing";
        return [];
      }
      if (state.status !== "playing") return [];

      if (action === "prevPad") return selectPad((state.selectedPad + PADS.length - 1) % PADS.length, action);
      if (action === "nextPad") return selectPad((state.selectedPad + 1) % PADS.length, action);
      if (typeof action === "string" && action.indexOf("selectPad:") === 0) {
        const raw = action.slice("selectPad:".length);
        const index = raw === "" ? NaN : Number(raw);
        return selectPad(index, action);
      }
      if (typeof action === "string" && action.indexOf("build:") === 0) {
        return build(action.slice("build:".length), action);
      }
      if (action === "upgrade") return upgrade(action);
      if (action === "sell") return sell(action);
      if (action === "wave") return startWave(action);
      return [];
    }

    // Narrow state setters/helpers match the existing game-engine testing convention.
    function setGold(value) { state.gold = Math.max(0, Number(value) || 0); }
    function setIntegrity(value) { state.integrity = Math.max(0, Number(value) || 0); }
    function setWave(value) {
      state.wave = clamp(Math.trunc(Number(value) || 0), 0, LAST_WAVE);
      state.phase = "planning";
      state.spawnQueue = [];
      state.spawnTimerMs = 0;
    }
    function hash() { return R.fnv1a(JSON.stringify(state.inputLog)); }

    reset(opts.seed);

    return {
      state: state,
      dispatch: dispatch,
      tick: tick,
      reset: reset,
      hash: hash,
      towerStats: towerStats,
      findTarget: findTarget,
      addEnemy: addEnemy,
      advanceEnemy: advanceEnemy,
      applySlow: applySlow,
      syncEnemy: syncEnemy,
      setGold: setGold,
      setIntegrity: setIntegrity,
      setWave: setWave,
      pointOnPath: pointOnPath,
      pathLength: PATH_LENGTH,
    };
  }

  const api = {
    WORLD_W: WORLD_W,
    WORLD_H: WORLD_H,
    PATH: PATH,
    PADS: PADS,
    TOWER_STATS: TOWER_STATS,
    ENEMY_STATS: ENEMY_STATS,
    WAVES: WAVES,
    PATH_LENGTH: PATH_LENGTH,
    createEngine: createEngine,
  };
  Object.assign(G, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
