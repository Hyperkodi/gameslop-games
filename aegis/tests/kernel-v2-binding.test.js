"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ABI = require("../js/sim/abi.js");
const ABIV2 = require("../js/sim/abi-v2.js");
const Kernel = require("../js/sim/kernel.js");
const Fixture = require("./fixtures/kernel-v2/content.js");

const V3_RELEASE = require(path.join(
  __dirname, "..", "content", "generated",
  "aegis-release.f38d130820cad7b9311de4be2fa6a262a6f59c5a276a8ad0b959692d34be239c.js"
)).RELEASE;
const V3_CONTENT = require(path.join(
  __dirname, "..", "content", "generated",
  "aegis-content.647876fbe0ea68ca972721c3c03d26d567753ec16a234cab5759985eb012c240.js"
)).CONTENT;

const fixture = Fixture.buildKernelV2Fixture();

function mutated(mutate) {
  const content = Fixture.clone(fixture.content);
  const release = Fixture.clone(fixture.release);
  mutate(content, release);
  return { content: Fixture.deepFreeze(content), release: Fixture.deepFreeze(release) };
}

function bindMutated(mutate) {
  const parts = mutated(mutate);
  return function () {
    Kernel.createRulesetBinding({ release: parts.release, content: parts.content });
  };
}

function boundFixture() {
  return Kernel.createRulesetBinding({
    release: fixture.release,
    content: fixture.content,
  });
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.keys(value).forEach(function (key) { assertDeepFrozen(value[key]); });
}

test("compiled content schema 4 binds ABI v2 and publishes its version", () => {
  const binding = boundFixture();
  assert.equal(binding.abiVersion, 2);
  assert.equal(binding.eventSchemaVersion, 2);
  assert.equal(binding.behaviorRegistryVersion, 2);
  assert.equal(binding.abiHash, "sha256:" + ABIV2.DESCRIPTOR_SHA256);
  assert.equal(binding.rulesetHash, Fixture.FIXTURE_RULESET_HASH);
  assert.equal(Object.isFrozen(binding), true);
});

test("the kernel accepts compiled act narrative and derives nothing from it (spec 18.2)", () => {
  const narrative = {
    schemaVersion: 1,
    records: [{
      index: 1,
      titleKey: "act.1.title",
      eraKey: "act.1.era",
      storyKey: "act.1.story",
      premiseKey: "act.1.premise",
      missionIds: ["m01"],
    }],
    reconRecords: [
      { tier: 0, detailKey: "recon.0.detail" },
      { tier: 1, detailKey: "recon.1.detail" },
      { tier: 2, detailKey: "recon.2.detail" },
      { tier: 3, detailKey: "recon.3.detail" },
    ],
  };
  const parts = mutated(function (content) { content.acts = narrative; });
  const withNarrative = Kernel.createRulesetBinding({ release: parts.release, content: parts.content });
  const withoutNarrative = boundFixture();

  /* The kernel binds it without reading it: the ruleset identity comes from the authenticated
     artifact bytes, which is why the two bindings agree on every derived value here. */
  assert.equal(withNarrative.abiVersion, withoutNarrative.abiVersion);
  assert.equal(withNarrative.rulesetHash, withoutNarrative.rulesetHash);
  assert.equal(withNarrative.eventSchemaVersion, withoutNarrative.eventSchemaVersion);
  assert.equal(withNarrative.behaviorRegistryVersion, withoutNarrative.behaviorRegistryVersion);
  assert.deepEqual(Object.keys(withNarrative).sort(), Object.keys(withoutNarrative).sort());
  const encoded = JSON.stringify(withNarrative);
  ["act.1.era", "act.1.story", "act.1.premise", "recon.0.detail"].forEach(function (key) {
    assert.equal(encoded.indexOf(key), -1, key + " never reaches a ruleset binding");
  });

  /* A field the compiler never emits is still rejected, so this is an accepted collection,
     not a hole in the content contract. */
  assert.throws(
    bindMutated(function (content) { content.marketingCopy = narrative; }),
    /Simulation content must contain exactly/
  );
});

