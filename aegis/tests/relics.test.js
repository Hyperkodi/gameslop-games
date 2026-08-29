"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi-v2.js");
const Relics = require("../js/sim/relics.js");
const Compiler = require("../../../tools/lib/aegis/v4-unlock-compiler.js");

function checkedInRecordSet() {
  const output = {};
  ["protocols", "relics", "specializations", "reinforcements", "mechanisms", "progression"]
    .forEach(function (domain) {
      output[domain] = JSON.parse(fs.readFileSync(
        path.join(__dirname, "..", "content-v4", domain, "binding-v1.json"),
        "utf8"
      ));
    });
  return output;
}

function compiledRelics() {
  return Compiler.compileUnlockSimulationContent(checkedInRecordSet()).relics;
}

function modifier(resolution, statId) {
  return resolution.modifiers.find(function (record) { return record.statId === statId; });
}

test("Relic resolver publishes one frozen ABI-v2 browser contract", () => {
  assert.equal(Object.isFrozen(Relics), true);
  assert.equal(Relics.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assert.equal(Relics.RELIC_SCHEMA_VERSION, 1);
  assert.equal(Object.isFrozen(Relics.STAT_POLICIES), true);

  const context = { Game: { AegisSimV2: ABI } };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "js", "sim", "relics.js"), "utf8"),
    context,
    { filename: "relics.js" }
  );
  assert.equal(context.Game.AegisRelics.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assert.equal(Object.isFrozen(context.Game.AegisRelics), true);
});

test("checked-in eight-Relic compiler partition normalizes without presentation data", () => {
  const source = compiledRelics();
  const catalog = Relics.normalizeRelicCatalog(source);
  assert.equal(catalog.length, 8);
  assert.deepEqual(catalog.map(function (record) { return record.id; }), [
    "broken-aegis", "bronze-obol", "forge-ember", "hermes-greaves",
    "laurel-of-ares", "owl-lens", "tideglass", "titan-gear",
  ]);
  assert.equal(Object.isFrozen(catalog), true);
  assert.equal(Object.isFrozen(catalog[0]), true);
  assert.equal(JSON.stringify(catalog).includes("nameKey"), false);
});

test("all binding singleton Relics expose their exact visible tradeoff modifiers", () => {
  const catalog = Relics.normalizeRelicCatalog(compiledRelics());
  const expected = {
    "broken-aegis": [["starting-aether", -20], ["starting-integrity", 5]],
    "bronze-obol": [["bounty", 8500], ["starting-aether", 25]],
    "forge-ember": [["build-cost", 10800], ["specialization-cost", 8800], ["upgrade-cost", 8800]],
    "hermes-greaves": [["tower-range", -800], ["tower-rate", 800]],
    "laurel-of-ares": [["tower-control-duration", 8500], ["tower-control-magnitude", 8500],
      ["tower-direct-damage", 11200], ["tower-dot-damage", 11200]],
    "owl-lens": [["tower-range", 1000], ["tower-rate", -800]],
    "tideglass": [["tower-control-magnitude", 12000], ["tower-direct-damage", 9200],
      ["tower-displacement", 12000], ["tower-dot-damage", 9200]],
    "titan-gear": [["build-cost", 10800], ["protocol-cost", 8500],
      ["specialization-cost", 10800], ["upgrade-cost", 10800]],
  };
  Object.keys(expected).forEach(function (id) {
    const result = Relics.resolveRelicLoadout(catalog, [id], 1);
    assert.deepEqual(result.modifiers.map(function (record) {
      return [record.statId, record.amount];
    }), expected[id], id);
  });
});

