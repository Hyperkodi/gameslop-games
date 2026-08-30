"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PreviewController = require("../js/delivery/preview-controller.js");
const MapIr = require("../../../tools/lib/aegis/map-ir.js");

const ROLE_PROOF_CONTEXT = Object.freeze({
  projectionRangeWorldUnits: 22,
  slotComparatorId: "guard-contact-v1",
  contactComparatorId: "guard-contact-v1",
  closedComparatorIds: Object.freeze([
    "base-speed-desc",
    "guard-contact-v1",
    "hp-plus-shields-desc",
    "immutable-enemy-id-asc",
    "remaining-route-distance-asc",
    "secondary-route-front-v1",
    "threat-priority-desc",
  ]),
  eligibleDefenseTagIds: Object.freeze(["area", "control", "direct", "guard", "support"]),
  requireGuardProofs: true,
});

function frozen(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => frozen(value[key]));
  return Object.freeze(value);
}

function normalizedMissionMap(id) {
  const source = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "content", "maps", id + ".slice-v1.json"),
    "utf8"
  ));
  return MapIr.normalizeMapForV3(source, { roleProofContext: ROLE_PROOF_CONTEXT });
}

function fixtureRuntime(kernelOverrides, configure) {
  const sentinel = {
    id: "sentinel",
    nameKey: "defense.sentinel.name",
    roleKey: "defense.sentinel.role",
    weaknessKey: "defense.sentinel.weakness",
    targetKinds: ["air", "ground"],
    allowedTargetPolicyIds: ["FAST", "FRONT", "STRONG"],
    defaultTargetPolicyId: "FRONT",
    levels: [
      {
        purchase: { kind: "build", costAether: 60 },
        rangeWorldUnits: 22000,
        behaviors: [{
          contractId: "direct",
          parameters: {
            baseDamage: 8000,
            cooldownMs: 450,
            consecutiveHitCounter: null,
          },
        }],
      },
      {
        purchase: { kind: "upgrade", costAether: 55 },
        rangeWorldUnits: 24000,
        behaviors: [{
          contractId: "direct",
          parameters: {
            baseDamage: 12000,
            cooldownMs: 410,
            consecutiveHitCounter: null,
          },
        }],
      },
    ],
  };
  const chronos = {
    id: "chronos",
    nameKey: "defense.chronos.name",
    roleKey: "defense.chronos.role",
    weaknessKey: "defense.chronos.weakness",
    targetKinds: ["air", "ground"],
    allowedTargetPolicyIds: ["FRONT"],
    defaultTargetPolicyId: "FRONT",
    levels: [{
      purchase: { kind: "build", costAether: 75 },
      rangeWorldUnits: 24000,
      behaviors: [
        { contractId: "direct", parameters: { baseDamage: 2000, cooldownMs: 900, consecutiveHitCounter: null } },
        { contractId: "slow", parameters: { magnitudeBp: 3200, durationMs: 1200, echoCounter: null } },
      ],
    }],
  };
  const content = {
    contentVersion: "slice-dev-v1",
    campaignRules: {
      difficultyPresets: [
        { id: "story", integrity: 25 },
        { id: "strategos", integrity: 20 },
        { id: "titan", integrity: 15 },
      ],
    },
    defenseUnlockGrantMappings: [
      { defenseId: "chronos", accessGrantId: "campaign.chronos" },
      { defenseId: "sentinel", accessGrantId: "campaign.sentinel" },
    ],
    defenses: { chronos, sentinel },
    enemies: {
      raider: { id: "raider", nameKey: "enemy.raider.name" },
    },
    bosses: {},
    missions: {
      m01: {
        id: "m01",
        titleKey: "m01.title",
        mapId: "m01",
        availableDefenseIds: ["chronos", "sentinel"],
        tutorial: { upgradeGateMode: "m01-wave1" },
        waves: [{ index: 1 }],
      },
    },
    maps: {
      m01: {
        schemaVersion: 2,
        id: "m01",
        sourceKind: "campaign",
        board: { widthWorldUnits: 160, heightWorldUnits: 100 },
        road: { widthMilliUnits: 12000 },
        laneSegments: [{
          id: "lane.main",
          kind: "ground",
          layerId: "surface",
          routeIds: ["route.main"],
          compiled: {
            length: 260000,
            subsegments: [
              { index: 0, start: 0, length: 52000, fromX: -6000, fromY: 22000, toX: 46000, toY: 22000, deltaX: 52000, deltaY: 0 },
              { index: 1, start: 52000, length: 52000, fromX: 46000, fromY: 22000, toX: 46000, toY: 74000, deltaX: 0, deltaY: 52000 },
              { index: 2, start: 104000, length: 68000, fromX: 46000, fromY: 74000, toX: 114000, toY: 74000, deltaX: 68000, deltaY: 0 },
              { index: 3, start: 172000, length: 36000, fromX: 114000, fromY: 74000, toX: 114000, toY: 38000, deltaX: 0, deltaY: -36000 },
              { index: 4, start: 208000, length: 52000, fromX: 114000, fromY: 38000, toX: 166000, toY: 38000, deltaX: 52000, deltaY: 0 },
            ],
          },
        }],
        routes: [{ id: "route.main", kind: "ground", length: 260000, laneSegmentIds: ["lane.main"] }],
        joins: [],
        crossings: [],
        pads: [
          {
            id: "p01", x: 14000, y: 38000, selectionOrder: 0, intent: "early",
            declaredQuality: "standard", claimedRouteIds: ["route.main"],
          },
          {
            id: "p02", x: 62000, y: 34000, selectionOrder: 1, intent: "bend",
            declaredQuality: "strong", claimedRouteIds: ["route.main"],
          },
        ],
        anchors: [
          { id: "entry.west", kind: "entry", x: -6000, y: 22000 },
          { id: "gate.east", kind: "gate", x: 166000, y: 38000 },
        ],
      },
    },
  };
  const presentation = {
    strings: [
      { key: "m01.title", value: "Gate of Dawn", placeholders: [] },
      { key: "enemy.raider.name", value: "Bronze Raider", placeholders: [] },
      { key: "defense.sentinel.name", value: "Sentinel", placeholders: [] },
      { key: "defense.sentinel.role", value: "Focused ground and air damage.", placeholders: [] },
      { key: "defense.sentinel.weakness", value: "Dense armor and crowds.", placeholders: [] },
      {
        key: "defense.sentinel.l1.description",
        value: "Fires {damage} damage every {cooldownMs} ms within range {range}.",
        placeholders: [
          { name: "damage", type: "integer" },
          { name: "cooldownMs", type: "integer" },
          { name: "range", type: "integer" },
        ],
      },
      {
        key: "defense.sentinel.l2.description",
        value: "Fires {damage} damage every {cooldownMs} ms within range {range}.",
        placeholders: [
          { name: "damage", type: "integer" },
          { name: "cooldownMs", type: "integer" },
          { name: "range", type: "integer" },
        ],
      },
      { key: "defense.chronos.name", value: "Chronos", placeholders: [] },
      { key: "defense.chronos.role", value: "Persistent soft control.", placeholders: [] },
      { key: "defense.chronos.weakness", value: "Low direct damage.", placeholders: [] },
      {
        key: "defense.chronos.l1.description",
        value: "Deals {damage} every {cooldownMs} ms and slows {slowPercent}% for {durationMs} ms.",
        placeholders: [
          { name: "damage", type: "integer" },
          { name: "cooldownMs", type: "integer" },
          { name: "slowPercent", type: "integer" },
          { name: "durationMs", type: "integer" },
        ],
      },
    ],
  };
  if (typeof configure === "function") configure(content, presentation);
  const kernel = Object.assign({
    createInitialState() { throw new Error("test kernel createInitialState was not supplied"); },
    advanceTick() { throw new Error("test kernel advanceTick was not supplied"); },
  }, kernelOverrides || {});
  return frozen({
    binding: { rulesetHash: "sha256:" + "e".repeat(64) },
    commands: {
      normalizeCommand(command) { return frozen(Object.assign({}, command)); },
    },
    content,
    descriptor: { id: "slice-dev-v1", contentIds: ["m01"] },
    economy: { sellRefund(invested) { return Math.floor(invested * 70 / 100); } },
    kernel,
    presentation,
    release: {
      contentVersion: "slice-dev-v1",
      eventSchemaVersion: 1,
      approvalState: "candidate-balance",
    },
    simulation: {
      DAMAGE_SCALE: 1000,
      DISTANCE_SCALE: 1000,
      TICKS_PER_SECOND: 60,
    },
  });
}

