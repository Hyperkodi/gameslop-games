const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");
const DT = 1000 / 60;
function playing(seed = 1) { const e = E.createEngine({ seed }); e.dispatch("start"); e.clearEnemies(); return e; }

test("ship moves 70 u/s while held and clamps", () => {
  const e = playing(); e.dispatch("leftOn"); e.tick(100); assert.ok(Math.abs(e.state.ship.x - 43) < 1e-6);
  e.dispatch("leftOff"); e.tick(100); assert.ok(Math.abs(e.state.ship.x - 43) < 1e-6);
  e.dispatch("leftOn"); e.tick(5000); assert.ok(Math.abs(e.state.ship.x - 4) < 1e-6);
});
test("fire: one bullet per 220 ms while held, at most 6 alive", () => {
  const e = playing(); e.dispatch("fireOn");
  let ev = e.tick(DT); assert.equal(e.state.bullets.length, 1); assert.ok(ev.some((x) => x.type === "fire"));
  e.tick(200); assert.equal(e.state.bullets.length, 1);
  e.tick(30); assert.equal(e.state.bullets.length, 2);
  for (let i = 0; i < 100; i++) e.tick(DT); assert.ok(e.state.bullets.length <= 6);
  e.dispatch("fireOff"); const n = e.state.bullets.length; e.tick(300); assert.ok(e.state.bullets.length <= n);
});
test("bullets travel up at 130 u/s and are removed above the world", () => {
  const e = playing(); e.dispatch("fireOn"); e.tick(DT); e.dispatch("fireOff");
  const y0 = e.state.bullets[0].y; e.tick(100); assert.ok(Math.abs((y0 - e.state.bullets[0].y) - 13) < 1e-6);
  e.tick(2000); assert.equal(e.state.bullets.length, 0);
});
test("asteroid dies in one hit for 10; drone needs two hits for 30", () => {
  const e = playing(); e.setShip(50);
  e.spawnEnemy({ id: 1, kind: "asteroid", x: 50, y: 100, r: 5, hp: 1, vx: 0, vy: 0, phase: 0 });
  e.dispatch("fireOn"); e.tick(DT); e.dispatch("fireOff");
  let ev = []; for (let i = 0; i < 20; i++) ev = ev.concat(e.tick(DT));
  assert.equal(e.state.enemies.length, 0); assert.equal(e.state.score, 10); assert.ok(ev.some((x) => x.type === "explode" && x.kind === "asteroid"));
  e.spawnEnemy({ id: 2, kind: "drone", x: 50, y: 100, r: 4, hp: 2, vx: 0, vy: 0, phase: 0 });
  e.dispatch("fireOn"); e.tick(DT); e.dispatch("fireOff"); ev = []; for (let i = 0; i < 20; i++) ev = ev.concat(e.tick(DT));
  assert.equal(e.state.enemies.length, 1); assert.equal(e.state.enemies[0].hp, 1); assert.ok(ev.some((x) => x.type === "hit")); assert.equal(e.state.score, 10);
  e.dispatch("fireOn"); e.tick(DT); e.dispatch("fireOff"); for (let i = 0; i < 20; i++) e.tick(DT);
  assert.equal(e.state.enemies.length, 0); assert.equal(e.state.score, 40);
});
test("an enemy touching the ship costs a life, grants 1.5 s invulnerability; 0 lives ends the game", () => {
  const e = playing(); e.setShip(50);
  e.spawnEnemy({ id: 1, kind: "asteroid", x: 50, y: 126, r: 5, hp: 1, vx: 0, vy: 10, phase: 0 });
  let ev = e.tick(DT); assert.equal(e.state.lives, 2); assert.ok(ev.some((x) => x.type === "damage")); assert.ok(e.state.invulnMs > 0);
  e.spawnEnemy({ id: 2, kind: "asteroid", x: 50, y: 126, r: 5, hp: 1, vx: 0, vy: 0, phase: 0 }); e.tick(DT); assert.equal(e.state.lives, 2);
  e.tick(1600); e.clearEnemies();
  e.spawnEnemy({ id: 3, kind: "asteroid", x: 50, y: 126, r: 5, hp: 1, vx: 0, vy: 0, phase: 0 }); e.tick(DT); assert.equal(e.state.lives, 1);
  e.tick(1600); e.clearEnemies();
  e.spawnEnemy({ id: 4, kind: "asteroid", x: 50, y: 126, r: 5, hp: 1, vx: 0, vy: 0, phase: 0 }); ev = e.tick(DT);
  assert.equal(e.state.lives, 0); assert.ok(ev.some((x) => x.type === "gameover")); assert.equal(e.state.status, "over");
});
test("enemies leaving the bottom vanish without penalty", () => {
  const e = playing(); e.setShip(10);
  e.spawnEnemy({ id: 1, kind: "asteroid", x: 90, y: 139, r: 5, hp: 1, vx: 0, vy: 40, phase: 0 });
  for (let i = 0; i < 20; i++) e.tick(DT);
  assert.equal(e.state.enemies.length, 0); assert.equal(e.state.lives, 3); assert.equal(e.state.score, 0);
});
test("spawning: seeded enemies appear within bounds; a wave every 8 s tightens the interval", () => {
  const e = playing(); e.setShip(50);
  for (let i = 0; i < 120; i++) e.tick(DT); // 2 s
  assert.ok(e.state.enemies.length >= 1);
  e.state.enemies.forEach((en) => { assert.ok(en.x >= en.r - 1e-9 && en.x <= 100 - en.r + 1e-9); assert.ok(["asteroid", "drone"].includes(en.kind)); });
  let ev = []; for (let i = 0; i < 400; i++) { e.state.invulnMs = 5000; ev = ev.concat(e.tick(DT)); }
  assert.ok(ev.some((x) => x.type === "wave")); assert.ok(e.state.wave >= 2); assert.ok(e.state.spawnInterval < 1100);
});
test("determinism: same seed + log reproduces", () => {
  function run(seed) { const e = E.createEngine({ seed }); e.dispatch("start"); e.dispatch("fireOn"); for (let t = 0; t < 900; t++) { if (t % 40 === 0) e.dispatch(t % 80 === 0 ? "leftOn" : "leftOff"); e.tick(DT); if (e.state.status === "over") break; } return e; }
  const a = run(8), b = run(8);
  assert.deepEqual(a.state.enemies, b.state.enemies); assert.equal(a.state.score, b.state.score); assert.equal(a.hash(), b.hash());
});
