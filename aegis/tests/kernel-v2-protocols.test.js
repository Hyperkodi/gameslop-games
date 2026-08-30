"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const ABI = require("../js/sim/abi.js");
const Kernel = require("../js/sim/kernel.js");
const Management = require("../js/sim/management.js");
const Protocols = require("../js/sim/protocols.js");
const Fixture = require("./fixtures/kernel-v2/content.js");

const fixture = Fixture.buildKernelV2Fixture();
const TICKS_PER_SECOND = ABI.TICKS_PER_SECOND;

const UNLOCK_FIELDS = [
  "schemaVersion", "eventSchemaVersion", "behaviorRegistryVersion", "commandSchemaVersion",
  "replayFormatVersion", "profileSchemaVersion", "protocolRules", "relicRules",
  "reinforcementRules", "protocols", "relics", "specializations", "reinforcements", "mechanisms",
  "grantRecords", "missionProgression",
];

const CATALOG = Protocols.adaptCompiledProtocolContent(UNLOCK_FIELDS.reduce(function (record, key) {
  record[key] = fixture.content[key];
  return record;
}, {}));

function binding() {
  return Kernel.createRulesetBinding({ release: fixture.release, content: fixture.content });
}

function richHeader(overrides) {
  return Fixture.headerV2(fixture, Object.assign({
    assist: true,
    campaignModifierIds: ["reserve-1"],
  }, overrides || {}));
}

function tierHeader(tier) {
  return richHeader({
    protocolLoadout: [{ slot: 0, protocolId: "temporal-edict", tier: tier }],
    protocolAuthority: [{ protocolId: "temporal-edict", availableTier: 3 }],
  });
}

function castCommand(tick, tier) {
  return {
    tick: tick,
    seq: 0,
    type: "activatePower",
    protocolId: "temporal-edict",
    tier: tier === undefined ? 1 : tier,
    target: { kind: "none" },
  };
}

function openWave(bound, header) {
  return Kernel.advanceTick(bound, Kernel.createInitialState(bound, header), [
    { tick: 0, seq: 0, type: "startWave" },
  ]);
}

function runTo(bound, result, targetTick) {
  let current = result;
  while (current.state.tick < targetTick) {
    current = Kernel.advanceTick(bound, current.state, []);
  }
  return current;
}

function slowEffects(state) {
  return state.effects.filter(function (effect) { return effect.statusId === "slow"; });
}

/* Cast legality and payment live in one reducer seam. These direct Management fixtures exercise
   the exact same reducer the kernel calls, without paying for thousands of simulated ticks to
   walk an eighty-second cooldown. */
function castConfig(relicModifiers) {
  return {
    abiVersion: 2,
    missionId: "m01",
    resolvedStartAether: 1000,
    tutorialUpgradeGateMode: "none",
    padIds: ["p01"],
    waveStartGrants: [0, 0],
    defenses: [{
      id: "sentinel",
      costsAether: [10, 20],
      defaultTargetPolicy: "FRONT",
      allowedTargetPolicies: ["FRONT"],
    }],
    relicModifiers: relicModifiers || [],
    specializationAccessIds: [],
    specializations: [],
  };
}

function castState(config, aether) {
  const base = Management.createManagementState(config);
  return Management.normalizeManagementState({
    schemaVersion: 2,
    missionId: base.missionId,
    aether: aether,
    bountyRemainder: 0,
    phase: "wave",
    activeWave: 1,
    clearedWaves: 0,
    tutorialUpgradeGateMode: base.tutorialUpgradeGateMode,
    tutorialUpgradeGateOpen: true,
    towers: [],
    runtimeIds: base.runtimeIds,
  }, config);
}

