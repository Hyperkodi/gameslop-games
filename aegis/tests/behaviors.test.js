"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const Effects = require("../js/sim/effects.js");
const BEHAVIORS_PATH = path.join(__dirname, "..", "js", "sim", "behaviors.js");
const Behaviors = require(BEHAVIORS_PATH);
const scenarios = require("./fixtures/behaviors/scenarios.json");

const CONTENT_ROOT = path.join(__dirname, "..", "content");
const defensesSource = require(path.join(CONTENT_ROOT, "defenses", "slice-v1.json"));
const enemiesSource = require(path.join(CONTENT_ROOT, "enemies", "slice-v1.json"));
const bossesSource = require(path.join(CONTENT_ROOT, "bosses", "slice-v1.json"));
const eventsSource = require(path.join(CONTENT_ROOT, "events", "slice-v1.json"));

const LIMITS = Object.freeze({ maxEntities: 64, maxEvents: 64, maxTargets: 16 });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compileDecimal(value, scale) {
  return typeof value === "string" ? ABI.parseExactDecimal(value, scale) : value;
}

function compileParameters(parameters) {
  const output = clone(parameters);
  ["baseDamage", "contactDamage"].forEach(function (field) {
    if (Object.prototype.hasOwnProperty.call(output, field)) {
      output[field] = compileDecimal(output[field], ABI.DAMAGE_SCALE);
    }
  });
  ["radiusWorldUnits"].forEach(function (field) {
    if (Object.prototype.hasOwnProperty.call(output, field)) {
      output[field] = compileDecimal(output[field], ABI.DISTANCE_SCALE);
    }
  });
  if (output.centerBonus) {
    output.centerBonus.radiusWorldUnits = compileDecimal(
      output.centerBonus.radiusWorldUnits,
      ABI.DISTANCE_SCALE
    );
  }
  if (output.echoCounter) {
    output.echoCounter.radiusWorldUnits = compileDecimal(
      output.echoCounter.radiusWorldUnits,
      ABI.DISTANCE_SCALE
    );
  }
  if (output.bash) output.bash.damage = compileDecimal(output.bash.damage, ABI.DAMAGE_SCALE);
  return output;
}

function defenseBehavior(defenseId, level, behaviorId) {
  const defense = defensesSource.records.find((record) => record.id === defenseId);
  const levelRecord = defense.levels.find((record) => record.level === level);
  const behavior = levelRecord.behaviors.find((record) => record.id === behaviorId);
  return compileParameters(behavior.parameters);
}

function enemyTrait(enemyId, kind) {
  const enemy = enemiesSource.records.find((record) => record.id === enemyId);
  return clone(enemy.traits.find((record) => record.kind === kind));
}

function talosDefinition() {
  const boss = bossesSource.records.find((record) => record.id === "talos-prototype");
  const output = clone(boss);
  output.hp = compileDecimal(output.hp, ABI.DAMAGE_SCALE);
  output.speedWorldUnitsPerSecond = compileDecimal(
    output.speedWorldUnitsPerSecond,
    ABI.DISTANCE_SCALE
  );
  output.thresholdScript.parameters.thresholds.forEach(function (threshold) {
    threshold.childSpawnRecords.forEach(function (child) {
      child.routeOffsetDistance = compileDecimal(child.routeOffsetDistance, ABI.DISTANCE_SCALE);
    });
  });
  return output;
}

function executableTalosDefinition() {
  const output = talosDefinition();
  output.thresholdScript.parameters.thresholds.forEach(function (threshold) {
    threshold.transitionEventIds = ["talos.threshold", "talos.expose", "talos.pods"];
  });
  return output;
}

function eventCatalog() {
  const output = {};
  eventsSource.records.forEach(function (record) { output[record.id] = clone(record); });
  return output;
}

function request(parameters, state, input, extra) {
  return Object.assign({
    eventCatalog: eventCatalog(),
    input: input,
    limits: clone(LIMITS),
    parameters: parameters,
    state: state,
  }, extra || {});
}

function eventIds(result) {
  return result.events.map((event) => event.eventId);
}

test("closed dispatch IDs bind the reviewed v1 delivery seams", () => {
  assert.deepEqual(Object.values(Behaviors.DISPATCH_IDS), [
    "aura@1/continuous-range-status",
    "aura@1/periodic-targeted-status",
    "block@1/marker-contact-control",
    "bossScript@1/guarded-hp-thresholds",
    "direct@1/instant-primary-hit",
    "slow@1/primary-status",
    "spawnUnit@1/guard-slots",
    "splash@1/primary-centered-radius",
    "trait.cloak@1",
  ]);
  assert.throws(
    () => Behaviors.dispatchBehavior("future-script@9", {}),
    /unknown behavior dispatch ID/i
  );
  const badSplash = defenseBehavior("siege", 3, "blast");
  badSplash.secondaryComparatorId = "future-comparator-v9";
  assert.throws(() => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
    badSplash,
    null,
    {
      actionId: "resolve",
      primaryTarget: {
        runtimeId: 1, routeId: "route.main", remainingRouteDistance: 1,
        targetKind: "ground", threatPriority: 1, x: 0, y: 0,
      },
      secondaryCandidates: [],
      towerRuntimeId: 1,
    }
  )), /unknown splash secondary comparator/i);
});

