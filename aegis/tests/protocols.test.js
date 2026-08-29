"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI_V1 = require("../js/sim/abi.js");
const ABI = require("../js/sim/abi-v2.js");
const CommandsV2 = require("../js/sim/commands-v2.js");
const PROTOCOLS_PATH = path.join(__dirname, "..", "js", "sim", "protocols.js");
const Protocols = require(PROTOCOLS_PATH);
const V4Catalog = require("../../../tools/lib/aegis/v4-rule-catalog.js");
const V4Compiler = require("../../../tools/lib/aegis/v4-unlock-compiler.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compiledV4() {
  return V4Compiler.compileUnlockSimulationContent(V4Catalog.BINDING_SOURCES);
}

function catalogInput() {
  return clone(Protocols.adaptCompiledProtocolContent(compiledV4()));
}

function loadoutInput(overrides) {
  return Object.assign({
    slotCap: 2,
    protocolAuthority: [
      { protocolId: "athena-command", availableTier: 3 },
      { protocolId: "medusa-lock", availableTier: 3 },
      { protocolId: "poseidon-surge", availableTier: 3 },
      { protocolId: "temporal-edict", availableTier: 3 },
    ],
    protocols: [
      { slot: 0, protocolId: "temporal-edict", tier: 1 },
      { slot: 1, protocolId: "poseidon-surge", tier: 2 },
    ],
    missionLoan: { protocolId: "armara-ascension", tier: 1 },
  }, overrides);
}

function ledgerInput(overrides) {
  return Object.assign({
    sharedReadyTick: 0,
    protocols: [],
  }, overrides);
}

function contextInput(overrides) {
  return Object.assign({
    currentTick: 600,
    phase: "wave",
    aether: 500,
    protocolCostMultiplierBp: 10000,
    boardBounds: { minX: 0, minY: 0, maxX: 200000, maxY: 100000 },
    routes: [
      { routeId: "route.main", routeLength: 225612 },
      { routeId: "route.second", routeLength: 180000 },
    ],
    targetSelection: null,
  }, overrides);
}

function command(target, overrides) {
  return Object.assign({
    tick: 600,
    seq: 0,
    type: "activatePower",
    protocolId: "temporal-edict",
    tier: 1,
    target: target || { kind: "none" },
  }, overrides);
}

function selection(protocolId, target, eligibleTargetIds) {
  return { protocolId: protocolId, target: target, eligibleTargetIds: eligibleTargetIds };
}

function plan(overrides) {
  overrides = overrides || {};
  return Protocols.planProtocolActivation({
    catalog: overrides.catalog || catalogInput(),
    loadout: overrides.loadout || loadoutInput(),
    ledger: overrides.ledger || ledgerInput(),
    context: overrides.context || contextInput(),
    command: overrides.command || command(),
  });
}

test("Protocol catalog validation creates a closed deeply frozen canonical copy", () => {
  const input = catalogInput();
  const catalog = Protocols.normalizeProtocolCatalog(input);
  assert.deepEqual(catalog, input);
  assert.notEqual(catalog, input);
  assert.notEqual(catalog.protocols[0], input.protocols[0]);
  assert.notEqual(catalog.protocols[0].tiers, input.protocols[0].tiers);
  assert.equal(Object.isFrozen(catalog), true);
  assert.equal(catalog.protocols.every(function (record) {
    return Object.isFrozen(record) && Object.isFrozen(record.tiers) && record.tiers.every(Object.isFrozen);
  }), true);
  assert.doesNotThrow(() => ABI.canonicalEncode(catalog));

  input.protocols[0].tiers[0].baseCostAether = 1;
  assert.equal(catalog.protocols[0].tiers[0].baseCostAether, 70);
});

test("the production adapter preserves compiled v4 policies, effects, and global Protocol rules", () => {
  const compiled = compiledV4();
  const runtime = Protocols.adaptCompiledProtocolContent(compiled);
  assert.equal(runtime.maximumSlotCap, compiled.protocolRules.maximumSlotCap);
  assert.equal(runtime.repeatCostStepBp, compiled.protocolRules.repeatCostStepBp);
  assert.equal(runtime.sharedCooldownMs, compiled.protocolRules.sharedCooldownMs);
  assert.equal(runtime.protocols.length, 10);
  assert.equal(runtime.protocols[0].protocolId, "aegis-ward");
  assert.equal(runtime.protocols[0].castPolicyId, "repeat-surcharge");
  assert.equal(runtime.protocols[0].tiers[0].maximumAcceptedCasts, null);
  assert.deepEqual(runtime.protocols[0].tiers[0].effect, compiled.protocols[0].tiers[0].effect);
  assert.notStrictEqual(runtime.protocols[0].tiers[0].effect, compiled.protocols[0].tiers[0].effect);
  assert.equal(runtime.protocols[1].protocolId, "armara-ascension");
  assert.equal(runtime.protocols[1].castPolicyId, "once-per-mission");
  assert.equal(runtime.protocols[1].tiers[0].maximumAcceptedCasts, 1);
  assert.equal(runtime.protocols[9].protocolId, "zeus-skyfire");
  assert.equal(Object.isFrozen(runtime.protocols[0].tiers[0].effect), true);
});