test("compiled content schema 3 still binds ABI v1 with its historical identities", () => {
  const binding = Kernel.createRulesetBinding({ release: V3_RELEASE, content: V3_CONTENT });
  assert.equal(binding.abiVersion, 1);
  assert.equal(binding.eventSchemaVersion, ABI.EVENT_SCHEMA_VERSION);
  assert.equal(binding.behaviorRegistryVersion, ABI.BEHAVIOR_REGISTRY_VERSION);
});

test("a release/content schema disagreement fails closed with a stable error", () => {
  assert.throws(
    bindMutated(function (content) { content.schemaVersion = 3; }),
    /matching release\/content schema version 3 or 4/
  );
  assert.throws(
    bindMutated(function (content, release) { release.schemaVersion = 3; }),
    /matching release\/content schema version 3 or 4/
  );
  assert.throws(
    bindMutated(function (content, release) {
      content.schemaVersion = 5;
      release.schemaVersion = 5;
    }),
    /matching release\/content schema version 3 or 4/
  );
});

test("an ABI-v2 binding requires the authenticated ABI v2 descriptor digest", () => {
  assert.throws(
    bindMutated(function (content, release) {
      content.abiHash = "sha256:" + "0".repeat(64);
      release.abiHash = "sha256:" + "0".repeat(64);
    }),
    /does not match the authenticated simulation ABI v2/
  );
});

test("an ABI-v2 binding requires event schema 2 and behavior registry 2", () => {
  assert.throws(
    bindMutated(function (content, release) {
      content.eventSchemaVersion = 1;
      release.eventSchemaVersion = 1;
    }),
    /event schema does not match the simulation ABI/
  );
  assert.throws(
    bindMutated(function (content, release) {
      content.behaviorRegistryVersion = 1;
      release.behaviorRegistryVersion = 1;
    }),
    /behavior registry does not match the simulation artifact/
  );
});

test("an ABI-v2 binding requires command schema 2 and replay format 2", () => {
  assert.throws(
    bindMutated(function (content) { content.commandSchemaVersion = 1; }),
    /command\/replay identities do not match ABI v2/
  );
  assert.throws(
    bindMutated(function (content) { content.replayFormatVersion = 1; }),
    /command\/replay identities do not match ABI v2/
  );
});

test("compiled v4 defenses must publish two paid levels and one owned branch pair", () => {
  assert.throws(
    bindMutated(function (content) {
      content.defenses.sentinel.levels = content.defenses.sentinel.levels.slice(0, 1);
    }),
    /must declare two paid levels/
  );
  assert.throws(
    bindMutated(function (content) {
      content.defenses.sentinel.specializationIds = ["sentinel-lock-on"];
    }),
    /must declare two branches/
  );
  assert.throws(
    bindMutated(function (content) {
      content.defenses.sentinel.specializationIds = ["sentinel-lock-on", "chronos-time-debt"];
    }),
    /references a foreign branch/
  );
  assert.throws(
    bindMutated(function (content) {
      content.defenses.sentinel.specializationIds = ["sentinel-twin-lance", "sentinel-lock-on"];
    }),
    /must list its default first/
  );
});

test("every compiled specialization record is a complete Level-3 purchase record", () => {
  assert.throws(
    bindMutated(function (content) { content.specializations["sentinel-lock-on"].level = 2; }),
    /Specialization record does not match/
  );
  assert.throws(
    bindMutated(function (content) {
      content.specializations["sentinel-lock-on"].purchase.kind = "upgrade";
    }),
    /Specialization record does not match/
  );
  assert.throws(
    bindMutated(function (content) {
      delete content.specializations["sentinel-lock-on"].ui;
    }),
    /must contain exactly/
  );
});

test("compiled v4 missions must carry loan, mechanism, and reinforcement-marker records", () => {
  ["protocolLoan", "mechanism", "reinforcementMarkers"].forEach(function (field) {
    assert.throws(
      bindMutated(function (content) { delete content.missions.m01[field]; }),
      /is missing its unlock records/
    );
  });
  assert.throws(
    bindMutated(function (content) {
      content.missions.m01.protocolLoan = { protocolId: "temporal-edict", tier: 2 };
    }),
    /Protocol loan must be Tier 1/
  );
});