test("Sentinel Lock-On saturates at three and emits +15% combo damage on hit four and later", () => {
  const parameters = defenseBehavior("sentinel", 3, "shot");
  let state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.DIRECT, {});
  const coefficients = [];
  for (let hit = 0; hit < 3; hit += 1) {
    const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.DIRECT, request(
      parameters,
      state,
      { actionId: "accepted-primary-hit", targetRuntimeId: 9, towerRuntimeId: 2 }
    ));
    state = result.state;
    assert.deepEqual(result.damageIntent, {
      armorIgnoreBp: 0,
      baseDamageMilli: 18000,
      bossCoefficientBp: 10000,
      damageTypeId: "kinetic",
      internalDamageCoefficientBp: 10000,
      shieldCoefficientBp: 10000,
      targetRuntimeId: 9,
      towerRuntimeId: 2,
    });
    coefficients.push(result.damageCoefficientBp);
    assert.deepEqual(result.events, []);
  }
  assert.deepEqual(coefficients, [10000, 10000, 10000]);
  assert.deepEqual(state, {
    acceptedHitCount: 3, idleElapsedTimeUnits: 0, targetRuntimeId: 9,
  });
  for (let bonusHit = 0; bonusHit < 2; bonusHit += 1) {
    const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.DIRECT, request(
      parameters,
      state,
      { actionId: "accepted-primary-hit", targetRuntimeId: 9, towerRuntimeId: 2 }
    ));
    state = result.state;
    assert.equal(result.damageCoefficientBp, 11500);
    assert.equal(result.damageIntent.internalDamageCoefficientBp, 11500);
    assert.deepEqual(result.state, {
      acceptedHitCount: 3, idleElapsedTimeUnits: 0, targetRuntimeId: 9,
    });
    assert.deepEqual(eventIds(result), ["direct.combo"]);
    assert.deepEqual(result.events[0].payload, {
      acceptedHitCount: 3,
      damageCoefficientBp: 11500,
      targetRuntimeId: 9,
      towerRuntimeId: 2,
    });
  }

  const switched = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.DIRECT, request(
    parameters,
    state,
    { actionId: "accepted-primary-hit", targetRuntimeId: 10, towerRuntimeId: 2 }
  ));
  assert.equal(switched.damageCoefficientBp, 10000);
  assert.deepEqual(switched.state, {
    acceptedHitCount: 1, idleElapsedTimeUnits: 0, targetRuntimeId: 10,
  });
});

test("Chronos direct hit emits its exact low-damage arcane intent independently of slow", () => {
  const parameters = defenseBehavior("chronos", 3, "shot");
  const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.DIRECT, request(
    parameters,
    Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.DIRECT, {}),
    { actionId: "accepted-primary-hit", targetRuntimeId: 15, towerRuntimeId: 4 }
  ));
  assert.deepEqual(result.damageIntent, {
    armorIgnoreBp: 0,
    baseDamageMilli: 6000,
    bossCoefficientBp: 10000,
    damageTypeId: "arcane",
    internalDamageCoefficientBp: 10000,
    shieldCoefficientBp: 10000,
    targetRuntimeId: 15,
    towerRuntimeId: 4,
  });
});

test("Sentinel candidate idle reset is separate from target switch and secondary effects never advance", () => {
  const parameters = defenseBehavior("sentinel", 3, "shot");
  const armed = { acceptedHitCount: 3, idleElapsedTimeUnits: 0, targetRuntimeId: 9 };
  const shortGap = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.DIRECT, request(
    parameters,
    armed,
    { actionId: "no-target", elapsedTimeUnits: 59999 }
  ));
  assert.deepEqual(shortGap.state, {
    acceptedHitCount: 3, idleElapsedTimeUnits: 59999, targetRuntimeId: 9,
  });
  const reset = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.DIRECT, request(
    parameters,
    shortGap.state,
    { actionId: "no-target", elapsedTimeUnits: 1 }
  ));
  assert.deepEqual(reset.state, {
    acceptedHitCount: 0, idleElapsedTimeUnits: 0, targetRuntimeId: null,
  });
  const secondary = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.DIRECT, request(
    parameters,
    armed,
    { actionId: "secondary-effect", targetRuntimeId: 9, towerRuntimeId: 2 }
  ));
  assert.deepEqual(secondary.state, armed);
  assert.equal(secondary.damageCoefficientBp, 10000);
});

test("Chronos fifth nonempty hit echoes to the first two route-front secondaries", () => {
  const parameters = defenseBehavior("chronos", 3, "slow");
  let state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.SLOW, {});
  for (let hit = 1; hit < 5; hit += 1) {
    const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SLOW, request(
      parameters,
      state,
      {
        actionId: "accepted-primary-hit",
        primaryPosition: { x: 0, y: 0 },
        primaryTargetRuntimeId: 3,
        secondaryCandidates: clone(scenarios.chronosSecondaries),
        towerRuntimeId: 4,
      }
    ));
    state = result.state;
    assert.deepEqual(result.primaryStatusIntent, {
      durationTimeUnits: 90000,
      magnitudeBp: 4800,
      statusId: "slow",
      targetRuntimeId: 3,
    });
    assert.deepEqual(result.secondaryStatusIntents, []);
  }
  assert.equal(state.acceptedPrimaryHitCount, 4);

  const empty = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SLOW, request(
    parameters,
    state,
    {
      actionId: "accepted-primary-hit",
      primaryPosition: { x: 0, y: 0 },
      primaryTargetRuntimeId: 3,
      secondaryCandidates: [],
      towerRuntimeId: 4,
    }
  ));
  assert.equal(empty.state.acceptedPrimaryHitCount, 4);
  assert.deepEqual(empty.events, []);

  const echo = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SLOW, request(
    parameters,
    empty.state,
    {
      actionId: "accepted-primary-hit",
      primaryPosition: { x: 0, y: 0 },
      primaryTargetRuntimeId: 3,
      secondaryCandidates: clone(scenarios.chronosSecondaries),
      towerRuntimeId: 4,
    }
  ));
  assert.equal(echo.state.acceptedPrimaryHitCount, 0);
  assert.deepEqual(echo.secondaryStatusIntents.map((intent) => intent.targetRuntimeId), [11, 12]);
  assert.deepEqual(echo.secondaryStatusIntents.map((intent) => [
    intent.statusId, intent.magnitudeBp, intent.durationTimeUnits,
  ]), [["slow", 2400, 60000], ["slow", 2400, 60000]]);
  assert.deepEqual(eventIds(echo), ["slow.echo"]);
  assert.equal(echo.events[0].payload.secondaryTargetCount, 2);
  assert.throws(() => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SLOW, request(
    parameters,
    empty.state,
    {
      actionId: "accepted-primary-hit",
      primaryPosition: { x: 0, y: 0 },
      primaryTargetRuntimeId: 3,
      secondaryCandidates: clone(scenarios.chronosSecondaries),
      towerRuntimeId: 4,
    },
    { limits: { maxEntities: 64, maxEvents: 64, maxTargets: 1 } }
  )), /target cap/i);

  const recursive = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SLOW, request(
    parameters,
    { acceptedPrimaryHitCount: 4 },
    { actionId: "secondary-effect" }
  ));
  assert.deepEqual(recursive.state, { acceptedPrimaryHitCount: 4 });
  assert.deepEqual(recursive.events, []);
  const waveReset = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SLOW, request(
    parameters,
    { acceptedPrimaryHitCount: 4 },
    { actionId: "wave-start" }
  ));
  assert.deepEqual(waveReset.state, { acceptedPrimaryHitCount: 0 });
});