test("tower cards expose compiled cost, damage, cadence, range, targeting, and descriptions", () => {
  const runtime = fixtureRuntime();
  const sentinel = PreviewController.defenseView(runtime, "sentinel", 1);
  assert.equal(sentinel.name, "Sentinel");
  assert.equal(sentinel.costAether, 60);
  assert.equal(sentinel.damage, "8");
  assert.equal(sentinel.attacksPerSecond, "2.22");
  assert.equal(sentinel.range, "22");
  assert.deepEqual(sentinel.targetKinds, ["air", "ground"]);
  assert.equal(sentinel.description, "Fires 8 damage every 450 ms within range 22.");
  assert.match(sentinel.role, /Focused/);
  assert.match(sentinel.weakness, /armor/);
  assert.equal(sentinel.thumbnail.kind, "atlas");
  assert.equal(sentinel.thumbnail.href, "art/v2/m01/towers/sentinel-anim-v1.webp");
  assert.equal(sentinel.thumbnail.frame.frameName, "idleA");
  assert.equal(sentinel.thumbnail.frame.level, 1);
  assert.equal(sentinel.thumbnail.frame.column, 0);
  assert.equal(sentinel.thumbnail.frame.row, 0);

  const chronos = PreviewController.defenseView(runtime, "chronos", 1);
  assert.equal(chronos.costAether, 75);
  assert.equal(chronos.description, "Deals 2 every 900 ms and slows 32% for 1200 ms.");
});

