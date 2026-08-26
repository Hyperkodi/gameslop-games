/* Armara 2048 engine — pure game logic. No DOM, no timers.
   Classic script that attaches to window.Game.createEngine, plus a CommonJS export for Node tests. */
(function (global) {
  "use strict";
  const R = typeof require === "function" ? require("../../_kit/rng.js") : global.GameSlopKit;
  const G = global.Game = global.Game || {};

  const SIZE = 4;
  const WIN_TILE = 2048;
  const DIRECTIONS = ["up", "down", "left", "right"];

  // Each direction reads/writes one of the board's 4 lines (rows for left/right, columns for
  // up/down) in "move order" — index 0 of the returned line is the cell tiles compact toward.
  const LINES = {
    left: {
      getLine: function (b, i) { return b[i].slice(); },
      setLine: function (b, i, line) { b[i] = line.slice(); },
    },
    right: {
      getLine: function (b, i) { return b[i].slice().reverse(); },
      setLine: function (b, i, line) { b[i] = line.slice().reverse(); },
    },
    up: {
      getLine: function (b, i) { return [b[0][i], b[1][i], b[2][i], b[3][i]]; },
      setLine: function (b, i, line) { for (let y = 0; y < SIZE; y++) b[y][i] = line[y]; },
    },
    down: {
      getLine: function (b, i) { return [b[3][i], b[2][i], b[1][i], b[0][i]]; },
      setLine: function (b, i, line) { for (let y = 0; y < SIZE; y++) b[y][i] = line[SIZE - 1 - y]; },
    },
  };

  // Compact `line` toward index 0, merging equal neighbours once each, left-to-right, then
  // compacting again (the second compaction is implicit: `out` is built already compact).
  function slideLine(line) {
    const vals = line.filter(function (v) { return v !== 0; });
    const merges = [];
    let scoreDelta = 0;
    const out = [];
    let i = 0;
    while (i < vals.length) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
        const merged = vals[i] * 2;
        out.push(merged);
        merges.push(merged);
        scoreDelta += merged;
        i += 2;
      } else {
        out.push(vals[i]);
        i += 1;
      }
    }
    while (out.length < SIZE) out.push(0);
    return { line: out, merges: merges, scoreDelta: scoreDelta };
  }

  function emptyBoard() {
    const b = [];
    for (let y = 0; y < SIZE; y++) b.push([0, 0, 0, 0]);
    return b;
  }
  function deepCopyBoard(b) { return b.map(function (row) { return row.slice(); }); }
  function boardsEqual(a, b) {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (a[y][x] !== b[y][x]) return false;
    return true;
  }
  // True if sliding `board` in `action` would change it (used for the game-over check —
  // must inspect all 4 directions, not just the direction just played).
  function wouldChange(board, action) {
    const spec = LINES[action];
    for (let i = 0; i < SIZE; i++) {
      const line = spec.getLine(board, i);
      const res = slideLine(line);
      for (let k = 0; k < SIZE; k++) if (res.line[k] !== line[k]) return true;
    }
    return false;
  }
  function anyMoveChangesBoard(board) {
    return DIRECTIONS.some(function (a) { return wouldChange(board, a); });
  }

  function createEngine(opts) {
    opts = opts || {};

    const state = {
      status: "ready", score: 0, seed: 0, inputLog: [], tick: 0,
      board: emptyBoard(), bestTile: 0, won: false,
    };
    let rng = null;

    function emptyCells() {
      const cells = [];
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (state.board[y][x] === 0) cells.push({ x: x, y: y });
        }
      }
      return cells;
    }

    // Uniform pick among empty cells via the engine's own rng stream, so seed + inputLog replays
    // it: one rng() call for the cell, one for the 2-vs-4 choice, in that order.
    function spawnTile(events) {
      const cells = emptyCells();
      if (!cells.length) return;
      const idx = Math.floor(rng() * cells.length);
      const cell = cells[idx];
      const value = rng() < 0.9 ? 2 : 4;
      state.board[cell.y][cell.x] = value;
      events.push({ type: "spawn", x: cell.x, y: cell.y, value: value });
    }

    function updateBestTile() {
      let m = 0;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (state.board[y][x] > m) m = state.board[y][x];
      state.bestTile = m;
    }

    function reset(seed) {
      if (seed === undefined) seed = opts.seed === undefined ? (Date.now() >>> 0) : opts.seed;
      state.seed = seed >>> 0;
      rng = R.mulberry32(state.seed);

      state.board = emptyBoard();
      state.score = 0;
      state.won = false;
      state.status = "ready";
      state.inputLog = [];
      state.tick = 0;

      const initEvents = [];
      spawnTile(initEvents);
      spawnTile(initEvents);
      updateBestTile();
    }

    // Slides + merges the board once in `action`'s direction. A no-op result (board unchanged)
    // emits nothing — the caller already logged the action in dispatch(). A real move emits, in
    // order: one slide (from = pre-move board), one merge per merge in scan order, one spawn,
    // then won (first time reaching 2048) and gameover (checked after the spawn) if applicable.
    function move(action) {
      const events = [];
      const spec = LINES[action];
      const before = deepCopyBoard(state.board);
      const newBoard = deepCopyBoard(state.board);
      let scoreDelta = 0;
      const mergeValues = [];
      for (let i = 0; i < SIZE; i++) {
        const line = spec.getLine(state.board, i);
        const res = slideLine(line);
        spec.setLine(newBoard, i, res.line);
        scoreDelta += res.scoreDelta;
        for (let k = 0; k < res.merges.length; k++) mergeValues.push(res.merges[k]);
      }
      if (boardsEqual(before, newBoard)) return events;

      state.board = newBoard;
      state.score += scoreDelta;
      events.push({ type: "slide", from: before });
      for (let k = 0; k < mergeValues.length; k++) events.push({ type: "merge", value: mergeValues[k] });

      spawnTile(events);
      updateBestTile();
      if (!state.won && state.bestTile >= WIN_TILE) { state.won = true; events.push({ type: "won" }); }
      if (!anyMoveChangesBoard(state.board)) { state.status = "over"; events.push({ type: "gameover" }); }
      return events;
    }

    function tick(dt) {
      if (state.status !== "playing") return [];
      state.tick++;
      return [];
    }

    function dispatch(action) {
      state.inputLog.push([state.tick, action]);
      if (action === "start") { if (state.status === "ready") state.status = "playing"; return []; }
      if (action === "pause") { if (state.status === "playing") state.status = "paused"; return []; }
      if (action === "resume") { if (state.status === "paused") state.status = "playing"; return []; }
      if (state.status !== "playing") return [];
      if (!LINES[action]) return [];
      return move(action);
    }

    // Test/replay helper.
    function setBoard(rows) {
      state.board = rows.map(function (row) { return row.slice(); });
    }
    function hash() { return R.fnv1a(JSON.stringify(state.inputLog)); }

    reset(opts.seed);

    return {
      state: state, dispatch: dispatch, tick: tick, reset: reset,
      setBoard: setBoard, hash: hash,
    };
  }

  const api = { SIZE: SIZE, WIN_TILE: WIN_TILE, createEngine: createEngine };
  Object.assign(G, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
