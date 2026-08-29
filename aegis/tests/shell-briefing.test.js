"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const Shell = require("../js/delivery/shell.js");
const Profile = require("../js/progression/profile-v2.js");
const Progression = require("../js/progression/progression.js");

/* ---------------------------------------------------------------- fixtures */

function group(id, unitId, count, routeId, firstTick, spawnKind) {
  const record = {
    id, count, routeId, firstTick, intervalTicks: 18,
    spawnKind: spawnKind || "enemy", order: 0, modifierIds: [],
  };
  if (spawnKind === "boss") record.bossId = unitId;
  else record.enemyId = unitId;
  return record;
}

const WAVES = [
  { id: "w1", index: 1, titleKey: "wave.1.title", groups: [group("g0", "scout", 3, "route.main", 0)] },
  {
    id: "w2", index: 2, titleKey: "wave.2.title",
    groups: [group("g1", "raider", 6, "route.main", 90), group("g2", "harpy", 9, "route.sky", 180)],
  },
  { id: "w3", index: 3, titleKey: "wave.3.title", groups: [group("g3", "scout", 5, "route.main", 30)] },
  {
    id: "w4", index: 4, titleKey: "wave.4.title",
    groups: [group("g4", "talos-prototype", 1, "route.main", 0, "boss")],
  },
];

function fixtureContent(missionOverrides) {
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
    defenses: {
      sentinel: {
        id: "sentinel", nameKey: "defense.sentinel.name", roleKey: "defense.sentinel.role",
        weaknessKey: "defense.sentinel.weakness", targetKinds: ["ground"],
        levels: [{ level: 1, purchase: { kind: "build", costAether: 60 }, rangeWorldUnits: 22000, behaviors: [] }],
      },
      chronos: {
        id: "chronos", nameKey: "defense.chronos.name", roleKey: "defense.chronos.role",
        weaknessKey: "defense.chronos.weakness", targetKinds: ["ground"],
        levels: [{ level: 1, purchase: { kind: "build", costAether: 75 }, rangeWorldUnits: 20000, behaviors: [] }],
      },
      siege: {
        id: "siege", nameKey: "defense.siege.name", roleKey: "defense.siege.role",
        weaknessKey: "defense.siege.weakness", targetKinds: ["ground"],
        levels: [{ level: 1, purchase: { kind: "build", costAether: 90 }, rangeWorldUnits: 26000, behaviors: [] }],
      },
    },
    enemies: {
      scout: { id: "scout", nameKey: "enemy.scout.name", routeKinds: ["ground"], traits: [], tags: ["swift"], resistances: [] },
      raider: { id: "raider", nameKey: "enemy.raider.name", routeKinds: ["ground"], traits: ["armored"], tags: [], resistances: ["kinetic"] },
      harpy: { id: "harpy", nameKey: "enemy.harpy.name", routeKinds: ["air"], traits: ["flying"], tags: [], resistances: [] },
    },
    bosses: {
      "talos-prototype": {
        id: "talos-prototype", nameKey: "boss.talos.name", descriptionKey: "boss.talos.description",
        routeKinds: ["ground"],
        phaseRecords: [
          { id: "sealed", order: 0, hpLowerInclusiveBp: 5001, hpUpperInclusiveBp: 10000 },
          { id: "exposed-core", order: 1, hpLowerInclusiveBp: 1, hpUpperInclusiveBp: 5000 },
        ],
      },
    },
    protocols: {
      "temporal-edict": {
        id: "temporal-edict", nameKey: "protocol.temporal-edict.name",
        castPolicyId: "repeat-surcharge", targetKind: "none",
        tiers: [{
          tier: 1, baseCostAether: 75, cooldownMs: 80000,
          incrementalLaurels: 0, cumulativeLaurels: 0, maximumAcceptedCasts: null,
          effect: { kind: "global-slow", durationMs: 10000 },
        }],
      },
    },
    relics: {},
    reinforcements: {},
    missions: {
      m01: Object.assign({
        id: "m01",
        actIndex: 1,
        mapId: "m01",
        titleKey: "mission.m01.title",
        availableDefenseIds: ["chronos", "sentinel", "siege"],
        tutorial: { upgradeGateMode: "m01-wave1" },
        briefing: {
          summaryKey: "mission.m01.summary",
          objectiveKey: "mission.m01.objective",
          routeNoticeKeys: ["mission.m01.route"],
          mechanicNoticeKeys: ["mission.m01.mechanic"],
        },
        objectives: [
          { id: "victory", titleKey: "objective.victory.title", descriptionKey: "objective.victory.description" },
          { id: "integrity", titleKey: "objective.integrity.title", descriptionKey: "objective.integrity.description" },
          { id: "mastery", titleKey: "objective.mastery.title", descriptionKey: "objective.mastery.description" },
        ],
        waves: WAVES,
        protocolLoan: null,
      }, missionOverrides || {}),
    },
  };
}

