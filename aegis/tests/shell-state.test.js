"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Shell = require("../js/delivery/shell.js");
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
    levels: [
      { level: 1, purchase: { kind: "build", costAether }, rangeWorldUnits: 22000, behaviors: [] },
      { level: 2, purchase: { kind: "upgrade", costAether: costAether + 20 }, rangeWorldUnits: 24000, behaviors: [] },
    ],
  };
}

function wave(index, groups, titleKey) {
  return { id: "w" + index, index, titleKey, groups, waveClearScore: 100 };
}

function group(id, enemyId, count, routeId, firstTick, spawnKind) {
  return {
    id, enemyId, count, routeId, firstTick,
    intervalTicks: 18, spawnKind: spawnKind || "enemy", order: 0, modifierIds: [],
  };
}

function mission(id, actIndex, extra) {
  return Object.assign({
    id,
    actIndex,
    missionIndex: Number(id.slice(1)),
    mapId: id,
    titleKey: "mission." + id + ".title",
    availableDefenseIds: ["chronos", "hoplite", "sentinel", "siege"],
    tutorial: { upgradeGateMode: id === "m01" ? "m01-wave1" : "none" },
    briefing: {
      summaryKey: "mission." + id + ".summary",
      objectiveKey: "mission." + id + ".objective",
      routeNoticeKeys: ["mission." + id + ".route"],
      mechanicNoticeKeys: [],
    },
    objectives: [
      { id: "victory", titleKey: "objective.victory.title", descriptionKey: "objective.victory.description" },
      { id: "integrity", titleKey: "objective.integrity.title", descriptionKey: "objective.integrity.description" },
      { id: "mastery", titleKey: "objective.mastery.title", descriptionKey: "objective.mastery.description" },
    ],
    waves: [
      wave(1, [group("g0", "scout", 6, "route.main", 0)], "wave.1.title"),
      wave(2, [group("g1", "raider", 3, "route.main", 60), group("g2", "harpy", 2, "route.sky", 120)],
        "wave.2.title"),
      wave(3, [group("g3", "talos-prototype", 1, "route.main", 0, "boss")], "wave.3.title"),
    ],
    protocolLoan: null,
  }, extra || {});
}

function fixtureContent(overrides) {
  return Object.assign({
    schemaVersion: 4,
    contentVersion: "candidate-v4",
    defenseUnlockGrantMappings: [
      { defenseId: "chronos", accessGrantId: "campaign.chronos" },
      { defenseId: "hoplite", accessGrantId: "campaign.hoplite" },
      { defenseId: "sentinel", accessGrantId: "campaign.sentinel" },
      { defenseId: "siege", accessGrantId: "campaign.siege" },
    ],
    campaignRules: {
      difficultyPresets: [
        { id: "story", startAetherBp: 11900, integrity: 25, enemyHpBp: 8500, enemySpeedBp: 9500, bountyBp: 11000, scoreBp: 7500 },
        { id: "strategos", startAetherBp: 10000, integrity: 20, enemyHpBp: 10000, enemySpeedBp: 10000, bountyBp: 10000, scoreBp: 10000 },
        { id: "titan", startAetherBp: 9100, integrity: 15, enemyHpBp: 12500, enemySpeedBp: 10800, bountyBp: 10000, scoreBp: 15000 },
      ],
    },
    defenses: {
      chronos: defense("chronos", 75),
      hoplite: defense("hoplite", 80),
      sentinel: defense("sentinel", 60),
      siege: defense("siege", 90),
    },
    enemies: {
      scout: { id: "scout", nameKey: "enemy.scout.name", routeKinds: ["ground"], traits: [], tags: ["swift"], resistances: [] },
      raider: { id: "raider", nameKey: "enemy.raider.name", routeKinds: ["ground"], traits: ["armored"], tags: [], resistances: [] },
      harpy: { id: "harpy", nameKey: "enemy.harpy.name", routeKinds: ["air"], traits: ["flying"], tags: [], resistances: [] },
    },
    bosses: {
      "talos-prototype": {
        id: "talos-prototype",
        nameKey: "boss.talos.name",
        descriptionKey: "boss.talos.description",
        routeKinds: ["ground"],
        phaseRecords: [
          { id: "sealed", order: 0, hpLowerInclusiveBp: 5001, hpUpperInclusiveBp: 10000 },
          { id: "exposed-core", order: 1, hpLowerInclusiveBp: 1, hpUpperInclusiveBp: 5000 },
        ],
      },
    },
    missions: { m01: mission("m01", 1), m02: mission("m02", 1), m03: mission("m03", 1) },
    protocols: {},
    relics: {},
    reinforcements: {},
  }, overrides || {});
}

