const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/engine.js");

const DT = 1000 / 60;

function playing(seed = 1) {
  const engine = E.createEngine({ seed });
  engine.dispatch("start");
  return engine;
}

function withoutLog(state) {
  const copy = JSON.parse(JSON.stringify(state));
  delete copy.inputLog;
  return copy;
}

test("landscape geometry matches the approved 160 by 100 battlefield", () => {
  assert.equal(E.WORLD_W, 160);
  assert.equal(E.WORLD_H, 100);
  assert.deepEqual(E.PATH, [
    { x: -8, y: 18 }, { x: 42, y: 18 }, { x: 42, y: 48 }, { x: 88, y: 48 },
    { x: 88, y: 76 }, { x: 132, y: 76 }, { x: 132, y: 44 }, { x: 168, y: 44 },
  ]);
  assert.deepEqual(E.PADS, [
    { x: 18, y: 34 }, { x: 61, y: 17 }, { x: 61, y: 64 }, { x: 76, y: 31 },
    { x: 104, y: 32 }, { x: 105, y: 61 }, { x: 106, y: 90 }, { x: 148, y: 88 },
    { x: 148, y: 61 }, { x: 148, y: 27 },
  ]);
  assert.equal(E.PATH_LENGTH, 266);
});

test("initial state matches the Aegis reset contract", () => {
  const e = E.createEngine({ seed: 123 });
  assert.equal(e.state.status, "ready");
  assert.equal(e.state.phase, "planning");
  assert.equal(e.state.score, 0);
  assert.equal(e.state.gold, 160);
  assert.equal(e.state.integrity, 20);
  assert.equal(e.state.wave, 0);
  assert.equal(e.state.outcome, null);
  assert.equal(e.state.selectedPad, 0);
  assert.equal(e.state.selectedType, "sentinel");
  assert.deepEqual(e.state.towers, []);
  assert.deepEqual(e.state.enemies, []);
  assert.deepEqual(e.state.spawnQueue, []);
  assert.equal(e.state.seed, 123);
  assert.deepEqual(e.state.inputLog, []);
});

test("start, pause, and resume gate simulation ticks", () => {
  const e = E.createEngine({ seed: 2 });
  assert.deepEqual(e.tick(500), []);
  assert.equal(e.state.tick, 0);
  e.dispatch("start");
  assert.equal(e.state.status, "playing");
  e.tick(500);
  assert.equal(e.state.tick, 1);
  e.dispatch("pause");
  const frozen = withoutLog(e.state);
  assert.deepEqual(e.tick(5000), []);
  assert.deepEqual(withoutLog(e.state), frozen);
  e.dispatch("resume");
  e.tick(DT);
  assert.equal(e.state.status, "playing");
  assert.equal(e.state.tick, 2);
});

test("pad selection accepts semantic indices and cycles with wrap", () => {
  const e = playing();
  assert.deepEqual(e.dispatch("selectPad:7"), [{ type: "select", pad: 7 }]);
  assert.equal(e.state.selectedPad, 7);
  e.dispatch("nextPad");
  assert.equal(e.state.selectedPad, 8);
  e.dispatch("selectPad:9");
  e.dispatch("nextPad");
  assert.equal(e.state.selectedPad, 0);
  e.dispatch("prevPad");
  assert.equal(e.state.selectedPad, 9);
  const before = e.state.selectedPad;
  assert.deepEqual(e.dispatch("selectPad:10"), [{ type: "denied", reason: "invalid-pad", command: "selectPad:10" }]);
  assert.equal(e.state.selectedPad, before);
});

test("all three tower types build on empty pads for their exact costs", () => {
  const e = playing();
  e.setGold(200);
  const expected = [
    ["sentinel", 0, 40, 160],
    ["chronos", 1, 55, 105],
    ["siege", 2, 75, 30],
  ];
  for (const [type, pad, cost, gold] of expected) {
    e.dispatch("selectPad:" + pad);
    const events = e.dispatch("build:" + type);
    assert.equal(events[0].type, "build");
    assert.equal(events[0].towerType, type);
    assert.equal(events[0].cost, cost);
    assert.equal(e.state.gold, gold);
    assert.equal(e.state.selectedType, type);
  }
  assert.deepEqual(e.state.towers.map((t) => [t.pad, t.type, t.level]), [[0, "sentinel", 1], [1, "chronos", 1], [2, "siege", 1]]);
});

