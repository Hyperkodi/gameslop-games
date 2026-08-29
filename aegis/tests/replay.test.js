"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI = require("../js/sim/abi.js");
const Commands = require("../js/sim/commands.js");
const ReplayRunner = require("../js/sim/replay-runner.js");
const Replay = require("../js/sim/replay.js");

const ABI_PATH = path.join(__dirname, "..", "js", "sim", "abi.js");
const COMMANDS_PATH = path.join(__dirname, "..", "js", "sim", "commands.js");
const REPLAY_PATH = path.join(__dirname, "..", "js", "sim", "replay.js");
const RULESET_HASH = "sha256:" + "a".repeat(64);
const FINAL_HASH = "b".repeat(64);

function validEnvelope(overrides) {
  return Object.assign({
    formatVersion: 1,
    rulesetHash: RULESET_HASH,
    eventSchemaVersion: 1,
    missionId: "m01",
    difficultyId: "strategos",
    assist: false,
    seed: 123,
    loadoutIds: ["sentinel", "chronos", "siege"],
    loadoutSlotCap: 4,
    campaignModifierIds: ["reserve-1"],
    accessGrantIds: ["campaign.chronos", "campaign.siege"],
    tutorialUpgradeGateMode: "none",
    inputs: [],
    checkpoints: [{ tick: 60, diagnosticHash: "fnv1a32:1234abcd" }],
    finalClaim: {
      outcome: "victory",
      score: 12345,
      laurels: 3,
      durationTicks: 120,
      finalStateHash: FINAL_HASH,
    },
  }, overrides || {});
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function replace(text, from, to) {
  assert.ok(text.includes(from), "fixture token exists: " + from);
  return text.replace(from, to);
}

test("replay API and its explicit resource ceilings are frozen", () => {
  assert.equal(Object.isFrozen(Replay), true);
  assert.equal(Object.isFrozen(Replay.DEFAULT_LIMITS), true);
  assert.equal(Replay.FORMAT_VERSION, 1);
  assert.equal(Replay.EVENT_SCHEMA_VERSION, ABI.EVENT_SCHEMA_VERSION);
  assert.equal(Replay.COMMAND_SCHEMA_VERSION, Commands.COMMAND_SCHEMA_VERSION);
  assert.deepEqual(
    {
      maxTick: Replay.DEFAULT_LIMITS.maxTick,
      maxCommandsPerTick: Replay.DEFAULT_LIMITS.maxCommandsPerTick,
    },
    {
      maxTick: Commands.DEFAULT_LIMITS.maxTick - 1,
      maxCommandsPerTick: Commands.DEFAULT_LIMITS.maxCommandsPerTick,
    }
  );
  assert.equal(Replay.DEFAULT_LIMITS.maxTotalCommands, 4096);
  assert.ok(Replay.DEFAULT_LIMITS.maxTotalCommands < Commands.DEFAULT_LIMITS.maxTotalCommands);
  assert.equal(Replay.DEFAULT_LIMITS.maxUtf8Bytes, 4 * 1024 * 1024);
  assert.equal(Replay.DEFAULT_LIMITS.maxDurationTicks, 5184000);
  assert.equal(Replay.simulateReplay, undefined);
  assert.equal(typeof Replay.createBoundSimulator, "function");
});

test("all advertised replay maxima fit together beneath the tighter four-MiB byte ceiling", () => {
  function maximumId(prefix, index) {
    const stem = prefix + String(index).padStart(4, "0");
    return stem + "x".repeat(Replay.DEFAULT_LIMITS.maxStringLength - stem.length);
  }

  const commands = new Array(Replay.DEFAULT_LIMITS.maxTotalCommands);
  const firstCommandTick = Replay.DEFAULT_LIMITS.maxTick -
    Math.ceil(commands.length / Replay.DEFAULT_LIMITS.maxCommandsPerTick) + 1;
  for (let index = 0; index < commands.length; index++) {
    commands[index] = {
      tick: firstCommandTick + Math.floor(index / Replay.DEFAULT_LIMITS.maxCommandsPerTick),
      seq: index % Replay.DEFAULT_LIMITS.maxCommandsPerTick,
      type: "build",
      padId: maximumId("p", 0),
      defenseId: maximumId("d", 0),
    };
  }
  const checkpoints = new Array(Replay.DEFAULT_LIMITS.maxCheckpoints);
  for (let index = 0; index < checkpoints.length; index++) {
    checkpoints[index] = { tick: index + 1, diagnosticHash: "fnv1a32:1234abcd" };
  }
  const source = validEnvelope({
    loadoutIds: Array.from(
      { length: Replay.DEFAULT_LIMITS.maxLoadoutIds },
      (_, index) => maximumId("l", index)
    ),
    loadoutSlotCap: Replay.DEFAULT_LIMITS.maxLoadoutIds,
    campaignModifierIds: Array.from(
      { length: Replay.DEFAULT_LIMITS.maxCampaignModifierIds },
      (_, index) => maximumId("m", index)
    ),
    accessGrantIds: Array.from(
      { length: Replay.DEFAULT_LIMITS.maxAccessGrantIds },
      (_, index) => maximumId("g", index)
    ),
    inputs: commands,
    checkpoints: checkpoints,
    finalClaim: Object.assign({}, validEnvelope().finalClaim, {
      durationTicks: Replay.DEFAULT_LIMITS.maxDurationTicks,
    }),
  });
  const canonical = Replay.canonicalEnvelopeString(source);
  assert.ok(ABI.utf8Bytes(canonical).length < Replay.DEFAULT_LIMITS.maxUtf8Bytes);
  const parsed = Replay.parseReplayEnvelope(canonical);
  assert.equal(parsed.inputs.length, Replay.DEFAULT_LIMITS.maxTotalCommands);
  assert.equal(parsed.checkpoints.length, Replay.DEFAULT_LIMITS.maxCheckpoints);
  assert.equal(parsed.inputs[parsed.inputs.length - 1].tick, Replay.DEFAULT_LIMITS.maxTick);
});

test("normalization preserves loadout order, freezes copies deeply, and never mutates caller data", () => {
  const source = validEnvelope({ loadoutIds: ["siege", "sentinel", "chronos"] });
  const before = clone(source);
  const normalized = Replay.normalizeReplayEnvelope(source);

  assert.deepEqual(source, before);
  assert.deepEqual(normalized.loadoutIds, ["siege", "sentinel", "chronos"]);
  assert.notEqual(normalized, source);
  assert.notEqual(normalized.loadoutIds, source.loadoutIds);
  assert.notEqual(normalized.finalClaim, source.finalClaim);
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.loadoutIds), true);
  assert.equal(Object.isFrozen(normalized.checkpoints[0]), true);
  assert.equal(Object.isFrozen(normalized.finalClaim), true);
  assert.equal(Object.isFrozen(source), false);
  assert.equal(Object.isFrozen(source.loadoutIds), false);
  assert.doesNotThrow(() => ABI.canonicalEncode(normalized));
});