test("two Relics sum named basis-point deltas once in ASCII order", () => {
  const catalog = Relics.normalizeRelicCatalog(compiledRelics());
  const costs = Relics.resolveRelicLoadout(catalog, ["forge-ember", "titan-gear"], 2);
  assert.equal(modifier(costs, "build-cost").amount, 11600);
  assert.equal(modifier(costs, "upgrade-cost").amount, 9600);
  assert.equal(modifier(costs, "specialization-cost").amount, 9600);
  assert.equal(modifier(costs, "protocol-cost").amount, 8500);

  const combat = Relics.resolveRelicLoadout(catalog, ["laurel-of-ares", "tideglass"], 2);
  assert.equal(modifier(combat, "tower-direct-damage").amount, 10400);
  assert.equal(modifier(combat, "tower-dot-damage").amount, 10400);
  assert.equal(modifier(combat, "tower-control-magnitude").amount, 10500);
  assert.equal(modifier(combat, "tower-displacement").amount, 12000);

  const targeting = Relics.resolveRelicLoadout(catalog, ["hermes-greaves", "owl-lens"], 2);
  assert.equal(modifier(targeting, "tower-rate").amount, 0);
  assert.equal(modifier(targeting, "tower-range").amount, 200);

  const starts = Relics.resolveRelicLoadout(catalog, ["broken-aegis", "bronze-obol"], 2);
  assert.equal(modifier(starts, "starting-aether").amount, 5);
  assert.equal(modifier(starts, "starting-integrity").amount, 5);
  assert.equal(modifier(starts, "bounty").amount, 8500);
});

test("combined modifiers clamp by named category before one rounding operation", () => {
  const catalog = Relics.normalizeRelicCatalog([
    {
      id: "alpha", unlockGrantId: "grant.relic.alpha",
      benefitModifiers: [{ statId: "tower-rate", operation: "add-bp", amount: 4000, rounding: "floor" }],
      drawbackModifiers: [{ statId: "tower-range", operation: "add-bp", amount: -2500, rounding: "floor" }],
    },
    {
      id: "beta", unlockGrantId: "grant.relic.beta",
      benefitModifiers: [{ statId: "tower-rate", operation: "add-bp", amount: 4000, rounding: "floor" }],
      drawbackModifiers: [{ statId: "tower-range", operation: "add-bp", amount: -2500, rounding: "floor" }],
    },
  ]);
  assert.equal(catalog[1].benefitModifiers[0].rounding, "floor");
  assert.throws(function () {
    Relics.normalizeRelicCatalog([{
      id: "legacy", unlockGrantId: "grant.relic.legacy",
      benefitModifiers: [{ statId: "tower-rate", operation: "add-bp", amount: 800, rounding: "none" }],
      drawbackModifiers: [{ statId: "tower-range", operation: "add-bp", amount: -800, rounding: "floor" }],
    }]);
  }, /operation\/rounding/i, "the retired legacy \"none\" label is no longer accepted for tower-rate");
  const result = Relics.resolveRelicLoadout(catalog, ["alpha", "beta"], 2);
  assert.equal(modifier(result, "tower-rate").amount, 4000);
  assert.equal(modifier(result, "tower-range").amount, -2500);
  assert.equal(modifier(result, "tower-rate").rounding, "floor");

  assert.throws(function () {
    Relics.normalizeRelicCatalog([{
      id: "gamma", unlockGrantId: "grant.relic.gamma",
      benefitModifiers: [{ statId: "tower-range", operation: "add-bp", amount: 1000, rounding: "none" }],
      drawbackModifiers: [{ statId: "tower-rate", operation: "add-bp", amount: -800, rounding: "floor" }],
    }]);
  }, /operation\/rounding/i);
  assert.throws(function () {
    Relics.normalizeRelicCatalog([{
      id: "delta", unlockGrantId: "grant.relic.delta",
      benefitModifiers: [{ statId: "tower-range", operation: "add-bp", amount: 1000, rounding: "floor" }],
      drawbackModifiers: [{ statId: "tower-rate", operation: "add-bp", amount: -800, rounding: "ceil" }],
    }]);
  }, /operation\/rounding/i);
});

test("add-bp modifiers scale the base by basis points under the policy rounding", () => {
  const catalog = Relics.normalizeRelicCatalog(compiledRelics());
  const owl = Relics.resolveRelicLoadout(catalog, ["owl-lens"], 1);
  assert.equal(Relics.applyIntegerModifier(500, modifier(owl, "tower-range")), 550);
  assert.equal(Relics.applyIntegerModifier(500, modifier(owl, "tower-rate")), 460);
  const hermes = Relics.resolveRelicLoadout(catalog, ["hermes-greaves"], 1);
  assert.equal(Relics.applyIntegerModifier(500, modifier(hermes, "tower-rate")), 540);
  assert.equal(Relics.applyIntegerModifier(500, modifier(hermes, "tower-range")), 460);
  assert.equal(Relics.applyIntegerModifier(7, modifier(owl, "tower-range")), 7);
  assert.equal(Relics.applyIntegerModifier(0, modifier(owl, "tower-rate")), 0);

  assert.equal(Relics.STAT_POLICIES["tower-range"].rounding, "floor");
  assert.equal(Relics.STAT_POLICIES["tower-rate"].rounding, "floor");
  assert.equal(modifier(owl, "tower-rate").rounding, "floor");
  assert.equal(modifier(hermes, "tower-rate").rounding, "floor");

  assert.throws(function () {
    Relics.applyIntegerModifier(-500, modifier(owl, "tower-range"));
  }, /nonnegative base/i);
  assert.throws(function () {
    Relics.applyIntegerModifier(-500, modifier(hermes, "tower-rate"));
  }, /nonnegative base/i);
});