test("compiled v4 unlock collections must all be present and bounded", () => {
  ["protocolRules", "relicRules", "reinforcementRules", "protocols", "relics", "specializations",
    "reinforcements", "mechanisms", "grantRecords", "missionProgression"].forEach(function (field) {
    assert.throws(
      bindMutated(function (content) { delete content[field]; }),
      /must contain exactly|missing its unlock record/
    );
  });
});

test("a v4 semantic event catalog must use ABI v2 phases and version 2", () => {
  assert.throws(
    bindMutated(function (content) {
      content.eventCatalog["enemy.spawn"].phaseId = "commands";
    }),
    /is not an ABI v2 phase/
  );
  assert.throws(
    bindMutated(function (content) {
      content.eventCatalog["enemy.spawn"].version = 1;
    }),
    /identity\/version does not match/
  );
});

test("the ABI-v2 initial state is a deeply frozen canonical record with the exact v2 key set", () => {
  const binding = boundFixture();
  const state = Kernel.createInitialState(binding, Fixture.headerV2(fixture));
  assert.deepEqual(Object.keys(state).sort(), [
    "accessGrantIds", "assist", "campaignModifierIds", "contentVersion", "difficultyId",
    "effects", "enemies", "income", "integrity", "lineages", "loadoutIds", "loadoutSlotCap",
    "management", "mechanism", "missionId", "missionProtocolLoan", "objectiveFacts",
    "objectiveResults", "outcome", "pendingBossReleases", "pendingSpawns", "protocolAuthority",
    "protocolLoadout", "protocolSlotCap", "protocols", "reinforcement", "reinforcementId",
    "relicIds", "relicSlotCap", "relics", "rngStreams", "routes", "rulesetHash", "schemaVersion",
    "score", "scoreFacts", "seed", "specializationAccessIds", "tick", "timers",
    "tutorialUpgradeGateMode", "waveStartTick",
  ]);
  assert.equal(state.schemaVersion, Kernel.KERNEL_SCHEMA_VERSION_V2);
  assert.equal(state.management.schemaVersion, 2);
  assert.equal(state.tick, 0);
  assertDeepFrozen(state);
  assert.equal(ABI.canonicalEncode(state), ABI.canonicalEncode(JSON.parse(JSON.stringify(state))));
});

test("the initial v2 state opens every added collection empty and bounded", () => {
  const state = Kernel.createInitialState(boundFixture(), Fixture.headerV2(fixture));
  assert.deepEqual(state.protocols, {
    effects: [],
    equipped: [{
      acceptedCastCount: 0,
      loan: false,
      protocolId: "temporal-edict",
      readyTick: 0,
      tier: 1,
    }],
    schedules: [],
    sharedReadyTick: 0,
    wardCharges: 0,
  });
  assert.deepEqual(state.income, {
    protocolAetherEarned: 0,
    specializationAetherEarned: 0,
    wardPreventedIntegrity: 0,
  });
  assert.deepEqual(state.reinforcement, {
    liveUnitId: null,
    readyTick: 0,
    reinforcementId: null,
  });
  assert.deepEqual(state.mechanism, {
    activationsUsed: 0,
    mechanismId: null,
    pending: null,
    readyTick: 0,
    zones: [],
  });
  assert.deepEqual(state.relics, { schemaVersion: 1, equippedRelicIds: [], modifiers: [] });
});

test("a mission loan enters the Protocol runtime after every equipped slot", () => {
  const binding = boundFixture();
  const state = Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
    missionId: "m04",
    tutorialUpgradeGateMode: "none",
    missionProtocolLoan: { protocolId: "temporal-edict", tier: 1 },
    protocolLoadout: [{ slot: 0, protocolId: "zeus-skyfire", tier: 1 }],
    protocolAuthority: [
      { protocolId: "temporal-edict", availableTier: 3 },
      { protocolId: "zeus-skyfire", availableTier: 1 },
    ],
  }));
  assert.deepEqual(state.protocols.equipped.map(function (record) {
    return [record.protocolId, record.loan];
  }), [["zeus-skyfire", false], ["temporal-edict", true]]);
  assert.deepEqual(state.missionProtocolLoan, { protocolId: "temporal-edict", tier: 1 });
});