test("strict v1 envelope, checkpoint, and final-claim fields reject omissions and additions", () => {
  const missing = validEnvelope();
  delete missing.assist;
  assert.throws(() => Replay.normalizeReplayEnvelope(missing), /exactly.*assist/i);
  assert.throws(
    () => Replay.normalizeReplayEnvelope(Object.assign(validEnvelope(), { runId: "local" })),
    /exactly/i
  );

  const checkpointExtra = validEnvelope();
  checkpointExtra.checkpoints[0].state = {};
  assert.throws(() => Replay.normalizeReplayEnvelope(checkpointExtra), /checkpoint.*exactly/i);

  const claimMissing = validEnvelope();
  delete claimMissing.finalClaim.score;
  assert.throws(() => Replay.normalizeReplayEnvelope(claimMissing), /final claim.*exactly/i);
  const claimExtra = validEnvelope();
  claimExtra.finalClaim.timestamp = 1;
  assert.throws(() => Replay.normalizeReplayEnvelope(claimExtra), /final claim.*exactly/i);
});

test("header versions, hashes, scalar types, seed, IDs, and tutorial gate are exact", () => {
  const cases = [
    ["formatVersion", 2, /format version.*1/i],
    ["eventSchemaVersion", 2, /event schema version.*1/i],
    ["rulesetHash", "sha256:" + "A".repeat(64), /ruleset hash/i],
    ["rulesetHash", "a".repeat(64), /ruleset hash/i],
    ["missionId", "bad id", /stable ASCII ID/i],
    ["difficultyId", "strat\u00e9gos", /stable ASCII ID/i],
    ["difficultyId", "oracle", /story, strategos, or titan/i],
    ["assist", 0, /boolean/i],
    ["seed", -1, /nonnegative/i],
    ["seed", 4294967296, /limit/i],
    ["tutorialUpgradeGateMode", "profile", /unsupported/i],
  ];
  for (const item of cases) {
    assert.throws(
      () => Replay.normalizeReplayEnvelope(validEnvelope({ [item[0]]: item[1] })),
      item[2],
      item[0] + "=" + String(item[1])
    );
  }
});