function castRuntime(tier, acceptedCastCount, readyTick, sharedReadyTick) {
  return {
    boardBounds: { minX: 0, minY: 0, maxX: 160000, maxY: 100000 },
    mechanism: null,
    protocolCatalog: CATALOG,
    protocolLoadout: {
      slotCap: 1,
      protocolAuthority: [{ protocolId: "temporal-edict", availableTier: 3 }],
      protocols: [{ slot: 0, protocolId: "temporal-edict", tier: tier }],
      missionLoan: null,
    },
    protocols: {
      effects: [],
      equipped: [{
        acceptedCastCount: acceptedCastCount,
        loan: false,
        protocolId: "temporal-edict",
        readyTick: readyTick,
        tier: tier,
      }],
      schedules: [],
      sharedReadyTick: sharedReadyTick,
      wardCharges: 0,
    },
    reinforcement: null,
    routes: [{ routeId: "route.main", routeLength: 100000 }],
    selectProtocolTargets: function (command) {
      if (command.target.kind !== "none") return null;
      return { protocolId: command.protocolId, target: command.target, eligibleTargetIds: [] };
    },
    supportedEffectKinds: Kernel.SUPPORTED_PROTOCOL_EFFECT_KINDS,
  };
}

function castThroughManagement(tier, acceptedCastCount, aether, relicModifiers) {
  const config = castConfig(relicModifiers);
  const state = castState(config, aether);
  return Management.applyCommandBucketV2(
    state,
    config,
    0,
    [castCommand(0, tier)],
    castRuntime(tier, acceptedCastCount, 0, 0)
  );
}

test("Temporal Edict tiers charge exactly 75, 115, and 165 Aether", () => {
  [[1, 75], [2, 115], [3, 165]].forEach(function (pair) {
    const bound = binding();
    const opened = openWave(bound, tierHeader(pair[0]));
    const before = opened.state.management.aether;
    const cast = Kernel.advanceTick(bound, opened.state, [castCommand(1, pair[0])]);
    assert.equal(cast.commandEvents[0].type, "activatePower", "tier " + pair[0]);
    assert.equal(cast.commandEvents[0].costAether, pair[1]);
    assert.equal(cast.state.management.aether, before - pair[1]);
  });
});

test("Temporal Edict tiers start 80, 95, and 110 second individual cooldowns", () => {
  [[1, 80], [2, 95], [3, 110]].forEach(function (pair) {
    const bound = binding();
    const opened = openWave(bound, tierHeader(pair[0]));
    const cast = Kernel.advanceTick(bound, opened.state, [castCommand(1, pair[0])]);
    assert.equal(
      cast.state.protocols.equipped[0].readyTick,
      1 + pair[1] * TICKS_PER_SECOND,
      "tier " + pair[0]
    );
    assert.equal(cast.state.protocols.equipped[0].acceptedCastCount, 1);
  });
});

test("every accepted cast starts the universal fifteen-second shared Protocol cooldown", () => {
  const bound = binding();
  const opened = openWave(bound, tierHeader(1));
  const cast = Kernel.advanceTick(bound, opened.state, [castCommand(1, 1)]);
  assert.equal(cast.state.protocols.sharedReadyTick, 1 + 15 * TICKS_PER_SECOND);
  const blocked = Kernel.advanceTick(bound, cast.state, [castCommand(2, 1)]);
  assert.equal(blocked.commandEvents[0].reason, "shared-cooldown");
  assert.equal(blocked.state.management.aether, cast.state.management.aether);
  assert.equal(blocked.state.protocols.equipped[0].acceptedCastCount, 1);
});

test("repeated accepted casts pay the content-locked linear 25 percent surcharge", () => {
  /* ceil(75 x (10000 + 2500 x prior) / 10000) = 75, 94, 113, 132. */
  [[0, 75], [1, 94], [2, 113], [3, 132]].forEach(function (pair) {
    const result = castThroughManagement(1, pair[0], 1000);
    assert.equal(result.events[0].type, "activatePower", "prior casts " + pair[0]);
    assert.equal(result.events[0].costAether, pair[1]);
    assert.equal(result.state.aether, 1000 - pair[1]);
    assert.equal(result.protocols.equipped[0].acceptedCastCount, pair[0] + 1);
  });
});

