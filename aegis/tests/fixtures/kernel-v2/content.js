"use strict";

/* Deterministic ABI-v2 kernel fixture.

   This helper builds a compiled content-schema-4 release from the committed schema-3 slice
   artifacts plus the real `compileUnlockSimulationContent` output, so nothing here is a checked-in
   blob that can drift from the source of truth. Batch K1 owns only the kernel/management runtime;
   the alternate Level-3 branch records below deliberately reuse each family's reviewed default
   behavior contracts with different numbers, because the authored alternates land in later
   batches. */

const fs = require("node:fs");
const path = require("node:path");

const ABIV2 = require("../../../js/sim/abi-v2.js");

const AEGIS_ROOT = path.resolve(__dirname, "..", "..", "..");
const REPO_ROOT = path.resolve(AEGIS_ROOT, "..", "..");
const GENERATED_ROOT = path.join(AEGIS_ROOT, "content", "generated");
const CONTENT_V4_ROOT = path.join(AEGIS_ROOT, "content-v4");
const UnlockCompiler = require(
  path.join(REPO_ROOT, "tools", "lib", "aegis", "v4-unlock-compiler.js")
);

const FIXTURE_RULESET_HASH = "sha256:" + "a5".repeat(32);
/* The same committed schema-3 slice artifacts kernel.test.js binds. */
const RELEASE_ARTIFACT =
  "aegis-release.f38d130820cad7b9311de4be2fa6a262a6f59c5a276a8ad0b959692d34be239c.js";
const CONTENT_ARTIFACT =
  "aegis-content.647876fbe0ea68ca972721c3c03d26d567753ec16a234cab5759985eb012c240.js";
const UNLOCK_DOMAINS = [
  "protocols", "relics", "specializations", "reinforcements", "mechanisms", "progression",
];

/* Retained ABI v1 semantic events keep their authored names; the v4 catalog states the ABI v2
   phase each one now resolves in. This is the same table the kernel binds to the catalog. */
const V1_TO_V2_PHASE = {
  "commands": "commands-and-aether-payments",
  "scheduled-spawns": "spawn-movement-control-and-contact",
  "status-expiry": "expiry-and-enable-transitions",
  "movement": "spawn-movement-control-and-contact",
  "leaks": "leak-arbitration-and-ward",
  "tower-acquisition-and-attacks": "tower-and-reinforcement-acquisition-and-attacks",
  "shield-damage-and-status": "persistent-zone-pulses-and-terminal-damage",
  "guarded-boss-threshold-transition": "persistent-zone-pulses-and-terminal-damage",
  "terminal-death-execute-children-and-revival": "persistent-zone-pulses-and-terminal-damage",
  "bounty": "bounty-income-objectives-and-score-facts",
  "wave-clear": "guarded-boss-wave-mission-transition-and-event-finalization",
};

const MISSION_PROTOCOL_LOANS = {
  m04: { protocolId: "temporal-edict", tier: 1 },
};