test("loadout capacity is canonical while order and grants remain stable", () => {
  assert.deepEqual(
    Replay.normalizeReplayEnvelope(validEnvelope({ loadoutIds: ["siege", "sentinel"] })).loadoutIds,
    ["siege", "sentinel"]
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({ loadoutIds: ["siege", "siege"] })),
    /unique/i
  );
  assert.throws(() => Replay.normalizeReplayEnvelope(validEnvelope({ loadoutIds: [] })), /must not be empty/i);
  assert.equal(Replay.normalizeReplayEnvelope(validEnvelope()).loadoutSlotCap, 4);
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({ loadoutIds: ["sentinel", "chronos", "siege"], loadoutSlotCap: 2 })),
    /slot cap/i
  );
  assert.throws(() => Replay.normalizeReplayEnvelope(validEnvelope({ loadoutSlotCap: 0 })), /at least one/i);
  assert.throws(() => Replay.normalizeReplayEnvelope(validEnvelope({ loadoutSlotCap: 7 })), /limit/i);
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({ campaignModifierIds: ["reserve-2", "reserve-1"] })),
    /strict ASCII order/i
  );
  const approvedExample = ["campaign.oracle", "campaign.artemis"];
  assert.deepEqual(
    Replay.normalizeReplayEnvelope(validEnvelope({ accessGrantIds: approvedExample })).accessGrantIds,
    approvedExample
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({ accessGrantIds: ["campaign.siege", "campaign.siege"] })),
    /unique|strict ASCII order/i
  );
});

test("Commands owns input schema, ordering, total, per-tick, and tick validation", () => {
  const valid = validEnvelope({
    inputs: [{ tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" }],
  });
  const normalized = Replay.normalizeReplayEnvelope(valid);
  assert.deepEqual(normalized.inputs, valid.inputs);
  assert.notEqual(normalized.inputs, valid.inputs);
  assert.notEqual(normalized.inputs[0], valid.inputs[0]);
  assert.equal(Object.isFrozen(normalized.inputs[0]), true);
  assert.equal(Object.isFrozen(valid.inputs[0]), false);

  const badSequence = validEnvelope({
    inputs: [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 0, type: "sell", towerId: 1 },
    ],
  });
  assert.throws(() => Replay.normalizeReplayEnvelope(badSequence), /seq|sequence/i);

  const twoInputs = validEnvelope({
    inputs: [
      { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" },
      { tick: 0, seq: 1, type: "sell", towerId: 1 },
    ],
  });
  assert.throws(
    () => Replay.normalizeReplayEnvelope(twoInputs, { maxCommandsPerTick: 1 }),
    /per.tick|commands/i
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(twoInputs, { maxTotalCommands: 1 }),
    /total|commands|array length/i
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({
      inputs: [{ tick: 121, seq: 0, type: "skipTutorialGate" }],
    })),
    /input tick.*duration/i
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({
      inputs: [{ tick: 120, seq: 0, type: "skipTutorialGate" }],
      checkpoints: [],
    })),
    /strictly less than final duration/i
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({
      inputs: [{ tick: 0, seq: 0, type: "skipTutorialGate" }],
      checkpoints: [],
      finalClaim: Object.assign({}, validEnvelope().finalClaim, { durationTicks: 0 }),
    })),
    /strictly less than final duration/i
  );
  assert.doesNotThrow(() => Replay.normalizeReplayEnvelope(validEnvelope({
    inputs: [],
    checkpoints: [],
    finalClaim: Object.assign({}, validEnvelope().finalClaim, { durationTicks: 0 }),
  })));
});