test("the v2 header rejects an equipped tier above its permanent authority", () => {
  const binding = boundFixture();
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      protocolLoadout: [{ slot: 0, protocolId: "temporal-edict", tier: 3 }],
      protocolAuthority: [{ protocolId: "temporal-edict", availableTier: 2 }],
    })),
    /exceeds permanent authority/
  );
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      protocolLoadout: [{ slot: 0, protocolId: "temporal-edict", tier: 1 }],
      protocolAuthority: [],
    })),
    /Cannot equip locked protocol/
  );
});

test("the v2 header must carry exactly the mission's authored Protocol loan", () => {
  const binding = boundFixture();
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      missionProtocolLoan: { protocolId: "zeus-skyfire", tier: 1 },
      protocolAuthority: [
        { protocolId: "temporal-edict", availableTier: 3 },
        { protocolId: "zeus-skyfire", availableTier: 1 },
      ],
    })),
    /does not match the authored mission loan/
  );
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      missionId: "m04",
      tutorialUpgradeGateMode: "none",
      missionProtocolLoan: null,
    })),
    /does not match the authored mission loan/
  );
});

test("the v2 header bounds Relic identity, slot cap, and order", () => {
  const binding = boundFixture();
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      relicIds: ["bronze-obol"],
      relicSlotCap: 0,
    })),
    /exceed the Relic slot cap/
  );
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      relicIds: ["not-a-relic"],
      relicSlotCap: 1,
    })),
    /Unknown Relic/
  );
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      relicIds: ["bronze-obol", "broken-aegis"],
      relicSlotCap: 2,
    })),
    /must be in strict ASCII order/
  );
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      relicIds: [],
      relicSlotCap: 3,
    })),
    /Relic slot cap cannot exceed 2/
  );
});

test("the v2 header rejects unknown reinforcement and specialization access grants", () => {
  const binding = boundFixture();
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      reinforcementId: "ghost-legion",
    })),
    /reinforcement is not in the bound release/
  );
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, {
      specializationAccessIds: ["nonexistent-branch", "sentinel-lock-on"],
    })),
    /Unknown specialization access grant/
  );
});

test("an ABI-v2 binding rejects a replay-v1 header shape", () => {
  const binding = boundFixture();
  assert.throws(
    () => Kernel.createInitialState(binding, {
      formatVersion: 1,
      rulesetHash: fixture.release.rulesetHash,
      eventSchemaVersion: 1,
      missionId: "m01",
      difficultyId: "story",
      assist: false,
      seed: 1,
      loadoutIds: ["sentinel"],
      loadoutSlotCap: 1,
      campaignModifierIds: [],
      accessGrantIds: ["campaign.sentinel"],
      tutorialUpgradeGateMode: "m01-wave1",
    }),
    /must contain exactly/
  );
  assert.throws(
    () => Kernel.createInitialState(binding, Fixture.headerV2(fixture, { formatVersion: 1 })),
    /replay format version must be 2/
  );
});

test("no simulation module reads wall-clock time or a nondeterministic generator", () => {
  const simRoot = path.join(__dirname, "..", "js", "sim");
  fs.readdirSync(simRoot).filter(function (name) {
    return name.slice(-3) === ".js";
  }).forEach(function (name) {
    const source = fs.readFileSync(path.join(simRoot, name), "utf8");
    assert.equal(/\bMath\.random\b/.test(source), false, name);
    assert.equal(/\bDate\.now\b/.test(source), false, name);
    assert.equal(/\bnew Date\b/.test(source), false, name);
    assert.equal(/\bperformance\.now\b/.test(source), false, name);
  });
});