test("a cast is denied on its individual cooldown without payment or ledger movement", () => {
  const config = castConfig();
  const state = castState(config, 1000);
  const runtime = castRuntime(1, 1, 4800, 0);
  const result = Management.applyCommandBucketV2(
    state, config, 0, [castCommand(0, 1)], runtime
  );
  assert.equal(result.events[0].reason, "protocol-cooldown");
  assert.equal(result.state.aether, 1000);
  assert.equal(result.protocols.equipped[0].acceptedCastCount, 1);
  assert.equal(result.protocols.equipped[0].readyTick, 4800);
  assert.deepEqual(result.protocolActivations, []);
});

test("a cast the run cannot afford is denied at the exact surcharged boundary", () => {
  assert.equal(castThroughManagement(1, 1, 94).events[0].type, "activatePower");
  const denied = castThroughManagement(1, 1, 93);
  assert.equal(denied.events[0].reason, "insufficient-aether");
  assert.equal(denied.state.aether, 93);
  assert.deepEqual(denied.protocolActivations, []);
});

test("Titan Gear folds the Protocol surcharge and Relic multiplier into one ceiling", () => {
  const relicModifiers = [{
    amount: 8500,
    operation: "multiply-bp",
    rounding: "ceil",
    statId: "protocol-cost",
  }];
  /* R2: ceil(75 x 12500 x 8500 / 10^8) = 80, not ceil(ceil(75 x 1.25) x 0.85) = 80 by accident:
     the third cast separates them, ceil(75 x 15000 x 8500 / 10^8) = 96 vs a two-ceiling 97. */
  assert.equal(castThroughManagement(1, 0, 1000, relicModifiers).events[0].costAether, 64);
  assert.equal(castThroughManagement(1, 1, 1000, relicModifiers).events[0].costAether, 80);
  assert.equal(castThroughManagement(1, 2, 1000, relicModifiers).events[0].costAether, 96);
  assert.equal(castThroughManagement(3, 0, 1000, relicModifiers).events[0].costAether, 141);
});

test("an accepted global field slows every live hostile at acceptance", () => {
  const bound = binding();
  const opened = openWave(bound, tierHeader(2));
  const withEnemies = runTo(bound, opened, 4);
  assert.ok(withEnemies.state.enemies.length > 0);
  const cast = Kernel.advanceTick(bound, withEnemies.state, [castCommand(4, 2)]);
  const instances = slowEffects(cast.state);
  assert.equal(instances.length, withEnemies.state.enemies.length);
  instances.forEach(function (effect) {
    assert.equal(effect.magnitude, 5000);
    assert.equal(effect.sourceTypeId, "protocol");
    assert.equal(effect.timer.remainingUnits, 10 * ABI.TIME_UNITS_PER_SECOND);
  });
  assert.equal(cast.state.protocols.effects.length, 1);
  assert.deepEqual(cast.state.protocols.effects[0], {
    appliedTick: 4,
    carryAcrossWave: false,
    effectRuntimeId: cast.state.protocols.effects[0].effectRuntimeId,
    expiryTick: 4 + 10 * TICKS_PER_SECOND,
    kind: "global-slow-field",
    magnitudeBp: 5000,
    protocolId: "temporal-edict",
    sourceKind: "protocol",
    tier: 2,
  });
});

test("a hostile that spawns inside the field inherits the field's original expiry", () => {
  const bound = binding();
  const opened = openWave(bound, tierHeader(1));
  const cast = Kernel.advanceTick(bound, opened.state, [castCommand(1, 1)]);
  const fieldExpiry = cast.state.protocols.effects[0].expiryTick;
  let current = cast;
  let checked = 0;
  const seen = new Set(current.state.enemies.map(function (enemy) { return enemy.id; }));
  while (current.state.tick < 120 && checked < 2) {
    current = Kernel.advanceTick(bound, current.state, []);
    current.state.enemies.forEach(function (enemy) {
      if (seen.has(enemy.id)) return;
      seen.add(enemy.id);
      const instance = current.state.effects.find(function (effect) {
        return effect.statusId === "slow" && effect.targetRuntimeId === enemy.id;
      });
      assert.ok(instance, "a hostile spawned inside the field must be slowed");
      const expiryTick = instance.timer.lastExpiryTick +
        instance.timer.remainingUnits / ABI.TIME_UNITS_PER_TICK;
      assert.equal(expiryTick, fieldExpiry, "instance expiry must equal the field expiry");
      assert.ok(instance.timer.remainingUnits < 10 * ABI.TIME_UNITS_PER_SECOND);
      checked += 1;
    });
  }
  assert.equal(checked, 2);
});

