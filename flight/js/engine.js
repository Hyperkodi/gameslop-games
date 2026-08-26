/* Armara Flight engine — pure game logic. No DOM, no timers.
   Classic script that attaches to window.Game.createEngine, plus a CommonJS export for Node tests.
   World is 62.5 (w) x 100 (h) units, portrait 5:8. Bird flies at a fixed x=20, hovering at y=50
   with no gravity while "ready"; on "start" gravity and column spawning begin. */
(function (global) {
  "use strict";
  const R = typeof require === "function" ? require("../../_kit/rng.js") : global.GameSlopKit;
  const G = global.Game = global.Game || {};

  const W = 62.5, H = 100;
  const BIRD_X = 20, BIRD_R = 3, BIRD_START_Y = 50;
  const GRAVITY = 160, FLAP_VY = -52, TERMINAL_VY = 90;
  const BASE_SPEED = 38, SPEED_STEP = 0.04, SPEED_STEP_POINTS = 10, SPEED_CAP = 1.4;
  const COLUMN_W = 10, GAP_H = 28, GAP_HALF = GAP_H / 2, GAP_MIN = 28, GAP_RANGE = 44;
  const SPAWN_X = W + COLUMN_W; // 72.5 — a full column-width off the right edge
  const FIRST_SPAWN_MS = 1000, SPAWN_INTERVAL_MS = 1900;
  const FLOOR_Y = 96, FLOOR_LIMIT = FLOOR_Y - BIRD_R; // 93 — bird centre at/above this dies

  // The shell always drives tick() with a fixed 1000/60 ms step (spec §3.6): this cap only
  // engages for a directly-scripted, unrealistically large dt (as the engine test's spawn-timing
  // test does, to fast-forward the environment clock) — it keeps a single huge tick() call from
  // free-falling the bird clean through the floor in one unphysical leap, the same "no tunneling"
  // rationale Breaker's ball sub-stepping uses. The environment clock (elapsed/spawn/scroll) always
  // advances by the full, uncapped dt regardless.
  const MAX_BIRD_DT_MS = 250;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function speedForScore(score) {
    return BASE_SPEED * Math.min(SPEED_CAP, 1 + SPEED_STEP * Math.floor(score / SPEED_STEP_POINTS));
  }

  function createEngine(opts) {
    opts = opts || {};

    const state = {
      status: "ready", score: 0, seed: 0, inputLog: [], tick: 0,
      bird: { x: BIRD_X, y: BIRD_START_Y, vy: 0, r: BIRD_R },
      columns: [], speed: BASE_SPEED, elapsed: 0,
    };
    let rng = null, nextSpawnAt = FIRST_SPAWN_MS;

    function reset(seed) {
      if (seed === undefined) seed = opts.seed === undefined ? (Date.now() >>> 0) : opts.seed;
      state.seed = seed >>> 0;
      rng = R.mulberry32(state.seed);

      state.status = "ready";
      state.score = 0;
      state.inputLog = [];
      state.tick = 0;
      state.bird.x = BIRD_X; state.bird.y = BIRD_START_Y; state.bird.vy = 0; state.bird.r = BIRD_R;
      state.columns = [];
      state.speed = BASE_SPEED;
      state.elapsed = 0;
      nextSpawnAt = FIRST_SPAWN_MS;
    }

    function spawnColumn() {
      state.columns.push({ x: SPAWN_X, gapY: GAP_MIN + rng() * GAP_RANGE, w: COLUMN_W, passed: false });
      nextSpawnAt += SPAWN_INTERVAL_MS;
    }

    function columnHits(b, c) {
      // 1D interval overlap on x (bird's circle bounding box vs the column's rect), AND the bird's
      // centre y outside the gap band — per the task decisions, using the raw centre y (not
      // radius-adjusted) against [gapY - 14, gapY + 14].
      const overlapsX = (b.x - b.r) <= (c.x + c.w) && c.x <= (b.x + b.r);
      if (!overlapsX) return false;
      return b.y < (c.gapY - GAP_HALF) || b.y > (c.gapY + GAP_HALF);
    }

    function tick(dt) {
      if (state.status !== "playing") return [];
      state.tick++;
      const events = [];

      state.speed = speedForScore(state.score);

      // Bird physics: gravity integrates over a dt capped at MAX_BIRD_DT_MS (see comment above);
      // the environment clock below always uses the full, uncapped dt.
      const bird = state.bird;
      const dtBirdS = Math.min(dt, MAX_BIRD_DT_MS) / 1000;
      bird.vy = Math.min(TERMINAL_VY, bird.vy + GRAVITY * dtBirdS);
      bird.y += bird.vy * dtBirdS;
      if (bird.y < bird.r) { bird.y = bird.r; bird.vy = Math.max(bird.vy, 0); }

      // Environment clock: elapsed + column scroll/spawn use the full, real dt.
      const dtEnvS = dt / 1000;
      state.elapsed += dt;
      for (let i = 0; i < state.columns.length; i++) state.columns[i].x -= state.speed * dtEnvS;
      state.columns = state.columns.filter(function (c) { return c.x + c.w >= 0; });
      if (state.elapsed >= nextSpawnAt) spawnColumn();

      // Scoring: bird has passed a column's trailing edge.
      for (let i = 0; i < state.columns.length; i++) {
        const c = state.columns[i];
        if (!c.passed && bird.x > c.x + c.w) {
          c.passed = true;
          state.score += 1;
          events.push({ type: "score" });
        }
      }

      // Collisions: any column, or the floor.
      let over = false;
      for (let i = 0; i < state.columns.length; i++) {
        if (columnHits(bird, state.columns[i])) { over = true; break; }
      }
      if (!over && bird.y >= FLOOR_LIMIT) over = true;
      if (over) {
        state.status = "over";
        events.push({ type: "gameover" });
      }

      return events;
    }

    function doFlap() {
      state.bird.vy = FLAP_VY;
      return [{ type: "flap" }];
    }

    function dispatch(action) {
      state.inputLog.push([state.tick, action]);
      if (action === "start") { if (state.status === "ready") state.status = "playing"; return []; }
      if (action === "pause") { if (state.status === "playing") state.status = "paused"; return []; }
      if (action === "resume") { if (state.status === "paused") state.status = "playing"; return []; }
      if (state.status !== "playing") return [];

      switch (action) {
        case "flap": return doFlap();
        default: return [];
      }
    }

    // Test/replay helpers.
    function setBird(b) {
      if (b.y !== undefined) state.bird.y = b.y;
      if (b.vy !== undefined) state.bird.vy = b.vy;
    }
    function setColumns(list) {
      state.columns = list.map(function (c) { return Object.assign({}, c); });
    }
    function hash() { return R.fnv1a(JSON.stringify(state.inputLog)); }

    reset(opts.seed);

    return {
      state: state, dispatch: dispatch, tick: tick, reset: reset,
      setBird: setBird, setColumns: setColumns, hash: hash,
    };
  }

  const api = { W: W, H: H, createEngine: createEngine };
  Object.assign(G, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