test("Chronos slow remains in the shared strongest-only movement bucket", () => {
  const resolved = Behaviors.resolveMovementReduction([
    { appliedTick: 1, expiryTimeUnits: 9000, magnitude: 2400, sourceId: 4, statusId: "slow" },
    { appliedTick: 1, expiryTimeUnits: 5000, magnitude: 3100, sourceId: 7, statusId: "drench" },
  ], 10000, 5200);
  assert.deepEqual(resolved, Effects.resolveMovementReduction([
    { appliedTick: 1, expiryTimeUnits: 9000, magnitude: 2400, sourceId: 4, statusId: "slow" },
    { appliedTick: 1, expiryTimeUnits: 5000, magnitude: 3100, sourceId: 7, statusId: "drench" },
  ], 10000, 5200));
  assert.equal(resolved.strongestReductionBp, 3100);
});

test("Siege hits every eligible secondary in route-front order without gameplay truncation", () => {
  const parameters = defenseBehavior("siege", 3, "blast");
  const multiInput = {
    actionId: "resolve",
    primaryTarget: {
      runtimeId: 5, routeId: "route.a", remainingRouteDistance: 4000,
      targetKind: "ground", threatPriority: 10, x: 0, y: 0,
    },
    secondaryCandidates: clone(scenarios.siegeTargets),
    towerRuntimeId: 6,
  };
  const multi = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
    parameters, null, multiInput
  ));
  assert.deepEqual(multi.hitIntents.map((hit) => hit.targetRuntimeId), [5, 6, 7, 8]);
  assert.deepEqual(multi.hitIntents.map((hit) => hit.damageCoefficientBp), [
    13500, 10000, 10000, 13500,
  ]);
  assert.deepEqual(eventIds(multi), ["splash.center", "splash.center"]);
  assert.throws(() => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
    parameters,
    null,
    multiInput,
    { limits: { maxEntities: 64, maxEvents: 64, maxTargets: 3 } }
  )), /target cap/i);
  const oneInside = clone(multiInput);
  oneInside.secondaryCandidates = [clone(scenarios.siegeTargets[0])];
  const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
    parameters,
    null,
    oneInside
  ));
  assert.deepEqual(result.hitIntents.map((hit) => hit.targetRuntimeId), [5, 8]);
  assert.deepEqual(
    result.hitIntents.map((hit) => hit.damageCoefficientBp),
    [13500, 13500]
  );
  assert.deepEqual(eventIds(result), ["splash.center", "splash.center"]);
  assert.throws(() => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
    parameters,
    null,
    oneInside,
    { limits: { maxEntities: 64, maxEvents: 64, maxTargets: 1 } }
  )), /target cap/i);
  assert.throws(() => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
    parameters,
    null,
    oneInside,
    { limits: { maxEntities: 64, maxEvents: 1, maxTargets: 16 } }
  )), /event cap/i);
  const outOfRadius = clone(multiInput);
  outOfRadius.secondaryCandidates = [clone(scenarios.siegeTargets[3])];
  assert.deepEqual(
    Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
      parameters, null, outOfRadius
    )).hitIntents.map((intent) => intent.targetRuntimeId),
    [5]
  );
});

test("Hoplite creates and replenishes guards in slot order with monotonic summon IDs", () => {
  const parameters = defenseBehavior("hoplite", 3, "guard-slots");
  const markerInput = clone(scenarios.guardMarkers);
  let state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.GUARD_SLOTS, {
    markers: markerInput,
  });
  assert.equal(Object.isFrozen(markerInput), false);
  assert.equal(Object.isFrozen(markerInput[1].routeDistances), false);
  const initial = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.GUARD_SLOTS, request(
    parameters,
    state,
    {
      actionId: "scheduled-spawns", elapsedTimeUnits: 0,
      nextSummonRuntimeId: 40, towerRuntimeId: 9,
    }
  ));
  assert.deepEqual(initial.created.map((guard) => [
    guard.slotIndex, guard.markerId, guard.summonRuntimeId,
  ]), [[0, "guard.p01.0", 40], [1, "guard.p01.1", 41], [2, "guard.p01.2", 42]]);
  assert.equal(initial.nextSummonRuntimeId, 43);
  assert.deepEqual(eventIds(initial), ["guard.create", "guard.create", "guard.create"]);
  assert.deepEqual(initial.state.slots[1].routeDistances, [
    { remainingDistance: 75000, routeDistance: 25000, routeId: "route.alt" },
    { remainingDistance: 80000, routeDistance: 20000, routeId: "route.main" },
  ]);

  state = clone(initial.state);
  state.slots[0].summonRuntimeId = null;
  state.slots[0].replenishRemainingTimeUnits = 360000;
  const notReady = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.GUARD_SLOTS, request(
    parameters,
    state,
    {
      actionId: "scheduled-spawns", elapsedTimeUnits: 359000,
      nextSummonRuntimeId: 43, towerRuntimeId: 9,
    }
  ));
  assert.deepEqual(notReady.created, []);
  assert.equal(Object.isFrozen(state), false);
  assert.equal(Object.isFrozen(state.slots[1].routeDistances), false);
  const replenished = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.GUARD_SLOTS, request(
    parameters,
    notReady.state,
    {
      actionId: "scheduled-spawns", elapsedTimeUnits: 1000,
      nextSummonRuntimeId: 43, towerRuntimeId: 9,
    }
  ));
  assert.deepEqual(replenished.created.map((guard) => guard.summonRuntimeId), [43]);
});