const PRESENTATION = {
  strings: [
    { key: "mission.m01.title", value: "Gate of Dawn" },
    { key: "mission.m02.title", value: "Olive Terraces" },
    { key: "mission.m03.title", value: "Marble Quarry" },
    { key: "mission.m01.summary", value: "Teach the gate." },
    { key: "mission.m01.objective", value: "Survive six waves." },
    { key: "mission.m01.route", value: "One road enters from the east." },
    { key: "defense.sentinel.name", value: "Sentinel" },
    { key: "defense.chronos.name", value: "Chronos" },
    { key: "defense.siege.name", value: "Siege" },
    { key: "defense.hoplite.name", value: "Hoplite" },
    { key: "defense.sentinel.role", value: "Reliable single-target damage." },
    { key: "enemy.scout.name", value: "Scout" },
    { key: "enemy.raider.name", value: "Raider" },
    { key: "enemy.harpy.name", value: "Harpy" },
    { key: "boss.talos.name", value: "Talos Prototype" },
    { key: "boss.talos.description", value: "A bronze automaton with exposed-core phases." },
    { key: "objective.victory.title", value: "Win the mission" },
    { key: "objective.integrity.title", value: "Keep the gate above the threshold" },
    { key: "objective.mastery.title", value: "Field the featured defense" },
    { key: "wave.1.title", value: "First Footsteps" },
    { key: "wave.2.title", value: "Skyward" },
    { key: "wave.3.title", value: "Bronze Warden" },
  ],
};

function catalogFor(content) {
  return Shell.createCatalog({ content: content || fixtureContent(), presentation: PRESENTATION });
}

function completedProfile(missionIds) {
  let profile = Profile.createProfileV2("candidate-v4");
  missionIds.forEach((missionId) => {
    profile = Progression.planApplyMissionFirstClear(profile, missionId).profile;
  });
  return profile;
}

function drive(catalog, profile, actions, startState) {
  let state = startState || Shell.createInitialState({ catalog, profile });
  const results = [];
  actions.forEach((action) => {
    const result = Shell.transition({ catalog, profile, state }, action);
    results.push(result);
    state = result.state;
  });
  return { state, results, last: results[results.length - 1] };
}

/* ------------------------------------------------------------------- tests */

test("the catalog orders shipped missions by campaign order and groups them into acts", () => {
  const catalog = catalogFor();
  assert.deepEqual(catalog.missionIds, ["m01", "m02", "m03"]);
  assert.equal(catalog.acts.length, 1);
  assert.deepEqual(catalog.acts[0].missionIds, ["m01", "m02", "m03"]);
  assert.equal(catalog.missions.m01.title, "Gate of Dawn");
  assert.equal(catalog.abiVersion, 2);
  assert.equal(Object.isFrozen(catalog), true);
  assert.throws(() => Shell.createCatalog({ content: { missions: {} } }), /at least one campaign mission/);
});

test("the initial state starts on the title screen with Strategos and no run", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  const state = Shell.createInitialState({ catalog, profile });
  assert.equal(state.screen, "title");
  assert.equal(state.mode, "campaign");
  assert.equal(state.difficultyId, "strategos");
  assert.equal(state.missionId, null);
  assert.equal(state.runHeader, null);
  assert.equal(state.storageKind, "session");
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.settings), true);
});

