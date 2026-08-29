"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PlayerUi = require("../js/presentation/player-ui.js");

test("player UI publishes the same frozen dependency-free browser surface", () => {
  const filename = path.join(__dirname, "../js/presentation/player-ui.js");
  const source = fs.readFileSync(filename, "utf8");
  const context = { globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename });
  assert.equal(context.Game.AegisPlayerUi.VERSION, PlayerUi.VERSION);
  assert.deepEqual(Array.from(context.Game.AegisPlayerUi.READINESS), Array.from(PlayerUi.READINESS));
  assert.equal(typeof context.Game.AegisPlayerUi.createProtocolTray, "function");
  assert.equal(Object.isFrozen(context.Game.AegisPlayerUi), true);

  const conflict = { globalThis: null, Game: { AegisPlayerUi: {} } };
  conflict.globalThis = conflict;
  assert.throws(function () {
    vm.runInNewContext(source, conflict, { filename });
  }, /Conflicting Game\.AegisPlayerUi/i);
});

function frozen(value) {
  if (!value || typeof value !== "object") return value;
  Object.keys(value).forEach(function (key) { frozen(value[key]); });
  return Object.freeze(value);
}

function protocolTier(tier, baseCostAether, cooldownMs, durationMs, effectText, maximumAcceptedCasts) {
  return {
    tier,
    baseCostAether,
    cooldownMs,
    durationMs,
    maximumAcceptedCasts: maximumAcceptedCasts === undefined ? null : maximumAcceptedCasts,
    effectText,
  };
}

function protocolFixture(configure) {
  const input = {
    content: {
      protocolRules: {
        repeatCostStepBp: 2500,
      },
      protocols: {
        "temporal-edict": {
          protocolId: "temporal-edict",
          castPolicyId: "repeat-surcharge",
          name: "Temporal Edict",
          targetKind: "none",
          tiers: [
            protocolTier(1, 75, 80000, 10000, "Slow every enemy by 25% for 10 seconds."),
            protocolTier(2, 115, 95000, 10000, "Slow every enemy by 50% for 10 seconds."),
            protocolTier(3, 165, 110000, 15000, "Slow every enemy by 50% for 15 seconds."),
          ],
        },
        "zeus-skyfire": {
          protocolId: "zeus-skyfire",
          castPolicyId: "repeat-surcharge",
          name: "Zeus Protocol: Skyfire",
          targetKind: "none",
          tiers: [
            protocolTier(1, 90, 90000, 900, "Strike every active enemy after a visible warning."),
            protocolTier(2, 135, 100000, 900, "Strike every active enemy after a visible warning."),
            protocolTier(3, 190, 115000, 1600, "Strike every active enemy twice after a visible warning."),
          ],
        },
      },
    },
    state: {
      tick: 120,
      ticksPerSecond: 60,
      phase: "wave",
      aether: 100,
      protocolSlotCap: 2,
      protocolLoadout: [
        { slot: 0, protocolId: "temporal-edict", tier: 1 },
        { slot: 1, protocolId: "zeus-skyfire", tier: 2 },
      ],
      missionLoan: null,
      protocolRuntimes: [
        { protocolId: "temporal-edict", readyTick: 120, acceptedCastCount: 1 },
        { protocolId: "zeus-skyfire", readyTick: 180, acceptedCastCount: 0 },
      ],
      pendingProtocolIds: [],
      sharedReadyTick: 150,
      protocolCostMultiplierBp: 8500,
    },
    local: { targeting: null },
    bindings: { protocolSlots: ["1", "2"] },
  };
  if (configure) configure(input);
  return frozen(input);
}

test("protocol tray always exposes two exact frozen slot cards from content and canonical state", () => {
  const input = protocolFixture();
  const model = PlayerUi.createProtocolTray(input);

  assert.equal(PlayerUi.PROTOCOL_SLOT_COUNT, 2);
  assert.equal(model.schemaVersion, 1);
  assert.equal(model.aether, 100);
  assert.equal(model.protocolSlots.length, 2);
  assert.deepEqual(model.protocolSlots.map(function (card) {
    return [card.slot, card.protocolId, card.resolvedCostAether, card.readiness];
  }), [
    [0, "temporal-edict", 80, "cooldown"],
    [1, "zeus-skyfire", 115, "cooldown"],
  ]);
  assert.equal(model.protocolSlots[0].baseCostAether, 75);
  assert.equal(model.protocolSlots[0].baseCooldownMs, 80000);
  assert.equal(model.protocolSlots[0].individualCooldownRemainingTicks, 0);
  assert.equal(model.protocolSlots[0].sharedCooldownRemainingTicks, 30);
  assert.equal(model.protocolSlots[0].cooldownRemainingSeconds, 1);
  assert.equal(model.protocolSlots[0].targetMode, "instant-confirm");
  assert.equal(model.protocolSlots[0].requiresTarget, false);
  assert.equal(model.protocolSlots[0].minimumTargetSizePx, 48);
  assert.equal(model.protocolSlots[0].effect.durationTicks, 600);
  assert.match(model.protocolSlots[0].ariaLabel, /Temporal Edict, Tier 1/i);
  assert.match(model.protocolSlots[0].ariaLabel, /resolved cost 80 Aether/i);
  assert.match(model.protocolSlots[0].ariaLabel, /cooldown 1 second/i);
  assert.equal(model.tutorialLoan, null);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.protocolSlots), true);
  assert.equal(Object.isFrozen(model.protocolSlots[0]), true);
  assert.equal(Object.isFrozen(model.protocolSlots[0].effect), true);
  assert.equal(input.state.aether, 100, "projection must not mutate canonical state");
});