test("preview header derives loadout grants and tutorial mode from compiled content", () => {
  const runtime = fixtureRuntime();
  const header = PreviewController.createHeader(runtime, {
    missionId: "m01",
    difficultyId: "titan",
    seed: 4294967295,
    loadoutIds: ["sentinel", "chronos"],
  });
  assert.deepEqual(header.loadoutIds, ["sentinel", "chronos"]);
  assert.deepEqual(header.accessGrantIds, ["campaign.sentinel", "campaign.chronos"]);
  assert.equal(header.loadoutSlotCap, 4);
  assert.equal(header.tutorialUpgradeGateMode, "m01-wave1");
  assert.equal(header.rulesetHash, runtime.binding.rulesetHash);
  assert.equal(header.eventSchemaVersion, 1);
  assert.equal(header.seed, 4294967295);
  assert.equal(Object.isFrozen(header), true);
});

test("battlefield projection exposes compiled routes, selectable pads, towers, and live enemy progress", () => {
  const runtime = fixtureRuntime();
  const state = frozen({
    missionId: "m01",
    tick: 37,
    routes: [{ id: "route.main", length: 104000 }],
    management: {
      towers: [{
        id: 3,
        padId: "p02",
        defenseId: "sentinel",
        level: 1,
        investedAether: 60,
        targetPolicy: "FRONT",
      }],
    },
    enemies: [{
      id: 8,
      ownerId: "raider",
      kind: "enemy",
      routeId: "route.main",
      distance: 26000,
      hpMilli: 5000,
      maximumHpMilli: 10000,
      position: { x: 46000, y: 22000 },
    }],
  });
  const projection = PreviewController.battlefieldView(runtime, state, "p02");

  assert.equal(PreviewController.VISUAL_FPS, 30, "presentation renders at a smooth rate below the 60 Hz simulation");
  assert.equal(projection.missionId, "m01");
  assert.equal(projection.tick, 37);
  assert.equal(projection.roadWidth, 12000);
  assert.deepEqual(projection.board, { x: 0, y: 0, width: 160000, height: 100000 });
  assert.deepEqual(projection.routes[0].segments, [
    { fromX: -6000, fromY: 22000, toX: 46000, toY: 22000 },
    { fromX: 46000, fromY: 22000, toX: 46000, toY: 74000 },
    { fromX: 46000, fromY: 74000, toX: 114000, toY: 74000 },
    { fromX: 114000, fromY: 74000, toX: 114000, toY: 38000 },
    { fromX: 114000, fromY: 38000, toX: 166000, toY: 38000 },
  ]);
  assert.equal(projection.pads[1].id, "p02");
  assert.equal(projection.pads[1].selected, true);
  assert.deepEqual(projection.pads[0].foundation, {
    kind: "image",
    href: "art/v2/m01/foundation-attican-v1.webp",
  });
  assert.equal(projection.pads[1].foundation, null,
    "the neutral foundation image replaces only an empty M01 site's vector core");
  assert.equal(Object.hasOwn(projection.pads[0], "intent"), false,
    "player presentation must not receive the authored placement answer key");
  assert.equal(Object.hasOwn(projection.pads[0], "quality"), false,
    "player presentation must not receive declared pad quality");
  assert.equal(projection.pads[1].tower.defenseId, "sentinel");
  assert.equal(projection.pads[1].tower.level, 1);
  assert.equal(projection.pads[1].tower.name, "Sentinel");
  assert.equal(projection.pads[1].tower.range, 22000);
  assert.equal(projection.pads[1].tower.asset.kind, "atlas");
  assert.equal(projection.pads[1].tower.asset.href, "art/v2/m01/towers/sentinel-anim-v1.webp");
  assert.equal(projection.pads[1].tower.asset.metadata.id, "m01.tower.sentinel.v1");
  assert.equal(projection.enemies[0].name, "Bronze Raider");
  assert.equal(projection.enemies[0].hpBp, 5000);
  assert.equal(projection.enemies[0].progressBp, 2500);
  assert.equal(projection.enemies[0].x, 46000);
  assert.equal(projection.enemies[0].y, 22000);
  assert.equal(projection.enemies[0].asset.kind, "atlas");
  assert.equal(projection.enemies[0].asset.href, "art/v2/m01/enemies/raider-anim-v1.webp");
  assert.equal(projection.enemies[0].asset.metadata.id, "m01.enemy.raider.v1");
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.routes[0].segments), true);
  assert.equal(projection.enemies[0].displayX, 46000);
  assert.equal(projection.enemies[0].displayY, 24300, "presentation lane offset separates stacked units without changing route facts");
  assert.deepEqual(projection.viewBox, { minX: -18000, minY: -12000, width: 198400, height: 124000 });
  assert.equal(projection.roadGeometry.physicalLaneCount, 1);
  assert.equal(projection.missionArt.environment.href, "art/v2/m01/environment-gate-of-dawn-v4.webp");
});

