"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const KeyBindings = require("../js/delivery/keybindings.js");
const SessionStore = require("../js/delivery/session-store.js");
const Shell = require("../js/delivery/shell.js");
const Profile = require("../js/progression/profile-v2.js");

function fixtureContent() {
  return {
    schemaVersion: 4,
    contentVersion: "candidate-v4",
    campaignRules: {
      difficultyPresets: [
        { id: "story", startAetherBp: 11900, integrity: 25, enemyHpBp: 8500, enemySpeedBp: 9500, bountyBp: 11000, scoreBp: 7500 },
        { id: "strategos", startAetherBp: 10000, integrity: 20, enemyHpBp: 10000, enemySpeedBp: 10000, bountyBp: 10000, scoreBp: 10000 },
      ],
    },
    defenses: {
      sentinel: {
        id: "sentinel", nameKey: "defense.sentinel.name", roleKey: "defense.sentinel.role",
        weaknessKey: "defense.sentinel.weakness", targetKinds: ["ground"],
        levels: [{ level: 1, purchase: { kind: "build", costAether: 60 }, rangeWorldUnits: 22000, behaviors: [] }],
      },
    },
    enemies: {}, bosses: {}, protocols: {}, relics: {}, reinforcements: {},
    missions: {
      m01: {
        id: "m01", actIndex: 1, mapId: "m01", titleKey: "mission.m01.title",
        availableDefenseIds: ["sentinel"], tutorial: { upgradeGateMode: "none" }, briefing: {},
        objectives: [{ id: "victory", titleKey: "objective.victory.title" }],
        waves: [{ id: "w1", index: 1, titleKey: "wave.1.title", groups: [] }],
        protocolLoan: null,
      },
    },
  };
}

const CATALOG = Shell.createCatalog({
  content: fixtureContent(),
  presentation: { strings: [{ key: "mission.m01.title", value: "Gate of Dawn" }] },
});

function settingsState(overrides) {
  const profile = Profile.createProfileV2("candidate-v4");
  let state = Shell.createInitialState(Object.assign({ catalog: CATALOG, profile }, overrides || {}));
  state = Shell.transition({ catalog: CATALOG, profile, state },
    { type: "navigate", screen: "settings" }).state;
  return { catalog: CATALOG, profile, state };
}

/* --------------------------------------------------------------- bindings */

test("default key bindings are the specified 1, 2, R, and M", () => {
  assert.equal(KeyBindings.DEFAULT_BINDINGS.protocolSlot1, "1");
  assert.equal(KeyBindings.DEFAULT_BINDINGS.protocolSlot2, "2");
  assert.equal(KeyBindings.DEFAULT_BINDINGS.reinforcement, "R");
  assert.equal(KeyBindings.DEFAULT_BINDINGS.mechanism, "M");
  assert.equal(KeyBindings.CANCEL_KEY, "Escape");
  assert.equal(Object.isFrozen(KeyBindings.DEFAULT_BINDINGS), true);
});

test("a binding is one printable letter or digit compared case insensitively", () => {
  assert.deepEqual(
    ["q", "Q", "7"].map((key) => KeyBindings.normalizeKey(key).key),
    ["Q", "Q", "7"]
  );
  assert.equal(KeyBindings.normalizeKey("q").ok, true);
  assert.equal(KeyBindings.normalizeKey({ key: "z", ctrlKey: false }).key, "Z");
  assert.equal(KeyBindings.normalizeKey("").reasonCode, "empty");
  assert.equal(KeyBindings.normalizeKey("ab").reasonCode, "unprintable");
  assert.equal(KeyBindings.normalizeKey("!").reasonCode, "unprintable");
});

