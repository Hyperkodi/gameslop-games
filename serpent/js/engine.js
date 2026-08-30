/* Armara Serpent engine: pure game logic. No DOM, no timers.
   Classic script that attaches to window.Game.createEngine, plus a CommonJS export for Node tests. */
(function (global) {
  "use strict";
  const R = typeof require === "function" ? require("../../_kit/rng.js") : global.GameSlopKit;
  const G = global.Game = global.Game || {};

  const W = 20, H = 20;
  const START_LEN = 3;
  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  function createEngine(opts) {
    opts = opts || {};

    const state = {
      status: "ready", score: 0, seed: 0, inputLog: [], tick: 0,
      w: W, h: H, snake: [], dir: { x: 1, y: 0 }, pickup: { x: 0, y: 0 }, pickups: 0, length: START_LEN,
    };
    let rng = null;
    let acc = 0;
    let turnQueue = [];

    function stepMs() {
      return Math.max(70, 200 - 6 * state.pickups);
    }

    // All cells not currently occupied by the snake, in a fixed row-major order.
    function emptyCells() {
      const occ = new Set(state.snake.map(function (s) { return s.x + "," + s.y; }));
      const cells = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!occ.has(x + "," + y)) cells.push({ x: x, y: y });
        }
      }
      return cells;
    }

    // Uniform pick among empty cells via the engine's own rng stream, so seed + inputLog replays it.
    // A full board (no empty cell) is unreachable at the 20x20 grid size in practice, but leaves
    // pickup null rather than crashing rng()'s index math against an empty list, step() below
    // tolerates a null pickup by skipping the eat check.
    function spawnPickup() {
      const cells = emptyCells();
      if (cells.length === 0) { state.pickup = null; return; }
      const idx = Math.floor(rng() * cells.length);
      state.pickup = cells[idx];
    }

    function reset(seed) {
      if (seed === undefined) seed = opts.seed === undefined ? (Date.now() >>> 0) : opts.seed;
      state.seed = seed >>> 0;
      rng = R.mulberry32(state.seed);

      const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
      state.snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
      state.dir = { x: 1, y: 0 };
      state.length = state.snake.length;
      state.score = 0;
      state.pickups = 0;
      state.status = "ready";
      state.inputLog = [];
      state.tick = 0;
      acc = 0;
      turnQueue = [];
      spawnPickup();
    }

    // Advances the snake by one cell in state.dir (applying at most one queued turn first).
    // Wall/self collisions leave state.snake untouched, the engine keeps the snake as it was.
    function step(events) {
      if (turnQueue.length) state.dir = turnQueue.shift();

      const head = state.snake[0];
      const newHead = { x: head.x + state.dir.x, y: head.y + state.dir.y };
      if (newHead.x < 0 || newHead.x >= W || newHead.y < 0 || newHead.y >= H) {
        state.status = "over";
        events.push({ type: "gameover" });
        return;
      }

      const ate = state.pickup !== null && newHead.x === state.pickup.x && newHead.y === state.pickup.y;
      // Eating keeps the tail (the snake grows); otherwise the tail cell is vacated this step,
      // so moving into it is legal, collision is checked against the post-move body below.
      const newSnake = ate
        ? [newHead].concat(state.snake)
        : [newHead].concat(state.snake.slice(0, state.snake.length - 1));

      const collided = newSnake.slice(1).some(function (seg) { return seg.x === newHead.x && seg.y === newHead.y; });
      if (collided) {
        state.status = "over";
        events.push({ type: "gameover" });
        return;
      }

      state.snake = newSnake;
      state.length = newSnake.length;
      if (ate) {
        state.pickups += 1;
        state.score += 10 + Math.floor(state.length / 5) * 5;
        events.push({ type: "eat" });
        spawnPickup();
      }
    }

    function tick(dt) {
      if (state.status !== "playing") return [];
      state.tick++;
      const events = [];
      acc += dt;
      while (acc >= stepMs()) {
        acc -= stepMs();
        step(events);
        if (state.status !== "playing") { acc = 0; break; }
      }
      return events;
    }

    function dispatch(action) {
      state.inputLog.push([state.tick, action]);
      const events = [];
      if (action === "start") { if (state.status === "ready") state.status = "playing"; return events; }
      if (action === "pause") { if (state.status === "playing") state.status = "paused"; return events; }
      if (action === "resume") { if (state.status === "paused") state.status = "playing"; return events; }
      if (state.status !== "playing") return events;

      const vec = DIRS[action];
      if (!vec) return events;
      const ref = turnQueue.length ? turnQueue[turnQueue.length - 1] : state.dir;
      const isOpposite = vec.x === -ref.x && vec.y === -ref.y;
      const isSame = vec.x === ref.x && vec.y === ref.y;
      if (isOpposite || isSame) return events;
      if (turnQueue.length >= 2) return events;
      turnQueue.push(vec);
      events.push({ type: "turn" });
      return events;
    }

    // Test/replay helpers.
    function setSnake(cells, dir) {
      state.snake = cells.map(function (c) { return { x: c.x, y: c.y }; });
      state.dir = { x: dir.x, y: dir.y };
      state.length = state.snake.length;
      acc = 0;
      turnQueue = [];
    }
    function setPickup(x, y) { state.pickup = { x: x, y: y }; }
    function hash() { return R.fnv1a(JSON.stringify(state.inputLog)); }

    reset(opts.seed);

    return {
      state: state, dispatch: dispatch, tick: tick, stepMs: stepMs, reset: reset,
      setSnake: setSnake, setPickup: setPickup, hash: hash,
    };
  }

  const api = { W: W, H: H, START_LEN: START_LEN, createEngine: createEngine };
  Object.assign(G, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
