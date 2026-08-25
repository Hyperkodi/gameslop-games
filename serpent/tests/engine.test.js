const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
const DT = 1000 / 60;
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); return e; }

test("starts ready, length 3, centred, moving right, one pickup off the snake", () => {
  const e = E.createEngine({ seed: 3 });
  assert.equal(e.state.status, "ready");
  assert.equal(e.state.snake.length, 3);
  assert.deepEqual(e.state.dir, { x: 1, y: 0 });
  assert.deepEqual(e.state.snake[0], { x: 10, y: 10 });
  assert.deepEqual(e.state.snake[2], { x: 8, y: 10 });
  assert.ok(!e.state.snake.some((s) => s.x === e.state.pickup.x && s.y === e.state.pickup.y));
  assert.equal(e.state.length, 3);
});
test("steps every 200 ms at zero pickups", () => {
  const e = playing();
  e.tick(199); assert.deepEqual(e.state.snake[0], { x: 10, y: 10 });
  e.tick(1); assert.deepEqual(e.state.snake[0], { x: 11, y: 10 });
  assert.equal(e.state.snake.length, 3);
});
test("stepMs shortens with pickups and floors at 70", () => {
  const e = playing();
  assert.equal(e.stepMs(), 200);
  e.state.pickups = 10; assert.equal(e.stepMs(), 140);
  e.state.pickups = 50; assert.equal(e.stepMs(), 70);
});
test("eating grows the snake, scores, spawns a new pickup on an empty cell", () => {
  const e = playing();
  e.setSnake([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], { x: 1, y: 0 });
  e.setPickup(6, 5);
  const ev = e.tick(200);
  assert.ok(ev.some((x) => x.type === "eat"));
  assert.equal(e.state.snake.length, 4);
  assert.equal(e.state.length, 4);
  assert.equal(e.state.pickups, 1);
  assert.equal(e.state.score, 10 + Math.floor(4 / 5) * 5);
  const p = e.state.pickup;
  assert.ok(p.x >= 0 && p.x < 20 && p.y >= 0 && p.y < 20);
  assert.ok(!e.state.snake.some((s) => s.x === p.x && s.y === p.y));
});
test("score formula at length 10", () => {
  const e = playing();
  const body = []; for (let i = 0; i < 9; i++) body.push({ x: 9 - i, y: 5 });
  e.setSnake(body, { x: 1, y: 0 }); e.setPickup(10, 5);
  e.tick(200);
  assert.equal(e.state.score, 10 + Math.floor(10 / 5) * 5);
});
test("turns apply on the next step; reversing is ignored; two queued turns apply in order", () => {
  const e = playing();
  e.setSnake([{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], { x: 1, y: 0 });
  assert.deepEqual(e.dispatch("left"), []);            // reverse → ignored
  assert.deepEqual(e.dispatch("up"), [{ type: "turn" }]);
  assert.deepEqual(e.dispatch("left"), [{ type: "turn" }]); // queued (relative to up, left is valid)
  e.tick(200); assert.deepEqual(e.state.snake[0], { x: 5, y: 4 });
  e.tick(200); assert.deepEqual(e.state.snake[0], { x: 4, y: 4 });
});
test("hitting a wall ends the game", () => {
  const e = playing();
  e.setSnake([{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }], { x: 1, y: 0 });
  const ev = e.tick(200);
  assert.ok(ev.some((x) => x.type === "gameover"));
  assert.equal(e.state.status, "over");
  assert.deepEqual(e.dispatch("up"), []);
});
test("hitting yourself ends the game", () => {
  const e = playing();
  e.setSnake([{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }], { x: 0, y: -1 });
  // head at (5,5) moving up into (5,4), which is the tail... make it the body instead:
  e.setSnake([{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }], { x: 0, y: -1 });
  const ev = e.tick(200);
  assert.ok(ev.some((x) => x.type === "gameover"));
});
test("moving into the cell the tail is vacating is allowed", () => {
  const e = playing();
  e.setSnake([{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }], { x: 0, y: -1 });
  e.dispatch("left"); // head will go to (4,5)? no — (4,5) is body. Use tail cell: set dir so next is (4,5)... tail is (4,5) → allowed
  const ev = e.tick(200);
  assert.ok(!ev.some((x) => x.type === "gameover"));
  assert.deepEqual(e.state.snake[0], { x: 4, y: 5 });
});
test("tick does nothing unless playing; actions are logged with tick index", () => {
  const e = E.createEngine({ seed: 1 });
  e.tick(1000); assert.deepEqual(e.state.snake[0], { x: 10, y: 10 });
  e.dispatch("start"); e.dispatch("up");
  assert.deepEqual(e.state.inputLog, [[0, "start"], [0, "up"]]);
});
test("determinism: same seed + log reproduces", () => {
  function run(seed) {
    const e = E.createEngine({ seed }); e.dispatch("start");
    const dirs = ["up", "left", "down", "right"];
    for (let t = 0; t < 900; t++) { if (t % 23 === 0) e.dispatch(dirs[(t / 23) % 4]); e.tick(DT); if (e.state.status === "over") break; }
    return e;
  }
  const a = run(11), b = run(11);
  assert.deepEqual(a.state.snake, b.state.snake); assert.equal(a.state.score, b.state.score); assert.equal(a.hash(), b.hash());
  const r = E.createEngine({ seed: 11 }); const byTick = new Map();
  a.state.inputLog.forEach(([t, act]) => { (byTick.get(t) || byTick.set(t, []).get(t)).push(act); });
  for (let t = 0; t <= a.state.tick; t++) { (byTick.get(t) || []).forEach((act) => r.dispatch(act)); if (t < a.state.tick) r.tick(DT); }
  assert.deepEqual(r.state.snake, a.state.snake); assert.equal(r.hash(), a.hash());
});