test("Protocol catalogs reject unknown fields, bad tier sets, order, IDs, targets, and unsafe numbers", () => {
  const extra = catalogInput();
  extra.protocols[0].extra = true;
  assert.throws(() => Protocols.normalizeProtocolCatalog(extra), /exactly/i);

  const unordered = catalogInput();
  unordered.protocols.reverse();
  assert.throws(() => Protocols.normalizeProtocolCatalog(unordered), /ASCII order/i);

  const duplicate = catalogInput();
  duplicate.protocols[1].protocolId = duplicate.protocols[0].protocolId;
  assert.throws(() => Protocols.normalizeProtocolCatalog(duplicate), /ASCII order|duplicate/i);

  const badId = catalogInput();
  badId.protocols[0].protocolId = "Armara";
  assert.throws(() => Protocols.normalizeProtocolCatalog(badId), /lowercase authored ID/i);

  const longId = catalogInput();
  longId.protocols[0].protocolId = "a".repeat(129);
  assert.throws(() => Protocols.normalizeProtocolCatalog(longId), /authored ID|128|length|exceeds/i);

  const badTarget = catalogInput();
  badTarget.protocols[0].targetKind = "area";
  assert.throws(() => Protocols.normalizeProtocolCatalog(badTarget), /target kind/i);

  const missingTier = catalogInput();
  missingTier.protocols[0].tiers.pop();
  assert.throws(() => Protocols.normalizeProtocolCatalog(missingTier), /exactly three/i);

  const badTier = catalogInput();
  badTier.protocols[0].tiers[1].tier = 3;
  assert.throws(() => Protocols.normalizeProtocolCatalog(badTier), /tier order/i);

  const badCost = catalogInput();
  badCost.protocols[0].tiers[0].baseCostAether = 0;
  assert.throws(() => Protocols.normalizeProtocolCatalog(badCost), /positive/i);

  const badCooldown = catalogInput();
  badCooldown.protocols[0].tiers[0].cooldownMs = -1;
  assert.throws(() => Protocols.normalizeProtocolCatalog(badCooldown), /nonnegative/i);

  const badMaximum = catalogInput();
  badMaximum.protocols[0].tiers[0].maximumAcceptedCasts = 1;
  assert.throws(() => Protocols.normalizeProtocolCatalog(badMaximum), /cast ceiling/i);
});

test("loadout validation locks two zero-based slots, grants, equipped tiers, and a dedicated loan", () => {
  const source = loadoutInput();
  const normalized = Protocols.normalizeProtocolLoadout(source, catalogInput());
  assert.deepEqual(normalized, source);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.protocols), true);
  assert.equal(Object.isFrozen(normalized.protocolAuthority), true);
  assert.equal(Object.isFrozen(normalized.missionLoan), true);

  assert.throws(() => Protocols.normalizeProtocolLoadout(
    loadoutInput({ slotCap: 3 }), catalogInput()
  ), /slot cap/i);
  assert.throws(() => Protocols.normalizeProtocolLoadout(loadoutInput({
    protocols: [
      { slot: 0, protocolId: "temporal-edict", tier: 1 },
      { slot: 0, protocolId: "poseidon-surge", tier: 2 },
    ],
  }), catalogInput()), /slot order|duplicate slot/i);
  assert.throws(() => Protocols.normalizeProtocolLoadout(loadoutInput({
    protocols: [{ slot: 2, protocolId: "temporal-edict", tier: 1 }],
  }), catalogInput()), /slot cap/i);
  assert.throws(() => Protocols.normalizeProtocolLoadout(loadoutInput({
    protocols: [
      { slot: 0, protocolId: "temporal-edict", tier: 1 },
      { slot: 1, protocolId: "temporal-edict", tier: 1 },
    ],
  }), catalogInput()), /duplicate protocol/i);
  assert.throws(() => Protocols.normalizeProtocolLoadout(loadoutInput({
    protocols: [{ slot: 0, protocolId: "armara-ascension", tier: 1 }],
  }), catalogInput()), /locked protocol/i);
  assert.throws(() => Protocols.normalizeProtocolLoadout(loadoutInput({
    protocols: [{ slot: 0, protocolId: "temporal-edict", tier: 4 }],
  }), catalogInput()), /tier/i);
  assert.throws(() => Protocols.normalizeProtocolLoadout(loadoutInput({
    protocolAuthority: [
      { protocolId: "athena-command", availableTier: 3 },
      { protocolId: "medusa-lock", availableTier: 3 },
      { protocolId: "poseidon-surge", availableTier: 3 },
      { protocolId: "temporal-edict", availableTier: 1 },
    ],
    protocols: [{ slot: 0, protocolId: "temporal-edict", tier: 2 }],
  }), catalogInput()), /exceeds permanent authority/i);
  assert.throws(() => Protocols.normalizeProtocolLoadout(loadoutInput({
    missionLoan: { protocolId: "temporal-edict", tier: 1 },
  }), catalogInput()), /duplicate.*loan|loan.*duplicate/i);
  assert.throws(() => Protocols.normalizeProtocolLoadout(loadoutInput({
    missionLoan: { protocolId: "armara-ascension", tier: 2 },
  }), catalogInput()), /loans must use Tier 1/i);
});

