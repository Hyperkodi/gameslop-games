"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ABI_V1 = require("../js/sim/abi.js");
const ABI_V2_PATH = path.join(__dirname, "..", "js", "sim", "abi-v2.js");
const ABI_V2 = require(ABI_V2_PATH);

const V1_GOLDEN = "4a788f71581d4b1c4e79318d72ae45ffa1c6b79281c3ae32e6c29f22a8b2256b";
const V2_GOLDEN = "5f02c369c5331f65196090e00cdf09a7aa4458376f35057c0b5750202a0ea76b";

test("ABI v2 is additive, authenticated, and leaves the v1 identity byte-exact", () => {
  assert.equal(ABI_V1.DESCRIPTOR_SHA256, V1_GOLDEN);
  assert.equal(ABI_V1.DESCRIPTOR.version, 1);
  assert.equal(ABI_V2.DESCRIPTOR.version, 2);
  assert.equal(ABI_V2.BASE_ABI_DESCRIPTOR_SHA256, V1_GOLDEN);
  assert.equal(ABI_V2.DESCRIPTOR.baseAbiDescriptorSha256, V1_GOLDEN);
  assert.equal(ABI_V2.DESCRIPTOR_SHA256, V2_GOLDEN);
  assert.equal(ABI_V2.DESCRIPTOR_SHA256, ABI_V1.sha256Hex(ABI_V2.DESCRIPTOR_CANONICAL));
  assert.equal(Object.isFrozen(ABI_V2), true);
  assert.equal(Object.isFrozen(ABI_V2.DESCRIPTOR), true);
});

test("ABI v2 binds every exact command family and target tagged union", () => {
  assert.deepEqual(ABI_V2.DESCRIPTOR.commands.families, [
    { type: "build", fields: ["tick", "seq", "type", "padId", "defenseId"] },
    { type: "upgrade", fields: ["tick", "seq", "type", "towerId"] },
    { type: "sell", fields: ["tick", "seq", "type", "towerId"] },
    { type: "startWave", fields: ["tick", "seq", "type"] },
    { type: "skipTutorialGate", fields: ["tick", "seq", "type"] },
    { type: "setTargetPolicy", fields: ["tick", "seq", "type", "towerId", "policy"] },
    { type: "specializeTower", fields: ["tick", "seq", "type", "towerRuntimeId", "specializationId"] },
    { type: "activatePower", fields: ["tick", "seq", "type", "protocolId", "tier", "target"] },
    { type: "deployReinforcement", fields: ["tick", "seq", "type", "reinforcementId", "markerId"] },
    { type: "activateMechanism", fields: ["tick", "seq", "type", "mechanismId", "activationId"] },
    { type: "resetPlan", fields: ["tick", "seq", "type"] },
  ]);
  assert.deepEqual(ABI_V2.DESCRIPTOR.commands.targetUnion, [
    { kind: "none", fields: ["kind"] },
    { kind: "route-point", fields: ["kind", "routeId", "routeDistance"] },
    { kind: "tower", fields: ["kind", "towerRuntimeId"] },
    { kind: "world-vector", fields: ["kind", "originX", "originY", "aimX", "aimY"] },
  ]);
  assert.equal(ABI_V2.DESCRIPTOR.commands.schemaVersion, 2);
  assert.equal(ABI_V2.DESCRIPTOR.commands.authoredIdMaxLength, 128);
  assert.deepEqual(ABI_V2.DESCRIPTOR.semanticEvents, {
    id: "armara-aegis-semantic-events",
    schemaVersion: 2,
  });
  assert.deepEqual(ABI_V2.DESCRIPTOR.behaviorRegistry, {
    id: "armara-aegis-behavior-registry",
    version: 2,
  });
});

test("ABI v2 re-exports the authenticated v1 exact math and canonical primitives by identity", () => {
  [
    "assertSafeInteger", "checkedAdd", "checkedMultiply", "floorDivNonnegative",
    "ceilDivNonnegative", "truncDivSigned", "checkedMulDivFloor", "checkedMulDivCeil",
    "parseExactDecimal", "authoredMillisecondsToTimeUnits", "canonicalEncode", "canonicalBytes",
    "utf8Bytes", "sha256Hex", "fnv1a32", "refundSeventyPercent",
  ].forEach(function (name) {
    assert.strictEqual(ABI_V2[name], ABI_V1[name], name);
  });
  assert.equal(ABI_V2.BASIS_POINTS, 10000);
  assert.equal(ABI_V2.TICKS_PER_SECOND, 60);
  assert.equal(ABI_V2.TIME_UNITS_PER_SECOND, 60000);
});

test("classic ABI v2 installs beside v1 without DOM, storage, network, or dynamic code", () => {
  const source = fs.readFileSync(ABI_V2_PATH, "utf8");
  assert.deepEqual(
    Array.from(source.matchAll(/\brequire\("([^"]+)"\)/g), (match) => match[1]),
    ["./abi.js"]
  );
  const context = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "sim", "abi.js"), "utf8"), context);
  vm.runInContext(source, context);
  assert.equal(context.Game.AegisSim.DESCRIPTOR.version, 1);
  assert.equal(context.Game.AegisSimV2.DESCRIPTOR_SHA256, V2_GOLDEN);
  assert.equal(Object.isFrozen(context.Game.AegisSimV2), true);
  assert.equal(context.document, undefined);
  assert.equal(context.fetch, undefined);
  assert.equal(context.localStorage, undefined);
  assert.equal(context.WebSocket, undefined);

  assert.throws(() => vm.runInNewContext(source, {}, {
    codeGeneration: { strings: false, wasm: false },
  }), /AegisSim/);
});