test("checkpoint records require strict tick order, bounded duration, and lowercase hash syntax", () => {
  const unordered = validEnvelope({
    checkpoints: [
      { tick: 60, diagnosticHash: "fnv1a32:1234abcd" },
      { tick: 60, diagnosticHash: "fnv1a32:87654321" },
    ],
  });
  assert.throws(() => Replay.normalizeReplayEnvelope(unordered), /strictly increasing/i);
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({
      checkpoints: [{ tick: 60, diagnosticHash: "fnv1a32:1234ABCD" }],
    })),
    /diagnostic hash/i
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({
      checkpoints: [{ tick: 121, diagnosticHash: "fnv1a32:1234abcd" }],
    })),
    /checkpoint tick.*duration/i
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope(), { maxCheckpoints: 0 }),
    /checkpoint.*array length/i
  );
});

test("final claim validates terminal outcome, integer score/laurels, duration, and SHA-256", () => {
  const cases = [
    [{ outcome: "quit" }, /outcome/i],
    [{ score: -1 }, /score.*nonnegative/i],
    [{ score: 1.5 }, /score.*safe integer/i],
    [{ laurels: 4 }, /Laurels.*limit/i],
    [{ durationTicks: -1 }, /duration.*nonnegative/i],
    [{ finalStateHash: "sha256:" + FINAL_HASH }, /final state hash/i],
    [{ finalStateHash: "B".repeat(64) }, /final state hash/i],
  ];
  for (const item of cases) {
    const envelope = validEnvelope();
    envelope.finalClaim = Object.assign({}, envelope.finalClaim, item[0]);
    assert.throws(() => Replay.normalizeReplayEnvelope(envelope), item[1]);
  }
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope(), { maxDurationTicks: 119 }),
    /duration.*limit/i
  );
  assert.equal(
    Replay.normalizeReplayEnvelope(validEnvelope({
      finalClaim: Object.assign({}, validEnvelope().finalClaim, { outcome: "defeat", laurels: 0 }),
    })).finalClaim.outcome,
    "defeat"
  );
});

test("strict parser rejects duplicate decoded keys, BOM, trailing data, and noninteger JSON numbers", () => {
  const canonical = JSON.stringify(validEnvelope());
  const duplicate = replace(canonical, '"formatVersion":1', '"formatVersion":1,"format\\u0056ersion":1');
  assert.throws(() => Replay.parseReplayEnvelope(duplicate), /duplicate object key/i);
  assert.throws(() => Replay.parseReplayEnvelope("\ufeff" + canonical), /BOM/i);
  assert.throws(() => Replay.parseReplayEnvelope(canonical + " null"), /trailing data/i);
  assert.throws(
    () => Replay.parseReplayEnvelope(replace(canonical, '"seed":123', '"seed":123.0')),
    /numbers must be integers/i
  );
  assert.throws(
    () => Replay.parseReplayEnvelope(replace(canonical, '"seed":123', '"seed":1e2')),
    /numbers must be integers/i
  );
  assert.throws(
    () => Replay.parseReplayEnvelope(replace(canonical, '"seed":123', '"seed":9007199254740992')),
    /safe integer/i
  );
  assert.throws(
    () => Replay.parseReplayEnvelope(replace(canonical, '"seed":123', '"seed":-0')),
    /negative zero/i
  );
});

