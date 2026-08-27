"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURE_ROOT = path.join(__dirname, "fixtures", "compiler", "v3-records");
const VALID_ROOT = path.join(FIXTURE_ROOT, "valid");
const INVALID_PRESENTATION_ROOT = path.join(FIXTURE_ROOT, "invalid-presentation");
const LIB_ROOT = path.join(REPO_ROOT, "tools", "lib", "aegis");
const { AegisContentError } = require(path.join(LIB_ROOT, "diagnostics.js"));
const Catalog = require(path.join(LIB_ROOT, "v3-rule-catalog.js"));
const Contracts = require(path.join(LIB_ROOT, "v3-record-contracts.js"));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validRecordSet() {
  return {
    approvalState: "candidate-balance",
    campaignRules: readJson(path.join(VALID_ROOT, "campaign-rules.json")),
    defenses: readJson(path.join(VALID_ROOT, "defenses.json")),
    enemies: readJson(path.join(VALID_ROOT, "enemies.json")),
    bosses: readJson(path.join(VALID_ROOT, "bosses.json")),
    missions: [
      readJson(path.join(VALID_ROOT, "missions", "m01.json")),
      readJson(path.join(VALID_ROOT, "missions", "m04.json")),
      readJson(path.join(VALID_ROOT, "missions", "m05.json")),
    ],
    eventCatalog: readJson(path.join(VALID_ROOT, "events.json")),
    stringCatalog: readJson(path.join(VALID_ROOT, "strings.json")),
    presentationCatalog: readJson(path.join(VALID_ROOT, "presentation", "slice-v1.json")),
  };
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

test("v3 closed catalogs are independent, frozen, and preserve ABI-v1 membership", () => {
  assert.equal(Catalog.EVENT_SCHEMA_VERSION, 1);
  assert.equal(Catalog.BEHAVIOR_REGISTRY_VERSION, 1);
  assert.notEqual(Catalog.EVENT_SCHEMA_VERSION_SOURCE, Catalog.COMMAND_SCHEMA_VERSION_SOURCE);
  assert.equal(Object.isFrozen(Catalog.RULE_CATALOG), true);
  assert.equal(Object.isFrozen(Catalog.RULE_CATALOG.comparatorIds), true);
  assert.equal(Object.isFrozen(Catalog.BEHAVIOR_DELIVERIES), true);

  const abi = readJson(path.join(__dirname, "..", "content", "abi", "abi-v1.json"));
  assert.deepEqual(Catalog.BEHAVIOR_CONTRACTS, abi.behaviorRegistry.contracts);
  assert.deepEqual(Catalog.TARGET_POLICY_RECORDS.FRONT.comparatorIds, [
    "remaining-route-distance-asc",
    "threat-priority-desc",
    "immutable-enemy-id-asc",
  ]);
});

test("a complete synthetic slice record set normalizes into an unshared deeply frozen graph", () => {
  const input = validRecordSet();
  assert.strictEqual(Contracts.validateSliceRecordSet, Contracts.validateNonMapSliceRecordSet);
  const normalized = Contracts.validateNonMapSliceRecordSet(input);
  assert.notStrictEqual(normalized.campaignRules, input.campaignRules);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.defenses.records[0].levels[0].behaviors), true);
  assert.equal(Object.isFrozen(normalized.missions[0].waves[0].groups[0]), true);
  assert.equal(normalized.eventSchemaVersion, 1);
  assert.equal(normalized.behaviorRegistryVersion, 1);
  assert.deepEqual(normalized.defenseUnlockGrantMappings, [
    { defenseId: "chronos", accessGrantId: "campaign.chronos" },
    { defenseId: "hoplite", accessGrantId: "campaign.hoplite" },
    { defenseId: "oracle", accessGrantId: "campaign.oracle" },
    { defenseId: "sentinel", accessGrantId: "campaign.sentinel" },
    { defenseId: "siege", accessGrantId: "campaign.siege" },
  ]);
  assert.deepEqual(normalized.defenses.records.find((record) => record.id === "sentinel").targetKinds, [
    "air",
    "ground",
  ]);
});