test("Hoplite guard identities reject nonadjacent duplicate markers and duplicate summons", () => {
  const duplicateMarkers = clone(scenarios.guardMarkers);
  duplicateMarkers.find((marker) => marker.slotIndex === 2).markerId = "guard.p01.0";
  assert.throws(() => Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.GUARD_SLOTS, {
    markers: duplicateMarkers,
  }), /duplicate marker ID/i);

  const contactParameters = defenseBehavior("hoplite", 2, "guard-contact");
  const duplicateSummons = clone(Behaviors.createBehaviorState(
    Behaviors.DISPATCH_IDS.GUARD_SLOTS,
    { markers: clone(scenarios.guardMarkers) }
  ));
  duplicateSummons.slots[0].summonRuntimeId = 77;
  duplicateSummons.slots[2].summonRuntimeId = 77;
  assert.throws(() => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.BLOCK, request(
    contactParameters,
    duplicateSummons,
    { actionId: "movement-contacts", contacts: [], towerRuntimeId: 8 }
  )), /duplicate summon runtime ID/i);
});

test("Hoplite contacts arbitrate globally across towers before any guard is consumed", () => {
  const contactParameters = defenseBehavior("hoplite", 1, "guard-contact");
  const firstState = clone(Behaviors.createBehaviorState(
    Behaviors.DISPATCH_IDS.GUARD_SLOTS,
    {
      markers: [{
        markerId: "guard.p01.0",
        routeDistances: [{
          remainingDistance: 90000, routeDistance: 10000, routeId: "route.main",
        }],
        slotIndex: 0,
      }],
    }
  ));
  firstState.slots[0].replenishDurationTimeUnits = 360000;
  firstState.slots[0].summonRuntimeId = 70;
  const secondState = clone(Behaviors.createBehaviorState(
    Behaviors.DISPATCH_IDS.GUARD_SLOTS,
    {
      markers: [{
        markerId: "guard.p02.0",
        routeDistances: [{
          remainingDistance: 88000, routeDistance: 12000, routeId: "route.main",
        }],
        slotIndex: 0,
      }],
    }
  ));
  secondState.slots[0].replenishDurationTimeUnits = 360000;
  secondState.slots[0].summonRuntimeId = 80;
  const contact = {
    enemyRuntimeId: 24, hardControlActive: false, hardControlBp: 10000,
    nextRouteDistance: 16000, priorRouteDistance: 8000,
    requestedForwardAdvance: 8000, resolveActive: false, routeId: "route.main",
    tags: ["regular"], targetKind: "ground",
  };
  const result = Behaviors.resolveGuardContactBatch({
    eventCatalog: eventCatalog(),
    input: { actionId: "movement-contacts", contacts: [contact] },
    limits: clone(LIMITS),
    towers: [
      { parameters: clone(contactParameters), state: secondState, towerRuntimeId: 9 },
      { parameters: contactParameters, state: firstState, towerRuntimeId: 8 },
    ],
  });
  assert.deepEqual(result.acceptedContacts.map((accepted) => [
    accepted.towerRuntimeId,
    accepted.summonRuntimeId,
    accepted.enemyRuntimeId,
  ]), [[8, 70, 24]]);
  assert.deepEqual(result.towerStates.map((record) => [
    record.towerRuntimeId,
    record.state.slots[0].summonRuntimeId,
  ]), [[8, null], [9, 80]]);
  assert.deepEqual(eventIds(result), ["guard.contact", "guard.consume"]);
});

test("Hoplite L1/L2 prefilter Resolve and occupied hard control before deterministic guard assignment", () => {
  const slotParameters = defenseBehavior("hoplite", 2, "guard-slots");
  const contactParameters = defenseBehavior("hoplite", 2, "guard-contact");
  let state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.GUARD_SLOTS, {
    markers: clone(scenarios.guardMarkers),
  });
  state = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.GUARD_SLOTS, request(
    slotParameters,
    state,
    {
      actionId: "scheduled-spawns", elapsedTimeUnits: 0,
      nextSummonRuntimeId: 70, towerRuntimeId: 8,
    }
  )).state;

  const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.BLOCK, request(
    contactParameters,
    state,
    { actionId: "movement-contacts", contacts: clone(scenarios.guardContacts), towerRuntimeId: 8 }
  ));
  assert.deepEqual(result.acceptedContacts.map((contact) => [
    contact.summonRuntimeId,
    contact.enemyRuntimeId,
    contact.markerId,
    contact.durationTimeUnits,
    contact.resolveDurationTimeUnits,
  ]), [
    [70, 24, "guard.p01.0", 66000, 60000],
    [71, 23, "guard.p01.1", 66000, 90000],
  ]);
  assert.deepEqual(result.queuedDamageIntents, []);
  assert.deepEqual(result.state.slots.map((slot) => slot.summonRuntimeId), [null, null, null]);
  assert.deepEqual(eventIds(result), [
    "guard.rejected", "guard.rejected", "guard.contact", "guard.consume", "guard.contact", "guard.consume",
  ]);
});