test("byte parser rejects BOM, malformed/overlong UTF-8, surrogates, and oversized source before normalization", () => {
  const canonical = JSON.stringify(validEnvelope());
  const bytes = ABI.utf8Bytes(canonical);
  assert.deepEqual(Replay.parseReplayEnvelope(bytes), Replay.normalizeReplayEnvelope(validEnvelope()));
  assert.throws(
    () => Replay.parseReplayEnvelope(Uint8Array.from([0xef, 0xbb, 0xbf].concat(Array.from(bytes)))),
    /BOM/i
  );
  for (const malformed of [
    [0xc0, 0xaf],
    [0xe0, 0x80, 0xaf],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [0x80],
  ]) {
    assert.throws(() => Replay.parseReplayEnvelope(Uint8Array.from(malformed)), /invalid UTF-8/i);
  }
  assert.throws(
    () => Replay.parseReplayEnvelope(replace(canonical, '"missionId":"m01"', '"missionId":"\\ud800"')),
    /lone Unicode surrogate/i
  );
  assert.throws(
    () => Replay.parseReplayEnvelope(bytes, { maxUtf8Bytes: bytes.length - 1 }),
    /UTF-8 byte limit/i
  );
  const spoof = { 0: 0x7b, length: 1, [Symbol.toStringTag]: "Uint8Array" };
  assert.throws(() => Replay.parseReplayEnvelope(spoof), /string or Uint8Array/i);
});

test("parser bounds string, object, array, and nesting work before schema normalization", () => {
  const canonical = JSON.stringify(validEnvelope());
  assert.throws(
    () => Replay.parseReplayEnvelope(canonical, { maxStringLength: 8 }),
    /string length limit/i
  );
  assert.throws(
    () => Replay.parseReplayEnvelope(canonical, { maxObjectFields: 13 }),
    /field limit/i
  );
  assert.throws(
    () => Replay.parseReplayEnvelope(canonical, {
      maxArrayLength: 2,
      maxLoadoutIds: 2,
      maxCampaignModifierIds: 2,
      maxAccessGrantIds: 2,
      maxCheckpoints: 2,
      maxTotalCommands: 2,
    }),
    /parser array limit/i
  );
  assert.throws(
    () => Replay.parseReplayEnvelope(canonical, { maxNestingDepth: 1 }),
    /nesting depth/i
  );
});

test("caller limits may tighten known defaults but cannot relax or smuggle unknown policy", () => {
  const strict = Replay.createReplayLimits({ maxCheckpoints: 2, maxTick: 120 });
  assert.equal(Object.isFrozen(strict), true);
  assert.equal(strict.maxCheckpoints, 2);
  assert.equal(strict.maxTick, 120);
  assert.equal(strict.maxUtf8Bytes, Replay.DEFAULT_LIMITS.maxUtf8Bytes);
  assert.throws(() => Replay.createReplayLimits({ maxTick: Replay.DEFAULT_LIMITS.maxTick + 1 }), /relax/i);
  assert.throws(() => Replay.createReplayLimits({ maxTick: -1 }), /nonnegative/i);
  assert.throws(() => Replay.createReplayLimits({ maxInputs: 1 }), /unknown/i);
  const accessor = {};
  Object.defineProperty(accessor, "maxTick", { enumerable: true, get() { throw new Error("read"); } });
  assert.throws(() => Replay.createReplayLimits(accessor), /data properties/i);
});

test("direct and parsed envelopes enforce the same explicit nesting-depth semantics", () => {
  const depthTwo = validEnvelope({ inputs: [], checkpoints: [] });
  assert.doesNotThrow(() => Replay.normalizeReplayEnvelope(depthTwo, { maxNestingDepth: 2 }));
  assert.doesNotThrow(() => Replay.parseReplayEnvelope(JSON.stringify(depthTwo), { maxNestingDepth: 2 }));

  const depthThree = validEnvelope({
    inputs: [{ tick: 0, seq: 0, type: "startWave" }],
    checkpoints: [],
  });
  assert.throws(
    () => Replay.normalizeReplayEnvelope(depthThree, { maxNestingDepth: 2 }),
    /nesting depth/i
  );
  assert.throws(
    () => Replay.parseReplayEnvelope(JSON.stringify(depthThree), { maxNestingDepth: 2 }),
    /nesting depth/i
  );

  const checkpointDepthThree = validEnvelope({ inputs: [] });
  assert.throws(
    () => Replay.normalizeReplayEnvelope(checkpointDepthThree, { maxNestingDepth: 2 }),
    /nesting depth/i
  );
  assert.throws(
    () => Replay.parseReplayEnvelope(JSON.stringify(checkpointDepthThree), { maxNestingDepth: 2 }),
    /nesting depth/i
  );
});