test("record entry points reject unknown, missing, accessor, prototype, and shared data", () => {
  const graph = validRecordSet();
  graph.campaignRules.extra = true;
  expectDiagnostic(
    () => Contracts.validateCampaignRules(graph.campaignRules),
    "SCHEMA_UNKNOWN_KEY",
    "/extra"
  );

  const missing = validRecordSet().defenses;
  delete missing.records[0].levels;
  expectDiagnostic(
    () => Contracts.validateDefenseSource(missing),
    "SCHEMA_REQUIRED",
    "/records/0/levels"
  );

  const accessor = validRecordSet().eventCatalog;
  Object.defineProperty(accessor, "records", { enumerable: true, get() { return []; } });
  expectDiagnostic(
    () => Contracts.validateEventCatalog(accessor),
    "SCHEMA_DATA_PROPERTY",
    "/records"
  );

  const inherited = Object.create({ schemaVersion: 1 });
  inherited.id = "bad";
  expectDiagnostic(() => Contracts.validateStringCatalog(inherited), "SCHEMA_OBJECT", "/");

  const inheritedArray = validRecordSet().eventCatalog;
  Object.setPrototypeOf(inheritedArray.records, { inherited: true });
  expectDiagnostic(() => Contracts.validateEventCatalog(inheritedArray), "SCHEMA_OBJECT", "/records");

  const shared = validRecordSet().defenses;
  shared.records[1].levels[0].ui = shared.records[0].levels[0].ui;
  expectDiagnostic(
    () => Contracts.validateDefenseSource(shared),
    "SCHEMA_SHARED_REFERENCE",
    "/records/1/levels/0/ui"
  );
});

test("campaign rules freeze exact difficulties, Assist, policies, rule catalog, and score cap", () => {
  let source = validRecordSet().campaignRules;
  source.difficultyPresets[0].bountyBp = 10000;
  expectDiagnostic(() => Contracts.validateCampaignRules(source), "CAMPAIGN_DIFFICULTY_LOCK");

  source = validRecordSet().campaignRules;
  source.difficultyPresets[1].availabilityId = "difficulty.story";
  expectDiagnostic(() => Contracts.validateCampaignRules(source), "CAMPAIGN_DIFFICULTY_LOCK");

  source = validRecordSet().campaignRules;
  source.assistRecord.enemySpeedBp = 9300;
  expectDiagnostic(() => Contracts.validateCampaignRules(source), "CAMPAIGN_ASSIST_LOCK");

  source = validRecordSet().campaignRules;
  source.targetPolicyRecords[1].comparatorIds.pop();
  expectDiagnostic(() => Contracts.validateCampaignRules(source), "TARGET_POLICY_LOCK");

  source = validRecordSet().campaignRules;
  source.ruleCatalog.comparatorIds.push("runtime-expression");
  expectDiagnostic(() => Contracts.validateCampaignRules(source), "RULE_CATALOG_MISMATCH");

  source = validRecordSet().campaignRules;
  source.scoreRules.unspentCapDivisor = 20;
  expectDiagnostic(() => Contracts.validateCampaignRules(source), "SCORE_RULE_LOCK");

  source = validRecordSet().campaignRules;
  [source.scoreRules.eligibleUnspentFormulaId, source.scoreRules.difficultyApplicationId] =
    [source.scoreRules.difficultyApplicationId, source.scoreRules.eligibleUnspentFormulaId];
  expectDiagnostic(() => Contracts.validateCampaignRules(source), "SCORE_RULE_LOCK");

  source = validRecordSet().campaignRules;
  source.accessGrantIds.reverse();
  expectDiagnostic(() => Contracts.validateCampaignRules(source), "SCHEMA_UNSTABLE_ORDER");
});