test("the field expires exactly at its authored tick and publishes its resolved event", () => {
  const long = Fixture.buildLongWaveFixture();
  const bound = Kernel.createRulesetBinding({ release: long.release, content: long.content });
  const opened = Kernel.advanceTick(bound, Kernel.createInitialState(bound, tierHeader(1)), [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "startWave" },
  ]);
  const cast = Kernel.advanceTick(bound, opened.state, [castCommand(1, 1)]);
  const expiry = cast.state.protocols.effects[0].expiryTick;
  assert.equal(expiry, 1 + 10 * TICKS_PER_SECOND);
  const beforeExpiry = runTo(bound, cast, expiry);
  assert.equal(beforeExpiry.state.protocols.effects.length, 1);
  const atExpiry = Kernel.advanceTick(bound, beforeExpiry.state, []);
  assert.equal(atExpiry.state.protocols.effects.length, 0);
  assert.deepEqual(
    atExpiry.events.map(function (event) { return event.eventId; }),
    ["protocol.temporal-edict.resolved"]
  );
  assert.deepEqual(slowEffects(atExpiry.state), []);
});

test("an accepted cast publishes its accepted semantic event with exact facts", () => {
  const bound = binding();
  const opened = openWave(bound, tierHeader(3));
  const withEnemies = runTo(bound, opened, 4);
  const cast = Kernel.advanceTick(bound, withEnemies.state, [castCommand(4, 3)]);
  const accepted = cast.events.find(function (event) {
    return event.eventId === "protocol.temporal-edict.accepted";
  });
  assert.ok(accepted);
  assert.equal(accepted.phaseId, "scheduled-protocol-mechanism-resolutions-and-spawns");
  assert.equal(accepted.payload.protocolId, "temporal-edict");
  assert.equal(accepted.payload.tier, 3);
  assert.equal(accepted.payload.costAether, 165);
  assert.equal(accepted.payload.magnitudeBp, 5000);
  assert.equal(accepted.payload.durationTimeUnits, 15 * ABI.TIME_UNITS_PER_SECOND);
  assert.equal(accepted.payload.affectedEnemyCount, withEnemies.state.enemies.length);
});

