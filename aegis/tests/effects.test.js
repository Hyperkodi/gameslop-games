"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const EFFECTS_PATH = path.join(__dirname, "..", "js", "sim", "effects.js");
const Effects = require(EFFECTS_PATH);

function status(overrides) {
  return Object.assign({
    appliedTick: 1,
    expiryTimeUnits: 5000,
    magnitude: 1000,
    sourceId: 1,
    statusId: "slow",
  }, overrides);
}

function external(overrides) {
  return Object.assign({
    appliedTick: 1,
    damageBp: 0,
    expiryTimeUnits: 5000,
    magnitude: 100,
    name: "mark.default",
    rangeBp: 0,
    rateBp: 0,
    sourceId: 1,
    sourceType: "mark",
  }, overrides);
}

function shield(overrides) {
  return Object.assign({ expiryTimeUnits: 5000, remainingMilli: 1000, sourceId: 1 }, overrides);
}

test("complete status comparator uses magnitude, later expiry, then lower runtime source ID", () => {
  const weakerLater = Effects.createStatusInstance(status({
    expiryTimeUnits: 9000, magnitude: 1900, sourceId: 1,
  }));
  const strongEarly = Effects.createStatusInstance(status({
    expiryTimeUnits: 3000, magnitude: 2100, sourceId: 99,
  }));
  const tiedEarlier = Effects.createStatusInstance(status({
    expiryTimeUnits: 6000, magnitude: 2000, sourceId: 2,
  }));
  const tiedLaterHighId = Effects.createStatusInstance(status({
    expiryTimeUnits: 7000, magnitude: 2000, sourceId: 8,
  }));
  const tiedLaterLowId = Effects.createStatusInstance(status({
    expiryTimeUnits: 7000, magnitude: 2000, sourceId: 3,
  }));

  assert.equal(Effects.compareStatusInstances(strongEarly, weakerLater), -1);
  assert.equal(Effects.compareStatusInstances(tiedLaterHighId, tiedEarlier), -1);
  assert.equal(Effects.compareStatusInstances(tiedLaterLowId, tiedLaterHighId), -1);
  assert.equal(Effects.compareStatusInstances(tiedLaterLowId, tiedLaterLowId), 0);

  const selected = Effects.selectStrongestStatus([
    weakerLater, tiedEarlier, tiedLaterHighId, tiedLaterLowId, strongEarly,
  ]);
  assert.deepEqual(selected, strongEarly);
  assert.equal(selected.expiryTimeUnits, 3000);
  assert.notEqual(selected.expiryTimeUnits, weakerLater.expiryTimeUnits);
  assert.equal(Object.isFrozen(selected), true);
});

test("slow and drench share one strongest-only movement bucket with a visible complete source", () => {
  const slow = status({
    expiryTimeUnits: 9000, magnitude: 2500, sourceId: 3, statusId: "slow",
  });
  const drench = status({
    expiryTimeUnits: 6000, magnitude: 3000, sourceId: 5, statusId: "drench",
  });
  const ignoredBurn = status({
    expiryTimeUnits: 12000, magnitude: 9000, sourceId: 1, statusId: "burn",
  });
  const resolved = Effects.resolveMovementReduction([slow, ignoredBurn, drench], 10000, 5200);
  assert.deepEqual(resolved, {
    effectiveSpeedBp: 7000,
    scaledReductionBp: 3000,
    source: Effects.createStatusInstance(drench),
    strongestReductionBp: 3000,
  });
  assert.equal(resolved.source.statusId, "drench");
  assert.equal(resolved.source.expiryTimeUnits, 6000);

  assert.deepEqual(Effects.resolveMovementReduction([ignoredBurn], 10000, 5200), {
    effectiveSpeedBp: 10000,
    scaledReductionBp: 0,
    source: null,
    strongestReductionBp: 0,
  });
});

test("movement reduction delegates exact regular, heavy, and boss control floors to the ABI", () => {
  const strongest = status({ magnitude: 8000, sourceId: 4, statusId: "slow" });
  const regular = Effects.resolveMovementReduction([strongest], 10000, 5200);
  assert.equal(regular.scaledReductionBp, 8000);
  assert.equal(regular.effectiveSpeedBp, 5200);

  const boss = Effects.resolveMovementReduction([
    status({ magnitude: 5000, sourceId: 9, statusId: "drench" }),
  ], 2000, 9500);
  assert.equal(boss.scaledReductionBp, 1000);
  assert.equal(boss.effectiveSpeedBp, 9500);
  assert.equal(boss.source.sourceId, 9);
});