test("protocol readiness has deterministic unavailable, pending, targeting, cooldown, unaffordable, ready priority", () => {
  function readiness(configure) {
    return PlayerUi.createProtocolTray(protocolFixture(configure)).protocolSlots[0].readiness;
  }

  assert.equal(readiness(function (input) { input.state.phase = "planning"; }), "unavailable");
  assert.equal(readiness(function (input) { input.state.pendingProtocolIds = ["temporal-edict"]; }), "pending");
  assert.equal(readiness(function (input) {
    input.state.sharedReadyTick = 120;
    input.local.targeting = { source: "loadout", slot: 0, protocolId: "temporal-edict" };
  }), "targeting");
  assert.equal(readiness(function () {}), "cooldown");
  assert.equal(readiness(function (input) {
    input.state.sharedReadyTick = 120;
    input.state.aether = 79;
  }), "unaffordable");
  assert.equal(readiness(function (input) {
    input.state.sharedReadyTick = 120;
    input.state.aether = 80;
  }), "ready");

  const empties = protocolFixture(function (input) {
    input.state.protocolSlotCap = 1;
    input.state.protocolLoadout = [];
    input.state.protocolRuntimes = [];
  });
  const emptyModel = PlayerUi.createProtocolTray(empties);
  assert.deepEqual(emptyModel.protocolSlots.map(function (card) {
    return [card.kind, card.locked, card.readiness, card.ariaLabel];
  }), [
    ["empty", false, "unavailable", "Divine Protocol slot 1, empty"],
    ["empty", true, "unavailable", "Divine Protocol slot 2, locked"],
  ]);

  const loanModel = PlayerUi.createProtocolTray(protocolFixture(function (input) {
    input.state.protocolLoadout.pop();
    input.state.missionLoan = { protocolId: "zeus-skyfire", tier: 1 };
  }));
  assert.equal(loanModel.protocolSlots.length, 2);
  assert.equal(loanModel.protocolSlots[1].kind, "empty");
  assert.equal(loanModel.tutorialLoan.kind, "tutorial-loan");
  assert.equal(loanModel.tutorialLoan.protocolId, "zeus-skyfire");
  assert.equal(loanModel.tutorialLoan.slot, null);
  assert.equal(loanModel.tutorialLoan.source, "mission-loan");
  assert.match(loanModel.tutorialLoan.ariaLabel, /Tutorial loan/i);
});

test("relic, specialization, reinforcement, and mechanism models expose exact tradeoffs and action state", () => {
  const relics = PlayerUi.createRelicCards(frozen({
    content: { relics: {
      "bronze-obol": {
        id: "bronze-obol", name: "Bronze Obol", benefitText: "+25 starting Aether.",
        drawbackText: "Earn 15% less bounty.", unlockSource: "Win mission 6.",
      },
      "owl-lens": {
        id: "owl-lens", name: "Owl Lens", benefitText: "+10% tower range.",
        drawbackText: "-8% tower attack rate.", unlockSource: "Win mission 7.",
      },
    } },
    state: {
      slotCap: 1, unlockedIds: ["bronze-obol"], equippedIds: ["bronze-obol"],
      slotUnlockSource: "Win mission 6 and mission 15.",
    },
  }));
  assert.deepEqual(relics.map(function (card) { return [card.id, card.status, card.equippedSlot]; }), [
    ["bronze-obol", "equipped", 1],
    ["owl-lens", "locked", null],
  ]);
  assert.match(relics[0].ariaLabel, /Benefit: \+25 starting Aether/i);
  assert.match(relics[0].ariaLabel, /Drawback: Earn 15% less bounty/i);
  assert.match(relics[0].ariaLabel, /Status: Equipped\.$/);
  assert.match(relics[1].ariaLabel, /Status: Locked\.$/);
  assert.equal(relics[1].inspectable, true, "locked Relics remain inspectable");

  const specializations = PlayerUi.createSpecializationCards(frozen({
    content: { specializations: {
      "sentinel-lock-on": {
        id: "sentinel-lock-on", defenseId: "sentinel", name: "Lock-On",
        costAether: 110, effectText: "Focused damage grows while tracking one target.",
        tradeoffText: "No secondary target.", isDefault: true,
      },
      "sentinel-twin-lance": {
        id: "sentinel-twin-lance", defenseId: "sentinel", name: "Twin Lance",
        costAether: 110, effectText: "Hits a nearby second target for 60% damage.",
        tradeoffText: "Loses Lock-On scaling.", isDefault: false,
      },
    } },
    state: {
      phase: "planning", aether: 105, pendingSpecialization: null,
      specializationCostMultiplierBp: 10000,
      tower: {
        runtimeId: 7, defenseId: "sentinel", level: 2,
        availableSpecializationIds: ["sentinel-lock-on", "sentinel-twin-lance"],
        selectedSpecializationId: null,
      },
    },
  }));
  assert.equal(specializations.length, 2);
  assert.deepEqual(specializations.map(function (card) { return [card.id, card.status]; }), [
    ["sentinel-lock-on", "unaffordable"],
    ["sentinel-twin-lance", "unaffordable"],
  ]);
  assert.equal(specializations[0].baseCostAether, 110);
  assert.equal(specializations[0].resolvedCostAether, 110);
  assert.match(specializations[1].ariaLabel, /Loses Lock-On scaling/i);
  assert.match(specializations[1].ariaLabel, /Not enough Aether\.$/);
  assert.doesNotMatch(specializations[1].ariaLabel, /unaffordable/);

  const reinforcement = PlayerUi.createReinforcementControl(frozen({
    content: { reinforcements: {
      "spartan-phalanx": {
        id: "spartan-phalanx", name: "Spartan Phalanx", roleText: "Blocks three ground contacts.",
        costAether: 70, cooldownMs: 50000, lifetimeMs: 14000,
      },
    } },
    state: {
      tick: 900, ticksPerSecond: 60, phase: "wave", aether: 80,
      equippedId: "spartan-phalanx", readyTick: 960, liveUnitId: null,
      liveUnitExpiresTick: null,
      markerAvailable: true, pending: false,
    },
    bindings: { activate: "P" },
  }));
  assert.equal(reinforcement.readiness, "cooldown");
  assert.equal(reinforcement.cooldownRemainingSeconds, 1);
  assert.equal(reinforcement.keyHint, "P");
  assert.match(reinforcement.ariaLabel, /Spartan Phalanx.*cooldown 1 second/i);

  const mechanisms = PlayerUi.createMechanismCards(frozen({
    content: { mechanisms: {
      "bronze-city-gate": {
        id: "bronze-city-gate", name: "Bronze City Gate", effectText: "Blocks up to three contacts.",
        costAether: 55, cooldownMs: 0, maximumActivations: 3,
      },
    } },
    state: {
      tick: 300, ticksPerSecond: 60, phase: "wave", aether: 54,
      runtimes: [{
        mechanismId: "bronze-city-gate", activationId: "gate.m05",
        readyTick: 300, acceptedActivationCount: 0, pending: false, activationAvailable: true,
      }],
    },
    bindings: { activate: null },
  }));
  assert.equal(mechanisms[0].readiness, "unaffordable");
  assert.equal(mechanisms[0].targetMode, "activation-id");
  assert.equal(mechanisms[0].keyHint, null);
  assert.equal(Object.isFrozen(mechanisms[0]), true);
});