test("chords, Escape, Tab, Enter, Space, and function keys are refused with a reason", () => {
  const chord = KeyBindings.normalizeKey({ key: "s", ctrlKey: true });
  assert.equal(chord.ok, false);
  assert.equal(chord.reasonCode, "chord");
  assert.match(chord.reason, /Control, Alt, Shift, or the Command key/);
  assert.equal(KeyBindings.normalizeKey({ key: "s", metaKey: true }).reasonCode, "chord");
  assert.equal(KeyBindings.normalizeKey({ key: "s", altKey: true }).reasonCode, "chord");
  ["Escape", "Tab", "Enter", " ", "ArrowLeft", "PageDown"].forEach((key) => {
    const refused = KeyBindings.normalizeKey(key);
    assert.equal(refused.ok, false, key);
    assert.equal(refused.reasonCode, "reserved", key);
  });
  ["F1", "F5", "F12"].forEach((key) => {
    assert.equal(KeyBindings.normalizeKey(key).reasonCode, "functionKey", key);
  });
});

test("rebinding refuses duplicates and unknown actions and never partially applies", () => {
  const duplicate = KeyBindings.planRebind(KeyBindings.DEFAULT_BINDINGS, "mechanism", "R");
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reasonCode, "duplicate");
  assert.match(duplicate.reason, /Deploy reinforcement/);
  assert.deepEqual(duplicate.bindings, KeyBindings.DEFAULT_BINDINGS);

  const unknown = KeyBindings.planRebind(KeyBindings.DEFAULT_BINDINGS, "fly", "K");
  assert.equal(unknown.reasonCode, "unknownAction");

  const accepted = KeyBindings.planRebind(KeyBindings.DEFAULT_BINDINGS, "mechanism", "k");
  assert.equal(accepted.ok, true);
  assert.equal(accepted.bindings.mechanism, "K");
  assert.equal(accepted.bindings.reinforcement, "R");
  assert.equal(Object.isFrozen(accepted.bindings), true);
  assert.equal(KeyBindings.DEFAULT_BINDINGS.mechanism, "M", "the default table is never mutated");
});

test("stored bindings normalize back to defaults when they are no longer legal", () => {
  const bindings = KeyBindings.normalizeBindings({
    protocolSlot1: "Escape", protocolSlot2: "F4", reinforcement: "z", mechanism: null,
  });
  assert.equal(bindings.protocolSlot1, "1");
  assert.equal(bindings.protocolSlot2, "2");
  assert.equal(bindings.reinforcement, "Z");
  assert.equal(bindings.mechanism, "M");
  assert.deepEqual(Object.keys(bindings).sort(), KeyBindings.ACTION_IDS.slice().sort());
});

test("the settings screen rebinds through the shell and reports the refusal reason", () => {
  const context = settingsState();
  const accepted = Shell.transition(context, { type: "rebindKey", actionId: "mechanism", key: "k" });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.settings.bindings.mechanism, "K");
  const refused = Shell.transition(
    { catalog: CATALOG, profile: context.profile, state: accepted.state },
    { type: "rebindKey", actionId: "reinforcement", key: "Escape" }
  );
  assert.equal(refused.ok, false);
  assert.equal(refused.reasonCode, "binding-refused");
  assert.match(refused.reason, /reserved by the browser or by Cancel/);
  assert.equal(refused.state.settings.bindings.reinforcement, "R");

  const model = Shell.selectSettingsScreen({
    catalog: CATALOG, profile: context.profile, state: accepted.state,
  });
  assert.equal(model.cancelKey, "Escape");
  assert.match(model.bindingRule, /Escape always cancels and cannot be rebound/);
  const mechanism = model.bindings.find((binding) => binding.id === "mechanism");
  assert.equal(mechanism.key, "K");
  assert.equal(mechanism.isDefault, false);
  assert.match(mechanism.ariaLabel, /currently the K key/);
});