test("runtime ledger validation is sparse, canonical, bounded to catalog IDs, and immutable", () => {
  const source = ledgerInput({
    sharedReadyTick: 650,
    protocols: [
      { protocolId: "poseidon-surge", readyTick: 700, acceptedCastCount: 2 },
      { protocolId: "temporal-edict", readyTick: 800, acceptedCastCount: 1 },
    ],
  });
  const normalized = Protocols.normalizeProtocolRuntimeLedger(source, catalogInput());
  assert.deepEqual(normalized, source);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.protocols), true);
  assert.equal(normalized.protocols.every(Object.isFrozen), true);

  const unordered = ledgerInput({ protocols: source.protocols.slice().reverse() });
  assert.throws(() => Protocols.normalizeProtocolRuntimeLedger(unordered, catalogInput()), /ASCII order/i);
  assert.throws(() => Protocols.normalizeProtocolRuntimeLedger(ledgerInput({
    protocols: [{ protocolId: "unknown", readyTick: 0, acceptedCastCount: 0 }],
  }), catalogInput()), /unknown protocol/i);
  assert.throws(() => Protocols.normalizeProtocolRuntimeLedger(ledgerInput({
    protocols: [{ protocolId: "temporal-edict", readyTick: -1, acceptedCastCount: 0 }],
  }), catalogInput()), /nonnegative/i);
});

test("repeat cost uses checked linear 25 percent escalation and one ceiling per stage", () => {
  assert.deepEqual(Protocols.resolveProtocolCastCost(75, 0, 10000, 2500), {
    baseCostAether: 75,
    priorAcceptedCasts: 0,
    repeatMultiplierBp: 10000,
    repeatedCostAether: 75,
    protocolCostMultiplierBp: 10000,
    repeatCostStepBp: 2500,
    resolvedCastCostAether: 75,
  });
  assert.equal(Protocols.resolveProtocolCastCost(75, 1, 10000, 2500).resolvedCastCostAether, 94);
  assert.equal(Protocols.resolveProtocolCastCost(75, 2, 10000, 2500).resolvedCastCostAether, 113);
  assert.equal(Protocols.resolveProtocolCastCost(75, 3, 10000, 2500).resolvedCastCostAether, 132);
  assert.equal(Protocols.resolveProtocolCastCost(75, 1, 8500, 2500).resolvedCastCostAether, 80);
  assert.equal(Protocols.resolveProtocolCastCost(65, 2, 8500, 2500).resolvedCastCostAether, 84);
  assert.equal(Object.isFrozen(Protocols.resolveProtocolCastCost(75, 1, 8500, 2500)), true);
  assert.throws(() => Protocols.resolveProtocolCastCost(75, -1, 10000, 2500), /nonnegative/i);
  assert.throws(
    () => Protocols.resolveProtocolCastCost(Number.MAX_SAFE_INTEGER, 1, 10000, 2500),
    /safe integer|overflow/i
  );
});

test("accepted activation returns an immutable payment and ready-tick ledger plan without mutation", () => {
  const catalog = catalogInput();
  const loadout = loadoutInput();
  const ledger = ledgerInput();
  const context = contextInput();
  const activation = command();
  const accepted = Protocols.planProtocolActivation({
    catalog: catalog,
    loadout: loadout,
    ledger: ledger,
    context: context,
    command: activation,
  });

  assert.equal(accepted.accepted, true);
  assert.equal(accepted.denialReason, null);
  assert.equal(accepted.source, "loadout");
  assert.equal(accepted.resolvedCastCostAether, 75);
  assert.equal(accepted.aetherAfter, 425);
  assert.deepEqual(accepted.ledgerUpdate, {
    protocolId: "temporal-edict",
    acceptedCastCount: 1,
    readyTick: 5400,
    sharedReadyTick: 1500,
  });
  assert.deepEqual(accepted.nextLedger, {
    sharedReadyTick: 1500,
    protocols: [{ protocolId: "temporal-edict", readyTick: 5400, acceptedCastCount: 1 }],
  });
  assert.equal(Object.isFrozen(accepted), true);
  assert.equal(Object.isFrozen(accepted.target), true);
  assert.equal(Object.isFrozen(accepted.ledgerUpdate), true);
  assert.equal(Object.isFrozen(accepted.nextLedger), true);
  assert.equal(Object.isFrozen(accepted.nextLedger.protocols), true);
  assert.deepEqual(ledger, ledgerInput());
  assert.deepEqual(context, contextInput());
  assert.deepEqual(loadout, loadoutInput());
  assert.deepEqual(catalog, catalogInput());
});

