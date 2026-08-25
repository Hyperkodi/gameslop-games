/* Armaratris engine — pure game logic. No DOM, no timers.
   Classic script that attaches to window.Armaratris, plus a CommonJS export for Node tests. */
(function (global) {
  "use strict";

  const COLS = 10;
  const ROWS = 22;          // 2 hidden rows on top + 20 visible
  const HIDDEN_ROWS = 2;
  const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];
  const ROT_NAMES = "0R2L";
  const SPAWN = { x: 3, y: 0, rot: 0 };
  const LOCK_DELAY_MS = 500;
  const MAX_LOCK_RESETS = 15;
  const SOFT_DROP_FACTOR = 20;
  const QUEUE_SIZE = 3;
  const GRAVITY_MS = [1000, 793, 618, 473, 355, 262, 190, 135, 94, 64, 43, 28, 18, 11, 7];
  const LINE_SCORES = [0, 100, 300, 500, 800];

  // SRS shapes: [dx, dy] offsets per rotation state 0, R, 2, L. y grows downward.
  const SHAPES = {
    I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
    O: [[[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]],
    T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
    S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
    Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
    J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
    L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]],
  };

  // SRS wall kicks, already converted to y-down ([dx, dy]). Key = fromState + toState using "0R2L".
  const KICKS = {
    JLSTZ: {
      "0R": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      "R0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      "R2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      "2R": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      "2L": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      "L2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      "L0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      "0L": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    },
    I: {
      "0R": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      "R0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      "R2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
      "2R": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      "2L": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      "L2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      "L0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      "0L": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    },
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createBag(rng) {
    let bag = [];
    return function next() {
      if (bag.length === 0) {
        bag = TYPES.slice();
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
        }
      }
      return bag.pop();
    };
  }

  function sequence(seed, n) {
    const next = createBag(mulberry32(seed));
    const out = [];
    for (let i = 0; i < n; i++) out.push(next());
    return out;
  }

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function gravityMs(level) {
    return GRAVITY_MS[Math.min(Math.max(level, 1), GRAVITY_MS.length) - 1];
  }

  function emptyBoard() {
    const b = [];
    for (let y = 0; y < ROWS; y++) b.push(new Array(COLS).fill(null));
    return b;
  }

  function cellsOf(piece) {
    return SHAPES[piece.type][piece.rot].map(function (d) { return [piece.x + d[0], piece.y + d[1]]; });
  }

  function createEngine(opts) {
    opts = opts || {};
    const startLevel = opts.startLevel || 1;

    const state = {
      board: emptyBoard(), active: null, hold: null, holdUsed: false, queue: [],
      score: 0, lines: 0, level: startLevel, status: "ready", seed: 0, inputLog: [], tick: 0,
    };
    let nextFromBag = null;
    let gravityAcc = 0, lockTimer = 0, lockResets = 0, softDrop = false;

    function fits(piece) {
      const cells = cellsOf(piece);
      for (let i = 0; i < cells.length; i++) {
        const x = cells[i][0], y = cells[i][1];
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
        if (state.board[y][x] !== null) return false;
      }
      return true;
    }

    function shifted(piece, dx, dy) {
      return { type: piece.type, rot: piece.rot, x: piece.x + dx, y: piece.y + dy };
    }

    function resetPieceTimers() {
      gravityAcc = 0; lockTimer = 0; lockResets = 0;
    }

    function gameOver(events) {
      state.status = "over";
      events.push({ type: "gameover" });
    }

    // Places a piece at the spawn position; if it fits one row lower, drops it there at once
    // so a visible cell exists from the first frame (spec 3.1). Not a player move: no
    // onPlayerMoved, no input-log entry. Block-out is still judged at the spawn position.
    function place(type, events) {
      state.active = { type: type, rot: SPAWN.rot, x: SPAWN.x, y: SPAWN.y };
      resetPieceTimers();
      if (!fits(state.active)) { gameOver(events); return; } // block-out
      if (fits(shifted(state.active, 0, 1))) state.active = shifted(state.active, 0, 1);
    }

    function spawn(events) {
      const type = state.queue.shift();
      state.queue.push(nextFromBag());
      place(type, events);
    }

    function reset(seed) {
      if (seed === undefined) seed = opts.seed === undefined ? (Date.now() >>> 0) : opts.seed;
      state.seed = seed >>> 0;
      nextFromBag = createBag(mulberry32(state.seed));
      state.board = emptyBoard();
      state.hold = null; state.holdUsed = false;
      state.queue = [];
      for (let i = 0; i < QUEUE_SIZE; i++) state.queue.push(nextFromBag());
      state.score = 0; state.lines = 0; state.level = startLevel;
      state.status = "ready"; state.inputLog = []; state.tick = 0;
      softDrop = false;
      spawn([]);
    }

    function onPlayerMoved() {
      if (!fits(shifted(state.active, 0, 1)) && lockResets < MAX_LOCK_RESETS) { lockTimer = 0; lockResets++; }
    }

    function tryMove(dx, dy) {
      const p = shifted(state.active, dx, dy);
      if (!fits(p)) return false;
      state.active = p;
      onPlayerMoved();
      return true;
    }

    function tryRotate(dir) {
      const a = state.active;
      if (a.type === "O") return false;
      const from = a.rot, to = (a.rot + dir + 4) % 4;
      const table = (a.type === "I" ? KICKS.I : KICKS.JLSTZ)[ROT_NAMES[from] + ROT_NAMES[to]];
      for (let i = 0; i < table.length; i++) {
        const cand = { type: a.type, rot: to, x: a.x + table[i][0], y: a.y + table[i][1] };
        if (fits(cand)) { state.active = cand; onPlayerMoved(); return true; }
      }
      return false;
    }

    function ghostY() {
      let y = state.active.y;
      while (fits(shifted(state.active, 0, y - state.active.y + 1))) y++;
      return y;
    }

    function clearLines(events, boardSnapshot) {
      const cleared = [];
      for (let y = ROWS - 1; y >= 0; y--) {
        if (state.board[y].every(function (c) { return c !== null; })) cleared.push(y);
      }
      if (cleared.length === 0) return;
      const remaining = state.board.filter(function (row, y) { return cleared.indexOf(y) === -1; });
      while (remaining.length < ROWS) remaining.unshift(new Array(COLS).fill(null));
      state.board = remaining;
      const n = cleared.length;
      state.lines += n;
      state.score += LINE_SCORES[n] * state.level;
      events.push({ type: "clear", lines: n, rows: cleared.slice().sort(function (a, b) { return a - b; }), board: boardSnapshot });
      const newLevel = startLevel + Math.floor(state.lines / 10);
      if (newLevel !== state.level) {
        state.level = newLevel;
        events.push({ type: "level", level: newLevel });
      }
    }

    function lock() {
      const events = [{ type: "lock" }];
      const cells = cellsOf(state.active);
      let allHidden = true;
      for (let i = 0; i < cells.length; i++) {
        const x = cells[i][0], y = cells[i][1];
        state.board[y][x] = state.active.type;
        if (y >= HIDDEN_ROWS) allHidden = false;
      }
      if (allHidden) { gameOver(events); return events; } // lock-out
      const anyFull = state.board.some(function (row) { return row.every(function (c) { return c !== null; }); });
      const boardCopy = anyFull ? state.board.map(function (r) { return r.slice(); }) : null;
      clearLines(events, boardCopy);
      state.holdUsed = false;
      spawn(events);
      return events;
    }

    function doHold() {
      if (state.holdUsed || !state.active) return [];
      const events = [{ type: "hold" }];
      const current = state.active.type;
      if (state.hold === null) {
        state.hold = current;
        spawn(events);
      } else {
        const swapIn = state.hold;
        state.hold = current;
        place(swapIn, events);
      }
      state.holdUsed = true;
      return events;
    }

    function hardDrop() {
      const gy = ghostY();
      const dist = gy - state.active.y;
      state.active = shifted(state.active, 0, dist);
      state.score += 2 * dist;
      return lock();
    }

    function tick(dt) {
      if (state.status !== "playing" || !state.active) return [];
      const events = [];
      state.tick++;
      const interval = softDrop ? gravityMs(state.level) / SOFT_DROP_FACTOR : gravityMs(state.level);
      gravityAcc += dt;
      while (gravityAcc >= interval) {
        gravityAcc -= interval;
        if (fits(shifted(state.active, 0, 1))) {
          state.active = shifted(state.active, 0, 1);
          if (softDrop) state.score += 1;
        } else {
          gravityAcc = 0;
          break;
        }
      }
      if (!fits(shifted(state.active, 0, 1))) {
        lockTimer += dt;
        if (lockTimer >= LOCK_DELAY_MS) Array.prototype.push.apply(events, lock());
      } else {
        lockTimer = 0;
      }
      return events;
    }

    function dispatch(action) {
      state.inputLog.push([state.tick, action]);
      const events = [];
      if (action === "start") { if (state.status === "ready") state.status = "playing"; return events; }
      if (action === "pause") { if (state.status === "playing") state.status = "paused"; return events; }
      if (action === "resume") { if (state.status === "paused") state.status = "playing"; return events; }
      if (state.status !== "playing" || !state.active) return events;
      switch (action) {
        case "left": if (tryMove(-1, 0)) events.push({ type: "move" }); break;
        case "right": if (tryMove(1, 0)) events.push({ type: "move" }); break;
        case "rotateCW": if (tryRotate(1)) events.push({ type: "rotate" }); break;
        case "rotateCCW": if (tryRotate(-1)) events.push({ type: "rotate" }); break;
        case "softDropOn": softDrop = true; break;
        case "softDropOff": softDrop = false; break;
        case "hardDrop": Array.prototype.push.apply(events, hardDrop()); break;
        case "hold": Array.prototype.push.apply(events, doHold()); break;
        default: break;
      }
      return events;
    }

    // Test/replay helpers. rows: array of strings ('.' empty, letter = tile type), bottom-aligned if fewer than ROWS.
    function setBoard(rows) {
      const b = emptyBoard();
      const offset = ROWS - rows.length;
      for (let i = 0; i < rows.length; i++) {
        for (let x = 0; x < COLS; x++) {
          const ch = rows[i][x];
          b[offset + i][x] = ch && ch !== "." ? ch : null;
        }
      }
      state.board = b;
    }
    function setActive(piece) {
      state.active = { type: piece.type, rot: piece.rot || 0, x: piece.x, y: piece.y };
      resetPieceTimers();
    }
    function hash() { return fnv1a(JSON.stringify(state.inputLog)); }

    reset(opts.seed);

    return { state: state, dispatch: dispatch, tick: tick, ghostY: ghostY, reset: reset, setBoard: setBoard, setActive: setActive, hash: hash };
  }

  const api = {
    COLS: COLS, ROWS: ROWS, HIDDEN_ROWS: HIDDEN_ROWS, TYPES: TYPES, SHAPES: SHAPES, KICKS: KICKS,
    GRAVITY_MS: GRAVITY_MS, LINE_SCORES: LINE_SCORES, LOCK_DELAY_MS: LOCK_DELAY_MS, MAX_LOCK_RESETS: MAX_LOCK_RESETS,
    mulberry32: mulberry32, createBag: createBag, sequence: sequence, fnv1a: fnv1a, gravityMs: gravityMs, cellsOf: cellsOf,
    createEngine: createEngine,
  };
  global.Armaratris = global.Armaratris || {};
  Object.assign(global.Armaratris, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