test("Hoplite L3 resolves bash as one clamped compound contact without queued control", () => {
  const slotParameters = defenseBehavior("hoplite", 3, "guard-slots");
  const contactParameters = defenseBehavior("hoplite", 3, "guard-contact");
  let state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.GUARD_SLOTS, {
    markers: clone(scenarios.guardMarkers),
  });
  state = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.GUARD_SLOTS, request(
    slotParameters,
    state,
    {
      actionId: "scheduled-spawns", elapsedTimeUnits: 0,
      nextSummonRuntimeId: 80, towerRuntimeId: 8,
    }
  )).state;
  const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.BLOCK, request(
    contactParameters,
    state,
    { actionId: "movement-contacts", contacts: clone(scenarios.guardContacts), towerRuntimeId: 8 }
  ));
  assert.deepEqual(result.acceptedContacts.map((contact) => [
    contact.summonRuntimeId,
    contact.enemyRuntimeId,
    contact.markerId,
    contact.routeId,
    contact.clampedRouteDistance,
    contact.haltForwardMovement,
    contact.hardControlBucketId,
    contact.durationTimeUnits,
    contact.bashImpactDurationTimeUnits,
    contact.resolveStartsAfterTimeUnits,
    contact.resolveDurationTimeUnits,
  ]), [
    [80, 24, "guard.p01.0", "route.main", 10000, true, "hard-control", 72000, 15000, 72000, 60000],
    [81, 23, "guard.p01.1", "route.main", 20000, true, "hard-control", 72000, 15000, 72000, 90000],
  ]);
  assert.deepEqual(result.queuedDamageIntents, [
    {
      armorIgnoreBp: 0,
      baseDamageMilli: 12000,
      bossCoefficientBp: ABI.BASIS_POINTS,
      damageTypeId: "kinetic",
      internalDamageCoefficientBp: ABI.BASIS_POINTS,
      shieldCoefficientBp: ABI.BASIS_POINTS,
      targetRuntimeId: 24,
      towerRuntimeId: 8,
    },
    {
      armorIgnoreBp: 0,
      baseDamageMilli: 12000,
      bossCoefficientBp: ABI.BASIS_POINTS,
      damageTypeId: "kinetic",
      internalDamageCoefficientBp: ABI.BASIS_POINTS,
      shieldCoefficientBp: ABI.BASIS_POINTS,
      targetRuntimeId: 23,
      towerRuntimeId: 8,
    },
  ]);
  assert.deepEqual(eventIds(result), [
    "guard.rejected", "guard.rejected",
    "guard.contact", "guard.bash", "guard.consume",
    "guard.contact", "guard.bash", "guard.consume",
  ]);
  assert.deepEqual(result.events.filter((event) => event.eventId === "guard.bash").map(
    (event) => event.payload
  ), [
    {
      damageMilli: 12000,
      durationMs: 250,
      enemyRuntimeId: 24,
      statusId: "stun",
      summonRuntimeId: 80,
      towerRuntimeId: 8,
    },
    {
      damageMilli: 12000,
      durationMs: 250,
      enemyRuntimeId: 23,
      statusId: "stun",
      summonRuntimeId: 81,
      towerRuntimeId: 8,
    },
  ]);
  assert.deepEqual(result.state.slots.map((slot) => slot.summonRuntimeId), [null, null, 82]);
});

test("Hoplite L3 rejects a bash impact window longer than its enclosing contact", () => {
  const contactParameters = defenseBehavior("hoplite", 3, "guard-contact");
  contactParameters.bash.durationMs = contactParameters.durationMs + 1;
  const state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.GUARD_SLOTS, {
    markers: clone(scenarios.guardMarkers),
  });
  assert.throws(() => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.BLOCK, request(
    contactParameters,
    state,
    { actionId: "movement-contacts", contacts: [], towerRuntimeId: 8 }
  )), /bash impact duration cannot exceed the enclosing contact duration/i);
});

test("one physical Hoplite summon serves a shared marker route table and is consumed only once", () => {
  const slotParameters = defenseBehavior("hoplite", 2, "guard-slots");
  const contactParameters = defenseBehavior("hoplite", 2, "guard-contact");
  let state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.GUARD_SLOTS, {
    markers: clone(scenarios.guardMarkers),
  });
  state = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.GUARD_SLOTS, request(
    slotParameters,
    state,
    {
      actionId: "scheduled-spawns", elapsedTimeUnits: 0,
      nextSummonRuntimeId: 90, towerRuntimeId: 8,
    }
  )).state;
  state = clone(state);
  state.slots[0].summonRuntimeId = null;
  const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.BLOCK, request(
    contactParameters,
    state,
    {
      actionId: "movement-contacts",
      contacts: [
        {
          enemyRuntimeId: 100, hardControlActive: false, hardControlBp: 10000,
          nextRouteDistance: 26000, priorRouteDistance: 24000,
          requestedForwardAdvance: 2000, resolveActive: false, routeId: "route.alt",
          tags: ["regular"], targetKind: "ground",
        },
        {
          enemyRuntimeId: 101, hardControlActive: false, hardControlBp: 10000,
          nextRouteDistance: 21000, priorRouteDistance: 19000,
          requestedForwardAdvance: 2000, resolveActive: false, routeId: "route.main",
          tags: ["regular"], targetKind: "ground",
        },
      ],
      towerRuntimeId: 8,
    }
  ));
  assert.deepEqual(result.acceptedContacts.map((contact) => contact.enemyRuntimeId), [100]);
  assert.equal(result.state.slots[1].summonRuntimeId, null);
  assert.equal(result.state.slots[1].routeDistances.length, 2);
});

test("Oracle continuous reveal applies and removes exact source-range statuses", () => {
  const parameters = defenseBehavior("oracle", 1, "reveal");
  const initial = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.REVEAL, {});
  const expiry = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.REVEAL, request(
    parameters,
    initial,
    {
      actionId: "status-expiry",
      eligibleEnemyRuntimeIds: [9, 4],
      sourceActive: true,
      towerRuntimeId: 3,
    }
  ));
  assert.deepEqual(expiry.events, []);
  const applied = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.REVEAL, request(
    parameters,
    expiry.state,
    {
      actionId: "shield-damage-and-status",
      eligibleEnemyRuntimeIds: [9, 4],
      sourceActive: true,
      towerRuntimeId: 3,
    }
  ));
  assert.deepEqual(applied.state, { revealedEnemyRuntimeIds: [4, 9] });
  assert.deepEqual(applied.statusIntents.map((intent) => [intent.kind, intent.enemyRuntimeId]), [
    ["apply", 4], ["apply", 9],
  ]);
  assert.deepEqual(eventIds(applied), ["reveal.apply", "reveal.apply"]);

  const removed = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.REVEAL, request(
    parameters,
    applied.state,
    {
      actionId: "status-expiry",
      eligibleEnemyRuntimeIds: [9, 12],
      sourceActive: true,
      towerRuntimeId: 3,
    }
  ));
  assert.deepEqual(removed.statusIntents.map((intent) => [intent.kind, intent.enemyRuntimeId]), [
    ["remove", 4],
  ]);
  assert.deepEqual(eventIds(removed), ["reveal.remove"]);
  const changed = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.REVEAL, request(
    parameters,
    removed.state,
    {
      actionId: "shield-damage-and-status",
      eligibleEnemyRuntimeIds: [9, 12],
      sourceActive: true,
      towerRuntimeId: 3,
    }
  ));
  assert.deepEqual(changed.statusIntents.map((intent) => [intent.kind, intent.enemyRuntimeId]), [
    ["apply", 12],
  ]);
  assert.deepEqual(eventIds(changed), ["reveal.apply"]);
});

