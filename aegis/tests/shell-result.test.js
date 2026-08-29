"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const Shell = require("../js/delivery/shell.js");
const BattleSession = require("../js/delivery/battle-session.js");
const ShareCard = require("../js/presentation/share-card.js");
const Profile = require("../js/progression/profile-v2.js");

/* ---------------------------------------------------------------- fixtures */

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
    defenses: {
      sentinel: {
        id: "sentinel", nameKey: "defense.sentinel.name", roleKey: "defense.sentinel.role",
        weaknessKey: "defense.sentinel.weakness", targetKinds: ["ground"],
        levels: [{ level: 1, purchase: { kind: "build", costAether: 60 }, rangeWorldUnits: 22000, behaviors: [] }],
      },
    },
    enemies: {},
    bosses: {},
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
    relics: {
      "bronze-obol": {
        id: "bronze-obol", nameKey: "relic.bronze-obol.name",
        benefitKey: "relic.bronze-obol.benefit", drawbackKey: "relic.bronze-obol.drawback",
      },
    },
    reinforcements: {
      "spartan-phalanx": {
        id: "spartan-phalanx", nameKey: "reinforcement.spartan-phalanx.name",
        costAether: 70, cooldownMs: 50000, lifetimeMs: 14000, markerKind: "reinforcement-block",
      },
    },
    missions: {
      m01: {
        id: "m01", actIndex: 1, mapId: "m01", titleKey: "mission.m01.title",
        availableDefenseIds: ["sentinel"], tutorial: { upgradeGateMode: "m01-wave1" },
        briefing: {},
        objectives: [
          { id: "victory", titleKey: "objective.victory.title" },
          { id: "integrity", titleKey: "objective.integrity.title" },
        ],
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
    { key: "protocol.temporal-edict.name", value: "Temporal Edict" },
    { key: "relic.bronze-obol.name", value: "Bronze Obol" },
    { key: "relic.bronze-obol.benefit", value: "Start with 25 more Aether." },
    { key: "relic.bronze-obol.drawback", value: "Earn 15% less bounty." },
    { key: "reinforcement.spartan-phalanx.name", value: "Spartan Phalanx" },
    { key: "objective.victory.title", value: "Win the mission" },
    { key: "objective.integrity.title", value: "Keep the gate above 15" },
  ],
};

const CATALOG = Shell.createCatalog({ content: fixtureContent(), presentation: PRESENTATION });

const HEADER = Object.freeze({
  formatVersion: 2,
  missionId: "m01",
  difficultyId: "strategos",
  assist: false,
  seed: 4,
  protocolLoadout: [{ slot: 0, protocolId: "temporal-edict", tier: 2 }],
  missionProtocolLoan: null,
  relicIds: ["bronze-obol"],
  reinforcementId: "spartan-phalanx",
});

const EVENTS = Object.freeze([
  { eventId: "wave.deploy" },
  { eventId: "protocol.temporal-edict.accepted" },
  { eventId: "protocol.temporal-edict.resolved" },
  { eventId: "protocol.temporal-edict.accepted" },
  { eventId: "reinforcement.spartan-phalanx.deployed" },
  { eventId: "mechanism.bronze-city-gate.activated" },
  { eventId: "mechanism.bronze-city-gate.activated" },
]);

const TERMINAL_STATE = Object.freeze({
  missionId: "m01",
  difficultyId: "strategos",
  outcome: "victory",
  score: 12000,
  integrity: 18,
  tick: 9000,
  objectiveResults: [
    { id: "victory", complete: true },
    { id: "integrity", complete: true },
    { id: "mastery", complete: false },
  ],
  management: {
    phase: "planning",
    clearedWaves: 1,
    towers: [
      { defenseId: "sentinel", level: 3, specializationId: "sentinel-lock-on" },
      { defenseId: "sentinel", level: 2, specializationId: null },
    ],
  },
});

function resultState(result, mode) {
  const profile = Profile.createProfileV2("candidate-v4");
  return {
    catalog: CATALOG,
    profile,
    state: Object.freeze({
      screen: "result",
      mode: mode || "campaign",
      missionId: "m01",
      difficultyId: "strategos",
      assist: false,
      seed: 4,
      loadoutIds: ["sentinel"],
      runHeader: HEADER,
      result: result,
      notice: null,
      previousScreen: "battle",
      settings: { reducedMotion: false, photosensitiveSafe: false, bindings: {} },
      storageKind: "session",
      debug: false,
    }),
  };
}

/* ------------------------------------------------------------------- tests */