test("canonical envelope text/bytes are stable, parser-independent, and fresh", () => {
  const source = validEnvelope({ loadoutIds: ["siege", "sentinel", "chronos"] });
  const canonical = Replay.canonicalEnvelopeString(source);
  assert.equal(canonical, ABI.canonicalEncode(Replay.normalizeReplayEnvelope(source)));
  assert.equal(canonical.includes("\n"), false);
  assert.equal(Replay.canonicalEnvelopeString("  " + JSON.stringify(source) + "\n"), canonical);

  const first = Replay.canonicalEnvelopeBytes(source);
  const second = Replay.canonicalEnvelopeBytes(source);
  assert.ok(first instanceof Uint8Array);
  assert.ok(second instanceof Uint8Array);
  assert.notEqual(first, second);
  assert.deepEqual(Array.from(first), Array.from(ABI.utf8Bytes(canonical)));
  first[0] ^= 0xff;
  assert.deepEqual(Array.from(second), Array.from(ABI.utf8Bytes(canonical)));
});

test("canonical state diagnostic FNV-1a and final SHA-256 helpers match frozen vectors", () => {
  const state = { tick: 60, bountyRemainder: 9000, rng: { wave: 123 } };
  assert.equal(ABI.canonicalEncode(state), '{"bountyRemainder":9000,"rng":{"wave":123},"tick":60}');
  assert.equal(Replay.diagnosticStateHash(state), "fnv1a32:80ab317b");
  assert.equal(
    Replay.finalStateHash(state),
    "74192902834fc499f934060f80b774b277fca7983b1281f643d7486a199591ed"
  );
  assert.throws(() => Replay.diagnosticStateHash({ value: 1.5 }), /integer/i);
  assert.throws(() => Replay.finalStateHash({ value: undefined }), /unsupported/i);
});

test("direct object boundary rejects accessors, sparse arrays, shared input nodes, and lone surrogates", () => {
  const accessor = validEnvelope();
  Object.defineProperty(accessor, "seed", { enumerable: true, get() { throw new Error("should not execute"); } });
  assert.throws(() => Replay.normalizeReplayEnvelope(accessor), /data properties/i);

  const sparse = validEnvelope();
  sparse.loadoutIds = new Array(2);
  sparse.loadoutIds[0] = "sentinel";
  assert.throws(() => Replay.normalizeReplayEnvelope(sparse), /dense array/i);

  const shared = { tick: 0, seq: 0, type: "build", padId: "p01", defenseId: "sentinel" };
  const repeated = validEnvelope({ inputs: [shared, shared] });
  assert.throws(() => Replay.normalizeReplayEnvelope(repeated), /sequence|shared/i);

  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({ missionId: "m\ud800" })),
    /lone Unicode surrogate/i
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({ seed: -0 })),
    /negative zero/i
  );
  assert.throws(
    () => Replay.normalizeReplayEnvelope(validEnvelope({
      inputs: [{ tick: -0, seq: 0, type: "startWave" }],
      checkpoints: [],
    })),
    /negative zero/i
  );
});