const PRESENTATION = {
  strings: [
    { key: "mission.m01.title", value: "Gate of Dawn" },
    { key: "mission.m01.summary", value: "Hold the eastern gate through four waves." },
    { key: "mission.m01.objective", value: "Finish with the gate above the threshold." },
    { key: "mission.m01.route", value: "One road enters from the east." },
    { key: "mission.m01.mechanic", value: "Upgrades unlock after wave one." },
    { key: "map.m01.name", value: "Gate of Dawn Terrace" },
    { key: "defense.sentinel.name", value: "Sentinel" },
    { key: "defense.chronos.name", value: "Chronos" },
    { key: "defense.siege.name", value: "Siege" },
    { key: "enemy.scout.name", value: "Scout" },
    { key: "enemy.raider.name", value: "Raider" },
    { key: "enemy.harpy.name", value: "Harpy" },
    { key: "boss.talos.name", value: "Talos Prototype" },
    { key: "boss.talos.description", value: "A bronze automaton that exposes its core." },
    { key: "objective.victory.title", value: "Win the mission" },
    { key: "objective.integrity.title", value: "Keep the gate above 15" },
    { key: "objective.mastery.title", value: "Field the featured defense" },
    { key: "protocol.temporal-edict.name", value: "Temporal Edict" },
    { key: "wave.1.title", value: "First Footsteps" },
    { key: "wave.2.title", value: "Skyward" },
    { key: "wave.3.title", value: "Second Column" },
    { key: "wave.4.title", value: "Bronze Warden" },
    { key: "route.m01.route.main", value: "East Road" },
    { key: "route.m01.route.sky", value: "Sky Lane" },
  ],
};

function catalogFor(content) {
  return Shell.createCatalog({ content: content || fixtureContent(), presentation: PRESENTATION });
}

function profileWithRecon(tier) {
  let profile = Profile.createProfileV2("candidate-v4");
  const missionsByTier = { 1: 6, 2: 14, 3: 18 };
  const limit = missionsByTier[tier];
  if (!limit) return profile;
  for (let index = 1; index <= limit; index += 1) {
    profile = Progression.planApplyMissionFirstClear(profile, "m" + String(index).padStart(2, "0")).profile;
  }
  return profile;
}

function briefing(catalog, profile, content, extra) {
  let state = Shell.createInitialState({ catalog, profile });
  state = Shell.transition({ catalog, profile, state }, { type: "navigate", screen: "campaign" }).state;
  state = Shell.transition({ catalog, profile, state }, { type: "selectMission", missionId: "m01" }).state;
  state = Shell.transition({ catalog, profile, state }, { type: "openBriefing" }).state;
  return Shell.selectBriefingScreen(Object.assign({
    catalog, profile, state,
    waves: (content || fixtureContent()).missions.m01.waves,
    ticksPerSecond: 60,
  }, extra || {}));
}

/* ------------------------------------------------------------------- tests */

test("the briefing names the mission, act, environment, objectives, and loadout", () => {
  const catalog = catalogFor();
  const model = briefing(catalog, Profile.createProfileV2("candidate-v4"));
  assert.equal(model.heading, "Mission 1 - Gate of Dawn");
  assert.equal(model.actTitle, "Act I");
  assert.equal(model.environmentLabel, "Gate of Dawn Terrace");
  assert.equal(model.summary, "Hold the eastern gate through four waves.");
  assert.equal(model.objectiveText, "Finish with the gate above the threshold.");
  assert.deepEqual(model.routeNotices, ["One road enters from the east."]);
  assert.deepEqual(model.mechanicNotices, ["Upgrades unlock after wave one."]);
  assert.equal(model.waveCount, 4);
  assert.equal(model.difficulty.label, "Strategos");
  assert.equal(model.difficulty.gateHealth, 20);
  assert.deepEqual(model.loadoutNames, ["Chronos", "Sentinel", "Siege"]);
  assert.deepEqual(model.laurelTargets.map((target) => [target.title, target.earned]), [
    ["Win the mission", false],
    ["Keep the gate above 15", false],
    ["Field the featured defense", false],
  ]);
  assert.equal(Object.isFrozen(model), true);
});