test("Oracle L3 exact fifth nonempty scan widens to five targets for two seconds", () => {
  const parameters = defenseBehavior("oracle", 3, "mark");
  let state = { acceptedScanCount: 4 };
  const empty = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.MARK, request(
    parameters,
    state,
    { actionId: "scan", candidates: [], towerRuntimeId: 7 }
  ));
  assert.equal(empty.state.acceptedScanCount, 4);
  assert.deepEqual(empty.events, []);

  const fifth = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.MARK, request(
    parameters,
    empty.state,
    { actionId: "scan", candidates: clone(scenarios.oracleTargets), towerRuntimeId: 7 }
  ));
  assert.equal(fifth.state.acceptedScanCount, 0);
  assert.deepEqual(fifth.markIntents.map((intent) => intent.targetRuntimeId), [54, 50, 51, 52, 53]);
  assert.deepEqual(fifth.markIntents.map((intent) => [
    intent.amountBp, intent.durationTimeUnits, intent.sourceTypeId, intent.statusId,
  ]), Array(5).fill([1100, 120000, "oracle-mark", "mark"]));
  assert.deepEqual(eventIds(fifth), [
    "mark.scan", "mark.apply", "mark.apply", "mark.apply", "mark.apply", "mark.apply", "mark.echo",
  ]);
  assert.equal(fifth.events[0].phaseId, "tower-acquisition-and-attacks");
  assert.equal(fifth.events[1].phaseId, "shield-damage-and-status");
  const oneCandidate = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.MARK, request(
    parameters,
    { acceptedScanCount: 4 },
    { actionId: "scan", candidates: [clone(scenarios.oracleTargets[0])], towerRuntimeId: 7 },
    { limits: { maxEntities: 64, maxEvents: 64, maxTargets: 1 } }
  ));
  assert.deepEqual(oneCandidate.markIntents.map((intent) => intent.targetRuntimeId), [52]);
  assert.throws(() => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.MARK, request(
    parameters,
    { acceptedScanCount: 4 },
    { actionId: "scan", candidates: clone(scenarios.oracleTargets), towerRuntimeId: 7 },
    { limits: { maxEntities: 64, maxEvents: 64, maxTargets: 4 } }
  )), /target cap/i);

  const waveReset = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.MARK, request(
    parameters,
    { acceptedScanCount: 4 },
    { actionId: "wave-start" }
  ));
  assert.deepEqual(waveReset.state, { acceptedScanCount: 0 });

  const expired = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.MARK, request(
    parameters,
    waveReset.state,
    {
      actionId: "status-expiry",
      expiredEnemyRuntimeIds: [54, 50],
      towerRuntimeId: 7,
    }
  ));
  assert.deepEqual(
    expired.expiredStatusIntents.map((intent) => intent.enemyRuntimeId),
    [50, 54]
  );
  assert.deepEqual(eventIds(expired), ["mark.expire", "mark.expire"]);
});

test("Echo cloak distinguishes direct, collateral, reveal, damage exposure, and recloak", () => {
  const trait = enemyTrait("echo", "cloak");
  let state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.CLOAK, {});
  let eligibility = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.CLOAK, request(
    trait,
    state,
    { actionId: "eligibility", revealActive: false }
  ));
  assert.deepEqual(eligibility.eligibility, {
    collateralEligible: true, directEligible: false, isCloaked: true,
  });
  assert.deepEqual(eligibility.state, state);

  const damaged = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.CLOAK, request(
    trait,
    state,
    {
      actionId: "accepted-damage", enemyRuntimeId: 20, hpDamageMilli: 1,
      revealActive: false,
      sourceRuntimeId: 6,
    }
  ));
  state = damaged.state;
  assert.equal(state.exposedRemainingTimeUnits, 72000);
  assert.deepEqual(eventIds(damaged), ["echo.exposed"]);
  const elapsed = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.CLOAK, request(
    trait,
    state,
    {
      actionId: "status-expiry", elapsedTimeUnits: 12000,
      enemyRuntimeId: 20, revealActive: false,
    }
  ));
  assert.equal(elapsed.state.exposedRemainingTimeUnits, 60000);
  const refreshed = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.CLOAK, request(
    trait,
    elapsed.state,
    {
      actionId: "accepted-damage", enemyRuntimeId: 20, hpDamageMilli: 1,
      revealActive: false, sourceRuntimeId: 6,
    }
  ));
  assert.equal(refreshed.state.exposedRemainingTimeUnits, 72000);
  assert.deepEqual(refreshed.events, []);
  state = refreshed.state;
  eligibility = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.CLOAK, request(
    trait,
    state,
    { actionId: "eligibility", revealActive: false }
  ));
  assert.equal(eligibility.eligibility.directEligible, true);

  const expiredButRevealed = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.CLOAK, request(
    trait,
    state,
    {
      actionId: "status-expiry", elapsedTimeUnits: 72000,
      enemyRuntimeId: 20, revealActive: true,
    }
  ));
  assert.deepEqual(expiredButRevealed.events, []);
  assert.equal(expiredButRevealed.eligibility.directEligible, true);
  const damageAcrossRevealEdge = Behaviors.dispatchBehavior(
    Behaviors.DISPATCH_IDS.CLOAK,
    request(
      trait,
      expiredButRevealed.state,
      {
        actionId: "accepted-damage", enemyRuntimeId: 20, hpDamageMilli: 1,
        revealActive: false, sourceRuntimeId: 6,
      }
    )
  );
  assert.deepEqual(damageAcrossRevealEdge.events, []);
  const recloaked = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.CLOAK, request(
    trait,
    expiredButRevealed.state,
    {
      actionId: "status-expiry", elapsedTimeUnits: 0,
      enemyRuntimeId: 20, revealActive: false,
    }
  ));
  assert.deepEqual(eventIds(recloaked), ["echo.cloak"]);
  assert.equal(recloaked.eligibility.directEligible, false);

  const revealed = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.CLOAK, request(
    trait,
    Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.CLOAK, {}),
    { actionId: "eligibility", revealActive: true }
  ));
  assert.deepEqual(revealed.state, {
    exposedRemainingTimeUnits: 0,
    wasVisible: false,
  });
  const damageWhileRevealed = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.CLOAK, request(
    trait,
    revealed.state,
    {
      actionId: "accepted-damage", enemyRuntimeId: 21, hpDamageMilli: 1,
      revealActive: true, sourceRuntimeId: 6,
    }
  ));
  assert.deepEqual(damageWhileRevealed.events, []);
  assert.equal(damageWhileRevealed.state.exposedRemainingTimeUnits, 72000);
});