test("defense contracts require three complete levels and the closed delivery matrix", () => {
  let source = validRecordSet().defenses;
  source.records[0].levels.pop();
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "DEFENSE_LEVEL_COUNT");

  source = validRecordSet().defenses;
  source.records[0].levels[1].purchase.kind = "build";
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "DEFENSE_PURCHASE_KIND");

  source = validRecordSet().defenses;
  source.records[3].levels[0].behaviors[0].deliveryKind = "script";
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "BEHAVIOR_DELIVERY");

  source = validRecordSet().defenses;
  source.records[0].levels[2].behaviors[1].parameters.triggerBehaviorId = "later";
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "BEHAVIOR_TRIGGER_ORDER");

  source = validRecordSet().defenses;
  source.records[1].levels[0].behaviors[0].parameters.markerProofKind = "line";
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "BEHAVIOR_PARAMETER_VALUE");

  source = validRecordSet().defenses;
  source.summonRecords[0].acceptedContactsBeforeConsume = 2;
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "SUMMON_FIXED_MARKER_CONTRACT");

  source = validRecordSet().defenses;
  source.records.find((record) => record.id === "hoplite").levels[0].behaviors[0].parameters.activeSlotCount = 4;
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "SCHEMA_RANGE");

  source = validRecordSet().defenses;
  source.records.find((record) => record.id === "oracle").levels[0].behaviors[0].parameters.statusId = "stun";
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "BEHAVIOR_PARAMETER_VALUE");

  source = validRecordSet().defenses;
  source.records[4].levels[0].behaviors[0].parameters.unknown = true;
  expectDiagnostic(
    () => Contracts.validateDefenseSource(source),
    "SCHEMA_UNKNOWN_KEY",
    "/records/4/levels/0/behaviors/0/parameters/unknown"
  );

  source = validRecordSet().defenses;
  source.records.find((record) => record.id === "chronos").levels[0].behaviors[0].parameters.cooldownMs = 19;
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "TIMER_MINIMUM");

  source = validRecordSet().defenses;
  source.records.find((record) => record.id === "oracle").levels[0].behaviors[1].parameters.cadenceMs = 16;
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "TIMER_MINIMUM");

  source = validRecordSet().defenses;
  source.records.find((record) => record.id === "hoplite").levels[0].behaviors[0].parameters.replenishMs = 1;
  assert.doesNotThrow(() => Contracts.validateDefenseSource(source));

  assert.deepEqual(Catalog.ABI_V1_TIMER_MINIMA, {
    attackCooldownMsAtMaximumExternalRate: 20,
    uncappedPeriodicCadenceMs: 17,
  });
});

test("fixed guard events resolve through the summon contract with one consume remainder", () => {
  let source = validRecordSet().defenses;
  source.summonRecords[0].semanticEventIds = source.summonRecords[0].semanticEventIds.filter(
    (id) => id !== "guard.contact"
  );
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "SUMMON_EVENT_CONTRACT");

  source = validRecordSet().defenses;
  source.summonRecords[0].semanticEventIds.unshift("guard.bash");
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "SUMMON_EVENT_CONTRACT");
});

test("unlock grants are one-to-one and unlock-defense rewards resolve transactionally", () => {
  let graph = validRecordSet();
  graph.defenses.records[1].unlockId = graph.defenses.records[0].unlockId;
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "ACCESS_GRANT_MAPPING");

  graph = validRecordSet();
  graph.defenses.records[1].unlockId = "campaign.missing";
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "REFERENCE_UNKNOWN");

  graph = validRecordSet();
  graph.missions[0].firstClearRewards[0].defenseId = "oracle";
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "REWARD_UNLOCK_MAPPING");
});