test("loadout and unlock projections are fixed semantic sections and derive the next locked reward", () => {
  const loadout = PlayerUi.createLoadoutModel(frozen({
    towers: { slotCap: 6, equippedIds: ["chronos", "sentinel"], unlockSource: "Campaign victories." },
    protocols: { slotCap: 2, equippedIds: ["temporal-edict"], unlockSource: "Win mission 5 and mission 10." },
    relics: { slotCap: 1, equippedIds: ["bronze-obol"], unlockSource: "Win mission 6 and mission 15." },
    reinforcement: { slotCap: 1, equippedIds: [], unlockSource: "Win mission 9." },
  }));
  assert.deepEqual(loadout.sections.map(function (section) {
    return [section.id, section.title, section.usedSlots, section.slotCap, section.clearLabel];
  }), [
    ["towers", "Towers", 2, 6, "Clear Towers"],
    ["protocols", "Divine Protocols", 1, 2, "Clear Divine Protocols"],
    ["relics", "Relics", 1, 1, "Clear Relics"],
    ["reinforcement", "Reinforcement", 0, 1, "Clear Reinforcement"],
  ]);
  assert.equal(loadout.sections[0].minimumTargetSizePx, 44);
  assert.equal(Object.isFrozen(loadout.sections), true);

  const unlocks = PlayerUi.createUnlockCards(frozen({
    content: { unlocks: {
      "protocol.temporal": {
        id: "protocol.temporal", order: 5, category: "protocol", name: "Temporal Edict",
        description: "Unlock the first Divine Protocol.", sourceMissionId: "m05",
      },
      "relic.bronze": {
        id: "relic.bronze", order: 6, category: "relic", name: "Bronze Obol",
        description: "Unlock a tradeoff Relic.", sourceMissionId: "m06",
      },
      "protocol.skyfire": {
        id: "protocol.skyfire", order: 8, category: "protocol", name: "Skyfire",
        description: "Unlock Zeus's global strike.", sourceMissionId: "m08",
      },
    } },
    state: { unlockedIds: ["protocol.temporal"] },
  }));
  assert.deepEqual(unlocks.map(function (card) { return [card.id, card.status]; }), [
    ["protocol.temporal", "unlocked"],
    ["relic.bronze", "next"],
    ["protocol.skyfire", "locked"],
  ]);
  assert.match(unlocks[1].ariaLabel, /Next unlock.*mission 6/i);
});

