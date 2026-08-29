"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Shell = require("../js/delivery/shell.js");
const ShellView = require("../js/presentation/shell-view.js");
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
    enemies: {
      scout: { id: "scout", nameKey: "enemy.scout.name", routeKinds: ["ground"], traits: [], tags: [], resistances: [] },
    },
    bosses: {},
    protocols: {}, relics: {}, reinforcements: {},
    missions: {
      m01: {
        id: "m01", actIndex: 1, mapId: "m01", titleKey: "mission.m01.title",
        availableDefenseIds: ["chronos", "sentinel", "siege"],
        tutorial: { upgradeGateMode: "m01-wave1" },
        briefing: { summaryKey: "mission.m01.summary", objectiveKey: "mission.m01.objective", routeNoticeKeys: [], mechanicNoticeKeys: [] },
        objectives: [{ id: "victory", titleKey: "objective.victory.title" }],
        waves: [{
          id: "w1", index: 1, titleKey: "wave.1.title",
          groups: [{ id: "g0", enemyId: "scout", count: 6, routeId: "route.main", firstTick: 0, intervalTicks: 18, spawnKind: "enemy", order: 0, modifierIds: [] }],
        }],
        protocolLoan: null,
      },
      m02: {
        id: "m02", actIndex: 1, mapId: "m02", titleKey: "mission.m02.title",
        availableDefenseIds: ["chronos", "sentinel", "siege"],
        tutorial: { upgradeGateMode: "none" },
        briefing: { summaryKey: "mission.m02.summary", objectiveKey: "mission.m02.objective", routeNoticeKeys: [], mechanicNoticeKeys: [] },
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
    { key: "mission.m02.title", value: "Olive Terraces" },
    { key: "mission.m01.summary", value: "Hold the eastern gate." },
    { key: "mission.m01.objective", value: "Finish above the gate threshold." },
    { key: "mission.m02.summary", value: "Defend the terraces." },
    { key: "mission.m02.objective", value: "Finish above the gate threshold." },
    { key: "defense.sentinel.name", value: "Sentinel" },
    { key: "defense.chronos.name", value: "Chronos" },
    { key: "defense.siege.name", value: "Siege" },
    { key: "defense.sentinel.role", value: "Reliable single-target damage." },
    { key: "enemy.scout.name", value: "Scout" },
    { key: "objective.victory.title", value: "Win the mission" },
    { key: "wave.1.title", value: "First Footsteps" },
  ],
};

const CATALOG = Shell.createCatalog({ content: fixtureContent(), presentation: PRESENTATION });
const CONTENT = fixtureContent();

function profileFor(missionIds) {
  let profile = Profile.createProfileV2("candidate-v4");
  (missionIds || []).forEach((missionId) => {
    profile = Progression.planApplyMissionFirstClear(profile, missionId).profile;
  });
  return profile;
}

function stateAt(screen, profile, extra) {
  let state = Shell.createInitialState({ catalog: CATALOG, profile });
  const step = (action) => {
    state = Shell.transition({ catalog: CATALOG, profile, state }, action).state;
  };
  if (screen === "title") return state;
  if (screen === "campaign" || screen === "settings" || screen === "codex" || screen === "training") {
    step({ type: "navigate", screen });
    return state;
  }
  step({ type: "navigate", screen: "campaign" });
  step({ type: "selectMission", missionId: "m01" });
  if (screen === "loadout") return state;
  step({ type: "openBriefing" });
  if (screen === "briefing") return state;
  step({
    type: "startRun",
    header: { formatVersion: 2, missionId: "m01", difficultyId: "strategos", assist: false, seed: 1 },
  });
  if (screen === "battle") return state;
  step({ type: "finishRun", result: extra });
  return state;
}

function modelFor(screen, profile, extra) {
  const state = stateAt(screen, profile, extra);
  return Shell.selectScreen({
    catalog: CATALOG, profile, state, waves: CONTENT.missions.m01.waves, ticksPerSecond: 60,
  });
}