test("applyIntegerModifier rejects hand-built modifiers outside the stat clamp bounds", () => {
  assert.throws(function () {
    Relics.applyIntegerModifier(100, {
      statId: "build-cost", operation: "multiply-bp", amount: 20000, rounding: "ceil",
    });
  }, function (error) {
    return error instanceof RangeError && /clamp/i.test(error.message);
  });
  assert.throws(function () {
    Relics.applyIntegerModifier(100, {
      statId: "build-cost", operation: "multiply-bp", amount: 0, rounding: "ceil",
    });
  }, function (error) {
    return error instanceof RangeError && /clamp/i.test(error.message);
  });
  assert.throws(function () {
    Relics.applyIntegerModifier(100, {
      statId: "tower-range", operation: "add-bp", amount: 3000, rounding: "floor",
    });
  }, function (error) {
    return error instanceof RangeError && /clamp/i.test(error.message);
  });
  assert.equal(Relics.applyIntegerModifier(100, {
    statId: "build-cost", operation: "multiply-bp", amount: 14000, rounding: "ceil",
  }), 140);
  assert.equal(Relics.applyIntegerModifier(100, {
    statId: "build-cost", operation: "multiply-bp", amount: 7000, rounding: "ceil",
  }), 70);
});

test("Titan Gear escalated Protocol cast cost rounds once over both factors", () => {
  assert.equal(Relics.resolveProtocolCastCostWithRelics(90, 1, 8500), 96);
  assert.equal(Relics.resolveProtocolCastCostWithRelics(125, 1, 8500), 133);
  assert.deepEqual([0, 1, 2, 3, 4].map(function (prior) {
    return Relics.resolveProtocolCastCostWithRelics(75, prior, 10000);
  }), [75, 94, 113, 132, 150]);
  assert.equal(Relics.resolveProtocolCastCostWithRelics(0, 3, 14000), 0);

  assert.throws(function () {
    Relics.resolveProtocolCastCostWithRelics(Number.MAX_SAFE_INTEGER, 1, 8500);
  }, RangeError);
  assert.throws(function () {
    Relics.resolveProtocolCastCostWithRelics(90, Number.MAX_SAFE_INTEGER, 10000);
  }, RangeError);
  assert.throws(function () {
    Relics.resolveProtocolCastCostWithRelics(90, -1, 10000);
  }, RangeError);
  assert.throws(function () {
    Relics.resolveProtocolCastCostWithRelics(-90, 0, 10000);
  }, RangeError);
  assert.throws(function () {
    Relics.resolveProtocolCastCostWithRelics(90, 0, 6999);
  }, RangeError);
  assert.throws(function () {
    Relics.resolveProtocolCastCostWithRelics(90, 0, 14001);
  }, RangeError);
  assert.throws(function () {
    Relics.resolveProtocolCastCostWithRelics(90.5, 0, 10000);
  }, TypeError);
  assert.throws(function () {
    Relics.resolveProtocolCastCostWithRelics(90, 0, "8500");
  }, TypeError);
});

test("additive starting Aether below zero clamps to zero", () => {
  const catalog = Relics.normalizeRelicCatalog(compiledRelics());
  const broken = Relics.resolveRelicLoadout(catalog, ["broken-aegis"], 1);
  assert.equal(Relics.applyIntegerModifier(10, modifier(broken, "starting-aether")), 0);
  assert.equal(Relics.applyIntegerModifier(30, modifier(broken, "starting-aether")), 10);
  assert.equal(Relics.applyIntegerModifier(20, modifier(broken, "starting-aether")), 0);
});

