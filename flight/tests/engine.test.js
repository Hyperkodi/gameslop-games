const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
const DT = 1000 / 60;
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); return e; }

test("ready: bird hovers at y=50 with no gravity", () => {
  const e = E.createEngine({ seed: 1 }); e.tick(1000);
  assert.equal(e.state.bird.y, 50); assert.equal(e.state.bird.vy, 0); assert.equal(e.state.columns.length, 0);
});
test("gravity 160 u/s², terminal 90", () => {
  const e = playing(); e.tick(100);
  assert.ok(Math.abs(e.state.bird.vy - 16) < 1e-6); assert.ok(e.state.bird.y > 50);
  e.setBird({ y: 50, vy: 85 }); e.tick(100); assert.equal(e.state.bird.vy, 90);
});
test("flap sets vy to -52 and emits flap; ceiling clamps", () => {
  const e = playing(); e.setBird({ y: 50, vy: 40 });
  assert.deepEqual(e.dispatch("flap"), [{ type: "flap" }]); assert.equal(e.state.bird.vy, -52);
  e.setBird({ y: 3.5, vy: -52 }); e.tick(50); assert.equal(e.state.bird.y, 3);
});
test("columns spawn at 1.0 s then every 1.9 s, scroll at 38 u/s, gap centre within [28,72]", () => {
  const e = playing(); e.setBird({ y: 50, vy: 0 });
  e.tick(999); assert.equal(e.state.columns.length, 0);
  e.tick(1); assert.equal(e.state.columns.length, 1); assert.ok(Math.abs(e.state.columns[0].x - 72.5) < 1e-6);
  e.setBird({ y: e.state.columns[0].gapY, vy: 0 }); // keep the bird alive inside the gap line
  e.tick(1000); assert.ok(Math.abs(e.state.columns[0].x - (72.5 - 38)) < 1e-6);
  e.tick(900); assert.equal(e.state.columns.length, 2);
  e.state.columns.forEach((c) => assert.ok(c.gapY >= 28 && c.gapY <= 72));
});
test("passing a column scores once; speed ramps 4% per 10 points, capped at 1.4x", () => {
  const e = playing(); e.setBird({ y: 50, vy: 0 });
  e.setColumns([{ x: 5, gapY: 50, w: 10, passed: false }]);
  let ev = []; for (let i = 0; i < 20; i++) { e.setBird({ y: 50, vy: 0 }); ev = ev.concat(e.tick(DT)); }
  assert.equal(e.state.score, 1); assert.equal(ev.filter((x) => x.type === "score").length, 1);
  e.state.score = 30; e.tick(DT); assert.ok(Math.abs(e.state.speed - 38 * 1.12) < 1e-6);
  e.state.score = 200; e.tick(DT); assert.ok(Math.abs(e.state.speed - 38 * 1.4) < 1e-6);
});
test("hitting a column or the floor ends the game", () => {
  const e = playing(); e.setColumns([{ x: 15, gapY: 80, w: 10, passed: false }]); e.setBird({ y: 20, vy: 0 });
  let ev = []; for (let i = 0; i < 5; i++) ev = ev.concat(e.tick(DT));
  assert.ok(ev.some((x) => x.type === "gameover")); assert.equal(e.state.status, "over");
  const f = playing(); f.setBird({ y: 95, vy: 60 }); ev = []; for (let i = 0; i < 5; i++) ev = ev.concat(f.tick(DT));
  assert.ok(ev.some((x) => x.type === "gameover"));
});
test("determinism: same seed + log reproduces", () => {
  function run(seed) { const e = E.createEngine({ seed }); e.dispatch("start"); for (let t = 0; t < 900; t++) { if (t % 25 === 0) e.dispatch("flap"); e.tick(DT); if (e.state.status === "over") break; } return e; }
  const a = run(21), b = run(21);
  assert.deepEqual(a.state.columns, b.state.columns); assert.deepEqual(a.state.bird, b.state.bird); assert.equal(a.hash(), b.hash());
  const r = E.createEngine({ seed: 21 }); const byTick = new Map(); a.state.inputLog.forEach(([t, act]) => { (byTick.get(t) || byTick.set(t, []).get(t)).push(act); });
  for (let t = 0; t <= a.state.tick; t++) { (byTick.get(t) || []).forEach((act) => r.dispatch(act)); if (t < a.state.tick) r.tick(DT); }
  assert.deepEqual(r.state.bird, a.state.bird); assert.equal(r.state.score, a.state.score);
});