test("regular enemies are complete, bounded, and preserve the five-enemy terminal slice", () => {
  let source = validRecordSet().enemies;
  source.records.find((record) => record.id === "echo").traits = [];
  expectDiagnostic(() => Contracts.validateSliceRecordSet({ ...validRecordSet(), enemies: source }), "SLICE_ECHO_CLOAK");

  source = validRecordSet().enemies;
  source.records[0].control.minimumMovementBp = 0;
  expectDiagnostic(() => Contracts.validateEnemySource(source), "SCHEMA_RANGE");

  source = validRecordSet().enemies;
  source.records[0].resistances = [{ damageTypeId: "kinetic", reductionBp: 3501 }];
  expectDiagnostic(() => Contracts.validateEnemySource(source), "SCHEMA_RANGE");

  source = validRecordSet().enemies;
  source.records.find((record) => record.id === "scout").deathBehavior = {
    kind: "single-revival",
    delayTicks: 1,
    restoredHpBp: 1,
    routeOffsetDistance: "0",
    lineageOwnership: "parent-lineage",
    bountyPolicy: "suppressed",
    statusIds: [],
    maximumRevivals: 1,
    semanticEventIds: [],
  };
  expectDiagnostic(() => Contracts.validateEnemySource(source), "SLICE_ENEMY_TERMINAL_ONLY");
});

test("Talos uses guarded descending thresholds, one-transition clamps, and complete phases", () => {
  let source = validRecordSet().bosses;
  source.records[0].executeBehavior.kind = "allowed";
  expectDiagnostic(() => Contracts.validateBossSource(source), "BOSS_EXECUTE_FORBIDDEN");

  source = validRecordSet().bosses;
  source.records[0].thresholdScript.parameters.maximumTransitionsPerResolvedHit = 2;
  expectDiagnostic(() => Contracts.validateBossSource(source), "BOSS_TRANSITION_LIMIT");

  source = validRecordSet().bosses;
  source.records[0].thresholdScript.parameters.thresholds[0].clampHpToThreshold = false;
  expectDiagnostic(() => Contracts.validateBossSource(source), "BOSS_THRESHOLD_CLAMP");

  source = validRecordSet().bosses;
  source.records[0].phaseRecords[1].hpUpperInclusiveBp = 4999;
  expectDiagnostic(() => Contracts.validateBossSource(source), "BOSS_PHASE_COVERAGE");

  source = validRecordSet().bosses;
  source.records[0].phaseRecords[1].id = source.records[0].phaseRecords[0].id;
  expectDiagnostic(() => Contracts.validateBossSource(source), "SCHEMA_DUPLICATE_ID");

  source = validRecordSet().bosses;
  const threshold = source.records[0].thresholdScript.parameters.thresholds[0];
  threshold.childSpawnRecords.push({
    ...clone(threshold.childSpawnRecords[0]),
    order: 1,
  });
  threshold.maximumCreateEventsPerTick = 1;
  expectDiagnostic(() => Contracts.validateBossSource(source), "CREATE_EVENT_CAP_UNDERRUN");
});

test("Talos transition events preserve unique authored semantic order", () => {
  let graph = validRecordSet();
  graph.bosses.records[0].thresholdScript.parameters.thresholds[0].transitionEventIds = [
    "talos.threshold",
    "talos.pods",
    "talos.expose",
  ];
  assert.doesNotThrow(() => Contracts.validateNonMapSliceRecordSet(graph));

  graph = validRecordSet();
  graph.bosses.records[0].thresholdScript.parameters.thresholds[0].transitionEventIds = [
    "talos.expose",
    "talos.expose",
  ];
  expectDiagnostic(() => Contracts.validateNonMapSliceRecordSet(graph), "SCHEMA_DUPLICATE_ID");
});