test("all Act I tower upgrades and enemy families project animated shared atlases", () => {
  const runtime = fixtureRuntime(null, function (content, presentation) {
    ["hoplite", "oracle"].forEach(function (id) {
      const defense = JSON.parse(JSON.stringify(content.defenses.sentinel));
      defense.id = id;
      defense.nameKey = "defense." + id + ".name";
      defense.roleKey = "defense." + id + ".role";
      defense.weaknessKey = "defense." + id + ".weakness";
      content.defenses[id] = defense;
      presentation.strings.push(
        { key: defense.nameKey, value: id.toUpperCase(), placeholders: [] },
        { key: defense.roleKey, value: "Specialist role.", placeholders: [] },
        { key: defense.weaknessKey, value: "Specialist weakness.", placeholders: [] }
      );
    });
    ["echo", "guardian", "titan"].forEach(function (id) {
      content.enemies[id] = { id, nameKey: "enemy." + id + ".name" };
      presentation.strings.push({ key: "enemy." + id + ".name", value: id.toUpperCase(), placeholders: [] });
    });
    content.bosses["talos-prototype"] = {
      id: "talos-prototype",
      nameKey: "boss.talos-prototype.name",
    };
    presentation.strings.push({
      key: "boss.talos-prototype.name", value: "TALOS", placeholders: [],
    });
  });
  const enemyIds = ["echo", "guardian", "titan", "talos-prototype"];
  const projection = PreviewController.battlefieldView(runtime, frozen({
    missionId: "m01",
    tick: 18,
    routes: [{ id: "route.main", length: 104000 }],
    management: {
      towers: [
        { id: 1, padId: "p01", defenseId: "hoplite", level: 1 },
        { id: 2, padId: "p02", defenseId: "oracle", level: 2 },
      ],
    },
    enemies: enemyIds.map(function (ownerId, index) {
      return {
        id: index + 1,
        ownerId,
        kind: ownerId === "talos-prototype" ? "boss" : "enemy",
        routeId: "route.main",
        distance: 1000 * (index + 1),
        hpMilli: 10000,
        maximumHpMilli: 10000,
        position: { x: 12000 + index * 4000, y: 22000 },
      };
    }),
  }), null);

  assert.deepEqual(projection.pads.map(function (pad) {
    return pad.tower && [pad.tower.defenseId, pad.tower.asset.href, pad.tower.asset.fallbackSymbol];
  }), [
    ["hoplite", "art/v2/shared/towers/hoplite-anim-v1.webp", "H"],
    ["oracle", "art/v2/shared/towers/oracle-anim-v1.webp", "O"],
  ]);
  assert.deepEqual(projection.enemies.map(function (enemy) {
    return [enemy.ownerId, enemy.asset.href];
  }), [
    ["echo", "art/v2/shared/enemies/echo-anim-v1.webp"],
    ["guardian", "art/v2/shared/enemies/guardian-anim-v1.webp"],
    ["titan", "art/v2/shared/enemies/titan-anim-v1.webp"],
    ["talos-prototype", "art/v2/shared/enemies/talos-anim-v1.webp"],
  ]);
});