test("player UI projections fail closed on extra fields, unknown IDs, duplicate slots, and stale local targeting", () => {
  assert.throws(function () {
    const input = protocolFixture(function (value) { value.wallClockMs = 1; });
    PlayerUi.createProtocolTray(input);
  }, /unknown field wallClockMs/i);

  assert.throws(function () {
    const input = protocolFixture(function (value) {
      value.state.protocolLoadout[1].slot = 0;
    });
    PlayerUi.createProtocolTray(input);
  }, /duplicate protocol slot/i);

  assert.throws(function () {
    const input = protocolFixture(function (value) {
      value.state.protocolLoadout[0].protocolId = "unknown-protocol";
    });
    PlayerUi.createProtocolTray(input);
  }, /unknown Protocol/i);

  assert.throws(function () {
    const input = protocolFixture(function (value) {
      value.local.targeting = { source: "loadout", slot: 1, protocolId: "temporal-edict" };
    });
    PlayerUi.createProtocolTray(input);
  }, /does not match protocol slot/i);

  assert.throws(function () {
    PlayerUi.createLoadoutModel({
      towers: { slotCap: 1, equippedIds: [], unlockSource: "Start." },
      protocols: { slotCap: 0, equippedIds: [], unlockSource: "Later." },
      relics: { slotCap: 0, equippedIds: [], unlockSource: "Later." },
      reinforcement: { slotCap: 0, equippedIds: [], unlockSource: "Later.", extra: true },
    });
  }, /unknown field extra/i);
});

test("player UI preflight rejects getters, sparse arrays, symbols, cycles, and shared references before projection", () => {
  let getterCalls = 0;
  const getterInput = JSON.parse(JSON.stringify(protocolFixture()));
  Object.defineProperty(getterInput, "content", {
    enumerable: true,
    get: function () { getterCalls += 1; return {}; },
  });
  assert.throws(function () { PlayerUi.createProtocolTray(getterInput); }, /data properties|accessor/i);
  assert.equal(getterCalls, 0);

  const sparse = JSON.parse(JSON.stringify(protocolFixture()));
  sparse.bindings.protocolSlots = new Array(2);
  assert.throws(function () { PlayerUi.createProtocolTray(sparse); }, /dense/i);

  const symbolic = JSON.parse(JSON.stringify(protocolFixture()));
  symbolic[Symbol("hostile")] = true;
  assert.throws(function () { PlayerUi.createProtocolTray(symbolic); }, /symbol/i);

  const cyclic = JSON.parse(JSON.stringify(protocolFixture()));
  cyclic.local.loop = cyclic;
  assert.throws(function () { PlayerUi.createProtocolTray(cyclic); }, /cycles|shared/i);

  const shared = JSON.parse(JSON.stringify(protocolFixture()));
  shared.local.alias = shared.content.protocolRules;
  assert.throws(function () { PlayerUi.createProtocolTray(shared); }, /cycles|shared/i);
});

test("protocol once-per-mission readiness keeps accepted pending work visible before exhaustion", () => {
  const pending = protocolFixture(function (input) {
    const protocol = input.content.protocols["temporal-edict"];
    protocol.castPolicyId = "once-per-mission";
    protocol.tiers.forEach(function (tier) { tier.maximumAcceptedCasts = 1; });
    input.state.protocolRuntimes[0].acceptedCastCount = 1;
    input.state.pendingProtocolIds = ["temporal-edict"];
  });
  const pendingCard = PlayerUi.createProtocolTray(pending).protocolSlots[0];
  assert.equal(pendingCard.readiness, "pending");
  assert.equal(pendingCard.readinessReasonCode, "effect-pending");

  const exhausted = protocolFixture(function (input) {
    const protocol = input.content.protocols["temporal-edict"];
    protocol.castPolicyId = "once-per-mission";
    protocol.tiers.forEach(function (tier) { tier.maximumAcceptedCasts = 1; });
    input.state.protocolRuntimes[0].acceptedCastCount = 1;
    input.state.sharedReadyTick = input.state.tick;
  });
  const exhaustedCard = PlayerUi.createProtocolTray(exhausted).protocolSlots[0];
  assert.equal(exhaustedCard.readiness, "unavailable");
  assert.equal(exhaustedCard.readinessReasonCode, "once-per-mission-used");
  assert.equal(exhaustedCard.summary.cost.maximumAcceptedCasts, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(exhaustedCard.summary, "runtimeId"), false);
});

test("null-prototype lookup tables safely accept prototype-shaped authored IDs", () => {
  const records = Object.create(null);
  ["constructor", "toString", "valueOf"].forEach(function (id) {
    records[id] = {
      id: id, name: id, benefitText: "A visible benefit.", drawbackText: "A visible drawback.",
      unlockSource: "Audit fixture.",
    };
  });
  const cards = PlayerUi.createRelicCards({
    content: { relics: records },
    state: {
      slotCap: 2, unlockedIds: ["constructor", "toString", "valueOf"], equippedIds: ["constructor"],
      slotUnlockSource: "Audit fixture.",
    },
  });
  assert.deepEqual(cards.map(function (card) { return card.id; }), ["constructor", "toString", "valueOf"]);
  assert.equal(cards[0].status, "equipped");
});

