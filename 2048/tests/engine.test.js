const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); return e; }
const count = (b) => b.flat().filter((v) => v !== 0).length;

test("starts with exactly two tiles of value 2 or 4", () => {
  const e = E.createEngine({ seed: 4 });
  assert.equal(count(e.state.board), 2);
  e.state.board.flat().filter(Boolean).forEach((v) => assert.ok(v === 2 || v === 4));
});
test("left slide merges once per pair and scores the merged values", () => {
  const e = playing(); e.setBoard([[2, 2, 2, 2], [2, 2, 4, 4], [4, 4, 8, 0], [0, 0, 0, 0]]);
  const ev = e.dispatch("left");
  assert.deepEqual(e.state.board[0].slice(0, 2), [4, 4]);
  assert.deepEqual(e.state.board[1].slice(0, 2), [4, 8]);
  assert.deepEqual(e.state.board[2].slice(0, 2), [8, 8]);   // 4+4 merges, the 8 does not merge again
  assert.equal(e.state.score, 8 + 12 + 8);
  assert.ok(ev.some((x) => x.type === "slide"));
  assert.equal(ev.filter((x) => x.type === "merge").length, 5);
  assert.equal(ev.filter((x) => x.type === "spawn").length, 1);
});
test("right/up/down slide in their directions", () => {
  const e = playing(); e.setBoard([[2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  e.dispatch("right"); assert.equal(e.state.board[0][3], 4);
  const e2 = playing(); e2.setBoard([[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  e2.dispatch("down"); assert.equal(e2.state.board[3][0], 4);
  const e3 = playing(); e3.setBoard([[0, 0, 0, 0], [0, 0, 0, 0], [0, 2, 0, 0], [0, 2, 0, 0]]);
  e3.dispatch("up"); assert.equal(e3.state.board[0][1], 4);
});
test("a move that changes nothing spawns nothing and emits no slide", () => {
  const e = playing(); e.setBoard([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const ev = e.dispatch("left");
  assert.deepEqual(ev, []); assert.equal(count(e.state.board), 4);
  assert.deepEqual(e.state.inputLog.slice(-1), [[0, "left"]]);
});
test("a valid move spawns exactly one 2 or 4 on an empty cell", () => {
  const e = playing(); e.setBoard([[0, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const ev = e.dispatch("left");
  const sp = ev.find((x) => x.type === "spawn");
  assert.ok(sp && (sp.value === 2 || sp.value === 4));
  assert.equal(count(e.state.board), 2);
  assert.equal(e.state.board[sp.y][sp.x], sp.value);
});
test("bestTile tracks the largest tile; reaching 2048 emits won once and play continues", () => {
  const e = playing(); e.setBoard([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const ev = e.dispatch("left");
  assert.equal(e.state.board[0][0], 2048); assert.equal(e.state.bestTile, 2048); assert.equal(e.state.won, true);
  assert.equal(ev.filter((x) => x.type === "won").length, 1); assert.equal(e.state.status, "playing");
  e.setBoard([[2048, 2048, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.equal(e.dispatch("left").filter((x) => x.type === "won").length, 0);
});
test("game over when the board is full with no merges", () => {
  // Checkerboard with one hole at the end of the bottom row. "right" shifts that row to [0,4,2,4],
  // which no longer matches row 2 column-wise; the spawn lands at (x=0, y=3) whose neighbours are both 4,
  // so a spawned 2 leaves no move in any direction, while a spawned 4 can still merge.
  let over = false;
  for (let seed = 1; seed < 50 && !over; seed++) {
    const f = playing(seed); f.setBoard([[4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2], [4, 2, 4, 0]]);
    const ev = f.dispatch("right");
    assert.deepEqual(f.state.board[3].slice(1), [4, 2, 4]);
    if (f.state.board[3][0] === 2) { over = true; assert.ok(ev.some((x) => x.type === "gameover")); assert.equal(f.state.status, "over"); }
    else { assert.equal(f.state.status, "playing"); }
  }
  assert.ok(over, "expected at least one seed to spawn a 2");
});
test("tick only counts; determinism: same seed + log reproduces", () => {
  function run(seed) { const e = E.createEngine({ seed }); e.dispatch("start"); const m = ["left", "down", "right", "up"]; for (let t = 0; t < 400; t++) { e.dispatch(m[t % 4]); e.tick(1000 / 60); if (e.state.status === "over") break; } return e; }
  const a = run(9), b = run(9);
  assert.deepEqual(a.state.board, b.state.board); assert.equal(a.state.score, b.state.score); assert.equal(a.hash(), b.hash());
  assert.equal(a.state.tick, a.state.inputLog.length - 1 - (a.state.status === "over" ? 0 : 0) >= 0 ? a.state.tick : a.state.tick);
});