function treeFor(screen, profile, options, extra) {
  return ShellView.buildScreenTree(modelFor(screen, profile, extra),
    Object.assign({ storageKind: "session" }, options || {}));
}

const RESULT = Object.freeze({
  outcome: "victory",
  missionId: "m01",
  difficultyId: "strategos",
  assist: false,
  score: 12000,
  gateHealth: 18,
  waves: { cleared: 1, total: 1 },
  completedObjectiveIds: ["victory"],
  newLaurelIds: ["m01:strategos:victory"],
  grantIdsApplied: ["grant.defense.hoplite"],
  masteryChanges: [],
  facts: { protocolCasts: [], relicIds: [], specializationIds: [], reinforcementId: null, mechanismId: null },
  persistence: { kind: "session", durable: false, message: "SESSION ONLY. This victory is not saved." },
});

const SCREENS = ["title", "campaign", "training", "codex", "settings", "loadout", "briefing", "battle"];

/* --------------------------------------------------------- minimal DOM shim */

function createDocumentShim() {
  function element(tag) {
    return {
      tag,
      className: "",
      attributes: {},
      children: [],
      listeners: {},
      value: undefined,
      get firstChild() { return this.children[0] || null; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeChild(child) { this.children = this.children.filter((entry) => entry !== child); },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(type, handler) {
        this.listeners[type] = (this.listeners[type] || []).concat([handler]);
      },
    };
  }
  return {
    createElement: element,
    createTextNode(text) { return { tag: "#text", text, children: [], attributes: {} }; },
  };
}

function flatten(node, out) {
  const collected = out || [];
  collected.push(node);
  (node.children || []).forEach((child) => flatten(child, collected));
  return collected;
}

/* ------------------------------------------------------------------- tests */

test("every shell screen renders a frozen tree with a heading and a live notice region", () => {
  const profile = profileFor(["m01"]);
  SCREENS.concat(["result"]).forEach((screen) => {
    const tree = screen === "result"
      ? treeFor("result", profile, {}, RESULT) : treeFor(screen, profile);
    assert.equal(tree.tag, "div", screen);
    assert.equal(tree.attrs["data-screen"], screen === "training" ? "training" : screen, screen);
    assert.equal(Object.isFrozen(tree), true, screen);
    const nodes = flatten(tree);
    assert.equal(nodes.some((node) => node.tag === "h1"), true, screen + " needs a top heading");
    const notice = nodes.find((node) => node.attrs && node.attrs.id === "shellNotice");
    assert.equal(notice.attrs["aria-live"], "polite", screen);
    assert.equal(notice.attrs.role, "status", screen);
  });
});

test("every screen is fully reachable by keyboard and every control has an accessible name", () => {
  const profile = profileFor(["m01"]);
  SCREENS.concat(["result"]).forEach((screen) => {
    const tree = screen === "result"
      ? treeFor("result", profile, {}, RESULT) : treeFor(screen, profile);
    const order = ShellView.focusOrder(tree);
    assert.equal(order.length > 0, true, screen + " must expose at least one control");
    order.forEach((entry, index) => {
      assert.equal(typeof entry.label, "string", screen + " control " + index);
      assert.equal(entry.label.trim().length > 0, true,
        screen + " control " + index + " needs an accessible name");
      assert.equal(["button", "input", "select", "textarea", "a"].includes(entry.tag), true, screen);
    });
  });
});

test("focus order is deterministic and follows the reading order of the screen", () => {
  const profile = profileFor(["m01"]);
  const first = ShellView.focusOrder(treeFor("campaign", profile)).map((entry) => entry.label);
  const second = ShellView.focusOrder(treeFor("campaign", profile)).map((entry) => entry.label);
  assert.deepEqual(first, second);
  assert.equal(first[0], "Back");
  assert.match(first[1], /Mission 1, Gate of Dawn/);
  assert.match(first[2], /Mission 2, Olive Terraces/);
  assert.equal(first.length, 3, "the campaign screen exposes Back plus one control per unlocked mission");
});

test("a disabled control is not focusable and states why it is unavailable", () => {
  const profile = profileFor([]);
  const tree = treeFor("campaign", profile);
  const buttons = flatten(tree).filter((node) => node.tag === "button");
  const locked = buttons.find((node) => (node.attrs["aria-label"] || "").includes("Olive Terraces"));
  assert.equal(Object.prototype.hasOwnProperty.call(locked.attrs, "disabled"), true);
  assert.equal(locked.action, null, "a disabled control carries no action");
  assert.match(ShellView.renderToText(tree), /Win Gate of Dawn first\./);
  const focusLabels = ShellView.focusOrder(tree).map((entry) => entry.label);
  assert.equal(focusLabels.some((label) => label.includes("Olive Terraces")), false);
});

test("ordinary player screens never render a tick, hash, id, pad quality, or grid token", () => {
  const profile = profileFor(["m01"]);
  const forbidden = [
    /\btick\b/i, /\bticks\b/i, /sha256/i, /\bhash\b/i, /runtimeId/i, /\bseed\b/i,
    /pad quality/i, /pad-quality/i, /strategy rank/i, /hidden grid/i,
    /\bgridColumn\b/i, /\bcolumn \d+, row \d+/i, /rulesetHash/i, /\bJSON\b/,
    /simulation step/i, /replay hash/i, /\bABI\b/,
  ];
  SCREENS.concat(["result"]).forEach((screen) => {
    const tree = screen === "result"
      ? treeFor("result", profile, {}, RESULT) : treeFor(screen, profile);
    const text = ShellView.renderToText(tree);
    forbidden.forEach((pattern) => {
      assert.equal(pattern.test(text), false,
        screen + " leaked developer data matching " + pattern + ": " + text.slice(0, 240));
    });
  });
});

test("prices, slot counts, and lock reasons are visible text on the loadout screen", () => {
  const text = ShellView.renderToText(treeFor("loadout", profileFor(["m01"])));
  assert.match(text, /60 Aether/);
  assert.match(text, /75 Aether/);
  assert.match(text, /90 Aether/);
  assert.match(text, /Towers/);
  assert.match(text, /Divine Protocols/);
  assert.match(text, /Relics/);
  assert.match(text, /Reinforcement/);
  assert.match(text, /of 4 slots|of 5 slots|of 6 slots/);
  assert.match(text, /Assist adds 20 starting Aether/);
  assert.match(text, /Read the briefing/);
});

test("the briefing renders the Recon tier, wave groups, and Laurel targets as text", () => {
  const text = ShellView.renderToText(treeFor("briefing", profileFor(["m01"])));
  assert.match(text, /Baseline scouting/);
  assert.match(text, /First Footsteps/);
  assert.match(text, /Scout/);
  assert.match(text, /ground/);
  assert.match(text, /Win the mission/);
  assert.match(text, /Start mission/);
  assert.match(text, /Gate Health/);
});

test("the session-only warning is on every screen until storage is durable", () => {
  const profile = profileFor(["m01"]);
  const sessionText = ShellView.renderToText(treeFor("title", profile, { storageKind: "session" }));
  assert.match(sessionText, /SESSION ONLY - progress will not be saved/);
  const durableText = ShellView.renderToText(treeFor("title", profile, { storageKind: "durable" }));
  assert.match(durableText, /Saving to this browser/);
  assert.doesNotMatch(durableText, /SESSION ONLY/);
});

test("Reduced Motion and photosensitivity-safe mode are declared on the rendered root", () => {
  const profile = profileFor(["m01"]);
  const plain = treeFor("title", profile);
  assert.equal(plain.attrs["data-reduced-motion"], "false");
  assert.equal(plain.attrs["data-photosensitive-safe"], "false");
  const adjusted = treeFor("title", profile, { reducedMotion: true, photosensitiveSafe: true });
  assert.equal(adjusted.attrs["data-reduced-motion"], "true");
  assert.equal(adjusted.attrs["data-photosensitive-safe"], "true");
});

test("mounting builds real DOM nodes, wires one handler per control, and replaces old content", () => {
  const documentObject = createDocumentShim();
  const container = documentObject.createElement("div");
  container.appendChild(documentObject.createElement("p"));
  const dispatched = [];
  const tree = treeFor("campaign", profileFor(["m01"]));
  ShellView.mount(documentObject, container, tree, (action) => dispatched.push(action));
  assert.equal(container.children.length, 1, "mounting replaces the previous screen");
  const nodes = flatten(container.children[0]);
  const buttons = nodes.filter((node) => node.tag === "button");
  assert.equal(buttons.length > 0, true);
  const mission = buttons.find((node) => (node.attributes["aria-label"] || "").includes("Gate of Dawn"));
  assert.equal(mission.listeners.click.length, 1);
  mission.listeners.click[0]({});
  assert.deepEqual(dispatched, [{ type: "selectMission", missionId: "m01" }]);
  assert.throws(() => ShellView.mount(null, container, tree), /requires a document/);
  assert.throws(() => ShellView.mount(documentObject, null, tree), /requires a container/);
});

test("the shell view refuses an unknown or malformed screen model", () => {
  assert.throws(() => ShellView.buildScreenTree(null, {}), /requires a screen model/);
  assert.throws(() => ShellView.buildScreenTree({ screen: "shop" }, {}), /Unknown Aegis shell screen/);
});

/* ------------------------------------------------------- page and stylesheet */

test("preview.html hosts the shell, the battle region, and gated developer tools", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "preview.html"), "utf8");
  assert.match(html, /id="shellRoot"/);
  assert.match(html, /id="battleRegion"[^>]*hidden/);
  assert.match(html, /id="resultCardRegion"[^>]*hidden/);
  assert.match(html, /id="previewDeveloperTools"[^>]*hidden/);
  assert.match(html, /css\/aegis-shell\.css/);
  [
    "js/delivery/keybindings.js",
    "js/delivery/run-header-v2.js",
    "js/delivery/session-store.js",
    "js/delivery/shell.js",
    "js/presentation/shell-view.js",
    "js/delivery/battle-session.js",
    "js/progression/profile-v2.js",
    "js/progression/progression.js",
    "js/presentation/player-ui.js",
  ].forEach((source) => {
    assert.match(html, new RegExp('<script src="' + source.replace(/[.\/]/g, "\\$&") + '">'), source);
  });
  assert.doesNotMatch(html, /releaseId:\s*"candidate-v4"/, "the default release is never hard-wired to a candidate");
});

