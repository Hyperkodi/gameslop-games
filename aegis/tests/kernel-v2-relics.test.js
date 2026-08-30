"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const ABI = require("../js/sim/abi.js");
const Economy = require("../js/sim/economy.js");
const Kernel = require("../js/sim/kernel.js");
const Relics = require("../js/sim/relics.js");
const Fixture = require("./fixtures/kernel-v2/content.js");

const fixture = Fixture.buildKernelV2Fixture();

function binding() {
  return Kernel.createRulesetBinding({ release: fixture.release, content: fixture.content });
}

function relicHeader(relicIds, overrides) {
  return Fixture.headerV2(fixture, Object.assign({
    relicIds: relicIds,
    relicSlotCap: relicIds.length,
  }, overrides || {}));
}

function initialState(relicIds, overrides) {
  return Kernel.createInitialState(binding(), relicHeader(relicIds, overrides));
}

test("Bronze Obol adds its starting Aether after difficulty and before Reserve and Assist", () => {
  const plain = initialState([]);
  /* Story: floor(150 x 11900 / 10000) = 178. */
  assert.equal(plain.management.aether, 178);
  assert.equal(initialState(["bronze-obol"]).management.aether, 203);
  assert.equal(
    initialState(["bronze-obol"], {
      assist: true,
      campaignModifierIds: ["reserve-1"],
    }).management.aether,
    178 + 25 + 10 + 20
  );
  const staged = Economy.resolveStartAether(150, 11900, 10, 20, 25);
  assert.equal(staged.difficultyStartAether, 178);
  assert.equal(staged.afterRelicAether, 203);
  assert.equal(staged.afterCampaignModifierAether, 213);
  assert.equal(staged.startAether, 233);
});

test("Broken Aegis subtracts starting Aether and adds starting and maximum integrity", () => {
  const plain = initialState([]);
  const withRelic = initialState(["broken-aegis"]);
  assert.equal(plain.integrity, 25);
  assert.equal(withRelic.integrity, 30);
  assert.equal(withRelic.objectiveFacts.integrity, 30);
  assert.equal(withRelic.management.aether, 178 - 20);
});

test("a combined Relic pair resolves one additive Aether stage and one integrity stage", () => {
  const state = initialState(["broken-aegis", "bronze-obol"]);
  assert.equal(state.management.aether, 178 + 25 - 20);
  assert.equal(state.integrity, 30);
  assert.deepEqual(state.relics.equippedRelicIds, ["broken-aegis", "bronze-obol"]);
  assert.deepEqual(state.relics.modifiers.map(function (modifier) {
    return [modifier.statId, modifier.amount];
  }), [["bounty", 8500], ["starting-aether", 5], ["starting-integrity", 5]]);
});

test("R4 clamps a negative resolved starting-Aether stage to zero instead of throwing", () => {
  const clamped = Economy.resolveStartAether(30, 10000, 0, 0, -100000);
  assert.equal(clamped.afterRelicAether, 0);
  assert.equal(clamped.startAether, 0);
  assert.equal(Relics.applyIntegerModifier(5, {
    statId: "starting-aether",
    operation: "add",
    amount: -100000,
    rounding: "none",
  }), 0);
});

test("the Relic bounty multiplier keeps one remainder domain and conserves every unit", () => {
  const bound = binding();
  function bountyRun(relicIds) {
    let result = Kernel.advanceTick(
      bound,
      Kernel.createInitialState(bound, relicHeader(relicIds, {
        assist: true,
        campaignModifierIds: ["reserve-1"],
      })),
      [
        { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
        { tick: 0, seq: 1, type: "startWave" },
      ]
    );
    const credits = [];
    for (let tick = 1; tick <= 90; tick += 1) {
      result = Kernel.advanceTick(bound, result.state, []);
      result.telemetry.records.forEach(function (record) {
        if (record.kind === "aether-transaction" && record.action === "bounty") {
          credits.push({
            credit: record.creditAether,
            remainderBefore: record.bountyRemainderBefore,
            remainderAfter: record.bountyRemainderAfter,
          });
        }
      });
    }
    return { credits: credits, state: result.state };
  }

  const plain = bountyRun([]);
  const discounted = bountyRun(["bronze-obol"]);
  assert.ok(plain.credits.length > 0, "the run must pay at least one bounty");
  assert.equal(discounted.credits.length, plain.credits.length);

  /* Story bounty 11000 bp composed once with Bronze Obol 8500 bp = 9350 bp, then every kill
     divides by 10000 exactly once and carries its whole fraction in the single remainder. */
  const composedBp = Math.floor(11000 * 8500 / 10000);
  assert.equal(composedBp, 9350);
  let remainder = 0;
  let expectedTotal = 0;
  discounted.credits.forEach(function (record) {
    assert.equal(record.remainderBefore, remainder);
    const numerator = remainder + 2 * composedBp;
    assert.equal(record.credit, Math.floor(numerator / 10000));
    remainder = numerator % 10000;
    assert.equal(record.remainderAfter, remainder);
    expectedTotal += record.credit;
  });
  const awarded = discounted.credits.reduce(function (total, record) {
    return total + record.credit;
  }, 0);
  assert.equal(awarded, expectedTotal);
  /* Conservation: awarded Aether plus the carried remainder equals the exact rational total. */
  assert.equal(
    awarded * 10000 + remainder,
    discounted.credits.length * 2 * composedBp
  );
  assert.equal(discounted.state.management.bountyRemainder, remainder);
});

test("applyBountyWithRemainder and the kernel agree on one composed multiplier", () => {
  let remainder = 0;
  let total = 0;
  for (let index = 0; index < 25; index += 1) {
    const step = Relics.applyBountyWithRemainder(2, 9350, remainder);
    total += step.aetherAward;
    remainder = step.bountyRemainder;
  }
  assert.equal(total * 10000 + remainder, 25 * 2 * 9350);
});

test("Relic cost multipliers never escape their named stat clamp", () => {
  Object.keys(Relics.STAT_POLICIES).forEach(function (statId) {
    const policy = Relics.STAT_POLICIES[statId];
    if (policy.minimum === null || policy.maximum === null) return;
    assert.throws(
      () => Relics.applyIntegerModifier(100, {
        statId: statId,
        operation: policy.operation,
        amount: policy.minimum - 1,
        rounding: policy.rounding,
      }),
      /outside/
    );
  });
});

test("the resolved Relic table is a frozen canonical member of the ABI-v2 state", () => {
  const state = initialState(["forge-ember", "titan-gear"]);
  assert.equal(Object.isFrozen(state.relics), true);
  assert.equal(Object.isFrozen(state.relics.modifiers), true);
  assert.equal(state.relics.schemaVersion, Relics.RELIC_SCHEMA_VERSION);
  assert.equal(
    ABI.canonicalEncode(state.relics),
    ABI.canonicalEncode(JSON.parse(JSON.stringify(state.relics)))
  );
  let previous = null;
  state.relics.modifiers.forEach(function (modifier) {
    assert.equal(previous === null || modifier.statId > previous, true);
    previous = modifier.statId;
  });
});

test("an empty Relic loadout leaves every ABI-v2 economy result identical to no Relics", () => {
  const bound = binding();
  function run(header) {
    let result = Kernel.advanceTick(bound, Kernel.createInitialState(bound, header), [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]);
    for (let tick = 1; tick <= 40; tick += 1) {
      result = Kernel.advanceTick(bound, result.state, []);
    }
    return ABI.sha256Hex(ABI.canonicalBytes(result.state));
  }
  assert.equal(run(relicHeader([])), run(Fixture.headerV2(fixture)));
});
