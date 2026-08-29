"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const Shell = require("../js/delivery/shell.js");
const SessionStore = require("../js/delivery/session-store.js");
const Profile = require("../js/progression/profile-v2.js");
const Progression = require("../js/progression/progression.js");

/* ---------------------------------------------------------------- fixtures */

function defense(id, costAether) {
  return {
    id,
    nameKey: "defense." + id + ".name",
    roleKey: "defense." + id + ".role",
    weaknessKey: "defense." + id + ".weakness",
    targetKinds: ["ground"],
    levels: [{ level: 1, purchase: { kind: "build", costAether }, rangeWorldUnits: 22000, behaviors: [] }],
  };
}

function protocolRecord(id, costs) {
  return {
    id,
    nameKey: "protocol." + id + ".name",
    castPolicyId: "repeat-surcharge",
    targetKind: "none",
    tiers: costs.map((baseCostAether, index) => ({
      tier: index + 1,
      baseCostAether,
      cooldownMs: 80000 + index * 10000,
      incrementalLaurels: index === 0 ? 0 : (index === 1 ? 6 : 12),
      cumulativeLaurels: index === 0 ? 0 : (index === 1 ? 6 : 18),
      maximumAcceptedCasts: null,
      effect: { kind: "global-slow", durationMs: 10000 + index * 2000 },
    })),
  };
}

function fixtureContent() {
  return {
    schemaVersion: 4,
    contentVersion: "candidate-v4",
    campaignRules: {
      difficultyPresets: [
        { id: "story", startAetherBp: 11900, integrity: 25, enemyHpBp: 8500, enemySpeedBp: 9500, bountyBp: 11000, scoreBp: 7500 },
        { id: "strategos", startAetherBp: 10000, integrity: 20, enemyHpBp: 10000, enemySpeedBp: 10000, bountyBp: 10000, scoreBp: 10000 },
        { id: "titan", startAetherBp: 9100, integrity: 15, enemyHpBp: 12500, enemySpeedBp: 10800, bountyBp: 10000, scoreBp: 15000 },
      ],
    },
    defenses: { chronos: defense("chronos", 75), sentinel: defense("sentinel", 60), siege: defense("siege", 90) },
    enemies: {},
    bosses: {},
    protocols: {
      "temporal-edict": protocolRecord("temporal-edict", [75, 115, 165]),
      "zeus-skyfire": protocolRecord("zeus-skyfire", [90, 135, 190]),
      "aegis-ward": protocolRecord("aegis-ward", [70, 105, 145]),
    },
    relics: {
      "bronze-obol": {
        id: "bronze-obol",
        nameKey: "relic.bronze-obol.name",
        benefitKey: "relic.bronze-obol.benefit",
        drawbackKey: "relic.bronze-obol.drawback",
      },
    },
    reinforcements: {
      "spartan-phalanx": {
        id: "spartan-phalanx",
        nameKey: "reinforcement.spartan-phalanx.name",
        costAether: 70,
        cooldownMs: 50000,
        lifetimeMs: 14000,
        markerKind: "reinforcement-block",
      },
    },
    missions: {
      m01: {
        id: "m01",
        actIndex: 1,
        mapId: "m01",
        titleKey: "mission.m01.title",
        availableDefenseIds: ["chronos", "sentinel", "siege"],
        tutorial: { upgradeGateMode: "m01-wave1" },
        briefing: {},
        objectives: [{ id: "victory", titleKey: "objective.victory.title" }],
        waves: [{ id: "w1", index: 1, titleKey: "wave.1.title", groups: [] }],
        protocolLoan: null,
      },
    },
  };
}

const PRESENTATION = {
  strings: [
    { key: "mission.m01.title", value: "Gate of Dawn" },
    { key: "defense.sentinel.name", value: "Sentinel" },
    { key: "defense.chronos.name", value: "Chronos" },
    { key: "defense.siege.name", value: "Siege" },
    { key: "protocol.temporal-edict.name", value: "Temporal Edict" },
    { key: "protocol.zeus-skyfire.name", value: "Zeus Protocol: Skyfire" },
    { key: "protocol.aegis-ward.name", value: "Aegis Ward" },
    { key: "relic.bronze-obol.name", value: "Bronze Obol" },
    { key: "relic.bronze-obol.benefit", value: "Start with 25 more Aether." },
    { key: "relic.bronze-obol.drawback", value: "Earn 15% less bounty." },
    { key: "reinforcement.spartan-phalanx.name", value: "Spartan Phalanx" },
  ],
};