test("baseline Recon always shows routes, enemy types, traits, air or ground, and boss phases", () => {
  const catalog = catalogFor();
  const model = briefing(catalog, Profile.createProfileV2("candidate-v4"));
  const preview = model.wavePreview;
  assert.equal(preview.reconTier, 0);
  assert.equal(preview.reconLabel, "Baseline scouting");
  assert.equal(preview.waves.length, 4);
  preview.waves.forEach((wave) => {
    assert.equal(wave.detailLevel, "baseline");
    assert.equal(wave.routes.length > 0, true);
    wave.groups.forEach((entry) => {
      assert.equal(typeof entry.unitName, "string");
      assert.equal(entry.unitName.length > 0, true);
      assert.equal(["air", "ground"].includes(entry.movement), true);
      assert.equal(entry.exactCount, null, "baseline never reveals an exact count");
      assert.equal(entry.firstSpawnSecondBand, null, "baseline never reveals timing");
      assert.equal(typeof entry.relativeSize, "string");
    });
  });
  const skyward = preview.waves[1];
  assert.deepEqual(skyward.routes, ["East Road", "Sky Lane"]);
  assert.deepEqual(skyward.movementKinds, ["air", "ground"]);
  assert.deepEqual(skyward.groups.map((entry) => entry.traits), [["armored"], ["flying"]]);
  assert.deepEqual(skyward.groups.map((entry) => entry.relativeSize), ["medium group", "large group"]);
  assert.deepEqual(skyward.groups[0].resistances, ["kinetic"]);

  const boss = preview.waves[3].boss;
  assert.equal(boss.name, "Talos Prototype");
  assert.deepEqual(boss.phaseText, [
    "Sealed from 100% down to 50% health",
    "Exposed Core from 50% down to 0% health",
  ]);
});

test("Recon I reveals exact counts and routes for the next wave only", () => {
  const catalog = catalogFor();
  const model = briefing(catalog, profileWithRecon(1));
  const preview = model.wavePreview;
  assert.equal(preview.reconTier, 1);
  assert.equal(preview.reconLabel, "Recon I");
  assert.deepEqual(preview.waves.map((wave) => wave.detailLevel),
    ["counts", "baseline", "baseline", "baseline"]);
  assert.equal(preview.waves[0].groups[0].exactCount, 3);
  assert.equal(preview.waves[0].groups[0].firstSpawnSecondBand, null,
    "Recon I adds counts and routes, never spawn timing");
  assert.equal(preview.waves[1].groups[0].exactCount, null);
});

test("Recon II adds the next two waves and one-second spawn bands", () => {
  const catalog = catalogFor();
  const preview = briefing(catalog, profileWithRecon(2)).wavePreview;
  assert.equal(preview.reconTier, 2);
  assert.deepEqual(preview.waves.map((wave) => wave.detailLevel),
    ["timed", "timed", "baseline", "baseline"]);
  assert.equal(preview.waves[1].groups[0].exactCount, 6);
  assert.equal(preview.waves[1].groups[0].firstSpawnSecondBand, "1-2 s");
  assert.equal(preview.waves[1].groups[1].firstSpawnSecondBand, "3-4 s");
  assert.equal(preview.waves[2].groups[0].firstSpawnSecondBand, null);
});

test("Recon III reveals every remaining wave with counts, routes, and timing", () => {
  const catalog = catalogFor();
  const preview = briefing(catalog, profileWithRecon(3)).wavePreview;
  assert.equal(preview.reconTier, 3);
  assert.equal(preview.waves.every((wave) => wave.detailLevel === "timed"), true);
  assert.deepEqual(preview.waves.map((wave) => wave.groups[0].exactCount), [3, 6, 5, 1]);
  assert.equal(preview.waves[2].groups[0].firstSpawnSecondBand, "0-1 s");
});

test("Recon reveals only compiled wave data and never invents a group", () => {
  const content = fixtureContent();
  const catalog = catalogFor(content);
  const compiledUnitIds = [];
  content.missions.m01.waves.forEach((wave) => wave.groups.forEach((entry) => {
    compiledUnitIds.push(entry.enemyId || entry.bossId);
  }));
  [0, 1, 2, 3].forEach((tier) => {
    const preview = briefing(catalog, profileWithRecon(tier), content).wavePreview;
    const shown = [];
    preview.waves.forEach((wave) => wave.groups.forEach((entry) => shown.push(entry.unitId)));
    assert.deepEqual(shown, compiledUnitIds, "tier " + tier);
    preview.waves.forEach((wave, waveIndex) => {
      wave.groups.forEach((entry, groupIndex) => {
        const compiled = content.missions.m01.waves[waveIndex].groups[groupIndex];
        if (entry.exactCount !== null) assert.equal(entry.exactCount, compiled.count);
      });
    });
  });
});