function shortWaveRunToClear(tier) {
  const short = Fixture.buildShortWaveFixture();
  const bound = Kernel.createRulesetBinding({ release: short.release, content: short.content });
  let current = Kernel.advanceTick(bound, Kernel.createInitialState(bound, tierHeader(tier)), [
    { tick: 0, seq: 0, type: "startWave" },
  ]);
  current = runTo(bound, current, 5);
  current = Kernel.advanceTick(bound, current.state, [castCommand(5, tier)]);
  const cast = current;
  let cleared = null;
  let guard = 0;
  let bucket = [{ tick: 6, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" }];
  while (cleared === null && guard < 400) {
    const previousPhase = current.state.management.phase;
    current = Kernel.advanceTick(bound, current.state, bucket);
    bucket = [];
    if (previousPhase === "wave" && current.state.management.phase !== "wave") cleared = current;
    guard += 1;
  }
  return { bound: bound, cast: cast, cleared: cleared };
}

test("a temporary Protocol field ends at wave clear because it does not carry across", () => {
  const run = shortWaveRunToClear(1);
  assert.equal(run.cast.state.protocols.effects.length, 1);
  assert.equal(run.cast.state.protocols.effects[0].carryAcrossWave, false);
  assert.ok(run.cleared, "the opening wave must clear");
  assert.ok(
    run.cleared.state.tick < run.cast.state.protocols.effects[0].expiryTick,
    "the wave must clear well before the field would expire on its own"
  );
  assert.deepEqual(run.cleared.state.protocols.effects, []);
  assert.deepEqual(slowEffects(run.cleared.state), []);
  assert.ok(run.cleared.events.some(function (event) {
    return event.eventId === "protocol.temporal-edict.resolved";
  }));
});

test("planning suspends every Protocol clock and never advances the tick boundary", () => {
  const run = shortWaveRunToClear(1);
  const planningState = run.cleared.state;
  assert.equal(planningState.management.phase, "planning");
  const planningTick = planningState.tick;
  const readyTick = planningState.protocols.equipped[0].readyTick;
  const sharedReadyTick = planningState.protocols.sharedReadyTick;
  let current = run.cleared;
  for (let index = 0; index < 5; index += 1) {
    current = Kernel.advanceTick(run.bound, current.state, [
      { tick: planningTick, seq: 0, type: "skipTutorialGate" },
    ]);
    assert.equal(current.state.tick, planningTick);
    assert.deepEqual(current.phaseTrace, ["commands-and-aether-payments"]);
    assert.equal(current.state.protocols.equipped[0].readyTick, readyTick);
    assert.equal(current.state.protocols.sharedReadyTick, sharedReadyTick);
    assert.deepEqual(current.state.protocols.effects, []);
  }
});

test("a Protocol cast is denied during planning and never leaves the plan", () => {
  const bound = binding();
  const state = Kernel.createInitialState(bound, tierHeader(1));
  const result = Kernel.advanceTick(bound, state, [castCommand(0, 1)]);
  assert.equal(result.commandEvents[0].reason, "wrong-phase");
  assert.equal(result.state.management.aether, state.management.aether);
  assert.deepEqual(result.state.protocols.effects, []);
});

test("a tier that does not match the resolved loadout is denied", () => {
  const bound = binding();
  const opened = openWave(bound, tierHeader(1));
  const result = Kernel.advanceTick(bound, opened.state, [castCommand(1, 2)]);
  assert.equal(result.commandEvents[0].reason, "tier-mismatch");
  assert.equal(result.state.management.aether, opened.state.management.aether);
});

test("an unequipped Protocol is denied even when the player owns its authority", () => {
  const bound = binding();
  const opened = openWave(bound, richHeader({
    protocolLoadout: [{ slot: 0, protocolId: "temporal-edict", tier: 1 }],
    protocolAuthority: [
      { protocolId: "hades-bargain", availableTier: 1 },
      { protocolId: "temporal-edict", availableTier: 3 },
    ],
  }));
  const routeId = opened.state.routes[0].id;
  const result = Kernel.advanceTick(bound, opened.state, [{
    tick: 1, seq: 0, type: "activatePower", protocolId: "hades-bargain", tier: 1,
    target: { kind: "route-point", routeId: routeId, routeDistance: 0 },
  }]);
  assert.equal(result.commandEvents[0].reason, "protocol-unequipped");
  assert.equal(result.state.management.aether, opened.state.management.aether);
});

test("route-point, tower, and world-vector selections are not yet proven and deny", () => {
  const bound = binding();
  const opened = openWave(bound, richHeader({
    protocolLoadout: [
      { slot: 0, protocolId: "hades-bargain", tier: 1 },
      { slot: 1, protocolId: "hephaestus-overclock", tier: 1 },
    ],
    protocolSlotCap: 2,
    protocolAuthority: [
      { protocolId: "hades-bargain", availableTier: 1 },
      { protocolId: "hephaestus-overclock", availableTier: 1 },
      { protocolId: "medusa-lock", availableTier: 1 },
    ],
  }));
  const routeId = opened.state.routes[0].id;
  const routePoint = Kernel.advanceTick(bound, opened.state, [{
    tick: 1, seq: 0, type: "activatePower", protocolId: "hades-bargain", tier: 1,
    target: { kind: "route-point", routeId: routeId, routeDistance: 0 },
  }]);
  assert.equal(routePoint.commandEvents[0].reason, "missing-eligible-target");
  const towerTarget = Kernel.advanceTick(bound, routePoint.state, [{
    tick: 2, seq: 0, type: "activatePower", protocolId: "hephaestus-overclock", tier: 1,
    target: { kind: "tower", towerRuntimeId: 1 },
  }]);
  assert.equal(towerTarget.commandEvents[0].reason, "missing-eligible-target");
  assert.equal(towerTarget.state.management.aether, opened.state.management.aether);
  assert.deepEqual(towerTarget.state.protocols.effects, []);
});

test("an authored effect kind this batch cannot resolve denies instead of faking success", () => {
  const bound = binding();
  const opened = openWave(bound, richHeader({
    protocolLoadout: [{ slot: 0, protocolId: "aegis-ward", tier: 1 }],
    protocolAuthority: [{ protocolId: "aegis-ward", availableTier: 1 }],
  }));
  const result = Kernel.advanceTick(bound, opened.state, [{
    tick: 1, seq: 0, type: "activatePower", protocolId: "aegis-ward", tier: 1,
    target: { kind: "none" },
  }]);
  assert.equal(result.commandEvents[0].reason, "effect-not-implemented");
  assert.equal(result.state.management.aether, opened.state.management.aether);
  assert.equal(result.state.protocols.wardCharges, 0);
  assert.deepEqual(result.state.protocols.effects, []);
});

test("a mission-loaned Tier 1 Protocol casts from the loan record, not the equipped slots", () => {
  const bound = binding();
  const header = richHeader({
    missionId: "m04",
    tutorialUpgradeGateMode: "none",
    missionProtocolLoan: { protocolId: "temporal-edict", tier: 1 },
    protocolLoadout: [],
    protocolSlotCap: 0,
    protocolAuthority: [],
  });
  const opened = openWave(bound, header);
  const cast = Kernel.advanceTick(bound, opened.state, [castCommand(1, 1)]);
  assert.equal(cast.commandEvents[0].type, "activatePower");
  assert.equal(cast.commandEvents[0].source, "mission-loan");
  assert.equal(cast.commandEvents[0].costAether, 75);
  assert.deepEqual(cast.state.protocols.equipped, [{
    acceptedCastCount: 1,
    loan: true,
    protocolId: "temporal-edict",
    readyTick: 1 + 80 * TICKS_PER_SECOND,
    tier: 1,
  }]);
});

test("a run with no Protocol equipped reproduces the same boundary hashes on every run", () => {
  const bound = binding();
  const emptyHeader = richHeader({
    protocolLoadout: [],
    protocolSlotCap: 0,
    protocolAuthority: [],
  });
  function run() {
    let result = Kernel.advanceTick(bound, Kernel.createInitialState(bound, emptyHeader), [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "startWave" },
    ]);
    const hashes = [];
    for (let tick = 1; tick <= 40; tick += 1) {
      result = Kernel.advanceTick(bound, result.state, []);
      hashes.push(ABI.sha256Hex(ABI.canonicalBytes(result.state)));
    }
    return hashes;
  }
  assert.deepEqual(run(), run());
});

test("the same header and inputs re-simulate to identical checkpoint and final hashes", () => {
  const long = Fixture.buildLongWaveFixture();
  const inputs = [
    { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
    { tick: 0, seq: 1, type: "startWave" },
    castCommand(5, 1),
    { tick: 200, seq: 0, type: "skipTutorialGate" },
  ];
  function simulate() {
    const bound = Kernel.createRulesetBinding({ release: long.release, content: long.content });
    let result = { state: Kernel.createInitialState(bound, tierHeader(1)) };
    const checkpoints = [ABI.sha256Hex(ABI.canonicalBytes(result.state))];
    for (let tick = 0; tick <= 240; tick += 1) {
      const bucket = inputs.filter(function (command) { return command.tick === tick; });
      result = Kernel.advanceTick(bound, result.state, bucket);
      if (tick % 60 === 0) checkpoints.push(ABI.sha256Hex(ABI.canonicalBytes(result.state)));
    }
    return {
      checkpoints: checkpoints,
      finalHash: ABI.sha256Hex(ABI.canonicalBytes(result.state)),
      outcome: result.state.outcome,
      score: result.state.score,
    };
  }
  const first = simulate();
  const second = simulate();
  assert.deepEqual(first.checkpoints, second.checkpoints);
  assert.equal(first.finalHash, second.finalHash);
  assert.equal(first.outcome, second.outcome);
  assert.equal(first.score, second.score);
});