function catalog() {
  return Shell.createCatalog({ content: fixtureContent(), presentation: PRESENTATION });
}

/* A profile that owns Protocols, a Relic slot, a reinforcement, and Laurels. */
function unlockedProfile(laurelMissionIds) {
  let profile = Profile.createProfileV2("candidate-v4");
  for (let index = 1; index <= 12; index += 1) {
    const missionId = "m" + String(index).padStart(2, "0");
    profile = Progression.planApplyMissionFirstClear(profile, missionId).profile;
  }
  (laurelMissionIds || []).forEach((missionId) => {
    ["story", "strategos", "titan"].forEach((difficultyId) => {
      const source = JSON.parse(JSON.stringify(profile));
      ["integrity", "mastery", "victory"].forEach((objectiveId) => {
        const laurelId = Profile.makeLaurelId(missionId, difficultyId, objectiveId);
        if (source.earnedLaurelIds.indexOf(laurelId) === -1) source.earnedLaurelIds.push(laurelId);
      });
      source.earnedLaurelIds.sort();
      profile = Profile.validateProfileV2(source);
    });
  });
  return profile;
}

function loadoutState(catalogValue, profile) {
  let state = Shell.createInitialState({ catalog: catalogValue, profile });
  state = Shell.transition({ catalog: catalogValue, profile, state },
    { type: "navigate", screen: "campaign" }).state;
  return Shell.transition({ catalog: catalogValue, profile, state },
    { type: "selectMission", missionId: "m01" }).state;
}

/* ------------------------------------------------------------------- tests */

test("the loadout screen shows four named sections with slot counts and unlock sources", () => {
  const catalogValue = catalog();
  const profile = unlockedProfile();
  const model = Shell.selectLoadoutScreen({
    catalog: catalogValue, profile, state: loadoutState(catalogValue, profile),
  });
  assert.deepEqual(model.sections.map((section) => [section.id, section.title, section.slotCap]), [
    ["towers", "Towers", 6],
    ["protocols", "Divine Protocols", 2],
    ["relics", "Relics", 1],
    ["reinforcement", "Reinforcement", 1],
  ]);
  model.sections.forEach((section) => {
    assert.equal(typeof section.unlockSource, "string");
    assert.equal(section.unlockSource.length > 0, true);
    assert.equal(section.clearLabel, "Clear " + section.title);
    assert.equal(section.minimumTargetSizePx >= 44, true);
  });
});

test("tower cards state their exact price, role, status, and lock reason", () => {
  const catalogValue = catalog();
  const profile = Profile.createProfileV2("candidate-v4");
  const model = Shell.selectLoadoutScreen({
    catalog: catalogValue, profile, state: loadoutState(catalogValue, profile),
  });
  const sentinel = model.towers.find((card) => card.id === "sentinel");
  assert.equal(sentinel.costAether, 60);
  assert.equal(sentinel.status, "equipped");
  assert.match(sentinel.ariaLabel, /60 Aether to build/);
  assert.equal(model.towers.every((card) => card.inspectable), true, "locked cards stay inspectable");
  assert.equal(model.ready, true);
  assert.equal(model.readyReason, null);
});