test("title reaches every hub screen and refuses screens it does not connect to", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  assert.deepEqual(Shell.HUB_SCREENS, ["campaign", "training", "settings"]);
  const title = Shell.selectTitleScreen({
    catalog, profile, state: Shell.createInitialState({ catalog, profile }),
  });
  assert.deepEqual(title.destinations.map((destination) => destination.label), [
    "Campaign", "Training Courtyard", "Settings",
  ]);
  Shell.HUB_SCREENS.forEach((screen) => {
    const run = drive(catalog, profile, [{ type: "navigate", screen }]);
    assert.equal(run.last.ok, true, screen);
    assert.equal(run.state.screen, screen);
  });
  const refused = drive(catalog, profile, [{ type: "navigate", screen: "battle" }]);
  assert.equal(refused.last.ok, false);
  assert.equal(refused.last.reasonCode, "screen-transition-not-allowed");
  assert.equal(refused.state.screen, "title");
  const unknown = drive(catalog, profile, [{ type: "navigate", screen: "shop" }]);
  assert.equal(unknown.last.reasonCode, "screen-unknown");
  const removedCodex = drive(catalog, profile, [{ type: "navigate", screen: "codex" }]);
  assert.equal(removedCodex.last.reasonCode, "screen-unknown");
});

test("campaign to loadout to briefing to battle to result to campaign is the whole loop", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  const run = drive(catalog, profile, [
    { type: "navigate", screen: "campaign" },
    { type: "selectMission", missionId: "m01" },
    { type: "openBriefing" },
  ]);
  assert.deepEqual(run.results.map((result) => result.ok), [true, true, true]);
  assert.equal(run.state.screen, "briefing");
  const header = {
    formatVersion: 1, missionId: "m01", difficultyId: "strategos", assist: false, seed: 1,
  };
  const started = Shell.transition({ catalog, profile, state: run.state }, { type: "startRun", header });
  assert.equal(started.ok, true);
  assert.equal(started.state.screen, "battle");
  assert.strictEqual(started.state.runHeader.missionId, "m01");
  const finished = Shell.transition({ catalog, profile, state: started.state }, {
    type: "finishRun",
    result: { outcome: "victory", missionId: "m01", difficultyId: "strategos", score: 100 },
  });
  assert.equal(finished.state.screen, "result");
  const continued = Shell.transition({ catalog, profile, state: finished.state }, { type: "continue" });
  assert.equal(continued.state.screen, "campaign");
  assert.equal(continued.state.runHeader, null);
  assert.equal(continued.state.result, null);
});

test("a run header is built once and cannot be replaced or re-chosen mid run", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  const run = drive(catalog, profile, [
    { type: "navigate", screen: "campaign" },
    { type: "selectMission", missionId: "m01" },
    { type: "openBriefing" },
    { type: "startRun", header: { formatVersion: 1, missionId: "m01", difficultyId: "strategos", assist: false, seed: 1 } },
  ]);
  assert.equal(run.state.screen, "battle");
  const again = Shell.transition({ catalog, profile, state: run.state }, {
    type: "startRun",
    header: { formatVersion: 1, missionId: "m01", difficultyId: "strategos", assist: false, seed: 2 },
  });
  assert.equal(again.ok, false);
  assert.equal(again.reasonCode, "screen-transition-not-allowed");
  ["setDifficulty", "setAssist", "setSeed"].forEach((type) => {
    const action = type === "setDifficulty" ? { type, difficultyId: "story" }
      : (type === "setAssist" ? { type, assist: true } : { type, seed: 9 });
    const blocked = Shell.transition({ catalog, profile, state: run.state }, action);
    assert.equal(blocked.ok, false, type);
    assert.equal(blocked.reasonCode, "run-already-started", type);
  });
});