test("a tutorial loan card explains the Tier 1 mission-local loan", () => {
  const content = fixtureContent({ protocolLoan: { protocolId: "temporal-edict", tier: 1 } });
  const model = briefing(catalogFor(content), Profile.createProfileV2("candidate-v4"), content);
  assert.equal(model.tutorialLoan.protocolId, "temporal-edict");
  assert.equal(model.tutorialLoan.name, "Temporal Edict");
  assert.equal(model.tutorialLoan.tier, 1);
  assert.match(model.tutorialLoan.text, /at Tier 1 in an extra slot/);
  assert.match(model.tutorialLoan.text, /cannot upgrade it during the run/);
  assert.match(model.tutorialLoan.text, /winning grants it for good/);

  const noLoan = briefing(catalogFor(), Profile.createProfileV2("candidate-v4"));
  assert.equal(noLoan.tutorialLoan, null);
});

test("the wave preview is presentation only and never reaches the run state", () => {
  const catalog = catalogFor();
  const preview = briefing(catalog, profileWithRecon(3)).wavePreview;
  const encoded = JSON.stringify(preview);
  ["tick", "rulesetHash", "runtimeId", "padQuality", "gridColumn", "seed"].forEach((token) => {
    assert.equal(encoded.includes(token), false, token);
  });
  assert.equal(Object.isFrozen(preview), true);
  assert.equal(Object.isFrozen(preview.waves[0]), true);
});

test("compiled string placeholders resolve and never reach a player as braces", () => {
  const content = fixtureContent();
  content.missions.m01.briefing.objectiveKey = "mission.m01.placeholder";
  content.missions.m01.objectives[0].descriptionKey = "objective.victory.placeholder";
  content.missions.m01.objectives[1].descriptionKey = "objective.integrity.placeholder";
  content.missions.m01.objectives[1].thresholdRecords = [
    { difficultyId: "story", minimumIntegrity: 20 },
    { difficultyId: "strategos", minimumIntegrity: 15 },
    { difficultyId: "titan", minimumIntegrity: 10 },
  ];
  content.missions.m01.objectives[2].predicate = { kind: "maximum-owned-towers-at-victory", maximum: 5 };
  content.missions.m01.objectives[2].descriptionKey = "objective.mastery.placeholder";
  const catalog = Shell.createCatalog({
    content,
    presentation: {
      strings: PRESENTATION.strings.concat([
        { key: "mission.m01.placeholder", value: "Hold the gate through {waveCount} waves." },
        { key: "objective.victory.placeholder", value: "Defeat every enemy in all {waveCount} waves." },
        { key: "objective.integrity.placeholder", value: "Finish with at least {minimumIntegrity} gate health." },
        { key: "objective.mastery.placeholder", value: "Win while owning no more than {maximumTowers} towers." },
        { key: "objective.unknown.placeholder", value: "Uses {unknownToken} here." },
      ]),
    },
  });
  const model = briefing(catalog, Profile.createProfileV2("candidate-v4"), content);
  assert.equal(model.objectiveText, "Hold the gate through 4 waves.");
  assert.deepEqual(model.laurelTargets.map((target) => target.description), [
    "Defeat every enemy in all 4 waves.",
    "Finish with at least 15 gate health.",
    "Win while owning no more than 5 towers.",
  ]);
  assert.equal(model.laurelTargets[1].minimumIntegrity, 15);
  const strings = [];
  (function collect(value) {
    if (typeof value === "string") { strings.push(value); return; }
    if (!value || typeof value !== "object") return;
    Object.keys(value).forEach((key) => collect(value[key]));
  })(model);
  strings.forEach((value) => {
    assert.equal(/\{[A-Za-z]/.test(value), false, "brace token survived into a player view: " + value);
  });
  assert.equal(
    Shell.createCatalog({
      content,
      presentation: { strings: [{ key: "mission.m01.title", value: "Uses {unknownToken} here." }] },
    }).missions.m01.title,
    "Uses here.",
    "an unsupplied token is dropped from every player-visible string, titles included"
  );
});

test("the wave preview clamps unknown Recon tiers and defaults its tick rate", () => {
  const catalog = catalogFor();
  const clamped = Shell.selectWavePreview({
    catalog, missionId: "m01", waves: WAVES, reconTier: 99,
  });
  assert.equal(clamped.reconTier, 3);
  const floor = Shell.selectWavePreview({
    catalog, missionId: "m01", waves: WAVES, reconTier: -4,
  });
  assert.equal(floor.reconTier, 0);
  assert.throws(() => Shell.selectWavePreview({ catalog, missionId: "m01", waves: null }),
    /requires the compiled wave list/);
  const empty = Shell.selectWavePreview({ catalog, missionId: "m01", waves: [], reconTier: 3 });
  assert.deepEqual(empty.waves, []);
});