test("Act I battlefield projection binds exact M04 and M05 art to physical lanes", () => {
  const maps = {
    m04: normalizedMissionMap("m04"),
    m05: normalizedMissionMap("m05"),
  };
  const runtime = fixtureRuntime(null, function (content, presentation) {
    ["m04", "m05"].forEach(function (id) {
      content.maps[id] = maps[id];
      content.missions[id] = {
        id,
        titleKey: id + ".title",
        mapId: id,
        availableDefenseIds: ["chronos", "sentinel"],
        tutorial: { kind: "none" },
        waves: [{ index: 1 }],
      };
      presentation.strings.push({ key: id + ".title", value: id.toUpperCase(), placeholders: [] });
    });
  });

  function project(id) {
    return PreviewController.battlefieldView(runtime, frozen({
      missionId: id,
      tick: 0,
      routes: maps[id].routes.map(function (route) { return { id: route.id, length: route.length }; }),
      management: { towers: [] },
      enemies: [],
    }), null);
  }

  const harbor = project("m04");
  assert.equal(harbor.missionArt.environment.href,
    "art/v2/m04/environment-piraeus-switchyard-v1.webp");
  assert.equal(harbor.missionArt.road.asset.href,
    "art/v2/m04/road-harbor-limestone-v1.webp");
  assert.equal(harbor.missionArt.road.physicalLaneCount, 3);
  assert.deepEqual(harbor.missionArt.road.widths, {
    coreMilliUnits: 8000,
    shoulderedMilliUnits: 12000,
    ambientOcclusionMilliUnits: 14000,
  });
  assert.deepEqual(harbor.missionArt.road.lanePieces.map(function (lane) {
    return lane.laneSegmentId;
  }), ["lane.north.approach", "lane.shared.trunk", "lane.south.approach"]);
  assert.equal(harbor.missionArt.road.joinCaps.length, 1);
  assert.ok(harbor.pads.every(function (pad) {
    return pad.foundation && pad.foundation.href === "art/v2/m01/foundation-attican-v1.webp";
  }));

  const foundry = project("m05");
  assert.equal(foundry.missionArt.environment.href,
    "art/v2/m05/environment-bronze-warden-v1.webp");
  assert.equal(foundry.missionArt.road.asset.href,
    "art/v2/m05/road-foundry-blackstone-v1.webp");
  assert.equal(foundry.missionArt.road.physicalLaneCount, 1);
  assert.equal(foundry.missionArt.road.lanePieces[0].laneSegmentId, "lane.spiral");
  assert.deepEqual(foundry.viewBox, { minX: -18000, minY: -12000, width: 198400, height: 124000 });
});

test("terminal results create a local 1200 by 675 Armara card model", () => {
  const runtime = fixtureRuntime();
  const victory = PreviewController.resultCardModel(runtime, frozen({
    missionId: "m01",
    difficultyId: "strategos",
    outcome: "victory",
    score: 12345,
    integrity: 14,
    management: { clearedWaves: 0 },
  }));
  assert.deepEqual(victory, {
    schemaVersion: 1,
    widthPx: 1200,
    heightPx: 675,
    outcome: "victory",
    missionTitle: "Gate of Dawn",
    score: 12345,
    waves: { cleared: 1, total: 1 },
    gateHealth: { current: 14, max: 20 },
    challengeLine: null,
    replay: null,
  });
  assert.equal(Object.isFrozen(victory), true);

  const defeat = PreviewController.resultCardModel(runtime, frozen({
    missionId: "m01",
    difficultyId: "titan",
    outcome: "defeat",
    score: 900,
    integrity: 0,
    management: { clearedWaves: 0 },
  }));
  assert.deepEqual(defeat.waves, { cleared: 0, total: 1 });
  assert.deepEqual(defeat.gateHealth, { current: 0, max: 15 });
  assert.throws(function () {
    PreviewController.resultCardModel(runtime, {
      missionId: "m01",
      outcome: "active",
      management: { clearedWaves: 0 },
    });
  }, /terminal authoritative kernel state/i);
});

