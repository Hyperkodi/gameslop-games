"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const ECONOMY_PATH = path.join(__dirname, "..", "js", "sim", "economy.js");
const Economy = require(ECONOMY_PATH);

function assertCanonicalFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  assert.doesNotThrow(() => ABI.canonicalEncode(value));
}

test("cumulative investment and exact refunds match binding Siege and Athena goldens", () => {
  const vectors = [
    { id: "siege", costs: [90, 85, 140], investments: [90, 175, 315], refunds: [63, 122, 220] },
    { id: "athena", costs: [90, 95, 155], investments: [90, 185, 340], refunds: [63, 129, 238] },
  ];

  for (const vector of vectors) {
    for (let level = 1; level <= 3; level++) {
      const costs = vector.costs.slice(0, level);
      const before = costs.slice();
      const summary = Economy.summarizeInvestment(costs);
      assert.deepEqual(costs, before, vector.id + " costs must not be mutated");
      assert.deepEqual(summary, {
        investedAether: vector.investments[level - 1],
        sellRefundAether: vector.refunds[level - 1],
      });
      assert.equal(Economy.cumulativeInvestment(costs), vector.investments[level - 1]);
      assert.equal(Economy.sellRefund(vector.investments[level - 1]), vector.refunds[level - 1]);
      assertCanonicalFrozen(summary);
    }
  }

  assert.equal(Math.floor(90 * 0.70), 62, "the forbidden floating-point formula demonstrates the regression");
  assert.equal(Economy.sellRefund(90), 63);
  assert.equal(Economy.cumulativeInvestment([]), 0);
  assert.equal(Economy.sellRefund(0), 0);
  assert.equal(
    Economy.sellRefund(Number.MAX_SAFE_INTEGER),
    Number(BigInt(Number.MAX_SAFE_INTEGER) * 70n / 100n)
  );
});

test("Mission 1 base and Assist starts resolve after one difficulty floor", () => {
  const difficulties = [
    { id: "story", aetherBp: 11900, base: 178, assisted: 198 },
    { id: "strategos", aetherBp: 10000, base: 150, assisted: 170 },
    { id: "titan", aetherBp: 9100, base: 136, assisted: 156 },
  ];

  for (const difficulty of difficulties) {
    const unassisted = Economy.resolveStartAether(150, difficulty.aetherBp, 0, 0);
    assert.equal(unassisted.difficultyStartAether, difficulty.base, difficulty.id);
    assert.equal(unassisted.afterCampaignModifierAether, difficulty.base, difficulty.id);
    assert.equal(unassisted.startAether, difficulty.base, difficulty.id);
    assertCanonicalFrozen(unassisted);

    const assisted = Economy.resolveStartAether(150, difficulty.aetherBp, 0, 20);
    assert.equal(assisted.difficultyStartAether, difficulty.base, difficulty.id);
    assert.equal(assisted.afterCampaignModifierAether, difficulty.base, difficulty.id);
    assert.equal(assisted.startAether, difficulty.assisted, difficulty.id);
    assertCanonicalFrozen(assisted);
  }
});

test("Reserve Capacitors apply after difficulty and Assist applies last", () => {
  const reserveOne = Economy.resolveStartAether(150, 11900, 10, 20);
  assert.deepEqual(reserveOne, {
    baseStartAether: 150,
    difficultyAetherBp: 11900,
    difficultyStartAether: 178,
    campaignModifierAether: 10,
    afterCampaignModifierAether: 188,
    assistAether: 20,
    startAether: 208,
  });

  const reserveTwo = Economy.resolveStartAether(150, 11900, 20, 20);
  assert.deepEqual(reserveTwo, {
    baseStartAether: 150,
    difficultyAetherBp: 11900,
    difficultyStartAether: 178,
    campaignModifierAether: 20,
    afterCampaignModifierAether: 198,
    assistAether: 20,
    startAether: 218,
  });

  assert.equal(Economy.resolveStartAether(150, 10000, 20, 20).startAether, 190);
  assert.equal(Economy.resolveStartAether(150, 9100, 20, 20).startAether, 176);
});