test("occupied, unaffordable, and unknown builds are denied without gameplay mutation", () => {
  const e = playing();
  e.dispatch("build:sentinel");
  let before = withoutLog(e.state);
  assert.deepEqual(e.dispatch("build:chronos"), [{ type: "denied", reason: "occupied-pad", command: "build:chronos" }]);
  assert.deepEqual(withoutLog(e.state), before);
  e.setGold(10);
  e.dispatch("selectPad:1");
  before = withoutLog(e.state);
  assert.deepEqual(e.dispatch("build:siege"), [{ type: "denied", reason: "insufficient-gold", command: "build:siege" }]);
  assert.deepEqual(withoutLog(e.state), before);
  assert.deepEqual(e.dispatch("build:oracle"), [{ type: "denied", reason: "unknown-tower", command: "build:oracle" }]);
  assert.deepEqual(withoutLog(e.state), before);
});

test("upgrades apply exact level stats and costs, then cap at level three", () => {
  const e = playing();
  e.setGold(500);
  e.dispatch("build:chronos");
  let events = e.dispatch("upgrade");
  assert.equal(events[0].type, "upgrade");
  assert.equal(events[0].cost, 45);
  assert.equal(e.state.towers[0].level, 2);
  assert.deepEqual(e.towerStats(e.state.towers[0]), E.TOWER_STATS.chronos[1]);
  events = e.dispatch("upgrade");
  assert.equal(events[0].cost, 75);
  assert.equal(e.state.towers[0].level, 3);
  assert.deepEqual(e.towerStats(e.state.towers[0]), E.TOWER_STATS.chronos[2]);
  const before = withoutLog(e.state);
  assert.deepEqual(e.dispatch("upgrade"), [{ type: "denied", reason: "max-level", command: "upgrade" }]);
  assert.deepEqual(withoutLog(e.state), before);
  e.dispatch("selectPad:1");
  assert.equal(e.dispatch("upgrade")[0].reason, "empty-pad");
});

test("selling level one, two, and three towers refunds seventy percent of total investment", () => {
  const scenarios = [
    { type: "sentinel", upgrades: 0, invested: 40, refund: 28 },
    { type: "sentinel", upgrades: 1, invested: 75, refund: 52 },
    { type: "siege", upgrades: 2, invested: 225, refund: 157 },
  ];

  for (const scenario of scenarios) {
    const e = playing();
    e.setGold(1000);
    e.dispatch("build:" + scenario.type);
    for (let i = 0; i < scenario.upgrades; i++) e.dispatch("upgrade");
    const tower = e.state.towers[0];
    const goldBeforeSale = e.state.gold;
    assert.equal(tower.invested, scenario.invested);
    assert.deepEqual(e.dispatch("sell"), [{
      type: "sell",
      towerId: tower.id,
      pad: tower.pad,
      towerType: scenario.type,
      level: scenario.upgrades + 1,
      invested: scenario.invested,
      refund: scenario.refund,
    }]);
    assert.equal(e.state.gold, goldBeforeSale + scenario.refund);
    assert.deepEqual(e.state.towers, []);
  }
});

test("selling an empty pad is denied without gameplay mutation", () => {
  const e = playing();
  const before = withoutLog(e.state);
  assert.deepEqual(e.dispatch("sell"), [{ type: "denied", reason: "empty-pad", command: "sell" }]);
  assert.deepEqual(withoutLog(e.state), before);
});

test("a sold tower is removed and its refund can only be collected once", () => {
  const e = playing();
  e.dispatch("build:chronos");
  const goldBeforeSale = e.state.gold;
  assert.equal(e.dispatch("sell")[0].refund, 38);
  assert.equal(e.state.gold, goldBeforeSale + 38);
  assert.deepEqual(e.state.towers, []);
  const goldAfterSale = e.state.gold;
  assert.deepEqual(e.dispatch("sell"), [{ type: "denied", reason: "empty-pad", command: "sell" }]);
  assert.equal(e.state.gold, goldAfterSale);
  assert.deepEqual(e.state.towers, []);
});