test("overlong property names are rejected without echoing the key", () => {
  const key = "k".repeat(5000);
  const hostile = JSON.parse(JSON.stringify(compiledRelics()));
  hostile[0][key] = 1;
  let caught = null;
  try {
    Relics.normalizeRelicCatalog(hostile);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof RangeError);
  assert.equal(caught.message.includes(key), false);
  assert.equal(caught.message.includes("kkkkkkkk"), false);
  assert.ok(caught.message.length < 200);
});

test("bounty multipliers carry authored clamp bounds like the other multiply stats", () => {
  assert.equal(Relics.STAT_POLICIES.bounty.minimum, 5000);
  assert.equal(Relics.STAT_POLICIES.bounty.maximum, 15000);

  function bountyCatalog(amount) {
    return Relics.normalizeRelicCatalog([{
      id: "obol", unlockGrantId: "grant.relic.obol",
      benefitModifiers: [{ statId: "starting-aether", operation: "add", amount: 25, rounding: "none" }],
      drawbackModifiers: [{ statId: "bounty", operation: "multiply-bp", amount: amount, rounding: "mission-remainder" }],
    }]);
  }
  assert.equal(modifier(Relics.resolveRelicLoadout(bountyCatalog(8500), ["obol"], 1), "bounty").amount, 8500);
  assert.equal(modifier(Relics.resolveRelicLoadout(bountyCatalog(0), ["obol"], 1), "bounty").amount, 5000);
  assert.equal(modifier(Relics.resolveRelicLoadout(bountyCatalog(20000), ["obol"], 1), "bounty").amount, 15000);
  assert.throws(function () { bountyCatalog(20001); }, /authored bound/i);
  assert.throws(function () { bountyCatalog(-1); }, /authored bound/i);
});

test("resolved integer application and bounty remainder use exact checked rounding", () => {
  const catalog = Relics.normalizeRelicCatalog(compiledRelics());
  const titan = Relics.resolveRelicLoadout(catalog, ["titan-gear"], 1);
  assert.equal(Relics.applyIntegerModifier(95, modifier(titan, "protocol-cost")), 81);
  const combat = Relics.resolveRelicLoadout(catalog, ["laurel-of-ares", "tideglass"], 2);
  assert.equal(Relics.applyIntegerModifier(11, modifier(combat, "tower-direct-damage")), 11);
  const starts = Relics.resolveRelicLoadout(catalog, ["broken-aegis", "bronze-obol"], 2);
  assert.equal(Relics.applyIntegerModifier(100, modifier(starts, "starting-aether")), 105);
  assert.deepEqual(Relics.applyBountyWithRemainder(3, 8500, 0), {
    aetherAward: 2,
    bountyRemainder: 5500,
  });
  assert.deepEqual(Relics.applyBountyWithRemainder(3, 8500, 5500), {
    aetherAward: 3,
    bountyRemainder: 1000,
  });
});

test("loadouts and catalogs reject order, duplicates, slots, unknowns, and hostile graphs", () => {
  const catalog = Relics.normalizeRelicCatalog(compiledRelics());
  assert.throws(function () {
    Relics.resolveRelicLoadout(catalog, ["owl-lens", "bronze-obol"], 2);
  }, /ASCII order/i);
  assert.throws(function () {
    Relics.resolveRelicLoadout(catalog, ["owl-lens", "owl-lens"], 2);
  }, /unique|ASCII order/i);
  assert.throws(function () {
    Relics.resolveRelicLoadout(catalog, ["owl-lens"], 0);
  }, /slot cap/i);
  assert.throws(function () {
    Relics.resolveRelicLoadout(catalog, ["constructor"], 1);
  }, /unknown Relic/i);

  let getterRuns = 0;
  const hostile = JSON.parse(JSON.stringify(compiledRelics()));
  Object.defineProperty(hostile[0], "id", {
    enumerable: true,
    get: function () { getterRuns += 1; return "broken-aegis"; },
  });
  assert.throws(function () { Relics.normalizeRelicCatalog(hostile); }, /data propert|accessor/i);
  assert.equal(getterRuns, 0);

  const shared = JSON.parse(JSON.stringify(compiledRelics()));
  shared[0].drawbackModifiers = shared[0].benefitModifiers;
  assert.throws(function () { Relics.normalizeRelicCatalog(shared); }, /shared reference|cycle/i);
});
