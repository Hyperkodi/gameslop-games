"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const Geometry = require("../js/sim/geometry.js");
const TARGETING_PATH = path.join(__dirname, "..", "js", "sim", "targeting.js");
const Targeting = require(TARGETING_PATH);

function query(overrides) {
  return Object.assign({
    originX: 0,
    originY: 0,
    range: 10000,
    targetLayerIds: ["ground"],
  }, overrides);
}

function candidate(overrides) {
  return Object.assign({
    baseSpeedDistanceUnitsPerSecond: 60000,
    currentHpMilli: 5000,
    id: 1,
    layerId: "ground",
    remainingDistance: 10000,
    revealEligible: true,
    shieldPoolsMilli: [],
    threatPriority: 0,
    x: 0,
    y: 0,
  }, overrides);
}

function idOf(policy, candidates, targetingQuery) {
  const selected = Targeting.selectTarget(policy, targetingQuery || query(), candidates);
  return selected === null ? null : selected.id;
}

test("eligibility filters caller-resolved reveal, target layer, and inclusive squared range", () => {
  const candidates = [
    candidate({ id: 1, x: 3000, y: 4000 }),
    candidate({ id: 2, revealEligible: false, x: 0, y: 0 }),
    candidate({ id: 3, layerId: "air", x: 0, y: 0 }),
    candidate({ id: 4, x: 3001, y: 4000 }),
  ];
  const groundOnly = query({ range: 5000 });
  assert.deepEqual(Targeting.filterEligibleTargets(groundOnly, candidates).map((enemy) => enemy.id), [1]);
  assert.deepEqual(Targeting.filterEligibleTargets(
    query({ range: 5000, targetLayerIds: ["ground", "air"] }),
    candidates
  ).map((enemy) => enemy.id), [1, 3]);
  assert.equal(Geometry.isWithinSquaredRange(0, 0, 3000, 4000, 5000), true);
  assert.equal(Geometry.isWithinSquaredRange(0, 0, 3001, 4000, 5000), false);
});

test("FRONT selects least remaining distance, then higher threat, then lower runtime ID", () => {
  const candidates = [
    candidate({ id: 20, remainingDistance: 2000, threatPriority: 99 }),
    candidate({ id: 30, remainingDistance: 1000, threatPriority: 1 }),
    candidate({ id: 40, remainingDistance: 1000, threatPriority: 9 }),
    candidate({ id: 2, remainingDistance: 1000, threatPriority: 9 }),
  ];
  assert.equal(idOf("FRONT", candidates), 2);
  assert.equal(Targeting.compareTargets("FRONT", candidates[1], candidates[0]), -1);
  assert.equal(Targeting.compareTargets("FRONT", candidates[2], candidates[1]), -1);
  assert.equal(Targeting.compareTargets("FRONT", candidates[3], candidates[2]), -1);
});

test("STRONG sums current HP and every active shield pool before remaining distance and ID", () => {
  const candidates = [
    candidate({ currentHpMilli: 5000, id: 10, remainingDistance: 5000, shieldPoolsMilli: [2000, 3000] }),
    candidate({ currentHpMilli: 9000, id: 1, remainingDistance: 100, shieldPoolsMilli: [] }),
    candidate({ currentHpMilli: 8000, id: 50, remainingDistance: 4000, shieldPoolsMilli: [2000] }),
    candidate({ currentHpMilli: 7000, id: 3, remainingDistance: 4000, shieldPoolsMilli: [1000, 2000] }),
  ];
  assert.equal(Targeting.targetStrengthMilli(candidates[0]), 10000);
  assert.equal(Targeting.targetStrengthMilli(candidates[1]), 9000);
  assert.equal(idOf("STRONG", candidates), 3);
  assert.equal(Targeting.compareTargets("STRONG", candidates[0], candidates[1]), -1);
  assert.equal(Targeting.compareTargets("STRONG", candidates[2], candidates[0]), -1);
  assert.equal(Targeting.compareTargets("STRONG", candidates[3], candidates[2]), -1);
});

test("FAST uses unmodified base speed, then remaining distance and lower ID", () => {
  const candidates = [
    candidate({ baseSpeedDistanceUnitsPerSecond: 1000, id: 1, remainingDistance: 100 }),
    candidate({ baseSpeedDistanceUnitsPerSecond: 2000, id: 10, remainingDistance: 500 }),
    candidate({ baseSpeedDistanceUnitsPerSecond: 2000, id: 20, remainingDistance: 400 }),
    candidate({ baseSpeedDistanceUnitsPerSecond: 2000, id: 2, remainingDistance: 400 }),
  ];
  assert.equal(idOf("FAST", candidates), 2);
  assert.equal(Targeting.compareTargets("FAST", candidates[1], candidates[0]), -1);
  assert.equal(Targeting.compareTargets("FAST", candidates[2], candidates[1]), -1);
  assert.equal(Targeting.compareTargets("FAST", candidates[3], candidates[2]), -1);
  assert.throws(() => Targeting.createTargetCandidate(candidate({ effectiveSpeedBp: 5000 })), /exactly/i);
});