test("authored wave rosters are exact and their seeded shuffle is reproducible", () => {
  function queue(seed) {
    const e = playing(seed);
    e.setWave(2);
    const events = e.dispatch("wave");
    assert.deepEqual(events, [{ type: "wave", wave: 3 }]);
    return e.state.spawnQueue.slice();
  }
  const a = queue(44), b = queue(44), c = queue(45);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 14);
  assert.equal(a.filter((x) => x === "raider").length, 8);
  assert.equal(a.filter((x) => x === "scout").length, 6);

  const first = playing(44);
  first.dispatch("wave");
  assert.deepEqual(first.state.spawnQueue, Array(8).fill("raider"));
  assert.equal(first.state.spawnIntervalMs, 850);
});

test("spawn timing catches up after a large tick without duplicates", () => {
  const e = playing(7);
  e.dispatch("wave");
  const interval = e.state.spawnIntervalMs;
  let events = e.tick(interval * 3 + 1);
  const spawned = events.filter((ev) => ev.type === "spawn");
  assert.equal(spawned.length, 4);
  assert.equal(e.state.enemies.length, 4);
  assert.equal(e.state.spawnQueue.length, 4);
  assert.equal(new Set(e.state.enemies.map((x) => x.id)).size, 4);
  e.dispatch("pause");
  const queueLength = e.state.spawnQueue.length;
  assert.deepEqual(e.tick(interval * 10), []);
  assert.equal(e.state.spawnQueue.length, queueLength);
});

test("enemy movement follows waypoints without overshoot and slow changes exact distance", () => {
  const e = playing();
  const enemy = e.addEnemy("scout", { progress: 47 });
  assert.deepEqual([enemy.x, enemy.y], [39, 18]);
  e.tick(1000);
  assert.ok(Math.abs(enemy.progress - 56) < 1e-9);
  assert.deepEqual([enemy.x, enemy.y], [42, 24]);
  const before = enemy.progress;
  enemy.slowPct = 0.35;
  enemy.slowMs = 500;
  e.tick(1000);
  assert.ok(Math.abs(enemy.progress - (before + 9 * (0.5 * 0.65 + 0.5))) < 1e-9);
  assert.equal(enemy.slowPct, 0);
  assert.equal(enemy.slowMs, 0);
  assert.ok(enemy.progress > before);
});

test("targeting chooses greatest progress in range and lowest id on a tie", () => {
  const e = playing();
  e.setGold(500);
  e.dispatch("selectPad:1");
  e.dispatch("build:sentinel");
  const tower = e.state.towers[0];
  const a = e.addEnemy("raider", { progress: 48 });
  const b = e.addEnemy("raider", { progress: 50 });
  const c = e.addEnemy("raider", { progress: 50 });
  const far = e.addEnemy("raider", { progress: 180 });
  assert.equal(e.findTarget(tower).id, b.id);
  assert.ok(b.id < c.id);
  assert.notEqual(e.findTarget(tower).id, far.id);
  a.progress = 200; e.syncEnemy(a);
  b.progress = 200; e.syncEnemy(b);
  c.progress = 200; e.syncEnemy(c);
  assert.equal(e.findTarget(tower), null);
});

test("Sentinel applies armor-adjusted damage and observes its exact cooldown", () => {
  const e = playing();
  e.setGold(500);
  e.dispatch("selectPad:1");
  e.dispatch("build:sentinel");
  const guardian = e.addEnemy("guardian", { x: E.PADS[1].x, y: E.PADS[1].y + 1, hp: 100, progress: 1, detached: true });
  let events = e.tick(1);
  assert.equal(events.filter((x) => x.type === "attack").length, 1);
  assert.equal(guardian.hp, 95);
  e.tick(448);
  assert.equal(guardian.hp, 95);
  events = e.tick(1);
  assert.equal(events.filter((x) => x.type === "attack").length, 1);
  assert.equal(guardian.hp, 90);
});

test("Chronos keeps the strongest live slow and refreshes only equal or stronger effects", () => {
  const e = playing();
  e.setGold(500);
  e.dispatch("selectPad:1");
  e.dispatch("build:chronos");
  const enemy = e.addEnemy("raider", { detached: true, x: E.PADS[1].x, y: E.PADS[1].y + 1, hp: 200 });
  e.tick(1);
  assert.equal(enemy.hp, 197);
  assert.equal(enemy.slowPct, 0.35);
  assert.equal(enemy.slowMs, 1500);
  e.advanceEnemy(enemy, 200);
  assert.equal(enemy.slowMs, 1300);
  assert.equal(e.applySlow(enemy, 0.45, 1700), true);
  assert.equal(e.applySlow(enemy, 0.35, 1900), false);
  assert.equal(enemy.slowPct, 0.45);
  assert.equal(enemy.slowMs, 1700);
  assert.equal(e.applySlow(enemy, 0.45, 1700), true);
  assert.equal(enemy.slowMs, 1700);
  assert.equal(e.applySlow(enemy, 0.55, 1900), true);
  assert.equal(enemy.slowPct, 0.55);
  e.advanceEnemy(enemy, 1900);
  assert.equal(enemy.slowPct, 0);
  assert.equal(enemy.slowMs, 0);
});