test("synthetic non-content sub-ten Story bounties accumulate through one mission-scoped remainder", () => {
  // Mechanics-only arithmetic vector: these ten base-1 events are not authored Mission 1 content.
  let remainder = Economy.initialBountyRemainder();
  let totalAward = 0;
  const awards = [];
  for (let event = 0; event < 10; event++) {
    const resolved = Economy.resolveBountyEvent(remainder, 1, 11000);
    assertCanonicalFrozen(resolved);
    awards.push(resolved.bountyAward);
    totalAward += resolved.bountyAward;
    remainder = resolved.bountyRemainder;
  }

  assert.deepEqual(awards, [1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
  assert.equal(totalAward, 11);
  assert.equal(remainder, 0);
  assert.equal(Economy.initialBountyRemainder(), 0, "a new mission resets the carry");
});

test("fixed deployment and clear grants bypass bounty scaling and preserve its remainder", () => {
  // The 7/3 grant amounts are mechanics-only sentinels, not authored Mission 1 content.
  const firstBounty = Economy.resolveBountyEvent(0, 1, 11000);
  assert.deepEqual(firstBounty, {
    bountyNumerator: 11000,
    bountyAward: 1,
    bountyRemainder: 1000,
  });

  const deployment = Economy.creditFixedGrant(firstBounty.bountyRemainder, 7);
  assert.deepEqual(deployment, { aetherAward: 7, bountyRemainder: 1000 });
  const clear = Economy.creditFixedGrant(deployment.bountyRemainder, 3);
  assert.deepEqual(clear, { aetherAward: 3, bountyRemainder: 1000 });
  const secondBounty = Economy.resolveBountyEvent(clear.bountyRemainder, 1, 11000);
  assert.deepEqual(secondBounty, {
    bountyNumerator: 12000,
    bountyAward: 1,
    bountyRemainder: 2000,
  });
  assertCanonicalFrozen(deployment);
  assertCanonicalFrozen(clear);
});

test("economy helpers reject invalid and overflowing integer inputs", () => {
  assert.throws(() => Economy.addInvestment(-1, 1), /nonnegative/i);
  assert.throws(() => Economy.addInvestment(1, 0.5), /safe integer/i);
  assert.throws(() => Economy.addInvestment(Number.MAX_SAFE_INTEGER, 1), /safe integer range/i);
  assert.throws(() => Economy.cumulativeInvestment([Number.MAX_SAFE_INTEGER, 1]), /safe integer range/i);
  assert.throws(() => Economy.cumulativeInvestment([1, -1]), /nonnegative/i);
  assert.throws(() => Economy.cumulativeInvestment("90"), /array/i);
  const extraCostState = [90];
  extraCostState.unhashed = 1;
  assert.throws(() => Economy.cumulativeInvestment(extraCostState), /extra properties/i);
  assert.throws(() => Economy.sellRefund(-1), /nonnegative/i);
  assert.throws(() => Economy.sellRefund(90.5), /safe integer/i);

  assert.throws(() => Economy.resolveStartAether(-1, 10000, 0, 0), /nonnegative/i);
  assert.throws(() => Economy.resolveStartAether(150, 10000.5, 0, 0), /safe integer/i);
  assert.throws(() => Economy.resolveStartAether(150, 10000, -1, 0), /nonnegative/i);
  assert.throws(
    () => Economy.resolveStartAether(Number.MAX_SAFE_INTEGER, 10000, 1, 0),
    /safe integer range/i
  );
  assert.throws(
    () => Economy.resolveStartAether(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0, 0),
    /safe integer range/i
  );

  assert.throws(() => Economy.resolveBountyEvent(-1, 1, 11000), /nonnegative/i);
  assert.throws(() => Economy.resolveBountyEvent(10000, 1, 11000), /less than 10000/i);
  assert.throws(() => Economy.resolveBountyEvent(0, -1, 11000), /nonnegative/i);
  assert.throws(() => Economy.resolveBountyEvent(0, 1, 11000.5), /safe integer/i);
  assert.throws(
    () => Economy.resolveBountyEvent(0, Number.MAX_SAFE_INTEGER, 2),
    /safe integer range/i
  );
  assert.throws(() => Economy.creditFixedGrant(10000, 1), /less than 10000/i);
  assert.throws(() => Economy.creditFixedGrant(0, -1), /nonnegative/i);
});

test("CommonJS and classic-script modes expose the same frozen pure economy API", () => {
  assert.equal(Object.isFrozen(Economy), true);
  assert.equal(Economy.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);

  const abiSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8");
  const economySource = fs.readFileSync(ECONOMY_PATH, "utf8");
  const context = vm.createContext({});
  vm.runInContext(abiSource, context, { filename: "abi.js" });
  const injectedAbi = context.Game.AegisSim;
  vm.runInContext(economySource, context, { filename: "economy.js" });

  assert.equal(context.Game.AegisSim, injectedAbi);
  assert.equal(Object.isFrozen(context.Game.AegisEconomy), true);
  assert.equal(context.Game.AegisEconomy.ABI_DESCRIPTOR_SHA256, context.Game.AegisSim.DESCRIPTOR_SHA256);
  assert.equal(context.Game.AegisEconomy.sellRefund(90), 63);
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.require, undefined);

  const missingAbi = vm.createContext({ Game: {} });
  assert.throws(() => vm.runInContext(economySource, missingAbi), /AegisSim/i);
});