test("a run header that disagrees with the chosen mission is refused with a plain reason", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  const run = drive(catalog, profile, [
    { type: "navigate", screen: "campaign" },
    { type: "selectMission", missionId: "m01" },
    { type: "openBriefing" },
  ]);
  const wrongMission = Shell.transition({ catalog, profile, state: run.state }, {
    type: "startRun",
    header: { formatVersion: 2, missionId: "m02", difficultyId: "strategos", assist: false, seed: 1 },
  });
  assert.equal(wrongMission.ok, false);
  assert.match(wrongMission.reason, /does not match the choices on this screen/);
  const notAHeader = Shell.transition({ catalog, profile, state: run.state },
    { type: "startRun", header: { formatVersion: 3 } });
  assert.equal(notAHeader.reasonCode, "run-header-required");
});

test("linear mission unlock names the exact preceding mission", () => {
  const catalog = catalogFor();
  const fresh = Profile.createProfileV2("candidate-v4");
  assert.equal(Shell.prerequisiteMissionId(catalog, "m01"), null);
  assert.equal(Shell.prerequisiteMissionId(catalog, "m02"), "m01");
  assert.deepEqual(Shell.missionStatus(catalog, fresh, "m01").status, "current");
  const locked = Shell.missionStatus(catalog, fresh, "m02");
  assert.equal(locked.status, "locked");
  assert.equal(locked.lockReason, "Win Gate of Dawn first.");
  const refused = drive(catalog, fresh, [
    { type: "navigate", screen: "campaign" },
    { type: "selectMission", missionId: "m02" },
  ]);
  assert.equal(refused.last.ok, false);
  assert.equal(refused.last.reasonCode, "mission-locked");
  assert.equal(refused.last.reason, "Win Gate of Dawn first.");

  const advanced = completedProfile(["m01"]);
  assert.equal(Shell.missionStatus(catalog, advanced, "m01").status, "completed");
  assert.equal(Shell.missionStatus(catalog, advanced, "m02").status, "current");
});

test("a partial release falls back to the nearest shipped earlier mission", () => {
  const partial = fixtureContent({
    missions: { m01: mission("m01", 1), m04: mission("m04", 1), m05: mission("m05", 1) },
  });
  const catalog = catalogFor(partial);
  assert.deepEqual(catalog.missionIds, ["m01", "m04", "m05"]);
  assert.equal(Shell.prerequisiteMissionId(catalog, "m04"), "m01");
  assert.equal(Shell.prerequisiteMissionId(catalog, "m05"), "m04");
  assert.equal(Shell.prerequisiteMissionId(catalog, "m01"), null);
});

test("Titan is locked until the act containing the mission is cleared", () => {
  const catalog = catalogFor();
  const fresh = Profile.createProfileV2("candidate-v4");
  const partial = completedProfile(["m01", "m02"]);
  const cleared = completedProfile(["m01", "m02", "m03"]);
  const started = drive(catalog, fresh, [
    { type: "navigate", screen: "campaign" },
    { type: "selectMission", missionId: "m01" },
    { type: "setDifficulty", difficultyId: "titan" },
  ]);
  assert.equal(started.last.ok, false);
  assert.equal(started.last.reasonCode, "difficulty-locked");
  assert.match(started.last.reason, /Clear every mission in Act I/);
  assert.equal(started.state.difficultyId, "strategos");

  assert.equal(Shell.difficultyAvailability(catalog, partial, "m01", "titan", "campaign").available, false);
  assert.equal(Shell.difficultyAvailability(catalog, cleared, "m01", "titan", "campaign").available, true);
  assert.equal(Shell.difficultyAvailability(catalog, fresh, "m01", "story", "campaign").available, true);
  assert.equal(Shell.difficultyAvailability(catalog, fresh, "m01", "titan", "training").available, true,
    "training may trial every difficulty");
});