test("the shell stylesheet keeps large targets, responsive layout, and access modes", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "css", "aegis-shell.css"), "utf8");
  assert.match(css, /--shell-target-primary:\s*3rem/);
  assert.match(css, /--shell-target-secondary:\s*2\.75rem/);
  assert.match(css, /\.aegis-shell-button--primary\s*\{[^}]*min-height:\s*var\(--shell-target-primary\)/s);
  assert.match(css, /@media \(max-width: 30rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /body\[data-reduced-motion="true"\]/);
  assert.match(css, /body\[data-photosensitive-safe="true"\]/);
  assert.match(css, /\.aegis-shell-button:focus-visible\s*\{[^}]*outline:/s);
  assert.doesNotMatch(css, /\d+px\s*;\s*\/\* cost/, "no combat number is ever hard-coded in CSS");
  assert.doesNotMatch(css, /content:\s*"[^"]*Aether/, "prices are live DOM text, never CSS content");
});

test("the shell view installs as a frozen collision-safe classic script", () => {
  const filename = path.join(__dirname, "../js/presentation/shell-view.js");
  const source = fs.readFileSync(filename, "utf8");
  const context = { globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename });
  assert.equal(context.Game.AegisShellView.VERSION, ShellView.VERSION);
  assert.equal(Object.isFrozen(context.Game.AegisShellView), true);
  const conflict = { globalThis: null, Game: { AegisShellView: {} } };
  conflict.globalThis = conflict;
  assert.throws(() => vm.runInNewContext(source, conflict, { filename }),
    /Conflicting Game\.AegisShellView/);
});