test("every policy removes ineligible enemies before it compares priority fields", () => {
  const eligible = candidate({
    baseSpeedDistanceUnitsPerSecond: 1, currentHpMilli: 1, id: 50,
    remainingDistance: 5000, threatPriority: 0,
  });
  const hidden = candidate({
    baseSpeedDistanceUnitsPerSecond: 999999, currentHpMilli: 999999, id: 1,
    remainingDistance: 0, revealEligible: false, shieldPoolsMilli: [999999], threatPriority: 999,
  });
  const wrongLayer = candidate({
    baseSpeedDistanceUnitsPerSecond: 888888, currentHpMilli: 888888, id: 2,
    layerId: "air", remainingDistance: 0, shieldPoolsMilli: [888888], threatPriority: 888,
  });
  const outside = candidate({
    baseSpeedDistanceUnitsPerSecond: 777777, currentHpMilli: 777777, id: 3,
    remainingDistance: 0, shieldPoolsMilli: [777777], threatPriority: 777,
    x: 10001,
  });
  for (const policy of Targeting.TARGET_POLICIES) {
    assert.equal(idOf(policy, [hidden, wrongLayer, outside, eligible]), 50);
  }
  assert.equal(idOf("FRONT", [hidden], query()), null);
});

test("target adapters reject malformed keys, masks, identities, shield sums, and squared overflow", () => {
  assert.throws(() => Targeting.selectTarget("UNKNOWN", query(), []), /policy/i);
  assert.throws(() => Targeting.createTargetQuery(query({ targetLayerIds: [] })), /at least one/i);
  assert.throws(() => Targeting.createTargetQuery(query({ targetLayerIds: ["ground", "ground"] })), /duplicate/i);
  assert.throws(() => Targeting.createTargetQuery(query({ targetLayerIds: ["bad layer"] })), /ASCII/i);
  assert.throws(() => Targeting.createTargetQuery(query({ range: -1 })), /nonnegative/i);
  assert.throws(() => Targeting.createTargetCandidate(candidate({ extra: 1 })), /exactly/i);
  assert.throws(() => Targeting.createTargetCandidate(candidate({ revealEligible: 1 })), /boolean/i);
  assert.throws(() => Targeting.createTargetCandidate(candidate({ id: 0 })), /positive/i);
  assert.throws(() => Targeting.createTargetCandidate(candidate({ currentHpMilli: -1 })), /nonnegative/i);
  assert.throws(() => Targeting.createTargetCandidate(candidate({ shieldPoolsMilli: [0] })), /positive/i);
  assert.throws(() => Targeting.filterEligibleTargets(query(), [candidate({ id: 1 }), candidate({ id: 1 })]), /duplicate/i);
  assert.throws(() => Targeting.targetStrengthMilli(candidate({
    currentHpMilli: Number.MAX_SAFE_INTEGER, shieldPoolsMilli: [1],
  })), /safe integer range/i);
  assert.throws(() => Targeting.filterEligibleTargets(
    query({ range: Number.MAX_SAFE_INTEGER }), [candidate()]
  ), /safe integer range/i);
  const shared = candidate({ id: 4 });
  assert.throws(() => Targeting.filterEligibleTargets(query(), [shared, shared]), /shared reference/i);
});

test("target queries, candidates, filters, and selections are deeply frozen canonical copies", () => {
  const queryInput = query({ targetLayerIds: ["ground", "air"] });
  const candidateInput = candidate({ id: 9, shieldPoolsMilli: [100, 200] });
  const frozenQuery = Targeting.createTargetQuery(queryInput);
  const frozenCandidate = Targeting.createTargetCandidate(candidateInput);
  const eligible = Targeting.filterEligibleTargets(frozenQuery, [candidateInput]);
  const selected = Targeting.selectTarget("FRONT", frozenQuery, [candidateInput]);

  for (const output of [frozenQuery, frozenCandidate, eligible, selected]) {
    assert.equal(Object.isFrozen(output), true);
    assert.doesNotThrow(() => ABI.canonicalEncode(output));
  }
  assert.equal(Object.isFrozen(frozenQuery.targetLayerIds), true);
  assert.equal(Object.isFrozen(frozenCandidate.shieldPoolsMilli), true);
  assert.equal(Object.isFrozen(eligible[0]), true);
  assert.equal(Object.isFrozen(selected.shieldPoolsMilli), true);
  assert.equal(Object.isFrozen(queryInput), false);
  assert.equal(Object.isFrozen(queryInput.targetLayerIds), false);
  assert.equal(Object.isFrozen(candidateInput), false);
  assert.equal(Object.isFrozen(candidateInput.shieldPoolsMilli), false);
  assert.deepEqual(candidateInput.shieldPoolsMilli, [100, 200]);
  assert.notEqual(selected, candidateInput);
});

test("classic script consumes frozen ABI and Geometry without DOM, network, kit, or other modules", () => {
  const abiSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8");
  const geometrySource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "geometry.js"), "utf8");
  const targetingSource = fs.readFileSync(TARGETING_PATH, "utf8");
  const context = vm.createContext({});
  vm.runInContext(abiSource, context, { filename: "abi.js" });
  vm.runInContext(geometrySource, context, { filename: "geometry.js" });
  const injectedAbi = context.Game.AegisSim;
  const injectedGeometry = context.Game.AegisGeometry;
  vm.runInContext(targetingSource, context, { filename: "targeting.js" });

  assert.equal(context.Game.AegisSim, injectedAbi);
  assert.equal(context.Game.AegisGeometry, injectedGeometry);
  assert.equal(Object.isFrozen(context.Game.AegisTargeting), true);
  assert.equal(context.Game.AegisEffects, undefined);
  assert.equal(context.Game.AegisMovement, undefined);
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.require, undefined);
  assert.throws(
    () => vm.runInContext(targetingSource, vm.createContext({ Game: { AegisSim: injectedAbi } })),
    /AegisGeometry/i
  );
});