test("checked-in v4 catalogs retain 10/30/8/3/5 parity and project all five mechanisms", () => {
  function binding(relative) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "../content-v4", relative, "binding-v1.json"), "utf8"));
  }
  const protocols = binding("protocols").records;
  const specializations = binding("specializations").records;
  const relics = binding("relics").records;
  const reinforcements = binding("reinforcements").records;
  const mechanisms = binding("mechanisms").records;
  assert.deepEqual([protocols.length, specializations.length, relics.length, reinforcements.length, mechanisms.length],
    [10, 30, 8, 3, 5]);

  const content = Object.create(null);
  mechanisms.forEach(function (record) {
    content[record.id] = {
      id: record.id, name: record.nameKey, effectText: record.effect.kind,
      costAether: record.costAether, cooldownMs: record.cooldownMs,
      maximumActivations: record.maximumActivations,
    };
  });
  // Each mission carries at most one mechanism, so every catalog record is projected on its own.
  const cards = mechanisms.map(function (record, index) {
    const projected = PlayerUi.createMechanismCards({
      content: { mechanisms: content },
      state: {
        tick: 0, ticksPerSecond: 60, phase: "wave", aether: 9999,
        runtimes: [{
          mechanismId: record.id, activationId: "activation." + index, readyTick: 0,
          acceptedActivationCount: 0, pending: false, activationAvailable: true,
        }],
      },
      bindings: { activate: "M" },
    });
    assert.equal(projected.length, 1);
    return projected[0];
  });
  assert.deepEqual(cards.map(function (card) { return [card.id, card.cooldownMs, card.keyHint]; }),
    mechanisms.map(function (record) { return [record.id, record.cooldownMs, "M"]; }));
  assert.equal(cards.find(function (card) { return card.id === "bridgefall"; }).cooldownMs, 0);
});

test("a mission projects at most one mechanism runtime so one key hint never targets two mechanisms", () => {
  function input(runtimes) {
    return {
      content: { mechanisms: {
        "bronze-city-gate": {
          id: "bronze-city-gate", name: "Bronze City Gate", effectText: "Blocks up to three contacts.",
          costAether: 55, cooldownMs: 75000, maximumActivations: 3,
        },
        "harbor-chain": {
          id: "harbor-chain", name: "Harbor Chain", effectText: "Slows harbor enemies.",
          costAether: 50, cooldownMs: 65000, maximumActivations: 3,
        },
      } },
      state: { tick: 0, ticksPerSecond: 60, phase: "wave", aether: 100, runtimes: runtimes },
      bindings: { activate: "M" },
    };
  }
  function runtime(id) {
    return {
      mechanismId: id, activationId: "activation." + id, readyTick: 0,
      acceptedActivationCount: 0, pending: false, activationAvailable: true,
    };
  }
  assert.deepEqual(PlayerUi.createMechanismCards(input([])), []);
  assert.equal(PlayerUi.createMechanismCards(input([runtime("harbor-chain")]))[0].id, "harbor-chain");
  assert.throws(function () {
    PlayerUi.createMechanismCards(input([runtime("bronze-city-gate"), runtime("harbor-chain")]));
  }, /at most one mechanism runtime/i);
  assert.throws(function () {
    PlayerUi.createMechanismCards(input([runtime("bronze-city-gate"), runtime("bronze-city-gate")]));
  }, /at most one mechanism runtime/i);
});

test("specialization state binds pending work to the selected tower and only available branches", () => {
  function input(level) {
    return {
      content: { specializations: {
        "sentinel-lock-on": { id: "sentinel-lock-on", defenseId: "sentinel", name: "Lock-On",
          costAether: 110, effectText: "Focus.", tradeoffText: "Single target.", isDefault: true },
        "sentinel-twin-lance": { id: "sentinel-twin-lance", defenseId: "sentinel", name: "Twin Lance",
          costAether: 110, effectText: "Fork.", tradeoffText: "No scaling.", isDefault: false },
      } },
      state: { phase: "wave", aether: 200, pendingSpecialization: null,
        specializationCostMultiplierBp: 10000,
        tower: { runtimeId: 7, defenseId: "sentinel", level: level,
          availableSpecializationIds: ["sentinel-lock-on", "sentinel-twin-lance"],
          selectedSpecializationId: null } },
    };
  }
  const level1 = input(1);
  assert.deepEqual(PlayerUi.createSpecializationCards(level1).map(function (card) { return card.status; }),
    ["unavailable", "unavailable"]);
  const level2 = input(2);
  level2.state.pendingSpecialization = { towerRuntimeId: 7, specializationId: "sentinel-lock-on" };
  assert.deepEqual(PlayerUi.createSpecializationCards(level2).map(function (card) { return card.status; }),
    ["pending", "unavailable"]);
  const wrongTower = input(2);
  wrongTower.state.pendingSpecialization = { towerRuntimeId: 8, specializationId: "sentinel-lock-on" };
  assert.throws(function () { PlayerUi.createSpecializationCards(wrongTower); }, /selected tower/i);
  const lockedPending = input(2);
  lockedPending.state.tower.availableSpecializationIds = ["sentinel-lock-on"];
  lockedPending.state.pendingSpecialization = { towerRuntimeId: 7, specializationId: "sentinel-twin-lance" };
  assert.throws(function () { PlayerUi.createSpecializationCards(lockedPending); }, /pending specialization.*available/i);
  const level3 = input(3);
  level3.state.tower.availableSpecializationIds = ["sentinel-lock-on"];
  level3.state.tower.selectedSpecializationId = "sentinel-lock-on";
  assert.equal(PlayerUi.createSpecializationCards(level3)[0].status, "selected");
  const lockedSelected = input(3);
  lockedSelected.state.tower.availableSpecializationIds = ["sentinel-lock-on"];
  lockedSelected.state.tower.selectedSpecializationId = "sentinel-twin-lance";
  assert.throws(function () { PlayerUi.createSpecializationCards(lockedSelected); }, /selected specialization.*available/i);
});