test("Talos nonchronological transition order fails closed", () => {
  const definition = talosDefinition();
  definition.thresholdScript.parameters.thresholds.forEach(function (threshold) {
    threshold.transitionEventIds = ["talos.expose", "talos.pods", "talos.threshold"];
  });
  const state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.TALOS, {
    currentHpMilli: definition.hp,
    maximumHpMilli: definition.hp,
  });
  assert.throws(() => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.TALOS, request(
    definition,
    state,
    {
      actionId: "resolved-hit",
      bossRuntimeId: 90,
      damageMilli: definition.hp,
      lineageId: "lineage.talos",
      routeDistance: 123456,
      routeId: "route.spiral",
    }
  )), /transitionEventIds require source amendment/i);
});

test("Talos clamps immediately, warns, and releases exposure then persistent delayed pods", () => {
  const definition = executableTalosDefinition();
  let state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.TALOS, {
    currentHpMilli: definition.hp,
    maximumHpMilli: definition.hp,
  });
  const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.TALOS, request(
    definition,
    state,
    {
      actionId: "resolved-hit",
      bossRuntimeId: 90,
      damageMilli: definition.hp,
      lineageId: "lineage.talos",
      routeDistance: 123456,
      routeId: "route.spiral",
    }
  ));
  assert.equal(result.state.currentHpMilli, 1650000);
  assert.equal(result.state.maximumHpMilli, definition.hp);
  assert.equal(result.state.nextThresholdOrder, 1);
  assert.equal(result.appliedDamageMilli, 550000);
  assert.equal(result.discardedDamageMilli, 1650000);
  assert.deepEqual(eventIds(result), [
    "talos.phase-exit", "talos.phase-enter", "talos.threshold",
  ]);
  assert.deepEqual(result.events.map((event) => event.phaseId), [
    "guarded-boss-threshold-transition",
    "guarded-boss-threshold-transition",
    "guarded-boss-threshold-transition",
  ]);
  assert.deepEqual(result.childSpawnPlans, []);
  assert.equal(result.exposure, null);
  assert.deepEqual(result.resistanceOverridePlans, []);
  assert.deepEqual(result.statusDeliveries, []);
  assert.equal(result.scheduledReleasePlans.length, 1);
  const releasePlan = result.scheduledReleasePlans[0];
  assert.equal(releasePlan.releaseAfterTicks, 20);
  assert.equal(releasePlan.routeDistance, 123456);
  assert.equal(releasePlan.thresholdId, "core-75");

  const release = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.TALOS, request(
    definition,
    null,
    { actionId: "warning-release", releasePlan: clone(releasePlan) }
  ));
  assert.deepEqual(eventIds(release), ["talos.status", "talos.expose", "talos.pods"]);
  assert.deepEqual(release.events.map((event) => event.phaseId), [
    "shield-damage-and-status",
    "guarded-boss-threshold-transition",
    "terminal-death-execute-children-and-revival",
  ]);
  assert.equal(release.exposure.damageCoefficientBp, 14000);
  assert.equal(release.exposure.targetRuntimeId, 90);
  assert.equal(release.exposure.durationTimeUnits, 180000);
  assert.equal(release.exposure.internalCoefficientStageId, "boss");
  assert.equal(
    release.exposure.damageCoefficientBp,
    ABI.BASIS_POINTS + release.statusDeliveries[0].magnitudeBp
  );
  assert.equal(release.statusDeliveries[0].durationTimeUnits, 180000);
  assert.deepEqual(release.resistanceOverridePlans, [{
    damageTypeId: "kinetic", durationTimeUnits: 180000, reductionBp: 0,
    targetRuntimeId: 90,
  }]);
  assert.equal(release.statusDeliveries[0].targetRuntimeId, 90);
  assert.deepEqual(release.childSpawnPlans, [{
    bountyPolicy: "suppressed",
    count: 3,
    enemyId: "scout",
    firstDelayTicks: 10,
    fixedRouteId: null,
    intervalTicks: 8,
    lineageId: "lineage.talos",
    lineageOwnership: "parent-lineage",
    order: 0,
    routeDistance: 123456,
    routeId: "route.spiral",
    routeOffsetDistance: 0,
    sourceBossRuntimeId: 90,
  }]);
  assert.equal(release.maximumCreateEventsPerTick, 1);
  assert.equal(release.state, null);

  const second = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.TALOS, request(
    definition,
    result.state,
    {
      actionId: "resolved-hit",
      bossRuntimeId: 90,
      damageMilli: definition.hp,
      lineageId: "lineage.talos",
      routeDistance: 130000,
      routeId: "route.spiral",
    }
  ));
  assert.equal(second.state.currentHpMilli, 1100000);
  assert.equal(second.state.nextThresholdOrder, 2);
});