test("missions enforce finite ordered groups, economy, objectives, rewards, and previews", () => {
  let graph = validRecordSet();
  graph.missions[0].waves[0].groups[0].intervalTicks = 0;
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "SCHEMA_RANGE");

  graph = validRecordSet();
  graph.missions[0].waves[0].groups[0].modifierIds = ["reserve-1"];
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "GROUP_MODIFIER_UNIMPLEMENTED");

  graph = validRecordSet();
  graph.missions[0].waves[0].baseAetherEnvelope = 2;
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "WAVE_ENVELOPE_MISMATCH");

  graph = validRecordSet();
  graph.missions[0].waves[0].clearGrantAether = 1;
  graph.missions[0].waves[0].clearGrantEventId = "wave.clear";
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "FINAL_WAVE_CLEAR_GRANT");

  graph = validRecordSet();
  graph.missions[0].objectives.reverse();
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "OBJECTIVE_ORDER");

  graph = validRecordSet();
  graph.missions[2].firstClearRewards[0].slotCap = 4;
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "SLICE_REWARD_LOCK");

  graph = validRecordSet();
  graph.missions[0].previewDeclarations[0].previewEventId = "preview.echo";
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "SCHEMA_UNKNOWN_KEY");

  graph = validRecordSet();
  graph.missions[0].waves[0].previewDeclarationIds = [];
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "PREVIEW_UNUSED");

  graph = validRecordSet();
  graph.missions[0].previewDeclarations[0].semanticCueIds.push("cue.preview");
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "PRESENTATION_CUE_ASSIGNMENT");

  graph = validRecordSet();
  graph.eventCatalog.records.find((record) => record.id === "wave.deploy").payloadFields.pop();
  expectDiagnostic(() => Contracts.validateSliceRecordSet(graph), "EVENT_PAYLOAD_MISMATCH");

  const mission = validRecordSet().missions[1];
  mission.briefing.routeNoticeKeys = [];
  mission.briefing.mechanicNoticeKeys = [];
  mission.firstClearRewards.push({ ...clone(mission.firstClearRewards[0]), id: "reward.m04.reserve-again", order: 1 });
  expectDiagnostic(() => Contracts.validateMissionSource(mission), "REWARD_DUPLICATE_GRANT");
});

test("non-map preview proof stays fail closed until compiler lethality provenance exists", () => {
  let graph = validRecordSet();
  const sameWave = graph.missions[2].previewDeclarations[0];
  sameWave.previewKind = "nonlethal-semantic-event";
  sameWave.previewEventId = "boss.spawn";
  expectDiagnostic(() => Contracts.validateNonMapSliceRecordSet(graph), "PREVIEW_PROOF_UNIMPLEMENTED");
  const deferredEvent = Contracts.validateNonMapSliceRecordSet(graph, {
    previewProofMode: "defer-to-map-compiler",
  });
  assert.deepEqual(deferredEvent.pendingPreviewProofRecords, [{
    missionId: "m05",
    previewDeclarationId: "preview.m05",
    mechanicId: "talos-thresholds",
    previewKind: "nonlethal-semantic-event",
    firstLethalWaveIndex: 1,
    previewEventId: "boss.spawn",
  }]);
  assert.equal(Object.isFrozen(deferredEvent.pendingPreviewProofRecords), true);
  assert.equal(Object.isFrozen(deferredEvent.pendingPreviewProofRecords[0]), true);

  expectDiagnostic(
    () => Contracts.validateNonMapSliceRecordSet(validRecordSet(), { previewProofMode: "allow" }),
    "SCHEMA_ENUM",
    "/options/previewProofMode"
  );
  expectDiagnostic(
    () => Contracts.validateNonMapSliceRecordSet(validRecordSet(), {
      previewProofMode: "defer-to-map-compiler",
      unsafe: true,
    }),
    "SCHEMA_UNKNOWN_KEY",
    "/options/unsafe"
  );

  graph = validRecordSet();
  const mission = graph.missions[2];
  const bossWave = mission.waves[0];
  bossWave.index = 2;
  bossWave.id = "m05.w02";
  bossWave.groups[0].id = "m05.w02.g00";
  bossWave.previewDeclarationIds = [];
  const harmlessGroup = {
    ...clone(graph.missions[0].waves[0].groups[0]),
    id: "m05.w01.g00",
    routeId: "route.spiral",
  };
  mission.waves.unshift({
    id: "m05.w01",
    index: 1,
    baseAetherEnvelope: 0,
    deploymentGrantAether: 0,
    clearGrantAether: 0,
    groups: [harmlessGroup],
    previewDeclarationIds: ["preview.m05"],
    waveClearScore: 0,
    titleKey: "wave.title",
    deploymentGrantEventId: null,
    clearGrantEventId: null,
  });
  const earlierGroup = mission.previewDeclarations[0];
  earlierGroup.previewKind = "harmless-group";
  earlierGroup.previewGroupId = harmlessGroup.id;
  earlierGroup.firstLethalWaveIndex = 2;
  mission.semanticEventIds = ["boss.spawn", "enemy.spawn", "wave.deploy"];
  expectDiagnostic(() => Contracts.validateNonMapSliceRecordSet(graph), "PREVIEW_PROOF_UNIMPLEMENTED");
  const deferredGroup = Contracts.validateNonMapSliceRecordSet(graph, {
    previewProofMode: "defer-to-map-compiler",
  });
  assert.deepEqual(deferredGroup.pendingPreviewProofRecords, [{
    missionId: "m05",
    previewDeclarationId: "preview.m05",
    mechanicId: "talos-thresholds",
    previewKind: "harmless-group",
    firstLethalWaveIndex: 2,
    previewGroupId: "m05.w01.g00",
  }]);
});