test("specialization availability always includes the family default branch", () => {
  function input(level, availableIds) {
    return {
      content: { specializations: {
        "sentinel-lock-on": { id: "sentinel-lock-on", defenseId: "sentinel", name: "Lock-On",
          costAether: 110, effectText: "Focus.", tradeoffText: "Single target.", isDefault: true },
        "sentinel-twin-lance": { id: "sentinel-twin-lance", defenseId: "sentinel", name: "Twin Lance",
          costAether: 110, effectText: "Fork.", tradeoffText: "No scaling.", isDefault: false },
      } },
      state: { phase: "wave", aether: 200, pendingSpecialization: null,
        specializationCostMultiplierBp: 10000,
        tower: { runtimeId: 7, defenseId: "sentinel", level: level,
          availableSpecializationIds: availableIds, selectedSpecializationId: null } },
    };
  }
  const defaultOnly = PlayerUi.createSpecializationCards(input(2, ["sentinel-lock-on"]));
  assert.deepEqual(defaultOnly.map(function (card) { return [card.id, card.isDefault, card.status]; }), [
    ["sentinel-lock-on", true, "ready"],
    ["sentinel-twin-lance", false, "unavailable"],
  ]);
  assert.equal(defaultOnly[1].readinessReasonCode, "specialization-locked");
  assert.throws(function () {
    PlayerUi.createSpecializationCards(input(2, ["sentinel-twin-lance"]));
  }, /default specialization sentinel-lock-on/i);
  assert.throws(function () {
    PlayerUi.createSpecializationCards(input(2, []));
  }, /default specialization sentinel-lock-on/i);
  assert.throws(function () {
    PlayerUi.createSpecializationCards(input(1, []));
  }, /default specialization sentinel-lock-on/i);
});

test("specialization cards resolve Relic cost multipliers with ceiling rounding inside the reducer clamp", () => {
  function input(multiplierBp, aether) {
    return {
      content: { specializations: {
        "sentinel-lock-on": { id: "sentinel-lock-on", defenseId: "sentinel", name: "Lock-On",
          costAether: 95, effectText: "Focus.", tradeoffText: "Single target.", isDefault: true },
        "sentinel-twin-lance": { id: "sentinel-twin-lance", defenseId: "sentinel", name: "Twin Lance",
          costAether: 95, effectText: "Fork.", tradeoffText: "No scaling.", isDefault: false },
      } },
      state: { phase: "wave", aether: aether, pendingSpecialization: null,
        specializationCostMultiplierBp: multiplierBp,
        tower: { runtimeId: 7, defenseId: "sentinel", level: 2,
          availableSpecializationIds: ["sentinel-lock-on", "sentinel-twin-lance"],
          selectedSpecializationId: null } },
    };
  }
  function summary(model) {
    return [model.baseCostAether, model.costMultiplierBp, model.resolvedCostAether, model.status, model.canSelect];
  }
  assert.deepEqual(summary(PlayerUi.createSpecializationCards(input(10000, 95))[0]), [95, 10000, 95, "ready", true]);
  assert.deepEqual(summary(PlayerUi.createSpecializationCards(input(10000, 94))[0]), [95, 10000, 95, "unaffordable", false]);

  // forge-ember: specialization-cost x 8800 bp, ceil(95 * 8800 / 10000) = ceil(83.6) = 84
  const forgeEmber = PlayerUi.createSpecializationCards(input(8800, 84));
  assert.deepEqual(summary(forgeEmber[0]), [95, 8800, 84, "ready", true]);
  assert.match(forgeEmber[0].ariaLabel, /costs 84 Aether/);
  assert.doesNotMatch(forgeEmber[0].ariaLabel, /costs 95 Aether/);
  assert.equal(PlayerUi.createSpecializationCards(input(8800, 83))[0].status, "unaffordable");
  assert.equal(PlayerUi.createSpecializationCards(input(8800, 83))[0].readinessReasonCode, "insufficient-aether");

  // titan-gear: specialization-cost x 10800 bp, ceil(95 * 10800 / 10000) = ceil(102.6) = 103
  const titanGear = PlayerUi.createSpecializationCards(input(10800, 103));
  assert.deepEqual(summary(titanGear[1]), [95, 10800, 103, "ready", true]);
  assert.match(titanGear[1].ariaLabel, /costs 103 Aether/);
  assert.equal(PlayerUi.createSpecializationCards(input(10800, 102))[1].status, "unaffordable");

  // Reducer clamp bounds (relics.js specialization-cost policy): 7000..14000 bp inclusive.
  assert.equal(PlayerUi.createSpecializationCards(input(7000, 200))[0].resolvedCostAether, 67);
  assert.equal(PlayerUi.createSpecializationCards(input(14000, 200))[0].resolvedCostAether, 133);
  [6999, 14001, 0, -1, 1.5, -0, "10000", null, 100000].forEach(function (value) {
    assert.throws(function () {
      PlayerUi.createSpecializationCards(input(value, 200));
    }, /specialization cost multiplier/i, "multiplier " + String(value));
  });
  assert.throws(function () {
    const missing = input(10000, 200);
    delete missing.state.specializationCostMultiplierBp;
    PlayerUi.createSpecializationCards(missing);
  }, /missing field specializationCostMultiplierBp/i);
  assert.equal(Object.prototype.hasOwnProperty.call(forgeEmber[0], "costAether"), false,
    "cards expose base and resolved costs instead of an ambiguous costAether");
});