test("Reduced Motion and photosensitivity-safe mode are explicit, persisted settings", () => {
  const context = settingsState();
  assert.equal(context.state.settings.reducedMotion, false);
  const reduced = Shell.transition(context, { type: "setSetting", key: "reducedMotion", value: true });
  assert.equal(reduced.ok, true);
  assert.equal(reduced.state.settings.reducedMotion, true);
  const safe = Shell.transition(
    { catalog: CATALOG, profile: context.profile, state: reduced.state },
    { type: "setSetting", key: "photosensitiveSafe", value: true }
  );
  assert.equal(safe.state.settings.photosensitiveSafe, true);
  assert.equal(safe.state.settings.reducedMotion, true);
  const unknown = Shell.transition(context, { type: "setSetting", key: "hyperspeed", value: true });
  assert.equal(unknown.reasonCode, "setting-unknown");
  const nonBoolean = Shell.transition(context, { type: "setSetting", key: "reducedMotion", value: "yes" });
  assert.equal(nonBoolean.reasonCode, "setting-unknown");

  const model = Shell.selectSettingsScreen({
    catalog: CATALOG, profile: context.profile, state: safe.state,
  });
  assert.deepEqual(model.toggles.map((toggle) => [toggle.key, toggle.value]), [
    ["reducedMotion", true], ["photosensitiveSafe", true],
  ]);
  model.toggles.forEach((toggle) => assert.equal(toggle.minimumTargetSizePx >= 44, true));
  assert.match(model.toggles[0].detail, /Telegraph boundaries stay exact/);
});

test("a session-only start says so plainly and offers recovery export and import", () => {
  const model = Shell.selectSettingsScreen(settingsState());
  assert.equal(model.storage.kind, "session");
  assert.equal(model.storage.durable, false);
  assert.equal(model.storage.label, "SESSION ONLY");
  assert.match(model.storage.detail, /did not offer durable storage/);
  assert.equal(model.recovery.exportLabel, "Export recovery file");
  assert.equal(model.recovery.importLabel, "Import recovery file");
  assert.match(model.recovery.detail, /never contains a name or account/);

  const durable = Shell.selectSettingsScreen(settingsState({ storageKind: "durable" }));
  assert.equal(durable.storage.durable, true);
  assert.equal(durable.storage.label, "Saving to this browser");
});

/* ----------------------------------------------------------------- storage */

test("storage detection is honest about direct-file and missing IndexedDB", () => {
  assert.deepEqual(SessionStore.detectStorage(null),
    { kind: "session", durable: false, reason: "no-host" });
  assert.equal(SessionStore.detectStorage({ location: { protocol: "file:" } }).reason, "direct-file-boot");
  assert.equal(SessionStore.detectStorage({ location: { protocol: "https:" } }).reason, "no-indexeddb");
  const durable = SessionStore.detectStorage({ location: { protocol: "https:" }, indexedDB: {} });
  assert.deepEqual(durable, { kind: "indexeddb", durable: true, reason: null });
  const hostile = {
    get location() { throw new Error("blocked"); },
    get indexedDB() { throw new Error("blocked"); },
  };
  assert.equal(SessionStore.detectStorage(hostile).durable, false, "a blocked probe never throws");
});

test("the session store implements the profile-store contract and stays session only", async () => {
  const store = SessionStore.openSessionProfileStore({ namespace: "aegis-candidate-v4:profile" });
  assert.equal(store.kind, "session");
  assert.equal(store.durable, false);
  assert.match(store.notice.title, /SESSION ONLY/);
  ["readProfile", "writeProfile", "commitVictory", "readResults", "readReplayReference",
    "exportRecovery", "importRecovery", "close"].forEach((name) => {
    assert.equal(typeof store[name], "function", name);
  });
  const empty = await store.readProfile();
  assert.deepEqual(empty, { ok: true, value: null });
  const profile = Profile.createProfileV2("candidate-v4");
  const written = await store.writeProfile(profile, { kind: "bootstrap" });
  assert.equal(written.ok, true);
  const read = await store.readProfile();
  assert.equal(read.value.contentIdentity, "candidate-v4");
  assert.notStrictEqual(read.value, profile, "the store hands back a detached copy");
  const invalid = await store.writeProfile(null);
  assert.deepEqual(invalid, { ok: false, reason: "invalid-profile", value: null });
  assert.throws(() => SessionStore.openSessionProfileStore({ namespace: "evil" }), /Aegis-owned/);
});

