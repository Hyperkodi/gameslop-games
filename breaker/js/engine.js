/* Armara Breaker engine: pure game logic. No DOM, no timers.
   Classic script that attaches to window.Game.createEngine, plus a CommonJS export for Node tests.
   World is 100 (w) x 150 (h) units. No randomness is used by gameplay (brick layout, paddle and
   ball motion are all deterministic from formulas), but the rng/hash machinery is still wired up
   per the shared kit convention so state.seed and hash() behave like every other engine. */
(function (global) {
  "use strict";
  const R = typeof require === "function" ? require("../../_kit/rng.js") : global.GameSlopKit;
  const G = global.Game = global.Game || {};

  const W = 100, H = 150;
  const COLS = 10, ROWS = 6;
  const BRICK_W = 9.4, BRICK_H = 4.2, BRICK_TOP = 12, BRICK_GAP_X = 10, BRICK_GAP_Y = 4.8;
  const PADDLE_W = 18, PADDLE_H = 3, PADDLE_Y = 142, PADDLE_SPEED = 90;
  const BALL_R = 1.5, BALL_BASE_SPEED = 55, LEVEL_SPEED_MULT = 1.06;
  const START_LIVES = 3;
  const TIER_POINTS = { bronze: 30, gold: 20, marble: 10 };
  const TIER_HITS = { bronze: 2, gold: 1, marble: 1 };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function tierForRow(row) { return row < 2 ? "bronze" : row < 4 ? "gold" : "marble"; }

  function makeBricks() {
    const list = [];
    for (let row = 0; row < ROWS; row++) {
      const tier = tierForRow(row);
      for (let col = 0; col < COLS; col++) {
        list.push({
          x: 3 + col * BRICK_GAP_X, y: BRICK_TOP + row * BRICK_GAP_Y,
          w: BRICK_W, h: BRICK_H, hits: TIER_HITS[tier], tier: tier,
        });
      }
    }
    return list;
  }

  function createEngine(opts) {
    opts = opts || {};

    const state = {
      status: "ready", score: 0, level: 1, lives: START_LIVES, seed: 0, inputLog: [], tick: 0,
      paddle: { x: 50, w: PADDLE_W, y: PADDLE_Y, h: PADDLE_H },
      ball: { x: 50, y: PADDLE_Y - BALL_R - 0.1, r: BALL_R, vx: 0, vy: 0, attached: true },
      bricks: [], held: { left: false, right: false },
    };
    let rng = null;

    function ballSpeedForLevel() { return BALL_BASE_SPEED * Math.pow(LEVEL_SPEED_MULT, state.level - 1); }

    function attachBall() {
      const b = state.ball;
      b.attached = true; b.vx = 0; b.vy = 0;
      b.x = state.paddle.x; b.y = state.paddle.y - b.r - 0.1;
    }

    function reset(seed) {
      if (seed === undefined) seed = opts.seed === undefined ? (Date.now() >>> 0) : opts.seed;
      state.seed = seed >>> 0;
      rng = R.mulberry32(state.seed);

      state.status = "ready";
      state.score = 0;
      state.level = 1;
      state.lives = START_LIVES;
      state.inputLog = [];
      state.tick = 0;
      state.held.left = false; state.held.right = false;
      state.paddle.x = 50; state.paddle.w = PADDLE_W; state.paddle.y = PADDLE_Y; state.paddle.h = PADDLE_H;
      state.bricks = makeBricks();
      attachBall();
    }

    // Angle-from-hit-offset formula shared by the paddle bounce and by launch (whose offset is
    // always 0 since the attached ball is kept centred on the paddle): angle = -90 + 60*ratio,
    // clamped to ±60 degrees either side of straight up, ratio = (hitX - paddleX) / (paddle.w/2).
    function angleFromOffset(hitX, paddleX, halfW) {
      let ratio = (hitX - paddleX) / halfW;
      ratio = clamp(ratio, -1, 1);
      return (-90 + 60 * ratio) * Math.PI / 180;
    }

    function reflectFromPaddle(events) {
      const b = state.ball, p = state.paddle;
      const speed = Math.hypot(b.vx, b.vy);
      const angle = angleFromOffset(b.x, p.x, p.w / 2);
      b.vx = speed * Math.cos(angle);
      b.vy = speed * Math.sin(angle);
      b.y = p.y - b.r - 0.01;
      events.push({ type: "bounce" });
    }

    function levelUp(events) {
      state.score += 250;
      state.level += 1;
      state.bricks = makeBricks();
      attachBall();
      events.push({ type: "level" });
    }

    // Circle-vs-AABB: find the closest point on the brick rect to the ball centre; if within the
    // ball's radius, resolve on the axis the ball actually crossed to get here, determined from
    // its pre-sub-step position (prevX, prevY), robust against a ball that is already deeply
    // embedded in the brick by the time it's checked (a purely geometric "axis of least
    // penetration" test picks the wrong side in that case and can ping-pong through neighbouring
    // bricks). Falls back to the dominant velocity component only if the ball was already
    // overlapping before this sub-step moved it. Only the first matching brick (array order) is
    // resolved per sub-step.
    function checkBrickCollision(events, prevX, prevY) {
      const b = state.ball;
      for (let i = 0; i < state.bricks.length; i++) {
        const k = state.bricks[i];
        const cx = clamp(b.x, k.x, k.x + k.w);
        const cy = clamp(b.y, k.y, k.y + k.h);
        const dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy > b.r * b.r) continue;

        const wasAbove = prevY + b.r <= k.y, wasBelow = prevY - b.r >= k.y + k.h;
        const wasLeft = prevX + b.r <= k.x, wasRight = prevX - b.r >= k.x + k.w;
        const axis = (wasAbove || wasBelow) ? "y" : (wasLeft || wasRight) ? "x" :
          (Math.abs(b.vy) >= Math.abs(b.vx) ? "y" : "x");

        if (axis === "x") {
          b.x = b.vx > 0 ? k.x - b.r : k.x + k.w + b.r;
          b.vx = -b.vx;
        } else {
          b.y = b.vy > 0 ? k.y - b.r : k.y + k.h + b.r;
          b.vy = -b.vy;
        }

        k.hits -= 1;
        const destroyed = k.hits <= 0;
        events.push({ type: "brick", tier: k.tier, destroyed: destroyed });
        if (destroyed) {
          state.score += TIER_POINTS[k.tier];
          state.bricks.splice(i, 1);
          if (state.bricks.length === 0) levelUp(events);
        }
        return; // only one brick per sub-step
      }
    }

    function substep(subDt, events) {
      const b = state.ball;
      const prevX = b.x, prevY = b.y;
      b.x += b.vx * subDt / 1000;
      b.y += b.vy * subDt / 1000;

      // walls: x (left/right) and top only, the bottom is the life-loss boundary, not a wall.
      if (b.x - b.r < 0) {
        b.x = b.r; b.vx = Math.abs(b.vx); events.push({ type: "bounce" });
      } else if (b.x + b.r > W) {
        b.x = W - b.r; b.vx = -Math.abs(b.vx); events.push({ type: "bounce" });
      }
      if (b.y - b.r < 0) {
        b.y = b.r; b.vy = Math.abs(b.vy); events.push({ type: "bounce" });
      }

      // paddle: ball's bottom crosses the paddle's top while moving down, within its x-range.
      const p = state.paddle;
      if (b.vy > 0 && (b.y + b.r) >= p.y && (b.y - b.r) <= p.y + p.h &&
          (b.x + b.r) >= p.x - p.w / 2 && (b.x - b.r) <= p.x + p.w / 2) {
        reflectFromPaddle(events);
      }

      checkBrickCollision(events, prevX, prevY);

      if (b.y - b.r > H) {
        state.lives -= 1;
        events.push({ type: "life" });
        if (state.lives <= 0) {
          state.status = "over";
          events.push({ type: "gameover" });
        } else {
          attachBall();
        }
      }
    }

    function tick(dt) {
      if (state.status !== "playing") return [];
      state.tick++;
      const events = [];

      const dir = (state.held.right ? 1 : 0) - (state.held.left ? 1 : 0);
      if (dir !== 0) {
        const half = state.paddle.w / 2;
        state.paddle.x = clamp(state.paddle.x + dir * PADDLE_SPEED * dt / 1000, half, W - half);
      }

      if (state.ball.attached) {
        state.ball.x = state.paddle.x;
        state.ball.y = state.paddle.y - state.ball.r - 0.1;
      } else {
        const speed = Math.hypot(state.ball.vx, state.ball.vy);
        const totalDist = speed * dt / 1000;
        const steps = Math.max(1, Math.ceil(totalDist / 2));
        const subDt = dt / steps;
        for (let i = 0; i < steps; i++) {
          substep(subDt, events);
          if (state.status !== "playing" || state.ball.attached) break;
        }
      }

      return events;
    }

    // Launch angle: straight up (-90°) with up to ±15° of rng-chosen jitter, so consecutive
    // launches (after a life is lost, or a fresh level) don't all fire on the same line.
    function doLaunch() {
      const events = [];
      if (!state.ball.attached) return events;
      const speed = ballSpeedForLevel();
      const jitterDeg = (rng() * 2 - 1) * 15;
      const angle = (-90 + jitterDeg) * Math.PI / 180;
      state.ball.vx = speed * Math.cos(angle);
      state.ball.vy = speed * Math.sin(angle);
      state.ball.attached = false;
      events.push({ type: "launch" });
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
        case "launch": return doLaunch();
        default: return [];
      }
    }

    // Test/replay helpers.
    function setBall(b) {
      state.ball.x = b.x; state.ball.y = b.y; state.ball.vx = b.vx; state.ball.vy = b.vy; state.ball.attached = b.attached;
    }
    function setBricks(list) {
      state.bricks = list.map(function (b) { return Object.assign({}, b); });
    }
    function setPaddle(x) { state.paddle.x = x; }
    function hash() { return R.fnv1a(JSON.stringify(state.inputLog)); }

    reset(opts.seed);

    return {
      state: state, dispatch: dispatch, tick: tick, reset: reset,
      setBall: setBall, setBricks: setBricks, setPaddle: setPaddle, hash: hash,
    };
  }

  const api = { W: W, H: H, COLS: COLS, ROWS: ROWS, createEngine: createEngine };
  Object.assign(G, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