test("key binding collisions fail closed and full Relic slots expose a stable reason", () => {
  assert.throws(function () {
    PlayerUi.createProtocolTray(protocolFixture(function (input) {
      input.bindings.protocolSlots = ["Q", "Q"];
    }));
  }, /duplicate key bindings/i);
  assert.throws(function () {
    PlayerUi.createProtocolTray(protocolFixture(function (input) {
      input.bindings.reinforcement = "1";
    }));
  }, /duplicate key bindings/i);

  const relics = PlayerUi.createRelicCards({
    content: { relics: {
      alpha: { id: "alpha", name: "Alpha", benefitText: "Benefit.", drawbackText: "Drawback.", unlockSource: "Start." },
      beta: { id: "beta", name: "Beta", benefitText: "Benefit.", drawbackText: "Drawback.", unlockSource: "Start." },
    } },
    state: {
      slotCap: 1, unlockedIds: ["alpha", "beta"], equippedIds: ["alpha"],
      slotUnlockSource: "Win mission 6 and mission 15.",
    },
  });
  assert.equal(relics[1].status, "available");
  assert.equal(relics[1].canEquip, false);
  assert.equal(relics[1].reasonCode, "relic-slots-full");
  assert.match(relics[1].reasonText, /slots are full/i);
});

test("an unlocked Relic with no Relic slot explains the slot unlock instead of claiming the slots are full", () => {
  function cards(state) {
    return PlayerUi.createRelicCards({
      content: { relics: {
        alpha: { id: "alpha", name: "Alpha", benefitText: "Benefit.", drawbackText: "Drawback.", unlockSource: "Win mission 9." },
      } },
      state: state,
    });
  }
  const locked = cards({ slotCap: 0, unlockedIds: ["alpha"], equippedIds: [], slotUnlockSource: "Win mission 6 and mission 15." });
  assert.equal(locked[0].status, "available");
  assert.equal(locked[0].canEquip, false);
  assert.equal(locked[0].reasonCode, "relic-slot-locked");
  assert.match(locked[0].reasonText, /Relic slot.*locked/i);
  assert.match(locked[0].reasonText, /Win mission 6 and mission 15\./);
  assert.doesNotMatch(locked[0].reasonText, /full/i);
  assert.match(locked[0].ariaLabel, /Status: Available to equip\.$/);
  const open = cards({ slotCap: 1, unlockedIds: ["alpha"], equippedIds: [], slotUnlockSource: "Win mission 6 and mission 15." });
  assert.equal(open[0].reasonCode, "available");
  assert.throws(function () {
    cards({ slotCap: 0, unlockedIds: [], equippedIds: [] });
  }, /missing field slotUnlockSource/i);
  assert.throws(function () {
    cards({ slotCap: 0, unlockedIds: [], equippedIds: [], slotUnlockSource: "<script>" });
  }, /unsafe/i);
});

test("tutorial mission loans are always Tier 1", () => {
  [2, 3, 0, 4].forEach(function (tier) {
    assert.throws(function () {
      PlayerUi.createProtocolTray(protocolFixture(function (input) {
        input.state.protocolLoadout.pop();
        input.state.missionLoan = { protocolId: "zeus-skyfire", tier: tier };
      }));
    }, /Mission Protocol loan tier must be Tier 1/i, "loan tier " + tier);
  });
  const model = PlayerUi.createProtocolTray(protocolFixture(function (input) {
    input.state.protocolLoadout.pop();
    input.state.missionLoan = { protocolId: "zeus-skyfire", tier: 1 };
  }));
  assert.equal(model.tutorialLoan.tier, 1);
  assert.equal(model.tutorialLoan.baseCostAether, 90);
});