test("run facts count only canonical accepted events and live tower state", () => {
  const facts = BattleSession.deriveRunFacts({
    header: HEADER, events: EVENTS, state: TERMINAL_STATE,
  });
  assert.deepEqual(facts.protocolCasts, [{ protocolId: "temporal-edict", tier: 2, casts: 2 }]);
  assert.deepEqual(facts.relicIds, ["bronze-obol"]);
  assert.deepEqual(facts.specializationIds, ["sentinel-lock-on"]);
  assert.equal(facts.reinforcementId, "spartan-phalanx");
  assert.equal(facts.reinforcementDeployments, 1);
  assert.equal(facts.mechanismId, "bronze-city-gate");
  assert.equal(facts.mechanismActivations, 2);
  assert.deepEqual(facts.defenseEvidence, [
    { defenseId: "sentinel", highestLevel: 3, specializationIds: ["sentinel-lock-on"] },
  ]);
  assert.equal(Object.isFrozen(facts), true);
});

test("an equipped but unused reinforcement earns no badge", () => {
  const facts = BattleSession.deriveRunFacts({
    header: HEADER,
    events: [{ eventId: "protocol.temporal-edict.accepted" }],
    state: TERMINAL_STATE,
  });
  assert.equal(facts.reinforcementId, null);
  assert.equal(facts.reinforcementDeployments, 0);
  assert.equal(facts.mechanismId, null);
  const badges = Shell.usageBadges(CATALOG, facts);
  assert.equal(badges.some((badge) => badge.category === "reinforcement"), false);
  assert.equal(badges.some((badge) => badge.category === "mechanism"), false);
});

test("a loaned Protocol reports the loan tier, not an equipped tier", () => {
  const loanHeader = Object.assign({}, HEADER, {
    protocolLoadout: [],
    missionProtocolLoan: { protocolId: "temporal-edict", tier: 1 },
  });
  const facts = BattleSession.deriveRunFacts({
    header: loanHeader,
    events: [{ eventId: "protocol.temporal-edict.accepted" }],
    state: TERMINAL_STATE,
  });
  assert.deepEqual(facts.protocolCasts, [{ protocolId: "temporal-edict", tier: 1, casts: 1 }]);
});

test("badges are derived from facts and name every system actually used", () => {
  const facts = BattleSession.deriveRunFacts({ header: HEADER, events: EVENTS, state: TERMINAL_STATE });
  const badges = Shell.usageBadges(CATALOG, facts);
  assert.deepEqual(badges.map((badge) => [badge.category, badge.label, badge.detail]), [
    ["protocol", "Temporal Edict T2", "2 casts"],
    ["relic", "Bronze Obol", "Equipped"],
    ["specialization", "Sentinel Lock On", "Level 3 branch"],
    ["reinforcement", "Spartan Phalanx", "1 deployment"],
    ["mechanism", "Bronze City Gate", "2 activations"],
  ]);
});

test("the share-card challenge line carries the badges and stays inside the card's text limit", () => {
  const facts = BattleSession.deriveRunFacts({ header: HEADER, events: EVENTS, state: TERMINAL_STATE });
  const line = Shell.badgeLine(Shell.usageBadges(CATALOG, facts));
  assert.match(line, /^Used: Temporal Edict T2/);
  assert.equal(line.length <= 96, true);
  const model = ShareCard.createModel({
    widthPx: ShareCard.CARD_WIDTH_PX,
    heightPx: ShareCard.CARD_HEIGHT_PX,
    outcome: "victory",
    missionTitle: "Gate of Dawn",
    score: 12000,
    waves: { cleared: 1, total: 1 },
    gateHealth: { current: 18, max: 20 },
    challengeLine: line,
  });
  assert.equal(model.challengeLine, line);
  assert.match(ShareCard.summaryText(model), /Challenge: Used: Temporal Edict T2/);
  assert.equal(Shell.badgeLine([]), null);
});

test("a run result summarizes the terminal state without inventing progression", () => {
  const runtime = {
    binding: {}, content: fixtureContent(), release: {}, descriptor: { contentIds: ["m01"] },
    kernel: { createInitialState() {}, advanceTick() {} },
    commands: { normalizeCommand(command) { return command; } },
  };
  const result = BattleSession.createRunResult({
    runtime, header: HEADER, state: TERMINAL_STATE, events: EVENTS,
  });
  assert.equal(result.outcome, "victory");
  assert.equal(result.score, 12000);
  assert.equal(result.gateHealth, 18);
  assert.equal(result.maximumGateHealth, 20);
  assert.deepEqual(result.waves, { cleared: 1, total: 1 });
  assert.deepEqual(result.completedObjectiveIds, ["integrity", "victory"]);
  assert.deepEqual(result.newLaurelIds, []);
  assert.deepEqual(result.grantIdsApplied, []);
  assert.equal(result.persistence.durable, false);
  assert.throws(() => BattleSession.createRunResult({
    runtime, header: HEADER, events: EVENTS,
    state: Object.assign({}, TERMINAL_STATE, { outcome: "active" }),
  }), /terminal outcome/);
});