test("planning recomputes one canonical bucket and pause makes zero advanceTick calls", () => {
  const calls = [];
  function planningState(overrides) {
    return frozen(Object.assign({
      tick: 0,
      outcome: "active",
      management: {
        phase: "planning",
        aether: 150,
        towers: [],
      },
    }, overrides));
  }
  const initial = planningState();
  const runtime = fixtureRuntime({
    createInitialState() { return initial; },
    advanceTick(_binding, base, commands) {
      calls.push({ base, commands: commands.slice() });
      if (base.management.phase === "planning") {
        const buildCount = commands.filter((command) => command.type === "build").length;
        const started = commands.some((command) => command.type === "startWave");
        return frozen({
          events: [],
          state: planningState({
            tick: started ? 1 : 0,
            management: {
              phase: started ? "wave" : "planning",
              aether: 150 - buildCount * 60,
              towers: [],
            },
          }),
          telemetry: [],
        });
      }
      return frozen({
        events: [],
        state: planningState({
          tick: base.tick + 1,
          management: Object.assign({}, base.management, { phase: "wave" }),
        }),
        telemetry: [],
      });
    },
  });
  const session = PreviewController.createSession(runtime, {});

  session.command({ type: "build", padId: "p01", defenseId: "sentinel" });
  session.command({ type: "build", padId: "p02", defenseId: "sentinel" });
  assert.equal(calls.length, 2);
  assert.strictEqual(calls[0].base, initial);
  assert.strictEqual(calls[1].base, initial, "planning edits must replay from the same canonical base state");
  assert.deepEqual(calls[1].commands.map((command) => command.seq), [0, 1]);
  assert.equal(session.state.tick, 0, "planning management does not advance the simulation clock");

  session.command({ type: "startWave" });
  assert.equal(session.state.tick, 1);
  assert.equal(session.state.management.phase, "wave");
  assert.deepEqual(calls[2].commands.map((command) => command.seq), [0, 1, 2]);
  assert.deepEqual(session.inputs.map((command) => [command.tick, command.seq, command.type]), [
    [0, 0, "build"],
    [0, 1, "build"],
    [0, 2, "startWave"],
  ]);

  session.pause();
  const beforePauseStep = calls.length;
  const pausedResult = session.step();
  assert.equal(pausedResult.advanced, false);
  assert.equal(calls.length, beforePauseStep, "pause must be implemented by not calling advanceTick");
  session.command({ type: "sell", towerId: 1 });
  assert.equal(session.pendingCommandCount, 1, "management commands queue at the suspended simulation tick");
  assert.equal(session.step().advanced, false);
  assert.equal(calls.length, beforePauseStep, "a queued management command still cannot advance while paused");

  session.resume();
  const resumedResult = session.step();
  assert.equal(resumedResult.advanced, true);
  assert.equal(calls.length, beforePauseStep + 1);
  assert.deepEqual(calls.at(-1).commands.map((command) => command.type), ["sell"]);
  assert.equal(session.state.tick, 2);
});

/* ------------------------------------------------- tower firing animation */

const M01_PADS = Object.freeze([
  ["p01", 14000, 38000], ["p02", 62000, 34000], ["p03", 30000, 58000],
  ["p04", 66000, 58000], ["p05", 62000, 90000], ["p06", 82000, 90000],
  ["p07", 102000, 90000], ["p08", 98000, 54000], ["p09", 126000, 22000],
  ["p10", 146000, 54000],
]);

function m01PadRuntime() {
  return fixtureRuntime(null, function (content, presentation) {
    content.maps.m01.pads = M01_PADS.map(function (pad, index) {
      return {
        id: pad[0],
        x: pad[1],
        y: pad[2],
        selectionOrder: index,
        intent: index === 3 || index === 7 ? "double-pass" : "mid",
        declaredQuality: index === 3 || index === 7 ? "strong" : "standard",
        claimedRouteIds: ["route.main"],
      };
    });
    content.defenses.shortreach = {
      id: "shortreach",
      nameKey: "defense.shortreach.name",
      roleKey: "defense.shortreach.role",
      weaknessKey: "defense.shortreach.weakness",
      targetKinds: ["ground"],
      allowedTargetPolicyIds: ["FRONT"],
      defaultTargetPolicyId: "FRONT",
      levels: [{
        purchase: { kind: "build", costAether: 40 },
        rangeWorldUnits: 20000,
        behaviors: [{
          id: "shot",
          contractId: "direct",
          parameters: { baseDamage: 4000, cooldownMs: 500, consecutiveHitCounter: null },
        }],
      }],
    };
    presentation.strings.push(
      { key: "defense.shortreach.name", value: "Short Reach", placeholders: [] },
      { key: "defense.shortreach.role", value: "Close guard.", placeholders: [] },
      { key: "defense.shortreach.weakness", value: "Short reach.", placeholders: [] }
    );
  });
}