test("a session victory commit keeps the result and reports that it is not durable", async () => {
  const store = SessionStore.openSessionProfileStore({ namespace: "aegis" });
  const profile = Profile.createProfileV2("candidate-v4");
  const committed = await store.commitVictory({
    profile,
    result: { resultId: "m01:strategos:4", missionId: "m01", score: 12000 },
    replay: { formatVersion: 2 },
    journalEntry: { kind: "verified-victory", missionId: "m01" },
  });
  assert.equal(committed.ok, true);
  assert.equal(committed.value.durable, false);
  assert.equal(committed.value.resultId, "m01:strategos:4");
  const results = await store.readResults();
  assert.equal(results.value.length, 1);
  assert.equal(results.value[0].missionId, "m01");
  const replay = await store.readReplayReference("m01:strategos:4");
  assert.equal(replay.ok, true);
  const missing = await store.readReplayReference("m02:strategos:1");
  assert.deepEqual(missing, { ok: false, reason: "replay-not-retained", value: null });
  const rejected = await store.commitVictory({ result: {} });
  assert.equal(rejected.reason, "transaction-missing-profile");
});

test("recovery export and import round trip and refuse an unknown schema", async () => {
  const store = SessionStore.openSessionProfileStore({ namespace: "aegis" });
  const profile = Profile.createProfileV2("candidate-v4");
  await store.writeProfile(profile, null);
  const exported = await store.exportRecovery();
  assert.equal(exported.ok, true);
  assert.equal(exported.value.schemaVersion, SessionStore.RECOVERY_SCHEMA_VERSION);
  assert.equal(exported.value.durable, false);
  assert.equal(exported.value.profile.contentIdentity, "candidate-v4");

  const fresh = SessionStore.openSessionProfileStore({ namespace: "aegis" });
  const imported = await fresh.importRecovery(exported.value);
  assert.equal(imported.ok, true);
  assert.equal(imported.value.contentIdentity, "candidate-v4");
  assert.deepEqual(await fresh.importRecovery({ schemaVersion: 99 }),
    { ok: false, reason: "unsupported-recovery-schema", value: null });
  assert.deepEqual(await fresh.importRecovery(null),
    { ok: false, reason: "invalid-bundle", value: null });
});

test("openProfileStore prefers a durable adapter and falls back without throwing", async () => {
  const durableStore = { kind: "indexeddb", readProfile() { return Promise.resolve({ ok: true, value: null }); } };
  const opened = await SessionStore.openProfileStore({
    namespace: "aegis",
    adapterFactory: () => Promise.resolve(durableStore),
  });
  assert.strictEqual(opened, durableStore);

  const fallback = await SessionStore.openProfileStore({
    namespace: "aegis",
    adapterFactory: () => { throw new Error("IndexedDB is blocked"); },
  });
  assert.equal(fallback.kind, "session");

  const absent = await SessionStore.openProfileStore({ namespace: "aegis", game: {} });
  assert.equal(absent.kind, "session");
});

test("key bindings and the session store install as frozen collision-safe classic scripts", () => {
  [
    ["../js/delivery/keybindings.js", "AegisKeyBindings"],
    ["../js/delivery/session-store.js", "AegisSessionStore"],
  ].forEach(([relative, globalName]) => {
    const filename = path.join(__dirname, relative);
    const source = fs.readFileSync(filename, "utf8");
    const context = { globalThis: null };
    context.globalThis = context;
    vm.runInNewContext(source, context, { filename });
    assert.equal(Object.isFrozen(context.Game[globalName]), true, globalName);
    const conflict = { globalThis: null, Game: {} };
    conflict.Game[globalName] = {};
    conflict.globalThis = conflict;
    assert.throws(() => vm.runInNewContext(source, conflict, { filename }),
      new RegExp("Conflicting Game\\." + globalName));
  });
});