test("friendly same-aura selection prefers magnitude then lower tower ID and recomputes on removal", () => {
  const sources = [
    { auraId: "athena.rate", magnitude: 900, sourceId: 1 },
    { auraId: "athena.rate", magnitude: 1000, sourceId: 9 },
    { auraId: "athena.rate", magnitude: 1000, sourceId: 3 },
    { auraId: "oracle.range", magnitude: 9999, sourceId: 2 },
  ];
  assert.deepEqual(Effects.selectFriendlyAura(sources, "athena.rate"), {
    auraId: "athena.rate", magnitude: 1000, sourceId: 3,
  });
  assert.deepEqual(
    Effects.selectFriendlyAura(sources.filter((source) => source.sourceId !== 3), "athena.rate"),
    { auraId: "athena.rate", magnitude: 1000, sourceId: 9 }
  );
  assert.equal(Effects.selectFriendlyAura(sources, "missing.aura"), null);
  assert.deepEqual(sources[0], { auraId: "athena.rate", magnitude: 900, sourceId: 1 });
  assert.equal(Object.isFrozen(sources[0]), false);
});

test("same-name external sources retain one complete strongest instance without field mixing", () => {
  const earlyStrong = external({
    damageBp: 700, expiryTimeUnits: 3000, magnitude: 900,
    name: "mark.focus", rangeBp: 20, rateBp: 30, sourceId: 7,
  });
  const laterWeak = external({
    damageBp: 100, expiryTimeUnits: 9000, magnitude: 800,
    name: "mark.focus", rangeBp: 900, rateBp: 900, sourceId: 1,
  });
  const tiedLaterHighId = external({
    damageBp: 500, expiryTimeUnits: 4000, magnitude: 900,
    name: "mark.focus", rangeBp: 40, rateBp: 50, sourceId: 8,
  });
  const tiedLaterLowId = external({
    damageBp: 600, expiryTimeUnits: 4000, magnitude: 900,
    name: "mark.focus", rangeBp: 60, rateBp: 70, sourceId: 2,
  });
  const result = Effects.resolveExternalAmplification([
    laterWeak, tiedLaterHighId, earlyStrong, tiedLaterLowId,
  ]);
  assert.equal(result.damageBp, 600);
  assert.equal(result.rateBp, 70);
  assert.equal(result.rangeBp, 60);
  assert.deepEqual(result.sources, [Effects.createExternalAmplificationInstance(tiedLaterLowId)]);
  assert.equal(result.sources[0].expiryTimeUnits, 4000);

  const afterSourceRemoval = Effects.resolveExternalAmplification([
    laterWeak, tiedLaterHighId, earlyStrong,
  ]);
  assert.equal(afterSourceRemoval.damageBp, 500);
  assert.equal(afterSourceRemoval.sources[0].sourceId, 8);
});

test("distinct external survivors sum in stable order and clamp each ABI category", () => {
  const instances = [
    external({
      damageBp: 500, magnitude: 500, name: "mark.gamma", rangeBp: 100,
      rateBp: 100, sourceId: 9, sourceType: "mark",
    }),
    external({
      damageBp: 1000, magnitude: 1000, name: "coord.beta", rangeBp: 700,
      rateBp: 900, sourceId: 5, sourceType: "coordinated",
    }),
    external({
      damageBp: 1200, magnitude: 1200, name: "aura.alpha", rangeBp: 700,
      rateBp: 900, sourceId: 3, sourceType: "aura",
    }),
    external({
      damageBp: 10, expiryTimeUnits: 8000, magnitude: 1100, name: "aura.alpha",
      rangeBp: 10, rateBp: 10, sourceId: 1, sourceType: "aura",
    }),
  ];
  const result = Effects.resolveExternalAmplification(instances);
  assert.equal(result.damageBp, ABI.DESCRIPTOR.externalCapsBp.damage);
  assert.equal(result.rateBp, ABI.DESCRIPTOR.externalCapsBp.rate);
  assert.equal(result.rangeBp, ABI.DESCRIPTOR.externalCapsBp.range);
  assert.deepEqual(result.sources.map((source) => [source.sourceType, source.name, source.sourceId]), [
    ["aura", "aura.alpha", 3],
    ["coordinated", "coord.beta", 5],
    ["mark", "mark.gamma", 9],
  ]);

  const withoutAura = Effects.resolveExternalAmplification(
    instances.filter((source) => source.name !== "aura.alpha")
  );
  assert.deepEqual({
    damageBp: withoutAura.damageBp,
    rangeBp: withoutAura.rangeBp,
    rateBp: withoutAura.rateBp,
  }, { damageBp: 1500, rangeBp: 800, rateBp: 1000 });
  assert.equal(Effects.resolveExternalAmplification([]).sources.length, 0);
});