/* One sentinel on p02 whose kernel cooldown timer is the only animation input. */
function towerState(remainingUnits, tick) {
  return frozen({
    missionId: "m01",
    tick: tick === undefined ? 0 : tick,
    routes: [{ id: "route.main", length: 260000 }],
    management: {
      towers: [{ id: 3, padId: "p02", defenseId: "sentinel", level: 1, investedAether: 60 }],
    },
    timers: remainingUnits === null ? [] : [{
      towerRuntimeId: 3,
      createdTick: 0,
      defenseId: "sentinel",
      level: 1,
      behaviorStates: [{
        behaviorId: "shot",
        dispatchId: "direct.v1",
        index: 0,
        state: {},
        timer: { remainingUnits: remainingUnits },
      }],
    }],
    enemies: [],
  });
}

function towerVisual(state, options) {
  return PreviewController.battlefieldView(
    fixtureRuntime(), state, null, options || {}
  ).pads[1].tower;
}

test("tower artwork uses authored firing and recovery frames from the kernel cooldown", () => {
  /* Sentinel level 1 cooldown is 450 authored ms, so 27000 canonical time units. */
  assert.equal(towerVisual(towerState(27000)).action, "active",
    "a cooldown that has just reset means the tower fired this tick");
  assert.equal(towerVisual(towerState(26000)).action, "active");
  assert.equal(towerVisual(towerState(20000)).action, "recover",
    "the recovery effect follows the firing burst before the tower settles");
  assert.equal(towerVisual(towerState(12000)).action, "idle");
  assert.equal(towerVisual(towerState(0)).action, "idle");
  assert.equal(towerVisual(towerState(null)).action, "idle");
  assert.deepEqual([27000, 26000, 20000, 12000, 0, null].map(function (remaining) {
    return towerVisual(towerState(remaining)).frameName;
  }), ["active", "active", "recover", "idleA", "idleA", "idleA"]);
  assert.deepEqual(towerVisual(towerState(12000)), towerVisual(towerState(12000, 0)),
    "the same canonical facts always produce the same pose");
});

test("idle towers hold one clean atlas cell instead of cycling generated poses", () => {
  const frames = [];
  for (let tick = 0; tick < 240; tick += 1) frames.push(towerVisual(towerState(0, tick)).frameName);
  assert.deepEqual(Array.from(new Set(frames)), ["idleA"]);

  const runtime = fixtureRuntime();
  const state = frozen({
    missionId: "m01",
    tick: 0,
    routes: [{ id: "route.main", length: 260000 }],
    management: {
      towers: [
        { id: 1, padId: "p01", defenseId: "sentinel", level: 1 },
        { id: 2, padId: "p02", defenseId: "sentinel", level: 1 },
      ],
    },
    timers: [],
    enemies: [],
  });
  const view = PreviewController.battlefieldView(runtime, state, null, {});
  assert.equal(view.pads[0].tower.frameName, "idleA");
  assert.equal(view.pads[1].tower.frameName, "idleA");
  assert.equal(view.pads[0].tower.action, "idle");
  assert.equal(view.pads[1].tower.action, "idle");
});

test("reduced motion holds one stable tower frame and suppresses firing effects", () => {
  const options = { reduceMotion: true };
  const visuals = [
    towerVisual(towerState(27000, 0), options),
    towerVisual(towerState(20000, 11), options),
    towerVisual(towerState(0, 97), options),
    towerVisual(towerState(0, 512), options),
  ];
  assert.deepEqual(Array.from(new Set(visuals.map(function (visual) { return visual.frameName; }))), ["idleA"]);
  assert.deepEqual(Array.from(new Set(visuals.map(function (visual) { return visual.action; }))), ["idle"]);
});

/* --------------------------------------------- build-site coverage preview */