function generatedArtifact(name) {
  const file = path.join(GENERATED_ROOT, name);
  if (!fs.existsSync(file)) throw new Error("Missing generated artifact " + name);
  return file;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function unlockRecordSet() {
  const output = {};
  UNLOCK_DOMAINS.forEach(function (domain) {
    output[domain] = JSON.parse(
      fs.readFileSync(path.join(CONTENT_V4_ROOT, domain, "binding-v1.json"), "utf8")
    );
  });
  return output;
}

function protocolEventDefinition(eventId, phaseId, payloadFields) {
  return {
    highlightTags: ["protocol"],
    id: eventId,
    payloadFields: payloadFields,
    phaseId: phaseId,
    presentationCueId: "cue.default",
    version: 2,
  };
}

function field(name, type, required) {
  return { name: name, nullable: false, required: required, type: type };
}

function protocolEventCatalogEntries(protocols) {
  const entries = {};
  protocols.forEach(function (protocol) {
    entries["protocol." + protocol.id + ".accepted"] = protocolEventDefinition(
      "protocol." + protocol.id + ".accepted",
      "scheduled-protocol-mechanism-resolutions-and-spawns",
      [
        field("protocolId", "id", true),
        field("tier", "integer", true),
        field("costAether", "integer", true),
        field("magnitudeBp", "integer", false),
        field("durationTimeUnits", "integer", false),
        field("affectedEnemyCount", "integer", false),
      ]
    );
    entries["protocol." + protocol.id + ".resolved"] = protocolEventDefinition(
      "protocol." + protocol.id + ".resolved",
      "cooldown-and-effect-decrement",
      [field("protocolId", "id", true), field("tier", "integer", true)]
    );
  });
  return entries;
}

/* The alternate branch reuses the family's reviewed Level-3 behavior contracts with different
   authored numbers. Later batches replace these with the spec 7.2 records. */
function alternateBehaviors(behaviors) {
  return behaviors.map(function (behavior) {
    const next = clone(behavior);
    if (next.parameters && typeof next.parameters.baseDamage === "number" &&
        next.parameters.baseDamage > 1000) {
      next.parameters.baseDamage = Math.floor(next.parameters.baseDamage * 9 / 10);
    }
    return next;
  });
}

function specializationRecord(source, nameKey, levelThree, isDefault) {
  return {
    behaviors: isDefault ? clone(levelThree.behaviors) : alternateBehaviors(levelThree.behaviors),
    branchRoleId: source.branchRoleId,
    defenseId: source.defenseId,
    id: source.id,
    isDefault: isDefault,
    level: 3,
    nameKey: nameKey,
    purchase: { costAether: source.level3CostAether, kind: "specialize" },
    rangeWorldUnits: isDefault
      ? levelThree.rangeWorldUnits
      : Math.max(1000, levelThree.rangeWorldUnits - 1000),
    ui: {
      branchRoleId: source.branchRoleId,
      nameKey: nameKey,
      tradeoffKey: nameKey + ".tradeoff",
    },
    unlockGrantId: source.unlockGrantId,
  };
}

let cached = null;

function buildKernelV2Fixture() {
  if (cached !== null) return cached;
  const releaseV3 = require(generatedArtifact(RELEASE_ARTIFACT)).RELEASE;
  const contentV3 = require(generatedArtifact(CONTENT_ARTIFACT)).CONTENT;
  const recordSet = unlockRecordSet();
  const unlocks = UnlockCompiler.compileUnlockSimulationContent(recordSet);
  /* The unlock compiler strips presentation copy keys, so name keys come from the same
     authored source records the compiler validated. */
  const nameKeyById = {};
  recordSet.specializations.records.forEach(function (record) {
    nameKeyById[record.id] = record.nameKey;
  });

  const content = clone(contentV3);
  const release = clone(releaseV3);
  const abiHash = "sha256:" + ABIV2.DESCRIPTOR_SHA256;

  content.schemaVersion = 4;
  release.schemaVersion = 4;
  /* Compiled v4 content declares every versioned contract it binds, exactly as
     tools/lib/aegis/v4-compiler.js emits it. */
  content.abiVersion = 2;
  content.profileSchemaVersion = 2;
  /* ABI v2 declares the version-2 behavior contract roster; compiled v4 content carries a
     byte-equal copy that the kernel authenticates against that authority. */
  content.behaviorContracts = clone(ABIV2.BEHAVIOR_CONTRACTS);
  content.abiHash = abiHash;
  release.abiHash = abiHash;
  content.eventSchemaVersion = 2;
  release.eventSchemaVersion = 2;
  content.behaviorRegistryVersion = 2;
  release.behaviorRegistryVersion = 2;
  release.rulesetHash = FIXTURE_RULESET_HASH;
  /* A schema-4 release record declares the versioned contracts it binds and the globals its
     bundle installs, exactly as tools/lib/aegis/v4-artifacts.js emits them. */
  release.abiVersion = 2;
  release.commandSchemaVersion = 2;
  release.replayFormatVersion = 2;
  release.developerOnly = true;
  release.contentIds = Object.keys(content.missions).slice().sort();
  release.requiredGlobals = [
    "AegisCommandsV2", "AegisProtocols", "AegisRelics", "AegisSimV2",
  ];

  Object.keys(content.eventCatalog).forEach(function (eventId) {
    const definition = content.eventCatalog[eventId];
    const phaseId = V1_TO_V2_PHASE[definition.phaseId];
    if (!phaseId) throw new Error("Unmapped ABI v1 event phase " + definition.phaseId);
    definition.phaseId = phaseId;
    definition.version = 2;
  });
  Object.assign(content.eventCatalog, protocolEventCatalogEntries(unlocks.protocols));

  const specializationsByDefense = {};
  unlocks.specializations.forEach(function (record) {
    if (!specializationsByDefense[record.defenseId]) specializationsByDefense[record.defenseId] = [];
    specializationsByDefense[record.defenseId].push(record);
  });

  const specializations = {};
  Object.keys(content.defenses).sort().forEach(function (defenseId) {
    const defense = content.defenses[defenseId];
    const levelThree = defense.levels[2];
    if (!levelThree || levelThree.level !== 3) {
      throw new Error("Defense " + defenseId + " has no schema-3 Level 3 record");
    }
    const sources = specializationsByDefense[defenseId];
    if (!sources || sources.length !== 2) {
      throw new Error("Defense " + defenseId + " has no authored branch pair");
    }
    const defaultSource = sources.find(function (record) { return record.isDefault; });
    const alternateSource = sources.find(function (record) { return !record.isDefault; });
    specializations[defaultSource.id] = specializationRecord(
      defaultSource, nameKeyById[defaultSource.id], levelThree, true
    );
    specializations[alternateSource.id] = specializationRecord(
      alternateSource, nameKeyById[alternateSource.id], levelThree, false
    );
    defense.levels = defense.levels.slice(0, 2);
    defense.specializationIds = [defaultSource.id, alternateSource.id];
  });

  Object.keys(content.missions).forEach(function (missionId) {
    const mission = content.missions[missionId];
    mission.protocolLoan = MISSION_PROTOCOL_LOANS[missionId] || null;
    mission.mechanism = null;
    mission.reinforcementMarkers = [];
  });

  content.commandSchemaVersion = unlocks.commandSchemaVersion;
  content.replayFormatVersion = unlocks.replayFormatVersion;
  content.profileSchemaVersion = unlocks.profileSchemaVersion;
  content.protocolRules = clone(unlocks.protocolRules);
  content.relicRules = clone(unlocks.relicRules);
  content.reinforcementRules = clone(unlocks.reinforcementRules);
  content.protocols = clone(unlocks.protocols);
  content.relics = clone(unlocks.relics);
  content.specializations = specializations;
  /* A schema-4 release enumerates its specialization IDs alongside the other included records. */
  release.includedIds = Object.assign({}, release.includedIds, {
    specializations: Object.keys(specializations).slice().sort(),
  });
  content.reinforcements = clone(unlocks.reinforcements);
  content.mechanisms = clone(unlocks.mechanisms);
  content.grantRecords = clone(unlocks.grantRecords);
  content.missionProgression = clone(unlocks.missionProgression);

  cached = {
    content: deepFreeze(content),
    release: deepFreeze(release),
    specializationIds: Object.keys(specializations).sort(),
    unlocks: unlocks,
  };
  return cached;
}

function protocolAuthority(entries) {
  return entries.slice().sort(function (left, right) {
    return left.protocolId < right.protocolId ? -1 : left.protocolId > right.protocolId ? 1 : 0;
  });
}

function headerV2(fixture, overrides) {
  const base = {
    formatVersion: 2,
    rulesetHash: fixture.release.rulesetHash,
    eventSchemaVersion: 2,
    missionId: "m01",
    difficultyId: "story",
    assist: false,
    seed: 123,
    loadoutIds: ["sentinel"],
    loadoutSlotCap: 1,
    campaignModifierIds: [],
    accessGrantIds: ["campaign.sentinel"],
    tutorialUpgradeGateMode: "m01-wave1",
    protocolLoadout: [{ slot: 0, protocolId: "temporal-edict", tier: 1 }],
    protocolSlotCap: 1,
    protocolAuthority: protocolAuthority([{ protocolId: "temporal-edict", availableTier: 3 }]),
    missionProtocolLoan: null,
    relicIds: [],
    relicSlotCap: 0,
    reinforcementId: null,
    specializationAccessIds: ["sentinel-lock-on", "sentinel-twin-lance"],
  };
  return Object.assign(base, overrides || {});
}

/* A one-hostile, one-wave variant of the same schema-4 release. Wave-clear and planning-freeze
   assertions need a wave that finishes in tens of ticks rather than thousands. */
let cachedShortWave = null;

function buildShortWaveFixture() {
  if (cachedShortWave !== null) return cachedShortWave;
  const base = buildKernelV2Fixture();
  const content = clone(base.content);
  const release = clone(base.release);
  const waves = content.missions.m01.waves.slice(0, 2).map(function (wave, index) {
    const next = clone(wave);
    next.index = index + 1;
    next.groups = [Object.assign({}, next.groups[0], { count: 1 })];
    return next;
  });
  content.missions.m01.waves = waves;
  /* One Sentinel with reviewed contracts but overwhelming authored numbers ends the wave in a
     few ticks, so wave-clear and planning-freeze assertions stay fast and exact. */
  const sentinelLevelOne = content.defenses.sentinel.levels[0];
  sentinelLevelOne.rangeWorldUnits = 1000000;
  sentinelLevelOne.behaviors.forEach(function (behavior) {
    if (behavior.contractId === "direct") behavior.parameters.baseDamage = 1000000;
  });
  cachedShortWave = {
    content: deepFreeze(content),
    release: deepFreeze(release),
  };
  return cachedShortWave;
}

/* A single long, sparse wave with an overwhelming Sentinel: at most one hostile is ever alive,
   so cooldown, surcharge, and field-expiry assertions can reach high tick boundaries cheaply. */
let cachedLongWave = null;

function buildLongWaveFixture() {
  if (cachedLongWave !== null) return cachedLongWave;
  const base = buildKernelV2Fixture();
  const content = clone(base.content);
  const release = clone(base.release);
  const wave = clone(content.missions.m01.waves[0]);
  wave.index = 1;
  wave.groups = [Object.assign({}, wave.groups[0], {
    count: 6,
    firstTick: 0,
    intervalTicks: 1200,
  })];
  content.missions.m01.waves = [wave];
  const sentinelLevelOne = content.defenses.sentinel.levels[0];
  sentinelLevelOne.rangeWorldUnits = 1000000;
  sentinelLevelOne.behaviors.forEach(function (behavior) {
    if (behavior.contractId === "direct") behavior.parameters.baseDamage = 1000000;
  });
  cachedLongWave = { content: deepFreeze(content), release: deepFreeze(release) };
  return cachedLongWave;
}

module.exports = Object.freeze({
  FIXTURE_RULESET_HASH: FIXTURE_RULESET_HASH,
  V1_TO_V2_PHASE: V1_TO_V2_PHASE,
  buildKernelV2Fixture: buildKernelV2Fixture,
  buildLongWaveFixture: buildLongWaveFixture,
  buildShortWaveFixture: buildShortWaveFixture,
  clone: clone,
  deepFreeze: deepFreeze,
  headerV2: headerV2,
});