test("a Protocol equip goes through the progression planner and never mutates the profile", () => {
  const before = unlockedProfile();
  const frozenCopy = JSON.stringify(before);
  const plan = Shell.planLoadoutEdit(before, {
    kind: "setProtocolLoadout",
    loadout: [{ slot: 0, protocolId: "temporal-edict", tier: 1 }],
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.changed, true);
  assert.deepEqual(plan.profile.protocolLoadout, [{ slot: 0, protocolId: "temporal-edict", tier: 1 }]);
  assert.equal(JSON.stringify(before), frozenCopy, "the planner input is never mutated");
  assert.notStrictEqual(plan.profile, before);
});

test("an illegal Protocol loadout is refused with the planner's own reason", () => {
  const profile = unlockedProfile();
  const overCap = Shell.planLoadoutEdit(profile, {
    kind: "setProtocolLoadout",
    loadout: [
      { slot: 0, protocolId: "temporal-edict", tier: 1 },
      { slot: 1, protocolId: "zeus-skyfire", tier: 1 },
      { slot: 2, protocolId: "aegis-ward", tier: 1 },
    ],
  });
  assert.equal(overCap.ok, false);
  assert.equal(overCap.changed, false);
  assert.strictEqual(overCap.profile, profile);
  const duplicate = Shell.planLoadoutEdit(profile, {
    kind: "setProtocolLoadout",
    loadout: [
      { slot: 0, protocolId: "temporal-edict", tier: 1 },
      { slot: 1, protocolId: "temporal-edict", tier: 1 },
    ],
  });
  assert.equal(duplicate.ok, false);
  const unknownEdit = Shell.planLoadoutEdit(profile, { kind: "teleport" });
  assert.equal(unknownEdit.ok, false);
  assert.equal(unknownEdit.reason, Shell.REASONS["action-unknown"]);
});

test("Relic and reinforcement edits round trip through the planners", () => {
  let profile = unlockedProfile();
  const relic = Shell.planLoadoutEdit(profile, { kind: "setRelicLoadout", relicIds: ["bronze-obol"] });
  assert.equal(relic.ok, true);
  assert.deepEqual(relic.profile.relicLoadoutIds, ["bronze-obol"]);
  profile = relic.profile;
  const cleared = Shell.planLoadoutEdit(profile, { kind: "clearRelics" });
  assert.deepEqual(cleared.profile.relicLoadoutIds, []);

  const reinforcement = Shell.planLoadoutEdit(profile, {
    kind: "setReinforcement", reinforcementId: "spartan-phalanx",
  });
  assert.equal(reinforcement.ok, true);
  assert.equal(reinforcement.profile.reinforcementId, "spartan-phalanx");
  const dropped = Shell.planLoadoutEdit(reinforcement.profile, { kind: "clearReinforcement" });
  assert.equal(dropped.profile.reinforcementId, null);
});

test("Laurel allocation costs 6 then 12 and previews the resulting cast cost", () => {
  let profile = unlockedProfile(["m01", "m02"]);
  const budget = Profile.getLaurelBudget(profile);
  assert.equal(budget.earned, 18);
  assert.equal(budget.available, 18);

  const first = Shell.planLoadoutEdit(profile, {
    kind: "allocateProtocolTier", protocolId: "temporal-edict",
  });
  assert.equal(first.ok, true);
  assert.match(first.notes[0], /Tier 2 unlocked for 6 Laurels/);
  profile = first.profile;
  assert.equal(Profile.getLaurelBudget(profile).available, 12);

  const second = Shell.planLoadoutEdit(profile, {
    kind: "allocateProtocolTier", protocolId: "temporal-edict",
  });
  assert.match(second.notes[0], /Tier 3 unlocked for 12 Laurels/);
  profile = second.profile;
  assert.equal(Profile.getLaurelBudget(profile).available, 0);

  const panel = Shell.selectLoadoutScreen({
    catalog: catalog(), profile, state: loadoutState(catalog(), profile),
  }).protocols.find((entry) => entry.protocolId === "temporal-edict");
  assert.equal(panel.availableTier, 3);
  assert.equal(panel.currentCostAether, 165);
  assert.equal(panel.canAllocate, false);
  assert.equal(panel.allocateCostLaurels, null);
  assert.equal(panel.canRefund, true);
  assert.equal(panel.refundLaurels, 12);

  const exhausted = Shell.planLoadoutEdit(profile, {
    kind: "allocateProtocolTier", protocolId: "zeus-skyfire",
  });
  assert.equal(exhausted.ok, false);
  assert.match(exhausted.reason, /Insufficient available Laurels/);
});

test("a refund that lowers an equipped tier states exactly what changed", () => {
  let profile = unlockedProfile(["m01", "m02"]);
  profile = Shell.planLoadoutEdit(profile, {
    kind: "allocateProtocolTier", protocolId: "temporal-edict",
  }).profile;
  profile = Shell.planLoadoutEdit(profile, {
    kind: "setProtocolLoadout",
    loadout: [{ slot: 0, protocolId: "temporal-edict", tier: 2 }],
  }).profile;
  const warned = Shell.selectLoadoutScreen({
    catalog: catalog(), profile, state: loadoutState(catalog(), profile),
  }).protocols.find((entry) => entry.protocolId === "temporal-edict");
  assert.match(warned.refundWarning, /lowers your equipped Temporal Edict to Tier 1/);

  const refund = Shell.planLoadoutEdit(profile, {
    kind: "refundProtocolTier", protocolId: "temporal-edict",
  });
  assert.equal(refund.ok, true);
  assert.match(refund.notes[0], /returned to Tier 1\. 6 Laurels are available again/);
  assert.match(refund.notes[1], /Equipped Temporal Edict in slot 1 dropped from Tier 2 to Tier 1/);
  assert.deepEqual(refund.profile.protocolLoadout, [{ slot: 0, protocolId: "temporal-edict", tier: 1 }]);
  assert.equal(Profile.getLaurelBudget(refund.profile).available, 18);
});

test("Tier 1 is free and cannot be refunded", () => {
  const profile = unlockedProfile();
  const refused = Shell.planLoadoutEdit(profile, {
    kind: "refundProtocolTier", protocolId: "temporal-edict",
  });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /Tier 1 is free/);
  const locked = Shell.planLoadoutEdit(profile, {
    kind: "allocateProtocolTier", protocolId: "hades-bargain",
  });
  assert.equal(locked.ok, false);
  assert.match(locked.reason, /not granted/);
});