test("key bindings accept exactly one printable key, normalize case, and reject chords and reserved keys", () => {
  const defaults = PlayerUi.createProtocolTray(protocolFixture(function (input) {
    input.bindings = { protocolSlots: ["1", "2"], reinforcement: "R", mechanism: "M" };
  }));
  assert.deepEqual(defaults.protocolSlots.map(function (card) { return card.keyHint; }), ["1", "2"]);

  const lower = PlayerUi.createProtocolTray(protocolFixture(function (input) {
    input.bindings = { protocolSlots: ["q", null] };
  }));
  assert.equal(lower.protocolSlots[0].keyHint, "Q", "bindings normalize to upper case");
  assert.equal(lower.protocolSlots[1].keyHint, null);

  ["Ctrl+W", "Escape", "Tab", "F5", "Enter", "Space", "", " ", "ab", "-", "é", 1, undefined, true].forEach(function (value) {
    assert.throws(function () {
      PlayerUi.createProtocolTray(protocolFixture(function (input) {
        input.bindings = { protocolSlots: [value, "2"] };
      }));
    }, /single printable key/i, "protocol binding " + String(value));
    assert.throws(function () {
      PlayerUi.createProtocolTray(protocolFixture(function (input) {
        input.bindings = { protocolSlots: ["1", "2"], reinforcement: value };
      }));
    }, /single printable key/i, "reinforcement binding " + String(value));
    assert.throws(function () {
      PlayerUi.createProtocolTray(protocolFixture(function (input) {
        input.bindings = { protocolSlots: ["1", "2"], mechanism: value };
      }));
    }, /single printable key/i, "mechanism binding " + String(value));
  });

  assert.throws(function () {
    PlayerUi.createProtocolTray(protocolFixture(function (input) {
      input.bindings = { protocolSlots: ["q", "Q"] };
    }));
  }, /duplicate key bindings/i);
  assert.throws(function () {
    PlayerUi.createProtocolTray(protocolFixture(function (input) {
      input.bindings = { protocolSlots: ["1", "2"], reinforcement: "r", mechanism: "R" };
    }));
  }, /duplicate key bindings/i);

  const reinforcement = frozen({
    content: { reinforcements: {
      "spartan-phalanx": {
        id: "spartan-phalanx", name: "Spartan Phalanx", roleText: "Blocks three ground contacts.",
        costAether: 70, cooldownMs: 50000, lifetimeMs: 14000,
      },
    } },
    state: {
      tick: 900, ticksPerSecond: 60, phase: "wave", aether: 80,
      equippedId: "spartan-phalanx", readyTick: 960, liveUnitId: null,
      liveUnitExpiresTick: null, markerAvailable: true, pending: false,
    },
    bindings: { activate: "r", protocolSlots: ["1", "R"] },
  });
  assert.throws(function () { PlayerUi.createReinforcementControl(reinforcement); }, /duplicate key bindings/i);
  assert.throws(function () {
    PlayerUi.createReinforcementControl(Object.assign({}, reinforcement, { bindings: { activate: "Enter" } }));
  }, /single printable key/i);
  assert.equal(PlayerUi.createReinforcementControl(
    Object.assign({}, reinforcement, { bindings: { activate: "r", protocolSlots: ["1", "2"] } })
  ).keyHint, "R");
});

test("protocol tray accepts only the reducer's cost multiplier clamp and a positive repeat step", () => {
  function resolved(configure) {
    return PlayerUi.createProtocolTray(protocolFixture(configure)).protocolSlots[0].resolvedCostAether;
  }
  // temporal-edict Tier 1: base 75, one prior cast at 2500 bp -> ceil(75 * 12500 / 10000) = 94
  assert.equal(resolved(function (input) { input.state.protocolCostMultiplierBp = 10000; }), 94);
  assert.equal(resolved(function (input) { input.state.protocolCostMultiplierBp = 7000; }), 66);
  assert.equal(resolved(function (input) { input.state.protocolCostMultiplierBp = 14000; }), 132);
  [6999, 14001, 0, -1, 1.5, 100000, 100001, "8500", null].forEach(function (value) {
    assert.throws(function () {
      resolved(function (input) { input.state.protocolCostMultiplierBp = value; });
    }, /Protocol cost multiplier/i, "multiplier " + String(value));
  });
  // repeat step 1 bp: ceil(75 * 10001 / 10000) = 76, then ceil(76 * 8500 / 10000) = 65
  assert.equal(resolved(function (input) { input.content.protocolRules.repeatCostStepBp = 1; }), 65);
  [0, -1, 1.5, -0, "2500", null].forEach(function (value) {
    assert.throws(function () {
      resolved(function (input) { input.content.protocolRules.repeatCostStepBp = value; });
    }, /repeatCostStepBp/i, "repeat step " + String(value));
  });
});

test("projections snapshot validated input once and never re-read the caller's object", () => {
  const source = JSON.parse(JSON.stringify(protocolFixture()));
  const benignLoadout = [];
  const hostileLoadout = [{ slot: 0, protocolId: "temporal-edict", tier: 3 }];
  const benignLoan = null;
  const hostileLoan = { protocolId: "zeus-skyfire", tier: 3 };
  const target = source.state;
  target.protocolLoadout = benignLoadout;
  target.missionLoan = benignLoan;
  target.protocolRuntimes = [];
  const descriptorReads = { protocolLoadout: 0, missionLoan: 0 };
  const getReads = { protocolLoadout: 0, missionLoan: 0 };
  source.state = new Proxy(target, {
    getOwnPropertyDescriptor: function (object, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
      if (key === "protocolLoadout" || key === "missionLoan") {
        descriptorReads[key] += 1;
        if (descriptorReads[key] > 1) descriptor.value = key === "missionLoan" ? hostileLoan : hostileLoadout;
      }
      return descriptor;
    },
    get: function (object, key, receiver) {
      if (key === "protocolLoadout" || key === "missionLoan") {
        getReads[key] += 1;
        if (getReads[key] > 1) return key === "missionLoan" ? hostileLoan : hostileLoadout;
        return key === "missionLoan" ? benignLoan : benignLoadout;
      }
      return Reflect.get(object, key, receiver);
    },
  });
  const model = PlayerUi.createProtocolTray(source);
  assert.deepEqual(descriptorReads, { protocolLoadout: 1, missionLoan: 1 }, "each field is read exactly once");
  assert.deepEqual(getReads, { protocolLoadout: 0, missionLoan: 0 }, "projection never re-reads through get");
  assert.deepEqual(model.protocolSlots.map(function (card) { return [card.kind, card.tier]; }),
    [["empty", null], ["empty", null]]);
  assert.equal(model.tutorialLoan, null);
});
