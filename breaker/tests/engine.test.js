const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
const DT = 1000 / 60;
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); return e; }

test("initial layout: 60 bricks tiered by row, paddle centred, ball attached", () => {
  const e = E.createEngine({ seed: 1 });
  assert.equal(e.state.bricks.length, 60);
  const tiers = (row) => e.state.bricks.filter((b) => Math.abs(b.y - (12 + row * 4.8)) < 1e-9).map((b) => b.tier);
  assert.deepEqual(new Set(tiers(0)), new Set(["bronze"])); assert.deepEqual(new Set(tiers(3)), new Set(["gold"])); assert.deepEqual(new Set(tiers(5)), new Set(["marble"]));
  assert.equal(e.state.bricks.find((b) => b.tier === "bronze").hits, 2);
  assert.equal(e.state.lives, 3); assert.equal(e.state.level, 1);
  assert.ok(Math.abs(e.state.paddle.x - 50) < 1e-9); assert.equal(e.state.ball.attached, true);
});
test("paddle moves 90 u/s while held and clamps to the world", () => {
  const e = playing();
  e.dispatch("rightOn"); e.tick(100); assert.ok(Math.abs(e.state.paddle.x - 59) < 1e-6);
  e.dispatch("rightOff"); e.tick(100); assert.ok(Math.abs(e.state.paddle.x - 59) < 1e-6);
  e.dispatch("rightOn"); e.tick(5000); assert.ok(Math.abs(e.state.paddle.x - (100 - 9)) < 1e-6);
  assert.ok(Math.abs(e.state.ball.x - e.state.paddle.x) < 1e-6); // attached ball follows
});
test("launch gives the ball speed 55 upward from the paddle centre", () => {
  const e = playing();
  const ev = e.dispatch("launch");
  assert.ok(ev.some((x) => x.type === "launch"));
  assert.equal(e.state.ball.attached, false);
  assert.ok(Math.abs(Math.hypot(e.state.ball.vx, e.state.ball.vy) - 55) < 1e-6);
  assert.ok(e.state.ball.vy < 0); assert.ok(Math.abs(e.state.ball.vx) <= 55 * Math.sin(15 * Math.PI / 180) + 1e-9);
  assert.deepEqual(e.dispatch("launch"), []); // already launched
});
test("a marble brick breaks in one hit for 10 points", () => {
  const e = playing();
  const target = e.state.bricks.find((b) => b.tier === "marble" && Math.abs(b.x - 3) < 1e-9);
  e.setBall({ x: target.x + 4.7, y: target.y + 4.2 + 3, vx: 0, vy: -55, attached: false });
  let ev = []; for (let i = 0; i < 10; i++) ev = ev.concat(e.tick(DT));
  assert.ok(ev.some((x) => x.type === "brick"));
  assert.equal(e.state.bricks.length, 59); assert.equal(e.state.score, 10);
  assert.ok(e.state.ball.vy > 0);
});
test("a bronze brick needs two hits and pays 30", () => {
  const e = playing();
  const target = e.state.bricks.find((b) => b.tier === "bronze" && Math.abs(b.x - 3) < 1e-9);
  const keeper = e.state.bricks.find((b) => b.tier === "marble" && Math.abs(b.x - 93) < 1e-9);
  e.setBricks([target, keeper]);
  e.setBall({ x: target.x + 4.7, y: target.y + 4.2 + 3, vx: 0, vy: -55, attached: false });
  for (let i = 0; i < 10; i++) e.tick(DT);
  assert.equal(e.state.bricks.length, 2); assert.equal(e.state.bricks[0].hits, 1); assert.equal(e.state.score, 0);
  e.setBall({ x: target.x + 4.7, y: target.y + 4.2 + 3, vx: 0, vy: -55, attached: false });
  for (let i = 0; i < 10; i++) e.tick(DT);
  assert.equal(e.state.score, 30);
  assert.equal(e.state.bricks.length, 1);
});
test("ball below the paddle costs a life and re-attaches; 0 lives ends the game", () => {
  const e = playing();
  e.setBall({ x: 50, y: 149, vx: 0, vy: 55, attached: false });
  let ev = []; for (let i = 0; i < 10; i++) ev = ev.concat(e.tick(DT));
  assert.ok(ev.some((x) => x.type === "life")); assert.equal(e.state.lives, 2); assert.equal(e.state.ball.attached, true);
  e.dispatch("launch"); e.setBall({ x: 50, y: 149, vx: 0, vy: 55, attached: false }); for (let i = 0; i < 10; i++) e.tick(DT);
  e.dispatch("launch"); e.setBall({ x: 50, y: 149, vx: 0, vy: 55, attached: false }); ev = []; for (let i = 0; i < 10; i++) ev = ev.concat(e.tick(DT));
  assert.equal(e.state.lives, 0); assert.ok(ev.some((x) => x.type === "gameover")); assert.equal(e.state.status, "over");
});
test("clearing the last brick advances the level: +250, faster ball, bricks reset", () => {
  const e = playing();
  const target = e.state.bricks.find((b) => b.tier === "marble" && Math.abs(b.x - 3) < 1e-9);
  e.setBricks([target]);
  e.setBall({ x: target.x + 4.7, y: target.y + 4.2 + 3, vx: 0, vy: -55, attached: false });
  let ev = []; for (let i = 0; i < 10; i++) ev = ev.concat(e.tick(DT));
  assert.ok(ev.some((x) => x.type === "level"));
  assert.equal(e.state.level, 2); assert.equal(e.state.score, 10 + 250); assert.equal(e.state.bricks.length, 60);
  assert.equal(e.state.ball.attached, true);
  e.dispatch("launch"); assert.ok(Math.abs(Math.hypot(e.state.ball.vx, e.state.ball.vy) - 55 * 1.06) < 1e-6);
});
test("walls bounce; the ball never leaves the world sideways", () => {
  const e = playing();
  e.setBall({ x: 2, y: 80, vx: -55, vy: 0, attached: false });
  for (let i = 0; i < 30; i++) { e.tick(DT); assert.ok(e.state.ball.x >= 1.5 - 1e-6 && e.state.ball.x <= 98.5 + 1e-6); }
  assert.ok(e.state.ball.vx > 0);
});
test("determinism: same seed + log reproduces", () => {
  function run(seed) {
    const e = E.createEngine({ seed }); e.dispatch("start"); e.dispatch("launch");
    for (let t = 0; t < 1200; t++) { if (t % 60 === 0) e.dispatch(t % 120 === 0 ? "leftOn" : "leftOff"); if (t % 90 === 0) e.dispatch(t % 180 === 0 ? "rightOn" : "rightOff"); e.tick(DT); if (e.state.status === "over") break; }
    return e;
  }
  const a = run(5), b = run(5);
  assert.deepEqual(a.state.ball, b.state.ball); assert.equal(a.state.score, b.state.score); assert.equal(a.hash(), b.hash());
});