test("CommonJS and classic installs reject stale Commands identity and cannot silently drop replay inputs", () => {
  const replaySource = fs.readFileSync(REPLAY_PATH, "utf8");
  let staleCalls = 0;
  function fakeCommands(descriptorHash) {
    return Object.freeze({
      ABI_DESCRIPTOR_SHA256: descriptorHash,
      COMMAND_SCHEMA_VERSION: 1,
      DEFAULT_LIMITS: Object.freeze({
        maxCommandsPerTick: 64,
        maxTick: 5184000,
        maxTotalCommands: 100000,
      }),
      normalizeCommandSequence() {
        staleCalls++;
        return Object.freeze([]);
      },
    });
  }
  const stale = fakeCommands("0".repeat(64));

  assert.throws(() => vm.runInNewContext(replaySource, {
    module: { exports: {} },
    require(request) {
      if (request === "./abi.js") return ABI;
      if (request === "./commands.js") return stale;
      if (request === "./replay-runner.js") return ReplayRunner;
      throw new Error("unexpected require " + request);
    },
  }, {
    filename: "replay.js",
    codeGeneration: { strings: false, wasm: false },
  }), /ABI descriptor identity/i);

  assert.throws(() => vm.runInNewContext(replaySource, {
    Game: { AegisSim: ABI, AegisCommands: stale, AegisReplayRunner: ReplayRunner },
  }, {
    filename: "replay.js",
    codeGeneration: { strings: false, wasm: false },
  }), /ABI descriptor identity/i);
  assert.equal(staleCalls, 0, "a stale Commands implementation is rejected before it can inspect inputs");

  const matchingDropper = fakeCommands(ABI.DESCRIPTOR_SHA256);
  const commonJsModule = { exports: {} };
  vm.runInNewContext(replaySource, {
    module: commonJsModule,
    require(request) {
      if (request === "./abi.js") return ABI;
      if (request === "./commands.js") return matchingDropper;
      if (request === "./replay-runner.js") return ReplayRunner;
      throw new Error("unexpected require " + request);
    },
  }, {
    filename: "replay.js",
    codeGeneration: { strings: false, wasm: false },
  });
  const withInput = validEnvelope({
    inputs: [{ tick: 0, seq: 0, type: "startWave" }],
    checkpoints: [],
  });
  assert.throws(
    () => commonJsModule.exports.parseReplayEnvelope(JSON.stringify(withInput)),
    /preserve every normalized replay input/i
  );

  const classicDropContext = vm.createContext({
    Game: {
      AegisSim: ABI,
      AegisCommands: matchingDropper,
      AegisReplayRunner: ReplayRunner,
    },
    replayJson: JSON.stringify(withInput),
  }, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(replaySource, classicDropContext, { filename: "replay.js" });
  assert.throws(
    () => vm.runInContext("Game.AegisReplay.parseReplayEnvelope(replayJson)", classicDropContext),
    /preserve every normalized replay input/i
  );
});

test("classic scripts match CommonJS canonical bytes and hashes with dynamic code disabled", () => {
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(fs.readFileSync(ABI_PATH, "utf8"), context, { filename: "abi.js" });
  vm.runInContext(fs.readFileSync(COMMANDS_PATH, "utf8"), context, { filename: "commands.js" });
  context.Game.AegisReplayRunner = ReplayRunner;
  vm.runInContext(fs.readFileSync(REPLAY_PATH, "utf8"), context, { filename: "replay.js" });

  assert.ok(context.Game.AegisReplay);
  assert.equal(Object.isFrozen(context.Game.AegisReplay), true);
  assert.equal(context.require, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.localStorage, undefined);
  assert.equal(context.Game.AegisReplay.simulateReplay, undefined);
  const envelopeJson = JSON.stringify(validEnvelope());
  context.envelopeJson = envelopeJson;
  const parsed = context.Game.AegisReplay.parseReplayEnvelope(envelopeJson);
  assert.equal(parsed.missionId, "m01");
  assert.equal(Object.isFrozen(parsed.finalClaim), true);

  const expectedString = Replay.canonicalEnvelopeString(envelopeJson);
  const classicString = vm.runInContext(
    "Game.AegisReplay.canonicalEnvelopeString(envelopeJson)",
    context
  );
  assert.equal(classicString, expectedString);
  const classicBytes = JSON.parse(vm.runInContext(
    "JSON.stringify(Array.from(Game.AegisReplay.canonicalEnvelopeBytes(envelopeJson)))",
    context
  ));
  assert.deepEqual(classicBytes, Array.from(Replay.canonicalEnvelopeBytes(envelopeJson)));

  const state = { tick: 60, bountyRemainder: 9000, rng: { wave: 123 } };
  context.stateJson = JSON.stringify(state);
  assert.equal(
    vm.runInContext("Game.AegisReplay.diagnosticStateHash(JSON.parse(stateJson))", context),
    Replay.diagnosticStateHash(state)
  );
  assert.equal(
    vm.runInContext("Game.AegisReplay.finalStateHash(JSON.parse(stateJson))", context),
    Replay.finalStateHash(state)
  );
});