test("every loadout edit survives a persistence round trip through the store", async () => {
  const store = SessionStore.openSessionProfileStore({ namespace: "aegis-candidate-v4:profile" });
  let profile = unlockedProfile(["m01"]);
  const written = await store.writeProfile(profile, { kind: "bootstrap" });
  assert.equal(written.ok, true);

  const allocation = Shell.planLoadoutEdit(profile, {
    kind: "allocateProtocolTier", protocolId: "temporal-edict",
  });
  assert.equal(allocation.ok, true);
  await store.writeProfile(allocation.profile, { kind: "allocateProtocolTier" });

  const equip = Shell.planLoadoutEdit(allocation.profile, {
    kind: "setProtocolLoadout",
    loadout: [{ slot: 0, protocolId: "temporal-edict", tier: 2 }],
  });
  await store.writeProfile(equip.profile, { kind: "setProtocolLoadout" });

  const readBack = await store.readProfile();
  assert.equal(readBack.ok, true);
  const restored = Profile.validateProfileV2(readBack.value);
  assert.deepEqual(restored.protocolLoadout, [{ slot: 0, protocolId: "temporal-edict", tier: 2 }]);
  assert.equal(restored.protocols.find((record) => record.id === "temporal-edict").availableTier, 2);
  assert.equal(Profile.getLaurelBudget(restored).available, 3);
  profile = restored;

  const closed = await store.close();
  assert.equal(closed.ok, true);
  await assert.rejects(async () => { await store.readProfile(); }, /session store is closed/);
});

test("the loadout screen surfaces every Laurel total and difficulty tradeoff explicitly", () => {
  const catalogValue = catalog();
  const profile = unlockedProfile(["m01"]);
  const model = Shell.selectLoadoutScreen({
    catalog: catalogValue, profile, state: loadoutState(catalogValue, profile),
  });
  assert.equal(model.laurels.earned, 9);
  assert.equal(model.laurels.allocated, 0);
  assert.equal(model.laurels.available, 9);
  assert.deepEqual(model.difficulties.map((entry) => entry.id), ["story", "strategos", "titan"]);
  const story = model.difficulties[0];
  assert.equal(story.startAetherPercent, 119);
  assert.equal(story.gateHealth, 25);
  assert.equal(story.enemyHealthPercent, 85);
  assert.equal(story.scorePercent, 75);
  assert.match(story.ariaLabel, /Starting Aether 119 percent/);
  assert.match(model.assistText, /20 starting Aether/);
});

test("training marks its loadout as a trial and offers every defense in the build", () => {
  const catalogValue = catalog();
  const profile = Profile.createProfileV2("candidate-v4");
  let state = Shell.createInitialState({ catalog: catalogValue, profile });
  state = Shell.transition({ catalog: catalogValue, profile, state },
    { type: "navigate", screen: "training" }).state;
  state = Shell.transition({ catalog: catalogValue, profile, state },
    { type: "selectMission", missionId: "m01" }).state;
  const model = Shell.selectLoadoutScreen({ catalog: catalogValue, profile, state });
  assert.equal(model.trial, true);
  assert.match(model.trialNotice, /never changes campaign progress/);
  assert.equal(model.sections[0].slotCap, 6);
  assert.equal(model.towers.every((card) => card.status !== "locked"), true);
});