test("Talos thresholds derive from resolved Story/Titan runtime HP rather than compiled base HP", () => {
  const definition = executableTalosDefinition();
  [
    { bossRuntimeId: 91, difficultyId: "story", hpBp: 8500 },
    { bossRuntimeId: 92, difficultyId: "titan", hpBp: 12500 },
  ].forEach(function (scenario) {
    const runtimeMaximumHpMilli = ABI.checkedMulDivFloor(
      definition.hp,
      [scenario.hpBp],
      [ABI.BASIS_POINTS]
    );
    const expectedClampHpMilli = ABI.checkedMulDivFloor(
      runtimeMaximumHpMilli,
      [7500],
      [ABI.BASIS_POINTS]
    );
    const state = Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.TALOS, {
      currentHpMilli: runtimeMaximumHpMilli,
      maximumHpMilli: runtimeMaximumHpMilli,
    });
    const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.TALOS, request(
      definition,
      state,
      {
        actionId: "resolved-hit",
        bossRuntimeId: scenario.bossRuntimeId,
        damageMilli: runtimeMaximumHpMilli,
        lineageId: "lineage.talos." + scenario.difficultyId,
        routeDistance: 1000,
        routeId: "route.spiral",
      }
    ));
    assert.equal(result.state.currentHpMilli, expectedClampHpMilli);
    assert.equal(result.state.maximumHpMilli, runtimeMaximumHpMilli);
    assert.equal(result.appliedDamageMilli, runtimeMaximumHpMilli - expectedClampHpMilli);
    assert.equal(result.discardedDamageMilli, expectedClampHpMilli);
  });
});

test("semantic events validate exact payload types, phases, and ABI phase order", () => {
  const catalog = eventCatalog();
  const valid = {
    eventId: "slow.echo",
    phaseId: "shield-damage-and-status",
    payload: {
      durationMs: 1000,
      magnitudeBp: 2400,
      primaryTargetRuntimeId: 3,
      secondaryTargetCount: 2,
      statusId: "slow",
      towerRuntimeId: 4,
    },
  };
  assert.deepEqual(Behaviors.validateSemanticEvent(catalog, valid), valid);
  assert.throws(
    () => Behaviors.validateSemanticEvent(catalog, Object.assign({}, valid, { phaseId: "movement" })),
    /phase/i
  );
  const badPayload = clone(valid);
  badPayload.payload.extra = 1;
  assert.throws(() => Behaviors.validateSemanticEvent(catalog, badPayload), /exactly/i);
  assert.throws(
    () => Behaviors.validateSemanticEvent(catalog, {
      eventId: "unknown.event", phaseId: "movement", payload: {},
    }),
    /unknown semantic event/i
  );
  assert.throws(
    () => Behaviors.validateSemanticEvents(catalog, [
      valid,
      {
        eventId: "mark.scan",
        phaseId: "tower-acquisition-and-attacks",
        payload: { scanCount: 1, targetCount: 1, towerRuntimeId: 4 },
      },
    ], LIMITS),
    /phase order/i
  );

  const lineageTags = ["lineage.alpha"];
  const spawned = Behaviors.validateSemanticEvent(catalog, {
    eventId: "enemy.spawn",
    phaseId: "scheduled-spawns",
    payload: {
      enemyId: "scout",
      enemyRuntimeId: 10,
      lineageTags: lineageTags,
      routeId: "route.main",
      waveId: "m01-w01",
    },
  });
  assert.equal(Object.isFrozen(spawned.payload.lineageTags), true);
  assert.equal(Object.isFrozen(lineageTags), false);
});

test("all behavior inputs are immutable, outputs canonical/deep frozen, and caps fail closed", () => {
  const parameters = defenseBehavior("siege", 3, "blast");
  const input = {
    actionId: "resolve",
    primaryTarget: {
      runtimeId: 5, routeId: "route.a", remainingRouteDistance: 4000,
      targetKind: "ground", threatPriority: 10, x: 0, y: 0,
    },
    secondaryCandidates: [clone(scenarios.siegeTargets[0])],
    towerRuntimeId: 6,
  };
  const original = clone(input);
  const result = Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
    parameters, null, input
  ));
  assert.deepEqual(input, original);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.hitIntents), true);
  assert.equal(Object.isFrozen(result.hitIntents[0]), true);
  assert.doesNotThrow(() => ABI.canonicalEncode(result));

  const tooMany = clone(input);
  tooMany.secondaryCandidates = Array(65).fill(null).map((_, index) => ({
    runtimeId: index + 10,
    routeId: "route.main",
    remainingRouteDistance: index,
    targetKind: "ground",
    threatPriority: 10,
    x: index,
    y: 0,
  }));
  assert.throws(
    () => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
      parameters, null, tooMany
    )),
    /entity cap/i
  );
  assert.throws(
    () => Behaviors.dispatchBehavior(Behaviors.DISPATCH_IDS.SPLASH, request(
      parameters,
      null,
      Object.assign({}, input, { towerRuntimeId: Number.MAX_SAFE_INTEGER + 1 })
    )),
    /safe integer/i
  );
});

test("CommonJS and classic scripts expose frozen parity without renderer, kit, DOM, or network", () => {
  const abiSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8");
  const geometrySource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "geometry.js"), "utf8");
  const timersSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "timers.js"), "utf8");
  const movementSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "movement.js"), "utf8");
  const effectsSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "effects.js"), "utf8");
  const targetingSource = fs.readFileSync(path.join(__dirname, "..", "js", "sim", "targeting.js"), "utf8");
  const behaviorsSource = fs.readFileSync(BEHAVIORS_PATH, "utf8");
  const context = vm.createContext({});
  vm.runInContext(abiSource, context, { filename: "abi.js" });
  vm.runInContext(geometrySource, context, { filename: "geometry.js" });
  vm.runInContext(timersSource, context, { filename: "timers.js" });
  vm.runInContext(movementSource, context, { filename: "movement.js" });
  vm.runInContext(effectsSource, context, { filename: "effects.js" });
  vm.runInContext(targetingSource, context, { filename: "targeting.js" });
  vm.runInContext(behaviorsSource, context, { filename: "behaviors.js" });

  assert.equal(Object.isFrozen(context.Game.AegisBehaviors), true);
  assert.equal(context.Game.AegisBehaviors.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.Game.AegisBehaviors.DISPATCH_IDS)),
    Behaviors.DISPATCH_IDS
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(vm.runInContext(
      "Game.AegisBehaviors.createBehaviorState(Game.AegisBehaviors.DISPATCH_IDS.DIRECT, {})",
      context
    ))),
    Behaviors.createBehaviorState(Behaviors.DISPATCH_IDS.DIRECT, {})
  );
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.require, undefined);
  assert.throws(
    () => vm.runInContext(behaviorsSource, vm.createContext({ Game: {} })),
    /AegisSim/i
  );
});
