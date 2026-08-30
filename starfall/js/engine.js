/* Armara Starfall engine: pure game logic. No DOM, no timers.
   Classic script that attaches to window.Game.createEngine, plus a CommonJS export for Node tests.
   World is 100 (w) x 140 (h) units, portrait 5:7. Ship sits near the bottom and moves left/right
   while held; bullets fire upward while held (rate-limited); asteroids and drones fall from the
   top, seeded via mulberry32, and the wave clock periodically speeds up spawning. */
(function (global) {
  "use strict";
  const R = typeof require === "function" ? require("../../_kit/rng.js") : global.GameSlopKit;
  const G = global.Game = global.Game || {};

  const W = 100, H = 140;
  const SHIP_X0 = 50, SHIP_Y0 = 128, SHIP_W = 8, SHIP_H = 6, SHIP_SPEED = 70;
  const FIRE_INTERVAL_MS = 220, MAX_BULLETS = 6, BULLET_R = 0.8, BULLET_VY = -130;
  const START_LIVES = 3, INVULN_MS = 1500;
  const SPAWN_INTERVAL0 = 1100, SPAWN_INTERVAL_MULT = 0.93, WAVE_MS = 8000;

  function createEngine(opts) {
    opts = opts || {};

    const state = {
      status: "ready", score: 0, lives: START_LIVES, wave: 1, seed: 0, inputLog: [], tick: 0,
      ship: { x: SHIP_X0, y: SHIP_Y0, w: SHIP_W, h: SHIP_H },
      bullets: [], enemies: [],
      held: { left: false, right: false, fire: false },
      fireCooldown: 0, spawnTimer: 0, spawnInterval: SPAWN_INTERVAL0, waveTimer: 0,
      invulnMs: 0, elapsed: 0,
    };
    let rng = null, nextEnemyId = 1;

    function reset(seed) {
      if (seed === undefined) seed = opts.seed === undefined ? (Date.now() >>> 0) : opts.seed;
      state.seed = seed >>> 0;
      rng = R.mulberry32(state.seed);

      state.status = "ready";
      state.score = 0;
      state.lives = START_LIVES;
      state.wave = 1;
      state.inputLog = [];
      state.tick = 0;
      state.ship.x = SHIP_X0; state.ship.y = SHIP_Y0; state.ship.w = SHIP_W; state.ship.h = SHIP_H;
      state.bullets = [];
      state.enemies = [];
      state.held.left = false; state.held.right = false; state.held.fire = false;
      state.fireCooldown = 0;
      state.spawnTimer = 0;
      state.spawnInterval = SPAWN_INTERVAL0;
      state.waveTimer = 0;
      state.invulnMs = 0;
      state.elapsed = 0;
      nextEnemyId = 1;
    }

    // One seeded enemy. rng call order (fixed, for determinism): kind, then (asteroid: r, vy |
    // drone: phase), then x. droneShare = min(0.5, 0.1*(wave-1)), 0% at wave 1, 10% at wave 2, …
    function spawnOneEnemy() {
      const droneShare = Math.min(0.5, 0.1 * (state.wave - 1));
      const kind = rng() < droneShare ? "drone" : "asteroid";
      let r, vy, hp, phase;
      if (kind === "asteroid") {
        r = 4 + rng() * 3;
        vy = 22 + rng() * 16;
        hp = 1;
        phase = 0; // unused by asteroids; kept for state-shape consistency
      } else {
        r = 4;
        vy = 18;
        hp = 2;
        phase = rng() * 2 * Math.PI;
      }
      const x = r + rng() * (W - 2 * r);
      const en = { id: nextEnemyId++, kind: kind, x: x, y: -r, r: r, hp: hp, vx: 0, vy: vy, phase: phase };
      if (kind === "drone") {
        en.baseX = x; // drones drift sinusoidally around their spawn x (see tick())
        en.vx = 12 * Math.cos(en.phase + state.elapsed / 400);
      }
      state.enemies.push(en);
    }

    function tick(dt) {
      if (state.status !== "playing") return [];
      state.tick++;
      const events = [];
      const dtS = dt / 1000;

      state.elapsed += dt;

      // ship: held left/right at 70 u/s, clamped so the ship's body stays on-world
      const dir = (state.held.right ? 1 : 0) - (state.held.left ? 1 : 0);
      if (dir !== 0) {
        const half = state.ship.w / 2;
        state.ship.x = Math.min(W - half, Math.max(half, state.ship.x + SHIP_SPEED * dtS * dir));
      }

      // fire: cooldown decrements every tick regardless of held.fire; a shot only leaves once the
      // cooldown (just decremented) reads exactly 0.
      state.fireCooldown = Math.max(0, state.fireCooldown - dt);
      if (state.held.fire && state.fireCooldown === 0 && state.bullets.length < MAX_BULLETS) {
        state.bullets.push({ x: state.ship.x, y: state.ship.y - state.ship.h / 2, r: BULLET_R, vy: BULLET_VY });
        state.fireCooldown = FIRE_INTERVAL_MS;
        events.push({ type: "fire" });
      }

      // bullets: straight up, culled once fully off the top
      for (let i = 0; i < state.bullets.length; i++) state.bullets[i].y += state.bullets[i].vy * dtS;
      state.bullets = state.bullets.filter(function (b) { return b.y + b.r >= 0; });

      // enemies: fall; drones also drift sinusoidally around their spawn x (baseX), culled once
      // fully off the bottom. vx on a drone is purely informational telemetry of the current
      // drift velocity; a test-spawned enemy (no baseX) instead just integrates its own vx. The
      // sinusoid's own amplitude (12) can carry a drone's spawn x (only ever chosen in [r, 100-r])
      // outside the world near either edge, so the drifted x is clamped back into [r, 100-r].
      for (let i = 0; i < state.enemies.length; i++) {
        const en = state.enemies[i];
        en.y += en.vy * dtS;
        if (en.kind === "drone" && en.baseX !== undefined) {
          const theta = en.phase + state.elapsed / 400;
          en.x = Math.max(en.r, Math.min(W - en.r, en.baseX + 12 * Math.sin(theta)));
          en.vx = 12 * Math.cos(theta);
        } else {
          en.x += en.vx * dtS;
        }
      }
      state.enemies = state.enemies.filter(function (en) { return en.y - en.r <= H; });

      // bullet-vs-enemy: each bullet resolves against the first enemy (array order) within
      // (enemy.r + bullet.r) of it; a killed enemy pays out and explodes, a survivor just clangs.
      const survivingBullets = [];
      for (let bi = 0; bi < state.bullets.length; bi++) {
        const b = state.bullets[bi];
        let hitIndex = -1;
        for (let ei = 0; ei < state.enemies.length; ei++) {
          const en = state.enemies[ei];
          if (Math.hypot(en.x - b.x, en.y - b.y) <= en.r + b.r) { hitIndex = ei; break; }
        }
        if (hitIndex === -1) { survivingBullets.push(b); continue; }
        const en = state.enemies[hitIndex];
        en.hp -= 1;
        if (en.hp <= 0) {
          state.score += en.kind === "drone" ? 30 : 10;
          events.push({ type: "explode", kind: en.kind, x: en.x, y: en.y });
          state.enemies.splice(hitIndex, 1);
        } else {
          events.push({ type: "hit" });
        }
      }
      state.bullets = survivingBullets;

      // ship-vs-enemy: gated on invulnMs already reading 0 coming INTO this tick (i.e. the check
      // uses the value carried over from the previous tick, not this tick's own decay), a hit
      // resets invulnMs to 1500 without also applying this tick's decay on top of that fresh
      // value. This is the one place this engine's tick() deliberately checks-before-decaying
      // rather than decaying-before-checking (contrast the fire-cooldown block above, which does
      // decay first): a single big tick(dt) that spans an entire 1.5 s invulnerability window
      // (dt > 1500, used by the engine test to fast-forward) must let that window fully elapse
      // without also immediately re-triggering a hit against the same still-present enemy in that
      // same call, the test spawns a fresh enemy right after each such fast-forward specifically
      // to be the thing that registers next tick. Decaying-then-checking (using the post-decay,
      // now-zero value) would instead resolve that hit one tick early, inside the very call whose
      // return value the test discards, and the final scripted life-loss/game-over would never
      // observe its "gameover" event. See the task report's Concerns section.
      if (state.invulnMs > 0) {
        state.invulnMs = Math.max(0, state.invulnMs - dt);
      } else {
        const halfW = state.ship.w / 2, halfH = state.ship.h / 2;
        for (let i = 0; i < state.enemies.length; i++) {
          const en = state.enemies[i];
          if (Math.abs(en.x - state.ship.x) <= halfW + en.r && Math.abs(en.y - state.ship.y) <= halfH + en.r) {
            state.lives -= 1;
            events.push({ type: "damage" });
            state.invulnMs = INVULN_MS;
            state.enemies.splice(i, 1);
            if (state.lives === 0) { state.status = "over"; events.push({ type: "gameover" }); }
            break; // at most one enemy resolved per tick
          }
        }
      }

      // spawning: interval shrinks every wave; drone share rises every wave (capped 50%)
      state.spawnTimer += dt;
      while (state.status === "playing" && state.spawnTimer >= state.spawnInterval) {
        state.spawnTimer -= state.spawnInterval;
        spawnOneEnemy();
      }
      state.waveTimer += dt;
      if (state.waveTimer >= WAVE_MS) {
        state.waveTimer -= WAVE_MS;
        state.wave += 1;
        state.spawnInterval *= SPAWN_INTERVAL_MULT;
        events.push({ type: "wave" });
      }

      return events;
    }

    function dispatch(action) {
      state.inputLog.push([state.tick, action]);
      if (action === "start") { if (state.status === "ready") state.status = "playing"; return []; }
      if (action === "pause") { if (state.status === "playing") state.status = "paused"; return []; }
      if (action === "resume") { if (state.status === "paused") state.status = "playing"; return []; }
      if (state.status !== "playing") return [];

      switch (action) {
        case "leftOn": state.held.left = true; return [];
        case "leftOff": state.held.left = false; return [];
        case "rightOn": state.held.right = true; return [];
        case "rightOff": state.held.right = false; return [];
        case "fireOn": state.held.fire = true; return [];
        case "fireOff": state.held.fire = false; return [];
        default: return [];
      }
    }

    // Test/replay helpers.
    function spawnEnemy(e) { state.enemies.push(Object.assign({}, e)); }
    function setShip(x) { state.ship.x = x; }
    function clearEnemies() { state.enemies = []; } // bullets are untouched
    function hash() { return R.fnv1a(JSON.stringify(state.inputLog)); }

    reset(opts.seed);

    return {
      state: state, dispatch: dispatch, tick: tick, reset: reset,
      spawnEnemy: spawnEnemy, setShip: setShip, clearEnemies: clearEnemies, hash: hash,
    };
  }

  const api = { W: W, H: H, createEngine: createEngine };
  Object.assign(G, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