test("shield pools consume earliest expiry then lower source ID with partial and overflow results", () => {
  const pools = [
    shield({ expiryTimeUnits: 3000, remainingMilli: 700, sourceId: 5 }),
    shield({ expiryTimeUnits: 2000, remainingMilli: 500, sourceId: 2 }),
    shield({ expiryTimeUnits: 2000, remainingMilli: 400, sourceId: 1 }),
  ];
  assert.deepEqual(Effects.consumeShieldPools(pools, 600), {
    absorbedMilli: 600,
    overflowMilli: 0,
    pools: [
      { expiryTimeUnits: 2000, remainingMilli: 300, sourceId: 2 },
      { expiryTimeUnits: 3000, remainingMilli: 700, sourceId: 5 },
    ],
  });
  assert.deepEqual(Effects.consumeShieldPools(pools, 100), {
    absorbedMilli: 100,
    overflowMilli: 0,
    pools: [
      { expiryTimeUnits: 2000, remainingMilli: 300, sourceId: 1 },
      { expiryTimeUnits: 2000, remainingMilli: 500, sourceId: 2 },
      { expiryTimeUnits: 3000, remainingMilli: 700, sourceId: 5 },
    ],
  });
  assert.deepEqual(Effects.consumeShieldPools(pools, 2000), {
    absorbedMilli: 1600,
    overflowMilli: 400,
    pools: [],
  });
  assert.deepEqual(Effects.consumeShieldPools(pools, 0), {
    absorbedMilli: 0,
    overflowMilli: 0,
    pools: [
      { expiryTimeUnits: 2000, remainingMilli: 400, sourceId: 1 },
      { expiryTimeUnits: 2000, remainingMilli: 500, sourceId: 2 },
      { expiryTimeUnits: 3000, remainingMilli: 700, sourceId: 5 },
    ],
  });
  assert.equal(Object.isFrozen(pools), false);
  assert.equal(Object.isFrozen(pools[0]), false);
});

