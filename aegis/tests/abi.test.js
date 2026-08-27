"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI_PATH = path.join(__dirname, "..", "js", "sim", "abi.js");
const VECTORS = require("./fixtures/abi-v1-vectors.json");
const A = require(ABI_PATH);

test("ABI v1 descriptor fixes every deterministic scale and is deeply immutable", () => {
  assert.deepEqual(A.DESCRIPTOR, VECTORS.descriptor.value);
  assert.equal(Object.isFrozen(A), true);
  assert.equal(Object.isFrozen(A.DESCRIPTOR), true);
  assert.equal(Object.isFrozen(A.DESCRIPTOR.externalCapsBp), true);
  assert.equal(Object.isFrozen(A.DESCRIPTOR.phaseOrder), true);
  assert.equal(Object.isFrozen(A.DESCRIPTOR.geometry), true);
  assert.equal(Object.isFrozen(A.BEHAVIOR_CONTRACTS), true);
  assert.equal(Object.isFrozen(A.BEHAVIOR_CONTRACTS[0]), true);
  assert.strictEqual(A.BEHAVIOR_CONTRACTS, A.DESCRIPTOR.behaviorRegistry.contracts);
  assert.equal(Object.isFrozen(A.DESCRIPTOR.damagePipeline.resolutionOrder), true);
  assert.equal(Object.isFrozen(A.DESCRIPTOR.canonicalEncoding), true);
  assert.throws(() => { A.DESCRIPTOR.damageScale = 1; }, TypeError);
});

test("descriptor canonical bytes and synchronous SHA-256 identity are frozen goldens", () => {
  const canonical = A.canonicalEncode(A.DESCRIPTOR);
  const bytes = A.descriptorCanonicalBytes();
  assert.equal(new TextDecoder().decode(bytes), canonical);
  assert.equal(bytes.length, VECTORS.descriptor.canonicalByteLength);
  assert.equal(A.DESCRIPTOR_SHA256, VECTORS.descriptor.sha256);
  assert.equal(A.sha256Hex(bytes), VECTORS.descriptor.sha256);
  bytes[0] ^= 0xff;
  assert.notDeepEqual(Array.from(bytes), Array.from(A.descriptorCanonicalBytes()));
});

test("strict decimal parsing is exact, signed, bounded to three places, and rejects exponent syntax", () => {
  for (const vector of VECTORS.decimal) {
    assert.equal(A.parseExactDecimal(vector.input, vector.scale), vector.output, vector.input);
  }
  for (const input of VECTORS.invalidDecimal) {
    assert.throws(() => A.parseExactDecimal(input, 1000), /decimal/i, input);
  }
  assert.throws(() => A.parseExactDecimal(1.5, 1000), /string/i);
  assert.throws(() => A.parseExactDecimal("0.001", 100), /represent/i);
  assert.throws(() => A.parseExactDecimal("9007199254740991", 1000), /safe integer/i);
});

test("checked integer division and cross-cancelled rational math preserve named rounding boundaries", () => {
  assert.equal(A.floorDivNonnegative(10, 3), 3);
  assert.equal(A.ceilDivNonnegative(10, 3), 4);
  assert.equal(A.ceilDivNonnegative(9, 3), 3);
  assert.equal(A.truncDivSigned(-10, 3), -3);
  assert.equal(A.truncDivSigned(10, 3), 3);
  assert.throws(() => A.floorDivNonnegative(-1, 3), /nonnegative/i);
  assert.throws(() => A.checkedAdd(Number.MAX_SAFE_INTEGER, 1), /safe integer/i);
  assert.throws(() => A.checkedMultiply(Number.MAX_SAFE_INTEGER, 2), /safe integer/i);

  const floorVector = VECTORS.rational.crossCancelledFloor;
  assert.equal(
    A.checkedMulDivFloor(floorVector.base, floorVector.numerators, floorVector.denominators),
    floorVector.output
  );
  const ceilVector = VECTORS.rational.cooldownCeiling;
  assert.equal(
    A.checkedMulDivCeil(ceilVector.base, ceilVector.numerators, ceilVector.denominators),
    ceilVector.output
  );
  assert.throws(() => A.checkedMulDivFloor(1, [1], [0]), /denominator/i);
});

test("time, cooldown, range, and strongest-slow helpers implement the descriptor formulas exactly", () => {
  for (const vector of VECTORS.timeAndEffects.authoredMilliseconds) {
    assert.equal(A.authoredMillisecondsToTimeUnits(vector.milliseconds), vector.output);
  }
  for (const vector of VECTORS.timeAndEffects.cooldown) {
    assert.equal(
      A.effectiveCooldownUnits(vector.baseCooldownUnits, vector.externalRateBp),
      vector.output
    );
  }
  for (const vector of VECTORS.timeAndEffects.range) {
    assert.equal(A.effectiveRangeUnits(vector.baseRangeUnits, vector.externalRangeBp), vector.output);
  }
  for (const vector of VECTORS.timeAndEffects.slow) {
    assert.deepEqual(
      A.resolveStrongestSlowBp(
        vector.strongestReductionBp,
        vector.enemySlowControlBp,
        vector.enemyMinMovementBp
      ),
      vector.output
    );
  }
  assert.throws(() => A.authoredMillisecondsToTimeUnits(1.5), /integer/i);
  assert.throws(() => A.effectiveCooldownUnits(24600, 1501), /rate/i);
  assert.throws(() => A.effectiveRangeUnits(22000, 1201), /range/i);
  assert.throws(() => A.resolveStrongestSlowBp(10001, 10000, 5200), /reduction/i);
});