test("Laurel counts and the next-unlock ribbon come from the profile and grant bundles", () => {
  const catalog = catalogFor();
  let profile = Profile.createProfileV2("candidate-v4");
  const ribbon = Shell.nextUnlockRibbon(catalog, profile);
  assert.equal(ribbon.missionId, "m01");
  assert.match(ribbon.text, /New defense: Hoplite/);
  assert.equal(Shell.laurelCount(profile, "m01", "strategos"), 0);

  profile = Progression.planApplyVerifiedVictory(profile, {
    missionId: "m01",
    difficultyId: "strategos",
    completedObjectiveIds: ["integrity", "victory"],
    defenseEvidence: [{ defenseId: "sentinel", highestLevel: 2, specializationIds: [] }],
    runAuthorization: Progression.deriveRunAuthorization({
      rulesetHash: "sha256:" + "a".repeat(64),
      missionId: "m01",
      difficultyId: "strategos",
      loadoutIds: ["sentinel"],
      specializationAccessIds: profile.specializationAccessIds,
    }, profile.contentIdentity),
  }).profile;
  assert.equal(Shell.laurelCount(profile, "m01", "strategos"), 2);
  assert.equal(Shell.laurelCount(profile, "m01", "titan"), 0);
  const nextRibbon = Shell.nextUnlockRibbon(catalog, profile);
  assert.equal(nextRibbon.missionId, "m02");
});

test("loadout validation refuses empty, oversized, duplicated, and unavailable defenses", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  assert.equal(Shell.validateLoadout(catalog, profile, "m01", ["sentinel"], "campaign").ok, true);
  assert.equal(Shell.validateLoadout(catalog, profile, "m01", [], "campaign").reasonCode, "loadout-empty");
  assert.equal(
    Shell.validateLoadout(catalog, profile, "m01", ["sentinel", "sentinel"], "campaign").reasonCode,
    "loadout-duplicate"
  );
  assert.equal(
    Shell.validateLoadout(catalog, profile, "m01", ["hoplite"], "campaign").reasonCode,
    "loadout-unavailable"
  );
  assert.equal(
    Shell.validateLoadout(catalog, profile, "m01", ["hoplite"], "training").ok,
    true,
    "training trials every defense in the build"
  );
});

test("selecting a mission prefills only defenses the profile and mission both offer", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  const run = drive(catalog, profile, [
    { type: "navigate", screen: "campaign" },
    { type: "selectMission", missionId: "m01" },
  ]);
  assert.deepEqual(run.state.loadoutIds, ["chronos", "sentinel", "siege"]);
  const edited = Shell.transition({ catalog, profile, state: run.state }, {
    type: "setLoadout", loadoutIds: ["sentinel"],
  });
  assert.deepEqual(edited.state.loadoutIds, ["sentinel"]);
  const rejected = Shell.transition({ catalog, profile, state: edited.state }, {
    type: "setLoadout", loadoutIds: ["hoplite"],
  });
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state.loadoutIds, ["sentinel"], "a refused edit never changes the state");
});

test("briefing cannot open without a mission or with an invalid loadout", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  const run = drive(catalog, profile, [
    { type: "navigate", screen: "campaign" },
    { type: "selectMission", missionId: "m01" },
    { type: "setLoadout", loadoutIds: [] },
  ]);
  assert.equal(run.results[2].reasonCode, "loadout-empty");
  const direct = Shell.transition({ catalog, profile, state: Shell.createInitialState({ catalog, profile }) },
    { type: "openBriefing" });
  assert.equal(direct.ok, false);
  assert.equal(direct.reasonCode, "screen-transition-not-allowed");
});

test("back returns along the path and abandoning a run clears its header", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  const run = drive(catalog, profile, [
    { type: "navigate", screen: "campaign" },
    { type: "selectMission", missionId: "m01" },
    { type: "openBriefing" },
    { type: "back" },
  ]);
  assert.equal(run.state.screen, "loadout");
  const toCampaign = Shell.transition({ catalog, profile, state: run.state }, { type: "back" });
  assert.equal(toCampaign.state.screen, "campaign");
  const atTitle = Shell.transition({ catalog, profile, state: Shell.createInitialState({ catalog, profile }) },
    { type: "back" });
  assert.equal(atTitle.ok, false);

  const battle = drive(catalog, profile, [
    { type: "navigate", screen: "campaign" },
    { type: "selectMission", missionId: "m01" },
    { type: "openBriefing" },
    { type: "startRun", header: { formatVersion: 1, missionId: "m01", difficultyId: "strategos", assist: false, seed: 1 } },
    { type: "abandonRun" },
  ]);
  assert.equal(battle.state.screen, "campaign");
  assert.equal(battle.state.runHeader, null);
});