test("selecting a site projects its exact range circle and the road arcs it can affect", () => {
  const runtime = m01PadRuntime();
  const state = frozen({
    missionId: "m01",
    tick: 0,
    loadoutIds: ["sentinel", "chronos"],
    routes: [{ id: "route.main", length: 260000 }],
    management: { aether: 150, towers: [] },
    timers: [],
    enemies: [],
  });
  const selection = PreviewController.battlefieldView(runtime, state, "p04", {
    previewDefenseId: "sentinel",
  }).selection;
  assert.equal(selection.padId, "p04");
  assert.deepEqual([selection.x, selection.y], [66000, 58000]);
  assert.equal(selection.range, 22000, "the circle is the previewed tower's exact compiled range");
  assert.equal(selection.windowCount, 2);
  assert.equal(selection.hint, "Covers the road twice");
  assert.equal(selection.arcs.length, 2, "each covered stretch of road is drawn separately");
  selection.arcs.forEach(function (arc) {
    assert.equal(arc.routeId, "route.main");
    assert.ok(arc.points.length >= 2);
    arc.points.forEach(function (point) {
      assert.ok(Math.hypot(point.x - 66000, point.y - 58000) <= 22001,
        "a highlighted arc point can never fall outside the drawn range circle");
    });
  });

  const single = PreviewController.battlefieldView(runtime, state, "p05", {
    previewDefenseId: "sentinel",
  }).selection;
  assert.equal(single.windowCount, 1);
  assert.equal(single.hint, "Covers one stretch of road");
  assert.equal(single.arcs.length, 1);

  assert.equal(PreviewController.battlefieldView(runtime, state, null, {}).selection, null);
});

test("every build site carries a plain-language coverage hint and never the authoring answer key", () => {
  const runtime = m01PadRuntime();
  const state = frozen({
    missionId: "m01",
    tick: 0,
    loadoutIds: ["sentinel", "chronos"],
    routes: [{ id: "route.main", length: 260000 }],
    management: { aether: 150, towers: [] },
    timers: [],
    enemies: [],
  });
  const view = PreviewController.battlefieldView(runtime, state, null, {
    previewDefenseId: "sentinel",
  });
  assert.deepEqual(view.pads.map(function (pad) { return pad.coverage.windowCount; }),
    [1, 1, 1, 2, 1, 1, 1, 2, 1, 1],
    "the two double-pass pockets are the only sites the compiled route re-enters");
  assert.deepEqual(view.pads.map(function (pad) { return pad.coverage.hint; }), [
    "Covers one stretch of road", "Covers one stretch of road", "Covers one stretch of road",
    "Covers the road twice", "Covers one stretch of road", "Covers one stretch of road",
    "Covers one stretch of road", "Covers the road twice", "Covers one stretch of road",
    "Covers one stretch of road",
  ]);
  view.pads.forEach(function (pad) {
    assert.equal(Object.hasOwn(pad.coverage, "exposure"), false);
    assert.equal(Object.hasOwn(pad.coverage, "quality"), false);
    assert.equal(Object.hasOwn(pad.coverage, "column"), false);
    assert.doesNotMatch(pad.coverage.hint, /standard|strong|power|band|exposure|tick/i);
  });

  /* Twenty-world-unit reach never re-enters the Mission 1 route, so the hint moves with range. */
  const shortReach = PreviewController.battlefieldView(runtime, state, null,
    { previewDefenseId: "shortreach" });
  assert.deepEqual(shortReach.pads.map(function (pad) { return pad.coverage.windowCount; }),
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
});

test("an occupied site previews the built tower's own reach", () => {
  const runtime = m01PadRuntime();
  const state = frozen({
    missionId: "m01",
    tick: 0,
    loadoutIds: ["sentinel", "chronos"],
    routes: [{ id: "route.main", length: 260000 }],
    management: {
      aether: 30,
      towers: [{ id: 1, padId: "p04", defenseId: "chronos", level: 1, investedAether: 75 }],
    },
    timers: [],
    enemies: [],
  });
  const view = PreviewController.battlefieldView(runtime, state, "p04", {
    previewDefenseId: "sentinel",
  });
  assert.equal(view.selection.range, 24000, "a built tower previews its own range, not the menu's");
  assert.equal(view.selection.windowCount, 2);
  assert.equal(view.pads[3].coverage.windowCount, 2);
});

test("no em dash reaches any battle-screen string this lane owns", () => {
  const emDash = String.fromCharCode(0x2014);
  [
    path.join(__dirname, "..", "js", "delivery", "preview-controller.js"),
    path.join(__dirname, "..", "js", "presentation", "sprite-atlas.js"),
    path.join(__dirname, "..", "css", "aegis-shell.css"),
    path.join(__dirname, "..", "css", "aegis-art-system.css"),
    __filename,
  ].forEach(function (file) {
    assert.equal(fs.readFileSync(file, "utf8").includes(emDash), false, file);
  });
});