test("a repeated cast charges the exact surcharge and updates only its sparse ledger row", () => {
  const accepted = plan({
    ledger: ledgerInput({
      sharedReadyTick: 500,
      protocols: [
        { protocolId: "poseidon-surge", readyTick: 0, acceptedCastCount: 3 },
        { protocolId: "temporal-edict", readyTick: 500, acceptedCastCount: 1 },
      ],
    }),
    context: contextInput({ aether: 100, protocolCostMultiplierBp: 8500 }),
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.resolvedCastCostAether, 80);
  assert.equal(accepted.aetherAfter, 20);
  assert.deepEqual(accepted.nextLedger.protocols, [
    { protocolId: "poseidon-surge", readyTick: 0, acceptedCastCount: 3 },
    { protocolId: "temporal-edict", readyTick: 5400, acceptedCastCount: 2 },
  ]);
});

test("ordinary repeat-surcharge casts have no arbitrary gameplay ceiling", () => {
  const accepted = plan({
    ledger: ledgerInput({
      protocols: [{ protocolId: "temporal-edict", readyTick: 0, acceptedCastCount: 32 }],
    }),
    context: contextInput({ aether: 10000 }),
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.ledgerUpdate.acceptedCastCount, 33);
});

test("activation denial precedence covers lock, equip, tier, loan, phase, cooldown, once, and Aether", () => {
  assert.equal(plan({ command: command({ kind: "none" }, { protocolId: "unknown" }) }).denialReason,
    Protocols.DENIAL_REASONS.UNKNOWN_PROTOCOL);
  assert.equal(plan({
    command: command({ kind: "tower", towerRuntimeId: 2 }, { protocolId: "athena-command" }),
  }).denialReason, Protocols.DENIAL_REASONS.PROTOCOL_UNEQUIPPED);
  assert.equal(plan({
    loadout: loadoutInput({
      protocolAuthority: [
        { protocolId: "medusa-lock", availableTier: 3 },
        { protocolId: "poseidon-surge", availableTier: 3 },
        { protocolId: "temporal-edict", availableTier: 3 },
      ],
    }),
    command: command({ kind: "tower", towerRuntimeId: 2 }, { protocolId: "athena-command" }),
  }).denialReason, Protocols.DENIAL_REASONS.PROTOCOL_LOCKED);
  assert.equal(plan({ command: command({ kind: "none" }, { tier: 2 }) }).denialReason,
    Protocols.DENIAL_REASONS.TIER_MISMATCH);
  assert.equal(plan({
    command: command({ kind: "none" }, { protocolId: "armara-ascension", tier: 2 }),
  }).denialReason, Protocols.DENIAL_REASONS.MISSION_LOAN_MISMATCH);
  assert.equal(plan({ context: contextInput({ phase: "planning" }) }).denialReason,
    Protocols.DENIAL_REASONS.WRONG_PHASE);
  assert.equal(plan({ ledger: ledgerInput({ sharedReadyTick: 601 }) }).denialReason,
    Protocols.DENIAL_REASONS.SHARED_COOLDOWN);
  assert.equal(plan({ ledger: ledgerInput({
    protocols: [{ protocolId: "temporal-edict", readyTick: 601, acceptedCastCount: 1 }],
  }) }).denialReason, Protocols.DENIAL_REASONS.PROTOCOL_COOLDOWN);
  assert.equal(plan({
    ledger: ledgerInput({
      protocols: [{ protocolId: "armara-ascension", readyTick: 0, acceptedCastCount: 1 }],
    }),
    command: command({ kind: "none" }, { protocolId: "armara-ascension" }),
  }).denialReason, Protocols.DENIAL_REASONS.ONCE_PER_MISSION);
  assert.equal(plan({ context: contextInput({ aether: 74 }) }).denialReason,
    Protocols.DENIAL_REASONS.INSUFFICIENT_AETHER);
});

test("every denied plan is frozen and preserves Aether and the normalized runtime ledger", () => {
  const ledger = ledgerInput({
    sharedReadyTick: 601,
    protocols: [{ protocolId: "temporal-edict", readyTick: 700, acceptedCastCount: 1 }],
  });
  const denied = plan({ ledger: ledger, context: contextInput({ aether: 77 }) });
  assert.equal(denied.accepted, false);
  assert.equal(denied.aetherAfter, 77);
  assert.deepEqual(denied.nextLedger, ledger);
  assert.equal(Object.isFrozen(denied), true);
  assert.equal(Object.isFrozen(denied.nextLedger), true);
  assert.equal(Object.isFrozen(denied.nextLedger.protocols), true);
  assert.equal(Object.isFrozen(denied.target), true);
});

test("command-bound selection proofs reject empty selections, stale towers, routes, and vectors", () => {
  assert.equal(plan({
    command: command({ kind: "route-point", routeId: "route.main", routeDistance: 1 }),
  }).denialReason, Protocols.DENIAL_REASONS.WRONG_TARGET_KIND);
  const skyfireLoadout = loadoutInput({
    protocolAuthority: [{ protocolId: "zeus-skyfire", availableTier: 1 }],
    protocols: [{ slot: 0, protocolId: "zeus-skyfire", tier: 1 }],
    missionLoan: null,
  });
  assert.equal(plan({
    loadout: skyfireLoadout,
    context: contextInput({ targetSelection: selection("zeus-skyfire", { kind: "none" }, []) }),
    command: command({ kind: "none" }, { protocolId: "zeus-skyfire", tier: 1 }),
  }).denialReason, Protocols.DENIAL_REASONS.MISSING_ELIGIBLE_TARGET);

  const athenaLoadout = loadoutInput({
    protocolAuthority: [{ protocolId: "athena-command", availableTier: 1 }],
    protocols: [{ slot: 0, protocolId: "athena-command", tier: 1 }],
    missionLoan: null,
  });
  assert.equal(plan({
    loadout: athenaLoadout,
    context: contextInput({ targetSelection: selection(
      "athena-command", { kind: "tower", towerRuntimeId: 99 }, [2, 7]
    ) }),
    command: command({ kind: "tower", towerRuntimeId: 99 }, {
      protocolId: "athena-command", tier: 1,
    }),
  }).denialReason, Protocols.DENIAL_REASONS.STALE_TOWER);
  assert.equal(plan({
    loadout: athenaLoadout,
    context: contextInput({ targetSelection: selection(
      "athena-command", { kind: "tower", towerRuntimeId: 99 }, []
    ) }),
    command: command({ kind: "tower", towerRuntimeId: 99 }, {
      protocolId: "athena-command", tier: 1,
    }),
  }).denialReason, Protocols.DENIAL_REASONS.MISSING_ELIGIBLE_TARGET);

  assert.equal(plan({
    context: contextInput({ targetSelection: selection(
      "poseidon-surge", { kind: "route-point", routeId: "route.unknown", routeDistance: 1 }, [10]
    ) }),
    command: command({ kind: "route-point", routeId: "route.unknown", routeDistance: 1 }, {
      protocolId: "poseidon-surge", tier: 2,
    }),
  }).denialReason, Protocols.DENIAL_REASONS.UNKNOWN_ROUTE);
  assert.equal(plan({
    context: contextInput({ targetSelection: selection(
      "poseidon-surge", { kind: "route-point", routeId: "route.main", routeDistance: 225613 }, [10]
    ) }),
    command: command({ kind: "route-point", routeId: "route.main", routeDistance: 225613 }, {
      protocolId: "poseidon-surge", tier: 2,
    }),
  }).denialReason, Protocols.DENIAL_REASONS.ROUTE_DISTANCE_OUT_OF_RANGE);
  assert.equal(plan({
    context: contextInput({ targetSelection: selection(
      "poseidon-surge", { kind: "route-point", routeId: "route.main", routeDistance: 225612 }, []
    ) }),
    command: command({ kind: "route-point", routeId: "route.main", routeDistance: 225612 }, {
      protocolId: "poseidon-surge", tier: 2,
    }),
  }).denialReason, Protocols.DENIAL_REASONS.MISSING_ELIGIBLE_TARGET);
  assert.equal(plan({
    context: contextInput({ targetSelection: selection(
      "poseidon-surge", { kind: "route-point", routeId: "route.main", routeDistance: 225612 }, [10]
    ) }),
    command: command({ kind: "route-point", routeId: "route.main", routeDistance: 225612 }, {
      protocolId: "poseidon-surge", tier: 2,
    }),
  }).accepted, true);

  const medusaLoadout = loadoutInput({
    protocolAuthority: [{ protocolId: "medusa-lock", availableTier: 1 }],
    protocols: [{ slot: 0, protocolId: "medusa-lock", tier: 1 }],
    missionLoan: null,
  });
  assert.equal(plan({
    loadout: medusaLoadout,
    context: contextInput({ targetSelection: selection(
      "medusa-lock", { kind: "world-vector", originX: -1, originY: 1, aimX: 2, aimY: 2 }, [20]
    ) }),
    command: command({ kind: "world-vector", originX: -1, originY: 1, aimX: 2, aimY: 2 }, {
      protocolId: "medusa-lock", tier: 1,
    }),
  }).denialReason, Protocols.DENIAL_REASONS.OUT_OF_BOARD_VECTOR);
  assert.equal(plan({
    loadout: medusaLoadout,
    context: contextInput({ targetSelection: selection(
      "medusa-lock", { kind: "world-vector", originX: 1, originY: 1, aimX: 1, aimY: 1 }, [20]
    ) }),
    command: command({ kind: "world-vector", originX: 1, originY: 1, aimX: 1, aimY: 1 }, {
      protocolId: "medusa-lock", tier: 1,
    }),
  }).denialReason, Protocols.DENIAL_REASONS.ZERO_LENGTH_VECTOR);
  assert.equal(plan({
    loadout: medusaLoadout,
    context: contextInput({ targetSelection: selection(
      "medusa-lock", { kind: "world-vector", originX: 0, originY: 0, aimX: 200000, aimY: 100000 }, [20]
    ) }),
    command: command({ kind: "world-vector", originX: 0, originY: 0, aimX: 200000, aimY: 100000 }, {
      protocolId: "medusa-lock", tier: 1,
    }),
  }).accepted, true);
});

test("selection proof identity is exact and cooldown equality is ready", () => {
  assert.throws(() => plan({
    context: contextInput({ targetSelection: selection("poseidon-surge", { kind: "none" }, [1]) }),
  }), /does not match/i);
  const accepted = plan({
    ledger: ledgerInput({
      sharedReadyTick: 600,
      protocols: [{ protocolId: "temporal-edict", readyTick: 600, acceptedCastCount: 0 }],
    }),
  });
  assert.equal(accepted.accepted, true);
});

test("ready-tick addition rejects safe-integer overflow", () => {
  const tick = Number.MAX_SAFE_INTEGER - 100;
  assert.throws(() => plan({
    context: contextInput({ currentTick: tick, aether: 10000 }),
    command: command({ kind: "none" }, { tick: tick }),
  }), /overflow|safe integer/i);
});

test("a mission-local loan accepts its exact tier outside the permanent slot cap", () => {
  const accepted = plan({
    command: command({ kind: "none" }, { protocolId: "armara-ascension", tier: 1 }),
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.source, "mission-loan");
  assert.equal(accepted.resolvedCastCostAether, 220);
  assert.equal(accepted.ledgerUpdate.acceptedCastCount, 1);
  assert.equal(accepted.ledgerUpdate.readyTick, 600);
});

test("planner inputs are exact canonical records and command tick must match the boundary", () => {
  assert.throws(() => Protocols.planProtocolActivation({
    catalog: catalogInput(), loadout: loadoutInput(), ledger: ledgerInput(), context: contextInput(),
    command: command(), extra: true,
  }), /exactly/i);
  assert.throws(() => plan({ command: command({ kind: "none" }, { tick: 601 }) }), /current tick/i);
  assert.throws(() => plan({ command: { tick: 600, seq: 0, type: "startWave" } }), /activatePower/i);
  assert.throws(() => plan({ context: contextInput({ protocolCostMultiplierBp: 6999 }) }), /cost multiplier/i);
});

test("CommonJS and classic-script modes expose one frozen pure Protocol API", () => {
  assert.equal(Object.isFrozen(Protocols), true);
  assert.equal(Object.isFrozen(Protocols.DENIAL_REASONS), true);
  const source = fs.readFileSync(PROTOCOLS_PATH, "utf8");
  assert.deepEqual(
    Array.from(source.matchAll(/\brequire\("([^"]+)"\)/g), (match) => match[1]),
    ["./abi-v2.js", "./commands-v2.js"]
  );

  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  ["abi.js", "abi-v2.js", "commands.js", "commands-v2.js", "protocols.js"].forEach(function (filename) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "sim", filename), "utf8"), context);
  });
  assert.equal(Object.isFrozen(context.Game.AegisProtocols), true);
  assert.equal(vm.runInContext(
    "Game.AegisProtocols.resolveProtocolCastCost(75,1,10000,2500).resolvedCastCostAether",
    context
  ), 94);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.localStorage, undefined);
  assert.equal(context.WebSocket, undefined);

  assert.throws(() => vm.runInNewContext(source, {}, {
    codeGeneration: { strings: false, wasm: false },
  }), /AegisSimV2/);
  assert.throws(() => vm.runInNewContext(source, {
    Game: { AegisSimV2: ABI_V1, AegisCommandsV2: CommandsV2 },
  }, { codeGeneration: { strings: false, wasm: false } }), /ABI v2/i);
  assert.equal(Protocols.ABI_DESCRIPTOR_SHA256, ABI.DESCRIPTOR_SHA256);
  assert.equal(Protocols.COMMAND_SCHEMA_VERSION, CommandsV2.COMMAND_SCHEMA_VERSION);
});