test("all child references resolve globally before mission reachability checks", () => {
  const graph = validRecordSet();
  graph.bosses.records[0].thresholdScript.parameters.thresholds[0].childSpawnRecords[0].enemyId = "missing-child";
  expectDiagnostic(
    () => Contracts.validateNonMapSliceRecordSet(graph),
    "REFERENCE_UNKNOWN",
    "/bosses/records/0/thresholdScript/parameters/thresholds/0/childSpawnRecords/0/enemyId"
  );
});

test("mastery lineage tags and the m05 Talos binding resolve statically", () => {
  let graph = validRecordSet();
  graph.missions[2].objectives[2].predicate.lineageTag = "missing-tag";
  expectDiagnostic(() => Contracts.validateNonMapSliceRecordSet(graph), "MASTERY_LINEAGE_TAG");

  graph = validRecordSet();
  graph.bosses.records[0].thresholdScript.parameters.thresholds[0].childSpawnRecords[0].enemyId = "raider";
  graph.missions[2].enemyRosterIds = ["raider"];
  graph.missions[2].objectives[2].predicate.lineageTag = "swift";
  assert.doesNotThrow(() => Contracts.validateNonMapSliceRecordSet(graph));

  graph = validRecordSet();
  const finalGroup = graph.missions[2].waves[0].groups[0];
  finalGroup.spawnKind = "enemy";
  finalGroup.enemyId = "scout";
  finalGroup.spawnEventId = "enemy.spawn";
  delete finalGroup.bossId;
  graph.missions[2].semanticEventIds = ["boss.spawn", "enemy.spawn", "wave.deploy"];
  expectDiagnostic(() => Contracts.validateNonMapSliceRecordSet(graph), "SLICE_M05_TALOS");

  graph = validRecordSet();
  graph.missions[2].bossRosterIds = [];
  expectDiagnostic(() => Contracts.validateNonMapSliceRecordSet(graph), "SLICE_M05_TALOS");
});

test("every typed semantic event is bound to its narrow ABI-v1 phase role", async (t) => {
  const cases = [
    ["direct.combo", "commands"],
    ["slow.echo", "commands"],
    ["splash.center", "commands"],
    ["guard.contact", "commands"],
    ["guard.consume", "commands"],
    ["guard.create", "commands"],
    ["guard.rejected", "commands"],
    ["mark.scan", "commands"],
    ["mark.apply", "commands"],
    ["mark.expire", "commands"],
    ["reveal.remove", "commands"],
    ["shield.consume", "commands"],
    ["shield.expire", "commands"],
    ["echo.cloak", "commands"],
    ["talos.phase-enter", "commands"],
    ["talos.status", "commands"],
    ["talos.threshold", "commands"],
    ["talos.pods", "commands"],
    ["tutorial.step", "scheduled-spawns"],
  ];
  for (const [eventId, wrongPhase] of cases) {
    await t.test(eventId, () => {
      const graph = validRecordSet();
      graph.eventCatalog.records.find((record) => record.id === eventId).phaseId = wrongPhase;
      expectDiagnostic(() => Contracts.validateNonMapSliceRecordSet(graph), "EVENT_PHASE_MISMATCH");
    });
  }
});

