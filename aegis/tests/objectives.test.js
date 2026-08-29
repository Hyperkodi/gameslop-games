"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const OBJECTIVES_PATH = path.join(__dirname, "..", "js", "sim", "objectives.js");
const Objectives = require(OBJECTIVES_PATH);
const CONTENT_ROOT = path.join(__dirname, "..", "content", "missions");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function missionObjectives(missionId) {
  return JSON.parse(fs.readFileSync(
    path.join(CONTENT_ROOT, missionId + ".slice-v1.json"),
    "utf8"
  )).objectives;
}

function assertDeepFrozen(value, seen) {
  if (!value || typeof value !== "object") return;
  seen = seen || new Set();
  if (seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  Reflect.ownKeys(value).forEach(function (key) {
    assertDeepFrozen(value[key], seen);
  });
}

function factInput(binding, overrides) {
  const input = {
    integrity: 20,
    lineageTagLeakCounts: binding.lineageTagIds.map(function (lineageTag) {
      return { lineageTag: lineageTag, leakCount: 0 };
    }),
    outcome: "active",
    ownedTowerCount: 0,
    routeLeakCounts: binding.routeIds.map(function (routeId) {
      return { routeId: routeId, leakCount: 0 };
    }),
  };
  Object.assign(input, overrides || {});
  return input;
}

test("bindObjectives closes the three-record Candidate slice contract before Start", () => {
  const source = missionObjectives("m01");
  const before = clone(source);
  const binding = Objectives.bindObjectives(source, "strategos");

  assert.deepEqual(source, before, "binding must not mutate compiled mission content");
  assert.deepEqual(binding, {
    difficultyId: "strategos",
    lineageTagIds: [],
    records: [
      { id: "victory", kind: "victory", predicate: { kind: "mission-victory" } },
      {
        id: "integrity",
        kind: "integrity",
        predicate: { kind: "minimum-integrity", minimumIntegrity: 15 },
      },
      {
        id: "mastery",
        kind: "mastery",
        predicate: { kind: "maximum-owned-towers-at-victory", maximum: 5 },
      },
    ],
    routeIds: [],
    schemaVersion: 1,
  });
  assertDeepFrozen(binding);
  assert.doesNotThrow(() => ABI.canonicalEncode(binding));

  source[1].thresholdRecords[1].minimumIntegrity = 0;
  source[2].predicate.maximum = 99;
  assert.equal(binding.records[1].predicate.minimumIntegrity, 15);
  assert.equal(binding.records[2].predicate.maximum, 5);
});

test("integrity binding selects exactly the requested Story, Strategos, or Titan threshold", () => {
  const records = missionObjectives("m05");
  const thresholds = { story: 20, strategos: 14, titan: 9 };
  Object.keys(thresholds).forEach(function (difficultyId) {
    const binding = Objectives.bindObjectives(records, difficultyId);
    assert.equal(binding.records[1].predicate.minimumIntegrity, thresholds[difficultyId]);
    assert.equal(binding.difficultyId, difficultyId);
  });
});

test("evaluation reports provisional progress but completes objectives only on victory", () => {
  const binding = Objectives.bindObjectives(missionObjectives("m01"), "strategos");
  const activeInput = factInput(binding, { integrity: 15, ownedTowerCount: 4 });
  const activeBefore = clone(activeInput);
  const active = Objectives.evaluateObjectives(binding, activeInput);

  assert.deepEqual(activeInput, activeBefore, "evaluation must not mutate canonical kernel facts");
  assert.deepEqual(active, {
    completedCount: 0,
    objectiveResults: [
      {
        complete: false,
        current: 0,
        eligible: false,
        id: "victory",
        kind: "victory",
        predicateKind: "mission-victory",
        relation: "at-least",
        target: 1,
      },
      {
        complete: false,
        current: 15,
        eligible: true,
        id: "integrity",
        kind: "integrity",
        predicateKind: "minimum-integrity",
        relation: "at-least",
        target: 15,
      },
      {
        complete: false,
        current: 4,
        eligible: true,
        id: "mastery",
        kind: "mastery",
        predicateKind: "maximum-owned-towers-at-victory",
        relation: "at-most",
        target: 5,
      },
    ],
  });

  const victory = Objectives.evaluateObjectives(binding, factInput(binding, {
    integrity: 15,
    outcome: "victory",
    ownedTowerCount: 5,
  }));
  assert.equal(victory.completedCount, 3);
  assert.deepEqual(victory.objectiveResults.map(function (result) {
    return [result.id, result.eligible, result.complete];
  }), [
    ["victory", true, true],
    ["integrity", true, true],
    ["mastery", true, true],
  ]);

  const overbuilt = Objectives.evaluateObjectives(binding, factInput(binding, {
    integrity: 20,
    outcome: "victory",
    ownedTowerCount: 6,
  }));
  assert.equal(overbuilt.completedCount, 2);
  assert.deepEqual(overbuilt.objectiveResults[2], {
    complete: false,
    current: 6,
    eligible: false,
    id: "mastery",
    kind: "mastery",
    predicateKind: "maximum-owned-towers-at-victory",
    relation: "at-most",
    target: 5,
  });

  const defeat = Objectives.evaluateObjectives(binding, factInput(binding, {
    integrity: 20,
    outcome: "defeat",
    ownedTowerCount: 4,
  }));
  assert.equal(defeat.completedCount, 0);
  assert.equal(defeat.objectiveResults[1].eligible, true);
  assert.equal(defeat.objectiveResults[1].complete, false);
  assert.equal(defeat.objectiveResults[2].eligible, true);
  assert.equal(defeat.objectiveResults[2].complete, false);
  assertDeepFrozen(active);
  assertDeepFrozen(victory);
});

test("m04 mastery sums only its exact sorted route leak counters", () => {
  const binding = Objectives.bindObjectives(missionObjectives("m04"), "strategos");
  assert.deepEqual(binding.routeIds, ["route.north", "route.south"]);
  assert.deepEqual(binding.lineageTagIds, []);
  assert.doesNotThrow(() => ABI.canonicalEncode(binding));

  const clean = Objectives.evaluateObjectives(binding, factInput(binding, {
    integrity: 16,
    outcome: "victory",
    ownedTowerCount: 7,
  }));
  assert.deepEqual(clean.objectiveResults[2], {
    complete: true,
    current: 0,
    eligible: true,
    id: "mastery",
    kind: "mastery",
    predicateKind: "no-leaks-from-routes",
    relation: "at-most",
    target: 0,
  });

  const leaked = Objectives.evaluateObjectives(binding, factInput(binding, {
    integrity: 16,
    outcome: "victory",
    routeLeakCounts: [
      { routeId: "route.north", leakCount: 1 },
      { routeId: "route.south", leakCount: 2 },
    ],
  }));
  assert.equal(leaked.objectiveResults[2].current, 3);
  assert.equal(leaked.objectiveResults[2].eligible, false);
  assert.equal(leaked.objectiveResults[2].complete, false);
});

test("m05 mastery consumes the canonical boss-lineage leak counter", () => {
  const binding = Objectives.bindObjectives(missionObjectives("m05"), "titan");
  assert.deepEqual(binding.routeIds, []);
  assert.deepEqual(binding.lineageTagIds, ["boss"]);

  const facts = Objectives.createObjectiveFacts(binding, factInput(binding, {
    integrity: 9,
    lineageTagLeakCounts: [{ lineageTag: "boss", leakCount: 1 }],
    outcome: "victory",
    ownedTowerCount: 5,
  }));
  assertDeepFrozen(facts);
  assert.deepEqual(facts.lineageTagLeakCounts, [{ lineageTag: "boss", leakCount: 1 }]);

  const result = Objectives.evaluateObjectives(binding, facts);
  assert.equal(result.completedCount, 2);
  assert.deepEqual(result.objectiveResults[2], {
    complete: false,
    current: 1,
    eligible: false,
    id: "mastery",
    kind: "mastery",
    predicateKind: "no-leaks-from-lineage-tag",
    relation: "at-most",
    target: 0,
  });
});

test("objective content validation fails closed on shape, order, IDs, duplicates, and numbers", () => {
  const base = missionObjectives("m01");
  assert.throws(() => Objectives.bindObjectives({}, "story"), /array/i);
  assert.throws(() => Objectives.bindObjectives(base, "future"), /difficulty/i);

  const wrongOrder = clone(base);
  [wrongOrder[0], wrongOrder[1]] = [wrongOrder[1], wrongOrder[0]];
  assert.throws(() => Objectives.bindObjectives(wrongOrder, "story"), /order|victory/i);

  const extraField = clone(base);
  extraField[0].rendererOnly = true;
  assert.throws(() => Objectives.bindObjectives(extraField, "story"), /exactly/i);

  const unknownPredicate = clone(base);
  unknownPredicate[2].predicate = { kind: "future-mastery" };
  assert.throws(() => Objectives.bindObjectives(unknownPredicate, "story"), /predicate/i);

  const duplicateDifficulty = clone(base);
  duplicateDifficulty[1].thresholdRecords[1].difficultyId = "story";
  assert.throws(() => Objectives.bindObjectives(duplicateDifficulty, "story"), /order|difficulty/i);

  const unsafeThreshold = clone(base);
  unsafeThreshold[1].thresholdRecords[0].minimumIntegrity = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(() => Objectives.bindObjectives(unsafeThreshold, "story"), /safe integer/i);

  const unsafeMaximum = clone(base);
  unsafeMaximum[2].predicate.maximum = -1;
  assert.throws(() => Objectives.bindObjectives(unsafeMaximum, "story"), /nonnegative/i);

  const routeBase = missionObjectives("m04");
  const duplicateRoute = clone(routeBase);
  duplicateRoute[2].predicate.routeIds[1] = duplicateRoute[2].predicate.routeIds[0];
  assert.throws(() => Objectives.bindObjectives(duplicateRoute, "story"), /unique|order|duplicate/i);

  const reversedRoute = clone(routeBase);
  reversedRoute[2].predicate.routeIds.reverse();
  assert.throws(() => Objectives.bindObjectives(reversedRoute, "story"), /ASCII|order/i);

  const invalidKey = clone(base);
  invalidKey[0].titleKey = "Victory Label";
  assert.throws(() => Objectives.bindObjectives(invalidKey, "story"), /ID|key/i);

  const sharedRecord = base[0];
  assert.throws(
    () => Objectives.bindObjectives([sharedRecord, sharedRecord, base[2]], "story"),
    /shared|order/i
  );
});

test("canonical objective facts require exact binding-owned counters and safe integers", () => {
  const binding = Objectives.bindObjectives(missionObjectives("m04"), "story");
  const valid = factInput(binding);
  const before = clone(valid);
  const facts = Objectives.createObjectiveFacts(binding, valid);
  assert.deepEqual(valid, before);
  assertDeepFrozen(facts);
  assert.doesNotThrow(() => ABI.canonicalEncode(facts));

  const extraFact = factInput(binding);
  extraFact.presentationState = "sparkle";
  assert.throws(() => Objectives.createObjectiveFacts(binding, extraFact), /exactly/i);

  assert.throws(
    () => Objectives.createObjectiveFacts(binding, factInput(binding, { outcome: "paused" })),
    /outcome/i
  );
  assert.throws(
    () => Objectives.createObjectiveFacts(binding, factInput(binding, { integrity: -1 })),
    /nonnegative/i
  );
  assert.throws(
    () => Objectives.createObjectiveFacts(binding, factInput(binding, {
      ownedTowerCount: Number.MAX_SAFE_INTEGER + 1,
    })),
    /safe integer/i
  );
  assert.throws(
    () => Objectives.createObjectiveFacts(binding, factInput(binding, {
      routeLeakCounts: [{ routeId: "route.north", leakCount: 0 }],
    })),
    /exactly|counter/i
  );
  assert.throws(
    () => Objectives.createObjectiveFacts(binding, factInput(binding, {
      routeLeakCounts: [
        { routeId: "route.south", leakCount: 0 },
        { routeId: "route.north", leakCount: 0 },
      ],
    })),
    /order|counter/i
  );
  assert.throws(
    () => Objectives.createObjectiveFacts(binding, factInput(binding, {
      routeLeakCounts: [
        { routeId: "route.north", leakCount: 0 },
        { routeId: "route.north", leakCount: 0 },
      ],
    })),
    /counter|route/i
  );
  assert.throws(
    () => Objectives.createObjectiveFacts(binding, factInput(binding, {
      routeLeakCounts: [
        { routeId: "route.north", leakCount: -1 },
        { routeId: "route.south", leakCount: 0 },
      ],
    })),
    /nonnegative/i
  );

  const shared = { routeId: "route.north", leakCount: 0 };
  const sharedCounters = factInput(binding, { routeLeakCounts: [shared, shared] });
  assert.throws(() => Objectives.createObjectiveFacts(binding, sharedCounters), /shared/i);

  assert.throws(
    () => Objectives.createObjectiveFacts({ schemaVersion: 1 }, valid),
    /binding/i
  );
});

test("leak aggregation rejects checked-integer overflow", () => {
  const binding = Objectives.bindObjectives(missionObjectives("m04"), "story");
  const input = factInput(binding, {
    outcome: "victory",
    routeLeakCounts: [
      { routeId: "route.north", leakCount: Number.MAX_SAFE_INTEGER },
      { routeId: "route.south", leakCount: 1 },
    ],
  });
  assert.throws(() => Objectives.evaluateObjectives(binding, input), /safe integer range/i);
});

test("CommonJS and classic scripts expose the same frozen ABI-bound objective API", () => {
  assert.equal(Object.isFrozen(Objectives), true);
  assert.equal(Objectives.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assert.equal(Objectives.OBJECTIVE_SCHEMA_VERSION, 1);
  assert.deepEqual(Objectives.OUTCOMES, ["active", "defeat", "victory"]);

  const abiSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8");
  const objectiveSource = fs.readFileSync(OBJECTIVES_PATH, "utf8");
  const context = vm.createContext({});
  vm.runInContext(abiSource, context, { filename: "abi.js" });
  vm.runInContext(objectiveSource, context, { filename: "objectives.js" });

  const classic = context.Game.AegisObjectives;
  assert.equal(Object.isFrozen(classic), true);
  assert.equal(classic.ABI_DESCRIPTOR_SHA256, context.Game.AegisSim.DESCRIPTOR_SHA256);
  assert.equal(classic.OBJECTIVE_SCHEMA_VERSION, 1);

  const records = missionObjectives("m05");
  const nodeBinding = Objectives.bindObjectives(records, "strategos");
  const classicRecords = vm.runInContext(
    "JSON.parse(" + JSON.stringify(JSON.stringify(records)) + ")",
    context
  );
  const classicBinding = classic.bindObjectives(classicRecords, "strategos");
  const nodeInput = factInput(nodeBinding, {
    integrity: 14,
    outcome: "victory",
    lineageTagLeakCounts: [{ lineageTag: "boss", leakCount: 0 }],
    ownedTowerCount: 5,
  });
  const classicInput = vm.runInContext(
    "JSON.parse(" + JSON.stringify(JSON.stringify(nodeInput)) + ")",
    context
  );
  const nodeResult = Objectives.evaluateObjectives(nodeBinding, nodeInput);
  const classicResult = classic.evaluateObjectives(classicBinding, classicInput);
  assert.equal(
    ABI.canonicalEncode(nodeResult),
    context.Game.AegisSim.canonicalEncode(classicResult)
  );
  assert.equal(Object.isFrozen(classicBinding), true);
  assert.equal(Object.isFrozen(classicResult), true);
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.require, undefined);

  const missingAbi = vm.createContext({ Game: {} });
  assert.throws(() => vm.runInContext(objectiveSource, missingAbi), /AegisSim/i);
});