function skyfireLoadout() {
  return loadoutInput({
    protocolAuthority: [{ protocolId: "zeus-skyfire", availableTier: 1 }],
    protocols: [{ slot: 0, protocolId: "zeus-skyfire", tier: 1 }],
    missionLoan: null,
  });
}

function emptySkyfirePlan(catalog) {
  return plan({
    catalog: catalog,
    loadout: skyfireLoadout(),
    context: contextInput({ targetSelection: selection("zeus-skyfire", { kind: "none" }, []) }),
    command: command({ kind: "none" }, { protocolId: "zeus-skyfire", tier: 1 }),
  });
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    Object.freeze(value);
  }
  return value;
}

test("canonical effect clones reject __proto__ and non-ASCII keys so a hostile Zeus cannot borrow a ward kind", () => {
  const hijacked = catalogInput();
  hijacked.protocols[9].tiers.forEach(function (tier) {
    tier.effect = JSON.parse('{"__proto__":{"kind":"global-slow-field","affectsFutureSpawns":true}}');
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(hijacked.protocols[9].tiers[0].effect, "__proto__"),
    true
  );
  assert.throws(() => Protocols.normalizeProtocolCatalog(hijacked), {
    name: "TypeError", message: /__proto__/,
  });
  assert.throws(() => emptySkyfirePlan(hijacked), /__proto__/);

  const nulled = catalogInput();
  nulled.protocols[9].tiers[0].effect = JSON.parse('{"kind":"scheduled-global-damage","__proto__":null}');
  assert.throws(() => Protocols.normalizeProtocolCatalog(nulled), {
    name: "TypeError", message: /__proto__/,
  });

  const nonAscii = catalogInput();
  nonAscii.protocols[9].tiers[0].effect = JSON.parse('{"kind":"scheduled-global-damage","k\\u00efnd":1}');
  assert.throws(() => Protocols.normalizeProtocolCatalog(nonAscii), {
    name: "TypeError", message: /ASCII/,
  });
});

test("a mismatched selection proof throws before any denial, independent of Aether or phase", () => {
  const mismatch = selection("poseidon-surge", { kind: "none" }, [1]);
  assert.throws(() => plan({
    context: contextInput({ aether: 0, targetSelection: mismatch }),
  }), /does not match/i);
  assert.throws(() => plan({
    context: contextInput({ phase: "planning", targetSelection: mismatch }),
  }), /does not match/i);
  assert.throws(() => plan({
    ledger: ledgerInput({ sharedReadyTick: 601 }),
    context: contextInput({ targetSelection: mismatch }),
  }), /does not match/i);
  assert.throws(() => plan({
    context: contextInput({ targetSelection: selection(
      "temporal-edict", { kind: "tower", towerRuntimeId: 1 }, [1]
    ) }),
  }), /does not match/i);
  assert.throws(() => plan({
    context: contextInput({ targetSelection: mismatch }),
    command: command({ kind: "none" }, { protocolId: "unknown" }),
  }), /does not match/i);
});

test("effect kinds form a closed enum and empty selections derive from an explicit future-spawn rule", () => {
  assert.deepEqual(Array.from(Protocols.EFFECT_KINDS), [
    "aimed-petrify-cone", "bargain-mark", "global-ascension-field", "global-slow-field", "leak-ward",
    "route-front-rewind", "route-point-surge", "scheduled-global-damage",
    "tower-cluster-amplification", "tower-overclock",
  ]);
  assert.equal(Object.isFrozen(Protocols.EFFECT_KINDS), true);
  catalogInput().protocols.forEach(function (protocol) {
    protocol.tiers.forEach(function (tier) {
      assert.notEqual(Protocols.EFFECT_KINDS.indexOf(tier.effect.kind), -1, protocol.protocolId);
    });
  });

  const unknownKind = catalogInput();
  unknownKind.protocols[9].tiers[0].effect.kind = "skyfire-ward";
  assert.throws(() => Protocols.normalizeProtocolCatalog(unknownKind), {
    name: "TypeError", message: /effect kind/i,
  });
  const missingKind = catalogInput();
  delete missingKind.protocols[9].tiers[0].effect.kind;
  assert.throws(() => Protocols.normalizeProtocolCatalog(missingKind), /effect kind/i);
  const scalarEffect = catalogInput();
  scalarEffect.protocols[9].tiers[0].effect = 1;
  assert.throws(() => Protocols.normalizeProtocolCatalog(scalarEffect), /effect/i);
  const arrayEffect = catalogInput();
  arrayEffect.protocols[9].tiers[0].effect = [];
  assert.throws(() => Protocols.normalizeProtocolCatalog(arrayEffect), /effect/i);
  const badFlag = catalogInput();
  badFlag.protocols[8].tiers[0].effect.affectsFutureSpawns = 1;
  assert.throws(() => Protocols.normalizeProtocolCatalog(badFlag), /affectsFutureSpawns/);

  const flagged = catalogInput();
  flagged.protocols[9].tiers[0].effect.affectsFutureSpawns = true;
  assert.equal(emptySkyfirePlan(flagged).denialReason, Protocols.DENIAL_REASONS.MISSING_ELIGIBLE_TARGET);
  const relabelled = catalogInput();
  relabelled.protocols[9].tiers[0].effect.kind = "global-slow-field";
  assert.equal(emptySkyfirePlan(relabelled).denialReason, Protocols.DENIAL_REASONS.MISSING_ELIGIBLE_TARGET);
  const relabelledWard = catalogInput();
  relabelledWard.protocols[9].tiers[0].effect.kind = "global-ascension-field";
  assert.equal(
    emptySkyfirePlan(relabelledWard).denialReason,
    Protocols.DENIAL_REASONS.MISSING_ELIGIBLE_TARGET
  );

  assert.equal(plan({
    context: contextInput({ targetSelection: selection("temporal-edict", { kind: "none" }, []) }),
  }).accepted, true);
  assert.equal(plan({
    context: contextInput({ targetSelection: selection("armara-ascension", { kind: "none" }, []) }),
    command: command({ kind: "none" }, { protocolId: "armara-ascension", tier: 1 }),
  }).accepted, true);
  const wardLoadout = loadoutInput({
    protocolAuthority: [{ protocolId: "aegis-ward", availableTier: 1 }],
    protocols: [{ slot: 0, protocolId: "aegis-ward", tier: 1 }],
    missionLoan: null,
  });
  assert.equal(plan({
    loadout: wardLoadout,
    context: contextInput({ targetSelection: selection("aegis-ward", { kind: "none" }, []) }),
    command: command({ kind: "none" }, { protocolId: "aegis-ward", tier: 1 }),
  }).accepted, true);

  const stripped = catalogInput();
  delete stripped.protocols[8].tiers[0].effect.affectsFutureSpawns;
  assert.equal(plan({
    catalog: stripped,
    context: contextInput({ targetSelection: selection("temporal-edict", { kind: "none" }, []) }),
  }).denialReason, Protocols.DENIAL_REASONS.MISSING_ELIGIBLE_TARGET);
});

test("runtime ledger accepted cast counts are capped at the reviewed command ceiling and deny rather than throw", () => {
  assert.equal(Protocols.MAX_ACCEPTED_CAST_COUNT, 100000);
  assert.equal(Protocols.MAX_ACCEPTED_CAST_COUNT, CommandsV2.DEFAULT_LIMITS.maxTotalCommands);
  const atCap = ledgerInput({
    protocols: [{ protocolId: "temporal-edict", readyTick: 0, acceptedCastCount: 100000 }],
  });
  assert.equal(
    Protocols.normalizeProtocolRuntimeLedger(atCap, catalogInput()).protocols[0].acceptedCastCount,
    100000
  );
  assert.throws(() => Protocols.normalizeProtocolRuntimeLedger(ledgerInput({
    protocols: [{ protocolId: "temporal-edict", readyTick: 0, acceptedCastCount: 100001 }],
  }), catalogInput()), { name: "RangeError", message: /reviewed ceiling/ });
  assert.throws(() => plan({ ledger: ledgerInput({
    protocols: [{ protocolId: "temporal-edict", readyTick: 0, acceptedCastCount: Number.MAX_SAFE_INTEGER }],
  }) }), /reviewed ceiling/);

  const denied = plan({ ledger: atCap });
  assert.equal(denied.accepted, false);
  assert.equal(denied.denialReason, Protocols.DENIAL_REASONS.INSUFFICIENT_AETHER);
  assert.equal(denied.resolvedCastCostAether, 1875075);
});

test("normalized catalogs, loadouts, and ledgers pass through by identity while look-alikes are re-validated", () => {
  const catalog = Protocols.normalizeProtocolCatalog(catalogInput());
  assert.equal(Protocols.normalizeProtocolCatalog(catalog), catalog);
  const loadout = Protocols.normalizeProtocolLoadout(loadoutInput(), catalog);
  assert.equal(Protocols.normalizeProtocolLoadout(loadout, catalog), loadout);
  const ledger = Protocols.normalizeProtocolRuntimeLedger(ledgerInput({
    protocols: [{ protocolId: "temporal-edict", readyTick: 0, acceptedCastCount: 1 }],
  }), catalog);
  assert.equal(Protocols.normalizeProtocolRuntimeLedger(ledger, catalog), ledger);
  const denied = plan({
    catalog: catalog, loadout: loadout, ledger: ledger, context: contextInput({ aether: 0 }),
  });
  assert.equal(denied.denialReason, Protocols.DENIAL_REASONS.INSUFFICIENT_AETHER);
  assert.equal(denied.nextLedger, ledger);
  assert.equal(plan({ catalog: catalog, loadout: loadout, ledger: ledger }).accepted, true);

  const lookAlike = deepFreeze(clone(catalog));
  assert.deepEqual(lookAlike, catalog);
  const rebuilt = Protocols.normalizeProtocolCatalog(lookAlike);
  assert.notEqual(rebuilt, lookAlike);
  assert.deepEqual(rebuilt, catalog);

  const broken = clone(catalog);
  broken.protocols[0].tiers[0].baseCostAether = 0;
  assert.throws(() => Protocols.normalizeProtocolCatalog(deepFreeze(broken)), /positive/i);
  const relabelled = clone(catalog);
  relabelled.protocols[9].tiers[0].effect.kind = "skyfire-ward";
  assert.throws(() => emptySkyfirePlan(deepFreeze(relabelled)), /effect kind/i);
  const unbrandedLoadout = deepFreeze(clone(loadout));
  assert.notEqual(Protocols.normalizeProtocolLoadout(unbrandedLoadout, catalog), unbrandedLoadout);
  const brokenLedger = clone(ledger);
  brokenLedger.protocols[0].acceptedCastCount = 100001;
  assert.throws(
    () => Protocols.normalizeProtocolRuntimeLedger(deepFreeze(brokenLedger), catalog),
    /reviewed ceiling/
  );

  const sameContent = Protocols.normalizeProtocolCatalog(catalogInput());
  assert.notEqual(sameContent, catalog);
  const revalidated = Protocols.normalizeProtocolLoadout(loadout, sameContent);
  assert.notEqual(revalidated, loadout);
  assert.deepEqual(revalidated, loadout);
  assert.notEqual(Protocols.normalizeProtocolRuntimeLedger(ledger, sameContent), ledger);
  const partial = catalogInput();
  partial.protocols = partial.protocols.slice(0, 5);
  const partialCatalog = Protocols.normalizeProtocolCatalog(partial);
  assert.throws(() => Protocols.normalizeProtocolLoadout(loadout, partialCatalog), /unknown protocol/i);
  assert.throws(() => Protocols.normalizeProtocolRuntimeLedger(ledger, partialCatalog), /unknown protocol/i);
});