test("effect inputs reject exact-key violations, duplicate identities, unsafe sums, and invalid pools", () => {
  assert.throws(() => Effects.createStatusInstance(status({ extra: 1 })), /exactly/i);
  assert.throws(() => Effects.createStatusInstance(status({ sourceId: 0 })), /positive/i);
  assert.throws(() => Effects.createStatusInstance(status({ expiryTimeUnits: 0 })), /positive/i);
  assert.throws(() => Effects.selectStrongestStatus([
    status({ sourceId: 1 }), status({ expiryTimeUnits: 6000, sourceId: 1 }),
  ]), /duplicate/i);
  assert.throws(() => Effects.selectStrongestStatus([
    status({ sourceId: 1, statusId: "slow" }),
    status({ sourceId: 2, statusId: "burn" }),
  ]), /matching status IDs/i);
  assert.throws(() => Effects.compareStatusInstances(
    status({ sourceId: 1, statusId: "slow" }),
    status({ sourceId: 2, statusId: "burn" })
  ), /matching status IDs/i);
  assert.throws(() => Effects.resolveMovementReduction([
    status({ magnitude: 10001, statusId: "slow" }),
  ], 10000, 5200), /basis points/i);
  const conflictingMovementIdentity = [
    status({ sourceId: 4, statusId: "slow" }),
    status({ sourceId: 4, statusId: "drench" }),
  ];
  assert.throws(
    () => Effects.resolveMovementReduction(conflictingMovementIdentity, 10000, 5200),
    /duplicate/i
  );
  assert.throws(
    () => Effects.resolveMovementReduction(
      conflictingMovementIdentity.slice().reverse(), 10000, 5200
    ),
    /duplicate/i
  );
  assert.throws(() => Effects.selectFriendlyAura([
    { auraId: "aura", magnitude: 1, sourceId: 1 },
    { auraId: "aura", magnitude: 2, sourceId: 1 },
  ], "aura"), /duplicate/i);

  assert.throws(() => Effects.resolveExternalAmplification([
    external({ name: "one", damageBp: Number.MAX_SAFE_INTEGER, sourceId: 1 }),
    external({ name: "two", damageBp: 1, sourceId: 2 }),
  ]), /safe integer range/i);
  assert.throws(() => Effects.resolveExternalAmplification([
    external({ sourceId: 1 }), external({ expiryTimeUnits: 6000, sourceId: 1 }),
  ]), /duplicate/i);
  const conflictingExternalIdentity = [
    external({ damageBp: 100, sourceId: 7, sourceType: "mark" }),
    external({ damageBp: 900, sourceId: 7, sourceType: "aura" }),
  ];
  assert.throws(
    () => Effects.resolveExternalAmplification(conflictingExternalIdentity),
    /duplicate/i
  );
  assert.throws(
    () => Effects.resolveExternalAmplification(conflictingExternalIdentity.slice().reverse()),
    /duplicate/i
  );
  assert.throws(() => Effects.consumeShieldPools([
    shield({ sourceId: 1 }), shield({ expiryTimeUnits: 6000, sourceId: 1 }),
  ], 1), /duplicate/i);
  assert.throws(() => Effects.consumeShieldPools([shield({ remainingMilli: 0 })], 1), /positive/i);
  assert.throws(() => Effects.consumeShieldPools([shield()], -1), /nonnegative/i);

  const shared = status({ sourceId: 2 });
  assert.throws(() => Effects.selectStrongestStatus([shared, shared]), /shared reference/i);
});

test("effect outputs are deeply frozen canonical records and never mutate caller state", () => {
  const statusInput = status({ magnitude: 2500, sourceId: 4 });
  const externalInput = external({ damageBp: 500, sourceId: 5 });
  const shieldInput = shield({ remainingMilli: 800, sourceId: 6 });
  const outputs = [
    Effects.selectStrongestStatus([statusInput]),
    Effects.resolveMovementReduction([statusInput], 10000, 5200),
    Effects.resolveExternalAmplification([externalInput]),
    Effects.consumeShieldPools([shieldInput], 200),
  ];
  for (const output of outputs) {
    assert.equal(Object.isFrozen(output), true);
    assert.doesNotThrow(() => ABI.canonicalEncode(output));
  }
  assert.equal(Object.isFrozen(outputs[1].source), true);
  assert.equal(Object.isFrozen(outputs[2].sources), true);
  assert.equal(Object.isFrozen(outputs[2].sources[0]), true);
  assert.equal(Object.isFrozen(outputs[3].pools), true);
  assert.equal(Object.isFrozen(outputs[3].pools[0]), true);
  assert.equal(Object.isFrozen(statusInput), false);
  assert.equal(Object.isFrozen(externalInput), false);
  assert.equal(Object.isFrozen(shieldInput), false);
  assert.equal(shieldInput.remainingMilli, 800);
});

test("classic script consumes only frozen ABI and needs no kit, DOM, network, or other sim module", () => {
  const abiSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8");
  const effectsSource = fs.readFileSync(EFFECTS_PATH, "utf8");
  const context = vm.createContext({});
  vm.runInContext(abiSource, context, { filename: "abi.js" });
  const injectedAbi = context.Game.AegisSim;
  vm.runInContext(effectsSource, context, { filename: "effects.js" });

  assert.equal(context.Game.AegisSim, injectedAbi);
  assert.equal(Object.isFrozen(context.Game.AegisEffects), true);
  assert.equal(context.Game.AegisGeometry, undefined);
  assert.equal(context.Game.AegisTimers, undefined);
  assert.equal(context.Game.AegisMovement, undefined);
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.require, undefined);
  assert.throws(
    () => vm.runInContext(effectsSource, vm.createContext({ Game: {} })),
    /AegisSim/i
  );
});