test("Siege splash hits all and only enemies inside its target-centered radius", () => {
  const e = playing();
  e.setGold(500);
  e.dispatch("selectPad:1");
  e.dispatch("build:siege");
  const target = e.addEnemy("guardian", { detached: true, x: E.PADS[1].x, y: E.PADS[1].y + 1, hp: 100, progress: 10 });
  const inside = e.addEnemy("guardian", { detached: true, x: E.PADS[1].x + 4.9, y: E.PADS[1].y + 1, hp: 100, progress: 9 });
  const outside = e.addEnemy("guardian", { detached: true, x: E.PADS[1].x + 5.1, y: E.PADS[1].y + 1, hp: 100, progress: 8 });
  const events = e.tick(1);
  const attack = events.find((x) => x.type === "attack");
  assert.deepEqual(attack.hitIds, [target.id, inside.id]);
  assert.equal(target.hp, 85);
  assert.equal(inside.hp, 85);
  assert.equal(outside.hp, 100);
});

test("kills pay once while leaks pay nothing and zero integrity orders defeat events", () => {
  const e = playing();
  e.setGold(500);
  e.dispatch("selectPad:1");
  e.dispatch("build:sentinel");
  const goldAfterBuild = e.state.gold;
  e.addEnemy("scout", { detached: true, x: E.PADS[1].x, y: E.PADS[1].y + 1, hp: 1, progress: 2 });
  let events = e.tick(1);
  assert.equal(events.filter((x) => x.type === "kill").length, 1);
  assert.equal(e.state.gold, goldAfterBuild + 6);
  assert.equal(e.state.score, 60);
  e.tick(1000);
  assert.equal(e.state.gold, goldAfterBuild + 6);
  assert.equal(e.state.score, 60);

  e.setIntegrity(2);
  e.addEnemy("guardian", { progress: e.pathLength - 0.01 });
  events = e.tick(1000);
  assert.deepEqual(events.slice(-3).map((x) => x.type), ["leak", "breach", "gameover"]);
  assert.equal(e.state.integrity, 0);
  assert.equal(e.state.gold, goldAfterBuild + 6);
  assert.equal(e.state.outcome, "defeat");
  assert.equal(e.state.status, "over");
});

test("wave clear and wave twelve victory score exactly, and seed plus input log replays", () => {
  const victory = playing(9);
  victory.setWave(11);
  victory.setIntegrity(7);
  victory.dispatch("wave");
  victory.state.spawnQueue.length = 0;
  victory.state.enemies.length = 0;
  const beforeGold = victory.state.gold;
  const events = victory.tick(0);
  assert.deepEqual(events.map((x) => x.type), ["waveclear", "victory", "gameover"]);
  assert.equal(victory.state.gold, beforeGold + 80);
  assert.equal(victory.state.score, 1200 + 700);
  assert.equal(victory.state.outcome, "victory");
  assert.equal(victory.state.status, "over");

  function scripted(seed, replayLog) {
    const e = E.createEngine({ seed });
    const script = replayLog || [[0, "start"], [0, "build:sentinel"], [0, "nextPad"], [0, "build:chronos"], [0, "wave"], [90, "selectPad:2"], [90, "build:siege"], [180, "selectPad:0"], [180, "upgrade"], [220, "sell"]];
    let at = 0;
    for (let i = 0; i < 360; i++) {
      while (at < script.length && script[at][0] === e.state.tick) {
        e.dispatch(script[at][1]);
        at++;
      }
      e.tick(DT);
    }
    return e;
  }
  const first = scripted(777);
  const replay = scripted(777, first.state.inputLog.slice());
  assert.deepEqual(replay.state, first.state);
  assert.equal(replay.hash(), first.hash());
});