test("the result screen separates new Laurels from Laurels already owned", () => {
  const facts = BattleSession.deriveRunFacts({ header: HEADER, events: EVENTS, state: TERMINAL_STATE });
  const model = Shell.selectResultScreen(resultState({
    outcome: "victory",
    missionId: "m01",
    difficultyId: "strategos",
    assist: false,
    score: 12000,
    gateHealth: 18,
    waves: { cleared: 1, total: 1 },
    completedObjectiveIds: ["integrity", "victory"],
    newLaurelIds: ["m01:strategos:victory"],
    grantIdsApplied: ["grant.defense.hoplite"],
    masteryChanges: [{ defenseId: "sentinel", milestone: "tempered" }],
    facts,
    persistence: { kind: "session", durable: false, message: "SESSION ONLY. This victory is not saved." },
  }));
  assert.equal(model.heading, "LOCAL VICTORY");
  assert.equal(model.missionTitle, "Gate of Dawn");
  assert.equal(model.difficultyLabel, "Strategos");
  assert.deepEqual(model.laurels.map((laurel) => [laurel.title, laurel.isNew, laurel.statusText]), [
    ["Keep the gate above 15", false, "Already earned"],
    ["Win the mission", true, "New Laurel"],
  ]);
  assert.deepEqual(model.firstClearRewards.map((reward) => reward.text), ["New defense: Hoplite"]);
  assert.deepEqual(model.masteryChanges.map((change) => change.text), ["Sentinel reached tempered."]);
  assert.equal(model.badges.length, 5);
  assert.match(model.badgeLine, /^Used: /);
  assert.equal(model.persistence.durable, false);
  assert.match(model.persistence.message, /SESSION ONLY/);
  assert.equal(model.primaryAction, "Next mission");
});

test("a defeat keeps a readable result and never claims a reward", () => {
  const model = Shell.selectResultScreen(resultState({
    outcome: "defeat",
    missionId: "m01",
    difficultyId: "strategos",
    assist: true,
    score: 400,
    gateHealth: 0,
    waves: { cleared: 0, total: 1 },
    completedObjectiveIds: [],
    newLaurelIds: [],
    grantIdsApplied: [],
    masteryChanges: [],
    facts: BattleSession.deriveRunFacts({ header: HEADER, events: [], state: TERMINAL_STATE }),
    persistence: { kind: "session", durable: false, message: "Defeats are not saved." },
  }));
  assert.equal(model.heading, "DEFEAT");
  assert.deepEqual(model.laurels, []);
  assert.deepEqual(model.firstClearRewards, []);
  assert.equal(model.assist, true);
  assert.deepEqual(model.badges.map((badge) => badge.category), ["relic", "specialization"],
    "an equipped Relic and a chosen branch are still honest badges after a defeat");
});

test("the result screen never leaks developer diagnostics", () => {
  const facts = BattleSession.deriveRunFacts({ header: HEADER, events: EVENTS, state: TERMINAL_STATE });
  const model = Shell.selectResultScreen(resultState({
    outcome: "victory",
    missionId: "m01",
    difficultyId: "strategos",
    assist: false,
    score: 12000,
    gateHealth: 18,
    waves: { cleared: 1, total: 1 },
    completedObjectiveIds: ["victory"],
    newLaurelIds: [],
    grantIdsApplied: [],
    masteryChanges: [],
    facts,
    persistence: { kind: "session", durable: false, message: "Not saved." },
  }));
  const encoded = JSON.stringify(model);
  ["rulesetHash", "finalStateHash", "durationTicks", "runtimeId", "padQuality"].forEach((token) => {
    assert.equal(encoded.includes(token), false, token);
  });
  assert.equal(Object.isFrozen(model), true);
});

test("no result surface mentions a social account, follow, or verified badge", () => {
  const facts = BattleSession.deriveRunFacts({ header: HEADER, events: EVENTS, state: TERMINAL_STATE });
  const model = Shell.selectResultScreen(resultState({
    outcome: "victory",
    missionId: "m01",
    difficultyId: "strategos",
    assist: false,
    score: 12000,
    gateHealth: 18,
    waves: { cleared: 1, total: 1 },
    completedObjectiveIds: ["victory"],
    newLaurelIds: [],
    grantIdsApplied: [],
    masteryChanges: [],
    facts,
    persistence: { kind: "session", durable: false, message: "Not saved." },
  }));
  const text = JSON.stringify(model).toLowerCase();
  ["telegram", "follow us", "verified badge", "twitter", "connect wallet"].forEach((token) => {
    assert.equal(text.includes(token), false, token);
  });
  assert.equal(model.secondaryActions.includes("Record a 10-20 second highlight"), true);
});