test("on-create child events bind to scheduled spawns instead of terminal death", () => {
  let graph = validRecordSet();
  const boss = graph.bosses.records[0];
  boss.spawnBehavior = {
    kind: "ordered-children",
    trigger: "on-create",
    childSpawnRecords: [clone(boss.thresholdScript.parameters.thresholds[0].childSpawnRecords[0])],
    maximumCreateEventsPerTick: 1,
    semanticEventIds: ["zspawn.create"],
  };
  boss.semanticEventIds.push("zspawn.create");
  graph.eventCatalog.records.push({
    id: "zspawn.create",
    version: 1,
    phaseId: "scheduled-spawns",
    payloadFields: [],
    highlightTags: [],
    presentationCueId: "cue.default",
  });
  assert.doesNotThrow(() => Contracts.validateNonMapSliceRecordSet(graph));

  graph = clone(graph);
  graph.eventCatalog.records.find((record) => record.id === "zspawn.create").phaseId =
    "terminal-death-execute-children-and-revival";
  expectDiagnostic(() => Contracts.validateNonMapSliceRecordSet(graph), "EVENT_PHASE_MISMATCH");
});

test("null nested records always fail with stable Aegis diagnostics", () => {
  const cases = [
    ["tutorial", (graph) => { graph.missions[0].tutorial = null; }, "/missions/0/tutorial"],
    ["group", (graph) => { graph.missions[0].waves[0].groups[0] = null; }, "/missions/0/waves/0/groups/0"],
    ["reward", (graph) => { graph.missions[0].firstClearRewards[0] = null; }, "/missions/0/firstClearRewards/0"],
    ["threshold", (graph) => { graph.bosses.records[0].thresholdScript.parameters.thresholds[0] = null; }, "/bosses/records/0/thresholdScript/parameters/thresholds/0"],
    ["status delivery", (graph) => { graph.bosses.records[0].thresholdScript.parameters.thresholds[0].statusDeliveries[0] = null; }, "/bosses/records/0/thresholdScript/parameters/thresholds/0/statusDeliveries/0"],
  ];
  cases.forEach(function ([, mutate, diagnosticPath]) {
    const graph = validRecordSet();
    mutate(graph);
    expectDiagnostic(
      () => Contracts.validateNonMapSliceRecordSet(graph),
      "SCHEMA_OBJECT",
      diagnosticPath
    );
  });
});

test("events and strings reject unsafe payload schemas and placeholder drift", () => {
  let source = validRecordSet().eventCatalog;
  source.records[0].phaseId = "renderer-frame";
  expectDiagnostic(() => Contracts.validateEventCatalog(source), "REFERENCE_UNKNOWN");

  source = validRecordSet().eventCatalog;
  source.records[0].payloadFields = [
    { name: "value", type: "number", required: true, nullable: false },
  ];
  expectDiagnostic(() => Contracts.validateEventCatalog(source), "SCHEMA_ENUM");

  let strings = validRecordSet().stringCatalog;
  strings.entries.find((entry) => entry.key === "wave.title").value = "Wave {missing}";
  expectDiagnostic(() => Contracts.validateStringCatalog(strings), "STRING_PLACEHOLDER_MISMATCH");

  strings = validRecordSet().stringCatalog;
  strings.entries[0].value = "<b>unsafe</b>";
  expectDiagnostic(() => Contracts.validateStringCatalog(strings), "STRING_HTML_FORBIDDEN");

  assert.doesNotThrow(() => Contracts.validateStringCatalog({
    schemaVersion: 1,
    id: "long-string-key",
    locale: "en",
    fallbackLocale: null,
    entries: [{ key: "a".repeat(96), value: "safe", placeholders: [] }],
  }));
});