test("training mode never leaves the training branch and never persists a result", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  const run = drive(catalog, profile, [
    { type: "navigate", screen: "training" },
    { type: "selectMission", missionId: "m03" },
    { type: "setLoadout", loadoutIds: ["hoplite"] },
    { type: "openBriefing" },
    { type: "startRun", header: { formatVersion: 1, missionId: "m03", difficultyId: "strategos", assist: false, seed: 1 } },
    { type: "finishRun", result: { outcome: "victory", missionId: "m03", difficultyId: "strategos", score: 10 } },
  ]);
  assert.deepEqual(run.results.map((result) => result.ok), [true, true, true, true, true, true],
    "a locked mission is still selectable as a training trial");
  assert.equal(run.state.mode, "training");
  const model = Shell.selectResultScreen({ catalog, profile, state: run.state });
  assert.equal(model.persistence.durable, false);
  assert.match(model.persistence.message, /Training runs are never saved/);
  const back = Shell.transition({ catalog, profile, state: run.state }, { type: "continue" });
  assert.equal(back.state.screen, "training");
});

test("notices and refusals are stable, frozen, and never mutate the incoming state", () => {
  const catalog = catalogFor();
  const profile = Profile.createProfileV2("candidate-v4");
  const state = Shell.createInitialState({ catalog, profile });
  const refusal = Shell.transition({ catalog, profile, state }, { type: "unknownThing" });
  assert.equal(refusal.ok, false);
  assert.equal(refusal.reasonCode, "action-unknown");
  assert.strictEqual(refusal.state, state);
  assert.equal(Object.isFrozen(refusal), true);
  Object.keys(Shell.REASONS).forEach((code) => {
    assert.equal(typeof Shell.REASONS[code], "string");
    assert.equal(Shell.REASONS[code].length > 0, true, code);
  });
  const noticed = Shell.transition({ catalog, profile, state },
    { type: "setNotice", notice: { text: "Saved.", tone: "ready" } });
  assert.equal(noticed.state.notice.text, "Saved.");
  const cleared = Shell.transition({ catalog, profile, state: noticed.state }, { type: "dismissNotice" });
  assert.equal(cleared.state.notice, null);
  assert.throws(() => Shell.transition({ catalog, profile, state }, "navigate"), /plain object with a type/);
});

test("the shell installs as a frozen collision-safe classic script", () => {
  const filename = path.join(__dirname, "../js/delivery/shell.js");
  const source = fs.readFileSync(filename, "utf8");
  const context = { globalThis: null, Game: {} };
  context.globalThis = context;
  [
    "../js/progression/profile-v2.js",
    "../js/progression/progression.js",
    "../js/presentation/player-ui.js",
    "../js/delivery/keybindings.js",
  ].forEach((relative) => {
    const dependency = path.join(__dirname, relative);
    vm.runInNewContext(fs.readFileSync(dependency, "utf8"), context, { filename: dependency });
  });
  vm.runInNewContext(source, context, { filename });
  assert.equal(context.Game.AegisShell.VERSION, Shell.VERSION);
  assert.equal(Object.isFrozen(context.Game.AegisShell), true);
  const conflict = Object.assign({}, context, { Game: Object.assign({}, context.Game, { AegisShell: {} }) });
  conflict.globalThis = conflict;
  assert.throws(() => vm.runInNewContext(source, conflict, { filename }), /Conflicting Game\.AegisShell/);
});