test("milli-damage applies internal coefficients before one external coefficient and floors once", () => {
  for (const key of ["damageChain", "multiCoefficientDamage"]) {
    const vector = VECTORS.rational[key];
    assert.equal(
      A.preShieldDamageMilli(
        vector.baseDamageMilli,
        vector.internalDamageBp,
        vector.externalDamageBp
      ),
      vector.output,
      key
    );
  }
  assert.equal(A.preShieldDamageMilli(8000, [], 800), 8640);
  assert.throws(() => A.preShieldDamageMilli(8000, [], 2001), /external damage/i);
});

test("seventy-percent refunds use exact integer arithmetic", () => {
  for (const vector of VECTORS.refunds) {
    assert.equal(A.refundSeventyPercent(vector.invested), vector.output, String(vector.invested));
  }
  assert.equal(A.refundSeventyPercent(0), 0);
  assert.throws(() => A.refundSeventyPercent(-1), /nonnegative/i);
});

test("canonical encoding sorts ASCII keys and rejects noncanonical state values", () => {
  const value = { z: null, a: [3, true, "Ω"], nested: { b: 2, a: 1 } };
  assert.equal(A.canonicalEncode(value), VECTORS.canonical.encoded);
  assert.deepEqual(Array.from(A.canonicalBytes(value)), Array.from(Buffer.from(VECTORS.canonical.encoded, "utf8")));
  assert.equal(A.canonicalEncode(-0), "0");

  assert.throws(() => A.canonicalEncode({ "café": 1 }), /ASCII/i);
  assert.throws(() => A.canonicalEncode({ value: 1.25 }), /integer/i);
  assert.throws(() => A.canonicalEncode({ value: Number.MAX_SAFE_INTEGER + 1 }), /safe integer/i);
  assert.throws(() => A.canonicalEncode({ value: undefined }), /unsupported/i);
  assert.throws(() => A.canonicalEncode([1, , 3]), /sparse/i);
  const extra = [1]; extra["4294967295"] = 2;
  assert.throws(() => A.canonicalEncode(extra), /extra properties/i);
  const accessor = [1];
  Object.defineProperty(accessor, "0", { enumerable: true, get() { return 1; } });
  assert.throws(() => A.canonicalEncode(accessor), /data properties/i);
  const hidden = [1];
  Object.defineProperty(hidden, "0", { enumerable: false, value: 1 });
  assert.throws(() => A.canonicalEncode(hidden), /data properties/i);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => A.canonicalEncode(cyclic), /cycle|shared/i);
});

test("FNV-1a, named stream seeds, and Mulberry32 match fixed UTF-8 vectors", () => {
  for (const vector of VECTORS.fnv1a32) {
    assert.equal(A.fnv1a32(vector.input), vector.output, vector.input);
  }
  assert.equal(
    A.deriveNamedSeed(VECTORS.namedSeed.missionSeed, VECTORS.namedSeed.streamId),
    VECTORS.namedSeed.output
  );
  let state = VECTORS.mulberry32.seed;
  const steps = VECTORS.mulberry32.uint32Outputs.map((expected, index) => {
    const step = A.mulberry32Step(state);
    assert.equal(Object.isFrozen(step), true);
    assert.equal(step.state, VECTORS.mulberry32.states[index]);
    assert.equal(step.uint32, expected);
    state = step.state;
    return step.uint32;
  });
  assert.deepEqual(steps, VECTORS.mulberry32.uint32Outputs);
  const rng = A.mulberry32(VECTORS.mulberry32.seed);
  const outputs = VECTORS.mulberry32.uint32Outputs.map(() => Math.floor(rng() * 4294967296));
  assert.deepEqual(outputs, VECTORS.mulberry32.uint32Outputs);
  assert.throws(() => A.deriveNamedSeed(-1, "wave:m01"), /unsigned/i);
  assert.throws(() => A.deriveNamedSeed(1, "wávé"), /ASCII/i);
  assert.throws(() => A.mulberry32Step(-1), /unsigned/i);
});

test("self-contained synchronous SHA-256 matches standard string and byte vectors", () => {
  for (const vector of VECTORS.sha256) {
    const bytes = A.sha256Bytes(vector.input);
    assert.equal(bytes.length, 32);
    assert.equal(A.sha256Hex(vector.input), vector.output, vector.input);
    assert.equal(Buffer.from(bytes).toString("hex"), vector.output, vector.input);
    assert.equal(A.sha256Hex(A.utf8Bytes(vector.input)), vector.output, vector.input + " bytes");
  }
  assert.throws(() => A.sha256Bytes({}), /string|bytes/i);
});

test("SHA-256 padding stays correct across one- and two-block boundaries", () => {
  for (const vector of VECTORS.sha256Repeats) {
    assert.equal(A.sha256Hex(vector.character.repeat(vector.count)), vector.output, String(vector.count));
  }
});

test("classic-script execution installs only frozen Game.AegisSim and requires no kit, DOM, or network", () => {
  const source = fs.readFileSync(ABI_PATH, "utf8");
  const context = vm.createContext({});
  vm.runInContext(source, context, { filename: "abi.js" });

  assert.ok(context.Game);
  assert.ok(context.Game.AegisSim);
  assert.equal(context.GameSlopKit, undefined);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.require, undefined);
  assert.equal(Object.isFrozen(context.Game.AegisSim), true);
  assert.equal(context.Game.AegisSim.preShieldDamageMilli(8000, [], 800), 8640);
  assert.equal(context.Game.AegisSim.deriveNamedSeed(123, "wave:m01"), 3996353814);
  assert.equal(
    context.Game.AegisSim.sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});