test("presentation schema v1 accepts only procedural packs and semantic fallback cues", () => {
  const valid = readJson(path.join(VALID_ROOT, "presentation", "slice-v1.json"));
  const normalized = Contracts.validatePresentationCatalog(valid, {
    approvalState: "candidate-balance",
    missionIds: ["m01", "m04", "m05"],
    missionPackRecords: [
      { missionId: "m01", presentationPackId: "pack.slice" },
      { missionId: "m04", presentationPackId: "pack.slice" },
      { missionId: "m05", presentationPackId: "pack.slice" },
    ],
    cueIds: ["cue.default"],
  });
  assert.equal(Object.isFrozen(normalized.packRecords[0].missionIds), true);

  const cases = [
    ["bad-kind.json", "PRESENTATION_KIND"],
    ["bad-order.json", "SCHEMA_UNSTABLE_ORDER"],
    ["duplicate-assignment.json", "PRESENTATION_MISSION_ASSIGNMENT"],
    ["asset-field.json", "SCHEMA_UNKNOWN_KEY"],
  ];
  cases.forEach(function ([file, code]) {
    const value = readJson(path.join(INVALID_PRESENTATION_ROOT, file));
    expectDiagnostic(() => Contracts.validatePresentationCatalog(value, {
      approvalState: "candidate-balance",
      missionIds: ["m01", "m04", "m05"],
      missionPackRecords: [
        { missionId: "m01", presentationPackId: "pack.slice" },
        { missionId: "m04", presentationPackId: "pack.slice" },
        { missionId: "m05", presentationPackId: "pack.slice" },
      ],
      cueIds: ["cue.default"],
    }), code);
  });

  const production = readJson(path.join(INVALID_PRESENTATION_ROOT, "production-approved.json"));
  expectDiagnostic(
    () => Contracts.validatePresentationCatalog(production.catalog, {
      approvalState: production.approvalState,
      missionIds: ["m01", "m04", "m05"],
      missionPackRecords: [],
      cueIds: ["cue.default"],
    }),
    "PRESENTATION_PRODUCTION_FORBIDDEN"
  );

  let getterCalled = false;
  const hostileOptions = {
    approvalState: "candidate-balance",
    missionIds: ["m01", "m04", "m05"],
    missionPackRecords: [],
    cueIds: ["cue.default"],
    unknown: true,
  };
  Object.defineProperty(hostileOptions, "approvalState", {
    enumerable: true,
    get: function () { getterCalled = true; return "candidate-balance"; },
  });
  expectDiagnostic(() => Contracts.validatePresentationCatalog(valid, hostileOptions), "SCHEMA_DATA_PROPERTY");
  assert.equal(getterCalled, false);
  expectDiagnostic(() => Contracts.validatePresentationCatalog(valid), "SCHEMA_TYPE", "/options");
});

test("normalized records preserve strict-parser null prototypes without laundering", () => {
  const source = validRecordSet().eventCatalog;
  const inert = Object.assign(Object.create(null), source);
  inert.records = source.records.map(function (record) {
    return Object.assign(Object.create(null), record);
  });
  const normalized = Contracts.validateEventCatalog(inert);
  assert.equal(Object.getPrototypeOf(normalized), null);
  assert.equal(Object.getPrototypeOf(normalized.records[0]), null);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.records[0]), true);
});

test("hard source bounds and positive/zero distinctions fail before normalization", () => {
  let source = validRecordSet().defenses;
  source.records[0].levels[0].rangeWorldUnits = "0";
  expectDiagnostic(() => Contracts.validateDefenseSource(source), "SCHEMA_RANGE");

  source = validRecordSet().enemies;
  source.records[0].hp = "1.0000";
  expectDiagnostic(() => Contracts.validateEnemySource(source), "DECIMAL_FORMAT");

  const events = validRecordSet().eventCatalog;
  events.records = Array.from({ length: 1001 }, function (_, index) {
    return {
      id: "event." + String(index).padStart(4, "0"),
      version: 1,
      phaseId: "commands",
      payloadFields: [],
      highlightTags: [],
      presentationCueId: "cue.default",
    };
  });
  expectDiagnostic(() => Contracts.validateEventCatalog(events), "SCHEMA_LIMIT");
});
